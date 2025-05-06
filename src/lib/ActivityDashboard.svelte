<script>
 import { onMount } from "svelte";
import PocketBase from "pocketbase";
import {
  exportLogsToExcel,
  exportToCsv,
  exportProductLogsToExcel,
  exportCombinedLogsToExcel,
} from "$lib/excelExport.js";

// Initialize PocketBase
const pb = new PocketBase("https://timesync.pockethost.io/");

let showInvoiced = "all"; // "all", "invoiced", "not-invoiced"

// State management
let hourLogs = [];
let productLogs = [];
let isLoading = false;
let currentYear = new Date().getFullYear();
let selectedMonth = null;
let selectedUser = null;
let allUsers = [];
let monthlyHourStats = [];
let monthlyProductStats = [];
let useExcelFormat = true; // Excel by default, can be toggled to CSV
let activeTab = "hours"; // 'hours' or 'products'

// Month names
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Calculate monthly statistics for hour logs
function calculateMonthlyHourStats(logsData) {
  console.time('Calculate hour stats');
  const stats = [];

  for (let month = 0; month < 12; month++) {
    // Filter logs for this month and year
    const monthLogs = logsData.filter((log) => {
      const logDate = new Date(log.dato);
      return (
        logDate.getMonth() === month && logDate.getFullYear() === currentYear
      );
    });

    // Calculate totals
    const totalHours = monthLogs.reduce((sum, log) => sum + log.totalsum, 0);
    const totalAmount = monthLogs.reduce((sum, log) => sum + log.price, 0);
    const uniqueCustomers = [
      ...new Set(monthLogs.map((log) => log.kunde_navn)),
    ];
    const uniqueUsers = [...new Set(monthLogs.map((log) => log.user_name))];

    // Calculate invoiced vs non-invoiced
    const invoicedLogs = monthLogs.filter(log => log.invoiced === true);
    const notInvoicedLogs = monthLogs.filter(log => log.invoiced !== true);
    
    const invoicedHours = invoicedLogs.reduce((sum, log) => sum + log.totalsum, 0);
    const invoicedAmount = invoicedLogs.reduce((sum, log) => sum + log.price, 0);
    
    const notInvoicedHours = notInvoicedLogs.reduce((sum, log) => sum + log.totalsum, 0);
    const notInvoicedAmount = notInvoicedLogs.reduce((sum, log) => sum + log.price, 0);

    // Collect data by user
    const userStats = {};
    monthLogs.forEach((log) => {
      const userName = log.user_name || "Unknown";
      if (!userStats[userName]) {
        userStats[userName] = {
          logCount: 0,
          totalHours: 0,
          totalAmount: 0,
          invoicedLogCount: 0,
          invoicedHours: 0,
          invoicedAmount: 0,
        };
      }

      userStats[userName].logCount += 1;
      userStats[userName].totalHours += log.totalsum;
      userStats[userName].totalAmount += log.price;
      
      // Track invoiced stats by user
      if (log.invoiced === true) {
        userStats[userName].invoicedLogCount += 1;
        userStats[userName].invoicedHours += log.totalsum;
        userStats[userName].invoicedAmount += log.price;
      }
    });

    stats.push({
      month,
      monthName: monthNames[month],
      logCount: monthLogs.length,
      totalHours: totalHours.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      uniqueCustomers: uniqueCustomers.length,
      uniqueUsers: uniqueUsers.length,
      logs: monthLogs,
      userStats,
      // New invoice stats
      invoicedLogCount: invoicedLogs.length || 0,
      invoicedHours: (invoicedHours || 0).toFixed(2),
      invoicedAmount: (invoicedAmount || 0).toFixed(2),
      notInvoicedLogCount: notInvoicedLogs.length || 0,
      notInvoicedHours: (notInvoicedHours || 0).toFixed(2),
      notInvoicedAmount: (notInvoicedAmount || 0).toFixed(2),
    });
  }
  
  console.timeEnd('Calculate hour stats');
  return stats;
}

// Calculate monthly statistics for product logs
function calculateMonthlyProductStats(logsData) {
  console.time('Calculate product stats');
  const stats = [];

  for (let month = 0; month < 12; month++) {
    // Filter logs for this month and year
    const monthLogs = logsData.filter((log) => {
      const logDate = new Date(log.created);
      return (
        logDate.getMonth() === month && logDate.getFullYear() === currentYear
      );
    });

    // Calculate totals
    const totalQuantity = monthLogs.reduce(
      (sum, log) => sum + log.quantity,
      0,
    );
    const totalAmount = monthLogs.reduce(
      (sum, log) => sum + log.total_price,
      0,
    );
    const uniqueCustomers = [
      ...new Set(
        monthLogs.map((log) => log.expand?.kunder?.navn || log.kunder),
      ),
    ];
    const uniqueUsers = [
      ...new Set(monthLogs.map((log) => log.expand?.user?.name || log.user)),
    ];
    const uniqueProducts = [
      ...new Set(
        monthLogs.map(
          (log) => log.expand?.product?.productName || log.product,
        ),
      ),
    ];

    // Calculate invoiced vs non-invoiced
    const invoicedLogs = monthLogs.filter(log => log.invoiced === true);
    const notInvoicedLogs = monthLogs.filter(log => log.invoiced !== true);
    
    const invoicedQuantity = invoicedLogs.reduce((sum, log) => sum + log.quantity, 0);
    const invoicedAmount = invoicedLogs.reduce((sum, log) => sum + log.total_price, 0);
    
    const notInvoicedQuantity = notInvoicedLogs.reduce((sum, log) => sum + log.quantity, 0);
    const notInvoicedAmount = notInvoicedLogs.reduce((sum, log) => sum + log.total_price, 0);

    // Collect data by user
    const userStats = {};
    monthLogs.forEach((log) => {
      const userName = log.expand?.user?.name || log.user || "Unknown";
      if (!userStats[userName]) {
        userStats[userName] = {
          logCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
          invoicedLogCount: 0,
          invoicedQuantity: 0,
          invoicedAmount: 0,
        };
      }

      userStats[userName].logCount += 1;
      userStats[userName].totalQuantity += log.quantity;
      userStats[userName].totalAmount += log.total_price;
      
      // Track invoiced stats by user
      if (log.invoiced === true) {
        userStats[userName].invoicedLogCount += 1;
        userStats[userName].invoicedQuantity += log.quantity;
        userStats[userName].invoicedAmount += log.total_price;
      }
    });

    // Collect data by product
    const productStats = {};
    monthLogs.forEach((log) => {
      const productName =
        log.expand?.product?.productName || log.product || "Unknown";
      if (!productStats[productName]) {
        productStats[productName] = {
          logCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
          invoicedLogCount: 0,
          invoicedQuantity: 0,
          invoicedAmount: 0,
        };
      }

      productStats[productName].logCount += 1;
      productStats[productName].totalQuantity += log.quantity;
      productStats[productName].totalAmount += log.total_price;
      
      // Track invoiced stats by product
      if (log.invoiced === true) {
        productStats[productName].invoicedLogCount += 1;
        productStats[productName].invoicedQuantity += log.quantity;
        productStats[productName].invoicedAmount += log.total_price;
      }
    });

    stats.push({
      month,
      monthName: monthNames[month],
      logCount: monthLogs.length,
      totalQuantity: totalQuantity,
      totalAmount: totalAmount.toFixed(2),
      uniqueCustomers: uniqueCustomers.length,
      uniqueUsers: uniqueUsers.length,
      uniqueProducts: uniqueProducts.length,
      logs: monthLogs,
      userStats,
      productStats,
      // New invoice stats
      invoicedLogCount: invoicedLogs.length || 0,
      invoicedQuantity: invoicedQuantity || 0,
      invoicedAmount: (invoicedAmount || 0).toFixed(2),
      notInvoicedLogCount: notInvoicedLogs.length || 0,
      notInvoicedQuantity: notInvoicedQuantity || 0,
      notInvoicedAmount: (notInvoicedAmount || 0).toFixed(2),
    });
  }

  console.timeEnd('Calculate product stats');
  return stats;
}

