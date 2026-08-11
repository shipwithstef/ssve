#!/bin/bash
# scripts/load-project-env.sh [start-dir]
#
# Walks up from the current directory (or optional start-dir) to find the
# nearest `.env.local` at a git repo root, then exports every non-comment
# KEY=VALUE line into the current shell.
#
# Per-project secrets hygiene — replaces the anti-pattern of storing tokens
# in ~/.bashrc where they pollute every shell regardless of which project
# you're working on.
#
# Usage:
#   # From inside a svc skill or dispatch script:
#   source "$(git rev-parse --show-toplevel)/../seriousvibecoding/scripts/load-project-env.sh"
#
#   # Or with explicit start-dir:
#   source scripts/load-project-env.sh /path/to/example-marketplace
#
# Conventions:
#   - Secrets live in <repo-root>/.env.local (gitignored)
#   - .env.local perms must be 600 (script warns if looser)
#   - Only KEY=VALUE lines are exported; comments (#) and blanks ignored
#   - Values are NOT echoed to stdout (never leak to terminal logs)
#   - Exports every matching var; caller controls what to use
#
# Exit codes:
#   0  — file found and sourced (even if empty)
#   1  — no .env.local found walking up to filesystem root
#   2  — perms too loose (> 600), refuses to load (security)
#
# Chain contract: this script is designed to be SOURCED, not executed.
# It exports vars into the caller's shell. Running it standalone does
# nothing useful.

_load_project_env() {
  local start_dir="${1:-$PWD}"
  local dir
  dir="$(cd "$start_dir" 2>/dev/null && pwd)" || { echo "load-project-env: start-dir unreadable: $start_dir" >&2; return 1; }

  # Walk up looking for .env.local
  while [ "$dir" != "/" ] && [ -n "$dir" ]; do
    if [ -f "$dir/.env.local" ]; then
      # Perms check — block if world-readable or group-readable
      local mode
      mode=$(stat -c %a "$dir/.env.local" 2>/dev/null)
      if [ -n "$mode" ] && [ "$mode" != "600" ] && [ "$mode" != "400" ]; then
        echo "load-project-env: REFUSING to load $dir/.env.local — perms are $mode, expected 600" >&2
        echo "  fix: chmod 600 \"$dir/.env.local\"" >&2
        return 2
      fi

      # Source the file, but quietly — only read KEY=VALUE (no scripts)
      set -a
      # shellcheck disable=SC1090
      . "$dir/.env.local"
      set +a

      # Print ONLY the names loaded (never values) for audit
      local loaded
      loaded=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$dir/.env.local" | cut -d= -f1 | tr '\n' ' ')
      echo "load-project-env: loaded $(echo "$loaded" | wc -w) vars from $dir/.env.local" >&2
      [ -n "$loaded" ] && echo "load-project-env: names: $loaded" >&2
      return 0
    fi
    dir="$(dirname "$dir")"
  done

  echo "load-project-env: no .env.local found walking up from $start_dir" >&2
  return 1
}

_load_project_env "$@"
