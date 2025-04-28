<script>
    import { createEventDispatcher, onMount } from "svelte";
    import PocketBase from "pocketbase";
    import svg from "$lib/assets/logo.svg"
    // Props
    const pb = new PocketBase("https://timesync.pockethost.io/"); // Replace with your PocketBase URL
    export let title = "Dashboard";
    export let logo = svg; // URL to logo image

    import cvrIcon from "$lib/assets/icons/cvrsearch.png";

    let isLoggingOut = false;
    let buttonWidth = 100; // Default starting width
    export let siteLinks = [
        { id: "dashboard", label: "Dashboard", icon: "home" },
        { id: "logging", label: "Arbejdstid", icon: "home" },
        { id: "cvr", label: "CVR", icon: "chart-bar" },
        { id: "ansogninger", label: "Ansøgninger", icon: "cog" },
    ];
    
    // Default to cvr as in your original code
    export let activeSiteId = "cvr";
    export let collapsed = false;

    // Event dispatcher to notify parent components
    const dispatch = createEventDispatcher();

    // Load saved settings from localStorage on component mount
    onMount(() => {
        // Load active tab from localStorage if available
        const savedActiveTab = localStorage.getItem('timesync_active_tab');
        if (savedActiveTab) {
            activeSiteId = savedActiveTab;
            // Notify parent components of the loaded tab
            dispatch("siteChange", { siteId: activeSiteId });
        }
        
        // Optionally load sidebar collapsed state too
        const savedCollapsedState = localStorage.getItem('timesync_sidebar_collapsed');
        if (savedCollapsedState !== null) {
            collapsed = savedCollapsedState === 'true';
            dispatch("toggleCollapse", { collapsed });
        }
    });

    // Handle site selection
    function selectSite(siteId) {
        activeSiteId = siteId;
        // Save to localStorage
        localStorage.setItem('timesync_active_tab', siteId);
        dispatch("siteChange", { siteId });
    }

    // Toggle sidebar collapsed state
    function toggleSidebar() {
        collapsed = !collapsed;
        // Save to localStorage
        localStorage.setItem('timesync_sidebar_collapsed', collapsed.toString());
        dispatch("toggleCollapse", { collapsed });
    }

    async function handleLogout() {
        isLoggingOut = true;

        try {
            // Add a delay before logging out
            await new Promise((resolve) => setTimeout(resolve, 750));

            // Clear auth store and redirect to home
            pb.authStore.clear();
            // Clear saved tab when logging out (optional)
            localStorage.removeItem('timesync_active_tab');
            localStorage.removeItem('timesync_sidebar_collapsed');
            window.location.href = "/";
        } catch (error) {
            console.error("Logout error:", error);
            isLoggingOut = false;
        }
    }

    // Icon mapping - you can replace these with your preferred icon library
    const icons = {
        home: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>`,
        "chart-bar": `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                   </svg>`,
        cog: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>`,
        "chevron-left": `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                      </svg>`,
        "chevron-right": `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                       </svg>`,
        search: `<svg class="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M11.132 9.71395C10.139 11.2496 10.3328 13.2665 11.6 14.585C12.8468 15.885 14.8527 16.0883 16.335 15.065C16.6466 14.8505 16.9244 14.5906 17.159 14.294C17.3897 14.0023 17.5773 13.679 17.716 13.334C18.0006 12.6253 18.0742 11.8495 17.928 11.1C17.7841 10.3573 17.4268 9.67277 16.9 9.12995C16.3811 8.59347 15.7128 8.22552 14.982 8.07395C14.2541 7.92522 13.4982 8.00197 12.815 8.29395C12.1254 8.58951 11.5394 9.08388 11.132 9.71395Z" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17.5986 13.6868C17.2639 13.4428 16.7947 13.5165 16.5508 13.8513C16.3069 14.1861 16.3806 14.6552 16.7154 14.8991L17.5986 13.6868ZM19.0584 16.6061C19.3931 16.85 19.8623 16.7764 20.1062 16.4416C20.3501 16.1068 20.2764 15.6377 19.9416 15.3938L19.0584 16.6061ZM7.5 12.7499C7.91421 12.7499 8.25 12.4142 8.25 11.9999C8.25 11.5857 7.91421 11.2499 7.5 11.2499V12.7499ZM5.5 11.2499C5.08579 11.2499 4.75 11.5857 4.75 11.9999C4.75 12.4142 5.08579 12.7499 5.5 12.7499V11.2499ZM7.5 15.7499C7.91421 15.7499 8.25 15.4142 8.25 14.9999C8.25 14.5857 7.91421 14.2499 7.5 14.2499V15.7499ZM5.5 14.2499C5.08579 14.2499 4.75 14.5857 4.75 14.9999C4.75 15.4142 5.08579 15.7499 5.5 15.7499V14.2499ZM8.5 9.74994C8.91421 9.74994 9.25 9.41415 9.25 8.99994C9.25 8.58573 8.91421 8.24994 8.5 8.24994V9.74994ZM5.5 8.24994C5.08579 8.24994 4.75 8.58573 4.75 8.99994C4.75 9.41415 5.08579 9.74994 5.5 9.74994V8.24994ZM16.7154 14.8991L19.0584 16.6061L19.9416 15.3938L17.5986 13.6868L16.7154 14.8991ZM7.5 11.2499H5.5V12.7499H7.5V11.2499ZM7.5 14.2499H5.5V15.7499H7.5V14.2499ZM8.5 8.24994H5.5V9.74994H8.5V8.24994Z" fill="#FFFFFF"/>
</svg>`,
    };
