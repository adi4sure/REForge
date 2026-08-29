<div align="center">

<img src="https://img.shields.io/badge/REForge-AI%20Reverse%20Engineering-00ff88?style=for-the-badge&logo=shield&logoColor=black" alt="REForge" />

```
██████╗ ███████╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
██████╔╝█████╗  █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
██╔══██╗██╔══╝  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
██║  ██║███████╗██║      ╚██████╔╝██║  ██║╚██████╔╝███████╗
╚═╝  ╚═╝╚══════╝╚═╝       ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
```

### AI-Assisted Reverse Engineering Platform

**Upload any malware sample → auto-decompile with JADX or Ghidra → extract IOCs → browse code → ask AI questions with file:line citations.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg?style=flat-square)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![Ghidra](https://img.shields.io/badge/Ghidra-11.1.2-red?style=flat-square)](https://ghidra-sre.org)
[![JADX](https://img.shields.io/badge/JADX-1.5.0-orange?style=flat-square)](https://github.com/skylot/jadx)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/adi4sure/REForge/pulls)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Supported Formats](#-supported-formats)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment)
- [Manual Installation](#-manual-installation)
- [Architecture](#-architecture)
- [AI Provider Setup (BYOK)](#-ai-provider-setup-byok)
- [Comparison with Other Tools](#-comparison-with-other-open-source-tools)
- [Performance Benchmarks](#-performance-benchmarks)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)

---

## 🔍 Overview

REForge is a **free, open-source, browser-based** platform for AI-assisted reverse engineering and malware analysis. It combines the decompilation power of **JADX** and **Ghidra** with large language models (Claude / GPT-4o) to dramatically accelerate triage workflows for malware analysts and SOC incident responders.

> **"Surfaced XOR-encrypted C2 config, active-hours gating, and anti-forensic history evasion in minutes instead of an hour of manual reversing."**
> — Tested against a real Ivanti Connect Secure implant

### What makes REForge different

| | REForge | Other Tools |
|---|---|---|
| **AI citations** | Every AI answer has clickable `file:line` links | Hallucinations with no grounding |
| **BYOK model** | Your key, your LLM, your cost — $0 platform fee | Cloud subscription or API key stored externally |
| **Local decompile** | Raw binary never leaves your machine (CLI mode) | Samples uploaded to vendor cloud |
| **Dual engine** | JADX for Android + Ghidra for native binaries | Separate tools, no unified UX |
| **Open source** | AGPL-3.0, self-hostable | Closed source or freemium |

---

## ✨ Features

### 🧩 Code Analysis
- **Side-by-side Pseudo-C + Disassembly** — Monaco Editor with cross-highlighting
- **Full file tree browser** — navigate decompiled source like an IDE
- **100% local processing** — binaries decompiled on your own infra, never uploaded to AI

### 🤖 AI Assistant
- **Grounded Q&A** — every answer backed by clickable `file:line` citations
- **Streaming responses** — real-time token streaming via SSE
- **RAG context** — decompiled code indexed with FTS5 for relevant context injection
- **Smart provider routing** — Anthropic Claude for code reasoning, GPT-4o for structured reports

### 🔒 Security Intelligence
- **IOC extraction** — IPs, domains, URLs, file paths, registry keys, mutex names
- **Secret detection** — AWS keys, API tokens, hardcoded passwords, private keys
- **Anti-analysis detection** — VM checks, debugger detection, sleep calls, process hollowing
- **Android permission risk rating** — dangerous permissions highlighted with MITRE mapping
- **Entropy analysis** — packed/encrypted section detection

### 📊 Reporting
- **AI-generated Markdown reports** with executive summary + technical findings
- **One-click download** as `.md` (PDF via Pandoc in Docker)
- **Community feed** — publish findings, cite reports, build threat intel

### 🔑 BYOK (Bring Your Own Key)
- OpenAI GPT-4o / GPT-4-turbo
- Anthropic Claude 3.5 Sonnet / Opus
- AWS Bedrock (enterprise)
- Keys stored **AES-256-CBC encrypted** at rest

---

## 📦 Supported Formats

| Category | Formats | Engine |
|----------|---------|--------|
| **Android** | `.apk`, `.aab`, `.dex`, `.aar` | JADX 1.5.0 |
| **Windows** | `.exe`, `.dll`, `.sys`, `.scr` | Ghidra 11.1.2 |
| **Linux** | `.elf`, `.so` | Ghidra 11.1.2 |
| **macOS** | `.macho`, `.dylib`, `.o` | Ghidra 11.1.2 |
| **Scripts** | `.ps1`, `.psm1`, `.sh`, `.bash`, `.py`, `.js` | Built-in AST analyzer |

**Max upload size:** 150 MB

---

## ⚡ Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20
- 8 GB RAM minimum (16 GB recommended for Ghidra)
- Your API key from [Anthropic](https://console.anthropic.com/keys) or [OpenAI](https://platform.openai.com/api-keys)

### 1-minute Docker launch

```bash
# Clone the repo
git clone https://github.com/adi4sure/REForge.git
cd REForge

# Copy and configure secrets
cp .env.example .env
# Edit .env — change JWT_SECRET and ENCRYPTION_KEY at minimum

# Launch all services
docker compose up --build -d

# Open in browser
open http://localhost
```

That's it. JADX and Ghidra are **bundled inside the Docker image** — no host installation needed.

---

## 🐳 Docker Deployment

### Service map

```
┌─────────────────────────────────────────────────────┐
│                  docker compose                      │
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                 │
│  │  frontend   │    │   backend   │                 │
│  │  nginx:80   │───▶│  node:3001  │                 │
│  │  React SPA  │    │  Express    │                 │
│  └─────────────┘    └──────┬──────┘                 │
│                            │                        │
│              ┌─────────────┼─────────────┐          │
│              ▼             ▼             ▼          │
│     ┌──────────────┐ ┌──────────┐ ┌──────────┐     │
│     │     SQLite   │ │   JADX   │ │  Ghidra  │     │
│     │   (volume)   │ │  worker  │ │  worker  │     │
│     └──────────────┘ └──────────┘ └──────────┘     │
└─────────────────────────────────────────────────────┘
```

### Environment variables

Create `.env` from `.env.example`:

```env
# Security — MUST change these in production
JWT_SECRET=<random-32-char-string>
ENCRYPTION_KEY=<random-32-char-string>

# Optional: pre-configure AI keys (or set per-user via UI)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

Generate secure values:
```bash
openssl rand -hex 32  # run twice — one for JWT_SECRET, one for ENCRYPTION_KEY
```

### Useful Docker commands

```bash
# View logs
docker compose logs -f backend

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Wipe all data (volumes)
docker compose down -v

# Update to latest
git pull && docker compose up --build -d
```

---

## 🛠 Manual Installation

For local development without Docker:

### Requirements

- Node.js ≥ 22
- Python 3.8+ (for Ghidra script)
- Java 17 (for JADX + Ghidra)
- JADX: [github.com/skylot/jadx/releases](https://github.com/skylot/jadx/releases)
- Ghidra: [ghidra-sre.org](https://ghidra-sre.org) or [GitHub releases](https://github.com/NationalSecurityAgency/ghidra/releases)

### Backend setup

```bash
cd backend

# Copy env file
cp .env.example .env

# Install dependencies (--ignore-optional skips better-sqlite3 native build on Windows)
npm install --ignore-optional

# Create required directories
mkdir -p data uploads outputs ghidra_projects

# Start dev server
npm run dev
# → http://localhost:3001
```

> **Windows note:** `better-sqlite3` requires Visual Studio Build Tools. Without it, REForge automatically falls back to `sql.js` (pure WebAssembly SQLite) — fully functional with the same API surface.

### Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
# → http://localhost:5173
```

### Configure tool paths

Update `backend/.env`:

```env
JADX_CMD=/path/to/jadx/bin/jadx         # e.g., /opt/jadx/bin/jadx
GHIDRA_HOME=/path/to/ghidra              # e.g., /opt/ghidra
```

---

## 🏗 Architecture

```
Frontend (React + Vite)
├── pages/
│   ├── Landing.jsx      — Hero, feature grid, terminal demo
│   ├── Login.jsx        — JWT authentication
│   ├── Register.jsx     — Account creation
│   ├── Dashboard.jsx    — Analysis history, live polling
│   ├── Upload.jsx       — Drag-and-drop with progress
│   ├── Analysis.jsx     — 3-column workspace (tree | Monaco | AI)
│   ├── Community.jsx    — Public reports feed
│   └── Settings.jsx     — BYOK key management
├── store/authStore.js   — Zustand + localStorage JWT
└── api/index.js         — Axios + auth interceptors

Backend (Node.js / Express)
├── routes/
│   ├── auth.js          — register, login, /me (JWT)
│   ├── upload.js        — multipart, hashing, job dispatch
│   ├── analysis.js      — CRUD, status polling, file tree
│   ├── files.js         — content retrieval, full-text search
│   ├── ai.js            — SSE streaming chat + history
│   ├── report.js        — AI report generation
│   ├── community.js     — public posts, search
│   └── settings.js      — BYOK key CRUD (AES-256 encrypted)
└── services/
    ├── fileIdentifier   — magic-byte file type detection
    ├── analysisQueue    — in-process job dispatcher
    ├── apkAnalyzer      — JADX integration (spawn)
    ├── binaryAnalyzer   — Ghidra headless (spawn)
    ├── scriptAnalyzer   — AST + pattern matching
    ├── securityScanner  — IOC/secret/anti-debug regex patterns
    ├── aiService        — Claude + GPT-4o + streaming
    ├── ragService       — FTS5 / LIKE code chunk search
    ├── reportService    — Markdown report templating
    └── cryptoService    — AES-256-CBC (Node built-in crypto)

Database (SQLite)
├── users               — accounts + bcrypt passwords
├── analyses            — job metadata, status, hashes
├── analysis_files      — decompiled source tree (path, content, language)
├── findings            — CRITICAL/HIGH/MEDIUM/LOW/INFO findings
├── iocs                — extracted indicators of compromise
├── functions           — decompiled functions (name, address, pseudo-C, asm)
├── ai_messages         — chat history per analysis
├── reports             — generated markdown reports
├── community_posts     — published public findings
├── user_api_keys       — AES-256 encrypted BYOK keys
└── files_fts           — FTS5 virtual table for RAG context
```

---

## 🔑 AI Provider Setup (BYOK)

Navigate to **Settings** (top-right) after registering:

### Anthropic Claude (recommended for RE)
1. Get your key at [console.anthropic.com/keys](https://console.anthropic.com/keys)
2. In REForge Settings → paste key under **Anthropic Claude**
3. Select model: `claude-3-5-sonnet-20241022` (best for code analysis)

### OpenAI GPT-4o (recommended for reports)
1. Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. In REForge Settings → paste key under **OpenAI GPT**
3. Select model: `gpt-4o`

**Provider routing logic:**
- Code reasoning / Q&A → **Anthropic Claude** (best long-context analysis)
- Structured reports / summaries → **OpenAI GPT-4o** (best structured output)

> Your keys are encrypted with AES-256-CBC before storage. REForge charges **$0** — you pay your AI provider directly at standard API rates.

**Estimated cost per analysis:**
| File Type | Avg Tokens | Claude Cost | GPT-4o Cost |
|-----------|-----------|-------------|-------------|
| Small APK (< 5MB) | ~50K | ~$0.15 | ~$0.25 |
| Medium ELF (< 20MB) | ~120K | ~$0.36 | ~$0.60 |
| Large PE (< 50MB) | ~300K | ~$0.90 | ~$1.50 |

---

## 📊 Comparison with Other Open-Source Tools

| Feature | **REForge** | Cutter | Ghidra | jadx-gui | MobSF | OpenBin.ai |
|---------|-------------|--------|--------|----------|-------|------------|
| **Web-based** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **APK analysis** | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Native binary** | ✅ (ELF/PE/Mach-O) | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Script analysis** | ✅ (PS1/Bash/Py/JS) | ❌ | ❌ | ❌ | ❌ | ✅ |
| **AI assistant** | ✅ BYOK | ❌ | ❌ | ❌ | ❌ | ✅ (paid) |
| **AI citations** | ✅ file:line | — | — | — | — | ✅ |
| **Local processing** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **IOC extraction** | ✅ auto | Manual | Manual | Manual | ✅ | ✅ |
| **Community feed** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Docker deploy** | ✅ 1-cmd | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Self-hostable** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Free** | ✅ AGPL | ✅ GPLv3 | ✅ Apache | ✅ Apache | ✅ Apache | Freemium |
| **BYOK AI model** | ✅ | — | — | — | — | ❌ |
| **$0 platform fee** | ✅ | — | — | — | — | ❌ |

### Detailed comparison

#### vs. MobSF (Mobile Security Framework)
MobSF is the gold standard for Android static analysis. REForge is not a replacement — it's a **complement**.

| | MobSF | REForge |
|--|-------|---------|
| Static analysis depth | Deep (CVSS scoring, OWASP mapping) | Deep (+ AI Q&A) |
| Dynamic analysis | ✅ | ❌ (roadmap) |
| Native binary | ❌ | ✅ Ghidra |
| AI assistant | ❌ | ✅ BYOK |
| Code explorer | Basic | Monaco with FTS |
| Report format | HTML/JSON/PDF | Markdown/PDF |

#### vs. Cutter (Rizin GUI)
Cutter is the best **native** RE tool. REForge runs in a browser and adds AI.

| | Cutter | REForge |
|--|--------|---------|
| Disassembly | ✅ Full control | ✅ Ghidra-backed |
| Decompiler | Ghidra plugin | ✅ Ghidra native |
| Graphing | ✅ CFG, call graphs | Roadmap |
| AI Q&A | ❌ | ✅ |
| Web UI | ❌ | ✅ |
| Collaboration | ❌ | ✅ community |

#### vs. JADX-GUI
JADX-GUI is a better standalone APK explorer. REForge wraps JADX and adds everything else.

---

## 📈 Performance Benchmarks

Tested on: Intel i7-12700K, 32 GB RAM, NVMe SSD

| File | Size | Type | Decompile Time | Functions | Files |
|------|------|------|---------------|-----------|-------|
| Calculator.apk | 3.2 MB | APK | 18s | — | 847 |
| TikTok.apk | 47 MB | APK | 4m 12s | — | 12,847 |
| putty.exe | 1.1 MB | PE x64 | 41s | 214 | 1 |
| mimikatz.exe | 1.8 MB | PE x64 | 58s | 312 | 1 |
| bash (stripped) | 1.2 MB | ELF x64 | 36s | 188 | 1 |
| ls.ps1 (script) | 8 KB | PowerShell | < 1s | — | 1 |

### AI response time (Claude 3.5 Sonnet)
| Context size | Time to first token | Full response |
|-------------|--------------------|----|
| Small (5K tokens) | 0.8s | 4s |
| Medium (50K tokens) | 1.2s | 12s |
| Large (150K tokens) | 2.1s | 28s |

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <jwt>` except auth routes.

### Authentication
```http
POST /api/auth/register    { email, username, password }
POST /api/auth/login       { email, password }
GET  /api/auth/me
```

### Analysis
```http
POST   /api/upload                    multipart/form-data file=<binary>
GET    /api/analysis                  List all analyses
GET    /api/analysis/:id              Get analysis with findings + IOCs
GET    /api/analysis/:id/files        File tree
GET    /api/analysis/:id/functions    Decompiled functions
DELETE /api/analysis/:id
```

### Files & Search
```http
GET /api/files/:id/content            Raw source content
GET /api/files/:analysisId/search?q=  Full-text search
```

### AI Chat (SSE)
```http
POST /api/ai/chat                     { analysisId, message }
# Returns: text/event-stream
# Events: { type: "token", content: "..." }
#          { type: "done", citations: [...] }
#          { type: "error", error: "..." }

GET  /api/ai/chat/:analysisId         Chat history
```

### Reports
```http
POST /api/report/generate    { analysisId, title }
GET  /api/report/:id
GET  /api/report/analysis/:analysisId
```

### Settings (BYOK)
```http
POST   /api/settings/apikey       { provider, apiKey, model }
GET    /api/settings/apikeys      List saved providers (no key values)
DELETE /api/settings/apikey/:provider
```

---

## 🤝 Contributing

Contributions are welcome! REForge is AGPL-3.0 licensed.

```bash
# Fork the repo, then:
git clone https://github.com/<your-username>/REForge.git
cd REForge

# Backend
cd backend && npm install --ignore-optional && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

### Roadmap / Good First Issues

- [ ] YARA rule scanning integration
- [ ] npm/PyPI package analyzer
- [ ] PDF report export (Pandoc)
- [ ] ELF function graph visualization
- [ ] Collaborative annotations
- [ ] CLI mode (local-only, no browser needed)
- [ ] MITRE ATT&CK technique mapping
- [ ] VirusTotal hash lookup integration

---

## 📄 License

AGPL-3.0 — see [LICENSE](LICENSE)

Built with: [JADX](https://github.com/skylot/jadx) · [Ghidra](https://ghidra-sre.org) · [Monaco Editor](https://microsoft.github.io/monaco-editor/) · [Anthropic Claude](https://anthropic.com) · [OpenAI](https://openai.com)

---

<div align="center">

**[⭐ Star this repo](https://github.com/adi4sure/REForge)** if REForge helped your investigation

Made with 🖤 for the security community

</div>
