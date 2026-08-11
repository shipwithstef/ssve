# Framework Evolution — 2026-04-14: Browse Daemon Auto-Install on Setup

## Method

Evidence gathered from:
- Live session: `browse status` → hit `xdg-open` (wrong binary, not in PATH)
- `~/gstack/browse/dist/browse status` → "Status: healthy" (installed but not wired)
- `provision/hosts/claude.json` and `provision/hosts/codex.json` — no browse check
- `references/browse-integration.md` — already corrected to point at `~/gstack/browse/dist/browse` (proposal done/2026-04-13-browse-integration-source-fix.md)
- `scripts/` directory — no install-browse script exists

## Root Cause

The provision host configs define `verify_commands` that confirm svc infra files exist, but **nothing checks browse daemon installation or PATH wiring**. Result: every agent session runs `browse status`, hits the system `browse` (which on Linux is `xdg-open`), gets a confusing error, and silently falls back to heavier Playwright MCP. Browse is installed at `~/gstack/browse/dist/browse` and works — it just isn't wired to PATH.

This is a **setup gap that reproduces on every fresh machine and every new host**. It has already burned at least one full session of confusion (2026-04-14 track-visuals investigation).

## Findings

### P0 — Fix now (blocks quality)

**Finding: No browse install/PATH check in setup sequence**

- `provision/hosts/claude.json:33-38` — `verify_commands` only checks svc infra files. No browse check.
- `provision/hosts/codex.json:33-37` — same omission.
- `scripts/` — no `install-browse.sh` or equivalent exists.
- `references/browse-integration.md:26-29` — says "Step 0: Check if already installed" with `browse status`, but the system `browse` on Linux resolves to `xdg-open`, silently masking that gstack browse isn't in PATH.

**Impact:** Every `test-journeys`, `track-visuals`, and `verify-promotion` run falls back to Playwright MCP (higher token cost, no auth persistence, cold-start per session) because the PATH check passes the wrong binary. The agent believes browse isn't installed when it actually is.

**Fix — two parts:**

**Part 1: `scripts/install-browse.sh`** — idempotent script, safe to run multiple times:

```bash
#!/usr/bin/env bash
set -e

BROWSE_BIN="$HOME/gstack/browse/dist/browse"
LINK_TARGET="$HOME/.local/bin/browse"

# Step 1: Check if already in PATH and correct binary
if command -v browse &>/dev/null; then
  if browse status 2>&1 | grep -q "Status: healthy"; then
    echo "✅ browse daemon already installed and healthy"
    exit 0
  fi
fi

# Step 2: Check if binary exists at known location
if [ -f "$BROWSE_BIN" ]; then
  echo "✅ Found browse at $BROWSE_BIN — wiring to PATH"
  mkdir -p "$HOME/.local/bin"
  ln -sf "$BROWSE_BIN" "$LINK_TARGET"
  echo "✅ Symlinked: $LINK_TARGET → $BROWSE_BIN"
  browse status
  exit 0
fi

# Step 3: Build from source (gstack repo exists but binary not compiled)
if [ -d "$HOME/gstack/browse" ]; then
  echo "⚙️  Building browse from ~/gstack/browse..."
  cd "$HOME/gstack/browse"
  bun install && bun build --compile src/cli.ts --outfile dist/browse
  mkdir -p "$HOME/.local/bin"
  ln -sf "$BROWSE_BIN" "$LINK_TARGET"
  echo "✅ Built and linked"
  browse status
  exit 0
fi

# Step 4: Full install (gstack not cloned)
echo "⚙️  Cloning gstack (browse only)..."
git clone --filter=blob:none --sparse https://github.com/garrytan/gstack.git "$HOME/gstack"
cd "$HOME/gstack" && git sparse-checkout set browse
cd browse
# Ensure Playwright Chromium is available
npx playwright install chromium --with-deps 2>/dev/null || true
bun install && bun build --compile src/cli.ts --outfile dist/browse
mkdir -p "$HOME/.local/bin"
ln -sf "$BROWSE_BIN" "$LINK_TARGET"
echo "✅ Installed and linked"
browse status
```

**Part 2: Add to host configs** — `provision/hosts/claude.json` and `provision/hosts/codex.json`:

```json
"post_install_commands": [
  "bash {skills_path}/scripts/install-browse.sh"
],
"verify_commands": [
  "test -f {skills_path}/route-workflow/SKILL.md",
  "test -f {skills_path}/DOCTRINE.md",
  "test -f {skills_path}/skills-manifest.json",
  "test -f {skills_path}/scripts/worktree.sh",
  "browse status 2>&1 | grep -q 'Status: healthy'"
]
```

The `post_install_commands` run once after skills are synced. `verify_commands` now include a browse health check so a broken setup is caught immediately, not discovered mid-session.

**Also fix `references/browse-integration.md:Step 0`** — current text says `browse status` but on Linux this hits `xdg-open`. Change Step 0 to:

```bash
# Step 0: Check if already installed and healthy
# Note: plain 'browse' may resolve to xdg-open on Linux — check full path first
~/gstack/browse/dist/browse status 2>/dev/null || browse status 2>/dev/null
```

## Comparison Delta

gstack's own setup likely handles this in its install script — we're pulling browse as a dependency, not as a first-class install target. The gap is that svc treats browse as "available if the agent finds it" rather than "required infrastructure that setup must provision."

## Stale Proposal Audit

- `done/2026-04-13-browse-integration-source-fix.md` — implemented the reference doc correction (wrong GitHub URL → correct local path). **This proposal is the next step**: wire the install into setup so it never needs manual correction again.
- No other pending proposals on browse or setup automation found.
