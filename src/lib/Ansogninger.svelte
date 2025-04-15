<script>
    import { onMount, onDestroy } from "svelte";
    import PocketBase from "pocketbase";

    // Initialize PocketBase
    const pb = new PocketBase("https://timesync.pockethost.io/");

    let applications = [];
    let selectedApplication = null;
    let loading = true;
    let error = null;
    let isRefreshing = false;
    let refreshMessage = null;
    let refreshMessageTimeout = null;
    let showInterviewDatePicker = false;
    let interviewDate = "";
    let currentMonth = new Date();
    let activeTab = "all"; // 'all', 'interview', 'denied', 'calendar'

    // Function to fetch all applications
    const fetchApplications = async () => {
        loading = true;
        error = null;

        try {
            // Get all records from the 'ansogninger' collection
            const records = await pb.collection("ansogninger").getFullList({
                sort: "-created", // Sort by creation date, newest first
            });
            applications = records;
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    };

    // Function to refresh applications (separate from initial load)
    const refreshApplications = async () => {
        if (isRefreshing) return; // Prevent multiple refresh calls

        isRefreshing = true;
        error = null;

        // Clear any existing message timeout
        if (refreshMessageTimeout) {
            clearTimeout(refreshMessageTimeout);
            refreshMessageTimeout = null;
        }

        try {
            // Store the current number of applications for comparison
            const previousCount = applications.length;

            // Get all records from the 'ansogninger' collection
            const records = await pb.collection("ansogninger").getFullList({
                sort: "-created", // Sort by creation date, newest first
            });

            // Add artificial delay so user can see the refresh animation
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Compare to see if there are new applications
            const newCount = records.length - previousCount;

            if (newCount > 0) {
                refreshMessage = `${newCount} new application${newCount === 1 ? "" : "s"} received!`;
            } else {
                refreshMessage = "No new applications.";
            }

            // Set timeout to clear the message after 5 seconds
            refreshMessageTimeout = setTimeout(() => {
                refreshMessage = null;
            }, 5000);

            applications = records;
        } catch (err) {
            error = err.message;
            refreshMessage = "Error refreshing applications.";

            // Clear error message after 5 seconds
            refreshMessageTimeout = setTimeout(() => {
                refreshMessage = null;
            }, 5000);
        } finally {
            isRefreshing = false;
        }
    };

    // Function to update application status (accepted: 0=pending, 1=interview, 3=denied)
    const updateApplicationStatus = async (
        id,
        status,
        interviewDate = null,
    ) => {
        try {
            loading = true;

            // Prepare data for update
            const data = { accepted: status };

            // Add interview date if provided
            if (interviewDate) {
                data.interviewdate = interviewDate;
            }

            // Update the record
            await pb.collection("ansogninger").update(id, data);

            // If we're updating the currently selected application, update its status
            if (selectedApplication && selectedApplication.id === id) {
                selectedApplication = {
                    ...selectedApplication,
                    accepted: status,
                    ...(interviewDate && { interviewdate: interviewDate }),
                };
            }

            // Update the application in the list
            applications = applications.map((app) =>
                app.id === id
                    ? {
                          ...app,
                          accepted: status,
                          ...(interviewDate && {
                              interviewdate: interviewDate,
                          }),
                      }
                    : app,
            );

            // Show a message
            let message;
            if (status === 1) {
                const formattedDate = interviewDate
                    ? new Date(interviewDate).toLocaleDateString()
                    : "";
                message = `Applicant marked for interview${formattedDate ? ` on ${formattedDate}` : ""}!`;
            } else if (status === 4) {
                message = "Application marked as complete!";
            } else {
                message = "Applicant denied.";
            }
            refreshMessage = message;

            // Clear any existing message timeout
            if (refreshMessageTimeout) {
                clearTimeout(refreshMessageTimeout);
            }

            // Set timeout to clear the message after 5 seconds
            refreshMessageTimeout = setTimeout(() => {
                refreshMessage = null;
            }, 5000);

            // Reset the date picker state
            showInterviewDatePicker = false;
            interviewDate = "";

            return true; // Return a resolved promise
        } catch (err) {
            error = err.message;
            return false; // Return a resolved promise with error indication
        } finally {
            loading = false;
        }
    };

    // Fetch applications on component mount
    onMount(fetchApplications);

    // Clean up timeout on component destruction
    onDestroy(() => {
        if (refreshMessageTimeout) {
            clearTimeout(refreshMessageTimeout);
        }
    });

    // Function to view an application in detail
    const viewApplication = (application) => {
        selectedApplication = application;
    };

    // Function to go back to the list view
    const backToList = () => {
        selectedApplication = null;
    };

    // Function to format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("da-DK", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Function to open the file in a new tab
    const openFile = (url) => {
        window.open(pb.getFileUrl(selectedApplication, url), "_blank");
    };

    // Function to delete an application
    const deleteApplication = async (id, event) => {
        // Stop the click event from propagating to the parent (which would open the detail view)
        event?.stopPropagation();

        if (
            !confirm(
                "Are you sure you want to delete this application? This action cannot be undone.",
            )
        ) {
            return;
        }

        try {
            loading = true;
            await pb.collection("ansogninger").delete(id);

            // If we're deleting the currently selected application, go back to the list
            if (selectedApplication && selectedApplication.id === id) {
                selectedApplication = null;
            }

            // Remove the deleted application from the list
            applications = applications.filter((app) => app.id !== id);
            loading = false;
        } catch (err) {
            error = err.message;
            loading = false;
        }
    };

    const openDatePicker = () => {
        // If there's already an interview date set, use that as the default
        if (selectedApplication.interviewdate) {
            // Format existing date as YYYY-MM-DD for the date input
            interviewDate = selectedApplication.interviewdate.split("T")[0];
        } else {
            // Otherwise, set default date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Format as YYYY-MM-DD for the date input
            const year = tomorrow.getFullYear();
            const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
            const day = String(tomorrow.getDate()).padStart(2, "0");

            interviewDate = `${year}-${month}-${day}`;
        }

        showInterviewDatePicker = true;
    };

    // Function to handle scheduling an interview
    const scheduleInterview = () => {
        if (!interviewDate) {
            alert("Please select a date for the interview");
            return;
        }

        updateApplicationStatus(selectedApplication.id, 1, interviewDate).then(
            () => {
                // Navigate back to list view and show calendar tab
                selectedApplication = null;
                activeTab = "calendar";
            },
        );
    };

    // Function to format date for display in interview badge
    const formatInterviewDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("da-DK", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    // Functions for calendar view
    const getCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        // First day of the month
        const firstDay = new Date(year, month, 1);
        // Last day of the month
        const lastDay = new Date(year, month + 1, 0);

        const daysInMonth = lastDay.getDate();
        const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Create array of days
        const days = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push({ day: null, isCurrentMonth: false });
        }

        // Add days of the current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true });
        }

        return days;
    };

    // Function to go to previous month
    const previousMonth = () => {
        currentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() - 1,
            1,
        );
    };

    // Function to go to next month
    const nextMonth = () => {
        currentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            1,
        );
    };

    // Function to format month
    const formatMonth = (date) => {
        return date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        });
    };

    // Function to get interviews for a specific day
    const getInterviewsForDay = (day) => {
        if (!day) return [];

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        // Create a date object for the start of the day
        const targetDate = new Date(year, month, day);
        // Format as YYYY-MM-DD
        const targetDateString = targetDate.toISOString().split("T")[0];

        return applications.filter((app) => {
            // Only include applications with interview status and a date
            if (app.accepted !== 1 || !app.interviewdate) return false;

            // Convert the interview date to YYYY-MM-DD format (without time)
            // Use a consistent method to avoid timezone issues
            const appDate = new Date(app.interviewdate);
            const appDateString = new Date(
                appDate.getFullYear(),
                appDate.getMonth(),
                appDate.getDate(),
            )
                .toISOString()
                .split("T")[0];

            return appDateString === targetDateString;
        });
    };
