/**
 * Estimates API Tests
 * Tests for the estimates/quoting system
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
  v4: () => 'test-estimate-id'
}));

const estimatesRouter = require('./routes/estimates');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/estimates', estimatesRouter);
  return app;
};

describe('Estimates API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/estimates', () => {
    test('should return all estimates', async () => {
      const mockEstimates = [
        { id: '1', title: 'Estimate A', total: 100 },
        { id: '2', title: 'Estimate B', total: 200 }
      ];
      mockDb.query.mockResolvedValue(mockEstimates);

      const response = await request(app).get('/api/estimates');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/estimates');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch estimates');
    });
  });

  describe('GET /api/estimates/:id', () => {
    test('should return a single estimate', async () => {
      const mockEstimate = { id: '1', title: 'Estimate A', total: 100 };
      mockDb.get.mockResolvedValue(mockEstimate);

      const response = await request(app).get('/api/estimates/1');
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Estimate A');
    });

    test('should return 404 if estimate not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/estimates/nonexistent');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Estimate not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/estimates/1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch estimate');
    });
  });

  describe('POST /api/estimates', () => {
    const year = new Date().getFullYear();

    test('should create an estimate successfully', async () => {
      const lineItems = JSON.stringify([
        { description: 'Service A', quantity: 2, unit_price: 50 },
        { description: 'Service B', quantity: 1, unit_price: 100 }
      ]);

      // generateEstimateNumber calls db.query
      mockDb.query.mockResolvedValue([{ count: 0 }]);
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue({
        id: 'test-estimate-id',
        estimate_number: `EST-${year}-0001`,
        title: 'Test Estimate',
        subtotal: 200,
        total: 200
      });

      const response = await request(app)
        .post('/api/estimates')
        .send({
          customer_id: 'cust-1',
          title: 'Test Estimate',
          description: 'Test description',
          line_items: lineItems,
          tax_rate: 0
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('test-estimate-id');
      expect(mockDb.run).toHaveBeenCalled();
    });

    test('should return 400 if customer_id is missing', async () => {
      const response = await request(app)
        .post('/api/estimates')
        .send({ title: 'Test Estimate' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    test('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/api/estimates')
        .send({ customer_id: 'cust-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    test('should calculate totals from line items', async () => {
      const lineItems = JSON.stringify([
        { description: 'Item', quantity: 3, unit_price: 100 }
      ]);

      mockDb.query.mockResolvedValue([{ count: 5 }]);
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue({
        id: 'test-estimate-id',
        subtotal: 300,
        tax_amount: 30,
        total: 330
      });

      const response = await request(app)
        .post('/api/estimates')
        .send({
          customer_id: 'cust-1',
          title: 'Tax Estimate',
          line_items: lineItems,
          tax_rate: 10
        });

      expect(response.status).toBe(201);
      // Verify db.run was called with correct calculated totals
      const runArgs = mockDb.run.mock.calls[0][1];
      expect(runArgs).toContain(300);  // subtotal
      expect(runArgs).toContain(30);   // tax_amount
      expect(runArgs).toContain(330);  // total
    });

    test('should emit socket event on creation', async () => {
      mockDb.query.mockResolvedValue([{ count: 0 }]);
      mockDb.run.mockResolvedValue({ id: 1 });
      const createdEstimate = { id: 'test-estimate-id', title: 'Socket Test' };
      mockDb.get.mockResolvedValue(createdEstimate);

      await request(app)
        .post('/api/estimates')
        .send({
          customer_id: 'cust-1',
          title: 'Socket Test'
        });

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('estimate:created', createdEstimate);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/estimates')
        .send({
          customer_id: 'cust-1',
          title: 'Error Estimate'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create estimate');
    });
  });

  describe('PUT /api/estimates/:id', () => {
    test('should update an estimate successfully', async () => {
      const lineItems = JSON.stringify([
        { description: 'Updated Service', quantity: 1, unit_price: 150 }
      ]);

      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue({
        id: '1',
        title: 'Updated Estimate',
        subtotal: 150,
        total: 150
      });

      const response = await request(app)
        .put('/api/estimates/1')
        .send({
          customer_id: 'cust-1',
          title: 'Updated Estimate',
          line_items: lineItems,
          tax_rate: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Estimate');
    });

    test('should return 400 if customer_id is missing', async () => {
      const response = await request(app)
        .put('/api/estimates/1')
        .send({ title: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    test('should return 400 if title is missing', async () => {
      const response = await request(app)
        .put('/api/estimates/1')
        .send({ customer_id: 'cust-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    test('should recalculate totals on update', async () => {
      const lineItems = JSON.stringify([
        { description: 'Item', quantity: 2, unit_price: 200 }
      ]);

      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue({
        id: '1',
        subtotal: 400,
        tax_amount: 20,
        total: 420
      });

      const response = await request(app)
        .put('/api/estimates/1')
        .send({
          customer_id: 'cust-1',
          title: 'Recalc Estimate',
          line_items: lineItems,
          tax_rate: 5
        });

      expect(response.status).toBe(200);
      const runArgs = mockDb.run.mock.calls[0][1];
      expect(runArgs).toContain(400);  // subtotal
      expect(runArgs).toContain(20);   // tax_amount
      expect(runArgs).toContain(420);  // total
    });

    test('should emit socket event on update', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });
      const updatedEstimate = { id: '1', title: 'Updated' };
      mockDb.get.mockResolvedValue(updatedEstimate);

      await request(app)
        .put('/api/estimates/1')
        .send({
          customer_id: 'cust-1',
          title: 'Updated'
        });

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('estimate:updated', updatedEstimate);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/estimates/1')
        .send({
          customer_id: 'cust-1',
          title: 'Error Estimate'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update estimate');
    });
  });

  describe('DELETE /api/estimates/:id', () => {
    test('should delete an estimate successfully', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app).delete('/api/estimates/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Estimate deleted successfully');
    });

    test('should emit socket event on delete', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });

      await request(app).delete('/api/estimates/1');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('estimate:deleted', '1');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/estimates/1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete estimate');
    });
  });

  describe('POST /api/estimates/:id/convert-to-invoice', () => {
    const year = new Date().getFullYear();

    test('should convert estimate to invoice successfully', async () => {
      const mockEstimate = {
        id: 'est-1',
        customer_id: 'cust-1',
        title: 'Estimate to Convert',
        description: 'Description',
        subtotal: 200,
        tax_rate: 10,
        tax_amount: 20,
        total: 220,
        line_items: '[]',
        notes: 'Some notes'
      };
      const mockInvoice = {
        id: 'test-estimate-id',
        invoice_number: `INV-${year}-0001`,
        customer_id: 'cust-1',
        title: 'Estimate to Convert',
        status: 'pending',
        total: 220
      };

      mockDb.get
        .mockResolvedValueOnce(mockEstimate)   // fetch estimate
        .mockResolvedValueOnce(mockInvoice);    // fetch created invoice
      mockDb.query.mockResolvedValue([{ count: 0 }]); // invoice number generation
      mockDb.run
        .mockResolvedValueOnce({ id: 1 })      // INSERT invoice
        .mockResolvedValueOnce({ id: 1 });      // UPDATE estimate status

      const response = await request(app)
        .post('/api/estimates/est-1/convert-to-invoice');

      expect(response.status).toBe(201);
      expect(response.body.invoice_number).toBe(`INV-${year}-0001`);
      expect(response.body.status).toBe('pending');
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    test('should return 404 if estimate not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/estimates/nonexistent/convert-to-invoice');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Estimate not found');
    });

    test('should emit socket events on conversion', async () => {
      const mockEstimate = {
        id: 'est-1',
        customer_id: 'cust-1',
        title: 'Socket Estimate',
        description: '',
        subtotal: 100,
        tax_rate: 0,
        tax_amount: 0,
        total: 100,
        line_items: '[]',
        notes: ''
      };
      const mockInvoice = {
        id: 'test-estimate-id',
        invoice_number: `INV-${year}-0001`,
        status: 'pending'
      };

      mockDb.get
        .mockResolvedValueOnce(mockEstimate)
        .mockResolvedValueOnce(mockInvoice);
      mockDb.query.mockResolvedValue([{ count: 0 }]);
      mockDb.run
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 });

      await request(app)
        .post('/api/estimates/est-1/convert-to-invoice');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('invoice:created', mockInvoice);
      expect(mockIo.emit).toHaveBeenCalledWith('estimate:updated', { ...mockEstimate, status: 'accepted' });
    });

    test('should generate correct invoice number', async () => {
      const mockEstimate = {
        id: 'est-1',
        customer_id: 'cust-1',
        title: 'Numbered Estimate',
        description: '',
        subtotal: 100,
        tax_rate: 0,
        tax_amount: 0,
        total: 100,
        line_items: '[]',
        notes: ''
      };

      mockDb.get
        .mockResolvedValueOnce(mockEstimate)
        .mockResolvedValueOnce({ id: 'test-estimate-id', invoice_number: `INV-${year}-0006` });
      mockDb.query.mockResolvedValue([{ count: 5 }]); // 5 existing invoices
      mockDb.run
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 1 });

      const response = await request(app)
        .post('/api/estimates/est-1/convert-to-invoice');

      expect(response.status).toBe(201);
      // Verify the invoice_number passed to db.run INSERT
      const insertArgs = mockDb.run.mock.calls[0][1];
      expect(insertArgs).toContain(`INV-${year}-0006`);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/estimates/est-1/convert-to-invoice');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to convert estimate to invoice');
    });
  });
});
