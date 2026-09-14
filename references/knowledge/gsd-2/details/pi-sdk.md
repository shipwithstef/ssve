# GSD-2 Pi SDK — Knowledge Extraction

## Mechanism

### pi-ai (`packages/pi-ai/src/`)
- **`index.ts`** — Barrel export. Re-exports:
  - `@sinclair/typebox` (`Type`, `Static`, `TSchema`)
  - `api-registry.js`, `env-api-keys.js`, `models/index.js`
  - Anthropic shared utilities: `mapThinkingLevelToEffort()`, `supportsAdaptiveThinking()`
  - Provider families, capabilities, builtin registration, message transformation (`transformMessagesWithReport`, `createEmptyReport`, `hasTransformations`)
  - Streaming (`stream.js`), types (`types.js`)
  - Event-stream, JSON parse, overflow, typebox-helpers, repair-tool-json, validation utilities
  - OAuth types and interfaces
- **`models.ts`** — Backward-compatible re-export of `models/index.js` (ADR-007 moved registry internals to `src/models/*`).
- **`cli.ts`** — Standalone CLI for OAuth provider login:
  - Commands: `login [provider]`, `list`
  - Interactive provider selection via readline
  - Persists credentials to `auth.json`
- **`models/index.ts`** — Three-tier model registry:
  1. **Generated models** (`MODELS` from `models/generated/index.js`) — auto-generated from models.dev catalog.
  2. **Custom models** (`CUSTOM_MODELS` from `models/custom.js`) — manually maintained providers NOT in models.dev; additive only, never overwrites generated entries.
  3. **Capability patches** (`CAPABILITY_PATCHES` from `models/capability-patches.js`) — applied at module load to patch capabilities onto matched models.
  - `getModel(provider, modelId)` — typed model retrieval.
  - `getProviders()`, `getModels(provider)` — registry introspection.
  - `calculateCost(model, usage)` — cost computation per token tier (input/output/cacheRead/cacheWrite).
  - `supportsXhigh(model)` — checks `model.capabilities.supportsXhigh`.
  - `modelsAreEqual(a, b)` — equality by id + provider.

### pi-agent-core (`packages/pi-agent-core/src/`)
- **`index.ts`** — Barrel export of four modules:
  - `agent.js` — Core agent logic
  - `agent-loop.js` — Agent loop functions
  - `proxy.js` — Proxy utilities
  - `types.js` — Type definitions
- This is a thin re-export layer; the concrete implementations live in the sibling `pi-coding-agent` package which owns the full extension runtime.

