<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
    import { initializeUser, userName, currentUser } from '../stores/userStore';
    
    // Initialize PocketBase
    const pb = new PocketBase('https://timesync.pockethost.io/');
    
    let showModal = false;
    let date = new Date().toISOString().split('T')[0];
    let startTime = ""; // Use string format for the inputs
    let endTime = "";
    let comment = '';
    let totalHours = 0;
    let userNameValue = "Anonymous User"; // Default value
    let currentUserValue = null;
    let isLoading = false; // Flag to track loading state
    
    // Subscribe to the user store
    const unsubscribeUser = currentUser.subscribe(value => {
      currentUserValue = value;
      console.log("Current user updated:", currentUserValue);
    });
    
    const unsubscribeUserName = userName.subscribe(value => {
      userNameValue = value;
      console.log("User name updated:", userNameValue);
    });
    
    // Initialize user on component mount
    onMount(async () => {
      try {
        // Initialize the user from the store
        await initializeUser();
      } catch (error) {
        console.error('Error during initialization:', error);
      }
      
      return () => {
        unsubscribeUser();
        unsubscribeUserName();
      };
    });
    
    // Convert minutes to decimal hours based on the conversion table
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
    
    // Convert time string to minutes
    function timeToMinutes(timeStr) {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return (hours * 60) + minutes;
    }
    
    // Calculate total hours
    function calculateTotalHours() {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      if (startMinutes > endMinutes) {
        // Handle case where work spans midnight
        totalHours = convertMinutesToDecimal((24 * 60) - startMinutes + endMinutes);
      } else {
        totalHours = convertMinutesToDecimal(endMinutes - startMinutes);
      }
      
      return totalHours;
    }
    
    // Handle time input changes
    function handleTimeChange() {
      calculateTotalHours();
    }
    
    // Handle backdrop click to close modal
    function handleBackdropClick(event) {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    }
    
    // Handle form submission
    async function handleSubmit() {
      if (!currentUserValue || !currentUserValue.id) {
        alert('You must be logged in to log hours');
        return;
      }
      
      if (!startTime || !endTime) {
        alert('Please enter both start and end times');
        return;
      }
      
      try {
        // Set loading state
        isLoading = true;
        
        calculateTotalHours();
        
        // Prepare data for submission
        const data = {
          user: currentUserValue.id,      // Store user ID for relation
          user_name: userNameValue,       // Store user name for display
          dato: new Date(date).toISOString(),
          start: timeToMinutes(startTime),
          slut: timeToMinutes(endTime),
          totalsum: totalHours,
          kommentar: comment
        };
        
        console.log('Submitting worker hours:', data);
        
        // Create the record in the worker_hours collection
        await pb.collection('worker_hours').create(data);
        
        // Close modal immediately
        showModal = false;
        
        // Show full-page loading animation immediately
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center';
        loadingOverlay.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mb-4"></div>
            <p class="text-lg font-medium text-gray-700">Logging hours...</p>
          </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        // Refresh the page after 500ms
        setTimeout(() => {
          window.location.reload();
        }, 500);
        
      } catch (error) {
        console.error('Error logging worker hours:', error);
        alert('Error logging hours: ' + error.message);
        isLoading = false;
      }
    }
    
    // Reset form fields
    function resetForm() {
      date = new Date().toISOString().split('T')[0];
      startTime = "";
      endTime = "";
      comment = '';
      totalHours = 0;
    }
    
    // Handle modal close
    function closeModal() {
      showModal = false;
      resetForm();
    }
  </script>
  
  <div class="p-4">
    <!-- Button to open modal -->
    <button 
      on:click={() => showModal = true}
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex h-[50px] items-center cursor-pointer"
      disabled={!currentUserValue}
    >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
    </svg>
      Log My Hours
    </button>

    
    <!-- Modal -->
    {#if showModal}
      <div 
        class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
        on:click={handleBackdropClick}
      >
        <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
          <h2 class="text-xl font-bold mb-4">Log My Working Hours</h2>
          
          <form on:submit|preventDefault={handleSubmit} class="space-y-4">
            <!-- User Info Display -->
            <div class="bg-blue-50 p-3 rounded">
              <p class="text-sm font-medium text-blue-800">Logging hours for: {userNameValue}</p>
            </div>
            
            <!-- Date -->
            <div>
              <label class="block text-sm font-medium text-gray-700">Date</label>
              <input 
                type="date" 
                class="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                bind:value={date}
                required
                disabled={isLoading}
              />
            </div>
            
            <!-- Start Time -->
            <div>
              <label class="block text-sm font-medium text-gray-700">Start Time</label>
              <input 
                type="time" 
                class="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                bind:value={startTime}
                on:change={handleTimeChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <!-- End Time -->
            <div>
              <label class="block text-sm font-medium text-gray-700">End Time</label>
              <input 
                type="time" 
                class="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                bind:value={endTime}
                on:change={handleTimeChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <!-- Comment -->
            <div>
              <label class="block text-sm font-medium text-gray-700">Comment (Optional)</label>
              <textarea 
                class="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                rows="3"
                bind:value={comment}
                placeholder="What did you work on today?"
                disabled={isLoading}
              ></textarea>
            </div>
            
            <!-- Summary -->
            {#if startTime && endTime}
              <div class="bg-gray-100 p-3 rounded">
                <p class="font-medium">Total Hours: {totalHours.toFixed(2)}</p>
              </div>
            {/if}
            
            <!-- Buttons -->
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                class="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
                on:click={closeModal}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
                disabled={isLoading}
              >
                {#if isLoading}
                  <div class="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                  Saving...
                {:else}
                  Save Hours
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>