/**
 * APK Analyzer — wraps JADX CLI to decompile APK/AAB/DEX
 * JADX is run inside the jadx Docker container via child_process exec
 */
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const JADX_CMD = process.env.JADX_CMD || 'jadx';
const OUTPUT_BASE = process.env.OUTPUT_DIR || path.join(__dirname, '../../../outputs');

async function analyzeApk({ analysisId, filePath }) {
  const db = getDb();
  const outputDir = path.join(OUTPUT_BASE, analysisId, 'jadx');
  fs.mkdirSync(outputDir, { recursive: true });

  // Run JADX decompile
  console.log(`[JADX] Decompiling ${filePath} → ${outputDir}`);
  await execAsync(
    `${JADX_CMD} --deobf --export-gradle -d "${outputDir}" "${filePath}"`,
    { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }
  );

  // Parse AndroidManifest
  const manifestPath = path.join(outputDir, 'resources', 'AndroidManifest.xml');
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  }

  // Save APK metadata
  if (manifest) {
    db.prepare(`
      INSERT OR REPLACE INTO apk_metadata
      (analysis_id, package_name, version_name, version_code, min_sdk, target_sdk,
       permissions, activities, services, receivers, providers, native_libs)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      analysisId,
      manifest.packageName || null,
      manifest.versionName || null,
      manifest.versionCode || null,
      manifest.minSdk || null,
      manifest.targetSdk || null,
      JSON.stringify(manifest.permissions || []),
      JSON.stringify(manifest.activities || []),
      JSON.stringify(manifest.services || []),
      JSON.stringify(manifest.receivers || []),
      JSON.stringify(manifest.providers || []),
      JSON.stringify(manifest.nativeLibs || [])
    );
  }

  // Walk decompiled source tree and store all files
  const sourceDir = path.join(outputDir, 'sources');
  if (fs.existsSync(sourceDir)) {
    await walkAndStore(db, analysisId, sourceDir, sourceDir, null);
  }

  // Also store resources
  const resourceDir = path.join(outputDir, 'resources');
  if (fs.existsSync(resourceDir)) {
    await walkAndStore(db, analysisId, resourceDir, outputDir, null);
  }

  console.log(`[JADX] Analysis complete for ${analysisId}`);
}

async function walkAndStore(db, analysisId, dir, rootDir, parentId) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = fullPath.replace(rootDir, '').replace(/\\/g, '/');
    const fileId = uuidv4();

    if (entry.isDirectory()) {
      db.prepare(`
        INSERT OR IGNORE INTO analysis_files (id, analysis_id, parent_id, path, name, type)
        VALUES (?,?,?,?,?,?)
      `).run(fileId, analysisId, parentId, relPath, entry.name, 'dir');
      await walkAndStore(db, analysisId, fullPath, rootDir, fileId);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const lang = extToLang(ext);
      const stat = fs.statSync(fullPath);

      // Only store text files < 2MB in DB; large binaries skipped
      let content = null;
      if (stat.size < 2 * 1024 * 1024 && isTextExt(ext)) {
        try { content = fs.readFileSync(fullPath, 'utf8'); } catch {}
      }

      db.prepare(`
        INSERT OR IGNORE INTO analysis_files (id, analysis_id, parent_id, path, name, type, language, size, content)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(fileId, analysisId, parentId, relPath, entry.name, 'file', lang, stat.size, content);
    }
  }
}

function extToLang(ext) {
  const map = {
    '.java': 'java', '.kt': 'kotlin', '.xml': 'xml',
    '.smali': 'smali', '.json': 'json', '.gradle': 'groovy',
    '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
    '.ps1': 'powershell', '.sh': 'shell', '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.asm': 'asm', '.S': 'asm', '.txt': 'plaintext',
    '.md': 'markdown', '.yml': 'yaml', '.yaml': 'yaml',
    '.properties': 'ini', '.pro': 'plaintext'
  };
  return map[ext] || 'plaintext';
}

function isTextExt(ext) {
  const text = new Set(['.java','.kt','.xml','.smali','.json','.gradle','.py','.js','.ts','.ps1','.sh','.c','.h','.cpp','.asm','.S','.txt','.md','.yml','.yaml','.properties','.pro','.html','.css','.toml','.ini','.cfg']);
  return text.has(ext);
}

function parseManifest(xmlStr) {
  // Simple regex-based parser (no XML parser dep needed for MVP)
  const pkg = xmlStr.match(/package="([^"]+)"/)?.[1];
  const verName = xmlStr.match(/android:versionName="([^"]+)"/)?.[1];
  const verCode = parseInt(xmlStr.match(/android:versionCode="([^"]+)"/)?.[1] || '0');
  const minSdk = parseInt(xmlStr.match(/android:minSdkVersion="([^"]+)"/)?.[1] || '0');
  const targetSdk = parseInt(xmlStr.match(/android:targetSdkVersion="([^"]+)"/)?.[1] || '0');

  const perms = [...xmlStr.matchAll(/<uses-permission[^>]+android:name="([^"]+)"/g)].map(m => m[1]);
  const activities = [...xmlStr.matchAll(/<activity[^>]+android:name="([^"]+)"/g)].map(m => m[1]);
  const services = [...xmlStr.matchAll(/<service[^>]+android:name="([^"]+)"/g)].map(m => m[1]);
  const receivers = [...xmlStr.matchAll(/<receiver[^>]+android:name="([^"]+)"/g)].map(m => m[1]);
  const providers = [...xmlStr.matchAll(/<provider[^>]+android:name="([^"]+)"/g)].map(m => m[1]);
  const nativeLibs = [...xmlStr.matchAll(/lib\/[^/]+\/([^"]+\.so)/g)].map(m => m[1]);

  return { packageName: pkg, versionName: verName, versionCode: verCode, minSdk, targetSdk, permissions: perms, activities, services, receivers, providers, nativeLibs };
}

module.exports = { analyzeApk };
