#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const graphPath = argValue('--lane-tasks');
if (!graphPath) {
  console.error('Usage: node scripts/check-cross-system-iteration-cap.mjs --lane-tasks <.svc/lane-tasks-WI.json>');
  process.exit(2);
}

let graph;
try {
  graph = JSON.parse(fs.readFileSync(path.resolve(graphPath), 'utf8'));
} catch (err) {
  console.error(`FAIL: cannot parse lane-task graph: ${graphPath}`);
  console.error(err.message);
  process.exit(1);
}

function countDiagnoseTasks(tasks = []) {
  return tasks.reduce((count, task) => {
    const haystack = `${task.skill || ''} ${task.name || ''} ${task.task || ''}`.toLowerCase();
    const own = haystack.includes('diagnose-bug') ? 1 : 0;
    return count + own + countDiagnoseTasks(task.process_tasks || []);
  }, 0);
}

const explicitCount = Number(graph.diagnose_bug_invocations || graph.cross_system?.diagnose_bug_invocations || 0);
const taskCount = countDiagnoseTasks(graph.tasks || graph.lane_tasks || []);
const count = Math.max(explicitCount, taskCount);

if (count < 3) {
  console.log(`PASS: diagnose-bug invocation count ${count} is below cross-system escalation cap`);
  process.exit(0);
}

const labels = new Set([...(graph.labels || []), ...(graph.tags || [])]);
const crossSystem = graph.cross_system || {};
const contractMap = crossSystem.system_contract_map || graph.system_contract_map || {};
const reviewRequired =
  crossSystem.review_cross_model_required === true ||
  graph.review_cross_model_required === true ||
  (graph.required_skills || []).includes('review-cross-model');

const failures = [];
if (!labels.has('cross-system-suspected') && crossSystem.suspected !== true) {
  failures.push('third diagnose-bug invocation must mark cross-system-suspected');
}
if (contractMap.required !== true || !contractMap.path) {
  failures.push('third diagnose-bug invocation must require system_contract_map.path');
}
if (reviewRequired !== true) {
  failures.push('third diagnose-bug invocation must require review-cross-model before execute-changeset');
}

if (failures.length) {
  console.error(`FAIL: cross-system iteration cap violated at diagnose-bug invocation count ${count}`);
  for (const item of failures) console.error(`  - ${item}`);
  process.exit(1);
}

console.log(`PASS: cross-system escalation required at diagnose-bug invocation count ${count}`);
