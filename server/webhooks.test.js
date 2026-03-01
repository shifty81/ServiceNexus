/**
 * Webhooks API Tests
 * Tests for webhook CRUD, test delivery, and delivery history endpoints
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
jest.mock('uuid', () => ({ v4: () => 'test-webhook-id' }));
jest.mock('axios');

const axios = require('axios');
const webhooksRouter = require('./routes/webhooks');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/webhooks', webhooksRouter);
  return app;
};

const authHeader = () => {
  const token = jwt.sign({ id: 'user1', username: 'tester' }, JWT_SECRET);
  return `Bearer ${token}`;
};

describe('Webhooks API', () => {
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
      const res = await request(app).get('/api/webhooks');
      expect(res.status).toBe(401);
    });
  });

  // --- GET / ---

  describe('GET /api/webhooks', () => {
    test('should return list of webhooks with parsed events', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'w1', name: 'Hook1', url: 'https://example.com/hook', events: '["customer.created"]', is_active: 1 },
        { id: 'w2', name: 'Hook2', url: 'https://example.com/hook2', events: null, is_active: 0 }
      ]);

      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].events).toEqual(['customer.created']);
      expect(res.body[1].events).toEqual([]);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch webhooks');
    });
  });

  // --- GET /:id ---

  describe('GET /api/webhooks/:id', () => {
    test('should return a single webhook with parsed events', async () => {
      mockDb.get.mockResolvedValue({
        id: 'w1', name: 'Hook1', url: 'https://example.com/hook',
        events: '["customer.created","ticket.updated"]', is_active: 1, created_by: 'user1'
      });

      const res = await request(app)
        .get('/api/webhooks/w1')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('w1');
      expect(res.body.events).toEqual(['customer.created', 'ticket.updated']);
    });

    test('should return 404 when webhook not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/webhooks/missing')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Webhook not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/webhooks/w1')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch webhook');
    });
  });

  // --- POST / ---

  describe('POST /api/webhooks', () => {
    test('should create a new webhook', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue({
        id: 'test-webhook-id', name: 'New Hook', url: 'https://example.com/hook',
        events: '["customer.created"]', secret: 'abc123', created_by: 'user1'
      });

      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', authHeader())
        .send({ name: 'New Hook', url: 'https://example.com/hook', events: ['customer.created'] });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('test-webhook-id');
      expect(res.body.events).toEqual(['customer.created']);
    });

    test('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', authHeader())
        .send({ name: 'Hook' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name, URL, and events array are required');
    });

    test('should return 400 for invalid URL format', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', authHeader())
        .send({ name: 'Hook', url: 'not-a-url', events: ['customer.created'] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid URL format');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', authHeader())
        .send({ name: 'Hook', url: 'https://example.com/hook', events: ['customer.created'] });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create webhook');
    });
  });

  // --- PUT /:id ---

  describe('PUT /api/webhooks/:id', () => {
    test('should update an existing webhook', async () => {
      mockDb.get
        .mockResolvedValueOnce({
          id: 'w1', name: 'Old Name', url: 'https://example.com/old',
          events: '["customer.created"]', is_active: 1, created_by: 'user1'
        })
        .mockResolvedValueOnce({
          id: 'w1', name: 'New Name', url: 'https://example.com/new',
          events: '["ticket.updated"]', is_active: 1, created_by: 'user1'
        });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .put('/api/webhooks/w1')
        .set('Authorization', authHeader())
        .send({ name: 'New Name', url: 'https://example.com/new', events: ['ticket.updated'] });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.events).toEqual(['ticket.updated']);
    });

    test('should return 404 when webhook not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/webhooks/missing')
        .set('Authorization', authHeader())
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Webhook not found');
    });

    test('should return 400 for invalid URL format', async () => {
      mockDb.get.mockResolvedValue({
        id: 'w1', name: 'Hook', url: 'https://example.com/hook',
        events: '["customer.created"]', is_active: 1, created_by: 'user1'
      });

      const res = await request(app)
        .put('/api/webhooks/w1')
        .set('Authorization', authHeader())
        .send({ url: 'bad-url' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid URL format');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .put('/api/webhooks/w1')
        .set('Authorization', authHeader())
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update webhook');
    });
  });

  // --- POST /:id/test ---

  describe('POST /api/webhooks/:id/test', () => {
    test('should test webhook delivery successfully', async () => {
      mockDb.get.mockResolvedValue({
        id: 'w1', name: 'Hook', url: 'https://example.com/hook',
        events: '["customer.created"]', secret: 'secret123', created_by: 'user1'
      });
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      mockDb.run.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post('/api/webhooks/w1/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe(200);
      expect(res.body.deliveryId).toBe('test-webhook-id');
      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ event: 'webhook.test' }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-ServiceNexus-Signature': expect.any(String),
            'X-ServiceNexus-Delivery': 'test-webhook-id'
          })
        })
      );
    });

    test('should return 404 when webhook not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/webhooks/missing/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Webhook not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/webhooks/w1/test')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to test webhook');
    });
  });

  // --- GET /:id/deliveries ---

  describe('GET /api/webhooks/:id/deliveries', () => {
    test('should return delivery history', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'd1', webhook_id: 'w1', event: 'customer.created', succeeded: 1 },
        { id: 'd2', webhook_id: 'w1', event: 'webhook.test', succeeded: 0 }
      ]);

      const res = await request(app)
        .get('/api/webhooks/w1/deliveries')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('d1');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/webhooks/w1/deliveries')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch webhook deliveries');
    });
  });

  // --- DELETE /:id ---

  describe('DELETE /api/webhooks/:id', () => {
    test('should delete a webhook', async () => {
      mockDb.get.mockResolvedValue({
        id: 'w1', name: 'Hook', url: 'https://example.com/hook', created_by: 'user1'
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .delete('/api/webhooks/w1')
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Webhook deleted successfully');
    });

    test('should return 404 when webhook not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/webhooks/missing')
        .set('Authorization', authHeader());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Webhook not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .delete('/api/webhooks/w1')
        .set('Authorization', authHeader());

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete webhook');
    });
  });
});
