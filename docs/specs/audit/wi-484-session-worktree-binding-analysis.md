# Systems Analysis: WI-484 Session, Worktree, and WI Binding

**Date:** 2026-07-14
**Branch:** `framework-WI-484-session-worktree-binding`
**Spec:** `docs/specs/work-items/WI-484.md`
**Manifest:** `docs/plans/2026-07-14-wi484-session-worktree-binding/manifest.md`

## Acceptance-Criteria Ledger

| AC | Required behavior | Evidence | Status |
|---|---|---|---|
| AC-484-1 | One mutating WI/worktree binding per session; read-only may have zero | same-session renewal, reviewer zero binding, sibling and simultaneous cross-worktree tests, pre-side-effect missing-session create test | CONFIRMED |
| AC-484-2 | Foreign claim becomes advisory before completion calculation | foreign claim paired with deliberately corrupt graph; no block, parse, counter, or receipt change | CONFIRMED |
| AC-484-3 | Normalize claim variants without agent-name ownership | `session_token`, `session`, `session_id`, and shaped `claimed_by` accepted; `claude`, `codex`, `kimi`, and labels rejected | CONFIRMED |
| AC-484-4 | Pressure cap is three; state paths are absolute/worktree resolved | pressure 1-3 block, attempt 4 allows; non-pressure does not consume cap; symlink/foreign runtime roots disable pressure | CONFIRMED |
| AC-484-5 | Two sessions/worktrees have zero cross-talk | one winner in simultaneous binding/CAS races; foreign graph unread; receipt sentinel and scoped counters unchanged | CONFIRMED |

## Coverage Ledger

| Subsystem | Entrypoints | Risk | Result |
|---|---|---|---|
| Binding and claim lifecycle | `wi-claim.mjs`, `worktree.sh` | Critical | audited; atomic, serialized, CAS-bound |
| Authority resolution | `resolve-wi.mjs` | Critical | audited; diagnostics cannot become authority |
| User intent and Stop pressure | `active-intent.mjs`, completion guard | Critical | audited; latest prompt wins stale pressure, exact resume restores |
| Runtime state and counters | completion guard | High | audited; scoped absolute paths and owner checks |
| Compatibility and lifecycle | create/resume/status/remove, legacy callers | High | focused compatibility and full Tier 1 green |

## Hypotheses Tested

1. A foreign claim can reach graph parsing. Confirmed in the old ordering; corrected and fenced with a corrupt-graph fixture.
2. A session can bind two worktrees during a race. Falsified after repository-scoped locking; exactly one simultaneous writer wins.
3. A released or stale claim can be stolen without generation proof. Falsified after correction; direct takeover fails and CAS succeeds once.
4. A newer unrelated user prompt can be overridden by stale WI completion pressure. Confirmed from the captured WI-479 conversation; corrected while preserving exact same-session resume.
5. Clean/advisory stops can consume the pressure budget. Confirmed during Fable review; corrected so only pressure statuses mutate counters.
6. Missing session identity can leave an unbound mutating worktree. Confirmed during Fable review; corrected before every side effect and behaviorally tested.

## Review Convergence

- Codex self-review and full static validation found and corrected ownership, locking, and path issues.
- Claude Fable issued three REQUEST_CHANGES rounds across the original and follow-up deltas; every actionable Critical/High/Moderate finding was accepted and regression-fenced.
- Final Claude Fable verdict: APPROVE.
- `docs/specs/security/wi-484-session-worktree-binding-review.md` reports no unresolved Critical or High security finding.

## Validation

- `validate-session-worktree-binding.sh` — 22 passed, 0 failed.
- `validate-active-intent-guard.sh` — PASS.
- `validate-completion-guard-no-max-escape.sh` — 5 passed, 0 failed.
- `validate-stop-hook-session-isolation.sh` — PASS.
- Full Tier 1 on the final review-remediated tree — 240 scripts passed, 0 failed, 0 timed out.
- Full Tier 1 remains required after merge.

## Plan Deviations

- The planned five deterministic interleavings expanded into 22 focused assertions plus 100 concurrent renewals and two simultaneous CAS/binding races.
- The implementation added `validate-completion-guard-no-max-escape.sh` to the touched set because the pressure cap is an explicit AC and the existing contract needed preservation.
- Review and audit artifacts are added as mandatory-chain evidence. These changes narrow risk and do not expand product behavior.

## Residue and Boundaries

- No dependency, lockfile, registry, host manifest, or installed-skill symlink source change is part of WI-484.
- Fable's low-risk malformed-binding `cmd_remove` diagnostic and legacy-only foreign-claim counter ordering are not reachable in the authoritative binding path and are deferred.
- No production deployment exists for this framework change; post-merge host install drift and Tier 1 are promotion proof.

## Verdict

- [x] READY TO LAND — AC-484-1 through AC-484-5 are confirmed and no unresolved Critical/High finding remains.
- [ ] BLOCKED
- [ ] CONDITIONAL
