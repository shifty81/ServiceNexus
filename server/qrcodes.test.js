const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

const mockDb = { query: jest.fn(), get: jest.fn(), run: jest.fn() };
jest.mock('./database', () => mockDb);
jest.mock('uuid', () => ({ v4: () => 'test-qr-id' }));

const qrcodesRouter = require('./routes/qrcodes');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const mockIo = { emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/qrcodes', qrcodesRouter);
  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// 1. POST /generate
describe('POST /api/qrcodes/generate', () => {
  it('should create a QR code', async () => {
    const qrCode = { id: 'test-qr-id', customer_id: 'cust-1', qr_code_data: 'FIELDFORGE-test-qr-id', location_name: 'Main Office' };
    mockDb.run.mockResolvedValue({});
    mockDb.get.mockResolvedValue(qrCode);
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/generate').set('Authorization', `Bearer ${authToken}`).send({ customer_id: 'cust-1', location_name: 'Main Office' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(qrCode);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO qr_codes'),
      ['test-qr-id', 'cust-1', 'FIELDFORGE-test-qr-id', 'Main Office']
    );
  });

  it('should return 500 on db error', async () => {
    mockDb.run.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/generate').set('Authorization', `Bearer ${authToken}`).send({ customer_id: 'cust-1', location_name: 'Office' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to generate QR code');
  });
});

// 2. GET /customer/:customerId
describe('GET /api/qrcodes/customer/:customerId', () => {
  it('should return QR codes for a customer', async () => {
    const qrCodes = [{ id: 'qr-1', customer_id: 'cust-1', location_name: 'Office' }];
    mockDb.query.mockResolvedValue(qrCodes);
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/customer/cust-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(qrCodes);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM qr_codes'), ['cust-1']);
  });

  it('should return 500 on db error', async () => {
    mockDb.query.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/customer/cust-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch QR codes');
  });
});

// 3. POST /validate
describe('POST /api/qrcodes/validate', () => {
  it('should validate an active QR code', async () => {
    const qrCode = { id: 'qr-1', qr_code_data: 'FIELDFORGE-qr-1', is_active: 1, contact_name: 'John', company_name: 'Acme' };
    mockDb.get.mockResolvedValue(qrCode);
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/validate').set('Authorization', `Bearer ${authToken}`).send({ qr_code_data: 'FIELDFORGE-qr-1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(qrCode);
  });

  it('should return 404 for invalid or inactive QR code', async () => {
    mockDb.get.mockResolvedValue(null);
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/validate').set('Authorization', `Bearer ${authToken}`).send({ qr_code_data: 'INVALID' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Invalid or inactive QR code');
  });

  it('should return 500 on db error', async () => {
    mockDb.get.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/validate').set('Authorization', `Bearer ${authToken}`).send({ qr_code_data: 'FIELDFORGE-qr-1' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to validate QR code');
  });
});

// 4. PUT /:id/deactivate
describe('PUT /api/qrcodes/:id/deactivate', () => {
  it('should deactivate a QR code', async () => {
    mockDb.run.mockResolvedValue({});
    const app = createTestApp();
    const res = await request(app).put('/api/qrcodes/qr-1/deactivate')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE qr_codes SET is_active = 0'), ['qr-1']);
  });

  it('should return 500 on db error', async () => {
    mockDb.run.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).put('/api/qrcodes/qr-1/deactivate')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to deactivate QR code');
  });
});

