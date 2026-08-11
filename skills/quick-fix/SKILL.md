---
name: quick-fix
version: "1.0"
description: >
  DEPRECATED (retired as a lane) — quick-fix is retired; do not route new
  requests here. Speed for small/trivial changes now comes from conditional
  stage activation (`scripts/stage-activation.mjs`) inside the normal chain
  via route-workflow, not a separate fast lane. See the skill body for the
  retirement notice and pointer.
phases:
  - id: P1-QuickFixEligibilityGate
    trigger: always
    reads: ["user request", "git status", "changed-file estimate"]
    writes: [".svc/quick-fix-eligibility.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-RelevantFileReadAndRootCause
    trigger: always
    reads: ["target files", "error text", "spec references when present"]
    writes: [".svc/quick-fix-root-cause.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-MinimalEditApplied
    trigger: always
    reads: ["target files"]
    writes: ["changed files, maximum three"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-VerificationExecuted
    trigger: always
    reads: ["test/lint/typecheck commands", "project scripts"]
    writes: [".svc/quick-fix-verification.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-SpecSyncDecision
    trigger: behavior-covered-by-spec
    reads: ["git diff --cached --name-only", "docs/specs/features/"]
    writes: [".svc/quick-fix-spec-sync.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-CommitAndDecisionLog
    trigger: always
    reads: ["git diff", ".svc/pipeline-decisions.jsonl", "docs/specs/project-state.md"]
    writes: [".svc/pipeline-decisions.jsonl", "docs/specs/project-state.md when present", "git commit"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["git log -1", "git diff HEAD~1 --name-only", ".svc/lane-tasks-<WI>.json when present"]
    writes: [".svc/quick-fix-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/project-state.md", artifact: project-state }
outputs:
  produces: []
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# quick-fix — RETIRED

**Status: DEPRECATED (retired as a lane), 2026-08 — WI-512, one-lane
framework batch (`proposals/2026-08-02-one-lane-framework.md` §1: "There is
no quick fix — there are only cheap mutations").**

There is no such thing as a cheap MUTATION versus an expensive LANE. Cost is
a property of which STAGES a diff actually needs, and that is now
machine-checkable per diff, not a decision made once at intake by picking a
lane name.

**Where the speed comes from now:** conditional stage activation
(`scripts/stage-activation.mjs`). Every stage declares a machine-checkable
activation condition evaluated against the diff. A stage whose condition
evaluates false is recorded `na` with the condition and its evaluation — not
a human "n/a" sentence. The essential stages (`plan`, `review-plan`,
`implement`, `review-exec`, `spec-sync`, index re-stamp) always run;
everything else activates only when its condition is true. A one-line fix
now simply activates fewer stages instead of needing a separate lane to get
that outcome.

**Do this instead:** route the request through `route-workflow`, same as any
other change. The chain evaluates which stages are conditionally active for
this diff (via `scripts/stage-activation.mjs`) and records the rest as `na`
with a cited condition, not a judgment call.

**Left untouched by this retirement — and deliberately so:** the eligibility
machinery (`hooks/git/pre-commit.d/20-quick-fix-eligibility`,
`scripts/quick-fix-eligibility.mjs`, `scripts/classify-change-risk.mjs`)
stays exactly as it was. It remains in place as a bypass detector: a change
that tries to skip the chain entirely — not just skip its conditionally
inactive stages — still gets caught.

## Self-Verify

Retired skills execute no phases, so this table verifies the retirement
itself, not a fix.

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Description starts with the deprecation marker | `grep '^  DEPRECATED (retired as a lane)' skills/quick-fix/SKILL.md` | |
| 2 | No routing table still names `quick-fix` as a live destination | `grep -rn '\`quick-fix\`' skills/route-workflow/references/*.md` returns only the retired-lane note, never a bare destination cell | |
| 3 | Eligibility machinery is untouched | `git diff -- scripts/quick-fix-eligibility.mjs scripts/classify-change-risk.mjs hooks/git/pre-commit.d/20-quick-fix-eligibility` is empty | |

## Pipeline Continuation

### Task-graph mode (compatibility only — source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`. This skill does not chain: if a graph names `quick-fix`, repair that stale step to `route-workflow`. Historical graph migration records each declared compatibility phase with `node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> <phase-id> --evidence <kind:path>`; new work uses conditional stage activation instead.
