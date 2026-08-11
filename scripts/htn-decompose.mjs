#!/usr/bin/env node
// htn-decompose.mjs — Hierarchical Task Network decomposition (cutting-edge technique #3)
// Produces a phase tree with explicit preconditions/postconditions and validates
// that every precondition is satisfied by an earlier phase's postcondition.
// The `subtasks` arrays are filled by LLM decomposition (plan-changeset), not here —
// this script provides the structure + the precondition-satisfaction check.
// Usage: node scripts/htn-decompose.mjs "<goal>" ['<context-json>']

function decompose(goal, context) {
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

function validateTree(tree) {
  const errors = [];
  for (const phase of tree.tree) {
    for (const pre of phase.preconditions) {
      const satisfied = tree.tree.some(
        (p) => p.id < phase.id && p.postconditions.includes(pre)
      );
      if (!satisfied) {
        errors.push(`Phase ${phase.id}: precondition "${pre}" not satisfied by any earlier phase`);
      }
    }
  }
  return errors;
}

const goal = process.argv[2];
const contextRaw = process.argv[3] || "{}";
if (!goal) {
  console.error('Usage: htn-decompose.mjs "<goal>" [\'<context-json>\']');
  process.exit(1);
}
let context;
try {
  context = JSON.parse(contextRaw);
} catch {
  console.error("context arg must be valid JSON");
  process.exit(1);
}
const tree = decompose(goal, context);
const errors = validateTree(tree);
if (errors.length > 0) {
  console.error("Validation errors:\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log(JSON.stringify(tree, null, 2));
