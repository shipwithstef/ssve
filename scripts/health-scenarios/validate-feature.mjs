/**
 * Health Scenario: validate-feature
 * Tests that validate-feature produces a structured brief with a clear decision.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "validate-feature";

export function setup(ws) {
  fs.mkdirSync(path.join(ws, "docs", "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "docs", "specs", "personas.md"),
    "# Personas\n\n- Owner: manages the app\n- Customer: uses the app\n",
    "utf8"
  );
}

export function prompt(ws) {
  return `You are the validate-feature skill for the Serious Vibe Coding framework.

Context:
- Product: A simple todo app for small teams
- Personas: Owner (manages app), Customer (uses app)
- Feature idea: Add a dark mode toggle in settings

Run the 8 business questions and produce a Feature Validation Brief.
Your response MUST include one of these exact decisions: SHIP, NO-SHIP, DEFER, or PIVOT.
Also include a brief justification (1-2 sentences).`;
}

export const checks = [
  {
    name: "has decision keyword",
    fn: (stdout) =>
      /\b(SHIP|NO-SHIP|DEFER|PIVOT)\b/.test(stdout),
  },
  {
    name: "has justification",
    fn: (stdout) => stdout.length > 200, // More than just the decision word
  },
  {
    name: "mentions user value",
    fn: (stdout) =>
      stdout.toLowerCase().includes("user") ||
      stdout.toLowerCase().includes("customer") ||
      stdout.toLowerCase().includes("persona"),
  },
];
