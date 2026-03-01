const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');

// Rate limiter for file upload and deletion operations
const fileOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many file operations from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/service-call-pictures');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Extract serial numbers from text using simple patterns
// TODO: Enhance with actual OCR/AI service for better serial number detection
function extractSerialNumbers(text) {
  if (!text) return [];
  
  const serialPatterns = [
    /\b[A-Z]{2,}\d{6,}\b/g,  // Pattern like ABC123456
    /\b\d{10,}\b/g,           // Pattern like 1234567890
    /\bSN[:\s]?([A-Z0-9-]+)\b/gi,  // Pattern like SN: ABC-123
    /\bSerial[:\s]?([A-Z0-9-]+)\b/gi,  // Pattern like Serial: ABC-123
  ];
  
  const found = new Set();
  serialPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => found.add(match.trim()));
    }
  });
  
  return Array.from(found);
}

// Upload picture for service call
router.post('/upload', authenticateToken, upload.single('picture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { service_call_id, uploaded_by, comment } = req.body;
    const id = uuidv4();
    
    // In a real implementation, you would use OCR here to extract text from the image
    // For now, we'll use the comment field to extract serial numbers
    const serialNumbers = extractSerialNumbers(comment);

    await db.run(
      `INSERT INTO service_call_pictures (id, service_call_id, file_path, file_name, serial_numbers, comment, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, service_call_id, req.file.path, req.file.originalname, JSON.stringify(serialNumbers), comment, uploaded_by]
    );

    const picture = await db.get(`
      SELECT p.*, u.username
      FROM service_call_pictures p
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.id = ?
    `, [id]);

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('picture-uploaded', {
        serviceCallId: service_call_id,
        picture
      });
    }

    res.json(picture);
  } catch (error) {
    console.error('Error uploading picture:', error);
    res.status(500).json({ error: 'Failed to upload picture' });
  }
});

// Get pictures for service call
router.get('/servicecall/:serviceCallId', authenticateToken, async (req, res) => {
  try {
    const pictures = await db.query(`
      SELECT p.*, u.username
      FROM service_call_pictures p
      LEFT JOIN users u ON p.uploaded_by = u.id
      WHERE p.service_call_id = ?
      ORDER BY p.uploaded_at DESC
    `, [req.params.serviceCallId]);

    res.json(pictures);
  } catch (error) {
    console.error('Error fetching pictures:', error);
    res.status(500).json({ error: 'Failed to fetch pictures' });
  }
});

// Update picture comment
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { comment } = req.body;
    
    // Re-extract serial numbers from updated comment
    const serialNumbers = extractSerialNumbers(comment);

    await db.run(
      `UPDATE service_call_pictures 
       SET comment = ?, serial_numbers = ?
       WHERE id = ?`,
      [comment, JSON.stringify(serialNumbers), req.params.id]
    );

    const picture = await db.get('SELECT * FROM service_call_pictures WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('picture-updated', picture);
    }

    res.json(picture);
  } catch (error) {
    console.error('Error updating picture:', error);
    res.status(500).json({ error: 'Failed to update picture' });
  }
});

// Delete picture
router.delete('/:id', authenticateToken, fileOperationLimiter, async (req, res) => {
  try {
    const picture = await db.get('SELECT * FROM service_call_pictures WHERE id = ?', [req.params.id]);
    
    if (picture) {
      // Delete file from filesystem
      try {
        await fs.unlink(picture.file_path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }

    await db.run('DELETE FROM service_call_pictures WHERE id = ?', [req.params.id]);
    
    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').emit('picture-deleted', { id: req.params.id });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting picture:', error);
    res.status(500).json({ error: 'Failed to delete picture' });
  }
});

// Serve uploaded pictures
router.get('/view/:filename', authenticateToken, fileOperationLimiter, (req, res) => {
  const filename = path.basename(req.params.filename);
  const uploadDir = path.resolve(__dirname, '../../uploads/service-call-pictures');
  const filePath = path.join(uploadDir, filename);

  // Ensure the resolved path is within the upload directory
  if (!filePath.startsWith(uploadDir)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  res.sendFile(filePath);
});

module.exports = router;
