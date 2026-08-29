/**
 * AI Service — BYOK multi-provider AI with streaming
 * Selects provider based on task type:
 *   - Anthropic Claude: best for long code analysis, decompiled C reasoning
 *   - OpenAI GPT-4o: best for structured output, report generation, JS/Python
 */
const { getDb } = require('../db');
const { decryptKey } = require('./cryptoService');

const SYSTEM_PROMPT = `You are REForge, an expert AI reverse engineering assistant embedded in a malware analysis platform.
You have access to decompiled source code, disassembly, security findings, and IOC extractions from the analyzed file.

Your role:
- Answer questions about the code with precision and accuracy
- Every claim you make MUST be backed by a file:line citation from the provided code context
- Identify malicious patterns, obfuscation, C2 communication, anti-analysis tricks
- Explain crypto algorithms, encoding schemes, and obfuscated logic
- Never hallucinate: if you're unsure, say so

Citation format: [file/path/name.java:42] or [function_name.c:17]

Focus areas:
- Malware behavior: C2, persistence, evasion, data exfiltration
- Crypto: XOR keys, RC4, AES usage, custom encoders
- Anti-analysis: debugger detection, emulator checks, timing attacks
- Android: permissions abuse, reflection, dynamic DEX loading
- Native: shellcode, ROP gadgets, memory manipulation`;

function buildCodeContext(codeChunks, findings, iocs) {
  let ctx = '';

  if (codeChunks.length > 0) {
    ctx += `\n\n=== RELEVANT CODE CONTEXT ===\n`;
    for (const chunk of codeChunks) {
      ctx += `\n--- ${chunk.path} ---\n\`\`\`\n${chunk.content.slice(0, 3000)}\n\`\`\`\n`;
    }
  }

  if (findings.length > 0) {
    ctx += `\n\n=== SECURITY FINDINGS (${findings.length}) ===\n`;
    for (const f of findings.slice(0, 15)) {
      ctx += `[${f.severity}] ${f.category}: ${f.title} @ ${f.file_path}:${f.line_start}\n  ${f.evidence}\n`;
    }
  }

  if (iocs.length > 0) {
    ctx += `\n\n=== IOCs (${iocs.length}) ===\n`;
    for (const ioc of iocs.slice(0, 20)) {
      ctx += `  ${ioc.type.toUpperCase()}: ${ioc.value}\n`;
    }
  }

  return ctx;
}

async function getAiService(userId, preferredModel) {
  const db = getDb();
  const keys = db.prepare('SELECT * FROM user_api_keys WHERE user_id=?').all(userId);
  if (!keys.length) return null;

  // Priority: anthropic for code analysis, openai for reports/structured
  const providerOrder = ['anthropic', 'openai', 'bedrock'];
  for (const provider of providerOrder) {
    const keyRow = keys.find(k => k.provider === provider);
    if (keyRow) {
      const decrypted = decryptKey(keyRow.key_enc);
      return createProvider(provider, decrypted, preferredModel || keyRow.model);
    }
  }
  return null;
}

function createProvider(provider, apiKey, model) {
  if (provider === 'anthropic') {
    return new AnthropicProvider(apiKey, model || 'claude-3-5-sonnet-20241022');
  } else if (provider === 'openai') {
    return new OpenAIProvider(apiKey, model || 'gpt-4o');
  }
  throw new Error(`Provider ${provider} not yet implemented`);
}

// ── Anthropic Provider ────────────────────────────────────────────────────────
class AnthropicProvider {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  async streamChat({ analysis, message, history, codeChunks, findings, iocs, onToken, onCitations }) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: this.apiKey });

    const codeCtx = buildCodeContext(codeChunks, findings, iocs);
    const systemWithCtx = SYSTEM_PROMPT + `\n\nFile being analyzed: ${analysis.original_name} (${analysis.file_type}, SHA256: ${analysis.sha256})` + codeCtx;

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const stream = client.messages.stream({
      model: this.modelName,
      max_tokens: 4096,
      system: systemWithCtx,
      messages
    });

    const citations = [];
    let fullText = '';

    stream.on('text', (text) => {
      fullText += text;
      onToken(text);
      // Extract citations from streaming text
      const citationRegex = /\[([^\]:]+):(\d+)(?:-(\d+))?\]/g;
      let m;
      while ((m = citationRegex.exec(text)) !== null) {
        citations.push({ file_path: m[1], line_start: parseInt(m[2]), line_end: m[3] ? parseInt(m[3]) : parseInt(m[2]) });
      }
    });

    await stream.finalMessage();
    onCitations(citations);
  }
}

// ── OpenAI Provider ───────────────────────────────────────────────────────────
class OpenAIProvider {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  async streamChat({ analysis, message, history, codeChunks, findings, iocs, onToken, onCitations }) {
    const OpenAI = require('openai');
    const client = new OpenAI.default({ apiKey: this.apiKey });

    const codeCtx = buildCodeContext(codeChunks, findings, iocs);
    const systemMsg = SYSTEM_PROMPT + `\n\nFile: ${analysis.original_name} (${analysis.file_type})` + codeCtx;

    const messages = [
      { role: 'system', content: systemMsg },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const stream = await client.chat.completions.create({
      model: this.modelName,
      messages,
      max_tokens: 4096,
      stream: true
    });

    const citations = [];

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        onToken(token);
        const citationRegex = /\[([^\]:]+):(\d+)(?:-(\d+))?\]/g;
        let m;
        while ((m = citationRegex.exec(token)) !== null) {
          citations.push({ file_path: m[1], line_start: parseInt(m[2]), line_end: m[3] ? parseInt(m[3]) : parseInt(m[2]) });
        }
      }
    }

    onCitations(citations);
  }
}

module.exports = { getAiService };
