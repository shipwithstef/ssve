#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[process.argv.indexOf('--root') + 1] || process.cwd());
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const route = read('skills/route-workflow/references/task-graph-protocol.md');
const promptHook = read('hooks/svc-prompt-stale-state.mjs');
const taskGraph = read('scripts/task-graph.mjs');

if (!route.includes('Prompt-Time Progress Audit')) {
  failures.push('task-graph protocol must define Prompt-Time Progress Audit thresholds');
}
if (!route.includes('`chain.requires` is intentionally rejected')) {
  failures.push('task-graph protocol must explicitly reject chain.requires with rationale');
}
if (!route.includes('task-graph.mjs load-skill')) {
  failures.push('task-graph protocol must name task-graph.mjs load-skill as canonical receipt emission');
}
if (!promptHook.includes('SVC_PROMPT_PROGRESS_WARN_MINUTES') || !promptHook.includes('stalled in-progress task')) {
  failures.push('UserPromptSubmit hook must audit long-running in-progress tasks without waiting for Stop');
}
if (!taskGraph.includes('cannot be completed without a matching load-skill receipt')) {
  failures.push('task-graph set-status must reject completion without matching skill receipt');
}

const skillsRoot = path.join(root, 'skills');
const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
  .map((entry) => entry.name);

for (const dir of skillDirs) {
  const text = read(path.join('skills', dir, 'SKILL.md'));
  if (/^\s*chain\.requires\s*:/m.test(text)) {
    failures.push(`${dir}/SKILL.md declares chain.requires; use lane-task blocked_by instead`);
  }
}

if (failures.length) {
  console.error('FAIL: prompt progress / prerequisite contract invalid');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: prompt progress contract valid (${skillDirs.length} skills scanned)`);
