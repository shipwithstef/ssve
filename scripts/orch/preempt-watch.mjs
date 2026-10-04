#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { stateRoot, init, bootId, readJson, atomicJson, digest, procIdentity, withLocks, iso, isMain } from './common.mjs';
import { markInterrupting } from './interruption.mjs';

export const eventsURL = 'http://169.254.169.254/metadata/scheduledevents?api-version=2020-07-01';
const instanceURL = 'http://169.254.169.254/metadata/instance?api-version=2021-02-01';
// Native HTTP bypasses proxy environment variables; no redirect or POST approval.
export function readImds(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { Metadata: 'true' } }, response => {
      let body = '', size = 0;
      response.on('data', data => { size += data.length; if (size > 256 * 1024) request.destroy(new Error('IMDS response too large')); else body += data; });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode !== 200) { reject(new Error(`IMDS HTTP ${response.statusCode}`)); return; }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('IMDS request exceeded 2s')), 2000);
    request.once('close', () => clearTimeout(timer)); request.once('error', reject);
  });
}
export function signalCollector(root) {
  const identity = readJson(path.join(root, 'collector.json'))?.identity;
  const live = identity && procIdentity(identity.pid);
  if (!live || live.boot_id !== identity.boot_id || live.start_ticks !== identity.start_ticks || JSON.stringify(live.cmdline) !== JSON.stringify(identity.cmdline)) throw new Error('No verified collector watch process');
  process.kill(identity.pid, 'SIGUSR1');
}
export function checkpointEvents(payload, { root = stateRoot(), vmName, currentBoot = bootId(), signal = () => signalCollector(root) } = {}) {
  if (!Array.isArray(payload.Events)) throw new Error('Invalid Scheduled Events payload');
  if (!vmName) throw new Error('VM resource name required');
  const recorded = [];
  for (const event of payload.Events) {
    if (!['Preempt', 'Terminate'].includes(event.EventType) || !['Scheduled', 'Started'].includes(event.EventStatus) || !Array.isArray(event.Resources) || !event.Resources.includes(vmName) || typeof event.EventId !== 'string') continue;
    const marker = path.join(root, `checkpoint-${currentBoot}-${digest(event.EventId)}.json`);
    if (fs.existsSync(marker)) { markInterrupting(root, currentBoot, event, readJson(marker).requested_at); continue; }
    const checkpoint = { boot_id: currentBoot, requested_at: iso(), event, collector_signal: 'pending' };
    atomicJson(marker, checkpoint); atomicJson(path.join(root, 'checkpoint.json'), checkpoint);
    checkpoint.interrupting_tasks = markInterrupting(root, currentBoot, event, checkpoint.requested_at);
    try { signal(); checkpoint.collector_signal = 'sent'; } catch (e) { checkpoint.collector_signal = e.message; }
    atomicJson(marker, checkpoint); atomicJson(path.join(root, 'checkpoint.json'), checkpoint);
    recorded.push(checkpoint);
  }
  return recorded;
}
export async function watch() {
  const root = stateRoot(); init(root);
  let vmName = process.env.ORCH_VM_NAME, stopping = false, wake;
  const stop = () => { stopping = true; wake?.(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  try {
    await withLocks([path.join(root, 'locks', 'preempt.lock')], async () => {
      while (!stopping) {
        const start = Date.now();
        try {
          if (!vmName) vmName = (await readImds(instanceURL)).compute?.name;
          const events = await readImds(eventsURL);
          const checkpoints = checkpointEvents(events, { root, vmName });
          atomicJson(path.join(root, 'preempt-health.json'), { at: iso(), vm_name: vmName, healthy: true, event_count: events.Events.length });
          if (checkpoints.length) console.log(JSON.stringify(checkpoints));
        } catch (e) { atomicJson(path.join(root, 'preempt-health.json'), { at: iso(), healthy: false, error: e.message }); console.error(e.message); }
        if (!stopping) await new Promise(resolve => { const timer = setTimeout(done, Math.max(0, 5000 - (Date.now() - start))); function done() { clearTimeout(timer); wake = null; resolve(); } wake = done; });
      }
    });
  } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }
}
if (isMain(import.meta.url)) watch().catch(e => { console.error(e.message); process.exitCode = 1; });
