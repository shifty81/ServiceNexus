const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { validateRequired } = require('../utils/routeHelpers');

// Get all tags
router.get('/', async (req, res) => {
  try {
    const tags = await db.query('SELECT * FROM tags ORDER BY name ASC');
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Create tag
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;

    const validationError = validateRequired(req.body, ['name']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)',
      [id, name, color || '#6366f1']
    );

    const tag = await db.get('SELECT * FROM tags WHERE id = ?', [id]);
    res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update tag
router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    await db.run(
      'UPDATE tags SET name = ?, color = ? WHERE id = ?',
      [name, color, req.params.id]
    );
    const tag = await db.get('SELECT * FROM tags WHERE id = ?', [req.params.id]);
    res.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete tag (and its assignments)
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM tag_assignments WHERE tag_id = ?', [req.params.id]);
    await db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// Assign tag to an entity (customer, dispatch, service_call)
router.post('/assign', async (req, res) => {
  try {
    const { tag_id, entity_type, entity_id } = req.body;

    const validationError = validateRequired(req.body, ['tag_id', 'entity_type', 'entity_id']);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Check for duplicate
    const existing = await db.get(
      'SELECT * FROM tag_assignments WHERE tag_id = ? AND entity_type = ? AND entity_id = ?',
      [tag_id, entity_type, entity_id]
    );
    if (existing) {
      return res.status(409).json({ error: 'Tag already assigned' });
    }

    const id = uuidv4();
    await db.run(
      'INSERT INTO tag_assignments (id, tag_id, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [id, tag_id, entity_type, entity_id]
    );
    res.status(201).json({ id, tag_id, entity_type, entity_id });
  } catch (error) {
    console.error('Error assigning tag:', error);
    res.status(500).json({ error: 'Failed to assign tag' });
  }
});

// Remove tag from an entity
router.delete('/assign/:tag_id/:entity_type/:entity_id', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM tag_assignments WHERE tag_id = ? AND entity_type = ? AND entity_id = ?',
      [req.params.tag_id, req.params.entity_type, req.params.entity_id]
    );
    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Get tags for an entity
router.get('/entity/:entity_type/:entity_id', async (req, res) => {
  try {
    const tags = await db.query(`
      SELECT t.* FROM tags t
      JOIN tag_assignments ta ON t.id = ta.tag_id
      WHERE ta.entity_type = ? AND ta.entity_id = ?
      ORDER BY t.name ASC
    `, [req.params.entity_type, req.params.entity_id]);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching entity tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get all entities for a tag
router.get('/:id/entities', async (req, res) => {
  try {
    const assignments = await db.query(
      'SELECT * FROM tag_assignments WHERE tag_id = ?',
      [req.params.id]
    );
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching tag entities:', error);
    res.status(500).json({ error: 'Failed to fetch tag entities' });
  }
});

module.exports = router;
