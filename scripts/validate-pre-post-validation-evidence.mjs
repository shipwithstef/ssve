#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const evidencePath = argValue('--evidence');
if (!evidencePath) {
  console.error('Usage: node scripts/validate-pre-post-validation-evidence.mjs --evidence <pre-post-evidence.json>');
  process.exit(2);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (err) {
    console.error(`FAIL: cannot parse JSON evidence: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

const allowedStatuses = new Set(['pass', 'fail', 'blocked', 'not-run']);
const allowedComparisons = new Set([
  'fixed-by-change',
  'unchanged',
  'branch-introduced',
  'pre-existing',
  'blocked',
]);
const allowedBaselineReplacements = new Set(['old-path-new-path', 'detached-origin-main', 'blocker']);

const doc = readJson(evidencePath);
const failures = [];

function fail(message) {
  failures.push(message);
}

function requirePresent(obj, key, label) {
  if (!present(obj?.[key])) fail(`${label}: missing ${key}`);
}

function checkStatus(value, label) {
  if (!allowedStatuses.has(value)) {
    fail(`${label}: status must be one of ${Array.from(allowedStatuses).join(', ')}`);
  }
}

function selectedValue(key) {
  return doc.selected_proof?.[key];
}

if (doc.schema_version !== 1) fail('schema_version must be 1');
if (doc.acceptance_critical !== true && doc.acceptance_critical !== false) {
  fail('acceptance_critical must be boolean');
}

requirePresent(doc, 'comparison', 'root');
if (present(doc.comparison) && !allowedComparisons.has(doc.comparison)) {
  fail(`root: comparison must be one of ${Array.from(allowedComparisons).join(', ')}`);
}

requirePresent(doc, 'selected_proof', 'root');
for (const key of ['id', 'command', 'target', 'environment']) {
  requirePresent(doc.selected_proof, key, 'selected_proof');
}

if (present(doc.selected_proof?.fixture_account) && present(doc.post?.fixture_account)) {
  if (doc.selected_proof.fixture_account !== doc.post.fixture_account) {
    fail('post.fixture_account must match selected_proof.fixture_account');
  }
}

for (const key of ['command', 'target', 'environment', 'viewport']) {
  if (present(doc.post?.[key]) && present(selectedValue(key)) && doc.post[key] !== selectedValue(key)) {
    fail(`post.${key} must match selected_proof.${key} or be omitted`);
  }
}

requirePresent(doc, 'pre', 'root');
requirePresent(doc, 'post', 'root');
checkStatus(doc.pre?.status, 'pre');
checkStatus(doc.post?.status, 'post');
requirePresent(doc.pre, 'evidence', 'pre');
requirePresent(doc.post, 'evidence', 'post');

if (doc.pre?.status === 'not-run') {
  requirePresent(doc, 'no_pre_baseline_reason', 'root');
  if (!allowedBaselineReplacements.has(doc.baseline_replacement)) {
    fail(`root: baseline_replacement must be one of ${Array.from(allowedBaselineReplacements).join(', ')} when pre.status is not-run`);
  }
}

if (doc.acceptance_critical === true && doc.comparison === 'branch-introduced') {
  fail('acceptance-critical evidence cannot close with comparison=branch-introduced');
}

if (!Array.isArray(doc.iterations) || doc.iterations.length === 0) {
  fail('iterations must be a non-empty array');
} else {
  doc.iterations.forEach((iteration, idx) => {
    const label = `iterations[${idx}]`;
    if (!Number.isInteger(iteration.iteration) || iteration.iteration < 1) {
      fail(`${label}: iteration must be a positive integer`);
    }
    requirePresent(iteration, 'fix_batch', label);
    requirePresent(iteration, 'classification', label);
    requirePresent(iteration, 'evidence', label);
    if (Array.isArray(iteration.fix_batches) && iteration.fix_batches.length > 1) {
      fail(`${label}: exactly one fix_batch is allowed per iteration`);
    }
    if (present(iteration.classification) && !allowedComparisons.has(iteration.classification)) {
      fail(`${label}: classification must be one of ${Array.from(allowedComparisons).join(', ')}`);
    }
    if (doc.acceptance_critical === true && iteration.classification === 'branch-introduced') {
      fail(`${label}: acceptance-critical iteration cannot remain branch-introduced`);
    }
  });
}

if (!Array.isArray(doc.changed_signals) || doc.changed_signals.length === 0) {
  fail('changed_signals must be a non-empty array');
} else {
  doc.changed_signals.forEach((signal, idx) => {
    const label = `changed_signals[${idx}]`;
    requirePresent(signal, 'signal', label);
    requirePresent(signal, 'classification', label);
    if (present(signal.classification) && !allowedComparisons.has(signal.classification)) {
      fail(`${label}: classification must be one of ${Array.from(allowedComparisons).join(', ')}`);
    }
    const signalCritical = signal.acceptance_critical === true || doc.acceptance_critical === true;
    if (signalCritical && signal.classification === 'branch-introduced') {
      fail(`${label}: acceptance-critical signal cannot remain branch-introduced`);
    }
  });
}

if (failures.length) {
  console.error('FAIL: pre/post validation evidence failed');
  for (const item of failures) console.error(`  - ${item}`);
  process.exit(1);
}

console.log('PASS: pre/post validation evidence valid');
