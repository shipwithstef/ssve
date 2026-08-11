# WI-484 Changeset: Session, worktree, and WI binding

- **Spec:** docs/specs/work-items/WI-484.md
- **Branch:** framework-WI-484-session-worktree-binding
- **Lane:** framework
- **Archetype:** architectural concurrency/state-identity change
- **Planning mode:** invariants and ownership entry points before behavior
- **Execution mode:** dispatch
- **Planning base:** 22df12efdfc4d48dacf2acea8588d585ce0094a8
- **Dependency/execution base:** WI-485 VERIFIED; create from then-current verified origin/main
- **Status:** REVIEWED_AND_FROZEN; planning only
- **Created:** 2026-07-14T10:48:02Z

## Implementation Summary

Make one versioned, worktree-local binding the authority for mutating sessions. Normalize existing claim variants, establish ownership before task status, make shared fallbacks diagnostic, and prove two sessions cannot cross WI, worktree, path, receipt, or Stop state. Read-only roles retain zero-binding operation.

## Files Planned

| File | Action | Responsibility |
|---|---|---|
| schemas/session-worktree-binding.schema.json | CREATE | strict binding and normalized claim schema |
| references/session-worktree-wi-binding.md | CREATE | lifecycle, CAS transfer, TTL, role rules |
| test-framework/evals/tier-1/validate-session-worktree-binding.sh | CREATE | two-session concurrency fixtures |
| hooks/lib/resolve-wi.mjs | MODIFY | ownership-first resolution result |
| hooks/lib/wi-claim.mjs | MODIFY | normalize owner ids and atomic claim lifecycle |
| hooks/lib/active-intent.mjs | MODIFY | latest prompt suppresses stale backlog unless exact resume |
| hooks/svc-task-completion-guard.sh | MODIFY | binding/claim before status; absolute paths; hard cap |
| scripts/worktree.sh | MODIFY | initialize/remove binding state atomically |
| test-framework/evals/tier-1/validate-active-intent-guard.sh | MODIFY | foreign Stop incident regression |

## Changeset Blueprint

### schemas/session-worktree-binding.schema.json — complete schema contract

Draft 2020-12, additionalProperties false. Required: schema_version=1, session_id, role, wi, repo_root, worktree_root, branch, claim_path, created_at, updated_at, generation. session_id must be host-session-shaped (UUID or provider thread id) and cannot be an agent/model label. role enum is mutating, reviewer, research, audit; only mutating permits non-empty wi and requires claim_path. All paths are absolute. generation is integer >=1. Optional released_at and transfer_from_generation implement lifecycle history. A read-only record, when emitted for diagnostics, must have empty wi/claim_path and cannot authorize mutation.

### references/session-worktree-wi-binding.md — complete contract

Define authority order: exact payload session + worktree-local binding; matching fresh normalized claim; WI/worktree/branch agreement; explicit current user resume. Branch inference, single active graph, last contract, and active-intent cache are diagnostic only. Define create, renew, explicit release, stale proof, compare-and-swap transfer, and cleanup. Transfer requires expected generation and either owner release or stale TTL/PID proof; plain continuation text never transfers. Bindings live in <worktree>/.svc/bindings/<session-hash>.json; claims remain <worktree>/.svc/claims/WI-N.claim.json. Readers resolve absolute paths from git common-dir/worktree metadata, never ambient PWD.

### hooks/lib/wi-claim.mjs — exact API changes

Add `normalizeClaimOwner(claim)` returning `{session_id, attributable, source}`. Accept `session_token`, `session`, `session_id`, and `claimed_by` only when the value matches UUID/provider-thread shape; reject agent names such as claude, codex, kimi and empty values. Add `readClaimAbsolute(path)`, `claimFreshness(claim,path,now)`, and `transferClaim(wi, expectedGeneration, opts)` using temp+fsync+rename and compare-and-swap. New claims include schema_version, generation, absolute repo_root/worktree_root, branch, session_id, role, started_at, renewed_at, ttl_hours. Keep legacy exports and return shapes for current callers.

### hooks/lib/resolve-wi.mjs — exact resolution change

