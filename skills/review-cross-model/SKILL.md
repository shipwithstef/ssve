---
name: review-cross-model
version: "1.0"
handles_concerns:
  - data-model-mutation
  - database-migration
  - auth-surface
  - security-cross-family-review
description: >
  Adversarial code review using the canonical deterministic external-review launcher.
  Sends diff + goals + spec to the second model, gets findings back, then
  Claude evaluates each finding: accept with justification or reject with
  justification. Back and forth until all remaining findings are medium
  severity max. Use when "cross-model review", "second opinion", "codex
  review", "adversarial review", or when `review-gate` leaves residual risk
  on changes involving new data models or integrations.
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

Gather context for the second model:

```markdown
## Review Package

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

Keep it under 50K tokens. If the diff is larger, split by subsystem and
run multiple review rounds.

### Step 2: Send to the Canonical Launcher

```bash
mkdir -p .svc/external-review-artifacts/cross-model
SUMMARY=.svc/external-review-artifacts/cross-model/summary.json
node scripts/run-external-review.mjs \
  --orchestrator "${SVC_HOST:-claude}" \
  --review-kind exec \
  --artifacts-dir .svc/external-review-artifacts/cross-model \
  < .svc/review-cross-model-package.md > "$SUMMARY"
node - "$SUMMARY" <<'NODE'
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!summary.ok || !summary.findings || !summary.receipt) process.exit(1);
fs.copyFileSync(summary.findings, '.svc/review-cross-model-findings.json');
fs.copyFileSync(summary.receipt, '.svc/review-cross-model-receipt.json');
NODE
```

The launcher is the sole paid invocation path. It pins the requested model and
effort, takes the exact package on stdin, constrains findings to the shared
schema, writes an invocation receipt, and hard-fails on unavailable capability.
Do not construct provider commands in this skill.

The prompt to the second model:

```
You are reviewing a code change. Here is the context:

<review package>

Review this diff for:
1. Bugs — logic errors, off-by-one, null handling, race conditions
2. AC violations — does the code actually satisfy each acceptance criterion?
3. Security — injection, auth bypass, data leaks, insecure defaults
4. Design — does the implementation match the stated decisions?
5. Missing — what should be here but isn't?

For each finding, provide:
- Severity: Critical / High / Medium / Low
- Location: file:line
- Finding: what's wrong
- Evidence: why you believe this
- Proposal: how to fix it

Be specific. "Error handling could be better" is not a finding.
"api/users.ts:42 — no try/catch around the database call, a connection
timeout will crash the process" is a finding.
```

The resolved primary invocation is also the availability probe. There is no
paid smoke call and no generic tri-model fallback. For the Fable profile only,
a classified model-unavailable, entitlement, or provider-overload failure may
start a separate Opus xhigh invocation. A provider-managed same-process
Fable-to-Opus safeguard route is not that fallback and never starts another
Opus process. Authentication, shared quota, network, timeout, capability,
schema, turn-budget, profile-state, provider-safety, and unknown failures halt
the gate. Scheduled Opus/high is itself the primary and has no fallback.

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
3. After fixes, re-send the updated diff to the second model
4. Evaluate new findings
5. Repeat, subject to the HARD 3-round cap below.

### HARD 3-round cap and bounded exit (WI-491)

**Never run more than 3 adversarial rounds.** An adversarial reviewer prompted to
find flaws does not run dry on a genuinely complex change — it keeps producing
new High-severity concerns every round. "Loop until zero High" is therefore an
**unreachable** stopping condition and MUST NOT be used. Convergence is defined by
**disposition**, not by the reviewer running out of findings:

The loop is CONVERGED (terminates, change proceeds) as soon as **both** hold:
- **No unresolved Critical** findings, AND
- **Every** remaining High/Medium/Low finding carries a documented disposition —
  `accept-with-justification` (recorded as an execution-time risk to verify) or
  `reject-with-justification`.

Hard cap by round:
- **Rounds 1–3:** fix or disposition findings each round; re-review.
- **After round 3** (do NOT start a round 4):
  - **Unresolved Critical remain →** ESCALATE to the user/owner. Criticals always block; never auto-accept a Critical.
  - **Only High/Medium/Low remain →** the loop TERMINATES. Each remaining High MUST be dispositioned NOW (accept-with-justification as a logged execution-time risk, or reject-with-justification) and the change PROCEEDS. Do not run another round.

A rubric_score that does not improve across rounds is a signal the reviewer has
reached diminishing returns, not a signal to keep looping — apply the cap.

**Mechanical enforcement (wire it into the loop).** Record `rounds_run` and, when
you terminate, a `bounded_exit` (or escalation) block in the review-log. BEFORE
starting any new round, if you have already completed round 3, STOP — do not
dispatch a 4th round; disposition instead. The loop is guarded by
`node scripts/check-review-round-cap.mjs --log <review-log>`, which FAILS a run
with `rounds_run > 3`, an unresolved Critical without escalation, or any remaining
High lacking a documented disposition. A convergence/exec review is not complete
until this check passes.

> Anti-pattern (WI-491 origin): running 9 review rounds because 6 High findings
> persisted with 0 Critical. That is the exact unbounded-loop bug this cap fixes.
> High-only persistence AT round 3 is a DISPOSITION event, not a re-review event —
> you never reach round 4.

## Single-Vendor Windows (§4g)

When only one vendor family is reachable (quota, outage, cost), the reviewer
available for this loop is same-family with the executor and shares its
priors — repeating same-family passes approaches a floor set by those shared
priors and buys almost nothing past the first.

**The compensation is mechanism, not more passes.** In a single-vendor window,
every claim that would otherwise go to cross-family review must instead
acquire one of: a mechanical/grep-derived check, a contract claim
(`audit-*-contract.mjs`-style re-derivation from source on every run), a
negative test (deliberately break the check and require it to fail), or be
recorded as **UNVERIFIED** with the reason. It is never silently downgraded to
a same-family pass and marked reviewed.

**Self-terminating.** Record `review_family: cross | same` per round in
the review doc (Step 5 Summary block). When a second, opposite-family vendor becomes
available again, the accumulated `review_family: "same"` receipts ARE the
drain queue for what deserves a real cross-family look — no separate ledger
to maintain. The window ends when that queue is drained, not when the quota
resets. This is the standing justification for same-family (e.g. Opus-only)
review windows.

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
- rounds_run: <count> (HARD cap 3)
- review_family: cross | same (§4g — per round; drives the drain queue when a single-vendor window ends)

## Round 1
### Accepted
<finding + justification + fix>

### Rejected
<finding + rejection justification + evidence>

## Round 2 (if needed)
...

## Verdict
<PROMOTED (rounds_run<=3, 0 unresolved Critical, every remaining High dispositioned) / ESCALATED_TO_USER (unresolved Critical — blocks)>
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
- Sending the entire codebase instead of just the diff + context

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
| 4 | Round record + cap gate ran | `rounds_run<=3` recorded; `node scripts/check-review-round-cap.mjs --log <review-log>` exits 0 (or 3 = escalated Critical, which blocks) — capture its output before the verdict | |
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
