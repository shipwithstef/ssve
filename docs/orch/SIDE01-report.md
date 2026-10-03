# SIDE-01 — quiet, session-scoped hooks

Candidate: `feature/side01-quiet-hooks`; baseline `a2272de`; executor Codex/Sol 6.1 high.

- Proven reads bypass contract IO, self-heal, ownership state and denial counters.
- Recognize native Codex shell aliases and bounded literal code-mode wrappers.
- Permit read-command output only in `/tmp`, `SVC_SESSION_SCRATCHPAD`, or `~/.local/state/orch`.
- Keep executable flags, substitutions, mixed mutations, quoted tilde paths and symlink escapes governed.
- Advisory output is atomic once per session/repository/check/finding class, including host context.
- Advisory proposals do not increment the enforced-denial circuit breaker.
- Freshness selects matching session rows; absent/foreign contracts are silent; own stale contracts deny.
- Rules, including overflow pointers, arrive once per stable session across repositories/worktrees.
- Cursor reads exit before alias, context and event-log writes.
- Durable boundaries resolve runtime policy through the validated existing install manifest.
- Package the small output memo with the durable bundle; preserve deleted-source denial receipts.

Validation:
- `node --test test-framework/evals/tier-1/goal-delivery-hooks.test.mjs`: 5/5 passed.
- 1,000 installed-engine payloads + 108 materialized Claude/Codex/Cursor envelope replays: zero advisories or state writes.
- Mutation, finding-class/session dedupe, no-contract, own-stale-contract and rule-pointer controls passed.
- All-host install migration: 57/57; actionable denial: 67/67; manifest lint passed.
- Full baseline: 401/402 passed; native read-hook p95 failed under contention (179ms vs 153ms adjusted ceiling).
- Final full candidate suite: 403/403 passed, zero timeouts.
- Command: `TIER1_JOBS=4 VALIDATOR_TIMEOUT_SEC=300 bash test-framework/evals/run-all-evals.sh`.
- Delta: one new validator; final failure count zero. Baseline used default eight jobs/180s; latency is not a causal SIDE-01 claim.
- Two-Box isolated rerun: 131/131 passed; earlier default sweep timed out under contention.

Evidence: ignored local logs under `test-framework/results/side01-20261003/`.
Payload fixtures are synthetic native envelopes; no private transcript or redacted ENOENT stack was supplied.
Reported ENOENT is not attributed to the freshness reader, which already catches read errors.
Source/installed Claude digests differ; global hook installations were neither refreshed nor activated.
Owner review and activation remain pending. No push. Owner-supplied untracked side plan is untouched.
