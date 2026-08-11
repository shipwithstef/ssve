/**
 * Scenario: typo-fix
 * A 4-task bugfix lane that touches 1 source file and 1 plan file.
 * Small enough to run fast, complex enough to trigger multi-skill enforcement.
 */

import fs from "node:fs";
import path from "node:path";

export const name = "typo-fix";

export const lane = "bugfix";

export const tasks = [
  {
    id: 1,
    subject: "diagnose-bug: find typo in src/config.js",
    status: "pending",
    skill: "diagnose-bug",
    metadata: { skill: "diagnose-bug" },
  },
  {
    id: 2,
    subject: "plan-changeset: write 1-line fix plan",
    status: "pending",
    skill: "plan-changeset",
    metadata: { skill: "plan-changeset" },
    blocked_by: [1],
  },
  {
    id: 3,
    subject: "execute-changeset: fix typo in src/config.js",
    status: "pending",
    skill: "execute-changeset",
    metadata: { skill: "execute-changeset" },
    blocked_by: [2],
  },
  {
    id: 4,
    subject: "review-gate: validate the fix",
    status: "pending",
    skill: "review-gate",
    metadata: { skill: "review-gate" },
    blocked_by: [3],
  },
];

export function setup(workspace) {
  const srcDir = path.join(workspace, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(
    path.join(srcDir, "config.js"),
    `export const appNmae = "Example Marketplace";\nexport const version = "1.0.0";\n`,
    "utf8"
  );
}

export function workDiagnoseBug(workspace) {
  const configPath = path.join(workspace, "src", "config.js");
  const content = fs.readFileSync(configPath, "utf8");
  if (!content.includes("appNmae")) {
    throw new Error("Expected typo 'appNmae' not found in config.js");
  }
  // Diagnosis recorded as a note file
  fs.mkdirSync(path.join(workspace, "docs", "plans"), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "docs", "plans", "diagnosis.md"),
    "# Diagnosis\n\nTypo: `appNmae` should be `appName`.\n",
    "utf8"
  );
}

export function workPlanChangeset(workspace) {
  fs.writeFileSync(
    path.join(workspace, "docs", "plans", "typo-fix.md"),
    "# Plan\n\n1. Open src/config.js\n2. Replace `appNmae` with `appName`\n",
    "utf8"
  );
}

export function workExecuteChangeset(workspace) {
  const configPath = path.join(workspace, "src", "config.js");
  const content = fs.readFileSync(configPath, "utf8");
  fs.writeFileSync(configPath, content.replace("appNmae", "appName"), "utf8");
}

export function workReviewGate(workspace) {
  const configPath = path.join(workspace, "src", "config.js");
  const content = fs.readFileSync(configPath, "utf8");
  if (content.includes("appNmae")) {
    throw new Error("Review failed: typo still present");
  }
  if (!content.includes("appName")) {
    throw new Error("Review failed: fix not applied");
  }
}

export const workBySkill = {
  "diagnose-bug": workDiagnoseBug,
  "plan-changeset": workPlanChangeset,
  "execute-changeset": workExecuteChangeset,
  "review-gate": workReviewGate,
};
