# GSD-2 Project Meta

## What It Is

**GSD-2** (Get Shit Done v2) is a standalone TypeScript CLI application that acts as an orchestration layer between a developer and AI coding agents. Unlike the original GSD v1 (which was a collection of markdown prompts injected into Claude Code via slash commands), GSD-2 is a full agent harness built on the **Pi SDK** (`@gsd/pi-coding-agent`). It programmatically controls context windows, manages git branches/worktrees, tracks cost and tokens, detects stuck loops, recovers from crashes, and auto-advances through milestones without human intervention.

- **Package name:** `gsd-pi` (npm)
- **Version:** `2.78.1` (`package.json` line 3)
- **License:** MIT
- **Repository:** `https://github.com/gsd-build/gsd-2.git`
- **Node.js requirement:** `>= 22.0.0` (`package.json` line 44)

## Architecture Overview

```
gsd (CLI binary → dist/loader.js)
  └─ loader.ts          Sets PI_PACKAGE_DIR, GSD env vars, dynamic-imports cli.ts
      └─ cli.ts         Wires SDK managers, loads extensions, branches by mode
          ├─ headless.ts     Headless orchestrator (spawns RPC child, auto-responds)
          ├─ web-mode.ts     Browser-based web interface launcher
          ├─ onboarding.ts   First-run setup wizard (LLM provider + tool keys)
          ├─ wizard.ts       Env hydration from stored auth.json credentials
          ├─ mcp-server.ts   MCP server over stdin/stdout
          ├─ worktree-cli.ts Standalone worktree subcommands + -w flag
          └─ src/resources/
              ├─ extensions/gsd/    Core GSD extension (auto, state, commands, worktree)
              ├─ extensions/...     21 supporting extensions
              ├─ agents/            scout, researcher, worker, javascript-pro, typescript-pro
              └─ GSD-WORKFLOW.md    Manual bootstrap protocol
```

## Key Technologies

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 22+ ESM, TypeScript 5.4+ |
| **SDK** | Pi SDK (`@gsd/pi-coding-agent`, `@gsd/pi-tui`, `@gsd/pi-ai`, `@gsd/pi-agent-core`) |
| **Build** | `tsc` + `esbuild` (native pkg), workspace-based monorepo |
| **State** | Disk-first `.gsd/` directory (Markdown + JSON + SQLite `gsd.db`) |
| **Git** | Native `git` CLI via `native-git-bridge.ts` wrappers; worktree isolation |
| **Extensions** | jiti-compiled `.ts` extensions with `extension-manifest.json` |
| **Web UI** | Next.js-based standalone server (`dist/web/standalone/server.js`) or source dev (`web/`) |
| **MCP** | `@modelcontextprotocol/sdk` over stdio |
| **Compression** | Managed RTK binary (`rtk-ai/rtk`) for shell-command output compression |
| **Native modules** | Rust N-API modules (`native/`) for grep, git, AST operations |

---

## Section 1: Mechanism

**State-machine-driven auto mode.** GSD structures work into a hierarchy: **Milestone** (4-10 slices) → **Slice** (one demoable vertical capability, 1-7 tasks) → **Task** (one context-window-sized unit of work). The iron rule: a task must fit in one context window. Auto mode (`/gsd auto`) is a state machine driven by files on disk: it reads `.gsd/STATE.md`, determines the next unit, creates a fresh agent session, pre-inlines focused context, and lets the LLM execute. When finished, it reads disk state again and dispatches the next unit.

**Fresh session per unit.** Every task, research phase, and planning step gets a clean ~200k-token context window. No accumulated garbage. The dispatch prompt includes inlined task plans, slice plans, prior summaries, dependency summaries, roadmap excerpts, and a decisions register.

**Disk as source of truth.** All durable state lives in `.gsd/`:
- `STATE.md` — quick-glance dashboard
- `PROJECT.md`, `REQUIREMENTS.md`, `DECISIONS.md`, `KNOWLEDGE.md`, `RUNTIME.md`
- `M001-ROADMAP.md`, `M001-CONTEXT.md`, `M001-RESEARCH.md`
- `S01-PLAN.md`, `T01-PLAN.md`, `T01-SUMMARY.md`, `S01-UAT.md`
- `gsd.db` — SQLite-backed state for milestones, slices, tasks, metrics, memories
- `completed-units.json` — dispatch tracker

