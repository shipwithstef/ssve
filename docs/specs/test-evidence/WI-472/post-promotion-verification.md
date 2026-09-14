# WI-472 Post-Promotion Verification

**Verdict:** VERIFIED-L3
**Delivery tier:** full
**Target class:** headless framework
**Promotion:** PR 161, squash commit `0c522181d214b642919c815f425d5a5abaa8fb23`
**Reviewed head:** `9253a84b3c9b11e7b7aca5105cf83ce1b9d9a696`

## Promotion evidence

- GitHub reports PR 161 `MERGED` at `2026-07-21T03:31:24Z`.
- The promoted and reviewed trees both equal `db32acbcb1f8b78d9a21aa41c94cd16ca1ff44eb`.
- The promoted commit's copied mandatory receipt envelope validates `complete` before G7.
- The remote feature branch was deleted by the sanctioned merge wrapper.

## Acceptance-criteria verification

| AC | Post-merge proof | Result |
|---|---|---|
| RC-01 | `validate-svc-reconcile-bounded.sh` proves timeout and spawn-error behavior, including mutation-red coverage. | PASS |
| RC-02 | Golden and legacy-binary validators prove range/per-SHA equality and first-run compatibility. | PASS |
| RC-03 | Golden fixtures preserve pre-push refuse/warn and notes-ref semantics. | PASS |
| RC-04 | Watcher validator proves one generation-owned detached launch and duplicate suppression. | PASS |
| RC-05 | Five live merged-state runs kept the checkpoint unchanged while outcomes were running; fixture matrices cover terminal success and failure. | PASS |
| RC-06 | Five frozen OLD-vs-NEW legacy projections are byte-identical. | PASS |
| RC-07 | Post-merge wall times were `2431, 2111, 1990, 2208, 2652` ms; nearest-rank p95 is 2652 ms, below 10 seconds. The GitHub-hang fixture remains bounded below 20 seconds. | PASS |
| RC-08 | Timeout and watcher validators each prove intentional mutation red before implementation green. | PASS |
| RC-09 | The exact reviewed ledger validates 78 unique attestations, zero waivers; canonical `--compare-range` reports `unaccounted: 0`. | PASS |
| RC-10 | A fresh detached worktree with no `.svc/receipts` mirror validates the promoted commit `complete` and reports the same 78-row zero-unaccounted result. | PASS |

## Runtime and regression evidence

- Six WI-specific Tier-1 validators pass on the promoted tree.
- Full Tier-1 after commit and again at pre-push: 265 scripts passed, 1 failed, 0 timed out.
- The sole failure is `validate-skip-conditions-registry.sh` against untouched `.svc/lane-tasks-WI-498.json` tasks 5 and 6; WI-472 does not touch that file. It is classified pre-existing, not waived as a WI-472 result.
- The detached generic auto-drive therefore failed closed and attempted no effective rollback (`No commits between main and main`). Manual G7 uses the mapped WI-specific evidence plus the explicit baseline classification; it does not relabel the generic failure as green.
- The pre/post evidence file validates with `scripts/validate-pre-post-validation-evidence.mjs` and classifies the acceptance-critical delta `fixed-by-change` over four implementation iterations.

## Test-quality audit

The six mapped validators contain executable behavioral assertions and negative/mutation fixtures. No mapped requirement test is disabled, circular, or satisfied only by presence/non-null assertions. Expected values come from the frozen legacy projection, WI acceptance criteria, tracked review hashes, and explicit state matrices.

## Scope dispositions

- Browser server, DOM, visual baseline, responsive capture, and journeys: N/A; WI-472 is a headless repository enforcement path with no user-visible surface.
- Deployment/provider/mobile release evidence: N/A; this repository has no deploy target and WI-472 adds no external provider or mobile artifact.
- Pre-existing repository failure: retained and named as WI-498 evidence debt; no historical or test mass waiver was added.
- Leftovers: only governed WI-472 closeout edits are retained for the verification follow-up; generated competitive-monitor and knowledge-version test residue was removed.

## G7 verdict

No unresolved Critical or High drift remains. RC-01 through RC-10 are current on the promoted tree, the receipt backlog is portable with zero unaccounted rows, and the WI/INDEX state is synchronized to `VERIFIED-L3`.

```yaml
single_lane_summary:
  item: "WI-472 / PR-161"
  target_class: "headless-framework"
  verification_tier: "V2"
  sampled: true
  evidence:
    - "docs/specs/test-evidence/WI-472/post-promotion-verification.md"
    - "docs/specs/test-evidence/WI-472/pre-post-validation.json"
```
