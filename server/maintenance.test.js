/**
 * Maintenance API Tests
 * Tests for the preventive maintenance endpoints
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

const maintenanceRouter = require('./routes/maintenance');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/maintenance', maintenanceRouter);
  return app;
};

describe('Maintenance API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/maintenance/schedules', () => {
    test('should return schedules list', async () => {
      const mockSchedules = [
        { id: 's1', equipment_id: 'e1', schedule_type: 'preventive', frequency_days: 30, equipment_name: 'HVAC Unit', company_name: 'Acme' }
      ];
      mockDb.query.mockResolvedValue(mockSchedules);

      const response = await request(app).get('/api/maintenance/schedules');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].schedule_type).toBe('preventive');
    });
  });

  describe('POST /api/maintenance/schedules', () => {
    test('should create a new schedule', async () => {
      const newSchedule = {
        equipment_id: 'e1',
        schedule_type: 'preventive',
        frequency_days: 30,
        last_service_date: '2025-01-01T00:00:00.000Z',
        description: 'Monthly HVAC check',
        created_by: 'u1'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({
        id: 'new-id',
        ...newSchedule,
        next_service_date: '2025-01-31T00:00:00.000Z'
      });

      const response = await request(app)
        .post('/api/maintenance/schedules')
        .send(newSchedule);
      expect(response.status).toBe(200);
      expect(response.body.equipment_id).toBe('e1');
      expect(response.body.schedule_type).toBe('preventive');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/maintenance/schedules')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/maintenance/schedules/:id', () => {
    test('should delete a schedule', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/maintenance/schedules/s1');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/maintenance/alerts', () => {
    test('should return alerts list', async () => {
      const mockAlerts = [
        { id: 'a1', equipment_id: 'e1', alert_type: 'upcoming', severity: 'medium', status: 'active', equipment_name: 'HVAC Unit' }
      ];
      mockDb.query.mockResolvedValue(mockAlerts);

      const response = await request(app).get('/api/maintenance/alerts');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].alert_type).toBe('upcoming');
    });
  });

  describe('PUT /api/maintenance/alerts/:id', () => {
    test('should update alert status', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({ id: 'a1', status: 'resolved', resolved_at: '2025-01-15T00:00:00.000Z', resolved_by: 'u1' });

      const response = await request(app)
        .put('/api/maintenance/alerts/a1')
        .send({ status: 'resolved', resolved_by: 'u1' });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
    });
  });

  describe('GET /api/maintenance/dashboard', () => {
    test('should return dashboard summary', async () => {
      mockDb.get
        .mockResolvedValueOnce({ count: 50 }) // equipment count
        .mockResolvedValueOnce({ count: 10 }) // active schedules
        .mockResolvedValueOnce({ count: 3 }) // upcoming alerts
        .mockResolvedValueOnce({ count: 1 }) // overdue alerts
        .mockResolvedValueOnce({ count: 2 }); // predictive alerts

      mockDb.query.mockResolvedValue([
        { id: 'e1', name: 'HVAC', alert_type: 'overdue', severity: 'high', alert_title: 'Overdue maintenance' }
      ]);

      const response = await request(app).get('/api/maintenance/dashboard');
      expect(response.status).toBe(200);
      expect(response.body.total_equipment).toBe(50);
      expect(response.body.active_schedules).toBe(10);
      expect(response.body.upcoming_alerts).toBe(3);
      expect(response.body.overdue_alerts).toBe(1);
      expect(response.body.predictive_alerts).toBe(2);
      expect(Array.isArray(response.body.equipment_needing_attention)).toBe(true);
    });
  });

  describe('POST /api/maintenance/generate-alerts', () => {
    test('should generate alerts', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // active schedules (none)
        .mockResolvedValueOnce([]); // frequent equipment (none)

      const response = await request(app).post('/api/maintenance/generate-alerts');
      expect(response.status).toBe(200);
      expect(response.body.alerts_created).toBe(0);
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/maintenance/schedules');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch maintenance schedules');
    });
  });
});
