#!/usr/bin/env bash
# Tier 1 (WI-139): Every WI tagged `landing` or `marketing-page` and in VERIFIED
# state MUST have a side-by-side artifact at docs/specs/landing/<wi-lower>-side-by-side.jpg.
#
# Modes:
#   (default)             Real repo: glob docs/specs/work-items/WI-*.md, exit 0
#                         on full pass (or zero matches), 1 on any miss.
#   --fixture-dir <path>  Self-test: point at a fixture directory containing a
#                         synthetic WI markdown to exercise the negative path.
#   --self-test           Run the validator's bundled positive + negative tests
#                         in sequence; exit 0 only if both behave correctly.
#
# Read-only. Never mutates filesystem.
#
# WI-139
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

WI_DIR="$REPO_ROOT/docs/specs/work-items"
ARTIFACT_DIR="$REPO_ROOT/docs/specs/landing"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--fixture-dir <path>] [--self-test]

  Default: scan real repo work-items and validate each landing/marketing-tagged
           VERIFIED WI has a side-by-side artifact.
  --fixture-dir <path>: scan only the given directory's WI-*.md files.
  --self-test:          run the validator's own bundled positive + negative tests.

Exits 0 on full pass / zero matches. Exits 1 on any miss.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

# Self-test mode: invokes the validator twice with carefully arranged fixtures
if [[ "${1:-}" == "--self-test" ]]; then
  echo "Self-test 1: positive path against real repo"
  if ! "$0"; then
    echo "FAIL: real-repo positive path failed unexpectedly"
    exit 1
  fi
  echo "OK: positive path"

  echo "Self-test 2: negative path against fixture (expects exit 1)"
  FIX="$REPO_ROOT/test-framework/fixtures/wi139-empty-landing-dir"
  if [[ ! -d "$FIX" ]]; then
    echo "FAIL: fixture not present at $FIX"
    exit 1
  fi
  set +e
  "$0" --fixture-dir "$FIX" >/dev/null 2>&1
  rc=$?
  set -e
  if [[ "$rc" -eq 0 ]]; then
    echo "FAIL: negative path returned 0 (should have detected missing artifact)"
    exit 1
  fi
  echo "OK: negative path correctly returned $rc"
  echo "PASS: self-test"
  exit 0
fi

# Optional: --fixture-dir scopes the WI scan
if [[ "${1:-}" == "--fixture-dir" ]]; then
  WI_DIR="${2:-}"
  if [[ -z "$WI_DIR" || ! -d "$WI_DIR" ]]; then
    echo "FAIL: --fixture-dir requires a real directory" >&2
    exit 2
  fi
  shift 2
fi

if [[ ! -d "$WI_DIR" ]]; then
  echo "no work-items dir at $WI_DIR — skipping (vacuously pass)"
  exit 0
fi

MATCH=0
MISS=0
LANDING_VERIFIED=()

shopt -s nullglob
for wi in "$WI_DIR"/WI-*.md; do
  # Tags + Status detection (case-insensitive on values)
  tags="$(grep -iE '^\*\*Tags:\*\*' "$wi" | head -1 || true)"
  status="$(grep -iE '^\*\*Status:\*\*' "$wi" | head -1 || true)"
  [[ -z "$status" ]] && continue
  if ! echo "$status" | grep -qiE 'VERIFIED'; then continue; fi
  if [[ -z "$tags" ]]; then continue; fi
  if ! echo "$tags" | grep -qiE 'landing|marketing-page'; then continue; fi

  MATCH=$((MATCH + 1))
  wi_id="$(basename "$wi" .md | tr 'A-Z' 'a-z')"   # WI-139 -> wi-139
  artifact="$ARTIFACT_DIR/${wi_id}-side-by-side.jpg"
  if [[ -f "$artifact" ]]; then
    LANDING_VERIFIED+=("OK $wi_id $artifact")
  else
    LANDING_VERIFIED+=("MISS $wi_id $artifact")
    MISS=$((MISS + 1))
  fi
done

if [[ "$MATCH" -eq 0 ]]; then
  echo "no landing/marketing-page-tagged VERIFIED WIs found in $WI_DIR — skipping reachability check"
  exit 0
fi

for line in "${LANDING_VERIFIED[@]}"; do
  echo "$line"
done

echo "---"
echo "Landing-tagged VERIFIED WIs: $MATCH  |  Missing artifacts: $MISS"

if [[ "$MISS" -gt 0 ]]; then
  echo "FAIL: $MISS landing-tagged VERIFIED WI(s) lack their side-by-side artifact at $ARTIFACT_DIR/<wi-lower>-side-by-side.jpg" >&2
  echo "Each WI must run benchmark-landing Step 0b BEFORE being marked VERIFIED. See WI-139." >&2
  exit 1
fi
exit 0
