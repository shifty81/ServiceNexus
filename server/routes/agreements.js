const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { emitEvent, validateRequired } = require('../utils/routeHelpers');
const { authenticateToken } = require('../middleware/auth');

// Get all service agreements
router.get('/', authenticateToken, async (req, res) => {
  try {
    const agreements = await db.query(`
      SELECT sa.*, c.contact_name, c.company_name
      FROM service_agreements sa
      LEFT JOIN customers c ON sa.customer_id = c.id
      ORDER BY sa.created_at DESC
    `);
    res.json(agreements);
  } catch (error) {
    console.error('Error fetching service agreements:', error);
    res.status(500).json({ error: 'Failed to fetch service agreements' });
  }
});

// Get single service agreement
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const agreement = await db.get(`
      SELECT sa.*, c.contact_name, c.company_name
      FROM service_agreements sa
      LEFT JOIN customers c ON sa.customer_id = c.id
      WHERE sa.id = ?
    `, [req.params.id]);
    if (!agreement) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }
    res.json(agreement);
  } catch (error) {
    console.error('Error fetching service agreement:', error);
    res.status(500).json({ error: 'Failed to fetch service agreement' });
  }
});

// Create service agreement
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id, title, description, type,
      start_date, end_date, renewal_type,
      billing_frequency, billing_amount, terms
    } = req.body;

    const validationError = validateRequired(req.body, ['customer_id', 'title', 'start_date']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = uuidv4();
    const created_by = req.user?.id || null;

    await db.run(`
      INSERT INTO service_agreements
        (id, customer_id, title, description, type, start_date, end_date,
         renewal_type, billing_frequency, billing_amount, terms, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, customer_id, title, description, type || 'maintenance',
      start_date, end_date || null,
      renewal_type || 'manual', billing_frequency || 'monthly',
      billing_amount || 0, terms || null, created_by
    ]);

    const agreement = await db.get('SELECT * FROM service_agreements WHERE id = ?', [id]);
    emitEvent(req, 'agreement:created', agreement);
    res.status(201).json(agreement);
  } catch (error) {
    console.error('Error creating service agreement:', error);
    res.status(500).json({ error: 'Failed to create service agreement' });
  }
});

// Update service agreement
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id, title, description, type, status,
      start_date, end_date, renewal_type,
      billing_frequency, billing_amount, terms
    } = req.body;

    await db.run(`
      UPDATE service_agreements
      SET customer_id = ?, title = ?, description = ?, type = ?, status = ?,
          start_date = ?, end_date = ?, renewal_type = ?,
          billing_frequency = ?, billing_amount = ?, terms = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      customer_id, title, description, type, status,
      start_date, end_date, renewal_type,
      billing_frequency, billing_amount, terms, req.params.id
    ]);

    const agreement = await db.get('SELECT * FROM service_agreements WHERE id = ?', [req.params.id]);
    emitEvent(req, 'agreement:updated', agreement);
    res.json(agreement);
  } catch (error) {
    console.error('Error updating service agreement:', error);
    res.status(500).json({ error: 'Failed to update service agreement' });
  }
});

// Delete service agreement
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM service_agreements WHERE id = ?', [req.params.id]);
    emitEvent(req, 'agreement:deleted', req.params.id);
    res.json({ message: 'Service agreement deleted successfully' });
  } catch (error) {
    console.error('Error deleting service agreement:', error);
    res.status(500).json({ error: 'Failed to delete service agreement' });
  }
});

// Get agreements for a specific customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const agreements = await db.query(
      'SELECT * FROM service_agreements WHERE customer_id = ? ORDER BY created_at DESC',
      [req.params.customerId]
    );
    res.json(agreements);
  } catch (error) {
    console.error('Error fetching customer agreements:', error);
    res.status(500).json({ error: 'Failed to fetch customer agreements' });
  }
});

module.exports = router;
