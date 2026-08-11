#!/usr/bin/env bash
# Probe: is claude CLI available (or are we running inside Claude Code)?
if [[ -n "${CLAUDECODE:-}" || -n "${CLAUDE_CODE_SESSION:-}" ]]; then
  exit 0
fi
command -v claude >/dev/null 2>&1 || exit 1
exit 0
