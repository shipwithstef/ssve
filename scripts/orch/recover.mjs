#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stateRoot, configRoot, bootId, init, atomicJson, readJson, taskPath, lockPath, withLocks, iso, isMain } from './common.mjs';

const dispatchFile = fileURLToPath(new URL('./dispatch.mjs', import.meta.url));
const terminal = new Set(['done', 'failed', 'timeout', 'cancelled', 'stopped', 'needs_owner', 'done (unverified exit)', 'exited (unknown)']);
const recoverable = new Set(['running', 'queued', 'stalled', 'interrupted']);
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
export function reconcileTask(file, root, currentBoot) {
  const task = readJson(file);
  if (taskPath(task.id, root) !== file || task.schema_version !== 1) throw new Error('Invalid task record');
  if (terminal.has(task.state) || task.finished_at) return { id: task.id, action: 'terminal' };
  if (task.recovery?.boot_id === currentBoot) return { id: task.id, action: 'already_reconciled' };
  const identities = [task.supervisor_identity, task.process_identity].filter(Boolean);
  const oldBoot = identities[0]?.boot_id || task.boot_id;
  if (oldBoot === currentBoot || identities.some(identity => identity.boot_id === currentBoot)) return { id: task.id, action: 'same_boot' };
  const hold = reason => {
    task.state = 'needs_owner'; task.recovery = { ...task.recovery, boot_id: currentBoot, at: iso(), reason };
    atomicJson(file, task); return { id: task.id, action: 'needs_owner', reason };
  };
  if (typeof oldBoot !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(oldBoot) || identities.some(identity => !identity.boot_id || identity.boot_id !== oldBoot)) return hold('Missing or conflicting boot identity');
  if (!recoverable.has(task.state)) return hold('Unrecognized nonterminal task state');
  // Changed boot proves the previous local processes no longer exist. Preserve
  // the interrupted attempt for dispatch's normal history append.
  task.state = 'interrupted'; task.finished_at = iso();
  task.interrupted_attempt = { attempt_id: task.attempt_id, state: 'interrupted', boot_id: oldBoot, finished_at: task.finished_at, log_path: task.log_path };
  const count = task.auto_resume_count ?? 0;
  const limit = Math.min(2, task.max_auto_resume ?? 2);
  if (task.paid === true || task.card?.paid === true) return hold('Paid/live card requires owner reconciliation');
  if (task.adopted || task.read_only) return hold('Adopted worker has no dispatcher ownership');
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(limit) || limit < 0) return hold('Invalid auto-resume budget');
  if (count >= limit) return hold('Auto-resume limit reached');
  if (!task.session_id || typeof task.resume_text !== 'string' || !task.resume_text.trim() || !['codex', 'cursor', 'agy'].includes(task.executor?.cli)) return hold('No exact resumable session/continuation');
  task.auto_resume_count = count + 1;
  task.recovery = { boot_id: currentBoot, from_boot_id: oldBoot, at: iso(), attempt_id: task.attempt_id, status: 'reserved' };
  atomicJson(file, task);
  return { id: task.id, action: 'resume', attempt_id: task.attempt_id, resume_text: task.resume_text, auto_resume_count: task.auto_resume_count };
}

export async function runCommand(command, args, env = process.env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', data => { out = (out + data).slice(-4096); });
    child.stderr.on('data', data => { err = (err + data).slice(-4096); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `Command failed (${code})`)));
  });
}

export async function recover({ root = stateRoot(), currentBoot = bootId(), config = configRoot(), dispatch = dispatchFile, restart = () => runCommand('systemctl', ['--user', '--no-block', 'restart', 'orch-collect.service', 'orch-serve.service']) } = {}) {
  init(root);
  if (!/^[a-zA-Z0-9_-]+$/.test(currentBoot)) throw new Error('Invalid boot id');
  return await withLocks([path.join(root, 'locks', 'recovery.lock')], async () => {
    const file = path.join(root, `recovery-${currentBoot}.json`);
    const summary = readJson(file, { schema_version: 1, boot_id: currentBoot, started_at: iso(), tasks: [] });
    summary.parent = parentResume(config);
    atomicJson(file, summary);
    for (const name of fs.readdirSync(path.join(root, 'tasks')).filter(name => name.endsWith('.json')).sort()) {
      let result;
      try {
        const taskFile = path.join(root, 'tasks', name), task = readJson(taskFile);
        if (taskPath(task.id, root) !== taskFile) throw new Error('Task id/path mismatch');
        // Fast reads avoid contending with active writers on this boot.
        if (terminal.has(task.state) || task.finished_at || task.supervisor_identity?.boot_id === currentBoot || task.process_identity?.boot_id === currentBoot) continue;
        const locks = taskLocks(task, root);
        result = await withLocks(locks, () => {
          if (JSON.stringify(taskLocks(readJson(taskFile), root)) !== JSON.stringify(locks)) throw new Error('Task ownership changed before locking');
          return reconcileTask(taskFile, root, currentBoot);
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
    try { await restart(); summary.services = 'restart_requested'; } catch (e) { summary.services = e.message; }
    summary.finished_at = iso(); atomicJson(file, summary);
    return summary;
  });
}
if (isMain(import.meta.url)) recover().then(summary => console.log(JSON.stringify(summary))).catch(e => { console.error(e.message); process.exitCode = 1; });
