import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { atomicJson, configRoot, readJson, redact } from './common.mjs';

export const defaultUpdates = {
  events: ['started', 'done', 'failed', 'interrupted', 'blocked', 'needs_owner', 'goal_state'],
  digest_minutes: 30, digest_only_on_change: true,
  channels: { log: true, web: true, pane: true, ntfy_topic: null },
  quiet_hours: null, goals: 'all',
  summary: { mode: 'none', cli: 'cursor', model: 'grok-4.7-medium', max_per_hour: 2 },
};
export function readUpdatesConfig(config = configRoot()) {
  const file = path.join(config, 'updates.json');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(config, { recursive: true, mode: 0o700 });
    // Exclusive create preserves settings written by an owner racing first boot.
    try { fs.writeFileSync(file, JSON.stringify(defaultUpdates, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  const fallback = structuredClone(defaultUpdates);
  try {
    const input = readJson(file);
    const settings = { ...fallback, ...input, channels: { ...fallback.channels, ...input.channels }, summary: { ...fallback.summary, ...input.summary } };
    if (!Array.isArray(settings.events) || settings.events.some(e => !defaultUpdates.events.includes(e))
      || !Number.isFinite(settings.digest_minutes) || settings.digest_minutes <= 0
      || typeof settings.digest_only_on_change !== 'boolean'
      || ['log', 'web', 'pane'].some(c => typeof settings.channels[c] !== 'boolean')
      || !(settings.channels.ntfy_topic === null || /^[A-Za-z0-9_-]{1,128}$/.test(settings.channels.ntfy_topic))
      || !(typeof settings.goals === 'string' || Array.isArray(settings.goals) && settings.goals.every(g => typeof g === 'string'))
      || !['none', 'cheap'].includes(settings.summary.mode)
      || settings.summary.cli !== 'cursor' || !/^grok-[\w.-]+$/.test(settings.summary.model)
      || !Number.isInteger(settings.summary.max_per_hour) || settings.summary.max_per_hour < 0 || settings.summary.max_per_hour > 2) return fallback;
    if (settings.quiet_hours !== null) {
      const { start, end, timezone = 'UTC' } = settings.quiet_hours;
      if (![start, end].every(v => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))) return fallback;
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
    }
    return settings;
  } catch { return fallback; } // Invalid settings never opt in to model calls.
}
export function inQuietHours(settings, now) {
  if (!settings.quiet_hours) return false;
  const { start, end, timezone = 'UTC' } = settings.quiet_hours;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return start === end || (start < end ? time >= start && time < end : time >= start || time < end);
}
export function selectedGoal(settings, id) {
  return settings.goals === 'all' || (Array.isArray(settings.goals) ? settings.goals.includes(id) : settings.goals === id);
}
export function cheapDigest(summary, settings, cursor, cursorFile, now, run = spawnSync) {
  if (settings.summary.mode !== 'cheap' || settings.summary.cli !== 'cursor' || !/^grok-[\w.-]+$/.test(settings.summary.model) || inQuietHours(settings, now)) return summary;
  const rateFile = path.join(path.dirname(cursorFile), 'summary-rate.json');
  try {
    const rate = readJson(rateFile, { calls: [] });
    if (!Array.isArray(rate.calls) || rate.calls.some(at => !Number.isFinite(at))) return summary;
    rate.calls = rate.calls.filter(at => at > now - 3600000);
    if (rate.calls.length >= settings.summary.max_per_hour) return summary;
    // Reserve before invoking: failed/quota-limited calls count, including after restart.
    rate.calls.push(now); atomicJson(rateFile, rate);
  } catch { return summary; }
  try {
    const result = run('cursor-agent', ['--print', '--mode', 'ask', '--trust', '--output-format', 'text', '--model', settings.summary.model,
      'Summarize this digest in one short sentence. Use only the supplied facts. Do not use tools, inspect files, or take actions.\n' + summary],
    { cwd: path.dirname(cursorFile), encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 4096, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.error || result.status !== 0 || /quota|rate.?limit|usage limit|insufficient credits|credit balance/i.test((result.stderr || '') + (result.stdout || ''))) return summary;
    const text = redact(result.stdout, 160).replace(/\s+/g, ' ').trim();
    return text ? `${summary} · ${text}` : summary;
  } catch { return summary; }
}
