#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stateRoot, configRoot, bootId, init, atomicJson, readJson, taskPath, lockPath, withLocks, procIdentity, iso, isMain } from './common.mjs';
import { checkTaskGrant, goalLock, readRegistry } from './goals.mjs';
import { recoverySessions } from './sessions.mjs';
import { interruptionReason, journalShutdownWindows } from './interruption.mjs';

const dispatchFile = fileURLToPath(new URL('./dispatch.mjs', import.meta.url));
const terminal = new Set(['done', 'failed', 'timeout', 'cancelled', 'stopped', 'needs_owner', 'done (unverified exit)', 'exited (unknown)']);
const recoverable = new Set(['running', 'queued', 'stalled', 'interrupting', 'interrupted']);
const parentPrompt = 'Spot recovery: reconcile ~/.local/state/orch/status.json and continue the active goals; report only blockers.';
export const taskLocks = (task, root) => [path.join(root, 'locks', `task-${task.id}.lock`), lockPath(task.worktree, root), ...(task.session_id ? [path.join(root, 'locks', `session-${task.executor.cli}-${task.session_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.lock`)] : [])];

export function parentResume(config = configRoot()) {
  try {
    const id = fs.readFileSync(path.join(config, 'parent-session'), 'utf8').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) throw new Error('Invalid parent session id');
    return { state: 'needs_owner', session_id: id, resume_command: `claude --resume ${id}`, auto_start: false };
  } catch (e) { return { state: 'needs_owner', resume_command: null, auto_start: false, reason: e.code === 'ENOENT' ? 'Configure ~/.config/orch/parent-session' : e.message }; }
}

// Called only while task/worktree/session locks are held. Reserve durably BEFORE
// dispatch; an ambiguous launch is never retried in the same boot.
export function reconcileTask(file, root, currentBoot, shutdownWindows = []) {
  const task = readJson(file);
  if (taskPath(task.id, root) !== file || task.schema_version !== 1) throw new Error('Invalid task record');
  if (task.recovery?.boot_id === currentBoot) return { id: task.id, action: 'already_reconciled' };
  const identities = [task.supervisor_identity, task.process_identity].filter(Boolean);
  const oldBoot = identities[0]?.boot_id || task.boot_id;
  const interrupted = interruptionReason(task, root, oldBoot, shutdownWindows);
  if ((terminal.has(task.state) || task.finished_at) && !interrupted) return { id: task.id, action: 'terminal' };
  if (oldBoot === currentBoot || identities.some(identity => identity.boot_id === currentBoot)) return { id: task.id, action: 'same_boot' };
  const hold = reason => {
    task.state = 'needs_owner'; task.recovery = { ...task.recovery, boot_id: currentBoot, at: iso(), reason };
    atomicJson(file, task); return { id: task.id, action: 'needs_owner', reason };
  };
  if (typeof oldBoot !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(oldBoot) || identities.some(identity => !identity.boot_id || identity.boot_id !== oldBoot)) return hold('Missing or conflicting boot identity');
  if (!recoverable.has(task.state) && !interrupted) return hold('Unrecognized nonterminal task state');
  // Changed boot proves the previous local processes no longer exist. Preserve
  // the interrupted attempt for dispatch's normal history append.
  const previousState = task.state;
  task.state = 'interrupted'; task.finished_at ||= iso();
  task.interrupted_attempt = { attempt_id: task.attempt_id, state: 'interrupted', previous_state: previousState, reason: interrupted || 'Boot changed before clean exit was recorded', boot_id: oldBoot, finished_at: task.finished_at, log_path: task.log_path, exit_code: task.exit_code, exit_signal: task.exit_signal };
  const count = task.auto_resume_count ?? 0;
  const limit = Math.min(2, task.max_auto_resume ?? 2);
  if (task.paid === true || task.card?.paid === true) return hold('Paid/live card requires owner reconciliation');
  if (task.adopted || task.read_only) return hold('Adopted worker has no dispatcher ownership');
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(limit) || limit < 0) return hold('Invalid auto-resume budget');
  if (count >= limit) return hold('Auto-resume limit reached');
  if (!task.session_id || typeof task.resume_text !== 'string' || !task.resume_text.trim() || !['codex', 'cursor', 'agy', 'claude'].includes(task.executor?.cli)) return hold('No exact resumable session/continuation');
  try { checkTaskGrant(task, root, true); } catch (e) { return hold(`Goal recovery denied: ${e.message}`); }
  task.auto_resume_count = count + 1;
  task.recovery = { boot_id: currentBoot, from_boot_id: oldBoot, at: iso(), attempt_id: task.attempt_id, status: 'reserved' };
  atomicJson(file, task);
  return { id: task.id, action: 'resume', attempt_id: task.attempt_id, resume_text: task.resume_text, auto_resume_count: task.auto_resume_count };
}

