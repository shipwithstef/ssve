# Claude corrections after Phase R (≤10 lines)
1. R1 (claude-code CAPABILITIES): custom mod drawings render only in the LOCAL terminal; Remote Control clients (web/mobile) receive the conversation, not the pane. Control-pane design §Surfaces assumes mobile rendering → wrong. Add a zero-LLM remote view: static HTML + status.json served on the VM over Tailscale (owner already uses Tailscale), read-only by default; steer/stop stay local or via chat.
2. Attach = `claude --resume <id>` (≥2.1.285 attaches to a live background session) + Remote Control; never two writers on one session ID (transcripts interleave).
3. Parent↔child orchestrators: ListAgents/SendMessage same-machine inbox; notify_when_idle expires 12 h → heartbeat via status.json, not messages.
4. Grok: standard 4.7 via Cursor for bounded tasks; Grok 4.7 Heavy (grok CLI) re-evaluated when its balance refreshes. No Sonnet/Claude workers.
5. Research routing: agy primary (SSVE rule), Grok via Cursor for social/X, Sol for repo/CLI probes.
