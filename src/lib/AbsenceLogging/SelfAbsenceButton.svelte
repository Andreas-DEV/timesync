<script>
    import { onMount, createEventDispatcher } from "svelte";
    
    // Props passed from parent component
    export let pb = null;
    export let userData = null;
    export let userName = "";
    
    const dispatch = createEventDispatcher();
    
    let isLoading = false;
    let isComponentReady = false;
    let showModal = false;
    let absenceType = "";
    let startDate = "";
    let endDate = "";
    let reason = "";
    let submitError = "";
    let submitSuccess = "";
  
    // Absence types
    const absenceTypes = [
      { value: "sick", label: "Sick Leave" },
      { value: "vacation", label: "Vacation" },
      { value: "personal", label: "Personal Day" },
      { value: "emergency", label: "Emergency" },
      { value: "other", label: "Other" }
    ];
  
    onMount(async () => {
      try {
        // Wait a bit to ensure parent component has fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Validate that we have the required props
        if (!pb) {
          console.error("SelfAbsenceButton: PocketBase instance not provided");
          return;
        }
        
        if (!userData || !userData.id) {
          console.error("SelfAbsenceButton: Valid user data not provided");
          return;
        }
        
        // Verify PocketBase connection
        if (!pb.authStore.isValid) {
          console.error("SelfAbsenceButton: User not authenticated");
          return;
        }
        
        console.log("SelfAbsenceButton: Component initialized successfully");
        console.log("User data:", userData);
        console.log("User name:", userName);
        
        isComponentReady = true;
        
      } catch (error) {
        console.error("Error initializing SelfAbsenceButton:", error);
      }
    });
  
    function openModal() {
      if (!isComponentReady) {
        console.error("Component not ready yet");
        return;
      }
      
      // Reset form
      absenceType = "";
      startDate = "";
      endDate = "";
      reason = "";
      submitError = "";
      submitSuccess = "";
      
      showModal = true;
    }
  
    function closeModal() {
      showModal = false;
    }
  
    async function submitAbsenceRequest() {
      if (!isComponentReady || !pb || !userData) {
        submitError = "System not ready. Please try again.";
        return;
      }
  
      // Validate form
      if (!absenceType || !startDate || !endDate || !reason.trim()) {
        submitError = "Please fill in all fields.";
        return;
      }
  
      if (new Date(startDate) > new Date(endDate)) {
        submitError = "Start date cannot be after end date.";
        return;
      }
  
      isLoading = true;
      submitError = "";
      submitSuccess = "";
  
      try {
        // Create absence request record
        const absenceData = {
          user_id: userData.id,
          user_name: userName || userData.name || userData.email,
          absence_type: absenceType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
  
        console.log("Submitting absence request:", absenceData);
  
        // Try to submit to absence requests collection
        const result = await pb.collection('absence_requests').create(absenceData);
        
        console.log("Absence request created:", result);
        
        submitSuccess = "Absence request submitted successfully!";
        
        // Clear form after successful submission
        setTimeout(() => {
          closeModal();
          // Dispatch event to parent if needed
          dispatch('absenceSubmitted', { result });
        }, 2000);
  
      } catch (error) {
        console.error("Error submitting absence request:", error);
        
        if (error.status === 404) {
          submitError = "Absence requests collection not found. Please contact your administrator.";
        } else if (error.status === 403) {
          submitError = "You don't have permission to submit absence requests.";
        } else {
          submitError = error.message || "Failed to submit absence request. Please try again.";
        }
      } finally {
        isLoading = false;
      }
    }
  
    // Handle keyboard events
    function handleKeydown(event) {
      if (event.key === 'Escape') {
        closeModal();
      }
    }
  </script>
  
  <svelte:window on:keydown={handleKeydown} />
  
  {#if isComponentReady}
    <div class="self-absence-container">
      <!-- Trigger Button -->
      <button
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex h-[50px] items-center cursor-pointer"
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
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" on:click={closeModal}>
          <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4" on:click|stopPropagation>
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold text-gray-900">Request Absence</h2>
              <button
                class="text-gray-400 hover:text-gray-600 transition-colors"
                on:click={closeModal}
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
  
            <form on:submit|preventDefault={submitAbsenceRequest} class="space-y-4">
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
                >
                  <option value="">Select absence type</option>
                  {#each absenceTypes as type}
                    <option value={type.value}>{type.label}</option>
                  {/each}
                </select>
              </div>
  
              <!-- Start Date -->
              <div>
                <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  id="startDate"
                  type="date"
                  bind:value={startDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
  
              <!-- End Date -->
              <div>
                <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
                  End Date *
                </label>
                <input
                  id="endDate"
                  type="date"
                  bind:value={endDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
  
              <!-- Reason -->
              <div>
                <label for="reason" class="block text-sm font-medium text-gray-700 mb-1">
                  Reason *
                </label>
                <textarea
                  id="reason"
                  bind:value={reason}
                  placeholder="Please provide a brief reason for your absence..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="3"
                  required
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
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Submitting...
                  {:else}
                    Submit Request
                  {/if}
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Loading state -->
    <div class="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg">
      <div class="flex items-center gap-2">
        <svg class="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Loading...
      </div>
    </div>
  {/if}
  
  <style>
    .self-absence-container {
      display: inline-block;
    }
  </style>