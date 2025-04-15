// Import file-saver correctly (CommonJS to ES module)
import pkg from 'file-saver';
const { saveAs } = pkg;

// Import Excel.js if you're using it
import * as XLSX from 'xlsx';

/**
 * Export logs to CSV format
 * @param {Array} data - The data to export
 * @param {Array} headers - Column headers
 * @param {Array} keys - Object keys to extract from data
 * @param {String} filename - Name for the exported file
 */
export function exportToCsv(data, headers, keys, filename) {
  // Create CSV content
  let csvContent = headers.join(',') + '\n';
  
  // Add data rows
  data.forEach(item => {
    const row = keys.map(key => {
      const value = item[key] !== undefined ? item[key] : '';
      // Escape commas and quotes in the value
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvContent += row.join(',') + '\n';
  });
  
  // Create blob and save
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
}

/**
 * Export hour logs to Excel format
 * @param {Array} logs - The logs to export
 * @param {String} periodName - Period name for the filename
 * @param {String} selectedUser - Optional user filter
 */
export function exportLogsToExcel(logs, periodName, selectedUser) {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Process the data to ensure date formatting
  const processedData = logs.map(log => {
    const processed = {...log};
    processed.dato = formatDate(log.dato);
    processed.totalsum = log.totalsum.toFixed(2);
    processed.price = log.price.toFixed(2);
    return {
      'Date': processed.dato,
      'Customer': processed.kunde_navn || '',
      'Hours': processed.totalsum,
      'Price': processed.price,
      'Comment': processed.kommentar || '',
      'User': processed.user_name || ''
    };
  });
  
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(processedData);
  
  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 25 }, // Customer
    { wch: 10 }, // Hours
    { wch: 10 }, // Price
    { wch: 30 }, // Comment
    { wch: 15 }  // User
  ];
  ws['!cols'] = colWidths;
  
  // Build filename
  let filename = `hour_logs_${periodName}`;
  if (selectedUser) {
    filename += `_${selectedUser.replace(/\s+/g, '_')}`;
  }
  
  // Add worksheet to workbook and save
  XLSX.utils.book_append_sheet(wb, ws, 'Hour Logs');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export product logs to Excel format
 * @param {Array} logs - The logs to export
 * @param {String} periodName - Period name for the filename
 * @param {String} selectedUser - Optional user filter
 */
export function exportProductLogsToExcel(logs, periodName, selectedUser) {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Process the data to ensure date formatting
  const processedData = logs.map(log => {
    const processed = {...log};
    processed.created = formatDate(log.created);
    processed.quantity = log.quantity;
    processed.total_price = log.total_price.toFixed(2);
    
    return {
      'Date': processed.created,
      'Customer': log.expand?.kunder?.navn || log.kunder || '',
      'Product': log.expand?.product?.productName || log.product || '',
      'Quantity': processed.quantity,
      'Total Price': processed.total_price,
      'User': log.expand?.user?.name || log.user || ''
    };
  });
  
  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(processedData);
  
  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 25 }, // Customer
    { wch: 25 }, // Product
    { wch: 10 }, // Quantity
    { wch: 12 }, // Total Price
    { wch: 15 }  // User
  ];
  ws['!cols'] = colWidths;
  
  // Build filename
  let filename = `product_logs_${periodName}`;
  if (selectedUser) {
    filename += `_${selectedUser.replace(/\s+/g, '_')}`;
  }
  
  // Add worksheet to workbook and save
  XLSX.utils.book_append_sheet(wb, ws, 'Product Logs');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export combined hour and product logs to Excel format with multiple sheets
 * @param {Array} hourLogs - The hour logs to export
 * @param {Array} productLogs - The product logs to export
 * @param {String} filename - Name for the exported file
 * @param {String} selectedUser - Optional user filter
 */
