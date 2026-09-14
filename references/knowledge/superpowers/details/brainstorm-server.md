# superpowers — Brainstorm Server & Visual Companion Details

## Server Architecture (server.cjs)

Zero-dependency Node.js server (~250-300 lines) using only `http`, `crypto`, `fs`, `path`.

### Dual-Mode Operation
- `require.main === module` → starts server
- Required as module → exports `{computeAcceptKey, encodeFrame, decodeFrame, OPCODES}` for testing

### Two-Directory Layout
- `CONTENT_DIR` — HTML files written by Claude
- `STATE_DIR` — server state: `server-info`, `events`, `server-stopped`

### WebSocket Protocol (Custom RFC 6455)
- OPCODES: TEXT(0x01), CLOSE(0x08), PING(0x09), PONG(0x0A)
- Unrecognized opcodes → close with status 1003
- Client frames always masked; throws on unmasked
- Three length encodings: <126 (2-byte), 126-65535 (4-byte), >65535 (10-byte)
- Handshake: SHA-1(clientKey + WS magic constant).digest('base64')

### HTTP Routes
- `GET /` — newest HTML file + helper.js injection
- `GET /files/*` — static files from content directory (html, css, js, json, png, jpg, svg)
- Everything else → 404

### File Watching
- `fs.watch` (not chokidar — zero dependency)
- Per-filename debounce: 100ms timeout to prevent duplicate events
- New file detected → clear events file, log `screen-added`
- File change → log `screen-updated`, do NOT clear events

### Lifecycle
- Owner PID monitoring: exits if owner process dies
- Windows/MSYS2: PID monitoring disabled (MSYS2 PIDs invisible to Node.js)
- 30-minute idle timeout as fallback
- Startup writes `server-info` JSON to `STATE_DIR`
- `BRAINSTORM_URL_HOST` defaults to `localhost` when HOST is `127.0.0.1`
- Random high port (49152-65535) by default

### Fragment vs Full Document Detection
- Content starting with `<!doctype` or `<html>` (case-insensitive) → serve as-is (full doc)
- Otherwise → wrap in frame template via `<!-- CONTENT -->` placeholder

## Visual Companion (visual-companion.md)

### Interaction Model
- Browser = interactive display, terminal = conversation channel
- Claude writes HTML fragments to content dir → server detects → broadcasts reload
- User clicks `[data-choice]` elements → events written to state dir
- Claude reads events on next turn (no blocking, no polling)

### Event Capture
- Only `[data-choice]` clicks captured (not all buttons/forms)
- Events appended to `events` file (one JSON line per event, `source: "user-event"`)
- Events file cleared when new HTML file detected (not on change to existing)

### UI System
- Frame template: OS-aware light/dark theme via CSS `prefers-color-scheme`
- Fixed header, scrollable main, fixed indicator bar
- CSS classes: `.options`, `.cards`, `.mockup`, `.split`, `.pros-cons`, `.placeholder`
- Multi-select via `data-multiselect` attribute on container
- Selection indicator states: "Click an option above" / "Option B selected — return to terminal"

### Platform-Specific Launch
- macOS/Linux: default behavior
- Windows: `run_in_background: true`
- Codex: auto-foreground
- Gemini CLI: `--foreground` + background execution

### Key Rules
- Never reuse filenames — each screen gets a fresh file (server serves by mtime)
- Content fragments by default; full documents only when full control needed
- When returning to terminal: push "waiting.html" to clear stale content
- Per-question decision: use browser only when content IS visual

## helper.js (WebSocket Client)

- Connects to server WebSocket
- `toggleSelect()`: single vs. multi-select based on `data-multiselect`
- Captures clicks on `[data-choice]` elements
- Sends `{source: 'user-event', type: 'click', choice, text, id, className}` via WebSocket
- `window.brainstorm = { send, choice }` exposed globally

## Document Review System

### Spec Review Loop (after brainstorming)
- Dispatch spec reviewer via Task tool (general-purpose subagent)
- Checks: completeness (TODOs, TBDs), consistency, clarity, scope, YAGNI
- Same agent that wrote spec fixes issues (preserves context)
- Loop until approved; at 5+ iterations surface to human

### Plan Review Loop (during writing-plans)
- Dispatch plan reviewer for each chunk (delimited by `## Chunk N: <name>`)
- Checks: completeness, spec alignment, task decomposition, buildability
- Chunk size limit: 1000 lines
- Status: `✅ Approved` or `❌ Issues Found` (exact strings for parsing)

### Malformed Output Handling
- Re-dispatch with format note
- After 2 malformed responses: surface to human

## Evolution History

| Version | Change |
|---|---|
| v5.0.1 | Original with Express/ws/chokidar |
| v5.0.2 | Rebuilt as zero-dependency (custom RFC 6455, fs.watch) |
| v5.0.5 | `.cjs` extension fix for Node 22+ ESM; session-start no longer fires on `--resume` |
| v5.0.6 | Inline self-review replaced subagent review loops (30s vs 25 min, comparable quality); content/state directory split |
| v5.0.7 | GitHub Copilot CLI support; OpenCode bootstrap moved to first user message |

## Analysis — What's valuable for svc

The zero-dependency approach and custom WebSocket implementation demonstrate
how to avoid supply chain risk in agent infrastructure. The two-directory layout
(content vs state) is a clean security pattern (state not HTTP-accessible).
The document review loops (5-iteration limit, malformed output handling) provide
a concrete quality gate implementation.

## L4 Pointers

- Server: `skills/brainstorming/scripts/server.cjs`
- Visual companion guide: `skills/brainstorming/visual-companion.md`
- Helper client: `skills/brainstorming/scripts/helper.js`
- Frame template: `skills/brainstorming/scripts/frame-template.html`
- Start/stop: `skills/brainstorming/scripts/{start,stop}-server.sh`
- Spec reviewer: `skills/brainstorming/spec-document-reviewer-prompt.md`
- Plan reviewer: `skills/writing-plans/plan-document-reviewer-prompt.md`
- Server tests: `tests/brainstorm-server/{server.test.js,ws-protocol.test.js,windows-lifecycle.test.sh}`