export async function runCommand(command, args, env = process.env, timeout = 0, outputLimit = 4096) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'], ...(timeout ? { signal: AbortSignal.timeout(timeout) } : {}) });
    let out = '', err = '';
    child.stdout.on('data', data => { out = (out + data).slice(-outputLimit); });
    child.stderr.on('data', data => { err = (err + data).slice(-4096); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `Command failed (${code})`)));
  });
}

async function liveClaudeOwner(id, env) {
  // agents --json includes interactive owners whose argv no longer carries an
  // ID. Query failure is ambiguous ownership, never permission to start a copy.
  const agents = JSON.parse(await runCommand('claude', ['agents', '--json'], env, 15000, 1024 * 1024));
  if (!Array.isArray(agents)) throw new Error('Invalid Claude agents response');
  for (const owner of agents.filter(agent => agent?.sessionId === id)) {
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('Claude owner PID unknown');
    if (procIdentity(owner.pid)) return { pid: owner.pid, source: 'claude agents --json' };
  }
  // Also exclude an in-flight native launcher not yet registered by Claude.
  for (const pid of fs.readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    const live = procIdentity(pid), args = live?.cmdline;
    if (!args || !args.slice(0, 3).some(arg => path.basename(arg) === 'claude')) continue;
    if (args.some((arg, i) => (['--resume', '-r', '--session-id'].includes(arg) && args[i + 1] === id) || ['--resume=', '--session-id='].some(flag => arg === flag + id))) return { pid: live.pid, source: '/proc' };
  }
  return null;
}

async function autoResumeParent(summary, file, { root, config, currentBoot, claudeEnv }) {
  // Preserve reservation even after failure/crash or parent-session changes.
  if (summary.parent_auto_resume?.reserved_at) return;
  const parent = parentResume(config);
  const hold = reason => { summary.parent_auto_resume = { state: 'needs_owner', auto_start: false, session_id: parent.session_id ?? null, reason }; };
  if (fs.existsSync(path.join(config, 'no-claude-autoresume'))) { hold('Claude auto-resume opted out'); return; }
  if (!parent.session_id) { hold(parent.reason); return; }
  try {
    // Share the native-session lease with sessions.mjs; the outer recovery
    // lease serializes boot summaries. No goal/session authority is rebound.
    await withLocks([path.join(root, 'locks', 'orchestrator-parent.lock'), path.join(root, 'locks', `claude-${parent.session_id}.lock`), goalLock(root)], async () => {
      const registry = readRegistry(root);
      // A registry-bound parent can predate sessions.mjs supervision. A missing
      // launch nonce holds that helper's commands, not native exact-ID recovery.
      if (registry?.parent.session_id && registry.parent.session_id !== parent.session_id) throw new Error('Parent registry/session binding requires owner reconciliation');
      const owner = await liveClaudeOwner(parent.session_id, claudeEnv);
      if (owner) { summary.parent_auto_resume = { state: 'already_live', auto_start: false, session_id: parent.session_id, owner }; return; }
      const args = ['--bg', '--resume', parent.session_id, '--effort', 'low', parentPrompt];
      summary.parent_auto_resume = { state: 'reserved', auto_start: true, boot_id: currentBoot, session_id: parent.session_id, reserved_at: iso(), command: ['claude', ...args], attach_command: `claude attach ${parent.session_id}` };
      atomicJson(file, summary); // Ambiguous launch consumes this boot's attempt.
      try {
        summary.parent_auto_resume.output = await runCommand('claude', args, claudeEnv, 15000);
        summary.parent_auto_resume.state = 'resume_requested';
      } catch (e) {
        summary.parent_auto_resume.state = 'needs_owner';
        summary.parent_auto_resume.reason = `Claude resume unconfirmed; no retry this boot: ${e.message}`;
      }
      atomicJson(file, summary);
    });
  } catch (e) {
    if (summary.parent_auto_resume?.reserved_at) {
      summary.parent_auto_resume.state = 'needs_owner';
      summary.parent_auto_resume.reason = `Claude resume unconfirmed; no retry this boot: ${e.message}`;
    } else hold(`Claude auto-resume held: ${e.message}`);
  }
}

