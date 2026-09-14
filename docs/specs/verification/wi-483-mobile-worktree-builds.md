# WI-483 Post-Merge Verification

- **Manifest:** `docs/plans/2026-07-14-wi483-mobile-worktree-builds/manifest.md`
- **Promoted commit:** `6755c8afa2df6a61d9263df073ce4bd458e63ef3`
- **Pull request:** #137
- **Target class:** infra
- **Verification tier:** V2 real CLI and fake-adapter lifecycle
- **Delivery tier:** full
- **Delivery-graph classification:** runtime-accepted (the frozen WI-483 graph predates the `delivery_graph` evidence-family envelope; all five declared lane tasks are complete)
- **Verdict:** VERIFIED

## Promotion Evidence

| Surface | Result | Evidence |
|---|---|---|
| GitHub promotion | PASS | PR #137 squash-merged to main at `6755c8af` |
| Frozen review gate | PASS | `.svc/review-receipts/pr-137.json`; final Claude Fable round 5 verdict APPROVE |
| Receipt chain | PASS | Plan, review-plan, exec, review-exec, and audit receipts validate on implementation commit `d016bee7` |
| Promoted source | PASS | Post-merge verification branch starts at canonical `origin/main` commit `6755c8af` |
| Host installation | PASS | Antigravity, Claude, Codex, Cursor, Gemini, Kimi, Mimo Code, and OpenCode are drift-free from canonical main |
| Mobile consumer release | N/A | This framework repo has no `schemas/mobile-build-contract.json`; no canonical consumer version or store state was changed |

## Acceptance and Runtime Evidence

- AC-483-1: real identity derivation proves same-branch stability, named-branch coexistence metadata, and 100 distinct branch identities without collision.
- AC-483-2: ten same-epoch allocations and twelve concurrent allocations are strictly increasing and produce unique exact artifact names.
- AC-483-3: the verifier rejects development identity and receipt state as canonical release evidence.
- AC-483-4: source/platform idempotency, failed-code consumption, stale-floor rejection, and reserved to built to committed transitions prove exactly-once canonical allocation above both floors.
- AC-483-5: a directly invoked fake adapter produces real bytes and fresh inspection metadata; filename, source, identity, code, path, and independently computed SHA-256 must agree.
- AC-483-6: the lifecycle uses no mobile SDK, and the validator rejects any consumer Gradle or Xcode mutation in the framework diff.

## Regression Evidence

- `validate-mobile-build-identity.sh` — 12 passed, 0 failed.
- `validate-build-ship-android-version-gate.sh` — 37 passed, 0 failed.
- `validate-output-discipline-guard.sh` — 27 passed, 0 failed.
- First promoted-state aggregate run — 237 passed, five harness failures: four resource timeouts and one parallel temporary-fixture race.
- Every failed validator rerun independently on the same promoted commit — PASS.
- Reduced-concurrency promoted-state aggregate rerun — 242 scripts passed, 0 failed, 0 timed out.
- Full log — `/tmp/wi483-postmerge-tier1-rerun.log`.

## G7

G7 passes. All six acceptance criteria are proven against promoted source, no unresolved Critical, High, Medium, or Low review finding remains, the full promoted-state suite is green, and all installed host surfaces are drift-free. Browser, visual, deployment, provider, database, real SDK/device, and app-store checks are N/A because this change supplies a local framework contract and explicitly defers consumer integration to a separate WI.

```yaml
single_lane_summary:
  item: WI-483
  target_class: infra
  verification_tier: V2
  sampled: true
  evidence:
    - docs/specs/verification/wi-483-mobile-worktree-builds.md
    - docs/specs/audit/wi-483-mobile-worktree-builds-analysis.md
    - docs/specs/reviews/wi-483-mobile-worktree-builds-exec-cross-model.md
```
