<script>
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';
  
    // Initialize PocketBase
    const pb = new PocketBase('https://timesync.pockethost.io/'); // Replace with your PocketBase URL
  
    // Form data
    let email = '';
    let password = '';
    let errorMessage = '';
    let isLoading = false;
    let isLoggedIn = false;
    let userData = null;
    let redirecting = false;
  
    // Login function with delay
    async function handleLogin() {
      errorMessage = '';
      isLoading = true;
      
      try {
        // Add a delay before attempting login
        await new Promise(resolve => setTimeout(resolve, 650));
        
        // Authenticate with PocketBase
        const authData = await pb.collection('users').authWithPassword(email, password);
        
        // Store auth data
        userData = authData.record;
        isLoggedIn = true;
        
        // Show redirecting message immediately and redirect to dashboard page after delay
        redirecting = true;
        setTimeout(() => {
          window.location.href = '/dashboard'; // Redirect to dashboard page
        }, 2500);
        
        console.log('Login successful!', userData);
        
      } catch (error) {
        errorMessage = error.message || 'Login failed. Please check your credentials.';
        console.error('Login error:', error);
      } finally {
        isLoading = false;
      }
    }

    async function logUd() {
        isLoading = true;
        
        try {
            // Add a delay before logging out
            await new Promise(resolve => setTimeout(resolve, 750));
            
            // Clear auth store and reload page
            pb.authStore.clear();
            window.location.href = '/'; // Redirect to home page after logout
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
  
    // Check existing auth on component mount
    onMount(() => {
      if (pb.authStore.isValid) {
        isLoggedIn = true;
        userData = pb.authStore.model;
        
        // If already logged in, redirect to dashboard page immediately
        window.location.href = '/dashboard';
      }
    });
  </script>
  
<!-- Svelte Component with Tailwind CSS -->
<div class="max-w-md mx-auto w-[400px] p-8 bg-white rounded-xl shadow-lg border border-gray-100">
  {#if isLoggedIn}
    <div class="text-center">
      <div class="mb-6">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-green-600" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
      <h2 class="text-2xl font-bold text-gray-800 mb-2">Welcome, {userData.name || userData.email}!</h2>
      
      {#if redirecting}
        <div class="transition-opacity duration-300">
          <p class="text-gray-600 mb-4">Redirecting to your dashboard...</p>
          <div class="flex justify-center mb-6">
            <svg class="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      {:else}
        <p class="text-gray-600 mb-6">You are now successfully logged in.</p>
        <button 
          on:click={logUd}
          disabled={isLoading}
          class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {#if isLoading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Logging out...
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v4.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L14 11.586V7z" clip-rule="evenodd" />
            </svg>
            Log out
          {/if}
        </button>
      {/if}
    </div>
  {:else}
    <form on:submit|preventDefault={handleLogin} class="space-y-5">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold text-gray-800">Welcome Back</h2>
        <p class="text-gray-500 mt-2">Please enter your details to sign in</p>
      </div>
      
      {#if errorMessage}
        <div class="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md text-sm flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          {errorMessage}
        </div>
      {/if}
      
      <div class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input 
              id="email"
              type="email" 
              bind:value={email} 
              placeholder="you@example.com" 
              required
              class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>
        
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
              </svg>
            </div>
            <input 
              id="password"
              type="password" 
              bind:value={password} 
              placeholder="••••••••" 
              required
              class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>
      </div>
      
      <button 
        type="submit" 
        disabled={isLoading}
        class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center"
      >
        {#if isLoading}
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Logging in...
        {:else}
          Sign in
        {/if}
      </button>
    </form>
  {/if}
</div>