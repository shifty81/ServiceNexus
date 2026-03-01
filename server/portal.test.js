const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

const mockDb = { query: jest.fn(), get: jest.fn(), run: jest.fn() };
jest.mock('./database', () => mockDb);

const portalRouter = require('./routes/portal');

const customerToken = jwt.sign({ id: '1', username: 'customer1', role: 'user', user_type: 'user' }, JWT_SECRET);
const technicianToken = jwt.sign({ id: '2', username: 'tech1', role: 'user', user_type: 'technician' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/portal', portalRouter);
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Portal Routes', () => {
  describe('GET /api/portal/customer/:userId', () => {
    const mockServiceCalls = [
      { id: 1, status: 'pending', created_by: 1, assigned_to_name: 'Tech A' },
      { id: 2, status: 'in-progress', created_by: 1, assigned_to_name: 'Tech B' },
      { id: 3, status: 'completed', created_by: 1, assigned_to_name: 'Tech A' },
      { id: 4, status: 'cancelled', created_by: 1, assigned_to_name: null }
    ];

    const mockInvoices = [
      { id: 1, status: 'pending', total: 500, amount_paid: 0, contact_name: 'John' },
      { id: 2, status: 'paid', total: 300, amount_paid: 300, contact_name: 'John' },
      { id: 3, status: 'partial', total: 400, amount_paid: 100, contact_name: 'Jane' }
    ];

    const mockEstimates = [
      { id: 1, total: 1000, contact_name: 'John' },
      { id: 2, total: 2000, contact_name: 'Jane' }
    ];

    const mockEquipment = [
      { id: 1, name: 'HVAC Unit', service_call_title: 'Repair' },
      { id: 2, name: 'Furnace', service_call_title: 'Install' },
      { id: 3, name: 'AC Unit', service_call_title: 'Maintenance' }
    ];

    const mockFeedback = [
      { service_call_id: 3 },
      { service_call_id: 5 }
    ];

    it('should return customer portal data with correct stats', async () => {
      const app = createTestApp();
      mockDb.query
        .mockResolvedValueOnce(mockServiceCalls)
        .mockResolvedValueOnce(mockInvoices)
        .mockResolvedValueOnce(mockEstimates)
        .mockResolvedValueOnce(mockEquipment)
        .mockResolvedValueOnce(mockFeedback);

      const res = await request(app).get('/api/portal/customer/1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      // activeRequests: pending + in-progress = 2 (not completed, not cancelled)
      expect(res.body.stats.activeRequests).toBe(2);
      // completedRequests: 1 completed
      expect(res.body.stats.completedRequests).toBe(1);
      // pendingInvoices: pending + partial = 2
      expect(res.body.stats.pendingInvoices).toBe(2);
      // totalOwed: invoices not paid -> inv1 (500-0) + inv3 (400-100) = 800
      expect(res.body.stats.totalOwed).toBe(800);
      // totalEquipment: 3
      expect(res.body.stats.totalEquipment).toBe(3);

      expect(res.body.serviceCalls).toHaveLength(4);
      expect(res.body.invoices).toHaveLength(3);
      expect(res.body.estimates).toHaveLength(2);
      expect(res.body.equipment).toHaveLength(3);
      expect(res.body.ratedServiceCallIds).toEqual([3, 5]);
      expect(mockDb.query).toHaveBeenCalledTimes(5);
    });

    it('should limit results to 10 items per category', async () => {
      const app = createTestApp();
      const largeServiceCalls = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1, status: 'pending', created_by: 1
      }));

      mockDb.query
        .mockResolvedValueOnce(largeServiceCalls)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await request(app).get('/api/portal/customer/1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.serviceCalls).toHaveLength(10);
      expect(res.body.stats.activeRequests).toBe(15);
    });

    it('should return 500 on database error', async () => {
      const app = createTestApp();
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/portal/customer/1')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to load portal data');
    });
  });

  describe('GET /api/portal/technician/:userId', () => {
    const today = new Date().toISOString();

    const mockAssignedCalls = [
      { id: 1, status: 'in-progress', assigned_to: 2 },
      { id: 2, status: 'in-progress', assigned_to: 2 },
      { id: 3, status: 'pending', assigned_to: 2 },
      { id: 4, status: 'completed', assigned_to: 2, completed_at: today },
      { id: 5, status: 'completed', assigned_to: 2, completed_at: '2023-01-01T00:00:00.000Z' }
    ];

    const mockDispatches = [
      { id: 1, status: 'pending', assigned_to: 2 },
      { id: 2, status: 'in-progress', assigned_to: 2 }
    ];

    const mockTimeEntries = [
      { id: 1, user_id: 2, status: 'active', clock_in: today, total_hours: 2.5 },
      { id: 2, user_id: 2, status: 'completed', clock_in: today, total_hours: 3.7 },
      { id: 3, user_id: 2, status: 'completed', clock_in: '2023-01-01T00:00:00.000Z', total_hours: 8 }
    ];

    const mockRecentPOs = [
      { id: 1, requested_by: 2, status: 'approved' }
    ];

    const mockFeedbackRows = [
      { rating: 5, comment: 'Great work', service_call_title: 'Repair' },
      { rating: 4, comment: 'Good', service_call_title: 'Install' }
    ];

    const mockFeedbackStats = { total_reviews: 5, average_rating: 4.5 };

    it('should return technician portal data with correct stats', async () => {
      const app = createTestApp();
      mockDb.query
        .mockResolvedValueOnce(mockAssignedCalls)
        .mockResolvedValueOnce(mockDispatches)
        .mockResolvedValueOnce(mockTimeEntries)
        .mockResolvedValueOnce(mockRecentPOs)
        .mockResolvedValueOnce(mockFeedbackRows);
      mockDb.get.mockResolvedValueOnce(mockFeedbackStats);

      const res = await request(app).get('/api/portal/technician/2')
        .set('Authorization', `Bearer ${technicianToken}`);

      expect(res.status).toBe(200);
      // activeJobs: 2 in-progress
      expect(res.body.stats.activeJobs).toBe(2);
      // pendingJobs: 1 pending
      expect(res.body.stats.pendingJobs).toBe(1);
      // completedToday: 1 completed today
      expect(res.body.stats.completedToday).toBe(1);
      // todayHours: 2.5 + 3.7 = 6.2 (only today entries)
      expect(res.body.stats.todayHours).toBe(6.2);
      // isClockedIn: true (active time entry exists)
      expect(res.body.stats.isClockedIn).toBe(true);
      // averageRating: 4.5
      expect(res.body.stats.averageRating).toBe(4.5);
      // totalReviews: 5
      expect(res.body.stats.totalReviews).toBe(5);

      expect(res.body.assignedCalls).toHaveLength(5);
      expect(res.body.dispatches).toHaveLength(2);
      expect(res.body.timeEntries).toHaveLength(3);
      expect(res.body.recentPOs).toHaveLength(1);
      expect(res.body.activeTimeEntry).toEqual(mockTimeEntries[0]);
      expect(res.body.recentFeedback).toEqual(mockFeedbackRows);
      expect(mockDb.query).toHaveBeenCalledTimes(5);
      expect(mockDb.get).toHaveBeenCalledTimes(1);
    });

    it('should handle no active time entry (not clocked in)', async () => {
      const app = createTestApp();
      const noActiveEntries = [
        { id: 1, user_id: 2, status: 'completed', clock_in: '2023-01-01T00:00:00.000Z', total_hours: 8 }
      ];

      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(noActiveEntries)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_reviews: 0, average_rating: 0 });

      const res = await request(app).get('/api/portal/technician/2')
        .set('Authorization', `Bearer ${technicianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.isClockedIn).toBe(false);
      expect(res.body.stats.activeJobs).toBe(0);
      expect(res.body.stats.pendingJobs).toBe(0);
      expect(res.body.stats.todayHours).toBe(0);
      expect(res.body.stats.averageRating).toBe(0);
      expect(res.body.stats.totalReviews).toBe(0);
      expect(res.body.activeTimeEntry).toBeUndefined();
    });

    it('should handle null feedbackStats gracefully', async () => {
      const app = createTestApp();
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/portal/technician/2')
        .set('Authorization', `Bearer ${technicianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.averageRating).toBe(0);
      expect(res.body.stats.totalReviews).toBe(0);
    });

    it('should return 500 on database error', async () => {
      const app = createTestApp();
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/portal/technician/2')
        .set('Authorization', `Bearer ${technicianToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to load portal data');
    });
  });
});
