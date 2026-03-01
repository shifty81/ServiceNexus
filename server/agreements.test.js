/**
 * Service Agreements API Tests
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

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-agreement-id'
}));

const agreementsRouter = require('./routes/agreements');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/agreements', agreementsRouter);
  return app;
};

describe('Service Agreements API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/agreements', () => {
    test('should return all service agreements', async () => {
      const mockAgreements = [
        { id: '1', title: 'HVAC Annual Maintenance', status: 'active', customer_id: 'c1' }
      ];
      mockDb.query.mockResolvedValue(mockAgreements);

      const response = await request(app).get('/api/agreements');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/agreements');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch service agreements');
    });
  });

  describe('GET /api/agreements/:id', () => {
    test('should return a single agreement', async () => {
      const mockAgreement = { id: '1', title: 'Plumbing Contract', status: 'active' };
      mockDb.get.mockResolvedValue(mockAgreement);

      const response = await request(app).get('/api/agreements/1');
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Plumbing Contract');
    });

    test('should return 404 when agreement not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/agreements/999');
      expect(response.status).toBe(404);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/agreements/1');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/agreements', () => {
    test('should create a service agreement', async () => {
      const newAgreement = {
        id: 'test-agreement-id',
        customer_id: 'c1',
        title: 'HVAC Maintenance',
        start_date: '2026-01-01',
        status: 'active'
      };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newAgreement);

      const response = await request(app)
        .post('/api/agreements')
        .send({
          customer_id: 'c1',
          title: 'HVAC Maintenance',
          start_date: '2026-01-01'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('HVAC Maintenance');
      expect(app.get('io').emit).toHaveBeenCalledWith('agreement:created', newAgreement);
    });

    test('should return 400 when required fields missing', async () => {
      const response = await request(app)
        .post('/api/agreements')
        .send({ title: 'Test' });

      expect(response.status).toBe(400);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/agreements')
        .send({ customer_id: 'c1', title: 'Test', start_date: '2026-01-01' });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/agreements/:id', () => {
    test('should update an agreement', async () => {
      const updated = { id: '1', title: 'Updated Agreement', status: 'expired' };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updated);

      const response = await request(app)
        .put('/api/agreements/1')
        .send({ title: 'Updated Agreement', status: 'expired' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Agreement');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/agreements/1')
        .send({ title: 'Test' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/agreements/:id', () => {
    test('should delete an agreement', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/agreements/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service agreement deleted successfully');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/agreements/1');
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/agreements/customer/:customerId', () => {
    test('should return agreements for a customer', async () => {
      mockDb.query.mockResolvedValue([{ id: '1', customer_id: 'c1', title: 'Test' }]);

      const response = await request(app).get('/api/agreements/customer/c1');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/agreements/customer/c1');
      expect(response.status).toBe(500);
    });
  });
});
