/**
 * Integrations API Tests
 * Tests for the integration connectors, test-connection, and sync endpoints
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

// Mock database module
const mockDb = {
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
};

jest.mock('./database', () => mockDb);

const integrationsRouter = require('./routes/integrations');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/integrations', integrationsRouter);
  return app;
};

const authHeader = () => {
  const token = jwt.sign({ id: 'user1', username: 'tester' }, JWT_SECRET);
  return `Bearer ${token}`;
};

describe('Integrations API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Authentication ---

  describe('Authentication', () => {
    test('should reject requests without auth token', async () => {
      const res = await request(app).get('/api/integrations');
      expect(res.status).toBe(401);
    });
  });

  // --- CRUD ---

  describe('GET /api/integrations', () => {
    test('should return list of integrations', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'i1', name: 'My QB', type: 'quickbooks', status: 'active' }
      ]);

      const res = await request(app)
        .get('/api/integrations')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].type).toBe('quickbooks');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/integrations')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/integrations', () => {
    test('should create integration', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue({ id: 'i1', name: 'QB', type: 'quickbooks', status: 'inactive' });

      const res = await request(app)
        .post('/api/integrations')
        .set('Authorization', authHeader())
        .send({ name: 'QB', type: 'quickbooks' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('quickbooks');
    });

    test('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/integrations')
        .set('Authorization', authHeader())
        .send({ type: 'quickbooks' });

      expect(res.status).toBe(400);
    });

    test('should reject missing type', async () => {
      const res = await request(app)
        .post('/api/integrations')
        .set('Authorization', authHeader())
        .send({ name: 'QB' });

      expect(res.status).toBe(400);
    });
  });

  // --- Test Connection ---

  describe('POST /api/integrations/:id/test', () => {
    const validCredentials = JSON.stringify({
      client_id: 'cid', client_secret: 'cs', refresh_token: 'rt'
    });

    test('should succeed for quickbooks with valid credentials', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i1', type: 'quickbooks',
        credentials: validCredentials,
        config: JSON.stringify({ company_id: '123' }),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i1/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('QuickBooks');
    });

    test('should fail for quickbooks with missing credentials', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i1', type: 'quickbooks',
        credentials: JSON.stringify({}),
        config: JSON.stringify({}),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i1/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Missing credentials');
    });

    test('should succeed for salesforce with valid credentials', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i2', type: 'salesforce',
        credentials: validCredentials,
        config: JSON.stringify({ instance_url: 'https://na1.salesforce.com' }),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i2/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Salesforce');
    });

    test('should succeed for google with valid credentials', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i3', type: 'google',
        credentials: validCredentials,
        config: JSON.stringify({ scopes: 'calendar,contacts' }),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i3/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Google');
    });

    test('should succeed for microsoft365 with valid credentials', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i4', type: 'microsoft365',
        credentials: validCredentials,
        config: JSON.stringify({ tenant_id: 'tenant-abc' }),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i4/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Microsoft 365');
    });

    test('should succeed for procore with valid credentials', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i5', type: 'procore',
        credentials: validCredentials,
        config: JSON.stringify({ company_id: 'pc-999' }),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i5/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Procore');
    });

    test('should return failure for unknown type', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i6', type: 'unknown',
        credentials: JSON.stringify({}),
        config: JSON.stringify({}),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i6/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });

    test('should return 404 for missing integration', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/integrations/missing/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
    });
  });

  // --- Sync ---

  describe('POST /api/integrations/:id/sync', () => {
    const validCredentials = JSON.stringify({
      client_id: 'cid', client_secret: 'cs', refresh_token: 'rt'
    });

    test('should sync quickbooks integration', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i1', type: 'quickbooks', status: 'active',
        credentials: validCredentials,
        config: JSON.stringify({ company_id: '123' }),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });
      // Connector calls db.query twice (customers + invoices)
      mockDb.query
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([{ id: 'inv1' }]);

      const res = await request(app)
        .post('/api/integrations/i1/sync')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.records_processed).toBe(2);
    });

    test('should reject sync for inactive integration', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i1', type: 'quickbooks', status: 'inactive',
        created_by: 'user1'
      });

      const res = await request(app)
        .post('/api/integrations/i1/sync')
        .set('Authorization', authHeader());

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not active');
    });

    test('should return 404 for missing integration', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/integrations/missing/sync')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
    });

    test('should handle sync failure gracefully', async () => {
      mockDb.get.mockResolvedValue({
        id: 'i1', type: 'quickbooks', status: 'active',
        credentials: JSON.stringify({}),
        config: JSON.stringify({}),
        created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/integrations/i1/sync')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });
  });

  // --- Connector unit tests ---

  describe('Connector validation', () => {
    const quickbooks = require('./connectors/quickbooks');
    const salesforce = require('./connectors/salesforce');
    const google = require('./connectors/google');
    const microsoft365 = require('./connectors/microsoft365');
    const procore = require('./connectors/procore');

    test('quickbooks requires company_id config', () => {
      const result = quickbooks.validateCredentials(
        { client_id: 'a', client_secret: 'b', refresh_token: 'c' },
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.message).toContain('company_id');
    });

    test('salesforce requires instance_url config', () => {
      const result = salesforce.validateCredentials(
        { client_id: 'a', client_secret: 'b', refresh_token: 'c' },
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.message).toContain('instance_url');
    });

    test('google requires scopes config', () => {
      const result = google.validateCredentials(
        { client_id: 'a', client_secret: 'b', refresh_token: 'c' },
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.message).toContain('scopes');
    });

    test('microsoft365 requires tenant_id config', () => {
      const result = microsoft365.validateCredentials(
        { client_id: 'a', client_secret: 'b', refresh_token: 'c' },
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.message).toContain('tenant_id');
    });

    test('procore requires company_id config', () => {
      const result = procore.validateCredentials(
        { client_id: 'a', client_secret: 'b', refresh_token: 'c' },
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.message).toContain('company_id');
    });

    test('all connectors accept valid credentials and config', async () => {
      const creds = { client_id: 'a', client_secret: 'b', refresh_token: 'c' };
      expect((await quickbooks.testConnection(creds, { company_id: '1' })).success).toBe(true);
      expect((await salesforce.testConnection(creds, { instance_url: 'https://x.salesforce.com' })).success).toBe(true);
      expect((await google.testConnection(creds, { scopes: 'calendar' })).success).toBe(true);
      expect((await microsoft365.testConnection(creds, { tenant_id: 't1' })).success).toBe(true);
      expect((await procore.testConnection(creds, { company_id: '1' })).success).toBe(true);
    });
  });
});
