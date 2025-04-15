<script>
  import { onMount } from "svelte";
  import PocketBase from "pocketbase";
  import "../../app.css";
  import Dashboard from "$lib/Dashboard.svelte";
  import Sidebar from '$lib/Sidebar.svelte';
  import CvrTjek from "$lib/CvrTjek.svelte";
  import Ansogninger from "$lib/Ansogninger.svelte";
  import TimeLogging from "$lib/TimeLogging.svelte";
  import Log from "$lib/Log.svelte";
  import Admin from "$lib/Admin.svelte";

  import Logo from "$lib/assets/logo.svg"

  // Initialize PocketBase
  const pb = new PocketBase("http://127.0.0.1:8090"); // Replace with your PocketBase URL

  let isLoggedIn = false;
  let userData = null;
  let isLoading = true;
  let isLoggingOut = false;
  let userName = "";

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
    // Check if the user is authenticated
    if (pb.authStore.isValid) {
      isLoggedIn = true;
      userData = pb.authStore.model;
      
      // Fetch the user's name from the users collection
      try {
        const userId = userData.id;
        const userRecord = await pb.collection('users').getOne(userId);
        userName = userRecord.name || "";
        console.log("User's name:", userName);
        
        // Retrieve the saved active site ID or use the default after user data is loaded
        const savedActiveSiteId = localStorage.getItem('activeSiteId');
        // Check if saved site exists and if user has permission to access it
        if (savedActiveSiteId) {
          // Special check for admin section - only accessible to Berith
          if (savedActiveSiteId === 'admin' && userName !== 'Berith') {
            activeSiteId = 'dashboard'; // Default if they don't have admin access
          } else {
            activeSiteId = savedActiveSiteId;
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    } else {
      // If not authenticated, redirect to login page
      window.location.href = "/";
    }

    isLoading = false;
  });

  /* SIDEBAR STUFF */
  // Default to dashboard, but will be overridden by localStorage if available
  let activeSiteId = "dashboard";
  let sidebarCollapsed = false;

  // Function to get site links based on user permissions
  $: siteLinks = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "log", label: "Log Demo", icon: "cog" },
    { id: "cvr", label: "CVR Tjek", icon: "search" },
    { id: "ansogninger", label: "Ansøgninger", icon: "cog" },
    // Only show Admin tab if the user's name is "Berith"
    ...(userName === "Berith" ? [{ id: "admin", label: "Admin", icon: "cog" }] : [])
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
{:else if isLoggedIn}
  <!-- Simplified dashboard content - only logout button -->
  <div class="min-h-screen bg-gray-100">
    <div class="">

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
            <h1 class="text-2xl font-bold mb-4">Dashboard</h1>
            <div class="bg-white p-4 rounded-lg shadow">
              <!-- Your dashboard content goes here -->
              <Dashboard/>
            </div>
          {:else if activeSiteId === 'logging'}
            <h1 class="text-2xl font-bold mb-4">Arbejdstid</h1>
            <div class="bg-white p-4 rounded-lg shadow">
              <!-- Your analytics content goes here -->
              <TimeLogging/>
            </div>
          {:else if activeSiteId === 'log'}
            <h1 class="text-2xl font-bold mb-4">Log Demo</h1>
            <div class="bg-white p-4 rounded-lg shadow">
              <!-- Your analytics content goes here -->
              <Log/>
            </div>
          {:else if activeSiteId === 'cvr'}
            <h1 class="text-2xl font-bold mb-4">CVR Tjek</h1>
            <div class="bg-white p-4 rounded-lg shadow">
              <!-- Your analytics content goes here -->
              <CvrTjek/>
            </div>
          {:else if activeSiteId === 'ansogninger'}
            <h1 class="text-2xl font-bold mb-4">Ansøgninger</h1>
            <div class="bg-white p-4 rounded-lg shadow">
              <!-- Your analytics content goes here -->
              <Ansogninger/>
            </div>
          {:else if activeSiteId === 'admin' && userName === 'Berith'}
            <h1 class="text-2xl font-bold mb-4">Admin</h1>
            <div class="bg-white p-4 rounded-lg shadow">
              <!-- Your analytics content goes here -->
              <Admin/>
            </div>
         
          {/if}
        </main>
      </div>
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
{/if}