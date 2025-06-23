<!-- +page.svelte - Fixed version with streamlined loading and admin access control -->
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
  
  // Import userStore functions
  import { 
    currentUser, 
    userName, 
    isAuthenticated, 
    initializeUser,
    logout as userStoreLogout
  } from "../../lib/stores/userStore";

  // Initialize PocketBase
  const pb = new PocketBase("https://timesync.pockethost.io/");

  // Admin configuration
  const ADMIN_USER_ID = "0273221tcxal6i5";

  // State variables
  let isLoggedIn = false;
  let userData = null;
  let isLoggingOut = false;
  let authError = false;
  let activeSiteId = "dashboard";
  let sidebarCollapsed = false;
  let displayName = "";
  let authInitialized = false;

  // Base site configuration
  const baseSiteLinks = [
    { id: "dashboard", label: "Dashboard" },
    { id: "settings", label: "Settings" }
  ];

  const adminSiteLinks = [
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

  // Subscribe to userStore changes
  $: {
    userData = $currentUser;
    displayName = $userName;
    isLoggedIn = $isAuthenticated;
  }

  // Computed property for site links based on user permissions
  $: siteLinks = isUserAdmin(userData) 
    ? [...baseSiteLinks, ...adminSiteLinks] 
    : baseSiteLinks;

  // Check if user is admin
  function isUserAdmin(user) {
    return user && user.id === ADMIN_USER_ID;
  }

  // Check if current active site requires admin access
  function requiresAdminAccess(siteId) {
    const adminSiteIds = [
      'admin-activity',
      'admin-ansogninger', 
      'worker-hours',
      'admin-fravaer-dashboard',
      'admin-fravaer-requests'
    ];
    return adminSiteIds.includes(siteId);
  }

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
      await new Promise(resolve => setTimeout(resolve, 500));
      userStoreLogout();
      redirectToLogin();
    } catch (error) {
      console.error("Logout failed:", error);
      isLoggingOut = false;
    }
  }

  // Quick auth check - no loading state, just immediate redirect if not authenticated
  async function quickAuthCheck() {
    try {
      // Quick synchronous check first
      if (!pb.authStore.isValid || !pb.authStore.model) {
        redirectToLogin();
        return;
      }

      // Initialize user store in background
      await initializeUser();
      
      // If authentication failed, redirect
      if (!$isAuthenticated) {
        redirectToLogin();
        return;
      }
      
      // Restore saved preferences
      const savedActiveSiteId = localStorage.getItem('activeSiteId');
      const savedCollapseState = localStorage.getItem('sidebarCollapsed');
      
      if (savedActiveSiteId) {
        // Check if saved site requires admin access
        if (requiresAdminAccess(savedActiveSiteId) && !isUserAdmin($currentUser)) {
          // Reset to dashboard if user doesn't have admin access
          activeSiteId = "dashboard";
          localStorage.setItem('activeSiteId', 'dashboard');
        } else {
          activeSiteId = savedActiveSiteId;
        }
      }
      if (savedCollapseState !== null) sidebarCollapsed = savedCollapseState === 'true';
      
      authInitialized = true;
      
    } catch (error) {
      console.error("Authentication failed:", error);
      authError = true;
      // Quick redirect on error
      setTimeout(redirectToLogin, 500);
    }
  }

  // Event handlers
  function handleSiteChange(event) {
    const newSiteId = event.detail.siteId;
    
    // Check if the new site requires admin access
    if (requiresAdminAccess(newSiteId) && !isUserAdmin(userData)) {
      console.warn("Access denied: Admin privileges required");
      return; // Don't change the site
    }
    
    activeSiteId = newSiteId;
    localStorage.setItem('activeSiteId', activeSiteId);
  }

  function handleSidebarToggle(event) {
    sidebarCollapsed = event.detail.collapsed;
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }

  // Initialize on mount - no loading screen
  onMount(quickAuthCheck);

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

  // Additional security check for rendering admin components
  $: canRenderCurrentComponent = !requiresAdminAccess(activeSiteId) || isUserAdmin(userData);
</script>

<svelte:head>
  <title>TIMESYNC - Dashboard</title>
</svelte:head>

<!-- Only show error state, logout state, or the main app -->
{#if authError}
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
      <div class="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-4 text-gray-600">Logging out...</p>
    </div>
  </div>

{:else if authInitialized && isLoggedIn}
  <div class="min-h-screen bg-gray-100">
    <div class="flex h-screen bg-gray-100">
      <Sidebar 
        title="TIMESYNC"
        {siteLinks}
        {activeSiteId}
        collapsed={sidebarCollapsed}
        on:siteChange={handleSiteChange}
        on:toggleCollapse={handleSidebarToggle}
        on:logout={handleLogout}
      />
      
      <main class="flex-grow p-6 overflow-auto">
        <div class="bg-white p-4 rounded-lg shadow">
          {#if currentComponent && canRenderCurrentComponent}
            <!-- No longer passing props - components will handle their own auth -->
            <svelte:component this={currentComponent} />
          {:else if !canRenderCurrentComponent}
            <div class="text-center py-8">
              <div class="mb-4">
                <svg class="h-12 w-12 text-yellow-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p class="text-gray-600 text-lg font-semibold mb-2">Access Denied</p>
              <p class="text-gray-500">You don't have permission to access this section.</p>
            </div>
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
  <!-- Minimal fallback for edge cases - will usually redirect quickly -->
  <div class="min-h-screen bg-gray-100">
    <!-- Empty state - auth check will redirect if needed -->
  </div>
{/if}