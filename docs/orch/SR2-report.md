# SR2 — Automatic Claude parent recovery

① What
- After worker reconciliation, recover.mjs requests the configured parent in background at LOW.
- Exact launch: `claude --bg --resume <id> --effort low` plus the owner's exact Spot prompt.
- Installed `claude --help` and Claude CAPABILITIES.md confirm background resume; no fallback needed.
- Parent ID 6f0343ba-6f5e-4731-a94d-1256048ae265 already existed and was preserved.

② How / verification
- Shared recovery/parent/session leases exclude concurrent writers; registry binding stays unchanged.
- Native `claude agents --json` and exact /proc argv checks exclude existing Claude owners.
- Durable `parent_auto_resume` reservation permits one launch attempt per boot, including failures/crashes.
- `~/.config/orch/no-claude-autoresume` opts out; summary records command, output, holds and attach command.
- `node --test scripts/orch/*.test.mjs`: 82 passed, 0 failed; fake Claude covers guards and worker-first order.
- `node --check`, `git diff --check` and file-persistence verification passed.

③ Issues / operating state
- No real Claude launch or reboot exercised; parent was live in native session discovery.
- No units changed or services restarted; collector, server and preemption watcher remain active.
- Local commit only, no push; unrelated pre-existing research changes preserved.
