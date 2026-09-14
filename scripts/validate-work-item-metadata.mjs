#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const root = path.resolve(argValue('--root') || process.cwd());
const since = argValue('--since') || '2026-05-12';
const wiDir = path.join(root, 'docs/specs/work-items');
const failures = [];

function field(text, name) {
  return text.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*([^\\n]+)`, 'im'))?.[1]?.trim() || '';
}

function section(text, names) {
  const alternation = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`^##\\s+(${alternation})\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`, 'im'));
  return match ? match[2].trim() : '';
}

function hasMetadata(text) {
  const affected = section(text, ['Affected Files', 'Affected Specs']);
  if (/unknown\s*[:\-]\s*\S+/i.test(affected)) return true;
  return /^\s*[-*]\s+[`'"]?[^`\n]+[`'"]?/m.test(affected);
}

for (const name of fs.readdirSync(wiDir).filter((file) => /^WI-.*\.md$/.test(file))) {
  const file = path.join(wiDir, name);
  const text = fs.readFileSync(file, 'utf8');
  const severity = field(text, 'Severity').toLowerCase();
  const status = field(text, 'Status').toLowerCase();
  const filed = field(text, 'Filed');
  if (!['high', 'critical'].includes(severity)) continue;
  if (!filed || filed < since) continue;
  if (/\b(verified|done|closed|completed|implemented|resolved|merged|released)\b/i.test(status)) continue;
  if (!hasMetadata(text)) {
    failures.push(`${path.relative(root, file)}: ${severity} WI filed ${filed || 'unknown'} needs Affected Files/Specs or unknown:<reason>`);
  }
}

if (failures.length) {
  console.error('FAIL: high/critical WI metadata contract failed');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: work-item metadata contract valid since ${since}`);
