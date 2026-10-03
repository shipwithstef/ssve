#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const stateRoot = () => path.resolve(process.env.ORCH_STATE_DIR || path.join(os.homedir(), '.local/state/orch'));
export const digest = value => createHash('sha256').update(value).digest('hex');
export const iso = () => new Date().toISOString();
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const bootId = () => fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
export const configRoot = () => path.resolve(process.env.ORCH_CONFIG_DIR || path.join(os.homedir(), '.config/orch'));
export const isMain = url => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url);
export function init(root = stateRoot()) {
  for (const dir of ['', 'tasks', 'logs', 'locks', 'requests', 'cache']) fs.mkdirSync(path.join(root, dir), { recursive: true, mode: 0o700 });
}
export function atomicJson(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  const dir = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
export function taskPath(id, root = stateRoot()) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(id)) throw new Error('Invalid task id');
  return path.join(root, 'tasks', `${id}.json`);
}
export function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Expected --option value: ${key}`);
    result[key.slice(2).replaceAll('-', '_')] = args[++i];
  }
  return result;
}
export function number(value, name, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be positive`);
  return n;
}
export function procIdentity(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (fields[0] === 'Z') return null;
    return { pid: Number(pid), boot_id: fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(), start_ticks: fields[19], process_group: Number(fields[2]), cmdline: fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean) };
  } catch { return null; }
}
export function sameProcess(identity) {
  if (!identity) return false;
  const live = procIdentity(identity.pid);
  return !!live && live.boot_id === identity.boot_id && live.start_ticks === identity.start_ticks && JSON.stringify(live.cmdline) === JSON.stringify(identity.cmdline);
}
export function lockPath(worktree, root = stateRoot()) { return path.join(root, 'locks', `${digest(fs.realpathSync(worktree))}.lock`); }
export function lockBusy(file) {
  const result = spawnSync('flock', ['-n', '-E', '75', file, 'true'], { timeout: 2000 });
  if (result.error || ![0, 75].includes(result.status)) throw new Error('Cannot verify kernel lock');
  return result.status === 75;
}
// flock(2) owns the shared open-file description. The child locks inherited
// fd 3; this process retains the original fd until the operation completes.
// Stable inodes are never deleted; crash/reboot closes descriptors automatically.
export async function withLocks(files, operation) {
  const descriptors = [];
  try {
    for (const file of files) {
      const fd = fs.openSync(file, 'a', 0o600); descriptors.push(fd);
      const result = spawnSync('flock', ['-n', '-E', '75', '3'], { stdio: ['ignore', 'ignore', 'pipe', fd], timeout: 2000 });
      if (result.error || result.status !== 0) throw new Error(result.status === 75 ? 'Writer lock busy' : 'Cannot acquire kernel lock');
    }
    return await operation();
  } finally { for (const fd of descriptors.reverse()) fs.closeSync(fd); }
}
export function git(worktree, args) {
  const r = spawnSync('git', ['-C', worktree, ...args], { encoding: 'utf8', timeout: 5000, maxBuffer: 128 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
}
export function canonicalWorktree(value) {
  const worktree = fs.realpathSync(value);
  const top = git(worktree, ['rev-parse', '--show-toplevel']);
  if (!top || fs.realpathSync(top) !== worktree) throw new Error('Expected exact Git worktree root');
  return worktree;
}
export function redact(value, limit = 240) {
  return String(value ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/(?:Bearer\s+)[^\s"']+/gi, 'Bearer [redacted]').replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]+/g, '[redacted]').replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;"']+/gi, '$1[redacted]').slice(0, limit);
}
export function streamEvent(e, cli) {
  if (!e || typeof e !== 'object') return null;
  const type = e.type || e.event || 'unknown';
  const session_id = cli === 'codex' ? e.thread_id : cli === 'cursor' ? e.session_id : cli === 'claude' ? e.session_id : e.conversation_id || e.step_update?.conversation_id || e.result?.conversation_id;
  let summary = type;
  let completion_report = null, terminal = null, usage = null;
  if (e.item?.type === 'command_execution') summary = `command ${e.type === 'item.completed' ? `exited ${e.item.exit_code ?? 'unknown'}` : 'started'}: ${redact(e.item.command, 160)}`;
  else if (e.item?.type === 'agent_message') { completion_report = e.item.text; summary = `reported: ${redact(completion_report, 200)}`; }
  else if (type === 'assistant') { completion_report = e.message?.content?.filter(x => x.type === 'text').map(x => x.text).join('\n'); summary = `reported: ${redact(completion_report, 200)}`; }
  else if (type === 'tool_call') summary = `tool ${e.subtype || 'event'}: ${Object.keys(e.tool_call || {}).find(x => x.endsWith('ToolCall')) || 'unknown'}`;
  else if (type === 'step_update') { summary = `${e.step_update?.step_type || 'step'} ${e.step_update?.state || 'updated'}`; if (e.step_update?.step_type === 'agent_response' && e.step_update.text_delta) completion_report = e.step_update.text_delta; }
  if (type === 'turn.completed') { terminal = 'done'; usage = e.usage; }
  if (type === 'turn.failed' || type === 'error') { terminal = 'failed'; summary = `error: ${redact(e.error?.message || e.message || type)}`; }
  if (type === 'result') {
    const r = cli === 'agy' ? e.result : e;
    terminal = r?.is_error || (cli === 'agy' && r?.status !== 'SUCCESS') || (cli === 'cursor' && r?.subtype !== 'success') ? 'failed' : 'done';
    completion_report = r?.response || r?.result; usage = r?.usage; summary = `result ${terminal} (reported)`;
  }
  if (type === 'thinking' || type === 'user') summary = null;
  if (usage) usage = { ...Object.fromEntries(['total_tokens', 'cache_write_tokens', 'subscription_units', 'known_charge'].filter(k => typeof usage[k] === 'number' && Number.isFinite(usage[k]) && usage[k] >= 0).map(k => [k, usage[k]])), input_tokens: usage.input_tokens ?? usage.inputTokens ?? null, output_tokens: usage.output_tokens ?? usage.outputTokens ?? null, cached_tokens: usage.cached_input_tokens ?? usage.cache_read_tokens ?? usage.cacheReadTokens ?? null, source: 'worker_stream' };
  return { session_id: session_id || null, summary, completion_report: completion_report ? redact(completion_report, 16000) : null, terminal, usage, resolved_model: e.model || null };
}
export function ingestLines(text, cli, cache = {}) {
  const events = cache.events_last_3 || [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { cache.malformed_lines = (cache.malformed_lines || 0) + 1; continue; }
    const normalized = streamEvent(e, cli);
    if (!normalized) continue;
    for (const key of ['session_id', 'completion_report', 'terminal', 'usage', 'resolved_model']) if (normalized[key]) cache[key] = normalized[key];
    if (normalized.summary) { events.push(normalized.summary); if (events.length > 3) events.shift(); }
  }
  cache.events_last_3 = events;
  return cache;
}
