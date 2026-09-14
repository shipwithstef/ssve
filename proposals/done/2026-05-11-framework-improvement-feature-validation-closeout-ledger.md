# Framework Improvement — 2026-05-11 — Feature validation closeout ledger

**Status:** PROPOSED — needs `improve-framework` implementation

## Evidence

- **Source:** Example Marketplace WI-233 AI content/image generation closeout and user correction on 2026-05-11.
- **Finding:** A user-facing feature was treated as closeout-ready through API checks and visual fragments, without a single mandatory feature-validation artifact tying personas, acceptance criteria, journeys, runtime execution, E2E/manual evidence, and saved outcomes together.
- **Severity:** CRITICAL

## Diagnosis

- **Root cause:** svc has the right primitives (`validate-feature`, `build-personas`, `write-spec`, `audit-ac`, `write-journeys`, `write-e2e`, `test-journeys`, `track-visuals`, `review-gate`, `verify-promotion`), but route-workflow does not force them into one feature closeout ledger before a user-facing feature can be called complete.
- **Category:** feature-validation orchestration / closeout evidence / task-graph enforcement.
- **Already in FRAMEWORK-STATE.md?** Related visual and completion-scope gaps exist, but this exact feature-validation closeout ledger is not implemented as a mandatory closeout artifact.

The failure mode is:

1. User asks for a feature.
2. Implementation work happens.
3. Some tests/probes/screenshots run.
4. The result is summarized as working.
5. There is no complete ledger showing:
   - which personas were served,
   - which acceptance criteria existed,
   - which journeys covered those ACs,
   - which scenarios were executed,
   - which viewport/runtime states were captured,
   - which E2E/manual/browser checks passed or failed,
   - which saved end states were verified.

That is not framework-complete feature validation.

## Required Framework Change

### F-001 — Add `feature_validation_closeout` as a mandatory evidence family

For any user-facing feature lane, route-workflow must add this evidence family to the task graph:

```json
"feature_validation_closeout": "required"
```

It can become `satisfied` only when a closeout ledger exists and passes validation.

### F-002 — Require a feature closeout ledger artifact

Every user-facing feature closeout must produce:

```text
docs/specs/features/test-evidence/<date>-<feature>/FEATURE_VALIDATION_LEDGER.md
```

Minimum required sections:

1. Feature scope and production/local target.
2. Personas in scope.
3. Acceptance criteria inventory.
4. AC-to-persona mapping.
5. AC-to-journey/scenario mapping.
6. Static checks run before browser work.
7. Runtime journey execution results.
8. E2E test results or explicit fixture gap.
9. Visual/saved-state evidence paths.
10. Defects filed with WI links.
11. Final closeout classification.

### F-003 — Enforce one row per acceptance criterion

The ledger must include a machine-checkable table:

| AC ID | Persona(s) | Journey scenario(s) | Validation tier | Evidence path(s) | Runtime result | E2E result | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |

Rules:

- Every AC must have exactly one row.
- Every user-visible/rendering AC must cite at least one screenshot or track-visuals path.
- Every behavioral AC must cite a journey scenario or explain why no journey applies.
- Every failed or blocked AC must link a WI.
- A feature cannot be `framework-complete` while any AC row is `untested`, `missing-journey`, `missing-persona`, `missing-evidence`, `blocked-without-WI`, or `failed-without-WI`.

### F-004 — Route-workflow must distinguish feature validation from visual checking

When the request is feature-class, route-workflow must dispatch a full feature-validation graph, not a loose collection of visual/test skills:

```text
validate-feature
→ write-spec or sync-spec-code
→ audit-ac
→ build-personas refresh/check when personas are missing or stale
→ write-journeys/sync journeys
→ write-e2e when automatable
→ test-journeys for runtime/manual browser validation
→ track-visuals for visual/saved-state evidence
→ review-gate
→ verify-promotion
→ feature-validation closeout ledger
```

Downstream skills may skip with evidence, but the ledger must record every skip and the reason.

### F-005 — Add a closeout validator

Add a tier-1 or tier-1.5 validator:

```bash
node scripts/validate-feature-closeout-ledger.mjs \
  --feature docs/specs/features/<feature>.md \
  --ledger docs/specs/features/test-evidence/<run>/FEATURE_VALIDATION_LEDGER.md
```

Validator checks:

- Feature spec AC IDs are all present in the ledger.
- Every AC row has persona coverage or explicit `N/A` with reason.
- Every user-facing AC has journey/scenario coverage or filed journey-gap WI.
- Every visual/rendering AC has screenshot/track-visuals evidence.
- Every behavioral AC has runtime journey evidence.
- Every failed/blocked AC links a WI.
- Final classification matches row status.

### F-006 — Review-gate and verify-promotion must reject missing ledger

For user-facing features:

- `review-gate` cannot return PASS without a valid ledger or explicit non-user-facing rationale.
- `verify-promotion` cannot call a feature `framework-complete` without a valid ledger.
- `classify-delivery-graph-closeout` must return `runtime-accepted` or `blocked`, not `framework-complete`, if `feature_validation_closeout` is missing.

## Replay Verification

Replay target: Example Marketplace WI-233 failure fixture.

The fixture must fail when evidence exists only as:

- API probe passed,
- generated dialog screenshot exists,
- saved-state screenshots are partial,
- no AC-by-AC ledger exists,
- mobile journey is blocked without closeout classification,
- Event/Standby outcomes are partial or failed.

The fixture may pass only when:

- personas are mapped,
- ACs are inventoried,
- each AC maps to journey scenarios,
- runtime journey evidence exists,
- saved end states are verified,
- failures have WIs,
- final closeout is correctly classified.

## Acceptance Criteria

- [ ] route-workflow creates `feature_validation_closeout` evidence obligations for user-facing feature lanes.
- [ ] A canonical `FEATURE_VALIDATION_LEDGER.md` template exists.
- [ ] A validator checks AC/persona/journey/evidence completeness.
- [ ] review-gate rejects PASS for user-facing features without a valid ledger.
- [ ] verify-promotion rejects `framework-complete` for user-facing features without a valid ledger.
- [ ] test-journeys output can feed the ledger directly.
- [ ] track-visuals saved-state evidence can be referenced from ledger rows.
- [ ] A WI-233-style replay fixture proves the old failure now blocks closeout.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal is atomic | PASS |
| 2 | Addresses persona/AC/journey/runtime validation, not only visuals | PASS |
| 3 | Defines a mechanical artifact | PASS |
| 4 | Defines a validator | PASS |
| 5 | Defines review/verify closeout enforcement | PASS |
