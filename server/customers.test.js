/**
 * Customers API Tests
 * Tests for the customer management system
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
  v4: () => 'test-customer-id'
}));

const customersRouter = require('./routes/customers');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/customers', customersRouter);
  return app;
};

describe('Customers API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/customers', () => {
    test('should return all customers', async () => {
      const mockCustomers = [
        { id: '1', contact_name: 'John Doe', company_name: 'Acme Corp' },
        { id: '2', contact_name: 'Jane Smith', company_name: 'Tech Inc' }
      ];
      mockDb.query.mockResolvedValue(mockCustomers);

      const response = await request(app).get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch customers');
    });
  });

  describe('GET /api/customers/:id', () => {
    test('should return a single customer', async () => {
      const mockCustomer = { id: '1', contact_name: 'John Doe', company_name: 'Acme Corp' };
      mockDb.get.mockResolvedValue(mockCustomer);

      const response = await request(app).get('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.contact_name).toBe('John Doe');
    });

    test('should return 404 when customer not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/customers/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Customer not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch customer');
    });
  });

  describe('POST /api/customers', () => {
    test('should create a customer successfully', async () => {
      const newCustomer = {
        id: 'test-customer-id',
        company_name: 'Acme Corp',
        contact_name: 'John Doe',
        email: 'john@acme.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        notes: 'Important client'
      };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newCustomer);

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Acme Corp',
          contact_name: 'John Doe',
          email: 'john@acme.com',
          phone: '555-1234',
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          notes: 'Important client'
        });

      expect(response.status).toBe(201);
      expect(response.body.contact_name).toBe('John Doe');
      expect(app.get('io').emit).toHaveBeenCalledWith('customer:created', newCustomer);
    });

    test('should return 400 when contact_name is missing', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ company_name: 'Acme Corp' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Contact name is required');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contact_name: 'John Doe' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create customer');
    });
  });

  describe('PUT /api/customers/:id', () => {
    test('should update a customer successfully', async () => {
      const updatedCustomer = {
        id: '1',
        company_name: 'Acme Corp Updated',
        contact_name: 'John Doe',
        email: 'john@acme.com',
        phone: '555-5678',
        address: '456 Oak Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        notes: 'Updated notes'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedCustomer);

      const response = await request(app)
        .put('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Acme Corp Updated',
          contact_name: 'John Doe',
          email: 'john@acme.com',
          phone: '555-5678',
          address: '456 Oak Ave',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          notes: 'Updated notes'
        });

      expect(response.status).toBe(200);
      expect(response.body.company_name).toBe('Acme Corp Updated');
      expect(app.get('io').emit).toHaveBeenCalledWith('customer:updated', updatedCustomer);
    });

    test('should return 400 when contact_name is missing', async () => {
      const response = await request(app)
        .put('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ company_name: 'Acme Corp' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Contact name is required');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contact_name: 'John Doe' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update customer');
    });
  });

  describe('DELETE /api/customers/:id', () => {
    test('should delete a customer successfully', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Customer deleted successfully');
      expect(app.get('io').emit).toHaveBeenCalledWith('customer:deleted', '1');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/customers/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete customer');
    });
  });

  describe('GET /api/customers/search/:query', () => {
    test('should search customers', async () => {
      const mockCustomers = [
        { id: '1', contact_name: 'John Doe', company_name: 'Acme Corp' }
      ];
      mockDb.query.mockResolvedValue(mockCustomers);

      const response = await request(app).get('/api/customers/search/John')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].contact_name).toBe('John Doe');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/customers/search/test')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search customers');
    });
  });
});
