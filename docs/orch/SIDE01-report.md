# SIDE-01 — advisory read effects and installed replay

Candidate: `feature/side01-quiet-hooks`; baseline `09872e7`; Codex worker.
Activation attempt 5 was restored. This report covers offline verification only.

Fix:
- Preserve mutation/uncertain-call steering in governed repositories, including unbound sessions.
- Emit each finding once per stable session/repository/check/class with a concrete `Next step:` hint.
- Advisory read effects accept HOME paths, quoted escapes, safe globs and fixed read-only xargs children.
- Scratch output accepts /tmp, $TMPDIR, /tmp/claude-*, configured scratchpads and ~/.local/state/orch.
- Never execute submitted commands, expand filesystem globs or rewrite effects-proven input.
- Strict proof/output and Git optional-lock normalizations remain unchanged; possible writes stay governed.
- Omit optional-contract ENOENT diagnostics without a matching session contract; retain independent mutation steering.
- Opted-in/corrupt contract diagnostics remain visible; existing rule-once and circuit-breaker suppression remain covered.

Accepted offline gate:
- Official materialize → wire → finalize in temporary Git-backed HOME; verify receipts, bundle and configured entrypoints.
- All 1,059 fixture envelopes, including the three exact native failures from `side01-20261003T193229Z`.
- All 50 prepared plus 200 additional real calls; frozen bytes/strict labels retained (Codex 80, Claude 60, Cursor 60).
- 1,166 reads / 9,633 installed calls: zero advisories, denials or repository/runtime writes.
- Fourteen advisory-only reads (three exact failures + eleven frozen samples) retain strict denial controls.
- 20 typed writes, 123 uncertain inputs, 110 paired mutations and 14 strict controls / 1,476 installed calls passed.
- Mutation advisories include next-step hints; enforce controls deny. No selected input omitted.
- Total: 11,109/11,109 installed calls passed (10,938 → 11,109), zero failures; all 579 source hashes stayed stable.
- Frozen sample SHA-256: `80cdb7baf113c9c614e2f60ce5d81f252f4119c2dda637579c692fefdd7f59d7`.

Validation:
- Goal-delivery-hooks: 11/11 passed (8 → 11); exact failures, negative effects, dedupe and optional-contract regressions.
- Full Tier 1: 403/403 passed, zero failures/timeouts; aggregate validator count remains 403.
- Native read-hook p95: 68 ms against the unchanged 100 ms budget.
- Existing advisory-noise tests: 8/8 passed; boundary, state-IO discipline and manifest lint passed.
- Initial sweep exposed minimal-fixture dependencies and Git read normalization; all eight affected validators pass after correction.
- Gate: `node scripts/replay-installed-hooks.mjs --samples <frozen-json> --out <private-evidence-dir> --jobs 6`.
- Sweep: `EVALS=0 TIER1_JOBS=4 VALIDATOR_TIMEOUT_SEC=300 SVC_TIER1_MODE=full bash test-framework/evals/run-all-evals.sh`.

Accepted evidence: `test-framework/results/side01-effects-20261003/replay-release/`; `full-tier1-release.log` beside it (ignored).
Raw samples remain private. Live boundary/manifest/Claude/Codex/Cursor configs match pre-run hashes.
No global install/activation or push. Owner-supplied untracked side plan is untouched.
