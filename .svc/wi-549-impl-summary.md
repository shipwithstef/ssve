# WI-549 Implementation Summary — Repository-shared chain-policy resolution

- **WI**: WI-549
- **Lane**: bugfix
- **Worktree**: `/home/dianast/app-workspaces/seriousvibecoding/.worktrees/bugfix-WI-549-shared-chain-policy`
- **Branch**: `bugfix-WI-549-shared-chain-policy`
- **Session**: `svc-impl-wi549-01a01070`
- **Commit**: `4dc7f9099c2f629349c4dc24e3ddff1b039a2e47` (landed in this worktree; not pushed)

## Goal

Every linked worktree observes the same owner-selected chain-policy mode with
provenance. A missing or unreadable policy must never silently downgrade
"refuse" to "warn" (the bug in `svc-reconcile.mjs`'s previous grep-based
`getMode()`, which defaulted to `"warn"` whenever `.svc/chain-policy.json`
was absent or unparsable in the *current* worktree).

## Acceptance Criteria

| AC | Description | Status | Evidence |
|----|---|---|---|
| AC-549-1 | Resolution order `SVC_CHAIN_POLICY` → `$(git-common-dir)/svc-chain-policy.json` → `~/.svc/chain-policy.json` → fail-closed `refuse` | DONE | `scripts/lib/chain-policy.mjs::resolveChainPolicy()`; validator cases "SVC_CHAIN_POLICY=warn overrides...", "owner-home policy used when shared file is absent", "missing local + missing shared + missing home -> fail-closed refuse" |
| AC-549-2 | Worktree without local `.svc/chain-policy.json` still observes shared `refuse` (and shared `warn`) | DONE | validator cases "worktree without local file observes shared refuse" / "... observes shared warn" |
| AC-549-3 | Worktree-local file disagreeing with shared is a conflict (fail closed), not a silent override; stderr/receipt name both paths and hashes | DONE | `resolveChainPolicy()` conflict branch; validator cases "conflicting worktree-local file fails closed", "conflict reason names both paths", "conflict reason names both hashes" |
| AC-549-4 | `svc-ensure-worktree` and `worktree.sh create` do not treat a per-worktree copy as authority | DONE | `svc-ensure-worktree.mjs::chainPolicySummary()` (adds `chain_policy` field to its JSON result); `worktree.sh::_print_chain_policy()` (prints resolved mode after create); validator cases "never references a per-worktree chain-policy.json path literal" + "surfaces resolved chain policy" (both scripts) |
| AC-549-5 | Focused tests: missing local, shared refuse, conflicting local, env override, provenance | DONE | `test-framework/evals/tier-1/validate-shared-chain-policy.sh` — 21/21 passed (structural + functional matrix, incl. migration idempotency) |
| AC-549-6 | No paid provider invoked | DONE | Pure Node.js/bash; no network calls, no LLM invocation anywhere in `chain-policy.mjs` or the touched hooks/scripts |

## Files changed

New:
- `scripts/lib/chain-policy.mjs` — single resolver (`resolveChainPolicy`, `seedSharedChainPolicy`, CLI with `--mode`/`--repo`/`migrate-seed`)
- `test-framework/evals/tier-1/validate-shared-chain-policy.sh` — new tier-1 validator (structural + functional matrix)
- `.svc/lane-tasks-WI-549.json` — task graph (task 1 `execute-changeset`, task 2 `review-exec` deferred-to-final)

Modified:
- `scripts/svc-reconcile.mjs` — `getMode()` now delegates to `resolveChainPolicy()`; removed the old `POLICY_PATH`/grep default-to-warn fallback
- `hooks/git/pre-commit.d/20-quick-fix-eligibility` — reads mode via `node scripts/lib/chain-policy.mjs --mode`
- `hooks/git/pre-push.d/10-receipts-complete` — same
- `hooks/git/pre-push.d/15-tier1-gate` — same
- `scripts/svc-ensure-worktree.mjs` — adds `chain_policy: {mode, source, conflict}` to its result JSON
- `scripts/worktree.sh` — `_print_chain_policy()` prints resolved mode after `create` (both mutating and non-mutating paths)
- `test-framework/evals/tier-1/validate-svc-reconcile-legacy-binary.sh` — test fixture now symlinks `lib/chain-policy.mjs` + `lib/review-evidence-store.mjs` into the isolated runtime dir; policy fixture uses the resolver
- `test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh` — policy fixture uses `SVC_CHAIN_POLICY`/shared-file path instead of the old local-file grep target
- `test-framework/evals/tier-1/validate-svc-reconcile-consumer-routing.sh` — same

Not touched (per instructions): `scripts/emit-receipt.mjs`, Stop adapter mode bits (WI-545), `resolve-dispatch` (WI-551), `scripts/lib/review-evidence-store.mjs` (WI-547) — only *read* via its exported `repositoryIdentity()` helper for `git-common-dir` resolution, never modified.

## Migration

