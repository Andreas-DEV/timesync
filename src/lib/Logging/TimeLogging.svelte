<!-- TimeLoggingComponent.svelte -->
<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
    // Note: SheetJS is dynamically imported when needed in the exportToExcel function
    // Install SheetJS with: npm install xlsx
    
    // Initialize PocketBase
    const pb = new PocketBase('https://timesync.pockethost.io/');
    
    // Get current week number
    function getCurrentWeek() {
      const today = new Date();
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
      return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    
    // State variables
    let customers = [];
    let selectedCustomer = null;
    let newCustomerName = '';
    let logs = [];
    let selectedDate = '';
    let showForm = false;
    let activeTab = 'arbejdstid';
    let startShiftTime = '';
    let endShiftTime = '';
    let pauseMinutes = 30;
    let workedHours = '';
    let notes = '';
    let selectedWeek = getCurrentWeek();
    
    // User management variables
    let users = [];
    let selectedUser = null;
    let filterByUser = null;
    
    // Absence form variables
    let absenceType = 'sygdom';
    let absenceHours = 7.4;
    let absenceNotes = '';
    
    // Export period variables
    let startWeek = getCurrentWeek();
    let endWeek = getCurrentWeek();
    let year = new Date().getFullYear();
    let hourlyRate = 200;
    
    // Format date to be displayed
    function formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }
    
    // Get the weekday in Danish
    function getWeekday(date) {
      if (!date) return '';
      const d = new Date(date);
      const weekdays = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
      return weekdays[d.getDay()];
    }
    
    // Convert minutes to decimal hours (like in the minuteTable from the original code)
    function minutesToDecimalHours(minutes) {
      return Math.round((minutes / 60) * 100) / 100;
    }
    
    // Calculate hours worked based on start and end time
    function calculateHours() {
      if (!startShiftTime || !endShiftTime) return;
      
      const start = new Date(`2000-01-01T${startShiftTime}`);
      const end = new Date(`2000-01-01T${endShiftTime}`);
      
      let diffMs = end - start;
      
      // Handle times past midnight
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      
      // Calculate total minutes and subtract pause
      let totalMinutes = diffMs / (60 * 1000);
      
      if (totalMinutes > 0) {
        totalMinutes -= pauseMinutes;
      }
      
      // Convert to decimal hours
      const wholeHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = Math.round(totalMinutes % 60);
      const hours = wholeHours + minutesToDecimalHours(remainingMinutes);
      
      workedHours = hours.toFixed(2);
    }
    
    // Fetch customers and users on component mount
    onMount(async () => {
      try {
        // Fetch customers
        const customerRecords = await pb.collection('kunder').getFullList();
        customers = customerRecords;
        
        // Fetch users from the existing users collection
        try {
          const userRecords = await pb.collection('users').getFullList();
          users = userRecords;
          console.log("Users loaded:", users);
        } catch (userError) {
          console.error('Error fetching users:', userError);
          alert('Fejl ved indlæsning af brugere. Du kan stadig oprette tidsregistreringer, men brugerinformation vil ikke være tilgængelig.');
          users = [];
        }
        
        fetchLogs();
        
        // Set today's date as default
        const today = new Date();
        selectedDate = today.toISOString().split('T')[0];
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    });
    
    // Create a new customer
    async function createCustomer() {
      if (!newCustomerName.trim()) {
        alert('Indtast venligst et kundenavn');
        return;
      }
      
      try {
        const data = {
          "navn": newCustomerName
        };
        
        const record = await pb.collection('kunder').create(data);
        customers = [...customers, record];
        newCustomerName = '';
        alert(`Kunde "${record.navn}" oprettet!`);
      } catch (error) {
        console.error('Error creating customer:', error);
        alert('Fejl ved oprettelse af kunde. Prøv igen.');
      }
    }
    
    // Load day data and show form
    function loadDay() {
      if (!selectedDate) {
        alert('Vælg venligst en dato først');
        return;
      }
      
      showForm = true;
      
      // Reset form fields
      startShiftTime = '';
      endShiftTime = '';
      pauseMinutes = 30;
      workedHours = '';
      notes = '';
      absenceType = 'sygdom';
      absenceHours = 7.4;
      absenceNotes = '';
      
      // Check if we have data for this day in logs
      const dateStr = new Date(selectedDate).toISOString().split('T')[0];
      const existingLog = logs.find(log => {
        const logDate = new Date(log.dato).toISOString().split('T')[0];
        return logDate === dateStr;
      });
      
      if (existingLog) {
        // Populate form with existing data
        startShiftTime = new Date(existingLog.startTid * 1000).toTimeString().slice(0, 5);
        endShiftTime = new Date(existingLog.slutTid * 1000).toTimeString().slice(0, 5);
        calculateHours();
        notes = existingLog.notes || '';
        
        // Find the corresponding customer
        const cust = customers.find(c => c.navn === existingLog.navn);
        if (cust) {
          selectedCustomer = cust;
        }
      }
    }
    
    // Save work time entry
    async function saveWorkEntry() {
      if (!selectedCustomer || !selectedDate || !startShiftTime || !endShiftTime || !selectedUser) {
        alert('Udfyld venligst alle obligatoriske felter, inklusiv bruger');
        return;
      }
      
      try {
        const start = new Date(`${selectedDate}T${startShiftTime}`);
        const end = new Date(`${selectedDate}T${endShiftTime}`);
        
        const data = {
          "navn": selectedCustomer.navn,
          "startTid": Math.floor(start.getTime() / 1000),
          "slutTid": Math.floor(end.getTime() / 1000),
          "dato": start.toISOString(),
          "notes": notes,
          "pauseMinutes": pauseMinutes,
          "userId": selectedUser.id,
          "userName": selectedUser.name || selectedUser.username || selectedUser.id
        };
        
        console.log('Saving work entry:', data);
        
        await pb.collection('tidLog').create(data);
        alert('Arbejdstid gemt!');
        fetchLogs();
      } catch (error) {
        console.error('Error saving work entry:', error);
        alert('Fejl ved gemning af arbejdstid. Prøv igen.');
      }
    }
    
    // Save absence entry
    async function saveAbsenceEntry() {
      if (!selectedDate || !absenceHours || !selectedUser) {
        alert('Udfyld venligst alle obligatoriske felter, inklusiv bruger');
        return;
      }
      
      try {
        const date = new Date(selectedDate);
        
        // Create a data object that includes the absence hours
        const data = {
          "navn": absenceType, // Using navn field to store absence type
          "startTid": 0,
          "slutTid": 0,
          "dato": date.toISOString(),
          "notes": absenceNotes,
          "absenceHours": absenceHours, // Save the absence hours to the database
          "userId": selectedUser.id,
          "userName": selectedUser.name || selectedUser.username || selectedUser.id
        };
        
        console.log('Saving absence entry:', data);
        
        const record = await pb.collection('tidLog').create(data);
        alert('Fravær gemt!');
        fetchLogs();
      } catch (error) {
        console.error('Error saving absence entry:', error);
        alert('Fejl ved gemning af fravær. Prøv igen. Fejl: ' + error.message);
      }
    }
    
    // Fetch existing logs
    async function fetchLogs() {
      try {
        let filter = '';
        
        // Apply user filter if selected
        if (filterByUser) {
          filter = `userId = "${filterByUser.id}"`;
        }
        
        const records = await pb.collection('tidLog').getFullList({
          sort: '-dato',
          filter: filter
        });
        
        logs = records;
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    }
    
    // Format timestamp to readable time
    function formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString().slice(0, 5);
    }
    
    // Calculate duration in hours and minutes
    function calculateDuration(start, end) {
      if (!start || !end) return '';
      const diff = (end - start) / 60; // minutes
      const hours = Math.floor(diff / 60);
      const minutes = Math.floor(diff % 60);
      return `${hours}t ${minutes}m`;
    }
    
    // Export to Excel
    async function exportToExcel() {
      try {
        // Dynamically import the SheetJS library
        const XLSX = await import('xlsx');
        
        // Check if we have start and end weeks
        if (!startWeek || !endWeek || !year || !hourlyRate) {
          alert('Udfyld venligst alle felter for eksport');
          return;
        }
        
        if (startWeek < 1 || startWeek > 53 || endWeek < 1 || endWeek > 53) {
          alert('Ugenumre skal være mellem 1 og 53');
          return;
        }
        
        if (endWeek < startWeek) {
          alert('Slutuge skal være større end eller lig med startugen');
          return;
        }
        
        // Calculate start and end dates for the selected weeks
        const startDate = getFirstDayOfWeek(startWeek, year);
        const endDate = getFirstDayOfWeek(endWeek, year);
        endDate.setDate(endDate.getDate() + 6); // Set to last day (Sunday) of end week
        
        // Build filter string
        let filter = `dato >= "${startDate.toISOString()}" && dato <= "${endDate.toISOString()}"`;
        
        // Add user filter if selected
        if (filterByUser) {
          filter += ` && userId = "${filterByUser.id}"`;
        }
        
        // Fetch all records for the period
        const records = await pb.collection('tidLog').getFullList({
          sort: 'dato',
          filter: filter
        });
        
        if (records.length === 0) {
          alert('Ingen data fundet for den valgte periode');
          return;
        }
        
        // Process and calculate totals
        let totalWorkHours = 0;
        let totalAbsenceHours = 0;
        let totalPay = 0;
        
        // Prepare data for Excel
        const excelData = records.map(record => {
          const recordDate = new Date(record.dato);
          const weekNum = getWeekNumber(recordDate);
          const weekDay = getWeekday(recordDate);
          
          // Calculate hours and pay differently for work vs absence
          let hours = 0;
          let pay = 0;
          
          if (isAbsenceType(record.navn)) {
            // This is an absence record
            hours = parseFloat(record.absenceHours || 0);
            totalAbsenceHours += hours;
            // No pay for absence in this simple model
          } else {
            // This is a work record
            if (record.startTid && record.slutTid) {
              const durationMs = (record.slutTid - record.startTid) * 1000;
              const pauseMs = (parseInt(record.pauseMinutes) || 0) * 60 * 1000;
              hours = parseFloat(((durationMs - pauseMs) / (3600 * 1000)).toFixed(2));
              pay = parseFloat((hours * hourlyRate).toFixed(2));
              totalWorkHours += hours;
              totalPay += pay;
            }
          }
          
          return {
            date: formatDate(record.dato),
            weekday: weekDay,
            week: weekNum,
            type: isAbsenceType(record.navn) ? getAbsenceTypeText(record.navn) : 'Arbejde',
            user: record.userName || 'Ikke angivet',
            start: isAbsenceType(record.navn) ? '' : formatTime(record.startTid),
            end: isAbsenceType(record.navn) ? '' : formatTime(record.slutTid),
            pause: isAbsenceType(record.navn) ? '' : (parseInt(record.pauseMinutes) || 0),
            hours: hours.toFixed(2),
            pay: isAbsenceType(record.navn) ? '0.00' : pay.toFixed(2),
            notes: record.notes || ''
          };
        });
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Add header info
        const headerInfo = [
          ['Tidsregistrering'],
          ['Periode:', `Uge ${startWeek} - ${endWeek}, ${year}`],
          ['Timeløn:', `${hourlyRate.toFixed(2)} kr`],
          ['Bruger:', filterByUser ? (filterByUser.name || filterByUser.username || filterByUser.id) : 'Alle brugere'],
          ['']
        ];
        
        // Add column headers
        const columnHeaders = [
          'Dato', 'Ugedag', 'Uge', 'Type', 'Bruger', 'Start', 'Slut', 'Pause (min)', 'Timer', 'Løn (kr)', 'Bemærkninger'
        ];
        
        // Convert records to rows
        const dataRows = excelData.map(record => [
          record.date,
          record.weekday,
          record.week,
          record.type,
          record.user,
          record.start,
          record.end,
          record.pause,
          record.hours,
          record.pay,
          record.notes
        ]);
        
        // Add summary
        const summaryRows = [
          [''],
          ['Arbejdstimer i alt', totalWorkHours.toFixed(2)],
          ['Fraværstimer i alt', totalAbsenceHours.toFixed(2)],
          ['Timer i alt', (totalWorkHours + totalAbsenceHours).toFixed(2)],
          ['Løn i alt', totalPay.toFixed(2) + ' kr']
        ];
        
        // Combine all data
        const allData = [
          ...headerInfo,
          columnHeaders,
          ...dataRows,
          ...summaryRows
        ];
        
        // Create worksheet and add to workbook
        const ws = XLSX.utils.aoa_to_sheet(allData);
        
        // Set column widths
        ws['!cols'] = [
          { wch: 12 }, // A - Date
          { wch: 10 }, // B - Weekday
          { wch: 5 },  // C - Week
          { wch: 15 }, // D - Type
          { wch: 15 }, // E - User
          { wch: 8 },  // F - Start
          { wch: 8 },  // G - End
          { wch: 10 }, // H - Pause
          { wch: 8 },  // I - Hours
          { wch: 10 }, // J - Pay
          { wch: 30 }  // K - Notes
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Tidsregistrering');
        
        // Generate file name with user if filtered
        const userPart = filterByUser ? `_${(filterByUser.name || filterByUser.username || filterByUser.id).replace(/\s+/g, '-')}` : '';
        const fileName = `Tidsregistrering_Uge${startWeek}-${endWeek}_${year}${userPart}.xlsx`;
        
        // Write the file and trigger download
        XLSX.writeFile(wb, fileName);
        
        alert('Excel-fil er blevet genereret og downloadet.');
      } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Fejl ved eksport til Excel: ' + error.message);
      }
    }
    
    // Helper function to get the first day of a week
    function getFirstDayOfWeek(week, year) {
      const jan4 = new Date(year, 0, 4); // January 4th is always in week 1
      const jan4Day = jan4.getDay() || 7; // Get day of week, make Sunday 7 instead of 0
      
      // Find Monday of week 1
      const firstMonday = new Date(jan4);
      firstMonday.setDate(jan4.getDate() - jan4Day + 1);
      
      // If we want week 1, return the first Monday
      if (week === 1) {
        return firstMonday;
      }
      
      // Otherwise, add the appropriate number of weeks
      const targetDate = new Date(firstMonday);
      targetDate.setDate(firstMonday.getDate() + (week - 1) * 7);
      
      return targetDate;
    }
    
    // Helper function to get week number of a date
    function getWeekNumber(date) {
      const target = new Date(date.valueOf());
      const dayNum = date.getDay() || 7;
      target.setDate(target.getDate() + (4 - dayNum));
      const firstDayOfYear = new Date(target.getFullYear(), 0, 1);
      const days = Math.floor((target - firstDayOfYear) / 86400000) + 1;
      return Math.ceil(days / 7);
    }
    
    // Switch tabs
    function switchTab(tab) {
      activeTab = tab;
    }
    
    // Check if a string is an absence type
    function isAbsenceType(str) {
      return ['sygdom', 'barns-sygdom', 'ferie', 'afspadsering', 'andet'].includes(str);
    }
    
    // Get readable absence type
    function getAbsenceTypeText(type) {
      const types = {
        'sygdom': 'Sygdom',
        'barns-sygdom': 'Barns sygdom',
        'ferie': 'Ferie',
        'afspadsering': 'Afspadsering',
        'andet': 'Andet fravær'
      };
      
      return types[type] || type;
    }
    
    // Watch for changes in start/end time to recalculate hours
    $: if (startShiftTime && endShiftTime) {
      calculateHours();
    }
  </script>
  
  <div class="max-w-4xl mx-auto p-5 font-sans">
    <h1 class="text-3xl font-bold pb-3 mb-5 border-b-2 border-gray-800">Daglig tidsregistrering</h1>
    
    <!-- Date Selection Section -->
    <div class="mb-8 p-4 border border-gray-200 rounded-lg shadow-sm">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Vælg dato og bruger</h2>
      
      <div class="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 mb-4">
        <label for="date-picker" class="text-sm font-medium text-gray-700">Dato for registrering:</label>
        <input 
          type="date" 
          id="date-picker" 
          bind:value={selectedDate}
          class="py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
        <label for="user-select" class="ml-4 text-sm font-medium text-gray-700">Bruger:</label>
        <select 
          id="user-select" 
          bind:value={selectedUser}
          class="py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value={null}>-- Vælg en bruger --</option>
          {#each users as user}
            <option value={user}>{user.name || user.username || user.id}</option>
          {/each}
        </select>
        <button 
          on:click={loadDay}
          class="mt-2 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Indlæs dag
        </button>
      </div>
    
    <!-- Recent Logs Section -->
    <div class="mb-8 p-4 border border-gray-200 rounded-lg shadow-sm">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Seneste tidsregistreringer</h2>
      
      {#if logs.length === 0}
        <p class="text-gray-500 text-center py-4">Ingen logs fundet.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dato</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde/Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bruger</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slut</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Varighed</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bemærkninger</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each logs as log}
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(log.dato)}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {isAbsenceType(log.navn) ? getAbsenceTypeText(log.navn) : log.navn}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.userName || 'Ikke angivet'}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatTime(log.startTid)}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatTime(log.slutTid)}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {isAbsenceType(log.navn) 
                      ? (log.absenceHours ? log.absenceHours + ' timer' : '')
                      : calculateDuration(log.startTid, log.slutTid)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.notes || ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
    </div>
    
    <!-- Daily Entry Form -->
    {#if showForm}
      <div class="mb-8 p-4 border border-gray-200 rounded-lg shadow-sm">
        <h2 class="text-xl font-semibold text-gray-700 mb-4">
          Tidsregistrering for <span class="font-bold">{getWeekday(selectedDate)} {formatDate(selectedDate)}</span>
        </h2>
        
        <!-- Tabs -->
        <div class="flex border-b mb-4">
          <button 
            class="py-2 px-4 mr-2 {activeTab === 'arbejdstid' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded-t-md"
            on:click={() => switchTab('arbejdstid')}
          >
            Arbejdstid
          </button>
          <button 
            class="py-2 px-4 {activeTab === 'fravaer' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded-t-md"
            on:click={() => switchTab('fravaer')}
          >
            Fravær
          </button>
        </div>
        
        <!-- Work Time Form -->
        {#if activeTab === 'arbejdstid'}
          <div class="bg-gray-50 p-4 rounded-md border-l-4 border-blue-600">
            <div class="mb-4">
              <label for="customer-select" class="block text-sm font-medium text-gray-700 mb-1">Vælg kunde:</label>
              <select 
                id="customer-select" 
                bind:value={selectedCustomer}
                class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={null}>-- Vælg en kunde --</option>
                {#each customers as customer}
                  <option value={customer}>{customer.navn}</option>
                {/each}
              </select>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label for="start-time" class="block text-sm font-medium text-gray-700 mb-1">Mødetid:</label>
                <input 
                  type="time" 
                  id="start-time" 
                  bind:value={startShiftTime}
                  class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
              </div>
              <div>
                <label for="end-time" class="block text-sm font-medium text-gray-700 mb-1">Sluttid:</label>
                <input 
                  type="time" 
                  id="end-time" 
                  bind:value={endShiftTime}
                  class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
              </div>
              <div>
                <label for="pause-minutes" class="block text-sm font-medium text-gray-700 mb-1">Pause (minutter):</label>
                <input 
                  type="number" 
                  id="pause-minutes" 
                  bind:value={pauseMinutes}
                  min="0" 
                  max="120"
                  class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
              </div>
              <div>
                <label for="calculated-hours" class="block text-sm font-medium text-gray-700 mb-1">Arbejdstimer:</label>
                <input 
                  type="number" 
                  id="calculated-hours" 
                  bind:value={workedHours}
                  readonly
                  class="w-full py-2 px-3 border border-gray-300 bg-gray-50 rounded-md shadow-sm"
                >
              </div>
            </div>
            
            <div class="mb-4">
              <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">Bemærkninger:</label>
              <input 
                type="text" 
                id="notes" 
                bind:value={notes}
                class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
            </div>
            
            <div class="flex space-x-2">
              <button 
                on:click={saveWorkEntry}
                class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
              >
                Gem registrering
              </button>
              <button 
                on:click={() => {
                  startShiftTime = '';
                  endShiftTime = '';
                  pauseMinutes = 30;
                  workedHours = '';
                  notes = '';
                }}
                class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
              >
                Ryd
              </button>
            </div>
          </div>
        {:else}
          <!-- Absence Form -->
          <div class="bg-gray-50 p-4 rounded-md border-l-4 border-orange-500">
            <div class="mb-4">
              <label for="absence-type" class="block text-sm font-medium text-gray-700 mb-1">Type af fravær:</label>
              <select 
                id="absence-type" 
                bind:value={absenceType}
                class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="sygdom">Sygdom</option>
                <option value="barns-sygdom">Barns sygdom</option>
                <option value="ferie">Ferie</option>
                <option value="afspadsering">Afspadsering</option>
                <option value="andet">Andet</option>
              </select>
            </div>
            
            <div class="mb-4">
              <label for="absence-hours" class="block text-sm font-medium text-gray-700 mb-1">Timer:</label>
              <input 
                type="number" 
                id="absence-hours" 
                bind:value={absenceHours}
                min="0" 
                max="24" 
                step="0.1"
                class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
            </div>
            
            <div class="mb-4">
              <label for="absence-notes" class="block text-sm font-medium text-gray-700 mb-1">Bemærkninger:</label>
              <input 
                type="text" 
                id="absence-notes" 
                bind:value={absenceNotes}
                class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
            </div>
            
            <div class="flex space-x-2">
              <button 
                on:click={saveAbsenceEntry}
                class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
              >
                Gem fravær
              </button>
              <button 
                on:click={() => {
                  absenceType = 'sygdom';
                  absenceHours = 7.4;
                  absenceNotes = '';
                }}
                class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
              >
                Ryd
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Create Customer Section -->
    <div class="mb-8 p-4 border border-gray-200 rounded-lg shadow-sm">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Opret ny kunde</h2>
      
      <div class="flex space-x-2">
        <input 
          type="text" 
          placeholder="Nyt kundenavn" 
          bind:value={newCustomerName}
          class="flex-1 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button 
          on:click={createCustomer}
          class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Opret kunde
        </button>
      </div>
    </div>
    
    <!-- Export Section -->
    <div class="mb-8 p-4 border border-gray-200 rounded-lg shadow-sm">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Periode for eksport</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label for="start-week" class="block text-sm font-medium text-gray-700 mb-1">Startugenr:</label>
          <input 
            type="number" 
            id="start-week" 
            bind:value={startWeek}
            min="1" 
            max="53"
            class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
        </div>
        <div>
          <label for="end-week" class="block text-sm font-medium text-gray-700 mb-1">Slutugenr:</label>
          <input 
            type="number" 
            id="end-week" 
            bind:value={endWeek}
            min="1" 
            max="53"
            class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
        </div>
        <div>
          <label for="year" class="block text-sm font-medium text-gray-700 mb-1">År:</label>
          <select 
            id="year" 
            bind:value={year}
            class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
          </select>
        </div>
        <div>
          <label for="hourly-rate" class="block text-sm font-medium text-gray-700 mb-1">Timeløn (kr):</label>
          <input 
            type="number" 
            id="hourly-rate" 
            bind:value={hourlyRate}
            min="0" 
            max="1000" 
            step="0.01"
            class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
        </div>
        <div>
          <label for="filter-user" class="block text-sm font-medium text-gray-700 mb-1">Filtrer efter bruger:</label>
          <select 
            id="filter-user" 
            bind:value={filterByUser}
            class="w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value={null}>Alle brugere</option>
            {#each users as user}
              <option value={user}>{user.name || user.username || user.id}</option>
            {/each}
          </select>
        </div>
      </div>
      
      <div class="flex space-x-4">
        <button 
          on:click={exportToExcel}
          class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Eksportér til Excel
        </button>
        
        <button 
          on:click={() => {
            fetchLogs();
          }}
          class="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          Opdater visning
        </button>
      </div>
    </div>