---
name: review-gate
version: "1.0"
handles_concerns:
  - build-ship-alignment
  - data-model-mutation
  - auth-surface
  - pii-handling
  - feature-validation-closeout
  - provider-fidelity
description: Use at every review gate (G1-G7) to run the universal 5-step review protocol — self-review, self-judgment, cross-review, convergence check, and gate decision — producing structured, parseable findings that block or pass artifact state transitions
phases:
  - id: P1-GateContextChecklistConcernScan
    trigger: always
    reads: ["artifact under review", "gate-specific checklist", "concerns/REGISTRY.json", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/review-gate-context.log", ".svc/concern-hits.jsonl when concern scan runs"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SelfReviewFindings
    trigger: always
    reads: ["artifact under review", "gate-specific checklist", "upstream artifacts for selected gate"]
    writes: ["review findings output"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-SelfJudgment
    trigger: always
    reads: ["review findings output"]
    writes: ["review findings output"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-CrossReviewConvergence
    trigger: always
    reads: ["artifact under review", "accepted findings", "gate-specific checklist"]
    writes: ["review findings output"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-GateDecisionBacklog
    trigger: always
    reads: ["consolidated findings", "artifact under review"]
    writes: ["gate decision", "docs/specs/work-items/WI-*.md when medium/low backlog findings remain"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["gate decision", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "(artifact under review)", artifact: review-target }
  optional: []
outputs:
  produces:
    - { path: "(gate decision)", artifact: gate-decision }
chain:
  lanes:
    greenfield: { position: 22, prev: execute-changeset, next: audit-implementation }
    brownfield-feature: { position: 17, prev: execute-changeset, next: audit-implementation }
    bugfix: { position: 4, prev: execute-changeset, next: audit-implementation }
    refactor: { position: 4, prev: execute-changeset, next: audit-implementation }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Task graph contract:** Any task whose purpose is to run a review gate MUST declare `metadata.skill: "review-gate"`. Tasks with `metadata.skill == null` are exempt from AP-27 ghost-skill detection, which means a review task without this binding can be silently completed without the review protocol ever loading. This is a framework contract violation, not a style choice.

> **Cognitive routing:** 🛡️ [REVIEW-SONNET] + Codex cross-model when available — verification against an Opus blueprint only needs Sonnet 4.6; Opus for review wastes context budget. Codex as adversarial second opinion for high-stakes gates. See `references/model-routing.md`.
>
> **G3 adversarial UI verification (External Canvas Handoff mode):** when the artifact under review was produced via `design-ui` External Canvas Handoff (external tool + returned code), G3 MUST include a Gemini-subagent audit against `docs/specs/ui/constraint-matrix.md` per the contract in `skills/design-ui/SKILL.md` → Step C. A "looks good" visual check is not sufficient — the matrix is the mechanical gate.

# Review Protocol

## Overview

Every artifact state transition in the Serious Vibe Coding pipeline is gated by a review. This skill formalizes the 5-step review protocol designed around the specific failure modes of LLM agents: they miss their own errors, they agree too easily, and they rationalize incorrect output.

The protocol forces adversarial reasoning — an agent must argue with itself, then a fresh agent independently validates. No artifact advances without surviving this process.

**Announce at start:** "I'm using the review-gate skill to run gate [G1-G7] review on [artifact name]."

## Product Questions — MANDATORY format

At G1, apply the shared promotion predicate to actual AC/state evidence and consequential decision resolutions; review other gates for newly surfaced decisions. Follow `_shared/product-question-format.md` with `phase: review-gate`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work.

## Why This Protocol Exists

LLMs have three review failure modes that prompt engineering cannot eliminate:

1. **Self-blindness.** An agent that wrote an artifact cannot reliably find its own errors — the same pattern matching that produced the error considers it correct.
2. **Agreement bias.** When shown existing findings, an agent defaults to "looks good" rather than independent evaluation.
3. **Review theater.** An agent lists trivial issues to appear thorough while missing structural problems.

The protocol compensates for each: Step 2 forces self-confrontation, Step 3 introduces a fresh perspective, and severity classification with convergence criteria prevents theater from blocking progress.


## When To Use

Invoke this skill at every gate in the pipeline:

| Gate | After Skill | Artifact Under Review | State Transition |
|------|-------------|----------------------|-----------------|
| G1 | `write-spec` | Feature Spec | DRAFT quality gate → ready for UX |
| G2 | `design-ux` | UX Design | DRAFT → UX-REVIEWED |
| G3 | `design-ui` | UI Design | UX-REVIEWED → DESIGNED |
| G4 | `design-tech` | Technical Design | DESIGNED → BASELINED |
| G5 | `execute-changeset` | Executed change set on branch | BASELINED → CHANGE-SET-APPROVED |
| G6 | `land-changeset` | Promotion | CHANGE-SET-APPROVED → PROMOTED |
| G7 | `verify-promotion` | Verification | PROMOTED → VERIFIED |

## Worktree Context

Review-protocol runs where the artifact lives:

- **G1-G4** (spec/design reviews): on main — artifacts are on main before any worktree exists.
- **G5** (post-execution review): **inside the worktree** — the code is there, tests are there, review it there. The feature must be fully validated before leaving the worktree.
- **G6** (promotion review): on main — reviewing the staged squash diff after `worktree.sh promote`.

If the G5 review finds issues, fix them in the worktree and re-review. The feature does not leave the worktree until it passes.

## Prerequisites

| Input | Where | Required? | If missing |
|-------|-------|-----------|------------|
| Artifact under review | Path from producing skill | Yes | Cannot proceed — run the producing skill first |
| Gate-specific checklist | See Gate Checklists below | Yes | Use the checklist table in this skill |
| Prior review findings (if re-entering) | From previous iteration | If iteration > 1 | First iteration starts clean |
| Upstream artifacts for context | See gate table | Recommended | Cross-check may miss consistency issues |


## Concern Scan Gate (G3 mandatory step)

Before running the 5-step protocol at G3 (pre-merge code review), execute the concern scanner against the PR diff:

```bash
node <SKILLS_PATH>/scripts/scan-concerns.mjs \
  --project <repo-root> \
  --paths <files-changed-in-PR>
```

The scanner emits matched concerns at four severity tiers (CRITICAL, HIGH, MEDIUM, LOW) and exits with codes 3 (CRITICAL hits), 4 (HIGH hits, no CRITICAL), or 0 (clean / advisory only).

**G3 fail conditions added by this gate:**

1. **CRITICAL match without resolution** — exit 3 AND no `required_skill` produced an artifact for the change AND no PR body line `concern-waived: <name> — <reason>` → G3 review FAILs with finding severity HIGH (cite `concerns/REGISTRY.json#<name>` and the matching path).
2. **HIGH match without ack** — exit 4 AND no PR body line `concern-acked: <name>` → G3 review FAILs with severity MEDIUM (one finding per unack'd concern).
3. **Universal+project merge mismatch** — if a project-side concern in `<project>/.svc/concerns/` exists with the same `name` as a universal concern but the project version's severity is LOWER than the universal default, flag as MEDIUM finding ("project bypassing universal severity — verify the override is intentional").

Concern findings are CUMULATIVE with the existing 5-step protocol findings. A PR cleared by the protocol but with unresolved CRITICAL concerns still fails G3.


## The 5-Step Protocol (full templates: `references/five-step-protocol.md`)

1. **SELF-REVIEW** — Agent A reads the artifact in full + the gate checklist, emits structured findings `[GATE]-[NNN]` (severity critical|high|medium|low, evidence, suggested fix) in the exact parseable format.
2. **SELF-JUDGMENT** — A re-argues each of its OWN findings (accept/reject w/ justification) — forces self-confrontation before anyone else sees the list.
3. **CROSS-REVIEW** — a FRESH agent B independently (a) judges A's accepted findings and (b) hunts NEW findings under the no-agreement-bias rules; artifact = consolidated findings + gate checklist results.
4. **CONVERGENCE CHECK** — all remaining ≤ medium → PASS; any critical/high → FIX and re-enter Step 1 (artifact + full findings history, iteration++); iteration 3 with critical/high remaining → ESCALATE to human with full history.
5. **GATE DECISION** — `## Gate Decision: [G1-G7]` block: artifact, PASS|FAIL|ESCALATE, new state, iterations, resolved/remaining/escalated counts; FAIL ships fix tasks, ESCALATE ships the package.

## Gate Checklists

Per-gate checklists G1-G7 (spec, UX, UI, tech, executed-changeset, promotion, verification — each with its transition contract): `references/gate-checklists.md`. Findings→fix-task format, medium/low improvement-backlog tracking, token-cost guidance, process summary: `references/findings-feedback.md`.

## Routing

| Situation | Route to |
|-----------|----------|
| Gate returns PASS | Next skill in the pipeline (see Doctrine phase table) |
| Gate returns FAIL | Back to producing skill with fix tasks |
| Gate returns ESCALATE | Human review — present full findings package |
| Upstream skill returned NO-SHIP | **Pipeline exit** — do not gate a rejected feature. Log the NO-SHIP event and stop. The evidence package from validate-feature is the final artifact. |
| Artifact needs rewrite (>20 findings) | Back to producing skill with rewrite directive |
| Review finds missing dependency spec | `write-spec` to create the dependency |
| Review finds persona gap | `build-personas` then re-review |
| Review finds journey inconsistency | `write-journeys` then re-review |
| Disputed critical finding (A accepts, B rejects) | Escalate that specific finding to human |

### Auto-Invoke On-Demand Skills

After the 5-step review protocol completes, check for residual risk signals:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| HIGH/CRITICAL severity finding on new data models, external integrations, auth, or payment flows | `review-cross-model` | After review-gate if residual risk detected | Second-model adversarial review catches bias blind spots |

If `review-cross-model` is inserted, update `.svc/lane-tasks-<WI>.json` with the new task and set `blocked_by` so `land-changeset` waits for convergence. Log the insertion as a `taste` decision in `.svc/pipeline-decisions.jsonl`.

### Cross-System Proof Gate

For OAuth, hosted login, SSO, payments, webhooks, native/WebView handoffs,
deep links, push notifications, sync, streaming tool calls, provider callbacks,
or any flow crossing runtimes/origins/protocols/SDKs/storage layers, a PASS
requires:

- A System Contract Map at `docs/specs/contract-maps/<flow-name>.md` that passes
  `node scripts/validate-system-contract-map.mjs --map <path>`.
- Probe evidence that includes both `confirmation_check` and
  `falsification_check`, validated by
  `node scripts/validate-cross-system-probe-evidence.mjs --evidence <path>`.
- Old-path-fails / new-path-passes proof when the changeset migrates, swaps,
  bypasses, or routes through a different path to fix the symptom.
- Iteration-cap validation with
  `node scripts/check-cross-system-iteration-cap.mjs --lane-tasks .svc/lane-tasks-<WI>.json`
  when this is a repeated diagnosis WI.

Fail the gate when evidence only proves the new code exists, only confirms the
happy path, or cannot show that the old path and new path behave differently on
the same failing input.


## Specialized mandatory gates

- **External-State Lifecycle Cross-Check (G6/G7, WI-121):** G6 verifies every manifest External-State row's coupling enforcement exists in the diff; G7 re-verifies post-merge live state (installs/symlinks/settings actually changed together). Procedures: `references/specialized-gates.md`.
- **Feature Validation Closeout:** gates that close a validate-feature-born WI verify the Ship Brief promises landed. Same reference.
- **Provider Fidelity Gate:** provider-specified work requires `PROVIDER_FIDELITY_EVIDENCE.md` validated by `scripts/validate-provider-fidelity-evidence.mjs`. Same reference.
- **Security Rule Probe Gate:** RLS/security-rule changes require pre+post probe evidence via `scripts/validate-security-rule-probe-evidence.mjs`. Same reference.

## Anti-Patterns

Review theater (trivia lists masking structural misses), agreement bias ("looks good" on existing findings), self-blindness (author-judged-own-output without Step 2/3), box-checking speed-runs on large changesets (Self-Verify #5 fails them).

## Pipeline Continuation

### Phase Receipt Contract

Record each phase before completing the task — canonical form:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-GateContextChecklistConcernScan --evidence command_output:.svc/review-gate-context.log
```

All six commands (P1-GateContextChecklistConcernScan … P6-SelfVerifyContinuation): `references/five-step-protocol.md` §Phase receipt commands. WI-363 autoemit records observable phases; manual commands stay valid/idempotent.

### Task-graph mode

source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Claude mirrors TaskList; Kimi observes /task; for Codex coordination, mirror only the active step in `update_plan` (never the full graph). `Invoke:`/`metadata.skill` are routing instructions; parent-session-only host mirroring (no `SVC_SUBAGENT=1`); subagents never TaskUpdate; mark completed before leaving; evaluate next (runnable → in_progress + load skill; skippable → completed + reason).

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Gate decision rendered | Output contains PASS, FAIL, or ESCALATE decision | |
| 2 | Findings list produced | Structured findings list exists in review output | |
| 3 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |
| 4 | Visual evidence gate (browser-visible) | IF the feature touches browser-visible surfaces: `track-visuals` diff exists OR an explicit "no browser-visible surface" justification is logged. A review-gate PASS without visual evidence for a UI feature is a contract violation — FAIL the gate instead. | |
| 5 | Review depth check | For changesets >5 files or >200 lines: review MUST produce ≥3 distinct findings OR an explicit "clean, no issues found" justification with evidence of thorough inspection. A 26-second review-gate on a large changeset is procedural box-checking — FAIL. | |
| 6 | Cross-system proof checked | If the change crosses runtimes/origins/protocols/SDKs/storage layers, the System Contract Map and probe evidence validators passed; migration/path-swap fixes include old-path-fails / new-path-passes proof. | |
| 7 | Existing-component mock parity proven | For MODIFY work on an existing component/screen/route, the UI artifact includes a Production-Derived Mock Parity Ledger — missing ledger → G3 FAIL. | |
| 8 | Existing UI mock parity carried through execution | For browser-visible MODIFY work, the executed diff + screenshot evidence cover the ledger-listed paths and intended final state — missing ledger or final-only screenshot evidence → G5 FAIL. | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

`--progressive` + self-verify passed → greenfield: `audit-implementation --progressive`; brownfield-feature/bugfix/refactor: `land-changeset --progressive --lane <lane>` (honor `--skip`). Otherwise report and suggest `land-changeset`.

## Post-Compaction Recovery

Lane-tasks file is the sole source of truth: first `in_progress`/unblocked `pending`, `task-graph.mjs load-skill`, re-read this SKILL.md, resume; never ghost-complete (verify `skill_receipt`); checkpoint disagreement → trust lane-tasks + re-run `task-graph.mjs checkpoint`.

## Skill Outcome Contract

On new delivery-graph signals, emit `skill_outcome` per `references/skill-outcome-contract.md` before completing the task.
