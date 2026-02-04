const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../database');
const rateLimit = require('express-rate-limit');

// Webhook delivery timeout in milliseconds
const WEBHOOK_TIMEOUT_MS = 10000;

// Rate limiter for webhook operations
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    console.error('WARNING: JWT_SECRET is not set in environment variables. Using insecure fallback.');
  }

  jwt.verify(token, JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Apply authentication to all routes
router.use(authenticateToken);

// Apply rate limiting to all routes
router.use(webhookLimiter);

// Get all webhooks
router.get('/', async (req, res) => {
  try {
    const webhooks = await db.query(
      `SELECT id, name, url, events, is_active, last_triggered, created_at 
       FROM webhooks 
       WHERE created_by = ? 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Parse events JSON
    webhooks.forEach(webhook => {
      webhook.events = webhook.events ? JSON.parse(webhook.events) : [];
    });

    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Get webhook by ID
router.get('/:id', async (req, res) => {
  try {
    const webhook = await db.get(
      'SELECT * FROM webhooks WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    webhook.events = webhook.events ? JSON.parse(webhook.events) : [];

    res.json(webhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

// Create new webhook
router.post('/', async (req, res) => {
  const { name, url, events } = req.body;

  if (!name || !url || !events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Name, URL, and events array are required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const id = uuidv4();
    const secret = crypto.randomBytes(32).toString('hex');

    await db.run(
      `INSERT INTO webhooks (id, name, url, events, secret, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        url,
        JSON.stringify(events),
        secret,
        req.user.id
      ]
    );

    const newWebhook = await db.get('SELECT * FROM webhooks WHERE id = ?', [id]);
    newWebhook.events = JSON.parse(newWebhook.events);
    
    res.status(201).json(newWebhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Update webhook
router.put('/:id', async (req, res) => {
  const { name, url, events, is_active } = req.body;

  try {
    const existing = await db.get(
      'SELECT * FROM webhooks WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    await db.run(
      `UPDATE webhooks 
       SET name = ?, url = ?, events = ?, is_active = ?
       WHERE id = ?`,
      [
        name !== undefined ? name : existing.name,
        url !== undefined ? url : existing.url,
        events !== undefined ? JSON.stringify(events) : existing.events,
        is_active !== undefined ? is_active : existing.is_active,
        req.params.id
      ]
    );

    const updated = await db.get('SELECT * FROM webhooks WHERE id = ?', [req.params.id]);
    updated.events = JSON.parse(updated.events);
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Test webhook
router.post('/:id/test', async (req, res) => {
  try {
    const webhook = await db.get(
      'SELECT * FROM webhooks WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Send test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from FormForce'
      }
    };

    const result = await deliverWebhook(webhook, testPayload);
    
    res.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Get webhook delivery history
router.get('/:id/deliveries', async (req, res) => {
  try {
    const deliveries = await db.query(
      `SELECT * FROM webhook_deliveries 
       WHERE webhook_id = ? 
       ORDER BY delivered_at DESC 
       LIMIT 100`,
      [req.params.id]
    );

    res.json(deliveries);
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
});

// Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT * FROM webhooks WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await db.run('DELETE FROM webhooks WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Deliver webhook (helper function)
async function deliverWebhook(webhook, payload) {
  const deliveryId = uuidv4();
  const deliveredAt = new Date().toISOString();

  try {
    // Create signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send webhook
    const response = await axios.post(webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-FormForce-Signature': signature,
        'X-FormForce-Delivery': deliveryId,
        'X-FormForce-Event': payload.event
      },
      timeout: WEBHOOK_TIMEOUT_MS
    });

    // Log successful delivery
    await db.run(
      `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, response_status, response_body, delivered_at, succeeded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deliveryId,
        webhook.id,
        payload.event,
        JSON.stringify(payload),
        response.status,
        JSON.stringify(response.data),
        deliveredAt,
        1
      ]
    );

    // Update last triggered
    await db.run(
      'UPDATE webhooks SET last_triggered = CURRENT_TIMESTAMP WHERE id = ?',
      [webhook.id]
    );

    return {
      success: true,
      status: response.status,
      deliveryId: deliveryId
    };

  } catch (error) {
    // Log failed delivery
    await db.run(
      `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, response_status, error_message, delivered_at, succeeded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deliveryId,
        webhook.id,
        payload.event,
        JSON.stringify(payload),
        error.response?.status || 0,
        error.message,
        deliveredAt,
        0
      ]
    );

    return {
      success: false,
      error: error.message,
      deliveryId: deliveryId
    };
  }
}

// Trigger webhooks for an event
async function triggerWebhooks(event, data) {
  try {
    // Validate event parameter to prevent SQL injection
    if (typeof event !== 'string' || !event.match(/^[a-zA-Z0-9._-]+$/)) {
      console.error('Invalid event name:', event);
      return;
    }

    const webhooks = await db.query(
      `SELECT * FROM webhooks 
       WHERE is_active = 1 AND events LIKE ?`,
      [`%"${event}"%`]
    );

    const payload = {
      event: event,
      timestamp: new Date().toISOString(),
      data: data
    };

    // Deliver to all matching webhooks
    const deliveryPromises = webhooks.map(webhook => deliverWebhook(webhook, payload));
    await Promise.allSettled(deliveryPromises);

  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

// Export trigger function
router.triggerWebhooks = triggerWebhooks;

module.exports = router;
