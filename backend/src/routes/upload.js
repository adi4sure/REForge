const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('./auth');
const { identifyFile } = require('../services/fileIdentifier');
const { queueAnalysis } = require('../services/analysisQueue');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');

// Multer storage: save as UUID filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, 'raw');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.apk', '.aab', '.dex',
      '.exe', '.dll', '.sys',
      '.elf', '.so', '.dylib', '',
      '.ps1', '.psm1', '.psd1',
      '.sh', '.bash', '.zsh',
      '.js', '.ts', '.jsx', '.tsx',
      '.py', '.pyc'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype === 'application/octet-stream') {
      return cb(null, true);
    }
    cb(new Error(`File type not supported: ${ext}`));
  }
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);

    // Calculate hashes
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');

    // Identify file type
    const fileInfo = await identifyFile(filePath, req.file.originalname);

    // Create analysis record
    const id = uuidv4();
    const db = getDb();
    db.prepare(`
      INSERT INTO analyses (id, user_id, filename, original_name, sha256, md5, file_type, file_size, mime_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, req.user.id, req.file.filename, req.file.originalname, sha256, md5, fileInfo.type, req.file.size, fileInfo.mime, Date.now());

    // Queue async analysis
    queueAnalysis({ analysisId: id, filePath, fileType: fileInfo.type, userId: req.user.id });

    res.status(202).json({
      id,
      sha256,
      md5,
      file_type: fileInfo.type,
      file_size: req.file.size,
      original_name: req.file.originalname,
      status: 'pending'
    });
  } catch (err) {
    console.error('[upload]', err);
    if (req.file?.path) fs.unlinkSync(req.file.path).catch?.(() => {});
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

module.exports = router;