export function exportCombinedLogsToExcel(hourLogs, productLogs, filename, selectedUser) {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Process hour logs data
  const processedHourLogs = hourLogs.map(log => {
    return {
      'Date': formatDate(log.dato),
      'Customer': log.kunde_navn || '',
      'Hours': log.totalsum.toFixed(2),
      'Price': log.price.toFixed(2),
      'Comment': log.kommentar || '',
      'User': log.user_name || ''
    };
  });
  
  // Process product logs data
  const processedProductLogs = productLogs.map(log => {
    return {
      'Date': formatDate(log.created),
      'Customer': log.expand?.kunder?.navn || log.kunder || '',
      'Product': log.expand?.product?.productName || log.product || '',
      'Quantity': log.quantity,
      'Total Price': log.total_price.toFixed(2),
      'User': log.expand?.user?.name || log.user || ''
    };
  });
  
  // Generate summary data
  const hourTotal = hourLogs.reduce((sum, log) => sum + log.price, 0);
  const productTotal = productLogs.reduce((sum, log) => sum + log.total_price, 0);
  
  const summaryData = [
    { 'Category': 'Hour Logs', 'Count': hourLogs.length, 'Total Amount': hourTotal.toFixed(2) + ' kr' },
    { 'Category': 'Product Logs', 'Count': productLogs.length, 'Total Amount': productTotal.toFixed(2) + ' kr' },
    { 'Category': 'Combined', 'Count': hourLogs.length + productLogs.length, 'Total Amount': (hourTotal + productTotal).toFixed(2) + ' kr' }
  ];
  
  // Add summary by customer
  summaryData.push({ 'Category': '', 'Count': '', 'Total Amount': '' });
  summaryData.push({ 'Category': 'CUSTOMER BREAKDOWN', 'Count': '', 'Total Amount': '' });
  
  // Create a map of customers with their hour and product totals
  const customerMap = new Map();
  
  // Add hour logs to customer map
  hourLogs.forEach(log => {
    const customer = log.kunde_navn || 'Unknown';
    if (!customerMap.has(customer)) {
      customerMap.set(customer, { hours: 0, hourAmount: 0, productAmount: 0 });
    }
    const customerData = customerMap.get(customer);
    customerData.hours += log.totalsum;
    customerData.hourAmount += log.price;
  });
  
  // Add product logs to customer map
  productLogs.forEach(log => {
    const customer = log.expand?.kunder?.navn || log.kunder || 'Unknown';
    if (!customerMap.has(customer)) {
      customerMap.set(customer, { hours: 0, hourAmount: 0, productAmount: 0 });
    }
    const customerData = customerMap.get(customer);
    customerData.productAmount += log.total_price;
  });
  
  // Add customer data to summary
  customerMap.forEach((data, customer) => {
    summaryData.push({
      'Category': customer,
      'Count': `Hours: ${data.hours.toFixed(2)}`,
      'Total Amount': `${(data.hourAmount + data.productAmount).toFixed(2)} kr`
    });
  });
  
  // Create all three worksheets
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsHours = XLSX.utils.json_to_sheet(processedHourLogs);
  const wsProducts = XLSX.utils.json_to_sheet(processedProductLogs);
  
  // Set column widths for summary
  const summaryColWidths = [
    { wch: 30 }, // Category
    { wch: 20 }, // Count
    { wch: 20 }  // Total Amount
  ];
  wsSummary['!cols'] = summaryColWidths;
  
  // Set column widths for hours
  const hourColWidths = [
    { wch: 12 }, // Date
    { wch: 25 }, // Customer
    { wch: 10 }, // Hours
    { wch: 10 }, // Price
    { wch: 30 }, // Comment
    { wch: 15 }  // User
  ];
  wsHours['!cols'] = hourColWidths;
  
  // Set column widths for products
  const productColWidths = [
    { wch: 12 }, // Date
    { wch: 25 }, // Customer
    { wch: 25 }, // Product
    { wch: 10 }, // Quantity
    { wch: 12 }, // Total Price
    { wch: 15 }  // User
  ];
  wsProducts['!cols'] = productColWidths;
  
  // Add all sheets to workbook
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsHours, 'Hour Logs');
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Product Logs');
  
  // Save workbook
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Helper to format date
 * @param {String} isoString - ISO date string
 * @returns {String} - Formatted date
 */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString();
}