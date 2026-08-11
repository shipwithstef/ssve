#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_MODEL = 'Gemini 3.5 Flash (High)';
const DEFAULT_TIMEOUT_SECONDS = 1200;

function usage(message = '') {
  const prefix = message ? `dispatch-agy: ${message}\n` : '';
  return `${prefix}usage: dispatch-agy.mjs (--stdin | --prescope FILE --domain NAME) [--model MODEL] [--json-schema FILE] [--timeout-seconds N] [--artifacts-dir DIR]`;
}

function parseArgs(argv) {
  const options = { stdin: false, model: DEFAULT_MODEL, timeoutSeconds: DEFAULT_TIMEOUT_SECONDS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--stdin') options.stdin = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--prescope', '--domain', '--model', '--json-schema', '--timeout-seconds', '--artifacts-dir'].includes(arg)) {
      if (!argv[index + 1]) throw new Error(`missing value for ${arg}`);
      const key = { '--prescope': 'prescope', '--domain': 'domain', '--model': 'model', '--json-schema': 'jsonSchema', '--timeout-seconds': 'timeoutSeconds', '--artifacts-dir': 'artifactsDir' }[arg];
      options[key] = argv[index + 1];
      index += 1;
    } else throw new Error(`unsupported option ${arg}`);
  }
  options.timeoutSeconds = Number(options.timeoutSeconds);
  if (!Number.isInteger(options.timeoutSeconds) || options.timeoutSeconds < 1) throw new Error('--timeout-seconds must be a positive integer');
  if (options.stdin === Boolean(options.prescope || options.domain)) throw new Error('choose exactly one input mode: --stdin or --prescope FILE --domain NAME');
  if (!options.stdin && (!options.prescope || !options.domain)) throw new Error('--prescope and --domain are required together');
  return options;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function modelEffort(model) {
  const match = String(model).match(/(?:\(|-)(low|medium|high)\)?$/i);
  return match ? match[1].toLowerCase() : null;
}

function collapseIdenticalJsonDocuments(bytes) {
  const text = bytes.toString('utf8').trim();
  if (!text.startsWith('{')) return { bytes, repetitions: 0 };
  const documents = [];
  let start = 0;
  while (start < text.length) {
    while (/\s/.test(text[start] || '')) start += 1;
    if (start >= text.length) break;
    if (text[start] !== '{') return { bytes, repetitions: 0 };
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = -1;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === '{') depth += 1;
      else if (char === '}' && --depth === 0) { end = index + 1; break; }
    }
    if (end < 0 || quoted) return { bytes, repetitions: 0 };
    try { documents.push(JSON.parse(text.slice(start, end))); }
    catch { return { bytes, repetitions: 0 }; }
    start = end;
  }
  if (documents.length < 2) return { bytes, repetitions: 0 };
  const canonical = JSON.stringify(documents[0]);
  if (documents.some((document) => JSON.stringify(document) !== canonical)) return { bytes, repetitions: 0 };
  return { bytes: Buffer.from(`${canonical}\n`), repetitions: documents.length };
}

function extractionPrompt(prescopeBody) {
  return `You are extracting full knowledge of a website source for the svc framework's research skill.

Read EVERY URL in the pre-scope. Produce structured Markdown with:
1. Identity: legal entity, registration/VAT identifiers, address, phone, and email.
2. Services with verbatim prices.
3. Legal disclosures, refunds, disclaimers, and supervisory body.
4. Per-URL findings, including redirects and errors.
5. A coverage table with one row per URL.
6. Every source URL in fetch order.

Quality rules:
- Quote prices and legal language verbatim; do not invent absent facts.
- Inspect footer/imprint content and search for BULSTAT, ЕИК, EIK, ДДС, VAT, адвокат, and рег. №.
- Extract collapsed content from details, accordion, collapse, Elementor, Divi, WPBakery, FAQ, and aria-expanded controls.
- If a page has substantial HTML but little extracted body text, re-check hidden and collapsed content.
- Name every URL that could not be read. A partial result is not complete.

PRE-SCOPE:
---
${prescopeBody}
---`;
}

function classify(stderr, timedOut, code, spawnError) {
  if (spawnError) return 'capability';
  if (timedOut) return 'timeout';
  if (code === 0) return 'success';
  const text = stderr.toLowerCase();
  if (/auth|login|credential|oauth/.test(text)) return 'authentication';
  if (/quota|credit|resource_exhausted|429/.test(text)) return 'quota';
  if (/network|dns|socket|connect|proxy/.test(text)) return 'network';
  if (/invalid model selection|unknown model|model (?:is )?unavailable|not entitled|model entitlement/.test(text)) return 'model_unavailable';
  return 'provider_failure';
}

