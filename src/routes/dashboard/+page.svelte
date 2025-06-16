<script>
  import { onMount } from "svelte";
  import PocketBase from "pocketbase";
  import "../../app.css";
  import Dashboard from "$lib/Dashboard.svelte";
  import Sidebar from '$lib/Sidebar.svelte';
  import Ansogninger from "$lib/Ansogninger.svelte";
  import UserSettings from "$lib/Management/UserSettings.svelte";
  import Admin from "$lib/Admin.svelte";
  import AbsenceDashboard from "$lib/AbsenceLogging/Dashboard.svelte"
  import AbsenceCalender from "$lib/AbsenceLogging/Calender.svelte"
  import WorkerHoursCalendar from "$lib/Workers/WorkerHoursCalendar.svelte";

  // Initialize PocketBase
  const pb = new PocketBase("https://timesync.pockethost.io/");

  // State variables
  let isLoggedIn = false;
  let userData = null;
  let isLoading = true;
  let isLoggingOut = false;
  let userName = "";
  let authError = false;
  let activeSiteId = "dashboard";
  let sidebarCollapsed = false;

  // Site configuration
  const siteLinks = [
    { id: "dashboard", label: "Dashboard" },
    { id: "settings", label: "Settings" },
    { 
      id: "admin", 
      label: "Admin",
      isDropdown: true,
      subItems: [
        { id: "admin-activity", label: "Activity Dashboard" },
        { id: "admin-ansogninger", label: "Ansøgninger" },
        { id: "worker-hours", label: "Workers Hours" },
        { 
          id: "admin-fravaer", 
          label: "Fravær",
          isDropdown: true,
          subItems: [
            { id: "admin-fravaer-dashboard", label: "Register" },
            { id: "admin-fravaer-requests", label: "Overview" }
          ]
        }
      ]
    }
  ];

  // Utility functions
  function redirectToLogin() {
    pb.authStore.clear();
    localStorage.removeItem('activeSiteId');
    window.location.href = "/";
  }

  // Logout with animation delay
  async function handleLogout() {
    isLoggingOut = true;
    try {
      await new Promise(resolve => setTimeout(resolve, 750));
      redirectToLogin();
    } catch (error) {
      console.error("Logout failed:", error);
      isLoggingOut = false;
    }
  }

  // Fetch user data efficiently
  async function fetchUserData(userId) {
    try {
      const userRecord = await pb.collection('users').getOne(userId);
      return userRecord.name || userRecord.username || userData.email || "User";
    } catch (error) {
      // Try alternative collection name
      try {
        const userRecord = await pb.collection('_users').getOne(userId);
        return userRecord.name || userRecord.username || userData.email || "User";
      } catch {
        return userData.email || userData.username || "User";
      }
    }
  }

  // Initialize authentication and user data
  async function initializeAuth() {
    try {
      if (!pb.authStore.isValid || !pb.authStore.model?.id) {
        redirectToLogin();
        return;
      }

      userData = pb.authStore.model;
      userName = await fetchUserData(userData.id);
      
      // Restore saved preferences
      const savedActiveSiteId = localStorage.getItem('activeSiteId');
      const savedCollapseState = localStorage.getItem('sidebarCollapsed');
      
      if (savedActiveSiteId) activeSiteId = savedActiveSiteId;
      if (savedCollapseState !== null) sidebarCollapsed = savedCollapseState === 'true';
      
      isLoggedIn = true;
    } catch (error) {
      console.error("Authentication failed:", error);
      authError = true;
      setTimeout(redirectToLogin, 1000);
    } finally {
      isLoading = false;
    }
  }

  // Event handlers
  function handleSiteChange(event) {
    activeSiteId = event.detail.siteId;
    localStorage.setItem('activeSiteId', activeSiteId);
  }

  function handleSidebarToggle(event) {
    sidebarCollapsed = event.detail.collapsed;
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }

  // Initialize on mount
  onMount(initializeAuth);

  // Component mapping for cleaner rendering
  const componentMap = {
    'dashboard': Dashboard,
    'settings': UserSettings,
    'admin-activity': Admin,
    'worker-hours': WorkerHoursCalendar,
    'admin-ansogninger': Ansogninger,
    'admin-fravaer-dashboard': AbsenceDashboard,
    'admin-fravaer-requests': AbsenceCalender
  };

  $: currentComponent = componentMap[activeSiteId];
</script>

<svelte:head>
  <title>TIMESYNC - Dashboard</title>
</svelte:head>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <div class="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading dashboard...</p>
    </div>
  </div>

{:else if authError}
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <div class="mb-4">
        <svg class="h-12 w-12 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p class="text-red-600 text-lg font-semibold mb-2">Authentication Error</p>
      <p class="text-gray-600 mb-4">Please try logging in again.</p>
      <button 
        class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        on:click={redirectToLogin}
      >
        Go to Login
      </button>
    </div>
  </div>

{:else if isLoggingOut}
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <div class="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-4 text-gray-600">Logging out...</p>
    </div>
  </div>

{:else if isLoggedIn}
  <div class="min-h-screen bg-gray-100">
    <div class="flex h-screen bg-gray-100">
      <Sidebar 
        title="TIMESYNC"
        {siteLinks}
        {activeSiteId}
        collapsed={sidebarCollapsed}
        on:siteChange={handleSiteChange}
        on:toggleCollapse={handleSidebarToggle}
      />
      
      <main class="flex-grow p-6 overflow-auto">
        <div class="bg-white p-4 rounded-lg shadow">
          {#if currentComponent}
            <svelte:component this={currentComponent} {pb} {userData} {userName} />
          {:else}
            <div class="text-center py-8">
              <p class="text-gray-600">Page not found</p>
            </div>
          {/if}
        </div>
      </main>
    </div>
  </div>

{:else}
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <p class="text-gray-600 mb-4">Something went wrong. Please try refreshing the page.</p>
      <div class="space-x-2">
        <button 
          class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          on:click={() => window.location.reload()}
        >
          Refresh Page
        </button>
        <button 
          class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          on:click={redirectToLogin}
        >
          Go to Login
        </button>
      </div>
    </div>
  </div>
{/if}