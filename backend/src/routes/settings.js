const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('./auth');
const { encryptKey, decryptKey } = require('../services/cryptoService');



// POST /api/settings/apikey — save/update BYOK key
router.post('/apikey', requireAuth, (req, res) => {
  const { provider, apiKey, model } = req.body;
  const validProviders = ['openai', 'anthropic', 'bedrock'];
  if (!provider || !validProviders.includes(provider))
    return res.status(400).json({ error: 'Invalid provider. Use: openai, anthropic, bedrock' });
  if (!apiKey)
    return res.status(400).json({ error: 'apiKey required' });

  // Encrypt key at rest using AES-256-CBC
  const encrypted = encryptKey(apiKey);
  const hint = apiKey.slice(-4);

  const db = getDb();
  const existing = db.prepare('SELECT id FROM user_api_keys WHERE user_id=? AND provider=?').get(req.user.id, provider);

  if (existing) {
    db.prepare('UPDATE user_api_keys SET key_enc=?, key_hint=?, model=?, updated_at=? WHERE id=?')
      .run(encrypted, hint, model || null, Date.now(), existing.id);
  } else {
    db.prepare('INSERT INTO user_api_keys (id, user_id, provider, key_enc, key_hint, model, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(uuidv4(), req.user.id, provider, encrypted, hint, model || null, Date.now());
  }

  res.json({ success: true, provider, hint: `...${hint}` });
});

// GET /api/settings/apikeys — list configured providers (no key values)
router.get('/apikeys', requireAuth, (req, res) => {
  const db = getDb();
  const keys = db.prepare('SELECT id, provider, key_hint, model, created_at, updated_at FROM user_api_keys WHERE user_id=?').all(req.user.id);
  res.json({ keys });
});

// DELETE /api/settings/apikey/:provider
router.delete('/apikey/:provider', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM user_api_keys WHERE user_id=? AND provider=?').run(req.user.id, req.params.provider);
  res.json({ success: true });
});

module.exports = router;
