<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
  
    const pb = new PocketBase('https://timesync.pockethost.io');
  
    let currentYear = new Date().getFullYear();
    let selectedMonth = null;
    let showModal = false;
    let modalType = null; // 'hour', 'product', or 'worker'
    let hourLogs = [];
    let productLogs = [];
    let workerHours = []; // Add new array for worker hours
    let customers = [];
    let products = [];
    let monthlyStats = {};
    let loading = false;
    let dataLoaded = false; // Add this flag to track if data has been loaded
    let user = null;
    let editingLog = null;
    let editingType = null;
    let calculatedTotalPrice = 0;
    let showYearlyStats = false;
    let expandedMonths = new Set();
  
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
  
    onMount(async () => {
      // Check if user is authenticated
      if (pb.authStore.isValid) {
        user = pb.authStore.model;
        await loadMonthlyStats();
      } else {
        // Redirect to login or show login form
        alert('Please log in to access the dashboard');
        return;
      }
    });
  
    function convertMinutesToDecimal(minutes) {
      // Creating a mapping of minutes to decimal hours based on the provided table
      const conversionTable = {
        0: 0.00, 1: 0.02, 2: 0.03, 3: 0.05, 4: 0.07, 5: 0.08, 6: 0.1, 7: 0.12, 8: 0.13, 9: 0.15, 10: 0.17,
        11: 0.18, 12: 0.2, 13: 0.22, 14: 0.23, 15: 0.25, 16: 0.27, 17: 0.28, 18: 0.3, 19: 0.32, 20: 0.33,
        21: 0.35, 22: 0.37, 23: 0.38, 24: 0.4, 25: 0.42, 26: 0.43, 27: 0.45, 28: 0.47, 29: 0.48, 30: 0.5,
        31: 0.52, 32: 0.53, 33: 0.55, 34: 0.57, 35: 0.58, 36: 0.6, 37: 0.62, 38: 0.63, 39: 0.65, 40: 0.67,
        41: 0.68, 42: 0.7, 43: 0.72, 44: 0.73, 45: 0.75, 46: 0.77, 47: 0.78, 48: 0.8, 49: 0.82, 50: 0.83,
        51: 0.85, 52: 0.87, 53: 0.88, 54: 0.9, 55: 0.92, 56: 0.93, 57: 0.95, 58: 0.97, 59: 0.98, 60: 1.0,
      };
  
      if (minutes <= 0) return 0;
  
      // Calculate hours and remaining minutes
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
  
      // Get decimal value for remaining minutes
      const decimalPart = conversionTable[remainingMinutes] || 0;
  
      // Return total hours in decimal
      return hours + decimalPart;
    }
  
    function truncateText(text, maxLength = 30) {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
  
    function minutesToTimeString(minutes) {
      if (minutes <= 0) return "00:00";
      
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
  
    async function loadMonthlyStats() {
      if (!user) return;
      
      loading = true;
      dataLoaded = false;
      monthlyStats = {};
      
      try {
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31, 23, 59, 59);
        
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();
  
        // Load all hour logs for the year
        const hourLogsResult = await pb.collection('log').getList(1, 500, {
          filter: `user = "${user.id}" && dato >= "${startDateStr}" && dato <= "${endDateStr}"`,
          sort: '-dato'
        });
  
        // Load all product logs for the year
        const productLogsResult = await pb.collection('product_logs').getList(1, 500, {
          filter: `user = "${user.id}" && created >= "${startDateStr}" && created <= "${endDateStr}"`,
          sort: '-created'
        });

        // Load all worker hours for the year
        const workerHoursResult = await pb.collection('worker_hours').getList(1, 500, {
          filter: `user = "${user.id}" && dato >= "${startDateStr}" && dato <= "${endDateStr}"`,
          sort: '-dato'
        });
  
        // Calculate stats for each month
        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const monthStart = new Date(currentYear, monthIndex, 1);
          const monthEnd = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);
  
          const monthHourLogs = hourLogsResult.items.filter(log => {
            const logDate = new Date(log.dato);
            return logDate >= monthStart && logDate <= monthEnd;
          });
  
          const monthProductLogs = productLogsResult.items.filter(log => {
            const logDate = new Date(log.created);
            return logDate >= monthStart && logDate <= monthEnd;
          });

          const monthWorkerHours = workerHoursResult.items.filter(log => {
            const logDate = new Date(log.dato);
            return logDate >= monthStart && logDate <= monthEnd;
          });
  
          const totalHours = monthHourLogs.reduce((sum, log) => sum + (log.totalsum || 0), 0);
          const totalProducts = monthProductLogs.reduce((sum, log) => sum + (log.quantity || 0), 0);
          const totalWorkerHours = monthWorkerHours.reduce((sum, log) => sum + (log.totalsum || 0), 0);
          const totalWorkerOvertimeHours = monthWorkerHours.reduce((sum, log) => sum + (log.overarbejde || 0), 0);
          const overtimeWorkSessions = monthWorkerHours.filter(log => log.overtid).length;
          const workingDays = new Set(monthHourLogs.map(log => new Date(log.dato).toDateString())).size;
  
          monthlyStats[monthIndex] = {
            hourLogs: monthHourLogs.length,
            productLogs: monthProductLogs.length,
            workerHoursLogs: monthWorkerHours.length,
            totalHours: totalHours,
            totalProducts: totalProducts,
            totalWorkerHours: totalWorkerHours,
            totalWorkerOvertimeHours: totalWorkerOvertimeHours,
            overtimeWorkSessions: overtimeWorkSessions,
            workingDays: workingDays,
            avgHoursPerDay: workingDays > 0 ? (totalHours / workingDays) : 0
          };
        }
        
        dataLoaded = true;
      } catch (error) {
        console.error('Error loading monthly stats:', error);
      } finally {
        loading = false;
      }
    }
  
    async function loadMonthData(monthIndex) {
      if (!user || !dataLoaded) return; // Prevent clicking if data not loaded
      
      selectedMonth = monthIndex;
      showModal = true;
    }
  
    async function loadDataForModal(type) {
      if (!user || selectedMonth === null) return;
      
      loading = true;
      modalType = type;
      
      try {
        const startDate = new Date(currentYear, selectedMonth, 1);
        const endDate = new Date(currentYear, selectedMonth + 1, 0, 23, 59, 59);
        
        // Format dates for PocketBase filter
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();
  
        // Load hour logs for the selected month
        if (type === 'hour') {
          const hourLogsResult = await pb.collection('log').getList(1, 100, {
            filter: `user = "${user.id}" && dato >= "${startDateStr}" && dato <= "${endDateStr}"`,
            sort: '-dato',
            expand: 'user'
          });
          hourLogs = hourLogsResult.items;
        }
  
        // Load product logs for the selected month
        if (type === 'product') {
          const productLogsResult = await pb.collection('product_logs').getList(1, 100, {
            filter: `user = "${user.id}" && created >= "${startDateStr}" && created <= "${endDateStr}"`,
            sort: '-created',
            expand: 'kunder,product,user'
          });
          productLogs = productLogsResult.items;
        }

        // Load worker hours for the selected month
        if (type === 'worker') {
          const workerHoursResult = await pb.collection('worker_hours').getList(1, 100, {
            filter: `user = "${user.id}" && dato >= "${startDateStr}" && dato <= "${endDateStr}"`,
            sort: '-dato',
            expand: 'user'
          });
          workerHours = workerHoursResult.items;
        }
  
        // Load customers for dropdown
        const kundersResult = await pb.collection('kunder').getList(1, 100, {
          sort: 'navn'
        });
        customers = kundersResult.items;
  
        // Also load products for dropdown
        const productsResult = await pb.collection('products').getList(1, 100, {
          sort: 'productName'
        });
        products = productsResult.items;
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data. Please try again.');
      } finally {
        loading = false;
      }
    }
  
    function reloadData() {
      if (selectedMonth !== null && modalType) {
        loadDataForModal(modalType);
      }
    }
  
    function closeModal() {
      showModal = false;
      modalType = null;
      selectedMonth = null;
      hourLogs = [];
      productLogs = [];
      workerHours = [];
      customers = [];
      products = [];
    }

    function toggleMonthStats(monthIndex) {
      if (expandedMonths.has(monthIndex)) {
        expandedMonths.delete(monthIndex);
      } else {
        expandedMonths.add(monthIndex);
      }
      expandedMonths = expandedMonths; // Trigger reactivity
    }
  
    function startEditing(log, type) {
      editingLog = { ...log };
      editingType = type;
      
      // If editing a product log, recalculate the price to ensure correct tiered pricing
      if (type === 'product' && editingLog.product && editingLog.quantity) {
        const selectedProduct = products.find(p => p.id === editingLog.product);
        if (selectedProduct) {
          calculatedTotalPrice = calculateProductTotalPrice(selectedProduct, editingLog.quantity);
          editingLog.total_price = calculatedTotalPrice;
        }
      } else {
        calculatedTotalPrice = editingLog.total_price || 0;
      }
    }
  
    function cancelEditing() {
      editingLog = null;
      editingType = null;
    }
  
    async function saveEdit() {
      if (!editingLog || !editingType) return;
      
      loading = true;
      try {
        if (editingType === 'hour') {
          const data = {
            kunde_id: editingLog.kunde_id,
            kunde_navn: editingLog.kunde_navn,
            user: editingLog.user,
            user_name: editingLog.user_name,
            dato: editingLog.dato,
            start: parseFloat(editingLog.start),
            slut: parseFloat(editingLog.slut),
            totalsum: parseFloat(editingLog.totalsum),
            price: parseFloat(editingLog.price),
            kommentar: editingLog.kommentar,
            invoiced: editingLog.invoiced
          };
          await pb.collection('log').update(editingLog.id, data);
        } else if (editingType === 'product') {
          const data = {
            quantity: parseInt(editingLog.quantity),
            total_price: parseFloat(editingLog.total_price),
            kunder: editingLog.kunder,
            product: editingLog.product,
            user: editingLog.user,
            invoiced: editingLog.invoiced,
            comment: editingLog.comment
          };
          await pb.collection('product_logs').update(editingLog.id, data);
        }
        
        // Reload data to show updated information
        reloadData();
        cancelEditing();
      } catch (error) {
        console.error('Error updating record:', error);
        alert('Error updating record. Please try again.');
      } finally {
        loading = false;
      }
    }
  
    function formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('da-DK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  
    function formatCurrency(amount) {
      return new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: 'DKK'
      }).format(amount);
    }
  
    const priceTiers = [
      { min: 1, max: 5, price: 100.00 },
      { min: 6, max: 10, price: 90.00 },
      { min: 11, max: Infinity, price: 70.00 }
    ];
  
    // Calculate the price based on quantity
    function calculateTieredPrice(baseProduct, qty) {
      if (!baseProduct || !qty) return 0;
      
      // Ensure qty is a number
      const quantity = parseInt(qty);
      
      // Check if this is the product we want to apply tiered pricing to
      if (baseProduct.productName.toLowerCase().includes('lønseddel') || 
          baseProduct.productName.toLowerCase().includes('lonseddel') ||
          baseProduct.productName.toLowerCase().includes('payslip')) {
        
        // Find the appropriate tier
        const tier = priceTiers.find(tier => quantity >= tier.min && quantity <= tier.max);
        console.log(`Lønseddel pricing: quantity=${quantity}, tier=`, tier); // Debug log
        return tier ? tier.price : baseProduct.productPrice;
      }
      
      // For other products, use the standard price
      return baseProduct.productPrice;
    }
  
    // Calculate total price based on quantity and unit price
    function calculateProductTotalPrice(product, quantity) {
      if (!product || !quantity) return 0;
      
      // Ensure quantity is a number
      const qty = parseInt(quantity);
      
      // Get the unit price based on tiers
      const appliedPrice = calculateTieredPrice(product, qty);
      
      // Return total price
      const total = appliedPrice * qty;
      console.log(`Total calculation: ${appliedPrice} * ${qty} = ${total}`); // Debug log
      return total;
    }
  </script>
  
  <div class="min-h-screen p-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class=" rounded-lg p-6 mb-6">
        <div class="flex justify-end items-center">
          
          <div class="flex items-center space-x-4">
            <select 
              bind:value={currentYear} 
              on:change={loadMonthlyStats}
              disabled={loading}
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#each Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i) as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
            <button 
              on:click={reloadData}
              disabled={selectedMonth === null || loading || !modalType}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reload</span>
            </button>
          </div>
        </div>
        
      </div>
  
      <!-- Calendar Grid -->
      <div class="bg-white rounded-xl shadow-lg p-8 mb-6 border border-gray-100">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-bold text-gray-800 flex items-center space-x-3">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{currentYear} Calendar</span>
            {#if loading && !dataLoaded}
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            {/if}
          </h2>
          <button 
            on:click={() => showYearlyStats = !showYearlyStats}
            disabled={!dataLoaded}
            class="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              class="w-5 h-5 transition-transform duration-200 text-blue-600 {showYearlyStats ? 'rotate-180' : ''}" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span class="text-sm font-semibold text-blue-700">Year Overview</span>
          </button>
        </div>
        
        <!-- Year Overview Stats -->
        {#if showYearlyStats && Object.keys(monthlyStats).length > 0 && dataLoaded}
          {@const yearStats = Object.values(monthlyStats).reduce((acc, month) => ({
            totalHours: acc.totalHours + month.totalHours,
            totalProducts: acc.totalProducts + month.totalProducts,
            totalWorkerHours: acc.totalWorkerHours + month.totalWorkerHours,
            totalWorkerOvertimeHours: acc.totalWorkerOvertimeHours + month.totalWorkerOvertimeHours,
            totalHourEntries: acc.totalHourEntries + month.hourLogs,
            totalProductEntries: acc.totalProductEntries + month.productLogs,
            totalWorkerEntries: acc.totalWorkerEntries + month.workerHoursLogs,
            totalWorkingDays: acc.totalWorkingDays + month.workingDays,
            overtimeWorkSessions: acc.overtimeWorkSessions + month.overtimeWorkSessions
          }), { totalHours: 0, totalProducts: 0, totalWorkerHours: 0, totalWorkerOvertimeHours: 0, totalHourEntries: 0, totalProductEntries: 0, totalWorkerEntries: 0, totalWorkingDays: 0, overtimeWorkSessions: 0 })}
          
          <div class="grid grid-cols-2 md:grid-cols-6 gap-6 mb-8 p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-blue-100 shadow-inner">
            <div class="text-center p-4 bg-white rounded-xl shadow-sm border border-blue-100">
              <div class="text-3xl font-bold text-blue-600 mb-1">{yearStats.totalHours.toFixed(1)}</div>
              <div class="text-sm font-medium text-gray-600">Total Hours</div>
            </div>
            <div class="text-center p-4 bg-white rounded-xl shadow-sm border border-green-100">
              <div class="text-3xl font-bold text-green-600 mb-1">{yearStats.totalProducts}</div>
              <div class="text-sm font-medium text-gray-600">Products Logged</div>
            </div>
            <div class="text-center p-4 bg-white rounded-xl shadow-sm border border-indigo-100">
              <div class="text-3xl font-bold text-indigo-600 mb-1">{yearStats.totalWorkerHours.toFixed(1)}</div>
              <div class="text-sm font-medium text-gray-600">Worker Hours</div>
            </div>
            <div class="text-center p-4 bg-white rounded-xl shadow-sm border border-orange-100">
              <div class="text-3xl font-bold text-orange-600 mb-1">{yearStats.totalWorkerOvertimeHours.toFixed(1)}</div>
              <div class="text-sm font-medium text-gray-600">Overtime Hours</div>
            </div>
            <div class="text-center p-4 bg-white rounded-xl shadow-sm border border-purple-100">
              <div class="text-3xl font-bold text-purple-600 mb-1">{yearStats.totalWorkingDays}</div>
              <div class="text-sm font-medium text-gray-600">Working Days</div>
            </div>
            <div class="text-center p-4 bg-white rounded-xl shadow-sm border border-red-100">
              <div class="text-3xl font-bold text-red-600 mb-1">{yearStats.overtimeWorkSessions}</div>
              <div class="text-sm font-medium text-gray-600">OT Sessions</div>
            </div>
          </div>
        {/if}
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {#each months as month, index}
            {@const stats = monthlyStats[index] || { hourLogs: 0, productLogs: 0, workerHoursLogs: 0, totalHours: 0, totalProducts: 0, totalWorkerHours: 0, totalWorkerOvertimeHours: 0, overtimeWorkSessions: 0, workingDays: 0, avgHoursPerDay: 0 }}
            {@const hasActivity = stats.hourLogs > 0 || stats.productLogs > 0 || stats.workerHoursLogs > 0}
            {@const isExpanded = expandedMonths.has(index)}
            
            <div
              class="group relative p-6 rounded-2xl transition-all duration-300 overflow-hidden {
                !dataLoaded 
                  ? 'border-2 border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 opacity-60 cursor-not-allowed' 
                  : selectedMonth === index && showModal
                    ? 'border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg transform scale-105 -translate-y-1' 
                    : hasActivity 
                      ? 'border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 hover:border-green-300 hover:from-green-100 hover:to-emerald-100 shadow-md hover:shadow-xl transform hover:scale-105 hover:-translate-y-1 cursor-pointer' 
                      : 'border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:border-blue-300 hover:from-blue-50 hover:to-indigo-50 shadow-md hover:shadow-xl transform hover:scale-105 hover:-translate-y-1 cursor-pointer'
              }"
            >
              <!-- Main month button -->
              <button
                on:click={() => loadMonthData(index)}
                disabled={!dataLoaded}
                class="w-full text-left cursor-pointer relative z-10 disabled:cursor-not-allowed"
              >
                <div class="text-xl font-bold mb-2 text-gray-800 group-hover:text-gray-900 transition-colors {!dataLoaded ? 'text-gray-500' : ''}">{month}</div>
                <div class="text-sm font-medium text-gray-500 mb-4">{currentYear}</div>
                
                
              </button>
            </div>
          {/each}
        </div>
      </div>
  

    </div>
  
    <!-- Month Data Modal -->
    {#if showModal && selectedMonth !== null}
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-hidden flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-medium text-gray-900">
              {months[selectedMonth]} {currentYear} - Select Data Type
            </h3>
            <button 
              on:click={closeModal}
              class="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Month Stats Overview -->
          <!-- {#if monthlyStats[selectedMonth]}
            {@const stats = monthlyStats[selectedMonth]}
            <div class="mb-8 p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-2xl border border-slate-200 shadow-lg">
              <div class="flex items-center mb-6">
                <div class="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-4"></div>
                <h4 class="text-2xl font-bold text-slate-800 tracking-tight">Month Overview</h4>
              </div>
              <div class="flex flex-wrap justify-center gap-6">
                {#if stats.totalHours > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-blue-700 mb-1">{stats.totalHours.toFixed(1)}</div>
                      <div class="text-sm font-medium text-slate-600">Hours</div>
                    </div>
                  </div>
                {/if}
                {#if stats.totalProducts > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-emerald-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-emerald-700 mb-1">{stats.totalProducts}</div>
                      <div class="text-sm font-medium text-slate-600">Products</div>
                    </div>
                  </div>
                {/if}
                {#if stats.totalWorkerHours > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-indigo-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-indigo-700 mb-1">{stats.totalWorkerHours.toFixed(1)}</div>
                      <div class="text-sm font-medium text-slate-600">Worker Hours</div>
                    </div>
                  </div>
                {/if}
                {#if stats.totalWorkerOvertimeHours > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-orange-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-orange-700 mb-1">{stats.totalWorkerOvertimeHours.toFixed(1)}</div>
                      <div class="text-sm font-medium text-slate-600">Overtime</div>
                    </div>
                  </div>
                {/if}
                {#if stats.overtimeWorkSessions > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-red-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-red-700 mb-1">{stats.overtimeWorkSessions}</div>
                      <div class="text-sm font-medium text-slate-600">OT Sessions</div>
                    </div>
                  </div>
                {/if}
                {#if stats.workingDays > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-purple-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-purple-700 mb-1">{stats.workingDays}</div>
                      <div class="text-sm font-medium text-slate-600">Working Days</div>
                    </div>
                  </div>
                {/if}
                {#if stats.avgHoursPerDay > 0}
                  <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                    <div class="text-center">
                      <div class="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div class="text-3xl font-bold text-slate-700 mb-1">{stats.avgHoursPerDay.toFixed(1)}</div>
                      <div class="text-sm font-medium text-slate-600">Avg/Day</div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if} -->
          
          {#if !modalType}
            <!-- Data Type Selection -->
            <div class="flex justify-center space-x-6 py-8">
              <button 
                on:click={() => loadDataForModal('hour')}
                class="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              >
                <svg class="w-12 h-12 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-lg font-medium text-gray-900">Hour Logs</span>
                <span class="text-sm text-gray-500">View and edit time entries</span>
              </button>
              
              <button 
                on:click={() => loadDataForModal('product')}
                class="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              >
                <svg class="w-12 h-12 text-green-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span class="text-lg font-medium text-gray-900">Product Logs</span>
                <span class="text-sm text-gray-500">View and edit product entries</span>
              </button>

              <button 
                on:click={() => loadDataForModal('worker')}
                class="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              >
                <svg class="w-12 h-12 text-indigo-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span class="text-lg font-medium text-gray-900">Worker Hours</span>
                <span class="text-sm text-gray-500">View your worked time logs</span>
              </button>
            </div>
          {:else}
            <!-- Data Display -->
            <div class="flex-1 overflow-y-auto">
              {#if loading}
                <div class="flex justify-center items-center py-12">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              {:else if modalType === 'hour'}
                <!-- Hour Logs Table -->
                <div class="mb-4 flex justify-between items-center">
                  <button 
                    on:click={() => modalType = null}
                    class="text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    ← Back to selection
                  </button>
                  <h4 class="text-lg font-medium text-gray-900">
                    Hour Logs ({hourLogs.length} entries)
                  </h4>
                </div>
                
                {#if hourLogs.length === 0}
                  <div class="p-6 text-center text-gray-500">
                    No hour logs found for this month.
                  </div>
                {:else}
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each hourLogs as log}
                          <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(log.dato)}
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs" title={log.kunde_navn}>
                              <div class="truncate">
                                {truncateText(log.kunde_navn, 25)}
                              </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {minutesToTimeString(log.start)} - {minutesToTimeString(log.slut)} ({log.totalsum}h)
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs" title={log.kommentar || 'No comment'}>
                              <div class="truncate">
                                {truncateText(log.kommentar || 'No comment', 30)}
                              </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button 
                                on:click={() => startEditing(log, 'hour')}
                                class="text-blue-600 hover:text-blue-900 cursor-pointer"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              {:else if modalType === 'product'}
                <!-- Product Logs Table -->
                <div class="mb-4 flex justify-between items-center">
                  <button 
                    on:click={() => modalType = null}
                    class="text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    ← Back to selection
                  </button>
                  <h4 class="text-lg font-medium text-gray-900">
                    Product Logs ({productLogs.length} entries)
                  </h4>
                </div>
                
                {#if productLogs.length === 0}
                  <div class="p-6 text-center text-gray-500">
                    No product logs found for this month.
                  </div>
                {:else}
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each productLogs as log}
                          <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(log.created)}
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs" title={log.expand?.product?.productName || 'Unknown'}>
                              <div class="truncate">
                                {truncateText(log.expand?.product?.productName || 'Unknown', 30)}
                              </div>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs" title={log.expand?.kunder?.navn || 'Unknown'}>
                              <div class="truncate">
                                {truncateText(log.expand?.kunder?.navn || 'Unknown', 25)}
                              </div>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs" title={log.comment || 'No comment'}>
                              <div class="truncate">
                                {truncateText(log.comment || 'No comment', 30)}
                              </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.quantity}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button 
                                on:click={() => startEditing(log, 'product')}
                                class="text-blue-600 hover:text-blue-900 cursor-pointer"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              {:else if modalType === 'worker'}
                <!-- Worker Hours Table -->
                <div class="mb-4 flex justify-between items-center">
                  <button 
                    on:click={() => modalType = null}
                    class="text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    ← Back to selection
                  </button>
                  <h4 class="text-lg font-medium text-gray-900">
                    Worker Hours ({workerHours.length} entries)
                  </h4>
                </div>
                
                {#if workerHours.length === 0}
                  <div class="p-6 text-center text-gray-500">
                    No worker hours found for this month.
                  </div>
                {:else}
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker Name</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime Hours</th>
                          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Status</th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {#each workerHours as log}
                          <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(log.dato)}
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-900">
                              {log.user_name || 'Unknown'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {minutesToTimeString(log.start)} - {minutesToTimeString(log.slut)} ({log.totalsum}h)
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div class="flex items-center">
                                {#if log.overarbejde && log.overarbejde > 0}
                                  <span class="text-orange-600 font-medium">{log.overarbejde}h</span>
                                {:else}
                                  <span class="text-gray-400">-</span>
                                {/if}
                              </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                              {#if log.overtid}
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <div class="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                                  Overtime
                                </span>
                              {:else}
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  <div class="w-2 h-2 bg-gray-500 rounded-full mr-1"></div>
                                  Regular
                                </span>
                              {/if}
                            </td>
                            
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  
    <!-- Edit Modal -->
    {#if editingLog && editingType}
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">
              Edit {editingType === 'hour' ? 'Hour' : 'Product'} Log
            </h3>
            
            <form on:submit|preventDefault={saveEdit} class="space-y-4">
              {#if editingType === 'hour'}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Customer</label>
                    <select 
                      bind:value={editingLog.kunde_id}
                      on:change={(e) => {
                        const selectedCustomer = customers.find(c => c.id === e.target.value);
                        if (selectedCustomer) {
                          editingLog.kunde_navn = selectedCustomer.navn;
                        }
                      }}
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Select customer...</option>
                      {#each customers as customer}
                        <option value={customer.id}>{customer.navn}</option>
                      {/each}
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Customer Name</label>
                    <input 
                      bind:value={editingLog.kunde_navn}
                      type="text" 
                      readonly
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Start Time</label>
                    <input 
                      type="time" 
                      on:input={(e) => {
                        // Convert HH:MM to minutes when input changes
                        const timeValue = e.target.value;
                        if (timeValue) {
                          const [hours, minutes] = timeValue.split(':').map(Number);
                          editingLog.start = (hours * 60) + minutes;
                        }
                      }}
                      value={minutesToTimeString(editingLog.start)}
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">End Time</label>
                    <input 
                      type="time" 
                      on:input={(e) => {
                        // Convert HH:MM to minutes when input changes
                        const timeValue = e.target.value;
                        if (timeValue) {
                          const [hours, minutes] = timeValue.split(':').map(Number);
                          editingLog.slut = (hours * 60) + minutes;
                        }
                      }}
                      value={minutesToTimeString(editingLog.slut)}
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">Comment</label>
                    <textarea 
                      bind:value={editingLog.kommentar}
                      rows="3"
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                </div>
              {:else if editingType === 'product'}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Customer</label>
                    <select 
                      bind:value={editingLog.kunder}
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Select customer...</option>
                      {#each customers as customer}
                        <option value={customer.id}>{customer.navn}</option>
                      {/each}
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Product</label>
                    <select 
                      bind:value={editingLog.product}
                      on:change={() => {
                        // Recalculate total price when product changes using tiered pricing
                        const selectedProduct = products.find(p => p.id === editingLog.product);
                        if (selectedProduct && editingLog.quantity) {
                          editingLog.total_price = calculateProductTotalPrice(selectedProduct, editingLog.quantity);
                          calculatedTotalPrice = editingLog.total_price;
                        }
                      }}
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Select product...</option>
                      {#each products as product}
                        <option value={product.id}>{product.productName}</option>
                      {/each}
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Quantity</label>
                    <input 
                      bind:value={editingLog.quantity}
                      on:input={() => {
                        // Recalculate total price when quantity changes using tiered pricing
                        const selectedProduct = products.find(p => p.id === editingLog.product);
                        if (selectedProduct && editingLog.quantity) {
                          editingLog.total_price = calculateProductTotalPrice(selectedProduct, editingLog.quantity);
                          calculatedTotalPrice = editingLog.total_price;
                        }
                      }}
                      type="number" 
                      min="1"
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Total Price (DKK)</label>
                    <input 
                      value={formatCurrency(editingLog.total_price || 0)}
                      type="text" 
                      readonly
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">Comment</label>
                    <textarea 
                      bind:value={editingLog.comment}
                      rows="3"
                      class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                </div>
              {/if}
              
              <div class="flex justify-end space-x-3 pt-4">
                <button 
                  type="button"
                  on:click={cancelEditing}
                  class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    /* Additional custom styles if needed */
  </style>