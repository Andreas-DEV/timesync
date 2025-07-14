<script>
    import { onMount } from "svelte";
    import HourLogList from "./HourLogList.svelte";
    import ProductLogButton from "./Logging/ProductLogButton.svelte";
    import ActivityDashboard from "./ActivityDashboard.svelte";
    import HourLog from "./Logging/HourLog.svelte";
    import UserManangement from "../lib/Management/UserManangement.svelte";
    import PocketBase from "pocketbase";
    const pb = new PocketBase("https://timesync.pockethost.io/");

    // Define admin tools - only include actually implemented components
    const adminTools = [
        { id: "activity", name: "Activity Dashboard" },
        { id: "hourlog", name: "Settings" },
        // To add a new component in the future, just add a new entry here:
        // { id: 'newComponent', name: 'New Component Label' }
    ];

    // Selected tool state
    let selectedTool = "activity"; // Default to hour logs

    // Select a different tool
    function selectTool(toolId) {
        selectedTool = toolId;
    }

    function handleProductLogged() {
        // Refresh your data or perform other actions
        console.log("Product logged successfully");
    }
</script>

<div class="container mx-auto p-4">
    <!-- Tool Selection Buttons -->
    <div class="flex flex-wrap gap-2 mb-6">
        {#each adminTools as tool}
            <button
                class="px-4 py-2 rounded {selectedTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}"
                on:click={() => selectTool(tool.id)}
            >
                {tool.name}
            </button>
        {/each}
    </div>

    <!-- Component Display Area -->
    <div class="bg-white shadow-md rounded-lg p-4">
        {#if selectedTool === "activity"}
            <div class="flex gap-2 items-center">
                <ProductLogButton
                    pocketbase={pb}
                    onSuccess={handleProductLogged}
                />
                <HourLog />
            </div>
            <ActivityDashboard />
        {:else if selectedTool === "user"}
            <!-- <UserManangement /> -->
        {:else if selectedTool === "hourlog"}
            <HourLogList />
        {/if}
    </div>
</div>
