#!/usr/bin/env node
/**
 * stage-segment — the deterministic substrate for mandatory-chain stage-context
 * isolation (WI-380). The 7 chain skills run in ONE degrading orchestrator
 * context per WI today. This re-bases the chain onto per-stage FRESH subagents:
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
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
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
export function selectStageReceipt(envelope, {sha, expectedType, wi} = {}) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("receipt envelope required");
  const matches = [];
  for (const [key, value] of Object.entries(envelope)) {
    if (!key.startsWith(`slot::${expectedType}::`)) continue;
    const parts = key.split("::");
    if (parts.length !== 4 || parts[3] !== sha || !value || value.receipt_type !== expectedType || value.wi !== parts[2]
        || (value.target_sha && value.target_sha !== sha)) throw new Error("canonical receipt slot identity mismatch");
    const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
    if (envelope.digests?.[`${expectedType}::${parts[2]}`] !== digest) throw new Error("canonical receipt slot digest mismatch");
    if (!wi || parts[2] === wi) matches.push(value);
  }
  const alias = envelope[expectedType];
  if (alias && (!wi || alias.wi === wi)) {
    if (!matches.some(value => isDeepStrictEqual(value, alias))) matches.push(alias);
  }
  if (matches.length !== 1) throw new Error(matches.length ? "ambiguous stage receipt" : "stage receipt missing for WI/SHA");
  return matches[0];
}

export function verifyStageReceipt(sha, expectedType, repoRoot = ".", wi = null) {
  try {
    const resolved = execFileSync("git", ["-C", String(repoRoot), "rev-parse", "--verify", `${sha}^{commit}`], {encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
    const note = execFileSync("git", ["-C", String(repoRoot), "notes", "--ref=svc-receipts", "show", resolved], {encoding:"utf8",stdio:["ignore","pipe","ignore"]});
    const body = selectStageReceipt(JSON.parse(note), {sha:resolved, expectedType, wi});
    return {ok:true,present:true,body,sha:resolved,reason:`${expectedType} receipt present on ${resolved.slice(0,8)}`};
  } catch(error) {
    return {ok:false,present:false,reason:`stage receipt failed closed: ${error.message}`};
  }
}

export async function verifyCurrentPlanExecution({
  sha,
  repoRoot = ".",
  planBytes,
  manifestPath,
  sealRef,
  body,
  wi,
} = {}) {
  const presence = verifyStageReceipt(sha, "plan-manifest", repoRoot, wi || body?.wi);
  if (!presence.present) {
    return { ok: false, executable: false, present: false, reason: presence.reason };
  }
  let assertCurrentExecution, loadPlanAuthority;
  try {
    const mod = await import("./lib/receipt-issuance-epoch.mjs");
    assertCurrentExecution = mod.assertCurrentExecution;
    loadPlanAuthority = mod.loadPlanAuthority;
  } catch (e) {
    return { ok: false, executable: false, present: true, reason: `current execution checker unavailable (fail-closed): ${String(e && e.message || e)}` };
  }
  if (typeof assertCurrentExecution !== "function") {
    return { ok: false, executable: false, present: true, reason: "assertCurrentExecution missing — fail-closed" };
  }
  if (body != null && !isDeepStrictEqual(body, presence.body)) {
    return {ok:false,present:true,executable:false,reason:"supplied plan body differs from selected note slot"};
  }
  const envBody = presence.body;
  if (planBytes == null || !manifestPath) {
    try { const found=loadPlanAuthority({consumerRoot:repoRoot,body:envBody});planBytes=found.planBytes;manifestPath=found.manifestPath;sealRef=sealRef||found.sealRef; }
    catch(error) { return {ok:false,executable:false,present:true,reason:`exact plan authority unavailable: ${error.message}`}; }
  }
  try {
    const evidence = assertCurrentExecution({
      consumerRoot: repoRoot,
      body: envBody,
      planBytes: Buffer.isBuffer(planBytes) ? planBytes : Buffer.from(planBytes),
      manifestPath,
      sealRef: sealRef || (envBody && (envBody.seal_ref || (envBody.planning_contract && envBody.planning_contract.seal_ref))) || null,
    });
    if (!evidence || evidence.executable !== true) {
      return { ok: false, executable: false, present: true, reason: "assertCurrentExecution did not return executable:true" };
    }
    return { ok: true, executable: true, present: true, kind: evidence.kind, reason: "current execution verified", verifiedBindings: evidence.verifiedBindings };
  } catch (e) {
    return { ok: false, executable: false, present: true, reason: `assertCurrentExecution failed closed: ${String(e && e.message || e)}` };
  }
}

export async function invokePlanning({ input, mode = "prepare", consumerRoot = ".", signal, limits } = {}) {
  if (mode !== "prepare" && mode !== "live" && mode !== "OFFLINE") {
    throw new Error(`unknown planning mode: ${mode}`);
  }
  let runTwoBox;
  try {
    const mod = await import("./two-box-plan.mjs");
    runTwoBox = mod.runTwoBox;
  } catch (e) {
    throw new Error(`two-box planning entry unavailable (fail-closed): ${String(e && e.message || e)}`);
  }
  if (typeof runTwoBox !== "function") throw new Error("runTwoBox missing — fail-closed");
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("planning --input must be a JSON object");
  }
  return runTwoBox({
    consumerRoot: input.consumerRoot || consumerRoot,
    wi: input.wi,
    originalRequirements: input.originalRequirements,
    scope: input.scope,
    baseSha: input.baseSha,
    facts: input.facts,
    contractContext: input.contractContext,
    mode,
    dispatch: input.dispatch,
    signal,
    limits: limits || input.limits,
    offline: input.offline,
  });
}

function argVal(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1] || null; }

async function mainCli() {
  const cmd = process.argv[2];
  if (cmd === "verify-receipt") {
    const type = argVal("--type") || "exec-record";
    const sha = argVal("--sha") || "HEAD";
    const root = argVal("--root") || ".";
    if (type === "plan-manifest") {
      const planFile = argVal("--plan-file");
      const manifestPath = argVal("--manifest");
      let planBytes = null;
      if (planFile) {
        const fs = await import("node:fs");
        planBytes = fs.readFileSync(planFile);
      }
      const r = await verifyCurrentPlanExecution({
        sha,
        repoRoot: root,
        wi: argVal("--wi"),
        planBytes,
        manifestPath,
        sealRef: argVal("--seal-ref") ? {type:"object",sha256:argVal("--seal-ref")} : undefined,
      });
      process.stdout.write(JSON.stringify(r, null, 2) + "\n");
      process.exit(r.ok && r.executable === true ? 0 : 1);
    }
    const r = verifyStageReceipt(sha, type, root);
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "plan") {
    const inputPath = argVal("--input");
    const mode = argVal("--mode") || "prepare";
    const root = argVal("--root") || ".";
    if (!inputPath) {
      console.error("usage: stage-segment plan --input <json> [--mode prepare|live|OFFLINE] [--root <dir>] [--out <json>]");
      process.exit(2);
    }
    const fs = await import("node:fs");
    const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const result = await invokePlanning({ input, mode, consumerRoot: root });
    const text = JSON.stringify(result, null, 2) + "\n";
    const out = argVal("--out");
    if (out) fs.writeFileSync(out, text);
    else process.stdout.write(text);
  } else if (cmd === "segments") {
    process.stdout.write(JSON.stringify(SEGMENTS, null, 2) + "\n");
  } else {
    console.error("usage: stage-segment (segments | plan --input <json> [--mode prepare|live|OFFLINE] | verify-receipt --sha <sha> --type <receipt-type> [--root <dir>] [--plan-file <json> --manifest <path>])");
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mainCli().catch((e) => {
    process.stderr.write(`${String(e && e.message || e)}\n`);
    process.exit(1);
  });
}
