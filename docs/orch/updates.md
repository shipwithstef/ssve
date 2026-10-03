# Owner update settings

The collector creates `~/.config/orch/updates.json` with private permissions and reloads it each cycle. `ORCH_CONFIG_DIR` overrides this directory. Malformed settings fall back to zero-LLM defaults.

- `events`: select `started`, `done`, `failed`, `interrupted`, `blocked`, `needs_owner`, `goal_state`. State tracking continues while events are disabled, preventing replay on re-enable.
- `digest_minutes`: positive interval; `digest_only_on_change`: suppress unchanged intervals when true.
- `channels.log`, `channels.web`, `channels.pane`: independently enable log append and update display. Views still retain task status when updates are disabled.
- `channels.ntfy_topic`: a bare ntfy.sh topic; null falls back to the optional legacy `ntfy-topic` file. Neither configured means no push.
- `quiet_hours`: null, or `{ "start": "22:00", "end": "07:00", "timezone": "UTC" }`. Start inclusive, end exclusive; supports overnight intervals. Equal times silence the full day. Suppresses pushes and model summaries, while preserving local updates.
- `goals`: `"all"`, a goal ID, or an array of goal IDs. Filters updates/digests, including visible retained history.
- `summary`: defaults to `{ "mode": "none", "cli": "cursor", "model": "grok-4.7-medium", "max_per_hour": 2 }`. Cheap mode adds one short sentence to due digests only. Cursor read-only ask mode and an explicit Grok model are required; Claude/auto routing is rejected. Limit may be lowered to 0 or 1; the rolling-hour ceiling is two across all goals, including failed calls and service restarts. Each invocation is capped at 15 seconds and 4 KiB. Quota errors, unavailable CLI, timeout, or empty output retain the deterministic digest without retries.

Unbound children intentionally use parent orchestration: their absent supervision and unknown Claude turn allowance appear under `info`, outside blockers. A bound child's missing/stale observation remains `needs_owner`; worker budget unknowns/exhaustion remain blockers. This display change does not relax dispatch admission checks.

Adopted pre-dispatcher workers are observations: recovery holds and missing exit evidence are informational, outside task/goal blockers and blocker counts. After the observed process exits, a completion report projects `done (unverified exit)`; no report projects `exited (unknown)`. Completion updates explicitly retain the unverified qualifier. Incorrect legacy adopted blocker labels are removed from retained web/pane history while the append-only log remains intact. Dispatcher ownership, recovery actions and verification are unchanged.
