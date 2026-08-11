#!/usr/bin/env node
// no-loss-verify — WI-463 harness. Prove a change introduces ZERO new failures vs the
// OLD baseline in ~4 suite runs instead of ~17 (audit 2026-06-29). Thin orchestrator;
// changes NO validator. Calls the WI-462 preflight guard before the verify loop, so the
// two discipline traps (wrong cwd, no baseline-first) cannot recur.
//
// Usage:
//   node scripts/no-loss-verify.mjs --record-baseline [--runner "<cmd>"]
//       Run the suite NOW (intended: on the OLD/origin-main tree, in THIS clean env) and
//       save the failure set + tree_hash + exit code to .svc/verify-baseline.json.
//   node scripts/no-loss-verify.mjs [--verify] [--runner "<cmd>"]
//       preflight guard -> run the suite (NEW) -> diff vs baseline -> report.
//       exit 0 iff NEW failure tokens are a subset of baseline AND exit code not worse;
//       exit 1 on a regression; exit 2 if the guard blocks or the baseline is invalid.
//
// Default runner: bash test-framework/evals/run-all-evals.sh

import { execSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { preflight, repoRoot, BASELINE_PATH } from "./lib/no-loss-preflight.mjs";

const DEFAULT_RUNNER = "bash test-framework/evals/run-all-evals.sh";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Run the suite, returning BOTH output and exit code (a failing suite exits non-zero;
// we must NOT silently swallow that — Codex P1: swallowed exit hides non-validator regressions).
function runSuite(runner) {
  try {
    const out = execSync(runner, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { out, code: 0 };
  } catch (e) {
    return { out: (e.stdout || "") + (e.stderr || ""), code: typeof e.status === "number" ? e.status : 1 };
  }
}

// Comprehensive failure-token set — NOT just validate-* (Codex P1: tier-2/3 + RESULT
// failures must be captured or a regression there reads as "no-loss"). Tokens:
//   - validator names (validate-X.sh/mjs) from "FAIL: validate-X"
//   - "RESULT:FAIL" (any overall suite failure)
//   - tier failure lines ("Tier 2 [integration]: FAIL", "Tier 1.5 ...: FAIL")
//   - per-scenario "test-X: FAIL"
function failTokens(out) {
  const s = new Set();
  for (const raw of out.split("\n")) {
    const line = raw.trim();
    const v = line.match(/FAIL:\s+(validate-[a-z0-9-]+\.(?:sh|mjs))/);
    if (v) { s.add(v[1]); continue; }
    if (/^RESULT:\s*FAIL/i.test(line)) { s.add("RESULT:FAIL"); continue; }
    if (/^Tier\b.*\bFAIL\b/i.test(line)) { s.add(line.replace(/\s+/g, " ")); continue; }
    const t = line.match(/^(test-[a-z0-9-]+)\b.*:\s*FAIL/i);
    if (t) s.add(t[1]);
  }
  return [...s].sort();
}

function tree() {
  return execSync("git rev-parse HEAD^{tree}", { encoding: "utf8" }).trim();
}

const runner = arg("--runner", DEFAULT_RUNNER);
const root = repoRoot();

if (process.argv.includes("--record-baseline")) {
  const { out, code } = runSuite(runner);
  const rec = {
    schema: 1,
    tree_hash: tree(),
    runner,
    exit_code: code,
    baseline_failures: failTokens(out),
    recorded_at: new Date().toISOString(),
  };
  writeFileSync(`${root}/${BASELINE_PATH}`, JSON.stringify(rec, null, 2) + "\n");
  console.log(
    `no-loss-verify: baseline recorded on tree ${rec.tree_hash.slice(0, 12)} (exit ${code}) — ` +
      `${rec.baseline_failures.length} pre-existing failure(s): ${rec.baseline_failures.join(", ") || "none"}`
  );
  process.exit(0);
}

// default = --verify
const pf = preflight({ requireBaseline: true });
if (!pf.ok) {
  console.error("no-loss-verify: preflight BLOCKED (WI-462 guard)\n  - " + pf.reasons.join("\n  - "));
  process.exit(2);
}
const base = JSON.parse(readFileSync(`${root}/${BASELINE_PATH}`, "utf8"));
const baseFails = base.baseline_failures || [];
const baseCode = typeof base.exit_code === "number" ? base.exit_code : null;
const currentTree = tree();
// Codex P1: a baseline recorded on the CURRENT (changed) tree cannot prove no-loss —
// it would absorb a newly-introduced failure as "pre-existing". Demand an OLD-tree baseline.
if (base.tree_hash && base.tree_hash === currentTree) {
  console.error(
    `no-loss-verify: INVALID BASELINE — recorded on the CURRENT tree (${currentTree.slice(0, 12)}). ` +
      `Record the baseline on the OLD/origin-main tree FIRST (git stash/checkout the pre-change tree, ` +
      `--record-baseline), so NEW failures are diffed against the unchanged state (WI-462/463).`
  );
  process.exit(2);
}

const { out: newOut, code: newCode } = runSuite(runner);
const newFails = failTokens(newOut);
const introduced = newFails.filter((f) => !baseFails.includes(f));
console.log(`no-loss-verify: baseline tree=${(base.tree_hash || "?").slice(0, 12)} exit=${baseCode} failures=[${baseFails.join(", ") || "none"}]`);
console.log(`no-loss-verify: NEW      tree=${currentTree.slice(0, 12)} exit=${newCode} failures=[${newFails.join(", ") || "none"}]`);
// Worse = NEW exits non-zero with a code different from baseline (catches 0->1, 1->2,
// 0->2, not just 0->nonzero — Codex P1 round 2). Same code or NEW==0 is not-worse.
const codeWorse = baseCode !== null && newCode !== 0 && newCode !== baseCode;
if (introduced.length === 0 && !codeWorse) {
  console.log("no-loss-verify: NO-LOSS — NEW failure tokens are a subset of baseline and exit code is not worse (zero regressions introduced)");
  process.exit(0);
}
if (codeWorse) console.error(`no-loss-verify: REGRESSION — suite exit code worsened (baseline ${baseCode} -> NEW ${newCode})`);
if (introduced.length) console.error(`no-loss-verify: REGRESSION — ${introduced.length} new failure(s) not in baseline: ${introduced.join(", ")}`);
process.exit(1);
