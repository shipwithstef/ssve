#!/usr/bin/env bash
# Tier 1 — research skill applied-knowledge gate.
#
# Domains with substantial detail files (≥5 .md detail files OR a blog-posts/ dir)
# created/modified after 2026-05-03 MUST contain `details/applied-knowledge.md`
# with the 6 mandatory sections — UNLESS marker `.applied-na` is present.
#
# Failure mode this prevents: extraction + classification done but no distillation —
# next agent gets raw data without meaning, must re-derive from scratch.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KB_ROOT="$REPO_ROOT/references/knowledge"
GATE_DATE="2026-05-03"
GATE_EPOCH=$(date -u -d "$GATE_DATE 00:00:00 UTC" +%s)

PASS=0
FAIL=0
SKIP=0
ERRORS=""

file_commit_epoch() {
  local path="$1"
  local ts=""
  local relative="${path#$REPO_ROOT/}"

  ts=$(node --input-type=module - "$REPO_ROOT" "$relative" <<'NODE'
import { historicalPathEpoch } from "./scripts/lib/history-epoch.mjs";
console.log(historicalPathEpoch(process.argv[2], process.argv[3]));
NODE
)

  if [[ -z "$ts" || "$ts" == "" ]]; then
    ts=$(stat -c %Y "$path" 2>/dev/null || stat -f %m "$path" 2>/dev/null || echo 0)
  fi

  echo "${ts:-0}"
}

REQUIRED_SECTIONS='## 1\. Distilled positions|## 2\. Cross-domain implications|## 3\. Contradictions|## 4\. Recency|## 5\. Source map|## 6\. What this distillation does NOT capture'

shopt -s nullglob
for caps in "$KB_ROOT"/competitors/*/CAPABILITIES.md "$KB_ROOT"/launch/*/CAPABILITIES.md; do
  [[ -f "$caps" ]] || continue
  domain_dir=$(dirname "$caps")
  details_dir="$domain_dir/details"

  caps_epoch=$(file_commit_epoch "$caps")
  if (( caps_epoch < GATE_EPOCH )); then
    SKIP=$((SKIP+1))
    continue
  fi
  if [[ -f "$domain_dir/.applied-na" ]]; then SKIP=$((SKIP+1)); continue; fi

  # Determine if domain is substantial enough to require applied-knowledge
  detail_count=0
  if [[ -d "$details_dir" ]]; then
    detail_count=$(find "$details_dir" -maxdepth 1 -name "*.md" ! -name "applied-knowledge.md" | wc -l | tr -d ' ')
  fi
  has_blog_posts=0
  [[ -d "$details_dir/blog-posts" ]] && has_blog_posts=1

  if (( detail_count < 5 && has_blog_posts == 0 )); then
    SKIP=$((SKIP+1))
    continue
  fi

  applied="$details_dir/applied-knowledge.md"
  if [[ ! -f "$applied" ]]; then
    ERRORS+="  FAIL: $(basename "$domain_dir") — $detail_count detail files, blog_posts=$has_blog_posts, but no details/applied-knowledge.md. Run synthesize-meaning.mjs or create .applied-na if domain is mechanical-only.\n"
    FAIL=$((FAIL+1)); continue
  fi

  # Verify sections present
  missing=$(grep -cE "$REQUIRED_SECTIONS" "$applied" || true)
  if (( missing < 6 )); then
    ERRORS+="  FAIL: $(basename "$domain_dir")/details/applied-knowledge.md — only $missing/6 mandatory sections found. Re-run synthesize-meaning.\n"
    FAIL=$((FAIL+1))
  else
    PASS=$((PASS+1))
  fi
done

echo "  validate-research-applied-knowledge: $PASS passed, $FAIL failed, $SKIP skipped"
if (( FAIL > 0 )); then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
