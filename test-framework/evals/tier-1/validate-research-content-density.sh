#!/usr/bin/env bash
# Tier 1 — research skill content-density gate.
#
# When a knowledge domain claims "deep extraction" but the persisted detail
# files are tiny relative to the source URL count, that's a strong signal
# the agent skimmed the pages — likely missed accordion/tab/JS-rendered
# content. This validator catches that failure mode.
#
# Heuristic:
#   - For each domain with CAPABILITIES.md mtime >= GATE_DATE
#   - Count chars in details/*.md (excluding blog-posts/, applied-knowledge.md, coverage.md)
#   - Compare to the count of URLs in .sources.jsonl
#   - If chars-per-URL < THRESHOLD → FAIL with diagnostic
#
# Failure mode this prevents (observed 2026-05-03 advokatami.bg case):
#   Validators all pass (URL coverage 100%, deep-extraction structure OK)
#   but the actual page accordion content was silently skipped → only
#   marketing-summary surface captured, load-bearing FAQ/pricing buried.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KB_ROOT="$REPO_ROOT/references/knowledge"
GATE_DATE="2026-05-03"
MIN_CHARS_PER_URL=200  # average should be at least this much extracted body content per URL

PASS=0
FAIL=0
SKIP=0
ERRORS=""

shopt -s nullglob
for caps in "$KB_ROOT"/competitors/*/CAPABILITIES.md "$KB_ROOT"/launch/*/CAPABILITIES.md; do
  [[ -f "$caps" ]] || continue
  domain_dir=$(dirname "$caps")
  details_dir="$domain_dir/details"

  caps_date=$(date -r "$caps" +%Y-%m-%d)
  if [[ "$caps_date" < "$GATE_DATE" ]]; then SKIP=$((SKIP+1)); continue; fi
  if [[ -f "$domain_dir/.density-na" ]]; then SKIP=$((SKIP+1)); continue; fi

  # Count URLs in .sources.jsonl (excluding external verification URLs)
  sources_file="$domain_dir/.sources.jsonl"
  if [[ ! -f "$sources_file" ]]; then SKIP=$((SKIP+1)); continue; fi
  url_count=$(wc -l < "$sources_file" | tr -d ' ')
  [[ $url_count -lt 1 ]] && { SKIP=$((SKIP+1)); continue; }

  # Count substantive detail file chars (skip applied-knowledge + blog-* + coverage)
  detail_chars=0
  if [[ -d "$details_dir" ]]; then
    for f in "$details_dir"/*.md; do
      [[ -f "$f" ]] || continue
      base=$(basename "$f")
      case "$base" in
        applied-knowledge.md|coverage.md|blog-recent.md|blog-content-synthesis.md|blog-applied-knowledge.md|blog.md) continue ;;
      esac
      sz=$(wc -c < "$f" | tr -d ' ')
      detail_chars=$((detail_chars + sz))
    done
  fi

  # Add CAPABILITIES.md chars (it's the layer 2 summary)
  caps_chars=$(wc -c < "$caps" | tr -d ' ')
  total_chars=$((detail_chars + caps_chars))
  chars_per_url=$((total_chars / url_count))

  if (( chars_per_url < MIN_CHARS_PER_URL )); then
    ERRORS+="  FAIL: $(basename "$domain_dir") — $chars_per_url chars/URL (threshold $MIN_CHARS_PER_URL). Detail+CAPABILITIES total $total_chars chars across $url_count URL sources. Likely skimmed content; check for missed accordions/tabs/JS-rendered sections. Re-extract with skills/research/scripts/playwright-extract.mjs or create .density-na if extraction is genuinely intentionally-shallow.\n"
    FAIL=$((FAIL+1))
  else
    PASS=$((PASS+1))
  fi
done

echo "  validate-research-content-density: $PASS passed, $FAIL failed, $SKIP skipped (legacy or .density-na)"
if (( FAIL > 0 )); then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
