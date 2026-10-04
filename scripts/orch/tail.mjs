#!/usr/bin/env node
import fs from 'node:fs';
import { isMain, redact } from './common.mjs';

// One registered log, one bounded read. Large logs never enter the mod sandbox.
export function logTail(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error('Log is not a regular file');
    const start = Math.max(0, stat.size - 65536);
    const bytes = Buffer.alloc(Math.min(65536, stat.size));
    const count = fs.readSync(fd, bytes, 0, bytes.length, start);
    let lines = bytes.subarray(0, count).toString('utf8').split('\n');
    if (start) lines.shift();
    const clipped = lines.length > 200;
    lines = lines.slice(-200);
    return { path: file, at: stat.mtime.toISOString(), truncated: start > 0 || clipped, text: redact(lines.join('\n'), 65536) };
  } finally { fs.closeSync(fd); }
}
if (isMain(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node tail.mjs <registered-log-path>');
    console.log(JSON.stringify(logTail(process.argv[2])));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
