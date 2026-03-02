/**
 * Maintenance API Tests
 * Tests for the preventive maintenance endpoints
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

const maintenanceRouter = require('./routes/maintenance');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

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

      const response = await request(app).get('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${authToken}`);
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
        .set('Authorization', `Bearer ${authToken}`)
        .send(newSchedule);
      expect(response.status).toBe(200);
      expect(response.body.equipment_id).toBe('e1');
      expect(response.body.schedule_type).toBe('preventive');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should return 400 for invalid schedule_type', async () => {
      const response = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ equipment_id: 'e1', schedule_type: 'invalid_type', frequency_days: 30 });
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/schedule_type must be one of/);
    });

    test('should return 400 for non-positive frequency_days', async () => {
      const response = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ equipment_id: 'e1', schedule_type: 'preventive', frequency_days: -5 });
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/frequency_days must be a positive integer/);
    });

    test('should return 400 for NaN frequency_days', async () => {
      const response = await request(app)
        .post('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ equipment_id: 'e1', schedule_type: 'preventive', frequency_days: 'abc' });
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/frequency_days must be a positive integer/);
    });
  });

  describe('PUT /api/maintenance/schedules/:id', () => {
    test('should update a schedule with all fields including explicit next_service_date', async () => {
      const updateData = {
        equipment_id: 'e1',
        schedule_type: 'inspection',
        frequency_days: 60,
        last_service_date: '2025-02-01T00:00:00.000Z',
        next_service_date: '2025-04-01T00:00:00.000Z',
        description: 'Updated schedule',
        is_active: 1
      };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({ id: 's1', ...updateData });

      const response = await request(app)
        .put('/api/maintenance/schedules/s1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);
      expect(response.status).toBe(200);
      expect(response.body.schedule_type).toBe('inspection');
      expect(response.body.next_service_date).toBe('2025-04-01T00:00:00.000Z');
    });

    test('should auto-compute next_service_date from last_service_date + frequency_days', async () => {
      const updateData = {
        equipment_id: 'e1',
        schedule_type: 'preventive',
        frequency_days: 30,
        last_service_date: '2025-03-01T00:00:00.000Z',
        description: 'Auto-computed next date',
        is_active: 1
      };

      const expectedNext = new Date('2025-03-01T00:00:00.000Z');
      expectedNext.setDate(expectedNext.getDate() + 30);

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({ id: 's1', ...updateData, next_service_date: expectedNext.toISOString() });

      const response = await request(app)
        .put('/api/maintenance/schedules/s1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);
      expect(response.status).toBe(200);
      // Verify db.run was called with computed next_service_date (not undefined)
      const runArgs = mockDb.run.mock.calls[0][1];
      expect(runArgs[4]).toBe(expectedNext.toISOString());
    });

    test('should emit socket event on update', async () => {
      const updateData = {
        equipment_id: 'e1',
        schedule_type: 'preventive',
        frequency_days: 30,
        last_service_date: '2025-01-01T00:00:00.000Z',
        next_service_date: '2025-01-31T00:00:00.000Z',
        description: 'Socket test',
        is_active: 1
      };

      const updatedSchedule = { id: 's1', ...updateData };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedSchedule);

      await request(app)
        .put('/api/maintenance/schedules/s1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      const io = app.get('io');
      expect(io.emit).toHaveBeenCalledWith('maintenance-schedule-changed', updatedSchedule);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/maintenance/schedules/s1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ equipment_id: 'e1', schedule_type: 'preventive', frequency_days: 30 });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update maintenance schedule');
    });
  });

  describe('DELETE /api/maintenance/schedules/:id', () => {
    test('should delete a schedule', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/maintenance/schedules/s1')
        .set('Authorization', `Bearer ${authToken}`);
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

      const response = await request(app).get('/api/maintenance/alerts')
        .set('Authorization', `Bearer ${authToken}`);
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
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'resolved', resolved_by: 'u1' });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put('/api/maintenance/alerts/a1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' });
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/status must be one of/);
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

      const response = await request(app).get('/api/maintenance/dashboard')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.total_equipment).toBe(50);
      expect(response.body.active_schedules).toBe(10);
      expect(response.body.upcoming_alerts).toBe(3);
      expect(response.body.overdue_alerts).toBe(1);
      expect(response.body.predictive_alerts).toBe(2);
      expect(Array.isArray(response.body.equipment_needing_attention)).toBe(true);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/maintenance/dashboard')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch maintenance dashboard');
    });
  });

  describe('POST /api/maintenance/generate-alerts', () => {
    test('should generate alerts', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // active schedules (none)
        .mockResolvedValueOnce([]); // frequent equipment (none)

      const response = await request(app).post('/api/maintenance/generate-alerts')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.alerts_created).toBe(0);
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });

    test('should create overdue alert for schedule with past next_service_date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const overdueSchedule = {
        id: 'sched-1',
        equipment_id: 'e1',
        equipment_name: 'HVAC Unit',
        schedule_type: 'preventive',
        next_service_date: pastDate.toISOString(),
        is_active: 1
      };

      const createdAlert = {
        id: 'alert-1',
        equipment_id: 'e1',
        schedule_id: 'sched-1',
        alert_type: 'overdue',
        severity: 'high',
        status: 'active'
      };

      mockDb.query
        .mockResolvedValueOnce([overdueSchedule]) // active schedules
        .mockResolvedValueOnce([]); // frequent equipment
      mockDb.get
        .mockResolvedValueOnce(null) // no existing alert
        .mockResolvedValueOnce(createdAlert); // newly created alert
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).post('/api/maintenance/generate-alerts')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.alerts_created).toBe(1);
      expect(response.body.alerts[0].alert_type).toBe('overdue');
    });

    test('should create upcoming alert for schedule with next_service_date within 7 days', async () => {
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 3);
      const upcomingSchedule = {
        id: 'sched-2',
        equipment_id: 'e2',
        equipment_name: 'Generator',
        schedule_type: 'inspection',
        next_service_date: upcomingDate.toISOString(),
        is_active: 1
      };

      const createdAlert = {
        id: 'alert-2',
        equipment_id: 'e2',
        schedule_id: 'sched-2',
        alert_type: 'upcoming',
        severity: 'medium',
        status: 'active'
      };

      mockDb.query
        .mockResolvedValueOnce([upcomingSchedule]) // active schedules
        .mockResolvedValueOnce([]); // frequent equipment
      mockDb.get
        .mockResolvedValueOnce(null) // no existing alert
        .mockResolvedValueOnce(createdAlert); // newly created alert
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).post('/api/maintenance/generate-alerts')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.alerts_created).toBe(1);
      expect(response.body.alerts[0].alert_type).toBe('upcoming');
    });

    test('should create predictive alert for equipment with 3+ service calls in 90 days', async () => {
      const frequentEquip = {
        equipment_id: 'e3',
        equipment_name: 'Compressor',
        call_count: 5
      };

      const createdAlert = {
        id: 'alert-3',
        equipment_id: 'e3',
        alert_type: 'predictive',
        severity: 'high',
        status: 'active'
      };

      mockDb.query
        .mockResolvedValueOnce([]) // active schedules (none)
        .mockResolvedValueOnce([frequentEquip]); // frequent equipment
      mockDb.get
        .mockResolvedValueOnce(null) // no existing predictive alert
        .mockResolvedValueOnce(createdAlert); // newly created alert
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).post('/api/maintenance/generate-alerts')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.alerts_created).toBe(1);
      expect(response.body.alerts[0].alert_type).toBe('predictive');
    });

    test('should not create duplicate alert when one already exists', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const overdueSchedule = {
        id: 'sched-dup',
        equipment_id: 'e1',
        equipment_name: 'HVAC Unit',
        schedule_type: 'preventive',
        next_service_date: pastDate.toISOString(),
        is_active: 1
      };

      mockDb.query
        .mockResolvedValueOnce([overdueSchedule]) // active schedules
        .mockResolvedValueOnce([]); // frequent equipment
      mockDb.get
        .mockResolvedValueOnce({ id: 'existing-alert' }); // existing alert found

      const response = await request(app).post('/api/maintenance/generate-alerts')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.alerts_created).toBe(0);
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    test('should emit socket events for newly created alerts', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const overdueSchedule = {
        id: 'sched-sock',
        equipment_id: 'e1',
        equipment_name: 'HVAC Unit',
        schedule_type: 'preventive',
        next_service_date: pastDate.toISOString(),
        is_active: 1
      };

      const createdAlert = {
        id: 'alert-sock',
        equipment_id: 'e1',
        alert_type: 'overdue',
        severity: 'high',
        status: 'active'
      };

      mockDb.query
        .mockResolvedValueOnce([overdueSchedule])
        .mockResolvedValueOnce([]);
      mockDb.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAlert);
      mockDb.run.mockResolvedValue({ changes: 1 });

      await request(app).post('/api/maintenance/generate-alerts')
        .set('Authorization', `Bearer ${authToken}`);

      const io = app.get('io');
      expect(io.emit).toHaveBeenCalledWith('maintenance-alert-created', createdAlert);
    });
  });

  describe('Error handling', () => {
    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/maintenance/schedules')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch maintenance schedules');
    });
  });
});