### pi-coding-agent (`packages/pi-coding-agent/src/`)
- **`index.ts`** — Massive barrel export (~422 lines) exposing the full coding-agent SDK surface:
  - **Config**: `getAgentDir()`, `VERSION`
  - **Session**: `AgentSession`, `AgentSessionConfig`, `AgentSessionEvent`, `ModelCycleResult`, `ParsedSkillBlock`, `PromptOptions`, `parseSkillBlock()`, `SessionStats`
  - **Auth**: `AuthStorage`, `FileAuthStorageBackend`, `InMemoryAuthStorageBackend`, `ApiKeyCredential`, `OAuthCredential`
  - **Compaction**: `compact()`, `shouldCompact()`, `calculateContextTokens()`, `estimateTokens()`, `findCutPoint()`, `generateBranchSummary()`, `prepareBranchEntries()`, `serializeConversation()`, `DEFAULT_COMPACTION_SETTINGS`
  - **Event bus**: `createEventBus()`, `EventBus`, `EventBusController`
  - **Extensions**: Full extension system — `Extension`, `ExtensionAPI`, `ExtensionCommandContext`, `ExtensionContext`, `ExtensionRuntime`, `ExtensionFactory`, `RegisteredTool`, `ToolDefinition`, `ToolInfo`, `LifecycleHookContext`, `LifecycleHookMap`, `LoadExtensionsResult`, `discoverAndLoadExtensions()`, `createExtensionRuntime()`, `ExtensionRunner`, `wrapToolsWithExtensions()`
  - **Messages**: `convertToLlm()`
  - **Model discovery**: `ModelDiscoveryCache`, `getDiscoverableProviders()`, `getDiscoveryAdapter()`, `DiscoveredModel`, `DiscoveryResult`
  - **Model registry**: `ModelRegistry`, `ModelsJsonWriter`
  - **Package manager**: `DefaultPackageManager`, `ResolvedPaths`, `ResolvedResource`
  - **Package commands**: `parsePackageCommand()`, `runPackageCommand()`, `getPackageCommandUsage()`
  - **Resource loader**: `DefaultResourceLoader`, `ResourceLoader`
  - **Retry**: `RETRYABLE_ERROR_RE`
  - **SDK**: `createAgentSession()`, `createBashTool()`, `createCodingTools()`, `createEditTool()`, `createFindTool()`, `createGrepTool()`, `createLsTool()`, `createReadOnlyTools()`, `createReadTool()`, `createWriteTool()`, `readOnlyTools`, `hashlineCodingTools`, `hashlineEditTool`, `hashlineReadTool`
  - **Session manager**: `SessionManager`, `SessionContext`, `SessionEntry`, `SessionHeader`, `SessionInfo`, `parseSessionEntries()`, `migrateSessionEntries()`, `CURRENT_SESSION_VERSION`, `NewSessionOptions`, `BranchSummaryEntry`, `CompactionEntry`, `buildSessionContext()`, `getLatestCompactionEntry()`
  - **Blob store**: `BlobStore`, `isBlobRef()`, `parseBlobRef()`, `externalizeImageData()`, `resolveImageData()`
  - **Artifact manager**: `ArtifactManager`
  - **Settings**: `SettingsManager`, `AsyncSettings`, `CompactionSettings`, `ImageSettings`, `MemorySettings`, `RetrySettings`, `TaskIsolationSettings`
  - **Safe commands**: `SAFE_COMMAND_PREFIXES`, `setAllowedCommandPrefixes()`, `getAllowedCommandPrefixes()`
  - **Skills**: `loadSkills()`, `loadSkillsFromDir()`, `getLoadedSkills()`, `formatSkillsForPrompt()`, `Skill`, `SkillFrontmatter`, `ECOSYSTEM_SKILLS_DIR`, `ECOSYSTEM_PROJECT_SKILLS_DIR`
  - **Tools**: Full tool surface — `bashTool`, `editTool`, `findTool`, `grepTool`, `lsTool`, `readTool`, `writeTool`, `truncateHead`, `truncateLine`, `truncateTail`, `formatSize`, `DEFAULT_MAX_BYTES`, `DEFAULT_MAX_LINES`, `registerToolCompatibility()`, `getToolCompatibility()`, `getAllToolCompatibility()`, `registerMcpToolCompatibility()`
  - **Main**: `main()` entry point
  - **Modes**: `InteractiveMode`, `runPrintMode()`, `runRpcMode()`, `RpcClient`, `RpcClientOptions`, `RpcEventListener`, `RpcCommand`, `RpcInitResult`, `RpcProtocolVersion`, `RpcResponse`, `RpcSessionState`, `RpcV2Event`, `ModelInfo`
  - **JSONL**: `attachJsonlLineReader()`, `serializeJsonLine()`
  - **UI components**: 20+ components including `AssistantMessageComponent`, `BorderedLoader`, `CustomMessageComponent`, `ExtensionEditorComponent`, `FooterComponent`, `LoginDialogComponent`, `ModelSelectorComponent`, `SettingsSelectorComponent`, `ToolExecutionComponent`, `TreeSelectorComponent`, `renderDiff()`, `truncateToVisualLines()`
  - **Theme**: `Theme`, `initTheme()`, `highlightCode()`, `getLanguageFromPath()`, `getMarkdownTheme()`
  - **Clipboard**: `copyToClipboard()`
  - **Frontmatter**: `parseFrontmatter()`, `stripFrontmatter()`
  - **Shell**: `getShellConfig()`, `sanitizeCommand()`
  - **Path display**: `toPosixPath()`

