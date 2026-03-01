const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { emitEvent, validateRequired } = require('../utils/routeHelpers');

// Get all dispatches
router.get('/', async (req, res) => {
  try {
    const dispatches = await db.query(
      'SELECT * FROM dispatches ORDER BY created_at DESC'
    );
    res.json(dispatches);
  } catch (error) {
    console.error('Error fetching dispatches:', error);
    res.status(500).json({ error: 'Failed to fetch dispatches' });
  }
});

// Get single dispatch
router.get('/:id', async (req, res) => {
  try {
    const dispatch = await db.get('SELECT * FROM dispatches WHERE id = ?', [req.params.id]);
    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }
    res.json(dispatch);
  } catch (error) {
    console.error('Error fetching dispatch:', error);
    res.status(500).json({ error: 'Failed to fetch dispatch' });
  }
});

// Create dispatch
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      address,
      latitude,
      longitude,
      assigned_to,
      status,
      priority,
      due_date
    } = req.body;

    const validationError = validateRequired(req.body, ['title']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = uuidv4();

    await db.run(
      `INSERT INTO dispatches 
       (id, title, description, address, latitude, longitude, assigned_to, status, priority, due_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        description,
        address,
        latitude || null,
        longitude || null,
        assigned_to || null,
        status || 'pending',
        priority || 'normal',
        due_date || null
      ]
    );

    emitEvent(req, 'dispatch-changed', { action: 'created', id });

    res.status(201).json({ id, title, description, address });
  } catch (error) {
    console.error('Error creating dispatch:', error);
    res.status(500).json({ error: 'Failed to create dispatch' });
  }
});

// Update dispatch
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      address,
      latitude,
      longitude,
      assigned_to,
      status,
      priority,
      due_date
    } = req.body;

    await db.run(
      `UPDATE dispatches 
       SET title = ?, description = ?, address = ?, latitude = ?, longitude = ?,
           assigned_to = ?, status = ?, priority = ?, due_date = ?
       WHERE id = ?`,
      [
        title,
        description,
        address,
        latitude,
        longitude,
        assigned_to,
        status,
        priority,
        due_date,
        req.params.id
      ]
    );

    emitEvent(req, 'dispatch-changed', { action: 'updated', id: req.params.id });

    res.json({ id: req.params.id, message: 'Dispatch updated successfully' });
  } catch (error) {
    console.error('Error updating dispatch:', error);
    res.status(500).json({ error: 'Failed to update dispatch' });
  }
});

// Complete dispatch
router.post('/:id/complete', async (req, res) => {
  try {
    await db.run(
      'UPDATE dispatches SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', req.params.id]
    );

    emitEvent(req, 'dispatch-changed', { action: 'completed', id: req.params.id });

    res.json({ message: 'Dispatch completed successfully' });
  } catch (error) {
    console.error('Error completing dispatch:', error);
    res.status(500).json({ error: 'Failed to complete dispatch' });
  }
});

// Delete dispatch
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM dispatches WHERE id = ?', [req.params.id]);

    emitEvent(req, 'dispatch-changed', { action: 'deleted', id: req.params.id });

    res.json({ message: 'Dispatch deleted successfully' });
  } catch (error) {
    console.error('Error deleting dispatch:', error);
    res.status(500).json({ error: 'Failed to delete dispatch' });
  }
});

module.exports = router;
