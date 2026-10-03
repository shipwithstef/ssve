# SIDE-01 — offline activation replay

Candidate: `feature/side01-quiet-hooks`; baseline `7cf11c7`; Codex worker.
Activation attempt 3 was rolled back. This report covers offline verification only.

Fix:
- HOME is a dotfiles Git repo; its enclosing `.git` incorrectly vetoed orch output.
- Stop scratch ancestry checks at the explicit allowed root; retain nested-repo, metadata and symlink denials.
- The exact Claude `cat input.txt > /home/dianast/.local/state/orch/output` envelope is silent.
- Post-tool reads bypass receipt IO and cannot rewrite a completed command.
- Literal `echo` separators and `git check-ignore` in real Cursor status calls are proven reads.
- Unknown programs, substitutions, executable flags and mixed mutations remain governed.

Accepted offline gate:
- Official materialize → wire → finalize into a Git-backed temporary HOME for Claude/Codex/Cursor.
- Verify receipts, durable bundle bytes and actual configured installed commands; execute no submitted tool command.
- 1,056 fixture envelopes: 1,000 generated + 32 native forms + 22 recorded reads + two exact activation failures.
- Replay all 50 prepared inputs plus 200 additional recent calls: Codex 80, Claude 60, Cursor 60.
- Frozen real corpus: 96 reads, 20 typed writes, 134 unproven programs; omit no selected input.
- Cursor transcripts omit hook identity/workspace metadata; reconstruct that envelope and retain original tool inputs.
- Both modes: 1,152 read envelopes / 9,550 installed calls, zero advisories, denials or repository/runtime writes.
- 250 governed controls (20 writes + 134 unproven + 96 paired mutations) / 1,388 calls advise or deny as required.
- Total: 10,938/10,938 installed calls passed; zero failures; 576 source hashes and frozen sample hash stayed stable.

Validation:
- Goal-delivery-hooks: 8/8 passed; dedupe, circuit breaker, no-contract, stale-contract and rule-once controls retained.
- Full Tier 1: 403/403 passed, zero failures/timeouts; manifest lint passed.
- Initial sweep: 400/403; corrected receipt fixture/state IO. Final timing: 69 ms against the unchanged 100 ms budget.
- Delta: one additional goal test (7 → 8); aggregate validator count remains 403.
- Gate: `node scripts/replay-installed-hooks.mjs --samples <frozen-json> --out <private-evidence-dir>`.
- Sweep: `EVALS=0 TIER1_JOBS=4 VALIDATOR_TIMEOUT_SEC=300 SVC_TIER1_MODE=full bash test-framework/evals/run-all-evals.sh`.

Accepted evidence: `test-framework/results/side01-offline-20261003/replay-release/`; `full-tier1-release.log` beside it (ignored).
Raw private samples remain ignored. Live boundary/manifest/three host configs match pre-run hashes.
No global install/activation or push. Owner-supplied untracked side plan is untouched.
