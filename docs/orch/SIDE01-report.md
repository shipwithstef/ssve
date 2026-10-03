# SIDE-01 — quiet, session-scoped hooks

Candidate: `feature/side01-quiet-hooks`; follow-up baseline `e5606f4`; Codex/Sol 6.1 high.
Owner activation from `4a6ab7a` failed and was rolled back; previous synthetic coverage was insufficient.

Root cause and correction:
- Native spaced JSON keys after commas were rejected; compact synthetic JSON passed.
- The exact recorded payload yielded zero parsed calls before this fix, one afterward.
- Consume key whitespace first; preserve literal command proof for the entire envelope.
- Cover native parenthesized/bound output, stringify/slice, optional fields and bounded batch renderers.
- Keep dynamic inputs, mutating callbacks, shadowed globals, executable flags and substitutions governed.
- Reads bypass branch recovery, including the missing `origin/main` check; genuine mutations still advise/deny.

Regression fixtures: `test-framework/evals/fixtures/side01/`.
- Preserve the exact failed installed command, payload, stdout and stderr.
- Inventory all 25 distinct recorded managed Claude/Codex/Cursor hook command shapes.
- Sample 120 recent Codex logs (2026-09-30 through 2026-10-03); retain 16 native renderer/transport forms.
- Native sample redacts only literal command/workdir values; syntax/whitespace and source record hashes remain.
- The sample contained `exec` with nested `tools.exec_command`; no top-level shell/exec_command occurred.
- Replay boundary → durable launcher → dispatcher in disposable HOME; the earlier test skipped the launcher.

Validation:
- Targeted goal-delivery-hooks: 7/7 passed (previously 5/5).
- 1,000 engine probes, 108 original boundary replays, exact failure replay in advisory/enforce modes passed.
- 32 native read replays: zero advisories or repository/runtime writes; 64 paired mutation controls passed.
- All 13 shell-applicable recorded host hook command/event shapes are quiet; manifest lint passed.
- Final full Tier 1: 403/403 passed, zero failures/timeouts; `TIER1_JOBS=4 VALIDATOR_TIMEOUT_SEC=300`.
- Delta: two additional goal tests; aggregate validator count remains 403. Final sweep follows parser hardening.
- Full command: `bash test-framework/evals/run-all-evals.sh`; tiers 1.5–3 are not requested.

Evidence: `test-framework/results/side01-activation-fix-20261003/` (ignored).
Fixtures also preserve the owner's failed live evidence; temporary-home results do not claim live activation.
No global install/activation and no push. Owner-supplied untracked side plan is untouched.
