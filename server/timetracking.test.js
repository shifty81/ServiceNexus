/**
 * Time Tracking API Tests
 * Tests for the time tracking/clock-in/clock-out system
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
  v4: () => 'test-timeentry-id'
}));

const timetrackingRouter = require('./routes/timetracking');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/timetracking', timetrackingRouter);
  return app;
};

describe('Time Tracking API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/timetracking', () => {
    test('should return all time entries', async () => {
      const mockEntries = [
        { id: '1', user_id: 'u1', username: 'John', clock_in: '2024-01-01T08:00:00Z' },
        { id: '2', user_id: 'u2', username: 'Jane', clock_in: '2024-01-01T09:00:00Z' }
      ];
      mockDb.query.mockResolvedValue(mockEntries);

      const response = await request(app).get('/api/timetracking')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/timetracking')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch time entries');
    });
  });

  describe('GET /api/timetracking/active', () => {
    test('should return active time entries', async () => {
      const mockActive = [
        { id: '1', user_id: 'u1', username: 'John', status: 'active', clock_out: null }
      ];
      mockDb.query.mockResolvedValue(mockActive);

      const response = await request(app).get('/api/timetracking/active')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/timetracking/active')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch active entries');
    });
  });

  describe('GET /api/timetracking/user/:userId', () => {
    test('should return time entries for a specific user', async () => {
      const mockEntries = [
        { id: '1', user_id: 'u1', username: 'John', clock_in: '2024-01-01T08:00:00Z' }
      ];
      mockDb.query.mockResolvedValue(mockEntries);

      const response = await request(app).get('/api/timetracking/user/u1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/timetracking/user/u1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch user time entries');
    });
  });

  describe('GET /api/timetracking/payroll', () => {
    test('should return payroll summary', async () => {
      const mockPayroll = [
        { user_id: 'u1', username: 'John', total_entries: 5, total_hours: 40, total_pay: 800 }
      ];
      mockDb.query.mockResolvedValue(mockPayroll);

      const response = await request(app).get('/api/timetracking/payroll')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].total_hours).toBe(40);
    });

    test('should accept date range and userId filters', async () => {
      mockDb.query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/timetracking/payroll?startDate=2024-01-01&endDate=2024-01-31&userId=u1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND te.clock_in >= ?'),
        expect.arrayContaining(['2024-01-01', '2024-01-31', 'u1'])
      );
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/timetracking/payroll')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch payroll data');
    });
  });

  describe('POST /api/timetracking/clock-in', () => {
    test('should clock in successfully', async () => {
      const mockEntry = {
        id: 'test-timeentry-id',
        user_id: 'u1',
        username: 'John',
        status: 'active',
        clock_in: '2024-01-01T08:00:00Z'
      };
      mockDb.get
        .mockResolvedValueOnce(undefined)   // no active entry
        .mockResolvedValueOnce(mockEntry);  // newly created entry
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/timetracking/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_id: 'u1', hourly_rate: 20 });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('test-timeentry-id');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('timeentry:created', mockEntry);
    });

    test('should return 400 if user_id is missing', async () => {
      const response = await request(app)
        .post('/api/timetracking/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User ID is required');
    });

    test('should return 400 if user already has active entry', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 'existing', user_id: 'u1', status: 'active' });

      const response = await request(app)
        .post('/api/timetracking/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_id: 'u1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User already has an active time entry');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/timetracking/clock-in')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_id: 'u1' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to clock in');
    });
  });

  describe('POST /api/timetracking/clock-out/:id', () => {
    test('should clock out successfully', async () => {
      const existingEntry = {
        id: 'entry-1',
        user_id: 'u1',
        clock_in: '2024-01-01T08:00:00Z',
        clock_out: null,
        break_duration: 0,
        hourly_rate: 20,
        status: 'active'
      };
      const updatedEntry = {
        ...existingEntry,
        clock_out: '2024-01-01T16:00:00Z',
        total_hours: 8,
        total_pay: 160,
        status: 'completed',
        username: 'John'
      };
      mockDb.get
        .mockResolvedValueOnce(existingEntry)   // find entry
        .mockResolvedValueOnce(updatedEntry);   // updated entry
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/timetracking/clock-out/entry-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ break_duration: 0 });

      expect(response.status).toBe(200);

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('timeentry:updated', updatedEntry);
    });

    test('should return 404 if entry not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/timetracking/clock-out/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Time entry not found');
    });

    test('should return 400 if already clocked out', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'entry-1',
        clock_out: '2024-01-01T16:00:00Z',
        status: 'completed'
      });

      const response = await request(app)
        .post('/api/timetracking/clock-out/entry-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already clocked out');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/timetracking/clock-out/entry-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to clock out');
    });
  });

  describe('PUT /api/timetracking/:id', () => {
    test('should update time entry successfully', async () => {
      const existingEntry = {
        id: 'entry-1',
        user_id: 'u1',
        clock_in: '2024-01-01T08:00:00Z',
        clock_out: '2024-01-01T16:00:00Z',
        break_duration: 0,
        hourly_rate: 20,
        total_hours: 8,
        total_pay: 160,
        notes: null,
        dispatch_id: null,
        status: 'completed'
      };
      const updatedEntry = {
        ...existingEntry,
        notes: 'Updated notes',
        username: 'John'
      };
      mockDb.get
        .mockResolvedValueOnce(existingEntry)   // find entry
        .mockResolvedValueOnce(updatedEntry);   // updated entry
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .put('/api/timetracking/entry-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Updated notes' });

      expect(response.status).toBe(200);

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('timeentry:updated', updatedEntry);
    });

    test('should recalculate hours and pay when clock_in and clock_out provided', async () => {
      const existingEntry = {
        id: 'entry-1',
        user_id: 'u1',
        clock_in: '2024-01-01T08:00:00Z',
        clock_out: '2024-01-01T16:00:00Z',
        break_duration: 0,
        hourly_rate: 20,
        total_hours: 8,
        total_pay: 160,
        notes: null,
        dispatch_id: null,
        status: 'completed'
      };
      const updatedEntry = {
        ...existingEntry,
        clock_in: '2024-01-01T09:00:00Z',
        clock_out: '2024-01-01T17:00:00Z',
        username: 'John'
      };
      mockDb.get
        .mockResolvedValueOnce(existingEntry)
        .mockResolvedValueOnce(updatedEntry);
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .put('/api/timetracking/entry-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clock_in: '2024-01-01T09:00:00Z',
          clock_out: '2024-01-01T17:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['2024-01-01T09:00:00Z', '2024-01-01T17:00:00Z'])
      );
    });

    test('should return 404 if entry not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .put('/api/timetracking/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Time entry not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/timetracking/entry-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update time entry');
    });
  });

  describe('DELETE /api/timetracking/:id', () => {
    test('should delete time entry successfully', async () => {
      const existingEntry = { id: 'entry-1', user_id: 'u1' };
      mockDb.get.mockResolvedValueOnce(existingEntry);
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app).delete('/api/timetracking/entry-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Time entry deleted successfully');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('timeentry:deleted', { id: 'entry-1' });
    });

    test('should return 404 if entry not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const response = await request(app).delete('/api/timetracking/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Time entry not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/timetracking/entry-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete time entry');
    });
  });
});
