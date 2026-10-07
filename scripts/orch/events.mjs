#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { digest, readJson, atomicJson, withLocks, stateRoot, init, isMain, options } from './common.mjs';
import { checkedSession, roleId } from './sessions.mjs';
import { readRegistry } from './goals.mjs';

const HOUR = 3600000, MAX_MONITOR = 30 * 60000;
const fileFor = (o, root) => path.join(root, 'events', `${roleId(o.role, o.goal)}.json`);
const lockFor = (o, root) => path.join(root, 'locks', `events-${roleId(o.role, o.goal)}.lock`);
function dirs(root) { init(root); fs.mkdirSync(path.join(root, 'events'), { recursive: true, mode: 0o700 }); }
function ledger(o, root) {
  const old = readJson(fileFor(o, root));
  let current = old;
  if (old && (old.generation !== Number(o.generation) || old.session_id !== o.session_id || old.launch_nonce !== o.nonce)) {
    const session = checkedSession(o, root, true);
    if (old.generation === Number(o.generation) && old.session_id === o.session_id && session.resume_nonce_history?.includes(old.launch_nonce)) {
      // An owner-restored SAME transcript preserves handled/queued event IDs;
      // only the supervisor nonce rotates. Replaying a pending ID is idempotent.
      current = { ...old, launch_nonce: o.nonce }; atomicJson(fileFor(o, root), current);
      return current;
    }
    if (old.generation >= Number(o.generation)) throw new Error('Event cursor belongs to conflicting binding');
    // checkedSession has already proved the NEW live lease. Supervisor launch
    // only permits this after explicit old-writer/native release and handoff.
    const archive = path.join(root, 'events', 'archive'); fs.mkdirSync(archive, { recursive: true, mode: 0o700 });
    const file = path.join(archive, `${roleId(o.role, o.goal)}-${old.generation}.json`);
    if (!fs.existsSync(file)) atomicJson(file, old);
    current = null;
  }
  return current || { schema_version: 1, generation: Number(o.generation), session_id: o.session_id, launch_nonce: o.nonce,
    handled_fingerprint: null, active: null, messages: {}, blocker: null, attention_pending: false };
}
// Exclude heartbeat, elapsed, stream and usage snapshots. Only actionable state
// wakes children; parent sees authority/blockers, not every worker completion.
export function actionable(status, o) {
  const blockers = rows => (rows || []).map(b => ({ code: b.code, description: b.description }));
  const selectGoal = g => ({ id: g.id, priority: g.priority, desired_state: g.desired_state, child: g.child && { session_id: g.child.session_id, generation: g.child.generation },
    budget: g.budget, blockers: blockers(g.blockers), acceptance_refs: g.acceptance_refs,
    tasks: o.role === 'child' ? (status.tasks || []).filter(t => t.goal_id === g.id).map(t => ({ id: t.id, attempt_id: t.attempt_id, state: t.state, verification_state: t.verification_state, blockers: blockers(t.blockers), artifacts: t.artifacts })) : undefined });
  return o.role === 'child' ? (status.goals || []).filter(g => g.id === o.goal).map(selectGoal) : (status.goals || []).map(selectGoal);
}
export async function reconcileWake(o, root = stateRoot()) {
  dirs(root);
  return withLocks([lockFor(o, root)], () => {
    checkedSession(o, root, true);
    const status = readJson(path.join(root, 'status.json'));
    if (!status || !Number.isSafeInteger(status.revision) || !Array.isArray(status.goals) || !Array.isArray(status.tasks)) throw new Error('Status unreadable; preserve cursor and rescan once after repair');
    const state = ledger(o, root), fingerprint = digest(JSON.stringify(actionable(status, o)));
    if (state.active) {
      // A busy recipient reconciles its delivered snapshot first. Keep latest
      // state on disk; ack triggers a single follow-up if state still differs.
      return state.active;
    }
    if (fingerprint === state.handled_fingerprint) return null;
    const event = { v: 1, id: digest(`${o.session_id}:${o.generation}:${status.revision}:${fingerprint}`), type: 'STATUS_CHANGED',
      goal_id: o.goal, generation: Number(o.generation), registry_revision: status.registry_revision,
      ref: 'status.json', summary: 'Reconcile actionable goal files', fingerprint, status_revision: status.revision, state: 'queued' };
    state.active = event; state.attention_pending = true; atomicJson(fileFor(o, root), state); return event;
  });
}
export async function acknowledgeWake(o, id, root = stateRoot()) {
  dirs(root);
  return withLocks([lockFor(o, root)], () => {
    checkedSession(o, root, true); const state = ledger(o, root);
    if (state.active?.id !== id) throw new Error('Stale/foreign wake acknowledgement');
    state.handled_fingerprint = state.active.fingerprint; state.active = null;
    state.attention_pending = false; state.blocker = null; atomicJson(fileFor(o, root), state); return state;
  });
}
export async function deliveryBlocker(o, reason, root = stateRoot()) {
  dirs(root);
  return withLocks([lockFor(o, root)], () => {
    checkedSession(o, root); const state = ledger(o, root);
    if (state.blocker === reason && state.attention_pending) return state;
    state.blocker = reason; state.attention_pending = true; atomicJson(fileFor(o, root), state); return state;
  });
}
// The bridge is a bounded Monitor source, NOT an event plugin. Startup/reconnect
// and watcher errors rescan once. Its single expiry timer never renews itself.
export function watchStatus(o, { root = stateRoot(), durationMs = 5 * 60000, debounceMs = 30, emit = e => console.log(JSON.stringify(e)), signal, watcherFactory = fs.watch } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_MONITOR) throw new Error('Monitor duration must be 1 ms..30 min');
  dirs(root); checkedSession(o, root, true);
  let debounce, deadline, running = false, dirty = false, stopped = false;
  const emitted = new Set(), watchers = [];
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  const scan = async () => {
    if (stopped) return;
    if (running) { dirty = true; return; }
    running = true;
    try {
      const event = await reconcileWake(o, root);
      if (!stopped && event && !emitted.has(event.id)) { emitted.add(event.id); emit(event); }
    } catch (e) {
      // Fail closed while retaining pending state; another actual fs change can
      // repair delivery. No timer retry and no model wake for watcher health.
      try { await deliveryBlocker(o, e.message, root); } catch { /* stale binding */ }
    } finally { running = false; if (dirty) { dirty = false; schedule(); } }
  };
  function schedule() { if (stopped) return; clearTimeout(debounce); debounce = setTimeout(scan, debounceMs); }
  const close = async reason => {
    if (stopped) return; stopped = true; clearTimeout(debounce); clearTimeout(deadline);
    for (const w of watchers) w.close(); signal?.removeEventListener('abort', abort);
    if (reason === 'monitor_expired') { try { await deliveryBlocker(o, 'Monitor expired; restore only at actionable work/resume', root); } catch { /* stale */ } }
    finish(reason);
  };
  const abort = () => { void close('stopped'); };
  const guarded = withLocks([path.join(root, 'locks', `monitor-${roleId(o.role, o.goal)}.lock`)], async () => {
    try {
      for (const dir of [root, path.join(root, 'events')]) {
        const watcher = watcherFactory(dir, (_, name) => {
          if (!name || (dir === root ? name.toString() === 'status.json' : name.toString() === path.basename(fileFor(o, root)))) schedule();
        });
        watcher.on('error', () => { watcher.close(); void deliveryBlocker(o, 'Watcher overflow/disconnect; one rescan, owner must restore watch', root).catch(() => {}); schedule(); });
        watchers.push(watcher);
      }
      deadline = setTimeout(() => { void close('monitor_expired'); }, durationMs);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort(); else void scan();
      return await done;
    } finally { await close('stopped'); }
  });
  return { done: guarded, close: async reason => { await close(reason); return guarded; }, rescan: scan };
}
function envelope(message) {
  if (Buffer.byteLength(JSON.stringify(message)) > 1024 || message?.v !== 1 || typeof message.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(message.id) || !['DECISION', 'DECISION_REQUIRED', 'DECISION_FAILED'].includes(message.type) || typeof message.summary !== 'string' || message.summary.split('\n').length > 10 || !Number.isSafeInteger(message.generation) || !Number.isSafeInteger(message.registry_revision) || typeof message.ref !== 'string') throw new Error('Invalid <=1 KiB/10-line message envelope');
}
export async function receiveMessage(o, message, { root = stateRoot(), senderSession, durable, delivery = 'accepted', notifyUntil = null, now = Date.now() } = {}) {
  dirs(root); envelope(message);
  return withLocks([lockFor(o, root)], () => {
    checkedSession(o, root, true);
    const registry = readRegistry(root), goal = registry.goals.find(g => g.id === message.goal_id);
    if (!goal || (o.role === 'child' && message.goal_id !== o.goal) || message.generation !== goal.generation || message.registry_revision !== registry.revision) return { ignored: 'stale_or_foreign' };
    const decision = message.type === 'DECISION';
    if ((decision ? o.role !== 'child' || senderSession !== registry.parent.session_id : o.role !== 'parent' || senderSession !== goal.child.session_id) || !senderSession) return { ignored: 'foreign_direction' };
    const state = ledger(o, root), key = `${senderSession}:${message.goal_id}:${message.generation}:${message.id}`;
    if (state.messages[key]?.state === 'handled') return { ignored: 'duplicate' };
    const prior = state.messages[key], deadline = prior?.notify_until ?? notifyUntil;
    // Persist the first one-shot subscription deadline. Reload/duplicate delivery
    // cannot renew it by omitting or extending provider metadata.
    if (deadline != null && (!Number.isFinite(deadline) || deadline < now || deadline > now + 12 * HOUR || (prior?.notify_until != null && notifyUntil != null && notifyUntil !== prior.notify_until))) {
      state.messages[key] = { state: 'held', notify_until: deadline, ref: message.ref };
      state.blocker = 'Idle notification expired/invalid; reconcile unresolved decision once'; state.attention_pending = true;
      atomicJson(fileFor(o, root), state); return { held: 'notification_expired' };
    }
    if (delivery !== 'accepted') {
      state.messages[key] = { state: 'held', notify_until: deadline, ref: message.ref };
      state.blocker = 'Inbox refused; reconcile durable decision, no retry loop'; state.attention_pending = true;
      atomicJson(fileFor(o, root), state); return { held: 'inbox_refused' };
    }
    // Reconciliation is the caller's bounded file check, never message consent.
    // It must prove the exact durable ref and committed revision before ack.
    if (typeof durable !== 'function') return { ignored: 'missing_durable_counterpart' };
    state.messages[key] = { state: 'queued', registry_revision: message.registry_revision, ref: message.ref, notify_until: deadline };
    state.attention_pending = true; atomicJson(fileFor(o, root), state);
    if (durable(message, registry, goal) !== true) return { ignored: 'missing_durable_counterpart' };
    state.messages[key] = { state: 'handled', registry_revision: message.registry_revision, ref: message.ref, notify_until: deadline };
    state.blocker = null; state.attention_pending = !!state.active || Object.values(state.messages).some(m => m.state === 'queued');
    atomicJson(fileFor(o, root), state); return { reconciled: true, id: message.id };
  });
}
export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args, o = options(rest);
  if (command === 'ack') { console.log(JSON.stringify(await acknowledgeWake(o, o.event))); return; }
  if (command !== 'watch') throw new Error('Expected watch or ack');
  const controller = new AbortController(); for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => controller.abort());
  await watchStatus(o, { signal: controller.signal, durationMs: Number(o.minutes || 5) * 60000 }).done;
}
if (isMain(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
