/**
 * Forms API Tests
 * Tests for the forms management system
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
  v4: () => 'test-form-id'
}));

// Mock fs for file operations in multer and delete route
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn()
}));

const fs = require('fs');
const formsRouter = require('./routes/forms');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/forms', formsRouter);
  return app;
};

describe('Forms API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/forms', () => {
    test('should return all forms', async () => {
      const mockForms = [
        { id: '1', title: 'Form A', fields: '[{"type":"text","label":"Name"}]', field_positions: '{"Name":{"x":0,"y":0}}' },
        { id: '2', title: 'Form B', fields: '[{"type":"email","label":"Email"}]', field_positions: null }
      ];
      mockDb.query.mockResolvedValue(mockForms);

      const response = await request(app).get('/api/forms')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].fields).toEqual([{ type: 'text', label: 'Name' }]);
      expect(response.body[0].field_positions).toEqual({ Name: { x: 0, y: 0 } });
      expect(response.body[1].field_positions).toBeNull();
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/forms')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch forms');
    });
  });

  describe('GET /api/forms/:id', () => {
    test('should return a single form', async () => {
      const mockForm = {
        id: '1', title: 'Form A', description: 'Test form',
        fields: '[{"type":"text","label":"Name"}]',
        field_positions: '{"Name":{"x":0,"y":0}}'
      };
      mockDb.get.mockResolvedValue(mockForm);

      const response = await request(app).get('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Form A');
      expect(response.body.fields).toEqual([{ type: 'text', label: 'Name' }]);
      expect(response.body.field_positions).toEqual({ Name: { x: 0, y: 0 } });
    });

    test('should return 404 when form not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const response = await request(app).get('/api/forms/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Form not found');
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch form');
    });
  });

  describe('POST /api/forms', () => {
    test('should create a form successfully without file upload', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Test Form')
        .field('description', 'A test form')
        .field('fields', JSON.stringify([{ type: 'text', label: 'Name' }]))
        .field('created_by', 'user1');

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('test-form-id');
      expect(response.body.title).toBe('Test Form');
      expect(response.body.description).toBe('A test form');
      expect(response.body.fields).toEqual([{ type: 'text', label: 'Name' }]);
      expect(response.body.uploaded_file_path).toBeNull();
      expect(response.body.uploaded_file_type).toBeNull();
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/forms')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Test Form')
        .field('description', 'A test form')
        .field('fields', JSON.stringify([{ type: 'text', label: 'Name' }]));

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create form');
    });
  });

  describe('PUT /api/forms/:id', () => {
    test('should update a form successfully without file upload', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Updated Form')
        .field('description', 'Updated description')
        .field('fields', JSON.stringify([{ type: 'text', label: 'Full Name' }]));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('1');
      expect(response.body.title).toBe('Updated Form');
      expect(response.body.fields).toEqual([{ type: 'text', label: 'Full Name' }]);
      expect(response.body.uploaded_file_path).toBeNull();
      expect(response.body.uploaded_file_type).toBeNull();
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .put('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`)
        .field('title', 'Updated Form')
        .field('description', 'Updated description')
        .field('fields', JSON.stringify([{ type: 'text', label: 'Name' }]));

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update form');
    });
  });

  describe('DELETE /api/forms/:id', () => {
    test('should delete a form without uploaded file', async () => {
      mockDb.get.mockResolvedValue({ uploaded_file_path: null });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app).delete('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Form deleted successfully');
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test('should delete a form and its uploaded file', async () => {
      mockDb.get.mockResolvedValue({ uploaded_file_path: '/uploads/documents/test.pdf' });
      mockDb.run.mockResolvedValue({ changes: 1 });
      fs.existsSync.mockReturnValue(true);

      const response = await request(app).delete('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Form deleted successfully');
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/api/forms/1')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete form');
    });
  });

  describe('POST /api/forms/:id/submit', () => {
    test('should submit a form successfully', async () => {
      mockDb.run.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/forms/form-1/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          data: { name: 'John Doe', email: 'john@example.com' },
          signature: 'sig-data',
          submitted_by: 'user1'
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('test-form-id');
      expect(response.body.message).toBe('Form submitted successfully');
    });

    test('should return 500 on database error', async () => {
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/forms/form-1/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          data: { name: 'John Doe' }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to submit form');
    });
  });

  describe('GET /api/forms/:id/submissions', () => {
    test('should return form submissions', async () => {
      const mockSubmissions = [
        { id: 's1', form_id: 'form-1', data: '{"name":"John Doe"}', submitted_at: '2024-01-01' },
        { id: 's2', form_id: 'form-1', data: '{"name":"Jane Smith"}', submitted_at: '2024-01-02' }
      ];
      mockDb.query.mockResolvedValue(mockSubmissions);

      const response = await request(app).get('/api/forms/form-1/submissions')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].data).toEqual({ name: 'John Doe' });
      expect(response.body[1].data).toEqual({ name: 'Jane Smith' });
    });

    test('should return 500 on database error', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/forms/form-1/submissions')
        .set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch submissions');
    });
  });
});