</script>

<aside
    class="flex flex-col h-screen {collapsed
        ? 'w-16'
        : 'w-64'} bg-gray-800 text-white transition-all duration-300 ease-in-out"
>
    <!-- Header with logo and title -->
    <div class="flex gap-2 items-center p-4 border-b border-gray-700">
        {#if logo && !collapsed}
            <img src={logo} alt="Logo" class="h-8 w-8" />
        {/if}

        {#if !collapsed}
            <h1 class="text-xl font-bold flex-grow select-none">{title}</h1>
        {/if}

        <button
            class="p-1 rounded-md hover:bg-gray-700 focus:outline-none"
            on:click={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
            {@html collapsed ? icons["chevron-right"] : icons["chevron-left"]}
        </button>
    </div>

    <!-- Navigation Links -->
    <nav class="flex-grow py-4">
        <ul class="space-y-2">
            {#each siteLinks as site}
                <li>
                    <button
                        class="w-full flex items-center px-4 py-2 text-left transition-colors {activeSiteId ===
                        site.id
                            ? 'bg-gray-700'
                            : 'hover:bg-gray-700'}"
                        on:click={() => selectSite(site.id)}
                        aria-label={site.label}
                    >
                        <span class="h-5 w-7 mr-1 flex items-center"
                            >{@html icons[site.icon] || ""}</span
                        >
                        {#if !collapsed}
                            <span>{site.label}</span>
                        {/if}
                    </button>
                </li>
            {/each}
        </ul>
    </nav>

    <div class="flex w-full p-2 items-center">
        <button
            on:click={handleLogout}
            disabled={isLoggingOut}
            class="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center w-full"
            bind:clientWidth={buttonWidth}
        >
            {#if isLoggingOut}
                <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                Logging out...
            {:else if buttonWidth > 50}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v4.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L14 11.586V7z"
                        clip-rule="evenodd"
                    />
                </svg>
                Log out
            {:else}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                    />
                </svg>
            {/if}
        </button>
    </div>

    <!-- Footer space -->
    <div class="p-4 border-t border-gray-700 text-xs text-gray-400">
        {#if !collapsed}
            <p>© 2025 TIMESYNC</p>
        {/if}
    </div>
</aside>