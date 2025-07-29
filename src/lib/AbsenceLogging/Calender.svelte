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

	// Absence report modal state
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
		Object.entries(reportData.dailyBreakdown).sort().forEach(([date, absences]) => {
			absences.forEach(absence => {
				allEntries.push({ date, absence });
			});
		});
		
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return allEntries.slice(startIndex, endIndex);
	})();

	$: totalPages = reportData?.dailyBreakdown 
		? Math.ceil(Object.entries(reportData.dailyBreakdown).reduce((total, [, absences]) => total + absences.length, 0) / itemsPerPage)
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

	// Get absences for a specific date - now handles both single dates and date ranges
	function getAbsencesForDate(day) {
		if (!day) return [];
		
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		const targetDate = new Date(dateStr);
		
		const dayAbsences = absenceLogs.filter(log => {
			// Handle "Syg på arbejde" which uses single date field
			if (log.absence_type === 'Syg på arbejde' && log.date) {
				const logDate = new Date(log.date.split(' ')[0]);
				return logDate.getTime() === targetDate.getTime();
			}
			
			// Handle other absence types that use date ranges
			if (log.start_date && log.end_date) {
				const startDate = new Date(log.start_date);
				const endDate = new Date(log.end_date);
				
				// Check if current date falls within the range (inclusive)
				return targetDate.getTime() >= startDate.getTime() && targetDate.getTime() <= endDate.getTime();
			}
			
			// Fallback for any records that might still use the old date field
			if (log.date && !log.start_date && !log.end_date) {
				const logDate = new Date(log.date.split(' ')[0]);
				return logDate.getTime() === targetDate.getTime();
			}
			
			return false;
		});
		
		return dayAbsences;
	}

	// Check if a date is part of a multi-day absence range
	function isPartOfRange(record) {
		if (!record.start_date || !record.end_date) return false;
		return record.start_date !== record.end_date;
	}

	// Check if this is the first day of a range for a specific calendar day
	function isRangeStart(record, day) {
		if (!isPartOfRange(record)) return false;
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return record.start_date === dateStr;
	}

	// Check if this is the last day of a range for a specific calendar day
	function isRangeEnd(record, day) {
		if (!isPartOfRange(record)) return false;
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return record.end_date === dateStr;
	}

	// Check if this day is in the middle of a range
	function isRangeMiddle(record, day) {
		if (!isPartOfRange(record)) return false;
		const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return dateStr > record.start_date && dateStr < record.end_date;
	}

	// Navigate months
	function previousMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1);
		setTimeout(() => fetchAbsences(), 0);
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1);
		setTimeout(() => fetchAbsences(), 0);
	}

	// Handle mouse events for tooltip
	function handleMouseEnter(event, record) {
		hoveredAbsence = record;
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
	function handleAbsenceDoubleClick(record) {
		absenceToDelete = record;
		showDeleteModal = true;
	}

	// Close delete modal
	function closeDeleteModal() {
		showDeleteModal = false;
		absenceToDelete = null;
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

	// Generate absence report
	async function generateReport() {
		if (!reportStartDate || !reportEndDate || !selectedWorker) {
			alert('Please select start date, end date, and worker');
			return;
		}

		isLoadingReport = true;
		currentPage = 1; // Reset pagination for new report
		try {
			// Fetch absence records for the selected period and worker
			const records = await pb.collection('absence_logs').getFullList({
				filter: `user = "${selectedWorker}"`,
				expand: 'user',
				sort: 'created'
			});

			// Filter records that fall within the date range
			const startDate = new Date(reportStartDate);
			const endDate = new Date(reportEndDate);
			
			const filteredRecords = records.filter(record => {
				// Handle "Syg på arbejde" with single date
				if (record.absence_type === 'Syg på arbejde' && record.date) {
					const recordDate = new Date(record.date.split(' ')[0]);
					return recordDate >= startDate && recordDate <= endDate;
				}
				
				// Handle date range absences - check if they overlap with our date range
				if (record.start_date && record.end_date) {
					const recordStartDate = new Date(record.start_date);
					const recordEndDate = new Date(record.end_date);
					
					// Check if the ranges overlap
					return (recordStartDate <= endDate && recordEndDate >= startDate);
				}
				
				// Fallback for old records using date field
				if (record.date && !record.start_date && !record.end_date) {
					const recordDate = new Date(record.date.split(' ')[0]);
					return recordDate >= startDate && recordDate <= endDate;
				}
				
				return false;
			});

			// Calculate absence statistics
			let absenceStats = {
				'Ferie med løn': 0,
				'Ferie uden løn': 0,
				'Sygedag': 0,
				'Fridag': 0,
				'Syg på arbejde': 0
			};

			let totalAbsenceDays = 0;
			let dailyBreakdown = {};

			// Process each record to calculate days and create daily breakdown
			filteredRecords.forEach(record => {
				if (record.absence_type === 'Syg på arbejde' && record.date) {
					// Single day absence
					const dateStr = record.date.split(' ')[0];
					if (dateStr >= reportStartDate && dateStr <= reportEndDate) {
						absenceStats[record.absence_type]++;
						totalAbsenceDays++;
						
						if (!dailyBreakdown[dateStr]) {
							dailyBreakdown[dateStr] = [];
						}
						dailyBreakdown[dateStr].push(record);
					}
				} else if (record.start_date && record.end_date) {
					// Date range absence
					const recordStartDate = new Date(record.start_date);
					const recordEndDate = new Date(record.end_date);
					
					// Calculate overlapping period with our report range
					const overlapStart = new Date(Math.max(recordStartDate.getTime(), startDate.getTime()));
					const overlapEnd = new Date(Math.min(recordEndDate.getTime(), endDate.getTime()));
					
					if (overlapStart <= overlapEnd) {
						// Calculate days in the overlapping period
						const dayCount = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 3600 * 24)) + 1;
						absenceStats[record.absence_type] += dayCount;
						totalAbsenceDays += dayCount;
						
						// Add to daily breakdown for each day in the overlap
						for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
							const dateStr = d.toISOString().split('T')[0];
							if (!dailyBreakdown[dateStr]) {
								dailyBreakdown[dateStr] = [];
							}
							dailyBreakdown[dateStr].push(record);
						}
					}
				}
			});

			reportData = {
				worker: filteredRecords[0]?.expand?.user,
				startDate: reportStartDate,
				endDate: reportEndDate,
				absenceStats,
				totalAbsenceDays,
				dailyBreakdown,
				records: filteredRecords
			};

		} catch (err) {
			console.error('Error generating report:', err);
			alert('Failed to generate report. Please try again.');
		} finally {
			isLoadingReport = false;
		}
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
			// Get all records with user expansion
			const records = await pb.collection('absence_logs').getFullList({
				sort: '-created',
				expand: 'user'
			});
			
			// Filter to include records that are relevant to current month
			const currentMonthStart = new Date(currentYear, currentMonth, 1);
			const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
			
			const filteredRecords = records.filter(record => {
				// Handle "Syg på arbejde" with single date
				if (record.absence_type === 'Syg på arbejde' && record.date) {
					const recordDate = new Date(record.date.split(' ')[0]);
					return recordDate >= currentMonthStart && recordDate <= currentMonthEnd;
				}
				
				// Handle date range absences
				if (record.start_date && record.end_date) {
					const startDate = new Date(record.start_date);
					const endDate = new Date(record.end_date);
					
					// Check if the range overlaps with the current month
					return (startDate <= currentMonthEnd && endDate >= currentMonthStart);
				}
				
				// Fallback for any old records using date field
				if (record.date && !record.start_date && !record.end_date) {
					const recordDate = new Date(record.date.split(' ')[0]);
					return recordDate >= currentMonthStart && recordDate <= currentMonthEnd;
				}
				
				return false;
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
		
		// Count each type - but count range absences only once, not per day
		absenceLogs.forEach(record => {
			if (stats.hasOwnProperty(record.absence_type)) {
				// For range absences, calculate total days in range
				if (record.start_date && record.end_date && record.absence_type !== 'Syg på arbejde') {
					const startDate = new Date(record.start_date);
					const endDate = new Date(record.end_date);
					const timeDiff = endDate.getTime() - startDate.getTime();
					const dayCount = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
					stats[record.absence_type] += dayCount;
				} else {
					// Single day absence
					stats[record.absence_type]++;
				}
			}
		});
		
		// Calculate total count (sum of all absence days)
		totalCount = Object.values(stats).reduce((sum, count) => sum + count, 0);
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
				on:click={openReportModal}
				class="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
				title="Absence Report"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
							{#each getAbsencesForDate(day) as record (record.id)}
								<div
									class="text-xs px-2 py-1 rounded border cursor-pointer transition-all duration-150 hover:shadow-sm select-none relative {absenceColors[record.absence_type] || 'bg-gray-100 border-gray-300 text-gray-800'}"
									on:mouseenter={(e) => handleMouseEnter(e, record)}
									on:mouseleave={handleMouseLeave}
									on:dblclick={() => handleAbsenceDoubleClick(record)}
									title="Double-click to delete"
								>
									<div class="flex items-center justify-between">
										<span>{getAbsenceAbbreviation(record.absence_type)}</span>
										{#if isPartOfRange(record)}
											<div class="flex space-x-1">
												{#if isRangeStart(record, day)}
													<span class="text-xs">►</span>
												{:else if isRangeEnd(record, day)}
													<span class="text-xs">◄</span>
												{:else if isRangeMiddle(record, day)}
													<span class="text-xs">─</span>
												{/if}
											</div>
										{/if}
									</div>
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

		<!-- Range Legend -->
		<div class="mt-4 flex items-center justify-center space-x-6 text-xs text-gray-600">
			<div class="flex items-center space-x-1">
				<span>►</span>
				<span>Range Start</span>
			</div>
			<div class="flex items-center space-x-1">
				<span>─</span>
				<span>Range Middle</span>
			</div>
			<div class="flex items-center space-x-1">
				<span>◄</span>
				<span>Range End</span>
			</div>
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
		
		<!-- Date Information -->
		<div class="text-gray-400 text-xs">
			{#if hoveredAbsence.absence_type === 'Syg på arbejde' && hoveredAbsence.date}
				{new Date(hoveredAbsence.date).toLocaleDateString()}
			{:else if hoveredAbsence.start_date && hoveredAbsence.end_date}
				{#if hoveredAbsence.start_date === hoveredAbsence.end_date}
					{new Date(hoveredAbsence.start_date).toLocaleDateString()}
				{:else}
					{new Date(hoveredAbsence.start_date).toLocaleDateString()} - {new Date(hoveredAbsence.end_date).toLocaleDateString()}
					{@const startDate = new Date(hoveredAbsence.start_date)}
					{@const endDate = new Date(hoveredAbsence.end_date)}
					{@const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1}
					<div class="text-xs text-gray-500">({dayCount} days)</div>
				{/if}
			{:else if hoveredAbsence.date}
				{new Date(hoveredAbsence.date).toLocaleDateString()}
			{/if}
		</div>
		
		{#if hoveredAbsence.comment}
			<div class="text-gray-300 text-xs mt-1 border-t border-gray-700 pt-1">
				{hoveredAbsence.comment}
			</div>
		{/if}
		{#if hoveredAbsence.start_time || hoveredAbsence.end_time}
			<div class="text-gray-300 text-xs mt-1">
				{#if hoveredAbsence.start_time}Left: {hoveredAbsence.start_time}{/if}
				{#if hoveredAbsence.end_time} End: {hoveredAbsence.end_time}{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- Absence Report Modal -->
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
						<h3 class="text-lg font-medium text-gray-900">Absence Report</h3>
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
					<div class="grid grid-cols-2 md:grid-cols-6 gap-4">
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="w-4 h-4 rounded border bg-green-100 border-green-300 mx-auto mb-2"></div>
								<div class="text-lg font-bold text-green-600">{reportData.absenceStats['Ferie med løn']}</div>
								<div class="text-xs text-gray-600">Ferie med løn</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="w-4 h-4 rounded border bg-yellow-100 border-yellow-300 mx-auto mb-2"></div>
								<div class="text-lg font-bold text-yellow-600">{reportData.absenceStats['Ferie uden løn']}</div>
								<div class="text-xs text-gray-600">Ferie uden løn</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="w-4 h-4 rounded border bg-red-100 border-red-300 mx-auto mb-2"></div>
								<div class="text-lg font-bold text-red-600">{reportData.absenceStats['Sygedag']}</div>
								<div class="text-xs text-gray-600">Sygedag</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="w-4 h-4 rounded border bg-blue-100 border-blue-300 mx-auto mb-2"></div>
								<div class="text-lg font-bold text-blue-600">{reportData.absenceStats['Fridag']}</div>
								<div class="text-xs text-gray-600">Fridag</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="w-4 h-4 rounded border bg-orange-100 border-orange-300 mx-auto mb-2"></div>
								<div class="text-lg font-bold text-orange-600">{reportData.absenceStats['Syg på arbejde']}</div>
								<div class="text-xs text-gray-600">Syg på arbejde</div>
							</div>
						</div>
						
						<div class="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
							<div class="text-center">
								<div class="text-2xl font-bold text-gray-600">{reportData.totalAbsenceDays}</div>
								<div class="text-xs text-gray-600">Total Days</div>
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
											<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absence Type</th>
											<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each paginatedDailyBreakdown as { date, absence }}
											<tr class="hover:bg-gray-50">
												<td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
													{new Date(date).toLocaleDateString()}
												</td>
												<td class="px-4 py-2 whitespace-nowrap text-sm">
													<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {absenceColors[absence.absence_type] || 'bg-gray-100 text-gray-800'}">
														{absence.absence_type}
													</span>
												</td>
												<td class="px-4 py-2 text-sm text-gray-600">
													{absence.comment || '-'}
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
										Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, Object.entries(reportData.dailyBreakdown).reduce((total, [, absences]) => total + absences.length, 0))} of {Object.entries(reportData.dailyBreakdown).reduce((total, [, absences]) => total + absences.length, 0)} entries
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

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && absenceToDelete}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
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
						
						<!-- Date display for delete modal -->
						<div class="text-gray-500 text-xs mt-1">
							{#if absenceToDelete.absence_type === 'Syg på arbejde' && absenceToDelete.date}
								{new Date(absenceToDelete.date).toLocaleDateString()}
							{:else if absenceToDelete.start_date && absenceToDelete.end_date}
								{#if absenceToDelete.start_date === absenceToDelete.end_date}
									{new Date(absenceToDelete.start_date).toLocaleDateString()}
								{:else}
									{new Date(absenceToDelete.start_date).toLocaleDateString()} - {new Date(absenceToDelete.end_date).toLocaleDateString()}
									{@const startDate = new Date(absenceToDelete.start_date)}
									{@const endDate = new Date(absenceToDelete.end_date)}
									{@const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1}
									<div class="text-amber-600 font-medium mt-1">Will delete entire {dayCount}-day period</div>
								{/if}
							{:else if absenceToDelete.date}
								{new Date(absenceToDelete.date).toLocaleDateString()}
							{/if}
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