**Git isolation via worktrees.** When `git.isolation` is `worktree` or `branch`, each milestone runs on its own `milestone/<MID>` branch (in a worktree or in-place). Slice work commits sequentially. On milestone completion, squash-merged to main as one clean commit. Default is `none`. Worktrees live under `.gsd/worktrees/<name>/` with branch `worktree/<name>` for manual `/worktree` usage.

**Extension-first loading.** On every launch, bundled extensions and agents are synced from `src/resources/` to `~/.gsd/agent/`. Extensions are discovered via `discoverExtensionEntryPaths()`, sorted topologically with Kahn's algorithm, and loaded via jiti. The `pkg/` shim directory prevents Pi's theme resolution from colliding with `src/`.

**Two-file loader pattern.** `loader.ts` sets all env vars (`PI_PACKAGE_DIR`, `GSD_CODING_AGENT_DIR`, `GSD_PKG_ROOT`, `NODE_PATH`, `GSD_BIN_PATH`, `GSD_WORKFLOW_PATH`, `GSD_BUNDLED_EXTENSION_PATHS`) with zero SDK imports, then dynamic-imports `cli.ts` which does static SDK imports. This guarantees env vars are present before any SDK code evaluates.

---

## Section 2: Analysis

**Extension-first philosophy.** The project aggressively pushes capabilities out of core into extensions, skills, and plugins. The core GSD extension lives at `src/resources/extensions/gsd/` and contains the workflow engine, auto mode, commands, and worktree logic. CONTRIBUTING.md states: "Can this be an extension instead of a core change? If yes, build it as an extension." This keeps the CLI entry surface small and the monorepo scalable.

**Simplicity over abstraction.** VISION.md explicitly rejects "enterprise patterns" (DI containers, abstract factories, strategy-pattern-for-the-sake-of-it). The codebase favors three similar lines of code over a premature abstraction. This is visible in the CLI branching logic (`cli.ts` lines 145-881): sequential `if` blocks for each subcommand/mode rather than a router framework.

**Tests are the contract.** CONTRIBUTING.md mandates `node:test` + `node:assert/strict`, prohibits source-grep tests (reading source files and regex-asserting), and requires regression tests for bug fixes. Three recurring defect classes are CI-enforced: `Statement#get()` returns `undefined` (not `null`); `once()` listeners must be attached before triggering syscalls; `.mjs` importing `.ts` requires `--experimental-strip-types`.

**Provider-agnostic design.** GSD supports 20+ LLM providers (Anthropic, OpenAI, Google, OpenRouter, GitHub Copilot, Bedrock, Azure, Groq, Cerebras, Mistral, xAI, Ollama, etc.). Per-phase model selection allows different models for research, planning, execution, and completion with automatic fallback chains. OAuth and API key authentication are both supported, with a branded onboarding wizard (`onboarding.ts`) that walks users through provider selection.

**RTK integration for token optimization.** GSD provisions a managed RTK binary (`rtk-ai/rtk`) on supported platforms to compress shell-command output in bash/async_bash/bg_shell flows. RTK telemetry is forced off (`RTK_TELEMETRY_DISABLED=1`). The integration is opt-in via `experimental.rtk` preference; default is disabled.

**Worktree safety is a first-class concern.** The worktree system has multiple layers of safety guards:
- **Containment:** `isInsideWorktreesDir()` uses `realpathSync` + path-prefix checks before any destructive operation (`worktree-manager.ts` lines 147-154).
- **Submodule rescue:** Uncommitted submodule changes are committed to a labeled rescue branch (`gsd/submodule-rescue/<name>-<timestamp>`) before force removal to avoid stash pollution (`worktree-manager.ts` lines 546-596).
- **Nested .git detection:** Scaffolding tools create nested `.git` directories that become orphaned gitlinks; `findNestedGitDirs()` scans and removes them before worktree cleanup (`worktree-manager.ts` lines 423-474).
- **Ancestry guard:** `createWorktree()` refuses to force-reset a branch with commits not reachable from the start point, preventing orphaning of prior-session work (`worktree-manager.ts` lines 286-299).
- **Canonical milestone root:** `resolveCanonicalMilestoneRoot()` routes validators and cross-session readers through the live worktree so milestone validation does not read stale project-root state (`worktree-manager.ts` lines 175-206).

