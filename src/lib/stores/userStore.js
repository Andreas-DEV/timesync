import { writable } from 'svelte/store';
import PocketBase from 'pocketbase';

// Initialize PocketBase
const pb = new PocketBase('https://timesync.pockethost.io/');

// Create stores
export const currentUser = writable(null);
export const userName = writable('Anonymous User');
export const isLoading = writable(false);
export const isAuthenticated = writable(false);

// Initialize user data on load
export async function initializeUser() {
  isLoading.set(true);
  
  try {
    if (pb.authStore.isValid) {
      const authUser = pb.authStore.model;
      isAuthenticated.set(true);
      
      try {
        // Get the full user record to access all fields
        const userRecord = await pb.collection('users').getOne(authUser.id);
        currentUser.set(userRecord);
        
        // Use name or username, fall back to email
        const name = userRecord.name || userRecord.username || userRecord.email || 'Unknown User';
        userName.set(name);
        
        console.log('User authenticated:', name);
        return userRecord;
      } catch (error) {
        console.error('Error fetching user details:', error);
        currentUser.set(authUser);
        userName.set(authUser.email || 'Unknown User');
      }
    } else {
      // No authenticated user
      isAuthenticated.set(false);
      currentUser.set(null);
      userName.set('Anonymous User');
    }
  } catch (error) {
    console.error('Error initializing user:', error);
  } finally {
    isLoading.set(false);
  }
  
  return null;
}

// Get the current user's name
export function getCurrentUserName() {
  let result = 'Anonymous User';
  
  // Use the subscribe method to get the current value
  userName.subscribe(value => {
    result = value;
  })();
  
  return result;
}

// Get the current user object
export function getCurrentUser() {
  let result = null;
  
  // Use the subscribe method to get the current value
  currentUser.subscribe(value => {
    result = value;
  })();
  
  return result;
}

// Login a user
export async function login(email, password) {
  isLoading.set(true);
  
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    isAuthenticated.set(true);
    
    // Get full user data
    await initializeUser();
    
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  } finally {
    isLoading.set(false);
  }
}

// Logout the current user
export function logout() {
  pb.authStore.clear();
  isAuthenticated.set(false);
  currentUser.set(null);
  userName.set('Anonymous User');
}