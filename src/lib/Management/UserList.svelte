<script>
    import { onMount, createEventDispatcher } from 'svelte';
    
    export let pb; // PocketBase instance passed from parent
    
    const dispatch = createEventDispatcher();
    
    // User data
    let users = [];
    let loading = true;
    let error = null;
    
    // Pagination
    let page = 1;
    let perPage = 10;
    let totalItems = 0;
    let totalPages = 0;
    
    // Edit modal state
    let isEditModalOpen = false;
    let currentUser = null;
    let editFormData = {
      name: '',
      email: '',
      emailVisibility: true,
      verified: false,
      password: '',
      passwordConfirm: '',
      oldPassword: ''
    };
    let showEditPassword = false;
    let passwordChangeMode = false;
    let editSuccess = false;
    let editError = null;
    
    // Delete confirmation modal
    let isDeleteModalOpen = false;
    let userToDelete = null;
    
    // Load users initially and when pb changes
    $: if (pb) {
      loadUsers();
    }
    
    onMount(async () => {
      if (pb) {
        await loadUsers();
      }
    });
    
    async function loadUsers() {
      loading = true;
      error = null;
      
      try {
        // Check if we have auth
        if (!pb.authStore.isValid) {
          error = 'Authentication required to manage users';
          loading = false;
          return;
        }
        
        const resultList = await pb.collection('users').getList(page, perPage, {
          sort: '-created',
        });
        
        users = resultList.items;
        totalItems = resultList.totalItems;
        totalPages = resultList.totalPages;
      } catch (err) {
        // Ignore auto-cancellation errors when switching tabs
        if (err.name === 'AbortError' || err.message?.includes('cancelled') || err.message?.includes('autocancelled')) {
          console.log('Request was cancelled, this is normal when switching tabs');
        } else {
          // Only show error for non-cancellation errors
          error = err.message || 'Failed to load users';
          console.error('Error loading users:', err);
        }
      } finally {
        loading = false;
      }
    }
    
    async function changePage(newPage) {
      if (newPage < 1 || newPage > totalPages) return;
      page = newPage;
      await loadUsers();
    }
    
    function openEditModal(user) {
      currentUser = user;
      // Reset form data
      editFormData = {
        name: user.name || '',
        email: user.email || '',
        emailVisibility: user.emailVisibility,
        verified: user.verified,
        password: '',
        passwordConfirm: '',
        oldPassword: ''
      };
      passwordChangeMode = false;
      editSuccess = false;
      editError = null;
      isEditModalOpen = true;
    }
    
    function closeEditModal() {
      isEditModalOpen = false;
      currentUser = null;
      editSuccess = false;
      editError = null;
    }
    
    async function handleUpdateUser() {
      editError = null;
      editSuccess = false;
      
      try {
        const updateData = {
          name: editFormData.name,
          email: editFormData.email,
          emailVisibility: editFormData.emailVisibility,
          verified: editFormData.verified
        };
        
        // Only include password fields if in password change mode
        if (passwordChangeMode && editFormData.password) {
          if (editFormData.password !== editFormData.passwordConfirm) {
            editError = 'Passwords do not match';
            return;
          }
          
          if (editFormData.password.length < 8) {
            editError = 'Password must be at least 8 characters long';
            return;
          }
          
          updateData.password = editFormData.password;
          updateData.passwordConfirm = editFormData.passwordConfirm;
          
          // If changing own password, need old password
          const isOwnRecord = pb.authStore.model?.id === currentUser.id;
          if (isOwnRecord) {
            if (!editFormData.oldPassword) {
              editError = 'Current password is required to change your own password';
              return;
            }
            updateData.oldPassword = editFormData.oldPassword;
          }
        }
        
        // Update the user
        await pb.collection('users').update(currentUser.id, updateData);
        
        // Success
        editSuccess = true;
        
        // Reload users to get updated data
        await loadUsers();
        
        // Close modal after a short delay
        setTimeout(() => {
          closeEditModal();
        }, 1500);
        
      } catch (err) {
        editError = err.message || 'Failed to update user';
        console.error('Error updating user:', err);
      }
    }
    
    function togglePasswordChangeMode() {
      passwordChangeMode = !passwordChangeMode;
      if (!passwordChangeMode) {
        editFormData.password = '';
        editFormData.passwordConfirm = '';
        editFormData.oldPassword = '';
      }
    }
    
    function openDeleteModal(user) {
      userToDelete = user;
      isDeleteModalOpen = true;
    }
    
    function closeDeleteModal() {
      userToDelete = null;
      isDeleteModalOpen = false;
    }
    
    async function handleDeleteUser() {
      try {
        await pb.collection('users').delete(userToDelete.id);
        
        // Close modal and reload users
        closeDeleteModal();
        await loadUsers();
        
      } catch (err) {
        error = err.message || 'Failed to delete user';
        console.error('Error deleting user:', err);
        closeDeleteModal();
      }
    }
  </script>
  
  <!-- User List View -->
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if loading}
    <div class="flex justify-center items-center py-10">
      <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white">
        <thead class="bg-gray-100">
          <tr>
            <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Name</th>
            <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Email</th>
            <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Verified</th>
            <th class="py-3 px-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Created</th>
            <th class="py-3 px-4 text-center text-sm font-medium text-gray-600 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          {#if users.length === 0}
            <tr>
              <td colspan="5" class="py-4 px-4 text-center text-gray-500">No users found</td>
            </tr>
          {:else}
            {#each users as user}
              <tr class="hover:bg-gray-50">
                <td class="py-3 px-4">{user.name || 'N/A'}</td>
                <td class="py-3 px-4">{user.email}</td>
                <td class="py-3 px-4">
                  {#if user.verified}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Not Verified
                    </span>
                  {/if}
                </td>
                <td class="py-3 px-4">{new Date(user.created).toLocaleDateString()}</td>
                <td class="py-3 px-4 flex justify-center space-x-2">
                  <button
                    on:click={() => openEditModal(user)}
                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition duration-200"
                  >
                    Edit
                  </button>
                  <button
                    on:click={() => openDeleteModal(user)}
                    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition duration-200"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    
    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex justify-center items-center space-x-2 mt-6">
        <button
          on:click={() => changePage(page - 1)}
          disabled={page === 1}
          class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          Previous
        </button>
        
        {#each Array(totalPages) as _, i}
          <button
            on:click={() => changePage(i + 1)}
            class={`px-3 py-1 rounded ${page === i + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            {i + 1}
          </button>
        {/each}
        
        <button
          on:click={() => changePage(page + 1)}
          disabled={page === totalPages}
          class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    {/if}
    
    <!-- Add User button -->
    <div class="mt-6">
      <button
        on:click={() => dispatch('addUser')}
        class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition duration-200 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add New User
      </button>
    </div>
  {/if}
  
  <!-- Edit User Modal -->
  {#if isEditModalOpen && currentUser}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">Edit User: {currentUser.name || 'Unnamed'}</h3>
          <button
            on:click={closeEditModal}
            class="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {#if editSuccess}
          <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p>User updated successfully!</p>
          </div>
        {/if}
        
        {#if editError}
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{editError}</p>
          </div>
        {/if}
        
        <form on:submit|preventDefault={handleUpdateUser} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              bind:value={editFormData.name}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="User's name"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              bind:value={editFormData.email}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </div>
          
          <div class="flex items-center">
            <input
              type="checkbox"
              id="edit-emailVisibility"
              bind:checked={editFormData.emailVisibility}
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="edit-emailVisibility" class="ml-2 block text-sm text-gray-700">Email Visibility</label>
          </div>
          
          <div class="flex items-center">
            <input
              type="checkbox"
              id="edit-verified"
              bind:checked={editFormData.verified}
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="edit-verified" class="ml-2 block text-sm text-gray-700">Verified</label>
          </div>
          
          <div class="border-t border-gray-200 pt-4 mt-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">Change Password</span>
              <button
                type="button"
                on:click={togglePasswordChangeMode}
                class="text-sm text-blue-600 hover:text-blue-800"
              >
                {passwordChangeMode ? 'Cancel' : 'Change'}
              </button>
            </div>
          </div>
          
          {#if passwordChangeMode}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div class="relative">
                <input
                  type={showEditPassword ? "text" : "password"}
                  bind:value={editFormData.password}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 8 characters"
                  minlength="8"
                />
                <button 
                  type="button"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-800"
                  on:click={() => showEditPassword = !showEditPassword}
                >
                  {#if showEditPassword}
                    <!-- Hide password icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  {:else}
                    <!-- Show password icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  {/if}
                </button>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type={showEditPassword ? "text" : "password"}
                bind:value={editFormData.passwordConfirm}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
              />
            </div>
            
            {#if pb.authStore.model?.id === currentUser.id}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type={showEditPassword ? "text" : "password"}
                  bind:value={editFormData.oldPassword}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your current password"
                />
                <p class="mt-1 text-xs text-gray-500">Required when changing your own password</p>
              </div>
            {/if}
          {/if}
          
          <div class="flex justify-end pt-4">
            <button
              type="button"
              on:click={closeEditModal}
              class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded mr-2 transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition duration-200"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
  
  <!-- Delete Confirmation Modal -->
  {#if isDeleteModalOpen && userToDelete}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">Confirm Delete</h3>
          <button
            on:click={closeDeleteModal}
            class="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p class="mb-6">Are you sure you want to delete user <span class="font-semibold">{userToDelete.name || userToDelete.email}</span>? This action cannot be undone.</p>
        
        <div class="flex justify-end">
          <button
            on:click={closeDeleteModal}
            class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded mr-2 transition duration-200"
          >
            Cancel
          </button>
          <button
            on:click={handleDeleteUser}
            class="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition duration-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}