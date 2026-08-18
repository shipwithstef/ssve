#!/usr/bin/env node
// svc-continuation-phase-guard.mjs — WI-552 AC-552-4.
//
// A restart-boundary continuation child is mechanically denied diagnose-bug,
// plan-changeset, and execute-changeset (or whatever the baton declares).
// This is the PreToolUse enforcement point: if the CURRENT session is the
// exact session a continuation baton launched (matched by session id — never
// by heuristics), and the invoked Skill is outside the baton's delegated
// scope, deny before the skill loads. Sessions with no active continuation
// baton are completely unaffected (fail open by absence, not by default).

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const { readHookPayload } = await import(path.join(__dirname, "lib", "hook-payload.mjs"));
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "lib", "hook-denial.mjs"))); } catch { /* older install */ }
const { isPhaseForbiddenForSession } = await import(path.join(repoRoot, "scripts", "resolve-continuation.mjs"));

function disabled() {
  return (process.env.SVC_DISABLED_HOOKS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes("svc-continuation-phase-guard");
}

if (disabled()) process.exit(0);

const call = readHookPayload();
if (!call) process.exit(0);
if (call.toolName !== "Skill") process.exit(0);

const skillName = call.toolInput?.skill || call.toolInput?.name || "";
if (!skillName) process.exit(0);

const sessionId = call.sessionId || process.env.SVC_SESSION_ID || "";
if (!sessionId) process.exit(0);

let outcome;
try {
  outcome = isPhaseForbiddenForSession({ sessionId, skill: skillName, cwd: call.cwd || process.cwd() });
} catch (error) {
  // SOL-E005: continuation children fail closed when the ledger is unreadable.
  // Unrelated sessions still fail open by absence.
  const looksLikeChild = Boolean(process.env.SVC_CONTINUATION_TOKEN)
    || String(sessionId).startsWith("svc-continuation-");
  if (!looksLikeChild) process.exit(0);
  const reason = `restart-boundary continuation ledger is unreadable for child session; fail-closed (${error.message})`;
  if (emitDenial) {
    emitDenial({
      hook_id: "svc-continuation-phase-guard",
      reason_code: "SVC-CONTINUATION-LEDGER",
      cause: reason,
      operation: `Skill invocation (${skillName})`,
      recovery: "Repair or restore .svc/continuation/<WI>.ledger.jsonl, then retry from the parent session.",
      resolved_command_path: skillName,
      session_id: sessionId,
    });
  }
  process.stderr.write(`[svc-continuation-phase-guard] BLOCKED: ${reason}\n`);
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })}\n`);
  process.exit(2);
}

if (!outcome.forbidden) process.exit(0);

const reason = `restart-boundary continuation child for ${outcome.wi} is scoped to verification/closeout only; "${skillName}" is in its forbidden phases [${outcome.forbidden_phases.join(", ")}]`;

if (emitDenial) {
  emitDenial({
    hook_id: "svc-continuation-phase-guard",
    reason_code: "SVC-CONTINUATION-SCOPE",
    cause: reason,
    operation: `Skill invocation (${skillName})`,
    recovery: "A continuation child may only run the declared verification/closeout tasks. Return control to the parent/implementation session for planning or execution work.",
    resolved_command_path: skillName,
    session_id: sessionId,
  });
}
process.stderr.write(`[svc-continuation-phase-guard] BLOCKED: ${reason}\n`);
process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })}\n`);
process.exit(2);
