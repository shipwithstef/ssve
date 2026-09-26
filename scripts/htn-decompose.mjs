#!/usr/bin/env node
// htn-decompose.mjs — Hierarchical Task Network decomposition (cutting-edge technique #3)
// Produces a phase tree with explicit preconditions/postconditions and validates
// that every precondition is satisfied by an earlier phase's postcondition.
// The `subtasks` arrays are filled by LLM decomposition (plan-changeset), not here —
// this script provides the structure + the precondition-satisfaction check.
// Usage: node scripts/htn-decompose.mjs "<goal>" ['<context-json>']

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Produce the existing five-phase scaffold without filling model-owned subtasks. */
export function decompose(goal, context) {
  const phases = [
    { id: "P1", name: "Research & Understand", preconditions: [], postconditions: ["goal_understood"] },
    { id: "P2", name: "Design & Plan", preconditions: ["goal_understood"], postconditions: ["plan_ready"] },
    { id: "P3", name: "Implement", preconditions: ["plan_ready"], postconditions: ["code_written"] },
    { id: "P4", name: "Verify & Test", preconditions: ["code_written"], postconditions: ["verified"] },
    { id: "P5", name: "Ship & Monitor", preconditions: ["verified"], postconditions: ["shipped"] },
  ];
  return {
    goal,
    context,
    phases,
    tree: phases.map((phase) => ({ ...phase, subtasks: [] })),
  };
}

/** Validate the actual execution sequence, not the spelling of phase identifiers. */
export function validateTree(plan) {
  if (!Array.isArray(plan?.tree) || plan.tree.length === 0) return ["tree must be a nonempty phase array"];
  const errors = []; const available = new Set(); const ids = new Set();
  for (const phase of plan.tree) {
    if (!phase || typeof phase.id !== "string" || !phase.id.trim()) { errors.push("phase requires a nonempty string id"); continue; }
    if (ids.has(phase.id)) errors.push(`duplicate phase id: ${phase.id}`);
    ids.add(phase.id);
    if (![phase.preconditions, phase.postconditions].every((values) => Array.isArray(values) && values.every((v) => typeof v === "string" && v.trim()))) {
      errors.push(`Phase ${phase.id}: preconditions/postconditions must be string arrays`); continue;
    }
    for (const pre of phase.preconditions) {
      if (!available.has(pre)) errors.push(`Phase ${phase.id}: precondition "${pre}" not satisfied by any earlier phase`);
    }
    for (const post of phase.postconditions) available.add(post);
  }
  return errors;
}

/** Read-only CLI: generate a scaffold or validate an existing extended plan. */
function main(argv) {
  if (argv[0] === "--help") { console.log('Usage: htn-decompose.mjs "<goal>" [\'<context-json>\'] | --validate <plan.json>'); return; }
  if (!argv[0] || argv.length > 2) throw new Error('Usage: htn-decompose.mjs "<goal>" [\'<context-json>\'] | --validate <plan.json>');
  const plan = argv[0] === "--validate"
    ? JSON.parse(fs.readFileSync(argv[1] || "", "utf8"))
    : decompose(argv[0], JSON.parse(argv[1] || "{}"));
  const errors = validateTree(plan);
  if (errors.length) throw new Error("Validation errors:\n  " + errors.join("\n  "));
  console.log(JSON.stringify(plan, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`htn-decompose: ${error.message}`); process.exitCode = 1; }
}
