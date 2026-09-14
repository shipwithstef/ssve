# GSD Extension Core — Knowledge Extraction

## 1. Mechanism

### 1.1 Extension Entry Point (`src/resources/extensions/gsd/index.ts`)

- Exports write-gate state functions: `isDepthConfirmationAnswer`, `isDepthVerified`, `isGateQuestionId`, `isQueuePhaseActive`, `setQueuePhaseActive`, `shouldBlockContextWrite`, `shouldBlockPendingGate`, `shouldBlockPendingGateBash`, `shouldBlockQueueExecution`, `setPendingGate`, `clearPendingGate`, `getPendingGate`.

- `registerExtension(pi: ExtensionAPI)` — two-phase registration:
  1. **Phase 1 (isolated):** `registerGSDCommand(pi)` — ensures `/gsd` is available even if full bootstrap fails.
  2. **Phase 2 (full bootstrap):** `registerGsdExtension(pi)` — wrapped in try/catch so platform-specific load failures do not take out the core command.

### 1.2 Command Registration (`src/resources/extensions/gsd/commands/index.ts`)

- `registerGSDCommand(pi: ExtensionAPI)` — registers the `"gsd"` command with:
  - `description`: `GSD_COMMAND_DESCRIPTION`
  - `getArgumentCompletions`: `getGsdArgumentCompletions`
  - `handler`: disables stderr logging, awaits `handleGSDCommand(args, ctx, pi)`, restores stderr setting in finally block.

### 1.3 Core Command Handler (`src/resources/extensions/gsd/commands/handlers/core.ts`)

**Help display:**
- `showHelp(ctx, args?)` — summary mode (default) or full mode (triggered by `full`, `--full`, `all`).
  - Summary lines: quick start, visibility (status, parallel watch, notifications, visualize, queue), course correction (steer, capture, triage, undo, rethink), observability (logs, debug), setup (onboarding, setup, init, model, prefs, keys, doctor).
  - Full lines: adds workflow (templates, next, auto, stop, pause, discuss, new-milestone, new-project, quick, dispatch, parallel, workflow), shipping (ship, do, session-report, backlog, pr-branch, add-tests, eval-review, scan), maintenance (forensics, export, cleanup, worktree, migrate, remote, inspect, update, language).

**Status:**
- `handleStatus(ctx)` — opens DB via `ensureDbOpen()`, derives state, renders `GSDDashboardOverlay` TUI (90% width, 80 minWidth, 92% maxHeight, center anchor). Falls back to `formatTextStatus(state)` if TUI unavailable.
- `formatTextStatus(state: GSDState): string` — progress score, phase, active milestone/slice/task, progress counts, blockers, milestone registry with icons (complete=✓, active=▶, parked=⏸, pending=○), environment issues.

**Visualize:**
- `handleVisualize(ctx)` — opens `GSDVisualizerOverlay` TUI (80% width, 80 minWidth, 90% maxHeight, center anchor). Requires interactive terminal.

**Setup:**
- `handleSetup(args, ctx, pi?)` — sub-route dispatch:
  - `onboarding`/`wizard` → `handleOnboarding`
  - `llm`/`auth` → `handleOnboarding --step llm`
  - `search` → `handleOnboarding --step search`
  - `remote` → `handleOnboarding --step remote`
  - `model` → `handleModel`
  - `keys` → `handleKeys`
  - `prefs` → `handlePrefsWizard(ctx, "global")`
  - Bare `/gsd setup` — renders hub status (onboarding complete?, global configured?, project state, detected language) + configuration actions list.

**Model switching:**
- `handleModel(trimmedArgs, ctx, pi?)` — provider-grouped model selection UI. Supports exact match, partial match, or full interactive picker. Sets model via `pi.setModel()`, records session override via `setSessionModelOverride()`.
- `sortModelsForSelection()`, `buildProviderModelGroups()`, `selectModelByProvider()`, `resolveRequestedModel()` — helper functions for model selection.

**Mode:**
- `/gsd mode [global|project]` → `handlePrefsMode(ctx, scope)`

**Other core commands:**
- `prefs` → `handlePrefs()`
- `language` → `handleLanguage()`
- `cmux` → `handleCmux()`
- `show-config` → `GSDConfigOverlay` TUI or `formatConfigText()`
- `setup` → `handleSetup()`
- `onboarding` → `handleOnboarding()`

### 1.4 Auto Command Handler (`src/resources/extensions/gsd/commands/handlers/auto.ts`)

**Yolo flag parsing:**
- `parseYoloFlag(trimmed): { yoloSeedFile, rest }` — regex `(?:--yolo|-y)\s+(...)`, strips quotes.

**Milestone target parsing:**
- `parseMilestoneTarget(input): { milestoneId, rest }` — regex `\b(M\d+(?:-[a-z0-9]{6})?)\b`.

**Command dispatch:**
- `/gsd next [milestoneId] [--dry-run] [--verbose] [--debug]` — validates milestone exists, calls `startAutoDetached(ctx, pi, projectRoot(), verboseMode, { step: true, milestoneLock })`.
- `/gsd auto [--yolo file.md] [milestoneId] [--verbose] [--debug]` — yolo path resolves seed file, triggers headless milestone creation via `showHeadlessMilestoneCreation()` then auto-mode. Milestone lock validation.
- `/gsd stop` — if auto not active, attempts `stopAutoRemote()` to signal remote session; otherwise `stopAuto()`.
- `/gsd pause` — `pauseAuto()` if active.
- `/gsd rate` → `handleRate()`.
- Bare `/gsd` (empty) — `startAutoDetached(..., { step: true })`.

### 1.5 Workflow Command Handler (`src/resources/extensions/gsd/commands/handlers/workflow.ts`)

