<script>
    import { onMount } from 'svelte';
    import SimpleHourLog from '../lib/HourLog.svelte';
    import CalendarHourLogList from './CalendarHourLogList.svelte';
    import CustomerSettings from './CustomerSettings.svelte';
    import CustomerAssignmentManager from './CustomerAssignmentManager.svelte';
    import { initializeUser } from './stores/userStore';
  
    let activeTab = 'manager'; // 'calendar' or 'settings'
    
    onMount(async () => {
      // Initialize user data
      await initializeUser();
    });
  </script>
  
  <main class=" rounded-xl">
    <div class="container mx-auto p-4">
      
      <!-- Tabs -->
      <div class="bg-white rounded-lg shadow-md mb-6">
        <div class="border-b border-gray-200">
          <nav class="flex">
           <!--  <button
              class={`py-4 px-6 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              on:click={() => (activeTab = 'calendar')}
            >
              Calendar View
            </button> -->
            <button
              class={`py-4 px-6 font-medium text-sm ${
                activeTab === 'manager'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              on:click={() => (activeTab = 'manager')}
            >
              Manager
            </button>
            <button
              class={`py-4 px-6 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              on:click={() => (activeTab = 'settings')}
            >
              Kunder & Produkter
            </button>
            
          </nav>
        </div>
        
        <!-- Tab content -->
        <div class="p-4">
          {#if activeTab === 'calendar'}
            <CalendarHourLogList />
          {:else if activeTab === 'settings'}
            <CustomerSettings/>
          {:else if activeTab === 'manager'}
          <CustomerAssignmentManager />
          {/if}
        </div>
      </div>
    </div>
  </main>