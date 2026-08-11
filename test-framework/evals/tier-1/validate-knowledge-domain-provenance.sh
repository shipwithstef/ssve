#!/usr/bin/env bash
# Tier 1: Knowledge Spine — provenance enforcement.
# Every references/knowledge/domains/<topic>/CAPABILITIES.md MUST be backed by
# a non-empty .sources.jsonl. Without it, the slice is unverified — recall
# warns (Phase A) and refuses (Phase E).
#
# Source: WI-SPINE-006 — closes the gap exposed when commit 5607ad9 wrote
# training-data-confabulated knowledge files into the Spine.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DOMAINS_DIR="$REPO_ROOT/references/knowledge/domains"
PHASE="${SVC_SPINE_PHASE:-A}"
PASS=0
WARN=0
FAIL=0
ERRORS=""

# Gate introduction epoch — domains with CAPABILITIES.md mtime after this MUST
# carry .sources.jsonl. Older domains warn-only (legacy backfill candidates).
# 2026-04-30T00:00:00Z = 1777593600
GATE_EPOCH=1777593600

[[ -d "$DOMAINS_DIR" ]] || { echo "validate-knowledge-domain-provenance: no domains dir — OK"; exit 0; }

while IFS= read -r dir; do
  domain=$(basename "$dir")
  cap="$dir/CAPABILITIES.md"
  sources="$dir/.sources.jsonl"
  [[ -f "$cap" ]] || continue
  if [[ ! -s "$sources" ]]; then
    # Worktree checkout time is not provenance. Prefer the tracked file's last
    # commit timestamp so old legacy domains do not become false post-gate
    # failures in freshly-created worktrees.
    cap_rel="${cap#$REPO_ROOT/}"
    cap_mtime="$(node --input-type=module - "$REPO_ROOT" "$cap_rel" <<'NODE'
import { historicalPathEpoch } from "./scripts/lib/history-epoch.mjs";
console.log(historicalPathEpoch(process.argv[2], process.argv[3]));
NODE
)"
    if [[ -z "$cap_mtime" ]]; then
      cap_mtime=$(stat -c %Y "$cap" 2>/dev/null || stat -f %m "$cap" 2>/dev/null || echo 0)
    fi
    if [[ "$cap_mtime" -ge "$GATE_EPOCH" ]]; then
      ERRORS+="  FAIL: $domain — CAPABILITIES.md created/modified after provenance gate (2026-04-30) but .sources.jsonl is missing/empty. Run research skill with provenance step, or revert the write.\n"
      FAIL=$((FAIL+1))
    else
      ERRORS+="  WARN: $domain — CAPABILITIES.md exists but .sources.jsonl is missing or empty (legacy domain, backfill candidate)\n"
      WARN=$((WARN+1))
    fi
  else
    PASS=$((PASS+1))
  fi
done < <(find "$DOMAINS_DIR" -maxdepth 1 -mindepth 1 -type d 2>/dev/null)

echo "validate-knowledge-domain-provenance: $PASS verified, $WARN legacy-unverified, $FAIL post-gate-fail"
if [[ -n "$ERRORS" ]]; then
  printf "%b" "$ERRORS"
  # Always fail on post-gate violations regardless of phase.
  if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
  if [[ "$PHASE" == "E" ]]; then exit 1; fi
fi
exit 0
