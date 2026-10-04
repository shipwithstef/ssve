import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { atomicJson, readJson, taskPath, iso } from './common.mjs';

// Supervisors hold writer leases for their lifetime. This separate, short lock
// serializes task metadata with the preemption observer without stealing a lease.
export function updateTaskRecord(id, root, update) {
  const file = taskPath(id, root);
  const fd = fs.openSync(path.join(root, 'locks', `record-${id}.lock`), 'a', 0o600);
  try {
    const locked = spawnSync('flock', ['-w', '2', '3'], { stdio: ['ignore', 'ignore', 'pipe', fd], timeout: 3000 });
    if (locked.error || locked.status !== 0) throw new Error('Task record lock unavailable');
    return update(readJson(file));
  } finally { fs.closeSync(fd); }
}

export function markInterrupting(root, currentBoot, event, at = iso()) {
  const marked = [];
  for (const name of fs.readdirSync(path.join(root, 'tasks')).filter(name => name.endsWith('.json'))) {
    const file = path.join(root, 'tasks', name), task = readJson(file);
    if (!task) continue;
    if (taskPath(task.id, root) !== file) throw new Error('Task id/path mismatch');
    updateTaskRecord(task.id, root, latest => {
      if (!latest || latest.finished_at || latest.owner_stop_requested || !['running', 'queued', 'stalled', 'interrupting'].includes(latest.state)) return;
      const boot = latest.supervisor_identity?.boot_id || latest.process_identity?.boot_id || latest.boot_id;
      if (boot !== currentBoot) return;
      latest.interruption = { attempt_id: latest.attempt_id, boot_id: currentBoot, at, reason: event.EventType, event_id: event.EventId };
      latest.state = 'interrupting'; atomicJson(taskPath(latest.id, root), latest); marked.push(latest.id);
    });
  }
  return marked;
}

// Read only shutdown-specific journal entries from the exact prior boot. Missing
// journal permissions/data is absence of evidence, never a generic retry grant.
export function journalShutdownWindows(oldBoot, env = process.env) {
  if (!/^[a-f0-9-]{32,36}$/.test(oldBoot)) return [];
  const result = spawnSync('journalctl', ['--boot', oldBoot.replaceAll('-', ''), '--no-pager', '--output=json', '--grep=scheduled-shutdown|Shutdown request received|System is powering down|Shutting down\\.|Reached target shutdown.target'], { env, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) return [];
  const windows = [];
  for (const line of result.stdout.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line), at = Number(entry.__REALTIME_TIMESTAMP) / 1000;
      if (entry._BOOT_ID !== oldBoot.replaceAll('-', '') || !Number.isFinite(at)) continue;
      const message = String(entry.MESSAGE || '');
      // The incident's platform observer logs scheduled-shutdown before systemd
      // begins stopping units; workers can already exit 1 at this timestamp.
      if (message.includes('scheduled-shutdown')) {
        const notice = JSON.parse(message);
        if (notice.event !== 'scheduled-shutdown' || !['Preempt', 'Terminate'].includes(notice.azure_event?.EventType)) continue;
      } else if (!['systemd', 'systemd-logind', 'kernel'].includes(entry.SYSLOG_IDENTIFIER)) continue;
      windows.push({ from: at - 30000, to: at + 120000, source: 'journal', boot_id: oldBoot });
    } catch { /* Ignore malformed journal entries. */ }
  }
  return windows;
}

export function interruptionReason(task, root, oldBoot, windows = []) {
  if (task.owner_stop_requested || ['needs_owner', 'stopped', 'cancelled', 'timeout', 'done', 'done (unverified exit)', 'exited (unknown)'].includes(task.state)) return null;
  if (task.interruption?.attempt_id === task.attempt_id && task.interruption.boot_id === oldBoot) return task.interruption.reason;
  if (task.state === 'interrupted' || task.state === 'interrupting') return task.state;
  if (task.state !== 'failed') return null;
  if (['SIGTERM', 'SIGKILL', 'SIGINT'].includes(task.exit_signal)) return `Worker exited with ${task.exit_signal}`;
  if (!task.finished_at && task.exit_recorded_boot_id !== oldBoot) return 'Boot changed before clean exit was recorded';
  const finished = Date.parse(task.finished_at);
  if (!Number.isFinite(finished)) return null;
  if (windows.some(w => w.boot_id === oldBoot && finished >= w.from && finished <= w.to)) return 'Exit within journal shutdown window';
  for (const name of fs.readdirSync(root).filter(name => name.startsWith(`checkpoint-${oldBoot}-`) && name.endsWith('.json'))) {
    const checkpoint = readJson(path.join(root, name));
    const at = Date.parse(checkpoint?.requested_at);
    if (checkpoint?.boot_id === oldBoot && ['Preempt', 'Terminate'].includes(checkpoint.event?.EventType) && finished >= at - 30000 && finished <= at + 120000) return 'Exit within preemption checkpoint window';
  }
  return null;
}
