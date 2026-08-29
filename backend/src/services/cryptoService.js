/**
 * Crypto Service — AES-256-CBC encryption using Node's built-in crypto module
 * Replaces the crypto-js dependency (which is deprecated)
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY_SOURCE = process.env.ENCRYPTION_KEY || 'reforge-enc-key-change-in-prod-32c';

// Derive a 32-byte key from the env var
function getKey() {
  return crypto.createHash('sha256').update(KEY_SOURCE).digest(); // always 32 bytes
}

function encryptKey(plaintext) {
  const iv = crypto.randomBytes(16);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Prepend IV as hex so we can decrypt later
  return iv.toString('hex') + ':' + encrypted;
}

function decryptKey(ciphertext) {
  const [ivHex, encrypted] = ciphertext.split(':');
  if (!ivHex || !encrypted) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivHex, 'hex');
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encryptKey, decryptKey };
