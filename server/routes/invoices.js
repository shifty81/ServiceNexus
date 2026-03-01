const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Generate invoice number
const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const result = await db.query(
    `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?`,
    [`INV-${year}-%`]
  );
  const count = result[0].count + 1;
  return `INV-${year}-${String(count).padStart(4, '0')}`;
};

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const invoices = await db.query(`
      SELECT i.*, c.contact_name, c.company_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
    `);
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const invoice = await db.get(
      `SELECT i.*, c.contact_name, c.company_name, c.email, c.phone, c.address, c.city, c.state, c.zip
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ?`,
      [req.params.id]
    );
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create new invoice
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id,
      title,
      description,
      status,
      line_items,
      tax_rate,
      due_date,
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
    const invoice_number = await generateInvoiceNumber();
    const created_by = req.user?.id || null;

    await db.run(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, title, description, status,
        subtotal, tax_rate, tax_amount, total, line_items, due_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, invoice_number, customer_id, title, description, status || 'pending',
      subtotal, tax_rate || 0, tax_amount, total, line_items, due_date, notes, created_by
    ]);

    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('invoice:created', invoice);
    }

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id,
      title,
      description,
      status,
      line_items,
      tax_rate,
      due_date,
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
      UPDATE invoices 
      SET customer_id = ?, title = ?, description = ?, status = ?,
          subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?,
          line_items = ?, due_date = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      customer_id, title, description, status,
      subtotal, tax_rate || 0, tax_amount, total,
      line_items, due_date, notes, req.params.id
    ]);

    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('invoice:updated', invoice);
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM invoices WHERE id = ?', [req.params.id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('invoice:deleted', req.params.id);
    }

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// Record payment
router.post('/:id/payment', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Use parseFloat to ensure proper numeric handling and round to 2 decimal places
    const currentAmountPaid = parseFloat(invoice.amount_paid || 0);
    const paymentAmount = parseFloat(amount);
    const invoiceTotal = parseFloat(invoice.total);
    const newAmountPaid = parseFloat((currentAmountPaid + paymentAmount).toFixed(2));
    const isPaid = newAmountPaid >= invoiceTotal - 0.01; // Account for floating-point precision (1 cent tolerance)

    await db.run(`
      UPDATE invoices 
      SET amount_paid = ?, 
          status = ?,
          paid_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      newAmountPaid,
      isPaid ? 'paid' : 'partial',
      isPaid ? new Date().toISOString() : null,
      req.params.id
    ]);

    const updatedInvoice = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    
    if (req.app.get('io')) {
      req.app.get('io').emit('invoice:updated', updatedInvoice);
    }

    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

module.exports = router;
