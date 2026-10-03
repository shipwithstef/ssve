#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { stateRoot, init, atomicJson, readJson, taskPath, options, number, canonicalWorktree, lockPath, procIdentity, sameProcess, iso, sleep, ingestLines, isMain, bootId, withLocks } from './common.mjs';
import { steeringCapability, userMessage, enqueueSteer, consumeSteers, autoResumeBudget } from './steering.mjs';
import { admitTask, checkTaskGrant, goalLock } from './goals.mjs';
import { updateTaskRecord } from './interruption.mjs';
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
  if (cli === 'claude') return ['claude', '-p', ...(resume ? ['--resume', task.session_id] : []), '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', model, '--effort', effort, '--dangerously-skip-permissions'];
  if (cli === 'agy') return ['agy', ...(resume ? ['--conversation', task.session_id] : []), '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--model', model, '--effort', effort, '--dangerously-skip-permissions'];
  throw new Error('cli must be codex, cursor, agy or claude');
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
  if (o.max_auto_resume !== undefined) {
    task.max_auto_resume = Number(o.max_auto_resume);
    if (!Number.isInteger(task.max_auto_resume) || task.max_auto_resume < 0 || task.max_auto_resume > 2) throw new Error('--max-auto-resume must be 0, 1 or 2');
  }
  for (const key of ['goal_generation', 'child_depth']) if (o[key] != null) { task[key] = Number(o[key]); if (!Number.isSafeInteger(task[key])) throw new Error(`Invalid ${key}`); }
  for (const key of ['child_session', 'child_principal']) if (o[key] != null) task[key] = o[key];
  if (!['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(task.executor.effort)) throw new Error('Invalid effort');
  const command = workerCommand(task, 'validate');
  task.executor.requested_model = task.executor.model;
  task.executor.resolved_model = command[command.indexOf(task.executor.cli === 'codex' ? '-m' : '--model') + 1];
  return task;
}
async function launch(task, prompt, resume, autoRecovery = null, steerResume = false) {
  const root = stateRoot(); init(root);
  const nonce = randomUUID(); const request = path.join(root, 'requests', `${nonce}.json`);
  atomicJson(request, { task, prompt, resume, root, autoRecovery, steerResume });
  const errfd = fs.openSync(`${request}.err`, 'a', 0o600);
  const locks = [path.join(root, 'locks', `task-${task.id}.lock`), lockPath(task.worktree, root), ...(resume ? [path.join(root, 'locks', `session-${task.executor.cli}-${task.session_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.lock`)] : [])];
  const lockArgs = locks.flatMap(file => ['flock', '-w', '2', '-E', '75', file]);
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
async function supervise(request, continuation = null, sessionLocked = false) {
  const { task, resume, root, autoRecovery, steerResume } = continuation || readJson(request);
  let { prompt } = continuation || readJson(request);
  const file = taskPath(task.id, root);
  // The flock inode is held by our parent throughout supervision and teardown.
  const existing = readJson(file);
  for (const name of fs.readdirSync(path.join(root, 'tasks')).filter(name => name.endsWith('.json'))) {
    const owner = readJson(path.join(root, 'tasks', name));
    if (owner.worktree !== task.worktree && !(resume && owner.executor?.cli === task.executor.cli && owner.session_id === task.session_id)) continue;
    const ownedScopeLive = owner.unit && spawnSync('systemctl', ['--user', 'is-active', owner.unit], { timeout: 3000 }).status === 0;
    if (continuation && owner.id === task.id && owner.attempt_id === task.attempt_id && owner.supervisor_pid === process.pid) continue;
    if (sameProcess(owner.supervisor_identity) || sameProcess(owner.process_identity) || ownedScopeLive) throw new Error('Worktree already has a live writer (including adopted/lost supervisors)');
  }
  if (existing && !continuation && (sameProcess(existing.supervisor_identity) || sameProcess(existing.process_identity))) throw new Error('Task already has a live writer');
  if (existing && !resume) throw new Error('Task id already exists; use resume');
  if (resume && (existing?.adopted || !existing?.session_id || existing.session_id !== task.session_id)) throw new Error('Resume ownership/session mismatch');
  if (resume && (existing.attempt_id !== task.attempt_id || existing.worktree !== task.worktree || existing.executor.cli !== task.executor.cli)) throw new Error('Resume attempt changed before locking');
  if (autoRecovery) {
    if (existing.paid === true || existing.card?.paid === true || existing.read_only || existing.state !== 'interrupted' || existing.recovery?.status !== 'reserved' || existing.recovery.boot_id !== autoRecovery.boot_id || autoRecovery.boot_id !== bootId() || existing.attempt_id !== autoRecovery.attempt_id || !Number.isInteger(existing.auto_resume_count) || existing.auto_resume_count < 1 || existing.auto_resume_count > Math.min(2, existing.max_auto_resume ?? 2)) throw new Error('Auto-recovery reservation invalid or owner required');
    task.recovery = { ...existing.recovery, status: 'dispatched' };
    if (!existing.recovery.from_boot_id || existing.recovery.from_boot_id === autoRecovery.boot_id || existing.goal_generation == null) throw new Error('Auto-recovery requires changed boot and persisted goal generation');
  }
  if (resume) {
    task.steer_queue = existing.steer_queue || []; task.steer_deliveries = existing.steer_deliveries || [];
  }
  task.steering = steeringCapability(task.executor.cli);
  const consumeIds = resume ? task.steer_queue.map(e => e.id) : [];
  const attempt = randomUUID();
  Object.assign(task, { attempt_id: attempt, unit: `orch-${attempt}.scope`, state: 'queued', started_at: iso(), finished_at: null, exit_code: null, exit_signal: null, exit_recorded_boot_id: null, interruption: null, owner_stop_requested: false, stop_requested: false, completion_report: null, usage: null, session_id: resume ? task.session_id : null, supervisor_identity: procIdentity(process.pid), supervisor_pid: process.pid, process_identity: null, pid: null, process_group: null, log_path: path.join(root, 'logs', `${task.id}-${attempt}.jsonl`), stderr_path: path.join(root, 'logs', `${task.id}-${attempt}.stderr`), events_path: path.join(root, 'logs', `${task.id}-${attempt}.events.jsonl`) });
  task.deadline_at = new Date(Date.parse(task.started_at) + task.hard_timeout_ms).toISOString();
  const version = spawnSync(task.executor.cli === 'cursor' ? 'cursor-agent' : task.executor.cli, ['--version'], { encoding: 'utf8', timeout: 3000 });
  task.executor.cli_version = version.status === 0 ? version.stdout.trim() : null;
  let sequence = 0;
  const syncInterruption = latest => {
    if (latest?.attempt_id !== attempt) return;
    task.steer_queue = latest.steer_queue || []; task.steer_deliveries = latest.steer_deliveries || [];
    task.steering_blocker = latest.steering_blocker || null;
    task.steering = latest.steering || task.steering;
    task.steer_now_requested = latest.steer_now_requested || false;
    task.max_auto_resume = latest.max_auto_resume; task.auto_resume_count = latest.auto_resume_count;
    if (latest.owner_stop_requested) task.owner_stop_requested = true;
    if (latest.interruption?.attempt_id === attempt) task.interruption = latest.interruption;
    if (task.interruption && !task.finished_at) task.state = task.stop_requested ? 'interrupted' : 'interrupting';
  };
  const persist = (kind, extra = {}) => updateTaskRecord(task.id, root, latest => {
    syncInterruption(latest);
    if (task.finished_at && task.interruption && !task.owner_stop_requested) task.state = 'interrupted';
    atomicJson(file, task); atomicJson(`${lockPath(task.worktree, root)}.owner.json`, { task_id: task.id, attempt_id: attempt, supervisor_identity: task.supervisor_identity, process_identity: task.process_identity, state: task.state });
    const fd = fs.openSync(task.events_path, 'a', 0o600);
    try { fs.writeSync(fd, JSON.stringify({ attempt_id: attempt, sequence: ++sequence, at: iso(), kind, ...extra, state: task.state }) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  });
  await admitTask(task, root, () => updateTaskRecord(task.id, root, latest => {
    task.steer_queue = latest?.steer_queue || []; task.steer_deliveries = latest?.steer_deliveries || [];
    if (continuation) task.auto_resume_count = autoResumeBudget(latest);
    if (consumeIds.length) {
      const text = consumeSteers(task, consumeIds, 'resume');
      prompt = steerResume || continuation ? text : prompt + '\n\n' + text;
    }
    task.steering_blocker = null; task.steer_now_requested = false;
    atomicJson(file, task);
  }), { recovery: !!autoRecovery });
  persist('queued');
  const out = fs.createWriteStream(task.log_path, { flags: 'a', mode: 0o600 });
  const err = fs.createWriteStream(task.stderr_path, { flags: 'a', mode: 0o600 });
  const argv = scopeCommand(task, workerCommand(task, prompt, resume));
  let fifoFd = null, fifoRead = null;
  if (task.steering.mode === 'stdin') {
    task.stdin_fifo = path.join(root, 'requests', `${attempt}.fifo`);
    const made = spawnSync('mkfifo', ['-m', '600', task.stdin_fifo]);
    if (made.status !== 0) throw new Error('Cannot create worker stdin FIFO');
    fifoFd = fs.openSync(task.stdin_fifo, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
    fifoRead = fs.openSync(task.stdin_fifo, fs.constants.O_RDONLY);
    persist('stdin_ready');
  }
  const child = spawn(argv[0], argv.slice(1), { cwd: task.worktree, detached: true, stdio: [fifoRead ?? 'ignore', 'pipe', 'pipe'] });
  if (fifoRead !== null) fs.closeSync(fifoRead);

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
  function terminate(signal) {
    if (stopping) return; stopping = true; stopAt = Date.now();
    syncInterruption(readJson(file));
    task.stop_requested = true;
    if (signal === 'SIGTERM' && !task.owner_stop_requested) task.interruption = { attempt_id: attempt, boot_id: task.supervisor_identity.boot_id, at: iso(), reason: 'Supervisor SIGTERM' };
    else task.owner_stop_requested = true;
    task.state = task.owner_stop_requested ? 'stopped' : 'interrupted'; persist('stop_requested', { signal });
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
  let draining = false; let inputReady = fifoFd === null;
  const delivery = fifoFd === null ? null : setInterval(async () => {
    if (!inputReady || draining || stopping || !sameProcess(task.process_identity)) return;
    draining = true;
    try {
      if (readJson(file)?.steer_queue?.length) await withLocks([goalLock(root)], () => updateTaskRecord(task.id, root, latest => {
        if (latest.attempt_id !== attempt || latest.steering?.mode !== 'stdin' || latest.owner_stop_requested || latest.steer_now_requested || latest.interruption) return;
        checkTaskGrant(latest, root, false, true);
        const entry = latest.steer_queue?.[0]; if (!entry) return;
        consumeSteers(latest, [entry.id], 'stdin'); atomicJson(file, latest);
        try {
          const line = userMessage(entry.text, latest.session_id || '');
          if (fs.writeSync(fifoFd, line) !== Buffer.byteLength(line)) throw new Error('Partial FIFO write');
          latest.steer_deliveries.at(-1).state = 'sent';
        } catch (e) {
          latest.steering_blocker = `Live steer delivery unconfirmed; reconcile receipt ${entry.id}: ${e.message}`;
          // A partial line cannot safely precede another NDJSON envelope.
          latest.steering = { mode: 'queue', reason: 'Live FIFO unavailable; unconfirmed delivery held' };
        }
        atomicJson(file, latest);
      }));
    } catch (e) { updateTaskRecord(task.id, root, latest => { latest.steering_blocker = e.message; atomicJson(file, latest); }); }
    finally { draining = false; }
  }, 100);
  const heartbeat = setInterval(() => { task.last_heartbeat_at = iso(); persist('heartbeat'); }, 15000);
  const watchdog = setInterval(() => {
    if ((stopping || Date.now() >= Date.parse(task.deadline_at)) && Date.now() >= (stopping ? stopAt : Date.parse(task.deadline_at)) + 10000) {
      spawnSync('systemctl', ['--user', 'kill', '--kill-whom=all', '--signal=KILL', task.unit], { timeout: 3000 });
      if (sameProcess(task.process_identity)) process.kill(-task.process_group, 'SIGKILL');
    }
  }, 1000);
  let closed = false;
  const completion = new Promise(resolve => { child.once('error', error => { closed = true; resolve({ code: null, signal: null, error: error.message }); }); child.once('close', (code, signal) => { closed = true; resolve({ code, signal }); }); });
  let inputError = null;
  if (fifoFd !== null) {
    const input = Buffer.from(userMessage(prompt, task.session_id || '')); let offset = 0;
    const inputDeadline = Date.now() + 10000;
    try {
      while (offset < input.length) {
        if (closed || Date.now() >= inputDeadline) throw new Error('Initial stdin delivery unconfirmed');
        try { offset += fs.writeSync(fifoFd, input, offset, input.length - offset); }
        catch (e) { if (e.code !== 'EAGAIN') throw e; await sleep(10); }
      }
    } catch (e) { inputError = e.message; terminate('SIGINT'); }
  }
  inputReady = true;
  const result = await completion;
  result.error ||= inputError;
  clearInterval(heartbeat); clearInterval(watchdog); if (delivery) clearInterval(delivery);
  while (draining) await sleep(10);
  if (fifoFd !== null) { fs.closeSync(fifoFd); fs.unlinkSync(task.stdin_fifo); }
  // Do not release the worktree lease while background descendants remain.
  const cleanup = spawnSync('systemctl', ['--user', 'stop', task.unit], { timeout: 15000 });
  const active = spawnSync('systemctl', ['--user', 'is-active', task.unit], { encoding: 'utf8', timeout: 3000 });
  if (active.status === 0 || ![3, 4].includes(active.status)) {
    task.state = 'failed'; task.error = `Scope teardown unverified (${cleanup.status}); lease retained`; persist('teardown_unverified');
    // Keep the flock held for operator reconciliation; no new writer admitted.
    for (;;) await sleep(60000);
  }
  await Promise.all([new Promise(resolve => out.end(resolve)), new Promise(resolve => err.end(resolve))]);
  Object.assign(task, { finished_at: iso(), exit_recorded_boot_id: bootId(), exit_code: result.code, exit_signal: result.signal, error: result.error || null, completion_report: cache.completion_report || null, usage: cache.usage || null });
  if (!task.owner_stop_requested && ['SIGTERM', 'SIGKILL', 'SIGINT'].includes(result.signal) && Date.now() < Date.parse(task.deadline_at)) task.interruption ||= { attempt_id: attempt, boot_id: task.supervisor_identity.boot_id, at: task.finished_at, reason: `Worker exited with ${result.signal}` };
  task.state = task.owner_stop_requested ? 'stopped' : task.interruption ? 'interrupted' : result.code === 124 || (result.code === 137 && Date.now() >= Date.parse(task.deadline_at)) ? 'timeout' : result.code === 0 && cache.terminal !== 'failed' ? 'done' : 'failed';
  persist('exit', { exit_code: result.code, exit_signal: result.signal, state: task.state });
  process.off('SIGTERM', terminate); process.off('SIGINT', terminate);
  const latest = readJson(file);
  if (['done', 'failed'].includes(latest.state) && !latest.owner_stop_requested && !latest.steer_now_requested && latest.steer_queue?.length) {
    try {
      autoResumeBudget(latest);
      if (!latest.session_id) throw new Error('No exact session for queued steer');
      const next = { task: resumedTask(latest), prompt: '', resume: true, root, steerResume: true };
      if (resume || sessionLocked) await supervise(request, next, true);
      else await withLocks([sessionLock(latest, root)], () => supervise(request, next, true));
    } catch (e) {
      updateTaskRecord(task.id, root, held => { held.steering_blocker = `Queued steer held: ${e.message}`; atomicJson(file, held); });
    }
  }
}
const sessionLock = (task, root) => path.join(root, 'locks', `session-${task.executor.cli}-${task.session_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.lock`);
function resumedTask(previous) {
  return { ...previous, attempt_history: [...previous.attempt_history, { attempt_id: previous.attempt_id, started_at: previous.started_at, finished_at: previous.finished_at, state: previous.state, log_path: previous.log_path, exit_code: previous.exit_code, usage: previous.usage || null }] };
}
export async function steerTask(id, text, now = false) {
  const root = stateRoot();
  let previous;
  updateTaskRecord(id, root, latest => {
    if (!latest || latest.adopted || latest.read_only) throw new Error('No owned steerable task');
    if (!latest.session_id && latest.finished_at) throw new Error('No owned resumable task/session');
    enqueueSteer(latest, text);
    if (now) latest.steer_now_requested = true;
    atomicJson(taskPath(id, root), latest); previous = latest;
  });
  const running = !previous.finished_at && (sameProcess(previous.supervisor_identity) || sameProcess(previous.process_identity));
  if (running && !now) return { id, steering_mode: previous.steering?.mode || 'queue', queued: previous.steer_queue.length };
  if (running) await stopTask(id);
  const latest = readJson(taskPath(id, root));
  if (sameProcess(latest.process_identity) || sameProcess(latest.supervisor_identity)) throw new Error('Worker still running; steer retained');
  if (!latest.session_id) throw new Error('No exact session; steer retained');
  return launch(resumedTask(latest), '', true, null, true);
}
export async function stopTask(id) {
  const task = readJson(taskPath(id));
  if (!task || task.adopted) throw new Error('Task is missing or read-only adopted; stop unavailable');
  if (!sameProcess(task.supervisor_identity)) {
    if (sameProcess(task.process_identity)) throw new Error('Lost supervision: owned worker remains live; reconcile manually');
    return task;
  }
  if (task.supervisor_pid !== task.supervisor_identity.pid) throw new Error('Supervisor PID/identity mismatch');
  if (!task.supervisor_identity.cmdline.includes(self) || !task.supervisor_identity.cmdline.includes('__supervise')) throw new Error('Supervisor cmdline mismatch');
  updateTaskRecord(id, stateRoot(), latest => {
    if (latest.attempt_id !== task.attempt_id) throw new Error('Stop attempt changed');
    latest.owner_stop_requested = true; atomicJson(taskPath(id), latest);
  });
  process.kill(task.supervisor_pid, 'SIGTERM');
  for (let i = 0; i < 300; i++) { if (!sameProcess(task.supervisor_identity) && !sameProcess(task.process_identity)) return readJson(taskPath(id)); await sleep(100); }
  throw new Error('Stop not confirmed; lease retained');
}
export async function main(args = process.argv.slice(2)) {
  if (args[0] === '__supervise') {
    try { await supervise(args[1]); } catch (e) { atomicJson(`${args[1]}.ack`, { error: e.message }); throw e; }
    return;
  }
  if (args[0] === 'steer') {
    if (args.length < 3 || args.slice(3).some(arg => arg !== '--now') || args.length > 4) throw new Error('Usage: steer <id> <message> [--now]');
    console.log(JSON.stringify(await steerTask(args[1], args[2], args[3] === '--now'))); return;
  }
  if (args[0] === 'stop') { console.log(JSON.stringify(await stopTask(args[1]))); return; }
  if (args[0] === 'resume') {
    const previous = readJson(taskPath(args[1]));
    if (!previous || previous.adopted || !previous.session_id) throw new Error('No owned resumable task/session');
    if (sameProcess(previous.supervisor_identity) || sameProcess(previous.process_identity)) throw new Error('Worker still running; stop and verify exit before resume');
    const task = resumedTask(previous);
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
