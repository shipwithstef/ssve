---
name: blind-control-plan
version: "1.0"
self_verify: true
human_checkpoint: false
description: >
  Canonical Two-Box Planning entry for current substantive work (skill id remains
  blind-control-plan). Use between plan-changeset and review-plan when live-recomputed
  staged eligibility is not accepted. Independent Open and Contract boxes, Contract-only
  exactly two scouts, distinct original and revised Contract, grounded assessor, complete
  conversion before review-plan, and a separate seal after. Triggers: two-box, two-box
  planning, blind-control-plan, control-plan v2, runTwoBox. Legacy v1 F>=B floor helpers
  are historical inspection only and never grant current execution.
inputs:
  required:
    - original-requirements (owner intent and constraints)
    - living-specs-and-designs (carried into Contract and conversion)
  optional:
    - frozen-facts (bounded annotations; source bytes come from the repo snapshot)
    - contract-context (contained spec/design paths)
outputs:
  produces:
    - artifact: control-plan-receipt
      path: refs/notes/svc-receipts (mirror .svc/receipts/<sha>/control-plan.json)
chain:
  lanes: {}   # gate, not a pipeline step (mirrors review-plan); inserted adjacent, not as a lane position
---

**Announce at start:** "I'm using blind-control-plan as the Two-Box Planning entry (independent Open/Contract, two Contract-only scouts, assessor, conversion, then existing review-plan and a separate seal)."

# Two-Box Planning

Current orchestration is `node scripts/two-box-plan.mjs --input <json>` (default `--mode prepare`, no paid call). Explicit `--mode live` runs exactly one `runTwoBox`. Current control evidence is strict control-plan v2. Legacy `blind-floor-check` / `blind-floor-judge` / `decide()` are historical/read-only inspection and never current execution authority.

Do not skip current substantive work via opt-in dual_track, `.svc/dual-track.off`, file-count, class, size, caller `eligible`, or a historical SHA. Recompute staged eligibility with `evaluateEligibility`. Unproved current routing is `run:true` unless that live recompute accepts lightweight eligibility. OFFLINE fixtures are nonauthoritative.

## Process

### P1 — eligibility
Ignore any supplied eligible boolean. `runTwoBox` recomputes `scripts/quick-fix-eligibility.mjs` on the real consumer staged tree. No staged/real diff => not eligible. Eligible true + bound tree hash => v5 lightweight alternative (no control_plan_ref). Else continue.

### P2 — independent boxes
Controller-owned read-only tool-free harness subprocesses. Open Box: original requirements + frozen facts only; no SSVE methodology or competing plan. Contract Box: same originals plus living specs/designs; no Open output. Persist original Open and original Contract as distinct objects before either scout.

### P3 — exactly two Contract-only scouts
`scout_forward` and `scout_reverse` are separate processes on the Contract original only. They never receive Open. Empty or identical assignments fail. Incomplete reports stay incomplete; the assessor must dispose consequential gaps.

### P4 — revise + assess
Revised Contract is a distinct object (same digest allowed only if bytes unchanged). Assessor sees both originals, revised Contract, scout reports, and source facts. Winner is only `open_win`, `contract_win`, or `combination`. `reject_innovation` is a disposition. Unresolved conflict blocks conversion.

### P5 — convert, then review, then seal
Reconcile selected consequential decisions into specs/designs and prepare the complete current contract BEFORE review-plan. Run existing holistic review-plan once. Seal is a separate envelope; do not rewrite reviewed bytes. Then execute-changeset.

### P6 — self-verify
Run the Self-Verify table. A v1 `floor_verdict` does not grant current execution.

## Pipeline Continuation
Source of truth: `.svc/lane-tasks-<WI>.json`. This is a gate invoked adjacent to plan-changeset (not a lane position). Lightweight-eligible work continues without control-plan v2. Otherwise: prepared complete contract → review-plan → seal → execute-changeset. Mark the gate task complete; mirror host task state.

### Task-graph mode
source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Claude Code mirror file state with `TaskList`/`TaskUpdate`; in Kimi use `/task` as observation only; in Codex and other hosts without native task-mutation APIs, mirror only the active step in `update_plan` (never the full graph). Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Current entry | Live orchestration is `scripts/two-box-plan.mjs` / `runTwoBox`; this skill does not author Open/Contract/scout judgments | |
| 2 | Eligibility | Caller eligible/opt-in/kill-switch/file-count/SHA cannot skip; `evaluateEligibility` on the staged tree decides lightweight vs Two-Box | |
| 3 | Isolation + scouts | Open and initial Contract are independent; exactly two scouts on Contract original only; original/revised remain distinct | |
| 4 | Conversion order | Complete current contract exists before review-plan; seal is a separate post-review envelope | |
| 5 | No v1 authority | `floor_verdict` / historical `decide()` / OFFLINE fixtures do not grant current execution | |
