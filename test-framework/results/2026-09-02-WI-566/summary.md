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
- After the advisory execution-review corrections, the full candidate suite
  improved again to 339 passed, 25 failed, 0 timed out. Its only apparent
  candidate-only failure is the same live-controller-sensitive
  `validate-stop-hook-session-isolation.sh`; it passes all five checks from a
  clean detached worktree at corrected candidate tree
  `b854bb225961cc0dadb315fc5729f89a354ac4f2`. The WI-566 changes do not touch
  that hook family, so the clean exact-tree replay is the controlling
  classification.
- The final authority-model rerun records 338 passed, 26 failed, 0 timed out.
  Its only apparent candidate-only entries are the two already classified
  shared-state validators, `validate-receipt-tier.sh` and
  `validate-stop-hook-session-isolation.sh`; both pass from a clean detached
  worktree at final authority-model tree
  `d8e1026ead0f81974894f68f9cbd9f0441c10d5b` before external review.
- After structured evidence and signed classification, the final broad run is
  336 passed, 28 failed, 0 timed out. The four apparent candidate-only entries
  are shared-worktree residue/session validators already green individually;
  all four pass from clean candidate tree
  `29e3f36f55d2ca5a7fba505b2db24b771945770c` before the concluding review.
- After the request-bound classification correction, the concluding broad run
  is 339 passed, 25 failed, 0 timed out. The only apparent candidate-only
  entries are `validate-no-svc-residue.sh` and
  `validate-stop-hook-session-isolation.sh`; both pass from clean candidate
  worktree replay of the final staged candidate.

Conclusion: the full-suite red set is environmental/session-state debt already
present at the base or caused by shared host activity. Clean replay proves no
candidate-only WI-566 failure. Full logs and failure-set files remain generated
test artifacts in this result directory.
