# gstack Browse Daemon — Details

## Mechanism

Persistent Chromium browser daemon controlled via localhost HTTP. Built on
Playwright + Bun. Compiles to single ~58MB binary via `bun build --compile`.

### Architecture

```
CLI (compiled binary)
  → reads .gstack/browse.json (pid, port, token)
  → POST /command to localhost:PORT
  → Server (Bun.serve, ~2200 lines)
    → dispatches to read/write/meta command handlers
    → talks to Chromium via Playwright CDP
    → returns plain text result
```

### Request Pipeline (server.ts handleCommandInternal)

1. Scope check (token-registry) — verify token has required scope
2. Domain allowlist check — for scoped tokens only
3. Rate limit check — 1-req/sec sliding window per clientId
4. Tab ownership check — own-only policy for multi-agent
5. Execute command (read/write/meta dispatch)
6. Content wrapping — untrusted envelope for PAGE_CONTENT_COMMANDS
7. Activity emission — SSE feed for Chrome extension sidebar

### Source Files (25)

| File | Lines | Role |
|---|---|---|
| server.ts | ~2200 | Main HTTP server, all routes, command dispatch |
| browser-manager.ts | ~1190 | Chromium lifecycle, tabs, dialog, anti-bot patches |
| cli.ts | ~980 | CLI entry, server health-check, pair-agent setup |
| write-commands.ts | ~920 | All write commands + cleanup selectors |
| meta-commands.ts | ~600 | Tabs, screenshot, chain, diff, snapshot, handoff |
| snapshot.ts | ~550 | ARIA tree -> @ref map, annotated screenshots |
| read-commands.ts | ~450 | text, html, links, js, eval, etc. |
| cookie-import-browser.ts | large | AES-128-CBC cookie decryption from real browsers |
| cookie-picker-ui.ts | ~400 | Self-contained dark-theme cookie picker HTML/JS/CSS |
| token-registry.ts | ~380 | Scoped tokens, rate limiting, setup key exchange |
| sidebar-agent.ts | ~380 | JSONL queue poller, claude subprocess spawner |
| cdp-inspector.ts | ~380 | CDP CSS inspection, style modification, undo history |
| content-security.ts | ~348 | Datamarking, hidden element stripping, content filters |
| cookie-picker-routes.ts | ~200 | HTTP routes for cookie picker UI |
| url-validation.ts | ~180 | DNS rebinding protection, metadata IP blocking |
| commands.ts | ~151 | Command set registry, load-time validation |
| config.ts | ~151 | Path resolution, .gstack/ dir management |
| activity.ts | ~130 | SSE activity feed for Chrome extension |
| buffers.ts | ~120 | CircularBuffer + console/network/dialog instances |
| tab-session.ts | ~120 | Per-tab state: page, refMap, activeFrame |
| bun-polyfill.cjs | ~100 | Windows Node.js shim for Bun APIs |
| find-browse.ts | ~60 | Binary locator for .codex/.agents/.claude dirs |
| sidebar-utils.ts | ~30 | URL sanitization for extension |
| platform.ts | ~20 | IS_WINDOWS, TEMP_DIR, isPathWithin() |
| welcome.html | ~200 | Headed-mode welcome page |

### Ref System (@e and @c)

`snapshot -i` calls `page.accessibility.snapshot()` → parses YAML-like ARIA tree →
assigns sequential refs: @e1, @e2... Each ref stores: role, name, Playwright Locator.
Locators are external to DOM (no mutation, no CSP issues, no framework conflicts).

Staleness detection: `resolveRef()` performs async `count()` check (~5ms) before use.
Refs cleared on navigation (`framenavigated` event on main frame).

Cursor-interactive refs (`-C`): finds clickable non-ARIA elements (cursor:pointer,
onclick, custom tabindex). Gets @c1, @c2 refs in separate namespace.

### Token Scopes

| Scope | Commands |
|---|---|
| SCOPE_READ | text, html, links, forms, accessibility, js, eval, css, attrs, etc. |
| SCOPE_WRITE | goto, click, fill, select, type, press, scroll, wait, cookie, header |
| SCOPE_ADMIN | stop, restart, connect, disconnect, pair |
| SCOPE_META | tabs, newtab, closetab, screenshot, pdf, chain, state, frame |

### Content Security (4 layers)

1. **Datamarking** — zero-width space watermarks in text output (session-scoped)
2. **Hidden element stripping** — CSS-hidden, ARIA injection patterns stripped (no DOM mutation)
3. **Content filter pipeline** — URL blocklist (requestbin, ngrok, webhook.site), extensible
4. **Instruction block hardening** — explicit prompt injection warnings in agent instructions

### Headed Mode

`chromium.launchPersistentContext()` on port 34567.
Anti-bot patches: navigator.plugins/languages spoofing, `cdc_` variable removal.
Auto-starts sidebar-agent.ts. Extension auto-loads.

### Sidebar Chat

Server writes to JSONL queue file. sidebar-agent polls every 200ms.
Spawns `claude -p` subprocess per tab. Model routing:
- ANALYSIS_WORDS → opus (reading, summarizing, explaining)
- ACTION_PATTERNS → sonnet (click, navigate, screenshot)

Git worktree isolation per sidebar session. Per-tab cancel files.

### Cookie Import

Supports Chrome, Chromium, Arc, Brave, Edge, Comet.
AES-128-CBC: macOS Keychain PBKDF2 key derivation + Linux libsecret.
v10/v11 prefix detection, 32-byte Chromium metadata skip.
Key cache per-session. Database read-only (copies to temp file).

## Analysis

The browse daemon is gstack's core technical differentiator. The persistent daemon
model (vs cold-start per command) delivers ~100-200ms latency and maintains cookies/
localStorage across commands. The @ref system (ARIA tree → Playwright Locators)
avoids DOM mutation entirely, solving CSP/hydration/Shadow DOM issues.

The 4-layer content security for `/pair-agent` is the most thorough prompt injection
defense in any browse tool — datamarking, hidden element stripping, content filters,
and instruction hardening. The split snapshot format (trusted refs above, untrusted
content below) is a novel approach.

The sidebar chat with model routing (Sonnet for actions, Opus for analysis) and
per-tab context isolation is production-quality browser-AI integration.

## L4 Pointers

- Browse source: `browse/src/` (25 files, ~8000 LOC)
- Browse tests: `browse/test/` (40+ test files, 750+ security tests)
- Architecture doc: `ARCHITECTURE.md` (full design rationale)
- Browser reference: `BROWSER.md` (full command reference)
- Design docs: `docs/designs/GSTACK_BROWSER_V0.md`, `CHROME_VS_CHROMIUM_EXPLORATION.md`
