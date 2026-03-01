const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Generate estimate number
const generateEstimateNumber = async () => {
  const year = new Date().getFullYear();
  const result = await db.query(
    `SELECT COUNT(*) as count FROM estimates WHERE estimate_number LIKE ?`,
    [`EST-${year}-%`]
  );
  const count = result[0].count + 1;
  return `EST-${year}-${String(count).padStart(4, '0')}`;
};

// Get all estimates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const estimates = await db.query(`
      SELECT e.*, c.contact_name, c.company_name
      FROM estimates e
      LEFT JOIN customers c ON e.customer_id = c.id
      ORDER BY e.created_at DESC
    `);
    res.json(estimates);
  } catch (error) {
    console.error('Error fetching estimates:', error);
    res.status(500).json({ error: 'Failed to fetch estimates' });
  }
});

// Get single estimate
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const estimate = await db.get(
      `SELECT e.*, c.contact_name, c.company_name, c.email, c.phone, c.address, c.city, c.state, c.zip
       FROM estimates e
       LEFT JOIN customers c ON e.customer_id = c.id
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json(estimate);
  } catch (error) {
    console.error('Error fetching estimate:', error);
    res.status(500).json({ error: 'Failed to fetch estimate' });
  }
});

// Create new estimate
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id,
      title,
      description,
      status,
      line_items,
      tax_rate,
      valid_until,
      notes
    } = req.body;

    if (!customer_id || !title) {
      return res.status(400).json({ error: 'Customer and title are required' });
    }

    // Calculate totals
    let items;
    try {
      items = JSON.parse(line_items || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid line_items JSON' });
    }
    const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const tax_amount = subtotal * (tax_rate || 0) / 100;
    const total = subtotal + tax_amount;

    const id = uuidv4();
    const estimate_number = await generateEstimateNumber();
    const created_by = req.user?.id || null;

    await db.run(`
      INSERT INTO estimates (
        id, estimate_number, customer_id, title, description, status,
        subtotal, tax_rate, tax_amount, total, line_items, valid_until, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, estimate_number, customer_id, title, description, status || 'draft',
      subtotal, tax_rate || 0, tax_amount, total, line_items, valid_until, notes, created_by
    ]);

    const estimate = await db.get('SELECT * FROM estimates WHERE id = ?', [id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('estimate:created', estimate);
    }

    res.status(201).json(estimate);
  } catch (error) {
    console.error('Error creating estimate:', error);
    res.status(500).json({ error: 'Failed to create estimate' });
  }
});

// Update estimate
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id,
      title,
      description,
      status,
      line_items,
      tax_rate,
      valid_until,
      notes
    } = req.body;

    if (!customer_id || !title) {
      return res.status(400).json({ error: 'Customer and title are required' });
    }

    // Calculate totals
    let items;
    try {
      items = JSON.parse(line_items || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid line_items JSON' });
    }
    const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const tax_amount = subtotal * (tax_rate || 0) / 100;
    const total = subtotal + tax_amount;

    await db.run(`
      UPDATE estimates 
      SET customer_id = ?, title = ?, description = ?, status = ?,
          subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?,
          line_items = ?, valid_until = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      customer_id, title, description, status,
      subtotal, tax_rate || 0, tax_amount, total,
      line_items, valid_until, notes, req.params.id
    ]);

    const estimate = await db.get('SELECT * FROM estimates WHERE id = ?', [req.params.id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('estimate:updated', estimate);
    }

    res.json(estimate);
  } catch (error) {
    console.error('Error updating estimate:', error);
    res.status(500).json({ error: 'Failed to update estimate' });
  }
});

// Delete estimate
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM estimates WHERE id = ?', [req.params.id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('estimate:deleted', req.params.id);
    }

    res.json({ message: 'Estimate deleted successfully' });
  } catch (error) {
    console.error('Error deleting estimate:', error);
    res.status(500).json({ error: 'Failed to delete estimate' });
  }
});

// Convert estimate to invoice
router.post('/:id/convert-to-invoice', authenticateToken, async (req, res) => {
  try {
    const estimate = await db.get('SELECT * FROM estimates WHERE id = ?', [req.params.id]);
    
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Generate invoice number
    const year = new Date().getFullYear();
    const result = await db.query(
      `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?`,
      [`INV-${year}-%`]
    );
    const count = result[0].count + 1;
    const invoice_number = `INV-${year}-${String(count).padStart(4, '0')}`;

    const id = uuidv4();
    const created_by = req.user?.id || null;
    const due_date = req.body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await db.run(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, estimate_id, title, description,
        status, subtotal, tax_rate, tax_amount, total, line_items,
        due_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, invoice_number, estimate.customer_id, estimate.id, estimate.title, estimate.description,
      'pending', estimate.subtotal, estimate.tax_rate, estimate.tax_amount, estimate.total,
      estimate.line_items, due_date, estimate.notes, created_by
    ]);

    // Update estimate status
    await db.run('UPDATE estimates SET status = ? WHERE id = ?', ['accepted', req.params.id]);

    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('invoice:created', invoice);
      req.app.get('io').emit('estimate:updated', { ...estimate, status: 'accepted' });
    }

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error converting estimate to invoice:', error);
    res.status(500).json({ error: 'Failed to convert estimate to invoice' });
  }
});

module.exports = router;
