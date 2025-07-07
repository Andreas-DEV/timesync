<!-- src/routes/absence/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';

	const pb = new PocketBase('https://timesync.pockethost.io');
	
	let workers = [];
	let loading = true;
	let error = null;
	let showModal = false;
	let selectedWorker = null;
	let submitting = false;
	let toast = { show: false, message: '', type: 'success' };
	let authenticated = false;
	let showLoginModal = false;
	let loginData = { email: '', password: '' };
	let loginError = '';

	// Form data - updated to support date ranges
	let absenceData = {
		absence_type: '',
		date: new Date().toISOString().split('T')[0], // For single day (Syg på arbejde)
		start_date: new Date().toISOString().split('T')[0], // For date ranges
		end_date: new Date().toISOString().split('T')[0], // For date ranges
		start_time: '',
		end_time: '',
		comment: ''
	};

	const absenceTypes = [
		'Ferie med løn',
		'Ferie uden løn',
		'Sygedag',
		'Fridag',
		'Syg på arbejde'
	];

	onMount(async () => {
		// Check if already authenticated
		if (pb.authStore.isValid) {
			authenticated = true;
			await loadWorkers();
		} else {
			loading = false;
			showLoginModal = true;
		}
	});

	async function login() {
		try {
			loginError = '';
			await pb.collection('users').authWithPassword(loginData.email, loginData.password);
			authenticated = true;
			showLoginModal = false;
			loading = true;
			await loadWorkers();
		} catch (err) {
			console.error('Login error:', err);
			loginError = 'Invalid credentials. Please try again.';
		}
	}

	async function loadWorkers() {
		try {
			const records = await pb.collection('users').getFullList({
				sort: 'name',
			});
			
			workers = records;
			loading = false;
		} catch (err) {
			console.error('Error fetching workers:', err);
			error = 'Failed to load workers. Please try again.';
			loading = false;
		}
	}

	function handleWorkerClick(worker) {
		selectedWorker = worker;
		showModal = true;
		const today = new Date().toISOString().split('T')[0];
		absenceData = {
			absence_type: '',
			date: today,
			start_date: today,
			end_date: today,
			start_time: '',
			end_time: '',
			comment: ''
		};
	}

	function closeModal() {
		showModal = false;
		selectedWorker = null;
	}

	function showToast(message, type = 'success') {
		toast = { show: true, message, type };
		setTimeout(() => {
			toast.show = false;
		}, 4000);
	}

	// Helper function to generate date range
	function getDateRange(startDate, endDate) {
		const dates = [];
		const start = new Date(startDate);
		const end = new Date(endDate);
		
		while (start <= end) {
			dates.push(new Date(start).toISOString().split('T')[0]);
			start.setDate(start.getDate() + 1);
		}
		
		return dates;
	}

	// Helper function to calculate number of days
	function getDayCount(startDate, endDate) {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const timeDiff = end.getTime() - start.getTime();
		return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
	}

	// Validation function
	function validateDates() {
		const startDate = new Date(absenceData.start_date);
		const endDate = new Date(absenceData.end_date);
		
		if (endDate < startDate) {
			showToast('End date cannot be before start date', 'error');
			return false;
		}
		
		return true;
	}

	async function submitAbsence() {
		// Validation based on absence type
		if (!absenceData.absence_type) {
			showToast('Please select an absence type', 'error');
			return;
		}

		if (absenceData.absence_type === 'Syg på arbejde') {
			if (!absenceData.date) {
				showToast('Please select a date', 'error');
				return;
			}
		} else {
			if (!absenceData.start_date || !absenceData.end_date) {
				showToast('Please select start and end dates', 'error');
				return;
			}
			if (!validateDates()) {
				return;
			}
		}

		submitting = true;
		try {
			if (absenceData.absence_type === 'Syg på arbejde') {
				// Single day record for "Syg på arbejde" - use date field only
				const data = {
					user: selectedWorker.id,
					absence_type: absenceData.absence_type,
					date: absenceData.date,
					comment: absenceData.comment
				};

				if (absenceData.start_time) data.start_time = absenceData.start_time;
				if (absenceData.end_time) data.end_time = absenceData.end_time;

				await pb.collection('absence_logs').create(data);
				
				showToast(`Absence registered successfully for ${selectedWorker.name || selectedWorker.email.split('@')[0]}!`, 'success');
			} else {
				// Single record with date range for other absence types
				const data = {
					user: selectedWorker.id,
					absence_type: absenceData.absence_type,
					start_date: absenceData.start_date,
					end_date: absenceData.end_date,
					comment: absenceData.comment
				};

				// For single day ranges, also set the date field for compatibility
				if (absenceData.start_date === absenceData.end_date) {
					data.date = absenceData.start_date;
				}

				await pb.collection('absence_logs').create(data);
				
				const dayCount = getDayCount(absenceData.start_date, absenceData.end_date);
				const dayText = dayCount === 1 ? 'day' : 'days';
				showToast(`Absence registered successfully for ${selectedWorker.name || selectedWorker.email.split('@')[0]} (${dayCount} ${dayText})!`, 'success');
			}
			
			closeModal();
		} catch (err) {
			console.error('Error registering absence:', err);
			showToast('Failed to register absence. Please try again.', 'error');
		} finally {
			submitting = false;
		}
	}

	function getInitials(name) {
		if (!name) return '?';
		return name.split(' ')
			.map(word => word.charAt(0))
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function getAvatarUrl(worker) {
		if (worker.avatar) {
			return `https://timesync.pockethost.io/api/files/users/${worker.id}/${worker.avatar}`;
		}
		return null;
	}

	// Reactive statement to update end date when start date changes (only for non-sick-at-work types)
	$: if (absenceData.absence_type !== 'Syg på arbejde' && absenceData.start_date && absenceData.end_date && new Date(absenceData.end_date) < new Date(absenceData.start_date)) {
		absenceData.end_date = absenceData.start_date;
	}
</script>

<svelte:head>
	<title>Register Absence</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 flex justify-between items-center">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Register Absence</h1>
				<p class="mt-2 text-sm text-gray-600">Select a worker to register their absence</p>
			</div>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="flex justify-center items-center py-12">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
				<span class="ml-3 text-gray-600">Loading workers...</span>
			</div>
		{/if}

		<!-- Error State -->
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-md p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-red-800">{error}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Workers Grid -->
		{#if !loading && !error && workers.length > 0 && authenticated}
			<div class="flex justify-center">
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
					{#each workers as worker}
						<button
							on:click={() => handleWorkerClick(worker)}
							class="group bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
						>
							<div class="flex justify-center mb-4">
								{#if getAvatarUrl(worker)}
									<img
										src={getAvatarUrl(worker)}
										alt={worker.name || worker.email}
										class="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-blue-300 transition-colors"
									/>
								{:else}
									<div class="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-gray-200 group-hover:ring-blue-300 transition-colors">
										<span class="text-white font-semibold text-lg">
											{getInitials(worker.name || worker.email)}
										</span>
									</div>
								{/if}
							</div>

							<div class="text-center">
								<h3 class="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
									{worker.name || worker.email.split('@')[0]}
								</h3>
								{#if worker.name && worker.email}
									<p class="text-xs text-gray-500 mt-1 truncate">
										{worker.email}
									</p>
								{/if}
							</div>

							<div class="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
								<div class="w-full h-0.5 bg-blue-500 rounded-full"></div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Empty State -->
		{#if !loading && !error && workers.length === 0 && authenticated}
			<div class="text-center py-12">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900">No workers found</h3>
				<p class="mt-1 text-sm text-gray-500">There are no workers available to register absence for.</p>
			</div>
		{/if}
	</div>
</div>

<!-- Login Modal -->
{#if showLoginModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="flex items-center justify-between pb-3 border-b">
				<h3 class="text-lg font-medium text-gray-900">Login Required</h3>
			</div>

			<div class="py-4 space-y-4">
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
					<input
						type="email"
						id="email"
						bind:value={loginData.email}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
					<input
						type="password"
						id="password"
						bind:value={loginData.password}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					/>
				</div>

				{#if loginError}
					<div class="text-red-600 text-sm">{loginError}</div>
				{/if}
			</div>

			<div class="flex items-center justify-end pt-3 border-t">
				<button
					on:click={login}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					Login
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Absence Registration Modal -->
{#if showModal && selectedWorker}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" on:click={closeModal}>
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" on:click|stopPropagation>
			<div class="flex items-center justify-between pb-3 border-b">
				<h3 class="text-lg font-medium text-gray-900">
					Register Absence - {selectedWorker.name || selectedWorker.email.split('@')[0]}
				</h3>
				<button on:click={closeModal} class="text-gray-400 hover:text-gray-600">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>

			<div class="py-4 space-y-4">
				<!-- Absence Type Selection -->
				<div>
					<label for="absence_type" class="block text-sm font-medium text-gray-700 mb-1">Absence Type *</label>
					<select
						id="absence_type"
						bind:value={absenceData.absence_type}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						required
					>
						<option value="">Select absence type</option>
						{#each absenceTypes as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>

				<!-- Date Section - conditional based on absence type -->
				{#if absenceData.absence_type === 'Syg på arbejde'}
					<!-- Single Date for "Syg på arbejde" -->
					<div>
						<label for="date" class="block text-sm font-medium text-gray-700 mb-1">Date *</label>
						<input
							type="date"
							id="date"
							bind:value={absenceData.date}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							required
						/>
					</div>
				{:else if absenceData.absence_type}
					<!-- Date Range for other absence types -->
					<div class="space-y-3">
						<div>
							<label for="start_date" class="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
							<input
								type="date"
								id="start_date"
								bind:value={absenceData.start_date}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>

						<div>
							<label for="end_date" class="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
							<input
								type="date"
								id="end_date"
								bind:value={absenceData.end_date}
								min={absenceData.start_date}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>

						<!-- Duration Display -->
						{#if absenceData.start_date && absenceData.end_date}
							<div class="text-sm text-gray-600 bg-gray-50 p-2 rounded-md">
								Duration: {getDayCount(absenceData.start_date, absenceData.end_date)} day{getDayCount(absenceData.start_date, absenceData.end_date) > 1 ? 's' : ''}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Time Details for "Syg på arbejde" -->
				{#if absenceData.absence_type === 'Syg på arbejde'}
					<div class="space-y-3 p-3 bg-gray-50 rounded-md">
						<h4 class="text-sm font-medium text-gray-700">Time Details</h4>
						
						<div>
							<label for="start_time" class="block text-sm font-medium text-gray-700 mb-1">Tidspunkt man gik</label>
							<input
								type="time"
								id="start_time"
								bind:value={absenceData.start_time}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>

						<div>
							<label for="end_time" class="block text-sm font-medium text-gray-700 mb-1">Tidspunkt man har fri</label>
							<input
								type="time"
								id="end_time"
								bind:value={absenceData.end_time}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
					</div>
				{/if}

				<!-- Comment Section -->
				<div>
					<label for="comment" class="block text-sm font-medium text-gray-700 mb-1">Comment</label>
					<textarea
						id="comment"
						bind:value={absenceData.comment}
						rows="3"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="Add any additional notes..."
					></textarea>
				</div>
			</div>

			<div class="flex items-center justify-end pt-3 border-t space-x-3">
				<button
					on:click={closeModal}
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					on:click={submitAbsence}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={submitting}
				>
					{submitting ? 'Registering...' : 'Register Absence'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Toast Notification -->
{#if toast.show}
	<div class="fixed bottom-4 right-12 z-50 animate-in slide-in-from-right duration-300">
		<div class="flex items-center p-4 rounded-lg shadow-lg {toast.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'} max-w-sm">
			<div class="flex-shrink-0">
				{#if toast.type === 'success'}
					<svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
					</svg>
				{:else}
					<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
					</svg>
				{/if}
			</div>
			
			<div class="ml-3">
				<p class="text-sm font-medium {toast.type === 'success' ? 'text-green-800' : 'text-red-800'}">
					{toast.message}
				</p>
			</div>
		</div>
	</div>
{/if}