# UPD1 + follow-up
Private ~/.config/orch/updates.json defaults created; settings hot-reload every cycle.
Event/goal filters, channel switches, quiet hours, configurable changed-only digest interval.
Default summary none makes zero LLM calls; cheap uses Cursor/Grok for digests only, never Claude.
Cheap calls: durable rolling-hour cap ≤2, 15s/4KiB bounds; quota/errors retain deterministic digest.
Deduped updates.log; web/pane last 20; prompt band newest; optional bounded ntfy push.
Unbound parent-orchestrated child and unknown Claude turn allowance are info; bound-child loss stays blocked.
Validation: node --test scripts/orch/*.test.mjs 99/99; plugin tests 9/9; syntax/persistence/diff checks pass.
Both services restarted/active; live HTTP 200 verifies fresh channels, mode none and 2 parent-orchestrated goals.
Local commits only, no push; unrelated edits preserved; cheap provider mocked; settings guide: docs/orch/updates.md.
