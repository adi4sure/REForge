/**
 * RAG Service — indexes decompiled source for AI context retrieval
 * Uses FTS5 (native better-sqlite3) or falls back to LIKE (sql.js/WASM)
 */
const { getDb } = require('../db');

function getFtsTable(db) {
  return db._hasFts5 ? 'files_fts' : 'files_fts_plain';
}

async function indexAnalysisForRag(analysisId) {
  const db = getDb();
  const table = getFtsTable(db);

  // Get all text files for this analysis
  const files = db.prepare(
    "SELECT id, path, content FROM analysis_files WHERE analysis_id=? AND type='file' AND content IS NOT NULL"
  ).all(analysisId);

  // Delete existing entries for this analysis
  db.prepare(`DELETE FROM ${table} WHERE analysis_id=?`).run(analysisId);

  // Insert chunks — handle both db.transaction (native) and plain loop (sql.js)
  const insert = db.prepare(`INSERT INTO ${table}(analysis_id, file_id, path, content) VALUES (?,?,?,?)`);

  const doInsert = () => {
    for (const f of files) {
      if (f.content && f.content.length > 10) {
        const chunks = chunkText(f.content, 4000);
        for (const chunk of chunks) {
          insert.run(analysisId, f.id, f.path, chunk);
        }
      }
    }
  };

  if (typeof db.transaction === 'function') {
    db.transaction(doInsert)();
  } else {
    doInsert();
  }

  console.log(`[RAG] Indexed ${files.length} files for analysis ${analysisId} (table=${table})`);
}

async function searchCodeChunks(analysisId, query, limit = 6) {
  const db = getDb();
  const cleanQuery = query.replace(/[^a-zA-Z0-9\s_\.]/g, ' ').trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  // FTS5 path (native only)
  if (db._hasFts5) {
    try {
      const results = db.prepare(`
        SELECT af.id, af.path, af.language,
               snippet(files_fts, 3, '<mark>', '</mark>', '...', 40) as content
        FROM files_fts
        JOIN analysis_files af ON files_fts.file_id = af.id
        WHERE files_fts.analysis_id = ? AND files_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(analysisId, cleanQuery + '*', limit);
      if (results.length) return results;
    } catch (_) { /* fall through */ }
  }

  // LIKE fallback (sql.js or FTS5 syntax error)
  try {
    return db.prepare(`
      SELECT id, path, language, substr(content, 1, 800) as content
      FROM analysis_files
      WHERE analysis_id=? AND content LIKE ? AND type='file'
      LIMIT ?
    `).all(analysisId, `%${cleanQuery.slice(0, 50)}%`, limit);
  } catch {
    return [];
  }
}

function chunkText(text, maxChars) {
  const chunks = [];
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    if (current.length + line.length > maxChars && current.length > 0) {
      chunks.push(current);
      current = '';
    }
    current += line + '\n';
  }
  if (current.trim()) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

module.exports = { indexAnalysisForRag, searchCodeChunks };
