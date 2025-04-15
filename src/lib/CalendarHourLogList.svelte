<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
    import HourLog from './HourLog.svelte';
    
    // Initialize PocketBase
    const pb = new PocketBase('https://timesync.pockethost.io/');
    
    // State management
    let logs = [];
    let isLoading = false;
    let currentYear = new Date().getFullYear();
    let selectedMonth = null;
    let selectedUser = null;
    let allUsers = [];
    let monthlyStats = [];
    
    // Month names
    const monthNames = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    // Get monthly statistics
    function calculateMonthlyStats(logsData) {
      const stats = [];
      
      for (let month = 0; month < 12; month++) {
        // Filter logs for this month and year
        const monthLogs = logsData.filter(log => {
          const logDate = new Date(log.dato);
          return logDate.getMonth() === month && logDate.getFullYear() === currentYear;
        });
        
        // Calculate totals
        const totalHours = monthLogs.reduce((sum, log) => sum + log.totalsum, 0);
        const totalAmount = monthLogs.reduce((sum, log) => sum + log.price, 0);
        const uniqueCustomers = [...new Set(monthLogs.map(log => log.kunde_navn))];
        const uniqueUsers = [...new Set(monthLogs.map(log => log.user_name))];
        
        stats.push({
          month,
          monthName: monthNames[month],
          logCount: monthLogs.length,
          totalHours: totalHours.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          uniqueCustomers: uniqueCustomers.length,
          uniqueUsers: uniqueUsers.length
        });
      }
      
      return stats;
    }
    
    // Fetch logs for the current year
    async function fetchLogs() {
      isLoading = true;
      
      try {
        // Get the start and end dates for the current year
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear + 1, 0, 0);
        
        // Fetch logs for the current year
        const records = await pb.collection('log').getFullList({
          sort: '-dato',
          filter: `dato >= "${startDate.toISOString()}" && dato <= "${endDate.toISOString()}"`
        });
        
        logs = records;
        
        // Calculate monthly statistics
        monthlyStats = calculateMonthlyStats(logs);
        
        // Extract unique users
        const users = [...new Set(logs.map(log => log.user_name))];
        allUsers = users.map(user => ({ name: user }));
        
        console.log("Fetched logs:", logs);
        console.log("Monthly stats:", monthlyStats);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        isLoading = false;
      }
    }
    
    // Select a month to view
    function selectMonth(month) {
      selectedMonth = month;
    }
    
    // Filter logs for the selected month and user
    $: filteredLogs = logs.filter(log => {
      const logDate = new Date(log.dato);
      const monthMatch = selectedMonth !== null ? logDate.getMonth() === selectedMonth : true;
      const userMatch = selectedUser ? log.user_name === selectedUser : true;
      return monthMatch && userMatch;
    });
    
    // Format date for display
    function formatDate(isoString) {
      return new Date(isoString).toLocaleDateString();
    }
    
    // Delete a log
    async function deleteLog(id) {
      if (confirm('Are you sure you want to delete this log?')) {
        isLoading = true;
        try {
          await pb.collection('log').delete(id);
          logs = logs.filter(log => log.id !== id);
          // Recalculate stats
          monthlyStats = calculateMonthlyStats(logs);
          alert('Log deleted successfully');
        } catch (error) {
          console.error("Error deleting log:", error);
          alert('Error deleting log');
        } finally {
          isLoading = false;
        }
      }
    }
    
    // Change year
    function changeYear(increment) {
      currentYear += increment;
      selectedMonth = null;
      fetchLogs();
    }
    
    // Export logs to Excel (CSV)
    function exportToExcel() {
      // Determine which logs to export
      const logsToExport = selectedMonth !== null ? filteredLogs : logs;
      
      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Add headers
      csvContent += "Date,Customer,Hours,Price,Comment,User\n";
      
      // Add log data
      logsToExport.forEach(log => {
        const date = formatDate(log.dato);
        const customer = log.kunde_navn || 'Unknown';
        const hours = log.totalsum.toFixed(2);
        const price = log.price.toFixed(2);
        const comment = `"${(log.kommentar || '').replace(/"/g, '""')}"`;
        const user = log.user_name || 'Unknown';
        
        csvContent += `${date},${customer},${hours},${price},${comment},${user}\n`;
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      
      // Set filename based on selection
      let filename = "hour_logs";
      if (selectedMonth !== null) {
        filename += `_${monthNames[selectedMonth]}_${currentYear}`;
      } else {
        filename += `_${currentYear}`;
      }
      if (selectedUser) {
        filename += `_${selectedUser.replace(/\s+/g, '_')}`;
      }
      link.setAttribute("download", `${filename}.csv`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    // Initialize component
    onMount(() => {
      fetchLogs();
    });
  </script>
  
  <div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Hour Logs Calendar</h2>
      
      
      <div class="flex items-center space-x-4">
        <!-- Year Navigation -->
        <button 
          class="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
          on:click={() => changeYear(-1)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        
        <span class="text-xl font-semibold">{currentYear}</span>
        
        <button 
          class="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
          on:click={() => changeYear(1)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        
        <!-- Export Button -->
        <button 
          class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded flex items-center"
          on:click={exportToExcel}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          Export Excel
        </button>
      </div>
    </div>
    
    <!-- Loading indicator -->
    {#if isLoading}
      <div class="flex justify-center my-8">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    {:else}
      {#if selectedMonth !== null}
        <!-- Month Detail View -->
        <div class="bg-white rounded-lg shadow-md p-4 mb-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <button 
                class="text-blue-600 hover:text-blue-800 flex items-center"
                on:click={() => selectedMonth = null}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Back to Calendar
              </button>
              <h3 class="text-xl font-bold mt-2">{monthNames[selectedMonth]} {currentYear}</h3>
            </div>
            
            <!-- User Filter -->
            <div class="w-64">
              <label class="block text-sm font-medium text-gray-700 mb-1">Filter by User</label>
              <select 
                class="block w-full p-2 border border-gray-300 rounded-md"
                bind:value={selectedUser}
              >
                <option value={null}>All Users</option>
                {#each allUsers as user}
                  <option value={user.name}>{user.name}</option>
                {/each}
              </select>
            </div>
          </div>
          
          <!-- Month Summary -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-500">Total Logs</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].logCount}</p>
            </div>
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-500">Total Hours</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].totalHours}</p>
            </div>
            <div class="bg-yellow-50 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-500">Total Amount</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].totalAmount} kr</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-500">Unique Customers</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].uniqueCustomers}</p>
            </div>
          </div>
          
          <!-- Logs Table -->
          {#if filteredLogs.length > 0}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each filteredLogs as log}
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap">{formatDate(log.dato)}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{log.kunde_navn || 'Unknown'}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{log.totalsum.toFixed(2)}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{log.price.toFixed(2)} kr</td>
                      <td class="px-6 py-4">
                        <div class="max-w-xs truncate" title={log.kommentar}>
                          {log.kommentar || '—'}
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-gray-500">
                        {log.user_name || 'No user'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          class="text-red-600 hover:text-red-900 ml-2"
                          on:click={() => deleteLog(log.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="text-center p-8 bg-gray-50 rounded-lg">
              <p class="text-gray-500">No logs found for this month{selectedUser ? ` and user (${selectedUser})` : ''}.</p>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Calendar View -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {#each monthlyStats as stats}
            <div 
              class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              on:click={() => selectMonth(stats.month)}
            >
              <div class="bg-blue-600 text-white font-semibold p-3">
                {stats.monthName} {currentYear}
              </div>
              <div class="p-4">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <div class="text-sm text-gray-500">Logs</div>
                    <div class="text-xl font-bold">{stats.logCount}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">Hours</div>
                    <div class="text-xl font-bold">{stats.totalHours}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">Amount</div>
                    <div class="text-xl font-bold">{stats.totalAmount} kr</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">Users</div>
                    <div class="text-xl font-bold">{stats.uniqueUsers}</div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>