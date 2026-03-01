const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get equipment for service call
router.get('/servicecall/:serviceCallId', authenticateToken, async (req, res) => {
  try {
    const equipment = await db.query(
      'SELECT * FROM equipment WHERE service_call_id = ? ORDER BY created_at DESC',
      [req.params.serviceCallId]
    );
    res.json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Get equipment for customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const equipment = await db.query(
      'SELECT * FROM equipment WHERE customer_id = ? ORDER BY created_at DESC',
      [req.params.customerId]
    );
    res.json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Add equipment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { service_call_id, customer_id, name, serial_number, model, manufacturer, location_details, notes } = req.body;
    const id = uuidv4();

    await db.run(
      `INSERT INTO equipment (id, service_call_id, customer_id, name, serial_number, model, manufacturer, location_details, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, service_call_id, customer_id, name, serial_number, model, manufacturer, location_details, notes]
    );

    const equipment = await db.get('SELECT * FROM equipment WHERE id = ?', [id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('equipment-added', equipment);
    }

    res.json(equipment);
  } catch (error) {
    console.error('Error adding equipment:', error);
    res.status(500).json({ error: 'Failed to add equipment' });
  }
});

// Update equipment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, serial_number, model, manufacturer, location_details, notes } = req.body;

    await db.run(
      `UPDATE equipment 
       SET name = ?, serial_number = ?, model = ?, manufacturer = ?, location_details = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, serial_number, model, manufacturer, location_details, notes, req.params.id]
    );

    const equipment = await db.get('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('equipment-updated', equipment);
    }

    res.json(equipment);
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Delete equipment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM equipment WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('equipment-deleted', { id: req.params.id });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

module.exports = router;
