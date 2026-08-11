#!/usr/bin/env node
// SubagentStop hook (WI-CLN-13 / plan §4.15) — append a subagent-completion
// record to .svc/dispatch-log.jsonl for parallel-dispatch telemetry.
// Reads the hook payload on stdin: { session_id, cwd, hook_event_name,
// agent_name|agent_type, success|error|exit_code, ... }. OBSERVE only — never
// blocks, always exits 0. Writes via state-io.mjs, NOT raw fs.append.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appendJsonlLine } from "../scripts/state-io.mjs";
import { resolveSvcStateDir } from "./lib/svc-state-dir.mjs";

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  payload = {};
}

try {
  const cwd = payload.cwd || process.env.SVC_PROJECT_DIR || process.cwd();
  const svcDir = resolveSvcStateDir(cwd);   // WI-452: skip if not in an svc repo (no /tmp pollution)
  if (!svcDir) process.exit(0);
  // Derive an outcome from whichever signal the host provides.
  let outcome = "unknown";
  if (typeof payload.success === "boolean") outcome = payload.success ? "success" : "failure";
  else if (payload.error) outcome = "failure";
  else if (typeof payload.exit_code === "number") outcome = payload.exit_code === 0 ? "success" : "failure";
  const entry = {
    ts: new Date().toISOString(),
    event: "subagent_stop",
    session_id: payload.session_id || "",
    agent: payload.agent_name || payload.agent_type || "",
    outcome,
    exit_code: typeof payload.exit_code === "number" ? payload.exit_code : null,
  };
  appendJsonlLine(resolve(svcDir, "dispatch-log.jsonl"), entry);
} catch {
  // telemetry must never block subagent lifecycle
}
process.exit(0);
