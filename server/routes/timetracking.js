const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Helper function to calculate hours and pay
const calculateHoursAndPay = (clockIn, clockOut, breakDuration, hourlyRate) => {
  const clock_in_ms = new Date(clockIn).getTime();
  const clock_out_ms = new Date(clockOut).getTime();
  const break_duration_ms = (breakDuration || 0) * 60000; // convert minutes to milliseconds
  
  // Calculate total_hours as (clock_out - clock_in - break_duration) / 3600000
  const total_hours = Math.max(0, (clock_out_ms - clock_in_ms - break_duration_ms) / 3600000);
  
  // Calculate total_pay as total_hours * hourly_rate
  const total_pay = total_hours * Math.max(0, hourlyRate || 0);
  
  return { total_hours, total_pay };
};

// Get all time entries with user information
router.get('/', async (req, res) => {
  try {
    const entries = await db.query(
      `SELECT te.*, u.username, u.email 
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       ORDER BY te.clock_in DESC`
    );
    res.json(entries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Get currently active (clocked in) entries
router.get('/active', async (req, res) => {
  try {
    const activeEntries = await db.query(
      `SELECT te.*, u.username, u.email 
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       WHERE te.status = 'active' AND te.clock_out IS NULL
       ORDER BY te.clock_in DESC`
    );
    res.json(activeEntries);
  } catch (error) {
    console.error('Error fetching active entries:', error);
    res.status(500).json({ error: 'Failed to fetch active entries' });
  }
});

// Get time entries for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const entries = await db.query(
      `SELECT te.*, u.username, u.email 
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       WHERE te.user_id = ?
       ORDER BY te.clock_in DESC`,
      [req.params.userId]
    );
    res.json(entries);
  } catch (error) {
    console.error('Error fetching user time entries:', error);
    res.status(500).json({ error: 'Failed to fetch user time entries' });
  }
});

// Get payroll summary by user and date range
router.get('/payroll', async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    let query = `
      SELECT 
        te.user_id,
        u.username,
        u.email,
        COUNT(te.id) as total_entries,
        SUM(te.total_hours) as total_hours,
        SUM(te.total_pay) as total_pay,
        AVG(te.hourly_rate) as avg_hourly_rate
      FROM time_entries te
      LEFT JOIN users u ON te.user_id = u.id
      WHERE te.status = 'completed'
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND te.clock_in >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND te.clock_in <= ?';
      params.push(endDate);
    }
    
    if (userId) {
      query += ' AND te.user_id = ?';
      params.push(userId);
    }
    
    query += ' GROUP BY te.user_id, u.username, u.email ORDER BY total_hours DESC';
    
    const payroll = await db.query(query, params);
    res.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ error: 'Failed to fetch payroll data' });
  }
});

// Clock in (create new entry with clock_in time)
router.post('/clock-in', async (req, res) => {
  try {
    const { user_id, hourly_rate, notes, dispatch_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user already has an active entry
    const activeEntry = await db.get(
      'SELECT * FROM time_entries WHERE user_id = ? AND status = ? AND clock_out IS NULL',
      [user_id, 'active']
    );
    
    if (activeEntry) {
      return res.status(400).json({ 
        error: 'User already has an active time entry',
        activeEntry 
      });
    }
    
    const id = uuidv4();
    const clock_in = new Date().toISOString();
    
    await db.run(
      `INSERT INTO time_entries 
       (id, user_id, clock_in, hourly_rate, notes, dispatch_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, clock_in, hourly_rate || 0, notes || null, dispatch_id || null, 'active']
    );
    
    const entry = await db.get(
      `SELECT te.*, u.username, u.email 
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       WHERE te.id = ?`,
      [id]
    );
    
    const io = req.app.get('io');
    io.emit('timeentry:created', entry);
    
    res.status(201).json(entry);
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// Clock out (update entry with clock_out, calculate hours and pay)
router.post('/clock-out/:id', async (req, res) => {
  try {
    const { break_duration } = req.body;
    const entryId = req.params.id;
    
    const entry = await db.get('SELECT * FROM time_entries WHERE id = ?', [entryId]);
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    
    if (entry.clock_out) {
      return res.status(400).json({ error: 'Already clocked out' });
    }
    
    const clock_out = new Date().toISOString();
    
    const { total_hours, total_pay } = calculateHoursAndPay(
      entry.clock_in,
      clock_out,
      break_duration || entry.break_duration || 0,
      entry.hourly_rate || 0
    );
    
    await db.run(
      `UPDATE time_entries 
       SET clock_out = ?, break_duration = ?, total_hours = ?, total_pay = ?, status = ?
       WHERE id = ?`,
      [clock_out, break_duration || entry.break_duration || 0, total_hours, total_pay, 'completed', entryId]
    );
    
    const updatedEntry = await db.get(
      `SELECT te.*, u.username, u.email 
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       WHERE te.id = ?`,
      [entryId]
    );
    
    const io = req.app.get('io');
    io.emit('timeentry:updated', updatedEntry);
    
    res.json(updatedEntry);
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// Update time entry (for corrections)
router.put('/:id', async (req, res) => {
  try {
    const {
      clock_in,
      clock_out,
      break_duration,
      hourly_rate,
      notes,
      dispatch_id
    } = req.body;
    
    const entry = await db.get('SELECT * FROM time_entries WHERE id = ?', [req.params.id]);
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    
    // Recalculate hours and pay if times changed
    let total_hours = entry.total_hours;
    let total_pay = entry.total_pay;
    let status = entry.status;
    
    if (clock_in && clock_out) {
      const result = calculateHoursAndPay(
        clock_in,
        clock_out,
        break_duration !== undefined ? break_duration : entry.break_duration || 0,
        hourly_rate !== undefined ? hourly_rate : entry.hourly_rate || 0
      );
      total_hours = result.total_hours;
      total_pay = result.total_pay;
      status = 'completed';
    }
    
    await db.run(
      `UPDATE time_entries 
       SET clock_in = ?, clock_out = ?, break_duration = ?, hourly_rate = ?,
           total_hours = ?, total_pay = ?, notes = ?, dispatch_id = ?, status = ?
       WHERE id = ?`,
      [
        clock_in || entry.clock_in,
        clock_out || entry.clock_out,
        break_duration !== undefined ? break_duration : entry.break_duration,
        hourly_rate !== undefined ? hourly_rate : entry.hourly_rate,
        total_hours,
        total_pay,
        notes !== undefined ? notes : entry.notes,
        dispatch_id !== undefined ? dispatch_id : entry.dispatch_id,
        status,
        req.params.id
      ]
    );
    
    const updatedEntry = await db.get(
      `SELECT te.*, u.username, u.email 
       FROM time_entries te
       LEFT JOIN users u ON te.user_id = u.id
       WHERE te.id = ?`,
      [req.params.id]
    );
    
    const io = req.app.get('io');
    io.emit('timeentry:updated', updatedEntry);
    
    res.json(updatedEntry);
  } catch (error) {
    console.error('Error updating time entry:', error);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

// Delete time entry
router.delete('/:id', async (req, res) => {
  try {
    const entry = await db.get('SELECT * FROM time_entries WHERE id = ?', [req.params.id]);
    
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    
    await db.run('DELETE FROM time_entries WHERE id = ?', [req.params.id]);
    
    const io = req.app.get('io');
    io.emit('timeentry:deleted', { id: req.params.id });
    
    res.json({ message: 'Time entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

module.exports = router;
