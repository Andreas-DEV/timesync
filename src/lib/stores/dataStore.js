// Enhanced dataStore.js - Add this alongside your userStore
import { writable, get, derived } from 'svelte/store';
import { pb, userInfo } from './userStore';

// Data stores with caching
export const customers = writable([]);
export const messages = writable([]);
export const readMessages = writable([]);
export const oldMessages = writable([]);
export const users = writable([]);
export const hourLogs = writable([]);
export const isLoading = writable(false);
export const error = writable(null);

// Cache management
const dataCache = {
  customers: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 }, // 5 minutes
  messages: { data: null, timestamp: 0, ttl: 30 * 1000 }, // 30 seconds
  readMessages: { data: null, timestamp: 0, ttl: 2 * 60 * 1000 }, // 2 minutes
  oldMessages: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 }, // 5 minutes
  users: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }, // 10 minutes
  hourLogs: { data: null, timestamp: 0, ttl: 1 * 60 * 1000 }, // 1 minute
};

// Helper function to check if cache is valid
function isCacheValid(cacheKey) {
  const cache = dataCache[cacheKey];
  if (!cache.data) return false;
  return Date.now() - cache.timestamp < cache.ttl;
}

// Helper function to update cache
function updateCache(cacheKey, data) {
  dataCache[cacheKey] = {
    data: data,
    timestamp: Date.now(),
    ttl: dataCache[cacheKey].ttl
  };
}

