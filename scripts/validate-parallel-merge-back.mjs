#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const planPath = argValue('--plan');
const resultsPath = argValue('--results');

if (!planPath || !resultsPath) {
  console.error('Usage: node scripts/validate-parallel-merge-back.mjs --plan <plan.json> --results <dir-or-json>');
  process.exit(2);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (err) {
    console.error(`FAIL: cannot parse JSON: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}

function loadResults(inputPath) {
  const abs = path.resolve(inputPath);
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(abs)
      .filter((name) => name.endsWith('.result.json'))
      .map((name) => readJson(path.join(abs, name)));
  }
  const doc = readJson(abs);
  return Array.isArray(doc) ? doc : Array.isArray(doc.results) ? doc.results : [doc];
}

const plan = readJson(planPath);
const results = loadResults(resultsPath);
const plannedTasks = new Map();
for (const wave of plan.waves || []) {
  for (const task of wave.tasks || []) {
    if (task.transport !== 'blocked') plannedTasks.set(task.wi, { ...task, wave: wave.id });
  }
}

const resultsByWi = new Map(results.map((result) => [result.wi, result]));
const failures = [];

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

for (const wi of plannedTasks.keys()) {
  if (!resultsByWi.has(wi)) failures.push(`${wi}: missing worker result`);
}

for (const result of results) {
  const task = plannedTasks.get(result.wi);
  if (!task) {
    failures.push(`${result.wi || '<missing wi>'}: result does not match a planned dispatch task`);
    continue;
  }
  if (!present(result.status)) failures.push(`${result.wi}: missing status`);
  if (!present(result.worker_summary)) failures.push(`${result.wi}: missing worker_summary`);
  if (!Array.isArray(result.changed_files)) failures.push(`${result.wi}: changed_files must be an array`);
  if (!Array.isArray(result.validation_evidence) || result.validation_evidence.length === 0) {
    failures.push(`${result.wi}: validation_evidence must contain at least one entry`);
  }
  if (!result.parent_graph_mutation || result.parent_graph_mutation.updated !== true || !present(result.parent_graph_mutation.path)) {
    failures.push(`${result.wi}: parent_graph_mutation.updated/path required`);
  }

  if (result.status === 'success') {
    if (result.clean_worktree !== true) failures.push(`${result.wi}: successful result requires clean_worktree=true`);
    const allowed = new Set(task.ownership?.write_scope || []);
    for (const file of result.changed_files || []) {
      if (!allowed.has(file)) failures.push(`${result.wi}: changed file outside ownership scope: ${file}`);
    }
    for (const evidence of result.validation_evidence || []) {
      if (!present(evidence.command) || !['PASS', 'pass', true].includes(evidence.result)) {
        failures.push(`${result.wi}: validation evidence must include command and PASS result`);
      }
    }
  }

  if ((task.conflicts_with || []).length > 0 && result.status === 'success') {
    if (!result.conflict_handling || !present(result.conflict_handling.strategy)) {
      failures.push(`${result.wi}: serialized/conflicting task requires conflict_handling.strategy`);
    }
  }
}

if (failures.length) {
  console.error('FAIL: parallel merge-back validation failed');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: parallel merge-back valid (${results.length} result(s), ${plannedTasks.size} planned task(s))`);
