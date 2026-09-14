#!/usr/bin/env bash
# Tier 1 — research skill mode-detection gate.
#
# When a research invocation logs a topic that LOOKS like a URL or repo identifier,
# Analysis Mode is required → there must be a corresponding pre-scope artifact.
#
# Failure mode this prevents: agent runs Question Mode on a URL input, skipping
# pre-scope + coverage check, leading to incomplete extraction with no audit trail.
# Observed 2026-05-03 (legalconsult.bg run).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PIPELINE_LOG="$REPO_ROOT/.svc/pipeline-decisions.jsonl"
PRESCOPE_DIR="$REPO_ROOT/docs/specs"

if [[ ! -f "$PIPELINE_LOG" ]]; then
  echo "  validate-research-mode-detection: no .svc/pipeline-decisions.jsonl (PASS by vacuous-truth)"
  exit 0
fi

PASS=0
FAIL=0
ERRORS=""

# Extract every research invocation receipt
while IFS= read -r line; do
  topic=$(echo "$line" | grep -oE '"topic":"[^"]*"' | head -1 | sed 's/"topic":"//;s/"$//') || continue
  mode=$(echo "$line" | grep -oE '"mode":"[^"]*"' | head -1 | sed 's/"mode":"//;s/"$//') || continue

  [[ -z "$topic" ]] && continue

  # Heuristic: topic looks like a URL or domain if it contains "://", ".bg", ".com", ".io", ".app"
  # OR ends in -bg / -ai etc, OR looks like a single-word repo name
  is_url=0
  if [[ "$topic" =~ ^https?:// ]] || [[ "$topic" =~ \.(bg|com|io|app|org|net|eu)([/-]|$) ]]; then
    is_url=1
  fi

  [[ $is_url -eq 0 ]] && continue

  # URL-shaped topic → expect a prescope file with a slug derived from the topic
  slug=$(echo "$topic" | sed -E 's|https?://||; s|[^a-z0-9]+|-|gi; s|^-||; s|-$||' | tr '[:upper:]' '[:lower:]')
  found=0
  for f in "$PRESCOPE_DIR"/research-prescope-*.md; do
    [[ -f "$f" ]] || continue
    bn=$(basename "$f" .md)
    if [[ "$bn" == *"$slug"* ]] || grep -qF "$topic" "$f" 2>/dev/null; then
      found=1
      break
    fi
  done

  if [[ $found -eq 1 ]]; then
    PASS=$((PASS+1))
  else
    ERRORS+="  FAIL: research invocation on URL-shaped topic '$topic' (mode='$mode') has no pre-scope artifact in $PRESCOPE_DIR/. Analysis Mode requires pre-scope.\n"
    FAIL=$((FAIL+1))
  fi
done < <(grep '"skill":"research"' "$PIPELINE_LOG" 2>/dev/null | grep '"event":"skill_invocation"' || true)

echo "  validate-research-mode-detection: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
