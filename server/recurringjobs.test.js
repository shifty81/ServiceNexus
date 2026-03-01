/**
 * Recurring Jobs API Tests
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
  v4: () => 'test-recurring-id'
}));

const recurringJobsRouter = require('./routes/recurringjobs');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/recurringjobs', recurringJobsRouter);
  return app;
};

describe('Recurring Jobs API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recurringjobs', () => {
    test('should return all recurring jobs', async () => {
      const mockJobs = [
        { id: '1', title: 'Monthly HVAC Filter Change', frequency: 'monthly' }
      ];
      mockDb.query.mockResolvedValue(mockJobs);

      const response = await request(app).get('/api/recurringjobs')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/recurringjobs')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/recurringjobs/:id', () => {
    test('should return a single recurring job', async () => {
      mockDb.get.mockResolvedValue({ id: '1', title: 'Weekly Inspection' });

      const response = await request(app).get('/api/recurringjobs/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Weekly Inspection');
    });

    test('should return 404 when not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/recurringjobs/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/recurringjobs/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/recurringjobs', () => {
    test('should create a recurring job', async () => {
      const newJob = {
        id: 'test-recurring-id',
        customer_id: 'c1',
        title: 'Monthly Maintenance',
        frequency: 'monthly',
        next_due_date: '2026-04-01'
      };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newJob);

      const response = await request(app)
        .post('/api/recurringjobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: 'c1',
          title: 'Monthly Maintenance',
          frequency: 'monthly',
          next_due_date: '2026-04-01'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Monthly Maintenance');
    });

    test('should return 400 when required fields missing', async () => {
      const response = await request(app)
        .post('/api/recurringjobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test' });

      expect(response.status).toBe(400);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/recurringjobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: 'c1',
          title: 'Test',
          frequency: 'monthly',
          next_due_date: '2026-04-01'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/recurringjobs/:id', () => {
    test('should update a recurring job', async () => {
      const updated = { id: '1', title: 'Updated Job', frequency: 'weekly' };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updated);

      const response = await request(app)
        .put('/api/recurringjobs/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Job', frequency: 'weekly' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Job');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/recurringjobs/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/recurringjobs/:id', () => {
    test('should delete a recurring job', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/recurringjobs/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Recurring job deleted successfully');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/recurringjobs/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/recurringjobs/:id/generate', () => {
    test('should generate a dispatch from recurring job', async () => {
      const job = {
        id: '1', title: 'Monthly HVAC', customer_id: 'c1',
        next_due_date: '2026-03-01', frequency: 'monthly',
        assigned_to: 'tech1', priority: 'normal'
      };
      const customer = { id: 'c1', address: '123 Main St' };

      mockDb.get
        .mockResolvedValueOnce(job)      // fetch job
        .mockResolvedValueOnce(customer); // fetch customer
      mockDb.run
        .mockResolvedValueOnce({ id: 1 }) // insert dispatch
        .mockResolvedValueOnce({ changes: 1 }); // update job next_due_date

      const response = await request(app).post('/api/recurringjobs/1/generate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(201);
      expect(response.body.dispatchId).toBeDefined();
      expect(response.body.nextDueDate).toBe('2026-04-01');
    });

    test('should return 404 when job not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).post('/api/recurringjobs/999/generate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/api/recurringjobs/1/generate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
    });
  });
});
