<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  
  // Props
  export let pocketbase; // Your PocketBase instance
  export let onSuccess = () => {}; // Optional callback for when logging is successful

  // Component state
  let showModal = false;
  let kunder = []; // List of all "kunder" (customers)
  let products = [];
  let selectedKunde = null;
  let selectedProduct = null;
  let quantity = 1;
  let isLoading = false;
  let isLoadingData = true;
  let successMessage = '';
  let errorMessage = '';
  let appliedPrice = 0;

  // Define price tiers for the product
  const priceTiers = [
    { min: 1, max: 5, price: 100.00 },
    { min: 6, max: 10, price: 90.00 },
    { min: 11, max: Infinity, price: 70.00 }
  ];

  // Calculate the price based on quantity
  function calculateTieredPrice(baseProduct, qty) {
    if (!baseProduct) return 0;
    
    // Check if this is the product we want to apply tiered pricing to
    // You can adjust this condition based on product ID or name as needed
    if (baseProduct.productName.toLowerCase().includes('lønseddel') || 
        baseProduct.productName.toLowerCase().includes('lonseddel') ||
        baseProduct.productName.toLowerCase().includes('payslip')) {
      
      // Find the appropriate tier
      const tier = priceTiers.find(tier => qty >= tier.min && qty <= tier.max);
      return tier ? tier.price : baseProduct.productPrice;
    }
    
    // For other products, use the standard price
    return baseProduct.productPrice;
  }

  // Calculate total price based on quantity and unit price
  function calculateTotalPrice() {
    if (!selectedProduct) return 0;
    
    // Get the unit price based on tiers
    appliedPrice = calculateTieredPrice(selectedProduct, quantity);
    
    // Return total price
    return appliedPrice * quantity;
  }

  // Fetch data on mount
  onMount(async () => {
    isLoadingData = true;
    
    try {
      // Fetch all kunder (customers)
      const kunderData = await pocketbase.collection('kunder').getFullList({
        sort: '+navn',
      });
      kunder = kunderData;
      
      // Fetch all products
      const productsData = await pocketbase.collection('products').getFullList({
        sort: '+productName',
      });
      products = productsData;
      
      isLoadingData = false;
    } catch (error) {
      console.error('Failed to fetch data:', error);
      errorMessage = 'Failed to load data. Please try again.';
      isLoadingData = false;
    }
  });

  // Open modal
  function openModal() {
    showModal = true;
  }

  // Close modal
  function closeModal() {
    showModal = false;
    selectedKunde = null;
    selectedProduct = null;
    quantity = 1;
    successMessage = '';
    errorMessage = '';
  }

  // Handle form submission
  async function handleSubmit() {
    if (!selectedKunde) {
      errorMessage = 'Please select a customer first.';
      return;
    }
    
    if (!selectedProduct) {
      errorMessage = 'Please select a product.';
      return;
    }

    if (quantity <= 0) {
      errorMessage = 'Quantity must be greater than 0.';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      // Calculate unit price based on tiers
      const unitPrice = calculateTieredPrice(selectedProduct, quantity);
      
      // Calculate total price
      const totalPrice = unitPrice * quantity;

      // Create the data object for the new record
      const logData = {
        kunder: selectedKunde.id,
        product: selectedProduct.id,
        quantity: quantity,
        unit_price: unitPrice, // Store the actual unit price used
        total_price: totalPrice,
        created: new Date().toISOString(),
      };
      
      // Add the current user's ID if they're authenticated
      if (pocketbase.authStore.isValid) {
        logData.user = pocketbase.authStore.model.id;
      }

      // Create new product log record in the database
      await pocketbase.collection('product_logs').create(logData);

      // Call the success callback if provided
      onSuccess();
      
      // Close modal immediately
      closeModal();
      
      // Show full-page loading animation immediately
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center';
      loadingOverlay.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          <p class="text-lg font-medium text-gray-700">Updating...</p>
        </div>
      `;
      document.body.appendChild(loadingOverlay);
      
      // Refresh the page after 500ms
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to log product:', error);
      errorMessage = 'Failed to log product. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Update applied price whenever product or quantity changes
  $: {
    if (selectedProduct && quantity > 0) {
      appliedPrice = calculateTieredPrice(selectedProduct, quantity);
    } else {
      appliedPrice = 0;
    }
  }
</script>

<!-- Button to open modal -->
<button 
  on:click={openModal}
  class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex h-[50px] items-center"
>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
  </svg>
  Log Product
</button>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    transition:fade={{ duration: 200 }}
    on:click={closeModal}
  >
    <!-- Modal content -->
    <div 
      class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      on:click|stopPropagation={() => {}}
    >
      <!-- Modal header -->
      <div class="border-b px-6 py-4">
        <h3 class="text-lg font-semibold text-gray-900">Log Product</h3>
      </div>

      <!-- Modal body -->
      <div class="p-6">
        {#if isLoadingData}
          <div class="flex justify-center py-6">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        {:else}
          {#if successMessage}
            <div class="mb-4 p-3 bg-green-100 text-green-800 rounded-md">
              {successMessage}
            </div>
          {/if}

          {#if errorMessage}
            <div class="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
              {errorMessage}
            </div>
          {/if}

          <!-- Kunde (Customer) selection -->
          <div class="mb-4">
            <label for="customer-select" class="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
            <select 
              id="customer-select"
              class="w-full p-2 border rounded-md bg-white"
              bind:value={selectedKunde}
            >
              <option value={null}>-- Select a customer --</option>
              {#each kunder as kunde}
                <option value={kunde}>{kunde.navn}</option>
              {/each}
            </select>
          </div>

          <!-- Product selection (only enabled if kunde is selected) -->
          <div class="mb-4">
            <label for="product-select" class="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
            <select 
              id="product-select"
              class="w-full p-2 border rounded-md bg-white"
              bind:value={selectedProduct}
              disabled={!selectedKunde}
            >
              <option value={null}>-- Select a product --</option>
              {#each products as product}
                <option value={product}>{product.productName} - DKK {product.productPrice.toFixed(2)}</option>
              {/each}
            </select>
          </div>

          <!-- Quantity input -->
          <div class="mb-4">
            <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input 
              type="number" 
              id="quantity" 
              bind:value={quantity} 
              min="1" 
              class="w-full p-2 border rounded-md"
              disabled={!selectedProduct}
            />
          </div>

          <!-- Pricing information for tiered products -->
          {#if selectedProduct && selectedProduct.productName.toLowerCase().includes('lønseddel')}
            <div class="mb-4 p-3 bg-blue-50 rounded-md text-sm">
              <p class="font-medium mb-1">Tiered pricing:</p>
              <ul class="list-disc pl-5">
                <li>1-5 medarbejdere pr. lønseddel: DKK 100.00</li>
                <li>6-10 medarbejdere pr. lønseddel: DKK 90.00</li>
                <li>Over 10 medarbejdere pr. lønseddel: DKK 70.00</li>
              </ul>
              {#if quantity > 0}
                <p class="mt-2 font-medium">Applied price: DKK {appliedPrice.toFixed(2)} per unit</p>
              {/if}
            </div>
          {/if}

          <!-- Total calculation -->
          {#if selectedProduct && quantity > 0}
            <div class="mb-4 p-3 bg-gray-100 rounded-md">
              <p class="font-medium">Total: DKK {calculateTotalPrice().toFixed(2)}</p>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Modal footer -->
      <div class="border-t px-6 py-4 flex justify-end gap-2">
        <button 
          type="button" 
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          on:click={closeModal}
        >
          Cancel
        </button>
        <button 
          type="button" 
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={handleSubmit}
          disabled={isLoading || isLoadingData || !selectedKunde || !selectedProduct || quantity <= 0}
        >
          {isLoading ? 'Saving...' : 'Log Product'}
        </button>
      </div>
    </div>
  </div>
{/if}