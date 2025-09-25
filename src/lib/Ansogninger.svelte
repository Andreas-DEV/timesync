<script>
    import { onMount, onDestroy } from "svelte";
    import PocketBase from "pocketbase";

    let test;

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
    let interviewTime = ""; // New field for interview time
    let currentMonth = new Date();
    let activeTab = "all"; // 'all', 'interview', 'denied', 'emailsent', 'completed', 'calendar'
    
    // Email selection states
    let selectedForEmail = new Set();
    let showEmailModal = false;
    let emailSubject = "";
    let emailBody = "";
    let emailType = "custom"; // 'custom', 'denial', 'interview', 'followup'
    
    // Email templates
    const emailTemplates = {
        denial: {
            subject: "Vedrørende din jobansøgning",
            body: `Kære [Name],

Tak for din interesse i vores stilling og for at du tog dig tid til at sende din ansøgning.

Efter nøje overvejelse af alle ansøgninger må vi desværre meddele, at vi ikke går videre med din ansøgning på nuværende tidspunkt.

Vi sætter pris på din interesse i vores virksomhed og ønsker dig alt det bedste fremover.

Med venlig hilsen,
Grønbech Revision`
        },
        interview: {
            subject: "Invitation til jobsamtale",
            body: `Kære [Name],

Vi har med glæde gennemgået din ansøgning og vil gerne invitere dig til en jobsamtale vedrørende den stilling, du har søgt.

Samtaledetaljer:
Dato: [Date]
Tidspunkt: [Time]

Venligst bekræft din deltagelse ved at svare på denne email.

Vi ser frem til at møde dig.

Med venlig hilsen,
Grønbech Revision`
        },
        followup: {
            subject: "Opfølgning på din ansøgning",
            body: `Kære [Name],

Tak for din ansøgning til vores stilling.

Vi vil gerne bekræfte, at vi har modtaget din ansøgning og er i gang med at gennemgå alle kandidater. Vi vender tilbage snarest muligt vedrørende de næste skridt i processen.

Hvis du har spørgsmål i mellemtiden, er du velkommen til at kontakte os.

Med venlig hilsen,
Grønbech Revision`
        },
        custom: {
            subject: "",
            body: ""
        }
    };

    // Function to send email via backend API
    const sendEmail = async (to, subject, body, type = 'general') => {
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    subject,
                    html: body.replace(/\n/g, '<br>'),
                    type
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send email');
            }

            return await response.json();
        } catch (err) {
            console.error('Error sending email:', err);
            throw err;
        }
    };

    // Function to get count for each tab
    const getTabCount = (tab) => {
        switch(tab) {
            case 'all':
                return applications.filter(app => app.accepted === 0).length;
            case 'interview':
                return applications.filter(app => app.accepted === 1).length;
            case 'denied':
                return applications.filter(app => app.accepted === 3 && !app.email_sent).length;
            case 'emailsent':
                return applications.filter(app => app.accepted === 3 && app.email_sent).length;
            case 'completed':
                return applications.filter(app => app.accepted === 4).length;
            default:
                return 0;
        }
    };

    // Function to load email template
    const loadEmailTemplate = (template) => {
        emailType = template;
        const selectedTemplate = emailTemplates[template];
        emailSubject = selectedTemplate.subject;
        emailBody = selectedTemplate.body;
    };

    // Function to send emails to selected recipients
    const sendBatchEmails = async () => {
        if (selectedForEmail.size === 0) {
            alert('Please select at least one recipient.');
            return;
        }

        if (!emailSubject || !emailBody) {
            alert('Please enter both subject and body for the email.');
            return;
        }

        loading = true;

        try {
            // Prepare batch recipients
            const recipients = [];
            for (const appId of selectedForEmail) {
                const app = applications.find(a => a.id === appId);
                if (app) {
                    recipients.push({
                        email: app.email,
                        name: app.name,
                        id: app.id
                    });
                }
            }

            // Prepare request body
            const requestBody = {
                batch: recipients,
                subject: emailSubject,
                html: emailBody.replace(/\n/g, '<br>'),
                type: emailType
            };

            // Log the request for debugging
            console.log('Sending email request:', requestBody);

            // Send all emails in one batch request to SendGrid
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const responseData = await response.json();
            
            if (!response.ok) {
                console.error('Email API error:', responseData);
                throw new Error(responseData.error || 'Failed to send emails');
            }

            // Update email_sent status for all recipients
            for (const recipient of recipients) {
                // If this was a denial email, update both status and email_sent
                if (emailType === 'denial') {
                    await pb.collection("ansogninger").update(recipient.id, { 
                        accepted: 3,
                        email_sent: true
                    });
                } else {
                    // For other email types, just mark email as sent
                    await pb.collection("ansogninger").update(recipient.id, { 
                        email_sent: true
                    });
                }
            }
            
            // Update local state
            applications = applications.map(app => {
                if (selectedForEmail.has(app.id)) {
                    return {
                        ...app,
                        ...(emailType === 'denial' && { accepted: 3 }),
                        email_sent: true
                    };
                }
                return app;
            });

            refreshMessage = `Successfully sent ${recipients.length} email(s)!`;
            
            // Clear selections
            selectedForEmail.clear();
            showEmailModal = false;
            emailSubject = "";
            emailBody = "";
            emailType = "custom";

            // Clear message after 5 seconds
            if (refreshMessageTimeout) clearTimeout(refreshMessageTimeout);
            refreshMessageTimeout = setTimeout(() => {
                refreshMessage = null;
            }, 5000);

        } catch (err) {
            console.error('Email sending error:', err);
            error = err.message;
            refreshMessage = `Error: ${err.message}`;
            
            if (refreshMessageTimeout) clearTimeout(refreshMessageTimeout);
            refreshMessageTimeout = setTimeout(() => {
                refreshMessage = null;
            }, 5000);
        } finally {
            loading = false;
        }
    };

    // Function to send interview invitation email
    const sendInterviewInvitation = async (application, date, time) => {
        const formattedDate = new Date(date).toLocaleDateString('da-DK', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Personalize the email
        let personalizedBody = emailTemplates.interview.body
            .replace('[Name]', application.name)
            .replace('[Date]', formattedDate)
            .replace('[Time]', time);

        try {
            await sendEmail(application.email, emailTemplates.interview.subject, personalizedBody, 'interview');
            return true;
        } catch (err) {
            console.error('Failed to send interview invitation:', err);
            return false;
        }
    };

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
        interviewTime = null,
        sendEmailNotification = false
    ) => {
        try {
            loading = true;

            // Prepare data for update
            const data = { accepted: status };

            // Add interview date and time if provided
            if (interviewDate) {
                data.interviewdate = interviewDate;
            }
            if (interviewTime) {
                data.interview_tidspunkt = interviewTime;
            }

            // Update the record
            await pb.collection("ansogninger").update(id, data);

            // Send email if requested
            if (sendEmailNotification && status === 1) {
                const app = applications.find(a => a.id === id);
                if (app) {
                    const emailSent = await sendInterviewInvitation(app, interviewDate, interviewTime);
                    if (!emailSent) {
                        refreshMessage = "Interview scheduled but email notification failed.";
                    }
                }
            }

            // If we're updating the currently selected application, update its status
            if (selectedApplication && selectedApplication.id === id) {
                selectedApplication = {
                    ...selectedApplication,
                    accepted: status,
                    ...(interviewDate && { interviewdate: interviewDate }),
                    ...(interviewTime && { interview_tidspunkt: interviewTime }),
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
                          ...(interviewTime && {
                              interview_tidspunkt: interviewTime,
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
                if (sendEmailNotification) {
                    message += " Email invitation sent.";
                }
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
            interviewTime = "";

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

        // Set default time or use existing
        if (selectedApplication.interview_tidspunkt) {
            interviewTime = selectedApplication.interview_tidspunkt;
        } else {
            interviewTime = "10:00"; // Default time
        }

        showInterviewDatePicker = true;
    };

    // Function to handle scheduling an interview
    const scheduleInterview = () => {
        if (!interviewDate) {
            alert("Please select a date for the interview");
            return;
        }
        if (!interviewTime) {
            alert("Please select a time for the interview");
            return;
        }

        updateApplicationStatus(
            selectedApplication.id, 
            1, 
            interviewDate, 
            interviewTime,
            true // Send email notification
        ).then(() => {
            // Navigate back to list view and show calendar tab
            selectedApplication = null;
            activeTab = "calendar";
        });
    };

    // Function to format date for display in interview badge
    const formatInterviewDate = (dateString, timeString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        let formatted = date.toLocaleDateString("da-DK", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
        if (timeString) {
            formatted += ` at ${timeString}`;
        }
        return formatted;
    };

    // Toggle selection for email
    const toggleEmailSelection = (id, event) => {
        event.stopPropagation();
        if (selectedForEmail.has(id)) {
            selectedForEmail.delete(id);
        } else {
            selectedForEmail.add(id);
        }
        selectedForEmail = selectedForEmail; // Trigger reactivity
    };

    // Select all visible applications for email (only works on denied tab)
    const selectAllForEmail = () => {
        if (activeTab !== "denied") return;
        
        // Only select denied applicants who haven't been sent an email yet
        const deniedWithoutEmail = applications.filter((app) => app.accepted === 3 && !app.email_sent);
        deniedWithoutEmail.forEach(app => selectedForEmail.add(app.id));
        selectedForEmail = selectedForEmail; // Trigger reactivity
    };

    // Clear all email selections
    const clearEmailSelections = () => {
        selectedForEmail.clear();
        selectedForEmail = selectedForEmail; // Trigger reactivity
    };

    // Open email modal with selected recipients
    const openEmailModal = () => {
        if (selectedForEmail.size === 0) {
            alert('Please select at least one recipient first.');
            return;
        }
        showEmailModal = true;
        emailType = "custom";
        emailSubject = "";
        emailBody = "";
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
                        New Applications
                        {#if getTabCount('all') > 0}
                            <span class="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                                {getTabCount('all')}
                            </span>
                        {/if}
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
                        {#if getTabCount('interview') > 0}
                            <span class="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-green-600 rounded-full">
                                {getTabCount('interview')}
                            </span>
                        {/if}
                    </button>
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "denied"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "denied")}
                    >
                        Denied (Pending Email)
                        {#if getTabCount('denied') > 0}
                            <span class="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                                {getTabCount('denied')}
                            </span>
                        {/if}
                    </button>
                    <button
                        class={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                            activeTab === "emailsent"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                        on:click={() => (activeTab = "emailsent")}
                    >
                        Denied (Email Sent)
                        {#if getTabCount('emailsent') > 0}
                            <span class="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-gray-600 rounded-full">
                                {getTabCount('emailsent')}
                            </span>
                        {/if}
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
                        {#if getTabCount('completed') > 0}
                            <span class="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-purple-600 rounded-full">
                                {getTabCount('completed')}
                            </span>
                        {/if}
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
                                                selectedApplication.interview_tidspunkt
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
                                <div class="mb-4">
                                    <label
                                        for="interviewTime"
                                        class="block text-sm font-medium text-gray-700 mb-2"
                                    >
                                        Select Time for Interview
                                    </label>
                                    <input
                                        type="time"
                                        id="interviewTime"
                                        bind:value={interviewTime}
                                        class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div class="mb-4">
                                    <label class="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            disabled
                                            class="mr-2"
                                        />
                                        <span class="text-sm text-gray-700">
                                            Send email invitation to applicant
                                        </span>
                                    </label>
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
                                        Schedule Interview & Send Email
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {:else}
            <!-- Batch actions bar (only show on 'denied' tab when items are selected) -->
            {#if activeTab === "denied" && selectedForEmail.size > 0}
                <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-700">
                            {selectedForEmail.size} recipient(s) selected
                        </span>
                        <div class="flex space-x-3">
                            <button
                                on:click={clearEmailSelections}
                                class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Clear Selection
                            </button>
                            <button
                                on:click={openEmailModal}
                                class="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Send Email
                            </button>
                        </div>
                    </div>
                </div>
            {/if}

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
                                                    title={`${interview.name} at ${interview.interview_tidspunkt || 'TBD'}`}
                                                >
                                                    {interview.interview_tidspunkt || ''} {interview.name}
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
                        ? applications.filter((app) => app.accepted === 0)
                        : activeTab === "interview"
                          ? applications.filter((app) => app.accepted === 1)
                          : activeTab === "denied"
                            ? applications.filter((app) => app.accepted === 3 && !app.email_sent)
                            : activeTab === "emailsent"
                              ? applications.filter((app) => app.accepted === 3 && app.email_sent)
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
                                    {#if activeTab === "denied"}
                                        <th scope="col" class="px-6 py-3">
                                            <button
                                                on:click={selectAllForEmail}
                                                class="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Select All
                                            </button>
                                        </th>
                                    {/if}
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
                                        {#if activeTab === "denied"}
                                            <td class="px-6 py-4" on:click|stopPropagation>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedForEmail.has(application.id)}
                                                    on:change={(e) => toggleEmailSelection(application.id, e)}
                                                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                            </td>
                                        {/if}
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
                                                        application.interview_tidspunkt
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

        <!-- Email Modal -->
        {#if showEmailModal}
            <div class="fixed inset-0 flex items-center justify-center z-50">
                <div class="absolute inset-0 bg-black opacity-50"></div>
                <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl z-10 max-h-[80vh] overflow-y-auto">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">
                        Send Email to {selectedForEmail.size} Recipient(s)
                    </h3>
                    
                    <!-- Template selector -->
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Email Template
                        </label>
                        <div class="grid grid-cols-4 gap-2">
                            <button
                                on:click={() => loadEmailTemplate('custom')}
                                class={`px-3 py-2 text-sm rounded border ${
                                    emailType === 'custom' 
                                        ? 'bg-blue-500 text-white border-blue-500' 
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Custom
                            </button>
                            <button
                                on:click={() => loadEmailTemplate('denial')}
                                class={`px-3 py-2 text-sm rounded border ${
                                    emailType === 'denial' 
                                        ? 'bg-blue-500 text-white border-blue-500' 
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Denial
                            </button>
                            <button
                                on:click={() => loadEmailTemplate('interview')}
                                class={`px-3 py-2 text-sm rounded border ${
                                    emailType === 'interview' 
                                        ? 'bg-blue-500 text-white border-blue-500' 
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Interview
                            </button>
                            <button
                                on:click={() => loadEmailTemplate('followup')}
                                class={`px-3 py-2 text-sm rounded border ${
                                    emailType === 'followup' 
                                        ? 'bg-blue-500 text-white border-blue-500' 
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Follow-up
                            </button>
                        </div>
                    </div>

                    <!-- Recipients preview -->
                    <div class="mb-4 p-3 bg-gray-50 rounded max-h-32 overflow-y-auto">
                        <p class="text-xs font-medium text-gray-700 mb-1">Recipients:</p>
                        <div class="text-xs text-gray-600">
                            {#each Array.from(selectedForEmail) as appId, index}
                                {@const app = applications.find(a => a.id === appId)}
                                {#if app}
                                    <span class="inline-block mr-2 mb-1 px-2 py-1 bg-white rounded border border-gray-200">
                                        {app.name} ({app.email})
                                    </span>
                                {/if}
                            {/each}
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Email Subject
                        </label>
                        <input
                            type="text"
                            bind:value={emailSubject}
                            placeholder="Enter email subject..."
                            class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Email Body
                        </label>
                        <div class="text-xs text-gray-500 mb-2">
                            Available placeholders: [Name], [Date], [Time]
                        </div>
                        <textarea
                            bind:value={emailBody}
                            rows="12"
                            placeholder="Enter email body..."
                            class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>

                    {#if emailType === 'denial'}
                        <div class="mb-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                            <p class="text-sm text-yellow-800">
                                ⚠️ Sending denial emails will automatically update the selected applications to "Denied" status.
                            </p>
                        </div>
                    {/if}
                    
                    <div class="flex justify-end space-x-3">
                        <button
                            on:click={() => {
                                showEmailModal = false;
                                emailSubject = "";
                                emailBody = "";
                                emailType = "custom";
                            }}
                            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            on:click={sendBatchEmails}
                            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : `Send Email${selectedForEmail.size > 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>