---

## Section 3: L4 Pointers

### Project Bootstrap & Env Setup
- **`src/loader.ts`** — Fast-path `--version`/`-v` and `--help`/`-h` before heavy imports (lines 21-30). Runtime dependency checks (`checkNodeVersion`, `requireGit`) (lines 37-69). Sets `PI_PACKAGE_DIR` to `pkg/` shim (line 84). Sets `GSD_CODING_AGENT_DIR`, `GSD_PKG_ROOT`, `NODE_PATH`, `GSD_VERSION`, `GSD_BIN_PATH`, `GSD_WORKFLOW_PATH`, `GSD_BUNDLED_EXTENSION_PATHS` (lines 110-176). Validates critical workspace packages (`@gsd/pi-coding-agent`) are resolvable (lines 236-255).
- **`src/cli.ts`** — Early `exitIfManagedResourcesAreNewer()` gate (line 297). RTK bootstrap via `doRtkBootstrap()` / `ensureRtkBootstrap()` (lines 163-206). Onboarding wizard gate `shouldRunOnboarding()` → `runOnboarding()` (lines 527-538). Interactive mode entry: `new InteractiveMode(session).run()` (line 881).

### State & Configuration
- **`package.json`** — `piConfig` block defines `name: "gsd"`, `configDir: ".gsd"` (lines 39-42). Workspaces: `packages/*`, `studio`, `extensions/*` (lines 15-19). Bin entry: `gsd: "dist/loader.js"` (line 21).
- **`src/resources/extensions/gsd/preferences.js`** — `loadEffectiveGSDPreferences()` loaded by cli.ts RTK bootstrap (line 172).
- **`src/resources/extensions/gsd/paths.js`** — `gsdRoot()`, `milestonesDir()` used throughout the GSD extension.

### Extension Loading
- **`src/resource-loader.js`** — `initResources()`, `buildResourceLoader()`, `getNewerManagedResourceVersion()` imported by `cli.ts` (line 10). `flushPendingProviderRegistrations()` wires extension-registered providers into `ModelRegistry` (lines 450-456).
- **`src/extension-discovery.js`** — `discoverExtensionEntryPaths()`.
- **`src/extension-registry.js`** — `loadRegistry()`, `readManifestFromEntryPath()`, `isExtensionEnabled()`.

### Headless Mode
- **`src/headless.ts`** — `runHeadless()` with crash-restart loop and exponential backoff (lines 238-266). `runHeadlessOnce()` spawns `RpcClient`, tracks events, handles answer injection, supervised mode, idle timeout, and completion detection (lines 268-990). `parseHeadlessArgs()` supports `--timeout`, `--json`, `--output-format`, `--model`, `--context`, `--auto`, `--verbose`, `--max-restarts`, `--answers`, `--events`, `--supervised`, `--response-timeout`, `--resume`, `--bare` (lines 147-232). Exit codes: `0` success, `1` error/timeout, `10` blocked, `11` cancelled.

### Web Mode
- **`src/web-mode.ts`** — `launchWebMode()` resolves host bootstrap (`packaged-standalone` vs `source-dev`), reserves port via `reserveWebPort()`, spawns detached process, waits for boot readiness via `/api/boot` health check, writes PID file, registers in `web-instances.json`, opens browser with auth token (lines 547-736). `stopWebMode()` supports `--all` and per-project stopping (lines 198-256).
- **`src/cli-web-branch.ts`** — `runWebCliBranch()` handles `gsd web stop [path|all]` and `gsd --web [path]` branching (lines 206-315). `parseCliArgs()` parses `--web`, `--host`, `--port`, `--allowed-origins` (lines 45-98).

