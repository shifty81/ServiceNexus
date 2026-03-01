/**
 * Routing API Tests
 * Tests for the smart routing and auto-assignment endpoints
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

const routingRouter = require('./routes/routing');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/routing', routingRouter);
  return app;
};

describe('Routing API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/routing', () => {
    test('should return suggestions array', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          { id: 'sc1', customer_id: 'c1', status: 'pending', assigned_to: null, customer_name: 'Acme Corp' }
        ]) // unassigned calls
        .mockResolvedValueOnce([
          { id: 'u1', username: 'tech1', user_type: 'technician' }
        ]) // technicians
        .mockResolvedValueOnce([]) // workloads
        .mockResolvedValueOnce([]) // callStats
        .mockResolvedValueOnce([]) // ratings
        .mockResolvedValueOnce([]); // activeEntries

      const response = await request(app).get('/api/routing');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].serviceCall).toBeDefined();
      expect(response.body[0].suggestedTechnician).toBeDefined();
      expect(response.body[0].score).toBeDefined();
      expect(response.body[0].factors).toBeDefined();
    });

    test('should return empty array when no unassigned calls', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no unassigned calls

      const response = await request(app).get('/api/routing');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/routing/technician-scores', () => {
    test('should return technician scores array', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          { id: 'u1', username: 'tech1', user_type: 'technician' }
        ]) // technicians
        .mockResolvedValueOnce([{ assigned_to: 'u1', count: 2 }]) // workloads
        .mockResolvedValueOnce([{ assigned_to: 'u1', total: 10, completed: 8 }]) // callStats
        .mockResolvedValueOnce([{ technician_id: 'u1', avg_rating: 4.5 }]) // ratings
        .mockResolvedValueOnce([]); // activeEntries

      const response = await request(app).get('/api/routing/technician-scores');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].technician.username).toBe('tech1');
      expect(response.body[0].overallScore).toBeDefined();
      expect(response.body[0].factors).toBeDefined();
      expect(response.body[0].activeCallCount).toBe(2);
      expect(response.body[0].completedCallCount).toBe(8);
      expect(response.body[0].averageRating).toBe(4.5);
      expect(response.body[0].availabilityStatus).toBe('available');
    });

    test('should return empty array when no technicians', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no technicians

      const response = await request(app).get('/api/routing/technician-scores');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/routing/auto-assign', () => {
    test('should assign service call to best technician', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 'sc1', status: 'pending', assigned_to: null }) // service call lookup
        .mockResolvedValueOnce({ id: 'sc1', status: 'pending', assigned_to: 'u1', assigned_to_name: 'tech1' }); // updated call

      mockDb.query
        .mockResolvedValueOnce([{ id: 'u1', username: 'tech1', user_type: 'technician' }]) // technicians
        .mockResolvedValueOnce([]) // workloads
        .mockResolvedValueOnce([]) // callStats
        .mockResolvedValueOnce([]) // ratings
        .mockResolvedValueOnce([]); // activeEntries

      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/routing/auto-assign')
        .send({ service_call_id: 'sc1' });
      expect(response.status).toBe(200);
      expect(response.body.serviceCall).toBeDefined();
      expect(response.body.assignedTo).toBeDefined();
      expect(response.body.assignedTo.username).toBe('tech1');
      expect(response.body.score).toBeDefined();
      expect(response.body.factors).toBeDefined();
    });

    test('should return 400 when service_call_id is missing', async () => {
      const response = await request(app)
        .post('/api/routing/auto-assign')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('service_call_id is required');
    });

    test('should return 404 when service call not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/routing/auto-assign')
        .send({ service_call_id: 'nonexistent' });
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service call not found');
    });
  });

  describe('Error handling', () => {
    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/routing');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get routing suggestions');
    });
  });
});
