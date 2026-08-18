# WI-548 Host capability matrix

Legend:

- **native** — host primitive exists and is the intended path
- **adapter-backed** — portable outcome is delivered through an svc adapter
- **unsupported** — no honest path; must emit an explicit blocker
- **mandatory portable** — every host must produce this outcome, using native or adapter

AGY is a reviewer transport. It is not an orchestrator.

| Capability / portable outcome | Grok Build | Cursor CLI | AGY | Claude | Codex |
|---|---|---|---|---|---|
| Orchestrator | native (where configured) | native (where configured) | **unsupported** — reviewer only | native (where configured) | native (where configured) |
| Independent reviewer transport | adapter-backed (launch configured station) | native/adapter (Fable/Sol/subagent where configured) | **native reviewer** (Gemini via `dispatch-agy.mjs`) | native/adapter | native/adapter |
| SessionStart / install health | native hooks + adapter (`svc-session-start-healthcheck.mjs`) | adapter (`sessionStart` → same healthcheck) | unsupported | native hooks | adapter / session receipts |
| Stop / completion guard | adapter (`hooks/grok/svc-grok-task-completion-guard.sh`) — **WI-545 must make it executable** | adapter (`hooks/cursor/svc-cursor-task-completion-guard.sh`) — **WI-545** | unsupported | native Stop + `svc-task-completion-guard.sh` | adapter (`svc-codex-stop-firewall.mjs`) |
| PreTool mutation authority | adapter-backed | adapter-backed | unsupported | native PreToolUse | native/adapter dispatcher |
| Subagent / child transport | native (where configured) | native (where configured) | unsupported as general child orchestrator | native | native |
| Fresh-session launch for verify | adapter-backed **if** Grok CLI can start a session non-interactively; else unsupported+blocker | adapter-backed **if** Cursor CLI can start a session non-interactively; else unsupported+blocker. **Today: `fresh_session_launch.enabled=false`** — capability-limited blocker, never a Claude remap | unsupported | adapter-backed where CLI `-p` exists | adapter-backed where autorun exists |
| Durable receipts | **mandatory portable** via notes + WI-547 store | same | produces review bytes consumed by the store; does not own notes | same | same |
| Collision-safe multi-WI evidence | **mandatory portable** (WI-550) | same | n/a (does not write chain notes) | same | same |
| Review/audit continuity | **mandatory portable** — consume WI-547 objects without rerunning AGY | same | producer of bytes, not re-runner | consumer | consumer |
| Honest task state | **mandatory portable** — lane-tasks is index | same (no native Task UI) | unsupported | native TaskList is a mirror only | update_plan is a mirror only |
| Canonical completion validation | **mandatory portable** (WI-550 barrier) | same | unsupported | same | same |
| Post-exec / post-promo verification | **mandatory portable** | same | may supply independent review only | same | same |
| Autonomous closeout | adapter-backed via WI-552; capability-limited blocker if no launch API | same | unsupported | adapter-backed | adapter-backed |
| No false “done” on invalid receipts | **mandatory portable** | same | n/a | same | same |
| No paid-review rerun because evidence moved | **mandatory portable** (WI-547) | same | must not be invoked for relocate | same | same |
| No owner copy/paste as normal continuation | **mandatory portable** (WI-552) or explicit blocker | same | n/a | same | same |
| Shared worktree chain-policy | **mandatory portable** (WI-549) | same | n/a | same | same |
| Setup / install drift | `./setup --host grok` native target | `./setup --host cursor` native target | not an install host | `./setup --host claude` | `./setup --host codex` |
| Silent remap to Claude/Codex | **forbidden** | **forbidden** | **forbidden** | self | self |

## Unavoidable host differences (must stay explicit)

1. Grok hook schema is nested `[[hooks.<Event>]]` TOML; Cursor is `hooks.json` with exit-code-2; Claude is `settings.json` matchers; Codex uses a consolidated PreTool dispatcher. Do not unify the file formats.
2. Cursor has no matcher and no native Task UI. Observational task APIs are not required for portable outcomes.
3. AGY cannot own SessionStart, Stop, claims, or worktrees.
4. Fresh-session launch is host-specific. If the CLI cannot start a session without a human, WI-552 returns a capability-limited blocker instead of a Claude remap.
5. Owner `reviewer-policy-v2.json` currently names only `claude` and `codex` orchestrators. That is owner-external data. The framework must not invent a Grok key. Until the owner adds one, Grok reviews are native self-review plus whatever global dispatch file later names.
6. `./setup` invoked from a git worktree refuses (AP-30) unless override re-points the symlink source at the canonical checkout. Cursor live-acceptance therefore proves `./setup --host cursor` from an isolated non-worktree source copy of this tree, not by poisoning `~/.cursor/skills` from `.worktrees/`.

## Cursor fixture coverage (WI-546 / AC-546-7)

Every unavoidable Cursor difference above is covered by `test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh`. Child WIs are composed, not rewritten.

| Diff # | Cursor-specific fact | Fixture |
|---|---|---|
| 1 | `hooks.json` + exit code 2 (not TOML / not Claude matchers) | Isolated `./setup --host cursor` writes `hooks.json`; Stop adapter exits `2` on canonical receipt failure |
| 2 | No matcher; no native Task UI; lane-tasks is the index | `provision/hosts/cursor.json` `hook_quirks.tool_matcher_regex=false` and `task_graph.task_ui` contains `none`; `validate-task-graph-cross-host.sh` includes `cursor` |
| 3 | AGY is reviewer transport only | `resolve-dispatch` refuses `orchestrator=agy`; consume path for `f27a143a` does not spawn `dispatch-agy` |
| 4 | `fresh_session_launch.enabled=false` | Composed `validate-continuation-lifecycle-wi552.mjs` cursor-restart-route → `capability_limited` |
| 5 | Owner reviewer-policy is external; no invented Cursor/Grok orchestrator key | Missing `~/.svc/dispatch-policy.json` fails closed; fixture policy keeps `cursor-grok-4.6-high` with no Claude/Codex/Sonnet remap |
| 6 | Worktree setup refusal (AP-30) | Direct `./setup --host cursor` from this worktree exits non-zero without override |

## Live acceptance the final wave (WI-546) must prove

- `./setup --host grok` and `./setup --host cursor` succeed with zero drift.
- Fresh sessions load the declared adapters.
- Shared policy, task-state persistence, receipt produce/consume, review continuity, Stop/finalization, restart continuation, promotion verification, and complete closeout have equivalent fixtures.
- Real AGY bytes are consumed from Grok, Cursor, and main without rerunning AGY.
- Historical worktree removal does not invalidate evidence.
- No hidden Claude/Codex remap.
- Unsupported native behavior yields a capability-limited result.
