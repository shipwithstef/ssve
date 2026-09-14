#!/usr/bin/env node
/**
 * svc-lane-tasks-validate-edit.mjs
 *
 * Simulates a StrReplaceFile edit on a lane-tasks file and validates the result.
 * Used by the PreToolUse hook to block invalid StrReplaceFile operations.
 *
 * Usage:
 *   node svc-lane-tasks-validate-edit.mjs <filePath> <oldText> <newText>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// WI-498: resolve task-graph.mjs from THIS hook's own install dir (self-located),
// never by walking up the consumer's tree. Walking up would execute a consumer-
// planted scripts/task-graph.mjs (ACE); self-location resolves the install copy
// through the ~/.claude farm symlink (node default realpath) regardless of what
// the consumer repo contains.
const SELF_TASK_GRAPH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "task-graph.mjs");

const [filePath, oldText, newText] = process.argv.slice(2);

if (!filePath || !oldText) {
  console.error("Usage: <filePath> <oldText> <newText>");
  process.exit(2);
}

const content = fs.readFileSync(filePath, "utf8");

// Simulate the edit
const occurrences = content.split(oldText).length - 1;
if (occurrences === 0) {
  // Old text not found - StrReplaceFile would fail anyway, let it fail naturally
  process.exit(0);
}

if (occurrences > 1) {
  // Ambiguous edit - let the tool handle this
  process.exit(0);
}

const edited = content.replace(oldText, newText || "");

const taskGraphPath = SELF_TASK_GRAPH;
if (!fs.existsSync(taskGraphPath)) {
  console.error("svc-lane-tasks-pre-validator: install scripts/task-graph.mjs not found");
  process.exit(2);
}

// Write to temp file and validate
const tmpDir = fs.mkdtempSync("/tmp/svc-lane-tasks-pre-");
const tmpPath = path.join(tmpDir, "lane-tasks.json");
fs.writeFileSync(tmpPath, edited, "utf8");

try {
  execFileSync(process.execPath, [taskGraphPath, "validate", tmpPath], {
    cwd: path.dirname(taskGraphPath),
    stdio: "pipe",
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
} catch (e) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  const msg = e.stderr?.toString() || e.stdout?.toString() || e.message;
  console.error(`❌ svc-lane-tasks-pre-validator: blocked invalid lane-tasks edit`);
  console.error(msg);
  process.exit(1);
}
