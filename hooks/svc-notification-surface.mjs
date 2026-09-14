#!/usr/bin/env node
// Notification hook — append payload to .svc/sessions/notifications.jsonl.
// Never blocks.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appendJsonlLine } from "../scripts/state-io.mjs";
import { resolveSvcStateDir } from "./lib/svc-state-dir.mjs";

let payload = "";
try {
  payload = readFileSync(0, "utf8");
} catch {}

try {
  const cwd = process.cwd();
  const svcDir = resolveSvcStateDir(cwd);   // WI-452: skip if not in an svc repo (no /tmp pollution)
  if (!svcDir) process.exit(0);
  const sessDir = resolve(svcDir, "sessions");
  const entry = { ts: new Date().toISOString(), payload: payload.trim() };
  appendJsonlLine(resolve(sessDir, "notifications.jsonl"), entry);
} catch {
  // never block
}
process.exit(0);
