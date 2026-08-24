#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const root = path.resolve(argValue('--root') || process.cwd());
const pr = argValue('--pr');
const receiptFile = argValue('--receipt');

if (!pr && !receiptFile) {
  console.error('Usage: node scripts/validate-review-receipt.mjs --pr <number> [--root <dir>] [--receipt <file>]');
  process.exit(2);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file}: ${err.message}`);
  }
}

function candidateReceipts() {
  if (receiptFile) return [path.resolve(root, receiptFile)];
  return [
    path.join(root, '.svc', 'review-receipts', `pr-${pr}.json`),
    path.join(root, 'docs', 'specs', 'reviews', `pr-${pr}-review-gate.json`),
  ];
}

function readBypassLog() {
  const log = path.join(root, '.svc', 'pipeline-decisions.jsonl');
  if (!fs.existsSync(log)) return null;
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      entry.review_gate_bypass === true &&
      String(entry.pr || entry.pr_number || '') === String(pr) &&
      typeof entry.reasoning === 'string' &&
      entry.reasoning.trim() &&
      typeof entry.approved_by === 'string' &&
      entry.approved_by.trim()
    ) {
      return entry;
    }
  }
  return null;
}

const existing = candidateReceipts().find((file) => fs.existsSync(file));
if (!existing) {
  const bypass = pr ? readBypassLog() : null;
  if (bypass) {
    console.log(`PASS: review-gate bypass logged for PR ${pr}`);
    process.exit(0);
  }
  console.error(`FAIL: missing review-gate receipt for PR ${pr}`);
  console.error(`Expected one of: ${candidateReceipts().map((file) => path.relative(root, file)).join(', ')}`);
  process.exit(1);
}

let receipt;
try {
  receipt = readJson(existing);
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}

const failures = [];
function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

// WI-562 IP-R7: snapshot-based schema_version enforcement — receipts NOT in
// the pre-implementation frozen baseline must carry schema_version: 1.
try {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/specs/wi562-read-matrix-baseline.json'), 'utf8'));
  const frozen = new Set((baseline.frozen_pr_review_receipt_inventory?.files) || []);
  if (!frozen.has(existing) && receipt.schema_version !== 1) {
    failures.push('schema_version must be 1 for receipts created after WI-562');
  }
} catch { /* baseline unreadable: skip snapshot check (fail-open only for the SNAPSHOT lookup, not validation) */ }

if (pr && String(receipt.pr || receipt.pr_number || '') !== String(pr)) failures.push('pr must match target PR');
if (!present(receipt.reviewed_at)) failures.push('reviewed_at required');
if (!present(receipt.review_gate_task)) failures.push('review_gate_task required');
if (!present(receipt.reviewer)) failures.push('reviewer required');
if (!['PASS', 'pass', 'approved'].includes(receipt.result)) failures.push('result must be PASS/approved');
if (!Array.isArray(receipt.evidence) || receipt.evidence.length === 0) failures.push('evidence must be a non-empty array');
if (receipt.self_review === true) failures.push('self_review=true is not eligible for merge');
if (receipt.review_gate_required !== true) failures.push('review_gate_required must be true');

if (failures.length) {
  console.error(`FAIL: invalid review-gate receipt ${path.relative(root, existing)}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: review-gate receipt valid (${path.relative(root, existing)})`);