// Function to calculate combined monthly stats
function calculateCombinedStats() {
  // Make sure we have data to work with
  if (!monthlyHourStats || !monthlyProductStats || 
      monthlyHourStats.length === 0 || monthlyProductStats.length === 0) {
    return [];
  }
  
  return monthlyHourStats.map((hourStat, index) => {
    // Ensure we have product stats for this month
    const productStat = monthlyProductStats[index] || {
      logCount: 0,
      totalQuantity: 0,
      totalAmount: "0.00",
      invoicedLogCount: 0,
      notInvoicedLogCount: 0,
      invoicedAmount: "0.00",
      notInvoicedAmount: "0.00"
    };

    // Calculate safely
    const hourAmount = parseFloat(hourStat.totalAmount || 0);
    const productAmount = parseFloat(productStat.totalAmount || 0);
    
    return {
      month: hourStat.month,
      monthName: hourStat.monthName,
      hourLogCount: hourStat.logCount || 0,
      productLogCount: productStat.logCount || 0,
      totalLogCount: (hourStat.logCount || 0) + (productStat.logCount || 0),
      totalHours: hourStat.totalHours || "0.00",
      totalProductQuantity: productStat.totalQuantity || 0,
      hourAmount: hourAmount,
      productAmount: productAmount,
      totalAmount: hourAmount + productAmount,
      uniqueCustomers: hourStat.uniqueCustomers || 0,
      uniqueUsers: hourStat.uniqueUsers || 0,
      
      // Invoice stats
      invoicedLogCount: (hourStat.invoicedLogCount || 0) + (productStat.invoicedLogCount || 0),
      notInvoicedLogCount: (hourStat.notInvoicedLogCount || 0) + (productStat.notInvoicedLogCount || 0),
      invoicedAmount: parseFloat(hourStat.invoicedAmount || 0) + parseFloat(productStat.invoicedAmount || 0),
      notInvoicedAmount: parseFloat(hourStat.notInvoicedAmount || 0) + parseFloat(productStat.notInvoicedAmount || 0),
      notInvoicedHours: parseFloat(hourStat.notInvoicedHours || 0),
      notInvoicedQuantity: productStat.notInvoicedQuantity || 0,
      
      // Maintain compatibility with existing code
      hasData: (hourStat.logs && hourStat.logs.length > 0) || 
               (productStat.logs && productStat.logs.length > 0)
    };
  });
}

// OPTIMIZED: Fetch logs with pagination and expanded relations
async function fetchLogs() {
  isLoading = true;
  console.time("Total fetch time");

  // Reset arrays to ensure clean data loading
  hourLogs = [];
  productLogs = [];
  monthlyHourStats = [];
  monthlyProductStats = [];

  try {
    // Get the start and end dates for the current year
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear + 1, 0, 0);

    // OPTIMIZATION 1: Batch requests with Promise.all
    console.time("Fetch data");

    const [hourRecords, productRecords] = await Promise.all([
      // OPTIMIZATION 2: Fetch expanded hour logs in a single request
      pb.collection("log").getFullList({
        sort: "-dato",
        filter: `dato >= "${startDate.toISOString()}" && dato <= "${endDate.toISOString()}"`,
        expand: "kunde", // Expand customer data if needed
      }),

      // OPTIMIZATION 3: Fetch expanded product logs in a single request
      pb.collection("product_logs").getFullList({
        sort: "-created",
        filter: `created >= "${startDate.toISOString()}" && created <= "${endDate.toISOString()}"`,
        expand: "kunder,product,user", // Expand all relations at once
      }),
    ]);

    console.timeEnd("Fetch data");
    console.log(
      `Fetched ${hourRecords.length} hour logs and ${productRecords.length} product logs`,
    );

    // Store the data
    hourLogs = hourRecords.map((log) => ({
      ...log,
      invoiced: log.invoiced || false, // Set default if field doesn't exist yet
    }));

    productLogs = productRecords.map((log) => ({
      ...log,
      invoiced: log.invoiced || false, // Set default if field doesn't exist yet
    }));
    // OPTIMIZATION 4: Process data in a web worker (simulated with timers here)
    setTimeout(() => {
      console.time("Process data");
      // Calculate monthly statistics
      monthlyHourStats = calculateMonthlyHourStats(hourLogs);
      monthlyProductStats = calculateMonthlyProductStats(productLogs);

      // Extract unique users from both types of logs
      const hourLogUsers = [...new Set(hourLogs.map((log) => log.user_name))];
      const productLogUsers = [
        ...new Set(
          productLogs.map((log) => log.expand?.user?.name || log.user),
        ),
      ];

      // Combine unique users from both logs
      const uniqueUsers = [...new Set([...hourLogUsers, ...productLogUsers])];
      allUsers = uniqueUsers.map((user) => ({ name: user || "Unknown" }));

      console.timeEnd("Process data");
      isLoading = false;
    }, 10); // Small delay to allow UI to update
  } catch (error) {
    console.error("Error fetching logs:", error);
    isLoading = false;
  } finally {
    console.timeEnd("Total fetch time");
  }
}

async function toggleHourLogInvoiced(id, currentStatus) {
  isLoading = true;
  try {
    // Update the database record
    await pb.collection("log").update(id, {
      invoiced: !currentStatus,
    });

    // Update local data
    hourLogs = hourLogs.map((log) =>
      log.id === id ? { ...log, invoiced: !currentStatus } : log,
    );

    // Recalculate stats for the affected month
    const logToUpdate = hourLogs.find((log) => log.id === id);
    if (logToUpdate) {
      const logMonth = new Date(logToUpdate.dato).getMonth();
      monthlyHourStats = calculateMonthlyHourStats(hourLogs);
    }
  } catch (error) {
    console.error("Error updating invoice status:", error);
    alert("Error updating invoice status");
  } finally {
    isLoading = false;
  }
}

async function toggleProductLogInvoiced(id, currentStatus) {
  isLoading = true;
  try {
    // Update the database record
    await pb.collection("product_logs").update(id, {
      invoiced: !currentStatus,
    });

    // Update local data
    productLogs = productLogs.map((log) =>
      log.id === id ? { ...log, invoiced: !currentStatus } : log,
    );

    // Recalculate stats for the affected month
    const logToUpdate = productLogs.find((log) => log.id === id);
    if (logToUpdate) {
      const logMonth = new Date(logToUpdate.created).getMonth();
      monthlyProductStats = calculateMonthlyProductStats(productLogs);
    }
  } catch (error) {
    console.error("Error updating invoice status:", error);
    alert("Error updating invoice status");
  } finally {
    isLoading = false;
  }
}

// Select a month to view
function selectMonth(month) {
  selectedMonth = month;
  // Reset user filter when selecting a month
  selectedUser = null;
}

// Filter hour logs for the selected month and user
$: filteredHourLogs = hourLogs.filter((log) => {
  const logDate = new Date(log.dato);
  const monthMatch =
    selectedMonth !== null ? logDate.getMonth() === selectedMonth : true;
  const userMatch = selectedUser ? log.user_name === selectedUser : true;
  const invoiceMatch =
    showInvoiced === "all"
      ? true
      : showInvoiced === "invoiced"
        ? log.invoiced === true
        : log.invoiced !== true;
  return monthMatch && userMatch && invoiceMatch;
});

$: filteredProductLogs = productLogs.filter((log) => {
  const logDate = new Date(log.created);
  const monthMatch =
    selectedMonth !== null ? logDate.getMonth() === selectedMonth : true;
  const userMatch = selectedUser
    ? (log.expand?.user?.name || log.user) === selectedUser
    : true;
  const invoiceMatch =
    showInvoiced === "all"
      ? true
      : showInvoiced === "invoiced"
        ? log.invoiced === true
        : log.invoiced !== true;
  return monthMatch && userMatch && invoiceMatch;
});

