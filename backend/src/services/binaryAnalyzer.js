/**
 * Binary Analyzer — wraps Ghidra headless to decompile ELF/PE/Mach-O
 * Uses Ghidra's analyzeHeadless script with DecompileFunction post-script
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const execAsync = promisify(exec);

const GHIDRA_HOME = process.env.GHIDRA_HOME || '/opt/ghidra';
const OUTPUT_BASE = process.env.OUTPUT_DIR || path.join(__dirname, '../../../outputs');
const GHIDRA_PROJECTS = process.env.GHIDRA_PROJECTS || path.join(__dirname, '../../../ghidra_projects');

async function analyzeBinary({ analysisId, filePath, fileType }) {
  const db = getDb();
  const projectDir = path.join(GHIDRA_PROJECTS, analysisId);
  const outputDir = path.join(OUTPUT_BASE, analysisId, 'ghidra');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const analyzeScript = path.join(__dirname, '../workers/ghidra_export.py');
  const ghidraHeadless = path.join(GHIDRA_HOME, 'support', 'analyzeHeadless');

  console.log(`[Ghidra] Analyzing ${filePath} (${fileType})`);

  // Run Ghidra headless analysis + export
  const cmd = `"${ghidraHeadless}" "${projectDir}" reforge_${analysisId} -import "${filePath}" -postScript "${analyzeScript}" "${outputDir}" -scriptPath "${path.dirname(analyzeScript)}" -deleteProject -overwrite`;

  try {
    await execAsync(cmd, {
      timeout: 600000, // 10 min
      maxBuffer: 100 * 1024 * 1024,
      env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME || '' }
    });
  } catch (err) {
    // Ghidra may exit non-zero even on success; check if output exists
    const outputJson = path.join(outputDir, 'analysis.json');
    if (!fs.existsSync(outputJson)) throw err;
  }

  // Parse Ghidra output JSON
  const outputJson = path.join(outputDir, 'analysis.json');
  if (!fs.existsSync(outputJson)) {
    throw new Error('Ghidra did not produce analysis.json');
  }

  const ghidraData = JSON.parse(fs.readFileSync(outputJson, 'utf8'));

  // Store binary metadata
  db.prepare(`
    INSERT OR REPLACE INTO binary_metadata
    (analysis_id, arch, bits, endian, compiler, linked_libs, sections, imports, exports, entry_point, is_packed, is_stripped)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    analysisId,
    ghidraData.arch || null,
    ghidraData.bits || null,
    ghidraData.endian || null,
    ghidraData.compiler || null,
    JSON.stringify(ghidraData.linked_libs || []),
    JSON.stringify(ghidraData.sections || []),
    JSON.stringify(ghidraData.imports || []),
    JSON.stringify(ghidraData.exports || []),
    ghidraData.entry_point || null,
    ghidraData.is_packed ? 1 : 0,
    ghidraData.is_stripped ? 1 : 0
  );

  // Update analysis arch/os
  db.prepare('UPDATE analyses SET arch=?, os_type=? WHERE id=?')
    .run(ghidraData.arch, ghidraData.os_type, analysisId);

  // Store functions
  for (const fn of (ghidraData.functions || [])) {
    const fnId = uuidv4();
    db.prepare(`
      INSERT OR IGNORE INTO functions (id, analysis_id, name, address, signature, decompiled_c, asm_listing, complexity)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(fnId, analysisId, fn.name, fn.address, fn.signature, fn.decompiled_c, fn.asm_listing, fn.complexity || 0);

    // Also store as a file in analysis_files for the explorer
    if (fn.decompiled_c) {
      const fileId = uuidv4();
      const content = `// Function: ${fn.name}\n// Address: ${fn.address}\n// Signature: ${fn.signature}\n\n${fn.decompiled_c}`;
      db.prepare(`
        INSERT OR IGNORE INTO analysis_files (id, analysis_id, path, name, type, language, size, content)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(fileId, analysisId, `/functions/${fn.name}.c`, `${fn.name}.c`, 'file', 'c', content.length, content);
    }
  }

  // Store strings as a file
  if (ghidraData.strings?.length) {
    const strContent = ghidraData.strings.map(s => `[0x${s.addr}] ${s.value}`).join('\n');
    const strId = uuidv4();
    db.prepare(`
      INSERT OR IGNORE INTO analysis_files (id, analysis_id, path, name, type, language, size, content)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(strId, analysisId, '/strings.txt', 'strings.txt', 'file', 'plaintext', strContent.length, strContent);
  }

  console.log(`[Ghidra] Analysis complete for ${analysisId}: ${(ghidraData.functions || []).length} functions`);
}

module.exports = { analyzeBinary };
