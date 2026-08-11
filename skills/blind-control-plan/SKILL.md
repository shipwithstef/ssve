---
name: blind-control-plan
version: "1.0"
self_verify: true
human_checkpoint: false
description: >
  Best-of-2 retention floor that proves the framework plan is never worse than a
  bare-model "blind" plan. Generates a context-starved blind plan B, deterministically
  diffs it against the framework plan F, and — when F silently removes or weakens a
  correct B-element without an independent cross-family judge certifying a strict
  improvement — ships B verbatim (floor_verdict=blind-adopted). Emits a control-plan
  ROI receipt. v1 is WARN/shadow, default OFF (armed via .svc/chain-policy.json
  dual_track:"measured"); it is a gate, not a pipeline step. Use between plan-changeset
  and review-plan on infra-path + M+ plans when dual-track is armed. WI-410.
inputs:
  required:
    - blind-plan-B (context-starved: spec + ACs only, no svc skills/checklists)
    - framework-plan-F (the plan-changeset manifest, structured as elements)
  optional:
    - judge-verdicts (cross-family certifications for REMOVE/ALTER rows)
outputs:
  produces:
    - artifact: control-plan-receipt
      path: refs/notes/svc-receipts (mirror .svc/receipts/<sha>/control-plan.json)
chain:
  lanes: {}   # gate, not a pipeline step (mirrors review-plan); inserted adjacent, not as a lane position
---

**Announce at start:** "I'm using blind-control-plan to prove the framework plan is never worse than the blind baseline."

# Blind-Control-Plan Floor

The framework only earns its tokens if its plan beats what the bare model would have produced. This gate makes that measurable and makes "never worse than blind" true *by construction* (best-of-2 retention), not by trusting a judge.

> **NOT a refinement loop.** The framework never *edits* the blind plan — intrinsic self-correction degrades quality (Huang et al. ICLR 2024; OAgents reflection −6.62% on hard tasks). B and F are independent candidates; B is kept immutable and returnable.

## Arming (v1: WARN/shadow, default OFF)
Run only when `scripts/blind-floor-route.mjs` returns `run:true` — armed by `.svc/chain-policy.json` `{"dual_track":"measured"}`, infra-path + M+, no `.svc/dual-track.off` kill-switch. Otherwise SKIP (blind==framework for trivial/exempt work; the floor trivially holds). In v1 this gate is **WARN-only**: it logs + emits the receipt but does NOT block promotion, and `control-plan` is NOT in `REQUIRED_TYPES_FULL`.

## Process

### P1 — generate-blind
Spawn a context-starved sub-invocation (spec + ACs only; explicit "no svc skills/checklists/review-tier knowledge"), same model family as the framework author. Emit B as `{elements:[{key,content}]}` keyed by `(path, task-id, AC-id)`. Log `contamination_note` (B is not provably framework-free — accepted risk). Read the probe-free tuple policy from `resolve-adversarial-reviewer.sh`; the canonical launcher's primary invocation is the availability probe.

### P2 — deterministic-delta
`node scripts/blind-floor-check.mjs --blind B.json --merged F.json` classifies every B-element KEEP/REFINE/ADD/REMOVE/ALTER. Isolate the REMOVE/ALTER rows — they are the only rows needing a verdict.

### P3 — judge-removals
For REMOVE/ALTER rows only: `bash scripts/blind-floor-judge.sh --blind B.json --merged F.json --rows rows.json`. The judge is cross-family (Claude never judges Claude), OUTPUT-FIRST, instructed "longer is NOT better", defaults to REJECT on uncertainty. Exit 4 is an actionable canonical-launcher failure: preserve its receipt and halt; exit 3 remains reserved for the retired no-judge retention hatch. Only a substantive negative certification adopts B.

### P4 — floor-decision
Re-run `blind-floor-check.mjs --verdicts judge.json`: `pass` (zero uncertified REMOVE/ALTER → ship F), or repair F to re-add the element, or `--adopt-blind` → ship B verbatim (`blind-adopted`). svc NEVER writes `certified_strict_improvement` — only the judge verdicts file does.

### P5 — emit receipt
`node scripts/emit-receipt.mjs --type control-plan --wi <WI>` with `floor_verdict`, `element_ledger`, `judge{reviewer_family,certifications}`, model/profile/registry_version, `tree_hash`. `blind-adopted` is a logged negative-ROI signal ("framework did not beat blind here").

### P6 — self-verify
Run the Self-Verify table; record the phase receipt.

## Pipeline Continuation
Source of truth: `.svc/lane-tasks-<WI>.json`. This is a gate invoked adjacent to plan-changeset (not a lane position). On `pass` → continue to `review-plan`. On `blind-adopted` → the shipped plan is B; continue with B. Mark the gate task complete; mirror host task state. In v1 (WARN/shadow) a `fail` verdict is logged + receipted but does not block — it is the measurement that gates the v2 flip to BLOCK (≥20 shadow plans + ≥1 real catch).

### Task-graph mode
source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Claude Code mirror file state with `TaskList`/`TaskUpdate`; in Kimi use `/task` as observation only; in Codex and other hosts without native task-mutation APIs, mirror only the active step in `update_plan` (never the full graph). Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Deterministic floor | `bash test-framework/evals/tier-1/validate-blind-floor.sh` exits 0 (run-twice golden, both negatives exit non-zero) | |
| 2 | Anti-self-grade | gate/check output never carries `certified_strict_improvement`; only the judge verdicts file does | |
| 3 | Judge independence | `reviewer_family != anthropic` on any pass/refined certification (`resolve-adversarial-reviewer.sh`) | |
| 4 | No degraded review | judge-unavailable / kill-switch / budget / capability failure halts with the canonical receipt; only a substantive negative certification may produce `blind-adopted` | |
| 5 | WARN/shadow honored | v1 emits the receipt but does not block; `control-plan` NOT in `REQUIRED_TYPES_FULL` | |
