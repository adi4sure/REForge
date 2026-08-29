/**
 * File Identifier Service
 * Uses magic bytes + extension fallback to determine file type
 */
const path = require('path');
const fs = require('fs');

const MAGIC_BYTES = [
  { magic: [0x50, 0x4B, 0x03, 0x04], type: 'apk', mime: 'application/zip' }, // ZIP/APK/AAB/JAR
  { magic: [0x64, 0x65, 0x78, 0x0A], type: 'dex', mime: 'application/octet-stream' }, // DEX
  { magic: [0x4D, 0x5A],             type: 'pe',  mime: 'application/x-msdownload' }, // MZ (PE)
  { magic: [0x7F, 0x45, 0x4C, 0x46], type: 'elf', mime: 'application/x-elf' },       // ELF
  { magic: [0xCE, 0xFA, 0xED, 0xFE], type: 'macho', mime: 'application/x-mach-binary' }, // Mach-O 32
  { magic: [0xCF, 0xFA, 0xED, 0xFE], type: 'macho', mime: 'application/x-mach-binary' }, // Mach-O 64
  { magic: [0xCA, 0xFE, 0xBA, 0xBE], type: 'macho', mime: 'application/x-mach-binary' }, // FAT Mach-O
];

const EXTENSION_MAP = {
  '.apk': 'apk', '.aab': 'apk', '.dex': 'dex',
  '.exe': 'pe', '.dll': 'pe', '.sys': 'pe', '.com': 'pe',
  '.elf': 'elf', '.so': 'elf',
  '.dylib': 'macho', '.macho': 'macho',
  '.ps1': 'powershell', '.psm1': 'powershell', '.psd1': 'powershell',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.py': 'python', '.pyc': 'python',
  '.js': 'javascript', '.ts': 'javascript', '.jsx': 'javascript', '.tsx': 'javascript',
  '.jar': 'jar'
};

const SCRIPT_TYPES = new Set(['powershell', 'shell', 'python', 'javascript']);

async function identifyFile(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const extType = EXTENSION_MAP[ext];

  // Read first 16 bytes for magic
  let magicType = null;
  let mime = 'application/octet-stream';
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    for (const entry of MAGIC_BYTES) {
      if (entry.magic.every((b, i) => buf[i] === b)) {
        magicType = entry.type;
        mime = entry.mime;
        break;
      }
    }
  } catch {}

  // APK vs AAB vs JAR — all are ZIPs, distinguish by extension + content
  if (magicType === 'apk') {
    if (ext === '.aab') magicType = 'aab';
    else if (ext === '.jar') magicType = 'jar';
    // APK detected by ZIP magic — trust it
  }

  // Script types: use extension (magic bytes unreliable for text)
  const type = magicType || extType || 'unknown';
  const isScript = SCRIPT_TYPES.has(type);

  return { type, mime: isScript ? 'text/plain' : mime };
}

module.exports = { identifyFile };
