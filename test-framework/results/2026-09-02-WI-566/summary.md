# WI-566 static framework comparison

Status: PASS — no candidate-code regression.

- Candidate `94f21ead0af237e607e38fe1d2c4a31f9cea0a50`: 338 passed,
  26 failed, 0 timed out; suite exit 1.
- Exact base `981005eb9127237d5c5e3a259ee023965ee15dfd`: 321 passed,
  42 failed, 0 timed out; suite exit 1.
- Initial set comparison named two candidate-only failures:
  `validate-receipt-tier.sh` and `validate-stop-hook-session-isolation.sh`.
- Both pass from a clean detached worktree at the exact candidate commit.
  `validate-receipt-tier.sh` observed a transient missing-file race while other
  host-state suites were active. `validate-stop-hook-session-isolation.sh` ran
  in the working worktree carrying another live session's controller lease
  (`WI-GROK-HOST-IDENTITY-02`), so its synthetic `WI-TEST-A` request correctly
  failed authority resolution; a clean candidate worktree passes all five
  isolation checks.
- The focused bounded-exit, reviewer-evidence, retroactive-attestation,
  contract (670/0), and launcher (165/0) validators all pass.

Conclusion: the full-suite red set is environmental/session-state debt already
present at the base or caused by shared host activity. Clean replay proves no
candidate-only WI-566 failure. Full logs and failure-set files remain generated
test artifacts in this result directory.
