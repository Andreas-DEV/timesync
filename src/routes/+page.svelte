<script>
    import "../app.css"
    /* import Logo from "$lib/Logo.svg"; */
    import Login from "$lib/Login.svelte";
</script>


<main class="min-h-screen bg-gradient-to-r from-yellow-600 via-red-500 to-blue-400 relative">
    <!-- Logo positioned in top left corner -->
    <div class="absolute top-4 left-4 flex gap-1 items-center select-none">
      <!-- <img class="w-[90px]" draggable="false" src={Logo} alt=""> -->
      <p class="text-4xl uppercase text-white rounded font-bold">timesync</p>
    </div>
    
    <!-- Centered login component -->
    <div class="min-h-screen flex items-center justify-center p-4">
      <Login/>
    </div>
  </main>