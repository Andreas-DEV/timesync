<script lang="ts">
    import PocketBase from "pocketbase";

    const pb = new PocketBase("https://timesync.pockethost.io/");
    let isLoading = false;

    async function logUd() {
        isLoading = true;

        try {
            // Add a delay before logging out
            await new Promise((resolve) => setTimeout(resolve, 750));

            // Clear auth store and reload page
            pb.authStore.clear();
            window.location.reload();
        } catch (error) {
            console.error("Logout error:", error);
            isLoading = false; // Reset loading state in case of error
        }
    }
</script>


    <button
        on:click={logUd}
        disabled={isLoading}
        class=" py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
    >
        {#if isLoading}
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
        {:else}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v4.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L14 11.586V7z"
                    clip-rule="evenodd"
                />
            </svg>
            <span class="px-10">

                Log out
            </span>
        {/if}
    </button>
