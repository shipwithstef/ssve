#!/usr/bin/env bash
# Tier-1 validator: framework docs drift audit (WI-FW-DOCS-AUDIT-01).
#
# TIER-1 PROMOTION NOTE (required by rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-framework-docs-audit.sh
#     -> delegates to scripts/audit-framework-docs.mjs
#   failure_class: authority-doc drift — stale countable claims (agents/rules/
#     reference-docs), false archive-path existence claims, host-table gaps vs
#     provision/hosts/*.json, broken internal md links in live docs.
#   promotion_signal: observed 2026-08-26 (WI-FW-DOCS-AUDIT-01): agents repeated
#     wrong facts sourced from drifted authority docs — "Agents: 3" (actual 28),
#     "Rules: 18"/"13" (actual 48), "Reference docs: 21" (actual 91), HOSTS.md
#     missing a provisioned host, FRAMEWORK-STATE.md pointing at an archive
#     directory that was never committed. Same class previously produced wrong
#     host-capability claims (stored framework learning on knowledge decay).
#   expected_runtime_budget: <5s, hermetic (fs reads only; no network/LLM/browser).
#   why_tier_2_or_targeted_is_insufficient: these docs are read by EVERY session
#     at startup (route-workflow P1); drift poisons routing before any targeted
#     check would run. Detection must be always-on and free.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

exec node "$ROOT/scripts/audit-framework-docs.mjs"
