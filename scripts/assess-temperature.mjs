#!/usr/bin/env node
// assess-temperature.mjs — Adaptive Temperature (cutting-edge technique #10)
// Pre-flight explore/exploit recommendation from EXISTING data. Reads only; does
// NOT modify route-workflow. The orchestrator decides whether to act on it.
// Reads: .svc/auto-grades.jsonl, .svc/agent-decisions.jsonl

import fs from "node:fs";
import path from "node:path";

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

function assessTemperature(skillName) {
  const grades = readJsonl(path.join(projectDir, ".svc", "auto-grades.jsonl"));
  // Confidence records are written by write-decision.mjs to agent-decisions.jsonl
  // (NOT pipeline-decisions.jsonl, which has no `confidence` field) — reading the
  // wrong log left avgConfidence permanently null (review finding F4).
  const decisions = readJsonl(path.join(projectDir, ".svc", "agent-decisions.jsonl"));

  const skillGrades = grades.filter((g) => g.skill === skillName);
  const passRate =
    skillGrades.length > 0
      ? skillGrades.filter((g) => g.grade === "pass").length / skillGrades.length
      : null;
  const recentFails = skillGrades.slice(-10).filter((g) => g.grade === "fail").length;

  const skillDecisions = decisions.filter(
    (d) => d.skill === skillName && typeof d.confidence === "number"
  );
  const avgConfidence =
    skillDecisions.length > 0
      ? skillDecisions.reduce((s, d) => s + (d.confidence || 0.5), 0) / skillDecisions.length
      : null;

  let temperature = "low"; // default: exploit proven patterns
  const reasons = [];
  if (passRate !== null && passRate < 0.7) {
    temperature = "high";
    reasons.push(`pass rate ${(passRate * 100).toFixed(0)}% < 70%`);
  }
  if (recentFails >= 3) {
    temperature = "high";
    reasons.push(`${recentFails} recent failures`);
  }
  if (avgConfidence !== null && avgConfidence < 0.5) {
    temperature = "high";
    reasons.push(`avg confidence ${avgConfidence.toFixed(2)} < 0.5`);
  }
  if (passRate !== null && passRate > 0.9 && recentFails === 0) {
    temperature = "low";
    reasons.push(`pass rate ${(passRate * 100).toFixed(0)}% > 90%, no recent failures`);
  }
  if (reasons.length === 0) reasons.push("no grade/decision history for this skill — default exploit");

  return {
    skill: skillName,
    temperature,
    reasons,
    metrics: { passRate, recentFails, avgConfidence },
    recommendation:
      temperature === "high"
        ? "Consider prepending explore-solutions or research to the skill chain"
        : "Standard skill chain is appropriate",
  };
}

const skillName = process.argv[2];
if (!skillName) {
  console.error("Usage: assess-temperature.mjs <skill-name>");
  process.exit(1);
}
console.log(JSON.stringify(assessTemperature(skillName), null, 2));