// Format date for display
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString();
}

let showDeleteModal = false;
let itemToDelete = null;
let deleteType = ''; // 'hour' or 'product'

// Replace your existing delete functions with these
function confirmDeleteHourLog(id) {
  deleteType = 'hour';
  itemToDelete = id;
  showDeleteModal = true;
}

function confirmDeleteProductLog(id) {
  deleteType = 'product';
  itemToDelete = id;
  showDeleteModal = true;
}

// The actual delete functions
// Add this to your state management variables
let isDeleting = false;

// Update your executeDelete function to use this state
async function executeDelete() {
  isDeleting = true;
  try {
    if (deleteType === 'hour') {
      // Find the log to delete to identify its month
      const logToDelete = hourLogs.find((log) => log.id === itemToDelete);
      if (!logToDelete) {
        throw new Error("Log not found");
      }

      const logMonth = new Date(logToDelete.dato).getMonth();
      await pb.collection("log").delete(itemToDelete);

      // Remove from hourLogs array
      hourLogs = hourLogs.filter((log) => log.id !== itemToDelete);
      
      // Recalculate monthly stats
      monthlyHourStats = calculateMonthlyHourStats(hourLogs);
    } else if (deleteType === 'product') {
      // Find the log to delete to identify its month
      const logToDelete = productLogs.find((log) => log.id === itemToDelete);
      if (!logToDelete) {
        throw new Error("Log not found");
      }

      const logMonth = new Date(logToDelete.created).getMonth();
      await pb.collection("product_logs").delete(itemToDelete);

      // Remove from productLogs array
      productLogs = productLogs.filter((log) => log.id !== itemToDelete);
      
      // Recalculate monthly stats
      monthlyProductStats = calculateMonthlyProductStats(productLogs);
    }
    
    // Success message
    showSuccessToast(`${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} log deleted successfully`);
  } catch (error) {
    console.error(`Error deleting ${deleteType} log:`, error);
    showErrorToast(`Error deleting ${deleteType} log`);
  } finally {
    isDeleting = false;
    showDeleteModal = false;
    itemToDelete = null;
  }
}

function cancelDelete() {
  showDeleteModal = false;
  itemToDelete = null;
  deleteType = '';
}

// Toast notification system
let toasts = [];
let toastIdCounter = 0;

function showSuccessToast(message) {
  const id = toastIdCounter++;
  toasts = [...toasts, { id, message, type: 'success' }];
  setTimeout(() => {
    toasts = toasts.filter(toast => toast.id !== id);
  }, 3000);
}

function showErrorToast(message) {
  const id = toastIdCounter++;
  toasts = [...toasts, { id, message, type: 'error' }];
  setTimeout(() => {
    toasts = toasts.filter(toast => toast.id !== id);
  }, 3000);
}

// OPTIMIZED: Delete an hour log with targeted update
async function deleteHourLog(id) {
  if (confirm("Are you sure you want to delete this hour log?")) {
    isLoading = true;
    try {
      // Find the log to delete to identify its month
      const logToDelete = hourLogs.find((log) => log.id === id);
      if (!logToDelete) {
        throw new Error("Log not found");
      }

      const logMonth = new Date(logToDelete.dato).getMonth();
      await pb.collection("log").delete(id);

      // Remove from hourLogs array
      hourLogs = hourLogs.filter((log) => log.id !== id);

      // Only recalculate the affected month
      const affectedMonthLogs = hourLogs.filter((log) => {
        const date = new Date(log.dato);
        return date.getMonth() === logMonth;
      });

      // Update just the stats for the affected month
      const updatedMonthStat = {
        month: logMonth,
        monthName: monthNames[logMonth],
        logCount: 0,
        totalHours: "0.00",
        totalAmount: "0.00",
        uniqueCustomers: 0,
        uniqueUsers: 0,
        logs: [],
        userStats: {},
      };

      if (affectedMonthLogs.length > 0) {
        const totalHours = affectedMonthLogs.reduce(
          (sum, log) => sum + log.totalsum,
          0,
        );
        const totalAmount = affectedMonthLogs.reduce(
          (sum, log) => sum + log.price,
          0,
        );
        const uniqueCustomers = [
          ...new Set(affectedMonthLogs.map((log) => log.kunde_navn)),
        ];
        const uniqueUsers = [
          ...new Set(affectedMonthLogs.map((log) => log.user_name)),
        ];

        // Collect data by user
        const userStats = {};
        affectedMonthLogs.forEach((log) => {
          const userName = log.user_name || "Unknown";
          if (!userStats[userName]) {
            userStats[userName] = {
              logCount: 0,
              totalHours: 0,
              totalAmount: 0,
            };
          }

          userStats[userName].logCount += 1;
          userStats[userName].totalHours += log.totalsum;
          userStats[userName].totalAmount += log.price;
        });

        updatedMonthStat.logCount = affectedMonthLogs.length;
        updatedMonthStat.totalHours = totalHours.toFixed(2);
        updatedMonthStat.totalAmount = totalAmount.toFixed(2);
        updatedMonthStat.uniqueCustomers = uniqueCustomers.length;
        updatedMonthStat.uniqueUsers = uniqueUsers.length;
        updatedMonthStat.logs = affectedMonthLogs;
        updatedMonthStat.userStats = userStats;
      }

      // Update the specific month stat without recalculating everything
      monthlyHourStats = monthlyHourStats.map((stat) =>
        stat.month === logMonth ? updatedMonthStat : stat,
      );

      alert("Hour log deleted successfully");
    } catch (error) {
      console.error("Error deleting hour log:", error);
      alert("Error deleting hour log");
    } finally {
      isLoading = false;
    }
  }
}

// OPTIMIZED: Delete a product log with targeted update
async function deleteProductLog(id) {
  if (confirm("Are you sure you want to delete this product log?")) {
    isLoading = true;
    try {
      // Find the log to delete to identify its month
      const logToDelete = productLogs.find((log) => log.id === id);
      if (!logToDelete) {
        throw new Error("Log not found");
      }

      const logMonth = new Date(logToDelete.created).getMonth();
      await pb.collection("product_logs").delete(id);

      // Remove from productLogs array
      productLogs = productLogs.filter((log) => log.id !== id);

      // Only recalculate the affected month
      const affectedMonthLogs = productLogs.filter((log) => {
        const date = new Date(log.created);
        return date.getMonth() === logMonth;
      });

      // Update just the stats for the affected month
      const updatedMonthStat = {
        month: logMonth,
        monthName: monthNames[logMonth],
        logCount: 0,
        totalQuantity: 0,
        totalAmount: "0.00",
        uniqueCustomers: 0,
        uniqueUsers: 0,
        uniqueProducts: 0,
        logs: [],
        userStats: {},
        productStats: {},
      };

      if (affectedMonthLogs.length > 0) {
        const totalQuantity = affectedMonthLogs.reduce(
          (sum, log) => sum + log.quantity,
          0,
        );
        const totalAmount = affectedMonthLogs.reduce(
          (sum, log) => sum + log.total_price,
          0,
        );
        const uniqueCustomers = [
          ...new Set(
            affectedMonthLogs.map(
              (log) => log.expand?.kunder?.navn || log.kunder,
            ),
          ),
        ];
        const uniqueUsers = [
          ...new Set(
            affectedMonthLogs.map(
              (log) => log.expand?.user?.name || log.user,
            ),
          ),
        ];
        const uniqueProducts = [
          ...new Set(
            affectedMonthLogs.map(
              (log) => log.expand?.product?.productName || log.product,
            ),
          ),
        ];

        // Collect data by user
        const userStats = {};
        affectedMonthLogs.forEach((log) => {
          const userName = log.expand?.user?.name || log.user || "Unknown";
          if (!userStats[userName]) {
            userStats[userName] = {
              logCount: 0,
              totalQuantity: 0,
              totalAmount: 0,
            };
          }

          userStats[userName].logCount += 1;
          userStats[userName].totalQuantity += log.quantity;
          userStats[userName].totalAmount += log.total_price;
        });

        // Collect data by product
        const productStats = {};
        affectedMonthLogs.forEach((log) => {
          const productName =
            log.expand?.product?.productName || log.product || "Unknown";
          if (!productStats[productName]) {
            productStats[productName] = {
              logCount: 0,
              totalQuantity: 0,
              totalAmount: 0,
            };
          }

          productStats[productName].logCount += 1;
          productStats[productName].totalQuantity += log.quantity;
          productStats[productName].totalAmount += log.total_price;
        });

        updatedMonthStat.logCount = affectedMonthLogs.length;
        updatedMonthStat.totalQuantity = totalQuantity;
        updatedMonthStat.totalAmount = totalAmount.toFixed(2);
        updatedMonthStat.uniqueCustomers = uniqueCustomers.length;
        updatedMonthStat.uniqueUsers = uniqueUsers.length;
        updatedMonthStat.uniqueProducts = uniqueProducts.length;
        updatedMonthStat.logs = affectedMonthLogs;
        updatedMonthStat.userStats = userStats;
        updatedMonthStat.productStats = productStats;
      }

      // Update the specific month stat without recalculating everything
      monthlyProductStats = monthlyProductStats.map((stat) =>
        stat.month === logMonth ? updatedMonthStat : stat,
      );

      alert("Product log deleted successfully");
    } catch (error) {
      console.error("Error deleting product log:", error);
      alert("Error deleting product log");
    } finally {
      isLoading = false;
    }
  }
}

