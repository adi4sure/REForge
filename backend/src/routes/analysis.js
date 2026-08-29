const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireAuth } = require('./auth');

// GET /api/analysis/:id — full analysis with all sub-data
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const analysis = db.prepare('SELECT * FROM analyses WHERE id=?').get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

  // Only the owner can view (unless community-published)
  if (analysis.user_id !== req.user.id && req.user.role !== 'admin') {
    const pub = db.prepare('SELECT id FROM community_posts WHERE analysis_id=? AND is_public=1').get(req.params.id);
    if (!pub) return res.status(403).json({ error: 'Forbidden' });
  }

  // Attach sub-data
  const findings = db.prepare('SELECT * FROM findings WHERE analysis_id=? ORDER BY severity').all(req.params.id);
  const iocs = db.prepare('SELECT * FROM iocs WHERE analysis_id=?').all(req.params.id);

  let metadata = null;
  if (analysis.file_type === 'apk' || analysis.file_type === 'aab') {
    const apk = db.prepare('SELECT * FROM apk_metadata WHERE analysis_id=?').get(req.params.id);
    if (apk) {
      metadata = {
        ...apk,
        permissions: safeJSON(apk.permissions),
        activities: safeJSON(apk.activities),
        services: safeJSON(apk.services),
        receivers: safeJSON(apk.receivers),
        providers: safeJSON(apk.providers),
        native_libs: safeJSON(apk.native_libs)
      };
    }
  } else if (['elf', 'pe', 'macho'].includes(analysis.file_type)) {
    const bin = db.prepare('SELECT * FROM binary_metadata WHERE analysis_id=?').get(req.params.id);
    if (bin) {
      metadata = {
        ...bin,
        linked_libs: safeJSON(bin.linked_libs),
        sections: safeJSON(bin.sections),
        imports: safeJSON(bin.imports),
        exports: safeJSON(bin.exports)
      };
    }
  }

  res.json({ ...analysis, findings, iocs, metadata });
});

// GET /api/analysis/:id/files — file tree for the explorer
router.get('/:id/files', requireAuth, (req, res) => {
  const db = getDb();
  const analysis = db.prepare('SELECT user_id FROM analyses WHERE id=?').get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Not found' });

  const files = db.prepare(
    'SELECT id, parent_id, path, name, type, language, size FROM analysis_files WHERE analysis_id=? ORDER BY type DESC, name'
  ).all(req.params.id);

  res.json({ files });
});

// GET /api/analysis/:id/functions — function list for binary
router.get('/:id/functions', requireAuth, (req, res) => {
  const db = getDb();
  const fns = db.prepare(
    'SELECT id, name, address, signature, complexity FROM functions WHERE analysis_id=? ORDER BY name'
  ).all(req.params.id);
  res.json({ functions: fns });
});

// GET /api/analysis — list user's analyses
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const list = db.prepare(
    'SELECT id, original_name, file_type, file_size, sha256, status, created_at, completed_at FROM analyses WHERE user_id=? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json({ analyses: list });
});

// DELETE /api/analysis/:id
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const analysis = db.prepare('SELECT user_id FROM analyses WHERE id=?').get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Not found' });
  if (analysis.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM analyses WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

function safeJSON(str) {
  try { return JSON.parse(str); } catch { return []; }
}

module.exports = router;