function runAgy(args, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('agy', args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    } catch (error) {
      resolve({ code: null, signal: null, timedOut: false, stdout: Buffer.alloc(0), stderr: Buffer.from(error.message), spawnError: true });
      return;
    }
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let settled = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
    }, timeoutMs);
    const heartbeat = setInterval(() => process.stderr.write(`dispatch-agy: still running (${new Date().toISOString()})\n`), 60_000);
    heartbeat.unref();
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearInterval(heartbeat);
      resolve({ code: null, signal: null, timedOut, stdout: Buffer.concat(stdout), stderr: Buffer.concat([...stderr, Buffer.from(error.message)]), spawnError: true });
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearInterval(heartbeat);
      resolve({ code, signal, timedOut, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), spawnError: false });
    });
  });
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${usage(error.message)}\n`);
  process.exit(2);
}
if (options.help) {
  process.stdout.write(`${usage()}\n`);
  process.exit(0);
}

let packageBytes;
if (options.stdin) packageBytes = await readStdin();
else packageBytes = Buffer.from(extractionPrompt(await readFile(path.resolve(options.prescope), 'utf8')));
if (packageBytes.length === 0) {
  process.stderr.write(`${usage('input package is empty')}\n`);
  process.exit(2);
}
let schemaBytes = null;
if (options.jsonSchema) {
  schemaBytes = await readFile(path.resolve(options.jsonSchema));
  try { JSON.parse(schemaBytes.toString('utf8')); } catch { throw new Error('--json-schema must name a valid JSON document'); }
}

const requestId = randomUUID();
const startedAt = new Date().toISOString();
const privateDir = await mkdtemp(path.join(tmpdir(), 'svc-agy-package-'));
const packageFile = path.join(privateDir, 'package.md');
const schemaFile = path.join(privateDir, 'response.schema.json');
const artifactsDir = options.artifactsDir ? path.resolve(options.artifactsDir) : null;
let result;
let classification = 'internal_failure';
try {
  await writeFile(packageFile, packageBytes, { mode: 0o600 });
  if (schemaBytes) await writeFile(schemaFile, schemaBytes, { mode: 0o600 });
  const instruction = `Read ${packageFile} completely and follow it. Treat it as the complete task package. Do not modify the package file. Return only the requested result.`;
  const agyArgs = [
    '--sandbox',
    '--mode', 'plan',
    '--model', options.model,
    '--add-dir', privateDir,
    ...(schemaBytes ? ['--json-schema', schemaFile, '--output-format', 'json'] : []),
    '--print-timeout', `${options.timeoutSeconds}s`,
    '--print', instruction,
  ];
  result = await runAgy(agyArgs, options.timeoutSeconds * 1000);
  classification = classify(`${result.stdout.toString('utf8')}\n${result.stderr.toString('utf8')}`, result.timedOut, result.code, result.spawnError);
  const normalized = classification === 'success'
    ? collapseIdenticalJsonDocuments(result.stdout)
    : { bytes: result.stdout, repetitions: 0 };
  const effectiveStdout = normalized.bytes;

  if (artifactsDir) {
    await mkdir(artifactsDir, { recursive: true, mode: 0o700 });
    const outputPath = path.join(artifactsDir, 'output.txt');
    const stderrPath = path.join(artifactsDir, 'stderr.log');
    await writeFile(outputPath, effectiveStdout, { mode: 0o600 });
    await writeFile(stderrPath, result.stderr, { mode: 0o600 });
    await writeFile(path.join(artifactsDir, 'receipt.json'), `${JSON.stringify({
      schema_version: 1,
      request_id: requestId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: classification === 'success' ? 'success' : 'failure',
      classification,
      requested_model: options.model,
      requested_effort: modelEffort(options.model),
      response_schema_sha256: schemaBytes ? sha256(schemaBytes) : null,
      model_attestation: { level: classification === 'success' ? 'requested_accepted' : 'none', evidence: classification === 'success' ? 'exact_model_argv_plus_successful_process_exit_no_server_model_echo' : null },
      package_sha256: sha256(packageBytes),
      package_bytes: packageBytes.length,
      transport: 'stdin_to_private_mode_0600_file',
      sandbox: true,
      mode: 'plan',
      timeout_seconds: options.timeoutSeconds,
      identical_json_repetitions_collapsed: normalized.repetitions,
      exit_code: result.code,
      signal: result.signal,
      artifacts: { output: outputPath, stderr: stderrPath },
    }, null, 2)}\n`, { mode: 0o600 });
  }

  process.stdout.write(effectiveStdout);
  if (result.stderr.length) process.stderr.write(result.stderr);
  if (classification !== 'success') {
    process.stderr.write(`dispatch-agy: ${classification}: verify AGY authentication, model entitlement, network, and the receipt artifacts; request=${requestId}\n`);
    process.exitCode = result.code || 1;
  }
} finally {
  await rm(privateDir, { recursive: true, force: true });
}
