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
// Keep actual fs functions (createReadStream, createWriteStream, etc.) for multer/supertest
// Only mock unlink; use real mkdir so multer can write uploaded files
jest.mock('fs', () => {
  const mockActualFs = jest.requireActual('fs');
  return {
    ...mockActualFs,
    promises: {
      ...mockActualFs.promises,
      unlink: jest.fn().mockResolvedValue(undefined)
    }
  };
});

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

const fs = require('fs');
const path = require('path');

const TEST_IMAGE_PATH = '/tmp/test-upload.jpg';

describe('Pictures API', () => {
  let app;

  beforeAll(() => {
    // Create a small fake JPEG for upload tests
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    fs.writeFileSync(TEST_IMAGE_PATH, jpegHeader);
    app = createTestApp();
  });

  afterAll(() => {
    try { fs.unlinkSync(TEST_IMAGE_PATH); } catch { /* cleanup - ignore missing file */ }
    // Clean up any multer-created upload files
    const uploadDir = path.join(__dirname, 'uploads/service-call-pictures');
    try {
      const files = fs.readdirSync(uploadDir);
      files.forEach(f => fs.unlinkSync(path.join(uploadDir, f)));
      fs.rmdirSync(uploadDir);
    } catch { /* cleanup - ignore if directory doesn't exist */ }
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

    test('should upload a file successfully and extract serial numbers from comment', async () => {
      const mockPicture = {
        id: 'test-picture-id',
        service_call_id: 'sc-1',
        file_name: 'test-upload.jpg',
        comment: 'Found SN:ABC-123 on the unit',
        serial_numbers: '["SN:ABC-123"]',
        uploaded_by: 'user-1',
        username: 'testuser'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(mockPicture);

      const response = await request(app)
        .post('/api/pictures/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('picture', TEST_IMAGE_PATH)
        .field('service_call_id', 'sc-1')
        .field('uploaded_by', 'user-1')
        .field('comment', 'Found SN:ABC-123 on the unit');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-picture-id');
      expect(response.body.service_call_id).toBe('sc-1');

      // Verify db.run was called with serial numbers extracted from comment
      const runCall = mockDb.run.mock.calls[0];
      const serialNumbersArg = runCall[1][4];
      const parsed = JSON.parse(serialNumbersArg);
      expect(parsed.length).toBeGreaterThan(0);
    });

    test('should emit socket event on successful upload', async () => {
      const mockPicture = {
        id: 'test-picture-id',
        service_call_id: 'sc-1',
        file_name: 'test-upload.jpg',
        comment: 'A photo',
        serial_numbers: '[]',
        uploaded_by: 'user-1',
        username: 'testuser'
      };
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(mockPicture);

      await request(app)
        .post('/api/pictures/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('picture', TEST_IMAGE_PATH)
        .field('service_call_id', 'sc-1')
        .field('uploaded_by', 'user-1')
        .field('comment', 'A photo');

      expect(app.get('io').emit).toHaveBeenCalledWith('picture-uploaded', {
        serviceCallId: 'sc-1',
        picture: mockPicture
      });
    });

    test('should return 500 on database error during upload', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/pictures/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('picture', TEST_IMAGE_PATH)
        .field('service_call_id', 'sc-1')
        .field('uploaded_by', 'user-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to upload picture');
    });
  });

  describe('GET /api/pictures/view/:filename', () => {
    test('should attempt to serve the file (may 404 if file missing)', async () => {
      const response = await request(app)
        .get('/api/pictures/view/somefile.jpg')
        .set('Authorization', `Bearer ${authToken}`);

      // File doesn't actually exist on disk, so Express sendFile returns an error
      // Accept either 404 (file not found) or similar non-crash status
      expect([404, 500]).toContain(response.status);
    });

    test('should strip path traversal via path.basename', async () => {
      const response = await request(app)
        .get('/api/pictures/view/..%2F..%2Fetc%2Fpasswd')
        .set('Authorization', `Bearer ${authToken}`);

      // path.basename strips traversal, resulting file won't exist => 404
      // The key assertion: it does NOT return the contents of /etc/passwd
      expect(response.status).not.toBe(200);
      expect(response.text).not.toContain('root:');
    });
  });

  describe('extractSerialNumbers', () => {
    // Access the function indirectly through the route behavior
    // by testing via the PUT endpoint which calls extractSerialNumbers

    test('should extract SN: pattern from comment', async () => {
      const comment = 'Device has SN:ABC-123 printed on it';
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({
        id: 'pic-1',
        comment,
        serial_numbers: '["SN:ABC-123"]'
      });

      await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment });

      const runCall = mockDb.run.mock.calls[0];
      const serialNumbersArg = runCall[1][1];
      const parsed = JSON.parse(serialNumbersArg);
      expect(parsed).toEqual(expect.arrayContaining([expect.stringContaining('SN')]));
    });

    test('should extract Serial: pattern from comment', async () => {
      const comment = 'Label reads Serial:XYZ-789 on the back';
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({
        id: 'pic-1',
        comment,
        serial_numbers: '["Serial:XYZ-789"]'
      });

      await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment });

      const runCall = mockDb.run.mock.calls[0];
      const serialNumbersArg = runCall[1][1];
      const parsed = JSON.parse(serialNumbersArg);
      expect(parsed).toEqual(expect.arrayContaining([expect.stringContaining('Serial')]));
    });

    test('should return empty array for empty comment', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue({
        id: 'pic-1',
        comment: '',
        serial_numbers: '[]'
      });

      await request(app)
        .put('/api/pictures/pic-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment: '' });

      const runCall = mockDb.run.mock.calls[0];
      const serialNumbersArg = runCall[1][1];
      expect(JSON.parse(serialNumbersArg)).toEqual([]);
    });
  });
});