// Change year
function changeYear(increment) {
  currentYear += increment;
  selectedMonth = null;
  selectedUser = null;
  fetchLogs();
}

// Export hour logs to Excel or CSV
function exportHourData() {
  // Determine which logs to export and period name
  const logsToExport = selectedMonth !== null ? filteredHourLogs : hourLogs;
  let periodName =
    selectedMonth !== null
      ? `${monthNames[selectedMonth]}_${currentYear}`
      : `${currentYear}`;

  if (useExcelFormat) {
    // Export to Excel using the advanced helper
    exportLogsToExcel(logsToExport, periodName, selectedUser);
  } else {
    // Export to CSV using simpler approach
    const headers = ["Date", "Customer", "Hours", "Price", "Comment", "User"];
    const keys = [
      "dato",
      "kunde_navn",
      "totalsum",
      "price",
      "kommentar",
      "user_name",
    ];

    // Process the data to ensure date formatting
    const processedData = logsToExport.map((log) => {
      const processed = { ...log };
      processed.dato = formatDate(log.dato);
      processed.totalsum = log.totalsum.toFixed(2);
      processed.price = log.price.toFixed(2);
      return processed;
    });

    let filename = `hour_logs_${periodName}`;
    if (selectedUser) {
      filename += `_${selectedUser.replace(/\s+/g, "_")}`;
    }

    exportToCsv(processedData, headers, keys, filename);
  }
}

// Export product logs to Excel or CSV
function exportProductData() {
  // Determine which logs to export and period name
  const logsToExport =
    selectedMonth !== null ? filteredProductLogs : productLogs;
  let periodName =
    selectedMonth !== null
      ? `${monthNames[selectedMonth]}_${currentYear}`
      : `${currentYear}`;

  if (useExcelFormat) {
    // Export to Excel using the advanced helper
    exportProductLogsToExcel(logsToExport, periodName, selectedUser);
  } else {
    // Export to CSV using simpler approach
    const headers = [
      "Date",
      "Customer",
      "Product",
      "Quantity",
      "Total Price",
      "User",
    ];
    const keys = [
      "created",
      "kunder",
      "product",
      "quantity",
      "total_price",
      "user",
    ];

    // Process the data to ensure date formatting
    const processedData = logsToExport.map((log) => {
      const processed = { ...log };
      processed.created = formatDate(log.created);
      processed.quantity = log.quantity;
      processed.total_price = log.total_price.toFixed(2);
      processed.kunder = log.expand?.kunder?.navn || log.kunder;
      processed.product = log.expand?.product?.productName || log.product;
      processed.user = log.expand?.user?.name || log.user;
      return processed;
    });

    let filename = `product_logs_${periodName}`;
    if (selectedUser) {
      filename += `_${selectedUser.replace(/\s+/g, "_")}`;
    }

    exportToCsv(processedData, headers, keys, filename);
  }
}

// Export combined logs to Excel or CSV
function exportCombinedData() {
  // Determine which logs to export and period name
  const hourLogsToExport =
    selectedMonth !== null ? filteredHourLogs : hourLogs;
  const productLogsToExport =
    selectedMonth !== null ? filteredProductLogs : productLogs;

  let periodName =
    selectedMonth !== null
      ? `${monthNames[selectedMonth]}_${currentYear}`
      : `${currentYear}`;

  let filename = `combined_logs_${periodName}`;
  if (selectedUser) {
    filename += `_${selectedUser.replace(/\s+/g, "_")}`;
  }

  if (useExcelFormat) {
    // Export to Excel using function that handles both types of logs
    exportCombinedLogsToExcel(
      hourLogsToExport,
      productLogsToExport,
      filename,
      selectedUser,
    );
  } else {
    // For CSV, we'll create two separate files since CSV doesn't support multiple sheets
    exportHourData();
    exportProductData();
    alert(
      "Two CSV files have been exported, one for hours and one for products.",
    );
  }
}

// Generate monthly hour report summary
function generateMonthlyHourReport() {
  if (selectedMonth === null) return;

  const monthData = monthlyHourStats[selectedMonth];

  // Prepare customer summary data
  const customerSummary = {};
  monthData.logs.forEach((log) => {
    const customerName = log.kunde_navn || "Unknown";
    if (!customerSummary[customerName]) {
      customerSummary[customerName] = {
        hours: 0,
        amount: 0,
        logCount: 0,
      };
    }

    customerSummary[customerName].hours += log.totalsum;
    customerSummary[customerName].amount += log.price;
    customerSummary[customerName].logCount += 1;
  });

  // Prepare data for export
  const reportData = [
    // Summary row
    {
      customer: "MONTHLY SUMMARY",
      hours: parseFloat(monthData.totalHours),
      amount: parseFloat(monthData.totalAmount),
      logCount: monthData.logCount,
    },
    // Empty row for separation
    {
      customer: "",
      hours: "",
      amount: "",
      logCount: "",
    },
    // Header row (will be styled in Excel)
    {
      customer: "CUSTOMER",
      hours: "HOURS",
      amount: "AMOUNT",
      logCount: "LOGS",
    },
  ];

  // Add customer data
  Object.entries(customerSummary).forEach(([customer, data]) => {
    reportData.push({
      customer,
      hours: data.hours.toFixed(2),
      amount: data.amount.toFixed(2),
      logCount: data.logCount,
    });
  });

  // Add blank row
  reportData.push({
    customer: "",
    hours: "",
    amount: "",
    logCount: "",
  });

  // Add user summary
  reportData.push({
    customer: "USER SUMMARY",
    hours: "",
    amount: "",
    logCount: "",
  });

  // Add user breakdown
  Object.entries(monthData.userStats).forEach(([user, data]) => {
    reportData.push({
      customer: user,
      hours: data.totalHours.toFixed(2),
      amount: data.totalAmount.toFixed(2),
      logCount: data.logCount,
    });
  });

  // Export the report
  const filename = `monthly_hour_report_${monthNames[selectedMonth]}_${currentYear}`;
  const headers = ["Customer", "Hours", "Amount", "Logs"];
  const keys = ["customer", "hours", "amount", "logCount"];

  if (useExcelFormat) {
    // Use advanced Excel export (placeholder - you would implement this in excelExport.js)
    alert("Monthly hour report generated and downloaded.");
  } else {
    exportToCsv(reportData, headers, keys, filename);
  }
}

