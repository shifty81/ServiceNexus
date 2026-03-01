const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const UPCOMING_MAINTENANCE_DAYS = 7;
const PREDICTIVE_ANALYSIS_DAYS = 90;
const PREDICTIVE_ALERT_THRESHOLD = 3;

// Get all maintenance schedules with equipment and customer info
router.get('/schedules', authenticateToken, async (req, res) => {
  try {
    const schedules = await db.query(`
      SELECT ms.*,
             e.name as equipment_name,
             e.serial_number,
             e.model,
             e.manufacturer,
             c.company_name,
             c.contact_name as customer_name
      FROM maintenance_schedules ms
      LEFT JOIN equipment e ON ms.equipment_id = e.id
      LEFT JOIN customers c ON e.customer_id = c.id
      ORDER BY ms.next_service_date ASC
    `);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedules' });
  }
});

// Create a maintenance schedule
router.post('/schedules', authenticateToken, async (req, res) => {
  try {
    const { equipment_id, schedule_type, frequency_days, last_service_date, description, created_by } = req.body;

    if (!equipment_id || !schedule_type || !frequency_days) {
      return res.status(400).json({ error: 'equipment_id, schedule_type, and frequency_days are required' });
    }

    const validTypes = ['preventive', 'inspection', 'calibration', 'replacement'];
    if (!validTypes.includes(schedule_type)) {
      return res.status(400).json({ error: 'schedule_type must be one of: ' + validTypes.join(', ') });
    }

    const freq = parseInt(frequency_days, 10);
    if (isNaN(freq) || freq < 1) {
      return res.status(400).json({ error: 'frequency_days must be a positive integer' });
    }

    const id = uuidv4();

    const baseDate = last_service_date || new Date().toISOString();
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + freq);
    const next_service_date = nextDate.toISOString();

    await db.run(
      `INSERT INTO maintenance_schedules (id, equipment_id, schedule_type, frequency_days, last_service_date, next_service_date, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, equipment_id, schedule_type, freq, baseDate, next_service_date, description, created_by]
    );

    const schedule = await db.get('SELECT * FROM maintenance_schedules WHERE id = ?', [id]);

    if (req.app.get('io')) {
      req.app.get('io').emit('maintenance-schedule-changed', schedule);
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to create maintenance schedule' });
  }
});

// Update a maintenance schedule
router.put('/schedules/:id', authenticateToken, async (req, res) => {
  try {
    const { equipment_id, schedule_type, frequency_days, last_service_date, next_service_date, description, is_active } = req.body;

    let computedNextDate = next_service_date;
    if (last_service_date && frequency_days && !next_service_date) {
      const d = new Date(last_service_date);
      d.setDate(d.getDate() + frequency_days);
      computedNextDate = d.toISOString();
    }

    await db.run(
      `UPDATE maintenance_schedules
       SET equipment_id = ?, schedule_type = ?, frequency_days = ?, last_service_date = ?,
           next_service_date = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [equipment_id, schedule_type, frequency_days, last_service_date, computedNextDate, description, is_active, req.params.id]
    );

    const schedule = await db.get('SELECT * FROM maintenance_schedules WHERE id = ?', [req.params.id]);

    if (req.app.get('io')) {
      req.app.get('io').emit('maintenance-schedule-changed', schedule);
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to update maintenance schedule' });
  }
});

// Delete a maintenance schedule
router.delete('/schedules/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM maintenance_schedules WHERE id = ?', [req.params.id]);

    if (req.app.get('io')) {
      req.app.get('io').emit('maintenance-schedule-changed', { id: req.params.id, deleted: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to delete maintenance schedule' });
  }
});

