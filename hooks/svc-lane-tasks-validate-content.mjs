#!/usr/bin/env node
/**
 * svc-lane-tasks-validate-content.mjs
 *
 * Validates lane-tasks JSON content without requiring a file on disk.
 * Used by the PreToolUse hook to block invalid WriteFile operations.
 *
 * Usage:
 *   echo '<json>' | node svc-lane-tasks-validate-content.mjs --stdin <filePath>
 *   or
 *   node svc-lane-tasks-validate-content.mjs <filePath>
 *     (reads file from disk, for testing)
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// WI-498: resolve task-graph.mjs from THIS hook's own install dir (self-located),
// never by walking up the consumer's tree (which would execute a consumer-planted
// copy = ACE). Self-location resolves the install copy via node's realpath default.
const SELF_TASK_GRAPH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "task-graph.mjs");

const args = process.argv.slice(2);
const isStdin = args[0] === "--stdin";
const filePath = isStdin ? args[1] : args[0];

if (!filePath) {
  console.error("Usage: [--stdin <filePath>] or <filePath>");
  process.exit(2);
}

let content;
if (isStdin) {
  content = fs.readFileSync(0, "utf8");
} else {
  content = fs.readFileSync(filePath, "utf8");
}

const taskGraphPath = SELF_TASK_GRAPH;
if (!fs.existsSync(taskGraphPath)) {
  console.error("svc-lane-tasks-pre-validator: install scripts/task-graph.mjs not found");
  process.exit(2);
}

// Write to a temp file so task-graph.mjs can validate it
const tmpDir = fs.mkdtempSync("/tmp/svc-lane-tasks-pre-");
const tmpPath = path.join(tmpDir, "lane-tasks.json");
fs.writeFileSync(tmpPath, content, "utf8");

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
  console.error(`❌ svc-lane-tasks-pre-validator: blocked invalid lane-tasks write`);
  console.error(msg);
  process.exit(1);
}
