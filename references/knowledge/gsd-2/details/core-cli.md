# GSD-2 Core CLI

## Section 1: Mechanism

**Multi-mode CLI entry surface.** The `gsd` binary (`dist/loader.js`) supports six distinct execution modes, selected by CLI flags and positional arguments before the heavy Pi SDK initializes:

1. **Interactive mode** (default TTY) — TUI chat session with the agent. Entry: bare `gsd` with TTY stdin/stdout. Runs through `cli.ts` → `InteractiveMode.run()`.
2. **Headless mode** — `gsd headless [cmd] [args...]`. Spawns an RPC child process (`RpcClient`) that runs `/gsd` commands without a TUI. Auto-responds to extension UI requests, streams progress to stderr, and exits with structured codes (`0`=success, `1`=error/timeout, `10`=blocked, `11`=cancelled). Supports crash restart with exponential backoff (default max 3 restarts).
3. **Web mode** — `gsd --web [path]` or `gsd web [start] [path]`. Launches a Next.js-based browser dashboard on a reserved local port, opens the system browser with an auth token, and registers the instance in `~/.gsd/web-instances.json` for multi-project tracking.
4. **Print mode** — `gsd --print "message"` or `gsd --mode text/json/rpc/mcp`. Single-shot execution without TTY. RPC mode runs JSON-RPC over stdin/stdout; MCP mode starts an MCP server.
5. **Subcommands** — `gsd config`, `gsd update`, `gsd sessions`, `gsd worktree`, `gsd graph`, `gsd install/remove/list`. Each branches early in `cli.ts` before interactive mode initialization.
6. **Auto shorthand** — `gsd auto [args...]` with piped stdin/stdout is redirected to `gsd headless auto [args...]` so terminal emulators retain foreground ownership.

**Loader fast-path.** `loader.ts` intercepts `--version`/`-v` and `--help`/`-h` before any heavy imports (~1s avoidance). It validates Node.js version and git availability, sets critical env vars (`PI_PACKAGE_DIR`, `GSD_PKG_ROOT`, `GSD_BIN_PATH`, `GSD_WORKFLOW_PATH`, `GSD_BUNDLED_EXTENSION_PATHS`), ensures workspace package symlinks (or copies on Windows), then dynamic-imports `cli.ts`.

**Headless orchestration internals.** `headless.ts` `runHeadlessOnce()` constructs an `RpcClient` with `cliPath`, `cwd`, optional `model`, and injects `GSD_HEADLESS=1` into the child env. The child runs the full interactive agent stack; headless acts as an event consumer. It tracks:
- `tool_execution_start/end` — counts tool calls, detects interactive tools for idle-timeout arming
- `extension_ui_request` — auto-responds via `handleExtensionUIRequest()` unless `--supervised` mode forwards to orchestrator stdin/stdout
- `cost_update` — cumulative-max aggregation for batch JSON output
- `execution_complete` / terminal notifications — determines completion and exit code
- `message_update` — verbose mode streams assistant text and thinking deltas

Idle timeout defaults to 5 minutes (`IDLE_TIMEOUT_MS`), disabled for multi-turn commands (`auto`, `next`, `discuss`, `plan`). New-milestone commands get 10-minute default timeout. Auto-mode disables the overall timeout (relies on internal auto-supervisor). On SIGINT/SIGTERM, `writeSync(2, ...)` guarantees the interrupted marker reaches consumers before `process.exit(11)`.

**Web mode boot sequence.** `web-mode.ts` `launchWebMode()`:
1. Resolves host bootstrap: prefers `dist/web/standalone/server.js` (packaged), falls back to `web/package.json` (source dev).
2. Cleans up stale instances for the same `cwd` via `cleanupStaleInstance()` to prevent `EADDRINUSE`.
3. Reserves a free port via `reserveWebPort()` (binds to `127.0.0.1` by default).
4. Generates a 64-byte hex auth token (`randomBytes(32).toString('hex')`).
5. Initializes resources (`initResources(agentDir)`) so extensions are synced.
6. Spawns a detached child process (`spawnDetachedProcess()`) with `stdio: 'ignore'`, passing env vars (`HOSTNAME`, `PORT`, `GSD_WEB_AUTH_TOKEN`, `GSD_WEB_PROJECT_CWD`, etc.).
7. Polls `/api/boot` with `Accept-Encoding: identity` for up to 180s, tolerating transient 5xx (max 3 consecutive before failure).
8. Writes PID file, registers in `web-instances.json`, opens browser at `http://host:port/#token=...`.

