<script>
    import { createEventDispatcher, onMount } from "svelte";
    import PocketBase from "pocketbase";
    import svg from "$lib/assets/logo.svg"
    
    const pb = new PocketBase("https://timesync.pockethost.io/");
    export let title = "Dashboard";
    export let logo = svg;

    let isLoggingOut = false;
    let buttonWidth = 100;
    let isMobile = false;
    let showMobileMenu = false;
    let openDropdowns = {}; // Track which dropdowns are open
    
    export let siteLinks = [
        { id: "dashboard", label: "Dashboard" },
        { id: "logging", label: "Arbejdstid" },
        { id: "cvr", label: "CVR Tjek" },
        { 
            id: "admin", 
            label: "Admin",
            isDropdown: true,
            subItems: [
                { id: "admin-activity", label: "Activity Dashboard" },
                { id: "admin-ansogninger", label: "Ansøgninger" },
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
    
    export let activeSiteId = "cvr";

    const dispatch = createEventDispatcher();

    // Function to update page title
    function updatePageTitle(siteId) {
        const site = findSiteById(siteId);
        if (site) {
            document.title = `TIMESYNC - ${site.label}`;
        } else {
            document.title = "TIMESYNC";
        }
    }

    // Helper function to find a site by ID (including nested sub-items)
    function findSiteById(siteId) {
        for (const site of siteLinks) {
            if (site.id === siteId) return site;
            if (site.subItems) {
                const subItem = site.subItems.find(sub => sub.id === siteId);
                if (subItem) return subItem;
                // Check nested sub-items
                for (const subItem of site.subItems) {
                    if (subItem.subItems) {
                        const nestedSubItem = subItem.subItems.find(nested => nested.id === siteId);
                        if (nestedSubItem) return nestedSubItem;
                    }
                }
            }
        }
        return null;
    }

    // Check if a site ID belongs to a dropdown's sub-items (including nested)
    function getParentDropdown(siteId) {
        for (const site of siteLinks) {
            if (site.subItems) {
                // Check direct sub-items
                if (site.subItems.some(sub => sub.id === siteId)) {
                    return site.id;
                }
                // Check nested sub-items
                for (const subItem of site.subItems) {
                    if (subItem.subItems && subItem.subItems.some(nested => nested.id === siteId)) {
                        return subItem.id;
                    }
                }
            }
        }
        return null;
    }

    // Get all parent dropdowns for nested items
    function getAllParentDropdowns(siteId) {
        const parents = [];
        for (const site of siteLinks) {
            if (site.subItems) {
                for (const subItem of site.subItems) {
                    if (subItem.subItems && subItem.subItems.some(nested => nested.id === siteId)) {
                        parents.push(site.id, subItem.id);
                        break;
                    }
                }
                if (parents.length === 0 && site.subItems.some(sub => sub.id === siteId)) {
                    parents.push(site.id);
                }
            }
        }
        return parents;
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
            
            // Auto-open dropdown(s) if active item is a sub-item or nested sub-item
            const parentDropdowns = getAllParentDropdowns(activeSiteId);
            parentDropdowns.forEach(parentId => {
                openDropdowns[parentId] = true;
            });
        }
        
        // Update page title on mount
        updatePageTitle(activeSiteId);
        
        return () => window.removeEventListener('resize', checkMobile);
    });

    function selectSite(siteId) {
        const site = findSiteById(siteId);
        
        // If it's a dropdown parent, toggle dropdown instead of selecting
        if (site && site.isDropdown) {
            toggleDropdown(siteId);
            // Don't set activeSiteId for dropdown parents
            return;
        }
        
        // Only set activeSiteId for actual navigable pages (non-dropdown items)
        activeSiteId = siteId;
        localStorage.setItem('timesync_active_tab', siteId);
        dispatch("siteChange", { siteId });
        
        // Update page title when site changes
        updatePageTitle(siteId);
        
        if (isMobile) {
            showMobileMenu = false;
        }
    }

    // Helper function to check if any child of a dropdown is active
    function hasActiveChild(item) {
        if (!item.subItems) return false;
        
        for (const subItem of item.subItems) {
            if (subItem.id === activeSiteId) return true;
            if (subItem.subItems && hasActiveChild(subItem)) return true;
        }
        return false;
    }

    // Helper function to check if this specific item should show as active
    function isItemActive(item) {
        // Direct match for non-dropdown items
        if (!item.isDropdown && item.id === activeSiteId) {
            return true;
        }
        
        // For dropdown items, they're "active" if any of their children are active
        if (item.isDropdown && hasActiveChild(item)) {
            return true;
        }
        
        return false;
    }

    function toggleDropdown(dropdownId) {
        openDropdowns[dropdownId] = !openDropdowns[dropdownId];
        // Trigger reactivity
        openDropdowns = { ...openDropdowns };
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
        {showMobileMenu ? '✕' : '☰'}
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
    <nav class="flex-1 py-6 px-4 relative overflow-y-auto">
        <ul class="space-y-2">
            {#each siteLinks as site}
                <li>
                    <!-- Main navigation item -->
                    <button
                        class="group relative w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none cursor-pointer
                        {isItemActive(site)
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'hover:bg-gray-700 hover:bg-opacity-50 text-gray-300 hover:text-white'
                        }"
                        on:click={() => selectSite(site.id)}
                        aria-label={site.label}
                    >
                        <!-- Active indicator - only show for actually active items -->
                        {#if isItemActive(site)}
                            <div class="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
                        {/if}
                        
                        <!-- Letter Badge -->
                        <div class="flex items-center justify-center w-10 h-10 rounded-lg mr-3 transition-all duration-200 font-bold text-sm
                            {isItemActive(site)
                                ? 'bg-gradient-to-br from-white to-gray-200 text-gray-800 shadow-lg' 
                                : 'bg-gradient-to-br from-gray-600 to-gray-700 text-white group-hover:from-gray-500 group-hover:to-gray-600'
                            }">
                            {site.label.charAt(0)}
                        </div>
                        
                        <div class="flex-1">
                            <span class="font-medium">{site.label}</span>
                            {#if isItemActive(site)}
                                <div class="text-xs opacity-75">Active</div>
                            {/if}
                        </div>
                        
                        <!-- Only show arrow for dropdown items -->
                        {#if site.isDropdown}
                            <div class="transition-all duration-200 transform {openDropdowns[site.id] ? 'rotate-90' : ''}">
                                ↱
                            </div>
                        {/if}
                    </button>

                    <!-- Dropdown sub-items -->
                    {#if site.isDropdown && openDropdowns[site.id]}
                        <ul class="mt-2 ml-4 space-y-1 border-l-2 border-gray-600 pl-4">
                            {#each site.subItems as subItem}
                                <li>
                                    <button
                                        class="group relative w-full flex items-center px-3 py-2 text-left rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none cursor-pointer text-sm
                                        {isItemActive(subItem)
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                                            : 'hover:bg-gray-700 hover:bg-opacity-50 text-gray-400 hover:text-white'
                                        }"
                                        on:click={() => selectSite(subItem.id)}
                                        aria-label={subItem.label}
                                    >
                                        <!-- Sub-item active indicator -->
                                        {#if isItemActive(subItem)}
                                            <div class="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"></div>
                                        {/if}
                                        
                                        <!-- Sub-item letter badge -->
                                        <div class="flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-all duration-200 font-semibold text-xs
                                            {isItemActive(subItem)
                                                ? 'bg-gradient-to-br from-white to-gray-200 text-gray-800 shadow-md' 
                                                : 'bg-gradient-to-br from-gray-600 to-gray-700 text-white group-hover:from-gray-500 group-hover:to-gray-600'
                                            }">
                                            {subItem.label.charAt(0)}
                                        </div>
                                        
                                        <div class="flex-1">
                                            <span class="font-medium">{subItem.label}</span>
                                            {#if isItemActive(subItem)}
                                                <div class="text-xs opacity-75">Active</div>
                                            {/if}
                                        </div>

                                        <!-- Only show arrow for dropdown sub-items -->
                                        {#if subItem.isDropdown}
                                            <div class="transition-all duration-200 transform {openDropdowns[subItem.id] ? 'rotate-90' : ''}">
                                                ↱
                                            </div>
                                        {/if}
                                    </button>

                                    <!-- Nested dropdown sub-items -->
                                    {#if subItem.isDropdown && openDropdowns[subItem.id]}
                                        <ul class="mt-1 ml-6 space-y-1 border-l-2 border-gray-500 pl-3">
                                            {#each subItem.subItems as nestedItem}
                                                <li>
                                                    <button
                                                        class="group relative w-full flex items-center px-2 py-1.5 text-left rounded-md transition-all duration-200 hover:scale-105 focus:outline-none cursor-pointer text-xs
                                                        {activeSiteId === nestedItem.id
                                                            ? 'bg-gradient-to-r from-blue-400 to-purple-400 text-white shadow-sm'
                                                            : 'hover:bg-gray-700 hover:bg-opacity-50 text-gray-500 hover:text-white'
                                                        }"
                                                        on:click={() => selectSite(nestedItem.id)}
                                                        aria-label={nestedItem.label}
                                                    >
                                                        <!-- Nested item active indicator -->
                                                        {#if activeSiteId === nestedItem.id}
                                                            <div class="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-4 bg-white rounded-r-full"></div>
                                                        {/if}
                                                        
                                                        <!-- Nested item dot indicator -->
                                                        <div class="flex items-center justify-center w-6 h-6 rounded-sm mr-2 transition-all duration-200 font-bold text-xs
                                                            {activeSiteId === nestedItem.id 
                                                                ? 'bg-gradient-to-br from-white to-gray-200 text-gray-800 shadow-sm' 
                                                                : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white group-hover:from-gray-600 group-hover:to-gray-700'
                                                            }">
                                                            {nestedItem.label.charAt(0)}
                                                        </div>
                                                        
                                                        <div class="flex-1">
                                                            <span class="font-medium">{nestedItem.label}</span>
                                                            {#if activeSiteId === nestedItem.id}
                                                                <div class="text-xs opacity-75">Active</div>
                                                            {/if}
                                                        </div>
                                                    </button>
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
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
                        ⏻
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