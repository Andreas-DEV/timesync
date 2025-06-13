import { writable, get } from 'svelte/store';
import PocketBase from 'pocketbase';

// Initialize PocketBase
const pb = new PocketBase('https://timesync.pockethost.io/');

// Create stores
export const currentUser = writable(null);
export const userName = writable('Anonymous User');
export const isLoading = writable(false);
export const isAuthenticated = writable(false);

// Helper function to set user data from any user object
function setUserData(userRecord) {
  currentUser.set(userRecord);
  isAuthenticated.set(true);
  
  // Use name or username, fall back to email
  const name = userRecord.name || userRecord.username || userRecord.email || 'Unknown User';
  userName.set(name);
}

// Helper function to clear user data
function clearUserData() {
  isAuthenticated.set(false);
  currentUser.set(null);
  userName.set('Anonymous User');
}

// Initialize user data on load - optimized version
export async function initializeUser() {
  // Prevent multiple simultaneous calls
  if (get(isLoading)) {
    console.log('User initialization already in progress');
    return null;
  }
  
  isLoading.set(true);
  
  try {
    if (pb.authStore.isValid && pb.authStore.model) {
      const authUser = pb.authStore.model;
      
      // Use the auth store data directly - no additional API call needed
      setUserData(authUser);
      console.log('User authenticated from auth store:', get(userName));
      return authUser;
    } else {
      // No authenticated user - clear everything
      clearUserData();
    }
  } catch (error) {
    console.error('Error initializing user:', error);
    clearUserData();
  } finally {
    isLoading.set(false);
  }
  
  return null;
}

// Get the current user's name
export function getCurrentUserName() {
  return get(userName);
}

// Get the current user object
export function getCurrentUser() {
  return get(currentUser);
}

// Get current authentication status
export function getIsAuthenticated() {
  return get(isAuthenticated);
}

// Get current loading status
export function getIsLoading() {
  return get(isLoading);
}

// Login a user - optimized version
export async function login(email, password) {
  // Prevent multiple simultaneous login attempts
  if (get(isLoading)) {
    console.log('Login already in progress');
    return false;
  }
  
  // Validate input
  if (!email || !password) {
    console.error('Email and password are required');
    return false;
  }
  
  isLoading.set(true);
  
  try {
    // Single API call for authentication
    const authData = await pb.collection('users').authWithPassword(email, password);
    
    if (!authData || !authData.record) {
      throw new Error('Authentication failed - no data returned');
    }
    
    // Use the returned user data directly - no need for additional API call
    setUserData(authData.record);
    console.log('Login successful:', get(userName));
    
    return true;
  } catch (error) {
    console.error('Login error:', error);
    clearUserData();
    return false;
  } finally {
    isLoading.set(false);
  }
}

// Register a new user - optimized version
export async function register(email, password, passwordConfirm, additionalData = {}) {
  // Prevent multiple simultaneous registration attempts
  if (get(isLoading)) {
    console.log('Registration already in progress');
    return false;
  }
  
  // Validate input
  if (!email || !password || !passwordConfirm) {
    console.error('Email, password, and password confirmation are required');
    return false;
  }
  
  if (password !== passwordConfirm) {
    console.error('Passwords do not match');
    return false;
  }
  
  isLoading.set(true);
  
  try {
    const userData = {
      email,
      password,
      passwordConfirm,
      ...additionalData
    };
    
    const record = await pb.collection('users').create(userData);
    
    if (!record) {
      throw new Error('Registration failed - no record returned');
    }
    
    console.log('Registration successful');
    
    // Automatically log in after successful registration
    // This will now be much faster since login is optimized
    return await login(email, password);
  } catch (error) {
    console.error('Registration error:', error);
    return false;
  } finally {
    isLoading.set(false);
  }
}

// Logout the current user
export function logout() {
  try {
    pb.authStore.clear();
    clearUserData();
    console.log('User logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear local state even if there's an error
    clearUserData();
  }
}

// Check if user is currently authenticated
export function checkAuth() {
  return pb.authStore.isValid && pb.authStore.model;
}

// Refresh the current user's data - only call this when you specifically need fresh data
export async function refreshUserData() {
  const user = getCurrentUser();
  
  if (!user || !getIsAuthenticated()) {
    console.log('No authenticated user to refresh');
    return null;
  }
  
  if (get(isLoading)) {
    console.log('Another operation in progress');
    return null;
  }
  
  isLoading.set(true);
  
  try {
    const refreshedUser = await pb.collection('users').getOne(user.id);
    setUserData(refreshedUser);
    console.log('User data refreshed');
    return refreshedUser;
  } catch (error) {
    console.error('Error refreshing user data:', error);
    return null;
  } finally {
    isLoading.set(false);
  }
}

// Auto-refresh auth token (useful for long-running sessions)
export async function refreshAuth() {
  if (!checkAuth()) {
    return false;
  }
  
  try {
    const authData = await pb.collection('users').authRefresh();
    // Update user data with refreshed data if available
    if (authData && authData.record) {
      setUserData(authData.record);
    }
    console.log('Auth token refreshed');
    return true;
  } catch (error) {
    console.error('Auth refresh failed:', error);
    // If refresh fails, the user might need to log in again
    logout();
    return false;
  }
}