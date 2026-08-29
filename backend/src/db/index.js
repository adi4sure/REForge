/**
 * db/index.js — SQLite adapter with auto-driver detection
 *
 * In Docker (Linux): uses better-sqlite3 (native, fast)
 * On Windows dev:    falls back to sql.js (pure WASM, no compilation needed)
 *
 * Both expose the same synchronous API: db.prepare(), db.exec(), etc.
 */
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/reforge.db');

let db;
let usingNative = false;

// ── sql.js wrapper — maps better-sqlite3 API onto sql.js ─────────────────────
class SqlJsWrapper {
  constructor(sqlJs, data) {
    this._db = new sqlJs.Database(data || null);
    this._path = null;
  }

  _save() {
    if (this._path) {
      const data = this._db.export();
      fs.writeFileSync(this._path, Buffer.from(data));
    }
  }

  pragma(stmt) {
    this._db.run(`PRAGMA ${stmt}`);
  }

  exec(sql) {
    this._db.run(sql);
    this._save();
    return this;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self._db.run(sql, params);
        self._save();
        return { changes: 1 };
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
      }
    };
  }

  close() { this._db.close(); }
}

// ── Initialization ────────────────────────────────────────────────────────────
async function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Try native better-sqlite3 first (works on Linux/Docker, not on Windows without VS)
  try {
    const BetterSQLite = require('better-sqlite3');
    db = new BetterSQLite(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    usingNative = true;
    console.log('[DB] Using better-sqlite3 (native)');
  } catch (_err) {
    // Fallback to sql.js (pure WebAssembly — no native compilation required)
    console.log('[DB] better-sqlite3 unavailable, falling back to sql.js (WASM)');
    const initSqlJs = require('sql.js');
    const sqlJs = await initSqlJs();

    // Load existing DB file if present
    const existingData = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
    const wrapper = new SqlJsWrapper(sqlJs, existingData);
    wrapper._path = DB_PATH;
    db = wrapper;
  }

  // Run base schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Create FTS5 table if native driver supports it, else use the plain fallback
  if (usingNative) {
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
          analysis_id UNINDEXED,
          file_id UNINDEXED,
          path,
          content
        )
      `);
      db._hasFts5 = true;
    } catch (e) {
      console.warn('[DB] FTS5 not available:', e.message);
      db._hasFts5 = false;
    }
  } else {
    // sql.js: alias files_fts_plain as the RAG target
    db._hasFts5 = false;
  }

  console.log(`[DB] SQLite initialized at ${DB_PATH} (native=${usingNative}, fts5=${db._hasFts5})`);
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

module.exports = { getDb, initDb };
