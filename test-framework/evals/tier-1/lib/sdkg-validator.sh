#!/usr/bin/env bash
# Tier-1 SDKG validator helper. Sourced by 5-LOC instance wrappers.
#
# Usage in a tier-1 wrapper:
#   #!/usr/bin/env bash
#   set -euo pipefail
#   REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
#   source "$REPO_ROOT/test-framework/evals/tier-1/lib/sdkg-validator.sh"
#   sdkg_validate competitor-analysis "$REPO_ROOT/references/schemas/competitor-analysis.example.json"
#
# Exit codes:
#   0 — data conforms to schema for the named SDKG instance
#   1 — fail
#   2 — registry missing or instance unknown

set -euo pipefail

sdkg_validate() {
  local instance="$1"
  local data_path="$2"
  local repo_root="${SDKG_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
  local registry="$repo_root/references/sdkg-registry.json"

  if [ ! -f "$registry" ]; then
    echo "FAIL: SDKG registry missing at $registry" >&2
    return 2
  fi

  local schema_rel
  schema_rel=$(node -e "
    const r = JSON.parse(require('fs').readFileSync('$registry', 'utf8'));
    const inst = r.instances && r.instances['$instance'];
    if (!inst) { process.exit(2); }
    process.stdout.write(inst.schema);
  ") || {
    echo "FAIL: SDKG instance '$instance' not registered in $registry" >&2
    return 2
  }

  local schema_path="$repo_root/$schema_rel"
  if [ ! -f "$schema_path" ]; then
    echo "FAIL: schema referenced by instance '$instance' not found at $schema_path" >&2
    return 2
  fi

  node "$repo_root/scripts/lib/json-schema-validator.mjs" \
    --schema="$schema_path" --data="$data_path"
}

# Adjacent-pattern sweep: verify legacy "no new web research" headers do NOT
# appear in producer outputs. Per RP-007 + spec COMP-07.
sdkg_reject_legacy_consolidation() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return 0  # missing file is a different validator's concern
  fi
  if grep -qiE "no new web research performed|read[- ]?only consolidation|consolidation[ -]only|reshuffl" "$file"; then
    echo "FAIL: $file contains banned 'consolidation only' pattern (per COMP-07). Live web research required." >&2
    return 1
  fi
  return 0
}

# When sourced, do nothing. When run directly with args, dispatch.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  if [ "${1:-}" = "validate" ]; then
    shift
    sdkg_validate "$@"
  elif [ "${1:-}" = "reject-legacy" ]; then
    shift
    sdkg_reject_legacy_consolidation "$@"
  else
    echo "Usage: $0 validate <instance> <data-path>" >&2
    echo "       $0 reject-legacy <md-file>" >&2
    exit 2
  fi
fi
