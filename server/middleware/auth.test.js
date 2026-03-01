const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';

describe('Auth Middleware', () => {
  let authenticateToken;
  let requireAdmin;
  let req;
  let res;
  let next;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    jest.resetModules();
    ({ authenticateToken, requireAdmin } = require('./auth'));
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should call next with valid token', () => {
      const token = jwt.sign({ id: 'user-1', username: 'testuser', role: 'user', user_type: 'user' }, JWT_SECRET);
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
      expect(req.user.username).toBe('testuser');
    });

    it('should return 401 when no authorization header', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header has no token', () => {
      req.headers['authorization'] = 'Bearer ';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token is invalid', () => {
      req.headers['authorization'] = 'Bearer invalid-token';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token is expired', () => {
      const token = jwt.sign({ id: 'user-1' }, JWT_SECRET, { expiresIn: '-1s' });
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      jest.resetModules();
      ({ authenticateToken } = require('./auth'));

      const token = jwt.sign({ id: 'user-1' }, JWT_SECRET);
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next when user has admin role', () => {
      req.user = { id: 'user-1', role: 'admin', user_type: 'admin' };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next when user has admin user_type', () => {
      req.user = { id: 'user-1', role: 'user', user_type: 'admin' };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when user is not admin', () => {
      req.user = { id: 'user-1', role: 'user', user_type: 'user' };

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not set', () => {
      req.user = undefined;

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
