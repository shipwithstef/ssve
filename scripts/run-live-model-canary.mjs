#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_CLAUDE_AUXILIARY = new Set(['claude-haiku-4-5-20251001']);
const ROUTES = ['codex', 'fable', 'opus', 'agy'];

function usage() {
  return `usage: SVC_ALLOW_PAID_MODEL_CANARY=1 node scripts/run-live-model-canary.mjs [--route codex|fable|opus|agy] [--artifacts-dir DIR] [--timeout-seconds N]\n\nThis is an opt-in paid hello-world canary. Its short timeout never changes the 1200-second production review default.`;
}

function parseArgs(argv) {
  const options = { routes: [], timeoutSeconds: 120 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--route', '--artifacts-dir', '--timeout-seconds'].includes(arg)) {
      if (!argv[index + 1]) throw new Error(`missing value for ${arg}`);
      if (arg === '--route') options.routes.push(argv[index + 1]);
      else if (arg === '--artifacts-dir') options.artifactsDir = argv[index + 1];
      else options.timeoutSeconds = Number(argv[index + 1]);
      index += 1;
    } else throw new Error(`unsupported option ${arg}`);
  }
  if (!Number.isInteger(options.timeoutSeconds) || options.timeoutSeconds < 1) throw new Error('--timeout-seconds must be a positive integer');
  if (options.routes.some((route) => !ROUTES.includes(route))) throw new Error(`--route must be one of ${ROUTES.join(', ')}`);
  if (options.routes.length === 0) options.routes = [...ROUTES];
  return options;
}

function run(binary, args, input, timeoutMs, cwd = tmpdir(), env = process.env) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(binary, args, { cwd, env: { ...env }, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) { resolve({ code: null, timedOut: false, stdout: '', stderr: error.message }); return; }
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => stderr.push(Buffer.from(error.message)));
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, timedOut, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
    child.stdin.end(input);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function codexCanary(directory, timeoutMs) {
  const schema = path.join(directory, 'schema.json');
  const final = path.join(directory, 'final.json');
  await writeFile(schema, `${JSON.stringify({ type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string', const: 'hello world' } } }, null, 2)}\n`, { mode: 0o600 });
  const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--strict-config', '--model', 'gpt-5.6-sol', '-c', 'model_reasoning_effort="high"', '--output-schema', schema, '--json', '--output-last-message', final, '--color', 'never', '--cd', directory, '-'];
  const result = await run('codex', args, 'Return {"message":"hello world"} exactly.\n', timeoutMs, directory);
  await writeFile(path.join(directory, 'events.jsonl'), result.stdout, { mode: 0o600 });
  await writeFile(path.join(directory, 'stderr.log'), result.stderr, { mode: 0o600 });
  assert(result.code === 0 && !result.timedOut, `Codex failed: ${result.stderr || `exit ${result.code}`}`);
  const output = JSON.parse(await readFile(final, 'utf8'));
  assert(output.message === 'hello world', 'Codex schema output mismatch');
  const observed = [];
  for (const line of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      for (const value of [event.model, event.response?.model, event.turn?.model]) if (typeof value === 'string') observed.push(value);
    } catch {}
  }
  assert(observed.every((model) => model === 'gpt-5.6-sol'), `Codex contradicted requested model: ${observed.join(', ')}`);
  return { requested_model: 'gpt-5.6-sol', effort: 'high', observed_models: [...new Set(observed)], attestation: observed.length ? 'server_observed' : 'requested_accepted', exit_code: result.code };
}

