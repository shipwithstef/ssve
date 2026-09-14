// no-loss-preflight — WI-462 discipline guard for no-loss verification loops.
//
// The 2026-06-29 speed audit (docs/analysis/2026-06-29-session-speed-audit.md) found
// ~11 of 17 wasted tier-1 runs came from two discipline failures, repeatable and
// mechanically preventable (FRAMEWORK-STATE "mechanical enforcement over agent discipline"):
//   1. running validators from the WRONG cwd (they are cwd-sensitive → inflated failures
//      → a phantom race-hunt), and
//   2. entering the verify loop WITHOUT first recording the OLD-baseline failure set in
//      the SAME env (so pre-existing env-reds get chased as regressions).
//
// This guard is a pure pre-check. The WI-463 harness (no-loss-verify.mjs) calls
// preflight() before looping; any other verify loop can call it too. It changes NO
// validator — it only blocks an undisciplined loop entry with a canonical fix.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BASELINE_PATH = ".svc/verify-baseline.json";

export function repoRoot(cwd = process.cwd()) {
  return execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf8" }).trim();
}

// Returns { ok: boolean, reasons: string[] }.
// ok=true only when cwd === repo root AND (when requireBaseline) a well-formed
// OLD-baseline marker exists.
export function preflight({ cwd = process.cwd(), requireBaseline = true } = {}) {
  const reasons = [];
  let root;
  try {
    root = repoRoot(cwd);
  } catch {
    return { ok: false, reasons: ["not inside a git repository"] };
  }
  if (cwd !== root) {
    reasons.push(
      `cwd is not the repo root (cwd=${cwd}, root=${root}). Validators are cwd-sensitive; ` +
        `run verification from the repo root (WI-462, audit 2026-06-29).`
    );
  }
  if (requireBaseline) {
    const bp = join(root, BASELINE_PATH);
    if (!existsSync(bp)) {
      reasons.push(
        `no OLD-baseline recorded (${BASELINE_PATH} missing). Record the OLD-baseline ` +
          `failure set in THIS env FIRST (no-loss-verify.mjs --record-baseline) so NEW ` +
          `failures are diffed against pre-existing env-reds, not chased as regressions (WI-462).`
      );
    } else {
      try {
        const b = JSON.parse(readFileSync(bp, "utf8"));
        if (!Array.isArray(b.baseline_failures)) {
          reasons.push(`${BASELINE_PATH} malformed: missing baseline_failures[] array`);
        }
      } catch (e) {
        reasons.push(`${BASELINE_PATH} unreadable: ${e.message}`);
      }
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// CLI: node scripts/lib/no-loss-preflight.mjs [--no-baseline]
if (import.meta.url === `file://${process.argv[1]}`) {
  const requireBaseline = !process.argv.includes("--no-baseline");
  const r = preflight({ requireBaseline });
  if (r.ok) {
    console.log("no-loss-preflight: OK (cwd=repo-root" + (requireBaseline ? " + baseline recorded)" : ")"));
    process.exit(0);
  }
  console.error("no-loss-preflight: BLOCKED\n  - " + r.reasons.join("\n  - "));
  process.exit(1);
}
