# Execution Controller production closeout — implementation audit

**Work item:** WI-529

**Mode:** full

**Baseline:** `0d75cb1d697d3c031e871f2bd182066a47f7bbb8`
**Verdict:** PASS pending exact-candidate independent receipts and post-merge AC-529-7

## Outcome

The implementation preserves the proof chain while closing the two production gaps: AGY can be represented truthfully as the Google reviewer host, and Codex executes one serialized PreToolUse dispatcher through the durable launcher. No product deployment or product repository is in scope.

## Acceptance-criteria verification

| AC | Evidence | Result |
|---|---|---|
| AC-529-1 | `validate-receipt-tier.sh` accepts AGY in plan/exec receipts and rejects unknown hosts | PASS |
| AC-529-2 | `cognitive-family.mjs` maps AGY to Google; same-family negative remains enforced | PASS |
| AC-529-3 | `validate-codex-hook-feature-flag.sh` and `validate-codex-session-rebinding.sh` require one launcher-backed dispatcher | PASS |
| AC-529-4 | rebinding validator compares the exact ordered dispatcher child set and counts one skill-load enforcer | PASS |
| AC-529-5 | split-marker laundering mutations fail for JSON case wiring and TOML post-install wiring; migration/drift/self-heal use the same command-bound predicate | PASS |
| AC-529-6 | focused receipt, wiring, setup, migration, enforcement, stdin, and worktree validators pass | PASS |
| AC-529-7 | canonical-main setup plus live drift-zero check | POST-MERGE |
| AC-529-8 | `validate-agy-launcher.sh` collapses three identical documents and preserves a conflicting pair as invalid | PASS |

## Adversarial review closure

The first Sol review correctly returned FAIL with two High findings: the rebinding validator asserted the obsolete direct `.mjs` fallback, and setup searched tokens independently across the whole config. Both were fixed. The routing predicate now parses command fields, selects exactly one command carrying the governed identity, and requires all markers on that same command. Mutation fixtures include unrelated marker text plus a direct governed command, so the original laundering behavior is executable and killed.

## Scope and preservation

- Legacy `gemini` receipts remain readable; new production review dispatch remains AGY, not Gemini CLI.
- The existing composite dispatcher remains serialized; no second concurrent skill enforcer was added.
- User-owned hook/config entries remain merge-preserved by the existing wirers.
- The worktree SIGPIPE fix changes only canonical-worktree discovery and prevents false drift/setup loops.
- No review gate, evidence requirement, runtime state transition, or deployment proof was removed.

## Validation evidence

- `validate-receipt-tier.sh`: 15 passed, 0 failed.
- `validate-governed-wirer-fail-fast.sh`: 9 passed, 0 failed, including split-marker laundering.
- `validate-all-host-install-migration.sh`: 52 passed, 0 failed.
- `validate-codex-session-rebinding.sh`: launcher route, exact child set, and one-use handoff PASS.
- `validate-codex-hook-feature-flag.sh`, `validate-enforcement-escape-and-readonly.sh`, `validate-stop-hook-stdin-preservation.sh`, and `validate-setup-worktree-canonical-resolution.sh`: PASS.
- `validate-agy-launcher.sh`: 14 passed, 0 failed; identical repetition is normalized and conflict remains fail-closed.
- `validate-wire-kimi-hooks-paths.sh`: duplicate last-hook convergence preserves following user TOML tables and leaves exactly one governed guard.

## Residual obligations

1. Obtain exact-candidate independent AGY and Sol PASS receipts after the review fixes.
2. Land through the governed wrapper.
3. From canonical main, re-run Codex setup, live routing probe, install drift, and focused Tier-1 checks before declaring production closeout verified.
