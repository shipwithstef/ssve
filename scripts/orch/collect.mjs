#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stateRoot, init, atomicJson, readJson, taskPath, options, number, canonicalWorktree, procIdentity, git, digest, ingestLines, iso, isMain, redact, withLocks, bootId } from './common.mjs';
const self = fileURLToPath(import.meta.url);
const CHUNK = 1024 * 1024;

export function readStream(file, cli, cache = {}) {
  const stat = fs.statSync(file);
  const identity = `${stat.dev}:${stat.ino}`;
  if (cache.identity !== identity || stat.size < (cache.offset || 0)) cache = { identity, offset: 0, events_last_3: [], rotated: !!cache.identity };
  const fd = fs.openSync(file, 'r'); const bytes = Buffer.alloc(Math.min(CHUNK, stat.size - cache.offset));
  let count; try { count = fs.readSync(fd, bytes, 0, bytes.length, cache.offset); } finally { fs.closeSync(fd); }
  const end = bytes.subarray(0, count).lastIndexOf(10);
  if (end >= 0) { const first = cache.skip_line ? bytes.subarray(0, count).indexOf(10) + 1 : 0; ingestLines(bytes.subarray(first, end).toString('utf8'), cli, cache); cache.offset += end + 1; }
  else if (count === CHUNK) { cache.offset += count; cache.oversized_lines = (cache.oversized_lines || 0) + 1; cache.skip_line = true; }
  // Do not parse a truncated remainder as a fresh event after an oversized line.
  if (cache.skip_line && end >= 0) cache.skip_line = false;
  if (cache.size !== stat.size || !cache.last_progress_at) cache.last_progress_at = new Date(stat.mtimeMs).toISOString();
  cache.backlog_bytes = Math.max(0, stat.size - cache.offset);
  cache.size = stat.size;
  return cache;
}
function recentTail(file, cli) {
  const stat = fs.statSync(file); const start = Math.max(0, stat.size - 65536);
  const fd = fs.openSync(file, 'r'); const bytes = Buffer.alloc(stat.size - start);
  let count; try { count = fs.readSync(fd, bytes, 0, bytes.length, start); } finally { fs.closeSync(fd); }
  const data = bytes.subarray(0, count); const end = data.lastIndexOf(10);
  const begin = start ? data.indexOf(10) + 1 : 0;
  if (end < begin) return {};
  return ingestLines(data.subarray(begin, end).toString('utf8'), cli);
}
export function classify(task, observation, now = Date.now(), stalledMinutes = 5) {
  // exec()/process-title changes do not end an attempt. Observation never grants
  // signal authority; a matching live process always outranks terminal metadata.
  if (observation.alive) {
    if (now - Date.parse(observation.last_progress_at || task.started_at) >= stalledMinutes * 60000) return 'stalled';
    return 'running';
  }
  if (task.state === 'needs_owner' || task.state === 'interrupted') return task.state;
  if (task.exit_code == null) return observation.completion_report ? 'done (unverified exit)' : 'exited (unknown)';
  if (task.state === 'timeout' || [124, 137].includes(task.exit_code) && now >= Date.parse(task.deadline_at)) return 'timeout';
  if (task.finished_at) return task.exit_code === 0 && task.state === 'done' && observation.terminal !== 'failed' ? 'done' : 'failed';
  return task.exit_code === 0 && observation.terminal !== 'failed' ? 'done' : 'failed';
}
export function observedAlive(identity) {
  if (!identity) return false;
  const live = procIdentity(identity.pid);
  return !!live && live.boot_id === identity.boot_id && live.start_ticks === identity.start_ticks;
}
function gitSnapshot(worktree) {
  const status = git(worktree, ['status', '--porcelain=v1']);
  const diffstat = git(worktree, ['diff', '--no-ext-diff', '--no-textconv', '--stat']);
  const staged_diffstat = git(worktree, ['diff', '--no-ext-diff', '--no-textconv', '--cached', '--stat']);
  const counts = git(worktree, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
  return { branch: git(worktree, ['branch', '--show-current']), head_sha: git(worktree, ['rev-parse', 'HEAD']), status, diffstat, staged_diffstat, ahead: counts === null ? null : Number(counts.split(/\s+/)[0]), behind: counts === null ? null : Number(counts.split(/\s+/)[1]) };
}
function completionFile(task) {
  const candidates = [...new Set([task.id, task.id[0].toUpperCase() + task.id.slice(1), task.id.toUpperCase()])].map(id => path.join(task.worktree, '.worker', `${id}-report.md`));
  const candidate = candidates.find(file => fs.existsSync(file));
  if (!candidate) return null;
  try {
    const real = fs.realpathSync(candidate);
    if (!real.startsWith(task.worktree + path.sep)) return null;
    const stat = fs.statSync(real); if (!stat.isFile()) return null;
    const fd = fs.openSync(real, 'r'); const buffer = Buffer.alloc(Math.min(16384, stat.size));
    try { fs.readSync(fd, buffer, 0, buffer.length, 0); } finally { fs.closeSync(fd); }
    return { path: real, text: redact(buffer.toString('utf8'), 16384), digest: digest(buffer), truncated: stat.size > buffer.length };
  } catch { return null; }
}
export function adopt(o, root = stateRoot()) {
  const id = o.adopt; const file = taskPath(id, root);
  const pid = number(o.pid, 'pid');
  if (!Number.isInteger(pid)) throw new Error('PID must be an integer');
  const identity = procIdentity(pid);
  const worktree = canonicalWorktree(o.worktree);
  const log_path = fs.realpathSync(o.log);
  const prior = readJson(file);
  if (prior && (!prior.adopted || prior.worktree !== worktree || prior.log_path !== log_path || prior.process_identity?.start_ticks !== identity?.start_ticks || prior.process_identity?.boot_id !== identity?.boot_id)) throw new Error('Adoption conflicts with existing task');
  const fd = fs.openSync(log_path, 'r'); const first = Buffer.alloc(16384);
  let count; try { count = fs.readSync(fd, first, 0, first.length, 0); } finally { fs.closeSync(fd); }
  const prefix = first.subarray(0, count).toString('utf8');
  const cli = o.cli || (prefix.includes('\"conversation_id\"') ? 'agy' : prefix.includes('\"thread_id\"') ? 'codex' : 'cursor');
  const cache = readStream(log_path, cli);
  // PIDs supplied by existing shell launchers may be wrappers; never signal them.
  const started_at = prior?.started_at || new Date(fs.statSync(log_path).birthtimeMs).toISOString();
  const task = { schema_version: 1, id, title: o.title || id, goal_id: o.goal || 'novisenti', lane: o.lane || 'M1', description: 'Read-only observation of an externally launched worker', depends_on: [], acceptance: [], adopted: true, read_only: true, state: 'running', attempt_id: `adopt-${id}`, started_at, start_time_basis: 'log_birthtime_approximate', finished_at: null, expected_minutes: o.expected_minutes ? number(o.expected_minutes, 'expected minutes') : null, hard_timeout_ms: null, deadline_at: null, executor: { cli, model: o.model || cache.resolved_model || null, effort: o.effort || cache.resolved_model?.match(/\b(low|medium|high|xhigh|max)\b/i)?.[1]?.toLowerCase() || null, cli_version: null }, pid, process_group: identity?.process_group || null, process_identity: identity, supervisor_pid: null, session_id: cache.session_id || null, worktree, log_path, stderr_path: null, exit_code: null, exit_signal: null, attempt_history: [] };
  atomicJson(file, task);
  return task;
}
export function collect(root = stateRoot(), stalledMinutes = 5) {
  init(root);
  const prior = readJson(path.join(root, 'status.json'), { revision: 0, tasks: [], deltas: [] });
  const now = Date.now(); const warnings = []; const tasks = [];
  for (const name of fs.readdirSync(path.join(root, 'tasks')).filter(x => x.endsWith('.json')).sort()) {
    try {
      const task = readJson(path.join(root, 'tasks', name)); taskPath(task.id, root);
      if (task.schema_version !== 1 || !task.executor || !task.worktree) throw new Error('Invalid task record');
      const cacheFile = path.join(root, 'cache', `${task.id}-${task.attempt_id}.json`);
      let cache = readJson(cacheFile, {});
      const blockers = [];
      try { cache = readStream(task.log_path, task.executor.cli, cache);
        if (cache.backlog_bytes > 0) { const tail = recentTail(task.log_path, task.executor.cli); for (const key of ['session_id', 'completion_report', 'terminal', 'usage', 'resolved_model', 'events_last_3']) if (tail[key]?.length || tail[key] && key !== 'events_last_3') cache[key] = tail[key]; }
        atomicJson(cacheFile, cache); } catch (e) { blockers.push({ code: 'log_unavailable', description: e.message, source: task.log_path, at: iso() }); }
      const alive = observedAlive(task.process_identity);
      const report = completionFile(task);
      const state = classify(task, { ...cache, alive, completion_report: report?.text || cache.completion_report || task.completion_report || (report ? 'Reported completion' : null) }, now, stalledMinutes);
      if (!alive && task.exit_code == null) blockers.push({ code: 'unknown_exit', description: 'No matching live process or durable exit code; outcome unverified', source: 'proc_identity', at: iso() });
      if (state === 'stalled') blockers.push({ code: 'stale_progress', description: `No log growth for ${stalledMinutes} minutes`, source: 'log_mtime', at: iso() });
      if (state === 'timeout') blockers.push({ code: 'hard_timeout', description: 'Hard deadline reached', source: 'dispatcher', at: task.deadline_at });
      if (task.stop_requested) blockers.push({ code: 'stopped', description: 'Owner stopped this attempt', source: 'dispatcher', at: task.finished_at });
      if (task.state === 'needs_owner' || task.state === 'interrupted') blockers.push({ code: 'recovery_hold', description: task.recovery?.reason || 'Interrupted attempt; resume reservation requires reconciliation if no worker appears', source: 'recovery', at: task.recovery?.at });
      if (cache.terminal === 'failed') blockers.push({ code: 'worker_error', description: cache.events_last_3?.at(-1) || 'Worker reported error', source: 'worker_stream', at: cache.last_progress_at });
      const g = gitSnapshot(task.worktree);
      if (g.status === null) blockers.push({ code: 'git_unavailable', description: 'Git inspection failed or exceeded bounds', source: task.worktree, at: iso() });
      const publicTask = { ...task };
      delete publicTask.resume_text;
      for (const key of ['process_identity', 'supervisor_identity']) if (publicTask[key]) { publicTask[key] = { ...publicTask[key] }; delete publicTask[key].cmdline; }
      tasks.push({ ...publicTask, ...g, state, design_state: alive ? state : state.startsWith('done') ? 'awaiting_verification' : task.exit_code == null ? 'unknown' : task.stop_requested ? 'stopped' : state === 'timeout' ? 'timed_out' : state, session_id: task.session_id || cache.session_id || null, elapsed_ms: Math.max(0, (!alive && task.finished_at ? Date.parse(task.finished_at) : now) - Date.parse(task.started_at)), elapsed_basis: 'wall_clock_approximate', estimate_ms: { low: task.expected_minutes === null ? null : task.expected_minutes * 60000, high: task.expected_minutes === null ? null : task.expected_minutes * 60000, basis: task.expected_minutes === null ? 'unknown' : 'owner_estimate' }, last_progress_at: cache.last_progress_at || null, last_event_summary: cache.events_last_3?.at(-1) || null, events_last_3: cache.events_last_3 || [], blockers, artifacts: report ? [{ path: report.path, kind: 'completion_report', digest: report.digest, digest_basis: report.truncated ? 'first_16KiB' : 'entire_file' }] : [], completion_report_ref: report?.path || null, completion_report: report ? report.text : cache.completion_report || task.completion_report || null, completion_report_provenance: report ? 'worker_file_reported' : 'worker_stream_reported', verification_state: 'unverified', health: state === 'stalled' ? 'stale_progress' : alive ? 'live_process' : 'not_running', usage: cache.usage || task.usage || { input_tokens: null, output_tokens: null, cached_tokens: null, source: 'unknown' }, cost_so_far: { known_amount: null, currency: null, unknown_components: ['subscription attribution', 'provider billing'], source: 'unknown', as_of: iso() }, stream: { offset: cache.offset || 0, backlog_bytes: cache.backlog_bytes || 0, malformed_lines: cache.malformed_lines || 0, rotated: cache.rotated || false } });
    } catch (e) { warnings.push({ code: 'task_read_error', path: name, description: e.message }); }
  }
  const goals = [];
  for (const task of tasks) {
    let goal = goals.find(x => x.id === task.goal_id); if (!goal) { goal = { id: task.goal_id, title: task.goal_id, lanes: [] }; goals.push(goal); }
    let lane = goal.lanes.find(x => x.id === task.lane); if (!lane) { lane = { id: task.lane, title: task.lane, tasks: [] }; goal.lanes.push(lane); } lane.tasks.push(task);
  }
  const changed_task_ids = tasks.filter(t => { const p = prior.tasks.find(x => x.id === t.id); return !p || p.state !== t.state || p.attempt_id !== t.attempt_id || p.last_progress_at !== t.last_progress_at || p.head_sha !== t.head_sha || p.status !== t.status; }).map(t => t.id);
  const revision = prior.revision + 1;
  const delta = { revision, at: iso(), task_ids: changed_task_ids };
  const recovery = readJson(path.join(root, `recovery-${bootId()}.json`));
  const checkpoint = readJson(path.join(root, 'checkpoint.json'));
  const status = { schema_version: 1, goal_id: goals.length === 1 ? goals[0].id : 'all', run_id: prior.run_id || `collector-${now}`, revision, generated_at: iso(), collector_heartbeat_at: iso(), recovery, checkpoint, plan: { path: null, revision: null, hash: null, specs_path: null, specs_hash: null }, goals, tasks, changed_task_ids, changes_since_revision: prior.revision, deltas: [...(prior.deltas || []), delta].slice(-200), warnings };
  atomicJson(path.join(root, 'status.json'), status);
  return status;
}
async function lockedInvocation(o) {
  const root = stateRoot(); init(root);
  const args = ['-n', '-E', '75', path.join(root, 'locks', 'collector.lock'), process.execPath, self, '__locked', JSON.stringify(o)];
  const code = await new Promise((resolve, reject) => { const child = spawn('flock', args, { stdio: 'inherit' }); child.on('error', reject); child.on('exit', resolve); });
  if (code !== 0) throw new Error(code === 75 ? 'Collector already writing' : `Collector failed (${code})`);
}
export async function main(args = process.argv.slice(2)) {
  if (args[0] === '__locked') { const o = JSON.parse(args[1]); if (o.adopt) adopt(o); const status = collect(stateRoot(), number(o.stalled_minutes, 'stalled minutes', 5)); console.log(JSON.stringify({ revision: status.revision, tasks: status.tasks.length, warnings: status.warnings })); return; }
  const o = options(args);
  if (o.watch && o.adopt) throw new Error('Adopt once before starting watch');
  if (!o.watch) { await lockedInvocation(o); return; }
  const root = stateRoot(); init(root);
  const interval = number(o.watch, 'watch seconds') * 1000;
  let wake, stopping = false, pendingFlush = false;
  const flush = () => { pendingFlush = true; wake?.(); };
  const stop = () => { stopping = true; wake?.(); };
  process.on('SIGUSR1', flush); process.on('SIGTERM', stop); process.on('SIGINT', stop);
  try {
    await withLocks([path.join(root, 'locks', 'collector.lock')], async () => {
      atomicJson(path.join(root, 'collector.json'), { identity: procIdentity(process.pid), started_at: iso() });
      do {
        pendingFlush = false;
        const status = collect(root, number(o.stalled_minutes, 'stalled minutes', 5));
        console.log(JSON.stringify({ revision: status.revision, tasks: status.tasks.length, warnings: status.warnings }));
        if (stopping) break;
        await new Promise(resolve => { const timer = setTimeout(done, pendingFlush ? 0 : interval); function done() { clearTimeout(timer); wake = null; resolve(); } wake = done; });
      } while (!stopping);
      collect(root, number(o.stalled_minutes, 'stalled minutes', 5));
    });
  } finally { process.off('SIGUSR1', flush); process.off('SIGTERM', stop); process.off('SIGINT', stop); }
}
if (isMain(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
