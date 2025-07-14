<script>
  import { onMount } from 'svelte';
  import PocketBase from 'pocketbase';
  import { writable } from 'svelte/store';

  // PocketBase client
  const pb = new PocketBase('https://timesync.pockethost.io/');
  
  // Stores
  const customers = writable([]);
  const products = writable([]);
  const loading = writable(false);
  const error = writable(null);
  const successMessage = writable('');
  
  // Pagination
  let customerPage = 1;
  let productPage = 1;
  const customerPerPage = 10; // 10 items per page for customers
const productPerPage = 5;   // 5 items per page for products
  let customerTotalPages = 0;
  let customerTotalItems = 0;
  let productTotalPages = 0;
  let productTotalItems = 0;
  
  // Search
  let customerSearchQuery = '';
  let productSearchQuery = '';
  let customerSearchTimeout;
  let productSearchTimeout;
  
  // Modal states
  let showCreateCustomerModal = false;
  let showEditCustomerModal = false;
  let showCreateProductModal = false;
  let showEditProductModal = false;
  
  // Form data
  let newCustomer = {
    navn: '',
    timepris: ''
  };
  
  let newProduct = {
    productName: '',
    productPrice: ''
  };
  
  let editingCustomer = null;
  let editingProduct = null;
  
  // Load customers
  async function loadCustomers() {
    try {
      loading.set(true);
      
      const filter = customerSearchQuery 
        ? `navn ~ "${customerSearchQuery}"` 
        : '';
      
        const records = await pb.collection('kunder').getList(customerPage, customerPerPage, {
        sort: 'navn',
        filter: filter
      });
      
      customers.set(records.items);
      customerTotalItems = records.totalItems;
      customerTotalPages = records.totalPages;
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Load products
  async function loadProducts() {
    try {
      loading.set(true);
      
      const filter = productSearchQuery 
        ? `productName ~ "${productSearchQuery}"` 
        : '';
      
        const records = await pb.collection('products').getList(productPage, productPerPage, {
        sort: 'productName',
        filter: filter
      });
      
      products.set(records.items);
      productTotalItems = records.totalItems;
      productTotalPages = records.totalPages;
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Run customer search with debounce
  function handleCustomerSearch() {
    clearTimeout(customerSearchTimeout);
    customerSearchTimeout = setTimeout(() => {
      customerPage = 1; // Reset to first page when searching
      loadCustomers();
    }, 300);
  }
  
  // Run product search with debounce
  function handleProductSearch() {
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
      productPage = 1; // Reset to first page when searching
      loadProducts();
    }, 300);
  }
  
  // Change customer page
  function changeCustomerPage(newPage) {
    if (newPage < 1 || newPage > customerTotalPages) return;
    customerPage = newPage;
    loadCustomers();
  }
  
  // Change product page
  function changeProductPage(newPage) {
    if (newPage < 1 || newPage > productTotalPages) return;
    productPage = newPage;
    loadProducts();
  }
  
  // Initial load
  onMount(() => {
    loadCustomers();
    loadProducts();
  });
  
  // Open create customer modal
  function openCreateCustomerModal() {
    newCustomer = {
      navn: '',
      timepris: ''
    };
    showCreateCustomerModal = true;
  }
  
  // Open create product modal
  function openCreateProductModal() {
    newProduct = {
      productName: '',
      productPrice: ''
    };
    showCreateProductModal = true;
  }
  
  // Open edit customer modal
  function openEditCustomerModal(customer) {
    editingCustomer = { ...customer };
    showEditCustomerModal = true;
  }
  
  // Open edit product modal
  function openEditProductModal(product) {
    editingProduct = { ...product };
    showEditProductModal = true;
  }
  
  // Create new customer
  async function createCustomer() {
    try {
      loading.set(true);
      error.set(null);
      
      // Validate form
      if (!newCustomer.navn.trim()) {
        throw new Error('Kunde navn er påkrævet');
      }
      
      if (!newCustomer.timepris || isNaN(Number(newCustomer.timepris))) {
        throw new Error('Timepris skal være et gyldigt tal');
      }
      
      // Format data for PocketBase
      const data = {
        navn: newCustomer.navn.trim(),
        timepris: Number(newCustomer.timepris)
      };
      
      // Create in PocketBase
      await pb.collection('kunder').create(data);
      
      // Reload list to show new item
      loadCustomers();
      
      // Close modal
      showCreateCustomerModal = false;
      
      // Show success message
      successMessage.set('Kunde oprettet med succes!');
      setTimeout(() => successMessage.set(''), 3000);
      
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Create new product
  async function createProduct() {
    try {
      loading.set(true);
      error.set(null);
      
      // Validate form
      if (!newProduct.productName.trim()) {
        throw new Error('Produkt navn er påkrævet');
      }
      
      if (!newProduct.productPrice || isNaN(Number(newProduct.productPrice))) {
        throw new Error('Pris skal være et gyldigt tal');
      }
      
      // Format data for PocketBase
      const data = {
        productName: newProduct.productName.trim(),
        productPrice: Number(newProduct.productPrice)
      };
      
      // Create in PocketBase
      await pb.collection('products').create(data);
      
      // Reload list to show new item
      loadProducts();
      
      // Close modal
      showCreateProductModal = false;
      
      // Show success message
      successMessage.set('Produkt oprettet med succes!');
      setTimeout(() => successMessage.set(''), 3000);
      
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Update customer
  async function updateCustomer() {
    try {
      loading.set(true);
      error.set(null);
      
      // Validate form
      if (!editingCustomer.navn.trim()) {
        throw new Error('Kunde navn er påkrævet');
      }
      
      if (!editingCustomer.timepris || isNaN(Number(editingCustomer.timepris))) {
        throw new Error('Timepris skal være et gyldigt tal');
      }
      
      // Format data for PocketBase
      const data = {
        navn: editingCustomer.navn.trim(),
        timepris: Number(editingCustomer.timepris)
      };
      
      // Update in PocketBase
      await pb.collection('kunder').update(editingCustomer.id, data);
      
      // Reload list
      loadCustomers();
      
      // Close modal
      showEditCustomerModal = false;
      
      // Show success message
      successMessage.set('Kunde opdateret med succes!');
      setTimeout(() => successMessage.set(''), 3000);
      
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Update product
  async function updateProduct() {
    try {
      loading.set(true);
      error.set(null);
      
      // Validate form
      if (!editingProduct.productName.trim()) {
        throw new Error('Produkt navn er påkrævet');
      }
      
      if (!editingProduct.productPrice || isNaN(Number(editingProduct.productPrice))) {
        throw new Error('Pris skal være et gyldigt tal');
      }
      
      // Format data for PocketBase
      const data = {
        productName: editingProduct.productName.trim(),
        productPrice: Number(editingProduct.productPrice)
      };
      
      // Update in PocketBase
      await pb.collection('products').update(editingProduct.id, data);
      
      // Reload list
      loadProducts();
      
      // Close modal
      showEditProductModal = false;
      
      // Show success message
      successMessage.set('Produkt opdateret med succes!');
      setTimeout(() => successMessage.set(''), 3000);
      
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Delete customer
  async function deleteCustomer(id) {
    if (!confirm('Er du sikker på, at du vil slette denne kunde?')) {
      return;
    }
    
    try {
      loading.set(true);
      error.set(null);
      
      await pb.collection('kunder').delete(id);
      
      // Reload list
      loadCustomers();
      
      // Show success message
      successMessage.set('Kunde slettet med succes!');
      setTimeout(() => successMessage.set(''), 3000);
      
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
  
  // Delete product
  async function deleteProduct(id) {
    if (!confirm('Er du sikker på, at du vil slette dette produkt?')) {
      return;
    }
    
    try {
      loading.set(true);
      error.set(null);
      
      await pb.collection('products').delete(id);
      
      // Reload list
      loadProducts();
      
      // Show success message
      successMessage.set('Produkt slettet med succes!');
      setTimeout(() => successMessage.set(''), 3000);
      
    } catch (err) {
      error.set(err.message);
    } finally {
      loading.set(false);
    }
  }
</script>

<div class="space-y-8">
  {#if $successMessage}
    <div class="p-4 bg-green-50 text-green-700 rounded-lg">
      <p>{$successMessage}</p>
    </div>
  {/if}

  <!-- Customer List Section -->
  <div class="bg-white p-6 rounded-lg shadow">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold">Kunde Oversigt</h2>
      <button
        on:click={openCreateCustomerModal}
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Opret Ny Kunde
      </button>
    </div>
    
    <!-- Search Bar -->
    <div class="mb-6">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path>
          </svg>
        </div>
        <input
          type="text"
          bind:value={customerSearchQuery}
          on:input={handleCustomerSearch}
          placeholder="Søg efter kunde..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>
    </div>
    
    {#if $loading}
      <div class="py-4 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        <p class="mt-2 text-gray-600">Indlæser kunder...</p>
      </div>
    {:else}
      {#if $customers.length === 0}
        <p class="text-gray-500 py-4">
          {customerSearchQuery ? `Ingen kunder matcher "${customerSearchQuery}".` : 'Ingen kunder fundet. Opret en ny kunde ved at klikke på "Opret Ny Kunde" knappen.'}
        </p>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Navn</th>
                <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timepris (DKK)</th>
                <th class="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Handlinger</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each $customers as customer}
                <tr class="hover:bg-gray-50">
                  <td class="py-3 px-4 text-sm text-gray-900">{customer.navn}</td>
                  <td class="py-3 px-4 text-sm text-gray-900">{customer.timepris} kr.</td>
                  <td class="py-3 px-4 text-sm text-gray-900 text-right space-x-2">
                    <button
                      on:click={() => openEditCustomerModal(customer)}
                      class="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Rediger
                    </button>
                    <button
                      on:click={() => deleteCustomer(customer.id)}
                      class="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Slet
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        {#if customerTotalPages > 1}
          <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
            <div class="flex flex-1 justify-between sm:hidden">
              <button
                on:click={() => changeCustomerPage(customerPage - 1)}
                disabled={customerPage === 1}
                class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 {customerPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
              >
                Forrige
              </button>
              <button
                on:click={() => changeCustomerPage(customerPage + 1)}
                disabled={customerPage === customerTotalPages}
                class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 {customerPage === customerTotalPages ? 'opacity-50 cursor-not-allowed' : ''}"
              >
                Næste
              </button>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700">
                  Viser <span class="font-medium">{(customerPage - 1) * customerPerPage + 1}</span> til <span class="font-medium">{Math.min(customerPage * customerPerPage, customerTotalItems)}</span> af <span class="font-medium">{customerTotalItems}</span> kunder
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    on:click={() => changeCustomerPage(customerPage - 1)}
                    disabled={customerPage === 1}
                    class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 {customerPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                  >
                    <span class="sr-only">Forrige</span>
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  
                  {#if customerTotalPages <= 7}
                    {#each Array(customerTotalPages) as _, i}
                      <button
                        on:click={() => changeCustomerPage(i + 1)}
                        class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {customerPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                      >
                        {i + 1}
                      </button>
                    {/each}
                  {:else}
                    <!-- First page -->
                    <button
                      on:click={() => changeCustomerPage(1)}
                      class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {customerPage === 1 ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                    >
                      1
                    </button>
                    
                    <!-- Ellipsis if needed -->
                    {#if customerPage > 3}
                      <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                        ...
                      </span>
                    {/if}
                    
                    <!-- Pages around current page -->
                    {#each Array(3) as _, i}
                      {#if customerPage - 1 + i > 1 && customerPage - 1 + i < customerTotalPages}
                        <button
                          on:click={() => changeCustomerPage(customerPage - 1 + i)}
                          class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {customerPage === customerPage - 1 + i ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                        >
                          {customerPage - 1 + i}
                        </button>
                      {/if}
                    {/each}
                    
                    <!-- Ellipsis if needed -->
                    {#if customerPage < customerTotalPages - 2}
                      <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                        ...
                      </span>
                    {/if}
                    
                    <!-- Last page -->
                    <button
                      on:click={() => changeCustomerPage(customerTotalPages)}
                      class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {customerPage === customerTotalPages ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                    >
                      {customerTotalPages}
                    </button>
                  {/if}
                  
                  <button
                    on:click={() => changeCustomerPage(customerPage + 1)}
                    disabled={customerPage === customerTotalPages}
                    class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 {customerPage === customerTotalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                  >
                    <span class="sr-only">Næste</span>
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <!-- Product List Section -->
  <div class="bg-white p-6 rounded-lg shadow mt-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold">Produkt Oversigt</h2>
      <button
        on:click={openCreateProductModal}
        class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        Opret Produkt
      </button>
    </div>
    
    <!-- Search Bar -->
    <div class="mb-6">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path>
          </svg>
        </div>
        <input
          type="text"
          bind:value={productSearchQuery}
          on:input={handleProductSearch}
          placeholder="Søg efter produkt..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>
    </div>
    
    {#if $loading}
      <div class="py-4 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
        <p class="mt-2 text-gray-600">Indlæser produkter...</p>
      </div>
    {:else}
      {#if $products.length === 0}
        <p class="text-gray-500 py-4">
          {productSearchQuery ? `Ingen produkter matcher "${productSearchQuery}".` : 'Ingen produkter fundet. Opret et nyt produkt ved at klikke på "Opret Produkt" knappen.'}
        </p>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full bg-white">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Navn</th>
                <th class="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pris (DKK)</th>
                <th class="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Handlinger</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {#each $products as product}
                <tr class="hover:bg-gray-50">
                  <td class="py-3 px-4 text-sm text-gray-900">{product.productName}</td>
                  <td class="py-3 px-4 text-sm text-gray-900">{product.productPrice} kr.</td>
                  <td class="py-3 px-4 text-sm text-gray-900 text-right space-x-2">
                    <button
                      on:click={() => openEditProductModal(product)}
                      class="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Rediger
                    </button>
                    <button
                      on:click={() => deleteProduct(product.id)}
                      class="inline-flex items-center px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Slet
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        {#if productTotalPages > 1}
          <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
            <div class="flex flex-1 justify-between sm:hidden">
              <button
                on:click={() => changeProductPage(productPage - 1)}
                disabled={productPage === 1}
                class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 {productPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
              >
                Forrige
              </button>
              <button
                on:click={() => changeProductPage(productPage + 1)}
                disabled={productPage === productTotalPages}
                class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 {productPage === productTotalPages ? 'opacity-50 cursor-not-allowed' : ''}"
              >
                Næste
              </button>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700">
                  Viser <span class="font-medium">{(productPage - 1) * productPerPage + 1}</span> til <span class="font-medium">{Math.min(productPage * productPerPage, productTotalItems)}</span> af <span class="font-medium">{productTotalItems}</span> produkter
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    on:click={() => changeProductPage(productPage - 1)}
                    disabled={productPage === 1}
                    class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 {productPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                  >
                    <span class="sr-only">Forrige</span>
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  
                  {#if productTotalPages <= 7}
                    {#each Array(productTotalPages) as _, i}
                      <button
                        on:click={() => changeProductPage(i + 1)}
                        class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {productPage === i + 1 ? 'bg-green-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                      >
                        {i + 1}
                      </button>
                    {/each}
                  {:else}
                    <!-- First page -->
                    <button
                      on:click={() => changeProductPage(1)}
                      class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {productPage === 1 ? 'bg-green-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                    >
                      1
                    </button>
                    
                    <!-- Ellipsis if needed -->
                    {#if productPage > 3}
                      <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                        ...
                      </span>
                    {/if}
                    
                    <!-- Pages around current page -->
                    {#each Array(3) as _, i}
                      {#if productPage - 1 + i > 1 && productPage - 1 + i < productTotalPages}
                        <button
                          on:click={() => changeProductPage(productPage - 1 + i)}
                          class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {productPage === productPage - 1 + i ? 'bg-green-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                        >
                          {productPage - 1 + i}
                        </button>
                      {/if}
                    {/each}
                    
                    <!-- Ellipsis if needed -->
                    {#if productPage < productTotalPages - 2}
                      <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                        ...
                      </span>
                    {/if}
                    
                    <!-- Last page -->
                    <button
                      on:click={() => changeProductPage(productTotalPages)}
                      class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {productPage === productTotalPages ? 'bg-green-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0"
                    >
                      {productTotalPages}
                    </button>
                  {/if}
                  
                  <button
                    on:click={() => changeProductPage(productPage + 1)}
                    disabled={productPage === productTotalPages}
                    class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 {productPage === productTotalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                  >
                    <span class="sr-only">Næste</span>
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<!-- Create Customer Modal -->
{#if showCreateCustomerModal}
  <div 
    class="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50"
    on:click|self={() => showCreateCustomerModal = false}
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Opret Ny Kunde</h3>
      
      {#if $error}
        <div class="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          <p>{$error}</p>
        </div>
      {/if}
      
      <form on:submit|preventDefault={createCustomer} class="space-y-4">
        <div>
          <label for="customerName" class="block text-sm font-medium text-gray-700">Kunde Navn</label>
          <input
            type="text"
            id="customerName"
            bind:value={newCustomer.navn}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Indtast kunde navn"
          />
        </div>
        
        <div>
          <label for="hourlyRate" class="block text-sm font-medium text-gray-700">Timepris (DKK)</label>
          <input
            type="number"
            id="hourlyRate"
            bind:value={newCustomer.timepris}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Indtast timepris"
            min="0"
            step="1"
          />
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            on:click={() => showCreateCustomerModal = false}
            class="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Annuller
          </button>
          <button
            type="submit"
            class="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={$loading}
          >
            {$loading ? 'Opretter...' : 'Opret Kunde'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Customer Modal -->
{#if showEditCustomerModal}
  <div 
    class="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50"
    on:click|self={() => showEditCustomerModal = false}
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Rediger Kunde</h3>
      
      {#if $error}
        <div class="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          <p>{$error}</p>
        </div>
      {/if}
      
      <form on:submit|preventDefault={updateCustomer} class="space-y-4">
        <div>
          <label for="editCustomerName" class="block text-sm font-medium text-gray-700">Kunde Navn</label>
          <input
            type="text"
            id="editCustomerName"
            bind:value={editingCustomer.navn}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label for="editHourlyRate" class="block text-sm font-medium text-gray-700">Timepris (DKK)</label>
          <input
            type="number"
            id="editHourlyRate"
            bind:value={editingCustomer.timepris}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            min="0"
            step="1"
          />
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            on:click={() => showEditCustomerModal = false}
            class="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Annuller
          </button>
          <button
            type="submit"
            class="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={$loading}
          >
            {$loading ? 'Gemmer...' : 'Gem Ændringer'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Create Product Modal -->
{#if showCreateProductModal}
  <div 
    class="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50"
    on:click|self={() => showCreateProductModal = false}
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Opret Nyt Produkt</h3>
      
      {#if $error}
        <div class="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          <p>{$error}</p>
        </div>
      {/if}
      
      <form on:submit|preventDefault={createProduct} class="space-y-4">
        <div>
          <label for="productName" class="block text-sm font-medium text-gray-700">Produkt Navn</label>
          <input
            type="text"
            id="productName"
            bind:value={newProduct.productName}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            placeholder="Indtast produkt navn"
          />
        </div>
        
        <div>
          <label for="productPrice" class="block text-sm font-medium text-gray-700">Pris (DKK)</label>
          <input
            type="number"
            id="productPrice"
            bind:value={newProduct.productPrice}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            placeholder="Indtast pris"
            min="0"
            step="1"
          />
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            on:click={() => showCreateProductModal = false}
            class="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Annuller
          </button>
          <button
            type="submit"
            class="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            disabled={$loading}
          >
            {$loading ? 'Opretter...' : 'Opret Produkt'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Product Modal -->
{#if showEditProductModal}
  <div 
    class="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50"
    on:click|self={() => showEditProductModal = false}
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Rediger Produkt</h3>
      
      {#if $error}
        <div class="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          <p>{$error}</p>
        </div>
      {/if}
      
      <form on:submit|preventDefault={updateProduct} class="space-y-4">
        <div>
          <label for="editProductName" class="block text-sm font-medium text-gray-700">Produkt Navn</label>
          <input
            type="text"
            id="editProductName"
            bind:value={editingProduct.productName}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label for="editProductPrice" class="block text-sm font-medium text-gray-700">Pris (DKK)</label>
          <input
            type="number"
            id="editProductPrice"
            bind:value={editingProduct.productPrice}
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            min="0"
            step="1"
          />
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            on:click={() => showEditProductModal = false}
            class="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Annuller
          </button>
          <button
            type="submit"
            class="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            disabled={$loading}
          >
            {$loading ? 'Gemmer...' : 'Gem Ændringer'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}