const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('./auth');
const { getAiService } = require('../services/aiService');
const { searchCodeChunks } = require('../services/ragService');

// POST /api/ai/chat — send message, get streamed response
router.post('/chat', requireAuth, async (req, res) => {
  const { analysisId, message, model } = req.body;
  if (!analysisId || !message)
    return res.status(400).json({ error: 'analysisId and message required' });

  const db = getDb();
  const analysis = db.prepare('SELECT * FROM analyses WHERE id=?').get(analysisId);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  if (analysis.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (analysis.status !== 'complete') return res.status(400).json({ error: 'Analysis not complete yet' });

  // Get user's API key
  const aiService = await getAiService(req.user.id, model);
  if (!aiService) return res.status(400).json({ error: 'No AI provider configured. Add your API key in Settings.' });

  // Retrieve conversation history (last 8 messages)
  const history = db.prepare(
    'SELECT role, content FROM ai_messages WHERE analysis_id=? ORDER BY created_at DESC LIMIT 8'
  ).all(analysisId).reverse();

  // RAG: search relevant code chunks
  const chunks = await searchCodeChunks(analysisId, message, 6);

  // Build security context
  const findings = db.prepare(
    'SELECT severity, category, title, file_path, line_start, evidence FROM findings WHERE analysis_id=? ORDER BY severity LIMIT 20'
  ).all(analysisId);
  const iocs = db.prepare('SELECT type, value FROM iocs WHERE analysis_id=? LIMIT 30').all(analysisId);

  // Save user message
  const userMsgId = uuidv4();
  db.prepare('INSERT INTO ai_messages (id, analysis_id, user_id, role, content, created_at) VALUES (?,?,?,?,?,?)')
    .run(userMsgId, analysisId, req.user.id, 'user', message, Date.now());

  // Stream response via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullResponse = '';
  let citations = [];

  try {
    await aiService.streamChat({
      analysis,
      message,
      history,
      codeChunks: chunks,
      findings,
      iocs,
      onToken: (token) => {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      },
      onCitations: (cits) => {
        citations = cits;
      }
    });

    // Save assistant message
    const asstMsgId = uuidv4();
    db.prepare('INSERT INTO ai_messages (id, analysis_id, user_id, role, content, citations, model, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(asstMsgId, analysisId, req.user.id, 'assistant', fullResponse, JSON.stringify(citations), aiService.modelName, Date.now());

    res.write(`data: ${JSON.stringify({ type: 'done', citations, messageId: asstMsgId })}\n\n`);
    res.end();
  } catch (err) {
    console.error('[ai/chat]', err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// GET /api/ai/chat/:analysisId — fetch conversation history
router.get('/chat/:analysisId', requireAuth, (req, res) => {
  const db = getDb();
  const messages = db.prepare(
    'SELECT id, role, content, citations, model, created_at FROM ai_messages WHERE analysis_id=? ORDER BY created_at'
  ).all(req.params.analysisId);
  res.json({ messages: messages.map(m => ({ ...m, citations: safeJSON(m.citations) })) });
});

function safeJSON(str) {
  try { return JSON.parse(str); } catch { return []; }
}

module.exports = router;
