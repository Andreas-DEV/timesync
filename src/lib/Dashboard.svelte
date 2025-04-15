<script lang="ts">
    import LogoutButton from "./LogoutButton.svelte";
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

<main class="">
    Dashboard
</main>