### pi-tui (`packages/pi-tui/src/`)
- **`index.ts`** — Terminal UI component library:
  - **Autocomplete**: `AutocompleteItem`, `AutocompleteProvider`, `CombinedAutocompleteProvider`, `SlashCommand`
  - **Components**: `Box`, `CancellableLoader`, `Editor`/`EditorOptions`/`EditorTheme`, `Image`/`ImageOptions`/`ImageTheme`, `Input`, `Loader`, `Markdown`/`MarkdownTheme`, `SelectList`/`SelectListTheme`, `SettingsList`/`SettingsListTheme`, `Spacer`, `Text`, `TruncatedText`
  - **Editor component interface**: `EditorComponent`
  - **Fuzzy matching**: `fuzzyFilter()`, `fuzzyMatch()`, `FuzzyMatch`
  - **Keybindings**: `DEFAULT_EDITOR_KEYBINDINGS`, `EditorKeybindingsManager`, `getEditorKeybindings()`, `setEditorKeybindings()`
  - **Keyboard input**: `Key`, `decodeKittyPrintable()`, `isKeyRelease()`, `isKeyRepeat()`, `isKittyProtocolActive()`, `matchesKey()`, `parseKey()`, `setKittyProtocolActive()`
  - **Stdin buffering**: `StdinBuffer`, `StdinBufferEventMap`, `StdinBufferOptions`
  - **Terminal**: `ProcessTerminal`, `Terminal`
  - **Terminal images**: `renderImage()`, `encodeKitty()`, `encodeITerm2()`, `detectCapabilities()`, `getCapabilities()`, `TerminalCapabilities`, `ImageProtocol`, `ImageDimensions`, `CellDimensions`, `allocateImageId()`, `deleteKittyImage()`, `deleteAllKittyImages()`
  - **TUI framework**: `TUI`, `Container`, `Component`, `Focusable`, `isFocusable()`, `OverlayHandle`, `OverlayOptions`, `CURSOR_MARKER`
  - **Utilities**: `truncateToWidth()`, `visibleWidth()`, `wrapTextWithAnsi()`

### daemon (`packages/daemon/src/`)
- **`index.ts`** — Daemon and orchestration exports:
  - **Config**: `resolveConfigPath()`, `loadConfig()`, `validateConfig()`
  - **Core daemon**: `Daemon`
  - **Project scanning**: `scanForProjects()`
  - **Session management**: `SessionManager`
  - **Discord bot**: `DiscordBot`, `isAuthorized()`, `validateDiscordConfig()`, `DiscordBotOptions`
  - **Channel management**: `ChannelManager`, `sanitizeChannelName()`
  - **Commands**: `buildCommands()`, `formatSessionStatus()`, `registerGuildCommands()`
  - **Event bridge**: `EventBridge`, `BridgeClient`, `EventBridgeOptions`
  - **Orchestrator**: `Orchestrator`, `OrchestratorConfig`, `OrchestratorDeps`, `DiscordMessageLike`
  - **Message batching**: `MessageBatcher`, `SendPayload`, `SendFn`, `BatcherOptions`
  - **Verbosity**: `VerbosityManager`, `shouldShowAtLevel()`
  - **Event formatting**: `formatToolStart()`, `formatToolEnd()`, `formatMessage()`, `formatBlocker()`, `formatCompletion()`, `formatError()`, `formatCostUpdate()`, `formatSessionStarted()`, `formatTaskTransition()`, `formatGenericEvent()`, `formatEvent()`
  - **Launchd**: `installLaunchAgent()`, `uninstallLaunchAgent()`, `launchAgentStatus()`, `generatePlist()`, `getPlistPath()`, `escapeXml()`

### mcp-server (`packages/mcp-server/src/`)
- **`index.ts`** — MCP server for GSD orchestration:
  - **Server**: `createMcpServer()`
  - **Session**: `SessionManager`
  - **State readers** (read-only, usable without a running session):
    - `readProgress()` → `ProgressResult`
    - `readRoadmap()` → `RoadmapResult` (`MilestoneInfo`, `SliceInfo`, `TaskInfo`)
    - `readHistory()` → `HistoryResult` (`MetricsUnit`)
    - `readCaptures()` → `CapturesResult` (`CaptureEntry`)
    - `readKnowledge()` → `KnowledgeResult` (`KnowledgeEntry`)
    - `runDoctorLite()` → `DoctorResult` (`DoctorIssue`)
    - `buildGraph()`, `writeGraph()`, `writeSnapshot()`, `graphStatus()`, `graphQuery()`, `graphDiff()` → `KnowledgeGraph`, `GraphNode`, `GraphEdge`, `NodeType`, `EdgeType`, `ConfidenceTier`, `GraphStatusResult`, `GraphQueryResult`, `GraphDiffResult`

