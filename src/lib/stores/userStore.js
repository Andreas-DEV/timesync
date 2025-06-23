// Enhanced userStore.js with better error handling and consistency
import { writable, get, derived } from 'svelte/store';
import PocketBase from 'pocketbase';

// Single PocketBase instance - export this for use across all components
export const pb = new PocketBase('https://timesync.pockethost.io/');

// Core authentication stores
export const currentUser = writable(null);
export const userName = writable('Anonymous User');
export const isLoading = writable(false);
export const isAuthenticated = writable(false);
export const authError = writable(null);

// Derived stores for common checks
export const isAdmin = derived(currentUser, ($user) => 
  $user?.admin === true || $user?.role === 'admin'
);

export const userInfo = derived(
  [currentUser, userName, isAuthenticated], 
  ([$user, $name, $isAuth]) => ({
    user: $user,
    name: $name,
    isAuthenticated: $isAuth,
    id: $user?.id || null
  })
);

// Auth state management
let authInitialized = false;
let initializationPromise = null;

function setUserData(userRecord) {
  if (!userRecord) {
    clearUserData();
    return;
  }
  
  currentUser.set(userRecord);
  isAuthenticated.set(true);
  authError.set(null);
  
  const name = userRecord.name || userRecord.username || userRecord.email || 'Unknown User';
  userName.set(name);
  
  console.log('User authenticated:', name);
}

function clearUserData() {
  isAuthenticated.set(false);
  currentUser.set(null);
  userName.set('Anonymous User');
}

// Initialize user - ensures only one initialization at a time
export async function initializeUser() {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return await initializationPromise;
  }
  
  // Return cached result if already initialized
  if (authInitialized && !get(isLoading)) {
    return get(currentUser);
  }
  
  // Create new initialization promise
  initializationPromise = performInitialization();
  
  try {
    const result = await initializationPromise;
    authInitialized = true;
    return result;
  } finally {
    initializationPromise = null;
  }
}

async function performInitialization() {
  if (get(isLoading)) {
    return get(currentUser);
  }
  
  isLoading.set(true);
  authError.set(null);
  
  try {
    // Check if we have a valid auth state
    if (pb.authStore.isValid && pb.authStore.model) {
      const authUser = pb.authStore.model;
      
      try {
        // Verify the auth is still valid by making a test request
        await pb.collection('users').getOne(authUser.id);
        setUserData(authUser);
        return authUser;
      } catch (error) {
        // Auth token might be expired, clear it
        console.warn('Auth token verification failed:', error);
        pb.authStore.clear();
        clearUserData();
      }
    } else {
      clearUserData();
    }
  } catch (error) {
    console.error('Error initializing user:', error);
    authError.set(error.message);
    clearUserData();
  } finally {
    isLoading.set(false);
  }
  
  return null;
}

// Enhanced login with better error handling
export async function login(email, password) {
  if (get(isLoading)) {
    throw new Error('Login already in progress');
  }
  
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  
  isLoading.set(true);
  authError.set(null);
  
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    
    if (!authData || !authData.record) {
      throw new Error('Authentication failed - no data returned');
    }
    
    setUserData(authData.record);
    authInitialized = true;
    return true;
  } catch (error) {
    console.error('Login error:', error);
    authError.set(error.message);
    clearUserData();
    throw error;
  } finally {
    isLoading.set(false);
  }
}

// Logout with cleanup
export function logout() {
  try {
    pb.authStore.clear();
    clearUserData();
    authInitialized = false;
    authError.set(null);
    console.log('User logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    clearUserData();
    authInitialized = false;
  }
}

// Helper functions for components
export function getCurrentUser() {
  return get(currentUser);
}

export function getCurrentUserName() {
  return get(userName);
}

export function getIsAuthenticated() {
  return get(isAuthenticated);
}

export function requireAuth() {
  const user = getCurrentUser();
  const isAuth = getIsAuthenticated();
  
  if (!isAuth || !user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

// Auto-refresh functionality for long sessions
export async function refreshAuth() {
  if (!pb.authStore.isValid) {
    return false;
  }
  
  try {
    const authData = await pb.collection('users').authRefresh();
    if (authData && authData.record) {
      setUserData(authData.record);
    }
    return true;
  } catch (error) {
    console.error('Auth refresh failed:', error);
    logout();
    return false;
  }
}

// Setup auto-refresh timer (call this once in your main app)
export function setupAuthRefresh() {
  // Refresh every 24 hours
  setInterval(refreshAuth, 24 * 60 * 60 * 1000);
}