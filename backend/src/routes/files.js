const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('./auth');

// GET /api/files/:id/content — return file content for Monaco
router.get('/:id/content', requireAuth, (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM analysis_files WHERE id=?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  // Verify access via analysis ownership
  const analysis = db.prepare('SELECT user_id FROM analyses WHERE id=?').get(file.analysis_id);
  if (analysis?.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });

  res.json({
    id: file.id,
    path: file.path,
    name: file.name,
    language: file.language,
    content: file.content || '',
    size: file.size
  });
});

// GET /api/files/:analysisId/search?q=term — full-text search across analysis
router.get('/:analysisId/search', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  const db = getDb();
  try {
    const results = db.prepare(`
      SELECT af.id, af.path, af.name, af.language,
             snippet(files_fts, 3, '<mark>', '</mark>', '...', 20) AS snippet
      FROM files_fts
      JOIN analysis_files af ON af.rowid = files_fts.rowid
      WHERE files_fts.analysis_id = ? AND files_fts MATCH ?
      LIMIT 50
    `).all(req.params.analysisId, q + '*');
    res.json({ results });
  } catch (err) {
    res.json({ results: [] });
  }
});

module.exports = router;
