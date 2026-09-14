# Deep-dive #8: Plan DAG Validation (GSD row #74) — SKIP

**Source:** GSD `bin/lib/verify.cjs` — parses `<task>` XML blocks from PLAN.md, mathematically verifies that if Task B requires an artifact from Task A then Task A is scheduled first. The earlier `proposals/2026-05-12-blend-gsd-validation-routing.md` already concluded svc's concern-routing architecture is BETTER. This deep-dive formalizes that decision against the 10-scenarios-or-skip discipline.

**Decision required:** adopt OR skip.

## What the feature is

Pre-execute validation that runs after the Planner agent outputs PLAN.md. Parses every `<task>` XML block, builds a DAG of producer/consumer relationships from `depends_on` attributes, and refuses to dispatch the plan if (a) a cycle exists, (b) a task references a non-existent producer, or (c) ordering would corrupt parallel execution.

GSD's claim: catches malformed plans before parallel execution corrupts the repo.

## svc current state

svc's `scripts/scan-concerns.mjs` runs at FOUR distinct lifecycle points (session start, pre-WI dispatch, pre-commit, review-gate G3). The DECOUPLED design separates "what changed" from "who needs to check it." Schema files (`schema.sql`, `*.types.ts`, package.json, etc.) signal-match to `concerns/<name>.md` files, which list `required_skills` that must engage. New requirements drop in as a new `concerns/*.md` file; no plan-rewrite needed.

Additionally, `scripts/lib/structured-gate-engine.mjs` + per-gate configs at `scripts/gates/*.mjs` enforce gate-time validation against the same concern registry.

## 10 scenarios — analyzing whether to adopt

### Scenario 1: Plan adds Task B requiring an artifact from Task A; A isn't scheduled first

**Today (svc):** plan-changeset manifest enumerates tasks with explicit `blocked_by` arrays. `scripts/validate-task-graph-lane.mjs` already does cycle detection + dependency validation on `.svc/lane-tasks-<WI>.json`. The DAG is enforced.
**With GSD-style XML DAG:** same validation, different data shape (XML attributes vs JSON arrays).
**Improvement:** ZERO — svc already has DAG validation, just at the JSON layer.
**Verdict: NEUTRAL (already covered).**

### Scenario 2: New evidence family requires a new validator skill

**Today (svc):** drop `concerns/<new-name>.md` declaring `signals` + `handled_by.required_skills: [<skill>]`. Any future plan touching the signal automatically picks up the new validator. Decoupled.
**With GSD-style XML DAG:** the planner agent's prompt must be updated to know about the new evidence family. Failure to update the prompt = plan passes DAG validation but lacks the new validator. The exact F-6 failure mode that motivated the validation-routing analysis.
**Improvement:** NEGATIVE — coupling new requirements to planner prompts is the failure mode svc already designed around.
**Verdict: NEGATIVE.**

### Scenario 3: Security engineer adds `concerns/pii-data.md` mid-project

**Today (svc):** the new file IS the activation. Any future plan touching PII picks up the security validator automatically. Zero coordination with planner.
**With GSD-style XML DAG:** the security engineer must coordinate with whoever maintains the planner prompt. Multi-team friction.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 4: Pre-execution catch vs post-plan catch

**Today (svc):** concern scan fires at FOUR points (session start, pre-WI dispatch, pre-commit, review-gate G3). The repeated firing acts as a defense-in-depth ratchet — even if a plan goes sideways, pre-commit will block the change.
**With GSD-style XML DAG:** single-point check at end of planning. If the planner's output is consumed without re-validation, post-plan changes (e.g. ad-hoc edits during execute) bypass the DAG check.
**Improvement:** NEGATIVE — single-point validation is less robust than 4-point concern scanning.
**Verdict: NEGATIVE.**

### Scenario 5: Plan correctness vs deployment correctness

