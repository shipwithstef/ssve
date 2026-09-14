# WI-487 pre-change Tier-1 baseline

- **$BASE:** `835e365a1ee2b408bcfbb8eae49500d8f0270f4b` (promoted `origin/main`, WI-486 promotion)
- **Acceptance predicate:** `FAILED_IDS ⊆ ENV_RED_SET` (a NAMED SET, never a numeric triple — F-006)

## ENV_RED_SET (environmental-precondition failures at `$BASE`, not code defects)

| validator_id | cause_class | why |
|---|---|---|
| `validate-agy-launcher.sh` | network/live-canary | requires a live Fable canary / network; the hermetic env has neither |
| `validate-codex-execution-integrity.sh` | host-machine-state | asserts the local `~/.codex` hooks feature-flag + current PreToolUse-limit docs; both are host-machine state, not repo content |

Machine-readable cause map: `docs/specs/test-evidence/WI-487/env-red-baseline.json`.

## BASELINE_PROVENANCE (informational only)

The manifest records 246 passed / 2 failed / 0 timed out at `$BASE`. Counts are
provenance only — the acceptance predicate is the `ENV_RED_SET` subset relation,
which shifts the moment the two NEW validators register.

## Observed at implementation time (this worktree)

The two NEW always-on validators register (+2 to the total). In THIS hermetic
environment the two ENV_RED_SET members happened to pass (no live-canary/host-state
mismatch surfaced), so the observed `FAILED_IDS` was empty — trivially a subset of
`ENV_RED_SET`. The predicate is enforced by `scripts/check-tier1-env-red-set.mjs`
(subset + require-pass + unchanged-cause), never by the count.
