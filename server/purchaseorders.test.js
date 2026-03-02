/**
 * Purchase Orders API Tests
 * Tests for the purchase orders management system
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
  v4: () => 'test-po-id'
}));

const purchaseOrdersRouter = require('./routes/purchaseorders');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/purchase-orders', purchaseOrdersRouter);
  return app;
};

describe('Purchase Orders API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/purchase-orders', () => {
    test('should return all purchase orders', async () => {
      const mockPOs = [
        { id: '1', po_number: 'PO-2025-0001', vendor_name: 'Vendor A', status: 'draft' },
        { id: '2', po_number: 'PO-2025-0002', vendor_name: 'Vendor B', status: 'approved' }
      ];
      mockDb.query.mockResolvedValue(mockPOs);

      const response = await request(app).get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should filter by status query param', async () => {
      const mockPOs = [
        { id: '1', po_number: 'PO-2025-0001', vendor_name: 'Vendor A', status: 'approved' }
      ];
      mockDb.query.mockResolvedValue(mockPOs);

      const response = await request(app).get('/api/purchase-orders?status=approved')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND po.status = ?'),
        ['approved']
      );
    });

    test('should filter by service_call_id query param', async () => {
      const mockPOs = [
        { id: '1', po_number: 'PO-2025-0001', service_call_id: 'sc-1' }
      ];
      mockDb.query.mockResolvedValue(mockPOs);

      const response = await request(app).get('/api/purchase-orders?service_call_id=sc-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND po.service_call_id = ?'),
        ['sc-1']
      );
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch purchase orders');
    });
  });

  describe('GET /api/purchase-orders/:id', () => {
    test('should return a single purchase order', async () => {
      const mockPO = { id: 'po-1', po_number: 'PO-2025-0001', vendor_name: 'Vendor A' };
      mockDb.get.mockResolvedValue(mockPO);

      const response = await request(app).get('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.po_number).toBe('PO-2025-0001');
    });

    test('should return 404 if purchase order not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/purchase-orders/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Purchase order not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch purchase order');
    });
  });

  describe('POST /api/purchase-orders', () => {
    const newPO = {
      service_call_id: 'sc-1',
      vendor_name: 'Vendor A',
      vendor_contact: 'John Doe',
      vendor_phone: '555-1234',
      vendor_email: 'john@vendor.com',
      line_items: JSON.stringify([{ quantity: 2, unit_price: 50 }, { quantity: 1, unit_price: 100 }]),
      notes: 'Urgent order',
      requested_by: 'user-1'
    };

    test('should create a purchase order successfully', async () => {
      const createdPO = {
        id: 'test-po-id',
        po_number: 'PO-2025-0001',
        vendor_name: 'Vendor A',
        subtotal: 200,
        total: 200,
        status: 'draft'
      };

      // First db.get call: generatePONumber lookup (no existing POs)
      mockDb.get
        .mockResolvedValueOnce(null)       // generatePONumber: no last PO
        .mockResolvedValueOnce(createdPO); // fetch newly created PO
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPO);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-po-id');
      expect(response.body.vendor_name).toBe('Vendor A');

      // Verify socket emission
      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('purchase-order-changed', createdPO);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPO);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create purchase order');
    });

    test('should apply custom tax_rate when provided', async () => {
      const poWithTax = {
        ...newPO,
        tax_rate: 0.08
      };
      const createdPO = {
        id: 'test-po-id',
        po_number: 'PO-2025-0001',
        vendor_name: 'Vendor A',
        subtotal: 200,
        tax_rate: 0.08,
        tax_amount: 16,
        total: 216,
        status: 'draft'
      };

      mockDb.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdPO);
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(poWithTax);

      expect(response.status).toBe(200);
      // Verify the db.run INSERT was called with correct tax values
      const insertCall = mockDb.run.mock.calls[0];
      const insertParams = insertCall[1];
      // subtotal=200, tax_rate=0.08, tax_amount=16, total=216
      expect(insertParams[7]).toBe(200);   // subtotal
      expect(insertParams[8]).toBe(0.08);  // tax_rate
      expect(insertParams[9]).toBe(16);    // tax_amount
      expect(insertParams[10]).toBe(216);  // total
    });

    test('should default tax_rate to 0 when not provided', async () => {
      const createdPO = {
        id: 'test-po-id',
        po_number: 'PO-2025-0001',
        subtotal: 200,
        tax_rate: 0,
        tax_amount: 0,
        total: 200,
        status: 'draft'
      };

      mockDb.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdPO);
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPO);

      expect(response.status).toBe(200);
      const insertCall = mockDb.run.mock.calls[0];
      const insertParams = insertCall[1];
      expect(insertParams[8]).toBe(0);   // tax_rate
      expect(insertParams[9]).toBe(0);   // tax_amount
    });
  });

  describe('PUT /api/purchase-orders/:id', () => {
    const updatedPO = {
      service_call_id: 'sc-1',
      vendor_name: 'Vendor B',
      vendor_contact: 'Jane Doe',
      vendor_phone: '555-5678',
      vendor_email: 'jane@vendor.com',
      status: 'pending',
      line_items: JSON.stringify([{ quantity: 3, unit_price: 75 }]),
      notes: 'Updated order'
    };

    test('should update a purchase order successfully', async () => {
      const returnedPO = {
        id: 'po-1',
        po_number: 'PO-2025-0001',
        vendor_name: 'Vendor B',
        subtotal: 225,
        total: 225,
        status: 'pending'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(returnedPO);

      const response = await request(app)
        .put('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedPO);

      expect(response.status).toBe(200);
      expect(response.body.vendor_name).toBe('Vendor B');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('purchase-order-changed', returnedPO);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedPO);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update purchase order');
    });

    test('should apply custom tax_rate on update', async () => {
      const poWithTax = {
        ...updatedPO,
        tax_rate: 0.10
      };
      const returnedPO = {
        id: 'po-1',
        vendor_name: 'Vendor B',
        subtotal: 225,
        tax_rate: 0.10,
        tax_amount: 22.5,
        total: 247.5,
        status: 'pending'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(returnedPO);

      const response = await request(app)
        .put('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(poWithTax);

      expect(response.status).toBe(200);
      const updateCall = mockDb.run.mock.calls[0];
      const updateParams = updateCall[1];
      // subtotal=225, tax_amount=22.5, total=247.5
      expect(updateParams[6]).toBe(225);    // subtotal
      expect(updateParams[7]).toBe(22.5);   // tax_amount
      expect(updateParams[8]).toBe(247.5);  // total
    });
  });

  describe('POST /api/purchase-orders/:id/approve', () => {
    test('should approve a purchase order', async () => {
      const approvedPO = { id: 'po-1', status: 'approved', approved_by: 'admin-1' };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(approvedPO);

      const response = await request(app)
        .post('/api/purchase-orders/po-1/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ approved_by: 'admin-1' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('purchase-order-changed', approvedPO);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/purchase-orders/po-1/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ approved_by: 'admin-1' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to approve purchase order');
    });
  });

  describe('POST /api/purchase-orders/:id/reject', () => {
    test('should reject a purchase order', async () => {
      const rejectedPO = { id: 'po-1', status: 'rejected' };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(rejectedPO);

      const response = await request(app)
        .post('/api/purchase-orders/po-1/reject')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('purchase-order-changed', rejectedPO);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/purchase-orders/po-1/reject')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to reject purchase order');
    });
  });

  describe('POST /api/purchase-orders/:id/receive', () => {
    test('should mark a purchase order as received', async () => {
      const receivedPO = { id: 'po-1', status: 'received' };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(receivedPO);

      const response = await request(app)
        .post('/api/purchase-orders/po-1/receive')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('received');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('purchase-order-changed', receivedPO);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/purchase-orders/po-1/receive')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to mark purchase order as received');
    });
  });

  describe('DELETE /api/purchase-orders/:id', () => {
    test('should delete a purchase order', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .delete('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('purchase-order-changed', { id: 'po-1', deleted: true });
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .delete('/api/purchase-orders/po-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete purchase order');
    });
  });
});
