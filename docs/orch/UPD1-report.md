# UPD1 + follow-ups
Private ~/.config/orch/updates.json defaults exist; settings hot-reload every cycle.
Config controls event/goal filters, channels, quiet hours, digest timing/change policy; views show recent updates.
Default summary none = deterministic, zero LLM; cheap uses Cursor/Grok for digests only, never Claude.
Cheap: durable hourly cap ≤2, 15s/4KiB bounds; quota/errors retain deterministic digest; optional ntfy push.
Adopted p1b/D1a project observed completion/unknown exit with info, not blockers; false legacy labels leave views.
Parent-orchestrated unbound children/unknown Claude allowance remain info; dispatcher admission/control stays unchanged.
Validation: node --test scripts/orch/*.test.mjs 102/102; pane 10/10; syntax/persistence/diff checks pass.
Services restarted/active; live HTTP 200 verifies both adopted tasks done (unverified exit), zero blockers, mode none.
Local commits only, no push; unrelated edits preserved; cheap provider mocked; guide: docs/orch/updates.md.
