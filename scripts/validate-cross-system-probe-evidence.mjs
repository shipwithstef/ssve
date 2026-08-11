#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const evidencePath = argValue('--evidence');
if (!evidencePath) {
  console.error('Usage: node scripts/validate-cross-system-probe-evidence.mjs --evidence <probe-evidence.json>');
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

const doc = readJson(evidencePath);
const probes = Array.isArray(doc) ? doc : Array.isArray(doc.probes) ? doc.probes : [doc];
const failures = [];
const allowedVerdicts = new Set(['hypothesis-holds', 'hypothesis-rejected', 'inconclusive']);
const passValues = new Set(['PASS', 'pass', true]);
const failValues = new Set(['FAIL', 'fail', false, 'failing-state', 'reproduced']);

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function checkProbe(probe, idx) {
  const label = probe.id || `probe[${idx}]`;
  if (!present(probe.hypothesis)) failures.push(`${label}: missing hypothesis`);
  if (!probe.confirmation_check || !present(probe.confirmation_check.predicate)) {
    failures.push(`${label}: missing confirmation_check.predicate`);
  }
  if (!probe.confirmation_check || !present(probe.confirmation_check.result)) {
    failures.push(`${label}: missing confirmation_check.result`);
  }
  if (!probe.falsification_check || !present(probe.falsification_check.predicate)) {
    failures.push(`${label}: missing falsification_check.predicate`);
  }
  if (!probe.falsification_check || !present(probe.falsification_check.result)) {
    failures.push(`${label}: missing falsification_check.result`);
  }
  if (!allowedVerdicts.has(probe.verdict)) {
    failures.push(`${label}: verdict must be one of ${Array.from(allowedVerdicts).join(', ')}`);
  }
  if (
    probe.verdict === 'hypothesis-holds' &&
    (!passValues.has(probe.confirmation_check?.result) ||
      !passValues.has(probe.falsification_check?.result))
  ) {
    failures.push(`${label}: hypothesis-holds requires PASS confirmation and PASS falsification checks`);
  }

  const requiresOldNew =
    probe.requires_old_new_path_proof === true ||
    probe.migration === true ||
    /migrat|switch|route through|use .* instead of|bypass|path[- ]swap/i.test(
      `${probe.hypothesis || ''} ${probe.change_reason || ''}`,
    );

  if (!requiresOldNew) return;

  if (!probe.same_input) failures.push(`${label}: migration proof missing same_input`);
  if (!probe.old_path || !present(probe.old_path.command) || !present(probe.old_path.result)) {
    failures.push(`${label}: migration proof missing old_path.command/result`);
  }
  if (!probe.new_path || !present(probe.new_path.command) || !present(probe.new_path.result)) {
    failures.push(`${label}: migration proof missing new_path.command/result`);
  }
  if (probe.old_path && probe.new_path && probe.old_path.result === probe.new_path.result) {
    failures.push(`${label}: old_path and new_path produced the same result; migration is not proven`);
  }
  if (probe.old_path && !failValues.has(probe.old_path.result)) {
    failures.push(`${label}: old_path.result must show the failing state`);
  }
  if (probe.new_path && !passValues.has(probe.new_path.result)) {
    failures.push(`${label}: new_path.result must show the passing state`);
  }
}

probes.forEach(checkProbe);

if (failures.length) {
  console.error('FAIL: cross-system probe evidence validation failed');
  for (const item of failures) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`PASS: cross-system probe evidence valid (${probes.length} probe(s))`);
