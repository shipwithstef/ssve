#!/bin/bash
# scripts/detect-host.sh — Detect which AI CLI host is currently running this session.
#
# Usage:
#   bash scripts/detect-host.sh              # prints host name (claude|kimi|codex|gemini|opencode|antigravity|cursor|mimo-code|grok|unknown)
#   bash scripts/detect-host.sh --json       # prints JSON with host + confidence
#   bash scripts/detect-host.sh --quiet      # exit code only (0=detected, 1=unknown)
#
# Detection order:
#   1. Parent process name (most reliable)
#   2. Host-specific environment variables
#   3. Recently modified session files in host directories

set -euo pipefail

MODE="${1:-}"

# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------

detect_by_parent_process() {
  local pid="$PPID"
  local max_depth=10
  local depth=0

  while [ "$pid" -gt 1 ] && [ "$depth" -lt "$max_depth" ]; do
    local comm
    comm="$(ps -o comm= "$pid" 2>/dev/null | tr -d '[:space:]')" || true

    case "$comm" in
      *Kimi*Code*) echo "kimi" ; return 0 ;;
      *mimocode*|*MiMo*Code*|*mimo-code*) echo "mimo-code" ; return 0 ;;
      *claude*)    echo "claude" ; return 0 ;;
      *codex*)     echo "codex" ; return 0 ;;
      *gemini*)    echo "gemini" ; return 0 ;;
      *opencode*)  echo "opencode" ; return 0 ;;
      *antigravity*) echo "antigravity" ; return 0 ;;
      *cursor*|*cursor-agent*|agent)    echo "cursor" ; return 0 ;;
      *grok*|*grok-build*|*grok-cli*)   echo "grok" ; return 0 ;;
    esac

    # Move up to parent
    pid="$(ps -o ppid= "$pid" 2>/dev/null | tr -d '[:space:]')" || break
    depth=$((depth + 1))
  done

  return 1
}

detect_by_env() {
  if [[ "${SVC_HOST:-}" =~ ^(claude|kimi|codex|gemini|opencode|antigravity|cursor|mimo-code|grok)$ ]]; then
    echo "$SVC_HOST"
    return 0
  fi

  # Kimi sets KIMI_WORK_DIR via system prompt variables
  if [ -n "${KIMI_WORK_DIR:-}" ]; then
    echo "kimi"
    return 0
  fi

  # Claude Code
  if [ -n "${CLAUDE_CODE_SSE_PORT:-}" ]; then
    echo "claude"
    return 0
  fi

  # Codex CLI / app. The Windows desktop app launches some WSL PTYs with
  # PPID=1, so parent-process detection can fail; CODEX_HOME and
  # CODEX_THREAD_ID are still present in that environment.
  if [ -n "${CODEX_CLI:-}" ] || [ -n "${CODEX_API_KEY:-}" ] || [ -n "${CODEX_HOME:-}" ] || [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_CI:-}" ]; then
    echo "codex"
    return 0
  fi

  # Gemini CLI
  if [ -n "${GEMINI_CLI_IDE_SERVER_PORT:-}" ]; then
    echo "gemini"
    return 0
  fi

  # OpenCode CLI
  if [ -n "${OPENCODE:-}" ]; then
    echo "opencode"
    return 0
  fi

  # Grok Build CLI
  if [ -n "${GROK_CLI:-}" ] || [ -n "${GROK_HOME:-}" ] || [ -n "${GROK_SESSION_ID:-}" ] || [ -n "${XAI_API_KEY:-}" ]; then
    echo "grok"
    return 0
  fi

  # Cursor / Antigravity best-effort markers. Prefer SVC_HOST when available;
  # these CLIs do not yet have a stable documented env contract in svc.
  if [ -n "${CURSOR_TRACE_ID:-}" ] || [ -n "${CURSOR_AGENT:-}" ]; then
    echo "cursor"
    return 0
  fi
  if [ -n "${ANTIGRAVITY:-}" ]; then
    echo "antigravity"
    return 0
  fi

  return 1
}

detect_by_session_files() {
  # Fallback: check for recent session activity in host directories
  local now
  now=$(date +%s)

  # Kimi sessions in ~/.kimi/sessions/
  if [ -d "$HOME/.kimi/sessions" ]; then
    local latest_kimi
    latest_kimi=$(find "$HOME/.kimi/sessions" -type d -mindepth 1 -maxdepth 1 -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -n "$latest_kimi" ]; then
      local mtime
      mtime=$(stat -c %Y "$latest_kimi" 2>/dev/null || stat -f %m "$latest_kimi" 2>/dev/null)
      if [ -n "$mtime" ] && [ "$((now - mtime))" -lt 300 ]; then
        echo "kimi"
        return 0
      fi
    fi
  fi

  # Claude sessions in ~/.claude/
  if [ -d "$HOME/.claude" ]; then
    local latest_claude
    latest_claude=$(find "$HOME/.claude" -type f -mmin -5 2>/dev/null | head -1)
    if [ -n "$latest_claude" ]; then
      echo "claude"
      return 0
    fi
  fi

  return 1
}

# ---------------------------------------------------------------------------
# Main detection
# ---------------------------------------------------------------------------

HOST="unknown"
METHOD="none"

if [[ "${SVC_HOST:-}" =~ ^(claude|kimi|codex|gemini|opencode|antigravity|cursor|mimo-code|grok)$ ]]; then
  HOST="$SVC_HOST"
  METHOD="env_var"
elif detect_by_parent_process >/dev/null 2>&1; then
  HOST="$(detect_by_parent_process)"
  METHOD="parent_process"
elif detect_by_env >/dev/null 2>&1; then
  HOST="$(detect_by_env)"
  METHOD="env_var"
elif detect_by_session_files >/dev/null 2>&1; then
  HOST="$(detect_by_session_files)"
  METHOD="session_files"
fi

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

case "$MODE" in
  --json)
    cat <<EOF
{
  "host": "$HOST",
  "method": "$METHOD",
  "ppid": $PPID,
  "detected_at": "$(date -Iseconds)"
}
EOF
    ;;
  --quiet)
    if [ "$HOST" = "unknown" ]; then
      exit 1
    fi
    exit 0
    ;;
  *)
    echo "$HOST"
    ;;
esac
