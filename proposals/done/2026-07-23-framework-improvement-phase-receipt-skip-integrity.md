# Framework Improvement: Phase-Receipt-Aware Skip Integrity

**Status:** IMPLEMENTED (2026-07-23, `781d913bea632b172296b3e29bb03004743fa0ec`)
**Accepted WI:** WI-510
**Lane:** framework
**Delivery tier:** full

## Evidence

- **Source:** Promoted WI-498 replay and the WI-509 follow-up diagnosis.
- **Finding:** `test-framework/evals/tier-1/validate-skip-conditions-registry.sh` rejects completed WI-498 tasks 5 and 6 because it recognizes only `skip_reason` or the legacy `output_artifact` / `validation_output` summary fields. Both tasks carry loaded skill receipts and complete `phases_executed[].evidence_artifacts`.
- **Exact replay:** `bash test-framework/evals/tier-1/validate-skip-conditions-registry.sh` reports one failure naming WI-498 tasks 5 and 6.
- **Severity:** high, because a promoted, executed graph is classified as an unevidenced skip on the default Tier-1 path.

## Diagnosis

- **Root cause:** Skip policy and execution evidence are conflated. The registry validator asks one legacy predicate to distinguish three states: executed completion, explicitly authorized skip, and ghost completion.
- **Category:** drift and fragility.
- **Already in FRAMEWORK-STATE.md?** Yes. The 2026-07-23 WI-509 analysis registers the mismatch as WI-510 and explicitly preserves it as separate baseline debt.
- **Duplicate filter:** No existing WI-510 improvement record exists. The older skip-conditions proposal introduced the original registry but predates Phase-D receipts and delivery graphs.

### Contract distinction

1. **Executed completion:** a valid loaded skill receipt with structurally valid phase evidence proves execution; it is not a skip and does not require skip authorization.
2. **Authorized skip:** a current delivery graph must explicitly list the skipped skill, the skip must be registry-applicable, and its justification/evidence must be valid.
3. **Ghost completion:** neither executed evidence nor an authorized skip exists; fail closed.
4. **Historical compatibility:** graphs predating the delivery-graph contract retain the compatibility explicitly documented by `references/phase-receipts.md`; historical files are never rewritten to manufacture stronger evidence.

## Acceptance Criteria

- Current graphs accept executed completions only when their phase receipt shape and evidence references satisfy the current contract.
- Current skipped tasks pass only with explicit delivery-graph authorization, a registered skip condition, and valid justification/evidence.
- Missing authorization, malformed phase receipts, empty or unsafe artifact paths, unregistered skips, and prose-only current claims fail closed.
- Historical supported graphs retain documented compatibility without receipt rewrites or waivers.
- The promoted WI-498 graph passes unchanged.
- Focused mutation-red fixtures and the full Tier-1 suite pass with the WI-498 allowlist entry removed.

## Implementation

- **Route:** normal svc pipeline.
- **Reason:** this changes Tier-1 hot-path behavior and `.svc` evidence-contract interpretation, triggering the plan-changeset discipline gate.
- **Preferred hypothesis:** implement one canonical executed-versus-skipped resolver and consume it from the focused validator plus overlapping integrity checks.
- **Files expected:** focused validator and fixtures, canonical resolver if selected, overlapping validator consumers, `references/phase-receipts.md`, `.svc/main-green-allowlist.json`, framework state/capability records.
- **Rollback:** revert the implementation commit and restore the exact prior allowlist row; do not alter WI-498.
- **Implementation SHA:** `865d8c253d4c34938437a86a566621cda9d2e253`.
- **Promoted squash:** `781d913bea632b172296b3e29bb03004743fa0ec`.
- **Pull request:** https://github.com/s7an-it/serious-vibe-coding/pull/175

## Replay Verification

- **Replay target:** promoted `.svc/lane-tasks-WI-498.json`, unchanged.
- **Focused command:** `bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh`.
- **Compatibility commands:** existing skip-conditions and lane-tasks integrity validators.
- **Aggregate command:** `bash test-framework/evals/run-all-evals.sh`.
- **Result:** PASS — focused matrix, unchanged WI-498, current WI-509, and
  full Tier-1 273/273 from promoted main.
- **Evidence:** complete promoted-SHA receipt envelope and canonical reconcile
  with `unaccounted_count=0`; the obsolete WI-498 allowlist row was then removed
  for the mandatory no-row replay.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** record promoted WI-510 semantics and replay results.
- **Known Gaps:** remove the WI-510 skip-integrity mismatch only after promoted-main replay.
- **Decisions:** lock the executed-versus-authorized-skip distinction and historical compatibility boundary.
- **Capabilities:** update `references/knowledge/svc/CAPABILITIES.md` with the canonical resolver behavior after verification.