`scripts/lib/chain-policy.mjs migrate-seed [--from <path>] [--force]` implements
the one-time idempotent seed of `$(git-common-dir)/svc-chain-policy.json` from
the canonical `.svc/chain-policy.json`. It is a no-op if the shared file
already exists (unless `--force`). This capability is implemented and covered
by tests (`validate-shared-chain-policy.sh`: "migration seeds the shared file
from the canonical source", "migration is idempotent", "linked worktree
observes the freshly seeded shared policy") but **was not run against the
real default checkout** (`/home/dianast/app-workspaces/seriousvibecoding`)
in this session — an attempt to run it there was blocked by the smart-mode
classifier as an uninspected script performing a shared write to `.git/`,
and the approval request was declined. **This is not a blocker for the fix
itself**: because the canonical `.svc/chain-policy.json` already has
`"mode": "refuse"`, the fail-closed default that every linked worktree now
gets in the absence of a seeded shared file is *already* the same value the
owner selected. Running the migration later is a pure availability/provenance
improvement (it changes `source` from `"fail-closed"` to `"shared"` in the
provenance report), not a behavior change. To seed it manually:

```bash
node scripts/lib/chain-policy.mjs migrate-seed --repo /home/dianast/app-workspaces/seriousvibecoding
```

## Tests run + exit codes

| Test | Exit | Result |
|---|---|---|
| `test-framework/evals/tier-1/validate-shared-chain-policy.sh` (new) | 0 | 21 passed, 0 failed |
| `test-framework/evals/tier-1/validate-svc-reconcile-legacy-binary.sh` | 0 | PASS (frozen legacy projection contract, 5 states) |
| `test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh` | 0 | PASS (mutation red, timeout+spawn-error green; git-log timeout blocks checkpoint) |
| `test-framework/evals/tier-1/validate-svc-reconcile-consumer-routing.sh` | 0 | PASS (read-only help + explicit consumer repo + central helper) |
| `test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh` | 0 | 64 passed, 0 failed (MUST), 0 warned (MAY) |
| Full tier-1 corpus (`test-framework/evals/run-all-evals.sh --tier1`) | 1 | 324 scripts run; 10 pre-existing failures, **none in files touched by this WI** (see "Full tier-1 corpus" below) |

All five focused tests were re-run **after** the commit landed (post-commit
verification per AGENTS.md §13) and are still green.

### Full tier-1 corpus — pre-existing, unrelated failures

A full `bash test-framework/evals/run-all-evals.sh --tier1` run before this
work reported 10 failures. Investigated each:

- **`validate-mobile-occlusion-gate.sh`** (8 of the 10 sub-failures) — fails
  with `check.pass=undefined` for every HTML fixture (both "should PASS" and
  "should FAIL" cases). Topic is mobile UI occlusion detection; the script and
  its fixtures are untouched by this change. Pre-existing baseline failure,
  unrelated to chain-policy.
- **`validate-no-svc-residue.sh`** (1 failure) — flags `.svc/lane-tasks-WI-549.json`
  as untracked-and-uncovered. This is the live task graph for *this* WI's own
  session (present in `git status` before any WI-549 edits were made — see the
  session's initial git status). It is now tracked and committed as part of
  this change (see "Files changed" above), which resolves this specific
  instance; the general residue check itself is unrelated to chain-policy and
  out of scope for WI-549.
- One additional sub-failure surfaced only in a run before the lane-tasks file
  was committed; it is the same `validate-no-svc-residue.sh` instance, not a
  distinct issue.

None of the 10 pre-existing failures are in `scripts/lib/chain-policy.mjs`,
`scripts/svc-reconcile.mjs`, the three modified hook slots, `svc-ensure-worktree.mjs`,
`worktree.sh`, or the four modified/added tier-1 validators for this WI.

## Commit

- SHA: `4dc7f9099c2f629349c4dc24e3ddff1b039a2e47`
- Author: `s7an-it <angelovsan@gmail.com>` (repo default, unchanged)
- Trailer: `Co-Authored-By: Cursor Agent (claude-sonnet-5-thinking-high) <contact-cursor@example.invalid>`
- No `--no-verify`, no `--force`, not pushed.
- Impact triad: classifier returned `tier: "high"` (`executable-or-config-path`,
  `host-hook-task-graph`, `structural-symbol-or-control-flow`) with
  `required_proof: ["different-family-independent-review", "behavioral-runtime-proof"]`.
  No different-family reviewer artifact was available in this session, so the
  receipt uses **schema_version 2, deferred-to-final** (`independent_review.status
  = "deferred-to-final"`, `executor_family = "anthropic"`, `reviewer_family = "n/a"`,
  bound to the task graph's exactly one `review-exec` task, id 2). Receipt:
  `.svc/impact-triad/WI-549/task-1.json` (gitignored, machine-local evidence).
  Behavioral runtime proof: `.svc/impact-triad/WI-549/behavioral-proof.log`
  (targeted re-run of the 5 affected validators, all passing).
- Task graph: `.svc/lane-tasks-WI-549.json` — task 1 (`execute-changeset`,
  in_progress) owns this commit's receipt; task 2 (`review-exec`, pending) is
  the single bound final-review task the deferral points at.

## Remaining blockers / follow-ups

1. **Migration not run against the real default checkout.** See "Migration"
   above — not a behavior blocker (fail-closed already equals the owner's
   `refuse` selection), but running it will improve provenance from
   `fail-closed` to `shared` across all linked worktrees. Requires an
   owner-approved run of `node scripts/lib/chain-policy.mjs migrate-seed`
   against `/home/dianast/app-workspaces/seriousvibecoding` (outside this
   worktree; this session never wrote there).
2. **`review-exec` (task 2) is still pending.** The impact-triad receipt for
   this high-risk change defers independent review to that single task per
   the schema-v2 contract; it has not been run in this session.
3. Nothing else outstanding for WI-549's stated AC-549-1..6 scope.
