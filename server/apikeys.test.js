/**
 * API Keys Route Tests
 * Tests for CRUD operations on API keys
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

const mockDb = {
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
};

jest.mock('./database', () => mockDb);
jest.mock('uuid', () => ({ v4: () => 'test-apikey-id' }));

const apikeysRouter = require('./routes/apikeys');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/apikeys', apikeysRouter);
  return app;
};

const authHeader = () => {
  const token = jwt.sign({ id: 'user1', username: 'tester' }, JWT_SECRET);
  return `Bearer ${token}`;
};

describe('API Keys API', () => {
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
      const res = await request(app).get('/api/apikeys');
      expect(res.status).toBe(401);
    });
  });

  // --- GET / ---

  describe('GET /api/apikeys', () => {
    test('should return all API keys for the user', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'k1', name: 'My Key', key_prefix: 'ff_abc123...', permissions: '["read","write"]', last_used: null, expires_at: null, is_active: 1, created_at: '2024-01-01' },
        { id: 'k2', name: 'Other Key', key_prefix: 'ff_def456...', permissions: '["read"]', last_used: null, expires_at: null, is_active: 1, created_at: '2024-01-02' }
      ]);

      const res = await request(app)
        .get('/api/apikeys')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('My Key');
      expect(res.body[0].permissions).toEqual(['read', 'write']);
      expect(res.body[1].permissions).toEqual(['read']);
    });

    test('should handle keys with null permissions', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'k1', name: 'Key', key_prefix: 'ff_abc...', permissions: null, is_active: 1, created_at: '2024-01-01' }
      ]);

      const res = await request(app)
        .get('/api/apikeys')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body[0].permissions).toEqual([]);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/apikeys')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch API keys');
    });
  });

  // --- POST / ---

  describe('POST /api/apikeys', () => {
    test('should create a new API key', async () => {
      mockDb.run.mockResolvedValue({ id: 'test-apikey-id', changes: 1 });
      mockDb.get.mockResolvedValue({
        id: 'test-apikey-id',
        name: 'New Key',
        key_prefix: 'ff_abc123ab...',
        permissions: '["read","write"]',
        expires_at: null,
        is_active: 1,
        created_at: '2024-01-01'
      });

      const res = await request(app)
        .post('/api/apikeys')
        .set('Authorization', authHeader())
        .send({ name: 'New Key', permissions: ['read', 'write'] });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('test-apikey-id');
      expect(res.body.name).toBe('New Key');
      expect(res.body.key).toMatch(/^ff_/);
      expect(res.body.permissions).toEqual(['read', 'write']);
    });

    test('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/apikeys')
        .set('Authorization', authHeader())
        .send({ permissions: ['read'] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name and permissions are required');
    });

    test('should return 400 when permissions are missing', async () => {
      const res = await request(app)
        .post('/api/apikeys')
        .set('Authorization', authHeader())
        .send({ name: 'Key Without Perms' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name and permissions are required');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/apikeys')
        .set('Authorization', authHeader())
        .send({ name: 'Key', permissions: ['read'] });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create API key');
    });
  });

  // --- PUT /:id ---

  describe('PUT /api/apikeys/:id', () => {
    test('should update an existing API key', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 'k1', name: 'Old Name', permissions: '["read"]', is_active: 1, created_by: 'user1' })
        .mockResolvedValueOnce({ id: 'k1', name: 'Updated Name', permissions: '["read","write"]', is_active: 1 });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .put('/api/apikeys/k1')
        .set('Authorization', authHeader())
        .send({ name: 'Updated Name', permissions: ['read', 'write'] });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.permissions).toEqual(['read', 'write']);
    });

    test('should return 404 when API key not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/apikeys/nonexistent')
        .set('Authorization', authHeader())
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('API key not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .put('/api/apikeys/k1')
        .set('Authorization', authHeader())
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update API key');
    });
  });

  // --- DELETE /:id ---

  describe('DELETE /api/apikeys/:id', () => {
    test('should delete an API key', async () => {
      mockDb.get.mockResolvedValue({ id: 'k1', name: 'Key', created_by: 'user1' });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .delete('/api/apikeys/k1')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('API key deleted successfully');
    });

    test('should return 404 when API key not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/apikeys/nonexistent')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('API key not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .delete('/api/apikeys/k1')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete API key');
    });
  });
});
