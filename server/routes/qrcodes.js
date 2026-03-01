const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Generate QR code for customer location
router.post('/generate', async (req, res) => {
  try {
    const { customer_id, location_name } = req.body;
    const id = uuidv4();
    const qr_code_data = `FIELDFORGE-${id}`;

    await db.run(
      `INSERT INTO qr_codes (id, customer_id, qr_code_data, location_name)
       VALUES (?, ?, ?, ?)`,
      [id, customer_id, qr_code_data, location_name]
    );

    const qrCode = await db.get('SELECT * FROM qr_codes WHERE id = ?', [id]);
    res.json(qrCode);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Get QR codes for a customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const qrCodes = await db.query(
      'SELECT * FROM qr_codes WHERE customer_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [req.params.customerId]
    );
    res.json(qrCodes);
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// Validate QR code
router.post('/validate', async (req, res) => {
  try {
    const { qr_code_data } = req.body;
    
    const qrCode = await db.get(`
      SELECT q.*, c.contact_name, c.company_name, c.address
      FROM qr_codes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.qr_code_data = ? AND q.is_active = 1
    `, [qr_code_data]);

    if (!qrCode) {
      return res.status(404).json({ error: 'Invalid or inactive QR code' });
    }

    res.json(qrCode);
  } catch (error) {
    console.error('Error validating QR code:', error);
    res.status(500).json({ error: 'Failed to validate QR code' });
  }
});

// Deactivate QR code
router.put('/:id/deactivate', async (req, res) => {
  try {
    await db.run('UPDATE qr_codes SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating QR code:', error);
    res.status(500).json({ error: 'Failed to deactivate QR code' });
  }
});

// Check in - Technician arrives at location
router.post('/checkin', async (req, res) => {
  try {
    const { service_call_id, technician_id, qr_code_id, location_latitude, location_longitude, notes } = req.body;
    const id = uuidv4();

    // Validate QR code
    const qrCode = await db.get('SELECT * FROM qr_codes WHERE id = ? AND is_active = 1', [qr_code_id]);
    if (!qrCode) {
      return res.status(400).json({ error: 'Invalid or inactive QR code' });
    }

    // Check if technician is already checked in
    const existingCheckIn = await db.get(
      'SELECT * FROM check_ins WHERE service_call_id = ? AND technician_id = ? AND check_out_time IS NULL',
      [service_call_id, technician_id]
    );

    if (existingCheckIn) {
      return res.status(400).json({ error: 'Technician is already checked in' });
    }

    await db.run(
      `INSERT INTO check_ins (id, service_call_id, technician_id, qr_code_id, check_in_time, location_latitude, location_longitude, notes)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [id, service_call_id, technician_id, qr_code_id, location_latitude, location_longitude, notes]
    );

    const checkIn = await db.get(`
      SELECT ci.*, u.username as technician_name
      FROM check_ins ci
      LEFT JOIN users u ON ci.technician_id = u.id
      WHERE ci.id = ?
    `, [id]);

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('technician-checked-in', checkIn);
    }

    res.json(checkIn);
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Check out - Technician leaves location
router.post('/checkout/:checkInId', async (req, res) => {
  try {
    const { notes } = req.body;

    await db.run(
      `UPDATE check_ins 
       SET check_out_time = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
       WHERE id = ?`,
      [notes, req.params.checkInId]
    );

    const checkIn = await db.get(`
      SELECT ci.*, u.username as technician_name
      FROM check_ins ci
      LEFT JOIN users u ON ci.technician_id = u.id
      WHERE ci.id = ?
    `, [req.params.checkInId]);

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('technician-checked-out', checkIn);
    }

    res.json(checkIn);
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// Get active check-in for technician
router.get('/active/:technicianId', async (req, res) => {
  try {
    const checkIn = await db.get(`
      SELECT ci.*, u.username as technician_name, sc.title as service_call_title
      FROM check_ins ci
      LEFT JOIN users u ON ci.technician_id = u.id
      LEFT JOIN service_calls sc ON ci.service_call_id = sc.id
      WHERE ci.technician_id = ? AND ci.check_out_time IS NULL
      ORDER BY ci.check_in_time DESC
      LIMIT 1
    `, [req.params.technicianId]);

    res.json(checkIn || null);
  } catch (error) {
    console.error('Error fetching active check-in:', error);
    res.status(500).json({ error: 'Failed to fetch active check-in' });
  }
});

// Get check-ins for service call
router.get('/servicecall/:serviceCallId', async (req, res) => {
  try {
    const checkIns = await db.query(`
      SELECT ci.*, u.username as technician_name
      FROM check_ins ci
      LEFT JOIN users u ON ci.technician_id = u.id
      WHERE ci.service_call_id = ?
      ORDER BY ci.check_in_time DESC
    `, [req.params.serviceCallId]);

    res.json(checkIns);
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

module.exports = router;
