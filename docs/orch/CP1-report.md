# CP1 completion — 2026-10-03

Files: `scripts/orch/{dispatch,collect,serve,common}.mjs`, `orch.test.mjs`,
`fixtures/{codex,cursor,agy}.jsonl`, `fixtures/README.md`; usage: `docs/orch/README.md`.

Validation (Node v24.19.0; no LLM calls):
- `node --test scripts/orch/*.test.mjs`: exit 0; 17 passed, 0 failed.
- Tests cover all three recorded streams, partial/malformed/rotated/oversized logs,
  backlog tails, classification, PID reuse, locks/adoption, resume, schema, HTTP/watch.
- Live systemd + fake Codex: writer exclusion, stop/resume, timeout/descendant cleanup pass.
- `for file in scripts/orch/*.mjs; do node --check "$file" || exit; done`: exit 0.
- `node scripts/lint-skills-manifest.mjs`: exit 0.
- `bash scripts/verify-file-persistence.sh --from-git-status`: exit 0.
- `git diff --check`: exit 0.
- `bash test-framework/evals/run-all-evals.sh`: exit 1; 400 passed, 2 failed, 0 timed out.
- Existing research-input failures: `validate-knowledge-legacy-backfill.sh` (new domains
  absent from queue); `validate-framework-docs-audit.sh` (6 broken design links).
- Neither failure concerns CP1 paths; fixing their source files is outside authorized scope.

Smoke: `node scripts/orch/collect.mjs --adopt p1b --pid 3179096 --log /home/dianast/worktrees/orchestrator-os-runs/p1b.json --worktree /home/dianast/worktrees/novisenti/p1b-20261003`: exit 0.
`node scripts/orch/collect.mjs`: exit 0; snapshot revision 3, no collector warnings.
P1b exited during implementation; adopted read-only, no signals or worktree changes.
Excerpt of `~/.local/state/orch/status.json`:
```json
{"schema_version":1,"revision":3,"goal":"novisenti","lane":"M1",
 "id":"p1b","pid":3179096,"state":"failed","design_state":"unknown",
 "adopted":true,"session_id":"9ae49a25-78b2-4c94-afe4-b1e338367c77",
 "executor":{"cli":"cursor","model":"Grok 4.7 256K Medium","effort":"medium"},
 "blockers":["unknown_exit"],"last_event_summary":"result done (reported)",
 "completion_report_ref":"/home/dianast/worktrees/novisenti/p1b-20261003/.worker/P1b-report.md"}
```
Unknown exit is intentional: the pre-existing launcher supplied no durable exit code.
Not done: PLAN/dependency admission, acceptance receipts, Claude mod/controls/Q&A,
billing attribution, Spot boot/fencing/recovery; no hooks/skills edits or push.
Unverified: paid CLI launch/resume, Tailscale/mobile exposure, 500-task performance,
crash/reboot recovery. Elapsed/start reconstruction is approximate; unknown cost stays null.
