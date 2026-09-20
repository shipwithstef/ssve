#!/usr/bin/env node
// population-compare.mjs — Population-Based Learning (cutting-edge technique #5)
// Compares parallel worker outputs using ACTUAL worker-result-contract fields
// (dispatch-waves: wi, status, worker_summary, changed_files, validation_evidence,
//  clean_worktree, parent_graph_mutation) and transfers winning patterns to
// .svc/population-patterns.jsonl. Standalone reader/appender (no subagent spawn here).
// Usage: node scripts/population-compare.mjs <population-dir-with-*.result.json>

import fs from "node:fs";
import path from "node:path";
import { appendJsonlLine } from "./state-io.mjs";

const projectDir = process.env.SVC_PROJECT_DIR || ".";

function scoreFromContractFields(r) {
  let score = 0;
  if (r.status === "success") score += 40;
  if (r.clean_worktree) score += 20;
  if (r.validation_evidence) score += 20;
  if (Array.isArray(r.changed_files) && r.changed_files.length < 10) score += 10; // focused
  if (!r.conflict_handling) score += 10; // no conflicts
  return score;
}

function inferFromSummary(summary) {
  if (!summary) return [];
  const f = [];
  if (/test/i.test(summary)) f.push("test-driven");
  if (/minimal/i.test(summary)) f.push("minimal-changes");
  if (/spec/i.test(summary)) f.push("spec-adherent");
  return f;
}

function comparePopulations(populationDir) {
  if (!fs.existsSync(populationDir)) {
    return { error: `population dir not found: ${populationDir}`, winner: null, patterns: 0, total: 0 };
  }
  const files = fs.readdirSync(populationDir).filter((f) => f.endsWith(".result.json"));
  const results = files.map((file) => ({
    ...JSON.parse(fs.readFileSync(path.join(populationDir, file), "utf8")),
    file,
  }));
  const scored = results
    .filter((r) => r.status === "success")
    .map((r) => ({ ...r, score: scoreFromContractFields(r) }))
    .sort((a, b) => b.score - a.score || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  const winners = scored.slice(0, Math.ceil(scored.length / 2));
  if (winners.length === 0) return { winner: null, patterns: 0, total: results.length, eligible: 0 };
  const patterns = winners.map((w) => ({
    wi: w.wi,
    summary: w.worker_summary,
    changed_files: w.changed_files,
    validation: w.validation_evidence,
    success_factors: inferFromSummary(w.worker_summary),
  }));

  const patternsPath = path.join(projectDir, ".svc", "population-patterns.jsonl");
  fs.mkdirSync(path.dirname(patternsPath), { recursive: true });
  for (const p of patterns) {
    appendJsonlLine(patternsPath, { ts: new Date().toISOString(), source_population: populationDir, ...p });
  }
  return { winner: scored[0]?.file || null, patterns: patterns.length, total: results.length, eligible: scored.length };
}

const populationDir = process.argv[2];
if (!populationDir) {
  console.error("Usage: population-compare.mjs <population-dir>");
  process.exit(1);
}
try {
  const result = comparePopulations(populationDir);
  console.log(JSON.stringify(result, null, 2));
  if (result.error) process.exitCode = 1;
} catch (error) { console.error(`population-compare: ${error.message}`); process.exitCode = 1; }
