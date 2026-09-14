#!/usr/bin/env bash
# svc-gemini-context-check.sh — pre-flight context-budget check for Gemini CLI.
#
# Enforces framework gap G1 from proposal
# 2026-04-19-session-audit-gemini-wi085-playwright-session.md.
#
# When running on Gemini CLI, context-heavy skills (write-e2e, execute-changeset,
# diagnose-bug, improve-framework) MUST check session-size before proceeding.
# Gemini's attention window degrades past 2.5 MB and collapses past 4 MB;
# without /compress + re-anchor, multi-file refactors and verification loops
# silently lose track of context (e.g., WI-085's 40-minute "is it deployed yet?"
# flailing because the deploy status fell out of attention).
#
# Usage (manual):
#   bash hooks/svc-gemini-context-check.sh
#
# Usage (hook):
#   matcher: "Skill"
#   command: "bash hooks/svc-gemini-context-check.sh"
#
# Exit codes:
#   0 — GOOD tier (< 1.5 MB) OR not running on Gemini CLI
#   0 + warning — WARN tier (1.5–2.5 MB)
#   0 + warning — DEGRADING tier (2.5–4 MB)
#   1 — POOR tier (> 4 MB) — BLOCK, force agent to /compress first

set -u

# Detect Gemini CLI: presence of ~/.gemini/tmp/ with chat sessions
GEMINI_CHATS_ROOT="${HOME}/.gemini/tmp"
if [ ! -d "$GEMINI_CHATS_ROOT" ]; then
  # Not running on Gemini (or Gemini not installed) — no-op
  exit 0
fi

# Find the most recent chat session for the current working directory's project
# Gemini hashes the cwd into a dir name; use the repo basename as a fallback.
REPO_NAME=$(basename "$(git -C "$(pwd)" rev-parse --show-toplevel 2>/dev/null || pwd)")

# Largest recently-modified session JSON across all gemini tmp dirs (last 2h)
LATEST_SESSION=$(find "$GEMINI_CHATS_ROOT" -maxdepth 4 -name "*.json" -mmin -120 2>/dev/null \
  | xargs -r ls -S 2>/dev/null \
  | head -1)

if [ -z "$LATEST_SESSION" ] || [ ! -f "$LATEST_SESSION" ]; then
  # No active Gemini session detected — not running on Gemini, or first session
  exit 0
fi

# Size in bytes
SIZE_BYTES=$(stat -c '%s' "$LATEST_SESSION" 2>/dev/null || echo 0)
SIZE_MB=$(awk "BEGIN { printf \"%.1f\", $SIZE_BYTES / 1048576 }")

# Tier thresholds (in bytes)
GOOD_CEIL=1572864    # 1.5 MB
WARN_CEIL=2621440    # 2.5 MB
DEGRADING_CEIL=4194304  # 4 MB

if [ "$SIZE_BYTES" -lt "$GOOD_CEIL" ]; then
  # GOOD — silent pass
  exit 0
fi

if [ "$SIZE_BYTES" -lt "$WARN_CEIL" ]; then
  cat >&2 <<EOF
⚠️  svc-gemini-context-check: WARN tier — session at ${SIZE_MB} MB
   (${LATEST_SESSION##*/})
   Finish the current micro-task, then run /compress before the next heavy
   file read or multi-file refactor. See references/gemini-context-budget.md.
EOF
  exit 0
fi

if [ "$SIZE_BYTES" -lt "$DEGRADING_CEIL" ]; then
  cat >&2 <<EOF
⚠️⚠️ svc-gemini-context-check: DEGRADING tier — session at ${SIZE_MB} MB
   (${LATEST_SESSION##*/})
   STOP accumulating. Run /compress IMMEDIATELY. After compress, re-anchor
   by reading: FRAMEWORK-STATE.md → project-state.md → active WI file →
   lane-tasks → task files. Multi-file refactors are HIGH RISK from here.
   See references/gemini-context-budget.md § Mandatory /compress Triggers.
EOF
  exit 0
fi

# POOR — hard block
cat >&2 <<EOF
❌ svc-gemini-context-check: POOR tier — session at ${SIZE_MB} MB
   (${LATEST_SESSION##*/})
   BLOCKING this operation. Do NOT attempt multi-file refactors, content
   audits, or cross-artifact comparisons at this context size. Gemini's
   effective attention window is collapsed.

   Required actions:
     1. Commit any work-in-progress
     2. Exit the current session
     3. Start a fresh Gemini CLI session
     4. Re-anchor by reading L1 → L2 → L3 → L4 (see
        references/gemini-context-budget.md)
     5. Resume from .svc/lane-tasks-<WI>.json

   This is the WI-085 failure mode: 40 minutes of flailing because
   "did you deploy yet?" fell out of effective attention while
   debugging test timeouts. The fix is a fresh session, not more effort.

   To bypass (NOT recommended — at your own risk):
     SVC_GEMINI_CONTEXT_BYPASS=1
EOF

if [ "${SVC_GEMINI_CONTEXT_BYPASS:-0}" = "1" ]; then
  echo "   (bypass set — proceeding, but failure mode likely)" >&2
  exit 0
fi

exit 1