### Worktree System
- **`src/worktree-cli.ts`** — Standalone subcommands: `handleList`, `handleMerge`, `handleClean`, `handleRemove`, `handleStatusBanner`, `handleWorktreeFlag` (lines 466-474). Loads extension modules lazily via jiti (`loadExtensionModules()`, lines 99-126). `-w` flag behavior: resume single active worktree, show multiple for selection, or create auto-named worktree (`handleWorktreeFlag()`, lines 379-439).
- **`src/worktree-name-gen.ts`** — `generateWorktreeName()` produces `adjective-verbing-noun` names (line 47).
- **`src/worktree-status-banner.ts`** — `showWorktreeStatusBanner()` parses `git worktree list --porcelain`, finds GSD worktrees under `.gsd/worktrees/`, filters those with unmerged changes against main branch, prints resume/merge hint (lines 128-150).
- **`src/resources/extensions/gsd/worktree-manager.ts`** — Core worktree operations: `createWorktree()`, `listWorktrees()`, `removeWorktree()`, `mergeWorktreeToMain()`, `diffWorktreeAll()`, `diffWorktreeNumstat()`, `resolveGitDir()`, `resolveCanonicalMilestoneRoot()`, `findNestedGitDirs()`, `isInsideWorktreesDir()`.
- **`src/resources/extensions/gsd/worktree-command.ts`** — `/worktree` and `/wt` command handlers: `registerWorktreeCommand()`, `handleWorktreeCommand()`, `handleCreate()`, `handleSwitch()`, `handleReturn()`, `handleMerge()`, `handleRemove()`, `handleRemoveAll()`. Merge flow: deterministic squash first, LLM-guided fallback on conflict (lines 553-736).
- **`src/resources/extensions/gsd/auto-worktree.ts`** — Milestone worktree lifecycle: `syncGsdStateToWorktree()`, `syncWorktreeStateBack()`, `syncProjectRootToWorktree()`, `syncStateToProjectRoot()`, `escapeStaleWorktree()`, `cleanStaleRuntimeUnits()`, `runWorktreePostCreateHook()`, `popStashByRef()`, `forceOverwriteAssessmentsWithVerdict()`.
- **`src/resources/extensions/gsd/native-git-bridge.ts`** — Low-level git wrappers: `nativeWorktreeAdd`, `nativeWorktreeRemove`, `nativeWorktreePrune`, `nativeWorktreeList`, `nativeBranchDelete`, `nativeBranchForceReset`, `nativeBranchExists`, `nativeMergeSquash`, `nativeMergeAbort`, `nativeCommit`, `nativeDiffNameStatus`, `nativeDiffNumstat`, `nativeDiffContent`, `nativeLogOneline`, `nativeIsAncestor`, `nativeDetectMainBranch`, `nativeGetCurrentBranch`, `nativeHasChanges`, `nativeHasMergeConflicts`.

### MCP Server
- **`src/mcp-server.ts`** — `startMcpServer()` creates a `Server` from `@modelcontextprotocol/sdk`, registers all active agent tools under `tools/list` and `tools/call`, threads `AbortSignal` into tool execution, maps `details` to `structuredContent` via strict `isPlainObject()` guard (lines 71-178).

### RTK
- **`src/rtk.ts`** — `bootstrapRtk()`, `ensureRtkAvailable()`, `resolveRtkBinaryPath()`, `rewriteCommandWithRtk()`, `validateRtkBinary()`. Downloads RTK from GitHub releases with SHA-256 checksum verification (lines 261-367).

### Update Command
- **`src/update-cmd.ts`** — `runUpdate()` fetches latest version from npm registry, compares semver, runs `npm install -g gsd-pi@latest` (lines 6-42).

### Help Text
- **`src/help-text.ts`** — `printHelp()` general CLI help, `printSubcommandHelp()` for `config`, `update`, `sessions`, `install`, `remove`, `list`, `worktree`, `graph`, `headless` (lines 175-210).

### Git Summary Service (Web Bridge)
- **`src/web/git-summary-service.ts`** — `collectCurrentProjectGitSummary()` reads `git status --porcelain`, parses into `GitSummaryFile[]`, computes counts (changed/staged/dirty/untracked/conflicts), returns `GitSummaryResponse` with `kind: "repo" | "not_repo"` (lines 151-198).
