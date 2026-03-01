const express = require('express');
const router = express.Router();
const db = require('../database');

const LOW_STOCK_THRESHOLD = 5;

// Get comprehensive analytics dashboard
router.get('/', async (req, res) => {
  try {
    const [
      revenue,
      servicePerformance,
      teamProductivity,
      customerInsights,
      operationalMetrics
    ] = await Promise.all([
      getRevenueAnalytics(),
      getServicePerformance(),
      getTeamProductivity(),
      getCustomerInsights(),
      getOperationalMetrics()
    ]);

    res.json({
      revenue,
      servicePerformance,
      teamProductivity,
      customerInsights,
      operationalMetrics
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

async function getRevenueAnalytics() {
  const summary = await db.get(`
    SELECT
      COALESCE(SUM(total), 0) AS totalRevenue,
      COALESCE(SUM(amount_paid), 0) AS totalPaid,
      COALESCE(SUM(total) - SUM(amount_paid), 0) AS totalOutstanding,
      COUNT(*) AS invoiceCount,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paidInvoiceCount,
      ROUND(COALESCE(AVG(total), 0), 1) AS averageInvoiceValue
    FROM invoices
  `);

  const monthlyRevenue = await db.query(`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COALESCE(SUM(total), 0) AS revenue,
      COALESCE(SUM(amount_paid), 0) AS paid,
      COUNT(*) AS count
    FROM invoices
    WHERE created_at >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
  `);

  return {
    totalRevenue: summary.totalRevenue,
    totalPaid: summary.totalPaid,
    totalOutstanding: summary.totalOutstanding,
    invoiceCount: summary.invoiceCount,
    paidInvoiceCount: summary.paidInvoiceCount,
    averageInvoiceValue: summary.averageInvoiceValue,
    monthlyRevenue
  };
}

async function getServicePerformance() {
  const summary = await db.get(`
    SELECT
      COUNT(*) AS totalServiceCalls,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCalls,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingCalls,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) AS inProgressCalls
    FROM service_calls
  `);

  const feedbackStats = await db.get(`
    SELECT
      ROUND(COALESCE(AVG(rating), 0), 1) AS averageRating,
      COUNT(*) AS totalFeedback
    FROM feedback
  `);

  const monthlyServiceCalls = await db.query(`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
    FROM service_calls
    WHERE created_at >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
  `);

  const completionRate = summary.totalServiceCalls > 0
    ? Math.round((summary.completedCalls / summary.totalServiceCalls) * 1000) / 10
    : 0;

  return {
    totalServiceCalls: summary.totalServiceCalls,
    completedCalls: summary.completedCalls,
    pendingCalls: summary.pendingCalls,
    inProgressCalls: summary.inProgressCalls,
    completionRate,
    averageRating: feedbackStats.averageRating,
    totalFeedback: feedbackStats.totalFeedback,
    monthlyServiceCalls
  };
}

async function getTeamProductivity() {
  const summary = await db.get(`
    SELECT
      COALESCE(SUM(total_hours), 0) AS totalHoursWorked,
      COALESCE(SUM(total_pay), 0) AS totalPayroll,
      COUNT(DISTINCT user_id) AS activeEmployees,
      ROUND(COALESCE(AVG(total_hours), 0), 1) AS averageHoursPerEntry
    FROM time_entries
  `);

  const topTechnicians = await db.query(`
    SELECT
      u.id AS user_id,
      u.username,
      COALESCE(te.totalHours, 0) AS totalHours,
      COALESCE(te.totalPay, 0) AS totalPay,
      ROUND(COALESCE(f.avgRating, 0), 1) AS averageRating,
      COALESCE(sc.completedCalls, 0) AS completedCalls
    FROM users u
    LEFT JOIN (
      SELECT user_id, SUM(total_hours) AS totalHours, SUM(total_pay) AS totalPay
      FROM time_entries
      GROUP BY user_id
    ) te ON u.id = te.user_id
    LEFT JOIN (
      SELECT technician_id, AVG(rating) AS avgRating
      FROM feedback
      GROUP BY technician_id
    ) f ON u.id = f.technician_id
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) AS completedCalls
      FROM service_calls
      WHERE status = 'completed'
      GROUP BY assigned_to
    ) sc ON u.id = sc.assigned_to
    WHERE te.totalHours IS NOT NULL
       OR f.avgRating IS NOT NULL
       OR sc.completedCalls IS NOT NULL
    ORDER BY COALESCE(te.totalHours, 0) DESC
    LIMIT 10
  `);

  return {
    totalHoursWorked: summary.totalHoursWorked,
    totalPayroll: summary.totalPayroll,
    activeEmployees: summary.activeEmployees,
    averageHoursPerEntry: summary.averageHoursPerEntry,
    topTechnicians
  };
}

async function getCustomerInsights() {
  const totalCustomers = await db.get(
    'SELECT COUNT(*) AS count FROM customers'
  );

  const newCustomersThisMonth = await db.get(
    `SELECT COUNT(*) AS count FROM customers WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  );

  const monthlyCustomerGrowth = await db.query(`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COUNT(*) AS count
    FROM customers
    WHERE created_at >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month ASC
  `);

  const topCustomersByRevenue = await db.query(`
    SELECT
      c.id AS customer_id,
      COALESCE(c.company_name, c.contact_name) AS name,
      COALESCE(SUM(i.total), 0) AS totalRevenue,
      COUNT(i.id) AS invoiceCount
    FROM customers c
    JOIN invoices i ON c.id = i.customer_id
    GROUP BY c.id
    ORDER BY totalRevenue DESC
    LIMIT 10
  `);

  return {
    totalCustomers: totalCustomers.count,
    newCustomersThisMonth: newCustomersThisMonth.count,
    monthlyCustomerGrowth,
    topCustomersByRevenue
  };
}

async function getOperationalMetrics() {
  const dispatches = await db.get(`
    SELECT
      COUNT(*) AS totalDispatches,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedDispatches
    FROM dispatches
  `);

  const forms = await db.get('SELECT COUNT(*) AS totalForms FROM forms');
  const submissions = await db.get('SELECT COUNT(*) AS totalSubmissions FROM form_submissions');

  const inventory = await db.get(`
    SELECT
      COUNT(*) AS totalInventoryItems,
      SUM(CASE WHEN quantity <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) AS lowStockItems
    FROM inventory
  `);

  const estimates = await db.get(`
    SELECT
      COUNT(*) AS totalEstimates,
      SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS acceptedEstimates
    FROM estimates
  `);

  const dispatchCompletionRate = dispatches.totalDispatches > 0
    ? Math.round((dispatches.completedDispatches / dispatches.totalDispatches) * 1000) / 10
    : 0;

  const estimateConversionRate = estimates.totalEstimates > 0
    ? Math.round((estimates.acceptedEstimates / estimates.totalEstimates) * 1000) / 10
    : 0;

  return {
    totalDispatches: dispatches.totalDispatches,
    completedDispatches: dispatches.completedDispatches,
    dispatchCompletionRate,
    totalForms: forms.totalForms,
    totalSubmissions: submissions.totalSubmissions,
    totalInventoryItems: inventory.totalInventoryItems,
    lowStockItems: inventory.lowStockItems,
    totalEstimates: estimates.totalEstimates,
    acceptedEstimates: estimates.acceptedEstimates,
    estimateConversionRate
  };
}

module.exports = router;
