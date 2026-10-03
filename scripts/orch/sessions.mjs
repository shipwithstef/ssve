#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stateRoot, init, readJson, atomicJson, canonicalWorktree, withLocks, procIdentity, sameProcess, bootId, iso, options, isMain } from './common.mjs';
import { readRegistry, validateChild, goalLock } from './goals.mjs';

const self = fileURLToPath(import.meta.url);
const pane = fileURLToPath(new URL('../../mods/orchestrator-pane', import.meta.url));
const safe = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(value);
function claudeExecutable() {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const file = path.resolve(dir, 'claude');
    try { fs.accessSync(file, fs.constants.X_OK); if (fs.statSync(file).isFile()) return fs.realpathSync(file); } catch { /* next */ }
  }
  throw new Error('Claude executable unavailable; intent remains held');
}
export function roleId(role, goal) {
  if (!['parent', 'child'].includes(role) || !safe(goal)) throw new Error('Invalid role/goal');
  return role === 'parent' ? 'parent' : `child-${goal}`;
}
export function sessionFile(role, goal, root = stateRoot()) { return path.join(root, 'sessions', `${roleId(role, goal)}.json`); }
export function sessionLock(role, goal, root) { return path.join(root, 'locks', `orchestrator-${roleId(role, goal)}.lock`); }
export function binding(o, root = stateRoot()) {
  roleId(o.role, o.goal);
  const registry = readRegistry(root), goal = registry?.goals.find(g => g.id === o.goal);
  if (!goal) throw new Error('Unknown goal');
  const authority = o.role === 'parent' ? registry.parent : { ...goal.child, generation: goal.generation };
  if (o.role === 'parent' && authority.goal_id !== goal.id) throw new Error('Parent planning goal mismatch');
  if (!safe(authority.session_id) || Number(o.generation) !== authority.generation || o.session_id !== authority.session_id || o.principal !== authority.principal) throw new Error('Stale or foreign session binding');
  const wt = canonicalWorktree(goal.planning_worktree);
  if (o.worktree !== wt) throw new Error('Exact canonical planning worktree required');
  const expected = fs.realpathSync(path.join(root, authority.contract_ref));
  if (!path.isAbsolute(o.contract || '') || fs.realpathSync(o.contract) !== expected || !fs.statSync(expected).isFile()) throw new Error('Exact absolute immutable contract required');
  const contract = readJson(expected);
  if (o.role === 'child') validateChild(goal, contract);
  else if (contract.role !== 'parent' || contract.goal_id !== goal.id || contract.generation !== authority.generation || contract.session_id !== authority.session_id || contract.principal !== authority.principal || contract.planning_worktree !== wt || contract.depth !== 0 || contract.effort !== 'low' || contract.max_orchestrator_depth !== 1 || contract.report_max_lines !== 10) throw new Error('Parent contract mismatch');
  return { registry, goal, authority, contract, worktree: wt, contract_file: expected };
}
function parentCaller(registry, o) {
  if ((process.env.ORCH_ROLE || 'parent') !== 'parent' || Number(process.env.ORCH_DEPTH || 0) !== 0 || (o.caller_principal || process.env.ORCH_PRINCIPAL || 'owner') !== registry.parent.principal) throw new Error('Only parent may launch/release orchestrators');
}
export function launchCommand(o, nonce) {
  const prompt = `Read ${o.contract}; use LOW effort and the ${o.role} brief at ${path.resolve(path.dirname(self), '../../docs/orch/briefs', o.role + '.md')}. ` +
    `Before work, acknowledge launch ${nonce} using ${self} acknowledge and the ORCH_ACK_FILE environment path; include actual full session ID, canonical cwd, effective effort/model, boot ID, PID and start ticks. Reconcile files; dispatch only via ${path.join(path.dirname(self), 'dispatch.mjs')}; registry writer ${path.join(path.dirname(self), 'goals.mjs')}; Monitor source ${path.join(path.dirname(self), 'events.mjs')}; report at most 10 lines.`;
  return ['claude', '--bg', '--effort', 'low', '--name', `orch-${o.role}-${o.goal}`, '--session-id', o.session_id, prompt];
}
export function attachCommand(record) {
  if (!safe(record?.session_id)) throw new Error('No exact session id');
  return ['claude', '--resume', record.session_id];
}
function privateDirs(root) {
  init(root);
  for (const dir of ['sessions', 'events']) fs.mkdirSync(path.join(root, dir), { recursive: true, mode: 0o700 });
}
function checkedAck(ack, record) {
  if (ack?.launch_nonce !== record.launch_nonce || ack.session_id !== record.session_id || ack.generation !== record.generation || ack.role !== record.role || ack.goal_id !== record.goal_id || ack.contract !== record.contract || ack.worktree !== record.worktree) throw new Error('Launch acknowledgement ID/nonce/cwd/contract mismatch');
  if (ack.effort !== 'low' || typeof ack.model !== 'string' || !ack.model.trim()) throw new Error('Effective LOW/model acknowledgement required');
  const identity = procIdentity(ack.pid);
  if (!identity || ack.boot_id !== identity.boot_id || ack.start_ticks !== identity.start_ticks || fs.realpathSync(`/proc/${ack.pid}/cwd`) !== record.worktree) throw new Error('Launch process identity/cwd mismatch');
  const executableMatches = identity.cmdline.some(arg => { try { return path.isAbsolute(arg) && fs.realpathSync(arg) === record.launch_executable; } catch { return false; } });
  if (!executableMatches && fs.realpathSync(`/proc/${ack.pid}/exe`) !== record.launch_executable) throw new Error('Launch native Claude executable mismatch');
  return identity;
}
// Watches atomic rename, not the original inode. One deadline, no model polling.
function waitAck(file, ms, signal) {
  return new Promise((resolve, reject) => {
    let timer, watcher;
    const end = (error, value) => { clearTimeout(timer); watcher?.close(); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
    const check = () => { try { const value = readJson(file); if (value) end(null, value); } catch (e) { end(e); } };
    const abort = () => end(new Error('Supervisor stopped; launch ownership unknown'));
    watcher = fs.watch(path.dirname(file), (_, name) => { if (name?.toString() === path.basename(file)) check(); });
    watcher.on('error', e => end(e));
    timer = setTimeout(() => end(new Error('Launch acknowledgement missing; reconcile nonce, never relaunch')), ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else check();
  });
}
export async function launchSession(o, { root = stateRoot(), signal, onReady = () => {}, ackTimeout = 15000 } = {}) {
  if (!safe(o.session_id)) throw new Error('Invalid session id');
  privateDirs(root);
  const file = sessionFile(o.role, o.goal, root);
  // Native restart ownership is unknown after any ambiguous launch. Only an
  // explicitly reconciled release permits a NEW generation, never an ID fork.
  return withLocks([sessionLock(o.role, o.goal, root), path.join(root, 'locks', `claude-${o.session_id}.lock`)], async () => {
    let record;
    await withLocks([goalLock(root)], () => {
      const b = binding(o, root); parentCaller(b.registry, o);
      if (o.live_verified !== 'true') throw new Error('Live transport UNVERIFIED; use verify-live --dry-run (no launch)');
      if (['closing', 'closed'].includes(b.goal.desired_state)) throw new Error('Goal closing/closed');
      if (b.goal.budget.claude_turn_cap == null || b.goal.budget.claude_turn_cap <= 0) throw new Error('Explicit positive Claude turn allowance required');
      const old = readJson(file);
      if (o.reconcile === 'true' || o.resume === 'true') {
        if (!old || old.state === 'released' || old.generation !== b.authority.generation || old.session_id !== o.session_id || old.principal !== o.principal || old.launch_nonce !== o.nonce || old.worktree !== b.worktree || old.contract !== b.contract_file || sameProcess(old.supervisor_identity)) throw new Error('Reconcile requires exact held nonce and dead prior supervisor');
        if (o.resume === 'true' && (sameProcess(old.process_identity) || o.native_stopped !== 'true')) throw new Error('Resume requires dead native identity AND owner-verified native supervisor/transcript stopped');
        record = { ...old, state: 'starting', blocker: null, supervisor_identity: procIdentity(process.pid), boot_id: bootId(), pid: process.pid, start_ticks: procIdentity(process.pid).start_ticks };
        if (o.resume === 'true') {
          record.launch_nonce = randomUUID(); record.process_identity = null; record.effort = 'low';
          record.resume_from_nonce = old.launch_nonce; record.resume_nonce_history = [...(old.resume_nonce_history || []), old.launch_nonce].slice(-64);
          record.plugin_dirs = [pane]; record.wake_cursor = null;
        }
        atomicJson(file, record); return;
      }
      if (old && (old.state !== 'released' || old.generation >= b.authority.generation || old.session_id === o.session_id)) throw new Error('Existing launch nonce/session held; reconcile before new generation');
      for (const name of fs.readdirSync(path.join(root, 'sessions')).filter(n => n.endsWith('.json'))) {
        const other = readJson(path.join(root, 'sessions', name));
        if (other?.session_id === o.session_id && path.join(root, 'sessions', name) !== file) throw new Error('Session id already owned');
      }
      const launch_nonce = randomUUID();
      record = { schema_version: 1, role: o.role, goal_id: o.goal, session_id: o.session_id, principal: o.principal,
        generation: b.authority.generation, launch_nonce, contract: b.contract_file, worktree: b.worktree,
        boot_id: bootId(), ...procIdentity(process.pid), supervisor_identity: procIdentity(process.pid), process_identity: null,
        state: 'starting', effort: 'low', model: null, last_heartbeat_at: iso(), last_progress_at: null,
        usage: { turns: null }, wake_cursor: null, blocker: null, native_restart_verified: false };
      delete record.cmdline; delete record.process_group;
      atomicJson(file, record); // Intent is durable BEFORE spawn, including failures.
    });
    const ackFile = path.join(root, 'requests', `${record.launch_nonce}.session-ack.json`);
    let heartbeat, observer, cursorWatch, launcher;
    const ackController = new AbortController();
    try {
      if (o.reconcile !== 'true') { record.launch_executable = claudeExecutable(); atomicJson(file, record); }
      const acknowledgement = waitAck(ackFile, ackTimeout, signal ? AbortSignal.any([signal, ackController.signal]) : ackController.signal);
      acknowledgement.catch(() => {}); // Also handled if synchronous spawn setup fails.
      if (o.reconcile !== 'true') {
        const command = o.resume === 'true' ? resumeCommand({ ...o, model: record.model }, record.launch_nonce) : launchCommand(o, record.launch_nonce);
        const errfd = fs.openSync(path.join(root, 'logs', `${record.launch_nonce}.launch.log`), 'a', 0o600);
        launcher = spawn(command[0], command.slice(1), { cwd: record.worktree,
          env: { ...process.env, ORCH_LAUNCH_NONCE: record.launch_nonce, ORCH_ACK_FILE: ackFile, ORCH_CONTRACT: record.contract,
            ORCH_SESSION_ID: record.session_id, ORCH_GENERATION: String(record.generation), ORCH_ROLE: record.role, ORCH_GOAL: record.goal_id,
            ORCH_PRINCIPAL: record.principal, ORCH_DEPTH: record.role === 'child' ? '1' : '0' }, stdio: ['ignore', errfd, errfd] });
        fs.closeSync(errfd);
        // Spawn/trust failures never clear intent. Keep acknowledgement deadline;
        // a background launcher exiting successfully is not proof of session health.
        launcher.on('error', e => { record.blocker = e.message; atomicJson(file, record); });
        launcher.on('exit', code => { if (code) { record.blocker = `Launch exited ${code}; trust/quota/ownership needs owner`; atomicJson(file, record); } });
      }
      const ack = await acknowledgement;
      await withLocks([goalLock(root)], () => {
        binding(o, root); record.process_identity = checkedAck(ack, record);
        record.state = 'idle'; record.model = ack.model; record.last_progress_at = iso(); record.blocker = null;
        // Unknown usage remains unknown; never invent zero turns at SessionStart.
        atomicJson(file, record);
      });
      const observeFile = path.join(root, 'requests', `${record.launch_nonce}.observation.json`);
      const observe = () => {
        try {
          const snapshot = readJson(observeFile);
          if (!snapshot) return;
          if (snapshot.launch_nonce !== record.launch_nonce || snapshot.session_id !== record.session_id || snapshot.generation !== record.generation || !Number.isSafeInteger(snapshot.turns) || snapshot.turns < 0 || (record.usage.turns != null && snapshot.turns < record.usage.turns)) throw new Error('Invalid/regressing usage checkpoint');
          if (snapshot.turns !== record.usage.turns) record.last_progress_at = iso();
          record.usage = { turns: snapshot.turns, source: 'session_reported_count_checkpoint' };
          atomicJson(file, record);
        } catch (e) { record.state = 'needs_owner'; record.blocker = e.message; atomicJson(file, record); }
      };
      observer = fs.watch(path.join(root, 'requests'), (_, name) => { if (name?.toString() === path.basename(observeFile)) observe(); });
      observer.on('error', () => { record.state = 'needs_owner'; record.blocker = 'Observation watcher disconnected; reconcile once after repair'; atomicJson(file, record); observe(); });
      observe();
      const cursorFile = path.join(root, 'events', `${roleId(o.role, o.goal)}.json`);
      const cursor = () => {
        try {
          const e = readJson(cursorFile);
          if (!e || e.generation !== record.generation || e.session_id !== record.session_id || e.launch_nonce !== record.launch_nonce) return;
          record.wake_cursor = { event_id: e.active?.id || null, handled_fingerprint: e.handled_fingerprint, attention_pending: e.attention_pending, blocker: e.blocker };
          atomicJson(file, record);
        } catch (e) { record.blocker = e.message; atomicJson(file, record); }
      };
      cursorWatch = fs.watch(path.join(root, 'events'), (_, name) => { if (name?.toString() === path.basename(cursorFile)) cursor(); });
      cursorWatch.on('error', () => { record.blocker = 'Wake cursor watcher disconnected'; atomicJson(file, record); cursor(); }); cursor();
      heartbeat = setInterval(() => {
        record.last_heartbeat_at = iso();
        if (!sameProcess(record.process_identity)) { record.state = 'needs_owner'; record.blocker = 'Native identity lost; restart ownership unverified'; }
        atomicJson(file, record);
      }, 15000);
      onReady(record);
      await new Promise(resolve => { if (signal?.aborted) resolve(); else signal?.addEventListener('abort', resolve, { once: true }); });
    } catch (e) { record.blocker = e.message; }
    finally {
      ackController.abort(); clearInterval(heartbeat); observer?.close(); cursorWatch?.close(); launcher?.removeAllListeners('error'); launcher?.removeAllListeners('exit'); record.state = 'needs_owner';
      record.blocker ||= 'Supervisor stopped; reconcile native ownership before restart'; atomicJson(file, record);
    }
    return record;
  });
}
export function checkedSession(o, root = stateRoot(), live = false) {
  binding(o, root);
  const record = readJson(sessionFile(o.role, o.goal, root));
  if (!record || record.session_id !== o.session_id || record.generation !== Number(o.generation) || record.launch_nonce !== o.nonce || record.worktree !== o.worktree || record.contract !== fs.realpathSync(o.contract) || record.principal !== o.principal) throw new Error('Session lease/nonce mismatch');
  if (live && (record.state !== 'idle' || record.effort !== 'low' || !sameProcess(record.supervisor_identity) || !sameProcess(record.process_identity))) throw new Error('Live attach/wake requires verified native writer; stopped transcript needs owner');
  return record;
}
export async function attachSession(o, { root = stateRoot(), dryRun = true } = {}) {
  privateDirs(root);
  return withLocks([path.join(root, 'locks', `attach-${roleId(o.role, o.goal)}.lock`)], async () => {
    const record = checkedSession(o, root, true), command = attachCommand(record);
    if (dryRun) return { cwd: record.worktree, command };
    // Bare interactive live attach only; no -p, pipes or configuration flags.
    const child = spawn(command[0], command.slice(1), { cwd: record.worktree, stdio: 'inherit' });
    return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  });
}
export async function releaseSession(o, root = stateRoot()) {
  privateDirs(root);
  return withLocks([sessionLock(o.role, o.goal, root), goalLock(root)], () => {
    const record = checkedSession(o, root); parentCaller(readRegistry(root), o);
    if (sameProcess(record.supervisor_identity) || sameProcess(record.process_identity) || o.native_stopped !== 'true') throw new Error('Release requires dead identities AND owner-verified native supervisor/transcript stopped');
    record.state = 'released'; record.blocker = null; record.released_at = iso(); atomicJson(sessionFile(o.role, o.goal, root), record); return record;
  });
}
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
export function resumeCommand(o, nonce) {
  const prompt = launchCommand(o, nonce).at(-1) + ' Read the current SR1 recovery receipt and existing attempts before any dispatch. Restore Monitor only for actionable work; never renew an idle wait.';
  return ['claude', '--resume', o.session_id, '--effort', 'low', '--plugin-dir', pane, '--bg', ...(o.model ? ['--model', o.model] : []), prompt];
}
// Pure command projection; never launch, rebind or change session/goal files.
export function recoverySessions(root = stateRoot(), registry = readRegistry(root)) {
  if (!registry) return [];
  const entries = [{ role: 'parent', goal: registry.parent.goal_id, authority: registry.parent },
    ...[...registry.goals].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).map(g => ({ role: 'child', goal: g.id, authority: { ...g.child, generation: g.generation } }))];
  return entries.filter(e => e.authority.session_id).map(({ role, goal, authority }) => {
    const result = { role, goal_id: goal, session_id: authority.session_id, generation: authority.generation,
      registry_revision: registry.revision, state: 'needs_owner', effort: 'low', auto_start: false,
      cwd: null, contract_ref: authority.contract_ref, plugin_dirs: [pane], attach_command: null, resume_command: null,
      reason: 'Resume parent first; verify native restart ownership and LOW; restore Monitor explicitly' };
    try {
      const worktree = registry.goals.find(g => g.id === goal)?.planning_worktree;
      const o = { role, goal, generation: authority.generation, session_id: authority.session_id, principal: authority.principal,
        worktree, contract: path.resolve(root, authority.contract_ref) };
      const b = binding(o, root), record = readJson(sessionFile(role, goal, root));
      result.cwd = b.worktree;
      if (!record?.launch_nonce || record.state === 'released') throw new Error('No held launch nonce; reconcile native session before creating a binding');
      o.nonce = record.launch_nonce; checkedSession(o, root);
      const base = ['env', `ORCH_STATE_DIR=${root}`, 'ORCH_ROLE=parent', 'ORCH_DEPTH=0', `ORCH_PRINCIPAL=${registry.parent.principal}`, process.execPath, self];
      const args = Object.entries(o).flatMap(([k, v]) => ['--' + k.replaceAll('_', '-'), String(v)]);
      const shell = argv => `cd ${quote(b.worktree)} && ${argv.map(quote).join(' ')}`;
      result.attach_command = shell([...base, 'attach', ...args]);
      result.resume_command = shell([...base, 'resume', ...args, '--native-stopped', 'true', '--live-verified', 'true']);
    } catch (e) { result.reason = e.message; }
    return result;
  });
}
export function verifyLive(o, root = stateRoot()) {
  const b = binding(o, root), nonce = randomUUID(), ack = path.join(root, 'requests', `${nonce}.session-ack.json`);
  const command = launchCommand(o, nonce);
  command[command.length - 1] = `Read ${b.contract_file}. Owner-only transport smoke: stay LOW; report actual full session ID, cwd and effective model/effort in at most 10 lines, then idle. Do not dispatch, mutate goal files or acknowledge a supervised launch; this standalone smoke has no supervisor.`;
  return [
    '# UNVERIFIED: owner runs once only; this dry-run starts nothing and writes nothing.',
    `cd ${quote(b.worktree)}`,
    `ORCH_LAUNCH_NONCE=${quote(nonce)} ORCH_ACK_FILE=${quote(ack)} ORCH_CONTRACT=${quote(b.contract_file)} ORCH_SESSION_ID=${quote(o.session_id)} ORCH_GENERATION=${quote(o.generation)} ORCH_ROLE=${quote(o.role)} ORCH_GOAL=${quote(o.goal)} ${command.map(quote).join(' ')}`,
    attachCommand({ session_id: o.session_id }).map(quote).join(' '),
    '# Verify actual full ID/cwd/effective LOW, attach/detach and native restart exclusion; retain evidence.',
    '# This standalone transport smoke does not bind a supervised launch or authorize dispatch.',
    '# Do not repeat launch after missing ack; reconcile nonce/native session first. Remote Control/inbox remain separate gates.'
  ].join('\n');
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args, dryRun = rest.includes('--dry-run');
  const o = options(rest.filter(x => x !== '--dry-run'));
  if (command === 'verify-live') { if (!dryRun) throw new Error('verify-live requires --dry-run; owner executes smoke'); console.log(verifyLive(o)); return; }
  if (command === 'acknowledge') {
    const root = stateRoot(), file = path.resolve(o.file || '');
    if (!path.isAbsolute(o.file || '') || path.dirname(file) !== path.join(root, 'requests') || !file.endsWith('.session-ack.json')) throw new Error('Acknowledgement must target absolute requests path');
    const ack = readJson(o.observation), record = readJson(sessionFile(ack.role, ack.goal_id, root));
    checkedAck(ack, record); if (file !== path.join(root, 'requests', `${record.launch_nonce}.session-ack.json`)) throw new Error('Ack nonce path mismatch');
    if (fs.existsSync(file)) throw new Error('Acknowledgement already exists'); atomicJson(file, ack); return;
  }
  if (command === 'attach') { console.log(JSON.stringify(await attachSession(o, { dryRun }))); return; }
  if (command === 'observe') {
    const root = stateRoot(), record = checkedSession(o, root, true), turns = Number(o.turns);
    if (!Number.isSafeInteger(turns) || turns < 0 || (record.usage.turns != null && turns < record.usage.turns)) throw new Error('Invalid/regressing usage checkpoint');
    atomicJson(path.join(root, 'requests', `${record.launch_nonce}.observation.json`), { launch_nonce: record.launch_nonce, session_id: record.session_id, generation: record.generation, turns }); return;
  }
  if (command === 'release') { console.log(JSON.stringify(await releaseSession(o))); return; }
  if (!['launch', 'reconcile', 'resume'].includes(command)) throw new Error('Expected launch, reconcile, resume, attach, release, observe, acknowledge or verify-live');
  if (command === 'reconcile') o.reconcile = 'true';
  if (command === 'resume') o.resume = 'true';
  const controller = new AbortController();
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => controller.abort());
  console.log(JSON.stringify(await launchSession(o, { signal: controller.signal, onReady: record => console.log(JSON.stringify({ state: record.state, session_id: record.session_id, launch_nonce: record.launch_nonce, attach_command: attachCommand(record).join(' ') })) })));
}
if (isMain(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
