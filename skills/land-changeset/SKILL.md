---
name: land-changeset
version: "1.0"
description: Use when an executed change set has been validated (tests, E2E, review all pass in the worktree) and is ready to land on main — validates manifest coverage, pushes branch, opens PR, merges via squash, cleans up worktree
phases:
  - id: P1-WorktreeManifestContext
    trigger: always
    reads: [".svc/receipts/<sha>/plan-manifest.json#ac_digests (WI-381 baton: AC nav index, read FIRST; live spec stays authoritative)", "docs/plans/<date>-<name>/manifest.md", ".worktrees/<branch-name>", "docs/specs/features/<name>.md"]
    writes: [".svc/land-changeset-context.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-DiffTaskCompletionAudit
    trigger: always
    reads: ["git diff main..HEAD", "docs/plans/<date>-<name>/manifest.md", "task checkpoints"]
    writes: [".svc/land-changeset-diff-audit.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-FinalValidationCoverageAudit
    trigger: always
    reads: ["manifest validation commands", "changed source files", "test output"]
    writes: [".svc/land-changeset-validation.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-PushPrCreation
    trigger: always
    reads: ["branch name", "manifest", "spec", "validation summary"]
    writes: ["pull request body or documented PR command"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-MergeDecisionCleanup
    trigger: always
    reads: ["PR state", "branch protection/review state", ".worktrees/<branch-name>"]
    writes: [".svc/pipeline-decisions.jsonl", "worktree cleanup output when merged"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SpecStatusSelfVerify
    trigger: always
    reads: ["docs/specs/features/<name>.md", ".svc/lane-tasks-<WI>.json", "post-merge validation output"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional: []
outputs:
  produces:
    - { path: "(PR merged to main)", artifact: landed-code, status: PROMOTED }
chain:
  lanes:
    greenfield: { position: 24, prev: audit-implementation, next: verify-promotion }
    brownfield-feature: { position: 19, prev: audit-implementation, next: verify-promotion }
    bugfix: { position: 6, prev: audit-implementation, next: verify-promotion }
    refactor: { position: 6, prev: audit-implementation, next: verify-promotion }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** ⚙️ [EXEC] — branch push, PR open, merge, cleanup are mechanical git ops; routes via `resolve-model.sh EXEC` (Sonnet 4.6 under svc-default per WI-357). See `references/model-routing.md`.

# Landing Change Set

## Runtime v2 lifecycle boundary

Bind the exact final SHA and build provenance, then execute only an authorized typed land/release
effect. Require proven rollback readiness before production release. A merge is not live proof and
does not close delivery. Follow `schemas/release-lifecycle-v2.schema.json`.

Land validated work from a feature worktree onto main via PR.

By the time this skill runs, the feature has been built, tested (unit + E2E),
and reviewed — all inside the worktree. This skill validates that the branch
matches the plan, then lands it through a proper PR flow.

**Announce at start:** "I'm using the land-changeset skill to land the validated branch onto main."

## Prerequisites

| Artifact | Where | Required? |
|----------|-------|-----------|
| Implementation manifest | `docs/plans/<date>-<name>/manifest.md` | Yes |
| Validated feature branch | `.worktrees/<branch-name>` | Yes |
| G5 approval evidence | task checkpoints + review output | Yes |
| Tests passing | all tests green in the worktree | Yes |
| Feature spec | `docs/specs/features/<name>.md` | Yes |

Do not start landing if tests are failing or G5 has not passed.

## Process

### Step 1: Validate in the worktree

Run these checks inside the worktree (where the code lives):

**1a. Read the manifest** — extract branch name, planned file set, validation commands, checkpoints.

**1b. Compare branch diff to manifest:**

```bash
git diff --name-only main..HEAD
```

Check:
- every changed file is in the manifest
- every manifest file appears in the diff
- no unexpected additions or silent omissions

**1b-ii. Task completion audit:**

For each task in the manifest:
1. Read the task's intent and AC slice
2. Check the diff for files this task should have touched
3. Verify the implementation satisfies the AC (not just file presence — check behavior)
4. Mark status:
   - **DONE** — implementation matches task intent and AC
   - **PARTIAL** — started but incomplete (e.g., happy path only, error path missing)
   - **MISSING** — no evidence of this task in the diff
   - **CHANGED** — implemented differently than planned (note what changed)

If any task is PARTIAL or MISSING: **STOP.** List what's missing. Do not
proceed to push with incomplete tasks. Either fix in the worktree or get
explicit user approval to ship without.

Source: gstack ship/SKILL.md Step 3.45 (plan completion audit), MIT, Copyright 2025 Garry Tan.

**1c. Confirm checkpoint history** — all task checkpoints exist, ordering is sensible, no unfinished tasks.

**1d. Run final validation commands** — execute the manifest's validation commands one last time. All must pass.

If any check fails, fix in the worktree before proceeding.

### Step 1e: Leftover-Disposition Closeout

Before declaring the branch ready to push or the landing complete, run `git status --short --untracked-files=all` in the relevant worktree. If any path remains, cite a ledger that follows `references/leftover-disposition.md` and run `node scripts/validate-leftover-disposition.mjs --ledger <path>`. The closeout must state whether leftovers remain and how each class was disposed.

### Step 1f: Story-Receipts and Branch-Index Land Gate (G10, WI-521 Batch C)

Two mechanical checks, run before push. Neither hard-blocks a WI that hasn't adopted the newer artifact yet (phase-in, not retroactive enforcement) — but any adopted artifact that exists must pass.

**1. Story receipts** — if this WI has a receipts file, it must be aligned. Check existence FIRST: the validator itself exits 2 (a usage-style error, "are you on the right branch/worktree?") on a missing file, which reads as a script bug, not "not adopted" — so the absent case is decided here, before invoking it, never by treating its exit 2 as the WARN.

```bash
if [ -f "docs/specs/receipts/<WI>.receipts.json" ]; then
  node scripts/audit-story-receipts.mjs docs/specs/receipts/<WI>.receipts.json
else
  echo "WARN: story receipts not adopted for this WI"
fi
```

- File exists → the validator call must exit 0 (prints `STORY ALIGNED`). A non-zero exit is a BLOCK: fix the receipts file or the underlying stage before landing.
- File absent → the WARN line prints and landing continues. Hard-blocking every pre-WI-521 WI on a file it never had would get this gate disabled within a day, not fixed — the WARN is deliberate, not a loophole.

**2. Branch index freshness** — every tracked index must still be trustworthy:

```bash
node scripts/check-branch-index.mjs --all
```

- No `docs/specs/relations/*.branches.md` tracked yet → prints its own WARN and exits 0; treat as WARN, not as a pass on indexes that don't exist.
- One or more indexes tracked → every one of them must exit fresh (script exits 0 overall only if ALL are fresh). A non-zero exit is a BLOCK: re-stamp the stale index (shape: `skills/write-spec/references/branch-index-template.md`) before landing.

### Step 2: Ship Preparation

#### Step 2-mobile: Canonical mobile release checkpoint

If `schemas/mobile-build-contract.json` is absent, record canonical mobile
release preparation as `N/A` with repository evidence and continue with the
generic ship preparation below. If it exists, validate it against
`schemas/mobile-build-contract.schema.json`, then perform this state machine
after the diff/review gates pass and before any release build:

1. Invoke the contract's floor query/inspection adapter and capture the remote
   store floor plus the durable ledger floor. The remote store is authority;
   the ledger is conservative evidence, never proof that a number is reusable.
2. Acquire the release-ledger lock and call `allocate-release` exactly once for
   this source and platform with both floors:
   `node scripts/mobile-build-identity.mjs allocate-release --contract
   schemas/mobile-build-contract.json --remote-floor <remote> --ledger-floor
   <ledger> --sha <source-sha> --platform <android-or-ios> [--now <epoch>]`.
   Allocation is idempotent for the same source SHA and platform: a resume
   returns the existing live reservation instead of appending a second row.
   The allocator must durably append the source/platform-bound `reserved` row
   before a build command runs.
3. Invoke the repository-reviewed `commands.allocate_release`,
   `commands.build_release`, and `commands.inspect_artifact` JSON argv arrays
   directly, without shell parsing, interpolation, `eval`, or an argv supplied
   by adapter output. Freshly inspect the produced artifact.
4. Require exact equality among canonical application/bundle identity,
   version/build code, version name, source SHA, inspected metadata, artifact
   filename, and release receipt. The artifact must resolve to a real regular,
   non-symlink file whose basename exactly equals the configured release
   artifact template rendered for project, code, source SHA, and platform.
   Have the engine compute SHA-256 from the artifact bytes and require that
   `artifact_sha256` to equal the receipt and fresh inspection metadata, then
   bind the digest and artifact path to the ledger row. Transition that exact
   reservation to `built`; commit the canonical version fields, ledger row,
   receipt, and artifact metadata together as the release checkpoint.
5. Transition the reservation to `committed` once when land succeeds. If
   allocation or build fails, transition the reserved row to `failed` using
   failure evidence; do not invent a placeholder artifact, metadata file, or
   digest.
   The failed reservation remains consumed.
   Only an explicit retry may re-read both floors and allocate a new higher code
   for the same source/platform; never call the build again with the old failed
   reservation.

Development allocation state and development receipts are forbidden inputs to
this state machine. Adapter-managed canonical mobile fields are also excluded
from the generic version bump below: that generic bump must not create a second
canonical allocation.

Before pushing, prepare the release. Commit order matters for bisectability:
1. Infrastructure changes (config, build, CI) first
2. Models + their tests
3. Controllers/services + their tests
4. VERSION + CHANGELOG last (single atomic commit)

The final VERSION + CHANGELOG commit should include:
```
chore: bump version and changelog (vX.Y.Z.W)

Constraint: <any active constraints from the feature>
Scope-risk: narrow
```

**2a. Version bump** — 4-digit `MAJOR.MINOR.PATCH.MICRO` format:

Read current version from `package.json`, `VERSION`, `Cargo.toml`, or equivalent.

**Idempotency check first:** compare the VERSION value on the base branch vs HEAD.
If already bumped (values differ), skip the bump entirely.

```bash
BASE_VERSION=$(git show main:VERSION 2>/dev/null || echo "0.0.0.0")
HEAD_VERSION=$(cat VERSION 2>/dev/null || echo "0.0.0.0")
if [ "$BASE_VERSION" != "$HEAD_VERSION" ]; then
  echo "VERSION already bumped ($BASE_VERSION -> $HEAD_VERSION), skipping"
fi
```

Bump level rules:
- **MICRO** (+0.0.0.1): fewer than 50 changed lines, trivial fix, no new files
- **PATCH** (+0.0.1.0): 50+ changed lines, no feature signals
- **MINOR** (+0.1.0.0): feature signals detected — ASK user before bumping
  - Feature signals: new routes, new migrations, new test files, `feat/` branch prefix
- **MAJOR** (+1.0.0.0): milestones only — ALWAYS ASK user

Bumping a digit resets all digits to its right to 0.
Example: `1.3.2.7` with PATCH bump becomes `1.3.3.0`.

**2b. CHANGELOG update**:

1. Read the existing CHANGELOG.md header to match its formatting style
2. Enumerate all commits on the branch: `git log --oneline main..HEAD`
3. Group changes by theme using conventional headings:
   - **Added** — new capabilities the user can now use
   - **Changed** — modifications to existing behavior
   - **Fixed** — bug fixes
   - **Removed** — features or code removed
4. Lead each bullet with what the user can now DO, not what the code does
   - Good: "Users can now reset passwords via email link"
   - Bad: "Added resetPassword() method to AuthService"
5. Cross-check: every commit in the log MUST map to at least one bullet.
   If a commit is missing, either add a bullet or justify the omission (e.g., pure refactor with no user-visible change).
6. Create `CHANGELOG.md` if it doesn't exist

**2c. Test audit** with coverage diagram:

Run the full test suite one final time. Report: total tests, passing, failing, new tests added.
If any tests fail: STOP — fix in worktree before proceeding.

Then produce a code path coverage diagram for every changed source file:

```
CODE PATH COVERAGE
[+] src/services/billing.ts
    ├── processPayment()
    │   ├── [★★★ TESTED] Happy path + card declined
    │   └── [GAP] Network timeout — NO TEST
    ├── refundPayment()
    │   └── [★★ TESTED] Happy path only
[+] src/controllers/checkout.ts
    ├── handleCheckout()
    │   └── [★ TESTED] Smoke test, no edge cases
```

Quality ratings:
- ★★★ — edge cases covered (happy path + error paths + boundary conditions)
- ★★ — happy path tested
- ★ — smoke test only (function called, result not deeply verified)

**Coverage gate:**
- Default minimum: 60% of changed code paths must have at least ★ coverage
- Target: 80% of changed code paths at ★★ or above
- **< 30%:** HARD STOP — do not ask, do not proceed. Route back to `write-e2e`. Untested code does not land.
- **30–59%:** WARN and ask user whether to proceed or write more tests
- **≥ 60%:** proceed (target: push toward 80% in the next iteration)

### Step 3a: Push the branch

Before any detached local commit or remote promotion, mint and consume the
single-use capability at the mutation boundary. The command after `--` is part
of the capability tuple: mint and exec MUST receive byte-identical argv. Local
land accepts only `git commit -m <message>`; remote promotion accepts only
`git push origin <exact-head-sha>:refs/heads/<exact-branch>` or `node scripts/merge-pr-with-review-receipt.mjs --pr <pr-number> --squash --delete-branch --expected-repo <owner/repo> --expected-head <branch> --expected-head-sha <sha>`. Flags that widen the staged tree, bypass hooks, rewrite
history, or change the destination are rejected before capability consumption.

```bash
COMMAND=(git commit -m "$COMMIT_MESSAGE")
MINT="$(node scripts/svc-owner-recovery.mjs promote-mint \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment local --operation local-land -- "${COMMAND[@]}")"
CAPABILITY="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.capability.capability_id)' "$MINT")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.token)' "$MINT")"
node scripts/svc-owner-recovery.mjs promote-exec \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment local --operation local-land --capability "$CAPABILITY" --token "$TOKEN" \
  -- "${COMMAND[@]}"
```

The same boundary is mandatory for the exact remote command. Do not run raw
`git push` or `gh pr merge` after a capability has been minted for another argv.

Still in the worktree, mint and consume a fresh capability for the exact push
(the local-commit capability is already consumed and cannot authorize this):

```bash
COMMAND=(git push origin "$HEAD_SHA:refs/heads/$BRANCH")
MINT="$(node scripts/svc-owner-recovery.mjs promote-mint \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment remote --operation remote-promotion -- "${COMMAND[@]}")"
CAPABILITY="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.capability.capability_id)' "$MINT")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.token)' "$MINT")"
node scripts/svc-owner-recovery.mjs promote-exec \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment remote --operation remote-promotion --capability "$CAPABILITY" --token "$TOKEN" \
  -- "${COMMAND[@]}"
```

### Step 3b: Switch to main and open PR

Exit the worktree — **PR merge must run through the review-receipt wrapper from
repo root, not from inside the worktree** (git error: "main is already used by
worktree" otherwise). Do not run raw `gh pr merge`; Codex shell/API sessions can
bypass host hooks, so the wrapper is the enforcement point.

```bash
# If the project uses gstack worktree.sh:
if [ -f scripts/worktree.sh ]; then
  scripts/worktree.sh guard --skill land-changeset --lane <lane> --branch <branch-name>
fi
# Explicit cd to repo root regardless (handles both gstack and non-gstack projects):
cd "$(git rev-parse --show-superproject-working-tree 2>/dev/null || git rev-parse --show-toplevel)"
```

Create the PR:

```bash
gh pr create \
  --title "<type>: <short description>" \
  --body "## Summary
<what this changes and why>

## Manifest
docs/plans/<date>-<name>/manifest.md

## Validation
- [ ] All task checkpoints present
- [ ] Branch diff matches manifest file set
- [ ] Tests pass (unit + E2E)
- [ ] G5 review passed
"
```

PR title convention:
- `feat: <description>` for greenfield / brownfield features
- `fix: <description>` for bugfix lane
- `refactor: <description>` for refactor lane

### Step 4: Merge or wait for approval

**Solo / auto-approve mode** (`--auto-approve` or solo contributor):

Merge immediately:

```bash
# Mint after the push so the capability binds the current exact HEAD and tree.
COMMAND=(node scripts/merge-pr-with-review-receipt.mjs --pr "$PR_NUMBER" --squash --delete-branch --expected-repo "$REMOTE_REPO" --expected-head "$BRANCH" --expected-head-sha "$HEAD_SHA")
MINT="$(node scripts/svc-owner-recovery.mjs promote-mint \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment remote --operation remote-promotion -- "${COMMAND[@]}")"
CAPABILITY="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.capability.capability_id)' "$MINT")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.token)' "$MINT")"
node scripts/svc-owner-recovery.mjs promote-exec \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment remote --operation remote-promotion --capability "$CAPABILITY" --token "$TOKEN" \
  -- "${COMMAND[@]}"
```

Then continue to Step 5.

### Promotion-memory handoff

Preserve the exact PR number, squash SHA, target branch, merge timestamp, and
review-receipt reference in the normal landing evidence. Do not write shared
promotion memory here: a merge is necessary but insufficient. `verify-promotion`
must first issue a passing G7 receipt for that exact squash SHA. This prevents
abandoned branch commits and merely merged-but-unverified changes from entering
later-session memory.

Before framework learning credit at land, run `node scripts/learning-lifecycle.mjs triage --root "$(git rev-parse --show-toplevel)" --limit 50`. Require a prior `used` event with outcome evidence plus a passing `evaluate-rule` receipt for elevation. Federated sources must be explicitly allowlisted and pass root ownership/symlink validation.

**If the merge is denied by the auto-mode classifier (`[Self-Approval]`)** — this is the
two-party-review boundary, working as designed. Follow the **blocked-on-user protocol** in
`references/merge-gate-permission.md`: record `.svc/merge-blocked-on-user.json` once,
surface the single unblock action, and **STOP retrying** (do not re-fire the merge or
tool-shop another surface — repeated attempts are flagged as bad-faith and burn budget).
The durable fix is the standing `Bash(node scripts/merge-pr-with-review-receipt.mjs:*)`
permission (that doc §1) — an **informed tradeoff**: the helper checks an *agent-authored*
review-receipt (an honesty gate backed by the cross-model review it cites, not a provenance
guarantee), so granting it removes the per-merge human prompt and is appropriate for a
solo / trusted-agent context. See the doc for the honest scope.

**Team / review-required mode** (default for external projects or when reviewers are assigned):

Stop here. The PR is open and waiting for approval.

```
Landing paused — PR #<number> open, waiting for approval.
Worktree preserved at .worktrees/<branch-name>.
Resume after merge: scripts/worktree.sh remove <branch-name>
```

The worktree stays alive so fixes can be pushed if reviewers request changes.
When the PR is approved and merged (by a teammate or CI), resume with Step 5.

**How to detect which mode:**
- If `gh pr view <number> --json reviewRequests` shows reviewers → wait
- If the repo has branch protection rules requiring approvals → wait
- If `--auto-approve` flag is set → merge immediately
- If solo contributor (no reviewers, no protection) → merge immediately

### Decision Logging

After the merge/wait decision is made, log it. The `run_id` comes from the active task graph.

```bash
# Merge strategy decision (mechanical — determined by repo configuration)
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill land-changeset \
  --phase "<task-id>" \
  --type mechanical \
  --decision "<Merged PR #N via squash|PR #N open, waiting for approval>" \
  --reasoning "<auto-approve: solo contributor, no branch protection|team mode: reviewers assigned>" \
  --decided-by P0 \
  --overrideable false
```

### Restart-Boundary Continuation (WI-552)

If the WI's plan or verify-promotion target declares `requires_fresh_session`
(the post-merge proof needs a genuinely new host session/process — e.g. a
SessionStart healthcheck), persist the hash-bound continuation baton BEFORE
merge, then stamp it with the exact merge SHA immediately after:

```bash
node scripts/resolve-continuation.mjs create \
  --wi "$WI" --host <host> --event <event-name> \
  --proof-query "<what the fresh session must prove>" \
  --session-id "$SVC_SESSION_ID"
# ...merge happens...
node scripts/resolve-continuation.mjs stamp-deploy --wi "$WI" --merge-sha "$(git rev-parse HEAD)"
```

Do not do anything else with the baton here — launch, freshness checks, and
consumption are `verify-promotion`'s job (called by `svc-auto-drive.mjs`
post-merge, or by `reconcile` on resume). This is additive: a WI with no
restart boundary never creates a baton and land-changeset's control flow is
unchanged (AC-552-8 — ordinary verification launches zero new sessions).

### Step 5: Clean up worktree (after merge)

After the PR is merged (either by you or by a reviewer):

```bash
git checkout main && git pull
scripts/worktree.sh remove <branch-name>
```

This removes `.worktrees/<branch-name>` and deletes the local branch.

### Step 6: Update spec status

Update the feature spec status to `PROMOTED`:

```
**Status:** PROMOTED
```

## Anti-Patterns

- Do not land a branch with failing tests
- Do not land without a PR (no local squash-merges)
- Do not land with missing task checkpoints
- Do not land files not in the manifest
- Do not skip the final validation run

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `land-changeset` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-WorktreeManifestContext --evidence command_output:.svc/land-changeset-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-DiffTaskCompletionAudit --evidence command_output:.svc/land-changeset-diff-audit.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-FinalValidationCoverageAudit --evidence command_output:.svc/land-changeset-validation.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-PushPrCreation --evidence command_output:.svc/land-changeset-pr.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-MergeDecisionCleanup --evidence command_output:.svc/land-changeset-merge.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SpecStatusSelfVerify --evidence command_output:.svc/land-changeset-self-verify.log
```

## Pipeline Continuation

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

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | PR was created | `gh pr view <number>` shows the PR | |
| 2 | PR was merged OR waiting for approval | `gh pr view <number> --json state` shows MERGED or OPEN | |
| 3 | If merged: worktree removed | `.worktrees/<branch>` no longer exists | |
| 4 | If merged: spec updated | spec shows `PROMOTED` status | |
| 5 | If merged: post-commit tier-1 passed | `bash test-framework/evals/run-all-evals.sh` exits 0 (or the relevant tier-1 check for the changed skills) | |
| 6 | Leftover disposition validated | `git status --short --untracked-files=all` is clean, or every remaining path is covered by a passing ledger per `references/leftover-disposition.md` | |
| 7 | Story receipts land gate ran (Step 1f, G10) | `docs/specs/receipts/<WI>.receipts.json` exists → `node scripts/audit-story-receipts.mjs` on it exits 0; absent → the WARN line printed and is cited here | |
| 8 | Branch index land gate ran (Step 1f, G10) | `node scripts/check-branch-index.mjs --all` exit code and its per-index output cited (0 fresh/no-index-WARN; non-zero is a BLOCK, not silently skipped) | |

If waiting for approval: checks 1-2 pass (PR exists and is OPEN). Checks 3-5 are
deferred until the PR is merged. Report the PR URL and stop — do not chain to
`verify-promotion` until the PR is merged.

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

**If PR was merged (auto-approve or post-approval):**
- If `--progressive`: invoke `verify-promotion --progressive --lane <lane>`
- If not progressive: suggest "Next: run `verify-promotion`"

**If PR is open and waiting for approval:**
- Stop the progressive chain. Report:
  "PR #<number> open, waiting for approval. After merge, run:
  `scripts/worktree.sh remove <branch>` then `verify-promotion`"
- The chain resumes in a future session after the PR is merged.

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

This skill emits receipt type `(consumer — verifies upstream receipts present; invokes svc-auto-drive post-merge)` per the contract in
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

**Cross-link to story receipts (WI-521 Batch C, C4 — one field, no merge of the two systems).** `land-changeset` itself emits no receipt type of its own (it is a consumer/verifier per the paragraph above) — the one land-adjacent receipt body that actually gets constructed is `verify-promotion`, built by `scripts/svc-auto-drive.mjs` when it runs post-merge (this same skill invokes it, per the paragraph above). That function's `findStoryReceiptSha256(mergeSha)` asks the merge commit itself which `docs/specs/receipts/*.receipts.json` path it touched — deterministic, not a commit-message guess — and, when exactly one such path changed, folds `story_receipt_sha256` (a sha256 of that file's content in the merge commit's tree) into the `verify-promotion` receipt before it is written to `.svc/receipts/<sha>/verify-promotion.json` and the consolidated git note. Ambiguous (0 or >1 receipts files touched) or any git failure yields no field at all — it is never invented.

This makes the per-commit chain-receipt envelope and the per-WI story-receipts file mutually detectable: forging either one alone no longer closes the WI silently — the envelope names a hash the receipts file must actually produce, and the receipts file's own stage entries carry `commit:<sha>` evidence pointing back (`references/story-receipts.md`). The two systems stay otherwise unmerged: chain receipts remain per-commit/push-gate, story receipts remain per-WI-stage.