Return `{wi, source, authority, diagnostics, binding}`. For mutating roles, first resolve session id and worktree-local binding; accept only matching fresh normalized claim and exact repo/worktree/branch. Explicit SVC_WORKER_WI and payload WI remain requests that must pass ownership, not unconditional authority. `wiFromBranch`, `wiFromSingleInProgress`, and `wiFromLastContract` populate diagnostics only. Non-execution roles return unresolved/allow unless an explicit read target is supplied. Preserve simple `{wi,source}` destructuring compatibility.

### hooks/lib/active-intent.mjs — exact behavior change

Persist the latest prompt classification with session id, turn id when present, prompt hash, referenced WI, classification, and timestamp. Any new prompt suppresses earlier `bound_to:wi-backlog` continuation pressure unless it is an exact explicit `continue WI-N` or `resume WI-N` for the same binding and current session. A scope correction or unrelated prompt always suppresses. Raw prompt storage remains existing debug behavior only where already configured; it is never ownership authority.

### hooks/svc-task-completion-guard.sh — exact control flow

Move session/binding/claim resolution before graph discovery and before actionable counts. If there is no attributable current binding, a fresh foreign claim, worktree mismatch, ambiguous diagnostics, or a non-execution role, emit advisory/allow and exit 0. Only then read the exact absolute graph from the binding. Counter path is runtime-root/repo-hash/session-hash/worktree-hash/WI; clamp SVC_COMPLETION_MAX to 1..3 and stop pressure after MAX. Remove relative `.svc/...` reads from the ownership and counter path. Pass exact graph/claim paths into Node helpers. Malformed governed binding fails open for Stop with diagnostic; it never selects another graph.

### scripts/worktree.sh — exact lifecycle changes

On create/resume, resolve real main repo and linked worktree paths, create worktree-local `.svc/bindings`, and call a Node binding writer with session, WI derived from explicit `--wi` or branch, role, claim, generation. Re-running with identical identity renews without changing generation. Conflicting live identity exits non-zero with release/transfer command. Remove first releases owned bindings and refuses when another live session owns one. Status prints WI, absolute worktree, branch, owner session, generation, and freshness. No installed skill symlink is changed.

### Tests — complete fixture matrix

The new shell test creates one bare origin, one default checkout, two linked worktrees, sessions A/B, WIs 484/999, and claim variants for every accepted/rejected owner field. It asserts: one mutation binding per session; zero for reviewer; foreign claim advisory before graph parse; branch/single-graph/last-contract cannot authorize; stale CAS succeeds once; live CAS fails; counter stops after three; corrupt foreign graph is never read; every accessed state path is absolute; simultaneous Node processes produce valid atomic JSON; no cross-worktree receipt or counter changes. Extend active-intent fixtures with the captured WI-479 prompt sequence.

## MODIFY Anchor Ledger

| File | Exact existing anchor | Disposition |
|---|---|---|
| hooks/lib/resolve-wi.mjs | comment `Resolution priority:` and exports `wiFromClaim`, `resolveWI` | REPLACE priority/resolveWI; retain diagnostic helpers |
| hooks/lib/wi-claim.mjs | exports `isClaimStale`, `claimWI`, `releaseClaim`, `cleanStaleClaims` | INSERT normalization/atomic APIs; REPLACE claim write; preserve exports |
| hooks/lib/active-intent.mjs | exports `classifyActiveIntent`, `writeActiveIntentState`, `evaluateSuppression` | INSERT session/turn hash; REPLACE backlog suppression |
| hooks/svc-task-completion-guard.sh | `WI-399 A6: real N-strike cap` followed by `foreign-claim ownership check` | MOVE ownership before status; REPLACE counter path; preserve cap output |
| scripts/worktree.sh | `cmd_create()`, `cmd_status()`, `cmd_remove()` | INSERT binding create/status/release at successful lifecycle boundaries |
| test-framework/evals/tier-1/validate-active-intent-guard.sh | existing prompt/contract fixture table | INSERT foreign WI-479 and latest-unrelated-prompt cases |

## Task Graph

```json
{"tasks":[
 {"id":"task-1","title":"Write schema, reference, and failing concurrency fixtures","blocked_by":[]},
 {"id":"task-2","title":"Normalize claims and ownership-first WI resolution","blocked_by":["task-1"]},
 {"id":"task-3","title":"Bind active intent and completion guard to exact ownership","blocked_by":["task-2"]},
 {"id":"task-4","title":"Wire binding lifecycle into worktree manager","blocked_by":["task-3"]},
 {"id":"task-5","title":"Run two-session and full framework validation","blocked_by":["task-4"]}
]}
```

