const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Apply authentication to all routes
router.use(authenticateToken);

// Generate API key
function generateApiKey() {
  return 'ff_' + crypto.randomBytes(32).toString('hex');
}

// Hash API key
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Get all API keys (without showing actual keys)
router.get('/', async (req, res) => {
  try {
    const apiKeys = await db.query(
      `SELECT id, name, key_prefix, permissions, last_used, expires_at, is_active, created_at 
       FROM api_keys 
       WHERE created_by = ? 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Parse permissions JSON
    apiKeys.forEach(key => {
      key.permissions = key.permissions ? JSON.parse(key.permissions) : [];
    });

    res.json(apiKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create new API key
router.post('/', async (req, res) => {
  const { name, permissions, expiresIn } = req.body;

  if (!name || !permissions) {
    return res.status(400).json({ error: 'Name and permissions are required' });
  }

  try {
    const id = uuidv4();
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 10) + '...';

    // Calculate expiration date
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
    }

    await db.run(
      `INSERT INTO api_keys (id, name, key_hash, key_prefix, permissions, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        keyHash,
        keyPrefix,
        JSON.stringify(permissions),
        expiresAt ? expiresAt.toISOString() : null,
        req.user.id
      ]
    );

    const newKey = await db.get('SELECT * FROM api_keys WHERE id = ?', [id]);
    
    // Return the actual key only once on creation
    res.status(201).json({
      id: newKey.id,
      name: newKey.name,
      key: apiKey, // Only returned on creation
      key_prefix: newKey.key_prefix,
      permissions: JSON.parse(newKey.permissions),
      expires_at: newKey.expires_at,
      is_active: newKey.is_active,
      created_at: newKey.created_at
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Update API key (permissions, active status, etc.)
router.put('/:id', async (req, res) => {
  const { name, permissions, is_active } = req.body;

  try {
    const existing = await db.get(
      'SELECT * FROM api_keys WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await db.run(
      `UPDATE api_keys 
       SET name = ?, permissions = ?, is_active = ?
       WHERE id = ?`,
      [
        name !== undefined ? name : existing.name,
        permissions !== undefined ? JSON.stringify(permissions) : existing.permissions,
        is_active !== undefined ? is_active : existing.is_active,
        req.params.id
      ]
    );

    const updated = await db.get('SELECT * FROM api_keys WHERE id = ?', [req.params.id]);
    updated.permissions = JSON.parse(updated.permissions);
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Delete API key
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT * FROM api_keys WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await db.run('DELETE FROM api_keys WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Validate API key (for API authentication)
async function validateApiKey(key) {
  try {
    const keyHash = hashApiKey(key);
    const apiKey = await db.get(
      `SELECT * FROM api_keys 
       WHERE key_hash = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [keyHash]
    );

    if (!apiKey) {
      return null;
    }

    // Update last used timestamp
    await db.run(
      'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
      [apiKey.id]
    );

    apiKey.permissions = JSON.parse(apiKey.permissions);
    return apiKey;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

// Export validation function
router.validateApiKey = validateApiKey;

module.exports = router;
