# Framework Improvement: Port/convert parity baseline = legacy source, not deployed product

**Status:** IMPLEMENTED (2026-06-15)

## Evidence
- **Source:** session audit `example-marketplace/proposals/2026-06-15-session-audit-landing-hero-restore.md` (finding F1) → evolution survey `proposals/2026-06-15-evolution-landing-audit.md` (F1m).
- **Finding:** in a cut-over port repo, "do the landing images differ from the original?" was answered by diffing the port against the **deployed product** (`example-marketplace.app`), which already serves the port build — guaranteeing a false "parity" result. The real difference (7 swapped hero images) was only found after 3 user corrections forced consulting the **legacy source repo**.
- **Severity:** medium (wrong answer + wasted user turns; clear mechanical home).

## Diagnosis
- **Root cause:** no contract told the agent that a cut-over port's deployed product is NOT the original; the comparison baseline (legacy source repo) was never resolved.
- **Category:** missing capability (Gap).
- **Already in FRAMEWORK-STATE.md?** No. The five `baseline` learnings concern visual-asset deploy capture, not parity comparison-baseline resolution.

## Implementation
- **Route:** direct edit — additive correction rule (exempt under `rules/plan-changeset-trigger.md`: additive documentation, no behavior change to existing flows; logged rationale here).
- **Files changed:**
  - `rules/common/port-parity-baseline.md` (new correction rule).
  - `skills-manifest.json` — new `rulesRegistry` entry, `auto_inject: "signal"` keyed on parity/baseline artifact paths (`parity.*results`, `port-parity`, `parity-verification`, `source-parity`, `source-content-drift`).
- **Commits:** (this commit)

## Replay Verification
- **Replay target:** the signal must inject the rule when an agent touches a parity/baseline artifact, and must NOT inject on unrelated source files.
- **Result:** PASS (partial coverage).
  - `parity_verification_results.md` → INJECTS ✅
  - `docs/specs/port-parity-baseline.md` → INJECTS ✅
  - `scripts/audit-source-parity.mjs` → INJECTS ✅
  - `src/pages/Landing.jsx` → skips ✅
- **Known limit (honest):** the original failure went *straight to the deployed
  URL* without consulting any parity artifact, so a path-signal would not have
  fired in that exact path. Full intent-level coverage needs a one-line consumer
  reference in route-workflow's verification/parity routing — tracked as a
  follow-up (route-workflow is a hot-path contract file → pipeline route, not a
  reactive edit). The rule body + registry note still teach the baseline
  discipline and fire on the common case (agent consults parity docs).

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add 2026-06-15 entry (rule added + replay).
- **Known Gaps:** add F2 (shared-checkout commit guard), F3 (e2e-guard session
  ownership), F4 (deploy-from-merged gate) as deferred-to-research+pipeline; note
  F5 folds into the existing WI-213 enforcement row.
- **Capabilities:** no change (advisory rule, not a new skill capability).
