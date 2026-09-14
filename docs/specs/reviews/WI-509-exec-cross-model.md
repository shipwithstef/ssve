# Cross-Model Execution Review: WI-509

**Date:** 2026-07-23
**Models:** Codex/OpenAI executor + Claude Opus 4.8/Anthropic reviewer
**Rounds:** 3
**Branch:** `framework-WI-509-reconcile-range-timeout`
**Verdict:** PROMOTED

## Summary

- Requested/effective reviewer tuple: `claude` / `anthropic` /
  `claude-opus-4-8` / `high`
- Round 1: 3 High, 2 Medium, 3 Low, 1 Info
- Round 2: 1 High, 3 Medium, 4 Low, 1 Info
- Round 3: 0 High/Critical, 3 Medium, 2 Low, 2 Info
- Accepted and fixed: symlink-safe entry, permanent-test scope, strict worker
  parser coverage, infrastructure classification, design drift, diagnostics,
  mixed-mode semantics, fixture isolation/portability, consumer wiring, and
  honest reconcile recovery guidance
- Remaining Critical: 0
- Remaining High: 0
- rounds_run: 3

## Round 1

### Accepted and fixed

- **RX-EXEC-001 High:** module-main guard was symlink-fragile. Fixed with
  realpath comparison and a real symlink CLI fixture.
- **RX-EXEC-002 High:** WI-specific baseline assertions did not belong in a
  permanent Tier-1 validator. Removed; one-shot proof remains in WI evidence.
- **RX-EXEC-003 High:** strict child-parser branches were not directly tested.
  Factored `interpretWorkerOutput()` and added table-driven malformed,
  cardinality, mismatch, timeout, exit, and buffer cases.
- RX-EXEC-004/005/006/007/008: added explicit infrastructure signals,
  synchronized timeout doctrine, preserved spawn errors, made range config
  consistent, and rejected mixed direct/range forms.

### Disposition

- **RX-EXEC-009 Info:** exact 166-SHA timing is a warm-cache host replay;
  the permanent 16-commit fixture deletes its mirrors first and proves cold
  concurrent creation. Both are retained with their distinct purpose.

## Round 2

### Accepted and fixed

- **RX-EXEC-010 High:** `infrastructure_failures` was produced but not consumed.
  `reconcile-core` now retains `receipt-validation-unavailable`, and
  `svc-reconcile` reports unavailable validation instead of missing debt while
  still preserving the checkpoint.
- RX-EXEC-012: fixture Git config is isolated from global/system hooks/signing.
- RX-EXEC-013: framework capability/state remain explicitly pending promoted
  replay.
- RX-EXEC-014/015/016/017: direct output stays byte-shape compatible, mixed
  modes are symmetric, pool worker signature is explicit, and hashing is
  Node-based portable logic.

### Disposition

- **RX-EXEC-011 Medium — accept-with-justification:** the existing reconcile
  child is the aggregate 20-second hard bound. A second competing range
  deadline would add cancellation/orphan semantics without improving the
  current 166-SHA acceptance proof. The permanent 15-second gate catches
  denominator growth before the parent does; a future measured threshold
  crossing routes a separate optimization.

## Round 3

### Accepted and fixed

- RX-EXEC-018/020: parse-failure/parent-timeout fallback now carries the
  infrastructure classification, and all-infrastructure failures print only
  replay-safe guidance, not retroactive receipt-debt remediation.
- RX-EXEC-021: event-loop-drain termination is retained to avoid truncation;
  exit code, stdout JSON, and CLI surface remain the compatibility boundary.
- RX-EXEC-023: no strict reconcile-output schema exists; the new fields are
  additive and legacy projection remains unchanged.

### Disposition

- **RX-EXEC-019 Medium — accept-with-justification:** reconcile's parent uses
  SIGKILL, so a process handler cannot guarantee cleanup. Each grandchild has
  its own 5-second hard timeout, writes only atomic per-SHA mirrors, and has no
  persistent service or lock; worst-case post-parent lifetime is bounded.
- **RX-EXEC-022 Low — reject-with-justification:** direct and symlink CLI
  fixtures parse stdout as JSON; all configuration and infrastructure
  diagnostics use stderr. Tolerating stray stdout would weaken the strict
  machine contract.
- **RX-EXEC-024 Info — accept-with-justification:** explicit `undefined`
  intentionally means a deterministic capacity of one in the pure unit
  boundary; production omits the argument and uses detected parallelism.

## Evidence

- Findings and receipts:
  - `.svc/external-review-artifacts/cross-model/`
  - `.svc/external-review-artifacts/cross-model-round2/`
  - `.svc/external-review-artifacts/cross-model-round3/`
- Focused validator:
  `test-framework/evals/tier-1/validate-chain-receipts-range-workers.sh`
- Exact replay: 166/166, 0 infrastructure failures, 3.746 seconds after
  review fixes.

## Verdict

**PROMOTED:** the three-round cap is reached, no Critical or High remains, and
every residual finding has an evidence-backed disposition.
