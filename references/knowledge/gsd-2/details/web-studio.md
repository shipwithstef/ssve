# GSD-2 Web UI, Studio, and VS Code Extension

## Mechanism

### Next.js Web UI (`/tmp/gsd-2/web/`)

The web interface is a Next.js 16.2.4 app (`/tmp/gsd-2/web/package.json`) with React 19.2.5, Tailwind CSS 4.2.4, and a heavy Radix UI primitives stack (25+ `@radix-ui/react-*` packages). It uses `next-themes` for dark-mode theming and `node-pty` for terminal emulation.

**Entry points:**
- `/tmp/gsd-2/web/app/page.tsx` — mounts `GSDAppShell` dynamically with `ssr: false`, showing a "Loading workspace…" placeholder during hydration.
- `/tmp/gsd-2/web/app/layout.tsx` — sets Geist/Geist_Mono fonts, dark default theme via `<ThemeProvider attribute="class" defaultTheme="dark">`, and a `Toaster` from `sonner` at bottom-right.

**API routes (all `runtime = "nodejs"`, `dynamic = "force-dynamic"`, no-cache headers):**

| Route | Source | Function |
|-------|--------|----------|
| `GET /api/live-state` | `bridge-service.ts` | `collectSelectiveLiveStatePayload(domains, projectCwd)` — domains: `"auto"`, `"workspace"`, `"resumable_sessions"` |
| `GET /api/steer` | `bridge-service.ts` | Reads `.gsd/OVERRIDES.md` via `resolveBridgeRuntimeConfig()`; returns `SteerData` |
| `GET /api/hooks` | `hooks-service.ts` | `collectHooksData(projectCwd)` |
| `GET /api/projects?root=&detail=` | `project-discovery-service.ts` | `discoverProjects(expandTilde(root), detail)` |
| `POST /api/projects` | same | Creates project dir, runs `git init`, returns `{name, path, kind, signals, lastModified}` |
| `GET /api/visualizer` | `visualizer-service.ts` | `collectVisualizerData(projectCwd)` |
| `GET /api/forensics` | `forensics-service.ts` | `collectForensicsData(projectCwd)` |

**Proxy / auth middleware:**
- `/tmp/gsd-2/web/proxy.ts` exports a `proxy(request: NextRequest)` function gated to `/api/*` paths.
- Checks `GSD_WEB_AUTH_TOKEN` env var against `Authorization: Bearer <token>` or `_token` query param for SSE.
- Validates `Origin` against `GSD_WEB_HOST`:`GSD_WEB_PORT` (default `127.0.0.1:3000`) plus `GSD_WEB_ALLOWED_ORIGINS` extra list.
- Config matcher: `/api/:path*`.

### Electron Studio (`/tmp/gsd-2/studio/`)

An Electron app scaffolded with `electron-vite` 5.0.0 and React 19.2.0.

**Main process (`/tmp/gsd-2/studio/src/main/index.ts`):**
- Creates a `BrowserWindow` (1400×900, min 1100×720, `backgroundColor: '#0a0a0a'`).
- `titleBarStyle: 'hiddenInset'` on macOS with traffic lights at `{x: 16, y: 16}`.
- Loads `preload` script with `contextIsolation: true`, `nodeIntegration: false`.
- Loads renderer from `ELECTRON_RENDERER_URL` env var in dev, or `dist/renderer/index.html` in production.

**Renderer (`/tmp/gsd-2/studio/src/renderer/src/App.tsx`):**
- Single-page bootstrap UI showing shell status, theme tokens, and typography proof.
- Imports `@phosphor-icons/react` icons and custom theme tokens from `./lib/theme/tokens`.
- Uses Tailwind utility classes with custom CSS vars (`--color-accent-muted`, `--color-accent`, `--color-bg-primary`, etc.).
- Entry (`main.tsx`) uses `StrictMode` and `createRoot`.

**Build config (`electron.vite.config.ts`):**
- Three Vite builds: `main` → `dist/main`, `preload` → `dist/preload`, `renderer` → `dist/renderer`.
- Renderer uses `@tailwindcss/vite` + `@vitejs/plugin-react` with `@/` alias to `src/renderer/src`.

### VS Code Extension (`/tmp/gsd-2/vscode-extension/`)

Published by FluxLabs as `gsd-2` v0.3.0. Activated `onStartupFinished`.

