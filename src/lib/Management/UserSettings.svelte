<!-- UserSettings.svelte -->
<script>
  import { onMount } from 'svelte';
  import { currentUser } from '../stores/userStore';
  import PocketBase from 'pocketbase';
  
  // Props passed from parent component
  export let pb = null;
  export let userData = null;
  export let userName = '';
  
  // Create PocketBase instance if not provided
  if (!pb) {
      pb = new PocketBase('https://timesync.pockethost.io/');
  }
  
  let user = null;
  let loading = false;
  let message = '';
  let messageType = '';
  let showMessage = false;
  let userLoading = false;
  
  // Form fields
  let name = '';
  let email = '';
  let confirmEmail = '';
  let emailVisibility = false;
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let avatarFile = null;
  let avatarPreview = '';
  let showPasswordSection = false;
  
  // Reactive statement to update form fields when user changes
  $: if (userData) {
    user = userData;
    name = user.name || '';
    email = user.email || '';
    confirmEmail = user.email || '';
    emailVisibility = user.emailVisibility || false;
    avatarPreview = user.avatar ? pb.files.getURL(user, user.avatar) : '';
    userLoading = false;
  }
  
  // Also listen to currentUser store changes for real-time updates
  $: if ($currentUser) {
    user = $currentUser;
    name = user.name || '';
    email = user.email || '';
    confirmEmail = user.email || '';
    emailVisibility = user.emailVisibility || false;
    avatarPreview = user.avatar ? pb.files.getURL(user, user.avatar) : '';
    userLoading = false;
  }
  
  onMount(() => {
    // Initialize user data from props or store
    if (userData) {
      user = userData;
      userLoading = false;
    } else if ($currentUser) {
      user = $currentUser;
      userLoading = false;
    } else {
      userLoading = true;
    }
  });
  
  function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (file) {
      avatarFile = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
  
  function removeAvatar() {
    avatarFile = null;
    avatarPreview = '';
  }
  
  function togglePasswordSection() {
    showPasswordSection = !showPasswordSection;
    // Clear password fields when closing
    if (!showPasswordSection) {
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    }
  }
  
  function showNotification(msg, type = 'success') {
    message = msg;
    messageType = type;
    showMessage = true;
    setTimeout(() => {
      showMessage = false;
    }, 3000);
  }
  
  async function updateProfile() {
    if (!user) return;
    
    // Check if email has changed and validate confirmation
    if (email !== user.email) {
      if (email !== confirmEmail) {
        showNotification('Email addresses do not match', 'error');
        return;
      }
    }
    
    loading = true;
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('emailVisibility', emailVisibility);
      
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      } else if (!avatarPreview && user.avatar) {
        // User wants to remove avatar
        formData.append('avatar', '');
      }
      
      const updatedUser = await pb.collection('users').update(user.id, formData);
      
      // Update the user store
      currentUser.set(updatedUser);
      user = updatedUser;
      
      showNotification('Profile updated successfully!');
    } catch (error) {
      showNotification('Failed to update profile: ' + error.message, 'error');
    } finally {
      loading = false;
    }
  }
  
  async function changePassword() {
    if (!user) return;
    
    if (newPassword !== confirmPassword) {
      showNotification('New passwords do not match', 'error');
      return;
    }
    
    if (newPassword.length < 8) {
      showNotification('Password must be at least 8 characters long', 'error');
      return;
    }
    
    loading = true;
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: currentPassword,
        password: newPassword,
        passwordConfirm: confirmPassword
      });
      
      // Clear password fields
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      
      showNotification('Password changed successfully!');
    } catch (error) {
      showNotification('Failed to change password: ' + error.message, 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto p-6 space-y-8">
  <!-- Header -->
  <div class="border-b border-gray-200 pb-4">
    <h1 class="text-3xl font-bold text-gray-900">Account Settings</h1>
    <p class="text-gray-600 mt-2">Manage your account information and preferences</p>
  </div>
  
  <!-- Loading State -->
  {#if userLoading}
    <div class="flex justify-center items-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Loading user data...</span>
    </div>
  {:else if !user}
    <div class="text-center p-8">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 class="text-lg font-medium text-yellow-800 mb-2">Authentication Required</h3>
        <p class="text-yellow-700">Please log in to view your account settings.</p>
      </div>
    </div>
  {:else}
    <!-- Notification -->
    {#if showMessage}
      <div class="fixed top-4 right-4 z-50 transition-all duration-300">
        <div class="bg-white border-l-4 p-4 shadow-lg rounded-r-lg {messageType === 'error' ? 'border-red-400' : 'border-green-400'}">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              {#if messageType === 'error'}
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              {:else}
                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              {/if}
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium {messageType === 'error' ? 'text-red-800' : 'text-green-800'}">{message}</p>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Profile Section -->
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-900">Profile Information</h2>
      </div>
      
      <form on:submit|preventDefault={updateProfile} class="p-6 space-y-6">
        <!-- Avatar Section -->
        <div class="flex items-center space-x-6">
          <div class="flex-shrink-0">
            {#if avatarPreview}
              <img src={avatarPreview} alt="Avatar" class="h-24 w-24 rounded-full object-cover border-4 border-gray-200" />
            {:else}
              <div class="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center border-4 border-gray-200">
                <svg class="h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            {/if}
          </div>
          
          <div class="flex-1">
            <div class="flex items-center space-x-4">
              <label for="avatar" class="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Photo
                <input id="avatar" type="file" accept="image/*" on:change={handleAvatarChange} class="sr-only" />
              </label>
              
              {#if avatarPreview}
                <button type="button" on:click={removeAvatar} class="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50">
                  Remove
                </button>
              {/if}
            </div>
            <p class="mt-2 text-sm text-gray-500">JPG, GIF or PNG. Max size 5MB.</p>
          </div>
        </div>
        
        <!-- Name Field -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <input
            id="name"
            type="text"
            bind:value={name}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your full name"
          />
        </div>
        
        <!-- Email Field -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email address"
          />
        </div>
        
        <!-- Confirm Email Field - Only show if email has been modified -->
        {#if user && email !== user.email}
          <div>
            <label for="confirmEmail" class="block text-sm font-medium text-gray-700 mb-2">Confirm New Email</label>
            <input
              id="confirmEmail"
              type="email"
              bind:value={confirmEmail}
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 {email !== confirmEmail ? 'border-red-300' : ''}"
              placeholder="Confirm your new email address"
            />
            {#if email !== confirmEmail}
              <p class="mt-1 text-sm text-red-600">Email addresses must match</p>
            {/if}
          </div>
        {/if}
        
        <!-- Email Visibility -->
        <div class="flex items-center">
          <input
            id="emailVisibility"
            type="checkbox"
            bind:checked={emailVisibility}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="emailVisibility" class="ml-2 block text-sm text-gray-700">
            Make my email address visible to other users
          </label>
        </div>
        
        <!-- Submit Button -->
        <div class="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            class="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {/if}
            Update Profile
          </button>
        </div>
      </form>
    </div>
    
    <!-- Password Section -->
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900">Change Password</h2>
          <button
            type="button"
            on:click={togglePasswordSection}
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 cursor-pointer bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {#if showPasswordSection}
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
              Close
            {:else}
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Change Password
            {/if}
          </button>
        </div>
      </div>
      
      {#if showPasswordSection}
        <div class="transition-all duration-300 ease-in-out">
          <form on:submit|preventDefault={changePassword} class="p-6 space-y-6">
            <!-- Current Password -->
            <div>
              <label for="currentPassword" class="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                bind:value={currentPassword}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter current password"
              />
            </div>
            
            <!-- New Password -->
            <div>
              <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <input
                id="newPassword"
                type="password"
                bind:value={newPassword}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter new password"
              />
              <p class="mt-1 text-sm text-gray-500">Password must be at least 8 characters long</p>
            </div>
            
            <!-- Confirm Password -->
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                bind:value={confirmPassword}
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirm new password"
              />
            </div>
            
            <!-- Submit Button -->
            <div class="flex justify-end">
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                class="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {#if loading}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                {/if}
                Change Password
              </button>
            </div>
          </form>
        </div>
      {/if}
    </div>
  {/if}
</div>