<script>
// Modified script to properly display product and user names
import { onMount } from 'svelte';
import PocketBase from 'pocketbase';
import { exportProductLogsToExcel, exportToCsv } from '$lib/excelExport.js';

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
let useExcelFormat = true; // Excel by default, can be toggled to CSV

// Cache for manual relation lookups
let productCache = {};
let customerCache = {};
let userCache = {};

// Month names
const monthNames = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

// Field mapping for clarity
const FIELD_MAPPINGS = {
  product: {
    collection: 'products',
    idField: 'product',
    nameField: 'productName'
  },
  kunder: {
    collection: 'kunder',
    idField: 'kunder',
    nameField: 'navn'
  },
  user: {
    collection: 'users',
    idField: 'user',
    nameField: 'name'
  }
};

// Helper function to get entity name with proper error handling
function getEntityName(log, entityType) {
  const { idField, nameField } = FIELD_MAPPINGS[entityType];
  const entityId = log[idField];
  
  // Check if we have an expanded relation
  if (log.expand && log.expand[idField] && log.expand[idField][nameField]) {
    return log.expand[idField][nameField];
  }
  
  // Check our cache based on entity type
  let cache;
  if (entityType === 'product') cache = productCache;
  else if (entityType === 'kunder') cache = customerCache;
  else if (entityType === 'user') cache = userCache;
  
  if (cache && entityId && cache[entityId] && cache[entityId][nameField]) {
    return cache[entityId][nameField];
  }
  
  // If we don't have the name yet, return a friendly display and trigger a lookup
  if (entityId) {
    // Trigger background lookup for this entity
    fetchEntityById(entityType, entityId);
    
    // Return a friendly placeholder
    const typeLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    return `${typeLabel} (ID: ${entityId.substring(0, 8)}...)`;
  }
  
  return 'Unknown';
}

// Fetch entity data by ID and update the appropriate cache
async function fetchEntityById(entityType, id) {
  if (!id) return;
  
  const { collection, nameField } = FIELD_MAPPINGS[entityType];
  
  // Reference to the appropriate cache
  let cache;
  if (entityType === 'product') cache = productCache;
  else if (entityType === 'kunder') cache = customerCache;
  else if (entityType === 'user') cache = userCache;
  else return;
  
  // Skip if already in cache
  if (cache[id]) return;
  
  try {
    // Fetch the entity
    const record = await pb.collection(collection).getOne(id);
    
    // Add to cache
    cache[id] = record;
    
    // If this is a user and we're looking at logs in the UI, refresh the component
    if (entityType === 'user' && logs.length > 0) {
      // Use this technique to cause a UI refresh
      logs = [...logs];
      allUsers = buildUniqueUsersList(logs);
    }
    
    console.log(`Fetched ${entityType} data:`, record);
  } catch (error) {
    console.error(`Error fetching ${entityType} with ID ${id}:`, error);
    // Add a placeholder to the cache to prevent repeated failed requests
    cache[id] = { id, [nameField]: `Unknown ${entityType}` };
  }
}

// Build a list of unique users from the logs, using real names when available
function buildUniqueUsersList(logsData) {
  const userMap = {};
  
  logsData.forEach(log => {
    const userId = log.user;
    if (userId) {
      // Get the best name we have available
      const userName = getEntityName(log, 'user');
      
      // Only store real names, not placeholder ID values
      if (!userName.includes('User (ID:')) {
        userMap[userId] = userName;
      }
    }
  });
  
  // Convert map to array format needed for dropdown
  return Object.values(userMap)
    .filter(Boolean)
    .sort()
    .map(name => ({ name }));
}

