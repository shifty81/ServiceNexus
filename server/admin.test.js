/**
 * Admin API Tests
 * Tests for the system administration endpoints
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Mock database module
const mockDb = {
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
};

jest.mock('./database', () => mockDb);

const adminRouter = require('./routes/admin');

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

      const response = await request(app).get('/api/admin/users');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].username).toBe('admin');
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
        .send({ role: 'admin' });
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('admin');
    });

    test('should return 400 without role or user_type', async () => {
      const response = await request(app)
        .put('/api/admin/users/u1')
        .send({});
      expect(response.status).toBe(400);
    });

    test('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/admin/users/bad-id')
        .send({ role: 'admin' });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    test('should delete user', async () => {
      mockDb.get.mockResolvedValue({ id: 'u1', username: 'test' });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/admin/users/u1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User deleted');
    });

    test('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/admin/users/bad-id');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/stats', () => {
    test('should return table counts', async () => {
      mockDb.get.mockResolvedValue({ count: 5 });

      const response = await request(app).get('/api/admin/stats');
      expect(response.status).toBe(200);
      expect(response.body.tableCounts).toBeDefined();
      expect(response.body.totalRecords).toBeDefined();
    });
  });

  describe('GET /api/admin/config', () => {
    test('should return server configuration', async () => {
      const response = await request(app).get('/api/admin/config');
      expect(response.status).toBe(200);
      expect(response.body.version).toBeDefined();
      expect(response.body.nodeEnv).toBeDefined();
      expect(response.body.port).toBeDefined();
    });
  });
});
