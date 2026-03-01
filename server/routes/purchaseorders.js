const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Generate unique PO number
async function generatePONumber() {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  
  // Get the last PO number for this year
  const lastPO = await db.get(
    'SELECT po_number FROM purchase_orders WHERE po_number LIKE ? ORDER BY created_at DESC LIMIT 1',
    [`${prefix}%`]
  );
  
  let nextNum = 1;
  if (lastPO) {
    const lastNum = parseInt(lastPO.po_number.split('-').pop());
    nextNum = lastNum + 1;
  }
  
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// Calculate totals from line items
// TODO: Make tax_rate configurable per organization or purchase order
function calculatePOTotals(line_items) {
  let items;
  try {
    items = JSON.parse(line_items || '[]');
  } catch (e) {
    return { error: 'Invalid line_items JSON' };
  }
  const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
  const tax_rate = 0; // Currently hardcoded to 0 - can be made configurable via settings
  const tax_amount = subtotal * tax_rate;
  const total = subtotal + tax_amount;
  
  return { subtotal, tax_rate, tax_amount, total };
}


// Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const { status, service_call_id } = req.query;
    let query = `
      SELECT po.*, 
             u1.username as requested_by_name,
             u2.username as approved_by_name,
             sc.title as service_call_title
      FROM purchase_orders po
      LEFT JOIN users u1 ON po.requested_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
      LEFT JOIN service_calls sc ON po.service_call_id = sc.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND po.status = ?';
      params.push(status);
    }
    
    if (service_call_id) {
      query += ' AND po.service_call_id = ?';
      params.push(service_call_id);
    }
    
    query += ' ORDER BY po.created_at DESC';
    
    const purchaseOrders = await db.query(query, params);
    res.json(purchaseOrders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// Get single purchase order
router.get('/:id', async (req, res) => {
  try {
    const purchaseOrder = await db.get(`
      SELECT po.*, 
             u1.username as requested_by_name,
             u2.username as approved_by_name,
             sc.title as service_call_title
      FROM purchase_orders po
      LEFT JOIN users u1 ON po.requested_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
      LEFT JOIN service_calls sc ON po.service_call_id = sc.id
      WHERE po.id = ?
    `, [req.params.id]);

    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Create purchase order
router.post('/', async (req, res) => {
  try {
    const {
      service_call_id,
      vendor_name,
      vendor_contact,
      vendor_phone,
      vendor_email,
      line_items,
      notes,
      requested_by
    } = req.body;

    const id = uuidv4();
    const po_number = await generatePONumber();

    // Calculate totals using helper function
    const totals = calculatePOTotals(line_items);
    if (totals.error) {
      return res.status(400).json({ error: totals.error });
    }
    const { subtotal, tax_rate, tax_amount, total } = totals;

    await db.run(
      `INSERT INTO purchase_orders 
       (id, po_number, service_call_id, vendor_name, vendor_contact, vendor_phone, vendor_email, 
        status, subtotal, tax_rate, tax_amount, total, line_items, notes, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      [id, po_number, service_call_id, vendor_name, vendor_contact, vendor_phone, vendor_email,
       subtotal, tax_rate, tax_amount, total, line_items, notes, requested_by]
    );

    const purchaseOrder = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('purchase-order-changed', purchaseOrder);
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Update purchase order
router.put('/:id', async (req, res) => {
  try {
    const {
      service_call_id,
      vendor_name,
      vendor_contact,
      vendor_phone,
      vendor_email,
      status,
      line_items,
      notes
    } = req.body;

    // Calculate totals using helper function
    const totals = calculatePOTotals(line_items);
    if (totals.error) {
      return res.status(400).json({ error: totals.error });
    }
    const { subtotal, tax_rate, tax_amount, total } = totals;

    await db.run(
      `UPDATE purchase_orders 
       SET service_call_id = ?, vendor_name = ?, vendor_contact = ?, vendor_phone = ?, 
           vendor_email = ?, status = ?, subtotal = ?, tax_amount = ?, total = ?, 
           line_items = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [service_call_id, vendor_name, vendor_contact, vendor_phone, vendor_email, status,
       subtotal, tax_amount, total, line_items, notes, req.params.id]
    );

    const purchaseOrder = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('purchase-order-changed', purchaseOrder);
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// Approve purchase order
router.post('/:id/approve', async (req, res) => {
  try {
    const { approved_by } = req.body;

    await db.run(
      `UPDATE purchase_orders 
       SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approved_by, req.params.id]
    );

    const purchaseOrder = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('purchase-order-changed', purchaseOrder);
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error approving purchase order:', error);
    res.status(500).json({ error: 'Failed to approve purchase order' });
  }
});

// Reject purchase order
router.post('/:id/reject', async (req, res) => {
  try {
    await db.run(
      `UPDATE purchase_orders 
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.params.id]
    );

    const purchaseOrder = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('purchase-order-changed', purchaseOrder);
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error rejecting purchase order:', error);
    res.status(500).json({ error: 'Failed to reject purchase order' });
  }
});

// Mark as received
router.post('/:id/receive', async (req, res) => {
  try {
    await db.run(
      `UPDATE purchase_orders 
       SET status = 'received', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.params.id]
    );

    const purchaseOrder = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('purchase-order-changed', purchaseOrder);
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error marking purchase order as received:', error);
    res.status(500).json({ error: 'Failed to mark purchase order as received' });
  }
});

// Delete purchase order
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM purchase_orders WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('purchase-order-changed', { id: req.params.id, deleted: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

module.exports = router;