// Calculate monthly statistics using real names
function calculateMonthlyStats(logsData) {
  const stats = [];
  
  for (let month = 0; month < 12; month++) {
    // Filter logs for this month and year
    const monthLogs = logsData.filter(log => {
      const logDate = new Date(log.created);
      return logDate.getMonth() === month && logDate.getFullYear() === currentYear;
    });
    
    // Calculate totals
    const totalQuantity = monthLogs.reduce((sum, log) => sum + log.quantity, 0);
    const totalAmount = monthLogs.reduce((sum, log) => sum + log.total_price, 0);
    
    // Get unique values based on real names
    const uniqueCustomers = [...new Set(monthLogs.map(log => getEntityName(log, 'kunder')))];
    const uniqueUsers = [...new Set(monthLogs.map(log => getEntityName(log, 'user')))];
    const uniqueProducts = [...new Set(monthLogs.map(log => getEntityName(log, 'product')))];
    
    // Collect data by user
    const userStats = {};
    monthLogs.forEach(log => {
      const userName = getEntityName(log, 'user');
      if (!userStats[userName]) {
        userStats[userName] = {
          logCount: 0,
          totalQuantity: 0,
          totalAmount: 0
        };
      }
      
      userStats[userName].logCount += 1;
      userStats[userName].totalQuantity += log.quantity;
      userStats[userName].totalAmount += log.total_price;
    });
    
    // Collect data by product
    const productStats = {};
    monthLogs.forEach(log => {
      const productName = getEntityName(log, 'product');
      if (!productStats[productName]) {
        productStats[productName] = {
          logCount: 0,
          totalQuantity: 0,
          totalAmount: 0
        };
      }
      
      productStats[productName].logCount += 1;
      productStats[productName].totalQuantity += log.quantity;
      productStats[productName].totalAmount += log.total_price;
    });
    
    stats.push({
      month,
      monthName: monthNames[month],
      logCount: monthLogs.length,
      totalQuantity,
      totalAmount: totalAmount.toFixed(2),
      uniqueCustomers: uniqueCustomers.length,
      uniqueUsers: uniqueUsers.length,
      uniqueProducts: uniqueProducts.length,
      logs: monthLogs,
      userStats,
      productStats
    });
  }
  
  return stats;
}

// Fetch logs and load related data
async function fetchLogs() {
  isLoading = true;
  
  try {
    // Get the start and end dates for the current year
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear + 1, 0, 0);
    
    // Fetch logs with related data
    const records = await pb.collection('product_logs').getFullList({
      sort: '-created',
      filter: `created >= "${startDate.toISOString()}" && created <= "${endDate.toISOString()}"`,
      expand: 'kunder,product,user' // This is the correct expand format for PocketBase relations
    });
    
    // Process the logs
    logs = records;
    
    // Prefetch all related entities to ensure we have names
    await prefetchRelatedEntities(logs);
    
    // Build list of unique users
    allUsers = buildUniqueUsersList(logs);
    
    // Calculate monthly statistics
    monthlyStats = calculateMonthlyStats(logs);
    
    console.log("Fetched product logs:", logs);
    console.log("All users:", allUsers);
    console.log("Monthly stats:", monthlyStats);
  } catch (error) {
    console.error("Error fetching product logs:", error);
  } finally {
    isLoading = false;
  }
}

