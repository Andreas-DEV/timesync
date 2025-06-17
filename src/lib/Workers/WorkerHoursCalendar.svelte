<!-- src/lib/components/WorkerHoursCalendar.svelte -->
<script>
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';

	const pb = new PocketBase('https://timesync.pockethost.io');

	let currentDate = new Date();
	let workerHours = [];
	let loading = true;
	let hoveredHours = null;
	let mousePosition = { x: 0, y: 0 };

	// Delete modal state
	let showDeleteModal = false;
	let hoursToDelete = null;
	let isDeleting = false;

	// Color mapping for different hour ranges
	const hoursColors = {
		'0-4': 'bg-red-100 border-red-300 text-red-800',
		'4-6': 'bg-orange-100 border-orange-300 text-orange-800',
		'6-8': 'bg-yellow-100 border-yellow-300 text-yellow-800',
		'8-10': 'bg-green-100 border-green-300 text-green-800',
		'10+': 'bg-blue-100 border-blue-300 text-blue-800'
	};

	$: currentYear = currentDate.getFullYear();
	$: currentMonth = currentDate.getMonth();

	// Get days in current month
	$: daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
	$: firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
	$: monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
		month: 'long', 
		year: 'numeric' 
	});

	// Generate calendar days
	$: calendarDays = (() => {
		const days = [];
		
		// Add empty cells for days before the first day of the month
		for (let i = 0; i < firstDayOfMonth; i++) {
			days.push(null);
		}
		
		// Add days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(day);
		}
		
		return days;
	})();

	// Get worker hours for a specific date
	function getHoursForDate(day) {
		if (!day) return [];
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		
		const dayHours = workerHours.filter(log => {
			// Handle different date formats that might come from PocketBase
			let logDateOnly;
			if (log.dato.includes('T')) {
				// ISO format: "2025-06-05T00:00:00.000Z"
				logDateOnly = log.dato.split('T')[0];
			} else if (log.dato.includes(' ')) {
				// Space format: "2025-06-05 00:00:00.000Z"
				logDateOnly = log.dato.split(' ')[0];
			} else {
				// Date only format: "2025-06-05"
				logDateOnly = log.dato;
			}
			return logDateOnly === dateStr;
		});
		
		return dayHours;
	}

	// Get color class based on total hours
	function getHoursColor(totalHours) {
		if (totalHours < 4) return hoursColors['0-4'];
		if (totalHours < 6) return hoursColors['4-6'];
		if (totalHours < 8) return hoursColors['6-8'];
		if (totalHours < 10) return hoursColors['8-10'];
		return hoursColors['10+'];
	}

	// Navigate months
	function previousMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1);
		setTimeout(() => fetchWorkerHours(), 0);
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
		setTimeout(() => fetchWorkerHours(), 0);
	}

	// Handle mouse events for tooltip
	function handleMouseEnter(event, hours) {
		hoveredHours = hours;
		updateMousePosition(event);
	}

	function handleMouseMove(event) {
		if (hoveredHours) {
			updateMousePosition(event);
		}
	}

	function handleMouseLeave() {
		hoveredHours = null;
	}

	function updateMousePosition(event) {
		mousePosition = {
			x: event.clientX,
			y: event.clientY
		};
	}

	// Handle double click on worker hours entry
	function handleHoursDoubleClick(hours) {
		hoursToDelete = hours;
		showDeleteModal = true;
	}

	// Close delete modal
	function closeDeleteModal() {
		showDeleteModal = false;
		hoursToDelete = null;
		isDeleting = false;
	}

	// Delete worker hours entry
	async function deleteWorkerHours() {
		if (!hoursToDelete) return;
		
		isDeleting = true;
		try {
			await pb.collection('worker_hours').delete(hoursToDelete.id);
			
			// Close modal first
			closeDeleteModal();
			
			// Refresh the calendar to ensure data is up to date
			await fetchWorkerHours();
			
		} catch (err) {
			console.error('Error deleting worker hours:', err);
			alert('Failed to delete worker hours entry. Please try again.');
			isDeleting = false;
		}
	}

	// Format time for display
	function formatTime(timeStr) {
		if (!timeStr && timeStr !== 0) return '';
		
		// Convert to string if it's a number
		const timeString = String(timeStr);
		
		// Handle different time formats
		if (timeString.includes(':')) {
			return timeString.substring(0, 5); // "HH:MM:SS" -> "HH:MM"
		}
		
		// If it's a number (like hours), format it appropriately
		if (!isNaN(timeStr)) {
			const num = parseFloat(timeStr);
			if (num < 24) {
				// Assume it's hours, format as HH:MM
				const hours = Math.floor(num);
				const minutes = Math.round((num - hours) * 60);
				return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
			}
		}
		
		return timeString;
	}

	// Fetch worker hours for current month
	async function fetchWorkerHours() {
		loading = true;
		try {
			const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
			
			// Get first and last day of the month
			const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
			const lastDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`;
			
			// Get all records with user expansion
			const records = await pb.collection('worker_hours').getFullList({
				sort: '-dato',
				expand: 'user'
			});
			
			// Filter client-side for current month
			const filteredRecords = records.filter(record => {
				let logDateOnly;
				if (record.dato.includes('T')) {
					logDateOnly = record.dato.split('T')[0];
				} else if (record.dato.includes(' ')) {
					logDateOnly = record.dato.split(' ')[0];
				} else {
					logDateOnly = record.dato;
				}
				return logDateOnly >= firstDay && logDateOnly <= lastDay;
			});
			
			workerHours = filteredRecords;
			calculateStats();
			
		} catch (err) {
			console.error('Error fetching worker hours:', err);
			workerHours = [];
		} finally {
			loading = false;
		}
	}

	// Statistics calculation
	let stats = {
		totalHours: 0,
		averageHours: 0,
		workingDays: 0,
		hourRanges: {
			'0-4': 0,
			'4-6': 0,
			'6-8': 0,
			'8-10': 0,
			'10+': 0
		}
	};

	function calculateStats() {
		// Reset stats
		stats = {
			totalHours: 0,
			averageHours: 0,
			workingDays: 0,
			hourRanges: {
				'0-4': 0,
				'4-6': 0,
				'6-8': 0,
				'8-10': 0,
				'10+': 0
			}
		};
		
		// Group by date to avoid counting multiple entries per day
		const dailyHours = {};
		
		workerHours.forEach(log => {
			let dateKey;
			if (log.dato.includes('T')) {
				dateKey = log.dato.split('T')[0];
			} else if (log.dato.includes(' ')) {
				dateKey = log.dato.split(' ')[0];
			} else {
				dateKey = log.dato;
			}
			
			if (!dailyHours[dateKey]) {
				dailyHours[dateKey] = 0;
			}
			dailyHours[dateKey] += log.totalsum || 0;
		});
		
		// Calculate stats from daily totals
		const dailyTotals = Object.values(dailyHours);
		stats.workingDays = dailyTotals.length;
		stats.totalHours = dailyTotals.reduce((sum, hours) => sum + hours, 0);
		stats.averageHours = stats.workingDays > 0 ? stats.totalHours / stats.workingDays : 0;
		
		// Count hour ranges
		dailyTotals.forEach(hours => {
			if (hours < 4) stats.hourRanges['0-4']++;
			else if (hours < 6) stats.hourRanges['4-6']++;
			else if (hours < 8) stats.hourRanges['6-8']++;
			else if (hours < 10) stats.hourRanges['8-10']++;
			else stats.hourRanges['10+']++;
		});
	}

	onMount(() => {
		fetchWorkerHours();
	});
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
	<!-- Calendar Header -->
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-2xl font-bold text-gray-900">Worker Hours Schedule</h2>
		
		<div class="flex items-center space-x-4">
			<button
				on:click={previousMonth}
				class="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			
			<h3 class="text-lg font-medium text-gray-900 min-w-[150px] text-center">
				{monthName}
			</h3>
			
			<button
				on:click={nextMonth}
				class="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
			
			<button
				on:click={fetchWorkerHours}
				class="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={loading}
				title="Refresh calendar"
			>
				<svg class="w-5 h-5 {loading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center items-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			<span class="ml-3 text-gray-600">Loading worker hours...</span>
		</div>
	{:else}
		<!-- Calendar Grid -->
		<div class="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
			<!-- Day Headers -->
			{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as dayName}
				<div class="bg-gray-50 p-3 text-center text-sm font-medium text-gray-700">
					{dayName}
				</div>
			{/each}

			<!-- Calendar Days -->
			{#each calendarDays as day}
				<div class="bg-white min-h-[120px] p-2 border-r border-b border-gray-100">
					{#if day}
						<!-- Day Number -->
						<div class="text-sm font-medium text-gray-900 mb-1">
							{day}
						</div>
						
						<!-- Worker hours for this day -->
						<div class="space-y-1">
							{#each getHoursForDate(day) as hours (hours.id)}
								<div
									class="text-xs px-1 py-0.5 rounded border cursor-pointer transition-all duration-150 hover:shadow-sm select-none {getHoursColor(hours.totalsum || 0)}"
									on:mouseenter={(e) => handleMouseEnter(e, hours)}
									on:mouseleave={handleMouseLeave}
									on:dblclick={() => handleHoursDoubleClick(hours)}
									title="Double-click to delete"
								>
									<div class="text-xs font-medium truncate">
										{hours.expand?.user?.name || hours.expand?.user?.email?.split('@')[0] || hours.user_name || 'Unknown'}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Legend -->
		<div class="mt-6 grid grid-cols-5 gap-3">
			<div class="flex items-center space-x-2">
				<div class="w-4 h-4 rounded border bg-red-100 border-red-300"></div>
				<span class="text-xs text-gray-600">0-4 hours</span>
			</div>
			<div class="flex items-center space-x-2">
				<div class="w-4 h-4 rounded border bg-orange-100 border-orange-300"></div>
				<span class="text-xs text-gray-600">4-6 hours</span>
			</div>
			<div class="flex items-center space-x-2">
				<div class="w-4 h-4 rounded border bg-yellow-100 border-yellow-300"></div>
				<span class="text-xs text-gray-600">6-8 hours</span>
			</div>
			<div class="flex items-center space-x-2">
				<div class="w-4 h-4 rounded border bg-green-100 border-green-300"></div>
				<span class="text-xs text-gray-600">8-10 hours</span>
			</div>
			<div class="flex items-center space-x-2">
				<div class="w-4 h-4 rounded border bg-blue-100 border-blue-300"></div>
				<span class="text-xs text-gray-600">10+ hours</span>
			</div>
		</div>

		<!-- Monthly Statistics -->
		<div class="mt-8 bg-gray-50 rounded-lg p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-gray-900">Monthly Statistics</h3>
				<span class="text-sm text-gray-500">{monthName}</span>
			</div>
			
			<!-- Summary Cards -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<div class="bg-white rounded-md p-4 border border-gray-200">
					<div class="text-center">
						<div class="text-2xl font-bold text-blue-600">{stats.totalHours.toFixed(1)}</div>
						<div class="text-sm text-gray-600">Total Hours</div>
					</div>
				</div>
				
				<div class="bg-white rounded-md p-4 border border-gray-200">
					<div class="text-center">
						<div class="text-2xl font-bold text-green-600">{stats.averageHours.toFixed(1)}</div>
						<div class="text-sm text-gray-600">Average Hours/Day</div>
					</div>
				</div>
				
				<div class="bg-white rounded-md p-4 border border-gray-200">
					<div class="text-center">
						<div class="text-2xl font-bold text-purple-600">{stats.workingDays}</div>
						<div class="text-sm text-gray-600">Working Days</div>
					</div>
				</div>
			</div>
			
			<!-- Hour Range Distribution -->
			<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
				<div class="bg-white rounded-md p-3 border border-gray-200">
					<div class="text-center">
						<div class="w-4 h-4 rounded border bg-red-100 border-red-300 mx-auto mb-2"></div>
						<div class="text-xs font-medium text-gray-700 mb-1">0-4 hours</div>
						<div class="text-lg font-bold text-gray-900">{stats.hourRanges['0-4']}</div>
					</div>
				</div>
				
				<div class="bg-white rounded-md p-3 border border-gray-200">
					<div class="text-center">
						<div class="w-4 h-4 rounded border bg-orange-100 border-orange-300 mx-auto mb-2"></div>
						<div class="text-xs font-medium text-gray-700 mb-1">4-6 hours</div>
						<div class="text-lg font-bold text-gray-900">{stats.hourRanges['4-6']}</div>
					</div>
				</div>
				
				<div class="bg-white rounded-md p-3 border border-gray-200">
					<div class="text-center">
						<div class="w-4 h-4 rounded border bg-yellow-100 border-yellow-300 mx-auto mb-2"></div>
						<div class="text-xs font-medium text-gray-700 mb-1">6-8 hours</div>
						<div class="text-lg font-bold text-gray-900">{stats.hourRanges['6-8']}</div>
					</div>
				</div>
				
				<div class="bg-white rounded-md p-3 border border-gray-200">
					<div class="text-center">
						<div class="w-4 h-4 rounded border bg-green-100 border-green-300 mx-auto mb-2"></div>
						<div class="text-xs font-medium text-gray-700 mb-1">8-10 hours</div>
						<div class="text-lg font-bold text-gray-900">{stats.hourRanges['8-10']}</div>
					</div>
				</div>
				
				<div class="bg-white rounded-md p-3 border border-gray-200">
					<div class="text-center">
						<div class="w-4 h-4 rounded border bg-blue-100 border-blue-300 mx-auto mb-2"></div>
						<div class="text-xs font-medium text-gray-700 mb-1">10+ hours</div>
						<div class="text-lg font-bold text-gray-900">{stats.hourRanges['10+']}</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Tooltip -->
{#if hoveredHours}
	<div
		class="fixed z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
		style="left: {mousePosition.x + 10}px; top: {mousePosition.y - 10}px;"
	>
		<div class="font-medium">
			{hoveredHours.expand?.user?.name || hoveredHours.expand?.user?.email?.split('@')[0] || hoveredHours.user_name || 'Unknown User'}
		</div>
        <div class="text-gray-400 text-xs pb-2">
            {new Date(hoveredHours.dato).toLocaleDateString()}
        </div>
		<div class="text-gray-300 font-medium">
			{hoveredHours.totalsum || 0} hours
		</div>
		{#if hoveredHours.kommentar}
			<div class="text-gray-300 text-xs mt-1 border-t border-gray-700 pt-1">
				{hoveredHours.kommentar}
			</div>
		{/if}
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && hoursToDelete}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
			<div class="flex items-center mb-4">
				<div class="flex-shrink-0">
					<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-lg font-medium text-gray-900">Delete Worker Hours</h3>
				</div>
			</div>
			
			<div class="mb-6">
				<p class="text-sm text-gray-500 mb-3">
					Are you sure you want to delete this worker hours entry? This action cannot be undone.
				</p>
				
				<div class="bg-gray-50 rounded-md p-3 border">
					<div class="text-sm">
						<div class="font-medium text-gray-900">
							{hoursToDelete.expand?.user?.name || hoursToDelete.expand?.user?.email?.split('@')[0] || hoursToDelete.user_name || 'Unknown User'}
						</div>
						<div class="text-gray-600 mt-1">
							{hoursToDelete.totalsum || 0} hours
						</div>
						<div class="text-gray-500 text-xs mt-1">
							{new Date(hoursToDelete.dato).toLocaleDateString()}
						</div>
						{#if hoursToDelete.kommentar}
							<div class="text-gray-600 text-xs mt-2 border-t border-gray-200 pt-2">
								{hoursToDelete.kommentar}
							</div>
						{/if}
					</div>
				</div>
			</div>
			
			<div class="flex justify-end space-x-3">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					on:click={closeDeleteModal}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
					on:click={deleteWorkerHours}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Deleting...
					{:else}
						Delete
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}