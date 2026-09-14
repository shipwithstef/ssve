#!/usr/bin/env node
// check-review-round-cap.mjs — WI-491: mechanically enforce the bounded review loop.
//
// The adversarial plan/exec review loop is HARD-CAPPED at 3 rounds. Convergence is by
// DISPOSITION (done AT round <=3), NOT by the reviewer running out of High findings (it
// never does on a complex change). This script FAILS unbounded looping AND fail-closes
// on missing / fabricated / ambiguous evidence (WI-491 review EXEC-001..004).
//
// Enforced invariant (strict, fail-closed):
//   1. rounds_run is an integer in [0,3]. rounds_run > 3 is a VIOLATION regardless of any
//      later disposition — the disposition must be made AT round 3 to terminate.
//   2. A Critical finding is NEVER auto-accepted and NEVER promotes. An unresolved Critical
//      WITHOUT an exact escalation record is a VIOLATION (exit 1). An unresolved Critical
//      WITH an exact `terminal_state: ESCALATED_TO_USER` record HALTS (exit 3, blocking) —
//      escalation is a terminal BLOCKING state handed to the owner, never a promotion.
//   3. Every remaining High is individually dispositioned: a `bounded_exit` block must
//      enumerate one `residual_highs` entry per remaining High (count >= remaining_high)
//      AND carry an allowed `disposition`. A bare mention of `bounded_exit` proves nothing.
//
// Exit codes:
//   0  compliant — loop may terminate and the change may PROCEED
//   1  VIOLATION — unbounded loop, undispositioned High, unresolved Critical w/o escalation,
//                  or missing / malformed / fabricated evidence (fail-closed)
//   2  usage error (missing file, unreadable input, malformed argument)
//   3  valid escalation; HALT — unresolved Critical with a proper escalation record; the
//      loop is bounded but the change must NOT promote until the owner rules.
//
// Usage:
//   node scripts/check-review-round-cap.mjs --log <review-log.yaml>
//   node scripts/check-review-round-cap.mjs --rounds N --remaining-high K --dispositioned-high D \
//        --unresolved-critical C --escalated true|false

import fs from "node:fs";

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function fail(msg) { process.stderr.write(`check-review-round-cap: VIOLATION: ${msg}\n`); process.exit(1); }
function usage(msg) { process.stderr.write(`check-review-round-cap: usage: ${msg}\n`); process.exit(2); }
function halt(msg) { process.stderr.write(`check-review-round-cap: ESCALATED (halt): ${msg}\n`); process.exit(3); }
function ok(msg) { process.stdout.write(`check-review-round-cap: OK — ${msg}\n`); process.exit(0); }

const CAP = 3;
const ALLOWED_DISPOSITIONS = new Set(["fixed", "accept-with-justification", "reject-with-justification"]);

