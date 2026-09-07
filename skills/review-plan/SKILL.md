---
name: review-plan
version: "1.0"
handles_concerns:
  - data-model-mutation
  - paid-external-api
  - auth-surface
  - build-ship-alignment
description: >
  Plan-level adversarial review gate. Runs after plan-changeset produces a
  manifest + task graph and BEFORE any execute-changeset dispatch. Two gates:
  (1) compiled mechanical/coverage checks — free, in-session; (2) one holistic
  adversarial review via the canonical external-review launcher with structured
  findings and a tuple receipt. Corrections recheck only invalidated lenses;
  disputed product/security authority routes to the owner, not a second model. Iteration loop
  with justified accept/reject responses — same discipline on both sides.
  Use when: plan-changeset manifest exists and is about to be promoted.
  Blocks promotion until all findings have resolutions.
phases:
  - id: P1-MechanicalPlanValidation
    trigger: always
    reads: ["docs/plans/<date>-<name>/manifest.md", "scripts/verify-plan-mechanical.sh"]
    writes: ["/tmp/plan-tier1-exit", "/tmp/plan-tier1.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ExternalStateCouplingCheck
    trigger: always
    reads: ["docs/plans/<date>-<name>/manifest.md", "references/external-state-lifecycle-protocol.md"]
    writes: ["/tmp/plan-external-state-check.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-PrimaryAdversarialReview
    trigger: always
    reads: ["docs/plans/<date>-<name>/manifest.md", "references/plan-review-protocol.md"]
    writes: ["/tmp/review-tier2.json", "/tmp/review-tier2.err"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ResponseTier3Decision
    trigger: always
    reads: ["/tmp/review-tier2.json", "orchestrator responses", "relevant lens digests"]
    writes: ["docs/plans/<date>-<name>/review-log.yaml"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ReviewLogPersistence
    trigger: always
    reads: ["tier1 output", "holistic review output", "invalidated lens rechecks", "orchestrator responses"]
    writes: ["docs/plans/<date>-<name>/review-log.yaml"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/plans/<date>-<name>/review-log.yaml", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: plan-manifest }
  optional:
    - { path: "docs/plans/<date>-<name>/lane-tasks.json", artifact: task-graph }
    - { path: "docs/specs/features/<name>.md", artifact: originating-spec }
outputs:
  produces:
    - { path: "docs/plans/<date>-<name>/review-log.yaml", artifact: review-log }
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: revised-plan, note: "revised in place if findings ACCEPTED" }

# Compatibility note: the phase ID P4-ResponseTier3Decision is retained only as
# an N-1 task-graph/receipt alias. In v2 it records response dispositions and
# invalidated-lens decisions; it does not authorize or require a Tier 3 reviewer.

chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🛡️ `scripts/review-plan-codex.sh` automatically adopts the owner-only `~/.svc/reviewer-policy-v2.json` (or `SVC_REVIEWER_POLICY`) and invokes its configured AGY station through `scripts/run-external-review.mjs`. The legacy scheduled profile remains compatibility-only when no owner config exists. Same-family Sol review is advisory and never mislabeled as different-family authority.

# Plan Review

## Overview

This skill is the mandatory gate between `plan-changeset` and `execute-changeset`. It catches ambiguity, rename-drift, forbidden patterns, and scope creep BEFORE MiMo (or any executor) dispatches against a broken plan. A broken plan wastes an entire execute-changeset cycle — this gate costs ~$0.05 to prevent.

The protocol is enforced by the canonical `references/plan-review-protocol.md`. Read that file if you need the full finding format, accept/reject shape, or iteration rules.

**Announce at start:** "I'm using review-plan to gate the plan before MiMo execution."

## Inputs (hard-scoped)

- `plan-manifest` (required): `docs/plans/<date>-<name>/manifest.md`
- `task-graph` (optional): `.svc/lane-tasks-<WI>.json` or inline JSON in the manifest
- `originating-spec` (optional): `docs/specs/features/<name>.md`

Reviewers must NOT read files outside what the plan lists. If a review requires unlisted context, the reviewer declares it in `dependencies_needing_read` and halts — the orchestrator decides whether to re-plan with that dependency explicit.

## Process

### Step 1 — Tier 1: Mechanical (scripts only, no model)

Run the deterministic check script in the current session:

```bash
bash scripts/verify-plan-mechanical.sh docs/plans/<date>-<name>/manifest.md
```

When the plan changes money, entitlement, quota, inventory, identity, notification, parallel ownership, deletion, or completeness/absence claims, require the adjacent `plan-contract.json`. The command above validates it automatically; prose is not a substitute for its ordering, compensation, denominator, ownership, and consumer evidence.

- Exit 0 → proceed to Tier 1.5
- Exit 1 → orchestrator fixes trivially (path typos, missing npm scripts, syntax errors, forbidden patterns). Re-run Tier 1 before any model is invoked.
- Exit 2 → input error; halt and report

Tier 1 is free. Always runs first.

### Step 1.5 — External-state coupling check (mechanical, generic)

Per `references/external-state-lifecycle-protocol.md` and AP-30 in `references/anti-patterns.md`, every plan-changeset manifest must contain a populated `## External State` section. Apply the following mechanical checks:

1. **Section exists.** `grep -q '^## External State' <manifest>` — missing section is `external-state-uncoupled` HIGH severity, BLOCK.
2. **Section is populated.** Section contains either a non-empty table OR an explicit `Untouched environments (walked the taxonomy, found nothing): <list>` line covering at least the 15 taxonomy entries (or naming the ones checked). An empty section is `external-state-uncoupled` HIGH severity, BLOCK.
3. **Diff vs section consistency.** Compute the file-set the manifest will write. For every path NOT under `{repo-root, worktree-root, .svc/}` (i.e. host configs, symlink targets, package registries, schedulers, external SaaS endpoints, DB migrations, etc.) cross-reference against the section's table. Any path written but not declared in the section is `external-state-uncoupled` HIGH severity, BLOCK.
4. **Coupling wiring named.** Every `coupled` row must reference an actual file/script/check. Bare assertions like "we will be careful" do not count. A row with `coupled` and no wiring is `external-state-uncoupled` HIGH severity, BLOCK.
5. **Decoupled-justified entries.** Every `decoupled-justified` row must be followed by a paragraph explaining why decoupling is safe and naming the monitoring/recovery path that catches drift. Missing prose = HIGH severity, BLOCK.

**§3g mechanical checks (rules 1-4 — the same-day-four-defects class):**

6. **Denominator stated (§3g#1).** Locus: every row of the manifest's Simulation/Assumptions section (or equivalent "no conflicting X exists" claim there). Each such row must state its scope explicitly; a row scoped to "this worktree" or "this repo" may never ratify a claim about a namespace shared with live environments or sibling branches (e.g. a migration version, an allocation id). A Simulation/Assumptions row with no stated scope is `check-denominator-mismatch` HIGH severity, BLOCK.
7. **External-state evidence is a response, not a file (§3g#2).** "External state" means state held by an external system (staging, prod, a live DB). Its evidence is a response from that system — walking repo files never counts as external-state evidence. A claim citing repo files for an external-state row is `external-state-evidence-mismatch` HIGH severity, BLOCK.
8. **No unprobed absences (§3g#3).** Locus: any manifest or handover sentence matching `/\bno (deployment|commit|migration|PR)\b/i`. Such a sentence may not assert the absence of that action without citing the probe that checked for it (a command, a query, a diff). A matching sentence with no cited probe is `unprobed-absence-claim` HIGH severity, BLOCK.
9. **File presence is not work evidence (§3g#4).** A completion or gating claim keyed only on a tracked file's presence (rather than on commits/diffs touching the WI's scope) is `file-presence-as-evidence` HIGH severity, BLOCK.
10. **No feature task may transitively depend on a deploy (§3g#5).** Run:

    ```bash
    node scripts/check-plan-deploy-dependency.mjs --lane-tasks .svc/lane-tasks-<WI>.json
    ```

    - Exit 0 → no non-deploy task transitively depends on a deploy-class task (`{"violations":[]}`); proceed.
    - Exit 1 → `violations[]` names each offending task and its `path_to_deploy_task`; this is `deploy-class-dependency` HIGH severity, BLOCK — deploying happens after merge, deliberately, by a human, never as an executor task.
    - Exit 2 → usage/input error (missing lane-tasks file or a `tasks` field that isn't an array); halt and report, never treat as `{"violations":[]}`.

Step 1.5 is mechanical first. Only after the mechanical pass does Tier 2 (the model reviewer) inspect the section for *quality* — whether the declared coupling actually catches the failure modes the planner claims to mitigate.

If Step 1.5 fails: orchestrator fixes the section, re-runs Tier 1 + Tier 1.5 BEFORE invoking Tier 2 (saves model tokens on a plan that's not yet adversarially reviewable).

### Step 1.75 — Deterministic coverage + one gap pass (§4)

Before the external review, run the compiled coverage/contradiction checks, then
one orchestrator gap pass over only uncovered decision, authority, failure and
release lenses. Normalize finding IDs and persist the coverage/finding digest.
Do not repeat full self-review until two subjective “empty” passes. A correction
reruns this step only when its relevant lens digest changed. Record
`self_review_passes: 1` and `self_review_digest` in `review-log.yaml`.

The one gap pass never substitutes for the independent holistic plan review; it
drains cheap defects before that review without paying for repeated full rereads.

### Step 2 — Tier 2: Primary adversarial review (cross-model preferred)

Build the plan package, then invoke the sole external-review adapter. The
primary invocation doubles as the availability probe; never run a paid smoke
call or consumer-local fallback.

```bash
SVC_HOST="${SVC_HOST:-claude}" \
  bash scripts/review-plan-codex.sh docs/plans/<date>-<name>/manifest.md \
    > /tmp/review-tier2.json 2>/tmp/review-tier2.err
```

Output: the shared findings JSON. The launcher receipt path is reported on
stderr and must be copied into the durable review log.

Missing CLI controls, authentication, shared quota, timeout, network, schema,
turn-budget exhaustion, invalid profile state, provider-safety failure, and
tuple mismatch are hard failures. The launcher alone owns profile resolution,
same-process provider routing, and the separate narrowly classified
Fable-availability fallback.

### Step 3 — Parse findings and decide

Parse `/tmp/review-tier2.json`:

- `rubric_score: 10` AND `findings: []` → PROMOTE the plan. Copy review to `docs/plans/<date>-<name>/review-log.yaml`. Skill completes.
- Else → orchestrator (Opus) writes responses for each finding per the accept/reject format in `references/plan-review-protocol.md`. NO bare ACCEPT or REJECT — every decision must carry `justification` and (for REJECTs) `counter_evidence`.

### Step 4 — Apply responses and invalidate exact lenses

- `ACCEPT` → apply the action, rerun Tier 1 and only the deterministic/lens checks
  whose relevant digest changed.
- `REJECT` → record justification and counter-evidence. A disputed Critical/High
  product or security-authority decision routes to founder/strategic authority;
  it does not automatically buy a second full-plan reviewer.
- Remaining High/Medium/Low findings receive explicit dispositions. Unresolved
  Critical findings block promotion.

There is no standalone Tier 3 reviewer in v2 and no broad “infra path means a
second complete review” rule. High-risk infra stays protected by compiled
authority/effect proof, the one holistic plan reviewer and final execution review.

### Step 5 — Bounded lens convergence inside the one review stage

If accepted fixes change a reviewed semantic lens, send only that invalidated
lens, prior finding and correction evidence back through the same review stage.
At most three adversarial lens rounds may occur; this is remediation inside the
single holistic review, not a new standalone review or a full package restart.
Content-addressed evidence reuses every unchanged lens. A disputed product or
security choice escalates to the owner rather than switching models or raising
effort until somebody agrees.

### Step 6 — Persist review log and close

Write full review log to `docs/plans/<date>-<name>/review-log.yaml`:

```yaml
review_log:
  plan: docs/plans/<date>-<name>/manifest.md
  tier1:
    script: scripts/verify-plan-mechanical.sh
    exit_code: 0
    issues: 0
  tier2:
    reviewer: codex | sonnet | kimi
    reviewer_family: openai | anthropic | moonshot
    rubric_score: 10
    findings: [...]
  responses: [...]      # orchestrator's accept/reject per finding
  lens_rechecks:        # only invalidated lenses inside this review stage
    - lens: <authority | product | failure | release | ...>
      prior_finding_id: <id>
      relevant_digest: <sha256>
      findings: [...]
  terminal_state: PROMOTED | PROMOTED_WITH_DISPUTES | REVISED_AND_REVIEWED | ESCALATED_TO_USER
  self_review_passes: 1        # one deterministic coverage + gap pass
  self_review_digest: <sha256>
  rounds_run: <int>            # adversarial rounds actually run — HARD-capped at 3
  unresolved_critical: <int>   # machine-readable; any > 0 blocks promotion
  remaining_high: <int>        # machine-readable; each must be enumerated below
  bounded_exit:                # REQUIRED when rounds_run == 3 and remaining_high > 0
    disposition: fixed | accept-with-justification | reject-with-justification
    residual_highs:            # one entry PER remaining High (count must equal remaining_high)
      - "<remaining High #1 + why accepted/rejected>"
      - "<remaining High #2 + why accepted/rejected>"
  commit_sha: <sha of plan at promotion time>
```

**HARD 3-round cap (WI-491) — mechanically enforced, fail-closed.** An
adversarial reviewer never runs out of High findings on a complex plan, so "loop
until zero High" is unreachable. Run at most **3** rounds. After round 3,
terminate by DISPOSITION: an unresolved Critical is NEVER dispositioned — it gets
an exact `terminal_state: ESCALATED_TO_USER` and BLOCKS (the plan does not
promote until the owner rules); every remaining High is enumerated in
`bounded_exit`. Before writing `terminal_state`, prove the loop stayed bounded:

```bash
node scripts/check-review-round-cap.mjs --log docs/plans/<date>-<name>/review-log.yaml
```

- **Exit 0** = bounded, 0 unresolved Critical, every remaining High enumerated +
  dispositioned → close/promote.
- **Exit 3** = an unresolved Critical is correctly escalated → terminal_state
  `ESCALATED_TO_USER`; the plan does NOT promote. Owner decides.
- **Exit 1** = a 4th round ran, an unresolved Critical lacks the exact escalation
  record, a High is undispositioned, or the round record is missing/malformed →
  fix the disposition, never start another round.

The checker fails closed: a bare `bounded_exit` mention, prose escalation, or a
`residual_highs` list shorter than `remaining_high` is a VIOLATION. This is the
same guard `review-exec` runs; it exists because the WI-486 plan looped 9 rounds
on 6 persistent High / 0 Critical.

**Receipt adjudication (WI-566).** If the terminal immutable launcher finding
still says raw `fail`, do not alter it and do not run round 4. Emit receipt
verdict `pass-with-acks` and attach `reviewer_evidence.bounded_exit` matching
`schemas/receipts/bounded-exit.schema.json`. Bind the exact ordered launcher and
findings digests, candidate SHA/tree/digest, derived cycle ID, review-log digest,
round-cap result digest, and a complete terminal findings census. Every High
needs non-empty justification plus hash-verified `.svc/` or `docs/` evidence.
Every terminal rubric failure also needs one exact census entry mapped to
dispositioned terminal finding IDs, with justification and hash-verified
repository evidence. Unread dependencies still block. At exactly round three,
failed plan certifications can close only through the optional
`certification_failure_census`: exact signed key/family/reviewed-plan digest,
non-Critical findings all dispositioned `fixed`, and hash-verified evidence
binding each certification and mapped finding to the corrected final candidate.
Unmapped, malformed, stale or unfixed certifications still block. Failed exec
certifications remain blocking. Preserve raw verdicts; emit `pass-with-acks`.
Use `build-bounded-exit-receipt.mjs` with explicit `certification_dispositions`;
never hand-edit signed reviewer output. High findings require the log's `fixed`
disposition to match every terminal High census entry.
Any Critical, stale candidate, omitted/duplicate finding or rubric failure,
wrong digest, or more
than three launcher receipts fails closed. Existing raw `pass` and
`pass-with-findings` evidence does not need this object.

Git-tracked alongside the plan manifest. Audit trail.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Tier 1 ran and exit 0 | check /tmp/plan-tier1-exit matches 0 | |
| 2 | Tier 2 produced schema-valid JSON | launcher schema validation plus JSON parse succeeds | |
| 3 | Every finding has analysis + evidence + proposed_fix | scan JSON fields | |
| 4 | Every response has justification (no bare ACCEPT/REJECT) | scan response fields | |
| 5 | No standalone Tier 3; only invalidated lens rechecks or owner escalation | review-log lens/authority check | |
| 6 | review-log.yaml written to docs/plans/<date>/ | `test -f` | |
| 7 | No model called Tier 2 before Tier 1 passed | log ordering check | |
| 8 | Scope lock honored — no reviewer read files outside plan's named inputs | grep worker log for out-of-scope reads | |

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `review-plan` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-MechanicalPlanValidation --evidence command_output:/tmp/plan-tier1.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ExternalStateCouplingCheck --evidence command_output:/tmp/plan-external-state-check.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PrimaryAdversarialReview --evidence file:/tmp/review-tier2.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ResponseTier3Decision --evidence file:docs/plans/<date>-<name>/review-log.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ReviewLogPersistence --evidence file:docs/plans/<date>-<name>/review-log.yaml
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/review-plan-self-verify.log
```

## Pipeline Continuation

Follow the canonical task-graph chaining contract: see `references/task-graph-chaining-protocol.md`.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**Default chain:** `plan-changeset` → `review-plan` → (if PASS) `execute-changeset`. review-plan is a gate, not a pipeline step — the task graph position is inside plan-changeset's self-verify, not as a separate task unless the user explicitly promotes it.

## Non-goals

- This skill does NOT rewrite the plan. It reviews. Orchestrator applies revisions.
- This skill does NOT do taste review — "is this the prettiest architecture" is out of scope.
- This skill does NOT run tests, builds, or installs. Read + analyze only.
- This skill does NOT edit files outside `docs/plans/<date>-<name>/review-log.yaml`.

## Key Principles

- **Every claim provable.** Analysis + evidence + proposed_fix for every finding.
- **Symmetric discipline.** Orchestrator responses carry the same rigor as reviewer findings.
- **Tier 1 always first.** Mechanical checks catch ~40% of issues for free. Never skip.
- **Deterministic adversary.** Use the exact launcher-owned tuple and preserve its receipt; no consumer-local model selection.
- **Infra paths escalate.** Two-reviewer consensus required for framework/infra changes.

### Self-Verify

Before declaring the review complete:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Tier 1 mechanical ran | `verify-plan-mechanical.sh` exit 0 | |
| 2 | Findings are structured | Every finding has claim + analysis + evidence + proposed_fix | |
| 3 | Review log persisted | `docs/plans/<date>-<name>/review-log.yaml` exists with terminal_state | |
| 4 | Skip justified (if skipped) | If skipped: lane-tasks skip_reason cites either (a) "trivial changeset (≤2 files, ≤50 lines)" or (b) "post-plan review exists at <path>". NEVER skip on >2 files / >50 lines without a prior review-log. | |

If any check FAILs, fix before continuing.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.

## Chain Receipt Emission (Mandatory Chain)

This skill emits receipt type `review-plan` per the contract in
`references/chain-receipt-contract.md`. The receipt is stored as a git
note on `refs/notes/svc-receipts` (authoritative) and mirrored under
`.svc/receipts/<sha>/<type>.json` (gitignored cache).

If the skill runs before a commit exists, it writes to
`.svc/receipts/staging/<tree-hash>/<type>.json` — the post-commit hook
(`hooks/git/post-commit.d/10-receipt-promote`) promotes to SHA mirror
and writes the consolidated git note.

Self-verify: receipt at `.svc/receipts/<sha>/<type>.json` exists, passes
its schema (`schemas/receipts/<type>.schema.json`), and is reflected in
the consolidated git note.


## Chain Receipt Emission (Mandatory Chain — Actionable)

After producing the canonical output, emit a SHA-keyed receipt:

```bash
BASE_SHA="$(git rev-parse HEAD)"
cat <<'JSON' | node scripts/emit-receipt.mjs --type review-plan --wi $WI --sha "$BASE_SHA"
{
  "schema_version": 3,
  "wi": "$WI",
  ...{self_review, adversarial_review, verdict},
  "reviewer_evidence": {
    "independent": true,
    "submitter_only": false,
    "commands": [{"binary":"<launcher>","argv":["<exact>"]}],
    "output_artifacts": ["<launcher receipt>","<findings output>"],
    "deletion_bearing": false,
    "parse_collect_evidence": []
  }
}
JSON
```

The emitter upgrades every newly produced review receipt to schema v3 and
derives `deletion_bearing` from the candidate diff. Missing direct reviewer
evidence fails emission; callers cannot select a legacy version to bypass it.

This writes to `.svc/receipts/<sha>/review-plan.json` (or staging if pre-commit)
AND attaches it to the consolidated git note on `refs/notes/svc-receipts`.

Self-verify: `node scripts/check-chain-receipts.mjs --sha HEAD` shows this
receipt type as present + schema-valid.

Reference: `references/chain-receipt-contract.md`.
