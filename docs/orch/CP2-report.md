# CP2 completion — 2026-10-03

Scope: `scripts/orch/`, `mods/orchestrator-pane/`, `docs/orch/`; no push.
Collector cause: live p1c-r retained boot/start ticks but changed command line.
Read-only liveness now uses boot/start ticks; control ownership checks stay strict.
Live processes project running/stalled before any terminal/deadline metadata.
Unknown exits: report → `done (unverified exit)`; no report → `exited (unknown)`.
No unknown exit is labeled failed; reported completion never implies acceptance.

Mod: local terminal `/orch`, goals → lanes → expandable task rows, 60s fs/clock
refresh, one-line AbovePrompt, status counter, stale/error view, 100-row paging.
Details: registered-log Node helper, ≤64 KiB / 200 lines, redacted, 5s deadline.
Stop/steer preview/copy exact shell-quoted dispatch commands for the owner to run;
live steer copies stop && resume. Adopted/stale/changed attempts refuse copying.
No model calls, prompt/context injection, direct controls or filesystem writes.
Usage: `claude --plugin-dir "$PWD/mods/orchestrator-pane"`, then `/orch` locally.

Validation (Node v24.19.0; Claude Code 2.1.288; zero inference):
- Pre-fix live/terminal regression assertion: exit 1 (expected failed vs running).
- `node --test scripts/orch/*.test.mjs`: exit 0; 22 passed, 0 failed.
- `claude plugin validate mods/orchestrator-pane`: exit 0.
- `claude plugin test mods/orchestrator-pane`: exit 0; 6 passed, 0 failed.
- Mod tests cover recorded status.json, expansion/joins, 60s timing, details,
  shell quoting, clipboard failure, stale/malformed/missing snapshots, clear,
  four-surface terminal-only fallback and 500 tasks over 10 virtual minutes.
- `for file in scripts/orch/*.mjs; do node --check "$file" || exit; done`: exit 0.
- `node scripts/lint-skills-manifest.mjs`: exit 0.
- `bash scripts/verify-file-persistence.sh --from-git-status`: exit 0.
- `git diff --check`: exit 0.
- `bash test-framework/evals/run-all-evals.sh`: exit 1; 400 passed, 2 failed.
  Existing CP1 failures: validate-framework-docs-audit.sh (6 design links),
  validate-knowledge-legacy-backfill.sh (research domains missing from queue).
- `node scripts/orch/collect.mjs`: exit 0; revision 20 showed live p1c-r running;
  revision 30 showed its durable exit 0/done and adopted d1a done (unverified exit).

Unverified: actual terminal paint, clipboard delivery, idle real-session trace,
CPU/latency targets and hot-reload rendering. Reopen /orch after clear/reload.
Excluded: remote custom drawings, Q&A, direct mutation, instant event watcher,
PLAN parser/admission, acceptance receipts, billing and Spot recovery.
