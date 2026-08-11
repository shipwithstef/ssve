#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const mapPath = argValue('--map');
if (!mapPath) {
  console.error('Usage: node scripts/validate-system-contract-map.mjs --map <contract-map.md>');
  process.exit(2);
}

const abs = path.resolve(mapPath);
let text = '';
try {
  text = fs.readFileSync(abs, 'utf8');
} catch (err) {
  console.error(`FAIL: cannot read contract map: ${mapPath}`);
  console.error(err.message);
  process.exit(1);
}

const failures = [];

function fail(message) {
  failures.push(message);
}

function sectionBody(title) {
  const re = new RegExp(`^#{2,4}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im');
  const match = text.match(re);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = rest.search(/^#{2,4}\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function normalizeCell(cell) {
  return cell.trim().toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ');
}

function parseFirstTable(body) {
  if (!body) return null;
  const lines = body.split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  if (lines.length < 3) return null;
  const headers = lines[0].split('|').slice(1, -1).map(normalizeCell);
  const rows = lines
    .slice(2)
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  return { headers, rows };
}

function requireSection(title) {
  const body = sectionBody(title);
  if (!body) fail(`missing section: ${title}`);
  return body;
}

function requireTable(title, requiredHeaders) {
  const body = requireSection(title);
  const table = parseFirstTable(body);
  if (!table) {
    fail(`${title}: missing markdown table with at least one data row`);
    return;
  }
  for (const header of requiredHeaders) {
    if (!table.headers.includes(header)) {
      fail(`${title}: missing required column "${header}"`);
    }
  }
  if (table.rows.length === 0) {
    fail(`${title}: table has no data rows`);
  }
}

if (!/system contract map/i.test(text)) {
  fail('document must identify itself as a System Contract Map');
}

const flow = requireSection('Flow Diagram');
if (flow && !/(-->|->|=>|graph\s+(TD|LR|RL|BT)|sequenceDiagram|\[[^\]]+\])/i.test(flow)) {
  fail('Flow Diagram: must contain a Mermaid/ASCII edge or node diagram');
}

requireTable('Handoff Table', [
  'from',
  'to',
  'transport',
  'data shape',
  'sender storage',
  'receiver storage',
  'next reader',
  'failure mode',
]);

requireTable('Origin / Storage Matrix', [
  'storage layer',
  'origin / owner',
  'written by',
  'readable by',
  'failure mode',
]);

requireTable('External Platform Invariants', [
  'claim',
  'verification source',
  'probe',
  'status',
]);

requireTable('Falsification Probes', [
  'hypothesis',
  'confirmation check',
  'falsification check',
  'result',
  'evidence',
]);

requireTable('Old Path / New Path Proof', [
  'same input',
  'old path result',
  'new path result',
  'conclusion',
  'evidence',
]);

const escalation = requireSection('Iteration Escalation');
if (escalation && !/third|3/i.test(escalation)) {
  fail('Iteration Escalation: must state the third-invocation halt condition');
}
if (escalation && !/review-cross-model/i.test(escalation)) {
  fail('Iteration Escalation: must require review-cross-model before resuming');
}

if (failures.length) {
  console.error('FAIL: System Contract Map validation failed');
  for (const item of failures) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`PASS: System Contract Map valid (${mapPath})`);
