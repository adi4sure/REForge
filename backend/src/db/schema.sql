-- REForge Database Schema
-- SQLite with WAL mode for concurrent reads

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,             -- bcrypt hash
  created_at  INTEGER NOT NULL,
  last_login  INTEGER,
  is_active   INTEGER DEFAULT 1,
  role        TEXT DEFAULT 'analyst'    -- analyst | admin
);

-- ─── Analyses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  filename        TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  sha256          TEXT,
  md5             TEXT,
  ssdeep          TEXT,
  file_type       TEXT,                -- apk|elf|pe|macho|script|unknown
  file_size       INTEGER,
  mime_type       TEXT,
  status          TEXT DEFAULT 'pending', -- pending|processing|complete|error
  error_msg       TEXT,
  arch            TEXT,                -- x86|x64|arm|arm64
  os_type         TEXT,               -- linux|windows|macos|android
  created_at      INTEGER NOT NULL,
  started_at      INTEGER,
  completed_at    INTEGER
);

-- ─── Analysis Files (decompiled source tree) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_files (
  id          TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  parent_id   TEXT,
  path        TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,           -- file | dir
  language    TEXT,                    -- java|kotlin|c|asm|xml|py|js|ps1|smali
  size        INTEGER DEFAULT 0,
  content     TEXT,                    -- actual source content (files only)
  UNIQUE(analysis_id, path)
);

CREATE INDEX IF NOT EXISTS idx_analysis_files_analysis_id ON analysis_files(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_files_parent ON analysis_files(analysis_id, parent_id);

-- ─── Full-text search table (files_fts) ─────────────────────────────────────
-- This is created by initDb() at startup, not here, because sql.js (WASM)
-- does not support FTS5. When better-sqlite3 is active, a real FTS5 virtual
-- table is created. When sql.js is active, a plain table is used instead.
-- The ragService.js already has a LIKE fallback for non-FTS queries.
CREATE TABLE IF NOT EXISTS files_fts_plain (
  analysis_id TEXT,
  file_id     TEXT,
  path        TEXT,
  content     TEXT
);

-- ─── Security Findings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS findings (
  id          TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  file_id     TEXT REFERENCES analysis_files(id),
  severity    TEXT NOT NULL,  -- CRITICAL|HIGH|MEDIUM|LOW|INFO
  category    TEXT NOT NULL,  -- network|secret|crypto|android|native|obfuscation
  title       TEXT NOT NULL,
  description TEXT,
  file_path   TEXT,
  line_start  INTEGER,
  line_end    INTEGER,
  evidence    TEXT,           -- code snippet
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_analysis ON findings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);

-- ─── IOCs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iocs (
  id          TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- url|ip|domain|email|hash|registry|mutex
  value       TEXT NOT NULL,
  context     TEXT,           -- surrounding code context
  file_path   TEXT,
  line_number INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iocs_analysis ON iocs(analysis_id);
CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(type);

-- ─── APK Metadata ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apk_metadata (
  analysis_id       TEXT PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
  package_name      TEXT,
  version_name      TEXT,
  version_code      INTEGER,
  min_sdk           INTEGER,
  target_sdk        INTEGER,
  compile_sdk       INTEGER,
  permissions       TEXT,     -- JSON array
  activities        TEXT,     -- JSON array
  services          TEXT,     -- JSON array
  receivers         TEXT,     -- JSON array
  providers         TEXT,     -- JSON array
  native_libs       TEXT,     -- JSON array of .so names
  certificate_sha1  TEXT,
  certificate_sha256 TEXT,
  signing_algo      TEXT
);

-- ─── Native Binary Metadata ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS binary_metadata (
  analysis_id   TEXT PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
  arch          TEXT,
  bits          INTEGER,
  endian        TEXT,
  compiler      TEXT,
  linked_libs   TEXT,    -- JSON array
  sections      TEXT,    -- JSON array {name, vaddr, size, entropy}
  imports       TEXT,    -- JSON array {name, lib}
  exports       TEXT,    -- JSON array {name, addr}
  entry_point   TEXT,
  is_packed     INTEGER DEFAULT 0,
  is_stripped   INTEGER DEFAULT 0
);

-- ─── Functions (decompiled) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS functions (
  id           TEXT PRIMARY KEY,
  analysis_id  TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT,
  signature    TEXT,
  decompiled_c TEXT,   -- pseudo-C from Ghidra
  asm_listing  TEXT,   -- raw disassembly
  complexity   INTEGER,
  file_id      TEXT REFERENCES analysis_files(id)
);

CREATE INDEX IF NOT EXISTS idx_functions_analysis ON functions(analysis_id);

-- ─── AI Chat Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id          TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id),
  role        TEXT NOT NULL,  -- user | assistant | system
  content     TEXT NOT NULL,
  citations   TEXT,           -- JSON [{file_path, line_start, line_end, snippet}]
  model       TEXT,           -- gpt-4o | claude-3-5-sonnet | etc.
  tokens_used INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_analysis ON ai_messages(analysis_id);

-- ─── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id),
  title       TEXT,
  markdown    TEXT,
  pdf_path    TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER
);

-- ─── Community Posts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id          TEXT PRIMARY KEY,
  analysis_id TEXT REFERENCES analyses(id),
  user_id     TEXT REFERENCES users(id),
  author      TEXT,
  title       TEXT NOT NULL,
  summary     TEXT,
  tags        TEXT,   -- JSON array
  is_public   INTEGER DEFAULT 0,
  views       INTEGER DEFAULT 0,
  upvotes     INTEGER DEFAULT 0,
  report_id   TEXT REFERENCES reports(id),
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_public ON community_posts(is_public, created_at);

-- ─── User API Keys (BYOK) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_api_keys (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,  -- openai | anthropic | bedrock
  key_enc     TEXT NOT NULL,  -- AES-256 encrypted
  key_hint    TEXT,           -- last 4 chars for display
  model       TEXT,           -- preferred model for this provider
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER,
  UNIQUE(user_id, provider)
);
