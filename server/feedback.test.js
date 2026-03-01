/**
 * Feedback API Tests
 * Tests for the customer feedback/rating system
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
  v4: () => 'test-feedback-id'
}));

const feedbackRouter = require('./routes/feedback');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/feedback', feedbackRouter);
  return app;
};

describe('Feedback API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/feedback', () => {
    test('should return all feedback', async () => {
      const mockFeedback = [
        { id: '1', rating: 5, comment: 'Great service', service_call_title: 'Fix AC' },
        { id: '2', rating: 4, comment: 'Good work', service_call_title: 'Repair heater' }
      ];
      mockDb.query.mockResolvedValue(mockFeedback);

      const response = await request(app).get('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch feedback');
    });
  });

  describe('GET /api/feedback/servicecall/:serviceCallId', () => {
    test('should return feedback for a service call', async () => {
      const mockFb = { id: '1', rating: 5, comment: 'Excellent' };
      mockDb.get.mockResolvedValue(mockFb);

      const response = await request(app).get('/api/feedback/servicecall/sc-123')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.rating).toBe(5);
    });

    test('should return null when no feedback exists', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/feedback/servicecall/sc-999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('GET /api/feedback/technician/:technicianId', () => {
    test('should return feedback and stats for technician', async () => {
      const mockFeedback = [
        { rating: 5, comment: 'Great' },
        { rating: 4, comment: 'Good' }
      ];
      mockDb.query.mockResolvedValue(mockFeedback);

      const response = await request(app).get('/api/feedback/technician/tech-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.stats.totalReviews).toBe(2);
      expect(response.body.stats.averageRating).toBe(4.5);
    });

    test('should return zero stats when no feedback', async () => {
      mockDb.query.mockResolvedValue([]);

      const response = await request(app).get('/api/feedback/technician/tech-new')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.stats.totalReviews).toBe(0);
      expect(response.body.stats.averageRating).toBe(0);
    });
  });

  describe('POST /api/feedback', () => {
    test('should submit feedback successfully', async () => {
      const serviceCall = { id: 'sc-1', status: 'completed', assigned_to: 'tech-1' };
      mockDb.get
        .mockResolvedValueOnce(serviceCall)  // service call lookup
        .mockResolvedValueOnce(undefined)    // existing feedback check
        .mockResolvedValueOnce({ id: 'test-feedback-id', rating: 5, comment: 'Excellent' }); // new feedback
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-1',
          rating: 5,
          comment: 'Excellent',
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(201);
      expect(response.body.rating).toBe(5);
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    test('should reject invalid rating', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-1',
          rating: 6,
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Rating must be');
    });

    test('should reject rating of 0', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-1',
          rating: 0,
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(400);
    });

    test('should reject non-integer rating', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-1',
          rating: 3.5,
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('integer');
    });

    test('should reject feedback for non-existent service call', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-invalid',
          rating: 5,
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    test('should reject feedback for non-completed service call', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 'sc-1', status: 'in-progress' });

      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-1',
          rating: 5,
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('completed');
    });

    test('should reject duplicate feedback for same service call', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 'sc-1', status: 'completed' })
        .mockResolvedValueOnce({ id: 'existing-feedback' });

      const response = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_call_id: 'sc-1',
          rating: 5,
          submitted_by: 'user-1'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already submitted');
    });
  });

  describe('GET /api/feedback/stats/summary', () => {
    test('should return technician summary stats', async () => {
      const mockStats = [
        { technician_id: 't1', technician_name: 'John', total_reviews: 10, average_rating: 4.5 }
      ];
      mockDb.query.mockResolvedValue(mockStats);

      const response = await request(app).get('/api/feedback/stats/summary')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].technician_name).toBe('John');
    });
  });
});
