const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, role, user_type } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await db.run(
      'INSERT INTO users (id, username, password, email, role, user_type) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, hashedPassword, email, role || 'user', user_type || 'user']
    );

    const token = jwt.sign({ id, username, role: role || 'user', user_type: user_type || 'user' }, JWT_SECRET);
    res.json({ token, user: { id, username, email, role: role || 'user', user_type: user_type || 'user' } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, user_type: user.user_type },
      JWT_SECRET
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        user_type: user.user_type
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all users (for dropdowns, etc.)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.query('SELECT id, username, email, role, user_type FROM users ORDER BY username');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