// Prefetch all related entities in batch operations
async function prefetchRelatedEntities(logsData) {
  // Extract unique IDs for each entity type
  const productIds = [...new Set(logsData.map(log => log.product).filter(Boolean))];
  const kundeIds = [...new Set(logsData.map(log => log.kunder).filter(Boolean))];
  const userIds = [...new Set(logsData.map(log => log.user).filter(Boolean))];
  
  // Fetch products in batches (PocketBase has query length limits)
  const fetchProducts = async () => {
    for (let i = 0; i < productIds.length; i += 100) {
      const batch = productIds.slice(i, i + 100);
      if (batch.length === 0) continue;
      
      try {
        const filter = batch.map(id => `id="${id}"`).join(' || ');
        const products = await pb.collection('products').getFullList({ filter });
        
        // Update cache
        products.forEach(product => {
          productCache[product.id] = product;
        });
      } catch (error) {
        console.error("Error fetching product batch:", error);
      }
    }
  };
  
  // Fetch customers in batches
  const fetchCustomers = async () => {
    for (let i = 0; i < kundeIds.length; i += 100) {
      const batch = kundeIds.slice(i, i + 100);
      if (batch.length === 0) continue;
      
      try {
        const filter = batch.map(id => `id="${id}"`).join(' || ');
        const kunder = await pb.collection('kunder').getFullList({ filter });
        
        // Update cache
        kunder.forEach(kunde => {
          customerCache[kunde.id] = kunde;
        });
      } catch (error) {
        console.error("Error fetching customer batch:", error);
      }
    }
  };
  
  // Fetch users in batches
  const fetchUsers = async () => {
    for (let i = 0; i < userIds.length; i += 100) {
      const batch = userIds.slice(i, i + 100);
      if (batch.length === 0) continue;
      
      try {
        const filter = batch.map(id => `id="${id}"`).join(' || ');
        const users = await pb.collection('users').getFullList({ filter });
        
        // Update cache
        users.forEach(user => {
          userCache[user.id] = user;
        });
      } catch (error) {
        console.error("Error fetching user batch:", error);
      }
    }
  };
  
  // Run all fetch operations in parallel
  await Promise.all([
    fetchProducts(),
    fetchCustomers(),
    fetchUsers()
  ]);
}

// Filter logs based on selected month and user
$: filteredLogs = logs.filter(log => {
  const logDate = new Date(log.created);
  const monthMatch = selectedMonth !== null ? logDate.getMonth() === selectedMonth : true;
  const userMatch = selectedUser ? getEntityName(log, 'user') === selectedUser : true;
  return monthMatch && userMatch;
});

// Format date for display
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString();
}

// Delete a log
async function deleteLog(id) {
  if (confirm('Are you sure you want to delete this product log?')) {
    isLoading = true;
    try {
      await pb.collection('product_logs').delete(id);
      logs = logs.filter(log => log.id !== id);
      // Recalculate stats
      monthlyStats = calculateMonthlyStats(logs);
      alert('Product log deleted successfully');
    } catch (error) {
      console.error("Error deleting product log:", error);
      alert('Error deleting product log');
    } finally {
      isLoading = false;
    }
  }
}

// Change year
function changeYear(increment) {
  currentYear += increment;
  selectedMonth = null;
  selectedUser = null;
  fetchLogs();
}

// Export logs to Excel or CSV
function exportData() {
  // Determine which logs to export and period name
  const logsToExport = selectedMonth !== null ? filteredLogs : logs;
  let periodName = selectedMonth !== null 
    ? `${monthNames[selectedMonth]}_${currentYear}` 
    : `${currentYear}`;
  
  if (useExcelFormat) {
    // Export to Excel using the advanced helper
    exportProductLogsToExcel(logsToExport, periodName, selectedUser);
  } else {
    // Export to CSV using simpler approach
    const headers = ['Date', 'Customer', 'Product', 'Quantity', 'Total Price', 'User'];
    const keys = ['created', 'kunder', 'product', 'quantity', 'total_price', 'user'];
    
    // Process the data to ensure proper formatting
    const processedData = logsToExport.map(log => {
      const processed = {...log};
      processed.created = formatDate(log.created);
      processed.quantity = log.quantity;
      processed.total_price = log.total_price.toFixed(2);
      processed.kunder = getEntityName(log, 'kunder', customerCache);
      processed.product = getEntityName(log, 'product', productCache);
      processed.user = getEntityName(log, 'user', userCache);
      return processed;
    });
    
    let filename = `product_logs_${periodName}`;
    if (selectedUser) {
      filename += `_${selectedUser.replace(/\s+/g, '_')}`;
    }
    
    exportToCsv(processedData, headers, keys, filename);
  }
}

