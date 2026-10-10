---
name: review-cross-model
version: "1.0"
handles_concerns:
  - data-model-mutation
  - database-migration
  - auth-surface
  - security-cross-family-review
description: >
  Adversarial review by a second model through the canonical external-review launcher:
  task card, decided solution, acceptance results and diff in, proof-bearing findings out,
  at most two rounds per feature. Use when: cross-model review, second opinion, codex
  review, adversarial review.
phases:
  - id: P1-ReviewPackagePreparation
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/plans/<date>-<name>/manifest.md", "git diff main..HEAD", "docs/specs/decisions/"]
    writes: [".svc/review-cross-model-package.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P2-SecondModelDispatch
    trigger: always
    reads: [".svc/review-cross-model-package.md", "scripts/run-external-review.mjs"]
    writes: [".svc/review-cross-model-findings.json", ".svc/review-cross-model-receipt.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-FindingEvaluation
    trigger: always
    reads: [".svc/review-cross-model-findings.json", ".svc/review-cross-model-receipt.json", "changed code", "feature spec"]
    writes: ["docs/specs/reviews/<name>-cross-model.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ConvergenceLoop
    trigger: always
    reads: ["accepted findings", "git diff main..HEAD", "updated second-model review output"]
    writes: ["docs/specs/reviews/<name>-cross-model.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ReviewDocumentation
    trigger: always
    reads: ["finding evaluations", "fix evidence", "remaining severity counts"]
    writes: ["docs/specs/reviews/<name>-cross-model.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/reviews/<name>-cross-model.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
  optional:
    - { path: "docs/specs/explorations/<name>/DECISION.md", artifact: solution-decision }
outputs:
  produces:
    - { path: "docs/specs/reviews/<name>-cross-model.md", artifact: review-cross-model }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Cross-Model Review

Independent code review from a second model. Two models disagree on code quality
more often than you'd expect — those disagreements are where the real bugs hide.

**Announce at start:** "I'm using review-cross-model for an independent second-model review."

## Why Two Models

Same-model review has a blind spot: the model that wrote the code shares the
same training biases as the model reviewing it. A second model (Codex, Gemini,
or any model accessible via CLI) brings genuinely different pattern recognition.

When both models agree something is fine → high confidence.
When they disagree → that's the signal worth investigating.

## Prerequisites

- The policy-selected Codex or Claude CLI is installed and authenticated
- Feature branch with committed code in the worktree
- Feature spec with ACs

## Process

This skill runs **inside the worktree** where the code lives.

### Step 1: Prepare the Review Package

Choose the reviewer by the actual code author, never the orchestrator host:

| Author / responsibility | Reviewer | Host / effort |
|---|---|---|
| Grok-authored | Sol 6.1 | Codex / high |
| Sol-authored | Grok 4.7 | Cursor / high |
| Claude-authored | Sol 6.1 | Codex / high |
| Milestone holistic | Claude Opus 5.5 (`claude-opus-5-5-high`) | agy / high; never Claude Pro |

Never assign Astra or max effort. Resolve the exact tuple through owner policy;
refuse a mismatched tuple rather than silently substituting. Milestone holistic
review is once per milestone and distinct from feature correction rounds.

Gather an ENTRY POINT for the second model, with read-only repository access:

```markdown
## Review Package

### Task Card and Decided Solution
<accepted task card, feature/WI identity, plan revision and decided solution>

### Acceptance Commands and Results
<exact commands, observed results and candidate digest>

### Goal
<one paragraph from the feature spec: what this feature does and for whom>

### Acceptance Criteria
<AC table from the spec>

### Key Decisions
<from docs/specs/decisions/ if exists — what was chosen and why>

### Diff
<git diff main..HEAD — the actual changes to review>

### Files Changed
<list with brief purpose of each>
```

Keep it under 50K tokens per package. If larger, prepare subsystem packets for
the same initial review batch; do not turn packet boundaries into sequential
rediscovery rounds.

### Step 2: Send to the Canonical Launcher

**Step 2: Send to the Canonical Launcher** — `node scripts/run-external-review.mjs --orchestrator "${SVC_HOST:-claude}" --review-kind exec --input-file .svc/review-cross-model-package.md --artifacts-dir .svc/external-review-artifacts/cross-model > <summary.json>`, then require `ok`, `findings` and `receipt` in the summary and copy them to `.svc/review-cross-model-findings.json` and `.svc/review-cross-model-receipt.json`. The launcher is the sole paid invocation path: NEVER construct provider commands in this skill. Its prompt tells the second model the package is an entry point (open whole touched files, unchanged callers, config, tests and cost path; read-only; missing access is INCOMPLETE), to return ALL findings in one pass (bugs, AC violations, security, design, missing) with severity, confidence, `file:line`, proof for blockers (otherwise downgrade to advisory), and a proposal. The resolved primary invocation is the availability probe, with no paid smoke call and no generic tri-model fallback; only for the Fable profile may a classified model-unavailable, entitlement or provider-overload failure start a separate Opus xhigh run, and auth, quota, network, timeout, schema, safety and unknown failures halt the gate. Details: `references/process-detail.md`.

### Step 3: Evaluate Each Finding and Its Receipt

For each finding the second model returns, Claude evaluates independently:

```markdown
### Finding: <title from second model>
**Second model says:** <severity> — <finding summary>
**Location:** <file:line>

**Claude's evaluation:**
- [ ] **ACCEPT** — <justification: why this is a real issue>
  - Priority: <keep severity or adjust>
  - Action: <what to fix>
- [ ] **REJECT** — <justification: why this is not an issue>
  - Reason: <false positive / already handled / out of scope / misunderstood context>
  - Evidence: <code citation proving it's handled>
```

Rules:
- Never reject without citing code that proves it's handled
- Never accept without verifying the finding is real (read the code)
- If uncertain → accept and mark for investigation
- Rejections must be more specific than acceptances (higher bar to dismiss)
- Retain both the schema-valid findings path and launcher receipt path in the
  review document; never infer the effective tuple from prose.

### Step 4: Convergence Loop

After first evaluation pass:

1. Count remaining accepted findings by severity
2. If any **Critical** or **High** → fix them in the worktree (or, for a High, disposition it — see the cap below)
3. Verify accepted fixes with focused checks and the original finding IDs.
4. If judgment remains unresolved, recheck only that finding and patch-caused regressions.
5. Park unrelated discoveries for post-delivery refinement; do not restart full review.

### One discovery batch; corrections stay on the finding branch

Run one full cross-family review of the frozen feature branch using the author
routing table. Collect its complete findings before changing code. A second paid
invocation is reserved for fix verification, not another discovery reviewer.
Do not run a second full discovery pass after seeing the first reviewer output.
Deduplicate findings into one numbered list, verify factual claims against source
and tests, then implement the accepted fixes in one batch.

Follow-ups may inspect only an original finding, its actual patch, and regressions
caused by that patch. Every follow-up request names the parent finding IDs and the
patch delta. Use focused deterministic checks first; a model recheck is conditional
on unresolved judgment, not a mandatory extra round. Include sufficient dependency
context to judge the patch, but explicitly prohibit rediscovery over unchanged code.
An unrelated new idea goes to a separate post-delivery refinement list; it does not
restart this gate. A newly proven imminent security/data-loss defect is escalated
with concrete evidence, not used to authorize another broad review loop.

The two-round feature-wide limit is a ceiling on necessary corrective exchanges, never a target
and never permission for two full reviews. Preserve the original finding census,
reviewer receipts, dispositions and patch/test evidence. Before another dispatch,
record `discovery_batches: 1` and `unlinked_followup_findings: 0` in the review log
and run the round-cap guard with `--branch-once`. Each external dispatch consumes a feature round; batch the feature into one
required cross-family review. Record calls and cost separately. A declined or unnecessary
recheck spends zero additional model calls. Owner spending limits take precedence.



### HARD 2-round cap per feature and bounded exit (RV1)

**HARD 2-round cap per feature and bounded exit (RV1)** — NEVER run more than 2 adversarial rounds per feature; "loop until zero High" is unreachable and MUST NOT be used. Keep one stable feature ID (`--feature-id`) across aliases, sessions and reviewers; the launcher reserves each round and incomplete attempts count. Round 1 is a full discovery batch; round 2 only verifies fixes against the original finding IDs, with no new discovery. Converged means no unresolved Critical and every remaining High/Medium/Low has an `accept-with-justification` or `reject-with-justification` disposition. After round 2 never start a round 3: unresolved Critical escalates to the owner (never auto-accept), otherwise disposition every High now and proceed. Record `rounds_run` and a `bounded_exit` or escalation block in the review log, and the review is not complete until `node scripts/check-review-round-cap.mjs --branch-once --log <review-log>` passes. When the final reviewer object stays raw `fail` after a compliant bounded exit, hand every launcher receipt/findings digest and the finding census back to the calling skill, which emits `pass-with-acks` with `reviewer_evidence.bounded_exit` (zero Critical, at most two rounds, unchanged candidate); never normalize the raw verdict. Details: `references/process-detail.md`.

## Single-Vendor Windows (§4g)

**Single-Vendor Windows (§4g)** — When only one vendor family is reachable, repeating same-family review passes buys almost nothing, so compensate with mechanism instead: every claim that would go to cross-family review must get a mechanical or grep-derived check, a contract re-derivation from source, a negative test, or be recorded as UNVERIFIED with the reason; never silently downgrade it to a same-family pass marked reviewed. Record `review_family: cross | same` per round in the Step 5 Summary block; the accumulated `same` receipts are the queue to drain when an opposite-family vendor returns, and the window ends when that queue is drained. Details: `references/single-vendor-windows.md`.

### Step 5: Document the Review

Save to `docs/specs/reviews/<feature-name>-cross-model.md`:

```markdown
# Cross-Model Review: <feature name>

**Date:** <timestamp>
**Models:** Claude (primary) + <second model name>
**Rounds:** <count>
**Branch:** <branch name>

## Summary
- Findings from second model: <count>
- Accepted: <count> (Critical: N, High: N, Medium: N, Low: N)
- Rejected: <count> (with justification for each)
- Fixed: <count>
- Remaining: <count> (each remaining High individually dispositioned — accept-with-justification as a logged risk, or reject-with-justification; unresolved Critical escalates and blocks)
- rounds_run: <count> (HARD cap 2)
- review_family: cross | same (§4g — per round; drives the drain queue when a single-vendor window ends)

## Round 1
### Accepted
<finding + justification + fix>

### Rejected
<finding + rejection justification + evidence>

## Round 2 (if needed)
...

## Verdict
<PROMOTED (rounds_run<=2, 0 unresolved Critical, every remaining High dispositioned) / ESCALATED_TO_USER (unresolved Critical — blocks)>
```

## When To Skip

- Pure documentation or config changes (no behavioral code to review)
- Changes under 20 lines (overhead not worth it)

If policy or the concern registry requires cross-model review, missing CLI
capability is an actionable hard failure, never a skip or waiver substitute.

## Anti-Patterns

- Accepting all findings without reading the code ("the other model must be right")
- Rejecting all findings without evidence ("I wrote it so it's fine")
- Stopping after round 1 with unresolved Critical findings
- Don’t paste the codebase — give read access and an entry point.

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `review-cross-model` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ReviewPackagePreparation --evidence file:.svc/review-cross-model-package.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SecondModelDispatch --evidence file:.svc/review-cross-model-receipt.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-FindingEvaluation --evidence file:docs/specs/reviews/<name>-cross-model.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ConvergenceLoop --evidence file:docs/specs/reviews/<name>-cross-model.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ReviewDocumentation --evidence file:docs/specs/reviews/<name>-cross-model.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/review-cross-model-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Review doc exists | `test -f docs/specs/reviews/<name>-cross-model.md` | |
| 2 | No unresolved Critical | grep for `Critical` in accepted + not fixed; any unresolved Critical must be `terminal_state: ESCALATED_TO_USER` (blocks, never promotes) | |
| 3 | Every remaining High dispositioned (NOT "no High remains") | each remaining High has accept-with-justification (logged risk) or reject-with-justification — Highs need not disappear | |
| 4 | Round record + cap gate ran | `rounds_run<=2` recorded; `node scripts/check-review-round-cap.mjs --branch-once --log <review-log>` exits 0 (or 3 = escalated Critical, which blocks) — capture its output before the verdict | |
| 5 | Every rejection has evidence | each REJECT has a code citation | |

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill is standalone — invoke it when you want a second opinion.
It does not auto-chain in progressive mode (optional, not mandatory).
Suggest: "Cross-model review complete. Proceed to `audit-implementation` or `land-changeset`."

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Chain Receipt Emission (Mandatory Chain)

This skill emits receipt type `review-plan|review-exec (per --mode flag)` per the contract in
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
  "wi": "$WI",
  ...{self_review, adversarial_review, verdict} — use --type review-plan when run pre-exec or --type review-exec when run post-exec
}
JSON
```

This writes to `.svc/receipts/<sha>/review-plan.json` (or staging if pre-commit)
AND attaches it to the consolidated git note on `refs/notes/svc-receipts`.

Self-verify: `node scripts/check-chain-receipts.mjs --sha HEAD` shows this
receipt type as present + schema-valid.

Reference: `references/chain-receipt-contract.md`.

## Automatic report recovery
The canonical launcher permits at most one same-model report-repair attempt inside the original timeout. Claude repair requires trustworthy observed spend and uses the remaining enforced dollar ceiling. Other transports report no enforced dollar ceiling; if an explicit dollar cap was requested, they cannot retry automatically. Without such a cap, the bound is one correction and the remaining timeout, not a claimed dollar limit. It preserves both raw attempts and signs only the final validated report. Incomplete/malformed reports require normal validation after repair; parsed negative findings, failed certifications, rubric failures or unread dependencies prevent automatic completion. Certification-scope repair may only remove unbound false entries; verdict, findings, dependencies, summary and every bound certification remain identical. An actual proven negative source observation must remain and block. Preserve raw provider output; canonical output may only record the required proof-or-advisory downgrade. Authorization, provider safety, model mismatch, missing proof and substantive defects are not recovery bypasses.
A zero-invocation verified cache replay retains its signed issuance history but consumes no new adversarial round. The two-substantive-round cap remains; historical notes and counters are not erased. Grok receives the whole prompt with --verbatim. Do not ask the owner to authorize these mechanical recoveries.

## Automatic input recovery
Persist the review request and pass `--input-file` to both preflight and review. Interactive stdin fails immediately; incomplete pipes stop after 30 seconds (configurable up to 60 seconds). On a zero-provider `input_invalid` failure, recover the exact saved request, verify the current candidate and reviewer policy still match, and retry once using the file. Preserve the failed attempt; never invent a replacement prompt or accept partial input. If an old launcher is still waiting, verify its command, worktree and zero-provider state before stopping that exact process. Keep this recovery internal and continue the existing task; ask the owner only when the request or authority cannot be recovered.
