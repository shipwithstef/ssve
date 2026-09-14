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
  const grades = readJsonl(path.join(projectDir, ".svc", "auto-grades.jsonl"));
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

  // Pattern 3: dead ends — a fail immediately followed by a pass on the same skill
  const deadEnds = [];
  for (let i = 1; i < grades.length; i++) {
    if (
      grades[i - 1].grade === "fail" &&
      grades[i].grade === "pass" &&
      grades[i - 1].skill === grades[i].skill
    ) {
      deadEnds.push({
        skill: grades[i].skill,
        recovery_iterations: grades[i].iterations || 1,
        original_findings: grades[i - 1].findings || null,
      });
    }
  }

  return {
    ts: new Date().toISOString(),
    skill_pass_rates: skillPassRates,
    decision_flows: decisionFlows,
    dead_end_patterns: deadEnds,
    total_grades: grades.length,
    total_dispatches: dispatchLog.length,
    total_decisions: decisions.length,
  };
}

const patterns = minePatterns();
const outPath = path.join(projectDir, ".svc", "trajectory-patterns.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
writeJsonAtomic(outPath, patterns);
console.log(JSON.stringify(patterns, null, 2));