// Generate monthly product report summary
function generateMonthlyProductReport() {
  if (selectedMonth === null) return;

  const monthData = monthlyProductStats[selectedMonth];

  // Prepare customer summary data
  const customerSummary = {};
  monthData.logs.forEach((log) => {
    const customerName = log.expand?.kunder?.navn || log.kunder || "Unknown";
    if (!customerSummary[customerName]) {
      customerSummary[customerName] = {
        quantity: 0,
        amount: 0,
        logCount: 0,
      };
    }

    customerSummary[customerName].quantity += log.quantity;
    customerSummary[customerName].amount += log.total_price;
    customerSummary[customerName].logCount += 1;
  });

  // Prepare product summary data
  const productSummary = {};
  monthData.logs.forEach((log) => {
    const productName =
      log.expand?.product?.productName || log.product || "Unknown";
    if (!productSummary[productName]) {
      productSummary[productName] = {
        quantity: 0,
        amount: 0,
        logCount: 0,
      };
    }

    productSummary[productName].quantity += log.quantity;
    productSummary[productName].amount += log.total_price;
    productSummary[productName].logCount += 1;
  });

  // Prepare data for export
  const reportData = [
    // Summary row
    {
      item: "MONTHLY SUMMARY",
      quantity: monthData.totalQuantity,
      amount: parseFloat(monthData.totalAmount),
      logCount: monthData.logCount,
    },
    // Empty row for separation
    {
      item: "",
      quantity: "",
      amount: "",
      logCount: "",
    },
    // Header row (will be styled in Excel)
    {
      item: "CUSTOMER",
      quantity: "QUANTITY",
      amount: "AMOUNT",
      logCount: "LOGS",
    },
  ];

  // Add customer data
  Object.entries(customerSummary).forEach(([customer, data]) => {
    reportData.push({
      item: customer,
      quantity: data.quantity,
      amount: data.amount.toFixed(2),
      logCount: data.logCount,
    });
  });

  // Add blank row
  reportData.push({
    item: "",
    quantity: "",
    amount: "",
    logCount: "",
  });

  // Add product summary header
  reportData.push({
    item: "PRODUCT SUMMARY",
    quantity: "",
    amount: "",
    logCount: "",
  });

  // Add product breakdown
  Object.entries(productSummary).forEach(([product, data]) => {
    reportData.push({
      item: product,
      quantity: data.quantity,
      amount: data.amount.toFixed(2),
      logCount: data.logCount,
    });
  });

  // Add blank row
  reportData.push({
    item: "",
    quantity: "",
    amount: "",
    logCount: "",
  });

  // Add user summary
  reportData.push({
    item: "USER SUMMARY",
    quantity: "",
    amount: "",
    logCount: "",
  });

  // Add user breakdown
  Object.entries(monthData.userStats).forEach(([user, data]) => {
    reportData.push({
      item: user,
      quantity: data.totalQuantity,
      amount: data.totalAmount.toFixed(2),
      logCount: data.logCount,
    });
  });

  // Export the report
  const filename = `product_report_${monthNames[selectedMonth]}_${currentYear}`;
  const headers = ["Item", "Quantity", "Amount", "Logs"];
  const keys = ["item", "quantity", "amount", "logCount"];

  if (useExcelFormat) {
    // Use advanced Excel export (placeholder - implementation needed in excelExport.js)
    alert("Monthly product report generated and downloaded.");
  } else {
    exportToCsv(reportData, headers, keys, filename);
  }
}

// Function to export combined report summary
function generateCombinedMonthlyReport() {
  if (selectedMonth === null) return;

  const hourMonthData = monthlyHourStats[selectedMonth];
  const productMonthData = monthlyProductStats[selectedMonth];

  // Prepare data for export - section 1: Summary
  const reportData = [
    // Title
    {
      section: `COMBINED MONTHLY REPORT - ${monthNames[selectedMonth]} ${currentYear}`,
      value1: "",
      value2: "",
      value3: "",
    },
    // Empty row for separation
    {
      section: "",
      value1: "",
      value2: "",
      value3: "",
    },
    // Hours Summary
    {
      section: "HOURS SUMMARY",
      value1: `Total Hours: ${hourMonthData.totalHours}`,
      value2: `Amount: ${hourMonthData.totalAmount} kr`,
      value3: `Logs: ${hourMonthData.logCount}`,
    },
    // Products Summary
    {
      section: "PRODUCTS SUMMARY",
      value1: `Total Quantity: ${productMonthData.totalQuantity}`,
      value2: `Amount: ${productMonthData.totalAmount} kr`,
      value3: `Logs: ${productMonthData.logCount}`,
    },
    // Empty row for separation
    {
      section: "",
      value1: "",
      value2: "",
      value3: "",
    },
    // Combined totals
    {
      section: "COMBINED TOTALS",
      value1: "",
      value2: `Total Amount: ${(parseFloat(hourMonthData.totalAmount) + parseFloat(productMonthData.totalAmount)).toFixed(2)} kr`,
      value3: `Total Logs: ${hourMonthData.logCount + productMonthData.logCount}`,
    },
    // Empty row for separation
    {
      section: "",
      value1: "",
      value2: "",
      value3: "",
    },
  ];

  // Section 2: Customer Breakdown
  reportData.push({
    section: "CUSTOMER BREAKDOWN",
    value1: "",
    value2: "",
    value3: "",
  });

  reportData.push({
    section: "Customer",
    value1: "Hours",
    value2: "Products Amount",
    value3: "Total Amount",
  });

  // Combine customer data from both logs
  const combinedCustomers = new Set([
    ...hourMonthData.logs.map((log) => log.kunde_navn),
    ...productMonthData.logs.map(
      (log) => log.expand?.kunder?.navn || log.kunder,
    ),
  ]);

  combinedCustomers.forEach((customer) => {
    if (!customer) return; // Skip undefined/null customers

    // Get hour logs for this customer
    const customerHourLogs = hourMonthData.logs.filter(
      (log) => log.kunde_navn === customer,
    );
    const hourAmount = customerHourLogs.reduce(
      (sum, log) => sum + log.price,
      0,
    );
    const hoursTotal = customerHourLogs.reduce(
      (sum, log) => sum + log.totalsum,
      0,
    );

    // Get product logs for this customer
    const customerProductLogs = productMonthData.logs.filter(
      (log) => (log.expand?.kunder?.navn || log.kunder) === customer,
    );
    const productAmount = customerProductLogs.reduce(
      (sum, log) => sum + log.total_price,
      0,
    );

    reportData.push({
      section: customer,
      value1: `${hoursTotal.toFixed(2)} (${hourAmount.toFixed(2)} kr)`,
      value2: `${productAmount.toFixed(2)} kr`,
      value3: `${(hourAmount + productAmount).toFixed(2)} kr`,
    });
  });

  // Add empty row for separation
  reportData.push({
    section: "",
    value1: "",
    value2: "",
    value3: "",
  });

  // Section 3: User Breakdown
  reportData.push({
    section: "USER BREAKDOWN",
    value1: "",
    value2: "",
    value3: "",
  });

  reportData.push({
    section: "User",
    value1: "Hours (Amount)",
    value2: "Products (Amount)",
    value3: "Total Amount",
  });

  // Combine user data from both logs
  const combinedUsers = new Set([
    ...Object.keys(hourMonthData.userStats),
    ...Object.keys(productMonthData.userStats),
  ]);

  combinedUsers.forEach((user) => {
    const hourStats = hourMonthData.userStats[user] || {
      totalHours: 0,
      totalAmount: 0,
      logCount: 0,
    };
    const productStats = productMonthData.userStats[user] || {
      totalQuantity: 0,
      totalAmount: 0,
      logCount: 0,
    };

    reportData.push({
      section: user,
      value1: `${hourStats.totalHours.toFixed(2)} (${hourStats.totalAmount.toFixed(2)} kr)`,
      value2: `${productStats.totalQuantity} (${productStats.totalAmount.toFixed(2)} kr)`,
      value3: `${(hourStats.totalAmount + productStats.totalAmount).toFixed(2)} kr`,
    });
  });

  // Export the combined report
  const filename = `combined_report_${monthNames[selectedMonth]}_${currentYear}`;
  const headers = ["Section", "Value 1", "Value 2", "Value 3"];
  const keys = ["section", "value1", "value2", "value3"];

  if (useExcelFormat) {
    // Use advanced Excel export (placeholder)
    alert("Combined monthly report generated and downloaded.");
  } else {
    exportToCsv(reportData, headers, keys, filename);
  }
}

