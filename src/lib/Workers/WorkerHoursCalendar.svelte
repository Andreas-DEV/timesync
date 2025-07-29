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

	// Details modal state
	let showDetailsModal = false;
	let selectedHours = null;

	// Worker hours report modal state
	let showReportModal = false;
	let reportStartDate = '';
	let reportEndDate = '';
	let selectedWorker = '';
	let allWorkers = [];
	let reportData = null;
	let isLoadingReport = false;

	// Pagination state
	let currentPage = 1;
	let itemsPerPage = 10;

	// Calculate paginated data
	$: paginatedDailyBreakdown = (() => {
		if (!reportData?.dailyBreakdown) return [];
		
		// Flatten the daily breakdown into individual entries
		const allEntries = [];
		Object.entries(reportData.dailyBreakdown).sort().forEach(([date, data]) => {
			data.records.forEach(record => {
				allEntries.push({ date, record, normalHours: data.normal / data.records.length, overtimeHours: data.overtime / data.records.length });
			});
		});
		
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return allEntries.slice(startIndex, endIndex);
	})();

	$: totalPages = reportData?.dailyBreakdown 
		? Math.ceil(Object.entries(reportData.dailyBreakdown).reduce((total, [, data]) => total + data.records.length, 0) / itemsPerPage)
		: 0;

	// Pagination functions
	function goToPage(page) {
		currentPage = Math.max(1, Math.min(page, totalPages));
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

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

	// Convert minutes to decimal hours using the provided conversion table
	function convertMinutesToDecimal(minutes) {
		// Creating a mapping of minutes to decimal hours based on the provided table
		const conversionTable = {
			1: 0.02, 2: 0.03, 3: 0.05, 4: 0.07, 5: 0.08, 6: 0.10, 
			7: 0.12, 8: 0.13, 9: 0.15, 10: 0.17, 11: 0.18, 12: 0.20,
			13: 0.22, 14: 0.23, 15: 0.25, 16: 0.27, 17: 0.28, 18: 0.30,
			19: 0.32, 20: 0.33, 21: 0.35, 22: 0.37, 23: 0.38, 24: 0.40,
			25: 0.42, 26: 0.43, 27: 0.45, 28: 0.47, 29: 0.48, 30: 0.50,
			31: 0.52, 32: 0.53, 33: 0.55, 34: 0.57, 35: 0.58, 36: 0.60,
			37: 0.62, 38: 0.63, 39: 0.65, 40: 0.67, 41: 0.68, 42: 0.70,
			43: 0.72, 44: 0.73, 45: 0.75, 46: 0.77, 47: 0.78, 48: 0.80,
			49: 0.82, 50: 0.83, 51: 0.85, 52: 0.87, 53: 0.88, 54: 0.90,
			55: 0.92, 56: 0.93, 57: 0.95, 58: 0.97, 59: 0.98, 60: 1.00
		};
		
		// Calculate hours and remaining minutes
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		
		// Get decimal value for remaining minutes
		const decimalPart = conversionTable[remainingMinutes] || 0;
		
		// Return total hours in decimal
		return hours + decimalPart;
	}

	// Convert minutes from midnight to HH:MM format
	function minutesToTimeFormat(minutes) {
		if (!minutes && minutes !== 0) return 'N/A';
		
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
	}

	// Convert decimal hours back to time format (HH:MM)
	function decimalToTimeFormat(decimal) {
		const hours = Math.floor(decimal);
		const minutes = Math.round((decimal - hours) * 60);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
	}

	// Format time from various formats to HH:MM
	function formatTimeDisplay(timeValue) {
		if (!timeValue && timeValue !== 0) return 'N/A';
		
		// If it's already in HH:MM format
		if (typeof timeValue === 'string' && timeValue.includes(':')) {
			return timeValue.substring(0, 5);
		}
		
		// If it's a number, assume it's minutes from midnight (like your database)
		if (typeof timeValue === 'number') {
			return minutesToTimeFormat(timeValue);
		}
		
		return String(timeValue);
	}

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

	// Handle single click on worker hours entry - show details modal or delete modal
	function handleHoursSingleClick(hours, event) {
		// Check if Shift key was pressed for delete modal
		if (event.shiftKey) {
			hoursToDelete = hours;
			showDeleteModal = true;
		} else {
			// Regular click - show details modal
			selectedHours = hours;
			showDetailsModal = true;
		}
	}

	// Handle double click on worker hours entry (keeping for backward compatibility)
	function handleHoursDoubleClick(hours) {
		hoursToDelete = hours;
		showDeleteModal = true;
	}

	// Close details modal
	function closeDetailsModal() {
		showDetailsModal = false;
		selectedHours = null;
	}

	// Close delete modal
	function closeDeleteModal() {
		showDeleteModal = false;
		hoursToDelete = null;
		isDeleting = false;
	}

	// Open report modal
	function openReportModal() {
		showReportModal = true;
		// Set default dates to current month
		const today = new Date();
		const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
		const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
		
		reportStartDate = firstDay.toISOString().split('T')[0];
		reportEndDate = lastDay.toISOString().split('T')[0];
		
		fetchAllWorkers();
	}

	// Close report modal
	function closeReportModal() {
		showReportModal = false;
		reportStartDate = '';
		reportEndDate = '';
		selectedWorker = '';
		reportData = null;
		currentPage = 1; // Reset pagination
	}

	// Fetch all workers for the dropdown
	async function fetchAllWorkers() {
		try {
			const users = await pb.collection('users').getFullList({
				sort: 'name'
			});
			allWorkers = users;
		} catch (err) {
			console.error('Error fetching workers:', err);
			allWorkers = [];
		}
	}

	// Generate worker hours report
	async function generateReport() {
		if (!reportStartDate || !reportEndDate || !selectedWorker) {
			alert('Please select start date, end date, and worker');
			return;
		}

		isLoadingReport = true;
		currentPage = 1; // Reset pagination for new report
		try {
			// Fetch worker hours for the selected period and worker
			const records = await pb.collection('worker_hours').getFullList({
				filter: `user = "${selectedWorker}" && dato >= "${reportStartDate}" && dato <= "${reportEndDate}"`,
				expand: 'user',
				sort: 'dato'
			});

			// Calculate totals
			let totalNormalHours = 0;
			let totalOvertimeHours = 0;
			let totalDays = 0;

			// Group by date to avoid double counting
			const dailyHours = {};
			
			records.forEach(record => {
				let dateKey;
				if (record.dato.includes('T')) {
					dateKey = record.dato.split('T')[0];
				} else if (record.dato.includes(' ')) {
					dateKey = record.dato.split(' ')[0];
				} else {
					dateKey = record.dato;
				}

				if (!dailyHours[dateKey]) {
					dailyHours[dateKey] = {
						normal: 0,
						overtime: 0,
						records: []
					};
				}

				dailyHours[dateKey].normal += record.totalsum || 0;
				dailyHours[dateKey].overtime += record.overarbejde || 0;
				dailyHours[dateKey].records.push(record);
			});

			// Calculate totals from daily aggregations
			Object.values(dailyHours).forEach(day => {
				totalNormalHours += day.normal;
				totalOvertimeHours += day.overtime;
				totalDays++;
			});

			reportData = {
				worker: records[0]?.expand?.user,
				startDate: reportStartDate,
				endDate: reportEndDate,
				totalNormalHours,
				totalOvertimeHours,
				totalHours: totalNormalHours + totalOvertimeHours,
				totalDays,
				averageHoursPerDay: totalDays > 0 ? (totalNormalHours + totalOvertimeHours) / totalDays : 0,
				dailyBreakdown: dailyHours,
				records
			};

		} catch (err) {
			console.error('Error generating report:', err);
			alert('Failed to generate report. Please try again.');
		} finally {
			isLoadingReport = false;
		}
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
				on:click={openReportModal}
				class="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
				title="Worker Hours Report"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
									on:click={(e) => handleHoursSingleClick(hours, e)}
									title="Click to view details, Shift+Click to delete"
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
		
		<!-- Show employee number and loentermin -->
		<div class="text-gray-400 text-xs">
			{#if hoveredHours.expand?.user?.medarbejdernr}
				Employee #{hoveredHours.expand.user.medarbejdernr}
			{/if}
			{#if hoveredHours.expand?.user?.loentermin}
				<br>{hoveredHours.expand.user.loentermin}
			{/if}
		</div>
		
        <div class="text-gray-400 text-xs pb-2">
            {new Date(hoveredHours.dato).toLocaleDateString()}
        </div>
		<div class="text-gray-300 font-medium">
			{hoveredHours.totalsum || 0} hours
		</div>
		{#if hoveredHours.overarbejde}
			<div class="text-orange-300 text-xs">
				Overtime: {hoveredHours.overarbejde} hours
			</div>
		{/if}
		{#if hoveredHours.kommentar}
			<div class="text-gray-300 text-xs mt-1 border-t border-gray-700 pt-1">
				{hoveredHours.kommentar}
			</div>
		{/if}
	</div>
{/if}

<!-- Worker Hours Report Modal -->
{#if showReportModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-lg font-medium text-gray-900">Worker Hours Report</h3>
					</div>
				</div>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 cursor-pointer"
					on:click={closeReportModal}
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			
			<!-- Report filters -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
				<div>
					<label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
					<input
						id="startDate"
						type="date"
						bind:value={reportStartDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				
				<div>
					<label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
					<input
						id="endDate"
						type="date"
						bind:value={reportEndDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				
				<div>
					<label for="worker" class="block text-sm font-medium text-gray-700 mb-1">Worker</label>
					<select
						id="worker"
						bind:value={selectedWorker}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Select Worker</option>
						{#each allWorkers as worker}
							<option value={worker.id}>
								{worker.name || worker.email?.split('@')[0] || 'Unknown'}
								{#if worker.medarbejdernr}(#{worker.medarbejdernr}){/if}
							</option>
						{/each}
					</select>
				</div>
				
				<div class="flex items-end">
					<button
						type="button"
						class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
						on:click={generateReport}
						disabled={isLoadingReport}
					>
						{#if isLoadingReport}
							<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Generating...
						{:else}
							Generate Report
						{/if}
					</button>
				</div>
			</div>
			
			<!-- Report results -->
			{#if reportData}
				<div class="space-y-6">
					<!-- Worker info -->
					<div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
						<h4 class="text-lg font-semibold text-blue-900 mb-2">
							{reportData.worker?.name || reportData.worker?.email?.split('@')[0] || 'Unknown Worker'}
						</h4>
						<div class="text-blue-700 text-sm">
							{#if reportData.worker?.medarbejdernr}
								Employee #{reportData.worker.medarbejdernr} •
							{/if}
							{new Date(reportData.startDate).toLocaleDateString()} - {new Date(reportData.endDate).toLocaleDateString()}
						</div>
					</div>
					
					<!-- Summary cards -->
					<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-green-600">{reportData.totalNormalHours.toFixed(1)}</div>
								<div class="text-sm text-gray-600">Normal Hours</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-orange-600">{reportData.totalOvertimeHours.toFixed(1)}</div>
								<div class="text-sm text-gray-600">Overtime Hours</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-blue-600">{reportData.totalHours.toFixed(1)}</div>
								<div class="text-sm text-gray-600">Total Hours</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-purple-600">{reportData.totalDays}</div>
								<div class="text-sm text-gray-600">Working Days</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-gray-600">{reportData.averageHoursPerDay.toFixed(1)}</div>
								<div class="text-sm text-gray-600">Avg Hours/Day</div>
							</div>
						</div>
					</div>
					
					<!-- Daily breakdown -->
					{#if Object.keys(reportData.dailyBreakdown).length > 0}
						<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
							<div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
								<h5 class="text-sm font-medium text-gray-900">Daily Breakdown</h5>
							</div>
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50">
										<tr>
											<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
											<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Normal Hours</th>
											<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime Hours</th>
											<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each paginatedDailyBreakdown as { date, record, normalHours, overtimeHours }}
											<tr class="hover:bg-gray-50">
												<td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
													{new Date(date).toLocaleDateString()}
												</td>
												<td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
													{(record.totalsum || 0).toFixed(1)}h
												</td>
												<td class="px-4 py-2 whitespace-nowrap text-sm text-orange-600 font-medium">
													{(record.overarbejde || 0).toFixed(1)}h
												</td>
												<td class="px-4 py-2 whitespace-nowrap text-sm font-semibold text-gray-900">
													{((record.totalsum || 0) + (record.overarbejde || 0)).toFixed(1)}h
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							
							<!-- Pagination -->
							{#if totalPages > 1}
								<div class="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
									<div class="text-sm text-gray-700">
										Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, Object.entries(reportData.dailyBreakdown).reduce((total, [, data]) => total + data.records.length, 0))} of {Object.entries(reportData.dailyBreakdown).reduce((total, [, data]) => total + data.records.length, 0)} entries
									</div>
									<div class="flex items-center space-x-2">
										<button
											type="button"
											class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
											on:click={previousPage}
											disabled={currentPage === 1}
										>
											Previous
										</button>
										
										<!-- Page numbers -->
										{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
											const startPage = Math.max(1, currentPage - 2);
											const endPage = Math.min(totalPages, startPage + 4);
											const adjustedStart = Math.max(1, endPage - 4);
											return adjustedStart + i;
										}).filter(page => page <= totalPages) as page}
											<button
												type="button"
												class="px-3 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 {currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}"
												on:click={() => goToPage(page)}
											>
												{page}
											</button>
										{/each}
										
										<button
											type="button"
											class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
											on:click={nextPage}
											disabled={currentPage === totalPages}
										>
											Next
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			
			<div class="flex justify-end mt-6">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
					on:click={closeReportModal}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Worker Hours Details Modal -->
{#if showDetailsModal && selectedHours}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-lg font-medium text-gray-900">Worker Hours Details</h3>
					</div>
				</div>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 cursor-pointer"
					on:click={closeDetailsModal}
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			
			<div class="space-y-4">
				<!-- Worker Info -->
				<div class="bg-gray-50 rounded-lg p-4 border">
					<div class="font-medium text-gray-900 text-lg">
						{selectedHours.expand?.user?.name || selectedHours.expand?.user?.email?.split('@')[0] || selectedHours.user_name || 'Unknown User'}
					</div>
					
					{#if selectedHours.expand?.user?.medarbejdernr}
						<div class="text-gray-600 text-sm mt-1">
							Employee #{selectedHours.expand.user.medarbejdernr}
						</div>
					{/if}
					
					{#if selectedHours.expand?.user?.loentermin}
						<div class="text-gray-600 text-sm">
							{selectedHours.expand.user.loentermin}
						</div>
					{/if}
					
					<div class="text-gray-500 text-sm mt-2">
						{new Date(selectedHours.dato).toLocaleDateString('en-US', { 
							weekday: 'long', 
							year: 'numeric', 
							month: 'long', 
							day: 'numeric' 
						})}
					</div>
				</div>

				<!-- Time Details -->
				<div class="grid grid-cols-2 gap-4">
					<div class="bg-green-50 rounded-lg p-4 border border-green-200">
						<div class="text-center">
							<div class="text-sm font-medium text-green-700 mb-1">Clock In</div>
							<div class="text-2xl font-bold text-green-800">
								{formatTimeDisplay(selectedHours.start)}
							</div>
						</div>
					</div>
					
					<div class="bg-red-50 rounded-lg p-4 border border-red-200">
						<div class="text-center">
							<div class="text-sm font-medium text-red-700 mb-1">Clock Out</div>
							<div class="text-2xl font-bold text-red-800">
								{formatTimeDisplay(selectedHours.slut)}
							</div>
						</div>
					</div>
				</div>

				<!-- Hours breakdown -->
				<div class="grid grid-cols-1 gap-4">
					<div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
						<div class="text-center">
							<div class="text-sm font-medium text-blue-700 mb-1">Normal Hours</div>
							<div class="text-3xl font-bold text-blue-800">
								{selectedHours.totalsum || 0} hours
							</div>
						</div>
					</div>
					
					{#if selectedHours.overarbejde}
						<div class="bg-orange-50 rounded-lg p-4 border border-orange-200">
							<div class="text-center">
								<div class="text-sm font-medium text-orange-700 mb-1">Overtime Hours</div>
								<div class="text-3xl font-bold text-orange-800">
									{selectedHours.overarbejde} hours
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Comments -->
				{#if selectedHours.kommentar}
					<div class="bg-gray-50 rounded-lg p-4 border">
						<div class="text-sm font-medium text-gray-700 mb-2">Comments</div>
						<div class="text-gray-900">
							{selectedHours.kommentar}
						</div>
					</div>
				{/if}
			</div>
			
			<div class="flex justify-end mt-6">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
					on:click={closeDetailsModal}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && hoursToDelete}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
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
						
						<!-- Show employee details in delete modal -->
						{#if hoursToDelete.expand?.user?.medarbejdernr || hoursToDelete.expand?.user?.loentermin}
							<div class="text-gray-600 text-xs mt-1">
								{#if hoursToDelete.expand?.user?.medarbejdernr}
									Employee #{hoursToDelete.expand.user.medarbejdernr}
								{/if}
								{#if hoursToDelete.expand?.user?.loentermin}
									<br>{hoursToDelete.expand.user.loentermin}
								{/if}
							</div>
						{/if}
						
						<div class="text-gray-600 mt-1">
							{hoursToDelete.totalsum || 0} hours
							{#if hoursToDelete.overarbejde}
								+ {hoursToDelete.overarbejde} overtime
							{/if}
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
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
					on:click={closeDeleteModal}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center cursor-pointer"
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