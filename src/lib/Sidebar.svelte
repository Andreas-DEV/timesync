<script>
    import { createEventDispatcher, onMount } from "svelte";
    import PocketBase from "pocketbase";
    import svg from "$lib/assets/logo.svg"
    
    const pb = new PocketBase("https://timesync.pockethost.io/");
    export let title = "Dashboard";
    export let logo = svg;

    import cvrIcon from "$lib/assets/icons/cvrsearch.png";

    let isLoggingOut = false;
    let buttonWidth = 100;
    let isMobile = false;
    let showMobileMenu = false;
    
    export let siteLinks = [
        { id: "dashboard", label: "Dashboard", icon: "home" },
        { id: "logging", label: "Arbejdstid", icon: "clock" },
        { id: "cvr", label: "CVR Tjek", icon: "search" },
        { id: "ansogninger", label: "Ansøgninger", icon: "applications" },
    ];
    
    export let activeSiteId = "cvr";

    const dispatch = createEventDispatcher();

    // Function to update page title
    function updatePageTitle(siteId) {
        const site = siteLinks.find(s => s.id === siteId);
        if (site) {
            document.title = `TIMESYNC - ${site.label}`;
        } else {
            document.title = "TIMESYNC";
        }
    }

    onMount(() => {
        const checkMobile = () => {
            isMobile = window.innerWidth < 768;
            if (isMobile) {
                showMobileMenu = false;
            }
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        const savedActiveTab = localStorage.getItem('timesync_active_tab');
        if (savedActiveTab) {
            activeSiteId = savedActiveTab;
            dispatch("siteChange", { siteId: activeSiteId });
        }
        
        // Update page title on mount
        updatePageTitle(activeSiteId);
        
        return () => window.removeEventListener('resize', checkMobile);
    });

    function selectSite(siteId) {
        activeSiteId = siteId;
        localStorage.setItem('timesync_active_tab', siteId);
        dispatch("siteChange", { siteId });
        
        // Update page title when site changes
        updatePageTitle(siteId);
        
        if (isMobile) {
            showMobileMenu = false;
        }
    }

    function toggleSidebar() {
        if (isMobile) {
            showMobileMenu = !showMobileMenu;
        }
    }

    async function handleLogout() {
        isLoggingOut = true;
        try {
            await new Promise((resolve) => setTimeout(resolve, 750));
            pb.authStore.clear();
            localStorage.removeItem('timesync_active_tab');
            window.location.href = "/";
        } catch (error) {
            console.error("Logout error:", error);
            isLoggingOut = false;
        }
    }

    const icons = {
        home: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>`,
        clock: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6" />
                </svg>`,
        applications: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8V3" />
                     </svg>`,
        "chevron-right": `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                       </svg>`,
        menu: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
             </svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>`,
        logout: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
               </svg>`,
    };
</script>

<!-- Mobile backdrop -->
{#if isMobile && showMobileMenu}
    <div 
        class="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        on:click={toggleSidebar}
    ></div>
{/if}

<!-- Mobile toggle button -->
{#if isMobile}
    <button
        class="fixed top-4 left-4 z-50 md:hidden p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-white hover:bg-gray-800 transition-all duration-200"
        on:click={toggleSidebar}
        aria-label="Toggle menu"
    >
        {@html showMobileMenu ? icons.close : icons.menu}
    </button>
{/if}

<aside
    class="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-2xl border-r border-gray-700 transition-all duration-300 ease-in-out relative
    {isMobile 
        ? `fixed top-0 left-0 z-40 transform ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} w-80`
        : 'w-72'
    }"
>
    <!-- Decorative gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 opacity-10 pointer-events-none"></div>

    <!-- Header -->
    <div class="relative flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800 bg-opacity-50">
        <div class="flex items-center gap-3">
            <div class="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <img src={logo} alt="Logo" class="h-6 w-6" />
            </div>
            <div>
                <h1 class="text-lg font-bold text-white select-none">{title}</h1>
            </div>
        </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-6 px-4 relative">
        <ul class="space-y-2">
            {#each siteLinks as site}
                <li>
                    <button
                        class="group relative w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none cursor-pointer
                        {activeSiteId === site.id
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'hover:bg-gray-700 hover:bg-opacity-50 text-gray-300 hover:text-white'
                        }"
                        on:click={() => selectSite(site.id)}
                        aria-label={site.label}
                    >
                        <!-- Active indicator -->
                        {#if activeSiteId === site.id}
                            <div class="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
                        {/if}
                        
                        <!-- Letter Badge -->
                        <div class="flex items-center justify-center w-10 h-10 rounded-lg mr-3 transition-all duration-200 font-bold text-sm
                            {activeSiteId === site.id 
                                ? 'bg-gradient-to-br from-white to-gray-200 text-gray-800 shadow-lg' 
                                : 'bg-gradient-to-br from-gray-600 to-gray-700 text-white group-hover:from-gray-500 group-hover:to-gray-600'
                            }">
                            {site.label.charAt(0)}
                        </div>
                        
                        <div class="flex-1">
                            <span class="font-medium">{site.label}</span>
                            {#if activeSiteId === site.id}
                                <div class="text-xs opacity-75">Active</div>
                            {/if}
                        </div>
                        
                        <div class="transition-all duration-200 {activeSiteId === site.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}">
                            {@html icons["chevron-right"]}
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    </nav>

    <!-- Logout Button -->
    <div class="p-4 border-t border-gray-700 bg-gray-800 bg-opacity-50">
        <button
            on:click={handleLogout}
            disabled={isLoggingOut}
            class="relative w-full py-3 px-4 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:scale-105 focus:outline-none cursor-pointer"
            bind:clientWidth={buttonWidth}
        >
            {#if isLoggingOut}
                <svg class="animate-spin h-5 w-5 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging out...
            {:else}
                <div class="flex items-center">
                    <div class="mr-2">
                        {@html icons.logout}
                    </div>
                    <span>Sign Out</span>
                </div>
            {/if}
        </button>
    </div>

    <!-- Footer -->
    <div class="p-4 text-center border-t border-gray-700">
        <div class="text-xs text-gray-400">
            © 2025 <span class="font-semibold text-white">TIMESYNC</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">Professional Edition</div>
    </div>
</aside>