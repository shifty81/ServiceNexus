const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get all service calls
router.get('/', authenticateToken, async (req, res) => {
  try {
    const serviceCalls = await db.query(`
      SELECT sc.*, 
             c.contact_name as customer_name,
             u.username as assigned_to_name,
             u2.username as created_by_name
      FROM service_calls sc
      LEFT JOIN customers c ON sc.customer_id = c.id
      LEFT JOIN users u ON sc.assigned_to = u.id
      LEFT JOIN users u2 ON sc.created_by = u2.id
      ORDER BY sc.created_at DESC
    `);
    res.json(serviceCalls);
  } catch (error) {
    console.error('Error fetching service calls:', error);
    res.status(500).json({ error: 'Failed to fetch service calls' });
  }
});

// Get single service call with details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const serviceCall = await db.get(`
      SELECT sc.*, 
             c.contact_name as customer_name,
             c.company_name,
             c.address,
             c.phone,
             c.email,
             u.username as assigned_to_name,
             u2.username as created_by_name
      FROM service_calls sc
      LEFT JOIN customers c ON sc.customer_id = c.id
      LEFT JOIN users u ON sc.assigned_to = u.id
      LEFT JOIN users u2 ON sc.created_by = u2.id
      WHERE sc.id = ?
    `, [req.params.id]);

    if (!serviceCall) {
      return res.status(404).json({ error: 'Service call not found' });
    }

    // Get comments
    const comments = await db.query(`
      SELECT c.*, u.username, u.user_type
      FROM service_call_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.service_call_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);

    // Get pictures
    const pictures = await db.query(`
      SELECT p.*, u.username
      FROM service_call_pictures p
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.service_call_id = ?
      ORDER BY p.uploaded_at DESC
    `, [req.params.id]);

    // Get equipment
    const equipment = await db.query(`
      SELECT * FROM equipment
      WHERE service_call_id = ?
      ORDER BY created_at DESC
    `, [req.params.id]);

    // Get check-ins
    const checkIns = await db.query(`
      SELECT ci.*, u.username as technician_name
      FROM check_ins ci
      LEFT JOIN users u ON ci.technician_id = u.id
      WHERE ci.service_call_id = ?
      ORDER BY ci.check_in_time DESC
    `, [req.params.id]);

    res.json({
      ...serviceCall,
      comments,
      pictures,
      equipment,
      checkIns
    });
  } catch (error) {
    console.error('Error fetching service call:', error);
    res.status(500).json({ error: 'Failed to fetch service call' });
  }
});

// Create service call
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, customer_id, assigned_to, status, priority, due_date, created_by } = req.body;
    const id = uuidv4();

    await db.run(
      `INSERT INTO service_calls (id, title, description, customer_id, assigned_to, status, priority, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, customer_id, assigned_to, status || 'pending', priority || 'normal', due_date, created_by]
    );

    const serviceCall = await db.get('SELECT * FROM service_calls WHERE id = ?', [id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('service-call-changed', serviceCall);
    }

    res.json(serviceCall);
  } catch (error) {
    console.error('Error creating service call:', error);
    res.status(500).json({ error: 'Failed to create service call' });
  }
});

// Update service call
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, customer_id, assigned_to, status, priority, due_date } = req.body;
    
    await db.run(
      `UPDATE service_calls 
       SET title = ?, description = ?, customer_id = ?, assigned_to = ?, 
           status = ?, priority = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, description, customer_id, assigned_to, status, priority, due_date, req.params.id]
    );

    const serviceCall = await db.get('SELECT * FROM service_calls WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('service-call-changed', serviceCall);
    }

    res.json(serviceCall);
  } catch (error) {
    console.error('Error updating service call:', error);
    res.status(500).json({ error: 'Failed to update service call' });
  }
});

// Complete service call
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    await db.run(
      `UPDATE service_calls 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.params.id]
    );

    const serviceCall = await db.get('SELECT * FROM service_calls WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('service-call-changed', serviceCall);
    }

    res.json(serviceCall);
  } catch (error) {
    console.error('Error completing service call:', error);
    res.status(500).json({ error: 'Failed to complete service call' });
  }
});

// Delete service call
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM service_calls WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('service-call-changed', { id: req.params.id, deleted: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting service call:', error);
    res.status(500).json({ error: 'Failed to delete service call' });
  }
});

// Add comment to service call
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { user_id, comment } = req.body;
    const id = uuidv4();

    await db.run(
      `INSERT INTO service_call_comments (id, service_call_id, user_id, comment)
       VALUES (?, ?, ?, ?)`,
      [id, req.params.id, user_id, comment]
    );

    const newComment = await db.get(`
      SELECT c.*, u.username, u.user_type
      FROM service_call_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [id]);

    // Emit socket event for real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('service-call-comment-added', {
        serviceCallId: req.params.id,
        comment: newComment
      });
    }

    res.json(newComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for service call
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const comments = await db.query(`
      SELECT c.*, u.username, u.user_type
      FROM service_call_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.service_call_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;
