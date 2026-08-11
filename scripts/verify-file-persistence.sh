#!/usr/bin/env bash
# verify-file-persistence.sh
# Mechanical guard against WriteFile/StrReplaceFile persistence failures.
# Run after batch file creation to confirm files actually landed on disk.
# Usage: bash scripts/verify-file-persistence.sh <file1> [file2] ...
#        bash scripts/verify-file-persistence.sh --from-git-status
#        bash scripts/verify-file-persistence.sh --from-manifest <manifest.md>
#
# Exit 0: all files exist
# Exit 1: one or more files missing — BLOCK and re-create

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

FILES=()
MODE="args"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-git-status)
      MODE="git-status"
      shift
      ;;
    --from-manifest)
      MODE="manifest"
      MANIFEST="${2:-}"
      if [[ -z "$MANIFEST" ]]; then
        echo "ERROR: --from-manifest requires a path" >&2
        exit 1
      fi
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 <file> [file ...]"
      echo "       $0 --from-git-status"
      echo "       $0 --from-manifest <manifest.md>"
      exit 0
      ;;
    *)
      FILES+=("$1")
      shift
      ;;
  esac
done

case "$MODE" in
  git-status)
    # Check all staged and modified files
    while IFS= read -r line; do
      status="${line:0:2}"
      file="${line:3}"
      # Only check added, modified, or untracked files
      if [[ "$status" =~ ^[AM?] ]]; then
        FILES+=("$file")
      fi
    # Expand untracked directories to their real file entries. The default
    # condensed `?? path/` row is a directory, not a missing persisted file.
    done < <(git status --short --untracked-files=all)
    ;;
  manifest)
    # Extract file paths from a plan-changeset manifest
    if [[ ! -f "$MANIFEST" ]]; then
      echo "ERROR: manifest not found: $MANIFEST" >&2
      exit 1
    fi
    while IFS= read -r file; do
      [[ -n "$file" ]] && FILES+=("$file")
    done < <(grep -oE '^- `[^`]+`' "$MANIFEST" | sed 's/^- `//; s/`$//' | grep -v '^#')
    ;;
esac

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files to verify."
  exit 0
fi

MISSING=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING: $f" >&2
    MISSING=$((MISSING + 1))
  fi
done

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "PERSISTENCE FAILURE: $MISSING file(s) missing after write." >&2
  echo "This usually means WriteFile/StrReplaceFile did not persist to disk." >&2
  echo "Re-create the missing files using Shell-based writes (cat <<'EOF' > file)." >&2
  echo ""
  exit 1
fi

echo "PASS: ${#FILES[@]} file(s) verified on disk."
exit 0
