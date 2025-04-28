<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
    import UserList from './UserList.svelte';
    import CreateUser from './CreateUser.svelte';
    
    export let adminToken = ''; // Admin token for authentication
    
    // PocketBase instance
    let pb;
    
    // UI state
    let activeTab = 'list'; // 'list' or 'create'
    
    // Initialize PocketBase with admin token
    onMount(() => {
      pb = new PocketBase('https://timesync.pockethost.io');
      
      // If an admin token is provided, use it
      if (adminToken) {
        pb.authStore.save(adminToken, null);
      }
    });
    
    // Switch between tabs
    function setActiveTab(tab) {
      activeTab = tab;
    }
    
    // This function will be called from the CreateUser component when a user is created
    function handleUserCreated() {
      // If we're showing the user list, refresh it
      if (activeTab === 'list') {
        // This will trigger a reactive update in UserList since pb is passed as a prop
        pb = pb;
      }
    }
  </script>
  
  <div class="p-6">
    <h2 class="text-2xl font-bold text-gray-800 mb-6">User Management</h2>
    
    <!-- Tab Navigation -->
    <div class="border-b border-gray-200 mb-6">
      <ul class="flex flex-wrap -mb-px">
        <li class="mr-2">
          <button
            class={`inline-block py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'list' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            on:click={() => setActiveTab('list')}
          >
            User List
          </button>
        </li>
        <li class="mr-2">
          <button
            class={`inline-block py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'create' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            on:click={() => setActiveTab('create')}
          >
            Create User
          </button>
        </li>
      </ul>
    </div>
    
    <!-- Tab Content -->
    {#if activeTab === 'list'}
      <UserList {pb} on:addUser={() => setActiveTab('create')} />
    {:else}
      <CreateUser {pb} on:userCreated={handleUserCreated} on:back={() => setActiveTab('list')} />
    {/if}
  </div>