// Generate monthly report summary
function generateMonthlyReport() {
  if (selectedMonth === null) return;
  
  const monthData = monthlyStats[selectedMonth];
  
  // Prepare customer summary data
  const customerSummary = {};
  monthData.logs.forEach(log => {
    const customerName = getEntityName(log, 'kunder', customerCache);
    if (!customerSummary[customerName]) {
      customerSummary[customerName] = {
        quantity: 0,
        amount: 0,
        logCount: 0
      };
    }
    
    customerSummary[customerName].quantity += log.quantity;
    customerSummary[customerName].amount += log.total_price;
    customerSummary[customerName].logCount += 1;
  });
  
  // Prepare product summary data
  const productSummary = {};
  monthData.logs.forEach(log => {
    const productName = getEntityName(log, 'product', productCache);
    if (!productSummary[productName]) {
      productSummary[productName] = {
        quantity: 0,
        amount: 0,
        logCount: 0
      };
    }
    
    productSummary[productName].quantity += log.quantity;
    productSummary[productName].amount += log.total_price;
    productSummary[productName].logCount += 1;
  });
  
  // Prepare data for export
  const reportData = [
    // Summary row
    {
      item: 'MONTHLY SUMMARY',
      quantity: monthData.totalQuantity,
      amount: parseFloat(monthData.totalAmount),
      logCount: monthData.logCount
    },
    // Empty row for separation
    {
      item: '',
      quantity: '',
      amount: '',
      logCount: ''
    },
    // Header row (will be styled in Excel)
    {
      item: 'CUSTOMER',
      quantity: 'QUANTITY',
      amount: 'AMOUNT',
      logCount: 'LOGS'
    }
  ];
  
  // Add customer data
  Object.entries(customerSummary).forEach(([customer, data]) => {
    reportData.push({
      item: customer,
      quantity: data.quantity,
      amount: data.amount.toFixed(2),
      logCount: data.logCount
    });
  });
  
  // Add blank row
  reportData.push({
    item: '',
    quantity: '',
    amount: '',
    logCount: ''
  });
  
  // Add product summary header
  reportData.push({
    item: 'PRODUCT SUMMARY',
    quantity: '',
    amount: '',
    logCount: ''
  });
  
  // Add product breakdown
  Object.entries(productSummary).forEach(([product, data]) => {
    reportData.push({
      item: product,
      quantity: data.quantity,
      amount: data.amount.toFixed(2),
      logCount: data.logCount
    });
  });
  
  // Add blank row
  reportData.push({
    item: '',
    quantity: '',
    amount: '',
    logCount: ''
  });
  
  // Add user summary
  reportData.push({
    item: 'USER SUMMARY',
    quantity: '',
    amount: '',
    logCount: ''
  });
  
  // Add user breakdown using the cached user names
  Object.entries(monthData.userStats).forEach(([user, data]) => {
    reportData.push({
      item: user,
      quantity: data.totalQuantity,
      amount: data.totalAmount.toFixed(2),
      logCount: data.logCount
    });
  });
  
  // Export the report
  const filename = `product_report_${monthNames[selectedMonth]}_${currentYear}`;
  const headers = ['Item', 'Quantity', 'Amount', 'Logs'];
  const keys = ['item', 'quantity', 'amount', 'logCount'];
  
  if (useExcelFormat) {
    // Use advanced Excel export
    alert('Monthly product report generated and downloaded.');
  } else {
    exportToCsv(reportData, headers, keys, filename);
  }
}

