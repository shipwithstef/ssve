import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { iso } from './common.mjs';
export function steeringCapability(cli) {
  if (['agy', 'claude'].includes(cli)) return { mode: 'stdin', protocol: 'stream-json' };
  if (cli === 'codex') {
    const probe = spawnSync('codex', ['app-server', '--help'], { encoding: 'utf8', timeout: 3000, maxBuffer: 32768 });
    return { mode: 'queue', app_server_help_available: probe.status === 0,
      reason: 'exec workers have no verified app-server thread/turn ownership bridge; exact exec resume fallback' };
  }
  return { mode: 'queue', reason: 'CLI has no streaming stdin transport' };
}
export function userMessage(text, sessionId = '') {
  return JSON.stringify({ type: 'user', session_id: sessionId, message: { role: 'user', content: text }, parent_tool_use_id: null }) + '\n';
}
export function enqueueSteer(task, text) {
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 8192) throw new Error('Steer message must be nonempty and at most 8192 bytes');
  task.steer_queue ||= [];
  if (task.steer_queue.length >= 100) throw new Error('Steer queue full');
  const entry = { id: randomUUID(), text, at: iso() };
  task.steer_queue.push(entry); task.steering_blocker = null;
  return entry;
}
// Claim before sending/spawning. Ambiguous crash windows never permit replay.
export function consumeSteers(task, ids, mode) {
  const chosen = (task.steer_queue || []).filter(e => ids.includes(e.id));
  if (chosen.length !== ids.length) throw new Error('Steer delivery changed before admission');
  task.steer_queue = (task.steer_queue || []).filter(e => !ids.includes(e.id));
  task.steer_deliveries = [...(task.steer_deliveries || []), ...chosen.map(e => ({ ...e, attempt_id: task.attempt_id, mode, state: 'claimed', claimed_at: iso() }))];
  return chosen.map(e => e.text).join('\n\n');
}
export function autoResumeBudget(task) {
  const count = task.auto_resume_count ?? 0, limit = Math.min(2, task.max_auto_resume ?? 2);
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(limit) || limit < 0) throw new Error('Invalid auto-resume budget');
  if (count >= limit) throw new Error('Auto-resume limit reached');
  if (task.paid || task.card?.paid || task.read_only || task.adopted) throw new Error('Automatic steer requires owned unpaid worker');
  return count + 1;
}
