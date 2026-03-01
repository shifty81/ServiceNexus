const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Customer portal dashboard data
router.get('/customer/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only access their own portal data (admins can access any)
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [serviceCalls, invoices, estimates, equipment, feedback] = await Promise.all([
      db.query(
        `SELECT sc.*, u.username as assigned_to_name
         FROM service_calls sc
         LEFT JOIN users u ON sc.assigned_to = u.id
         WHERE sc.created_by = ?
         ORDER BY sc.created_at DESC`,
        [userId]
      ),
      db.query(
        `SELECT i.*, c.contact_name, c.company_name
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE c.id IN (
           SELECT id FROM customers WHERE created_by = ?
         ) OR i.created_by = ?
         ORDER BY i.created_at DESC`,
        [userId, userId]
      ),
      db.query(
        `SELECT e.*, c.contact_name, c.company_name
         FROM estimates e
         LEFT JOIN customers c ON e.customer_id = c.id
         WHERE c.id IN (
           SELECT id FROM customers WHERE created_by = ?
         ) OR e.created_by = ?
         ORDER BY e.created_at DESC`,
        [userId, userId]
      ),
      db.query(
        `SELECT eq.*, sc.title as service_call_title
         FROM equipment eq
         LEFT JOIN service_calls sc ON eq.service_call_id = sc.id
         WHERE sc.created_by = ?
         ORDER BY eq.created_at DESC`,
        [userId]
      ),
      db.query(
        `SELECT f.service_call_id FROM feedback f
         JOIN service_calls sc ON f.service_call_id = sc.id
         WHERE sc.created_by = ?`,
        [userId]
      )
    ]);

    const activeRequests = serviceCalls.filter(sc => sc.status !== 'completed' && sc.status !== 'cancelled').length;
    const completedRequests = serviceCalls.filter(sc => sc.status === 'completed').length;
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'partial').length;
    const totalOwed = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + ((inv.total || 0) - (inv.amount_paid || 0)), 0);

    const ratedServiceCallIds = feedback.map(f => f.service_call_id);

    res.json({
      stats: {
        activeRequests,
        completedRequests,
        pendingInvoices,
        totalOwed,
        totalEquipment: equipment.length
      },
      serviceCalls: serviceCalls.slice(0, 10),
      invoices: invoices.slice(0, 10),
      estimates: estimates.slice(0, 10),
      equipment: equipment.slice(0, 10),
      ratedServiceCallIds
    });
  } catch (error) {
    console.error('Error loading customer portal data:', error);
    res.status(500).json({ error: 'Failed to load portal data' });
  }
});

// Technician portal dashboard data
router.get('/technician/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only access their own portal data (admins can access any)
    if (req.user.id !== userId && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [assignedCalls, dispatches, timeEntries, recentPOs, feedbackRows, feedbackStats] = await Promise.all([
      db.query(
        `SELECT sc.*, c.contact_name as customer_name, c.phone as customer_phone, c.address as customer_address
         FROM service_calls sc
         LEFT JOIN customers c ON sc.customer_id = c.id
         WHERE sc.assigned_to = ?
         ORDER BY
           CASE sc.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'normal' THEN 3
             WHEN 'low' THEN 4
             ELSE 5
           END,
           sc.due_date ASC`,
        [userId]
      ),
      db.query(
        `SELECT * FROM dispatches
         WHERE assigned_to = ?
         ORDER BY
           CASE status WHEN 'pending' THEN 1 WHEN 'in-progress' THEN 2 ELSE 3 END,
           due_date ASC`,
        [userId]
      ),
      db.query(
        `SELECT * FROM time_entries
         WHERE user_id = ?
         ORDER BY clock_in DESC
         LIMIT 10`,
        [userId]
      ),
      db.query(
        `SELECT * FROM purchase_orders
         WHERE requested_by = ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId]
      ),
      db.query(
        `SELECT f.rating, f.comment, f.created_at, sc.title as service_call_title
         FROM feedback f
         LEFT JOIN service_calls sc ON f.service_call_id = sc.id
         WHERE f.technician_id = ?
         ORDER BY f.created_at DESC
         LIMIT 5`,
        [userId]
      ),
      db.get(
        `SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 0) as average_rating
         FROM feedback
         WHERE technician_id = ?`,
        [userId]
      )
    ]);

    const activeJobs = assignedCalls.filter(sc => sc.status === 'in-progress').length;
    const pendingJobs = assignedCalls.filter(sc => sc.status === 'pending').length;
    const today = new Date().toISOString().split('T')[0];
    const completedToday = assignedCalls.filter(sc => {
      if (sc.status !== 'completed' || !sc.completed_at) return false;
      return new Date(sc.completed_at).toISOString().split('T')[0] === today;
    }).length;
    const activeTimeEntry = timeEntries.find(te => te.status === 'active');
    const todayHours = timeEntries
      .filter(te => {
        return te.clock_in && new Date(te.clock_in).toISOString().split('T')[0] === today;
      })
      .reduce((sum, te) => sum + (te.total_hours || 0), 0);

    const avgRating = feedbackStats ? feedbackStats.average_rating : 0;
    const totalReviews = feedbackStats ? feedbackStats.total_reviews : 0;

    res.json({
      stats: {
        activeJobs,
        pendingJobs,
        completedToday,
        todayHours: Math.round(todayHours * 10) / 10,
        isClockedIn: !!activeTimeEntry,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews
      },
      assignedCalls,
      dispatches: dispatches.slice(0, 10),
      timeEntries,
      recentPOs,
      activeTimeEntry,
      recentFeedback: feedbackRows
    });
  } catch (error) {
    console.error('Error loading technician portal data:', error);
    res.status(500).json({ error: 'Failed to load portal data' });
  }
});

module.exports = router;
