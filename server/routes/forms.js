const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { safeJsonParse } = require('../utils/routeHelpers');

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedExtensions = /jpeg|jpg|png|gif|pdf|doc|docx|bmp|webp/;
    const allowedMimeTypes = /image\/(jpeg|jpg|png|gif|bmp|webp)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/;
    
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and Word documents are allowed!'));
    }
  }
});

// Get all forms
router.get('/', async (req, res) => {
  try {
    const forms = await db.query('SELECT * FROM forms ORDER BY created_at DESC');
    res.json(forms.map(form => ({
      ...form,
      fields: safeJsonParse(form.fields, []),
      field_positions: form.field_positions ? safeJsonParse(form.field_positions) : null
    })));
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get single form
router.get('/:id', async (req, res) => {
  try {
    const form = await db.get('SELECT * FROM forms WHERE id = ?', [req.params.id]);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json({
      ...form,
      fields: safeJsonParse(form.fields, []),
      field_positions: form.field_positions ? safeJsonParse(form.field_positions) : null
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Create form (with optional file upload)
router.post('/', upload.single('document'), async (req, res) => {
  try {
    const { title, description, fields, field_positions, created_by } = req.body;
    const id = uuidv4();
    
    let filePath = null;
    let fileType = null;
    
    if (req.file) {
      filePath = `/uploads/documents/${req.file.filename}`;
      fileType = req.file.mimetype;
    }

    await db.run(
      'INSERT INTO forms (id, title, description, fields, uploaded_file_path, uploaded_file_type, field_positions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description, fields, filePath, fileType, field_positions || null, created_by || null]
    );

    res.status(201).json({ 
      id, 
      title, 
      description, 
      fields: safeJsonParse(fields, []),
      uploaded_file_path: filePath,
      uploaded_file_type: fileType,
      field_positions: field_positions ? safeJsonParse(field_positions) : null
    });
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Update form (with optional file upload)
router.put('/:id', upload.single('document'), async (req, res) => {
  try {
    const { title, description, fields, field_positions } = req.body;
    
    let filePath = null;
    let fileType = null;
    
    if (req.file) {
      filePath = `/uploads/documents/${req.file.filename}`;
      fileType = req.file.mimetype;
      
      await db.run(
        'UPDATE forms SET title = ?, description = ?, fields = ?, uploaded_file_path = ?, uploaded_file_type = ?, field_positions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, description, fields, filePath, fileType, field_positions || null, req.params.id]
      );
    } else {
      await db.run(
        'UPDATE forms SET title = ?, description = ?, fields = ?, field_positions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, description, fields, field_positions || null, req.params.id]
      );
    }
    
    res.json({ 
      id: req.params.id, 
      title, 
      description, 
      fields: safeJsonParse(fields, []),
      uploaded_file_path: filePath,
      uploaded_file_type: fileType,
      field_positions: field_positions ? safeJsonParse(field_positions) : null
    });
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: 'Failed to update form' });
  }
});

// Delete form
router.delete('/:id', async (req, res) => {
  try {
    // Get the form to check if it has an uploaded file
    const form = await db.get('SELECT uploaded_file_path FROM forms WHERE id = ?', [req.params.id]);
    
    // Delete the uploaded file if it exists
    if (form && form.uploaded_file_path) {
      const filePath = path.join(__dirname, '../../', form.uploaded_file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await db.run('DELETE FROM forms WHERE id = ?', [req.params.id]);
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

// Submit form
router.post('/:id/submit', async (req, res) => {
  try {
    const { data, signature, submitted_by } = req.body;
    const id = uuidv4();

    await db.run(
      'INSERT INTO form_submissions (id, form_id, data, signature, submitted_by) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, JSON.stringify(data), signature || null, submitted_by || null]
    );

    res.status(201).json({ id, message: 'Form submitted successfully' });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

// Get form submissions
router.get('/:id/submissions', async (req, res) => {
  try {
    const submissions = await db.query(
      'SELECT * FROM form_submissions WHERE form_id = ? ORDER BY submitted_at DESC',
      [req.params.id]
    );
    res.json(submissions.map(sub => ({
      ...sub,
      data: safeJsonParse(sub.data, {})
    })));
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;
