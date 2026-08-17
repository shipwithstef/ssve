#!/usr/bin/env node
// SessionEnd hook — append session record to .svc/sessions/sessions.jsonl.
// Reads stdin (ignored). Never blocks.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { appendJsonlLine } from "../scripts/state-io.mjs";
import { resolveSvcStateDir } from "./lib/svc-state-dir.mjs";

// Stdin drain not needed for SessionEnd.

try {
  const cwd = process.cwd();
  const svcDir = resolveSvcStateDir(cwd);   // WI-452: skip if not in an svc repo (no /tmp pollution)
  if (!svcDir) process.exit(0);
  const sessDir = resolve(svcDir, "sessions");
  let branch = "";
  try {
    branch = execSync("git branch --show-current", { encoding: "utf8", timeout: 1000 }).trim();
  } catch {}
  const entry = { ts: new Date().toISOString(), branch };
  appendJsonlLine(resolve(sessDir, "sessions.jsonl"), entry);
} catch {
  // never block
}
process.exit(0);
