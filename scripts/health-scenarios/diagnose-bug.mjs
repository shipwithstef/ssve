/**
 * Health Scenario: diagnose-bug
 * Tests that diagnose-bug finds a root cause from a simple bug report.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "diagnose-bug";

export function setup(ws) {
  fs.mkdirSync(path.join(ws, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "src", "config.js"),
    `export const appNmae = "TodoApp";\nexport const version = "1.0.0";\n`,
    "utf8"
  );
}

export function prompt(ws) {
  return `You are the diagnose-bug skill for the Serious Vibe Coding framework.

Bug report: "The app name shows as undefined in the browser console"

Source file src/config.js:
\`\`\`javascript
export const appNmae = "TodoApp";
export const version = "1.0.0";
\`\`\`

Diagnose the root cause. Your response MUST:
1. Identify the root cause
2. Name the specific file and line
3. Suggest the fix`;
}

export const checks = [
  {
    name: "identifies typo",
    fn: (stdout) =>
      stdout.toLowerCase().includes("appnmae") ||
      stdout.toLowerCase().includes("typo") ||
      stdout.toLowerCase().includes("misspelling"),
  },
  {
    name: "names file and fix",
    fn: (stdout) =>
      stdout.includes("config.js") &&
      (stdout.includes("appName") || stdout.includes("appNmae → appName")),
  },
  {
    name: "has root cause",
    fn: (stdout) =>
      stdout.toLowerCase().includes("root cause") ||
      stdout.toLowerCase().includes("cause:"),
  },
];
