#!/usr/bin/env node
// skills/ingest-guide/scripts/dispatch-research-detached.mjs
// Conditionally dispatch research extraction via detached Kimi runner,
// with a short-circuit for already-extracted content.
//
// USAGE:
//   node skills/ingest-guide/scripts/dispatch-research-detached.mjs \
//     --source-id <id> \
//     --raw-file <path> \
//     [--extracted-file <path>] \
//     [--skip-if-extracted]
//
// EXIT: 0 = extraction ready (either reused or freshly completed)
//       stdout: JSON { source_id, extraction_path, method: "reused|detached|inline" }

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.env.SVC_REPO_ROOT || process.cwd();
const DETACHED_RUNNER = path.join(repoRoot, 'scripts', 'run-kimi-detached.sh');
const JOB_STATUS = path.join(repoRoot, 'scripts', 'kimi-job-status.sh');
const CONVERTER = path.join(repoRoot, 'skills', 'ingest-guide', 'scripts', 'convert-to-ingest-ready.mjs');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--source-id': out.source_id = v; i++; break;
      case '--raw-file': out.raw_file = v; i++; break;
      case '--extracted-file': out.extracted_file = v; i++; break;
      case '--skip-if-extracted': out.skip_if_extracted = true; break;
    }
  }
  return out;
}

function fail(msg, extra = {}) {
  console.error(JSON.stringify({ verdict: 'failed', reason: msg, ...extra }));
  process.exit(1);
}

function pass(payload) {
  console.log(JSON.stringify({ verdict: 'ok', ...payload }));
  process.exit(0);
}

function fileExists(p) {
  try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; }
}

function sanitizeSourceId(id) {
  // Prevent path traversal: allow only alphanumeric, hyphen, underscore, dot
  if (!id || typeof id !== 'string') return null;
  const clean = id.replace(/[^A-Za-z0-9._-]/g, '_');
  // Collapse multiple underscores
  return clean.replace(/_+/g, '_').replace(/(^_|_$)/g, '');
}

function resolveCanonicalIngestReady(sourceId) {
  return path.join(repoRoot, 'docs', 'specs', 'ingest-guide', sourceId + '-ingest-ready.json');
}

function resolveExtractedPath(a) {
  // 1. Canonical ingest-ready.json
  const canonical = resolveCanonicalIngestReady(a.source_id);
  if (fileExists(canonical)) return { path: canonical, type: 'canonical' };

  // 2. Explicit extracted file
  if (a.extracted_file && fileExists(a.extracted_file)) {
    return { path: a.extracted_file, type: 'fallback' };
  }

  // 3. Fallback locations
  const candidates = [
    { p: path.join(repoRoot, 'docs', 'specs', 'ingest-guide', a.source_id + '-extracted.json'), type: 'fallback' },
    { p: path.join(repoRoot, 'docs', 'specs', 'ingest-guide', a.source_id + '-extracted.md'), type: 'fallback' },
    { p: path.join(repoRoot, 'docs', 'specs', 'research-prescope-' + a.source_id + '.md'), type: 'fallback' },
    { p: path.join(repoRoot, 'references', 'knowledge', 'domains', a.source_id, 'CAPABILITIES.md'), type: 'fallback' },
  ];

  for (const c of candidates) {
    if (fileExists(c.p)) return { path: c.p, type: c.type };
  }
  return null;
}

function isStructuredExtraction(p) {
  if (!p) return false;
  const text = fs.readFileSync(p, 'utf-8');
  return /\b(claims?|techniques?|results?|conditions?)\b/i.test(text) ||
         /##\s+CAPABILITIES/i.test(text);
}

function buildPrompt(rawFilePath, sourceId) {
  const rawText = fs.readFileSync(rawFilePath, 'utf-8');
  // SECURITY: use string concatenation, NOT template literals, to prevent
  // template literal injection from user-controlled rawText/sourceId.
  const header = 'You are the research extraction sub-agent for svc ingest-guide.\n\nSOURCE: ' + sourceId + '\n\n';
  const body = 'Extract structured claims from the following content. Output ONLY a JSON object with this shape:\n\n' +
    '{\n' +
    '  "claims": [\n' +
    '    {\n' +
    '      "id": 1,\n' +
    '      "text": "verbatim or summarized claim",\n' +
    '      "type": "technique|result|condition|assertion",\n' +
    '      "upstream_url": "URL cited in source, or null"\n' +
    '    }\n' +
    '  ],\n' +
    '  "upstream_urls": ["any public URLs mentioned"],\n' +
    '  "content_summary": "1-2 sentence summary"\n' +
    '}\n\n' +
    'CONTENT TO ANALYZE:\n' +
    '---\n';
  const footer = '\n---\n\nRules:\n- Each claim must be atomic (one idea per claim).\n- Preserve verbatim quotes where possible.\n- If the source cites a public repo, gist, or doc URL, include it in upstream_urls.\n';
  return header + body + rawText + footer;
}

