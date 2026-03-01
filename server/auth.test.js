const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const JWT_SECRET = 'test-jwt-secret';
// Set JWT_SECRET before requiring routes
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
  v4: () => 'test-user-id'
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRouter = require('./routes/auth');

const authToken = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);

const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use('/api/auth', authRouter);
  return app;
};

describe('Auth API', () => {
  let app;
  beforeAll(() => { app = createTestApp(); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'testpass', email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toMatchObject({
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        user_type: 'user'
      });

      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.id).toBe('test-user-id');
      expect(decoded.username).toBe('testuser');
    });

    it('should register with custom role and user_type', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      mockDb.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'admin1', password: 'pass', email: 'a@b.com', role: 'admin', user_type: 'technician' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.user_type).toBe('technician');
    });

    it('should return 400 when username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'testpass' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password required');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username and password required');
    });

    it('should return 500 when database insert fails', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      mockDb.run.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'testpass' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Registration failed');
    });
  });

  describe('POST /api/auth/login', () => {
    const storedUser = {
      id: 'user-1',
      username: 'testuser',
      password: 'hashed-password',
      email: 'test@example.com',
      role: 'user',
      user_type: 'admin'
    };

    it('should login successfully with valid credentials', async () => {
      mockDb.get.mockResolvedValue(storedUser);
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toMatchObject({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        user_type: 'admin'
      });
      expect(res.body.user.password).toBeUndefined();
    });

    it('should return 401 when user is not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'testpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 401 when password is incorrect', async () => {
      mockDb.get.mockResolvedValue(storedUser);
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 500 when database query fails', async () => {
      mockDb.get.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Login failed');
    });
  });

  describe('GET /api/auth/users', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: '1', username: 'alice', email: 'alice@example.com', role: 'admin', user_type: 'admin' },
        { id: '2', username: 'bob', email: 'bob@example.com', role: 'user', user_type: 'technician' }
      ];
      mockDb.query.mockResolvedValue(mockUsers);

      const res = await request(app).get('/api/auth/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].username).toBe('alice');
      expect(res.body[1].username).toBe('bob');
    });

    it('should return empty array when no users exist', async () => {
      mockDb.query.mockResolvedValue([]);

      const res = await request(app).get('/api/auth/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 500 when database query fails', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/auth/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch users');
    });
  });
});