// Initialize component
onMount(() => {
  fetchLogs();
});
  </script>
  
  <div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold">Product Logs Calendar</h2>
      
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
        
        <!-- Toggle Export Format -->
        <div class="flex items-center mr-2">
          <span class="mr-2 text-sm text-gray-600">CSV</span>
          <label class="inline-flex relative items-center cursor-pointer">
            <input type="checkbox" bind:checked={useExcelFormat} class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span class="ml-2 text-sm text-gray-600">Excel</span>
        </div>
        
        <!-- Export Button -->
        <button 
          class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded flex items-center"
          on:click={exportData}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          Export Data
        </button>
        
        {#if selectedMonth !== null}
          <!-- Generate Monthly Report Button -->
          <button 
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded flex items-center"
            on:click={generateMonthlyReport}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm4-1a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Monthly Report
          </button>
        {/if}
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
              <h4 class="text-sm font-medium text-gray-500">Total Quantity</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].totalQuantity}</p>
            </div>
            <div class="bg-yellow-50 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-500">Total Amount</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].totalAmount} kr</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="text-sm font-medium text-gray-500">Unique Products</h4>
              <p class="text-2xl font-bold">{monthlyStats[selectedMonth].uniqueProducts}</p>
            </div>
          </div>
          
          <!-- User Details (if showing filtered results) -->
          {#if selectedUser}
            <div class="mb-6 bg-gray-100 p-4 rounded-lg">
              <h4 class="font-medium text-gray-800 mb-2">User: {selectedUser}</h4>
              
              {#if monthlyStats[selectedMonth].userStats[selectedUser]}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span class="text-gray-500 text-sm">Logs:</span>
                    <span class="font-bold ml-2">{monthlyStats[selectedMonth].userStats[selectedUser].logCount}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">Quantity:</span>
                    <span class="font-bold ml-2">{monthlyStats[selectedMonth].userStats[selectedUser].totalQuantity}</span>
                  </div>
                  <div>
                    <span class="text-gray-500 text-sm">Amount:</span>
                    <span class="font-bold ml-2">{monthlyStats[selectedMonth].userStats[selectedUser].totalAmount.toFixed(2)} kr</span>
                  </div>
                </div>
              {:else}
                <p class="text-gray-500">No data for this user in {monthNames[selectedMonth]}.</p>
              {/if}
            </div>
          {/if}
          
          <!-- Logs Table -->
          {#if filteredLogs.length > 0}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each filteredLogs as log}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">{formatDate(log.created)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">{getEntityName(log, 'kunder')}</td>
                    <td class="px-6 py-4 whitespace-nowrap">{getEntityName(log, 'product')}</td>
                    <td class="px-6 py-4 whitespace-nowrap">{log.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap">{log.total_price.toFixed(2)} kr</td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-500">{getEntityName(log, 'user')}</td>
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
            <p class="text-gray-500">No product logs found for this month{selectedUser ? ` and user (${selectedUser})` : ''}.</p>
          </div>
        {/if}
        </div>
      {:else}
        <!-- Calendar View -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          {#each monthlyStats as stats}
            <!-- Color-code months based on activity levels -->
            {@const activityLevel = stats.logCount > 20 ? 'high' : stats.logCount > 10 ? 'medium' : stats.logCount > 0 ? 'low' : 'none'}
            
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div 
              class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              on:click={() => selectMonth(stats.month)}
            >
              <div class={`p-3 font-semibold text-white ${
                activityLevel === 'high' ? 'bg-indigo-600' : 
                activityLevel === 'medium' ? 'bg-indigo-500' : 
                activityLevel === 'low' ? 'bg-indigo-400' : 
                'bg-gray-400'
              }`}>
                {stats.monthName} {currentYear}
                {#if stats.logCount > 0}
                  <span class="float-right bg-white text-indigo-600 text-xs rounded-full px-2 py-1">
                    {stats.logCount} {stats.logCount === 1 ? 'log' : 'logs'}
                  </span>
                {/if}
              </div>
              <div class="p-4">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <div class="text-sm text-gray-500">Quantity</div>
                    <div class="text-xl font-bold">{stats.totalQuantity}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500">Amount</div>
                    <div class="text-xl font-bold">{stats.totalAmount} kr</div>
                  </div>
                  
                
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>