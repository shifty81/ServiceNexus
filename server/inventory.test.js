const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

const mockDb = {
  query: jest.fn(),
  get: jest.fn(),
  run: jest.fn()
};
jest.mock('./database', () => mockDb);
jest.mock('uuid', () => ({ v4: () => 'test-inventory-id' }));

const inventoryRouter = require('./routes/inventory');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/inventory', inventoryRouter);
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Inventory Routes', () => {
  // GET /
  describe('GET /api/inventory', () => {
    it('should return all inventory items', async () => {
      const mockItems = [
        { id: '1', name: 'Filter', quantity: 10 },
        { id: '2', name: 'Pipe', quantity: 25 }
      ];
      mockDb.query.mockResolvedValue(mockItems);
      const app = createTestApp();

      const res = await request(app).get('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockItems);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM inventory ORDER BY name ASC');
    });

    it('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).get('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch inventory' });
    });
  });

  // GET /:id
  describe('GET /api/inventory/:id', () => {
    it('should return a single inventory item', async () => {
      const mockItem = { id: '1', name: 'Filter', quantity: 10 };
      mockDb.get.mockResolvedValue(mockItem);
      const app = createTestApp();

      const res = await request(app).get('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockItem);
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM inventory WHERE id = ?', ['1']);
    });

    it('should return 404 when item not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const app = createTestApp();

      const res = await request(app).get('/api/inventory/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Item not found' });
    });

    it('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).get('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch item' });
    });
  });

  // POST /
  describe('POST /api/inventory', () => {
    it('should create a new inventory item', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();
      const newItem = {
        name: 'New Filter',
        description: 'HEPA filter',
        quantity: 5,
        unit: 'pieces',
        category: 'Filters',
        location: 'Warehouse A'
      };

      const res = await request(app).post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 'test-inventory-id',
        name: 'New Filter',
        quantity: 5
      });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory'),
        ['test-inventory-id', 'New Filter', 'HEPA filter', 5, 'pieces', 'Filters', 'Warehouse A', null]
      );
    });

    it('should store quantity as 0 when not provided', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      const res = await request(app).post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'No Qty Item' });

      expect(res.status).toBe(201);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory'),
        expect.arrayContaining(['test-inventory-id', 'No Qty Item', undefined, 0])
      );
    });

    it('should emit socket event on creation', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Item' });

      expect(app.get('io').emit).toHaveBeenCalledWith('inventory-changed', { action: 'created', id: 'test-inventory-id' });
    });

    it('should return 400 when name is missing', async () => {
      const app = createTestApp();

      const res = await request(app).post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No name provided' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'name is required' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Failing Item' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create item' });
    });
  });

  // PUT /:id
  describe('PUT /api/inventory/:id', () => {
    it('should update an inventory item', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();
      const updatedItem = {
        name: 'Updated Filter',
        description: 'Updated desc',
        quantity: 20,
        unit: 'boxes',
        category: 'Filters',
        location: 'Warehouse B',
        updated_by: 'admin-1'
      };

      const res = await request(app).put('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedItem);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: '1', message: 'Item updated successfully' });
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE inventory/),
        ['Updated Filter', 'Updated desc', 20, 'boxes', 'Filters', 'Warehouse B', 'admin-1', '1']
      );
    });

    it('should emit socket event on update', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).put('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });

      expect(app.get('io').emit).toHaveBeenCalledWith('inventory-changed', { action: 'updated', id: '1' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).put('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update item' });
    });
  });

  // PATCH /:id/quantity
  describe('PATCH /api/inventory/:id/quantity', () => {
    it('should adjust item quantity', async () => {
      const updatedItem = { id: '1', name: 'Filter', quantity: 15 };
      mockDb.run.mockResolvedValue({});
      mockDb.get.mockResolvedValue(updatedItem);
      const app = createTestApp();

      const res = await request(app).patch('/api/inventory/1/quantity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ adjustment: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedItem);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE inventory/),
        [5, null, '1']
      );
    });

    it('should emit socket event on quantity update', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.get.mockResolvedValue({ id: '1', name: 'Filter', quantity: 15 });
      const app = createTestApp();

      await request(app).patch('/api/inventory/1/quantity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ adjustment: 5 });

      expect(app.get('io').emit).toHaveBeenCalledWith('inventory-changed', {
        action: 'quantity-updated',
        id: '1',
        newQuantity: 15
      });
    });

    it('should return 400 when adjustment is missing', async () => {
      const app = createTestApp();

      const res = await request(app).patch('/api/inventory/1/quantity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'A valid numeric adjustment is required' });
    });

    it('should return 400 when adjustment is not a number', async () => {
      const app = createTestApp();

      const res = await request(app).patch('/api/inventory/1/quantity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ adjustment: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'A valid numeric adjustment is required' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).patch('/api/inventory/1/quantity')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ adjustment: 5 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update quantity' });
    });
  });

  // DELETE /:id
  describe('DELETE /api/inventory/:id', () => {
    it('should delete an inventory item', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      const res = await request(app).delete('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Item deleted successfully' });
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM inventory WHERE id = ?', ['1']);
    });

    it('should emit socket event on deletion', async () => {
      mockDb.run.mockResolvedValue({});
      const app = createTestApp();

      await request(app).delete('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(app.get('io').emit).toHaveBeenCalledWith('inventory-changed', { action: 'deleted', id: '1' });
    });

    it('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));
      const app = createTestApp();

      const res = await request(app).delete('/api/inventory/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete item' });
    });
  });
});
