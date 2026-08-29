/**
 * Script Analyzer — handles PowerShell, Shell, Python, JavaScript
 * Pure AST + regex analysis (no external tools needed)
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

async function analyzeScript({ analysisId, filePath, fileType }) {
  const db = getDb();
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);

  // Store the script itself as a file
  const fileId = uuidv4();
  const lang = { powershell: 'powershell', shell: 'shell', python: 'python', javascript: 'javascript' }[fileType] || 'plaintext';

  db.prepare(`
    INSERT OR IGNORE INTO analysis_files (id, analysis_id, path, name, type, language, size, content)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(fileId, analysisId, `/${filename}`, filename, 'file', lang, content.length, content);

  // Extract metadata
  let metadata = {};
  if (fileType === 'powershell') metadata = analyzePowerShell(content);
  else if (fileType === 'shell') metadata = analyzeShell(content);
  else if (fileType === 'python') metadata = analyzePython(content);
  else if (fileType === 'javascript') metadata = analyzeJavaScript(content);

  // Store metadata as a summary file
  if (Object.keys(metadata).length) {
    const summaryId = uuidv4();
    const summaryContent = JSON.stringify(metadata, null, 2);
    db.prepare(`
      INSERT OR IGNORE INTO analysis_files (id, analysis_id, path, name, type, language, size, content)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(summaryId, analysisId, '/metadata.json', 'metadata.json', 'file', 'json', summaryContent.length, summaryContent);
  }

  // Update analysis with OS type
  const osMap = { powershell: 'windows', shell: 'linux', python: 'cross', javascript: 'cross' };
  db.prepare('UPDATE analyses SET os_type=? WHERE id=?').run(osMap[fileType] || null, analysisId);

  console.log(`[Script] Analysis complete for ${analysisId} (${fileType})`);
}

function analyzePowerShell(content) {
  return {
    language: 'PowerShell',
    has_encoded_command: /\-EncodedCommand|\-enc\s/i.test(content),
    has_download: /(?:DownloadString|DownloadFile|WebClient|Invoke-WebRequest|iwr|curl|wget)/i.test(content),
    has_exec: /(?:Invoke-Expression|iex|Start-Process|cmd\.exe|powershell\.exe)/i.test(content),
    has_bypass: /(?:bypass|unrestricted|remotesigned|executionpolicy)/i.test(content),
    has_obfuscation: /\[char\]\s*\d+|\-join\s*\(|\[string\]::join/i.test(content),
    has_persistence: /(?:HKLM:|HKCU:|New-ItemProperty|schtasks|ScheduledTask)/i.test(content),
    line_count: content.split('\n').length,
  };
}

function analyzeShell(content) {
  return {
    language: 'Shell',
    interpreter: content.startsWith('#!') ? content.split('\n')[0] : '/bin/sh',
    has_download: /(?:curl|wget|nc|netcat|fetch)\s/i.test(content),
    has_exec: /(?:eval|exec|bash -c|sh -c|`[^`]+`|\$\([^)]+\))/i.test(content),
    has_persistence: /(?:crontab|\.bashrc|\.profile|\/etc\/cron|systemctl enable)/i.test(content),
    has_privilege_esc: /(?:sudo|chmod\s+[0-9]*7|chown root|setuid|setgid)/i.test(content),
    line_count: content.split('\n').length,
  };
}

function analyzePython(content) {
  const imports = [...content.matchAll(/^(?:import|from)\s+([^\s.]+)/gm)].map(m => m[1]);
  return {
    language: 'Python',
    imports: [...new Set(imports)],
    has_exec: /(?:subprocess|os\.system|os\.popen|commands\.getoutput|eval\(|exec\()/i.test(content),
    has_network: /(?:socket|requests|urllib|httpx|aiohttp|ftplib|smtplib)/i.test(content),
    has_crypto: /(?:cryptography|pycryptodome|Crypto\.|hashlib|base64)/i.test(content),
    has_persistence: /(?:winreg|HKEY_|startup|crontab|launchd)/i.test(content),
    line_count: content.split('\n').length,
  };
}

function analyzeJavaScript(content) {
  return {
    language: 'JavaScript',
    has_eval: /\beval\s*\(/.test(content),
    has_obfuscation: /(?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4}){5,}/i.test(content),
    has_network: /(?:fetch|XMLHttpRequest|axios|node-fetch|require\(['"]http)/i.test(content),
    has_child_process: /require\(['"]child_process['"]\)/.test(content),
    has_fs_ops: /require\(['"]fs['"]\)/.test(content),
    line_count: content.split('\n').length,
  };
}

module.exports = { analyzeScript };
