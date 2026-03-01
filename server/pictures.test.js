/**
 * Pictures API Tests
 * Tests for the service call pictures management system
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
  v4: () => 'test-picture-id'
}));

// Mock fs - the route uses require('fs').promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock express-rate-limit to pass through in tests
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const picturesRouter = require('./routes/pictures');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Mock io
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);

  app.use('/api/pictures', picturesRouter);
  return app;
};

describe('Pictures API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/pictures/servicecall/:serviceCallId', () => {
    test('should return pictures for a service call', async () => {
      const mockPictures = [
        { id: '1', service_call_id: 'sc-1', file_name: 'photo1.jpg', username: 'admin' },
        { id: '2', service_call_id: 'sc-1', file_name: 'photo2.jpg', username: 'admin' }
      ];
      mockDb.query.mockResolvedValue(mockPictures);

      const response = await request(app).get('/api/pictures/servicecall/sc-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].file_name).toBe('photo1.jpg');
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/pictures/servicecall/sc-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch pictures');
    });
  });

  describe('PUT /api/pictures/:id', () => {
    test('should update picture comment successfully', async () => {
      const updatedPicture = {
        id: 'pic-1',
        comment: 'Updated comment',
        serial_numbers: '[]'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedPicture);

      const response = await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment: 'Updated comment' });

      expect(response.status).toBe(200);
      expect(response.body.comment).toBe('Updated comment');
    });

    test('should extract serial numbers from comment', async () => {
      const comment = 'Found device ABC123456 with number 1234567890';
      const updatedPicture = {
        id: 'pic-1',
        comment,
        serial_numbers: '["ABC123456","1234567890"]'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedPicture);

      const response = await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment });

      expect(response.status).toBe(200);
      // Verify db.run was called with extracted serial numbers in JSON format
      const runCall = mockDb.run.mock.calls[0];
      const serialNumbersArg = runCall[1][1];
      const parsed = JSON.parse(serialNumbersArg);
      expect(parsed.length).toBeGreaterThan(0);
    });

    test('should emit socket event on update', async () => {
      const updatedPicture = {
        id: 'pic-1',
        comment: 'New comment',
        serial_numbers: '[]'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(updatedPicture);

      await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment: 'New comment' });

      expect(app.get('io').emit).toHaveBeenCalledWith('picture-updated', updatedPicture);
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment: 'Some comment' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update picture');
    });
  });

  describe('DELETE /api/pictures/:id', () => {
    test('should delete picture and file successfully', async () => {
      const mockPicture = {
        id: 'pic-1',
        file_path: '/uploads/service-call-pictures/photo1.jpg'
      };
      mockDb.get.mockResolvedValue(mockPicture);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const fs = require('fs');
      expect(fs.promises.unlink).toHaveBeenCalledWith(mockPicture.file_path);
    });

    test('should delete successfully when picture not found in db', async () => {
      mockDb.get.mockResolvedValue(undefined);
      mockDb.run.mockResolvedValue({ changes: 0 });

      const response = await request(app).delete('/api/pictures/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const fs = require('fs');
      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    test('should emit socket event on delete', async () => {
      mockDb.get.mockResolvedValue({ id: 'pic-1', file_path: '/tmp/photo.jpg' });
      mockDb.run.mockResolvedValue({ changes: 1 });

      await request(app).delete('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(app.get('io').emit).toHaveBeenCalledWith('picture-deleted', { id: 'pic-1' });
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete picture');
    });
  });

  describe('POST /api/pictures/upload', () => {
    test('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/pictures/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ service_call_id: 'sc-1', uploaded_by: 'user-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });
  });
});
