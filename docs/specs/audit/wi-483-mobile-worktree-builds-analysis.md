# Systems Analysis: WI-483 mobile worktree builds

**Date:** 2026-07-15
**Branch:** `framework-WI-483-mobile-worktree-builds`
**Spec:** `docs/specs/work-items/WI-483.md`
**Manifest:** `docs/plans/2026-07-14-wi483-mobile-worktree-builds/manifest.md`
**Mode:** full

## Verification contract

| AC | Required behavior | Evidence | Result |
|---|---|---|---|
| AC-483-1 | Same branch is stable; different branches produce co-installable identities | named-branch and 100-branch identity matrix | Confirmed |
| AC-483-2 | Ten same-minute builds increase strictly and artifacts remain unique | same-epoch burst plus 12-process allocator concurrency | Confirmed |
| AC-483-3 | Development proof cannot satisfy canonical release proof | dev-as-release, canonical identity, mode, and ledger-isolation negatives | Confirmed |
| AC-483-4 | Canonical allocation happens once, clears floors, and never reuses failed codes | source/platform idempotency, stale-floor, failed retry, commit replay, transition matrix | Confirmed |
| AC-483-5 | Built identity, exact filename, receipt, inspected metadata, and bytes agree | real fake adapter, exact template, regular-file/no-symlink, SHA-256 and immutable-ledger negatives | Confirmed |
| AC-483-6 | Framework proof requires no SDK or consumer Gradle/Xcode change | fake argv lifecycle and staged/untracked consumer-file denial | Confirmed |

## Scope drift

All ten manifest implementation files are present. Additional files are
classified as follows:

- `.svc/lane-tasks-WI-483.json` and `.svc/session-contract.jsonl`: mandatory
  cross-host workflow state.
- review, audit, and security Markdown: mandatory chain evidence.
- `validate-output-discipline-guard.sh`: justified bounded test-harness fix,
  documented in the execution review; it removes unsafe `bash -c` interpolation
  exposed by the newly injected rule text and changes no runtime behavior.
- `proposals/triage.json`: mechanical final-gate SLA deferral of three July 14
  proposals pending formal archive/residual-map program closeout; no WI-483
  behavior changed.

No unclassified scope creep remains.

## Coverage ledger

| Subsystem | Risk | Audit result |
|---|---|---|
| Contract and identity derivation | Medium | closed schema/runtime shapes, platform caps, collision resistance confirmed |
| Development allocator | High | state isolation, burst monotonicity, concurrency, and overflow confirmed |
| Release ledger | High | source/platform idempotency, floors, failure consumption, and immutable transitions confirmed |
| Artifact verification | High | contained regular bytes, exact template, fresh metadata, and engine SHA-256 confirmed |
| Skill/rule wiring | Medium | execute/land/verify separation and direct argv boundary confirmed |
| Test harness | High | real fake lifecycle, negative matrix, no SDK/consumer mutation confirmed |

## Hypotheses tested

1. Development state can alias or overwrite the release ledger — reproduced in
   the first review, fixed, and now rejected before write.
2. Matching JSON can advance a reservation without a real artifact — reproduced
   by the security audit, fixed with contained regular-file and digest proof.
3. Concurrent or repeated land can allocate multiple codes for one source —
   fixed with source/platform idempotency and failed-only higher retry.
4. Filename token similarity can pass instead of exact equality — fixed with
   exact configured template rendering and basename equality.
5. Unknown or stringly typed adapter fields can bypass the schema contract —
   fixed with closed output keys and JSON-number enforcement.

## Specialist and cross-model convergence

- Security re-audit: PASS.
- Testing audit: all blocking proof and fake-adapter gaps fixed and pinned.
- Performance/maintainability: spread-based ledger crash removed; stale-lock
  diagnostics added; final committed-floor ambiguity fixed. Whole-ledger rewrite
  remains linear but is bounded, durable, and non-blocking for this changeset.
- Claude Fable high-effort final verdict: APPROVE, no High or Medium findings.

## Pre/post classification

The manifest simulation recorded all engine/schema/reference/test targets absent
before execution, so this is a branch-introduced capability rather than a repair
whose baseline behavior could regress. Post-change evidence is the 12/12 focused
lifecycle matrix plus the framework Tier-1 gate. Consumer SDK/device/store proof
is explicitly deferred by AC-483-6 and is not substituted with local claims.

## Residue and unverified surfaces

No new TODO/FIXME/HACK residue exists in the implementation files. No mobile SDK,
real device, signing service, entitlement, or app-store state was exercised;
those surfaces require a separate consumer adapter work item.

## Verdict

- [x] READY TO LAND — all six ACs have direct evidence and no unresolved Critical, High, Medium, or Low finding remains.
- [ ] BLOCKED
- [ ] CONDITIONAL
