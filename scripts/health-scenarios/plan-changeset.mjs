/**
 * Health Scenario: plan-changeset
 * Tests that plan-changeset produces a manifest with tasks and file references.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "plan-changeset";

export function setup(ws) {
  fs.mkdirSync(path.join(ws, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "src", "config.js"),
    `export const appNmae = "TodoApp";\n`,
    "utf8"
  );
  fs.mkdirSync(path.join(ws, "docs", "specs", "features"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "docs", "specs", "features", "dark-mode.md"),
    "# Dark Mode\n\n## User Story\nAs a user, I want to toggle dark mode.\n\n## AC\nGiven I am on settings, When I click toggle, Then theme changes.\n",
    "utf8"
  );
}

export function prompt(ws) {
  return `You are the plan-changeset skill for the Serious Vibe Coding framework.

Spec: docs/specs/features/dark-mode.md describes a dark mode toggle.
Current code: src/config.js has a typo (appNmae should be appName).

Produce an implementation plan (manifest) with:
1. A list of tasks
2. Files that will be touched
3. A validation step

Keep it under 400 words.`;
}

export const checks = [
  {
    name: "has task list",
    fn: (stdout) =>
      /Task \d|1\.|• |\- /.test(stdout) ||
      /manifest|plan/i.test(stdout),
  },
  {
    name: "names files",
    fn: (stdout) =>
      stdout.includes("config.js") || stdout.includes(".css") || stdout.includes(".jsx"),
  },
  {
    name: "has validation",
    fn: (stdout) =>
      /test|validate|verify|check/i.test(stdout),
  },
];
