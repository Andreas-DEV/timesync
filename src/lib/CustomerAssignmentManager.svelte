

<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../lib/stores/userStore';
  import PocketBase from 'pocketbase';
  
  // Initialize PocketBase - use the same URL as in your hour logging component
  const pb = new PocketBase('https://timesync.pockethost.io/');
  
  // State variables
  let users = [];
  let allCustomers = []; // All customers for filtering
  let displayedCustomers = []; // Customers to display after filtering/pagination
  let assignments = [];
  let loading = true;
  let selectedUserId = '';
  let message = { text: '', type: '' };
  let currentUserValue = null;
  
  // Pagination variables
  let currentPage = 1;
  let itemsPerPage = 5;
  let totalPages = 1;
  
  // Search variables
  let searchTerm = '';
  let searchTimeout;
  
  // Subscribe to the user store to determine admin status
  const unsubscribeUser = currentUser.subscribe(value => {
    currentUserValue = value;
  });
  
  onMount(async () => {
    try {
      // Load users, customers and existing assignments
      const [usersData, customersData, assignmentsData] = await Promise.all([
        pb.collection('users').getFullList(),
        pb.collection('kunder').getFullList(),
        pb.collection('user_customer_assignments').getFullList({
          expand: 'user,kunde'
        })
      ]);
      
      users = usersData;
      allCustomers = customersData;
      assignments = assignmentsData;
      
      // Initialize pagination
      updatePagination();
      
      loading = false;
    } catch (err) {
      console.error('Error loading data:', err);
      message = { text: 'Failed to load data: ' + err.message, type: 'error' };
      loading = false;
    }
    
    return () => {
      unsubscribeUser();
    };
  });
  
  // Update pagination based on current filters
  function updatePagination() {
    // First filter customers based on search term
    const filteredCustomers = searchTerm 
      ? allCustomers.filter(customer => 
          customer.navn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.id.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [...allCustomers];
    
    // Calculate total pages
    totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
    
    // Ensure current page is within bounds
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    
    // Get customers for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredCustomers.length);
    displayedCustomers = filteredCustomers.slice(startIndex, endIndex);
  }
  
  // Handle search input with debounce
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1; // Reset to first page on new search
      updatePagination();
    }, 300);
  }
  
  // Change page
  function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      updatePagination();
    }
  }
  
  // Handle items per page change
  function changeItemsPerPage(event) {
    itemsPerPage = parseInt(event.target.value);
    currentPage = 1; // Reset to first page
    updatePagination();
  }
  
  async function toggleAssignment(customerId) {
    if (!selectedUserId) {
      message = { text: 'Please select a user first', type: 'error' };
      return;
    }
    
    loading = true;
    
    try {
      // Check if assignment already exists
      const existingAssignment = assignments.find(
        a => a.user === selectedUserId && a.kunde === customerId
      );
      
      if (existingAssignment) {
        // Delete assignment
        await pb.collection('user_customer_assignments').delete(existingAssignment.id);
        assignments = assignments.filter(a => a.id !== existingAssignment.id);
        message = { text: 'Assignment removed successfully', type: 'success' };
      } else {
        // Create new assignment
        const newAssignment = await pb.collection('user_customer_assignments').create({
          user: selectedUserId,
          kunde: customerId
        });
        
        // Add the new assignment to the array
        assignments = [...assignments, newAssignment];
        
        message = { text: 'Customer assigned successfully', type: 'success' };
      }
    } catch (err) {
      console.error('Error toggling assignment:', err);
      message = { text: 'Failed to update assignment: ' + err.message, type: 'error' };
    } finally {
      loading = false;
    }
  }
  
  function isAssigned(customerId) {
    return assignments.some(
      a => a.user === selectedUserId && a.kunde === customerId
    );
  }
  
  // Watch for changes to selected user
  $: if (selectedUserId) {
    // Reset message when user changes
    message = { text: '', type: '' };
  }
  
  // Watch for changes that should trigger pagination update
  $: if (allCustomers && searchTerm !== undefined) {
    handleSearch();
  }
</script>

