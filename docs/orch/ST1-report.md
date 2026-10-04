ST1: merged docs/orchestrator-os-research (c46e5c4), then implemented dispatcher steering.
agy/Claude use supervisor-owned private stdin FIFOs with NDJSON live user messages.
Codex app-server/daemon/proxy help succeeded; exec thread ownership unverified, so queue fallback retained.
Cursor/Codex queued messages resume the exact session after done/failed; --now verifies stop then resumes.
FIFO order, goal grants, writer/session leases and shared maximum two automatic resumes are enforced.
Durable delivery claims prevent duplicate replay after crash/reboot; ambiguous delivery stays unconfirmed.
Queued messages, steering mode and holds appear in status.json, web and pane; pane copies steer commands.
Validation: node --test scripts/orch/*.test.mjs (105/105); pane tests (8/8); plugin validation passed.
Live services checkout and real model sessions were not changed; pre-existing untracked docs preserved.
