# WI-551 Implementation Summary

## Scope

- Implemented WI-551 only in this worktree.
- Added owner-external, point-in-time dispatch resolution with layering:
  1. global dispatch policy at invoke-time,
  2. optional WI-scoped work overlay,
  3. explicit + receipted session override.
- Preserved AGY as reviewer transport only (not orchestrator).

## AC Coverage

- **AC-551-1**: PASS  
  Single resolver implemented in `scripts/resolve-dispatch.mjs` reading `~/.svc/dispatch-policy.json` or `SVC_DISPATCH_POLICY`.
- **AC-551-2**: PASS  
  Missing global policy now fails closed (`dispatch_missing_global_file`), no `svc-default` fallback.
- **AC-551-3**: PASS  
  Session override applies only when requested and receipted; otherwise ignored.
- **AC-551-4**: PASS  
  Work overlay honors WI scope (`scope.wi`) and is skipped for non-matching WI.
- **AC-551-5**: PASS  
  Per-role deny/allow enforced; denied models fail closed and cannot bypass via legacy defaults.
- **AC-551-6**: PASS  
  AGY/Gemini station selection is fallback/explicit-ask gated in resolver station selection.
- **AC-551-7**: PASS  
  Resolver preserves configured host identities (no silent Grok/Cursor remap).
- **AC-551-8**: PASS  
  Added schema + example only: `schemas/dispatch-policy.schema.json` and `examples/dispatch-policy.example.json`.
- **AC-551-9**: PASS  
  Added focused tier-1 replay validator `validate-dispatch-resolver-wi551.mjs`.

## Proposal AC-10 Replay Matrix

- Covered in `test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs`:
  1) global-only resolve  
  2) point-in-time edit changes next resolve  
  3) requested+receipted session override applies  
  4) override without request does not apply  
  5) WI overlay does not leak  
  6) deny-list fail-closed behavior  
  7) missing global file refusal  
  8) unavailable preferred station -> next allowed station  
  9) Opus 5 design-review allowed but EXEC denied  
  10) Gemini skipped by default, allowed on fallback or explicit ask

## Files Changed

- Added:
  - `schemas/dispatch-policy.schema.json`
  - `scripts/resolve-dispatch.mjs`
  - `examples/dispatch-policy.example.json`
  - `test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs`
  - `.svc/wi-551-impl-summary.md`
- Updated:
  - `scripts/resolve-model.sh`
  - `scripts/review-topology-v2.mjs`
  - `scripts/resolve-adversarial-reviewer.sh`
  - `scripts/review-plan-codex.sh`
  - `scripts/run-external-review.mjs`
  - `scripts/select-tier1-validators-v2.mjs`
  - `test-framework/evals/tier-1/validate-tier1-selector-v2.mjs`
  - `test-framework/evals/tier-1/validate-kimi-host.sh`
  - `test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs`

## Validation Run

- `node --check scripts/resolve-dispatch.mjs`
- `node --check scripts/review-topology-v2.mjs`
- `node --check scripts/run-external-review.mjs`
- `bash -n scripts/resolve-model.sh`
- `bash -n scripts/resolve-adversarial-reviewer.sh`
- `bash -n scripts/review-plan-codex.sh`
- `node test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs`
- `node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs`
- `node test-framework/evals/tier-1/validate-review-topology-v2.mjs`
- `node test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs`
- `bash test-framework/evals/tier-1/validate-kimi-host.sh`

## Remaining Blockers

- `test-framework/evals/tier-1/validate-external-review-launcher.sh` still encodes legacy scheduled reviewer-profile assumptions and currently fails under WI-551 fail-closed owner-dispatch-policy requirements unless updated to provide a dispatch-policy fixture and host/phase expectations aligned with resolver-first routing.
