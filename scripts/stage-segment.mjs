#!/usr/bin/env node
/**
 * stage-segment — the deterministic substrate for mandatory-chain stage-context
 * isolation (WI-380). The 7 chain skills run in ONE degrading orchestrator
 * context per WI today (context-budget.md classifies that as DEGRADING→POOR,
 * ~25-45% step dropout). This re-bases the chain onto per-stage FRESH subagents:
 * each stage boots a clean context with only its SKILL.md + the prior stage's
 * hash-bound baton/receipt, works in the SHARED worktree, and returns a ≤1K
 * schema-forced summary + the SHA whose receipt its own shell emitted. Stages
 * stay STRICTLY SEQUENTIAL — this isolates CONTEXT, not ordering.
 *
 * This module is the PURE, testable core: the segmentation (≥3 segments split at
 * the 3 human_checkpoint seams — AC1), the kickback-ladder state machine (AC2),
 * and stage-receipt SHA verification (AC3 — the orchestration VERIFIES the SHA the
 * stage agent emitted; it never re-emits). The actual subagent dispatch is a
 * route-workflow behavior (see references/stage-context-isolation.md).
 *
 * Segment vocabulary is single-sourced from references/stage-registry.json
 * mandatory_chain_segments (WI-SSVE-ARCHITECTURE-EVOLUTION-02 E1).
 */

import { execFileSync } from "node:child_process";   // Gemini G6 #3: no shell → no injection
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveMandatoryChainSegments, loadStageRegistry } from "./lib/stage-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, "..", "references", "stage-registry.json");
const REGISTRY = loadStageRegistry(REGISTRY_PATH);

// AC1: segments derived from the registry — byte-compatible export shape for consumers.
export const SEGMENTS = deriveMandatoryChainSegments(REGISTRY);

const SEV = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
// Gemini G6 #2: an UNRECOGNIZED severity ("FATAL", a typo like "CRITCAL") must
// fail CLOSED — treat it as CRITICAL (blocking), never silently fall to INFO and
// let the stage "pass". A truly empty findings list is still "pass"; only a
// PRESENT finding with an unknown severity is escalated.
const sev = (s) => SEV[String(s || "").toUpperCase()] ?? SEV.CRITICAL;
const PATCH_CAP = 3;   // hard cap on patch iterations before forced re-execute/re-plan

// AC2: the review-exec P4 kickback ladder as EXPLICIT backward control flow.
// Pure function: given the remaining findings + the current patch-iteration count,
// return the next action. Deterministic; no wall-clock.
//   findings: [{ severity, size_lines?, structural?, cause? }]
export function nextStageAction(findings, iterationCount = 0) {
  // Gemini G6 #1: a non-array findings payload (null/object from a broken review)
  // must fail CLOSED — never coerce to [] and return "pass".
  if (!Array.isArray(findings)) {
    return { action: "re-execute", reason: "malformed findings (not an array) — fail-closed", segment: "seg-2-exec", reset_iteration: true };
  }
  const blocking = findings.filter((f) => sev(f && f.severity) >= SEV.HIGH);
  if (blocking.length === 0) return { action: "pass", reason: "no CRITICAL/HIGH findings remain" };

  // A finding tracing to a PLAN flaw → re-plan (chain restarts at G5).
  if (blocking.some((f) => f.cause === "plan")) {
    return { action: "re-plan", reason: "a blocking finding traces to a plan flaw — kick back to plan-changeset (restart at G5)", segment: "seg-1-plan" };
  }
  // > 20 lines OR a structural change → re-execute (iteration resets).
  if (blocking.some((f) => f.structural || Number(f.size_lines || 0) > 20)) {
    return { action: "re-execute", reason: "fix is >20 lines or structural — archive exec-record and re-dispatch execute-changeset (iteration resets)", segment: "seg-2-exec", reset_iteration: true };
  }
  // Otherwise small in-place patch — but the hard cap forces escalation.
  if (iterationCount >= PATCH_CAP) {
    return { action: "re-execute", reason: `patch cap (${PATCH_CAP}) reached without resolution — must re-execute or re-plan`, segment: "seg-2-exec", reset_iteration: true };
  }
  return { action: "patch", reason: "≤20-line in-place fix; re-run review on the patched diff", next_iteration: iterationCount + 1 };
}

// AC3: the orchestration VERIFIES the receipt SHA the stage agent's own shell
// emitted — it does NOT re-emit. Returns { ok, present, reason }.
export function verifyStageReceipt(sha, expectedType, repoRoot = ".") {
  try {
    // Gemini G6 #3: execFileSync (no shell) — JSON.stringify double-quotes do NOT
    // stop $()/backtick subshell evaluation in /bin/sh; pass args directly instead.
    const note = execFileSync("git", ["-C", String(repoRoot), "notes", "--ref=svc-receipts", "show", String(sha)], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    const env = JSON.parse(note);
    const present = Object.prototype.hasOwnProperty.call(env, expectedType);
    return { ok: present, present, reason: present ? `${expectedType} receipt present on ${String(sha).slice(0, 8)}` : `${expectedType} receipt MISSING on ${String(sha).slice(0, 8)} — stage segment must HALT (never silently continue)` };
  } catch (e) {
    return { ok: false, present: false, reason: `no receipt envelope on ${String(sha).slice(0, 8)} — fail-closed (${String(e && e.message || e).slice(0, 60)})` };
  }
}

function argVal(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1] || null; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  if (cmd === "verify-receipt") {
    const r = verifyStageReceipt(argVal("--sha") || "HEAD", argVal("--type") || "exec-record", argVal("--root") || ".");
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "segments") {
    process.stdout.write(JSON.stringify(SEGMENTS, null, 2) + "\n");
  } else {
    console.error("usage: stage-segment (segments | verify-receipt --sha <sha> --type <receipt-type> [--root <dir>])");
    process.exit(2);
  }
}
