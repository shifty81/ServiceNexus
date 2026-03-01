/**
 * Invoices API Tests
 * Tests for the invoicing system
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
  v4: () => 'test-invoice-id'
}));

const invoicesRouter = require('./routes/invoices');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/invoices', invoicesRouter);
  return app;
};

describe('Invoices API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/invoices', () => {
    test('should return all invoices', async () => {
      const mockInvoices = [
        { id: '1', invoice_number: 'INV-2025-0001', title: 'Service A', total: 100 },
        { id: '2', invoice_number: 'INV-2025-0002', title: 'Service B', total: 200 }
      ];
      mockDb.query.mockResolvedValue(mockInvoices);

      const response = await request(app).get('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch invoices');
    });
  });

  describe('GET /api/invoices/:id', () => {
    test('should return a single invoice', async () => {
      const mockInvoice = { id: '1', invoice_number: 'INV-2025-0001', title: 'Service A', total: 100 };
      mockDb.get.mockResolvedValue(mockInvoice);

      const response = await request(app).get('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('1');
      expect(response.body.title).toBe('Service A');
    });

    test('should return 404 if invoice not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/invoices/non-existent')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch invoice');
    });
  });

  describe('POST /api/invoices', () => {
    test('should create an invoice successfully', async () => {
      const lineItems = JSON.stringify([
        { description: 'Labor', quantity: 2, unit_price: 50 },
        { description: 'Parts', quantity: 1, unit_price: 30 }
      ]);

      const newInvoice = {
        id: 'test-invoice-id',
        invoice_number: `INV-${new Date().getFullYear()}-0001`,
        customer_id: 'cust-1',
        title: 'Repair Job',
        subtotal: 130,
        tax_rate: 10,
        tax_amount: 13,
        total: 143,
        status: 'pending'
      };

      // First db.query call: generateInvoiceNumber count
      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);
      // db.run for INSERT
      mockDb.run.mockResolvedValue({ id: 1 });
      // db.get for returning the new invoice
      mockDb.get.mockResolvedValue(newInvoice);

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: 'cust-1',
          title: 'Repair Job',
          description: 'Fix broken pipe',
          line_items: lineItems,
          tax_rate: 10,
          due_date: '2025-12-31',
          notes: 'Urgent'
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('test-invoice-id');
      expect(response.body.total).toBe(143);
    });

    test('should return 400 if customer_id is missing', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Invoice' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Customer and title are required');
    });

    test('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customer_id: 'cust-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Customer and title are required');
    });

    test('should create invoice with empty line_items', async () => {
      const newInvoice = {
        id: 'test-invoice-id',
        invoice_number: `INV-${new Date().getFullYear()}-0001`,
        customer_id: 'cust-1',
        title: 'Consultation',
        subtotal: 0,
        total: 0,
        status: 'pending'
      };

      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newInvoice);

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: 'cust-1',
          title: 'Consultation'
        });

      expect(response.status).toBe(201);
      expect(response.body.subtotal).toBe(0);
    });

    test('should emit socket event on creation', async () => {
      const newInvoice = { id: 'test-invoice-id', title: 'Socket Test' };

      mockDb.query.mockResolvedValueOnce([{ count: 0 }]);
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newInvoice);

      await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customer_id: 'cust-1', title: 'Socket Test' });

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('invoice:created', newInvoice);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customer_id: 'cust-1', title: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create invoice');
    });
  });

  describe('PUT /api/invoices/:id', () => {
    test('should update an invoice successfully', async () => {
      const lineItems = JSON.stringify([
        { description: 'Labor', quantity: 3, unit_price: 60 }
      ]);

      const updatedInvoice = {
        id: '1',
        customer_id: 'cust-1',
        title: 'Updated Job',
        subtotal: 180,
        tax_rate: 5,
        tax_amount: 9,
        total: 189,
        status: 'pending'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedInvoice);

      const response = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: 'cust-1',
          title: 'Updated Job',
          description: 'Updated description',
          line_items: lineItems,
          tax_rate: 5,
          status: 'pending'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Job');
      expect(response.body.total).toBe(189);
    });

    test('should return 400 if customer_id is missing', async () => {
      const response = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Customer and title are required');
    });

    test('should return 400 if title is missing', async () => {
      const response = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customer_id: 'cust-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Customer and title are required');
    });

    test('should emit socket event on update', async () => {
      const updatedInvoice = { id: '1', title: 'Socket Update Test' };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedInvoice);

      await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customer_id: 'cust-1', title: 'Socket Update Test' });

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('invoice:updated', updatedInvoice);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ customer_id: 'cust-1', title: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update invoice');
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    test('should delete an invoice successfully', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Invoice deleted successfully');
    });

    test('should emit socket event on deletion', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await request(app).delete('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`);

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('invoice:deleted', '1');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/invoices/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete invoice');
    });
  });

  describe('POST /api/invoices/:id/payment', () => {
    test('should record a partial payment successfully', async () => {
      const invoice = { id: '1', total: 200, amount_paid: 0 };
      const updatedInvoice = { id: '1', total: 200, amount_paid: 50, status: 'partial' };

      mockDb.get
        .mockResolvedValueOnce(invoice)       // fetch invoice
        .mockResolvedValueOnce(updatedInvoice); // return updated
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50 });

      expect(response.status).toBe(200);
      expect(response.body.amount_paid).toBe(50);
      expect(response.body.status).toBe('partial');
    });

    test('should mark invoice as paid when fully paid', async () => {
      const invoice = { id: '1', total: 100, amount_paid: 50 };
      const updatedInvoice = { id: '1', total: 100, amount_paid: 100, status: 'paid' };

      mockDb.get
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce(updatedInvoice);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('paid');
      expect(response.body.amount_paid).toBe(100);
    });

    test('should return 400 if amount is missing', async () => {
      const response = await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid payment amount is required');
    });

    test('should return 400 if amount is zero', async () => {
      const response = await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid payment amount is required');
    });

    test('should return 400 if amount is negative', async () => {
      const response = await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid payment amount is required');
    });

    test('should return 404 if invoice not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/invoices/non-existent/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });

    test('should emit socket event on payment', async () => {
      const invoice = { id: '1', total: 100, amount_paid: 0 };
      const updatedInvoice = { id: '1', total: 100, amount_paid: 100, status: 'paid' };

      mockDb.get
        .mockResolvedValueOnce(invoice)
        .mockResolvedValueOnce(updatedInvoice);
      mockDb.run.mockResolvedValue({ changes: 1 });

      await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100 });

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('invoice:updated', updatedInvoice);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/invoices/1/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to record payment');
    });
  });
});