<div class="p-4 max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold mb-6">Customer Assignment Management</h1>
  
  {#if message.text}
    <div class={`p-4 mb-4 rounded-md ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {message.text}
      <button 
        class="float-right font-bold" 
        on:click={() => message = { text: '', type: '' }}
      >
        ×
      </button>
    </div>
  {/if}
  
  <div class="mb-6">
    <label for="user-select" class="block text-sm font-medium text-gray-700 mb-2">
      Select Team Member
    </label>
    <select 
      id="user-select"
      bind:value={selectedUserId}
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    >
      <option value="">-- Select a team member --</option>
      {#each users as user}
        <option value={user.id}>{user.name}</option>
      {/each}
    </select>
  </div>
  
  <!-- Search and pagination controls -->
  <div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
    <div class="mb-6 w-full">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path>
          </svg>
        </div>
        <input
          type="text"
          bind:value={searchTerm}
          on:input={handleSearch}
          placeholder="Søg efter kunde..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>
    </div>
    
   <!--  <div class="flex items-center space-x-4">
      <div>
        <label for="items-per-page" class="block text-sm font-medium text-gray-700 mb-2">Show</label>
        <select
          id="items-per-page"
          bind:value={itemsPerPage}
          on:change={changeItemsPerPage}
          class="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>
      
      <div class="text-sm text-gray-700">
        Showing {displayedCustomers.length} of {allCustomers.filter(c => 
          !searchTerm || 
          c.navn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.id.toLowerCase().includes(searchTerm.toLowerCase())
        ).length} customers
      </div>
    </div> -->
  </div>
  
  {#if loading}
    <div class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if selectedUserId}
    {#if displayedCustomers.length === 0 && searchTerm}
      <div class="text-center py-10 bg-gray-50 rounded-md">
        <p class="text-gray-500">No customers found matching '{searchTerm}'</p>
      </div>
    {:else if displayedCustomers.length === 0}
      <div class="text-center py-10 bg-gray-50 rounded-md">
        <p class="text-gray-500">No customers available</p>
      </div>
    {:else}
      <div class="bg-white shadow overflow-hidden sm:rounded-md">
        <ul class="divide-y divide-gray-200">
          {#each displayedCustomers as customer}
            <li>
              <div class="flex items-center px-4 py-4 sm:px-6">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 truncate">
                    {customer.navn}
                  </p>
                  <p class="text-sm text-gray-500">
                    {customer.timepris} kr/hour
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    on:click={() => toggleAssignment(customer.id)}
                    class={`px-4 py-2 rounded-md text-sm font-medium ${
                      isAssigned(customer.id)
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {isAssigned(customer.id) ? 'Remove Access' : 'Grant Access'}
                  </button>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </div>
      
      <!-- Pagination controls -->
      <div class="mt-4 flex justify-center">
        <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
          <button
            on:click={() => goToPage(1)}
            disabled={currentPage === 1}
            class={`relative inline-flex items-center px-2 py-2 rounded-l-md border ${
              currentPage === 1 
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span class="sr-only">First</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M7.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L3.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
          </button>
          
          <button
            on:click={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            class={`relative inline-flex items-center px-2 py-2 border ${
              currentPage === 1 
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span class="sr-only">Previous</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          
          <!-- Page number buttons - only show 5 page numbers at a time -->
          {#each Array(Math.min(5, totalPages)) as _, i}
            {@const pageNum = currentPage <= 3 
              ? i + 1 
              : currentPage >= totalPages - 2 
                ? totalPages - 4 + i 
                : currentPage - 2 + i}
            
            {#if pageNum > 0 && pageNum <= totalPages}
              <button
                on:click={() => goToPage(pageNum)}
                class={`relative inline-flex items-center px-4 py-2 border ${
                  pageNum === currentPage
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            {/if}
          {/each}
          
          <button
            on:click={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            class={`relative inline-flex items-center px-2 py-2 border ${
              currentPage === totalPages 
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span class="sr-only">Next</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          
          <button
            on:click={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            class={`relative inline-flex items-center px-2 py-2 rounded-r-md border ${
              currentPage === totalPages 
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span class="sr-only">Last</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 15.707a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L8.586 10 4.293 14.293a1 1 0 000 1.414z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M12.293 15.707a1 1 0 001.414 0l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 1.414L16.586 10l-4.293 4.293a1 1 0 000 1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    {/if}
  {:else}
    <div class="text-center py-10 bg-gray-50 rounded-md">
      <p class="text-gray-500">Please select a team member to manage their customer assignments</p>
    </div>
  {/if}
</div>