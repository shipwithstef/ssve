#!/usr/bin/env node
// SubagentStart hook (WI-CLN-13 / plan §4.15) — append a subagent-spawn record
// to .svc/dispatch-log.jsonl for parallel-dispatch telemetry.
// Reads the hook payload on stdin: { session_id, cwd, hook_event_name,
// agent_name|agent_type, prompt, ... }. OBSERVE only — never blocks, always
// exits 0. Writes via state-io.mjs (state-io-discipline), NOT raw fs.append.
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
  const entry = {
    ts: new Date().toISOString(),
    event: "subagent_start",
    session_id: payload.session_id || "",
    agent: payload.agent_name || payload.agent_type || "",
    prompt_chars: typeof payload.prompt === "string" ? payload.prompt.length : 0,
  };
  appendJsonlLine(resolve(svcDir, "dispatch-log.jsonl"), entry);
} catch {
  // telemetry must never block subagent lifecycle
}
process.exit(0);
