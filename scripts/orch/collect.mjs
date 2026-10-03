#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stateRoot, init, atomicJson, readJson, taskPath, options, number, canonicalWorktree, procIdentity, git, digest, ingestLines, iso, isMain, redact, withLocks, bootId, sameProcess, configRoot } from './common.mjs';
import { readRegistry, goalUsage, reportedUsage } from './goals.mjs';
import { recoverySessions, binding } from './sessions.mjs';
import { parentResume } from './recover.mjs';
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
    if (task.state === 'interrupting' || task.state === 'interrupted') return task.state;
    if (now - Date.parse(observation.last_progress_at || task.started_at) >= stalledMinutes * 60000) return 'stalled';
    return 'running';
  }
  if (['needs_owner', 'interrupted', 'interrupting', 'stopped'].includes(task.state)) return task.state;
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
export function collect(root = stateRoot(), stalledMinutes = 5, config = configRoot()) {
  init(root);
  const prior = readJson(path.join(root, 'status.json'), { revision: 0, tasks: [], deltas: [] });
  const registry = readRegistry(root); // Fail closed; preserve last valid status on corrupt authority.
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
      const publicKeys = ['schema_version', 'id', 'title', 'goal_id', 'lane', 'description', 'depends_on', 'acceptance', 'executor', 'worktree', 'session_id', 'adopted', 'read_only', 'state', 'attempt_id', 'started_at', 'finished_at', 'deadline_at', 'expected_minutes', 'hard_timeout_ms', 'memory_cap', 'exit_code', 'exit_signal', 'stop_requested', 'unit', 'pid', 'process_group', 'supervisor_pid', 'process_identity', 'supervisor_identity', 'log_path', 'stderr_path', 'events_path', 'last_heartbeat_at', 'goal_generation', 'registry_revision'];
      if (task.steering_blocker) blockers.push({ code: 'steering_hold', description: redact(task.steering_blocker, 1200), source: 'dispatcher' });
      const publicTask = Object.fromEntries(publicKeys.filter(key => key in task).map(key => [key, task[key]]));
      publicTask.steering = task.steering || { mode: 'queue', reason: 'Legacy attempt; stdin unavailable' };
      publicTask.queued_steers = (task.steer_queue || []).map(e => ({ id: e.id, at: e.at, text: redact(e.text, 8192) }));
      publicTask.steer_deliveries = (task.steer_deliveries || []).map(e => ({ id: e.id, attempt_id: e.attempt_id, mode: e.mode, state: e.state, claimed_at: e.claimed_at }));
      publicTask.reservation_active = !task.adopted && (alive || !task.finished_at && ['queued', 'running', 'stalled'].includes(task.state));
      publicTask.attempt_history = (task.attempt_history || []).map(a => ({ attempt_id: a.attempt_id, started_at: a.started_at, finished_at: a.finished_at, state: a.state, log_path: a.log_path, exit_code: a.exit_code, usage: reportedUsage(a.usage) }));
      for (const key of ['title', 'description']) publicTask[key] = redact(publicTask[key], 16000);
      for (const key of ['process_identity', 'supervisor_identity']) if (publicTask[key]) { publicTask[key] = { ...publicTask[key] }; delete publicTask[key].cmdline; }
      tasks.push({ ...publicTask, ...g, state, design_state: alive ? state : state.startsWith('done') ? 'awaiting_verification' : task.exit_code == null ? 'unknown' : task.stop_requested ? 'stopped' : state === 'timeout' ? 'timed_out' : state, session_id: task.session_id || cache.session_id || null, elapsed_ms: Math.max(0, (!alive && task.finished_at ? Date.parse(task.finished_at) : now) - Date.parse(task.started_at)), elapsed_basis: 'wall_clock_approximate', estimate_ms: { low: task.expected_minutes === null ? null : task.expected_minutes * 60000, high: task.expected_minutes === null ? null : task.expected_minutes * 60000, basis: task.expected_minutes === null ? 'unknown' : 'owner_estimate' }, last_progress_at: cache.last_progress_at || null, last_event_summary: cache.events_last_3?.at(-1) || null, events_last_3: cache.events_last_3 || [], blockers, artifacts: report ? [{ path: report.path, kind: 'completion_report', digest: report.digest, digest_basis: report.truncated ? 'first_16KiB' : 'entire_file' }] : [], completion_report_ref: report?.path || null, completion_report: report ? report.text : cache.completion_report || task.completion_report || null, completion_report_provenance: report ? 'worker_file_reported' : 'worker_stream_reported', verification_state: 'unverified', health: state === 'stalled' ? 'stale_progress' : alive ? 'live_process' : 'not_running', usage: cache.usage || task.usage || { input_tokens: null, output_tokens: null, cached_tokens: null, source: 'unknown' }, cost_so_far: { known_amount: null, currency: null, unknown_components: ['subscription attribution', 'provider billing'], source: 'unknown', as_of: iso() }, stream: { offset: cache.offset || 0, backlog_bytes: cache.backlog_bytes || 0, malformed_lines: cache.malformed_lines || 0, rotated: cache.rotated || false } });
    } catch (e) { warnings.push({ code: 'task_read_error', path: name, description: e.message }); }
  }
  const orchestrators = recoverySessions(root, registry);
  // Recheck compatibility on every projection, including a binding changed
  // since the last boot receipt. Never expose a stale parent's executable hint.
  const legacy = parentResume(config);
  if (registry && fs.existsSync(path.join(config, 'parent-session')) && (!legacy.session_id || legacy.session_id !== registry.parent.session_id)) {
    for (const entry of orchestrators.filter(s => s.role === 'parent')) {
      entry.attach_command = null; entry.resume_command = null;
      entry.reason = 'parent-session differs from goals.json; reconcile owner binding, do not rebind';
    }
  }
  const goals = (registry?.goals || []).map(goal => {
    const child = { session_id: goal.child.session_id, generation: goal.generation, effort: goal.child.effort, state: 'needs_owner', health: 'unobserved', last_heartbeat_at: null, attention_pending: false };
    const blockers = [];
    try {
      const session = readJson(path.join(root, 'sessions', `child-${goal.id}.json`));
      if (!session) throw new Error('Child has no supervised session observation');
      binding({ role: 'child', goal: goal.id, generation: session.generation, session_id: session.session_id, principal: session.principal, worktree: session.worktree, contract: session.contract }, root);
      if (session.session_id !== child.session_id || session.generation !== child.generation || session.effort !== 'low' || session.state === 'released') throw new Error('Stale/released child observation or LOW mismatch');
      child.last_heartbeat_at = session.last_heartbeat_at;
      const alive = sameProcess(session.supervisor_identity) && sameProcess(session.process_identity);
      const age = now - Date.parse(session.last_heartbeat_at);
      child.health = !alive ? 'native_ownership_unverified' : !Number.isFinite(age) || age > 45000 || age < -60000 ? 'suspected_loss' : 'live';
      child.state = alive && child.health === 'live' && session.state === 'idle' ? 'idle' : 'needs_owner';
      if (child.state === 'needs_owner') blockers.push({ code: 'needs_owner', description: redact(session.blocker || 'Reconcile child native ownership; heartbeat alone never authorizes restart', 1200) });
      // Read the durable cursor directly even when its supervisor was lost.
      const cursor = readJson(path.join(root, 'events', `child-${goal.id}.json`));
      const wake = cursor?.generation === goal.generation && cursor.session_id === child.session_id && cursor.launch_nonce === session.launch_nonce ? cursor : session.wake_cursor;
      child.attention_pending = !!wake?.attention_pending;
      // Pending delivery is health metadata, not a new actionable blocker that
      // would feed its own enqueue/ack transitions back into another wake.
      if (wake?.blocker) blockers.push({ code: 'attention_pending', description: redact(wake.blocker, 1200) });
    } catch (e) { blockers.push({ code: 'needs_owner', description: redact(e.message, 1200) }); }
    for (const task of tasks.filter(t => t.goal_id === goal.id)) for (const b of task.blockers.filter(b => b.code === 'recovery_hold')) blockers.push({ code: 'needs_owner', description: `${task.id}: ${b.description}` });
    const usage = goalUsage(goal.id, root, tasks);
    if (goal.budget.claude_turn_cap == null || usage.claude.turns == null) blockers.push({ code: 'budget_unknown', description: 'Claude turn allowance/usage unknown; reconcile before new child dispatch' });
    else if (usage.claude.turns >= goal.budget.claude_turn_cap) blockers.push({ code: 'budget_exhausted', description: 'Claude turn cap exhausted; parent allocation required' });
    for (const cli of ['codex', 'cursor', 'agy', ...(goal.budget.worker_caps.claude ? ['claude'] : [])]) {
      const cap = goal.budget.worker_caps[cli]?.runs;
      if (cap == null) blockers.push({ code: 'budget_unknown', description: `${cli} run allowance unknown; parent must configure cap` });
      else if (cap > 0 && usage.workers[cli].attempts >= cap) blockers.push({ code: 'budget_exhausted', description: `${cli} run cap exhausted; parent allocation required` });
    }
    return { id: goal.id, title: redact(goal.title), priority: goal.priority, desired_state: goal.desired_state,
      observed_state: goal.desired_state === 'active' ? child.state === 'idle' ? 'active' : 'needs_owner' : goal.desired_state, child, budget: goal.budget, usage,
      reserved: { claude_turns: null, worker_runs: Object.fromEntries(['codex', 'cursor', 'agy'].map(cli => [cli, tasks.filter(t => t.goal_id === goal.id && t.executor.cli === cli && t.reservation_active).length])) },
      remaining: { claude_turns: goal.budget.claude_turn_cap == null || usage.claude.turns == null ? null : Math.max(0, goal.budget.claude_turn_cap - usage.claude.turns),
        worker_runs: Object.fromEntries(['codex', 'cursor', 'agy'].map(cli => [cli, goal.budget.worker_caps[cli]?.runs == null ? null : Math.max(0, goal.budget.worker_caps[cli].runs - usage.workers[cli].attempts)])) },
      blockers, recovery: orchestrators.find(s => s.role === 'child' && s.goal_id === goal.id) || null, lanes: [] };
  });
  for (const task of tasks) {
    let goal = goals.find(x => x.id === task.goal_id);
    if (!goal) {
      goal = { id: task.goal_id, title: task.goal_id, priority: null, desired_state: null, observed_state: 'orphan', child: null, budget: null, usage: goalUsage(task.goal_id, root, tasks),
        blockers: [{ code: 'goal_ownership_missing', description: 'Task goal is absent from goals.json' }], lanes: [] }; goals.push(goal);
    }
    let lane = goal.lanes.find(x => x.id === task.lane); if (!lane) { lane = { id: task.lane, title: task.lane, tasks: [] }; goal.lanes.push(lane); } lane.tasks.push(task);
  }
  goals.sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
  // Elapsed wall time is display-only and must not cause a goal change/wake every tick.
  const signature = g => JSON.stringify({ id: g.id, title: g.title, priority: g.priority, desired_state: g.desired_state, observed_state: g.observed_state, child: g.child && { session_id: g.child.session_id, generation: g.child.generation, effort: g.child.effort, state: g.child.state, health: g.child.health, attention_pending: g.child.attention_pending }, budget: g.budget, blockers: g.blockers,
    claude: g.usage.claude, attempts: Object.fromEntries(Object.entries(g.usage.workers).map(([cli, w]) => [cli, w.attempts])) });
  const changed_goal_ids = goals.filter(g => { const old = prior.goals?.find(x => x.id === g.id); return !old || !old.usage || signature(old) !== signature(g); }).map(g => g.id);
  for (const old of prior.goals || []) if (!goals.some(g => g.id === old.id)) changed_goal_ids.push(old.id);
  const changed_task_ids = tasks.filter(t => { const p = prior.tasks.find(x => x.id === t.id); return !p || p.state !== t.state || p.attempt_id !== t.attempt_id || p.last_progress_at !== t.last_progress_at || p.head_sha !== t.head_sha || p.status !== t.status; }).map(t => t.id);
  const revision = prior.revision + 1;
  const delta = { revision, at: iso(), task_ids: changed_task_ids, goal_ids: changed_goal_ids };
  const receipt = readJson(path.join(root, `recovery-${bootId()}.json`));
  const recovery = receipt && { ...receipt, orchestrators };
  if (recovery && registry) recovery.parent = recovery.orchestrators.find(s => s.role === 'parent') || { state: 'needs_owner', resume_command: null, auto_start: false, reason: 'Parent not bound in registry' };
  const checkpoint = readJson(path.join(root, 'checkpoint.json'));
  const status = { schema_version: 1, goal_id: goals.length === 1 ? goals[0].id : 'all', run_id: prior.run_id || `collector-${now}`, revision, registry_revision: registry?.revision ?? null, changed_goal_ids, generated_at: iso(), collector_heartbeat_at: iso(), recovery, orchestrators: recovery?.orchestrators || orchestrators, checkpoint, plan: { path: null, revision: null, hash: null, specs_path: null, specs_hash: null }, goals, tasks, changed_task_ids, changes_since_revision: prior.revision, deltas: [...(prior.deltas || []), delta].slice(-200), warnings };
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
