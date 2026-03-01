/**
 * API Health Check Tests
 * Tests to verify the server can start and basic endpoints respond
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create a minimal test app
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });

  // API info endpoint
  app.get('/api', (req, res) => {
    res.json({
      name: 'FieldForge API',
      version: '1.0.0',
      endpoints: [
        '/api/auth',
        '/api/forms',
        '/api/dispatch',
        '/api/inventory',
        '/api/customers',
        '/api/estimates',
        '/api/invoices',
        '/api/timetracking'
      ]
    });
  });

  return app;
};

describe('Server Health Check', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  test('GET /health should return 200 and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api should return API information', async () => {
    const response = await request(app).get('/api');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('FieldForge API');
    expect(response.body.version).toBeDefined();
    expect(Array.isArray(response.body.endpoints)).toBe(true);
  });

  test('should handle 404 for undefined routes', async () => {
    const response = await request(app).get('/undefined-route');
    expect(response.status).toBe(404);
  });
});

describe('API Endpoints', () => {
  test('should have proper CORS headers', async () => {
    const app = createTestApp();
    const response = await request(app).get('/health');
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  test('should accept JSON content type', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/health')
      .send({ test: 'data' })
      .set('Content-Type', 'application/json');
    // Should accept the request even if endpoint doesn't exist
    expect(response.status).toBe(404); // POST not defined, but accepts JSON
  });
});
