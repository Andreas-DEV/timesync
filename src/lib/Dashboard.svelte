<script lang="ts">
    import PocketBase from "pocketbase";
    import { onMount, onDestroy } from "svelte";

    import bellNoti from "$lib/assets/icons/bell.png"
    import sendIcon from "$lib/assets/icons/send.png"

    import HourLog from "./Logging/HourLog.svelte";
    import ProductLogButton from "./Logging/ProductLogButton.svelte";
    import SelfAbsenceButton from "./AbsenceLogging/SelfAbsenceButton.svelte";
    import WorkerHourlog from "./Workers/WorkerHourlog.svelte";
    import CvrTjek from "./CvrTjek.svelte";

    // Props passed from parent component
    export let pb = null;
    export let userData = null;
    export let userName = "";

    // Fallback: Create PocketBase instance if not provided
    if (!pb) {
        pb = new PocketBase("https://timesync.pockethost.io/");
    }

    let isLoading = false;
    let showMessageModal = false;
    let showNotificationTray = false;
    let showMessageDetail = false;
    let users = [];
    let messages = [];
    let readMessages = [];
    let oldMessages = [];
    let unreadCount = 0;
    let unsubscribe: (() => void) | null = null;
    let selectedMessage = null;
    let currentView = 'new'; // 'new', 'read', 'old'
    let showReplyForm = false;
    let hasViewedMessages = false; // Track if user has viewed messages since last unread
    let isSendingMessage = false; // Track loading state for new messages
    let isSendingReply = false; // Track loading state for replies
    
    // Loading states for different message views
    let isLoadingMessages = false;
    let isLoadingReadMessages = false;
    let isLoadingOldMessages = false;

    // Reply form data
    let replyForm = {
        subject: "",
        message: ""
    };

    // Message form data
    let messageForm = {
        recipient: "",
        subject: "",
        message: ""
    };

    // Reactive statement to determine if bell should shake
    $: shouldShake = unreadCount > 0 && !hasViewedMessages;

    // Reactive statements for current view data
    $: currentMessages = (() => {
        switch (currentView) {
            case 'new':
                return messages || [];
            case 'read':
                return readMessages || [];
            case 'old':
                return oldMessages || [];
            default:
                return [];
        }
    })();

    $: currentLoadingState = (() => {
        switch (currentView) {
            case 'new':
                return isLoadingMessages;
            case 'read':
                return isLoadingReadMessages;
            case 'old':
                return isLoadingOldMessages;
            default:
                return false;
        }
    })();
    
    // Debug reactive updates
    $: {
        console.log("=== REACTIVE UPDATE ===");
        console.log("currentView:", currentView);
        console.log("messages:", messages?.length || 0);
        console.log("readMessages:", readMessages?.length || 0);
        console.log("oldMessages:", oldMessages?.length || 0);
        console.log("currentMessages:", currentMessages?.length || 0);
        console.log("currentLoadingState:", currentLoadingState);
        console.log("isLoadingMessages:", isLoadingMessages);
        console.log("isLoadingReadMessages:", isLoadingReadMessages);
        console.log("isLoadingOldMessages:", isLoadingOldMessages);
        console.log("========================");
    }

    // Check if component is ready (has required data)
    $: isComponentReady = pb && userData && userData.id;

    async function loadUsers() {
        if (!pb || !pb.authStore.model?.id) return;
        
        try {
            const userList = await pb.collection('users').getFullList({
                sort: 'name'
            });
            users = userList.filter(user => user.id !== pb.authStore.model?.id);
        } catch (error) {
            console.error("Error loading users:", error);
        }
    }

    async function loadMessages() {
        if (!pb || !pb.authStore.model?.id) {
            isLoadingMessages = false;
            return;
        }
        
        isLoadingMessages = true;
        
        try {
            // Load new/unread messages
            const newMessageList = await pb.collection('messages').getFullList({
                filter: `recipient = "${pb.authStore.model.id}" && archived = false && read = false`,
                sort: '-created',
                expand: 'sender'
            });
            messages = newMessageList;
            const newUnreadCount = newMessageList.length;
            
            // If unread count goes from 0 to something, reset hasViewedMessages
            if (unreadCount === 0 && newUnreadCount > 0) {
                hasViewedMessages = false;
            }
            
            unreadCount = newUnreadCount;
            console.log("Loaded new messages:", messages.length);
        } catch (error) {
            console.error("Error loading messages:", error);
            messages = []; // Set to empty array on error
        } finally {
            isLoadingMessages = false;
        }
    }

    async function loadReadMessages() {
        if (!pb || !pb.authStore.model?.id) {
            console.log("Cannot load read messages - no auth");
            isLoadingReadMessages = false;
            return;
        }
        
        console.log("Starting to load read messages...");
        isLoadingReadMessages = true;
        
        try {
            const readMessageList = await pb.collection('messages').getFullList({
                filter: `recipient = "${pb.authStore.model.id}" && archived = false && read = true`,
                sort: '-created',
                expand: 'sender'
            });
            readMessages = readMessageList;
            console.log("Loaded read messages:", readMessages.length);
        } catch (error) {
            console.error("Error loading read messages:", error);
            readMessages = []; // Set to empty array on error
        }
        
        // Explicitly set loading to false
        console.log("Setting isLoadingReadMessages to false");
        isLoadingReadMessages = false;
    }

    async function loadOldMessages() {
        if (!pb || !pb.authStore.model?.id) {
            isLoadingOldMessages = false;
            return;
        }
        
        isLoadingOldMessages = true;
        
        try {
            const messageList = await pb.collection('messages').getFullList({
                filter: `recipient = "${pb.authStore.model.id}" && archived = true`,
                sort: '-created',
                expand: 'sender'
            });
            oldMessages = messageList;
            console.log("Loaded old messages:", oldMessages.length);
        } catch (error) {
            console.error("Error loading old messages:", error);
            oldMessages = []; // Set to empty array on error
        } finally {
            isLoadingOldMessages = false;
        }
    }

    async function sendMessage() {
        if (!messageForm.recipient || !messageForm.subject || !messageForm.message) {
            alert("Please fill in all fields");
            return;
        }

        if (!pb || !pb.authStore.model?.id) {
            alert("Authentication error");
            return;
        }

        isSendingMessage = true;

        try {
            await pb.collection('messages').create({
                sender: pb.authStore.model.id,
                recipient: messageForm.recipient,
                subject: messageForm.subject,
                message: messageForm.message,
                read: false
            });

            // Reset form and close modal
            messageForm = { recipient: "", subject: "", message: "" };
            showMessageModal = false;
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Error sending message");
        } finally {
            isSendingMessage = false;
        }
    }

    async function markAsRead(messageId: string) {
        if (!pb) return;
        
        try {
            await pb.collection('messages').update(messageId, {
                read: true
            });
            // Reload messages to update the UI
            await loadMessages();
            await loadReadMessages();
        } catch (error) {
            console.error("Error marking message as read:", error);
        }
    }

    async function archiveMessage(messageId: string) {
        if (!pb) return;
        
        try {
            await pb.collection('messages').update(messageId, {
                archived: true
            });
            // Reload messages to update the UI
            await loadMessages();
            await loadReadMessages();
        } catch (error) {
            console.error("Error archiving message:", error);
        }
    }

    async function clearAllMessages() {
        if (!pb) return;
        
        try {
            let messagesToClear = [];
            
            if (currentView === 'new') {
                messagesToClear = messages.filter(msg => !msg.archived);
            } else if (currentView === 'read') {
                messagesToClear = readMessages.filter(msg => !msg.archived);
            }
            
            const updatePromises = messagesToClear.map(message => 
                pb.collection('messages').update(message.id, { archived: true })
            );
            await Promise.all(updatePromises);
            await loadMessages();
            await loadReadMessages();
        } catch (error) {
            console.error("Error clearing all messages:", error);
        }
    }

    function openMessageModal() {
        showMessageModal = true;
    }

    function closeMessageModal() {
        showMessageModal = false;
        messageForm = { recipient: "", subject: "", message: "" };
    }

    function toggleNotificationTray() {
        showNotificationTray = !showNotificationTray;
        
        if (showNotificationTray) {
            // Always reset to new view when opening
            if (currentView === 'old') {
                currentView = 'new';
            }
            
            // Mark that user has viewed the notification tray
            hasViewedMessages = true;
            
            // Reset all loading states first
            isLoadingMessages = false;
            isLoadingReadMessages = false;
            isLoadingOldMessages = false;
            
            // Load the current view's messages
            console.log("Opening notification tray, current view:", currentView);
            if (currentView === 'new') {
                loadMessages();
            } else if (currentView === 'read') {
                loadReadMessages();
            } else if (currentView === 'old') {
                loadOldMessages();
            }
        }
    }

    function showNewMessages() {
        currentView = 'new';
        console.log("Switching to new messages view");
        // Reset loading states
        isLoadingMessages = false;
        isLoadingReadMessages = false;
        isLoadingOldMessages = false;
        // Load messages
        loadMessages();
    }

    function showReadMessages() {
        currentView = 'read';
        console.log("Switching to read messages view");
        // Force reset ALL loading states
        isLoadingMessages = false;
        isLoadingReadMessages = false;
        isLoadingOldMessages = false;
        
        // Add a small delay to ensure state is reset
        setTimeout(() => {
            console.log("About to load read messages, loading state:", isLoadingReadMessages);
            loadReadMessages();
        }, 10);
    }

    function showOldMessages() {
        currentView = 'old';
        console.log("Switching to old messages view");
        // Reset loading states
        isLoadingMessages = false;
        isLoadingReadMessages = false;
        isLoadingOldMessages = false;
        // Load messages
        loadOldMessages();
    }

    async function openMessageDetail(message) {
        selectedMessage = message;
        showMessageDetail = true;
        showNotificationTray = false;
        showReplyForm = false;
        
        // Mark that user has viewed messages
        hasViewedMessages = true;
        
        // Mark as read if it's unread
        if (!message.read) {
            await markAsRead(message.id);
            // If we're currently viewing new messages and this message was marked as read,
            // we need to refresh the current view to remove it from the list
            if (currentView === 'new') {
                // Reload the current view's messages
                await loadMessages();
                await loadReadMessages();
            }
        }
    }

    function closeMessageDetail() {
        showMessageDetail = false;
        selectedMessage = null;
        showReplyForm = false;
        replyForm = { subject: "", message: "" };
        
        // Force refresh of current view when closing message detail
        // This ensures the UI is updated if message read status changed
        if (currentView === 'new') {
            loadMessages();
        } else if (currentView === 'read') {
            loadReadMessages();
        }
    }

    function showReply() {
        showReplyForm = true;
        replyForm.subject = `Re: ${selectedMessage.subject}`;
        replyForm.message = "";
    }

    function cancelReply() {
        showReplyForm = false;
        replyForm = { subject: "", message: "" };
    }

    async function sendReply() {
        if (!replyForm.subject || !replyForm.message) {
            return;
        }

        if (!pb || !pb.authStore.model?.id) {
            alert("Authentication error");
            return;
        }

        isSendingReply = true;

        try {
            await pb.collection('messages').create({
                sender: pb.authStore.model.id,
                recipient: selectedMessage.sender,
                subject: replyForm.subject,
                message: replyForm.message,
                read: false,
                archived: false
            });

            // Reset reply form and hide it
            replyForm = { subject: "", message: "" };
            showReplyForm = false;
            
            // Close the entire message detail modal after successful send
            closeMessageDetail();
            
        } catch (error) {
            console.error("Error sending reply:", error);
            alert("Error sending reply");
        } finally {
            isSendingReply = false;
        }
    }

    // Handle absence submission event
    function handleAbsenceSubmitted(event) {
        console.log("Absence request submitted:", event.detail);
        // You can add any additional logic here, like showing a toast notification
        // or refreshing other parts of the dashboard
    }

    onMount(async () => {
        // Wait a bit to ensure props are fully loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isComponentReady) {
            console.warn("Dashboard: Required props not provided, some features may not work");
            return;
        }

        console.log("Dashboard: Component initialized with props:", { pb: !!pb, userData: !!userData, userName });

        // Initialize all arrays and loading states
        messages = [];
        readMessages = [];
        oldMessages = [];
        users = [];
        isLoadingMessages = false;
        isLoadingReadMessages = false;
        isLoadingOldMessages = false;

        await loadUsers();
        // Only load new messages on mount, other views will load when clicked
        await loadMessages();

        // Subscribe to real-time message updates
        try {
            unsubscribe = await pb.collection('messages').subscribe('*', async (e) => {
                // Only update if the message is for the current user
                if (e.record.recipient === pb.authStore.model?.id) {
                    console.log("Real-time message update received");
                    // Only refresh the current view
                    if (currentView === 'new') {
                        await loadMessages();
                    } else if (currentView === 'read') {
                        await loadReadMessages();
                    } else if (currentView === 'old') {
                        await loadOldMessages();
                    }
                    // Always refresh new messages for the counter
                    if (currentView !== 'new') {
                        await loadMessages();
                    }
                }
            });
        } catch (error) {
            console.error("Error setting up real-time updates:", error);
        }
    });

    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
    });
