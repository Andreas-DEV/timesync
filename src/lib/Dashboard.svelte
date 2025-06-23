<!-- Dashboard.svelte - Complete version with data caching -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { pb, userInfo, initializeUser } from './stores/userStore';
    import { 
        fetchMessages, 
        fetchReadMessages, 
        fetchOldMessages, 
        fetchUsers,
        markMessageAsRead,
        archiveMessage,
        createMessage,
        messages,
        readMessages,
        oldMessages,
        users,
        isLoading as dataLoading
    } from './stores/dataStore';
    import { fade } from 'svelte/transition';

    import bellNoti from "$lib/assets/icons/bell.png";
    import sendIcon from "$lib/assets/icons/send.png";

    import HourLog from "./Logging/HourLog.svelte";
    import ProductLogButton from "./Logging/ProductLogButton.svelte";
    import SelfAbsenceButton from "./AbsenceLogging/SelfAbsenceButton.svelte";
    import WorkerHourlog from "./Workers/WorkerHourlog.svelte";
    import CvrTjek from "./CvrTjek.svelte";

    // Component state
    let isComponentReady = false;
    let showMessageModal = false;
    let showNotificationTray = false;
    let showMessageDetail = false;
    let unreadCount = 0;
    let unsubscribe: (() => void) | null = null;
    let selectedMessage = null;
    let currentView = 'new';
    let showReplyForm = false;
    let hasViewedMessages = false;
    let isSendingMessage = false;
    let isSendingReply = false;
    
    // Loading states for different message views
    let isLoadingMessages = false;
    let isLoadingReadMessages = false;
    let isLoadingOldMessages = false;

    // Form data
    let replyForm = { subject: "", message: "" };
    let messageForm = { recipient: "", subject: "", message: "" };

    // Reactive data from stores
    $: currentMessages = (() => {
        switch (currentView) {
            case 'new': return $messages || [];
            case 'read': return $readMessages || [];
            case 'old': return $oldMessages || [];
            default: return [];
        }
    })();

    $: currentLoadingState = (() => {
        switch (currentView) {
            case 'new': return isLoadingMessages;
            case 'read': return isLoadingReadMessages;
            case 'old': return isLoadingOldMessages;
            default: return false;
        }
    })();

    $: shouldShake = unreadCount > 0 && !hasViewedMessages;

    // User info reactive
    let userInfoValue = { user: null, name: 'Anonymous User', isAuthenticated: false, id: null };
    
    // Store subscriptions
    let unsubscribeUserInfo;
    let unsubscribeMessages;
    let unsubscribeReadMessages;
    let unsubscribeOldMessages;
    let unsubscribeUsers;

    // Subscribe to stores
    function subscribeToStores() {
        unsubscribeUserInfo = userInfo.subscribe(value => {
            userInfoValue = value;
        });
        
        unsubscribeMessages = messages.subscribe(value => {
            // Update unread count when messages change
            if (value) {
                const newUnreadCount = value.length;
                if (unreadCount === 0 && newUnreadCount > 0) {
                    hasViewedMessages = false;
                }
                unreadCount = newUnreadCount;
            }
        });
    }

    async function initializeComponent() {
        try {
            console.log('Dashboard: Starting initialization...');
            
            // Subscribe to stores
            subscribeToStores();
            
            // Initialize user first
            await initializeUser();
            
            // Wait for authentication
            if (!$userInfo.isAuthenticated) {
                throw new Error('User not authenticated');
            }

            console.log('Dashboard: Loading data...');
            
            // Load data using cached functions (these will use cache if available)
            await Promise.all([
                fetchUsers(),    // Uses cache if available
                fetchMessages() // Uses cache if available
            ]);

            // Setup real-time subscriptions
            await setupRealtimeSubscriptions();
            
            isComponentReady = true;
            console.log('Dashboard: Initialization complete');
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
        }
    }

    async function loadMessagesView(view, forceRefresh = false) {
        switch (view) {
            case 'new':
                isLoadingMessages = true;
                try {
                    await fetchMessages(forceRefresh);
                } finally {
                    isLoadingMessages = false;
                }
                break;
            case 'read':
                isLoadingReadMessages = true;
                try {
                    await fetchReadMessages(forceRefresh);
                } finally {
                    isLoadingReadMessages = false;
                }
                break;
            case 'old':
                isLoadingOldMessages = true;
                try {
                    await fetchOldMessages(forceRefresh);
                } finally {
                    isLoadingOldMessages = false;
                }
                break;
        }
    }

    async function setupRealtimeSubscriptions() {
        if (!$userInfo.isAuthenticated) return;
        
        try {
            unsubscribe = await pb.collection('messages').subscribe('*', async (e) => {
                if (e.record.recipient === $userInfo.id) {
                    // Refresh current view
                    await loadMessagesView(currentView, true);
                    
                    // Also refresh new messages if not currently viewing them
                    if (currentView !== 'new') {
                        await fetchMessages(true); // Force refresh
                    }
                }
            });
        } catch (error) {
            console.error("Error setting up real-time updates:", error);
        }
    }

    async function sendMessage() {
        if (!messageForm.recipient || !messageForm.subject || !messageForm.message) {
            alert("Please fill in all fields");
            return;
        }

        if (!$userInfo.isAuthenticated) {
            alert("Authentication error");
            return;
        }

        isSendingMessage = true;

        try {
            await createMessage({
                sender: $userInfo.id,
                recipient: messageForm.recipient,
                subject: messageForm.subject,
                message: messageForm.message,
                read: false
            });

            messageForm = { recipient: "", subject: "", message: "" };
            showMessageModal = false;
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Error sending message");
        } finally {
            isSendingMessage = false;
        }
    }

    async function handleMarkAsRead(messageId: string) {
        try {
            await markMessageAsRead(messageId);
            if (currentView === 'new') {
                await loadMessagesView('read');
            }
        } catch (error) {
            console.error("Error marking message as read:", error);
        }
    }

    async function handleArchiveMessage(messageId: string) {
        try {
            await archiveMessage(messageId);
        } catch (error) {
            console.error("Error archiving message:", error);
        }
    }

    async function clearAllMessages() {
        try {
            let messagesToClear = [];
            
            if (currentView === 'new') {
                messagesToClear = $messages.filter(msg => !msg.archived);
            } else if (currentView === 'read') {
                messagesToClear = $readMessages.filter(msg => !msg.archived);
            }
            
            const updatePromises = messagesToClear.map(message => 
                handleArchiveMessage(message.id)
            );
            await Promise.all(updatePromises);
        } catch (error) {
            console.error("Error clearing all messages:", error);
        }
    }

    // Modal controls
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
            if (currentView === 'old') {
                currentView = 'new';
            }
            
            hasViewedMessages = true;
            
            // Load current view messages (uses cache if available)
            loadMessagesView(currentView);
        }
    }

    function showNewMessages() {
        currentView = 'new';
        loadMessagesView('new');
    }

    function showReadMessages() {
        currentView = 'read';
        setTimeout(() => {
            loadMessagesView('read');
        }, 10);
    }

    function showOldMessages() {
        currentView = 'old';
        loadMessagesView('old');
    }

    async function openMessageDetail(message) {
        selectedMessage = message;
        showMessageDetail = true;
        showNotificationTray = false;
        showReplyForm = false;
        
        hasViewedMessages = true;
        
        if (!message.read) {
            await handleMarkAsRead(message.id);
        }
    }

    function closeMessageDetail() {
        showMessageDetail = false;
        selectedMessage = null;
        showReplyForm = false;
        replyForm = { subject: "", message: "" };
        
        // Refresh current view
        loadMessagesView(currentView);
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

        if (!$userInfo.isAuthenticated) {
            alert("Authentication error");
            return;
        }

        isSendingReply = true;

        try {
            await createMessage({
                sender: $userInfo.id,
                recipient: selectedMessage.sender,
                subject: replyForm.subject,
                message: replyForm.message,
                read: false,
                archived: false
            });

            replyForm = { subject: "", message: "" };
            showReplyForm = false;
            closeMessageDetail();
            
        } catch (error) {
            console.error("Error sending reply:", error);
            alert("Error sending reply");
        } finally {
            isSendingReply = false;
        }
    }

    function handleAbsenceSubmitted(event) {
        // Handle absence submission event if needed
    }

    // Component lifecycle
    onMount(async () => {
        await initializeComponent();
    });

    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
        if (unsubscribeUserInfo) {
            unsubscribeUserInfo();
        }
        if (unsubscribeMessages) {
            unsubscribeMessages();
        }
        if (unsubscribeReadMessages) {
            unsubscribeReadMessages();
        }
        if (unsubscribeOldMessages) {
            unsubscribeOldMessages();
        }
        if (unsubscribeUsers) {
            unsubscribeUsers();
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
    
    .shake {
        animation: gentle-pulse 2s ease-in-out infinite;
    }
    
    .spinner {
        animation: spin 1s linear infinite;
    }
</style>

{#if !isComponentReady}
    <div class="min-h-screen bg-gray-50 flex items-center justify-center" transition:fade>
        <div class="text-center">
            <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-25"></circle>
                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-gray-600">Loading dashboard...</p>
        </div>
    </div>
{:else if !$userInfo.isAuthenticated}
    <div class="min-h-screen bg-gray-50 flex items-center justify-center" transition:fade>
        <div class="text-center">
            <h1 class="text-2xl font-semibold text-gray-900 mb-4">Please Log In</h1>
            <p class="text-gray-600">You need to be authenticated to access this dashboard.</p>
        </div>
    </div>
{:else}
    <main class="min-h-screen bg-gray-50" transition:fade>
        <!-- Top Navigation Bar -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex flex-col">
                        <h1 class="text-xl font-semibold text-gray-900">Dashboard</h1>
                        <p class="text-xs text-gray-500 -mt-0.5">
                            Welcome back, {$userInfo.name}!
                        </p>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <!-- Send Message Button -->
                        <button
                            on:click={openMessageModal}
                            class="bg-gray-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 cursor-pointer"
                        >
                            <img src={sendIcon} class="invert" alt="Send">
                        </button>

                        <!-- Notification Bell -->
                        <div class="relative">
                            <button
                                on:click={toggleNotificationTray}
                                class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
                            >
                                <img class="{shouldShake ? 'shake' : ''}" src={bellNoti} alt="Notifications">
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
                                                    class="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    Clear All
                                                </button>
                                            {/if}
                                        </div>
                                        <div class="flex mt-2">
                                            <button
                                                on:click={showNewMessages}
                                                class="text-sm px-3 py-1 rounded-md transition-colors duration-200 {currentView === 'new' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}"
                                            >
                                                New
                                            </button>
                                            <button
                                                on:click={showReadMessages}
                                                class="text-sm px-3 py-1 rounded-md transition-colors duration-200 ml-2 {currentView === 'read' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}"
                                            >
                                                Read
                                            </button>
                                            <button
                                                on:click={showOldMessages}
                                                class="text-sm px-3 py-1 rounded-md transition-colors duration-200 ml-2 {currentView === 'old' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}"
                                            >
                                                Old
                                            </button>
                                        </div>
                                    </div>
                                    <div class="max-h-96 overflow-y-auto">
                                        {#if currentLoadingState}
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
                                                            on:click|stopPropagation={() => handleArchiveMessage(message.id)}
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
                                <ProductLogButton />
                                <HourLog />
                            </div>
                        </div>

                        <div>
                            <h2 class="text-xl">Medarbejder</h2>
                            <div class="flex items-center">
                                <SelfAbsenceButton on:absenceSubmitted={handleAbsenceSubmitted} />
                                <WorkerHourlog />
                            </div>
                        </div>
                    </div>
                </div>
                <div class="py-14">
                    <CvrTjek />
                </div>
            </div>
        </div>
    </main>

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
                                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingReply}
                                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors duration-200 flex items-center space-x-2"
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
                                        handleArchiveMessage(selectedMessage.id);
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
                                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
                                >
                                    Close
                                </button>
                                {#if !selectedMessage.archived}
                                    <button
                                        type="button"
                                        on:click={showReply}
                                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200 flex items-center space-x-2"
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
                                {#each $users as user}
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
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSendingMessage}
                                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition-colors duration-200 flex items-center space-x-2"
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
{/if}