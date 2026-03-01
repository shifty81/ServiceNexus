const express = require('express');
const router = express.Router();
const db = require('../database');
const os = require('os');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/admin/health - System health for remote monitoring (public for monitoring tools)
router.get('/health', async (req, res) => {
  try {
    const dbCheck = await db.get('SELECT 1 AS ok');
    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbCheck ? 'connected' : 'error',
      tables: tables.map(t => t.name),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: os.platform(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({ status: 'unhealthy', error: 'System health check failed' });
  }
});

// GET /api/admin/users - List all users with stats
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.query(`
      SELECT
        u.id, u.username, u.email, u.role, u.user_type, u.created_at,
        (SELECT COUNT(*) FROM time_entries WHERE user_id = u.id) AS timeEntryCount,
        (SELECT COUNT(*) FROM service_calls WHERE assigned_to = u.id) AS serviceCallCount,
        (SELECT ROUND(AVG(rating), 1) FROM feedback WHERE technician_id = u.id) AS averageRating
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id - Update user role/type
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, user_type } = req.body;
    const { id } = req.params;

    if (!role && !user_type) {
      return res.status(400).json({ error: 'Provide role or user_type to update' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newRole = role || user.role;
    const newType = user_type || user.user_type;

    await db.run(
      'UPDATE users SET role = ?, user_type = ? WHERE id = ?',
      [newRole, newType, id]
    );

    const updated = await db.get(
      'SELECT id, username, email, role, user_type, created_at FROM users WHERE id = ?',
      [id]
    );

    const io = req.app.get('io');
    if (io) io.emit('user-updated', updated);

    res.json(updated);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);

    const io = req.app.get('io');
    if (io) io.emit('user-deleted', { id });

    res.json({ message: 'User deleted', id });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/stats - Database table row counts
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ALLOWED_TABLES = new Set([
      'users', 'forms', 'form_submissions', 'dispatches', 'inventory',
      'customers', 'estimates', 'invoices', 'time_entries', 'service_calls',
      'feedback', 'integrations', 'api_keys', 'webhooks', 'purchase_orders',
      'equipment', 'qr_codes'
    ]);

    const counts = {};
    for (const table of ALLOWED_TABLES) {
      try {
        const row = await db.get('SELECT COUNT(*) AS count FROM "' + table.replace(/"/g, '') + '"');
        counts[table] = row.count;
      } catch {
        counts[table] = 0;
      }
    }

    res.json({
      tableCounts: counts,
      totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// GET /api/admin/config - Current server configuration (non-sensitive)
router.get('/config', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    trustProxy: process.env.TRUST_PROXY === 'true',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    version: require('../../package.json').version
  });
});

// Default branding / theme settings
const DEFAULT_SETTINGS = {
  brandName: 'ServiceNexus',
  brandTagline: 'AI-Powered Mobile Forms for Any Device',
  brandLogo: '',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
  navbarBg: '#1e293b',
  navbarText: '#ffffff'
};

// GET /api/admin/settings - Retrieve all branding / theme settings
router.get('/settings', async (req, res) => {
  try {
    const rows = await db.query('SELECT key, value FROM settings');
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings - Update branding / theme settings
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      await db.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, String(value)]
      );
    }

    // Return the full merged settings
    const rows = await db.query('SELECT key, value FROM settings');
    const settings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    const io = req.app.get('io');
    if (io) io.emit('settings-updated', settings);

    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
