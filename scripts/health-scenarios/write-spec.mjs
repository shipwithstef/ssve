/**
 * Health Scenario: write-spec
 * Tests that write-spec produces a structured spec with user stories and ACs.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "write-spec";

export function setup(ws) {
  fs.mkdirSync(path.join(ws, "docs", "specs", "features"), { recursive: true });
}

export function prompt(ws) {
  return `You are the write-spec skill for the Serious Vibe Coding framework.

Write a DRAFT feature spec for:
"Users can toggle between light and dark mode in settings"

Your response MUST include:
1. At least one User Story (As a [role], I want [goal])
2. At least one Acceptance Criteria (Given/When/Then format)
3. A brief description of the feature

Keep it concise (under 500 words).`;
}

export const checks = [
  {
    name: "has user story",
    fn: (stdout) => /As a\s+\w+.*I want/i.test(stdout),
  },
  {
    name: "has acceptance criteria",
    fn: (stdout) =>
      /Given.*When.*Then/i.test(stdout) ||
      /Acceptance Criteria/i.test(stdout) ||
      /AC[:\s]/i.test(stdout),
  },
  {
    name: "has feature description",
    fn: (stdout) => stdout.length > 300,
  },
];
