#!/usr/bin/env node
// svc-lane-tasks-failure.mjs
// Handles PostToolUseFailure for lane-tasks file edits.
// Emits a warning to stdout (added to agent context) when a lane-tasks edit fails.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { readHookPayload, extractFilePath } = await import(
  path.join(__dirname, "lib", "hook-payload.mjs")
);

// Unified host-agnostic payload extraction.
const call = readHookPayload();
if (!call) process.exit(0);
const toolName = call.toolName;
const toolInput = call.toolInput;
const error = call.raw?.error || "";
const filePath = extractFilePath(toolInput);

// Only care about lane-tasks files
if (!filePath || !/\.svc\/lane-tasks-[^/]+\.json$/.test(filePath)) {
  process.exit(0);
}

console.log(`⚠️ LANE-TASKS EDIT FAILED (${toolName})`);
console.log(`  File: ${filePath}`);
console.log(`  Error: ${String(error).slice(0, 200)}`);
console.log(`  Action: Fix the error and retry the edit. Check file permissions and JSON syntax.`);

process.exit(0);
