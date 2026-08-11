# Framework Improvement: Candidate Reservoir and Triage Engine

**Status:** IMPLEMENTED AND PROMOTED — 2026-07-23, `8097f53b22c7a11a88294e667a1ce848b09de572`

accepted_wi: WI-508

## Evidence

- **Source:** Direct user implementation brief and pre-change command replay.
- **Finding:** SVC had structured idea/WI intake but no isolated high-volume candidate reservoir, code-grounding evaluator, or multi-role pre-WI triage engine. The pre-change ranking command failed because the harness and seed mirror did not exist.
- **Severity:** high

## Diagnosis

- **Root cause:** Candidate ideas entered durable planning surfaces too early. SVC lacked a project-scoped pre-WI state layer that could import a Git-readable mirror, verify declared code targets, rank from explicit role scores, and promote or reject exactly one candidate with an audit event.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** no (new)

The user report provided a single-gap implementation brief, storage boundary, CLI surface, scoring formula, seed corpus, and proof command. WI-508 therefore followed the normal new-capability pipeline without broad re-diagnosis of unrelated gaps.

## Acceptance Boundary

- Store framework candidate state only in native Node SQLite under a local SVC state directory; never access a target project's customer database.
- Scope every row by dynamic `project_id` and `item_scope`.
- Resolve project identity from `.svc/company-link.json` `app_id`, then Git origin, then workspace basename, without company/path literals in script source.
- Import/export a deterministic human-readable JSON mirror under `docs/specs/candidates/`.
- Compute the exact weighted composite formula, report exact existing target-file ratios, and support rank/top/promote/reject commands.
- Append promotion and rejection triage decisions to `.svc/pipeline-decisions.jsonl` through a durable outbox.
- Ship a valid 50-row `CAND-001` through `CAND-050` seed mirror with work type, grounding metadata, multi-role labels, and scores.

## Implementation

- **Route:** `write-spec → audit-ac → design-tech → explore-solutions → plan-changeset → review-plan → execute-changeset → review-gate → review-exec → review-cross-model → review-security → audit-implementation → land-changeset → verify-promotion`; all mandatory gates passed.
- **Files changed:** `scripts/candidate-harness.mjs`, `docs/specs/candidates/consumer-experience-pool.json`, `test-framework/evals/tier-1/validate-candidate-harness.sh`, and WI/spec/design/state/capability evidence.
- **Commits:** implementation `8ed6361ecc92fdd6a4d15b4a8cbc3c270fd1c519`; promoted squash `8097f53b22c7a11a88294e667a1ce848b09de572` via PR #171.

## Rollback

Revert the additive harness, validator, seed mirror, and capability/state records together. The local SQLite database and ignored company-link config remain outside Git and are never deleted automatically; no product/customer database migration exists.

## Replay Verification

- **Replay target:** `node scripts/candidate-harness.mjs --file docs/specs/candidates/consumer-experience-pool.json --top 10`, plus hermetic rank/promote/reject and project-identity fixtures.
- **Result:** PASS on promoted `main` at `8097f53b`.
- **Evidence:** `docs/specs/verification/WI-508-promotion.md`, `docs/specs/test-evidence/WI-508/pre-post-evidence.json`, and `test-framework/evals/tier-1/validate-candidate-harness.sh`.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** records WI-508 as promoted and live-replayed on the exact squash SHA.
- **Known Gaps:** no prior row moved; this was a direct user-reported capability.
- **Decisions:** locks dual-layer SQLite plus deterministic JSON mirror, project identity fallback, and the explicit pre-WI promotion boundary.
- **Capabilities:** adds Candidate Reservoir and Triage Engine to `references/knowledge/svc/CAPABILITIES.md`.
