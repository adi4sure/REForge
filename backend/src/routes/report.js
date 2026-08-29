const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('./auth');
const { generateReport } = require('../services/reportService');

// POST /api/report/generate
router.post('/generate', requireAuth, async (req, res) => {
  const { analysisId, title } = req.body;
  if (!analysisId) return res.status(400).json({ error: 'analysisId required' });

  const db = getDb();
  const analysis = db.prepare('SELECT * FROM analyses WHERE id=?').get(analysisId);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  if (analysis.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  try {
    const reportId = uuidv4();
    const { markdown } = await generateReport(analysisId, title || analysis.original_name);

    db.prepare('INSERT INTO reports (id, analysis_id, user_id, title, markdown, created_at) VALUES (?,?,?,?,?,?)')
      .run(reportId, analysisId, req.user.id, title || analysis.original_name, markdown, Date.now());

    res.json({ reportId, markdown });
  } catch (err) {
    console.error('[report/generate]', err);
    res.status(500).json({ error: 'Report generation failed: ' + err.message });
  }
});

// GET /api/report/:id
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

// GET /api/report/analysis/:analysisId — list reports for an analysis
router.get('/analysis/:analysisId', requireAuth, (req, res) => {
  const db = getDb();
  const reports = db.prepare('SELECT id, title, created_at FROM reports WHERE analysis_id=? AND user_id=? ORDER BY created_at DESC').all(req.params.analysisId, req.user.id);
  res.json({ reports });
});

module.exports = router;
