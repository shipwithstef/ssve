#!/usr/bin/env node
// mine-trajectory-patterns.mjs — Experience Replay (cutting-edge technique #2)
// Mines decision patterns from EXISTING logs — no new instrumentation needed.
// Reads: .svc/dispatch-log.jsonl, .svc/auto-grades.jsonl, .svc/pipeline-decisions.jsonl
// Writes: .svc/trajectory-patterns.json (regenerable; mined, not recorded)

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "./state-io.mjs";

const projectDir = process.env.SVC_PROJECT_DIR || ".";

function readJsonl(filepath) {
  if (!fs.existsSync(filepath)) return [];
  return fs
    .readFileSync(filepath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function minePatterns() {
  const dispatchLog = readJsonl(path.join(projectDir, ".svc", "dispatch-log.jsonl"));
  const rawGrades = readJsonl(path.join(projectDir, ".svc", "auto-grades.jsonl"));
  const grades = rawGrades.filter((g) => typeof g.skill === "string" && g.skill && ["pass", "fail"].includes(g.grade));
  const decisions = readJsonl(path.join(projectDir, ".svc", "pipeline-decisions.jsonl"));

  // Pattern 1: skill pass rates
  const skillPassRates = {};
  for (const g of grades) {
    if (!g.skill) continue;
    if (!skillPassRates[g.skill]) skillPassRates[g.skill] = { pass: 0, fail: 0 };
    skillPassRates[g.skill][g.grade === "pass" ? "pass" : "fail"]++;
  }

  // Pattern 2: decision flows (from_skill -> to_skill frequency)
  const decisionFlows = {};
  for (const d of decisions) {
    const key = `${d.from_skill || d.skill || "unknown"}→${d.to_skill || "unknown"}`;
    if (!decisionFlows[key]) decisionFlows[key] = { count: 0 };
    decisionFlows[key].count++;
  }

  // Pattern 3: group only provenance-scoped tasks; legacy rows require adjacency.
  const deadEnds = []; const lastByTask = new Map();
  const scope = (g) => JSON.stringify([g.skill, g.wi ?? null, g.run_id ?? null, g.task_id ?? null]);
  for (let i = 0; i < grades.length; i++) {
    const grade = grades[i]; const attributed = grade.task_id !== undefined && grade.task_id !== null;
    const scoped = attributed && (Boolean(grade.wi) || Boolean(grade.run_id));
    const key = scope(grade);
    const previous = scoped ? lastByTask.get(key) : grades[i - 1];
    if (previous && scope(previous) === key && previous.grade === "fail" && grade.grade === "pass") {
      deadEnds.push({
        skill: grade.skill,
        ...(attributed ? { task_id: grade.task_id } : {}),
        ...(grade.wi ? { wi: grade.wi } : {}),
        ...(grade.run_id ? { run_id: grade.run_id } : {}),
        recovery_iterations: grade.iterations ?? 1,
        original_findings: previous.findings || null,
      });
    }
    if (scoped) lastByTask.set(key, grade);
  }

  return {
    ts: new Date().toISOString(),
    skill_pass_rates: skillPassRates,
    decision_flows: decisionFlows,
    dead_end_patterns: deadEnds,
    total_grades: rawGrades.length,
    valid_grades: grades.length,
    ignored_grades: rawGrades.length - grades.length,
    total_dispatches: dispatchLog.length,
    total_decisions: decisions.length,
  };
}

const patterns = minePatterns();
const outPath = path.join(projectDir, ".svc", "trajectory-patterns.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
writeJsonAtomic(outPath, patterns);
console.log(JSON.stringify(patterns, null, 2));
