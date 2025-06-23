<script>
  import "../app.css"
  import Logo from "../lib/assets/logo.svg"
  import Login from "$lib/Login.svelte";
</script>

<main class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
  <!-- Animated background elements -->
  <div class="absolute inset-0">
      <!-- Floating orbs -->
      <div class="absolute top-20 left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div class="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
      <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 2s;"></div>
      
      <!-- Grid pattern overlay -->
      <div class="absolute inset-0 opacity-10">
          <div class="h-full w-full" style="background-image: radial-gradient(circle, #ffffff 1px, transparent 1px); background-size: 50px 50px;"></div>
      </div>
  </div>
  
  <!-- Logo positioned in top left corner with enhanced styling -->
  <div class="absolute top-6 left-6 flex gap-2 items-center select-none z-10">
      <div class="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
          <img src={Logo} class="p-1" alt="">
      </div>
      <div>
          <p class="text-3xl uppercase text-white font-bold tracking-wide">timesync</p>
          <p class="text-xs text-purple-200 -mt-1 tracking-widest opacity-75">PRODUCTIVITY SUITE</p>
      </div>
  </div>
  
  <!-- Centered login component with glassmorphism container -->
  <div class="min-h-screen flex items-center justify-center p-4">
      <div class="relative">
          <!-- Glassmorphism background -->
          <div class="absolute inset-0 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl"></div>
          
          <!-- Gradient border effect -->
          <div class="absolute inset-0 bg-gradient-to-r from-purple-500/50 to-blue-500/50 rounded-3xl blur-sm opacity-75"></div>
          <div class="absolute inset-0.5 bg-slate-900/50 rounded-3xl"></div>
          
          <!-- Content container -->
          <div class="relative p-8 min-w-[400px]">
              <!-- Header text -->
              <div class="text-center mb-8">
                  <h1 class="text-3xl font-bold text-white mb-2">TimeSync Login</h1>
                  <p class="text-purple-200 opacity-75">Access your productivity dashboard</p>
              </div>
              
              <!-- Login component wrapper -->
              <div class="space-y-6">
                  <Login/>
              </div>
              
              <!-- Bottom decoration -->
              <div class="mt-8 pt-6 border-t border-white/10">
              </div>
          </div>
      </div>
  </div>
  
  <!-- Bottom corner accent -->
  <div class="absolute bottom-6 right-6 text-right text-purple-200/30 text-xs select-none">
      <p>Made with ❤️</p>
      <p class="font-mono">by Grønbech Solutions</p>
  </div>
</main>

<style>
  @keyframes pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.05); }
  }
  
  .animate-pulse {
      animation: pulse 4s ease-in-out infinite;
  }
  
  /* Additional glow effect on hover for the main container */
  main:hover .absolute.inset-0.bg-gradient-to-r {
      opacity: 1;
      transition: opacity 0.3s ease;
  }
</style>