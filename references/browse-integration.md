# Browse Daemon Integration

svc uses gstack's browse daemon (MIT licensed) as the primary browser
infrastructure for agentic QA. All browser-dependent skills prefer it over
Playwright MCP.

## Why Browse Over Playwright MCP

| | Browse daemon | Playwright MCP |
|---|---|---|
| Startup | Persistent daemon — ~100ms per command after first launch | Cold-start per session |
| State | Cookies/localStorage persist across commands | Fresh context each session |
| Token cost | 1 Bash tool call per action | 1 MCP tool call per action + schema overhead |
| Auth flow | Login once, stays logged in | Re-authenticate every session |
| Snapshot | `snapshot -i` → ref-based ARIA tree (@e1, @e2) | `browser_snapshot` → similar but heavier |
| Screenshot | `screenshot <path>` → one command | `browser_take_screenshot` → one tool call |

## Setup

The browse daemon lives in [garrytan/gstack](https://github.com/garrytan/gstack).
You do NOT need the full gstack suite — sparse-checkout `browse` only.

### Step 0: Check if already installed

```bash
# Always check the known binary path first.
# On Linux, plain 'browse' resolves to xdg-open — not the gstack daemon.
~/gstack/browse/dist/browse status 2>/dev/null \
  || browse status 2>/dev/null \
  || echo "browse not found — run scripts/install-browse.sh"
# Expected: "Status: healthy"
```

If you see `Status: healthy`, you're done. Skip the install steps below.

**Easier:** just run `bash ~/.claude/skills/scripts/install-browse.sh` — it
handles all cases idempotently (binary exists but not in PATH, needs building,
needs full clone).

### Install: run the install script (recommended)

```bash
bash ~/.claude/skills/scripts/install-browse.sh
```

The script handles all cases: binary exists but not in PATH, needs building
from `~/gstack`, or needs full clone. Safe to re-run.

**Manual install (if script unavailable):**

```bash
# Clone only the browse directory — do NOT clone the full gstack repo
git clone --filter=blob:none --sparse https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && git sparse-checkout set browse

# Build (requires Bun)
cd browse && bun install && bun build --compile src/cli.ts --outfile dist/browse

# Add to PATH
ln -sf ~/gstack/browse/dist/browse ~/.local/bin/browse
```

### Runtime requirements

- **Chromium**: browse uses Playwright's bundled Chromium. If not present, run:
  ```bash
  npx playwright install chromium
  ```
- **No other dependencies** — the binary is self-contained (compiled Bun)

### Verify

```bash
browse status
# Expected: "Status: healthy" (daemon auto-starts on first command)
```

## Command Reference (what skills actually call)

| Action | Browse CLI | Playwright MCP equivalent |
|--------|-----------|--------------------------|
| Navigate | `browse goto <url>` | `browser_navigate` |
| Screenshot | `browse screenshot <path>` | `browser_take_screenshot` |
| Snapshot (ARIA tree) | `browse snapshot -i` | `browser_snapshot` |
| Click by ref | `browse click @e3` | `browser_click ref=e3` |
| Click by selector | `browse click 'button[title*="Theme"]'` | `browser_click` with selector |
| Fill input | `browse fill @e4 "value"` | `browser_fill_form` |
| Type text | `browse type "text"` | `browser_type` |
| Run JS | `browse js 'expression'` | `browser_evaluate` |
| Viewport resize | `browse viewport 375x812` | `browser_resize` |
| Wait | `browse wait --networkidle` | `browser_wait_for` |
| Console errors | `browse console --errors` | `browser_console_messages` |
| Page URL | `browse url` | (read from tool result) |
| Responsive suite | `browse responsive <prefix>` | (manual resize + screenshot loop) |

## Tool Priority Order (for all browser-using skills)

1. **Browse tool** (`browse` CLI) — persistent daemon, lowest token cost, state persists
2. **Playwright MCP** — functional fallback when browse is not installed
3. **Manual browser** — instruct user to perform actions and paste screenshots

## Which Skills Use Browse

| Skill | How |
|-------|-----|
| `test-journeys` | Navigate flows, click through scenarios, capture evidence |
| `track-visuals` | Screenshot all screens at multiple breakpoints |
| `verify-promotion` | Post-deploy canary screenshots |
| `test-framework` | Browse-based scenario replay |

**Does NOT apply to:** `write-e2e` — that skill generates Playwright `.spec.ts`
test files. Its output IS Playwright code, so it stays Playwright-oriented.
