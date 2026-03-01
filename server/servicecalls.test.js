/**
 * Service Calls API Tests
 * Tests for the service calls CRUD and comments system
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
  v4: () => 'test-service-call-id'
}));

const serviceCallsRouter = require('./routes/servicecalls');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/servicecalls', serviceCallsRouter);
  return app;
};

describe('Service Calls API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/servicecalls', () => {
    test('should return all service calls', async () => {
      const mockServiceCalls = [
        { id: '1', title: 'Fix AC', status: 'pending', customer_name: 'John' },
        { id: '2', title: 'Repair heater', status: 'in-progress', customer_name: 'Jane' }
      ];
      mockDb.query.mockResolvedValue(mockServiceCalls);

      const response = await request(app).get('/api/servicecalls');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].title).toBe('Fix AC');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/servicecalls');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch service calls');
    });
  });

  describe('GET /api/servicecalls/:id', () => {
    test('should return a service call with details', async () => {
      const mockServiceCall = { id: 'sc-1', title: 'Fix AC', status: 'pending' };
      const mockComments = [{ id: 'c1', comment: 'On my way' }];
      const mockPictures = [{ id: 'p1', url: 'pic.jpg' }];
      const mockEquipment = [{ id: 'e1', name: 'Wrench' }];
      const mockCheckIns = [{ id: 'ci1', technician_name: 'Bob' }];

      mockDb.get.mockResolvedValue(mockServiceCall);
      mockDb.query
        .mockResolvedValueOnce(mockComments)
        .mockResolvedValueOnce(mockPictures)
        .mockResolvedValueOnce(mockEquipment)
        .mockResolvedValueOnce(mockCheckIns);

      const response = await request(app).get('/api/servicecalls/sc-1');
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Fix AC');
      expect(response.body.comments).toEqual(mockComments);
      expect(response.body.pictures).toEqual(mockPictures);
      expect(response.body.equipment).toEqual(mockEquipment);
      expect(response.body.checkIns).toEqual(mockCheckIns);
    });

    test('should return 404 when service call not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/servicecalls/nonexistent');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service call not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/servicecalls/sc-1');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch service call');
    });
  });

  describe('POST /api/servicecalls', () => {
    test('should create a service call', async () => {
      const newServiceCall = {
        id: 'test-service-call-id',
        title: 'Fix AC',
        description: 'AC not working',
        customer_id: 'cust-1',
        assigned_to: 'tech-1',
        status: 'pending',
        priority: 'high',
        due_date: '2024-12-31',
        created_by: 'admin-1'
      };

      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newServiceCall);

      const response = await request(app)
        .post('/api/servicecalls')
        .send({
          title: 'Fix AC',
          description: 'AC not working',
          customer_id: 'cust-1',
          assigned_to: 'tech-1',
          status: 'pending',
          priority: 'high',
          due_date: '2024-12-31',
          created_by: 'admin-1'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Fix AC');
      expect(response.body.id).toBe('test-service-call-id');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('service-call-changed', newServiceCall);
    });

    test('should use default status and priority when not provided', async () => {
      const createdCall = { id: 'test-service-call-id', title: 'Test', status: 'pending', priority: 'normal' };
      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(createdCall);

      const response = await request(app)
        .post('/api/servicecalls')
        .send({ title: 'Test', created_by: 'admin-1' });

      expect(response.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['pending', 'normal'])
      );
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/servicecalls')
        .send({ title: 'Fail', created_by: 'admin-1' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create service call');
    });
  });

  describe('PUT /api/servicecalls/:id', () => {
    test('should update a service call', async () => {
      const updatedCall = {
        id: 'sc-1',
        title: 'Updated Title',
        description: 'Updated desc',
        status: 'in-progress'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedCall);

      const response = await request(app)
        .put('/api/servicecalls/sc-1')
        .send({
          title: 'Updated Title',
          description: 'Updated desc',
          customer_id: 'cust-1',
          assigned_to: 'tech-1',
          status: 'in-progress',
          priority: 'high',
          due_date: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('service-call-changed', updatedCall);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/servicecalls/sc-1')
        .send({ title: 'Fail' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update service call');
    });
  });

  describe('POST /api/servicecalls/:id/complete', () => {
    test('should complete a service call', async () => {
      const completedCall = { id: 'sc-1', status: 'completed', completed_at: '2024-01-01' };

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(completedCall);

      const response = await request(app).post('/api/servicecalls/sc-1/complete');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('service-call-changed', completedCall);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/api/servicecalls/sc-1/complete');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to complete service call');
    });
  });

  describe('DELETE /api/servicecalls/:id', () => {
    test('should delete a service call', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/servicecalls/sc-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('service-call-changed', { id: 'sc-1', deleted: true });
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/servicecalls/sc-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete service call');
    });
  });

  describe('POST /api/servicecalls/:id/comments', () => {
    test('should add a comment to a service call', async () => {
      const newComment = {
        id: 'test-service-call-id',
        service_call_id: 'sc-1',
        user_id: 'user-1',
        comment: 'On my way',
        username: 'john',
        user_type: 'technician'
      };

      mockDb.run.mockResolvedValue({ id: 1 });
      mockDb.get.mockResolvedValue(newComment);

      const response = await request(app)
        .post('/api/servicecalls/sc-1/comments')
        .send({ user_id: 'user-1', comment: 'On my way' });

      expect(response.status).toBe(200);
      expect(response.body.comment).toBe('On my way');
      expect(response.body.username).toBe('john');

      const mockIo = app.get('io');
      expect(mockIo.emit).toHaveBeenCalledWith('service-call-comment-added', {
        serviceCallId: 'sc-1',
        comment: newComment
      });
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/servicecalls/sc-1/comments')
        .send({ user_id: 'user-1', comment: 'Fail' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to add comment');
    });
  });

  describe('GET /api/servicecalls/:id/comments', () => {
    test('should return comments for a service call', async () => {
      const mockComments = [
        { id: 'c1', comment: 'On my way', username: 'john' },
        { id: 'c2', comment: 'Arrived', username: 'john' }
      ];
      mockDb.query.mockResolvedValue(mockComments);

      const response = await request(app).get('/api/servicecalls/sc-1/comments');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].comment).toBe('On my way');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/servicecalls/sc-1/comments');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch comments');
    });
  });
});