function dispatchDetached(promptText, sourceId) {
  const tmpDir = path.join(repoRoot, '.svc', 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  // SECURITY: sanitize sourceId before using in filename
  const safeId = sanitizeSourceId(sourceId);
  if (!safeId) fail('invalid source-id after sanitization');
  const promptFile = path.join(tmpDir, 'ingest-' + safeId + '-prompt.txt');
  fs.writeFileSync(promptFile, promptText, 'utf-8');

  if (!fileExists(DETACHED_RUNNER)) {
    fail('detached runner not found: ' + DETACHED_RUNNER);
  }

  // SECURITY: use execFileSync with array args, not template string interpolation
  const stdout = execFileSync('bash', [
    DETACHED_RUNNER,
    '--skill', 'ingest-guide',
    '--prompt-file', promptFile,
    '--label', safeId,
  ], { encoding: 'utf-8', timeout: 10000 });

  const result = JSON.parse(stdout.trim());
  if (!result.job_id || !result.log_path) {
    fail('detached runner returned malformed JSON', { runner_output: stdout.trim() });
  }
  return result;
}

function pollUntilDone(jobId, maxSeconds = 3600) {
  const start = Date.now();
  const maxMs = maxSeconds * 1000;
  const pollIntervalMs = 15000;

  while (Date.now() - start < maxMs) {
    let status;
    try {
      // SECURITY: use execFileSync with array args
      const stdout = execFileSync('bash', [JOB_STATUS, jobId], { encoding: 'utf-8', timeout: 5000 });
      status = JSON.parse(stdout.trim());
    } catch (e) {
      // Status script may not exist or job may be too new; retry
    }

    if (status) {
      if (status.state === 'done') {
        return status;
      }
      if (status.state === 'timeout' || status.state === 'killed' || status.state === 'error' || status.state === 'failed') {
        fail('detached job ' + jobId + ' ended with state: ' + status.state, status);
      }
    }

    const sleepMs = Math.min(pollIntervalMs * Math.pow(1.5, ((Date.now() - start) / 60000)), 60000);
    // Use execSync sleep for portability
    try {
      execFileSync('sleep', [String(Math.ceil(sleepMs / 1000))]);
    } catch {
      // Fallback: busy-wait if sleep command unavailable
      const target = Date.now() + sleepMs;
      while (Date.now() < target) { /* busy wait */ }
    }
  }

  fail('detached job ' + jobId + ' did not complete within ' + maxSeconds + 's');
}

function convertLogToIngestReady(logPath, sourceId) {
  if (!fileExists(CONVERTER)) {
    fail('converter not found: ' + CONVERTER);
  }
  const outputPath = resolveCanonicalIngestReady(sourceId);
  try {
    execFileSync('node', [
      CONVERTER,
      '--source-id', sourceId,
      '--input', logPath,
      '--output', outputPath,
      '--from', 'research-log',
      '--extraction-method', 'detached',
    ], { encoding: 'utf-8', timeout: 30000 });
  } catch (e) {
    fail('converter failed', { error: e.message, stdout: e.stdout, stderr: e.stderr });
  }
  return outputPath;
}

function convertFallbackToIngestReady(fallbackPath, sourceId) {
  if (!fileExists(CONVERTER)) {
    fail('converter not found: ' + CONVERTER);
  }
  const outputPath = resolveCanonicalIngestReady(sourceId);
  let fromType = 'raw-md';
  if (fallbackPath.endsWith('.json')) fromType = 'extracted-json';
  else if (fallbackPath.endsWith('CAPABILITIES.md')) fromType = 'capabilities-md';
  else if (fallbackPath.includes('prescope')) fromType = 'prescope-md';

  try {
    execFileSync('node', [
      CONVERTER,
      '--source-id', sourceId,
      '--input', fallbackPath,
      '--output', outputPath,
      '--from', fromType,
      '--extraction-method', 'reused',
    ], { encoding: 'utf-8', timeout: 30000 });
  } catch (e) {
    fail('converter failed for fallback', { error: e.message });
  }
  return outputPath;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.source_id) fail('missing --source-id');

  const safeSourceId = sanitizeSourceId(a.source_id);
  if (!safeSourceId) fail('invalid source-id');

  // SHORT-CIRCUIT 1: canonical ingest-ready.json
  const canonicalPath = resolveCanonicalIngestReady(safeSourceId);
  if (fileExists(canonicalPath)) {
    pass({
      source_id: safeSourceId,
      extraction_path: canonicalPath,
      method: 'reused',
      reason: 'canonical ingest-ready.json already exists',
    });
    return;
  }

  // SHORT-CIRCUIT 2: fallback extracted content
  const extracted = resolveExtractedPath({ ...a, source_id: safeSourceId });
  if (extracted && isStructuredExtraction(extracted.path)) {
    if (extracted.type === 'canonical') {
      pass({
        source_id: safeSourceId,
        extraction_path: extracted.path,
        method: 'reused',
        reason: 'canonical ingest-ready.json already exists',
      });
    } else {
      // Convert fallback to canonical format before returning
      const convertedPath = convertFallbackToIngestReady(extracted.path, safeSourceId);
      pass({
        source_id: safeSourceId,
        extraction_path: convertedPath,
        method: 'reused',
        reason: 'fallback extraction converted to canonical ingest-ready.json',
        original_fallback: extracted.path,
      });
    }
    return;
  }

  // If no raw file provided and no extracted content, we can't proceed
  if (!a.raw_file || !fileExists(a.raw_file)) {
    fail('no raw file and no pre-existing extraction', { raw_file: a.raw_file, extracted_path: extracted ? extracted.path : null });
  }

  // Check if detached runner is available; if not, fall back to inline
  if (!fileExists(DETACHED_RUNNER)) {
    pass({
      source_id: safeSourceId,
      extraction_path: a.raw_file,
      method: 'inline',
      reason: 'detached runner unavailable; caller should run research inline',
    });
    return;
  }

  // Build prompt and dispatch detached
  const promptText = buildPrompt(a.raw_file, safeSourceId);
  const job = dispatchDetached(promptText, safeSourceId);

  // Poll until done
  const finalStatus = pollUntilDone(job.job_id, job.max_seconds || 3600);

  // Convert raw log to canonical ingest-ready.json
  const convertedPath = convertLogToIngestReady(job.log_path, safeSourceId);

  pass({
    source_id: safeSourceId,
    extraction_path: convertedPath,
    method: 'detached',
    job_id: job.job_id,
    state: finalStatus.state,
    exit_code: finalStatus.exit_code,
  });
}

main();