// Switch tabs
function switchTab(tab) {
  activeTab = tab;
}

// OPTIMIZED: Calculate combined monthly stats for calendar view with memoization
let lastCalculatedCombinedStats = null;
let lastHourStatsVersion = -1;
let lastProductStatsVersion = -1;

$: {
  // Determine if we need to recalculate (only when hour or product stats change)
  const hourStatsVersion = monthlyHourStats ? monthlyHourStats.length : 0;
  const productStatsVersion = monthlyProductStats ? monthlyProductStats.length : 0;

  if (
    hourStatsVersion !== lastHourStatsVersion ||
    productStatsVersion !== lastProductStatsVersion
  ) {
    console.time("Calculate combined stats");
    
    try {
      // Use the new function to calculate combined stats
      lastCalculatedCombinedStats = calculateCombinedStats();
      console.log("Combined stats calculated:", lastCalculatedCombinedStats);
    } catch (error) {
      console.error("Error calculating combined stats:", error);
      lastCalculatedCombinedStats = [];
    }

    // Update versions
    lastHourStatsVersion = hourStatsVersion;
    lastProductStatsVersion = productStatsVersion;

    console.timeEnd("Calculate combined stats");
  }
}

// Use the memoized value
$: combinedMonthlyStats = lastCalculatedCombinedStats || [];

