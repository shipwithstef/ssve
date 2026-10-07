#!/usr/bin/env node
// Freeze a private, bounded sample before replay; never relabel it during replay.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { evaluatePreToolObservation } from '../hooks/lib/pretool-decision-engine.mjs';
const args = process.argv.slice(2);
const opt = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const prepared = opt('--prepared');
const output = opt('--out');
if (!prepared || !output) throw Error('Usage: sample-hook-replays.mjs --prepared <50-row JSON> --out <private JSON>');
const ownerHome = opt('--log-home', os.homedir());
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const initial = JSON.parse(fs.readFileSync(prepared));
if (initial.length !== 50) throw Error('Prepared input must contain exactly 50 envelopes');
const seen = new Set(initial.map(r => hash(r.payload)));
const supported = new Set(['exec', 'functions.exec', 'exec_command', 'shell', 'shell_command', 'Bash', 'Shell', 'Read', 'Grep', 'Glob', 'Write', 'Edit', 'StrReplace', 'StrReplaceFile', 'apply_patch']);
function files(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(d => {
    const p = path.join(root, d.name);
    return d.isDirectory() ? files(p) : d.isFile() && p.endsWith('.jsonl') ? [{ p, mtime: fs.statSync(p).mtimeMs }] : [];
  });
}
const rows = initial.map((r, i) => ({ ...r, id: 'prepared-' + i, group: 'prepared', expected: 'read' }));
const inventory = {};
for (const [host, root, quota] of [['codex', '.codex/sessions', 80], ['claude', '.claude/projects', 60], ['cursor', '.cursor/projects', 60]]) {
  const candidates = [];
  const selectedFiles = files(path.join(ownerHome, root)).sort((a, b) => b.mtime - a.mtime).slice(0, 40);
  for (const { p } of selectedFiles) {
    const fd = fs.openSync(p, 'r'), size = fs.fstatSync(fd).size;
    const firstBuffer = Buffer.alloc(Math.min(size, 65536)); fs.readSync(fd, firstBuffer, 0, firstBuffer.length, 0);
    let meta = {}; try { meta = JSON.parse(firstBuffer.toString().split('\n')[0]).payload || {}; } catch {}
    const start = Math.max(0, size - 12 * 1024 * 1024), buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start); fs.closeSync(fd);
    let raw = buffer.toString(); if (start) raw = raw.slice(raw.indexOf('\n') + 1);
    let cwd = meta.cwd, offset = start + (start ? buffer.toString().indexOf('\n') + 1 : 0);
    for (const line of raw.split('\n')) {
      const originalOffset = offset; offset += Buffer.byteLength(line) + 1;
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (host === 'codex' && r.type === 'turn_context') cwd = r.payload?.cwd || cwd;
      const calls = [];
      if (host === 'codex' && r.type === 'response_item') {
        const q = r.payload || {};
        if (['function_call', 'custom_tool_call'].includes(q.type) && supported.has(q.name)) {
          let input = q.input ?? q.arguments;
          if (q.type === 'function_call') { try { input = JSON.parse(input); } catch { continue; } }
          calls.push({ session_id: meta.id || path.basename(p, '.jsonl'), cwd, tool_name: q.name, tool_input: input });
        }
      } else if (host !== 'codex' && (r.type || r.role) === 'assistant') {
        for (const q of r.message?.content || []) {
          if (q?.type !== 'tool_use' || !supported.has(q.name)) continue;
          const input = q.input;
          if (host === 'cursor') {
            // Cursor transcripts retain tool inputs but omit hook metadata.
            // Preserve those inputs; reconstruct conversation identity explicitly.
            const target = input?.working_directory || input?.path || input?.target_directory;
            calls.push({ conversation_id: path.basename(p, '.jsonl'), workspace_roots: [r.cwd || (target && path.isAbsolute(target) ? path.dirname(target) : ownerHome)], tool_name: q.name, tool_input: input });
          } else calls.push({ session_id: r.sessionId || path.basename(p, '.jsonl'), cwd: r.cwd, tool_name: q.name, tool_input: input });
        }
      }
      for (const payload of calls) candidates.push({ host, source_file: p, source_byte_offset: originalOffset, timestamp: r.timestamp || new Date(fs.statSync(p).mtimeMs).toISOString(), payload });
    }
  }
  candidates.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.source_byte_offset - a.source_byte_offset);
  // Fixed schema reads and writes; unproven programs remain an explicit third
  // category, never described as actual mutations or silently dropped.
  let selected = 0;
  const counts = { read: 0, mutation: 0, unproven: 0 };
  for (const r of candidates) {
    const digest = hash(r.payload); if (seen.has(digest)) continue; seen.add(digest);
    const name = r.payload.tool_name;
    const expected = ['Write', 'Edit', 'StrReplace', 'StrReplaceFile', 'apply_patch'].includes(name) ? 'mutation'
      : evaluatePreToolObservation(r.payload, { ...process.env, HOME: ownerHome }) ? 'read' : 'unproven';
    rows.push({ ...r, id: host + '-' + selected, group: 'additional', expected, original_sha256: digest }); counts[expected]++; selected++;
    if (selected === quota) break;
  }
  if (selected !== quota) throw Error(`Insufficient ${host} sample: ${selected}/${quota}`);
  inventory[host] = { files: selectedFiles.length, selected, ...counts };
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true, mode: 0o700 });
fs.writeFileSync(output, JSON.stringify({ schema_version: 1, owner_home: ownerHome, prepared_sha256: crypto.createHash('sha256').update(fs.readFileSync(prepared)).digest('hex'), inventory, rows }, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ prepared: 50, additional: 200, inventory }));
