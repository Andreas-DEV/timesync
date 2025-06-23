<!-- SelfAbsenceButton.svelte - Fixed version -->
<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { pb, userInfo, initializeUser, requireAuth } from '$lib/stores/userStore';
  import { fade } from 'svelte/transition';
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let isComponentReady = false;
  let isLoading = false;
  let error = null;
  let showModal = false;
  let absenceType = "";
  let startTime = "";
  let endTime = "";
  let date = "";
  let comment = "";
  let submitError = "";
  let submitSuccess = "";

  // User info reactive
  let userInfoValue = { user: null, name: 'Anonymous User', isAuthenticated: false, id: null };
  
  // Store subscriptions
  let unsubscribeUserInfo;

  // Absence types - matching your collection field options
  const absenceTypes = [
    { value: "Ferie med løn", label: "Ferie med løn" },
    { value: "Ferie uden løn", label: "Ferie uden løn" },
    { value: "Sygedag", label: "Sygedag" },
    { value: "Fridag", label: "Fridag" },
    { value: "Syg på arbejde", label: "Syg på arbejde" }
  ];

  // Subscribe to user info store
  function subscribeToStores() {
    unsubscribeUserInfo = userInfo.subscribe(value => {
      userInfoValue = value;
    });
  }
  
  // Initialize component
  async function initializeComponent() {
    try {
      error = null;
      
      // Subscribe to stores first
      subscribeToStores();
      
      // Initialize user authentication
      await initializeUser();
      
      // Check authentication
      if (!userInfoValue.isAuthenticated) {
        throw new Error('User authentication required');
      }
      
      isComponentReady = true;
      console.log('SelfAbsenceButton initialized successfully');
      console.log('User data:', userInfoValue);
      
    } catch (err) {
      console.error('Error initializing SelfAbsenceButton:', err);
      error = err.message;
    }
  }

  function openModal() {
    if (!isComponentReady) {
      console.error("Component not ready yet");
      return;
    }
    
    if (!userInfoValue.isAuthenticated) {
      alert('You must be logged in to log absence.');
      return;
    }
    
    // Reset form
    absenceType = "";
    startTime = "";
    endTime = "";
    date = "";
    comment = "";
    submitError = "";
    submitSuccess = "";
    
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function submitAbsenceRequest() {
    if (!isComponentReady) {
      submitError = "System not ready. Please try again.";
      return;
    }

    // Validate form
    if (!absenceType || !startTime || !endTime || !date || !comment.trim()) {
      submitError = "Please fill in all fields.";
      return;
    }

    // Validate time range
    if (startTime >= endTime) {
      submitError = "Start time must be before end time.";
      return;
    }

    isLoading = true;
    submitError = "";
    submitSuccess = "";

    try {
      // Ensure user is authenticated
      const user = requireAuth();
      
      // Create absence log record - matching your collection schema
      const absenceData = {
        user: user.id,  // This should be the relation field to users collection
        absence_type: absenceType,
        start_time: startTime,
        end_time: endTime,
        date: date,
        comment: comment.trim()
      };

      console.log("Submitting absence request:", absenceData);

      // Submit to absence_logs collection
      const result = await pb.collection('absence_logs').create(absenceData);
      
      console.log("Absence request created:", result);
      
      submitSuccess = "Absence request submitted successfully!";
      
      // Close modal after successful submission
      setTimeout(() => {
        closeModal();
        // Dispatch event to parent if needed
        dispatch('absenceSubmitted', { result });
      }, 1000);

    } catch (error) {
      console.error("Error submitting absence request:", error);
      
      if (error.status === 404) {
        submitError = "Absence logs collection not found. Please contact your administrator.";
      } else if (error.status === 403) {
        submitError = "You don't have permission to submit absence requests.";
      } else if (error.status === 400) {
        submitError = "Invalid data. Please check all fields and try again.";
      } else {
        submitError = error.message || "Failed to submit absence request. Please try again.";
      }
    } finally {
      isLoading = false;
    }
  }

  // Handle keyboard events
  function handleKeydown(event) {
    if (event.key === 'Escape' && showModal) {
      closeModal();
    }
  }
  
  // Component lifecycle
  onMount(async () => {
    await initializeComponent();
  });
  
  onDestroy(() => {
    if (unsubscribeUserInfo) {
      unsubscribeUserInfo();
    }
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Loading State -->
{#if !isComponentReady}
  <div class="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg" transition:fade>
    <div class="flex items-center gap-2">
      <svg class="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {#if error}
        Error: {error}
      {:else}
        Loading...
      {/if}
    </div>
  </div>

<!-- Authentication Required -->
{:else if !userInfoValue.isAuthenticated}
  <div class="px-4 py-2 bg-yellow-200 text-yellow-700 rounded-lg" transition:fade>
    <div class="flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      Not Authenticated
    </div>
  </div>

<!-- Component Ready -->
{:else}
  <div class="self-absence-container" transition:fade>
    <!-- Trigger Button -->
    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex h-[50px] items-center cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={openModal}
      disabled={isLoading}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
      </svg>
      Log Absence
    </button>

    <!-- Modal -->
    {#if showModal}
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
        on:click={closeModal}
        transition:fade
      >
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4" on:click|stopPropagation>
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Log Absence</h2>
            <button
              class="text-gray-400 hover:text-gray-600 transition-colors"
              on:click={closeModal}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- User Info Display -->
          <div class="bg-blue-50 p-3 rounded mb-4">
            <p class="text-sm font-medium text-blue-800">Logging absence for: {userInfoValue.name}</p>
          </div>

          <form on:submit|preventDefault={submitAbsenceRequest} class="space-y-4">
            <!-- Date -->
            <div>
              <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                id="date"
                type="date"
                bind:value={date}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>

            <!-- Absence Type -->
            <div>
              <label for="absenceType" class="block text-sm font-medium text-gray-700 mb-1">
                Absence Type *
              </label>
              <select
                id="absenceType"
                bind:value={absenceType}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isLoading}
              >
                <option value="">Select absence type</option>
                {#each absenceTypes as type}
                  <option value={type.value}>{type.label}</option>
                {/each}
              </select>
            </div>

            <!-- Start Time -->
            <div>
              <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <input
                id="startTime"
                type="time"
                bind:value={startTime}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>

            <!-- End Time -->
            <div>
              <label for="endTime" class="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <input
                id="endTime"
                type="time"
                bind:value={endTime}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>

            <!-- Comment -->
            <div>
              <label for="comment" class="block text-sm font-medium text-gray-700 mb-1">
                Comment *
              </label>
              <textarea
                id="comment"
                bind:value={comment}
                placeholder="Please provide a brief comment about your absence..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="3"
                required
                disabled={isLoading}
              ></textarea>
            </div>

            <!-- Error Message -->
            {#if submitError}
              <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                <p class="text-sm text-red-600">{submitError}</p>
              </div>
            {/if}

            <!-- Success Message -->
            {#if submitSuccess}
              <div class="p-3 bg-green-50 border border-green-200 rounded-md">
                <p class="text-sm text-green-600">{submitSuccess}</p>
              </div>
            {/if}

            <!-- Form Actions -->
            <div class="flex justify-end gap-3 pt-4">
              <button
                type="button"
                on:click={closeModal}
                class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isLoading}
              >
                {#if isLoading}
                  <svg class="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-25"></circle>
                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                {:else}
                  Submit
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .self-absence-container {
    display: inline-block;
  }
</style>