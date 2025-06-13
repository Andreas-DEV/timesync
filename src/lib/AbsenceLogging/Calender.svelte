<!-- src/lib/components/AbsenceCalendar.svelte -->
<script>
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';

	const pb = new PocketBase('https://timesync.pockethost.io');

	let currentDate = new Date();
	let absenceLogs = [];
	let loading = true;
	let hoveredAbsence = null;
	let mousePosition = { x: 0, y: 0 };
	
	// Delete modal state
	let showDeleteModal = false;
	let absenceToDelete = null;
	let isDeleting = false;

	// Color mapping for absence types
	const absenceColors = {
		'Ferie med løn': 'bg-green-100 border-green-300 text-green-800',
		'Ferie uden løn': 'bg-yellow-100 border-yellow-300 text-yellow-800',
		'Sygedag': 'bg-red-100 border-red-300 text-red-800',
		'Fridag': 'bg-blue-100 border-blue-300 text-blue-800',
		'Syg på arbejde': 'bg-orange-100 border-orange-300 text-orange-800'
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

	// Get absences for a specific date
	function getAbsencesForDate(day) {
		if (!day) return [];
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		
		const dayAbsences = absenceLogs.filter(log => {
			// Extract just the date part from the log.date (remove time component)
			const logDateOnly = log.date.split(' ')[0]; // "2025-06-05 00:00:00.000Z" -> "2025-06-05"
			return logDateOnly === dateStr;
		});
		
		return dayAbsences;
	}

	// Navigate months
	function previousMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1);
		// Call fetchAbsences with a slight delay to ensure reactive variables update
		setTimeout(() => fetchAbsences(), 0);
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
		// Call fetchAbsences with a slight delay to ensure reactive variables update
		setTimeout(() => fetchAbsences(), 0);
	}

	// Handle mouse events for tooltip
	function handleMouseEnter(event, absence) {
		hoveredAbsence = absence;
		updateMousePosition(event);
	}

	function handleMouseMove(event) {
		if (hoveredAbsence) {
			updateMousePosition(event);
		}
	}

	function handleMouseLeave() {
		hoveredAbsence = null;
	}

	function updateMousePosition(event) {
		mousePosition = {
			x: event.clientX,
			y: event.clientY
		};
	}

	// Handle double click on absence entry
	function handleAbsenceDoubleClick(absence) {
		absenceToDelete = absence;
		showDeleteModal = true;
	}

	// Close delete modal
	function closeDeleteModal() {
		showDeleteModal = false;
		absenceToDelete = null;
		isDeleting = false;
	}

	// Delete absence
	async function deleteAbsence() {
		if (!absenceToDelete) return;
		
		isDeleting = true;
		try {
			await pb.collection('absence_logs').delete(absenceToDelete.id);
			
			// Close modal first
			closeDeleteModal();
			
			// Refresh the calendar to ensure data is up to date
			await fetchAbsences();
			
		} catch (err) {
			console.error('Error deleting absence:', err);
			alert('Failed to delete absence. Please try again.');
			isDeleting = false;
		}
	}

	// Fetch absences for current month
	async function fetchAbsences() {
		loading = true;
		try {
			// Calculate days in month directly to ensure it's current
			const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
			
			// Get first and last day of the month
			const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
			const lastDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`;
			
			// Get all records with user expansion
			const records = await pb.collection('absence_logs').getFullList({
				sort: '-date',
				expand: 'user'
			});
			
			// Filter client-side for current month
			const filteredRecords = records.filter(record => {
				const logDateOnly = record.date.split(' ')[0];
				return logDateOnly >= firstDay && logDateOnly <= lastDay;
			});
			
			absenceLogs = filteredRecords;
			
			// Calculate stats after fetching data
			calculateStats();
			
		} catch (err) {
			console.error('Error fetching absences:', err);
			absenceLogs = [];
		} finally {
			loading = false;
		}
	}

	// Simple stats calculation
	let stats = {
		'Ferie med løn': 0,
		'Ferie uden løn': 0,
		'Sygedag': 0,
		'Fridag': 0,
		'Syg på arbejde': 0
	};
	let totalCount = 0;

	function calculateStats() {
		// Reset stats
		stats = {
			'Ferie med løn': 0,
			'Ferie uden løn': 0,
			'Sygedag': 0,
			'Fridag': 0,
			'Syg på arbejde': 0
		};
		
		// Count each type
		absenceLogs.forEach(log => {
			if (stats.hasOwnProperty(log.absence_type)) {
				stats[log.absence_type]++;
			}
		});
		
		totalCount = absenceLogs.length;
	}

	onMount(() => {
		fetchAbsences();
	});

	// Get short abbreviation for absence type
	function getAbsenceAbbreviation(type) {
		const abbreviations = {
			'Ferie med løn': 'FL',
			'Ferie uden løn': 'FU',
			'Sygedag': 'SY',
			'Fridag': 'FR',
			'Syg på arbejde': 'SA'
		};
		return abbreviations[type] || type.substring(0, 2).toUpperCase();
	}
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
	<!-- Calendar Header -->
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-2xl font-bold text-gray-900">Absence Schedule</h2>
		
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
				on:click={fetchAbsences}
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
			<span class="ml-3 text-gray-600">Loading absences...</span>
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
						
						<!-- Absences for this day -->
						<div class="space-y-1">
							{#each getAbsencesForDate(day) as absence (absence.id)}
								<div
									class="text-xs px-2 py-1 rounded border cursor-pointer transition-all duration-150 hover:shadow-sm select-none {absenceColors[absence.absence_type] || 'bg-gray-100 border-gray-300 text-gray-800'}"
									on:mouseenter={(e) => handleMouseEnter(e, absence)}
									on:mouseleave={handleMouseLeave}
									on:dblclick={() => handleAbsenceDoubleClick(absence)}
									title="Double-click to delete"
								>
									{getAbsenceAbbreviation(absence.absence_type)}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Legend -->
		<div class="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
			{#each Object.entries(absenceColors) as [type, colorClass]}
				<div class="flex items-center space-x-2">
					<div class="w-4 h-4 rounded border {colorClass}"></div>
					<span class="text-xs text-gray-600">{type}</span>
				</div>
			{/each}
		</div>

		<!-- Monthly Statistics -->
		<div class="mt-8 bg-gray-50 rounded-lg p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-gray-900">Monthly Statistics</h3>
				<span class="text-sm text-gray-500">{monthName}</span>
			</div>
			
			<div class="flex justify-center">
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
					<div class="bg-white rounded-md p-3 border border-gray-200 w-40">
						<div class="text-center">
							<div class="w-4 h-4 rounded border bg-green-100 border-green-300 mx-auto mb-2"></div>
							<div class="text-xs font-medium text-gray-700 mb-1">Ferie med løn</div>
							<div class="text-lg font-bold text-gray-900">{stats['Ferie med løn']}</div>
						</div>
					</div>
					
					<div class="bg-white rounded-md p-3 border border-gray-200 w-40">
						<div class="text-center">
							<div class="w-4 h-4 rounded border bg-yellow-100 border-yellow-300 mx-auto mb-2"></div>
							<div class="text-xs font-medium text-gray-700 mb-1">Ferie uden løn</div>
							<div class="text-lg font-bold text-gray-900">{stats['Ferie uden løn']}</div>
						</div>
					</div>
					
					<div class="bg-white rounded-md p-3 border border-gray-200 w-40">
						<div class="text-center">
							<div class="w-4 h-4 rounded border bg-red-100 border-red-300 mx-auto mb-2"></div>
							<div class="text-xs font-medium text-gray-700 mb-1">Sygedag</div>
							<div class="text-lg font-bold text-gray-900">{stats['Sygedag']}</div>
						</div>
					</div>
					
					<div class="bg-white rounded-md p-3 border border-gray-200 w-40">
						<div class="text-center">
							<div class="w-4 h-4 rounded border bg-blue-100 border-blue-300 mx-auto mb-2"></div>
							<div class="text-xs font-medium text-gray-700 mb-1">Fridag</div>
							<div class="text-lg font-bold text-gray-900">{stats['Fridag']}</div>
						</div>
					</div>
					
					<div class="bg-white rounded-md p-3 border border-gray-200 w-40">
						<div class="text-center">
							<div class="w-4 h-4 rounded border bg-orange-100 border-orange-300 mx-auto mb-2"></div>
							<div class="text-xs font-medium text-gray-700 mb-1">Syg på arbejde</div>
							<div class="text-lg font-bold text-gray-900">{stats['Syg på arbejde']}</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Total -->
			<div class="mt-4 bg-blue-50 rounded-md p-4 border border-blue-200">
				<div class="text-center">
					<span class="text-sm font-medium text-blue-700">Total Absences</span>
					<div class="text-2xl font-bold text-blue-900 mt-1">{totalCount}</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Tooltip -->
{#if hoveredAbsence}
	<div
		class="fixed z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
		style="left: {mousePosition.x + 10}px; top: {mousePosition.y - 10}px;"
	>
		<div class="font-medium">
			{hoveredAbsence.expand?.user?.name || hoveredAbsence.expand?.user?.email?.split('@')[0] || 'Unknown User'}
		</div>
		<div class="text-gray-300">
			{hoveredAbsence.absence_type}
		</div>
		<div class="text-gray-400 text-xs">
			{new Date(hoveredAbsence.date).toLocaleDateString()}
		</div>
		{#if hoveredAbsence.comment}
			<div class="text-gray-300 text-xs mt-1 border-t border-gray-700 pt-1">
				{hoveredAbsence.comment}
			</div>
		{/if}
		{#if hoveredAbsence.start_time || hoveredAbsence.end_time}
			<div class="text-gray-300 text-xs mt-1">
				{#if hoveredAbsence.start_time}Left: {hoveredAbsence.start_time}{/if}
				{#if hoveredAbsence.end_time}End: {hoveredAbsence.end_time}{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && absenceToDelete}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
			<div class="flex items-center mb-4">
				<div class="flex-shrink-0">
					<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-lg font-medium text-gray-900">Delete Absence</h3>
				</div>
			</div>
			
			<div class="mb-6">
				<p class="text-sm text-gray-500 mb-3">
					Are you sure you want to delete this absence entry? This action cannot be undone.
				</p>
				
				<div class="bg-gray-50 rounded-md p-3 border">
					<div class="text-sm">
						<div class="font-medium text-gray-900">
							{absenceToDelete.expand?.user?.name || absenceToDelete.expand?.user?.email?.split('@')[0] || 'Unknown User'}
						</div>
						<div class="text-gray-600 mt-1">
							{absenceToDelete.absence_type}
						</div>
						<div class="text-gray-500 text-xs mt-1">
							{new Date(absenceToDelete.date).toLocaleDateString()}
						</div>
						{#if absenceToDelete.comment}
							<div class="text-gray-600 text-xs mt-2 border-t border-gray-200 pt-2">
								{absenceToDelete.comment}
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
					on:click={deleteAbsence}
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