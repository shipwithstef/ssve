#!/usr/bin/env bash
# install-browse.sh — idempotent browse daemon setup
# Run automatically after svc framework install. Safe to re-run at any time.
# Part of svc post_install_commands (provision/hosts/claude.json + codex.json)

set -e

BROWSE_BIN="$HOME/gstack/browse/dist/browse"
LINK_TARGET="$HOME/.local/bin/browse"

# These are the only two host surfaces this optional installer owns. Refuse
# symlinked ancestry before mkdir/clone/link so setup's deferred shared phase
# cannot be redirected outside HOME.
python3 - "$HOME" "$HOME/gstack" "$HOME/gstack/browse" "$HOME/gstack/browse/dist" "$BROWSE_BIN" "$LINK_TARGET" <<'PY_BROWSE_TARGETS'
import os, pathlib, stat, sys
home = pathlib.Path(sys.argv[1]).resolve()
for raw in sys.argv[2:]:
    target = pathlib.Path(raw)
    replaceable_leaf = target == pathlib.Path(sys.argv[-1])
    try: parts = target.relative_to(home).parts
    except ValueError: raise SystemExit(f"browse target escapes HOME: {target}")
    current = home
    for part in parts:
        current /= part
        try: mode = os.lstat(current).st_mode
        except FileNotFoundError: break
        if stat.S_ISLNK(mode) and replaceable_leaf and current == target: break
        if stat.S_ISLNK(mode): raise SystemExit(f"browse target ancestry contains symlink: {current}")
        if current != target and not stat.S_ISDIR(mode): raise SystemExit(f"browse target ancestor is not a directory: {current}")
PY_BROWSE_TARGETS

browse_healthy() {
  # Check the known binary path first — avoids hitting system 'browse' (xdg-open on Linux)
  if [ -f "$BROWSE_BIN" ]; then
    "$BROWSE_BIN" status 2>&1 | grep -q "Status: healthy"
    return $?
  fi
  # Fall back to PATH only if binary doesn't exist at known location
  command -v browse &>/dev/null && browse status 2>&1 | grep -q "Status: healthy"
}

# Step 1: Already installed and healthy?
if browse_healthy; then
  # Always wire PATH if binary exists at known location.
  # On Linux, 'command -v browse' may resolve to xdg-open — check the actual
  # symlink target instead of trusting command -v.
  if [ -f "$BROWSE_BIN" ]; then
    CURRENT_LINK=$(readlink "$LINK_TARGET" 2>/dev/null || echo "")
    if [ "$CURRENT_LINK" != "$BROWSE_BIN" ]; then
      mkdir -p "$HOME/.local/bin"
      ln -sfn "$BROWSE_BIN" "$LINK_TARGET"
      echo "✅ browse healthy — wired to PATH: $LINK_TARGET → $BROWSE_BIN"
    else
      echo "✅ browse already installed and healthy"
    fi
  fi
  exit 0
fi

# Step 2: Binary exists at known location but not in PATH
if [ -f "$BROWSE_BIN" ]; then
  echo "✅ Found browse at $BROWSE_BIN — wiring to PATH..."
  mkdir -p "$HOME/.local/bin"
  ln -sfn "$BROWSE_BIN" "$LINK_TARGET"
  if "$BROWSE_BIN" status 2>&1 | grep -q "Status: healthy"; then
    echo "✅ browse wired and healthy"
  else
    echo "⚠️  browse binary exists but status check failed — Chromium may be missing"
    echo "   Run: npx playwright install chromium"
  fi
  exit 0
fi

# Step 3: gstack repo exists but binary not compiled
if [ -d "$HOME/gstack/browse" ]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "⚠️  browse source exists but bun is not on PATH — skipping optional browse build"
    echo "   Install bun, then re-run: bash scripts/install-browse.sh"
    exit 0
  fi
  echo "⚙️  Building browse from ~/gstack/browse..."
  cd "$HOME/gstack/browse"
  bun install
  bun build --compile src/cli.ts --outfile dist/browse
  mkdir -p "$HOME/.local/bin"
  ln -sfn "$BROWSE_BIN" "$LINK_TARGET"
  echo "✅ Built and linked"
  "$BROWSE_BIN" status
  exit 0
fi

# Step 4: Full install — gstack not cloned yet
if [ "${SVC_INSTALL_BROWSE_ALLOW_NETWORK:-0}" != "1" ]; then
  echo "⚠️  browse is optional and not installed; skipping network install"
  echo "   To install it, re-run with: SVC_INSTALL_BROWSE_ALLOW_NETWORK=1 bash scripts/install-browse.sh"
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "⚠️  git is required to install optional browse"
  exit 0
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "⚠️  bun is required to build optional browse"
  exit 0
fi

echo "⚙️  Cloning gstack (browse only)..."
git clone --filter=blob:none --sparse https://github.com/garrytan/gstack.git "$HOME/gstack"
cd "$HOME/gstack"
git sparse-checkout set browse
cd browse

# Ensure Playwright Chromium is available (best-effort, non-fatal)
npx playwright install chromium --with-deps 2>/dev/null || true

bun install
bun build --compile src/cli.ts --outfile dist/browse

mkdir -p "$HOME/.local/bin"
ln -sfn "$BROWSE_BIN" "$LINK_TARGET"
echo "✅ browse installed and linked"
"$BROWSE_BIN" status
