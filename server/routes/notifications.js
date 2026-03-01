const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { emitEvent, validateRequired } = require('../utils/routeHelpers');

// Get notifications for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const unreadOnly = req.query.unread === 'true';

    let sql = `
      SELECT n.*, c.contact_name as customer_name
      FROM notifications n
      LEFT JOIN customers c ON n.customer_id = c.id
    `;
    const params = [];

    if (userId) {
      sql += ' WHERE n.user_id = ?';
      params.push(userId);
      if (unreadOnly) {
        sql += ' AND n.is_read = 0';
      }
    } else if (unreadOnly) {
      sql += ' WHERE n.is_read = 0';
    }

    sql += ' ORDER BY n.sent_at DESC LIMIT 100';

    const notifications = await db.query(sql, params);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Create a notification
router.post('/', async (req, res) => {
  try {
    const {
      customer_id, user_id, type, channel,
      subject, message, related_type, related_id
    } = req.body;

    const validationError = validateRequired(req.body, ['type', 'message']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = uuidv4();

    await db.run(`
      INSERT INTO notifications
        (id, customer_id, user_id, type, channel, subject, message, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, customer_id || null, user_id || null,
      type, channel || 'in_app', subject || null,
      message, related_type || null, related_id || null
    ]);

    const notification = await db.get('SELECT * FROM notifications WHERE id = ?', [id]);
    emitEvent(req, 'notification:created', notification);
    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read for a user
router.put('/read-all/:userId', async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.params.userId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Get unread count for a user
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const result = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.params.userId]
    );
    res.json({ count: result.count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Delete a notification
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
