const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const MAX_COMMENT_LENGTH = 1000;

// Get all feedback (admin view)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const feedback = await db.query(`
      SELECT f.*, 
             sc.title as service_call_title,
             u.username as submitted_by_name,
             u2.username as technician_name
      FROM feedback f
      LEFT JOIN service_calls sc ON f.service_call_id = sc.id
      LEFT JOIN users u ON f.submitted_by = u.id
      LEFT JOIN users u2 ON f.technician_id = u2.id
      ORDER BY f.created_at DESC
    `);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get feedback for a specific service call
router.get('/servicecall/:serviceCallId', authenticateToken, async (req, res) => {
  try {
    const feedback = await db.get(`
      SELECT f.*, 
             u.username as submitted_by_name,
             u2.username as technician_name
      FROM feedback f
      LEFT JOIN users u ON f.submitted_by = u.id
      LEFT JOIN users u2 ON f.technician_id = u2.id
      WHERE f.service_call_id = ?
    `, [req.params.serviceCallId]);
    res.json(feedback || null);
  } catch (error) {
    console.error('Error fetching feedback for service call:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get feedback for a specific technician
router.get('/technician/:technicianId', authenticateToken, async (req, res) => {
  try {
    const feedback = await db.query(`
      SELECT f.*, 
             sc.title as service_call_title,
             u.username as submitted_by_name
      FROM feedback f
      LEFT JOIN service_calls sc ON f.service_call_id = sc.id
      LEFT JOIN users u ON f.submitted_by = u.id
      WHERE f.technician_id = ?
      ORDER BY f.created_at DESC
    `, [req.params.technicianId]);

    const avgRating = feedback.length > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
      : 0;

    res.json({
      feedback,
      stats: {
        totalReviews: feedback.length,
        averageRating: Math.round(avgRating * 10) / 10
      }
    });
  } catch (error) {
    console.error('Error fetching technician feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Submit feedback for a completed service call
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { service_call_id, technician_id, rating, comment, submitted_by } = req.body;

    if (!service_call_id || !rating || !submitted_by) {
      return res.status(400).json({ error: 'Service call ID, rating, and submitted_by are required' });
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    // Check if service call exists and is completed
    const serviceCall = await db.get(
      'SELECT * FROM service_calls WHERE id = ?',
      [service_call_id]
    );

    if (!serviceCall) {
      return res.status(404).json({ error: 'Service call not found' });
    }

    if (serviceCall.status !== 'completed') {
      return res.status(400).json({ error: 'Feedback can only be submitted for completed service calls' });
    }

    // Check if feedback already exists for this service call
    const existing = await db.get(
      'SELECT id FROM feedback WHERE service_call_id = ?',
      [service_call_id]
    );

    if (existing) {
      return res.status(409).json({ error: 'Feedback already submitted for this service call' });
    }

    const id = uuidv4();
    const sanitizedComment = comment ? String(comment).slice(0, MAX_COMMENT_LENGTH) : null;

    await db.run(
      `INSERT INTO feedback (id, service_call_id, technician_id, rating, comment, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, service_call_id, technician_id || serviceCall.assigned_to, rating, sanitizedComment, submitted_by]
    );

    const newFeedback = await db.get('SELECT * FROM feedback WHERE id = ?', [id]);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('feedback-submitted', newFeedback);
    }

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get summary stats for all technicians (admin view)
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        f.technician_id,
        u.username as technician_name,
        COUNT(*) as total_reviews,
        ROUND(AVG(f.rating), 1) as average_rating,
        SUM(CASE WHEN f.rating >= 4 THEN 1 ELSE 0 END) as positive_reviews,
        SUM(CASE WHEN f.rating <= 2 THEN 1 ELSE 0 END) as negative_reviews
      FROM feedback f
      LEFT JOIN users u ON f.technician_id = u.id
      WHERE f.technician_id IS NOT NULL
      GROUP BY f.technician_id
      ORDER BY average_rating DESC
    `);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ error: 'Failed to fetch feedback stats' });
  }
});

module.exports = router;
