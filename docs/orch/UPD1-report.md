# UPD1
Implemented deterministic UTC one-line task/goal/needs_owner updates; zero LLM.
Append-only ~/.local/state/orch/updates.log; durable dedup with partial-write recovery.
Task/goal/session file events wake collection; 60s polling remains fallback.
Changed-only active-goal digests every 30m; UTC done-today counts include attempt history.
Web and /orch show last 20; compact prompt band shows newest update.
Optional ntfy.sh POST: bounded 5s, no retries, skipped here (topic absent).
Validation: Node suite 93/93; plugin tests 8/8; syntax, persistence, diff checks pass.
Restarted orch-collect/orch-serve: active; live HTTP 200, fresh snapshot matches log tail.
Local commit only; unrelated pre-existing edits preserved; terminal paint not manually checked.
