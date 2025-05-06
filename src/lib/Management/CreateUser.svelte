<script>
    import { createEventDispatcher } from 'svelte';
  
    export let pb; // PocketBase instance passed from parent
    
    const dispatch = createEventDispatcher();
    
    // Form data
    let email = '';
    let name = '';
    let password = '';
    let passwordConfirm = '';
    let emailVisibility = true;
    let verified = false;
    
    // UI controls
    let showPassword = false;
    let showPasswordConfirm = false;
    let loading = false;
    let error = null;
    let success = false;
    let sendVerificationEmail = false;
    
    // Reset the form to its initial state
    function resetForm() {
      email = '';
      name = '';
      password = '';
      passwordConfirm = '';
      emailVisibility = true;
      verified = false;
      error = null;
      success = false;
    }
    
    async function handleSubmit() {
      // Reset states
      error = null;
      success = false;
      
      // Validate form
      if (!email || !name || !password || !passwordConfirm) {
        error = 'All fields are required.';
        return;
      }
      
      if (password !== passwordConfirm) {
        error = 'Passwords do not match.';
        return;
      }
      
      if (password.length < 8) {
        error = 'Password must be at least 8 characters long.';
        return;
      }
      
      // Set loading state
      loading = true;
      
      try {
        // First check if we're authenticated as admin
        const isAdmin = pb.authStore.isValid && pb.authStore.model?.role === 'admin';
        
        // Create user data object
        const userData = {
          email,
          name,
          password,
          passwordConfirm,
          emailVisibility
        };
        
        // Only add verified field if we're an admin
        if (isAdmin && verified) {
          userData.verified = verified;
        }
        
        // Create user in PocketBase
        const record = await pb.collection('users').create(userData);
        
        // Send verification email if requested
        if (sendVerificationEmail) {
          await pb.collection('users').requestVerification(email);
        }
        
        // Set success state
        success = true;
        
        // Emit event that user was created
        dispatch('userCreated', { record });
        
      } catch (err) {
        // Handle error
        error = err.message || 'An error occurred while creating the user.';
      } finally {
        // Reset loading state
        loading = false;
      }
    }
  </script>
  
  <div class="max-w-md mx-auto">
    <h3 class="text-xl font-bold text-gray-800 mb-4">Create New User</h3>
    
    {#if success}
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <p>User created successfully!</p>
        </div>
        <div class="mt-3">
          <button
            on:click={resetForm}
            class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded transition duration-200"
          >
            Create Another User
          </button>
        </div>
      </div>
    {:else}
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        {#if error}
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        {/if}
        
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            id="name"
            bind:value={name}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="John Doe"
            required
          />
        </div>
        
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="john@example.com"
            required
          />
        </div>
        
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div class="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              bind:value={password}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimum 8 characters"
              required
              minlength="8"
            />
            <button 
              type="button"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
              on:click={() => showPassword = !showPassword}
            >
              {#if showPassword}
                <!-- Hide password icon (eye-slash) -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              {:else}
                <!-- Show password icon (eye) -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              {/if}
            </button>
          </div>
        </div>
        
        <div>
          <label for="passwordConfirm" class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div class="relative">
            <input
              type={showPasswordConfirm ? "text" : "password"}
              id="passwordConfirm"
              bind:value={passwordConfirm}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm password"
              required
            />
            <button 
              type="button"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
              on:click={() => showPasswordConfirm = !showPasswordConfirm}
            >
              {#if showPasswordConfirm}
                <!-- Hide password icon (eye-slash) -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              {:else}
                <!-- Show password icon (eye) -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              {/if}
            </button>
          </div>
        </div>
        
        <div class="flex items-center">
          <input
            type="checkbox"
            id="emailVisibility"
            bind:checked={emailVisibility}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="emailVisibility" class="ml-2 block text-sm text-gray-700">Email Visibility</label>
        </div>
        
        <div class="flex items-center">
          <input
            type="checkbox"
            id="verified"
            bind:checked={verified}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="verified" class="ml-2 block text-sm text-gray-700">Pre-verify User (Admin only)</label>
          <div class="ml-2 text-xs text-gray-500 italic">
            Note: Requires admin authentication
          </div>
        </div>
        
        <div class="flex items-center">
          <input
            type="checkbox"
            id="sendVerificationEmail"
            bind:checked={sendVerificationEmail}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="sendVerificationEmail" class="ml-2 block text-sm text-gray-700">Send Verification Email</label>
        </div>
        
        <div class="pt-2">
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition duration-200 flex items-center justify-center"
            disabled={loading}
          >
            {#if loading}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating User...
            {:else}
              Create User
            {/if}
          </button>
        </div>
        
       <!--  <div class="pt-2">
          <button
            type="button"
            on:click={() => dispatch('back')}
            class="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded transition duration-200"
          >
            Back to User List
          </button>
        </div> -->
      </form>
    {/if}
  </div>