### rpc-client (`packages/rpc-client/src/`)
- **`index.ts`** — Standalone RPC client SDK:
  - Re-exports all types from `rpc-types.js`
  - JSONL utilities: `serializeJsonLine()`, `attachJsonlLineReader()`
  - `RpcClient` class with `RpcClientOptions`, `RpcEventListener`, `SdkAgentEvent`

### native (`packages/native/src/`)
- **`index.ts`** — High-performance Rust modules exposed via N-API:
  - **Clipboard**: `copyToClipboard()`, `readTextFromClipboard()`, `readImageFromClipboard()`
  - **Syntax highlighting**: `highlightCode()`, `supportsLanguage()`, `getSupportedLanguages()`
  - **Grep**: `searchContent()`, `grep()` — content + filesystem regex search
  - **Process tree**: `killTree()`, `listDescendants()`, `processGroupId()`, `killProcessGroup()`
  - **Glob**: `glob()`, `invalidateFsScanCache()`
  - **AST**: `astGrep()`, `astEdit()` — structural search/rewrite
  - **HTML**: `htmlToMarkdown()`
  - **Text**: `wrapTextWithAnsi()`, `truncateToWidth()`, `sliceWithWidth()`, `extractSegments()`, `sanitizeText()`, `visibleWidth()`, `EllipsisKind`
  - **Diff**: `normalizeForFuzzyMatch()`, `fuzzyFindText()`, `generateDiff()`
  - **Fuzzy find (fd)**: `fuzzyFind()`
  - **Image**: `parseImage()`, `ImageFormat`, `SamplingFilter`
  - **Hash**: `xxHash32()`, `xxHash32Fallback()`
  - **TTSR**: `ttsrCompileRules()`, `ttsrCheckBuffer()`, `ttsrFreeRules()`
  - **JSON parse**: `parseJson()`, `parsePartialJson()`, `parseStreamingJson()`
  - **Stream processing**: `processStreamChunk()`, `stripAnsiNative()`, `sanitizeBinaryOutputNative()`
  - **GSD parser**: `parseFrontmatter()`, `nativeExtractSection()`, `extractAllSections()`, `batchParseGsdFiles()`, `parseRoadmapFile()`
  - **Truncate**: `truncateTail()`, `truncateHead()`, `truncateOutput()`