// Generic fetch function with caching
async function fetchWithCache(cacheKey, store, fetchFunction, forceRefresh = false) {
  // Check cache first (unless force refresh)
  if (!forceRefresh && isCacheValid(cacheKey)) {
    console.log(`Using cached data for ${cacheKey}`);
    store.set(dataCache[cacheKey].data);
    return dataCache[cacheKey].data;
  }

  // Check authentication
  const userInfoValue = get(userInfo);
  if (!userInfoValue.isAuthenticated) {
    throw new Error('Authentication required');
  }

  try {
    isLoading.set(true);
    error.set(null);
    
    console.log(`Fetching fresh data for ${cacheKey}`);
    const data = await fetchFunction();
    
    // Update store and cache
    store.set(data);
    updateCache(cacheKey, data);
    
    return data;
  } catch (err) {
    console.error(`Error fetching ${cacheKey}:`, err);
    error.set(err.message);
    
    // If we have cached data, use it even if stale
    if (dataCache[cacheKey].data) {
      console.log(`Using stale cached data for ${cacheKey} due to error`);
      store.set(dataCache[cacheKey].data);
      return dataCache[cacheKey].data;
    }
    
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Customer functions
export async function fetchCustomers(forceRefresh = false) {
  return fetchWithCache('customers', customers, async () => {
    const records = await pb.collection('kunder').getFullList({
      sort: 'navn'
    });
    return records;
  }, forceRefresh);
}

export async function fetchAssignedCustomers(forceRefresh = false) {
  const userInfoValue = get(userInfo);
  
  // Get all customers first
  const allCustomers = await fetchCustomers(forceRefresh);
  
  // If admin, return all customers
  if (userInfoValue.user?.admin || userInfoValue.user?.role === 'admin') {
    return allCustomers;
  }
  
  // Get user assignments
  const assignments = await pb.collection('user_customer_assignments').getFullList({
    filter: `user = "${userInfoValue.id}"`,
    fields: 'kunde'
  });
  
  if (assignments.length === 0) {
    return [];
  }
  
  // Filter customers based on assignments
  const assignedIds = new Set(assignments.map(a => a.kunde));
  return allCustomers.filter(customer => assignedIds.has(customer.id));
}

// Message functions
export async function fetchMessages(forceRefresh = false) {
  return fetchWithCache('messages', messages, async () => {
    const userInfoValue = get(userInfo);
    const records = await pb.collection('messages').getFullList({
      filter: `recipient = "${userInfoValue.id}" && archived = false && read = false`,
      sort: '-created',
      expand: 'sender'
    });
    return records;
  }, forceRefresh);
}

export async function fetchReadMessages(forceRefresh = false) {
  return fetchWithCache('readMessages', readMessages, async () => {
    const userInfoValue = get(userInfo);
    const records = await pb.collection('messages').getFullList({
      filter: `recipient = "${userInfoValue.id}" && archived = false && read = true`,
      sort: '-created',
      expand: 'sender'
    });
    return records;
  }, forceRefresh);
}

export async function fetchOldMessages(forceRefresh = false) {
  return fetchWithCache('oldMessages', oldMessages, async () => {
    const userInfoValue = get(userInfo);
    const records = await pb.collection('messages').getFullList({
      filter: `recipient = "${userInfoValue.id}" && archived = true`,
      sort: '-created',
      expand: 'sender'
    });
    return records;
  }, forceRefresh);
}

// User functions
export async function fetchUsers(forceRefresh = false) {
  return fetchWithCache('users', users, async () => {
    const userInfoValue = get(userInfo);
    const userList = await pb.collection('users').getFullList({
      sort: 'name'
    });
    return userList.filter(user => user.id !== userInfoValue.id);
  }, forceRefresh);
}

// Hour logs functions
export async function fetchHourLogs(forceRefresh = false) {
  return fetchWithCache('hourLogs', hourLogs, async () => {
    const records = await pb.collection('log').getFullList({
      sort: '-dato',
      expand: 'kunde'
    });
    return records;
  }, forceRefresh);
}

// Cache management functions
export function clearCache(cacheKey = null) {
  if (cacheKey) {
    dataCache[cacheKey] = { data: null, timestamp: 0, ttl: dataCache[cacheKey].ttl };
    console.log(`Cleared cache for ${cacheKey}`);
  } else {
    // Clear all cache
    Object.keys(dataCache).forEach(key => {
      dataCache[key] = { data: null, timestamp: 0, ttl: dataCache[key].ttl };
    });
    console.log('Cleared all cache');
  }
}

export function invalidateCache(cacheKey) {
  if (dataCache[cacheKey]) {
    dataCache[cacheKey].timestamp = 0;
    console.log(`Invalidated cache for ${cacheKey}`);
  }
}

// Refresh specific data
export function refreshData(dataType) {
  switch (dataType) {
    case 'customers':
      return fetchCustomers(true);
    case 'messages':
      return fetchMessages(true);
    case 'readMessages':
      return fetchReadMessages(true);
    case 'oldMessages':
      return fetchOldMessages(true);
    case 'users':
      return fetchUsers(true);
    case 'hourLogs':
      return fetchHourLogs(true);
    default:
      console.warn(`Unknown data type: ${dataType}`);
  }
}

// Create operations that invalidate cache
export async function createMessage(messageData) {
  try {
    const result = await pb.collection('messages').create(messageData);
    
    // Invalidate message caches
    invalidateCache('messages');
    invalidateCache('readMessages');
    
    return result;
  } catch (error) {
    console.error('Error creating message:', error);
    throw error;
  }
}

export async function markMessageAsRead(messageId) {
  try {
    const result = await pb.collection('messages').update(messageId, { read: true });
    
    // Invalidate and refresh message caches
    invalidateCache('messages');
    invalidateCache('readMessages');
    
    // Refresh both to keep UI in sync
    await Promise.all([
      fetchMessages(true),
      fetchReadMessages(true)
    ]);
    
    return result;
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
}

export async function archiveMessage(messageId) {
  try {
    const result = await pb.collection('messages').update(messageId, { archived: true });
    
    // Invalidate message caches
    invalidateCache('messages');
    invalidateCache('readMessages');
    
    // Refresh to keep UI in sync
    await Promise.all([
      fetchMessages(true),
      fetchReadMessages(true)
    ]);
    
    return result;
  } catch (error) {
    console.error('Error archiving message:', error);
    throw error;
  }
}

export async function createHourLog(logData) {
  try {
    const result = await pb.collection('log').create(logData);
    
    // Invalidate hour logs cache
    invalidateCache('hourLogs');
    
    return result;
  } catch (error) {
    console.error('Error creating hour log:', error);
    throw error;
  }
}