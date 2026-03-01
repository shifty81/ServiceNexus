/**
 * Equipment API Tests
 * Tests for the equipment management system
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
  v4: () => 'test-equipment-id'
}));

const equipmentRouter = require('./routes/equipment');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/equipment', equipmentRouter);
  return app;
};

describe('Equipment API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/equipment/servicecall/:serviceCallId', () => {
    test('should return equipment for a service call', async () => {
      const mockEquipment = [
        { id: '1', service_call_id: 'sc-1', name: 'AC Unit', serial_number: 'SN001' },
        { id: '2', service_call_id: 'sc-1', name: 'Heater', serial_number: 'SN002' }
      ];
      mockDb.query.mockResolvedValue(mockEquipment);

      const response = await request(app).get('/api/equipment/servicecall/sc-1');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/equipment/servicecall/sc-1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch equipment');
    });
  });

  describe('GET /api/equipment/customer/:customerId', () => {
    test('should return equipment for a customer', async () => {
      const mockEquipment = [
        { id: '1', customer_id: 'cust-1', name: 'AC Unit', serial_number: 'SN001' },
        { id: '2', customer_id: 'cust-1', name: 'Heater', serial_number: 'SN002' }
      ];
      mockDb.query.mockResolvedValue(mockEquipment);

      const response = await request(app).get('/api/equipment/customer/cust-1');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/equipment/customer/cust-1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch equipment');
    });
  });

  describe('POST /api/equipment', () => {
    test('should add equipment successfully', async () => {
      const newEquipment = {
        id: 'test-equipment-id',
        service_call_id: 'sc-1',
        customer_id: 'cust-1',
        name: 'AC Unit',
        serial_number: 'SN001',
        model: 'Model X',
        manufacturer: 'ACME',
        location_details: 'Roof',
        notes: 'New install'
      };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newEquipment);

      const response = await request(app)
        .post('/api/equipment')
        .send({
          service_call_id: 'sc-1',
          customer_id: 'cust-1',
          name: 'AC Unit',
          serial_number: 'SN001',
          model: 'Model X',
          manufacturer: 'ACME',
          location_details: 'Roof',
          notes: 'New install'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('AC Unit');
      expect(response.body.id).toBe('test-equipment-id');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('equipment-added', newEquipment);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/equipment')
        .send({
          service_call_id: 'sc-1',
          customer_id: 'cust-1',
          name: 'AC Unit'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to add equipment');
    });
  });

  describe('PUT /api/equipment/:id', () => {
    test('should update equipment successfully', async () => {
      const updatedEquipment = {
        id: 'eq-1',
        name: 'Updated AC Unit',
        serial_number: 'SN001-U',
        model: 'Model Y',
        manufacturer: 'ACME',
        location_details: 'Basement',
        notes: 'Moved'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedEquipment);

      const response = await request(app)
        .put('/api/equipment/eq-1')
        .send({
          name: 'Updated AC Unit',
          serial_number: 'SN001-U',
          model: 'Model Y',
          manufacturer: 'ACME',
          location_details: 'Basement',
          notes: 'Moved'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated AC Unit');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('equipment-updated', updatedEquipment);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/equipment/eq-1')
        .send({
          name: 'Updated AC Unit'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update equipment');
    });
  });

  describe('DELETE /api/equipment/:id', () => {
    test('should delete equipment successfully', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/equipment/eq-1');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('equipment-deleted', { id: 'eq-1' });
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/equipment/eq-1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete equipment');
    });
  });
});
