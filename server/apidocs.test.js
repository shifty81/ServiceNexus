/**
 * API Docs Tests
 * Tests for the API documentation endpoints
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const apidocsRouter = require('./routes/apidocs');

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/docs', apidocsRouter);
  return app;
};

describe('API Docs', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /api/docs', () => {
    test('should return OpenAPI 3.0 spec with correct structure', async () => {
      const response = await request(app).get('/api/docs');
      expect(response.status).toBe(200);
      expect(response.body.openapi).toBe('3.0.0');
      expect(response.body.info).toBeDefined();
      expect(response.body.paths).toBeDefined();
      expect(response.body.components).toBeDefined();
      expect(response.body.tags).toBeDefined();
    });

    test("spec should have info.title as 'ServiceNexus API'", async () => {
      const response = await request(app).get('/api/docs');
      expect(response.status).toBe(200);
      expect(response.body.info.title).toBe('ServiceNexus API');
      expect(response.body.info.version).toBeDefined();
      expect(response.body.info.description).toBeDefined();
    });
  });

  describe('GET /api/docs/endpoints', () => {
    test('should return categorized endpoint list', async () => {
      const response = await request(app).get('/api/docs/endpoints');
      expect(response.status).toBe(200);
      expect(response.body.groups).toBeDefined();
      expect(response.body.total).toBeDefined();
      expect(typeof response.body.total).toBe('number');
      expect(response.body.total).toBeGreaterThan(0);
    });

    test('should have groups and total count', async () => {
      const response = await request(app).get('/api/docs/endpoints');
      expect(response.status).toBe(200);
      const groupNames = Object.keys(response.body.groups);
      expect(groupNames.length).toBeGreaterThan(0);
      expect(groupNames).toContain('Auth');
      expect(groupNames).toContain('Forms');

      let endpointCount = 0;
      for (const group of Object.values(response.body.groups)) {
        expect(Array.isArray(group)).toBe(true);
        endpointCount += group.length;
        group.forEach(endpoint => {
          expect(endpoint.method).toBeDefined();
          expect(endpoint.path).toBeDefined();
          expect(endpoint.summary).toBeDefined();
        });
      }
      expect(endpointCount).toBe(response.body.total);
    });
  });
});