// 5. POST /checkin
describe('POST /api/qrcodes/checkin', () => {
  const checkinPayload = {
    service_call_id: 'sc-1',
    technician_id: 'tech-1',
    qr_code_id: 'qr-1',
    location_latitude: 40.7128,
    location_longitude: -74.006,
    notes: 'Arrived on site'
  };

  it('should check in a technician', async () => {
    const qrCode = { id: 'qr-1', is_active: 1 };
    const checkIn = { id: 'test-qr-id', service_call_id: 'sc-1', technician_id: 'tech-1', technician_name: 'john' };
    mockDb.get
      .mockResolvedValueOnce(qrCode)       // validate QR code
      .mockResolvedValueOnce(null)          // no existing check-in
      .mockResolvedValueOnce(checkIn);      // return created check-in
    mockDb.run.mockResolvedValue({});
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/checkin').set('Authorization', `Bearer ${authToken}`).send(checkinPayload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(checkIn);
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO check_ins'), expect.any(Array));
  });

  it('should return 400 for invalid or inactive QR code', async () => {
    mockDb.get.mockResolvedValueOnce(null); // QR code not found
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/checkin').set('Authorization', `Bearer ${authToken}`).send(checkinPayload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or inactive QR code');
  });

  it('should return 400 if technician is already checked in', async () => {
    const qrCode = { id: 'qr-1', is_active: 1 };
    const existingCheckIn = { id: 'existing-id', service_call_id: 'sc-1', technician_id: 'tech-1' };
    mockDb.get
      .mockResolvedValueOnce(qrCode)            // valid QR code
      .mockResolvedValueOnce(existingCheckIn);   // already checked in
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/checkin').set('Authorization', `Bearer ${authToken}`).send(checkinPayload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Technician is already checked in');
  });

  it('should emit socket event on successful check-in', async () => {
    const qrCode = { id: 'qr-1', is_active: 1 };
    const checkIn = { id: 'test-qr-id', service_call_id: 'sc-1', technician_id: 'tech-1', technician_name: 'john' };
    mockDb.get
      .mockResolvedValueOnce(qrCode)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(checkIn);
    mockDb.run.mockResolvedValue({});
    const app = createTestApp();
    await request(app).post('/api/qrcodes/checkin').set('Authorization', `Bearer ${authToken}`).send(checkinPayload);
    const mockIo = app.get('io');
    expect(mockIo.emit).toHaveBeenCalledWith('technician-checked-in', checkIn);
  });

  it('should return 500 on db error', async () => {
    mockDb.get.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/checkin').set('Authorization', `Bearer ${authToken}`).send(checkinPayload);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to check in');
  });
});

// 6. POST /checkout/:checkInId
describe('POST /api/qrcodes/checkout/:checkInId', () => {
  it('should check out a technician', async () => {
    const checkIn = { id: 'ci-1', check_out_time: '2024-01-01', technician_name: 'john' };
    mockDb.run.mockResolvedValue({});
    mockDb.get.mockResolvedValue(checkIn);
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/checkout/ci-1').set('Authorization', `Bearer ${authToken}`).send({ notes: 'Work complete' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(checkIn);
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('check_out_time = CURRENT_TIMESTAMP'), ['Work complete', 'ci-1']);
  });

  it('should emit socket event on successful check-out', async () => {
    const checkIn = { id: 'ci-1', check_out_time: '2024-01-01', technician_name: 'john' };
    mockDb.run.mockResolvedValue({});
    mockDb.get.mockResolvedValue(checkIn);
    const app = createTestApp();
    await request(app).post('/api/qrcodes/checkout/ci-1').set('Authorization', `Bearer ${authToken}`).send({ notes: 'Done' });
    const mockIo = app.get('io');
    expect(mockIo.emit).toHaveBeenCalledWith('technician-checked-out', checkIn);
  });

  it('should return 500 on db error', async () => {
    mockDb.run.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).post('/api/qrcodes/checkout/ci-1').set('Authorization', `Bearer ${authToken}`).send({ notes: 'Done' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to check out');
  });
});

// 7. GET /active/:technicianId
describe('GET /api/qrcodes/active/:technicianId', () => {
  it('should return active check-in for technician', async () => {
    const checkIn = { id: 'ci-1', technician_id: 'tech-1', technician_name: 'john', service_call_title: 'Repair' };
    mockDb.get.mockResolvedValue(checkIn);
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/active/tech-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(checkIn);
  });

  it('should return null when no active check-in', async () => {
    mockDb.get.mockResolvedValue(null);
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/active/tech-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('should return 500 on db error', async () => {
    mockDb.get.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/active/tech-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch active check-in');
  });
});

// 8. GET /servicecall/:serviceCallId
describe('GET /api/qrcodes/servicecall/:serviceCallId', () => {
  it('should return check-ins for a service call', async () => {
    const checkIns = [{ id: 'ci-1', service_call_id: 'sc-1', technician_name: 'john' }];
    mockDb.query.mockResolvedValue(checkIns);
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/servicecall/sc-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(checkIns);
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('SELECT ci.*'), ['sc-1']);
  });

  it('should return 500 on db error', async () => {
    mockDb.query.mockRejectedValue(new Error('DB error'));
    const app = createTestApp();
    const res = await request(app).get('/api/qrcodes/servicecall/sc-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch check-ins');
  });
});
