/**
 * Tags API Tests
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

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-tag-id'
}));

const tagsRouter = require('./routes/tags');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/tags', tagsRouter);
  return app;
};

describe('Tags API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tags', () => {
    test('should return all tags', async () => {
      mockDb.query.mockResolvedValue([
        { id: '1', name: 'VIP', color: '#ef4444' },
        { id: '2', name: 'Recurring', color: '#6366f1' }
      ]);

      const response = await request(app).get('/api/tags')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/tags')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/tags', () => {
    test('should create a tag', async () => {
      const tag = { id: 'test-tag-id', name: 'VIP', color: '#ef4444' };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(tag);

      const response = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'VIP', color: '#ef4444' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('VIP');
    });

    test('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ color: '#ef4444' });

      expect(response.status).toBe(400);
    });

    test('should use default color', async () => {
      const tag = { id: 'test-tag-id', name: 'Test', color: '#6366f1' };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(tag);

      const response = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(201);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/tags/:id', () => {
    test('should update a tag', async () => {
      const updated = { id: '1', name: 'Updated', color: '#22c55e' };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updated);

      const response = await request(app)
        .put('/api/tags/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated', color: '#22c55e' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/tags/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/tags/:id', () => {
    test('should delete a tag and its assignments', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/tags/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tag deleted successfully');
      // Should call run twice: once for tag_assignments, once for tags
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/tags/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/tags/assign', () => {
    test('should assign a tag to an entity', async () => {
      mockDb.get.mockResolvedValue(undefined); // no existing assignment
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/tags/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tag_id: 't1', entity_type: 'customer', entity_id: 'c1' });

      expect(response.status).toBe(201);
    });

    test('should return 409 for duplicate assignment', async () => {
      mockDb.get.mockResolvedValue({ id: 'existing' });

      const response = await request(app)
        .post('/api/tags/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tag_id: 't1', entity_type: 'customer', entity_id: 'c1' });

      expect(response.status).toBe(409);
    });

    test('should return 400 when required fields missing', async () => {
      const response = await request(app)
        .post('/api/tags/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tag_id: 't1' });

      expect(response.status).toBe(400);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/tags/assign')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tag_id: 't1', entity_type: 'customer', entity_id: 'c1' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/tags/assign/:tag_id/:entity_type/:entity_id', () => {
    test('should remove a tag assignment', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/tags/assign/t1/customer/c1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/tags/assign/t1/customer/c1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/tags/entity/:entity_type/:entity_id', () => {
    test('should return tags for an entity', async () => {
      mockDb.query.mockResolvedValue([{ id: 't1', name: 'VIP', color: '#ef4444' }]);

      const response = await request(app).get('/api/tags/entity/customer/c1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/tags/entity/customer/c1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/tags/:id/entities', () => {
    test('should return all entities for a tag', async () => {
      mockDb.query.mockResolvedValue([
        { tag_id: 't1', entity_type: 'customer', entity_id: 'c1' }
      ]);

      const response = await request(app).get('/api/tags/t1/entities')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/tags/t1/entities')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });
});