- **`native.ts`** — Addon loader with graceful fallback:
  - Resolution order:
    1. `@gsd-build/engine-{platform}` npm optional dependency (production)
    2. `native/addon/gsd_engine.{platform}.node` (local release build)
    3. `native/addon/gsd_engine.dev.node` (local debug build)
  - Supported platforms: `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`, `win32-x64-msvc`
  - Unsupported platforms get a throwing Proxy (individual function calls fail, not startup — #1223)

---

## Analysis

1. **pi-ai is a model registry + provider abstraction layer.** It separates generated catalog data (models.dev), custom provider additions, and runtime capability patches. The registry is a `Map<string, Map<string, Model<Api>>>` keyed by provider then model ID.

2. **pi-coding-agent is the monolithic extension runtime.** Its `index.ts` exports ~400 symbols covering every subsystem: sessions, auth, compaction, extensions, tools, UI components, themes, skills, and RPC modes. This is the primary package consumed by the GSD extension.

3. **pi-tui is a standalone terminal UI framework.** It supports Kitty graphics protocol, iTerm2 inline images, ANSI-aware text measurement, and a React-like component model (`TUI`, `Container`, `Component`). It is decoupled from the agent logic.

4. **daemon provides Discord + launchd integration.** It wraps the agent runtime in a persistent daemon with Discord bot commands, event bridging, message batching, and macOS launch agent support. This is a deployment/ops layer, not a core dev tool.

5. **mcp-server exposes read-only GSD state via MCP.** It provides structured readers for progress, roadmaps, metrics, captures, knowledge, and a knowledge graph. These are designed to be queried by external MCP clients without starting a full agent session.

6. **rpc-client is a thin JSONL-over-stdio SDK.** It wraps the RPC protocol used by `pi-coding-agent`'s RPC mode, enabling external processes to drive agent sessions programmatically.

7. **native is a polyglot FFI surface.** Every exported function has a JS fallback (observed in `native.ts` throwing Proxy and referenced in bridge files). The native layer accelerates hot paths: grep, glob, git, diff, fuzzy find, AST search, process management, and text truncation.

---

## L4 pointers

| Capability | File | Function / Type |
|-----------|------|-----------------|
| Model registry | `pi-ai/src/models/index.ts` | `getModel()`, `getProviders()`, `getModels()`, `calculateCost()` |
| Model capability patches | `pi-ai/src/models/capability-patches.ts` | `CAPABILITY_PATCHES`, `applyCapabilityPatches()` |
| Custom models | `pi-ai/src/models/custom.ts` | `CUSTOM_MODELS` |
| Generated models | `pi-ai/src/models/generated/index.ts` | `MODELS` |
| OAuth CLI | `pi-ai/src/cli.ts` | `main()`, `login()` |
| API registry | `pi-ai/src/api-registry.ts` | Provider registration surface |
| Agent session | `pi-coding-agent/src/core/agent-session.ts` | `AgentSession`, `parseSkillBlock()` |
| Agent loop | `pi-coding-agent/src/core/agent-loop.ts` | Loop orchestration |
| Auth storage | `pi-coding-agent/src/core/auth-storage.ts` | `AuthStorage`, `FileAuthStorageBackend` |
| Compaction | `pi-coding-agent/src/core/compaction/index.ts` | `compact()`, `shouldCompact()`, `findCutPoint()` |
| Extension runtime | `pi-coding-agent/src/core/extensions/index.ts` | `Extension`, `ExtensionAPI`, `ExtensionCommandContext`, `createExtensionRuntime()` |
| Tool registry | `pi-coding-agent/src/core/tools/index.ts` | `bashTool`, `editTool`, `grepTool`, `readTool`, `writeTool`, `registerToolCompatibility()` |
| Session manager | `pi-coding-agent/src/core/session-manager.ts` | `SessionManager`, `parseSessionEntries()`, `CURRENT_SESSION_VERSION` |
| SDK factory | `pi-coding-agent/src/core/sdk.ts` | `createAgentSession()`, `createCodingTools()`, `createEditTool()` |
| RPC mode | `pi-coding-agent/src/modes/index.ts` | `runRpcMode()`, `RpcClient` |
| TUI framework | `pi-tui/src/tui.ts` | `TUI`, `Container`, `Component`, `OverlayHandle` |
| Terminal image | `pi-tui/src/terminal-image.ts` | `renderImage()`, `encodeKitty()`, `encodeITerm2()`, `detectCapabilities()` |
| Keyboard input | `pi-tui/src/keys.ts` | `Key`, `decodeKittyPrintable()`, `matchesKey()` |
| Daemon core | `daemon/src/daemon.ts` | `Daemon` |
| Discord bot | `daemon/src/discord-bot.ts` | `DiscordBot`, `isAuthorized()` |
| Event bridge | `daemon/src/event-bridge.ts` | `EventBridge`, `BridgeClient` |
| Orchestrator | `daemon/src/orchestrator.ts` | `Orchestrator` |
| Launchd agent | `daemon/src/launchd.ts` | `installLaunchAgent()`, `uninstallLaunchAgent()`, `generatePlist()` |
| MCP server factory | `mcp-server/src/server.ts` | `createMcpServer()` |
| Progress reader | `mcp-server/src/readers/state.ts` | `readProgress()` |
| Roadmap reader | `mcp-server/src/readers/roadmap.ts` | `readRoadmap()` |
| Knowledge graph | `mcp-server/src/readers/graph.ts` | `buildGraph()`, `graphQuery()`, `graphDiff()` |
| RPC client | `rpc-client/src/rpc-client.ts` | `RpcClient` |
| RPC types | `rpc-client/src/rpc-types.ts` | `RpcSessionState`, `RpcCommand`, `RpcResponse` |
| JSONL utilities | `rpc-client/src/jsonl.ts` | `serializeJsonLine()`, `attachJsonlLineReader()` |
| Native addon loader | `native/src/native.ts` | `loadNative()`, `native` proxy object |
| Native exports | `native/src/index.ts` | All N-API re-exports (grep, glob, ast, git, diff, fd, ps, truncate, etc.) |