// Parse an integer that MUST appear exactly once as `key: <int>` on its own line.
// Returns {value} on success or {error} — never guesses / falls back to 0.
function requireIntField(text, key) {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*(-?\\d+)\\s*(?:#.*)?$`, "gim");
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return { error: `required field '${key}' is missing (fail-closed)` };
  if (matches.length > 1) return { error: `field '${key}' appears ${matches.length} times; exactly one required` };
  const n = Number(matches[0][1]);
  if (!Number.isInteger(n) || n < 0) return { error: `field '${key}' must be a non-negative integer, got '${matches[0][1]}'` };
  return { value: n };
}

// Count enumerated `residual_highs:` list entries under a bounded_exit block. Each must be a
// non-empty list item. Returns {count, disposition} or {error}. No prose credit.
function parseBoundedExit(text) {
  const lines = text.split(/\r?\n/);
  const beIdx = lines.findIndex((l) => /^\s*bounded_exit\s*:/.test(l));
  if (beIdx === -1) return { error: "no bounded_exit block, but remaining High findings require one" };
  const beIndent = lines[beIdx].match(/^\s*/)[0].length;
  // disposition: exactly one allowed value inside the block
  let disposition = null;
  let residualCount = 0;
  let inResidual = false;
  let residualIndent = -1;
  for (let i = beIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const indent = line.match(/^\s*/)[0].length;
    if (indent <= beIndent) break; // dedent — block ended
    const dispM = line.match(/^\s*disposition\s*:\s*([A-Za-z-]+)\s*(?:#.*)?$/);
    if (dispM && !inResidual) {
      if (disposition !== null) return { error: "multiple 'disposition' keys in bounded_exit" };
      disposition = dispM[1];
      continue;
    }
    if (/^\s*residual_highs\s*:\s*(?:#.*)?$/.test(line)) { inResidual = true; residualIndent = indent; continue; }
    if (inResidual) {
      if (indent <= residualIndent) { inResidual = false; }
      else {
        const item = line.match(/^\s*-\s*(.+?)\s*$/);
        if (item && item[1].replace(/^["']|["']$/g, "").trim().length > 0) residualCount++;
        continue;
      }
    }
    // allow an inline residual_highs: ["a","b"] form
    const inlineM = line.match(/^\s*residual_highs\s*:\s*\[(.*)\]\s*(?:#.*)?$/);
    if (inlineM) {
      residualCount += inlineM[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean).length;
    }
  }
  if (disposition === null) return { error: "bounded_exit block has no 'disposition'" };
  if (!ALLOWED_DISPOSITIONS.has(disposition)) return { error: `disposition '${disposition}' not in {${[...ALLOWED_DISPOSITIONS].join(", ")}}` };
  return { count: residualCount, disposition };
}

let rounds, remainingHigh, dispositionedHigh, unresolvedCritical, escalated, escalationExact;

const logPath = arg("--log");
if (logPath) {
  let text;
  try { text = fs.readFileSync(logPath, "utf8"); }
  catch { usage(`cannot read ${logPath}`); }

  if (process.argv.includes("--branch-once")) {
    const batches = requireIntField(text, "discovery_batches");
    if (batches.error) fail(batches.error);
    if (batches.value !== 1) fail("branch-once requires exactly one discovery batch; run parallel reviewers before edits, never restart full discovery");
    const unlinked = requireIntField(text, "unlinked_followup_findings");
    if (unlinked.error) fail(unlinked.error);
    if (unlinked.value !== 0) fail("follow-ups must link to original findings or patch-caused regressions; park unrelated findings for refinement");
  }
  const r = requireIntField(text, "rounds_run"); if (r.error) fail(r.error); rounds = r.value;
  const uc = requireIntField(text, "unresolved_critical"); if (uc.error) fail(uc.error); unresolvedCritical = uc.value;
  const rh = requireIntField(text, "remaining_high"); if (rh.error) fail(rh.error); remainingHigh = rh.value;

  // self_review_passes (§4) — additive telemetry only, never gates pass/fail/exit code.
  const srp = requireIntField(text, "self_review_passes");
  if (srp.error) console.warn("check-review-round-cap: self_review_passes not recorded — add it to the review-log per §4 (advisory only, does not affect this verdict)");
  else process.stdout.write(`check-review-round-cap: self_review_passes=${srp.value} (informational)\n`);

  // Cross-check the DECLARED rounds_run against the ACTUAL round_<N> records so a
  // fabricated counter cannot mask a completed 4th round (WI-491 review EXEC-005).
  const roundIdx = [...new Set([...text.matchAll(/^\s*round_(\d+)\s*:/gim)].map((m) => Number(m[1])))];
  const maxRound = roundIdx.length ? Math.max(...roundIdx) : 0;
  if (maxRound > CAP) fail(`a round_${maxRound} record exists — a ${maxRound}th round is forbidden past the HARD ${CAP}-round cap (declared rounds_run=${rounds} cannot hide it).`);
  if (roundIdx.length && rounds !== roundIdx.length) fail(`declared rounds_run=${rounds} disagrees with ${roundIdx.length} actual round_N record(s) {${roundIdx.sort((a, b) => a - b).map((n) => `round_${n}`).join(", ")}}. The counter must equal the number of round records.`);
  // A round record still marked pending cannot be counted toward a terminal pass.
  if (/^\s*status\s*:\s*pending\s*(?:#.*)?$/im.test(text)) fail("a round record is still 'status: PENDING' — the review is incomplete; a pending round cannot certify a terminal pass.");

  // Escalation is proven ONLY by an exact terminal_state, never by prose.
  escalationExact = /^\s*terminal_state\s*:\s*ESCALATED_TO_USER\s*(?:#.*)?$/im.test(text);
  escalated = escalationExact;

  // 1. HARD cap — always first.
  if (rounds > CAP) fail(`rounds_run=${rounds} exceeds the HARD ${CAP}-round cap. Terminate AT round ${CAP} by dispositioning remaining High findings or escalating Criticals — never start a 4th round.`);

  // 2. Criticals never promote. Escalated -> HALT (exit 3); un-escalated -> VIOLATION.
  if (unresolvedCritical > 0) {
    if (!escalationExact) fail(`${unresolvedCritical} unresolved Critical without an exact 'terminal_state: ESCALATED_TO_USER' record. Criticals always block and escalate.`);
    halt(`${unresolvedCritical} unresolved Critical correctly escalated (terminal_state: ESCALATED_TO_USER). Loop is bounded but the change MUST NOT promote until the owner rules.`);
  }

  // 3. Every remaining High individually dispositioned via an enumerated bounded_exit.
  if (remainingHigh > 0) {
    const be = parseBoundedExit(text); if (be.error) fail(be.error);
    if (be.count < remainingHigh) fail(`remaining_high=${remainingHigh} but bounded_exit enumerates only ${be.count} residual_highs entr${be.count === 1 ? "y" : "ies"}. Every remaining High needs its own disposition line.`);
  }
  ok(`rounds_run=${rounds} within the ${CAP}-round cap; no unresolved Critical; all ${remainingHigh} remaining High enumerated + dispositioned`);
} else {
  if (process.argv.includes("--branch-once")) usage("--branch-once requires --log with discovery and finding-lineage counters");
  rounds = Number(arg("--rounds"));
  remainingHigh = Number(arg("--remaining-high") ?? "0");
  dispositionedHigh = Number(arg("--dispositioned-high") ?? "0");
  unresolvedCritical = Number(arg("--unresolved-critical") ?? "0");
  escalated = String(arg("--escalated") ?? "false") === "true";
  // self_review_passes (§4) — optional, additive telemetry only, never gates exit code.
  const srpArg = arg("--self-review-passes");
  if (srpArg === undefined) console.warn("check-review-round-cap: self_review_passes not recorded (informational only): --self-review-passes not provided");
  else process.stdout.write(`check-review-round-cap: self_review_passes=${srpArg} (informational)\n`);
  // Fail closed on malformed numeric arguments — NaN must never bypass a comparison.
  for (const [n, v] of [["--rounds", rounds], ["--remaining-high", remainingHigh], ["--dispositioned-high", dispositionedHigh], ["--unresolved-critical", unresolvedCritical]]) {
    if (!Number.isInteger(v) || v < 0) usage(`${n} must be a non-negative integer`);
  }

  // 1. HARD cap.
  if (rounds > CAP) fail(`${rounds} rounds exceeds the HARD ${CAP}-round cap. Terminate AT round ${CAP} by dispositioning remaining High findings or escalating Criticals — never start a 4th round.`);
  // 2. Criticals never promote.
  if (unresolvedCritical > 0) {
    if (!escalated) fail(`${unresolvedCritical} unresolved Critical without an owner-escalation record. Criticals always block and escalate; they are never dispositioned/accepted.`);
    halt(`${unresolvedCritical} unresolved Critical correctly escalated. Loop bounded but the change MUST NOT promote until the owner rules.`);
  }
  // 3. Every remaining High dispositioned.
  if (remainingHigh > dispositionedHigh) fail(`${remainingHigh} remaining High but only ${dispositionedHigh} carry a documented disposition. Every remaining High needs accept-with-justification (logged risk) or reject-with-justification.`);
  ok(`${rounds} round(s) within the ${CAP}-round cap; no unresolved Critical; all ${remainingHigh} remaining High dispositioned`);
}
