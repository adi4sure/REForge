/**
 * Analysis Queue — simple in-process async queue using Node worker threads.
 * In production this would be replaced by BullMQ + Redis.
 */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const { getDb } = require('../db');

const queue = [];
let processing = false;

async function queueAnalysis(job) {
  queue.push(job);
  if (!processing) processNext();
}

async function processNext() {
  if (queue.length === 0) { processing = false; return; }
  processing = true;
  const job = queue.shift();

  const db = getDb();
  db.prepare('UPDATE analyses SET status=?, started_at=? WHERE id=?')
    .run('processing', Date.now(), job.analysisId);

  try {
    await runAnalysis(job);
    db.prepare('UPDATE analyses SET status=?, completed_at=? WHERE id=?')
      .run('complete', Date.now(), job.analysisId);
  } catch (err) {
    console.error('[queue] Analysis failed:', err.message);
    db.prepare('UPDATE analyses SET status=?, error_msg=? WHERE id=?')
      .run('error', err.message.slice(0, 500), job.analysisId);
  }

  setImmediate(processNext);
}

async function runAnalysis(job) {
  const { fileType } = job;

  if (fileType === 'apk' || fileType === 'aab' || fileType === 'dex') {
    const { analyzeApk } = require('./apkAnalyzer');
    await analyzeApk(job);
  } else if (['elf', 'pe', 'macho'].includes(fileType)) {
    const { analyzeBinary } = require('./binaryAnalyzer');
    await analyzeBinary(job);
  } else if (['powershell', 'shell', 'python', 'javascript'].includes(fileType)) {
    const { analyzeScript } = require('./scriptAnalyzer');
    await analyzeScript(job);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  // Run security scanner on all types
  const { runSecurityScan } = require('./securityScanner');
  await runSecurityScan(job);

  // Index for RAG
  const { indexAnalysisForRag } = require('./ragService');
  await indexAnalysisForRag(job.analysisId);
}

module.exports = { queueAnalysis };
