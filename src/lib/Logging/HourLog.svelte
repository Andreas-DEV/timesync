<!-- HourLog.svelte - Updated with effektivtid -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { pb, userInfo, initializeUser, requireAuth } from '../stores/userStore';
  import { fade } from 'svelte/transition';
  
  // Component state
  let isComponentReady = false;
  let showModal = false;
  let allCustomers = [];
  let assignedCustomers = [];
  let selectedCustomer = null;
  let isLoading = false;
  let isInitializing = true;
  let error = null;
  
  // Form data
  let formData = {
    date: new Date().toISOString().split('T')[0],
    startTime: "",
    endTime: "",
    comment: ''
  };
  
  // Computed values
  let totalHours = 0;
  let effectiveHours = 0;
  let totalPrice = 0;
  let userEffektivtid = 100; // Default to 100% if not set
  
  // User info reactive
  let userInfoValue = { user: null, name: 'Anonymous User', isAuthenticated: false, id: null };
  let isAdmin = false;
  
  // Store subscriptions
  let unsubscribeUserInfo;
  
  // Time conversion lookup table
  const MINUTES_TO_DECIMAL = {
    0: 0.00, 1: 0.02, 2: 0.03, 3: 0.05, 4: 0.07, 5: 0.08, 6: 0.10, 
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
  
  // Subscribe to user info store
  function subscribeToStores() {
    unsubscribeUserInfo = userInfo.subscribe(value => {
      userInfoValue = value;
      isAdmin = value?.user?.admin === true || value?.user?.role === 'admin';
      
      // Reload assigned customers when user changes and component is ready
      if (value.isAuthenticated && isComponentReady) {
        loadAssignedCustomers();
        loadUserEffektivtid();
      }
    });
  }
  
  // Load user's effektivtid value
  async function loadUserEffektivtid() {
    try {
      if (!userInfoValue.id) return;
      
      // Get the user's effektivtid from the users collection
      const user = await pb.collection('users').getOne(userInfoValue.id);
      
      // Use the effektivtid value, default to 100 if not set
      userEffektivtid = user.effektivtid || 100;
      
      console.log(`User effektivtid loaded: ${userEffektivtid}%`);
    } catch (err) {
      console.error('Error loading user effektivtid:', err);
      userEffektivtid = 100; // Default to 100% on error
    }
  }
  
  // Initialize component
  async function initializeComponent() {
    try {
      isInitializing = true;
      error = null;
      
      // Subscribe to stores
      subscribeToStores();
      
      // Initialize user authentication
      await initializeUser();
      
      // Check authentication
      if (!userInfoValue.isAuthenticated) {
        throw new Error('User authentication required');
      }
      
      // Load component data
      await loadAllCustomers();
      await loadAssignedCustomers();
      await loadUserEffektivtid();
      
      isComponentReady = true;
      console.log('HourLog component initialized successfully');
      
    } catch (err) {
      console.error('Error initializing HourLog component:', err);
      error = err.message;
    } finally {
      isInitializing = false;
    }
  }
  
  // Load all customers
  async function loadAllCustomers() {
    try {
      const records = await pb.collection('kunder').getFullList({
        sort: 'navn'
      });
      allCustomers = records;
    } catch (err) {
      console.error('Error loading customers:', err);
      allCustomers = [];
      throw new Error('Failed to load customers');
    }
  }
  
  // Load customers assigned to current user
  async function loadAssignedCustomers() {
    try {
      if (!userInfoValue.isAuthenticated || !userInfoValue.id) {
        assignedCustomers = [];
        return;
      }
      
      // Admins see all customers
      if (isAdmin) {
        assignedCustomers = [...allCustomers];
        return;
      }
      
      // Get user assignments
      const assignments = await pb.collection('user_customer_assignments').getFullList({
        filter: `user = "${userInfoValue.id}"`,
        fields: 'kunde'
      });
      
      if (assignments.length === 0) {
        assignedCustomers = [];
        return;
      }
      
      // Filter customers based on assignments
      const assignedIds = new Set(assignments.map(a => a.kunde));
      assignedCustomers = allCustomers.filter(customer => 
        assignedIds.has(customer.id)
      );
      
    } catch (err) {
      console.error('Error loading assigned customers:', err);
      assignedCustomers = [];
    }
  }
  
  // Time conversion functions
  function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    
    return (hours * 60) + minutes;
  }
  
  function convertMinutesToDecimal(minutes) {
    if (minutes <= 0) return 0;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const decimalPart = MINUTES_TO_DECIMAL[remainingMinutes] || 0;
    
    return hours + decimalPart;
  }
  
  // Calculate totals
  function calculateTotals() {
    if (!formData.startTime || !formData.endTime) {
      totalHours = 0;
      effectiveHours = 0;
      totalPrice = 0;
      return;
    }
    
    const startMinutes = timeToMinutes(formData.startTime);
    const endMinutes = timeToMinutes(formData.endTime);
    
    let workMinutes;
    if (startMinutes > endMinutes) {
      // Work spans midnight
      workMinutes = (24 * 60) - startMinutes + endMinutes;
    } else {
      workMinutes = endMinutes - startMinutes;
    }
    
    totalHours = convertMinutesToDecimal(workMinutes);
    
    // Calculate effective hours based on user's effektivtid percentage
    effectiveHours = totalHours * (userEffektivtid / 100);
    
    // Calculate price based on effective hours
    totalPrice = selectedCustomer ? effectiveHours * selectedCustomer.timepris : 0;
  }
  
  // Reactive calculations
  $: if (formData.startTime || formData.endTime || selectedCustomer || userEffektivtid) {
    calculateTotals();
  }
  
  // Handle customer selection
  function handleCustomerChange(event) {
    const customerId = event.target.value;
    selectedCustomer = customerId ? 
      allCustomers.find(c => c.id === customerId) : null;
  }
  
  // Validate form data
  function validateForm() {
    const errors = [];
    
    if (!selectedCustomer) {
      errors.push('Please select a customer');
    }
    
    if (!formData.startTime) {
      errors.push('Please enter start time');
    }
    
    if (!formData.endTime) {
      errors.push('Please enter end time');
    }
    
    if (!formData.date) {
      errors.push('Please select a date');
    }
    
    if (formData.startTime && formData.endTime) {
      const startMinutes = timeToMinutes(formData.startTime);
      const endMinutes = timeToMinutes(formData.endTime);
      
      if (startMinutes === endMinutes) {
        errors.push('Start and end time cannot be the same');
      }
    }
    
    return errors;
  }
  
  // Handle form submission
  async function handleSubmit() {
    if (isLoading) return;
    
    const errors = validateForm();
    if (errors.length > 0) {
      alert('Please fix the following errors:\n' + errors.join('\n'));
      return;
    }
    
    isLoading = true;
    
    try {
      // Ensure user is authenticated
      const user = requireAuth();
      
      const logData = {
        kunde_id: selectedCustomer.id,
        kunde_navn: selectedCustomer.navn,
        user: user.id,
        user_name: userInfoValue.name,
        dato: new Date(formData.date).toISOString(),
        start: timeToMinutes(formData.startTime),
        slut: timeToMinutes(formData.endTime),
        totalsum: effectiveHours, // Now using effective hours instead of total hours
        actual_hours: totalHours, // Store the actual worked hours separately
        effektivtid: userEffektivtid, // Store the efficiency percentage used
        price: totalPrice,
        kommentar: formData.comment || ''
      };
      
      await pb.collection('log').create(logData);
      
      // Success feedback
      showSuccessMessage();
      closeModal();
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('hoursLogged', { 
        detail: logData 
      }));
      
    } catch (err) {
      console.error('Error logging hours:', err);
      alert(`Error logging hours: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }
  
  // Show success message
  function showSuccessMessage() {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = 'Hours logged successfully!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
  
  // Reset form
  function resetForm() {
    selectedCustomer = null;
    formData = {
      date: new Date().toISOString().split('T')[0],
      startTime: "",
      endTime: "",
      comment: ''
    };
    totalHours = 0;
    effectiveHours = 0;
    totalPrice = 0;
  }
  
  // Modal controls
  function openModal() {
    if (!isComponentReady) {
      alert('Component is still loading. Please wait.');
      return;
    }
    
    if (!userInfoValue.isAuthenticated) {
      alert('You must be logged in to log hours.');
      return;
    }
    
    if (assignedCustomers.length === 0 && !isAdmin) {
      alert('No customers are assigned to you. Please contact your administrator.');
      return;
    }
    
    showModal = true;
  }
  
  function closeModal() {
    showModal = false;
    resetForm();
  }
  
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
  
  // Handle escape key
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

<div class="p-4">
  <!-- Open Modal Button -->
  <button 
    on:click={openModal}
    class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex h-[50px] items-center cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    disabled={isInitializing || !isComponentReady || !userInfoValue.isAuthenticated}
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
    </svg>
    {#if isInitializing}
      Loading...
    {:else if error}
      Error
    {:else if !userInfoValue.isAuthenticated}
      Not Authenticated
    {:else}
      Log Hours
    {/if}
  </button>
  
  <!-- Error Message -->
  {#if error}
    <div class="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm" transition:fade>
      {error}
    </div>
  {/if}
  
  <!-- Modal -->
  {#if showModal}
    <div 
      class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
      on:click={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      transition:fade
    >
      <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 id="modal-title" class="text-xl font-bold mb-4">Log Hours</h2>
        
        <form on:submit|preventDefault={handleSubmit} class="space-y-4">
          <!-- Customer Selection -->
          <div>
            <label for="customer-select" class="block text-sm font-medium text-gray-700">
              Customer *
            </label>
            <select 
              id="customer-select"
              class="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              on:change={handleCustomerChange}
              value={selectedCustomer?.id || ""}
              required
              disabled={isLoading}
            >
              <option value="">Select a customer</option>
              {#each assignedCustomers as customer (customer.id)}
                <option value={customer.id}>{customer.navn}</option>
              {/each}
            </select>
            
            {#if selectedCustomer}
              <p class="mt-1 text-sm text-green-600">
                Selected: {selectedCustomer.navn} ({selectedCustomer.timepris} kr/hour)
              </p>
            {/if}
            
            {#if assignedCustomers.length === 0 && !isAdmin && isComponentReady}
              <p class="mt-1 text-sm text-red-600">
                No customers assigned. Contact your administrator.
              </p>
            {/if}
          </div>
          
          <!-- Date -->
          <div>
            <label for="date-input" class="block text-sm font-medium text-gray-700">
              Date *
            </label>
            <input 
              id="date-input"
              type="date" 
              class="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              bind:value={formData.date}
              required
              disabled={isLoading}
            />
          </div>
          
          <!-- Time Inputs -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="start-time" class="block text-sm font-medium text-gray-700">
                Start Time *
              </label>
              <input 
                id="start-time"
                type="time" 
                class="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                bind:value={formData.startTime}
                required
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label for="end-time" class="block text-sm font-medium text-gray-700">
                End Time *
              </label>
              <input 
                id="end-time"
                type="time" 
                class="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                bind:value={formData.endTime}
                required
                disabled={isLoading}
              />
            </div>
          </div>
          
          <!-- Comment -->
          <div>
            <label for="comment" class="block text-sm font-medium text-gray-700">
              Comment
            </label>
            <textarea 
              id="comment"
              class="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              bind:value={formData.comment}
              disabled={isLoading}
              placeholder="Optional comment..."
            ></textarea>
          </div>
          
          <!-- Summary -->
          <!-- {#if totalHours > 0 && selectedCustomer}
            <div class="bg-gray-50 p-3 rounded border">
              <p class="text-sm font-medium text-gray-700">
                Actual Hours Worked: <span class="font-bold">{totalHours.toFixed(2)}</span>
              </p>
              <p class="text-sm font-medium text-gray-700">
                Your Efficiency: <span class="font-bold">{userEffektivtid}%</span>
              </p>
              <p class="text-sm font-medium text-gray-700">
                Billable Hours: <span class="font-bold text-blue-600">{effectiveHours.toFixed(2)}</span>
              </p>
              <p class="text-sm font-medium text-gray-700">
                Rate: <span class="font-bold">{selectedCustomer.timepris} kr/hour</span>
              </p>
              <p class="text-sm font-bold text-gray-900 border-t pt-2 mt-2">
                Total Amount: <span class="text-green-600">{totalPrice.toFixed(2)} kr</span>
              </p>
            </div>
          {/if} -->
          
          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              class="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded transition-colors duration-200"
              on:click={closeModal}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
              disabled={isLoading || !selectedCustomer}
            >
              {#if isLoading}
                <div class="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                Saving...
              {:else}
                Save
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>