**Providers registered in `/tmp/gsd-2/vscode-extension/src/extension.ts`:**
- `GsdSidebarProvider` (webview view `gsd-sidebar`)
- `GsdSessionTreeProvider` (`gsd-sessions`)
- `GsdActivityFeedProvider` (`gsd-activity`)
- `GsdPlanViewerProvider` (`gsd-plan`)
- `GsdFileDecorationProvider` (file decoration provider)
- `GsdCodeLensProvider` (code lens for TS/TSX/JS/JSX/Python/Go/Rust)
- `GsdSlashCompletionProvider` (completion for `/` in markdown, plaintext, TS, TSX, JS, JSX)
- `GsdScmProvider` (custom SCM provider for agent changes)
- `GsdDiagnosticBridge` (diagnostics bridge)
- `GsdLineDecorationManager` (line-level decorations)
- `GsdGitIntegration` (git commit/branch/diff for agent changes)
- `GsdPermissionManager` (approval modes)
- `GsdChangeTracker` + `GsdBashTerminal`

**Key commands (48 total in `package.json` contributions.commands):**
- `gsd.start`, `gsd.stop`, `gsd.newSession`, `gsd.sendMessage`, `gsd.abort`
- `gsd.cycleModel`, `gsd.switchModel`, `gsd.cycleThinking`, `gsd.setThinking`
- `gsd.compact`, `gsd.exportHtml`, `gsd.sessionStats`, `gsd.runBash`
- `gsd.steer`, `gsd.listCommands`, `gsd.toggleAutoRetry`, `gsd.abortRetry`
- `gsd.forkSession`, `gsd.switchSession`, `gsd.refreshSessions`
- `gsd.toggleSteeringMode`, `gsd.toggleFollowUpMode`
- `gsd.acceptAllChanges`, `gsd.discardAllChanges`, `gsd.acceptFileChanges`, `gsd.discardFileChanges`
- `gsd.restoreCheckpoint`, `gsd.fixProblemsInFile`, `gsd.fixAllProblems`
- `gsd.commitAgentChanges`, `gsd.createAgentBranch`, `gsd.showAgentDiff`
- `gsd.clearPlan`, `gsd.cycleApprovalMode`, `gsd.selectApprovalMode`
- Code-lens triggered: `gsd.askAboutSymbol`, `gsd.refactorSymbol`, `gsd.findBugsSymbol`, `gsd.generateTestsSymbol`

**Configuration properties:**
- `gsd.binaryPath` (default `"gsd"`), `gsd.autoStart` (default `false`), `gsd.autoCompaction` (default `true`)
- `gsd.codeLens` (default `true`), `gsd.showProgressNotifications` (default `false`)
- `gsd.activityFeedMaxItems` (default `100`, min 10, max 500)
- `gsd.showContextWarning` (default `true`), `gsd.contextWarningThreshold` (default `80`, min 50, max 95)
- `gsd.approvalMode`: enum `["auto-approve", "ask", "plan-only"]`

**Status bar:**
- Persistent left-aligned status bar item refreshed every 10s via `setInterval`.
- Shows model ID, total cost, and spinning sync icon when streaming.
- Context-window warning throttled to once per 60s; offers "Compact Now" action.

**Progress notifications:**
- `agent_start` triggers a cancellable `vscode.ProgressLocation.Notification`.
- `tool_execution_start` updates the progress message with the tool name.
- `agent_end` resolves the progress promise.

## Analysis

- The web UI is a read-only/live-state dashboard, not an editing surface. All routes delegate to backend services (`bridge-service.ts`, `hooks-service.ts`, etc.) that likely live in the monorepo `src/web/` tree.
- The API uses bearer-token auth with an SSE-friendly `_token` query fallback. Origin validation is strict but configurable via env vars.
- The Electron studio is in very early bootstrap stage — `App.tsx` is essentially a design-system validation shell with no actual GSD business logic wired in yet.
- The VS Code extension is the most mature client surface. It has deep integration: SCM provider for agent changes, diagnostics bridge, git integration for commit/branch/diff, checkpoint restore, and a permission manager with three approval modes.
- The extension architecture follows a central `GsdClient` pattern that all providers subscribe to. Commands simply call `client!.<method>()`.
- `autoCompaction`, `contextWarningThreshold`, and `approvalMode` show GSD is context-window and safety conscious at the IDE layer.

## L4 Pointers

- **Web routes → services mapping:** All API routes import from `../../../../src/web/*-service.ts`. These service files are the real source of truth for live-state shape, hooks payload, and project discovery.
- **Proxy auth edge case:** When `GSD_WEB_AUTH_TOKEN` is unset, the proxy allows everything (`return NextResponse.next()`). This is documented as "dev mode without launch harness" but could be a security gap if accidentally deployed without the env var.
- **Studio missing IPC:** The preload script is referenced but its contents were not in the read set. The renderer has no visible IPC bridge to the main process (`window.studio.getStatus()` is shown as aspirational code in the UI, not confirmed implemented).
- **Extension chat participant:** `registerChatParticipant(context, client)` is called but the participant implementation (`chat-participant.ts`) was not read. The participant ID is `gsd.agent`, name `gsd`, sticky.
- **Missing route:** `/tmp/gsd-2/web/app/api/auto-dashboard/route.ts` does not exist in the source tree.