**Auto-active guard:**
- `requireNotAutoActive(commandName, ctx): boolean` — blocks interactive commands that mutate durable `.gsd/` state while auto-mode holds the worktree (prevents dirty-tree failures, #4704).

**Natural language routing:**
- `/gsd do <text>` → `handleDo()` (early dispatch, routes to other commands).

**Backlog:**
- `/gsd backlog ...` → `handleBacklog()`.

**Custom workflow subcommands:**
Reserved: `new`, `run`, `list`, `validate`, `pause`, `resume`, `info`, `install`, `uninstall`.

- Bare `/gsd workflow` → lists plugins via `listPluginsFormatted()`.
- `new` → redirects to `/skill create-workflow`.
- `run <name> [k=v]` → `createRun()` + `setActiveEngineId("custom")` + `startAutoDetached()`.
- `list [name]` → lists YAML runs with step counts.
- `info <name>` → `resolvePlugin()` + `formatPluginInfo()`.
- `install <source> [--project] [--name <n>]` → fetches from URL/gist/gh:, validates, previews 20 lines, installs to global or project scope.
- `uninstall <name>` → `uninstallPlugin()`, reports provenance warnings.
- `validate <name>` → reads YAML, `validateDefinition()`, reports pass/fail.
- `pause`/`resume` — custom workflow auto-mode control.
- Direct dispatch `/gsd workflow <name> [args]` → `resolvePlugin()` + `dispatchPluginByMode()`.

**Plugin modes:**
- `oneshot` → `dispatchOneshot()`
- `yaml-step` → `createRun()` + `startAutoDetached()`
- `markdown-phase` → `dispatchMarkdownPhasePlugin()` (blocks if auto active)
- `auto-milestone` → info message, use `/gsd auto` instead

**Other workflow commands:**
- `queue` → `showQueue()` (guarded against auto-active)
- `discuss` → `showDiscuss()` (guarded)
- `quick <text>` → `handleQuick()` (guarded)
- `new-milestone [--deep]` → sets planning depth, reads `headless-context.md` or `showSmartEntry()` (guarded)
- `new-project [--deep]` → `showSmartEntry()` with optional deep mode (guarded)
- `start <tpl>` → `handleStart()`
- `templates` → `handleTemplates()`
- `park [id] [reason]` → `parkMilestone()` with default-to-active logic (guarded)
- `unpark [id]` → `unparkMilestone()` with default-to-only-parked logic (guarded)

### 1.6 Escalate Command Handler (`src/resources/extensions/gsd/commands/handlers/escalate.ts`)

- `handleEscalateCommand(args, ctx, pi)` — ADR-011 Phase 2 mid-execution escalation surface.
- Requires `phases.mid_execution_escalation: true` in preferences.
- `list [--all]` — shows pending or all escalations for active milestone. Statuses: `PENDING (paused)`, `awaiting-review`, `resolved`.
- `show <taskRef>` — prints escalation artifact. TaskRef format: `Sxx/Tyy` or plain `Tyy`.
- `resolve <taskRef> <choice> [rationale...]` — resolves escalation. Choice can be option id, `accept`, or `reject-blocker`. Persisted to DB via `saveDecisionToDb()` with audit event via `emitUokAuditEvent()`. `reject-blocker` converts to blocker and triggers slice replan.

### 1.7 Natural Language Router (`src/resources/extensions/gsd/commands-do.ts`)

- `handleDo(args, ctx, pi)` — routes freeform text to correct `/gsd` subcommand.
- `ROUTES: Route[]` — 26 keyword routes (progress→status, auto→auto, stop→stop, pause→pause, history→history, doctor→doctor, clean up→cleanup, export→export, ship→ship, discuss→discuss, undo→undo, skip→skip, queue→queue, visualize→visualize, capture→capture, inspect→inspect, knowledge→knowledge, session report→session-report, backlog→backlog, pr branch→pr-branch, add tests→add-tests, next→next, migrate→migrate, steer→steer, park→park, widget→widget, logs→logs, debug→debug).
- `matchRoute(input): MatchResult | null` — longest-keyword-match wins. Strips matched keyword from input to produce remaining args.
- Falls back to `/gsd quick <args>` if no keyword match.

### 1.8 Backlog Management (`src/resources/extensions/gsd/commands-backlog.ts`)

- Items stored in `.gsd/BACKLOG.md` as markdown checklist: `- [x] 999.N — Title (note)`.
- `parseBacklog(basePath): BacklogItem[]` — regex `^-\s*\[([ x])\]\s*(999\.\d+)\s*—\s*(.+?)(?:\s*\((.+)\))?$`.
- `writeBacklog(basePath, items)` — rewrites file.
- `nextBacklogId(items): string` — `999.{max+1}`.
- Subcommands: `list`, `add <title>`, `promote <id>`, `remove <id>`. Bare argument → implicit add.
- Promote marks item done with note `promoted YYYY-MM-DD`; currently does not auto-create slice (awaiting single-writer engine).

### 1.9 Preferences Wizard (`src/resources/extensions/gsd/commands-prefs-wizard.ts`)

**Entry points:**
- `handlePrefs(args, ctx)` — dispatches to global/project wizard, import-claude, or status.
- `handlePrefsWizard(ctx, scope, prefill?, opts?)` — main TUI wizard with 16 categories.
- `handlePrefsMode(ctx, scope)` — quick mode configuration.
- `handleImportClaude(ctx, scope)` — runs Claude import flow.

**Prompt helpers:**
- `promptBoolean()`, `promptEnum()`, `promptInteger()`, `promptNumber()`, `promptString()`, `editStringListField()` — reusable TUI prompt wrappers with current-value display and validation.

**16 configuration categories:**
1. **Workflow Mode** (`configureMode`) — solo vs team. Solo: auto_push=true, push_branches=false, pre_merge_check=auto, merge_strategy=squash, isolation=worktree, unique_milestone_ids=false. Team: auto_push=false, push_branches=true, pre_merge_check=true, unique_milestone_ids=true.
2. **Models** (`configureModels`) — per-phase model selection (research, planning, discuss, execution, execution_simple, completion, validation, subagent). Provider-grouped picker. Also token_profile, service_tier, flat_rate_providers, dynamic_routing (capability_routing, escalate_on_failure, budget_pressure, cross_provider, hooks, allow_flat_rate_providers, tier_models).
3. **Timeouts** (`configureTimeouts`) — soft_timeout_minutes (20), idle_timeout_minutes (10), hard_timeout_minutes (30).
4. **Git** (`configureGit`) — main_branch, auto_push, push_branches, snapshots, remote, pre_merge_check (true/false/auto), commit_type, merge_strategy (squash/merge), isolation (worktree/branch/none), absorb_snapshot_commits, stale_commit_threshold_minutes.
5. **Skills** (`configureSkills`) — skill_discovery (auto/suggest/off), uat_dispatch, always_use_skills, prefer_skills, avoid_skills, custom_instructions, skill_rules (when/use/prefer/avoid), skill_staleness_days.
6. **Budget** (`configureBudget`) — budget_ceiling, budget_enforcement (warn/pause/halt), context_pause_threshold (0-100%).
7. **Notifications** (`configureNotifications`) — enabled, on_complete, on_error, on_budget, on_milestone, on_attention.
8. **Phases** (`configurePhases`) — skip_research, skip_reassess, skip_slice_research, skip_milestone_validation, reassess_after_slice, require_slice_discussion, mid_execution_escalation, progressive_planning.
9. **Parallelism** (`configureParallelism`) — parallel (enabled, max_workers 1-4, budget_ceiling, merge_strategy per-slice/per-milestone, auto_merge auto/confirm/manual, worker_model) and slice_parallel (enabled, max_workers).
10. **Verification** (`configureVerification`) — verification_commands, verification_auto_fix, verification_max_retries, enhanced_verification (+ pre/post/strict), safety_harness (enabled, evidence_collection, file_change_validation, evidence_cross_reference, destructive_command_warnings, content_validation, checkpoints, auto_rollback, timeout_scale_cap).
11. **Discuss** (`configureDiscuss`) — discuss_preparation, discuss_web_research, discuss_depth (quick/standard/thorough).
12. **Context & Codebase** (`configureContextCodebase`) — context_selection (full/smart), context_management (observation_masking, observation_mask_turns 1-50, compaction_threshold_percent 0.5-0.95, tool_result_max_chars 200-10000), context_window_override, codebase (exclude_patterns, max_files, collapse_threshold).
13. **Hooks** (`configureHooks`) — reactive_execution (enabled, max_parallel 1-8, subagent_model, isolation_mode same-tree), gate_evaluation (enabled, slice_gates, task_gates), post_unit_hooks[], pre_dispatch_hooks[] (name, trigger, prompt/action, enabled, model).
14. **UoK** (`configureUoK`) — enabled, legacy_fallback, gates, model_policy, execution_graph, audit_unified, plan_v2, gitops (enabled, turn_action commit/snapshot/status-only, turn_push).
15. **Integrations** (`configureIntegrations`) — language, search_provider (auto/brave/tavily/ollama/native), cmux (enabled, notifications, sidebar, splits, browser), remote_questions (channel, channel_id, timeout_minutes 1-30, poll_interval_seconds 2-30), github (enabled, repo, project, labels, auto_link_commits, slice_prs).
16. **Advanced** (`configureAdvanced`) — unique_milestone_ids, auto_visualize, auto_report, forensics_dedup, show_token_cost, min_request_interval_ms, widget_mode (full/small/min/off), experimental.rtk.

**Serialization:**
- `serializePreferencesToFrontmatter(prefs): string` — ordered keys, YAML-safe string quoting, omits empty arrays/objects to avoid parse/serialize cycle bugs.
- `writePreferencesFile(path, prefs, ctx, opts)` — single source of truth for writing PREFERENCES.md. Preserves body after frontmatter.
- `ensurePreferencesFile(path, ctx, scope)` — creates from template if missing.
- `handleLanguage(args, ctx)` — sets/clears global language preference.

### 1.10 Bootstrap Registration (`src/resources/extensions/gsd/bootstrap/register-extension.ts`)

- `registerGsdExtension(pi: ExtensionAPI)` — wires all GSD capabilities:
  - `registerLazyWorktreeCommands(pi)` — lazy-loaded worktree commands.
  - `registerExitCommand(pi)` — exit command.
  - Hook emitter bridge: `import("../hook-emitter.js").then(({ setHookEmitter }) => setHookEmitter(pi))`.
  - EPIPE guard: `installEpipeGuard()` — handles `uncaughtException` and `unhandledRejection`.
    - `handleRecoverableExtensionProcessError(err): boolean` — EPIPE → exit(0); ENOENT spawn → log and return true; ENOENT uv_cwd → log and return true.
  - Registers `"kill"` command: immediate `process.exit(0)`.
  - Non-critical registrations (wrapped individually so one failure does not prevent others):
    1. `dynamic-tools` → `registerDynamicTools(pi)`
    2. `db-tools` → `registerDbTools(pi)`
    3. `journal-tools` → `registerJournalTools(pi)`
    4. `query-tools` → `registerQueryTools(pi)`
    5. `memory-tools` → `registerMemoryTools(pi)`
    6. `exec-tools` → `registerExecTools(pi)`
    7. `shortcuts` → `registerShortcuts(pi)`
    8. `cmux-events` → `initCmuxEventListeners(pi.events)` (synchronous — see import comment)
    9. `hooks` → `registerHooks(pi, ecosystemHandlers)`
    10. `ecosystem` → `loadEcosystemExtensions(pi, ecosystemHandlers)` (async, catches errors)

### 1.11 System Context Injection (`src/resources/extensions/gsd/bootstrap/system-context.ts`)

- `buildBeforeAgentStartResult(event, ctx): Promise<{ systemPrompt, message? } | undefined>` — main context injection hook.

**Injection pipeline (stable prefix, cached):**
1. `systemContent` — loaded from `system` prompt template via `loadPrompt("system", { bundledSkillsTable, templatesDir, shortcutDashboard, shortcutShell })`.
2. `preferenceBlock` — rendered preferences from `loadEffectiveGSDPreferences()` + `resolveAllSkillReferences()`.
3. `knowledgeBlock` — global (`~/.gsd/agent/KNOWLEDGE.md`) + project (`.gsd/KNOWLEDGE.md`). Warns if global > 4KB.
4. `memoryBlock` — ADR-013 critical + query-relevant memories. Critical categories: `gotcha`, `environment`, `convention`, `architecture`. Critical cap: 8. Query k: 10. Char budget: 4000.
5. `codebaseBlock` — `.gsd/CODEBASE.md`, capped to ~8000 chars (~2000 tokens). Auto-refreshed when tracked file changes detected.
6. `newSkillsBlock` — newly discovered skills since last session.
7. `worktreeBlock` — active worktree context (overrides cwd). Supports both manual worktrees and auto-worktrees.
8. `subagentModelBlock` — `resolveModelWithFallbacksForUnit("subagent")` config, instructs explicit `model` parameter on subagent tool calls.

**Volatile suffix (context message, not cached):**
- `buildContextMessage({ memoryBlock, injection, forensicsInjection })` — priority: guided > forensics > memory-only.
- `buildGuidedExecuteContextInjection(prompt, basePath)` — detects:
  - `Execute the next task: T### ("...") in slice S## of milestone M###` → full task execution context.
  - `Resume interrupted work...` → resume context with active task.
  - Low-entropy resume patterns (`continue`, `resume`, `ok`, `go`, `next`, `yes`, etc.) during executing phase → task execution context (#3615).
- `buildTaskExecutionContextInjection()` — inlines task plan, slice plan excerpt, carry-forward lines from prior task summaries, resume state from CONTINUE.md, active overrides.
- `buildForensicsContextInjection()` — re-injects forensics marker on follow-up turns (expires after 2 hours, only for resume-intent prompts, #2941).

**Bundled skill triggers:**
- `BUNDLED_SKILL_TRIGGERS: Array<{ trigger, skill }>` — 35 entries. Dynamically resolved at runtime via `resolveSkillReference()`. Uninstalled skills are omitted from prompt (#3575).

**cmux auto-enable:**
- `shouldPromptToEnableCmux()` + `autoEnableCmuxPreferences()` — auto-enables cmux if detected.

**ADR-013 backfill:**
- `backfillDecisionsToMemories()` — idempotent absorption of decisions table into memory store.

### 1.12 Event Hooks (`src/resources/extensions/gsd/bootstrap/register-hooks.ts`)

**session_start:**
- Initializes notification store, notify interceptor, notification widget.
- Initializes health widget (if not auto-active).
- Resets write gate state, tool call loop guard, approval abort flag.
- Resets ask_user_questions turn cache.
- Syncs service tier status.
- Applies disabled model provider policy.
- Skips MCP auto-prep inside auto-worktree (prevents mid-run rewrite, #4704-like issue).
- Applies `show_token_cost` preference to `process.env.GSD_SHOW_TOKEN_COST`.
- Prints welcome screen on non-first sessions (after /clear).
- Loads tool API keys.

**session_switch:**
- Same as session_start but re-prints welcome screen is skipped.
- Skips MCP auto-prep in auto-worktree.

**before_agent_start:**
- Waits for ecosystem loader ready promise.
- Handles explicit approval responses (`isExplicitApprovalResponse`) → marks gate verified, clears pending gate.
- Calls `buildBeforeAgentStartResult()` for GSD context injection.
- Refreshes ecosystem snapshot via `deriveState()` + `updateSnapshot()`.
- Chains ecosystem handlers (each sees systemPrompt mutated by prior handlers).

**agent_end:**
- Resets approval abort flag, tool call loop guard, ask_user_questions cache.
- Calls `handleAgentEnd()` for recovery logic.

**turn_end:**
- `cleanupQuickBranch()` — squash-merges quick-task branch (#2668).

**session_before_compact (handler 1):**
- Cancels compaction if auto-mode is actively running.
- Otherwise, writes CONTINUE.md checkpoint for active milestone/slice/task in any phase (not just executing, #4258).

**session_before_compact (handler 2):**
- Context-mode snapshot: writes `.gsd/last-snapshot.md` if `context_mode.enabled` is true.

**message_update:**
- Detects approval-question messages and sets pending gate. Pauses before more tool calls run.
- Does NOT abort in-flight stream (avoids eating question text on external CLI providers).

**session_shutdown:**
- Shuts down parallel orchestrator if active.
- Saves activity log if auto-mode has a current unit.

**tool_call (handler 1 — guards):**
- Loop guard: `checkToolCallLoop()` blocks repeated identical tool calls (>4 consecutive, >1 for ask_user_questions).
- Discussion gate tracking: sets pending gate when `ask_user_questions` has gate-shaped question ID.
- Pending gate blocking: blocks all non-read-only tools while gate pending. Bash has separate `shouldBlockPendingGateBash()`.
- Queue mode blocking (`isQueuePhaseActive`): blocks write/edit/bash to non-`.gsd/` paths.
- Planning-unit tools-policy enforcement (`shouldBlockPlanningUnit`): blocks writes outside `.gsd/`, non-read-only bash, subagent dispatch based on active unit's manifest.
- Single-writer engine: blocks direct writes to STATE.md via write/edit/bash.
- Context write gate: `shouldBlockContextWrite()` blocks CONTEXT.md writes without depth verification.

**tool_call (handler 2 — safety):**
- Records tool start via `markToolStart()` and `safetyRecordToolCall()`.
- Persists evidence to disk immediately at dispatch (prevents race with mid-unit re-dispatch, #4385).
- Destructive command classification (`classifyCommand()`): warns only, never blocks.

**tool_result:**
- Marks tool end. Records tool invocation errors.
- Discussion gate handling: if cancelled/no response, returns HARD BLOCK text. If answered with confirmation option, marks gate verified.
- Depth verification: unlocks gate only if user selected first option (confirmation), structurally validated against question options.
- Discussion logging: appends Q&A exchange to `<milestoneDir>/<milestoneId>-DISCUSSION.md`.

**tool_execution_start:**
- `markToolStart()` if auto-active.

**tool_execution_end:**
- `markToolEnd()`. Records invocation errors. Records tool results for evidence. Persists evidence to disk.

**model_select:**
- Syncs service tier status.

**before_provider_request:**
- Observation masking: replaces old tool results with placeholders (default keep 8 turns, opt-out via `context_management.observation_masking`).
- Tool result truncation: caps individual tool result content length (default 800 chars).
- Service tier injection: adds `service_tier` field to payload for supported models.

**before_model_select:**
- Returns undefined (no override — capability scoring handles selection, ADR-004).

**adjust_tool_set:**
- Returns undefined (no override — provider compatibility filtering handles it, ADR-005 Phase 4).

### 1.13 Keyboard Shortcuts (`src/resources/extensions/gsd/bootstrap/register-shortcuts.ts`)

- `registerShortcuts(pi: ExtensionAPI)` — registers three shortcuts with Ctrl+Shift fallbacks where needed:
  - **Dashboard**: `Ctrl+Alt+G` (+ `Ctrl+Shift+G` fallback). Opens `GSDDashboardOverlay`. Checks `.gsd` exists.
  - **Notifications**: `Ctrl+Alt+N` (+ `Ctrl+Shift+N` fallback). Opens `GSDNotificationOverlay` (80% width, backdrop).
  - **Parallel**: `Ctrl+Alt+P`. Opens `ParallelMonitorOverlay`. No Ctrl+Shift fallback (conflicts with cycleModelBackward).

### 1.14 Exec Tools (`src/resources/extensions/gsd/bootstrap/exec-tools.ts`)

- `registerExecTools(pi: ExtensionAPI)` — registers three tools:
  1. **`gsd_exec`** — sandboxed script execution (bash/node/python). Full output persists to `.gsd/exec/<id>.{stdout,stderr,meta.json}`; digest returns in context. Parameters: runtime, script, purpose?, timeout_ms (1_000-600_000). Opt-in via `context_mode.enabled`.
  2. **`gsd_exec_search`** — search prior gsd_exec runs. Parameters: query?, runtime?, failing_only?, limit (1-200). Read-only.
  3. **`gsd_resume`** — reads `.gsd/last-snapshot.md` (≤2 KB digest for post-compaction re-orientation).

### 1.15 Memory Tools (`src/resources/extensions/gsd/bootstrap/memory-tools.ts`)

- `registerMemoryTools(pi: ExtensionAPI)` — registers three tools (all degrade gracefully when DB unavailable):
  1. **`capture_thought`** — records durable project knowledge. Categories: architecture, convention, gotcha, preference, environment, pattern. Parameters: category, content, confidence (0.1-0.99, default 0.8), tags?, scope?, structuredFields? (ADR-013 decision payload).
  2. **`memory_query`** — keyword-ranked memory search. Parameters: query, k (1-50), category?, scope?, tag?, include_superseded?, reinforce_hits?.
  3. **`gsd_graph`** — memory relationship graph. Modes: build (placeholder), query. Parameters: mode, memoryId?, depth (0-5), rel (related_to/depends_on/contradicts/elaborates/supersedes).

### 1.16 Query Tools (`src/resources/extensions/gsd/bootstrap/query-tools.ts`)

- `registerQueryTools(pi: ExtensionAPI)` — registers two read-only DB tools:
  1. **`gsd_milestone_status`** — reads milestone + slice + task counts from DB. Parameter: milestoneId.
  2. **`gsd_checkpoint_db`** — flushes SQLite WAL into base `gsd.db`. Safe to call anytime. No parameters.

### 1.17 Journal Tools (`src/resources/extensions/gsd/bootstrap/journal-tools.ts`)

- `registerJournalTools(pi: ExtensionAPI)` — registers:
  - **`gsd_journal_query`** — queries structured event journal for auto-mode iterations. Filters: flowId, unitId, rule, eventType, after, before, limit (default 100).

### 1.18 DB Tools (`src/resources/extensions/gsd/bootstrap/db-tools.ts`)

- `registerDbTools(pi: ExtensionAPI)` — registers 12 canonical tools + 12 aliases via `registerAlias()`.

**Decision & Requirements:**
- `gsd_decision_save` (alias: `gsd_save_decision`) — records decision to DB, regenerates DECISIONS.md. Auto-assigns ID. Fields: scope, decision, choice, rationale, revisable?, when_context?, made_by (human/agent/collaborative).
- `gsd_requirement_update` (alias: `gsd_update_requirement`) — updates requirement by ID. Fields: id, status?, validation?, notes?, description?, primary_owner?, supporting_slices?. Has root artifact write gate check.
- `gsd_requirement_save` (alias: `gsd_save_requirement`) — saves new requirement. Auto-assigns ID. Classes: core-capability, primary-user-loop, launchability, continuity, failure-visibility, integration, quality-attribute, operability, admin/support, compliance/security, differentiator, constraint, anti-feature. Has root artifact write gate check.

**Summary & Artifacts:**
- `gsd_summary_save` (alias: `gsd_save_summary`) — saves SUMMARY/RESEARCH/CONTEXT/ASSESSMENT/CONTEXT-DRAFT/PROJECT/PROJECT-DRAFT/REQUIREMENTS/REQUIREMENTS-DRAFT artifacts to DB + disk. Auto-computes paths.

**Milestone & Slice & Task Planning:**
- `gsd_milestone_generate_id` (alias: `gsd_generate_milestone_id`) — generates next milestone ID, respects `unique_milestone_ids`. Claims reserved IDs first. Calls `ensureMilestoneDbRow()`.
- `gsd_plan_milestone` (alias: `gsd_milestone_plan`) — writes milestone planning state to DB, renders ROADMAP.md, clears caches. Supports ADR-011 sketch slices (`isSketch`, `sketchScope`).
- `gsd_plan_slice` (alias: `gsd_slice_plan`) — writes slice planning state to DB, renders PLAN.md + task plans, clears caches.
- `gsd_plan_task` (alias: `gsd_task_plan`) — writes task planning state to DB, renders T##-PLAN.md, clears caches.

**Completion:**
- `gsd_task_complete` (alias: `gsd_complete_task`) — records completed task, renders SUMMARY.md, toggles checkbox. Supports ADR-011 Phase 2 escalation payload. Idempotent (INSERT OR REPLACE).
- `gsd_slice_complete` (alias: `gsd_complete_slice`) — records completed slice, renders SUMMARY.md + UAT.md, toggles roadmap checkbox. Validates all tasks complete.
- `gsd_complete_milestone` (alias: `gsd_milestone_complete`) — records completed milestone, renders MILESTONE-SUMMARY.md. Validates all slices complete. Requires `verificationPassed: true`.
- `gsd_validate_milestone` (alias: `gsd_milestone_validate`) — persists validation results, renders VALIDATION.md. Verdicts: pass/needs-attention/needs-remediation.

**Skip:**
- `gsd_skip_slice` — marks slice skipped, cascades non-closed tasks to skipped, rebuilds STATE.md (#3477). Skipped slices satisfy downstream dependencies.

**Alias mechanism:**
- `registerAlias(pi, toolDef, aliasName, canonicalName)` — creates alias with modified description directing LLM to prefer canonical name.

### 1.19 Dynamic Tools (`src/resources/extensions/gsd/bootstrap/dynamic-tools.ts`)

- `ensureDbOpen(basePath?): Promise<boolean>` — resolves DB path for worktrees via `resolveProjectRootDbPath()`.
  - Handles 5 path layouts: `.gsd/worktrees/`, `~/.gsd/projects/<hash>/worktrees/`, symlink-resolved variants, forward-slash variants, default.
  - Opens existing DB, or creates + auto-migrates from Markdown if `.gsd/` has content (DECISIONS.md, REQUIREMENTS.md, milestones/).

- `registerDynamicTools(pi: ExtensionAPI)` — registers four dynamic tools with `cwd: process.cwd()`:
  1. **bash** — wraps `createBashTool()` with default timeout from `DEFAULT_BASH_TIMEOUT_SECS`.
  2. **write** — wraps `createWriteTool()`, recreates fresh instance per call.
  3. **read** — wraps `createReadTool()`, recreates fresh instance per call.
  4. **edit** — wraps `createEditTool()`, recreates fresh instance per call.

### 1.20 Tool-Call Loop Guard (`src/resources/extensions/gsd/bootstrap/tool-call-loop-guard.ts`)

- `checkToolCallLoop(toolName, args): { block, reason?, count? }` — detects repeated identical tool calls within a single agent turn.
  - Hashes tool name + sorted-args via SHA-256 (first 16 chars).
  - Threshold: 4 consecutive identical calls (1 for `ask_user_questions`).
  - Resets on different tool call.
- `resetToolCallLoopGuard()` — resets state at agent turn boundaries.
- `disableToolCallLoopGuard()` — disables during shutdown.
- `getToolCallLoopCount()` — diagnostic accessor.

### 1.21 Write Gate (`src/resources/extensions/gsd/bootstrap/write-gate.ts`)

**State management:**
- `verifiedDepthMilestones: Set<string>` — milestones that passed depth verification.
- `verifiedApprovalGates: Set<string>` — approval gates that passed.
- `activeQueuePhase: boolean` — queue phase active flag.
- `pendingGateId: string | null` — currently pending discussion gate.

**Persistence:**
- `writeGateSnapshotPath(basePath): string` → `.gsd/runtime/write-gate-state.json`.
- `persistWriteGateSnapshot()` — atomic write via temp file + renameSync, with EXDEV fallback (copy+delete).
- `loadWriteGateSnapshot()` — reads persisted state or falls back to in-memory.
- `shouldPersistWriteGateSnapshot()` — ON by default; opt-out via `GSD_PERSIST_WRITE_GATE_STATE=0|false` (#4950).

**Gate question patterns:**
- `GATE_QUESTION_PATTERNS = ["depth_verification"]`
- `isGateQuestionId(questionId): boolean`
- `extractDepthVerificationMilestoneId(questionId): string | null` — regex `depth_verification[_-](M\d+(?:-[a-z0-9]{6})?)`

**Depth verification:**
- `isDepthVerified(): boolean`
- `isMilestoneDepthVerified(milestoneId): boolean`
- `markDepthVerified(milestoneId)` — adds to set + persists.

**Approval gate:**
- `markApprovalGateVerified(gateId)` — adds to set + persists.
- `isApprovalGateVerifiedInSnapshot(snapshot, gateId)`

**Pending gate:**
- `setPendingGate(gateId)` — sets pending, removes from verified sets, persists.
- `clearPendingGate()` — clears, persists.
- `getPendingGate()` — accessor.

**Blocking predicates:**
- `shouldBlockPendingGate(toolName, milestoneId, queuePhaseActive?)` — blocks all tools except `ask_user_questions` while gate pending.
- `shouldBlockPendingGateBash(command, milestoneId, queuePhaseActive?)` — blocks all bash while gate pending.
- `shouldBlockContextWrite(toolName, inputPath, milestoneId, queuePhaseActive?)` — blocks `write` to `M###-CONTEXT.md` unless milestone is depth-verified. Returns HARD BLOCK with mechanical gate message.
- `shouldBlockContextArtifactSave(artifactType, milestoneId, sliceId?)` — blocks `gsd_summary_save` with `artifact_type: "CONTEXT"` at milestone level unless depth-verified. Slice-level CONTEXT is allowed.
- `shouldBlockRootArtifactSaveInSnapshot(snapshot, artifactType, opts?)` — blocks PROJECT.md and REQUIREMENTS.md writes. Requires no pending gate. With `requireVerifiedApproval: true`, requires explicit gate verification (fail-closed for deep mode).
- `shouldBlockQueueExecution(toolName, input, queuePhaseActive?)` — queue mode guard (#2545). Allows read-only tools, write/edit to `.gsd/`, read-only bash. Blocks everything else.

**Planning-unit tools-policy enforcement (#4934):**
- `shouldBlockPlanningUnit(toolName, pathOrCommand, basePath, unitType, policy, agentClasses?)` — manifest-driven tool restriction.
  - Modes: `all` (pass), `read-only` (blocks writes/bash/subagent), `planning` (blocks writes outside `.gsd/`, non-read-only bash, subagent), `planning-dispatch` (like planning but permits read-only specialist subagents), `docs` (like planning + allowedPathGlobs).
  - `PLANNING_SAFE_TOOLS`: read, grep, find, ls, glob, ask_user_questions, web search tools.
  - `ALLOWED_PLANNING_DISPATCH_AGENTS`: scout, planner, reviewer, security, tester.
  - Stale callers (undefined agentClasses) fail closed with warning (#5060).

**Depth confirmation validation:**
- `isDepthConfirmationAnswer(selected, options?): boolean` — structurally validates that selected exactly matches the first option label (confirmation). Rejects free-form "Other" text. Fail-closed when no options available.

### 1.22 Provider Error Resume (`src/resources/extensions/gsd/bootstrap/provider-error-resume.ts`)

- `resumeAutoAfterProviderDelay(pi, ctx, deps?): Promise<"resumed" | "already-active" | "not-paused" | "missing-base">`
  - Reads auto dashboard snapshot via `getSnapshot()`.
  - Returns `"already-active"` if auto active; `"not-paused"` if not paused.
  - Resets transient retry state via `resetTransientRetryState()`.
  - Calls `startAuto()` with preserved `stepMode`.
  - Session-creation timeout state intentionally survives to prevent infinite pause/resume loops.

---

## 2. Analysis

### 2.1 Two-Phase Extension Registration
The GSD extension uses a defensive two-phase bootstrap: Phase 1 registers `/gsd` in isolation so the command is available even if Phase 2 (tools, shortcuts, hooks) fails due to platform-specific import errors. This is a reliability pattern — the core escape hatch (`/gsd`) must always work.

### 2.2 Write Gate as a Mechanical Safety Layer
The write-gate system (`write-gate.ts`) is not a suggestion — it is a **mechanical block** that the model cannot rationalize past. Key design decisions:
- **Fail-closed**: `isDepthConfirmationAnswer` returns false when options are unavailable, preventing free-form text from unlocking gates.
- **Persistent**: Gate state is written to `.gsd/runtime/write-gate-state.json` by default (opt-out via env var), surviving session restarts.
- **Composable**: Multiple guards stack (pending gate → queue mode → planning-unit policy → context write → root artifact), each with independent logic.
- **HARD BLOCK messaging**: Every blocked response includes explicit instructions to re-ask, not to proceed or retry.

### 2.3 Planning-Unit Tools-Policy as Manifest-Driven Sandbox
The `#4934` enforcement is a declarative sandbox: each unit type's manifest declares a `ToolsPolicy` (mode + allowedSubagents + allowedPathGlobs), and the `tool_call` hook enforces it at runtime. This closes the "b23 bug class" where a discuss-milestone LLM used Edit to modify user source files. The policy modes form a lattice: `all` > `docs` > `planning-dispatch` > `planning` > `read-only`.

### 2.4 Context Injection Split for Cache Efficiency
`system-context.ts` splits context into a **stable cached prefix** (system prompt, preferences, knowledge, codebase, worktree, subagent model config) and a **volatile suffix** (memory block, guided execute context, forensics) delivered as a user-message context payload. This preserves the system+tools cache hit across turns (#5019).

### 2.5 Auto-Mode Guard Points
Multiple handlers check `isAutoActive()` to prevent destructive concurrent operations:
- `requireNotAutoActive()` in workflow.ts blocks `/gsd do`, `/gsd backlog`, `/gsd queue`, `/gsd discuss`, `/gsd quick`, `/gsd park`, `/gsd unpark`.
- `message_update` hook sets approval gates for unit-type questions.
- `session_before_compact` cancels compaction while auto active.
- Safety harness only collects evidence during auto-mode.

### 2.6 Tool Alias Strategy
The DB tools use canonical names (`gsd_decision_save`) with aliases (`gsd_save_decision`). The alias registration adds a suffix to the description directing the LLM to prefer the canonical name. This allows backward compatibility while steering the model toward the preferred API surface.

### 2.7 Escalation as Structured Pause
ADR-011 Phase 2 introduces mid-execution escalation: when the executor hits ambiguity, it can pause auto-mode with a structured question (2-4 options + recommendation). The user resolves via `/gsd escalate resolve`. Unlike ad-hoc questions, escalations are persisted to the DB as decisions with audit trails, and `reject-blocker` converts to a replan trigger.

### 2.8 Preferences as Frontmatter-Driven Configuration
The preferences system uses YAML frontmatter in `PREFERENCES.md` files (global at `~/.gsd/PREFERENCES.md`, project at `.gsd/PREFERENCES.md`). The wizard mutates a JS object, then serializes via `serializePreferencesToFrontmatter()` with ordered keys and YAML-safe string quoting. Empty arrays/objects are omitted to avoid parse/serialize drift. The body after frontmatter is preserved so user notes survive edits.

### 2.9 Ecosystem Handler Chaining
The `before_agent_start` hook implements a chaining protocol for ecosystem extensions: each handler receives the systemPrompt mutated by prior handlers, and the final result is composed. This allows third-party extensions to inject context without replacing GSD's injection.

---

## 3. L4 Pointers

- Extension entry point: `src/resources/extensions/gsd/index.ts` — `registerExtension()`, re-exports write-gate state functions
- Command registration: `src/resources/extensions/gsd/commands/index.ts` — `registerGSDCommand()`
- Core command handler: `src/resources/extensions/gsd/commands/handlers/core.ts` — `handleCoreCommand()`, `showHelp()`, `handleStatus()`, `handleSetup()`, `handleModel()`, `formatTextStatus()`
- Auto command handler: `src/resources/extensions/gsd/commands/handlers/auto.ts` — `handleAutoCommand()`, `parseYoloFlag()`, `parseMilestoneTarget()`
- Workflow command handler: `src/resources/extensions/gsd/commands/handlers/workflow.ts` — `handleWorkflowCommand()`, `handleCustomWorkflow()`, `dispatchPluginByMode()`, `requireNotAutoActive()`, `parseWorkflowRunArgs()`, `parseWorkflowOverridesOnly()`
- Escalate command handler: `src/resources/extensions/gsd/commands/handlers/escalate.ts` — `handleEscalateCommand()`, `formatListEntries()`, `parseTaskRef()`, `locateRow()`
- Natural language router: `src/resources/extensions/gsd/commands-do.ts` — `handleDo()`, `matchRoute()`, `ROUTES[]`
- Backlog management: `src/resources/extensions/gsd/commands-backlog.ts` — `handleBacklog()`, `parseBacklog()`, `writeBacklog()`, `nextBacklogId()`
- Preferences wizard: `src/resources/extensions/gsd/commands-prefs-wizard.ts` — `handlePrefsWizard()`, `handlePrefs()`, `handlePrefsMode()`, `handleImportClaude()`, `configureMode()`, `configureModels()`, `configureDynamicRouting()`, `configureGit()`, `configureSkills()`, `configureBudget()`, `configureNotifications()`, `configurePhases()`, `configureParallelism()`, `configureVerification()`, `configureDiscuss()`, `configureContextCodebase()`, `configureHooks()`, `configureUoK()`, `configureIntegrations()`, `configureAdvanced()`, `buildCategorySummaries()`, `serializePreferencesToFrontmatter()`, `writePreferencesFile()`, `ensurePreferencesFile()`, `handleLanguage()`
- Bootstrap registration: `src/resources/extensions/gsd/bootstrap/register-extension.ts` — `registerGsdExtension()`, `installEpipeGuard()`, `handleRecoverableExtensionProcessError()`
- System context injection: `src/resources/extensions/gsd/bootstrap/system-context.ts` — `buildBeforeAgentStartResult()`, `buildContextMessage()`, `loadMemoryBlock()`, `loadKnowledgeBlock()`, `buildWorktreeContextBlock()`, `buildGuidedExecuteContextInjection()`, `buildTaskExecutionContextInjection()`, `buildCarryForwardLines()`, `buildResumeSection()`, `buildForensicsContextInjection()`, `clearForensicsMarker()`, `BUNDLED_SKILL_TRIGGERS[]`
- Event hooks: `src/resources/extensions/gsd/bootstrap/register-hooks.ts` — `registerHooks()`, handlers for session_start, session_switch, before_agent_start, agent_end, turn_end, session_before_compact (×2), message_update, session_shutdown, tool_call (×2), tool_result, tool_execution_start, tool_execution_end, model_select, before_provider_request, before_model_select, adjust_tool_set
- Keyboard shortcuts: `src/resources/extensions/gsd/bootstrap/register-shortcuts.ts` — `registerShortcuts()`, dashboard/notifications/parallel overlays
- Exec tools: `src/resources/extensions/gsd/bootstrap/exec-tools.ts` — `registerExecTools()`, `gsd_exec`, `gsd_exec_search`, `gsd_resume`
- Memory tools: `src/resources/extensions/gsd/bootstrap/memory-tools.ts` — `registerMemoryTools()`, `capture_thought`, `memory_query`, `gsd_graph`
- Query tools: `src/resources/extensions/gsd/bootstrap/query-tools.ts` — `registerQueryTools()`, `gsd_milestone_status`, `gsd_checkpoint_db`
- Journal tools: `src/resources/extensions/gsd/bootstrap/journal-tools.ts` — `registerJournalTools()`, `gsd_journal_query`
- DB tools: `src/resources/extensions/gsd/bootstrap/db-tools.ts` — `registerDbTools()`, `gsd_decision_save`, `gsd_requirement_update`, `gsd_requirement_save`, `gsd_summary_save`, `gsd_milestone_generate_id`, `gsd_plan_milestone`, `gsd_plan_slice`, `gsd_plan_task`, `gsd_task_complete`, `gsd_slice_complete`, `gsd_skip_slice`, `gsd_complete_milestone`, `gsd_validate_milestone`, plus aliases via `registerAlias()`
- Dynamic tools: `src/resources/extensions/gsd/bootstrap/dynamic-tools.ts` — `registerDynamicTools()`, `ensureDbOpen()`, `resolveProjectRootDbPath()`
- Tool-call loop guard: `src/resources/extensions/gsd/bootstrap/tool-call-loop-guard.ts` — `checkToolCallLoop()`, `resetToolCallLoopGuard()`, `disableToolCallLoopGuard()`, `getToolCallLoopCount()`
- Write gate: `src/resources/extensions/gsd/bootstrap/write-gate.ts` — `shouldBlockContextWrite()`, `shouldBlockPendingGate()`, `shouldBlockPendingGateBash()`, `shouldBlockQueueExecution()`, `shouldBlockPlanningUnit()`, `shouldBlockContextArtifactSave()`, `shouldBlockRootArtifactSaveInSnapshot()`, `isDepthConfirmationAnswer()`, `isDepthVerified()`, `isMilestoneDepthVerified()`, `markDepthVerified()`, `markApprovalGateVerified()`, `setPendingGate()`, `clearPendingGate()`, `getPendingGate()`, `setQueuePhaseActive()`, `resetWriteGateState()`, `loadWriteGateSnapshot()`, `canonicalToolName()`
- Provider error resume: `src/resources/extensions/gsd/bootstrap/provider-error-resume.ts` — `resumeAutoAfterProviderDelay()`
