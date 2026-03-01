const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { emitEvent, validateRequired } = require('../utils/routeHelpers');
const { authenticateToken } = require('../middleware/auth');

// Get all recurring jobs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const jobs = await db.query(`
      SELECT rj.*, c.contact_name, c.company_name,
             sa.title as agreement_title
      FROM recurring_jobs rj
      LEFT JOIN customers c ON rj.customer_id = c.id
      LEFT JOIN service_agreements sa ON rj.agreement_id = sa.id
      ORDER BY rj.next_due_date ASC
    `);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching recurring jobs:', error);
    res.status(500).json({ error: 'Failed to fetch recurring jobs' });
  }
});

// Get single recurring job
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const job = await db.get(`
      SELECT rj.*, c.contact_name, c.company_name
      FROM recurring_jobs rj
      LEFT JOIN customers c ON rj.customer_id = c.id
      WHERE rj.id = ?
    `, [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: 'Recurring job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error fetching recurring job:', error);
    res.status(500).json({ error: 'Failed to fetch recurring job' });
  }
});

// Create recurring job
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      agreement_id, customer_id, title, description,
      frequency, day_of_week, day_of_month, next_due_date,
      assigned_to, priority
    } = req.body;

    const validationError = validateRequired(req.body, ['customer_id', 'title', 'next_due_date', 'frequency']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = uuidv4();
    const created_by = req.user?.id || null;

    await db.run(`
      INSERT INTO recurring_jobs
        (id, agreement_id, customer_id, title, description,
         frequency, day_of_week, day_of_month, next_due_date,
         assigned_to, priority, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, agreement_id || null, customer_id, title, description || null,
      frequency, day_of_week || null, day_of_month || null, next_due_date,
      assigned_to || null, priority || 'normal', created_by
    ]);

    const job = await db.get('SELECT * FROM recurring_jobs WHERE id = ?', [id]);
    emitEvent(req, 'recurring-job:created', job);
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating recurring job:', error);
    res.status(500).json({ error: 'Failed to create recurring job' });
  }
});

// Update recurring job
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      agreement_id, customer_id, title, description,
      frequency, day_of_week, day_of_month, next_due_date,
      assigned_to, priority, status
    } = req.body;

    await db.run(`
      UPDATE recurring_jobs
      SET agreement_id = ?, customer_id = ?, title = ?, description = ?,
          frequency = ?, day_of_week = ?, day_of_month = ?, next_due_date = ?,
          assigned_to = ?, priority = ?, status = ?
      WHERE id = ?
    `, [
      agreement_id, customer_id, title, description,
      frequency, day_of_week, day_of_month, next_due_date,
      assigned_to, priority, status, req.params.id
    ]);

    const job = await db.get('SELECT * FROM recurring_jobs WHERE id = ?', [req.params.id]);
    emitEvent(req, 'recurring-job:updated', job);
    res.json(job);
  } catch (error) {
    console.error('Error updating recurring job:', error);
    res.status(500).json({ error: 'Failed to update recurring job' });
  }
});

// Delete recurring job
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.run('DELETE FROM recurring_jobs WHERE id = ?', [req.params.id]);
    emitEvent(req, 'recurring-job:deleted', req.params.id);
    res.json({ message: 'Recurring job deleted successfully' });
  } catch (error) {
    console.error('Error deleting recurring job:', error);
    res.status(500).json({ error: 'Failed to delete recurring job' });
  }
});

// Generate next dispatch from a recurring job (advance the schedule)
router.post('/:id/generate', authenticateToken, async (req, res) => {
  try {
    const job = await db.get('SELECT * FROM recurring_jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: 'Recurring job not found' });
    }

    // Create a dispatch from the recurring job
    const dispatchId = uuidv4();
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [job.customer_id]);

    await db.run(`
      INSERT INTO dispatches
        (id, title, description, address, assigned_to, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dispatchId,
      job.title,
      job.description || '',
      customer?.address || '',
      job.assigned_to,
      'pending',
      job.priority || 'normal',
      job.next_due_date
    ]);

    // Calculate next due date
    const nextDate = calculateNextDueDate(job.next_due_date, job.frequency, job.day_of_week, job.day_of_month);
    await db.run(
      'UPDATE recurring_jobs SET next_due_date = ?, last_generated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextDate, req.params.id]
    );

    emitEvent(req, 'dispatch-changed', { action: 'created', id: dispatchId });
    emitEvent(req, 'recurring-job:generated', { jobId: req.params.id, dispatchId });

    res.status(201).json({ dispatchId, nextDueDate: nextDate });
  } catch (error) {
    console.error('Error generating dispatch from recurring job:', error);
    res.status(500).json({ error: 'Failed to generate dispatch' });
  }
});

// Get due recurring jobs (jobs whose next_due_date is today or past)
router.get('/status/due', authenticateToken, async (req, res) => {
  try {
    const jobs = await db.query(`
      SELECT rj.*, c.contact_name, c.company_name
      FROM recurring_jobs rj
      LEFT JOIN customers c ON rj.customer_id = c.id
      WHERE rj.status = 'active' AND rj.next_due_date <= date('now')
      ORDER BY rj.next_due_date ASC
    `);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching due recurring jobs:', error);
    res.status(500).json({ error: 'Failed to fetch due recurring jobs' });
  }
});

/**
 * Calculate the next due date based on frequency.
 */
function calculateNextDueDate(currentDate, frequency, dayOfWeek, dayOfMonth) {
  const date = new Date(currentDate);
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      if (dayOfMonth) {
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annually':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString().split('T')[0];
}

module.exports = router;
