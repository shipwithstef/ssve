#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { stateRoot, init, atomicJson, readJson, taskPath, options, number, canonicalWorktree, lockPath, procIdentity, sameProcess, iso, sleep, ingestLines, isMain, bootId } from './common.mjs';
import { admitTask } from './goals.mjs';
const self = fileURLToPath(import.meta.url);

export function workerCommand(task, prompt, resume = false) {
  const { cli, model, effort } = task.executor;
  if (resume && !task.session_id) throw new Error('No recorded session id; resume unavailable');
  if (cli === 'codex') return ['codex', 'exec', ...(resume ? ['resume', task.session_id] : []), '--json', '--dangerously-bypass-approvals-and-sandbox', '-m', model, '-c', `model_reasoning_effort=${JSON.stringify(effort)}`, prompt];
  if (cli === 'cursor') {
    let resolved = model;
    if (model === 'grok-4.7') resolved = `${model}-${effort}`;
    else if (model.startsWith('grok-4.7-') && !model.includes(`-${effort}`)) throw new Error('Cursor model/effort mismatch');
    return ['cursor-agent', ...(resume ? ['--resume', task.session_id] : []), '-p', '--output-format', 'stream-json', '--model', resolved, '--force', '--trust', '--workspace', task.worktree, prompt];
  }
  if (cli === 'agy') return ['agy', ...(resume ? ['--conversation', task.session_id] : []), '-p', prompt, '--output-format', 'stream-json', '--model', model, '--effort', effort, '--dangerously-skip-permissions'];
  throw new Error('cli must be codex, cursor or agy');
}
export function scopeCommand(task, argv) {
  return ['systemd-run', '--user', '--scope', '--quiet', '--expand-environment=no', `--unit=${task.unit}`, '-p', `MemoryMax=${task.memory_cap}`, '-p', 'MemorySwapMax=0', '--', 'timeout', '--signal=TERM', '--kill-after=10s', `${task.hard_timeout_ms / 1000}s`, ...argv];
}
function required(o, key) { if (!o[key]) throw new Error(`Missing --${key.replaceAll('_', '-')}`); return o[key]; }
export function makeTask(o) {
  taskPath(required(o, 'id'));
  const memory_cap = required(o, 'memory_cap');
  if (!/^[1-9][0-9]*(?:[KMGT])?$/.test(memory_cap)) throw new Error('Memory cap must be positive bytes or K/M/G/T');
  const worktree = canonicalWorktree(required(o, 'worktree'));
  const task = { schema_version: 1, id: o.id, title: required(o, 'title'), goal_id: required(o, 'goal'), lane: required(o, 'lane'), description: o.title, depends_on: [], acceptance: [], executor: { cli: required(o, 'cli'), model: required(o, 'model'), effort: required(o, 'effort'), cli_version: null }, worktree, prompt_file: fs.realpathSync(required(o, 'prompt_file')), expected_minutes: number(o.expected_minutes, 'expected minutes'), hard_timeout_ms: number(o.hard_timeout, 'hard timeout seconds') * 1000, resume_text: required(o, 'resume_text'), memory_cap, session_id: null, attempt_history: [], adopted: false };
  if (o.paid !== undefined && !['true', 'false'].includes(o.paid)) throw new Error('--paid must be true or false');
  task.paid = o.paid === 'true';
  for (const key of ['goal_generation', 'child_depth']) if (o[key] != null) { task[key] = Number(o[key]); if (!Number.isSafeInteger(task[key])) throw new Error(`Invalid ${key}`); }
  for (const key of ['child_session', 'child_principal']) if (o[key] != null) task[key] = o[key];
  if (!['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(task.executor.effort)) throw new Error('Invalid effort');
  const command = workerCommand(task, 'validate');
  task.executor.requested_model = task.executor.model;
  task.executor.resolved_model = command[command.indexOf(task.executor.cli === 'codex' ? '-m' : '--model') + 1];
  return task;
}
async function launch(task, prompt, resume, autoRecovery = null) {
  const root = stateRoot(); init(root);
  const nonce = randomUUID(); const request = path.join(root, 'requests', `${nonce}.json`);
  atomicJson(request, { task, prompt, resume, root, autoRecovery });
  const errfd = fs.openSync(`${request}.err`, 'a', 0o600);
  const locks = [path.join(root, 'locks', `task-${task.id}.lock`), lockPath(task.worktree, root), ...(resume ? [path.join(root, 'locks', `session-${task.executor.cli}-${task.session_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.lock`)] : [])];
  const lockArgs = locks.flatMap(file => ['flock', '-n', '-E', '75', file]);
  const runner = spawn(lockArgs[0], [...lockArgs.slice(1), process.execPath, self, '__supervise', request], { detached: true, stdio: ['ignore', 'ignore', errfd] });
  fs.closeSync(errfd);
  let exit = null, failure = null;
  runner.on('error', e => { failure = e; }); runner.on('exit', code => { exit = code; }); runner.unref();
  for (let i = 0; i < 200; i++) {
    const ack = readJson(`${request}.ack`);
    if (ack) { if (ack.error) throw new Error(ack.error); return ack; }
    if (failure || exit !== null) throw new Error(failure?.message || (exit === 75 ? 'Worktree already has a live writer' : `Supervisor failed (${exit}): ${fs.readFileSync(`${request}.err`, 'utf8').slice(-1000)}`));
    await sleep(50);
  }
  throw new Error(`Launch acknowledgement pending; inspect ${request} before retrying`);
}
async function supervise(request) {
  const { task, prompt, resume, root, autoRecovery } = readJson(request);
  const file = taskPath(task.id, root);
  // The flock inode is held by our parent throughout supervision and teardown.
  const existing = readJson(file);
  for (const name of fs.readdirSync(path.join(root, 'tasks')).filter(name => name.endsWith('.json'))) {
    const owner = readJson(path.join(root, 'tasks', name));
    if (owner.worktree !== task.worktree && !(resume && owner.executor?.cli === task.executor.cli && owner.session_id === task.session_id)) continue;
    const ownedScopeLive = owner.unit && spawnSync('systemctl', ['--user', 'is-active', owner.unit], { timeout: 3000 }).status === 0;
    if (sameProcess(owner.supervisor_identity) || sameProcess(owner.process_identity) || ownedScopeLive) throw new Error('Worktree already has a live writer (including adopted/lost supervisors)');
  }
  if (existing && (sameProcess(existing.supervisor_identity) || sameProcess(existing.process_identity))) throw new Error('Task already has a live writer');
  if (existing && !resume) throw new Error('Task id already exists; use resume');
  if (resume && (existing?.adopted || !existing?.session_id || existing.session_id !== task.session_id)) throw new Error('Resume ownership/session mismatch');
  if (resume && (existing.attempt_id !== task.attempt_id || existing.worktree !== task.worktree || existing.executor.cli !== task.executor.cli)) throw new Error('Resume attempt changed before locking');
  if (autoRecovery) {
    if (existing.paid === true || existing.card?.paid === true || existing.read_only || existing.state !== 'interrupted' || existing.recovery?.status !== 'reserved' || existing.recovery.boot_id !== autoRecovery.boot_id || autoRecovery.boot_id !== bootId() || existing.attempt_id !== autoRecovery.attempt_id || !Number.isInteger(existing.auto_resume_count) || existing.auto_resume_count < 1 || existing.auto_resume_count > Math.min(2, existing.max_auto_resume ?? 2)) throw new Error('Auto-recovery reservation invalid or owner required');
    task.recovery = { ...existing.recovery, status: 'dispatched' };
    if (!existing.recovery.from_boot_id || existing.recovery.from_boot_id === autoRecovery.boot_id || existing.goal_generation == null) throw new Error('Auto-recovery requires changed boot and persisted goal generation');
  }
  const attempt = randomUUID();
  Object.assign(task, { attempt_id: attempt, unit: `orch-${attempt}.scope`, state: 'queued', started_at: iso(), finished_at: null, exit_code: null, exit_signal: null, stop_requested: false, completion_report: null, usage: null, session_id: resume ? task.session_id : null, supervisor_identity: procIdentity(process.pid), supervisor_pid: process.pid, process_identity: null, pid: null, process_group: null, log_path: path.join(root, 'logs', `${task.id}-${attempt}.jsonl`), stderr_path: path.join(root, 'logs', `${task.id}-${attempt}.stderr`), events_path: path.join(root, 'logs', `${task.id}-${attempt}.events.jsonl`) });
  task.deadline_at = new Date(Date.parse(task.started_at) + task.hard_timeout_ms).toISOString();
  const version = spawnSync(task.executor.cli === 'cursor' ? 'cursor-agent' : task.executor.cli, ['--version'], { encoding: 'utf8', timeout: 3000 });
  task.executor.cli_version = version.status === 0 ? version.stdout.trim() : null;
  let sequence = 0;
  const persist = (kind, extra = {}) => { atomicJson(file, task); atomicJson(`${lockPath(task.worktree, root)}.owner.json`, { task_id: task.id, attempt_id: attempt, supervisor_identity: task.supervisor_identity, process_identity: task.process_identity, state: task.state }); const fd = fs.openSync(task.events_path, 'a', 0o600); try { fs.writeSync(fd, JSON.stringify({ attempt_id: attempt, sequence: ++sequence, at: iso(), kind, ...extra }) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
  await admitTask(task, root, () => persist('queued'), { recovery: !!autoRecovery });
  const out = fs.createWriteStream(task.log_path, { flags: 'a', mode: 0o600 });
  const err = fs.createWriteStream(task.stderr_path, { flags: 'a', mode: 0o600 });
  const argv = scopeCommand(task, workerCommand(task, prompt, resume));
  const child = spawn(argv[0], argv.slice(1), { cwd: task.worktree, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const decoder = new StringDecoder('utf8'); let partial = '', cache = {};
  child.stdout.on('data', data => {
    out.write(data); partial += decoder.write(data);
    const end = partial.lastIndexOf('\n');
    if (end >= 0) { cache = ingestLines(partial.slice(0, end), task.executor.cli, cache); partial = partial.slice(end + 1); }
    if (partial.length > 1024 * 1024) partial = '';
    if (cache.session_id && !task.session_id) { task.session_id = cache.session_id; persist('session', { session_id: task.session_id }); }
    if (cache.usage) task.usage = cache.usage;
    task.last_progress_at = iso();
  });
  child.stderr.on('data', data => err.write(data));
  let stopping = false; let stopAt = null;
  function terminate() {
    if (stopping) return; stopping = true; stopAt = Date.now(); task.stop_requested = true; persist('stop_requested');
    if (sameProcess(task.process_identity)) {
      // Scope membership additionally contains descendants which changed groups.
      spawnSync('systemctl', ['--user', 'kill', '--kill-whom=all', '--signal=TERM', task.unit], { timeout: 3000 });
      if (sameProcess(task.process_identity)) process.kill(-task.process_group, 'SIGTERM');
    }
  }
  process.on('SIGTERM', terminate); process.on('SIGINT', terminate);
  child.once('spawn', () => {
    task.process_identity = procIdentity(child.pid); task.pid = child.pid; task.process_group = task.process_identity?.process_group; task.state = 'running'; task.last_heartbeat_at = iso(); persist('started');
    atomicJson(`${request}.ack`, { id: task.id, pid: task.pid, supervisor_pid: process.pid, log_path: task.log_path });
  });
  const heartbeat = setInterval(() => { task.last_heartbeat_at = iso(); persist('heartbeat'); }, 15000);
  const watchdog = setInterval(() => {
    if ((stopping || Date.now() >= Date.parse(task.deadline_at)) && Date.now() >= (stopping ? stopAt : Date.parse(task.deadline_at)) + 10000) {
      spawnSync('systemctl', ['--user', 'kill', '--kill-whom=all', '--signal=KILL', task.unit], { timeout: 3000 });
      if (sameProcess(task.process_identity)) process.kill(-task.process_group, 'SIGKILL');
    }
  }, 1000);
  const result = await new Promise(resolve => { child.once('error', error => resolve({ code: null, signal: null, error: error.message })); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearInterval(heartbeat); clearInterval(watchdog);
  // Do not release the worktree lease while background descendants remain.
  const cleanup = spawnSync('systemctl', ['--user', 'stop', task.unit], { timeout: 15000 });
  const active = spawnSync('systemctl', ['--user', 'is-active', task.unit], { encoding: 'utf8', timeout: 3000 });
  if (active.status === 0 || ![3, 4].includes(active.status)) {
    task.state = 'failed'; task.error = `Scope teardown unverified (${cleanup.status}); lease retained`; persist('teardown_unverified');
    // Keep the flock held for operator reconciliation; no new writer admitted.
    for (;;) await sleep(60000);
  }
  await Promise.all([new Promise(resolve => out.end(resolve)), new Promise(resolve => err.end(resolve))]);
  Object.assign(task, { finished_at: iso(), exit_code: result.code, exit_signal: result.signal, error: result.error || null, completion_report: cache.completion_report || null, usage: cache.usage || null });
  task.state = task.stop_requested ? 'failed' : result.code === 124 || (result.code === 137 && Date.now() >= Date.parse(task.deadline_at)) ? 'timeout' : result.code === 0 && cache.terminal !== 'failed' ? 'done' : 'failed';
  persist('exit', { exit_code: result.code, exit_signal: result.signal, state: task.state });
}
export async function stopTask(id) {
  const task = readJson(taskPath(id));
  if (!task || task.adopted) throw new Error('Task is missing or read-only adopted; stop unavailable');
  if (!sameProcess(task.supervisor_identity)) {
    if (sameProcess(task.process_identity)) throw new Error('Lost supervision: owned worker remains live; reconcile manually');
    return task;
  }
  if (!task.supervisor_identity.cmdline.includes(self) || !task.supervisor_identity.cmdline.includes('__supervise')) throw new Error('Supervisor cmdline mismatch');
  process.kill(task.supervisor_pid, 'SIGTERM');
  for (let i = 0; i < 300; i++) { if (!sameProcess(task.supervisor_identity) && !sameProcess(task.process_identity)) return readJson(taskPath(id)); await sleep(100); }
  throw new Error('Stop not confirmed; lease retained');
}
export async function main(args = process.argv.slice(2)) {
  if (args[0] === '__supervise') {
    try { await supervise(args[1]); } catch (e) { atomicJson(`${args[1]}.ack`, { error: e.message }); throw e; }
    return;
  }
  if (args[0] === 'stop') { console.log(JSON.stringify(await stopTask(args[1]))); return; }
  if (args[0] === 'resume') {
    const previous = readJson(taskPath(args[1]));
    if (!previous || previous.adopted || !previous.session_id) throw new Error('No owned resumable task/session');
    if (sameProcess(previous.supervisor_identity) || sameProcess(previous.process_identity)) throw new Error('Worker still running; stop and verify exit before resume');
    const task = { ...previous, attempt_history: [...previous.attempt_history, { attempt_id: previous.attempt_id, started_at: previous.started_at, finished_at: previous.finished_at, state: previous.state, log_path: previous.log_path, exit_code: previous.exit_code, usage: previous.usage || null }] };
    const flags = options(args.slice(3));
    const autoRecovery = flags.auto_recover ? { boot_id: flags.auto_recover, attempt_id: flags.expected_attempt } : null;
    console.log(JSON.stringify(await launch(task, args[2] || task.resume_text, true, autoRecovery))); return;
  }
  const o = options(args[0] === 'start' ? args.slice(1) : args);
  if (o.task_id) o.id = o.task_id;
  const task = makeTask(o);
  console.log(JSON.stringify(await launch(task, fs.readFileSync(task.prompt_file, 'utf8'), false)));
}
if (isMain(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