export async function recover({ root = stateRoot(), currentBoot = bootId(), config = configRoot(), dispatch = dispatchFile, claudeEnv = process.env, shutdownJournal = journalShutdownWindows, restart = () => runCommand('systemctl', ['--user', '--no-block', 'restart', 'orch-collect.service', 'orch-serve.service']) } = {}) {
  init(root);
  if (!/^[a-zA-Z0-9_-]+$/.test(currentBoot)) throw new Error('Invalid boot id');
  return await withLocks([path.join(root, 'locks', 'recovery.lock')], async () => {
    const file = path.join(root, `recovery-${currentBoot}.json`);
    const summary = readJson(file, { schema_version: 1, boot_id: currentBoot, started_at: iso(), tasks: [] });
    summary.parent = parentResume(config);
    try {
      const registry = readRegistry(root);
      summary.orchestrators = recoverySessions(root, registry);
      if (registry) {
        const parent = summary.orchestrators.find(s => s.role === 'parent');
        if ((summary.parent.session_id && summary.parent.session_id !== registry.parent.session_id) || (fs.existsSync(path.join(config, 'parent-session')) && !summary.parent.session_id)) {
          summary.parent = { ...summary.parent, resume_command: null, reason: 'parent-session differs from goals.json; reconcile owner binding, do not rebind' };
          if (parent) { parent.resume_command = null; parent.attach_command = null; parent.reason = summary.parent.reason; }
        } else if (parent) summary.parent = parent;
        else summary.parent = { state: 'needs_owner', resume_command: null, auto_start: false, reason: 'Parent is not bound in goals.json' };
      }
    } catch (e) {
      summary.orchestrators = []; summary.parent = { state: 'needs_owner', resume_command: null, auto_start: false, reason: `Registry/session recovery held: ${e.message}` };
    }
    atomicJson(file, summary);
    const shutdownByBoot = new Map();
    for (const name of fs.readdirSync(path.join(root, 'tasks')).filter(name => name.endsWith('.json')).sort()) {
      let result;
      try {
        const taskFile = path.join(root, 'tasks', name), task = readJson(taskFile);
        if (taskPath(task.id, root) !== taskFile) throw new Error('Task id/path mismatch');
        // Fast reads avoid contending with active writers on this boot.
        if (task.supervisor_identity?.boot_id === currentBoot || task.process_identity?.boot_id === currentBoot || task.boot_id === currentBoot) continue;
        const oldBoot = task.supervisor_identity?.boot_id || task.process_identity?.boot_id || task.boot_id;
        if (task.state === 'failed' && !shutdownByBoot.has(oldBoot)) shutdownByBoot.set(oldBoot, shutdownJournal(oldBoot));
        const shutdownWindows = shutdownByBoot.get(oldBoot) || [];
        if ((terminal.has(task.state) || task.finished_at) && !interruptionReason(task, root, oldBoot, shutdownWindows)) continue;
        const locks = taskLocks(task, root);
        result = await withLocks([...locks, goalLock(root)], () => {
          if (JSON.stringify(taskLocks(readJson(taskFile), root)) !== JSON.stringify(locks)) throw new Error('Task ownership changed before locking');
          return reconcileTask(taskFile, root, currentBoot, shutdownWindows);
        });
        if (result.action === 'already_reconciled') continue;
        if (result.action === 'resume') {
          const { resume_text, ...publicResult } = result;
          result = publicResult;
          summary.tasks.push({ ...result, action: 'reserved' }); atomicJson(file, summary);
          try {
            await runCommand(process.execPath, [dispatch, 'resume', task.id, resume_text, '--auto-recover', currentBoot, '--expected-attempt', result.attempt_id], { ...process.env, ORCH_STATE_DIR: root });
            result.action = 'resumed';
          } catch (e) {
            result.action = 'needs_owner'; result.reason = `Resume unconfirmed: ${e.message}`;
            // Only update an unconsumed reservation. A pending/live supervisor
            // may own the locks after an ambiguous acknowledgement timeout.
            try { await withLocks(locks, () => {
              const latest = readJson(taskFile);
              if (latest.attempt_id === result.attempt_id && latest.recovery?.status === 'reserved') {
                latest.state = 'needs_owner'; latest.recovery.reason = result.reason; atomicJson(taskFile, latest);
              }
            }); } catch { /* Pending writer retains sole authority. */ }
          }
        }
      } catch (e) { result = { id: name.slice(0, -5), action: 'held', reason: e.message }; }
      summary.tasks = [...summary.tasks.filter(item => item.id !== result.id), result]; atomicJson(file, summary);
    }
    await autoResumeParent(summary, file, { root, config, currentBoot, claudeEnv });
    try { await restart(); summary.services = 'restart_requested'; } catch (e) { summary.services = e.message; }
    summary.finished_at = iso(); atomicJson(file, summary);
    return summary;
  });
}
if (isMain(import.meta.url)) recover().then(summary => console.log(JSON.stringify(summary))).catch(e => { console.error(e.message); process.exitCode = 1; });
