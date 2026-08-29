/**
 * Security Scanner — deterministic pattern matching for IOCs, secrets, crypto
 * Runs after JADX/Ghidra analysis on all stored file content
 */
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

// ── IOC Patterns ──────────────────────────────────────────────────────────────
const PATTERNS = {
  // Network IOCs
  url: {
    regex: /https?:\/\/[^\s"'<>\]\[{})]+/gi,
    category: 'network', severity: 'MEDIUM', title: 'URL Found'
  },
  ip: {
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    category: 'network', severity: 'MEDIUM', title: 'IP Address Found',
    filter: (v) => !v.startsWith('127.') && !v.startsWith('0.') && !v.startsWith('255.')
  },
  domain: {
    regex: /(?:[a-zA-Z0-9-]{1,63}\.)+(?:com|net|org|io|ru|cn|tk|xyz|top|cc|pw|biz|info|onion)\b/gi,
    category: 'network', severity: 'LOW', title: 'Domain Found'
  },

  // Secrets
  aws_key: {
    regex: /(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}/g,
    category: 'secret', severity: 'CRITICAL', title: 'AWS Access Key Detected'
  },
  private_key: {
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    category: 'secret', severity: 'CRITICAL', title: 'Private Key Found'
  },
  generic_secret: {
    regex: /(?:password|passwd|secret|api[_-]?key|token|bearer)\s*[=:]\s*["']([^"']{8,})/gi,
    category: 'secret', severity: 'HIGH', title: 'Hardcoded Secret Detected'
  },
  jwt: {
    regex: /ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    category: 'secret', severity: 'HIGH', title: 'JWT Token Found'
  },

  // Crypto / Obfuscation
  base64_large: {
    regex: /[A-Za-z0-9+/]{100,}={0,2}/g,
    category: 'crypto', severity: 'LOW', title: 'Large Base64 String'
  },
  xor_pattern: {
    regex: /(?:xor|XOR|\^=)\s*0x[0-9a-fA-F]{1,4}/g,
    category: 'crypto', severity: 'MEDIUM', title: 'XOR Operation Detected'
  },
  hex_blob: {
    regex: /(?:0x[0-9a-fA-F]{2}\s*,?\s*){16,}/g,
    category: 'crypto', severity: 'MEDIUM', title: 'Hex Byte Array (Shellcode?)'
  },

  // Android specific
  dynamic_code: {
    regex: /(?:DexClassLoader|PathClassLoader|loadClass|defineClass)\s*\(/g,
    category: 'android', severity: 'HIGH', title: 'Dynamic Code Loading'
  },
  reflection: {
    regex: /(?:getDeclaredMethod|forName|invoke)\s*\(/g,
    category: 'android', severity: 'MEDIUM', title: 'Reflection Usage'
  },
  root_check: {
    regex: /(?:\/system\/bin\/su|\/sbin\/su|Superuser|supersu|busybox)/gi,
    category: 'android', severity: 'MEDIUM', title: 'Root Detection Evasion'
  },

  // Native / dangerous
  shell_exec: {
    regex: /\b(?:system|popen|exec[lve]?p?|execve|execl|execlp|execle)\s*\(/g,
    category: 'native', severity: 'HIGH', title: 'Shell Execution Function'
  },
  memory_ops: {
    regex: /\b(?:mprotect|mmap|VirtualAlloc|VirtualProtect|WriteProcessMemory)\s*\(/g,
    category: 'native', severity: 'HIGH', title: 'Memory Protection Modification'
  },
  ptrace: {
    regex: /\bptrace\s*\(/g,
    category: 'native', severity: 'MEDIUM', title: 'Ptrace Anti-Debug'
  },
  anti_debug: {
    regex: /(?:IsDebuggerPresent|CheckRemoteDebuggerPresent|NtQueryInformationProcess)/g,
    category: 'native', severity: 'MEDIUM', title: 'Anti-Debugger Check'
  }
};

// ── Android Permission Risk ───────────────────────────────────────────────────
const DANGEROUS_PERMS = new Set([
  'android.permission.READ_CONTACTS', 'android.permission.WRITE_CONTACTS',
  'android.permission.READ_SMS', 'android.permission.RECEIVE_SMS', 'android.permission.SEND_SMS',
  'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.RECORD_AUDIO', 'android.permission.CAMERA',
  'android.permission.READ_CALL_LOG', 'android.permission.WRITE_CALL_LOG',
  'android.permission.READ_PHONE_STATE',
  'android.permission.BIND_DEVICE_ADMIN', 'android.permission.BIND_ACCESSIBILITY_SERVICE',
  'android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.WRITE_SETTINGS', 'android.permission.PACKAGE_USAGE_STATS'
]);

async function runSecurityScan({ analysisId }) {
  const db = getDb();
  const files = db.prepare(
    "SELECT id, path, language, content FROM analysis_files WHERE analysis_id=? AND type='file' AND content IS NOT NULL"
  ).all(analysisId);

  const iocSet = new Set(); // deduplicate

  for (const file of files) {
    if (!file.content) continue;
    const lines = file.content.split('\n');

    for (const [patternName, pattern] of Object.entries(PATTERNS)) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;

      while ((match = regex.exec(file.content)) !== null) {
        const value = match[1] || match[0];
        if (pattern.filter && !pattern.filter(value)) continue;

        // Find line number
        const upToMatch = file.content.slice(0, match.index);
        const lineNum = upToMatch.split('\n').length;
        const lineContent = lines[lineNum - 1] || '';

        const dedupKey = `${patternName}:${value.slice(0, 100)}:${file.path}:${lineNum}`;
        if (iocSet.has(dedupKey)) continue;
        iocSet.add(dedupKey);

        // Store as finding
        const findId = uuidv4();
        db.prepare(`
          INSERT INTO findings (id, analysis_id, file_id, severity, category, title, description, file_path, line_start, evidence, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          findId, analysisId, file.id,
          pattern.severity, pattern.category,
          pattern.title,
          `Detected ${pattern.title} at ${file.path}:${lineNum}`,
          file.path, lineNum,
          lineContent.trim().slice(0, 200),
          Date.now()
        );

        // Store as IOC for network/secret patterns
        if (['url', 'ip', 'domain', 'aws_key', 'jwt'].includes(patternName)) {
          const iocId = uuidv4();
          db.prepare(`
            INSERT INTO iocs (id, analysis_id, type, value, context, file_path, line_number, created_at)
            VALUES (?,?,?,?,?,?,?,?)
          `).run(iocId, analysisId, patternName, value.slice(0, 1000), lineContent.trim().slice(0, 200), file.path, lineNum, Date.now());
        }
      }
    }
  }

  // Check dangerous Android permissions
  const apkMeta = db.prepare('SELECT permissions FROM apk_metadata WHERE analysis_id=?').get(analysisId);
  if (apkMeta?.permissions) {
    let perms;
    try { perms = JSON.parse(apkMeta.permissions); } catch { perms = []; }
    for (const perm of perms) {
      if (DANGEROUS_PERMS.has(perm)) {
        const findId = uuidv4();
        db.prepare(`
          INSERT INTO findings (id, analysis_id, severity, category, title, description, file_path, evidence, created_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).run(
          findId, analysisId, 'HIGH', 'android',
          'Dangerous Permission Declared',
          `App requests dangerous permission: ${perm}`,
          'AndroidManifest.xml', perm, Date.now()
        );
      }
    }
  }

  console.log(`[Scanner] Security scan complete for ${analysisId}: ${iocSet.size} findings`);
}

module.exports = { runSecurityScan };
