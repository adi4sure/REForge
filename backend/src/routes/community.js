const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('./auth');

// GET /api/community — public feed
router.get('/', (req, res) => {
  const db = getDb();
  const { page = 1, tag, search } = req.query;
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;

  let query = `
    SELECT cp.id, cp.title, cp.summary, cp.tags, cp.views, cp.upvotes, cp.created_at,
           cp.author, a.file_type, a.sha256, a.original_name
    FROM community_posts cp
    LEFT JOIN analyses a ON cp.analysis_id = a.id
    WHERE cp.is_public = 1
  `;
  const params = [];

  if (search) { query += ' AND (cp.title LIKE ? OR cp.summary LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (tag) { query += ' AND cp.tags LIKE ?'; params.push(`%"${tag}"%`); }

  query += ' ORDER BY cp.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const posts = db.prepare(query).all(...params).map(p => ({ ...p, tags: safeJSON(p.tags) }));
  res.json({ posts });
});

// POST /api/community/publish
router.post('/publish', requireAuth, (req, res) => {
  const { analysisId, title, summary, tags, reportId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const db = getDb();
  if (analysisId) {
    const analysis = db.prepare('SELECT user_id FROM analyses WHERE id=?').get(analysisId);
    if (!analysis || analysis.user_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });
  }

  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  const user = db.prepare('SELECT username FROM users WHERE id=?').get(req.user.id);

  db.prepare(`
    INSERT INTO community_posts (id, analysis_id, user_id, author, title, summary, tags, is_public, report_id, created_at)
    VALUES (?,?,?,?,?,?,?,1,?,?)
  `).run(id, analysisId || null, req.user.id, user?.username || 'Anonymous', title, summary || '', JSON.stringify(tags || []), reportId || null, Date.now());

  res.status(201).json({ id, success: true });
});

// GET /api/community/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT cp.*, a.file_type, a.sha256, a.original_name, a.file_size
    FROM community_posts cp
    LEFT JOIN analyses a ON cp.analysis_id = a.id
    WHERE cp.id = ? AND cp.is_public = 1
  `).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE community_posts SET views=views+1 WHERE id=?').run(req.params.id);
  res.json({ ...post, tags: safeJSON(post.tags) });
});

function safeJSON(str) {
  try { return JSON.parse(str); } catch { return []; }
}

module.exports = router;
