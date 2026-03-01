/**
 * Admin API Tests
 * Tests for the system administration endpoints
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

// Mock database module
const mockDb = {
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
};

jest.mock('./database', () => mockDb);

const adminRouter = require('./routes/admin');

// Generate a valid admin token for testing
const adminToken = jwt.sign({ id: 'admin-1', username: 'admin', role: 'admin', user_type: 'admin' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/admin', adminRouter);
  return app;
};

describe('Admin API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/health', () => {
    test('should return healthy status', async () => {
      mockDb.get.mockResolvedValue({ ok: 1 });
      mockDb.query.mockResolvedValue([{ name: 'users' }, { name: 'forms' }]);

      const response = await request(app).get('/api/admin/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
      expect(response.body.tables).toContain('users');
      expect(response.body.uptime).toBeDefined();
    });

    test('should return 503 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/admin/health');
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('GET /api/admin/users', () => {
    test('should return list of users with stats', async () => {
      const mockUsers = [
        { id: 'u1', username: 'admin', email: 'a@b.com', role: 'admin', user_type: 'admin', timeEntryCount: 5, serviceCallCount: 10, averageRating: 4.5 }
      ];
      mockDb.query.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].username).toBe('admin');
    });

    test('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/admin/users');
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    test('should update user role', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 'u1', role: 'user', user_type: 'admin' })
        .mockResolvedValueOnce({ id: 'u1', username: 'test', role: 'admin', user_type: 'admin' });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/admin/users/u1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('admin');
    });

    test('should return 400 without role or user_type', async () => {
      const response = await request(app)
        .put('/api/admin/users/u1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(response.status).toBe(400);
    });

    test('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/admin/users/bad-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    test('should delete user', async () => {
      mockDb.get.mockResolvedValue({ id: 'u1', username: 'test' });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .delete('/api/admin/users/u1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User deleted');
    });

    test('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/admin/users/bad-id')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(404);
    });

    test('should return 401 without auth token', async () => {
      const response = await request(app).delete('/api/admin/users/u1');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/stats', () => {
    test('should return table counts', async () => {
      mockDb.get.mockResolvedValue({ count: 5 });

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.tableCounts).toBeDefined();
      expect(response.body.totalRecords).toBeDefined();
    });
  });

  describe('GET /api/admin/config', () => {
    test('should return server configuration', async () => {
      const response = await request(app)
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.version).toBeDefined();
      expect(response.body.nodeEnv).toBeDefined();
      expect(response.body.port).toBeDefined();
    });

    test('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/admin/config');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/settings', () => {
    test('should return default settings when no overrides exist', async () => {
      mockDb.query.mockResolvedValue([]);

      const response = await request(app).get('/api/admin/settings');
      expect(response.status).toBe(200);
      expect(response.body.brandName).toBe('ServiceNexus');
      expect(response.body.primaryColor).toBe('#2563eb');
      expect(response.body.navbarBg).toBe('#1e293b');
    });

    test('should merge stored overrides with defaults', async () => {
      mockDb.query.mockResolvedValue([
        { key: 'brandName', value: 'Acme Corp' },
        { key: 'primaryColor', value: '#ff0000' }
      ]);

      const response = await request(app).get('/api/admin/settings');
      expect(response.status).toBe(200);
      expect(response.body.brandName).toBe('Acme Corp');
      expect(response.body.primaryColor).toBe('#ff0000');
      // Default values still present
      expect(response.body.navbarBg).toBe('#1e293b');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/admin/settings');
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/admin/settings', () => {
    test('should save and return updated settings', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.query.mockResolvedValue([
        { key: 'brandName', value: 'NewBrand' },
        { key: 'primaryColor', value: '#00ff00' }
      ]);

      const response = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ brandName: 'NewBrand', primaryColor: '#00ff00' });

      expect(response.status).toBe(200);
      expect(response.body.brandName).toBe('NewBrand');
      expect(response.body.primaryColor).toBe('#00ff00');
    });

    test('should ignore unknown keys', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.query.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unknownKey: 'value', brandName: 'Test' });

      expect(response.status).toBe(200);
      // run should have been called for brandName only
      expect(mockDb.run).toHaveBeenCalledTimes(1);
    });

    test('should emit settings-updated via socket', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.query.mockResolvedValue([{ key: 'brandName', value: 'Test' }]);

      const response = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ brandName: 'Test' });

      expect(response.status).toBe(200);
      const io = app.get('io');
      expect(io.emit).toHaveBeenCalledWith('settings-updated', expect.objectContaining({ brandName: 'Test' }));
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ brandName: 'Fail' });

      expect(response.status).toBe(500);
    });

    test('should return 401 without auth token', async () => {
      const response = await request(app)
        .put('/api/admin/settings')
        .send({ brandName: 'Test' });
      expect(response.status).toBe(401);
    });
  });
});
