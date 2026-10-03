CP3 — feature/ho1-orchestrator-hierarchy; research already merged before edits; commit only, no push.
Supported: /orch on|off; fresh bound-parent sessions default ON; global prompt keeps keyboard/input.
Closest whole-window behavior: request 10000 pane rows/columns; engine clamps to available space.
Unsupported: fullscreen/replacement seat, transcript-container hiding, placement override; user sizes win.
Supported: terminal AssistantMessage render hiding only; Show chat/Off restores it; stored context is intact.
Unplaced/narrow auto-open keeps chat visible; engine needs explicit /orch on below its auto-open floor.
Goals → lanes → expandable tasks, owner updates, blockers/needs_owner; 60s refresh plus manual/control reads.
Stop/steer confirm or cancel; ordinary ST1 live/queue delivery and explicit stop-then-resume --now.
Controls serialize, reread status, and enforce expected attempt/session in dispatch; no automatic retry.
Parse regression: plugin loader rejects reproduced extra '<'; actual terminal paint/reload walkthrough unverified.
Green: claude plugin validate; claude plugin test 21/21; node --test scripts/orch/*.test.mjs 124/124.
Full Tier-1: 399/402; baseline docs links/receipt fixture failures; p95 failed at 106ms, passed alone at 72ms.