async function claudeCanary(directory, model, timeoutMs) {
  const schema = JSON.stringify({ type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string', const: 'hello world' } } });
  const settings = model === 'claude-fable-5' ? ['--settings', '{"switchModelsOnFlag":true}'] : [];
  const args = ['--print', '--model', model, '--effort', 'high', '--safe-mode', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--permission-mode', 'plan', '--no-session-persistence', '--max-turns', '4', '--disable-slash-commands', '--no-chrome', ...settings, '--json-schema', schema, '--output-format', 'json', '--max-budget-usd', '1.00'];
  const env = { ...process.env };
  for (const key of ['CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK', 'ANTHROPIC_MODEL', 'CLAUDE_MODEL', 'CLAUDE_CODE_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']) delete env[key];
  const versionResult = await run('claude', ['--version'], '', Math.min(timeoutMs, 10_000), directory, env);
  assert(versionResult.code === 0, `${model} version probe failed: ${versionResult.stderr}`);
  const result = await run('claude', args, 'Return {"message":"hello world"} exactly.\n', timeoutMs, directory, env);
  await writeFile(path.join(directory, 'output.json'), result.stdout, { mode: 0o600 });
  await writeFile(path.join(directory, 'stderr.log'), result.stderr, { mode: 0o600 });
  assert(result.code === 0 && !result.timedOut, `${model} failed: ${result.stderr || `exit ${result.code}`}`);
  const outer = JSON.parse(result.stdout);
  assert(outer.structured_output?.message === 'hello world', `${model} schema output mismatch`);
  const allObserved = Object.keys(outer.modelUsage || {});
  const primaryObserved = allObserved.filter((entry) => !ALLOWED_CLAUDE_AUXILIARY.has(entry));
  assert(primaryObserved.length === 1 && primaryObserved[0] === model, `${model} effective model mismatch: ${primaryObserved.join(', ')}`);
  return { requested_model: model, effort: 'high', observed_models: allObserved, attestation: 'server_observed', cli_version: versionResult.stdout.trim(), settings_key_accepted: model === 'claude-fable-5' ? 'switchModelsOnFlag' : null, inherited_model_controls_scrubbed: true, exit_code: result.code, total_cost_usd: outer.total_cost_usd ?? null };
}

async function agyCanary(directory, timeoutSeconds) {
  const dispatcher = path.join(ROOT, 'skills/research/scripts/dispatch-agy.mjs');
  const result = await run(process.execPath, [dispatcher, '--stdin', '--model', 'Gemini 3.5 Flash (High)', '--timeout-seconds', String(timeoutSeconds), '--artifacts-dir', directory], 'Reply with exactly: hello world\n', (timeoutSeconds + 15) * 1000, directory);
  assert(result.code === 0 && !result.timedOut, `AGY failed: ${result.stderr || `exit ${result.code}`}`);
  assert(result.stdout.trim() === 'hello world', `AGY output mismatch: ${result.stdout.trim()}`);
  const receipt = JSON.parse(await readFile(path.join(directory, 'receipt.json'), 'utf8'));
  return { requested_model: receipt.requested_model, effort: null, observed_models: [], attestation: receipt.model_attestation.level, exit_code: result.code };
}

let options;
try { options = parseArgs(process.argv.slice(2)); }
catch (error) { process.stderr.write(`${error.message}\n${usage()}\n`); process.exit(2); }
if (options.help) { process.stdout.write(`${usage()}\n`); process.exit(0); }
if (process.env.SVC_ALLOW_PAID_MODEL_CANARY !== '1') {
  process.stderr.write(`live-model-canary: paid calls are disabled; set SVC_ALLOW_PAID_MODEL_CANARY=1 explicitly\n`);
  process.exit(2);
}

const artifactsRoot = options.artifactsDir ? path.resolve(options.artifactsDir) : await mkdtemp(path.join(tmpdir(), 'svc-live-model-canary-'));
await mkdir(artifactsRoot, { recursive: true, mode: 0o700 });
const summary = { schema_version: 1, started_at: new Date().toISOString(), timeout_seconds: options.timeoutSeconds, production_review_timeout_seconds: 1200, routes: {}, artifacts_dir: artifactsRoot };
let failed = false;
for (const route of options.routes) {
  const directory = path.join(artifactsRoot, route);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    if (route === 'codex') summary.routes[route] = { status: 'pass', ...(await codexCanary(directory, options.timeoutSeconds * 1000)) };
    else if (route === 'fable') summary.routes[route] = { status: 'pass', ...(await claudeCanary(directory, 'claude-fable-5', options.timeoutSeconds * 1000)) };
    else if (route === 'opus') summary.routes[route] = { status: 'pass', ...(await claudeCanary(directory, 'claude-opus-4-8', options.timeoutSeconds * 1000)) };
    else summary.routes[route] = { status: 'pass', ...(await agyCanary(directory, options.timeoutSeconds)) };
  } catch (error) {
    failed = true;
    summary.routes[route] = { status: 'fail', error: error.message };
  }
}
summary.finished_at = new Date().toISOString();
await writeFile(path.join(artifactsRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (failed) process.exitCode = 1;
