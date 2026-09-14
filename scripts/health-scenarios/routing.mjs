/**
 * Health Scenario: routing
 * Tests that route-workflow correctly routes freeform intent to the right skill.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "routing";

export function setup(ws) {
  // Minimal project state
  fs.mkdirSync(path.join(ws, "docs", "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "docs", "specs", "vision.md"),
    "# Vision\n\nA simple todo app.\n",
    "utf8"
  );
}

export function prompt(ws) {
  return `You are the route-workflow skill for the Serious Vibe Coding framework.

Repo state:
- docs/specs/vision.md exists (a simple todo app vision)
- No active lane-tasks file
- No pending work items

User says: "I want to add a dark mode toggle to the app"

Your job is to route this intent. Respond with ONLY the name of the first skill to invoke (e.g., validate-feature, write-spec, diagnose-bug, etc). No explanation.`;
}

export const checks = [
  {
    name: "routes to validate-feature",
    fn: (stdout) =>
      stdout.toLowerCase().includes("validate-feature") ||
      stdout.toLowerCase().includes("validate feature"),
  },
  {
    name: "single skill name",
    fn: (stdout) => {
      const lines = stdout.trim().split(/\n/).filter((l) => l.trim());
      return lines.length <= 3; // Should be concise
    },
  },
];