</script>

<div class="h-[89vh] pt-16">
    <div class="lg:max-w-6xl max-w-10xl mx-auto">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800">Job Applications</h1>

            <div class="flex items-center">
                {#if refreshMessage}
                    <span
                        class="text-sm mr-3 {refreshMessage.includes('new') &&
                        !refreshMessage.includes('No new')
                            ? 'text-green-600'
                            : refreshMessage.includes('interview')
                              ? 'text-blue-600'
                              : refreshMessage.includes('denied')
                                ? 'text-red-600'
                                : 'text-gray-600'}"
                    >
                        {refreshMessage}
                    </span>
                {/if}

                <button
                    on:click={refreshApplications}
                    class="p-2 text-blue-600 hover:text-blue-800 focus:outline-none cursor-pointer"
                    disabled={isRefreshing}
                    title="Refresh applications"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6 {isRefreshing ? 'animate-spin' : ''}"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </button>
            </div>
        </div>

        {#if !selectedApplication}
            <!-- Tabs for different views -->
            <div class="mb-6 border-b border-gray-200">
                <nav class="-mb-px flex space-x-8">
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "all"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "all")}
                    >
                        All Applications
                    </button>
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "interview"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "interview")}
                    >
                        For Interview
                    </button>
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "denied"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "denied")}
                    >
                        Denied Applicants
                    </button>
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "completed"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "completed")}
                    >
                        Completed
                    </button>
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "calendar"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "calendar")}
                    >
                        Interview Calendar
                    </button>
                </nav>
            </div>
        {/if}

        {#if loading && !isRefreshing}
            <div class="flex justify-center items-center h-64">
                <div
                    class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"
                ></div>
            </div>
        {:else if error}
            <div
                class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
            >
                <p>{error}</p>
            </div>
        {:else if selectedApplication}
            <!-- Detailed view of a single application -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <button
                            on:click={backToList}
                            class="flex items-center text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5 mr-1"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                            Back to list
                        </button>
                        <div class="flex items-center">
                            <!-- Status indicator -->
                            {#if selectedApplication.accepted === 1}
                                <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-4"
                                >
                                    Selected for Interview
                                    {#if selectedApplication.interviewdate}
                                        <span class="ml-1"
                                            >({formatInterviewDate(
                                                selectedApplication.interviewdate,
                                            )})</span
                                        >
                                    {/if}
                                </span>
                            {:else if selectedApplication.accepted === 3}
                                <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mr-4"
                                >
                                    Application Denied
                                </span>
                            {:else if selectedApplication.accepted === 4}
                                <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-4"
                                >
                                    Completed
                                </span>
                            {:else}
                                <span
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mr-4"
                                >
                                    Pending
                                </span>
                            {/if}

                            <button
                                on:click={() =>
                                    deleteApplication(selectedApplication.id)}
                                class="flex items-center text-red-600 hover:text-red-800 mr-4 cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-5 w-5 mr-1"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                                Delete
                            </button>
                            <span class="text-sm text-gray-500"
                                >Applied on {formatDate(
                                    selectedApplication.created,
                                )}</span
                            >
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <h3 class="text-lg font-medium text-gray-700 mb-2">
                                Contact Information
                            </h3>
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <div class="mb-3">
                                    <span
                                        class="block text-sm font-medium text-gray-500"
                                        >Name</span
                                    >
                                    <span>{selectedApplication.name}</span>
                                </div>
                                <div class="mb-3">
                                    <span
                                        class="block text-sm font-medium text-gray-500"
                                        >Email</span
                                    >
                                    <a
                                        href="mailto:{selectedApplication.email}"
                                        class="text-blue-600 hover:underline"
                                        >{selectedApplication.email}</a
                                    >
                                </div>
                                <div>
                                    <span
                                        class="block text-sm font-medium text-gray-500"
                                        >Phone</span
                                    >
                                    <a
                                        href="tel:{selectedApplication.tlf}"
                                        class="text-blue-600 hover:underline"
                                        >{selectedApplication.tlf}</a
                                    >
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 class="text-lg font-medium text-gray-700 mb-2">
                                Documents
                            </h3>
                            <div class="bg-gray-50 p-4 rounded-lg">
                                {#if selectedApplication.cv}
                                    <button
                                        on:click={() =>
                                            openFile(selectedApplication.cv)}
                                        class="w-full mb-3 flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        <span>View CV</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-5 w-5 text-gray-500"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fill-rule="evenodd"
                                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                                clip-rule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                {/if}

                                {#if selectedApplication.ansogning}
                                    <button
                                        on:click={() =>
                                            openFile(
                                                selectedApplication.ansogning,
                                            )}
                                        class="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        <span>View Application</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-5 w-5 text-gray-500"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fill-rule="evenodd"
                                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                                clip-rule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-lg font-medium text-gray-700 mb-2">
                            About
                        </h3>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <p class="whitespace-pre-line">
                                {selectedApplication.about ||
                                    "No information provided."}
                            </p>
                        </div>
                    </div>

                    <!-- Interview/Deny buttons -->
                    <div class="mt-6 flex justify-end space-x-4">
                        <button
                            on:click={() => {
                                updateApplicationStatus(
                                    selectedApplication.id,
                                    3,
                                ).then(() => {
                                    // Return to list view
                                    selectedApplication = null;
                                });
                            }}
                            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            disabled={selectedApplication.accepted === 3}
                        >
                            Deny Application
                        </button>
                        <button
                            on:click={openDatePicker}
                            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            disabled={selectedApplication.accepted === 4}
                        >
                            {selectedApplication.accepted === 1
                                ? "Change Interview Date"
                                : "Invite to Interview"}
                        </button>
                        <!-- New Complete button - only show for interview applicants -->
                        {#if selectedApplication.accepted === 1}
                            <button
                                on:click={() => {
                                    updateApplicationStatus(
                                        selectedApplication.id,
                                        4,
                                    ).then(() => {
                                        // Return to list view and switch to completed tab
                                        selectedApplication = null;
                                        activeTab = "completed";
                                    });
                                }}
                                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                disabled={selectedApplication.accepted === 4}
                            >
                                Mark as Complete
                            </button>
                        {/if}
                    </div>
                    {#if showInterviewDatePicker}
                        <div
                            class="fixed inset-0 flex items-center justify-center z-50"
                        >
                            <!-- Semi-transparent backdrop -->
                            <div
                                class="absolute inset-0 bg-black opacity-50"
                            ></div>

                            <!-- Modal content -->
                            <div
                                class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-10"
                            >
                                <h3
                                    class="text-lg font-medium text-gray-900 mb-4"
                                >
                                    Schedule Interview
                                </h3>
                                <div class="mb-4">
                                    <label
                                        for="interviewDate"
                                        class="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Select Date for Interview
                                    </label>
                                    <input
                                        type="date"
                                        id="interviewDate"
                                        bind:value={interviewDate}
                                        class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div class="flex justify-end space-x-3">
                                    <button
                                        on:click={() =>
                                            (showInterviewDatePicker = false)}
                                        class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        on:click={scheduleInterview}
                                        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        Schedule Interview
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {:else}
            <!-- List view of all applications -->
            {#if applications.length === 0}
                <div class="bg-white rounded-lg shadow-lg p-6 text-center select-none">
                    <p class="text-gray-500">No applications found.</p>
                </div>
            {:else if activeTab === "calendar"}
                <!-- Calendar View -->
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-xl font-semibold text-gray-800 select-none">
                                Interview Schedule
                            </h2>
                            <div class="flex items-center space-x-2">
                                <button
                                    on:click={previousMonth}
                                    class="p-1 rounded-full hover:bg-gray-100 cursor-pointer"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-6 w-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                </button>
                                <span class="text-lg font-medium"
                                    >{formatMonth(currentMonth)}</span
                                >
                                <button
                                    on:click={nextMonth}
                                    class="p-1 rounded-full hover:bg-gray-100 cursor-pointer"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-6 w-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-7 gap-2">
                            <!-- Days of week header -->
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Sun
                            </div>
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Mon
                            </div>
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Tue
                            </div>
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Wed
                            </div>
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Thu
                            </div>
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Fri
                            </div>
                            <div
                                class="text-center font-medium text-gray-500 py-2 select-none"
                            >
                                Sat
                            </div>

                            <!-- Calendar days -->
                            {#each getCalendarDays() as { day, isCurrentMonth }}
                                <div
                                    class={`min-h-24 p-1 border hover:border-blue-500 ${isCurrentMonth ? "bg-white" : "bg-gray-50"} ${
                                        day === new Date().getDate() &&
                                        currentMonth.getMonth() ===
                                            new Date().getMonth() &&
                                        currentMonth.getFullYear() ===
                                            new Date().getFullYear()
                                            ? "border-blue-500 border-2"
                                            : "border-gray-200"
                                    }`}
                                >
                                    {#if day !== null}
                                        <div
                                            class="text-right text-sm font-medium mb-1 select-none"
                                        >
                                            {day}
                                        </div>
                                        <!-- Interviews for this day -->
                                        <div class="space-y-1">
                                            {#each getInterviewsForDay(day) as interview}
                                                <div
                                                    class="text-xs bg-green-100 text-green-800 rounded p-1 truncate cursor-pointer hover:bg-green-200"
                                                    on:click={() =>
                                                        viewApplication(
                                                            interview,
                                                        )}
                                                >
                                                    {interview.name}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {:else}
                <!-- Filter applications based on active tab -->
                {@const filteredApplications =
                    activeTab === "all"
                        ? applications
                        : activeTab === "interview"
                          ? applications.filter((app) => app.accepted === 1)
                          : activeTab === "denied"
                            ? applications.filter((app) => app.accepted === 3)
                            : activeTab === "completed"
                              ? applications.filter((app) => app.accepted === 4)
                              : applications}

                {#if filteredApplications.length === 0}
                    <div class="bg-white rounded-lg shadow-md p-6 text-center">
                        <p class="text-gray-500">
                            No applications found in this category.
                        </p>
                    </div>
                {:else}
                    <div class="bg-white rounded-lg shadow-md overflow-hidden">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th
                                        scope="col"
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                                    >
                                        Name
                                    </th>

                                    <th
                                        scope="col"
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                                    >
                                        Date
                                    </th>
                                    <th
                                        scope="col"
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                                    >
                                        Interview Date
                                    </th>
                                    <th
                                        scope="col"
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                                    >
                                        Documents
                                    </th>
                                    <th
                                        scope="col"
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                                    >
                                        Status
                                    </th>
                                    <th scope="col" class="relative px-6 py-3">
                                        <span class="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                {#each filteredApplications as application (application.id)}
                                    <tr
                                        class="hover:bg-gray-50 cursor-pointer"
                                        on:click={() =>
                                            viewApplication(application)}
                                    >
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-900">
                                                {application.name}
                                            </div>
                                        </td>

                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm text-gray-500">
                                                {formatDate(
                                                    application.created,
                                                )}
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            {#if application.interviewdate}
                                                <span
                                                    class="text-sm text-gray-900"
                                                    >{formatInterviewDate(
                                                        application.interviewdate,
                                                    )}</span
                                                >
                                            {:else}
                                                <span
                                                    class="text-sm text-gray-400"
                                                    >-</span
                                                >
                                            {/if}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="flex space-x-2">
                                                {#if application.cv}
                                                    <span
                                                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 select-none"
                                                    >
                                                        CV
                                                    </span>
                                                {/if}
                                                {#if application.ansogning}
                                                    <span
                                                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 select-none"
                                                    >
                                                        Application
                                                    </span>
                                                {/if}
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            {#if application.accepted === 1}
                                                <span
                                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                                                >
                                                    Interview
                                                </span>
                                            {:else if application.accepted === 3}
                                                <span
                                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                                                >
                                                    Denied
                                                </span>
                                            {:else if application.accepted === 4}
                                                <span
                                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                                >
                                                    Completed
                                                </span>
                                            {:else}
                                                <span
                                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                                                >
                                                    Pending
                                                </span>
                                            {/if}
                                        </td>
                                        <td
                                            class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                                        >
                                            <div
                                                class="flex justify-end space-x-2"
                                            >
                                                <button
                                                    class="text-blue-600 hover:text-blue-900 cursor-pointer"
                                                >
                                                    View
                                                </button>
                                                <!-- <button 
                              on:click={(e) => deleteApplication(application.id, e)} 
                              class="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button> -->
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            {/if}
        {/if}
    </div>
</div>
