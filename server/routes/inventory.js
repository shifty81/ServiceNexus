const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { emitEvent, validateRequired } = require('../utils/routeHelpers');
const { authenticateToken } = require('../middleware/auth');

// Get all inventory items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const items = await db.query(
      'SELECT * FROM inventory ORDER BY name ASC'
    );
    res.json(items);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Get single inventory item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await db.get('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create inventory item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      quantity,
      unit,
      category,
      location,
      updated_by
    } = req.body;

    const validationError = validateRequired(req.body, ['name']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = uuidv4();

    await db.run(
      `INSERT INTO inventory 
       (id, name, description, quantity, unit, category, location, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        description,
        quantity || 0,
        unit,
        category,
        location,
        updated_by || null
      ]
    );

    emitEvent(req, 'inventory-changed', { action: 'created', id });

    res.status(201).json({ id, name, quantity });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update inventory item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      quantity,
      unit,
      category,
      location,
      updated_by
    } = req.body;

    await db.run(
      `UPDATE inventory 
       SET name = ?, description = ?, quantity = ?, unit = ?, 
           category = ?, location = ?, updated_by = ?, 
           last_updated = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description, quantity, unit, category, location, updated_by, req.params.id]
    );

    emitEvent(req, 'inventory-changed', { action: 'updated', id: req.params.id });

    res.json({ id: req.params.id, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Update quantity (for quick adjustments)
router.patch('/:id/quantity', authenticateToken, async (req, res) => {
  try {
    const { adjustment, updated_by } = req.body;

    if (adjustment === undefined || adjustment === null || !Number.isFinite(Number(adjustment))) {
      return res.status(400).json({ error: 'A valid numeric adjustment is required' });
    }
    
    await db.run(
      `UPDATE inventory 
       SET quantity = quantity + ?, updated_by = ?, 
           last_updated = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [adjustment, updated_by || null, req.params.id]
    );

    const item = await db.get('SELECT * FROM inventory WHERE id = ?', [req.params.id]);

    emitEvent(req, 'inventory-changed', { 
      action: 'quantity-updated', 
      id: req.params.id, 
      newQuantity: item.quantity 
    });

    res.json(item);
  } catch (error) {
    console.error('Error updating quantity:', error);
    res.status(500).json({ error: 'Failed to update quantity' });
  }
});

// Delete inventory item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM inventory WHERE id = ?', [req.params.id]);

    emitEvent(req, 'inventory-changed', { action: 'deleted', id: req.params.id });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
