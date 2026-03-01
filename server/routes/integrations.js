const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const { getConnector } = require('../connectors');

// Rate limiter for integration operations
const integrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many integration requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication and attach io to all routes
router.use(authenticateToken);
router.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

// Apply rate limiting to all routes
router.use(integrationLimiter);

// Get all integrations
router.get('/', async (req, res) => {
  try {
    const integrations = await db.query(
      'SELECT id, name, type, status, last_sync, sync_status, created_at, updated_at FROM integrations WHERE created_by = ?',
      [req.user.id]
    );

    res.json(integrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Get integration by ID
router.get('/:id', async (req, res) => {
  try {
    const integration = await db.get(
      'SELECT * FROM integrations WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Parse JSON fields
    integration.config = integration.config ? JSON.parse(integration.config) : {};
    integration.credentials = integration.credentials ? JSON.parse(integration.credentials) : {};

    // Don't send sensitive credentials to client
    delete integration.credentials;

    res.json(integration);
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

// Create new integration
router.post('/', async (req, res) => {
  const { name, type, config, credentials } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO integrations (id, name, type, status, config, credentials, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        type,
        'inactive',
        JSON.stringify(config || {}),
        JSON.stringify(credentials || {}),
        req.user.id
      ]
    );

    const newIntegration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
    
    req.io.emit('integration-created', { integration: newIntegration });
    
    res.status(201).json(newIntegration);
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// Update integration
router.put('/:id', async (req, res) => {
  const { name, type, status, config, credentials } = req.body;

  try {
    const existing = await db.get(
      'SELECT * FROM integrations WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await db.run(
      `UPDATE integrations 
       SET name = ?, type = ?, status = ?, config = ?, credentials = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || existing.name,
        type || existing.type,
        status || existing.status,
        config ? JSON.stringify(config) : existing.config,
        credentials ? JSON.stringify(credentials) : existing.credentials,
        req.params.id
      ]
    );

    const updated = await db.get('SELECT * FROM integrations WHERE id = ?', [req.params.id]);
    
    req.io.emit('integration-updated', { integration: updated });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// Test integration connection
router.post('/:id/test', async (req, res) => {
  try {
    const integration = await db.get(
      'SELECT * FROM integrations WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Parse credentials
    const credentials = integration.credentials ? JSON.parse(integration.credentials) : {};
    const config = integration.config ? JSON.parse(integration.config) : {};

    // Test connection using the appropriate connector
    const connector = getConnector(integration.type);
    let testResult;
    if (connector) {
      testResult = await connector.testConnection(credentials, config);
    } else {
      testResult = { success: false, message: 'Unknown integration type' };
    }

    // Update integration status based on test
    await db.run(
      `UPDATE integrations SET sync_status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [testResult.success ? 'healthy' : 'error', testResult.message, req.params.id]
    );

    res.json(testResult);
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

// Trigger manual sync
router.post('/:id/sync', async (req, res) => {
  try {
    const integration = await db.get(
      'SELECT * FROM integrations WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (integration.status !== 'active') {
      return res.status(400).json({ error: 'Integration is not active' });
    }

    // Create sync log entry
    const syncLogId = uuidv4();
    await db.run(
      `INSERT INTO integration_sync_logs (id, integration_id, sync_type, status, started_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [syncLogId, req.params.id, 'manual', 'running']
    );

    // Run sync through connector
    const connector = getConnector(integration.type);
    let syncResult;
    if (connector) {
      try {
        syncResult = await connector.sync(integration, db);
      } catch (err) {
        syncResult = { success: false, records_processed: 0, records_succeeded: 0, records_failed: 0, error: err.message };
      }
    } else {
      syncResult = { success: false, records_processed: 0, records_succeeded: 0, records_failed: 0, error: 'Unknown integration type' };
    }

    // Update sync log with results
    await db.run(
      `UPDATE integration_sync_logs SET status = ?, records_processed = ?, records_succeeded = ?, records_failed = ?, error_details = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        syncResult.success ? 'completed' : 'failed',
        syncResult.records_processed || 0,
        syncResult.records_succeeded || 0,
        syncResult.records_failed || 0,
        syncResult.error || null,
        syncLogId
      ]
    );

    // Update last sync time
    await db.run(
      `UPDATE integrations SET last_sync = CURRENT_TIMESTAMP, sync_status = ? WHERE id = ?`,
      [syncResult.success ? 'healthy' : 'error', req.params.id]
    );

    res.json({
      message: syncResult.success ? 'Sync completed successfully' : 'Sync completed with errors',
      syncLogId,
      ...syncResult
    });

  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// Get sync history for an integration
router.get('/:id/sync-logs', async (req, res) => {
  try {
    const logs = await db.query(
      `SELECT * FROM integration_sync_logs 
       WHERE integration_id = ? 
       ORDER BY started_at DESC 
       LIMIT 50`,
      [req.params.id]
    );

    res.json(logs);
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
});

// Delete integration
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT * FROM integrations WHERE id = ? AND created_by = ?',
      [req.params.id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await db.run('DELETE FROM integrations WHERE id = ?', [req.params.id]);
    
    req.io.emit('integration-deleted', { integrationId: req.params.id });
    
    res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

module.exports = router;
