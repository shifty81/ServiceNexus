const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const mockDb = {
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
};
jest.mock('./database', () => mockDb);
jest.mock('uuid', () => ({ v4: () => 'test-dispatch-id' }));

const dispatchRouter = require('./routes/dispatch');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/dispatch', dispatchRouter);
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Dispatch Routes', () => {
  // GET /
  describe('GET /api/dispatch', () => {
    it('should return all dispatches', async () => {
      const mockDispatches = [
        { id: '1', title: 'Dispatch 1', status: 'pending' },
        { id: '2', title: 'Dispatch 2', status: 'completed' }
      ];
      mockDb.query.mockResolvedValue(mockDispatches);
      const app = createTestApp();

      const res = await request(app).get('/api/dispatch');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDispatches);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM dispatches ORDER BY created_at DESC');
    });

    it('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).get('/api/dispatch');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch dispatches' });
    });
  });

  // GET /:id
  describe('GET /api/dispatch/:id', () => {
    it('should return a single dispatch', async () => {
      const mockDispatch = { id: '1', title: 'Dispatch 1', status: 'pending' };
      mockDb.get.mockResolvedValue(mockDispatch);
      const app = createTestApp();

      const res = await request(app).get('/api/dispatch/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDispatch);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM dispatches WHERE id = ?', ['1']);
    });

    it('should return 404 when dispatch not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const app = createTestApp();

      const res = await request(app).get('/api/dispatch/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Dispatch not found' });
    });

    it('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).get('/api/dispatch/1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch dispatch' });
    });
  });

  // POST /
  describe('POST /api/dispatch', () => {
    it('should create a new dispatch', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();
      const newDispatch = {
        title: 'New Dispatch',
        description: 'Test description',
        address: '123 Main St'
      };

      const res = await request(app).post('/api/dispatch').send(newDispatch);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 'test-dispatch-id',
        title: 'New Dispatch',
        description: 'Test description',
        address: '123 Main St'
      });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dispatches'),
        ['test-dispatch-id', 'New Dispatch', 'Test description', '123 Main St', null, null, null, 'pending', 'normal', null]
      );
    });

    it('should emit socket event on creation', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).post('/api/dispatch').send({
        title: 'New Dispatch',
        description: 'Desc',
        address: '123 Main St'
      });

      expect(app.get('io').emit).toHaveBeenCalledWith('dispatch-changed', { action: 'created', id: 'test-dispatch-id' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).post('/api/dispatch').send({
        title: 'New Dispatch',
        description: 'Desc',
        address: '123 Main St'
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create dispatch' });
    });

    it('should return 400 when title is missing', async () => {
      const app = createTestApp();

      const res = await request(app).post('/api/dispatch').send({
        description: 'No title provided',
        address: '123 Main St'
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'title is required' });
    });
  });

  // PUT /:id
  describe('PUT /api/dispatch/:id', () => {
    it('should update a dispatch', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();
      const updatedDispatch = {
        title: 'Updated',
        description: 'Updated desc',
        address: '456 Oak Ave',
        latitude: 40.7,
        longitude: -74.0,
        assigned_to: 'user1',
        status: 'in_progress',
        priority: 'high',
        due_date: '2025-01-01'
      };

      const res = await request(app).put('/api/dispatch/1').send(updatedDispatch);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: '1', message: 'Dispatch updated successfully' });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE dispatches/),
        ['Updated', 'Updated desc', '456 Oak Ave', 40.7, -74.0, 'user1', 'in_progress', 'high', '2025-01-01', '1']
      );
    });

    it('should emit socket event on update', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).put('/api/dispatch/1').send({
        title: 'Updated',
        description: 'Desc',
        address: '456 Oak Ave'
      });

      expect(app.get('io').emit).toHaveBeenCalledWith('dispatch-changed', { action: 'updated', id: '1' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).put('/api/dispatch/1').send({ title: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update dispatch' });
    });
  });

  // POST /:id/complete
  describe('POST /api/dispatch/:id/complete', () => {
    it('should complete a dispatch', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      const res = await request(app).post('/api/dispatch/1/complete');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Dispatch completed successfully' });
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE dispatches SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', '1']
      );
    });

    it('should emit socket event on completion', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).post('/api/dispatch/1/complete');

      expect(app.get('io').emit).toHaveBeenCalledWith('dispatch-changed', { action: 'completed', id: '1' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).post('/api/dispatch/1/complete');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to complete dispatch' });
    });
  });

  // DELETE /:id
  describe('DELETE /api/dispatch/:id', () => {
    it('should delete a dispatch', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      const res = await request(app).delete('/api/dispatch/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Dispatch deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM dispatches WHERE id = ?', ['1']);
    });

    it('should emit socket event on deletion', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).delete('/api/dispatch/1');

      expect(app.get('io').emit).toHaveBeenCalledWith('dispatch-changed', { action: 'deleted', id: '1' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).delete('/api/dispatch/1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete dispatch' });
    });
  });
});
