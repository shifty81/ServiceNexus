/**
 * Analytics API Tests
 * Tests for the analytics dashboard endpoint
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

const analyticsRouter = require('./routes/analytics');

const adminToken = jwt.sign({ id: 'admin-1', username: 'admin', role: 'admin', user_type: 'admin' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/analytics', analyticsRouter);
  return app;
};

describe('Analytics API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics', () => {
    test('should return analytics data with all sections', async () => {
      mockDb.get.mockImplementation((sql) => {
        if (sql.includes('FROM invoices') && sql.includes('SUM(total)')) {
          return Promise.resolve({ totalRevenue: 50000, totalPaid: 30000, totalOutstanding: 20000, invoiceCount: 10, paidInvoiceCount: 6, averageInvoiceValue: 5000 });
        }
        if (sql.includes('FROM service_calls') && sql.includes('COUNT(*)')) {
          return Promise.resolve({ totalServiceCalls: 20, completedCalls: 15, pendingCalls: 3, inProgressCalls: 2 });
        }
        if (sql.includes('FROM feedback') && sql.includes('AVG(rating)')) {
          return Promise.resolve({ averageRating: 4.5, totalFeedback: 12 });
        }
        if (sql.includes('FROM time_entries') && sql.includes('SUM(total_hours)')) {
          return Promise.resolve({ totalHoursWorked: 500, totalPayroll: 15000, activeEmployees: 5, averageHoursPerEntry: 8.2 });
        }
        if (sql.includes('COUNT(*) AS count FROM customers') && !sql.includes('strftime')) {
          return Promise.resolve({ count: 25 });
        }
        if (sql.includes('FROM customers') && sql.includes('strftime')) {
          return Promise.resolve({ count: 3 });
        }
        if (sql.includes('FROM dispatches')) {
          return Promise.resolve({ totalDispatches: 30, completedDispatches: 22 });
        }
        if (sql.includes('FROM forms')) {
          return Promise.resolve({ totalForms: 8 });
        }
        if (sql.includes('FROM form_submissions')) {
          return Promise.resolve({ totalSubmissions: 45 });
        }
        if (sql.includes('FROM inventory')) {
          return Promise.resolve({ totalInventoryItems: 100, lowStockItems: 5 });
        }
        if (sql.includes('FROM estimates')) {
          return Promise.resolve({ totalEstimates: 15, acceptedEstimates: 9 });
        }
        return Promise.resolve({});
      });

      mockDb.query.mockImplementation((sql) => {
        if (sql.includes('FROM invoices') && sql.includes('GROUP BY month')) {
          return Promise.resolve([{ month: '2026-01', revenue: 10000, paid: 8000, count: 3 }]);
        }
        if (sql.includes('FROM service_calls') && sql.includes('GROUP BY month')) {
          return Promise.resolve([{ month: '2026-01', total: 5, completed: 4 }]);
        }
        if (sql.includes('FROM users') && sql.includes('LEFT JOIN')) {
          return Promise.resolve([{ user_id: 'u1', username: 'john', totalHours: 100, totalPay: 3000, averageRating: 4.8, completedCalls: 10 }]);
        }
        if (sql.includes('FROM customers') && sql.includes('GROUP BY month')) {
          return Promise.resolve([{ month: '2026-01', count: 3 }]);
        }
        if (sql.includes('FROM customers') && sql.includes('JOIN invoices')) {
          return Promise.resolve([{ customer_id: 'c1', name: 'Acme Corp', totalRevenue: 15000, invoiceCount: 4 }]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app).get('/api/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.revenue).toBeDefined();
      expect(response.body.revenue.totalRevenue).toBe(50000);
      expect(response.body.servicePerformance).toBeDefined();
      expect(response.body.servicePerformance.completionRate).toBe(75);
      expect(response.body.teamProductivity).toBeDefined();
      expect(response.body.teamProductivity.topTechnicians.length).toBe(1);
      expect(response.body.customerInsights).toBeDefined();
      expect(response.body.customerInsights.totalCustomers).toBe(25);
      expect(response.body.operationalMetrics).toBeDefined();
      expect(response.body.operationalMetrics.totalForms).toBe(8);
    });

    test('should return 500 on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch analytics data');
    });

    test('should handle zero data gracefully', async () => {
      mockDb.get.mockImplementation((sql) => {
        if (sql.includes('FROM invoices') && sql.includes('SUM(total)')) {
          return Promise.resolve({ totalRevenue: 0, totalPaid: 0, totalOutstanding: 0, invoiceCount: 0, paidInvoiceCount: 0, averageInvoiceValue: 0 });
        }
        if (sql.includes('FROM service_calls') && sql.includes('COUNT(*)')) {
          return Promise.resolve({ totalServiceCalls: 0, completedCalls: 0, pendingCalls: 0, inProgressCalls: 0 });
        }
        if (sql.includes('FROM feedback')) {
          return Promise.resolve({ averageRating: 0, totalFeedback: 0 });
        }
        if (sql.includes('FROM time_entries')) {
          return Promise.resolve({ totalHoursWorked: 0, totalPayroll: 0, activeEmployees: 0, averageHoursPerEntry: 0 });
        }
        if (sql.includes('FROM customers') && sql.includes('strftime')) {
          return Promise.resolve({ count: 0 });
        }
        if (sql.includes('FROM customers')) {
          return Promise.resolve({ count: 0 });
        }
        if (sql.includes('FROM dispatches')) {
          return Promise.resolve({ totalDispatches: 0, completedDispatches: 0 });
        }
        if (sql.includes('FROM forms')) {
          return Promise.resolve({ totalForms: 0 });
        }
        if (sql.includes('FROM form_submissions')) {
          return Promise.resolve({ totalSubmissions: 0 });
        }
        if (sql.includes('FROM inventory')) {
          return Promise.resolve({ totalInventoryItems: 0, lowStockItems: 0 });
        }
        if (sql.includes('FROM estimates')) {
          return Promise.resolve({ totalEstimates: 0, acceptedEstimates: 0 });
        }
        return Promise.resolve({});
      });

      mockDb.query.mockResolvedValue([]);

      const response = await request(app).get('/api/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.revenue.totalRevenue).toBe(0);
      expect(response.body.servicePerformance.completionRate).toBe(0);
      expect(response.body.operationalMetrics.estimateConversionRate).toBe(0);
    });
  });
});
