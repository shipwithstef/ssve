# Advisory hooks and PR resolution

WI: WI-FW-ADVISORY-PR-01
Date: 2026-09-26
Status: Implemented and locally validated; final-head hosted checks and promotion evidence pending
Branch: feature-advisory-pr-resolution
Base: repaired #114, e599faa (initial review base was eb2b973cb19abec0f143406aaad11f34e8197ff1)

## Product decision

The owner reports unstable, blocking hooks and requests advisory defaults, useful PR resolution, updated project documentation, and GPT-6 Sol high implementation. Hooks should explain problems while allowing the operator to proceed. Enforcement is an explicit preference. Standalone validators, CI results, native host permissions, and GitHub review policy remain authoritative for their respective operations.

Recover the old OpenCode sweep as historical context only. Its item ledger retracts fabricated completion claims; no old receipt establishes completion here. Preserve its dirty worktree. Current GitHub source, exact revisions, and executed tests establish new evidence.

## Acceptance criteria

1. With no policy configured, every installed SVC hook boundary is advisory: denied decisions, nonzero exits, crashes, and bounded timeouts become visible warnings without blocking the host action.
2. Explicit enforce mode retains the original hook's decision and exit behavior. Document configuration precedence and persistent configuration. Malformed configuration produces a visible diagnostic and uses the default.
3. Preserve useful informational output and context. Remove SVC permission decisions and executable input rewrites from advisory results; warn about proposed command substitutions without applying them. Never manufacture a native permission grant. This was clarified by independent review of the Codex/Cursor skill-loader rewrite paths.
4. Existing installed SVC hooks migrate idempotently on setup; foreign/user hooks retain their original commands and decisions. Git slot dispatch distinguishes SVC slots from foreign slots. OpenCode/MiMo plugins cover thrown errors; Antigravity's lack of a hook runtime is explicit.
5. Bound child execution/output and terminate timed-out descendants. Host hook timeouts exceed the inner deadline. Advisory mode must not merely hide a still-blocking outer timeout. Defer the known multi-minute SessionStart repair, Stop quality, all-host Git refresh, and full pre-push suite with concrete manual commands; retain automatic bounded execution in enforce mode.
6. Tests exercise defaults without enforcement environment inheritance, opt-in strict behavior, malformed policy, host protocols, migration, third-party preservation, and timeouts. Existing strict fixtures explicitly select enforce mode.
7. Project docs explain the default, opt-in enforcement, migration, actual support, and limits. Full free checks, independent review, and install drift evidence remain visible, including failures.
8. Every open PR receives a product disposition, dependency order, exact reviewed revision, and honest release status. Verification aggregates are not release shortcuts.

## Plan and ownership

| Task | Owner | Scope | Proof |
|---|---|---|---|
| Recover and review PR sweep | Orchestrator + read-only Sol reviewer | Current PR inventory, source diffs, historical handoff | Per-PR disposition and current check identities |
| Review hook plan | Orchestrator + independent read-only reviewer | Protocol boundaries, configuration, lifecycle | Recorded findings and resolutions before implementation |
| Implement hook mode | GPT-6 Sol high | Hook runtime, wirers, plugin boundaries, Git dispatcher, regression tests | Focused executable fixtures |
| Update product docs | Orchestrator | README, AGENTS, doctrine/state and dedicated hook-mode guide | Documentation lint, accurate inventory |
| Review and verify | Independent reviewer + orchestrator | Frozen diff and real free-check entrypoint | Exact commands, results, residual limitations |
| Publish | Orchestrator | Branch/PR and existing PR disposition | Normal review requirements; no fabricated approval |

## External State

| State | Treatment | Coupling / verification |
|---|---|---|
| Nine provisioned host installations | Refresh only after source review and focused validation | setup --all-hosts; check-install-drift.sh --all-hosts |
| Owner hook policy | Optional persisted operator preference | Shared resolver and malformed/missing policy tests |
| GitHub PRs and main | Read inventory now; publish candidate and resolve reviewed PRs through normal policy | gh PR/check responses, exact head SHAs, post-merge checks if merged |
| Existing OpenCode worktree | Preserve all tracked/untracked work | git status; no writes in that worktree |
| Native permissions, credentials, repository settings | Unchanged | No policy/ruleset edits; scoped existing owner credential for authorized GitHub actions |

## Verification and rollback

Run focused wrapper/wirer tests, manifest lint, full EVALS=0 free checks, independent code review, and installation drift checks. Existing hosted results are historical once the candidate changes. A non-green result remains non-green; do not bypass it by changing its label or synthesizing receipts. Preserve strict behavior tests while adding meaningful default behavior coverage.

Rollback is the prior source revision plus setup refresh; operators can choose enforce mode without a code rollback. Keep PR #114 separate from the hook behavior change. The new branch includes #114 as its dependency and must present the hook-only diff against that baseline until #114 lands.

## Execution Command Sequence

1. Implement the reviewed source changes in the delegated isolated worktree.
2. Run focused hook behavior and wiring fixtures in default and explicit enforce modes.
3. Recompute and inspect the child diff before applying it to the controller worktree.
4. Run `node scripts/lint-skills-manifest.mjs` and `EVALS=0 bash scripts/ci/run-free-checks.sh`.
5. Review the candidate, publish through the existing PR process, and refresh host installations only from verified source.

```bash
node scripts/lint-skills-manifest.mjs
EVALS=0 bash scripts/ci/run-free-checks.sh
git diff --check
```

## Prerequisite Alignment Matrix

| Prerequisite | Observed state | Required action |
|---|---|---|
| Shared baseline #114 | Exact historical hosted 373/373 pass; independent review found timeout parsing defect | Fix invalid/zero timeout handling with regression tests |
| Child execution isolation | Separate worktree and persisted task delegation; Landlock probe passes | Keep runtime and documentation ownership disjoint |
| Independent plan review | Sol high read-only review delivered; external adapter currently reports two independent stations | Resolve configured station explicitly; do not invent review receipts |
| GitHub publication | Existing owner credential has write permission; branch review remains required | Use normal PR checks/review; do not bypass |
