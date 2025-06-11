<script>
  import { onMount } from "svelte";
  import PocketBase from "pocketbase";
  import "../../app.css";
  import Dashboard from "$lib/Dashboard.svelte";
  import Sidebar from '$lib/Sidebar.svelte';
  import CvrTjek from "$lib/CvrTjek.svelte";
  import Ansogninger from "$lib/Ansogninger.svelte";
  import Admin from "$lib/Admin.svelte";
  import AbsenceDashboard from "$lib/AbsenceLogging/Dashboard.svelte"
  import AbsenceCalender from "$lib/AbsenceLogging/Calender.svelte"
  import WorkerHoursCalendar from "$lib/Workers/WorkerHoursCalendar.svelte";

  import Logo from "$lib/assets/logo.svg"

  // Initialize PocketBase
  const pb = new PocketBase("https://timesync.pockethost.io/");

  let isLoggedIn = false;
  let userData = null;
  let isLoading = true;
  let isLoggingOut = false;
  let userName = "";
  let authError = false;

  // Logout function with delay
  async function handleLogout() {
    isLoggingOut = true;

    try {
      // Add a delay before logging out
      await new Promise((resolve) => setTimeout(resolve, 750));

      // Clear auth store and redirect to home
      pb.authStore.clear();
      // Clear the active site from localStorage when logging out
      localStorage.removeItem('activeSiteId');
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      isLoggingOut = false;
    }
  }

  // Check authentication on component mount
  onMount(async () => {
    try {
      // Debug PocketBase connection
      console.log("PocketBase URL:", pb.baseUrl);
      console.log("Auth store valid:", pb.authStore.isValid);
      console.log("Auth store model:", pb.authStore.model);

      // Check if the user is authenticated
      if (pb.authStore.isValid && pb.authStore.model) {
        userData = pb.authStore.model;
        console.log("User data:", userData);
        
        // Ensure userData exists and has required properties
        if (userData && userData.id) {
          isLoggedIn = true;
          
          // Fetch the user's name from the users collection
          try {
            const userId = userData.id;
            console.log("Attempting to fetch user record for ID:", userId);
            
            // Try to list collections first to test connection
            try {
              const collections = await pb.collections.getFullList();
              console.log("Available collections:", collections.map(c => c.name));
            } catch (collError) {
              console.warn("Could not list collections:", collError);
            }
            
            const userRecord = await pb.collection('users').getOne(userId);
            userName = userRecord.name || "";
            console.log("User's name:", userName);
            console.log("User record fetched successfully:", userRecord);
            
            // Retrieve the saved active site ID or use the default after user data is loaded
            const savedActiveSiteId = localStorage.getItem('activeSiteId');
            if (savedActiveSiteId) {
              activeSiteId = savedActiveSiteId;
            }
            
          } catch (error) {
            console.error("Detailed error fetching user data:", {
              error: error,
              message: error.message,
              status: error.status,
              response: error.response
            });
            
            // Try alternative approach - maybe the collection is named differently
            try {
              const userRecord = await pb.collection('_users').getOne(userData.id);
              userName = userRecord.name || userRecord.username || "";
              console.log("User found in _users collection:", userRecord);
            } catch (altError) {
              console.error("Alternative collection also failed:", altError);
              // Still allow login but without name
              userName = userData.email || userData.username || "User";
            }
          }
        } else {
          console.error("Invalid user data - missing ID");
          authError = true;
          pb.authStore.clear();
          setTimeout(() => window.location.href = "/", 1000);
          return;
        }
      } else {
        // If not authenticated, redirect to login page
        console.log("User not authenticated, redirecting to login");
        setTimeout(() => window.location.href = "/", 100);
        return;
      }
    } catch (error) {
      console.error("Critical error in authentication:", error);
      authError = true;
      setTimeout(() => window.location.href = "/", 1000);
      return;
    }

    isLoading = false;
  });

  /* SIDEBAR STUFF */
  // Default to dashboard, but will be overridden by localStorage if available
  let activeSiteId = "dashboard";
  let sidebarCollapsed = false;

  // Function to get site links based on user permissions
  $: siteLinks = [
    { id: "dashboard", label: "Dashboard" },
    { id: "cvr", label: "CVR Tjek" },
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

  // Handle site changes
  function handleSiteChange(event) {
    activeSiteId = event.detail.siteId;
    console.log(`Changed to site: ${activeSiteId}`);
    
    // Save the active site ID to localStorage
    localStorage.setItem('activeSiteId', activeSiteId);
  }

  // Handle sidebar collapse toggle
  function handleSidebarToggle(event) {
    sidebarCollapsed = event.detail.collapsed;
    
    // Optionally save sidebar collapsed state too
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }

  // Retrieve sidebar collapsed state on mount
  onMount(() => {
    const savedCollapseState = localStorage.getItem('sidebarCollapsed');
    if (savedCollapseState !== null) {
      sidebarCollapsed = savedCollapseState === 'true';
    }
  });
</script>

<svelte:head>
  <title>TIMESYNC - Dashboard</title>
</svelte:head>

{#if isLoading}
  <!-- Loading state -->
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <svg
        class="animate-spin h-10 w-10 text-indigo-600 mx-auto"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p class="mt-4 text-gray-600">Loading dashboard...</p>
    </div>
  </div>
{:else if authError}
  <!-- Error state -->
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <div class="mb-4">
        <svg class="h-12 w-12 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p class="text-red-600 text-lg font-semibold mb-2">Authentication Error</p>
      <p class="text-gray-600 mb-4">There was a problem with your authentication. Please try logging in again.</p>
      <button 
        class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        on:click={() => window.location.href = "/"}
      >
        Go to Login
      </button>
    </div>
  </div>
{:else if isLoggedIn && userData && userData.id}
  <!-- Main dashboard content - only render if we have complete user data -->
  <div class="min-h-screen bg-gray-100">
    <div class="flex h-screen bg-gray-100">
      <!-- Sidebar Component -->
      <Sidebar 
        title="TIMESYNC"
        {siteLinks}
        {activeSiteId}
        collapsed={sidebarCollapsed}
        on:siteChange={handleSiteChange}
        on:toggleCollapse={handleSidebarToggle}
      />
      
      <!-- Main Content Area -->
      <main class="flex-grow p-6 overflow-auto">
        {#if activeSiteId === 'dashboard'}
          <div class="bg-white p-4 rounded-lg shadow">
            <Dashboard {pb} {userData} {userName} />
          </div>
        {:else if activeSiteId === 'cvr'}
          <div class="bg-white p-4 rounded-lg shadow">
            <CvrTjek {pb} {userData} />
          </div>
        {:else if activeSiteId === 'admin-activity'}
          <div class="bg-white p-4 rounded-lg shadow">
            <Admin {pb} {userData} />
          </div>
        {:else if activeSiteId === 'worker-hours'}
          <div class="bg-white p-4 rounded-lg shadow">
            <WorkerHoursCalendar {pb} {userData} />
          </div>
        {:else if activeSiteId === 'admin-ansogninger'}
          <div class="bg-white p-4 rounded-lg shadow">
            <Ansogninger {pb} {userData} />
          </div>
        {:else if activeSiteId === 'admin-fravaer-dashboard'}
          <div class="bg-white p-4 rounded-lg shadow">
            <AbsenceDashboard {pb} {userData} />
          </div>
        {:else if activeSiteId === 'admin-fravaer-requests'}
          <div class="bg-white p-4 rounded-lg shadow">
            <AbsenceCalender {pb} {userData} />
          </div>
        {/if}
      </main>
    </div>
  </div>
{:else if isLoggingOut}
  <!-- Logging out state -->
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <svg
        class="animate-spin h-10 w-10 text-indigo-600 mx-auto"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p class="mt-4 text-gray-600">Logging out...</p>
    </div>
  </div>
{:else}
  <!-- Fallback error state -->
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="text-center">
      <p class="text-gray-600 mb-4">Something went wrong. Please try refreshing the page.</p>
      <button 
        class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors mr-2"
        on:click={() => window.location.reload()}
      >
        Refresh Page
      </button>
      <button 
        class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        on:click={() => window.location.href = "/"}
      >
        Go to Login
      </button>
    </div>
  </div>
{/if}