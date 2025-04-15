<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
    
    let searchValue = '';
    let companyData = null;
    let isLoading = false;
    let error = '';
    let searchHistory = [];
    let isLoadingHistory = false;
    let historyError = '';
    let isCompanyInfoExpanded = true; // Controls the expanded/collapsed state
    
    // Initialize PocketBase
    const pb = new PocketBase('https://timesync.pockethost.io/');
    
    /**
     * Fetches company information from the CVR API
     * @param {string} searchValue - The company's CVR number or name to search for
     * @param {string} [country='dk'] - The country code (default: 'dk')
     * @returns {Promise<Object>} Promise with the company data
     */
    const fetchCompanyInfo = async (searchValue, country = 'dk') => {
      try {
        if (!searchValue || searchValue.trim() === '') {
          throw new Error('Search value cannot be empty');
        }
  
        const proxyUrl = '/api/cvr-proxy'; // Example path to your backend proxy endpoint
        
        const url = `${proxyUrl}?search=${encodeURIComponent(searchValue)}&country=${country}`;
           
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Your App Name/1.0' // It's good practice to identify your application
          }
        });
  
        if (!response.ok) {
          throw new Error(`CVR API request failed with status ${response.status}`);
        }
  
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching CVR data:', error);
        throw error;
      }
    };
    
    // Function to fetch search history from PocketBase
    const fetchSearchHistory = async () => {
      isLoadingHistory = true;
      historyError = '';
      
      try {
        const result = await pb.collection('logs').getList(1, 10, {
          sort: '-created', // Sort by creation date, newest first
        });
        searchHistory = result.items;
      } catch (err) {
        historyError = err.message || 'An error occurred while fetching search history';
        console.error('Error fetching search history:', err);
      } finally {
        isLoadingHistory = false;
      }
    };
    
    // Fetch search history on component mount
    onMount(fetchSearchHistory);
    
    // Save search to PocketBase
    const saveSearch = async (searchTerm) => {
      try {
        // Create a new record in the logs collection
        await pb.collection('logs').create({
          searched: searchTerm,
          // 'created' field will be automatically set by PocketBase
        });
        
        // Refresh the search history
        await fetchSearchHistory();
      } catch (err) {
        console.error('Error saving search history:', err);
        // We don't want to stop the main flow if this fails
      }
    };
    
    // Delete a search history record
    const deleteSearchRecord = async (recordId) => {
      try {
        await pb.collection('logs').delete(recordId);
        // Refresh the search history after deletion
        await fetchSearchHistory();
      } catch (err) {
        console.error('Error deleting search record:', err);
        historyError = err.message || 'An error occurred while deleting the record';
      }
    };
    
    // Function to handle new search
    const handleSearch = async () => {
      if (!searchValue) return;
      
      isLoading = true;
      error = '';
      
      try {
        companyData = await fetchCompanyInfo(searchValue);
        
        // Save search to history after successful search
        await saveSearch(searchValue);
      } catch (err) {
        error = err.message || 'An error occurred while fetching company data';
        companyData = null;
      } finally {
        isLoading = false;
      }
    };
  
    // Function to handle "Search Again" from history
    const handleSearchAgain = async (term) => {
      searchValue = term;
      
      isLoading = true;
      error = '';
      
      try {
        companyData = await fetchCompanyInfo(searchValue);
        // No saveSearch call here to prevent duplicates
      } catch (err) {
        error = err.message || 'An error occurred while fetching company data';
        companyData = null;
      } finally {
        isLoading = false;
      }
    };
    
    // Handle form submission (when user presses Enter in the input field)
    const handleSubmit = (e) => {
      e.preventDefault();
      handleSearch();
    };
  </script>
  
  <div class="max-w-3xl mx-auto p-4 font-sans">
    <h2 class="text-2xl font-bold text-gray-800 mb-6">Company Information Lookup</h2>
    
    <form on:submit={handleSubmit} class="mb-6">
      <div class="flex">
        <input 
          type="text" 
          bind:value={searchValue} 
          placeholder="Enter CVR number or company name"
          disabled={isLoading}
          class="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
        <button 
          type="submit" 
          disabled={isLoading || !searchValue.trim()}
          class="px-4 py-2 bg-blue-500 text-white font-medium rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
    
    {#if isLoading}
      <div class="bg-gray-50 p-6 rounded-md text-center">
        <p class="text-gray-600">Loading company information...</p>
      </div>
    {:else if error}
      <div class="bg-red-50 p-6 rounded-md">
        <p class="text-red-700">{error}</p>
      </div>
    {:else if companyData}
      <div class="bg-gray-50 p-6 rounded-md shadow-sm border border-gray-200">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-800">{companyData.name || 'Company Name Not Available'}</h3>
          <button 
            class="text-blue-500 hover:text-blue-700 focus:outline-none"
            on:click={() => isCompanyInfoExpanded = !isCompanyInfoExpanded}
            aria-label={isCompanyInfoExpanded ? 'Collapse details' : 'Expand details'}
          >
            {#if isCompanyInfoExpanded}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {/if}
          </button>
        </div>
        
        {#if isCompanyInfoExpanded}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 transition-all duration-300">
            {#if companyData.vat}
              <div class="p-3 bg-white rounded border border-gray-100">
                <span class="block text-sm font-medium text-gray-600 mb-1">VAT/CVR:</span>
                <span class="text-gray-800">{companyData.vat}</span>
              </div>
            {/if}
            
            {#if companyData.address}
              <div class="p-3 bg-white rounded border border-gray-100">
                <span class="block text-sm font-medium text-gray-600 mb-1">Address:</span>
                <span class="text-gray-800">{companyData.address}, {companyData.zipcode} {companyData.city}</span>
              </div>
            {/if}
            
            {#if companyData.phone}
              <div class="p-3 bg-white rounded border border-gray-100">
                <span class="block text-sm font-medium text-gray-600 mb-1">Phone:</span>
                <span class="text-gray-800">{companyData.phone}</span>
              </div>
            {/if}
            
            {#if companyData.email}
              <div class="p-3 bg-white rounded border border-gray-100">
                <span class="block text-sm font-medium text-gray-600 mb-1">Email:</span>
                <span class="text-gray-800">{companyData.email}</span>
              </div>
            {/if}

            {#if companyData.startdate}
              <div class="p-3 bg-white rounded border border-gray-100">
                <span class="block text-sm font-medium text-gray-600 mb-1">Created:</span>
                <span class="text-gray-800">{companyData.startdate}</span>
              </div>
            {/if}
            
            {#if companyData.companydesc}
              <div class="p-3 bg-white rounded border border-gray-100 md:col-span-2">
                <span class="block text-sm font-medium text-gray-600 mb-1">Description:</span>
                <span class="text-gray-800">{companyData.companydesc}</span>
              </div>
            {/if}
          </div>
          
          {#if companyData.productionunits && companyData.productionunits.length > 0}
            <div class="mt-6 pt-6 border-t border-gray-200">
              <h4 class="text-lg font-semibold text-gray-700 mb-3">Production Units</h4>
              <div class="space-y-4">
                {#each companyData.productionunits as unit}
                  <div class="bg-white p-4 rounded-md shadow-sm">
                    <h5 class="font-medium text-gray-800 mb-2">
                      {unit.name} 
                      {#if unit.primary}
                        <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded ml-2">Primary</span>
                      {/if}
                    </h5>
                    <p class="text-gray-600 text-sm mb-1">{unit.address}, {unit.zipcode} {unit.city}</p>
                    {#if unit.phone}<p class="text-gray-600 text-sm mb-1">Phone: {unit.phone}</p>{/if}
                    {#if unit.email}<p class="text-gray-600 text-sm">Email: {unit.email}</p>{/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {:else}
          <div class="text-center py-2 text-gray-500 italic select-none">
            Click the arrow to view company details
          </div>
        {/if}
      </div>
    {:else}
      <div class="bg-blue-50 p-6 rounded-md text-center">
        <p class="text-blue-700">Enter a CVR number or company name to search</p>
      </div>
    {/if}
  </div>
  
  <!-- Search History Component (Separate from the main component) -->
  <div class="max-w-3xl mx-auto p-4 font-sans mt-8 rounded-md">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Search History</h2>
    <div class="bg-white rounded-lg border border-gray-200">
      
      {#if isLoadingHistory}
        <div class="py-4 text-center">
          <p class="text-gray-600">Loading search history...</p>
        </div>
      {:else if historyError}
        <div class="bg-red-50 p-4 rounded-md">
          <p class="text-red-700">{historyError}</p>
        </div>
      {:else if searchHistory.length === 0}
        <div class="py-4 text-center">
          <p class="text-gray-600">No search history found.</p>
        </div>
      {:else}
        <div class="overflow-x-auto rounded-lg">
          <table class="min-w-full bg-white">
            <thead>
              <tr class="bg-gray-100 text-gray-600 text-left text-sm">
                <th class="py-2 px-4 font-semibold">Search Term</th>
                <th class="py-2 px-4 font-semibold">Date</th>
                <th class="py-2 px-4 font-semibold" colspan="2">Actions</th>
              </tr>
            </thead>
            <tbody class="text-gray-600 text-sm">
              {#each searchHistory as record}
                <tr class="border-t border-gray-100">
                  <td class="py-3 px-4">{record.searched}</td>
                  <td class="py-3 px-4">{new Date(record.created).toLocaleString()}</td>
                  <td class="py-3 px-2">
                    <button 
                      class="text-blue-500 hover:text-blue-700 cursor-pointer"
                      on:click={() => handleSearchAgain(record.searched)}
                    >
                      Search Again
                    </button>
                  </td>
                  <td class="py-3 px-2">
                    <button 
                      class="text-red-500 hover:text-red-700 cursor-pointer"
                      on:click={() => deleteSearchRecord(record.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>