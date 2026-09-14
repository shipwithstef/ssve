# WI-488 Frozen-Tree Tier-1 Evidence

**Captured:** 2026-07-15T19:11:00+03:00
**Command:** `bash test-framework/evals/run-all-evals.sh`
**Independently reviewed implementation hash:** `b948fe6321936d98ae990b953355815c9892520448895ef3b726532f48ee62f6`

## Result

- Passed: 242
- Failed: 2
- Timed out: 0

Failing identities:

1. `validate-concern-registry-cross-host.sh` — pre-existing and assigned to WI-487.
2. `validate-shared-content-symlinks.sh` — pre-existing and assigned to WI-487.

The pre-edit 240-pass/3-failure identity set also contained
`validate-session-contract-freshness.sh`; it now passes because the isolated
WI-488 session contract is fresh. A transient pre-freeze run reported
`validate-no-svc-residue.sh` while the durable lane graph was still untracked;
staging that intended committed artifact made the validator pass. It is not in
the final result. The final failing set is a strict subset of the recorded
pre-edit allowlist, so WI-488 introduces no Tier-1 failure. The command exits 1
because the framework honestly retains the two WI-487 failures; the current
landing policy is satisfied by no new failures plus explicit ownership of the
known failures in the immediately dependent delivery wave.