</script>

<style>
    @keyframes gentle-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .shake {
        animation: gentle-pulse 2s ease-in-out infinite;
    }
    
    .spinner {
        animation: spin 1s linear infinite;
    }
    
    .loading-pulse {
        animation: pulse 1.5s ease-in-out infinite;
    }
</style>

{#if !isComponentReady}
    <!-- Loading state for component -->
    <div class="min-h-screen bg-gray-50 flex items-center justify-center">
        <div class="text-center">
            <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-25"></circle>
                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-gray-600">Loading dashboard...</p>
        </div>
    </div>
{:else}
    <main class="min-h-screen bg-gray-50">
        <!-- Top Navigation Bar -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class=" px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <h1 class="text-xl font-semibold text-gray-900">Dashboard</h1>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <!-- Send Message Button -->
                        <button
                            on:click={openMessageModal}
                            class="bg-gray-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 cursor-pointer"
                        >
                        
                        <img src={sendIcon} class="invert" alt="">
                        </button>

                        <!-- Notification Bell -->
                        <div class="relative">
                            <button
                                on:click={toggleNotificationTray}
                                class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
                            >
                                <img class="cursor-pointer {shouldShake ? 'shake' : ''}" src={bellNoti} alt="">
                                {#if unreadCount > 0}
                                    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                {/if}
                            </button>

                            <!-- Notification Dropdown -->
                            {#if showNotificationTray}
                                <div class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                    <div class="p-4 border-b border-gray-200">
                                        <div class="flex items-center justify-between">
                                            <h3 class="text-lg font-semibold text-gray-900">
                                                {currentView === 'new' ? 'New Messages' : currentView === 'read' ? 'Read Messages' : 'Old Messages'}
                                            </h3>
                                            {#if (currentView === 'new' || currentView === 'read') && currentMessages.length > 0 && !currentLoadingState}
                                                <button
                                                    on:click={clearAllMessages}
                                                    class="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                                >
                                                    Clear All
                                                </button>
                                            {/if}
                                        </div>
                                        <div class="flex mt-2">
                                            <button
                                                on:click={showNewMessages}
                                                class="text-sm px-3 py-1 rounded-md transition-colors duration-200 cursor-pointer {currentView === 'new' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}"
                                            >
                                                New
                                            </button>
                                            <button
                                                on:click={showReadMessages}
                                                class="text-sm px-3 py-1 rounded-md transition-colors duration-200 ml-2 cursor-pointer {currentView === 'read' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}"
                                            >
                                                Read
                                            </button>
                                            <button
                                                on:click={showOldMessages}
                                                class="text-sm px-3 py-1 rounded-md transition-colors duration-200 ml-2 cursor-pointer {currentView === 'old' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}"
                                            >
                                                Old
                                            </button>
                                        </div>
                                    </div>
                                    <div class="max-h-96 overflow-y-auto">
                                        {#if currentLoadingState}
                                            <!-- Loading Animation -->
                                            <div class="p-8 flex flex-col items-center justify-center text-gray-500">
                                                <svg class="w-8 h-8 spinner mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-25"></circle>
                                                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <p class="text-sm">Loading messages...</p>
                                            </div>
                                        {:else if currentMessages.length === 0}
                                            <div class="p-4 text-gray-500 text-center">
                                                {currentView === 'new' ? 'No new messages' : currentView === 'read' ? 'No read messages' : 'No old messages'}
                                            </div>
                                        {:else}
                                            {#each currentMessages as message}
                                                <div class="group relative">
                                                    <div 
                                                        class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200 {!message.read && currentView === 'new' ? 'bg-blue-50' : ''}"
                                                        on:click={() => openMessageDetail(message)}
                                                    >
                                                        <div class="flex justify-between items-start mb-1">
                                                            <h4 class="font-medium text-gray-900 {!message.read && currentView === 'new' ? 'font-bold' : ''} pr-8">
                                                                {message.subject}
                                                            </h4>
                                                            {#if !message.read && currentView === 'new'}
                                                                <span class="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                            {/if}
                                                        </div>
                                                        <p class="text-sm text-gray-600 mb-1">
                                                            From: {message.expand?.sender?.name || message.expand?.sender?.email || 'Unknown'}
                                                        </p>
                                                        <p class="text-sm text-gray-500 line-clamp-2">
                                                            {message.message}
                                                        </p>
                                                        <p class="text-xs text-gray-400 mt-1">
                                                            {new Date(message.created).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    {#if currentView !== 'old'}
                                                        <button
                                                            on:click|stopPropagation={() => archiveMessage(message.id)}
                                                            class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            title="Clear message"
                                                        >
                                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                                            </svg>
                                                        </button>
                                                    {/if}
                                                </div>
                                            {/each}
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content Area -->
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div class="px-4 py-6 sm:px-0">
                <div class="flex flex-col items-center">
                    <div class="flex gap-4">
                        <div>
                            <h2 class="text-xl">Kunder</h2>
                            <div class="flex items-center">
                                <ProductLogButton {pb} {userData} {userName} />
                                <HourLog {pb} {userData} {userName} />
                            </div>
                        </div>

                        <div>
                            <h2 class="text-xl">Medarbejder</h2>
                            <div class="flex items-center">
                                <SelfAbsenceButton {pb} {userData} {userName} on:absenceSubmitted={handleAbsenceSubmitted} />
                                <WorkerHourlog {pb} {userData} {userName} />
                            </div>
                        </div>
                    </div>
                </div>
                <div class="py-14">
                    <CvrTjek {pb} {userData} {userName} />
                </div>
            </div>
        </div>
    </main>
{/if}

<!-- Message Detail Modal -->
{#if showMessageDetail && selectedMessage}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-10 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
            <div class="mt-3">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">
                                {showReplyForm ? 'Reply to Message' : 'Message Details'}
                            </h3>
                            <p class="text-sm text-gray-500">
                                {new Date(selectedMessage.created).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        on:click={closeMessageDetail}
                        class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                {#if !showReplyForm}
                    <!-- Message Content -->
                    <div class="space-y-4">
                        <!-- From -->
                        <div class="flex items-center space-x-3">
                            <span class="text-sm font-medium text-gray-700 w-16">From:</span>
                            <div class="flex items-center space-x-2">
                                <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                </div>
                                <span class="text-sm text-gray-900 font-medium">
                                    {selectedMessage.expand?.sender?.name || selectedMessage.expand?.sender?.email || 'Unknown Sender'}
                                </span>
                            </div>
                        </div>

                        <!-- Subject -->
                        <div class="flex items-start space-x-3">
                            <span class="text-sm font-medium text-gray-700 w-16 mt-1">Subject:</span>
                            <span class="text-sm text-gray-900 font-semibold">
                                {selectedMessage.subject}
                            </span>
                        </div>

                        <!-- Message Body -->
                        <div class="mt-6">
                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <p class="text-gray-900 whitespace-pre-wrap leading-relaxed">
                                    {selectedMessage.message}
                                </p>
                            </div>
                        </div>
                    </div>
                {:else}
                    <!-- Reply Form -->
                    <form on:submit|preventDefault={sendReply} class="space-y-4">
                        <!-- Original Message Reference -->
                        <div class="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
                            <p class="text-xs text-gray-500 mb-1">Replying to:</p>
                            <p class="text-sm font-medium text-gray-700">{selectedMessage.subject}</p>
                            <p class="text-xs text-gray-500">
                                From: {selectedMessage.expand?.sender?.name || selectedMessage.expand?.sender?.email || 'Unknown'}
                            </p>
                        </div>

                        <!-- Reply Subject -->
                        <div>
                            <label for="reply-subject" class="block text-sm font-medium text-gray-700 mb-1">
                                Subject:
                            </label>
                            <input
                                type="text"
                                id="reply-subject"
                                bind:value={replyForm.subject}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>

                        <!-- Reply Message -->
                        <div>
                            <label for="reply-message" class="block text-sm font-medium text-gray-700 mb-1">
                                Your Reply:
                            </label>
                            <textarea
                                id="reply-message"
                                bind:value={replyForm.message}
                                rows="6"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                placeholder="Type your reply here..."
                                required
                            ></textarea>
                        </div>

                        <!-- Reply Form Buttons -->
                        <div class="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                on:click={cancelReply}
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md cursor-pointer transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSendingReply}
                                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md cursor-pointer transition-colors duration-200 flex items-center space-x-2"
                            >
                                {#if isSendingReply}
                                    <svg class="w-4 h-4 spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
                                        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Sending Reply...</span>
                                {:else}
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                    </svg>
                                    <span>Send Reply</span>
                                {/if}
                            </button>
                        </div>
                    </form>
                {/if}

                <!-- Footer Actions -->
                <div class="flex justify-between pt-6 mt-6 border-t border-gray-200">
                    <div>
                        {#if !selectedMessage.archived && !showReplyForm}
                            <button
                                type="button"
                                on:click={() => {
                                    archiveMessage(selectedMessage.id);
                                    closeMessageDetail();
                                }}
                                class="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors duration-200 flex items-center space-x-2"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                                <span>Clear Message</span>
                            </button>
                        {/if}
                    </div>
                    <div class="flex space-x-3">
                        {#if !showReplyForm}
                            <button
                                type="button"
                                on:click={closeMessageDetail}
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200 cursor-pointer"
                            >
                                Close
                            </button>
                            {#if !selectedMessage.archived}
                                <button
                                    type="button"
                                    on:click={showReply}
                                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200 flex items-center space-x-2 cursor-pointer"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                                    </svg>
                                    <span>Reply</span>
                                </button>
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Message Modal -->
{#if showMessageModal}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-medium text-gray-900">Send Message</h3>
                    <button
                        on:click={closeMessageModal}
                        class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <form on:submit|preventDefault={sendMessage} class="space-y-4">
                    <!-- Recipient Selection -->
                    <div>
                        <label for="recipient" class="block text-sm font-medium text-gray-700 mb-1">
                            To:
                        </label>
                        <select
                            id="recipient"
                            bind:value={messageForm.recipient}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            <option value="">Select recipient...</option>
                            {#each users as user}
                                <option value={user.id}>{user.name || user.email}</option>
                            {/each}
                        </select>
                    </div>

                    <!-- Subject -->
                    <div>
                        <label for="subject" class="block text-sm font-medium text-gray-700 mb-1">
                            Subject:
                        </label>
                        <input
                            type="text"
                            id="subject"
                            bind:value={messageForm.subject}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter subject"
                            required
                        />
                    </div>

                    <!-- Message -->
                    <div>
                        <label for="message" class="block text-sm font-medium text-gray-700 mb-1">
                            Message:
                        </label>
                        <textarea
                            id="message"
                            bind:value={messageForm.message}
                            rows="4"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder="Enter your message"
                            required
                        ></textarea>
                    </div>

                    <!-- Buttons -->
                    <div class="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            on:click={closeMessageModal}
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSendingMessage}
                            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors duration-200 flex items-center space-x-2 cursor-pointer"
                        >
                            {#if isSendingMessage}
                                <svg class="w-4 h-4 spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
                                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Sending...</span>
                            {:else}
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                </svg>
                                <span>Send Message</span>
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
{/if}

<!-- Click outside to close notification tray -->
{#if showNotificationTray}
    <div 
        class="fixed inset-0 z-40" 
        on:click={() => showNotificationTray = false}
    ></div>
{/if}