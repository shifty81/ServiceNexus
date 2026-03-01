/**
 * Notifications API Tests
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
  v4: () => 'test-notification-id'
}));

const notificationsRouter = require('./routes/notifications');

// Generate a valid auth token for testing
const userToken = jwt.sign({ id: 'u1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/notifications', notificationsRouter);
  return app;
};

describe('Notifications API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    test('should return all notifications', async () => {
      mockDb.query.mockResolvedValue([
        { id: '1', type: 'reminder', message: 'Appointment tomorrow' }
      ]);

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should filter by user_id', async () => {
      mockDb.query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/notifications?user_id=u1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
    });

    test('should filter unread only', async () => {
      mockDb.query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/notifications?unread=true')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
    });

    test('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/notifications');
      expect(response.status).toBe(401);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/notifications', () => {
    test('should create a notification', async () => {
      const notif = {
        id: 'test-notification-id',
        type: 'reminder',
        message: 'Service due tomorrow',
        channel: 'in_app'
      };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(notif);

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'reminder', message: 'Service due tomorrow' });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe('reminder');
    });

    test('should return 400 when required fields missing', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'reminder' });

      expect(response.status).toBe(400);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'reminder', message: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    test('should mark notification as read', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/notifications/1/read')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notification marked as read');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/notifications/1/read')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/notifications/read-all/:userId', () => {
    test('should mark all user notifications as read', async () => {
      mockDb.run.mockResolvedValue({ changes: 5 });

      const response = await request(app)
        .put('/api/notifications/read-all/u1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
    });

    test('should return 403 when marking another users notifications', async () => {
      const response = await request(app)
        .put('/api/notifications/read-all/other-user')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/notifications/unread-count/:userId', () => {
    test('should return unread count', async () => {
      mockDb.get.mockResolvedValue({ count: 3 });

      const response = await request(app)
        .get('/api/notifications/unread-count/u1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/notifications/unread-count/u1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    test('should delete a notification', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .delete('/api/notifications/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .delete('/api/notifications/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(500);
    });
  });
});
