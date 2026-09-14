#!/usr/bin/env node
// WI-562 IP-H1: ground-truth parallel merge-back.
//
// No merge-back may accept worker-authored status strings. Success requires:
//   1. git-recomputed changed files / diff digest / commit range (never the
//      worker's arrays — worker arrays may only be a subset hint; a superset
//      claim or a mismatch is a failure);
//   2. committed work: clean tree + >=1 commit over the base window
//      ("PASS with a dirty tree" exits nonzero);
//   3. scope verification against the planned ownership globs;
//   4. validation evidence that is REPLAYED by this validator, not trusted:
//      every evidence entry names {command, cwd}; commands must belong to the
//      task's plan-declared `validation_commands` set, and together they must
//      COVER the whole declared set. Undeclared/omitted/empty declared sets
//      fail closed. Worker-authored verdict fields are ignored entirely.
//
// Back-compat: results produced before WI-562 (no worktree field) resolve their
// worktree from --worktree-root, defaulting to the process cwd's git root.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  recomputeWorkerGroundTruth,
  verifyScope,
  isGitWorktree,
} from './lib/merge-back-core.mjs';
import { matchesAny } from '../hooks/lib/delegation-authority.mjs';

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

const planPath = argValue('--plan');
const resultsPath = argValue('--results');
const defaultWorktree = argValue('--worktree-root') || process.cwd();

if (!planPath || !resultsPath) {
  console.error('Usage: node scripts/validate-parallel-merge-back.mjs --plan <plan.json> --results <dir-or-json> [--worktree-root <dir>] [--no-replay]');
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

const replayEnabled = process.argv.includes('--no-replay') === false;

for (const result of results) {
  const task = plannedTasks.get(result.wi);
  if (!task) {
    failures.push(`${result.wi || '<missing wi>'}: result does not match a planned dispatch task`);
    continue;
  }
  if (!present(result.status)) failures.push(`${result.wi}: missing status`);
  if (!present(result.worker_summary)) failures.push(`${result.wi}: missing worker_summary`);

  const worktree = result.worktree || defaultWorktree;
  let truth = null;
  if (result.status === 'success' || result.clean_worktree === true || Array.isArray(result.changed_files)) {
    if (!isGitWorktree(worktree)) {
      // Fail closed: success cannot be verified without git ground truth.
      if (result.status === 'success') failures.push(`${result.wi}: worktree is not a git checkout — success unverifiable (ground-truth required)`);
    } else {
      try {
        truth = recomputeWorkerGroundTruth({ worktree, baseSha: result.base_sha || null });
      } catch (err) {
        if (result.status === 'success') failures.push(`${result.wi}: ground-truth recompute failed: ${err.message}`);
      }
    }
  }

  if (truth) {
    const claimed = Array.isArray(result.changed_files) ? result.changed_files.map(String) : [];
    const superset = claimed.filter((f) => !truth.files.includes(f));
    if (superset.length > 0) {
      failures.push(`${result.wi}: worker claims files absent from actual diff: ${superset.join(', ')}`);
    }
    if (result.diff_digest && result.diff_digest !== truth.diff_digest) {
      failures.push(`${result.wi}: worker diff_digest does not match recomputed digest`);
    }
    if (result.head_sha && result.head_sha !== truth.head_sha) {
      failures.push(`${result.wi}: worker head_sha is not worktree HEAD`);
    }
  }

  if (result.status === 'success') {
    if (!truth) {
      // truth === null with success status already recorded a failure above when
      // git was unavailable; avoid double-reporting but still fail closed here.
      if (!failures.some((f) => f.startsWith(`${result.wi}:`))) {
        failures.push(`${result.wi}: success requires git-recomputed ground truth`);
      }
    } else {
      if (!truth.committed) {
        failures.push(`${result.wi}: successful result requires committed work (clean tree + >=1 commit); dirty=${!truth.clean}, commits=${truth.commits.length}`);
      }
      if (truth.files.length === 0) {
        failures.push(`${result.wi}: successful result has an empty recomputed diff over the base window`);
      }
      // WI-562 round-5 review: scope via the SHARED glob matcher (same
      // semantics as the delegated path), not exact string membership.
      const allowed = task.ownership?.write_scope || [];
      const denied = task.ownership?.denied_paths || [];
      const scope = verifyScope(truth.files, { matchesAny, allowed, denied });
      if (!scope.ok) for (const f of scope.failures) failures.push(`${result.wi}: ${f}`);
    }
    if (!result.parent_graph_mutation || !present(result.parent_graph_mutation.path)) {
      failures.push(`${result.wi}: parent_graph_mutation.path required (mutation flags are set by the orchestrator AFTER validation, never by the worker)`);
    }
    validateEvidence(result, task);
  }

  if ((task.conflicts_with || []).length > 0 && result.status === 'success') {
    if (!result.conflict_handling || !present(result.conflict_handling.strategy)) {
      failures.push(`${result.wi}: serialized/conflicting task requires conflict_handling.strategy`);
    }
  }
}

// WI-562 IP-H1: evidence REPLAY — the validator executes declared validation
// commands itself and trusts only its own observed exit codes. The task's
// declared `validation_commands` set must be present and fully covered.
function validateEvidence(result, task) {
  const entries = Array.isArray(result.validation_evidence) ? result.validation_evidence : [];
  const declaredRaw = Array.isArray(task.validation_commands) ? task.validation_commands : null;
  const legacyAllowed = process.env.SVC_PARALLEL_LEGACY_VALIDATION === "1";
  if (declaredRaw === null) {
    if (legacyAllowed) return; // explicit grandfather flag for pre-WI-562 fixtures
    failures.push(`${result.wi}: plan task omits validation_commands — declare a command set or set SVC_PARALLEL_LEGACY_VALIDATION=1 for legacy fixtures`);
    return;
  }
  const declared = declaredRaw;
  if (declared.length === 0) {
    failures.push(`${result.wi}: declared_validation_missing — task declares an empty validation_commands set`);
    return;
  }
  const declaredSet = new Set(declared);
  const evidenceCommands = [];
  for (const entry of entries) {
    const command = entry && typeof entry.command === 'string' ? entry.command : null;
    if (!command) continue; // legacy-shaped rows carry no replayable command
    evidenceCommands.push(command);
    if (!declaredSet.has(command)) {
      failures.push(`${result.wi}: validation evidence cites undeclared command: ${command}`);
    }
  }
  const missing = declared.filter((c) => !evidenceCommands.includes(c));
  if (missing.length > 0) {
    failures.push(`${result.wi}: validation evidence does not cover declared commands: ${missing.join(', ')}`);
  }
  if (evidenceCommands.length === 0) {
    failures.push(`${result.wi}: no replayable validation evidence entries`);
    return;
  }
  if (!replayEnabled) return;
  const worktree = result.worktree || defaultWorktree;
  for (const entry of entries) {
    if (!declaredSet.has(entry.command)) continue;
    try {
      execFileSync('bash', ['-lc', entry.command], { cwd: path.resolve(worktree), stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    } catch (err) {
      failures.push(`${result.wi}: replayed validation command failed (${entry.command}): exit ${err.status ?? 'signal'}`);
    }
  }
}

if (failures.length) {
  console.error('FAIL: parallel merge-back validation failed');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: parallel merge-back valid (${results.length} result(s), ${plannedTasks.size} planned task(s), ground-truth recomputed)`);