// Get all maintenance alerts with optional filters
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const { status, severity } = req.query;
    let sql = `
      SELECT ma.*,
             e.name as equipment_name,
             e.serial_number,
             e.model,
             c.company_name,
             c.contact_name as customer_name
      FROM maintenance_alerts ma
      LEFT JOIN equipment e ON ma.equipment_id = e.id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND ma.status = ?';
      params.push(status);
    }
    if (severity) {
      sql += ' AND ma.severity = ?';
      params.push(severity);
    }

    sql += ' ORDER BY ma.created_at DESC';

    const alerts = await db.query(sql, params);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching maintenance alerts:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance alerts' });
  }
});

// Update alert status (acknowledge, resolve, dismiss)
router.put('/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const { status, resolved_by } = req.body;

    const validStatuses = ['active', 'acknowledged', 'resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'status must be one of: ' + validStatuses.join(', ') });
    }

    let resolvedAt = null;
    if (status === 'resolved' || status === 'dismissed') {
      resolvedAt = new Date().toISOString();
    }

    await db.run(
      `UPDATE maintenance_alerts
       SET status = ?, resolved_at = ?, resolved_by = ?
       WHERE id = ?`,
      [status, resolvedAt, resolved_by || null, req.params.id]
    );

    const alert = await db.get('SELECT * FROM maintenance_alerts WHERE id = ?', [req.params.id]);
    res.json(alert);
  } catch (error) {
    console.error('Error updating maintenance alert:', error);
    res.status(500).json({ error: 'Failed to update maintenance alert' });
  }
});

// Generate alerts by scanning active maintenance schedules
router.post('/generate-alerts', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + UPCOMING_MAINTENANCE_DAYS);
    const alertsCreated = [];

    // Get all active schedules
    const schedules = await db.query(`
      SELECT ms.*, e.name as equipment_name
      FROM maintenance_schedules ms
      LEFT JOIN equipment e ON ms.equipment_id = e.id
      WHERE ms.is_active = 1
    `);

    for (const schedule of schedules) {
      const nextDate = new Date(schedule.next_service_date);

      // Overdue: next_service_date is in the past
      if (nextDate < now) {
        const existing = await db.get(
          `SELECT id FROM maintenance_alerts
           WHERE equipment_id = ? AND schedule_id = ? AND alert_type = 'overdue' AND status = 'active'`,
          [schedule.equipment_id, schedule.id]
        );
        if (!existing) {
          const id = uuidv4();
          await db.run(
            `INSERT INTO maintenance_alerts (id, equipment_id, schedule_id, alert_type, severity, title, description, due_date)
             VALUES (?, ?, ?, 'overdue', 'high', ?, ?, ?)`,
            [id, schedule.equipment_id, schedule.id,
             `Overdue: ${schedule.equipment_name || 'Equipment'} - ${schedule.schedule_type}`,
             `Maintenance is overdue since ${schedule.next_service_date}. Schedule type: ${schedule.schedule_type}.`,
             schedule.next_service_date]
          );
          const alert = await db.get('SELECT * FROM maintenance_alerts WHERE id = ?', [id]);
          alertsCreated.push(alert);
        }
      }
      // Upcoming: next_service_date within 7 days
      else if (nextDate <= sevenDaysFromNow) {
        const existing = await db.get(
          `SELECT id FROM maintenance_alerts
           WHERE equipment_id = ? AND schedule_id = ? AND alert_type = 'upcoming' AND status = 'active'`,
          [schedule.equipment_id, schedule.id]
        );
        if (!existing) {
          const id = uuidv4();
          await db.run(
            `INSERT INTO maintenance_alerts (id, equipment_id, schedule_id, alert_type, severity, title, description, due_date)
             VALUES (?, ?, ?, 'upcoming', 'medium', ?, ?, ?)`,
            [id, schedule.equipment_id, schedule.id,
             `Upcoming: ${schedule.equipment_name || 'Equipment'} - ${schedule.schedule_type}`,
             `Maintenance due on ${schedule.next_service_date}. Schedule type: ${schedule.schedule_type}.`,
             schedule.next_service_date]
          );
          const alert = await db.get('SELECT * FROM maintenance_alerts WHERE id = ?', [id]);
          alertsCreated.push(alert);
        }
      }
    }

    // Predictive: equipment with frequent service calls in recent history
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - PREDICTIVE_ANALYSIS_DAYS);

    const frequentEquipment = await db.query(`
      SELECT e.id as equipment_id, e.name as equipment_name, COUNT(sc.id) as call_count
      FROM equipment e
      INNER JOIN service_calls sc ON e.service_call_id = sc.id
      WHERE sc.created_at >= ?
      GROUP BY e.id
      HAVING COUNT(sc.id) >= ?
    `, [ninetyDaysAgo.toISOString(), PREDICTIVE_ALERT_THRESHOLD]);

    for (const equip of frequentEquipment) {
      const existing = await db.get(
        `SELECT id FROM maintenance_alerts
         WHERE equipment_id = ? AND alert_type = 'predictive' AND status = 'active'`,
        [equip.equipment_id]
      );
      if (!existing) {
        const id = uuidv4();
        await db.run(
          `INSERT INTO maintenance_alerts (id, equipment_id, schedule_id, alert_type, severity, title, description, due_date)
           VALUES (?, ?, NULL, 'predictive', 'high', ?, ?, NULL)`,
          [id, equip.equipment_id,
           `Predictive: ${equip.equipment_name || 'Equipment'} needs attention`,
           `This equipment has had ${equip.call_count} service calls in the last 90 days. Consider increasing maintenance frequency.`]
        );
        const alert = await db.get('SELECT * FROM maintenance_alerts WHERE id = ?', [id]);
        alertsCreated.push(alert);
      }
    }

    // Emit socket events for new alerts
    if (alertsCreated.length > 0 && req.app.get('io')) {
      for (const alert of alertsCreated) {
        req.app.get('io').emit('maintenance-alert-created', alert);
      }
    }

    res.json({ alerts_created: alertsCreated.length, alerts: alertsCreated });
  } catch (error) {
    console.error('Error generating maintenance alerts:', error);
    res.status(500).json({ error: 'Failed to generate maintenance alerts' });
  }
});

// Dashboard summary
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const equipmentCount = await db.get('SELECT COUNT(*) as count FROM equipment');
    const activeSchedules = await db.get('SELECT COUNT(*) as count FROM maintenance_schedules WHERE is_active = 1');

    const upcomingAlerts = await db.get(
      `SELECT COUNT(*) as count FROM maintenance_alerts
       WHERE alert_type = 'upcoming' AND status = 'active'`
    );
    const overdueAlerts = await db.get(
      `SELECT COUNT(*) as count FROM maintenance_alerts
       WHERE alert_type = 'overdue' AND status = 'active'`
    );
    const predictiveAlerts = await db.get(
      `SELECT COUNT(*) as count FROM maintenance_alerts
       WHERE alert_type = 'predictive' AND status = 'active'`
    );

    const equipmentNeedingAttention = await db.query(`
      SELECT DISTINCT e.id, e.name, e.serial_number, e.model, e.manufacturer,
             c.company_name, c.contact_name as customer_name,
             ma.alert_type, ma.severity, ma.title as alert_title
      FROM maintenance_alerts ma
      LEFT JOIN equipment e ON ma.equipment_id = e.id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE ma.status = 'active'
      ORDER BY
        CASE ma.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END ASC
    `);

    res.json({
      total_equipment: equipmentCount.count,
      active_schedules: activeSchedules.count,
      upcoming_alerts: upcomingAlerts.count,
      overdue_alerts: overdueAlerts.count,
      predictive_alerts: predictiveAlerts.count,
      equipment_needing_attention: equipmentNeedingAttention
    });
  } catch (error) {
    console.error('Error fetching maintenance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance dashboard' });
  }
});

module.exports = router;