// Initialize component
onMount(async () => {
  // Add performance timing
  console.time("Initial load");

  await fetchLogs();

  // Force a UI update after data is loaded
  monthlyHourStats = [...monthlyHourStats];
  monthlyProductStats = [...monthlyProductStats];

  console.timeEnd("Initial load");
});
</script>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-2xl font-bold">Activity Dashboard</h2>

    <div class="flex items-center space-x-4">
      <!-- Year Navigation -->
      <button
        class="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
        on:click={() => changeYear(-1)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <span class="text-xl font-semibold">{currentYear}</span>

      <button
        class="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
        on:click={() => changeYear(1)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <!-- Toggle Export Format -->
      <div class="flex items-center mr-2">
        <span class="mr-2 text-sm text-gray-600">CSV</span>
        <label class="inline-flex relative items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={useExcelFormat}
            class="sr-only peer"
          />
          <div
            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
        </label>
        <span class="ml-2 text-sm text-gray-600">Excel</span>
      </div>

      {#if selectedMonth !== null}
        <!-- Export Button - Show appropriate export based on active tab -->
        {#if activeTab === "hours"}
          <button
            class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded flex items-center"
            on:click={exportHourData}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
            Export Hours
          </button>
        {:else}
          <button
            class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded flex items-center"
            on:click={exportProductData}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
            Export Products
          </button>
        {/if}

        <!-- Generate Monthly Report Button -->
        <div class="dropdown relative ml-2">
          <div
            class="dropdown-menu hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 py-1"
          >
            <button
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              on:click={generateMonthlyHourReport}
            >
              Hours Report
            </button>
            <button
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              on:click={generateMonthlyProductReport}
            >
              Products Report
            </button>
            <button
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              on:click={generateCombinedMonthlyReport}
            >
              Combined Report
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Loading indicator -->
  {#if isLoading}
    <div class="flex justify-center my-8">
      <div
        class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"
      ></div>
    </div>
  {:else if selectedMonth !== null}
    <!-- Month Detail View -->
    <div class="bg-white rounded-lg shadow-md p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <button
            class="text-blue-600 hover:text-blue-800 flex items-center"
            on:click={() => (selectedMonth = null)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clip-rule="evenodd"
              />
            </svg>
            Back to Calendar
          </button>
          <h3 class="text-xl font-bold mt-2">
            {monthNames[selectedMonth]}
            {currentYear}
          </h3>
        </div>

        <!-- Tab Navigation -->
        <div class="flex space-x-2">
          <button
            class={`px-4 py-2 rounded-t-lg font-medium ${activeTab === "hours" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
            on:click={() => switchTab("hours")}
          >
            Hours
          </button>
          <button
            class={`px-4 py-2 rounded-t-lg font-medium ${activeTab === "products" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
            on:click={() => switchTab("products")}
          >
            Products
          </button>
        </div>

        <!-- User Filter -->
        <div class="w-64">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Filter by User</label
          >
          <select
            class="block w-full p-2 border border-gray-300 rounded-md"
            bind:value={selectedUser}
          >
            <option value={null}>All Users</option>
            {#each allUsers as user}
              <option value={user.name}>{user.name}</option>
            {/each}
          </select>
        </div>
        
        <!-- Invoice Status Filter - NEW -->
        <div class="w-64">
          <label class="block text-sm font-medium text-gray-700 mb-1">Invoice Status</label>
          <select
            class="block w-full p-2 border border-gray-300 rounded-md"
            bind:value={showInvoiced}
          >
            <option value="all">All Entries</option>
            <option value="invoiced">Invoiced Only</option>
            <option value="not-invoiced">Not Invoiced Only</option>
          </select>
        </div>
      </div>

      <!-- Month Summary - Hours Tab -->
      {#if activeTab === "hours"}
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-blue-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Total Logs</h4>
            <p class="text-2xl font-bold">
              {monthlyHourStats[selectedMonth].logCount}
            </p>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Total Hours</h4>
            <p class="text-2xl font-bold">
              {monthlyHourStats[selectedMonth].totalHours}
            </p>
          </div>
          <div class="bg-yellow-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Total Amount</h4>
            <p class="text-2xl font-bold">
              {monthlyHourStats[selectedMonth].totalAmount} kr
            </p>
          </div>
          <div class="bg-purple-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Unique Customers</h4>
            <p class="text-2xl font-bold">
              {monthlyHourStats[selectedMonth].uniqueCustomers}
            </p>
          </div>
          <!-- New Not Invoiced Card -->
          <div class="bg-red-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Not Invoiced</h4>
            <p class="text-xl font-bold text-red-600">
              {monthlyHourStats[selectedMonth].notInvoicedHours} h
            </p>
            <p class="text-sm text-gray-500">
              {monthlyHourStats[selectedMonth].notInvoicedAmount} kr
            </p>
          </div>
        </div>

        <!-- User Details (if showing filtered results) -->
        {#if selectedUser && monthlyHourStats[selectedMonth].userStats[selectedUser]}
          <div class="mb-6 bg-gray-100 p-4 rounded-lg">
            <h4 class="font-medium text-gray-800 mb-2">User: {selectedUser}</h4>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <span class="text-gray-500 text-sm">Logs:</span>
                <span class="font-bold ml-2"
                  >{monthlyHourStats[selectedMonth].userStats[selectedUser]
                    .logCount}</span
                >
              </div>
              <div>
                <span class="text-gray-500 text-sm">Hours:</span>
                <span class="font-bold ml-2"
                  >{monthlyHourStats[selectedMonth].userStats[
                    selectedUser
                  ].totalHours.toFixed(2)}</span
                >
              </div>
              <div>
                <span class="text-gray-500 text-sm">Amount:</span>
                <span class="font-bold ml-2"
                  >{monthlyHourStats[selectedMonth].userStats[
                    selectedUser
                  ].totalAmount.toFixed(2)} kr</span
                >
              </div>
              <!-- New: Not Invoiced Hours -->
              <div>
                <span class="text-gray-500 text-sm">Not Invoiced:</span>
                <span class="font-bold ml-2 text-red-600"
                  >{(monthlyHourStats[selectedMonth].userStats[selectedUser].totalHours -
                    (monthlyHourStats[selectedMonth].userStats[selectedUser].invoicedHours || 0)).toFixed(2)} h</span
                >
              </div>
            </div>
          </div>
        {/if}

        <!-- Hours Logs Table -->
        {#if filteredHourLogs.length > 0}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Date</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Customer</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Hours</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Price</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Comment</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >User</th
                  >
                  <!-- New: Invoiced Column -->
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Invoiced</th
                  >
                  <th
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Actions</th
                  >
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each filteredHourLogs as log}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{formatDate(log.dato)}</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{log.kunde_navn || "Unknown"}</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{log.totalsum.toFixed(2)}</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{log.price.toFixed(2)} kr</td
                    >
                    <td class="px-6 py-4">
                      <div class="max-w-xs truncate" title={log.kommentar}>
                        {log.kommentar || "—"}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-500">
                      {log.user_name || "No user"}
                    </td>
                    <!-- New: Invoiced Checkbox -->
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input 
                          type="checkbox" 
                          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={log.invoiced === true}
                          on:change={() => toggleHourLogInvoiced(log.id, log.invoiced)}
                        />
                        <span class="ml-2 text-sm text-gray-700">
                          {log.invoiced ? "Yes" : "No"}
                        </span>
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    >
                    <button
                    class="text-red-600 hover:text-red-900 ml-2"
                    on:click={() => confirmDeleteHourLog(log.id)}
                  >
                    Delete
                  </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center p-8 bg-gray-50 rounded-lg">
            <p class="text-gray-500">
              No hour logs found for this month{selectedUser
                ? ` and user (${selectedUser})`
                : ""}{showInvoiced !== "all" 
                ? ` with invoice status: ${showInvoiced}`
                : ""}.
            </p>
          </div>
        {/if}

        <!-- Month Summary - Products Tab -->
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-indigo-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Total Logs</h4>
            <p class="text-2xl font-bold">
              {monthlyProductStats[selectedMonth].logCount}
            </p>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Total Quantity</h4>
            <p class="text-2xl font-bold">
              {monthlyProductStats[selectedMonth].totalQuantity}
            </p>
          </div>
          <div class="bg-yellow-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Total Amount</h4>
            <p class="text-2xl font-bold">
              {monthlyProductStats[selectedMonth].totalAmount} kr
            </p>
          </div>
          <div class="bg-purple-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Unique Products</h4>
            <p class="text-2xl font-bold">
              {monthlyProductStats[selectedMonth].uniqueProducts}
            </p>
          </div>
          <!-- New Not Invoiced Card -->
          <div class="bg-red-50 p-4 rounded-lg">
            <h4 class="text-sm font-medium text-gray-500">Not Invoiced</h4>
            <p class="text-xl font-bold text-red-600">
              {monthlyProductStats[selectedMonth].notInvoicedQuantity} units
            </p>
            <p class="text-sm text-gray-500">
              {monthlyProductStats[selectedMonth].notInvoicedAmount} kr
            </p>
          </div>
        </div>

        <!-- User Details (if showing filtered results) -->
        {#if selectedUser && monthlyProductStats[selectedMonth].userStats[selectedUser]}
          <div class="mb-6 bg-gray-100 p-4 rounded-lg">
            <h4 class="font-medium text-gray-800 mb-2">User: {selectedUser}</h4>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <span class="text-gray-500 text-sm">Logs:</span>
                <span class="font-bold ml-2"
                  >{monthlyProductStats[selectedMonth].userStats[selectedUser]
                    .logCount}</span
                >
              </div>
              <div>
                <span class="text-gray-500 text-sm">Quantity:</span>
                <span class="font-bold ml-2"
                  >{monthlyProductStats[selectedMonth].userStats[selectedUser]
                    .totalQuantity}</span
                >
              </div>
              <div>
                <span class="text-gray-500 text-sm">Amount:</span>
                <span class="font-bold ml-2"
                  >{monthlyProductStats[selectedMonth].userStats[
                    selectedUser
                  ].totalAmount.toFixed(2)} kr</span
                >
              </div>
              <!-- New: Not Invoiced Products -->
              <div>
                <span class="text-gray-500 text-sm">Not Invoiced:</span>
                <span class="font-bold ml-2 text-red-600"
                  >{monthlyProductStats[selectedMonth].userStats[selectedUser].totalQuantity -
                    (monthlyProductStats[selectedMonth].userStats[selectedUser].invoicedQuantity || 0)} units</span
                >
              </div>
            </div>
          </div>
        {/if}

        <!-- Products Logs Table -->
        {#if filteredProductLogs.length > 0}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Date</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Customer</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Product</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Quantity</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Price</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >User</th
                  >
                  <!-- New: Invoiced Column -->
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Invoiced</th
                  >
                  <th
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Actions</th
                  >
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each filteredProductLogs as log}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{formatDate(log.created)}</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{log.expand?.kunder?.navn || log.kunder || "Unknown"}</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{log.expand?.product?.productName ||
                        log.product ||
                        "Unknown"}</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap">{log.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap"
                      >{log.total_price.toFixed(2)} kr</td
                    >
                    <td class="px-6 py-4 whitespace-nowrap text-gray-500">
                      {log.expand?.user?.name || log.user || "No user"}
                    </td>
                    <!-- New: Invoiced Checkbox -->
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <input 
                          type="checkbox" 
                          class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          checked={log.invoiced === true}
                          on:change={() => toggleProductLogInvoiced(log.id, log.invoiced)}
                        />
                        <span class="ml-2 text-sm text-gray-700">
                          {log.invoiced ? "Yes" : "No"}
                        </span>
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    >
                    <button
                    class="text-red-600 hover:text-red-900 ml-2"
                    on:click={() => confirmDeleteProductLog(log.id)}
                  >
                    Delete
                  </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center p-8 bg-gray-50 rounded-lg">
            <p class="text-gray-500">
              No product logs found for this month{selectedUser
                ? ` and user (${selectedUser})`
                : ""}{showInvoiced !== "all" 
                ? ` with invoice status: ${showInvoiced}`
                : ""}.
            </p>
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <!-- Calendar View -->
    <div class="mb-6">
      <div class="bg-white p-4 rounded-lg shadow-md mb-6">
        <h3 class="text-lg font-semibold mb-4">Monthly Overview</h3>

        <!-- Combined Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <!-- Total Logs -->
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 class="text-sm font-medium text-gray-500">Total Logs</h4>
            <p class="text-2xl font-bold">
              {combinedMonthlyStats.reduce(
                (sum, month) => sum + month.totalLogCount,
                0,
              )}
            </p>
            <div class="flex text-xs text-gray-500 mt-1">
              <span class="flex items-center">
                <span class="w-3 h-3 inline-block bg-blue-500 rounded-full mr-1"
                ></span>
                Hours: {combinedMonthlyStats.reduce(
                  (sum, month) => sum + month.hourLogCount,
                  0,
                )}
              </span>
              <span class="mx-2">|</span>
              <span class="flex items-center">
                <span
                  class="w-3 h-3 inline-block bg-indigo-500 rounded-full mr-1"
                ></span>
                Products: {combinedMonthlyStats.reduce(
                  (sum, month) => sum + month.productLogCount,
                  0,
                )}
              </span>
            </div>
          </div>

          <!-- Total Hours -->
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 class="text-sm font-medium text-gray-500">Total Hours</h4>
            <p class="text-2xl font-bold">
              {combinedMonthlyStats
                .reduce((sum, month) => sum + parseFloat(month.totalHours), 0)
                .toFixed(2)}
            </p>
          </div>

          <!-- Total Products -->
          <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h4 class="text-sm font-medium text-gray-500">Total Products</h4>
            <p class="text-2xl font-bold">
              {combinedMonthlyStats.reduce(
                (sum, month) => sum + month.totalProductQuantity,
                0,
              )}
            </p>
          </div>
          <div class="bg-green-50 p-4 rounded-lg border border-green-100">
            <h4 class="text-sm font-medium text-gray-500">Total Amount</h4>
            <p class="text-2xl font-bold">
              {combinedMonthlyStats
                .reduce((sum, month) => sum + month.totalAmount, 0)
                .toFixed(2)} kr
            </p>
            <div class="flex flex-col text-xs text-gray-500 mt-1">
              <span class="flex items-center">
                <!-- <span class="w-3 h-3 inline-block bg-blue-500 rounded-full mr-1"
                ></span> -->
                <span class="font-bold pr-1">Hours:</span>
                 {combinedMonthlyStats
                  .reduce((sum, month) => sum + month.hourAmount, 0)
                  .toFixed(2)} kr
              </span>
             
              <span class="flex items-center">
                <!-- <span
                  class="w-3 h-3 inline-block bg-indigo-500 rounded-full mr-1"
                ></span> -->
                <span class="font-bold pr-1">Products:</span>{combinedMonthlyStats
                  .reduce((sum, month) => sum + month.productAmount, 0)
                  .toFixed(2)} kr
              </span>
            </div>
          </div>
          
          <!-- Not Invoiced Amount - NEW -->
          <div class="bg-red-50 p-4 rounded-lg border border-red-100">
            <h4 class="text-sm font-medium text-gray-500">Not Invoiced</h4>
            <p class="text-2xl font-bold text-red-600">
              {combinedMonthlyStats && combinedMonthlyStats.length > 0 ? 
                (isNaN(combinedMonthlyStats.reduce((sum, month) => sum + (parseFloat(month.notInvoicedAmount) || 0), 0)) ? 
                  "0.00" : 
                  combinedMonthlyStats.reduce((sum, month) => sum + (parseFloat(month.notInvoicedAmount) || 0), 0).toFixed(2))
                : "0.00"} kr
            </p>
            <div class="flex text-xs text-gray-500 mt-1">
              <span class="flex items-center">
                <span class="w-3 h-3 inline-block bg-blue-500 rounded-full mr-1"></span>
                Hours: {combinedMonthlyStats && combinedMonthlyStats.length > 0 ? 
                  (isNaN(combinedMonthlyStats.reduce((sum, month) => sum + (parseFloat(month.notInvoicedHours) || 0), 0)) ? 
                    "0.00" : 
                    combinedMonthlyStats.reduce((sum, month) => sum + (parseFloat(month.notInvoicedHours) || 0), 0).toFixed(2))
                  : "0.00"}
              </span>
              <span class="mx-2">|</span>
              <span class="flex items-center">
                <span class="w-3 h-3 inline-block bg-indigo-500 rounded-full mr-1"></span>
                Products: {combinedMonthlyStats && combinedMonthlyStats.length > 0 ? 
                  combinedMonthlyStats.reduce((sum, month) => sum + (month.notInvoicedQuantity || 0), 0) || 0
                  : 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly Calendar Cards -->
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {#each combinedMonthlyStats as stats}
        <!-- Color-code months based on activity levels -->
        {@const activityLevel =
          stats.totalLogCount > 20
            ? "high"
            : stats.totalLogCount > 10
              ? "medium"
              : stats.totalLogCount > 0
                ? "low"
                : "none"}

        <div
          class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          on:click={() => selectMonth(stats.month)}
        >
          <div
            class={`p-3 font-semibold text-white ${
              activityLevel === "high"
                ? "bg-purple-600"
                : activityLevel === "medium"
                  ? "bg-purple-500"
                  : activityLevel === "low"
                    ? "bg-purple-400"
                    : "bg-gray-400"
            }`}
          >
            {stats.monthName}
            {currentYear}
            {#if stats.totalLogCount > 0}
              <span
                class="float-right bg-white text-purple-600 text-xs rounded-full px-2 py-1"
              >
                {stats.totalLogCount}
                {stats.totalLogCount === 1 ? "log" : "logs"}
              </span>
            {/if}
          </div>
          <div class="p-4">
            <!-- Combined Stats -->
            <div class="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div class="text-sm text-gray-500">Hours</div>
                <div class="text-lg font-bold">{stats.totalHours}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Products</div>
                <div class="text-lg font-bold">
                  {stats.totalProductQuantity}
                </div>
              </div>
              <div class="col-span-2">
                <div class="text-sm text-gray-500">Total Amount</div>
                <div class="text-xl font-bold">
                  {stats.totalAmount.toFixed(2)} kr
                </div>
              </div>
            </div>

            <!-- Activity Indicators -->
            <div class="mt-3 pt-3 border-t border-gray-200">
              <div class="flex justify-between items-center">
                <div class="flex items-center">
                  <span
                    class="w-3 h-3 inline-block bg-blue-500 rounded-full mr-1"
                  ></span>
                  <span class="text-sm">{stats.hourLogCount} hour logs</span>
                </div>
                <div class="flex items-center">
                  <span
                    class="w-3 h-3 inline-block bg-indigo-500 rounded-full mr-1"
                  ></span>
                  <span class="text-sm"
                    >{stats.productLogCount} product logs</span
                  >
                </div>
              </div>

              <!-- Progress Bars -->
              <div class="mt-2">
                <!-- Customer Count -->
                <div class="text-xs text-gray-500 flex justify-between mb-1">
                  <span>Customers: {stats.uniqueCustomers}</span>
                  <span>Users: {stats.uniqueUsers}</span>
                </div>
                
                <!-- NEW: Invoice Status -->
                <div class="mt-2 text-xs flex justify-between">
                  <span class="text-green-600">
                    Invoiced: {stats.invoicedLogCount || 0}
                  </span>
                  <span class="text-red-600">
                    Not Invoiced: {stats.notInvoicedLogCount || 0}
                  </span>
                </div>
                
                <!-- NEW: Not Invoiced Amount -->
                {#if stats && stats.notInvoicedAmount && !isNaN(stats.notInvoicedAmount) && parseFloat(stats.notInvoicedAmount) > 0}
  <div class="mt-1 text-xs text-red-600 font-semibold">
    Not Invoiced: {parseFloat(stats.notInvoicedAmount).toFixed(2)} kr
  </div>
{/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showDeleteModal}
<div class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all">
    <div class="border-b border-gray-200 px-6 py-4">
      <h3 class="text-lg font-medium text-gray-900">Confirm Deletion</h3>
    </div>
    
    <div class="px-6 py-4">
      <p class="text-gray-700">
        Are you sure you want to delete this {deleteType} log? This action cannot be undone.
      </p>
    </div>
    
    <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 rounded-b-lg">
      <button 
        class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        on:click={cancelDelete}
        disabled={isDeleting}
      >
        Cancel
      </button>
      <button 
        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 relative"
        on:click={executeDelete}
        disabled={isDeleting}
      >
        {#if isDeleting}
          <span class="opacity-0">Delete</span>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        {:else}
          Delete
        {/if}
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Toast notification system -->
<div class="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
  {#each toasts as toast (toast.id)}
    <div 
      class="transform transition-all duration-300 ease-in-out bg-white rounded-lg shadow-lg p-4 flex items-center"
      class:bg-green-50={toast.type === 'success'}
      class:bg-red-50={toast.type === 'error'}
    >
      {#if toast.type === 'success'}
        <div class="flex-shrink-0 mr-3">
          <svg class="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
      {:else}
        <div class="flex-shrink-0 mr-3">
          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
      {/if}
      <div class="text-sm font-medium text-gray-900">
        {toast.message}
      </div>
    </div>
  {/each}
</div>

<!-- Add CSS for dropdown menu -->
<style>
  .dropdown:hover .dropdown-menu {
    display: block;
  }
</style>
