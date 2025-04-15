import { writable } from 'svelte/store';
import PocketBase from 'pocketbase';

// Initialize PocketBase
const pb = new PocketBase('https://timesync.pockethost.io/');

// Create stores
export const customers = writable([]);
export const hourLogs = writable([]);
export const isLoading = writable(false);
export const error = writable(null);

// Fetch all customers
export async function fetchCustomers() {
  isLoading.set(true);
  error.set(null);
  
  try {
    const records = await pb.collection('kunder').getFullList();
    customers.set(records);
    return records;
  } catch (err) {
    console.error('Error fetching customers:', err);
    error.set(err.message);
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Fetch all hour logs
export async function fetchHourLogs() {
  isLoading.set(true);
  error.set(null);
  
  try {
    // Force expand: 'kunde' to ensure we get the customer data
    const records = await pb.collection('log').getFullList({
      sort: '-dato',
      expand: 'kunde', // This is crucial - it expands the customer data
    });
    
    console.log('Fetched logs with expanded data:', records);
    
    // Check if we have properly expanded records
    records.forEach((record, index) => {
      if (!record.expand?.kunde && record.kunde) {
        console.warn(`Record #${index} (ID: ${record.id}) has kunde ID but no expanded data:`, record);
      }
    });
    
    hourLogs.set(records);
    return records;
  } catch (err) {
    console.error('Error fetching hour logs:', err);
    error.set(err.message);
    return [];
  } finally {
    isLoading.set(false);
  }
}

// Create a new hour log
export async function createHourLog(data) {
  isLoading.set(true);
  error.set(null);
  
  try {
    // Ensure the kunde field is properly set - it should be a string ID
    if (!data.kunde) {
      throw new Error('Customer ID is required');
    }
    
    console.log('Creating log with customer ID:', data.kunde);
    
    // Create the record first
    const record = await pb.collection('log').create(data);
    console.log('Created record:', record);
    
    // Then fetch it WITH expanded relation
    const expandedRecord = await pb.collection('log').getOne(record.id, {
      expand: 'kunde'
    });
    console.log('Expanded record:', expandedRecord);
    
    // Update the store with the expanded record
    hourLogs.update(logs => [expandedRecord, ...logs]);
    
    return expandedRecord;
  } catch (err) {
    console.error('Error creating hour log:', err);
    error.set(err.message);
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Delete an hour log
export async function deleteHourLog(id) {
  isLoading.set(true);
  error.set(null);
  
  try {
    await pb.collection('log').delete(id);
    hourLogs.update(logs => logs.filter(log => log.id !== id));
  } catch (err) {
    console.error('Error deleting hour log:', err);
    error.set(err.message);
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Update an hour log
export async function updateHourLog(id, data) {
  isLoading.set(true);
  error.set(null);
  
  try {
    const record = await pb.collection('log').update(id, data);
    hourLogs.update(logs => logs.map(log => log.id === id ? record : log));
    return record;
  } catch (err) {
    console.error('Error updating hour log:', err);
    error.set(err.message);
    throw err;
  } finally {
    isLoading.set(false);
  }
}

// Minutes to decimal conversion helper (based on the image table)
export function minutesToDecimal(minutes) {
  // Conversion table as shown in the image
  const conversionTable = {
    1: 0.02, 2: 0.03, 3: 0.05, 4: 0.07, 5: 0.08, 6: 0.10, 
    7: 0.12, 8: 0.13, 9: 0.15, 10: 0.17, 11: 0.18, 12: 0.20,
    13: 0.22, 14: 0.23, 15: 0.25, 16: 0.27, 17: 0.28, 18: 0.30,
    19: 0.32, 20: 0.33, 21: 0.35, 22: 0.37, 23: 0.38, 24: 0.40,
    25: 0.42, 26: 0.43, 27: 0.45, 28: 0.47, 29: 0.48, 30: 0.50,
    31: 0.52, 32: 0.53, 33: 0.55, 34: 0.57, 35: 0.58, 36: 0.60,
    37: 0.62, 38: 0.63, 39: 0.65, 40: 0.67, 41: 0.68, 42: 0.70,
    43: 0.72, 44: 0.73, 45: 0.75, 46: 0.77, 47: 0.78, 48: 0.80,
    49: 0.82, 50: 0.83, 51: 0.85, 52: 0.87, 53: 0.88, 54: 0.90,
    55: 0.92, 56: 0.93, 57: 0.95, 58: 0.97, 59: 0.98, 60: 1.00
  };
  
  // Calculate hours and remaining minutes
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  // Get decimal value for remaining minutes
  const decimalPart = conversionTable[remainingMinutes] || 0;
  
  // Return total hours in decimal
  return hours + decimalPart;
}

// Calculate total hours between two time points (in minutes)
export function calculateTotalHours(startMinutes, endMinutes) {
  if (startMinutes > endMinutes) {
    // Work spans midnight
    return minutesToDecimal((24 * 60) - startMinutes + endMinutes);
  } else {
    return minutesToDecimal(endMinutes - startMinutes);
  }
}

// Convert time string (HH:MM) to minutes
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
}

// Convert minutes to time string (HH:MM)
export function minutesToTimeString(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}