| Task | ACs | Validation | Checkpoint |
|---|---|---|---|
| 1 | 1,3,5 | schema parse + fixture red baseline | yes |
| 2 | 2,3,5 | claim/resolver table tests | yes |
| 3 | 2,4,5 | foreign Stop and cap fixtures | yes |
| 4 | 1,4,5 | create/resume/transfer/remove fixture | yes |
| 5 | 1–5 | focused + full tier-1 | yes |

## AC-to-Task and AC-to-Test Mapping

| AC | Task | Test type | Proof |
|---|---|---|---|
| AC-484-1 | 1,4 | integration | one mutating binding, read-only zero |
| AC-484-2 | 2,3 | regression | foreign claim advisory before status |
| AC-484-3 | 1,2 | table unit | schema variants, agent-name rejection |
| AC-484-4 | 3,4 | integration | absolute paths and three-pressure cap |
| AC-484-5 | 1–5 | concurrency | two processes/two worktrees, zero cross-talk |

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | N/A | headless concurrency control |
| Technical design | satisfied | program P4 authority order + schema contract |
| Style | satisfied | existing ESM/portable Bash/atomic state helpers |
| Persona | N/A | framework operator control |
| Security | required | ownership spoofing and symlink/path tests |
| Dependency | gated | WI-485 verify-promotion receipt required |

## Validation Plan

### Tier-1 promotion note

| Field | Decision |
|---|---|
| validator_path | test-framework/evals/tier-1/validate-session-worktree-binding.sh |
| failure_class | cross-session WI/worktree ownership and completion-pressure crosstalk |
| promotion_signal | repeated WI-352/WI-399 foreign-claim failures and captured WI-479 incident |
| expected_runtime_budget | under 5 seconds; five deterministic interleavings |
| why_tier_2_or_targeted_is_insufficient | shared resolver/claim hooks are framework hot paths; 100-interleaving stress remains targeted |

Run JSON Schema validation, Node syntax, Bash syntax, claim table tests, active-intent regression, five tier-1 interleavings, a targeted 100-interleaving stress loop, worktree safety validator, pipeline integrity, and full tier-1. Verify current callers that destructure resolveWI remain fixture-identical for owned sessions.

## Execution Command Sequence

```bash
git fetch origin main
test -z "$(git status --short)"
bash scripts/worktree.sh create framework-WI-484-session-worktree-binding --from origin/main
cd .worktrees/framework-WI-484-session-worktree-binding
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-active-intent-guard.sh
bash test-framework/evals/tier-1/validate-worktree-safety.sh
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh
```

RECOVERY_IF_FAIL: retain both fixture worktrees and runtime counter directory, identify the first ownership divergence, repair only that task, rerun 100 interleavings, then full tier-1. Never transfer a live claim to make a test pass.

## Checkpoint Plan

Checkpoint after each task and focused green test. Do not combine claim normalization and Stop control-flow changes in one commit; this preserves bisectability and the WI-485 containment rollback.

## Promotion Readiness Checklist

- [ ] WI-485 is VERIFIED.
- [ ] All five ACs have deterministic proof.
- [ ] No diagnostic fallback creates authority.
- [ ] Claim owner spoof and symlink/path attacks are covered.
- [ ] Existing owned-session behavior remains compatible.
- [ ] No ORM migration applies; JSON schema versioning is explicit.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 3 | Linked worktrees | binding/claim ownership per worktree | coupled | worktree create/resume/remove lifecycle |
| 12 | Downstream framework artifacts | resolver/guard caller contract | coupled | compatibility tests and pipeline validation |
| 15 | Runtime filesystem | counters and atomic binding/claim files | coupled | TTL, release, CAS transfer, cleanup tests |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| CREATE targets absent | PASS | schema/reference/test names do not exist |
| MODIFY targets exist | PASS | resolver, claim, intent, guard, worktree and active-intent test present |
| Dependency order | PASS | WI-485 precedes generalization |
| Import/caller compatibility | PASS | legacy exports and destructuring retained |
| Scenario walkthrough | PASS | all two-session transitions map to tasks 1–5 |

No unresolved simulation failure remains. Handoff ends before execute-changeset.