**Today (svc):** concerns route subject-matter to validator skills. The validator's actual outputs (e.g. "feature_validation_closeout" passes) are part of the gate. NOT just "plan is well-formed."
**With GSD-style XML DAG:** validates plan well-formedness. Says nothing about whether the right validators will actually fire / pass.
**Improvement:** NEGATIVE — narrower than svc's existing coverage.
**Verdict: NEGATIVE.**

### Scenario 6: Cost of adoption

**Today (svc):** N/A.
**With GSD-style XML DAG:** would require migrating to GSD's XML plan format (deep-dive #7 rejected this) OR adding a parallel DAG validation that runs on `.svc/lane-tasks-<WI>.json` (mostly duplicates what `validate-task-graph-lane.mjs` already does). Either path is unjustified.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 7: Codex F-6 finding context

**Today (svc):** the F-6 finding (Codex added `feature_validation_closeout` to review-gate but forgot to add `concerns/feature-validation-closeout.md`) was a HUMAN/agent error in deploying a new framework feature concurrently. svc's response: add a `validate-concern-parity.mjs` linter (still pending per scorecard row #74) that enforces "if a gate names a family, the concern must exist."
**With GSD-style XML DAG:** would NOT have caught F-6 either — GSD's DAG validates plan-task ordering, not "named-feature-has-backing-concern."
**Improvement:** the LINTER is the right fix; the DAG is irrelevant.
**Verdict: NEGATIVE (DAG doesn't address the actual failure mode).**

### Scenario 8: Even GSD-2 moved away

**Today (svc):** N/A.
**With GSD-style XML DAG:** GSD-2 (the newer Pi SDK harness) uses SQLite + JSON for state machine, not XML DAG. Even GSD's own evolution has been away from the pattern.
**Improvement:** NEGATIVE (adopting an outgoing pattern).
**Verdict: NEGATIVE.**

### Scenario 9: Architectural fit

**Today (svc):** decoupled signal/handler routing is the architecture. Concerns + handles_concerns frontmatter + 4-point scanner.
**With GSD-style XML DAG:** centralized planner-knows-all model. Architecturally incompatible.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 10: The previous analysis (proposal `2026-05-12-blend-gsd-validation-routing.md`) said SKIP

**Today (svc):** that analysis concluded svc is BETTER. ACTION required: ship `scripts/validate-concern-parity.mjs` (the deploy-concurrent linter) — still pending per scorecard row #74.
**With GSD-style XML DAG:** would override the prior analysis without new evidence.
**Improvement:** NEGATIVE (contradicts prior analysis with no new evidence).
**Verdict: NEGATIVE.**

### Scenario count: **0 POSITIVE / 8 NEGATIVE / 1 NEUTRAL / 1 already covered.**

## Blast radius (if adopted)

| Touched | Type | Regression risk | Notes |
|---|---|---|---|
| concern-routing system | core | HIGH: architectural conflict | concerns/ + handles_concerns lose their decoupling value |
| plan-changeset / execute-changeset | core skills | HIGH: shift to centralized planner-knows-all | undoes the 4-point ratchet |
| New-evidence-family deployment | UX | HIGH: requires planner prompt coordination | reintroduces F-6 failure mode |

**Net regression risk:** HIGH.

## Decision

**SKIP.** Already analyzed in `proposals/2026-05-12-blend-gsd-validation-routing.md` and confirmed here. svc's concern-routing architecture is strictly better than GSD's static XML DAG for the same problem space.

The COMPENSATING action (NOT adoption of GSD's pattern) is to ship `scripts/validate-concern-parity.mjs` — the deploy-concurrent linter that enforces "every named family in delivery-graph or review-gate has a backing `concerns/<family>.md`." That's a small, targeted lint. Tracked as a separate implementation PR; scorecard row #74 verdict is **✋ SKIP** with a sibling pending implementation noted.

## Implementation handoff

None for GSD pattern. The compensating `validate-concern-parity.mjs` linter ships as a separate small PR (estimated ~50 lines + tier-1 fixture).

Scorecard row #74 verdict: **✋ SKIPPED** with link to this deep-dive AND link to the pending `validate-concern-parity.mjs` implementation PR.