**Worktree lifecycle (manual).** Manual worktrees are created via `gsd -w [name]` or `/worktree <name>`:
- **Create:** `createWorktree()` in `worktree-manager.ts` runs `git worktree add .gsd/worktrees/<name> -b worktree/<name>` from the detected main branch. Validates name `[a-zA-Z0-9_-]+`. Rejects unborn branches. Handles stale branch reuse with ancestry guard. Post-create hook (`runWorktreePostCreateHook()`) copies `.env`, symlinks assets if configured.
- **Switch/Resume:** `handleWorktreeFlag()` in `worktree-cli.ts` auto-commits dirty work on the current branch, `chdir()` into the worktree, sets `GSD_CLI_WORKTREE` and `GSD_CLI_WORKTREE_BASE` env vars. If multiple active worktrees exist, lists them and exits.
- **Merge:** `handleMerge()` in `worktree-cli.ts` auto-commits dirty work, infers commit type from name, runs `mergeWorktreeToMain()` (squash merge), then `removeWorktree()`. The extension `/worktree merge` adds a deterministic squash path first; on conflict, aborts and falls back to LLM-guided merge via `pi.sendMessage()` with a populated prompt.
- **Remove:** `handleRemove()` checks for unmerged changes, requires `--force` if dirty, then `removeWorktree()` with `deleteBranch: true`. `handleClean()` removes all merged/empty worktrees.

