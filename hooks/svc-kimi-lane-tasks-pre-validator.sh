#!/bin/bash
# hooks/kimi/svc-kimi-lane-tasks-pre-validator.sh
#
# PreToolUse hook that blocks invalid lane-tasks edits BEFORE they happen.
# This is the enforcement layer; the PostToolUse validator is audit-only.
#
# Usage (from ~/.kimi/config.toml):
#   [[hooks]]
#   event = "PreToolUse"
#   matcher = "WriteFile|StrReplaceFile"
#   command = "bash ~/.kimi/skills/hooks/kimi/svc-kimi-lane-tasks-pre-validator.sh"
#   timeout = 10

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Read JSON payload from stdin (Kimi PreToolUse protocol)
PAYLOAD=$(cat)

if [ -z "$PAYLOAD" ] || [ "$PAYLOAD" = "{}" ]; then
  exit 0
fi

# Extract tool info from Kimi PreToolUse payload
# Format: { tool_name: "WriteFile", tool_input: { path: "...", content: "..." } }
#    or: { tool_name: "StrReplaceFile", tool_input: { path: "...", edit: { old: "...", new: "..." } } }
TOOL_NAME=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.tool_name || d.tool || '');
")

FILE_PATH=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
console.log(input.path || input.file_path || '');
")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only care about lane-tasks JSON files
if ! echo "$FILE_PATH" | grep -qE '\.svc/lane-tasks-[^/]+\.json$'; then
  exit 0
fi

# Resolve relative path to absolute
if ! [[ "$FILE_PATH" = /* ]]; then
  FILE_PATH="${PWD}/${FILE_PATH}"
fi

# For WriteFile: validate the proposed content directly
if [ "$TOOL_NAME" = "WriteFile" ]; then
  CONTENT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
console.log(input.content || '');
")

  if [ -z "$CONTENT" ]; then
    exit 0
  fi

  # Validate the proposed content
  echo "$CONTENT" | node "$SCRIPT_DIR/hooks/svc-lane-tasks-validate-content.mjs" --stdin "$FILE_PATH"
  exit $?
fi

# For StrReplaceFile: simulate the edit and validate the result
if [ "$TOOL_NAME" = "StrReplaceFile" ]; then
  if [ ! -f "$FILE_PATH" ]; then
    exit 0
  fi

  OLD_TEXT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
const edit = input.edit || {};
console.log(edit.old || '');
")

  NEW_TEXT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
const edit = input.edit || {};
console.log(edit.new || '');
")

  if [ -z "$OLD_TEXT" ]; then
    exit 0
  fi

  # Simulate the edit and validate
  node "$SCRIPT_DIR/hooks/svc-lane-tasks-validate-edit.mjs" "$FILE_PATH" "$OLD_TEXT" "$NEW_TEXT"
  exit $?
fi

exit 0
