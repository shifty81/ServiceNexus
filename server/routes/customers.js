const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Get all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const customers = await db.query(`
      SELECT * FROM customers 
      ORDER BY created_at DESC
    `);
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get single customer
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await db.get(
      'SELECT * FROM customers WHERE id = ?',
      [req.params.id]
    );
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create new customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      company_name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      notes
    } = req.body;

    if (!contact_name) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    const id = uuidv4();
    const created_by = req.user?.id || null;

    await db.run(`
      INSERT INTO customers (
        id, company_name, contact_name, email, phone, 
        address, city, state, zip, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, company_name, contact_name, email, phone,
      address, city, state, zip, notes, created_by
    ]);

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('customer:created', customer);
    }

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      company_name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      notes
    } = req.body;

    if (!contact_name) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    await db.run(`
      UPDATE customers 
      SET company_name = ?, contact_name = ?, email = ?, phone = ?,
          address = ?, city = ?, state = ?, zip = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      company_name, contact_name, email, phone,
      address, city, state, zip, notes, req.params.id
    ]);

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('customer:updated', customer);
    }

    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('customer:deleted', req.params.id);
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Search customers
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const query = `%${req.params.query}%`;
    const customers = await db.query(`
      SELECT * FROM customers 
      WHERE contact_name LIKE ? 
         OR company_name LIKE ? 
         OR email LIKE ? 
         OR phone LIKE ?
      ORDER BY created_at DESC
    `, [query, query, query, query]);
    res.json(customers);
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

module.exports = router;
