#!/bin/bash
# scripts/kill-stale-bg.sh [--dry-run]
#
# Finds and optionally kills stale Claude-Code-spawned background bash loops
# (the `until [ -f /tmp/claude-1000/... ]` polling pattern) and orphan
# opencode/codex/gemini subprocesses.
#
# Without --dry-run, kills all matching processes.
# With    --dry-run, lists them only.
#
# Usage:
#   bash scripts/kill-stale-bg.sh --dry-run
#   bash scripts/kill-stale-bg.sh
#
# Patterns killed:
#   - bash processes running `until [ -f /tmp/claude-1000` (polling loops)
#   - opencode/codex/gemini processes older than 10 minutes
#   - vite dev servers not tied to any active user shell
set -u

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

report() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "WOULD KILL: $1"
  else
    echo "KILLED: $1"
  fi
}

# Pattern 1: the chained-until-loop polling zombies
PIDS=$(pgrep -f "until \[ -f /tmp/claude-1000" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  for pid in $PIDS; do
    cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 120)
    report "poll-loop pid=$pid cmd=$cmd"
    [ "$DRY_RUN" -eq 0 ] && kill -TERM "$pid" 2>/dev/null
  done
fi

# Pattern 2: long-running subagent subprocesses (>10m)
for pat in "opencode run" "codex exec" "gemini -y -p" "gemini generalist"; do
  PIDS=$(pgrep -f "$pat" 2>/dev/null || true)
  for pid in $PIDS; do
    elapsed_s=$(ps -p "$pid" -o etimes= 2>/dev/null | tr -d ' ')
    [ -z "$elapsed_s" ] && continue
    if [ "$elapsed_s" -gt 600 ] 2>/dev/null; then
      cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 120)
      report "stale-subagent pid=$pid elapsed=${elapsed_s}s cmd=$cmd"
      [ "$DRY_RUN" -eq 0 ] && kill -TERM "$pid" 2>/dev/null
    fi
  done
done

# Pattern 3: orphan vite/next dev servers (no controlling tty)
for pat in "vite.*--port\|node.*vite" "next dev"; do
  PIDS=$(pgrep -f "$pat" 2>/dev/null || true)
  for pid in $PIDS; do
    tty=$(ps -p "$pid" -o tty= 2>/dev/null | tr -d ' ')
    if [ -z "$tty" ] || [ "$tty" = "?" ]; then
      elapsed_s=$(ps -p "$pid" -o etimes= 2>/dev/null | tr -d ' ')
      [ -z "$elapsed_s" ] && continue
      if [ "$elapsed_s" -gt 600 ] 2>/dev/null; then
        cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 100)
        report "orphan-dev-server pid=$pid elapsed=${elapsed_s}s cmd=$cmd"
        [ "$DRY_RUN" -eq 0 ] && kill -TERM "$pid" 2>/dev/null
      fi
    fi
  done
done

# Summary
if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "Dry-run complete. Run without --dry-run to kill."
else
  echo ""
  echo "Cleanup complete."
fi