**Worktree lifecycle (auto / milestone).** Auto-mode creates worktrees on `milestone/<MID>` branches under `.gsd/worktrees/<MID>/`:
- **State sync (project root → worktree):** `syncProjectRootToWorktree()` copies the milestone directory additively (`force: false` to protect worktree-authoritative files), force-syncs `completed-units.json`, and deletes empty `gsd.db` files to trigger rebuild.
- **State sync (worktree → project root):** `syncStateToProjectRoot()` copies `STATE.md`, milestone directory, `metrics.json`, and `runtime/units` back to the project root so crash recovery and dashboards see current state.
- **Bidirectional root state sync:** `syncGsdStateToWorktree()` copies missing root-level files (`DECISIONS.md`, `REQUIREMENTS.md`, `PROJECT.md`, `KNOWLEDGE.md`, `QUEUE.md`, etc.) and missing milestone/slice directories from main to worktree. `syncWorktreeStateBack()` copies root-level files and all milestone directories (except the one being merged) from worktree to main.
- **ASSESSMENT force-sync:** `forceOverwriteAssessmentsWithVerdict()` specifically handles the UAT stuck-loop (#2821) by scanning slice directories for `*-ASSESSMENT.md` files containing a `verdict:` YAML field and force-overwriting them into the worktree.
- **Staleness detection:** `readResourceVersion()` and `checkResourcesStale()` detect when managed resources have been updated since session start, prompting a restart.

**Git integration depth.** GSD does not use a Git library; it wraps the `git` CLI via `native-git-bridge.ts`:
- Worktree ops: `nativeWorktreeAdd`, `nativeWorktreeRemove`, `nativeWorktreePrune`, `nativeWorktreeList`
- Branch ops: `nativeBranchDelete`, `nativeBranchForceReset`, `nativeBranchExists`, `nativeIsAncestor`
- Merge ops: `nativeMergeSquash`, `nativeMergeAbort`, `nativeConflictFiles`, `nativeCheckoutTheirs`
- Commit ops: `nativeCommit`, `nativeAddAllWithExclusions`, `nativeAddPaths`, `nativeRmForce`
- Diff ops: `nativeDiffNameStatus`, `nativeDiffNumstat`, `nativeDiffContent`
- Query ops: `nativeDetectMainBranch`, `nativeGetCurrentBranch`, `nativeHasChanges`, `nativeHasMergeConflicts`, `nativeWorkingTreeStatus`, `nativeLogOneline`

All git subprocess calls set `GIT_TERMINAL_PROMPT: '0'` and `GCM_INTERACTIVE: 'Never'` to prevent interactive prompts from hanging headless/CI runs.

---

## Section 2: Analysis

**Headless as a testable RPC shell.** The headless architecture treats the full interactive agent as a child process and consumes its event stream. This is architecturally significant because it means headless mode exercises exactly the same code paths as interactive mode—there is no separate "headless agent." The only differences are: (1) TUI rendering is suppressed, (2) extension UI requests are auto-responded or forwarded, and (3) completion is detected via event patterns rather than user input. This design avoids headless-specific drift but requires robust event detection. The `isMultiTurnHeadlessCommand()` classifier (lines 95-102 in `headless.ts`) explicitly marks `auto`, `next`, `discuss`, and `plan` as multi-turn so they don't exit on the first `execution_complete` event.

**Supervised mode for orchestrator integration.** The `--supervised` flag transforms headless from an auto-responder into a request-forwarder: every interactive UI request is serialized as JSONL to stdout, and the orchestrator responds via stdin. This enables external systems (CI platforms, multi-agent orchestrators) to inject decisions without pre-baking answer files. The response timeout (default 30s) with fallback to auto-response provides resilience against slow or disconnected orchestrators.

**Web mode as a detached sidecar.** Unlike headless, which is synchronous (blocks until completion), web mode spawns a detached long-lived server process and immediately exits the CLI. The CLI only orchestrates launch and stop; the server runs independently. The multi-instance registry (`web-instances.json`) allows `gsd web stop --all` to clean up a fleet of servers across projects. The auth token is passed in the URL fragment (`#token=...`) so it is not sent to the server in HTTP headers on navigation, but is available to client-side JS.

**Worktree state sync as a distributed-systems problem.** The auto-worktree system has to solve a two-copy consistency problem between the project root and the worktree, where `.gsd/` may be a symlink (shared) or a real directory (separate). The `isSamePath()` helper using `realpathSync` detects the symlink case and skips all copies. When separate, the sync logic must be direction-aware:
- **Forward sync (main → worktree)** is mostly additive (`force: false`) because the worktree is the execution context of truth. But `completed-units.json` and ASSESSMENT files with verdicts must override because the project root may have newer completion state after crash recovery or UAT retry.
- **Back sync (worktree → main)** is mostly overwriting (`force: true`) because the worktree holds the latest execution artifacts. But the current milestone being merged is skipped to avoid conflicts with the squash merge.
- **Preferences are never back-synced** (`PREFERENCES.md` is excluded from `ROOT_STATE_FILES`) because the project root is authoritative for user settings.

**Safety-first removal logic.** `removeWorktree()` in `worktree-manager.ts` is one of the most defensive functions in the codebase. It resolves the actual path from `git worktree list` rather than trusting computed paths (symlink shadowing), verifies containment with `isInsideWorktreesDir()` both before and after symlink resolution, handles submodule rescue branches, nested `.git` cleanup, and has a three-stage removal attempt: non-force git remove → force git remove → manual `.git/worktrees/<name>` metadata deletion + `rmSync`. This reflects lessons from real data-loss incidents (#2365, #2616, #2821).

**MCP as a thin protocol adapter.** `mcp-server.ts` is deliberately minimal: it creates an MCP `Server`, maps `ListToolsRequestSchema` to the agent's tool registry, and maps `CallToolRequestSchema` to `tool.execute()` with AbortSignal threading. The `isPlainObject()` guard (prototype-chain check) ensures only true JSON objects flow into `structuredContent`, preventing Date/URL/Map/class instances from violating the MCP protocol contract. This is mirrored in `packages/mcp-server/src/workflow-tools.ts` for the workflow path.

---

## Section 3: L4 Pointers

### CLI Entry Branching (`cli.ts`)
- **Line 144** — `const cliFlags = parseCliArgs(process.argv)` — all flag parsing happens before any SDK import.
- **Lines 152-159** — `--help`/`-h` interception for subcommand-specific help via `printSubcommandHelp()`.
- **Lines 213-217** — `gsd update` early branch: bypasses `exitIfManagedResourcesAreNewer` so a version-mismatched binary can still upgrade.
- **Lines 222-295** — `gsd graph` subcommand branch (`build`, `status`, `query`, `diff`) using `@gsd-build/mcp-server`.
- **Lines 306-321** — Package commands (`install`, `remove`, `list`) branch via `runPackageCommand()`.
- **Lines 324-330** — `gsd config` branch replays onboarding wizard.
- **Lines 333-356** — `gsd web stop` and `gsd --web` branches via `runWebCliBranch()`.
- **Lines 359-423** — `gsd sessions` branch: lists sessions, interactive numeric picker via `readline`, sets `cliFlags.continue` and `cliFlags._selectedSessionPath`.
- **Lines 425-435** — `gsd headless` branch: syncs resources, imports `runHeadless`, parses args, exits.
- **Lines 442-448** — `runHeadlessFromAuto()` shared helper for auto-shorthand redirect.
- **Lines 461-463** — Auto-to-headless redirect: `shouldRedirectAutoToHeadless()` checks `messages[0] === 'auto'` and TTY state.
- **Lines 468-490** — `gsd worktree` / `gsd wt` subcommands: `handleList`, `handleMerge`, `handleClean`, `handleRemove`.
- **Lines 622-722** — Print/subagent mode branch: creates session, applies `--model` override, branches to `runRpcMode`, `startMcpServer`, or `runPrintMode`.
- **Lines 727-730** — `-w` flag: `handleWorktreeFlag(cliFlags.worktree)`.
- **Lines 735-741** — Worktree status banner on normal launch: `showWorktreeStatusBanner(process.cwd())`.
- **Lines 746-881** — Interactive mode branch: overlap resource loading with session setup, scoped model restoration, welcome screen, `InteractiveMode.run()`.

### Headless Deep Dives (`headless.ts`)
- **Lines 66-84** — `HeadlessOptions` interface: `timeout`, `json`, `outputFormat`, `model`, `command`, `commandArgs`, `context`, `contextText`, `auto`, `verbose`, `maxRestarts`, `supervised`, `responseTimeout`, `answers`, `eventFilter`, `resumeSession`, `bare`.
- **Lines 147-232** — `parseHeadlessArgs()` — strict validation of `--timeout`, `--output-format`, `--max-restarts`, `--response-timeout`.
- **Lines 238-266** — `runHeadless()` restart loop with `Math.min(5000 * restartCount, 30_000)` backoff.
- **Lines 268-990** — `runHeadlessOnce()`:
  - **Lines 348-353** — `query` command: read-only state snapshot, no RPC child.
  - **Lines 355-377** — `doctor` command: runs `runGSDDoctor()` directly, bypasses restart loop.
  - **Lines 404-448** — `RpcClient` construction with `GSD_HEADLESS=1` env injection.
  - **Lines 458-476** — `trackEvent()` keeps last 20 events for diagnostics.
  - **Lines 528-770** — `client.onEvent()` handler: tracks tool calls, manages idle timer, handles answer injection, formats progress, detects completion.
  - **Lines 697-707** — `execution_complete` handling for non-multi-turn commands.
  - **Lines 709-759** — `extension_ui_request` handling: blocked notification detection, milestone-ready detection, answer injector, supervised mode timeout.
  - **Lines 772-811** — SIGINT/SIGTERM handler with `process.prependListener` to beat Pi's LSP handler, `writeSync(2, ...)` for guaranteed output.
  - **Lines 813-829** — `client.start()` and v2 protocol init.
  - **Lines 834-853** — `--resume` session resolution via `resolveResumeSession()`.
  - **Lines 913-938** — Auto-mode chaining after `new-milestone` with `--auto`.
  - **Lines 986-989** — Returns `{ exitCode, interrupted }` for the restart loop decision.

### Web Mode Deep Dives (`web-mode.ts`)
- **Lines 32-42** — `WebModeLaunchOptions`: `cwd`, `projectSessionsDir`, `agentDir`, `packageRoot`, `host`, `port`, `allowedOrigins`.
- **Lines 293-328** — `resolveWebHostBootstrap()`: checks `dist/web/standalone/server.js` first, then `web/package.json`.
- **Lines 330-350** — `reserveWebPort()`: binds to `127.0.0.1`, returns ephemeral port.
- **Lines 418-454** — `requestLocalJson()`: Node `http` client with `Accept-Encoding: identity` and optional auth token.
- **Lines 456-521** — `waitForBootReady()`: polls `/api/boot` every 250ms, 180s timeout, 3 consecutive 5xx tolerance, heartbeat dots every 5s.
- **Lines 529-545** — `cleanupStaleInstance()`: kills prior PID for same cwd before reserving port.
- **Lines 547-736** — `launchWebMode()` full sequence with `emitLaunchStatus()` structured logging.
- **Lines 198-256** — `stopWebMode()` supports `options.all`, `options.projectCwd`, and legacy PID-file fallback.

### Worktree CLI (`worktree-cli.ts`)
- **Lines 99-126** — `loadExtensionModules()`: dynamically imports `worktree-manager.ts`, `auto-worktree.ts`, `native-git-bridge.ts`, `git-service.ts`, `worktree.ts` via jiti.
- **Lines 144-178** — `getWorktreeStatus()`: computes `filesChanged`, `linesAdded`, `linesRemoved`, `uncommitted`, `commits` per worktree.
- **Lines 222-284** — `handleMerge()` → `doMerge()`: auto-commit dirty work, infer commit type, squash-merge, remove worktree + branch.
- **Lines 288-314** — `handleClean()`: removes worktrees with zero changes and no uncommitted work.
- **Lines 318-345** — `handleRemove()`: guards against removing worktrees with unmerged changes unless `--force`.
- **Lines 379-439** — `handleWorktreeFlag()`: `-w` with no name resumes single active worktree, lists multiples, or creates auto-named worktree. `-w <name>` creates or resumes named worktree.
- **Lines 442-462** — `createAndEnter()`: calls `createWorktree()`, runs post-create hook, `chdir()`, sets `GSD_CLI_WORKTREE` and `GSD_CLI_WORKTREE_BASE`.

### Worktree Manager (`worktree-manager.ts`)
- **Lines 111-125** — `resolveGitDir()`: handles normal repo `.git` directory vs worktree `.git` file containing `gitdir:` pointer.
- **Lines 147-154** — `isInsideWorktreesDir()`: uses `realpathSync` and prefix check for containment safety.
- **Lines 175-206** — `resolveCanonicalMilestoneRoot()`: routes validators to live worktree when `.git` file is present; records telemetry via `emitCanonicalRootRedirect()`.
- **Lines 216-314** — `createWorktree()`: name validation, stale directory cleanup, unborn-branch guard, ancestry guard for force-reset, branch reuse with `reuseExistingBranch`.
- **Lines 320-400** — `listWorktrees()`: parses `nativeWorktreeList()`, filters to `.gsd/worktrees/`, handles branch naming `worktree/` and `milestone/` prefixes, resolves symlinks.
- **Lines 423-474** — `findNestedGitDirs()`: BFS scan (depth ≤ 10) skipping `node_modules`, `.gsd`, `dist`, etc.; detects `.git` directories (not files) indicating scaffolded nested repos.
- **Lines 480-675** — `removeWorktree()`: git-reported path resolution, double containment check, cwd escape, submodule rescue branch creation, nested `.git` removal, three-stage removal (non-force → force → metadata + rmSync), branch cleanup.
- **Lines 741-750** — `diffWorktreeGSD()`: diff restricted to `.gsd/` between worktree branch and main.
- **Lines 758-767** — `diffWorktreeAll()`: full repo diff excluding runtime/skip paths.
- **Lines 834-853** — `mergeWorktreeToMain()`: requires current branch === main, runs `nativeMergeSquash()`, commits with provided message.

### Auto-Worktree (`auto-worktree.ts`)
- **Lines 128-165** — `popStashByRef()`: targeted stash pop using marker string to avoid concurrent stash collisions (#4980 HIGH-6).
- **Lines 206-249** — `forceOverwriteAssessmentsWithVerdict()`: walks slice dirs for `*-ASSESSMENT.md`, copies if source contains `verdict:` (#2821 fix).
- **Lines 344-428** — `syncProjectRootToWorktree()`: additive milestone copy (`force: false`), force `completed-units.json`, force ASSESSMENT sync, empty `gsd.db` deletion with WAL/SHM sidecar cleanup.
- **Lines 436-477** — `syncStateToProjectRoot()`: copies `STATE.md`, milestone dir, `metrics.json`, `runtime/units` back to project root.
- **Lines 644-790** — `syncGsdStateToWorktree()`: copies missing root files (`ROOT_STATE_FILES`), preferences, and missing milestones/slices from main to worktree.
- **Lines 812-887** — `syncWorktreeStateBack()`: reconciles DB, copies root files back, syncs all non-current milestone directories.
- **Lines 530-568** — `escapeStaleWorktree()`: string-slice heuristic detects cwd inside `.gsd/worktrees/`, `chdir()` back to project root, guards against `~/.gsd` false match.
- **Lines 972-1000+** — `runWorktreePostCreateHook()`: reads `git.worktree_post_create` preference, resolves path, runs with `SOURCE_DIR` and `WORKTREE_DIR` env vars.

### Worktree Command (`worktree-command.ts`)
- **Lines 54-96** — `worktreeCompletions()`: tab-completion for `/worktree` subcommands and existing worktree names.
- **Lines 232-255** — `registerWorktreeCommand()`: registers `/worktree` and `/wt` with completions; restores `originalCwd` after `/reload`.
- **Lines 297-370** — `handleCreate()`: auto-commit before switch, post-create hook, tracks `originalCwd`, prompts to keep or clear inherited milestones.
- **Lines 372-418** — `handleSwitch()`: auto-commit before switch, `chdir()`, `nudgeGitBranchCache()`.
- **Lines 420-449** — `handleReturn()`: auto-commit before return, `clearWorktreeOriginalCwd()`, `chdir()` back.
- **Lines 553-736** — `handleMerge()`: preview with file counts and diff, confirm dialog, reconcile DB, deterministic squash, conflict → LLM fallback with `pi.sendMessage({ customType: "gsd-worktree-merge" })`.
- **Lines 738-779** — `handleRemove()`: confirm dialog, `removeWorktree()`, clear tracking if cwd changed.
- **Lines 781-833** — `handleRemoveAll()`: batch removal with per-worktree try/catch.

### Git Summary Service (`web/git-summary-service.ts`)
- **Lines 151-198** — `collectCurrentProjectGitSummary()`:
  - Detects repo via `git rev-parse --show-toplevel`.
  - Computes `repoRelativeProjectPath()` using `git rev-parse --show-prefix` or `relative()`.
  - Parses `git status --porcelain --untracked-files=all` into `GitSummaryFile[]` with staged/dirty/untracked/conflict flags.
  - Summarizes counts and truncates to `MAX_CHANGED_FILES = 25`.
  - Uses `nativeDetectMainBranch()`, `nativeGetCurrentBranch()`, `nativeHasChanges()`, `nativeHasMergeConflicts()` for aggregate flags.

### Native Git Bridge (referenced heavily, located at `src/resources/extensions/gsd/native-git-bridge.ts`)
- Exports used across worktree-manager, auto-worktree, worktree-command, git-summary-service, and worktree-cli: `nativeWorktreeAdd`, `nativeWorktreeRemove`, `nativeWorktreePrune`, `nativeWorktreeList`, `nativeBranchDelete`, `nativeBranchForceReset`, `nativeBranchExists`, `nativeMergeSquash`, `nativeMergeAbort`, `nativeCommit`, `nativeAddAllWithExclusions`, `nativeAddPaths`, `nativeRmForce`, `nativeDiffNameStatus`, `nativeDiffNumstat`, `nativeDiffContent`, `nativeLogOneline`, `nativeIsAncestor`, `nativeDetectMainBranch`, `nativeGetCurrentBranch`, `nativeHasChanges`, `nativeHasMergeConflicts`, `nativeWorkingTreeStatus`, `nativeCheckoutBranch`, `nativeCheckoutTheirs`, `nativeConflictFiles`, `nativeUpdateRef`.
