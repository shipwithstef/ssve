# WI-530 cross-model execution review

**Date:** 2026-08-11
**Orchestrator/self-review:** Codex
**Independent reviewers:** Sol reliability review plus AGY / Gemini 3.6 Flash High
**Rounds:** 3 of the hard maximum of 3

## Scope

The review covered the complete `skills/<name>` source migration, flat host
installation, consumer-local non-authority, preserved-worktree adoption,
same-session branch repair, controller-v2 promotion, migration recovery, and
rollback. Product repositories and product deployment were outside WI-530.

## Round history

| Round | Candidate | Result | Resolution |
|---|---|---|---|
| 1 | early migration candidate | FAIL | Fixed repeated bootstrap, post-lease receipt recovery, state-root containment, ambiguous owner handling, legacy model-label compatibility, duplicate Git registration, and two-surface rollback. |
| 2 | `8402d1ca2f58e86d4194a483e3544cb1f38c01ec0b5e9478da5d74f3b632c700` | FAIL | Fixed pre-intent controller compatibility, exact manifest/source name bijection, and generation-lineage branch convergence through rollback. |
| 3 | `74ffda26e5f80631d1b00819bf6f8e057251587dde29b9de5c81b54bfcfed16b` | AGY PASS; Sol found one High | At the cap, fixed the mechanically reproducible partial multi-binding write window. Same-session resume now checks the complete lineage every time. No fourth broad adversarial round ran. |

The cap-round fix produced implementation digest
`f94058b07f5ed53668459bc876ca7ac43a2740ecedb5ecf145698c266e56ecec`.
The exact crash-state regression and the previously queued focused validators
were then re-run read-only. Sol confirmed the cited High closed with no
Critical or High blocker remaining in the targeted scope.

## Final evidence

- AGY reviewer: Google family, Gemini 3.6 Flash High, no fallback or override.
- AGY round-3 result: rubric 10, zero findings, PASS.
- Existing-worktree self-heal: 17 passed, 0 failed.
- Controller migration and two-surface rollback: PASS.
- Packaged source bijection and containment: 109 passed, 0 failed.
- Full Tier-1 before the cap-round micro-fix: 285 scripts passed, the same 18
  repository baseline failures remained, and 0 timed out.
- The cap-round micro-fix was covered by the exact partial-state fixture plus
  default-checkout isolation and controller rollback validators.
- The subsequent consumer replay exposed a deterministic command-boundary bug:
  `svc-reconcile --help` executed work and the central command selected a
  consumer-local receipt checker. The bounded repair added side-effect-free
  argument handling, explicit operation-repository selection, and a packaged
  helper path. It is covered by a focused regression and does not reopen the
  capped broad recovery/layout review.
- Targeted Sol review found two High variants in that repair: a production-active
  checker override and cwd-relative detached auto-drive. Both executable paths
  are now immutable package siblings; consumer cwd remains only the operation
  scope. The legacy fixture builds an isolated package tree instead of exposing
  a runtime override, and the consumer fixture covers a merged-PR drive attempt.
  Targeted Sol replay confirmed the final routing delta PASS with zero
  Critical/High blockers.
- The first governed commit attempt exposed a separate deterministic lifecycle
  mismatch: pre-commit tried to repair live installs from canonical main before
  main contained the package migration. The repair makes worktree pre-commit
  validate-only for every host and keeps live installation exclusively on
  canonical main; a focused mutation validator locks that boundary. Sol also
  ran the real hook across all eight manifests and confirmed PASS with no live
  installation from the worktree. The commit replay then exposed that the
  tracked slot itself was an absolute canonical-main symlink; it is now a
  portable checkout-relative link and the validator binds its resolved target.

## Gate Decision: G5

**Artifact:** executed WI-530 changeset
**Decision:** PASS
**New state:** CHANGE-SET-APPROVED
**Iterations:** 3 bounded adversarial rounds
**Resolved Critical/High:** all
**Remaining Critical/High:** 0

The G5 self-review and judgment found the same recovery, containment, bijection,
and rollback concerns recorded in the round history; each accepted finding has
an executable regression. Independent Sol and AGY review performed the fresh
cross-review and convergence check. This is a headless framework change: no
browser-visible surface, UI mock, provider flow, product database, or external
runtime integration is modified. The source/install boundary is cross-host but
not an application cross-system flow; focused all-host installation validators
and post-merge live setup/drift are the applicable proof.

## Verdict

PASS for implementation review with zero unresolved Critical or High finding.
This is not a merge or installed-host claim. Governed landing and canonical-main
all-host setup/drift remain required.
