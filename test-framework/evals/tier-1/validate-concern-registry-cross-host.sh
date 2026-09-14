#!/bin/bash
# validate-concern-registry-cross-host.sh — tier-1 validator.
#
# Asserts that the concern registry is reachable from every installed CLI host
# declared in provision/hosts/*.json. Catches the
# failure mode where the host install symlinked scripts/ but not concerns/,
# producing a scanner that "works" only because Node resolves symlinks
# through scripts/ — fragile and silently broken if the source repo moves.
#
# For each host with $HOST/skills/ present:
#   - scripts/scan-concerns.mjs MUST be present (scanner)
#   - scripts/build-concern-registry.mjs MUST be present (lint helper)
#   - concerns/REGISTRY.json MUST be present (and parseable)
#   - concerns/REGISTRY.json MUST have universal_count > 0
#   - scanner MUST be able to JSON-parse the registry from this host's path
#
# Exit 0 if all installed hosts pass (uninstalled hosts are skipped).
# Exit 1 with per-host failure detail.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
mapfile -t HOSTS < <(python3 - "$REPO_ROOT" <<'PY'
import glob, json, os, sys
root = sys.argv[1]
for manifest_path in sorted(glob.glob(os.path.join(root, "provision/hosts/*.json"))):
    with open(manifest_path) as f:
        manifest = json.load(f)
    print(f"{manifest['host']}:{os.path.expanduser(manifest['skills_path'])}")
PY
)

PASS=0
FAIL=0
SKIPPED=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIPPED=$((SKIPPED+1)); echo "  - $1 (host not installed)"; }

echo "=== Tier 1: concern-registry cross-host parity ==="

for entry in "${HOSTS[@]}"; do
  name="${entry%%:*}"
  path="${entry#*:}"

  if [ ! -d "$path" ]; then
    skip "$name @ $path"
    continue
  fi

  source_repo=""
  if [ -f "$path/.source-repo" ]; then
    source_repo="$(cat "$path/.source-repo" 2>/dev/null || true)"
  fi
  if [ -z "$source_repo" ]; then
    skip "$name @ $path (not an svc-owned install; missing .source-repo)"
    continue
  fi
  source_real="$(realpath "$source_repo" 2>/dev/null || true)"
  repo_real="$(realpath "$REPO_ROOT" 2>/dev/null || true)"
  if [ -n "$source_real" ] && [ -n "$repo_real" ] && [ "$source_real" != "$repo_real" ]; then
    skip "$name @ $path (installed from $source_real, not repo under test)"
    continue
  fi

  # 1. scanner present
  if [ -f "$path/scripts/scan-concerns.mjs" ]; then
    pass "$name scanner present"
  else
    fail "$name scanner missing at $path/scripts/scan-concerns.mjs"
    continue
  fi

  # 2. build helper present
  if [ -f "$path/scripts/build-concern-registry.mjs" ]; then
    pass "$name build-concern-registry present"
  else
    fail "$name build-concern-registry missing"
  fi

  # 3. concerns dir reachable
  if [ ! -e "$path/concerns" ]; then
    fail "$name concerns/ NOT installed (add 'concerns' to provision/hosts/$name.json infra_dirs and re-run ./setup)"
    continue
  fi
  pass "$name concerns/ reachable"

  # 4. REGISTRY.json present and parseable
  registry="$path/concerns/REGISTRY.json"
  if [ ! -f "$registry" ]; then
    fail "$name REGISTRY.json missing at $registry"
    continue
  fi
  count=$(python3 -c "import json,sys; d=json.load(open('$registry')); print(d.get('universal_count',0))" 2>/dev/null || echo "PARSE_FAIL")
  if [ "$count" = "PARSE_FAIL" ]; then
    fail "$name REGISTRY.json unparseable"
    continue
  fi
  if [ "$count" -lt 1 ]; then
    fail "$name REGISTRY.json universal_count=$count (expected > 0; run scripts/build-concern-registry.mjs)"
    continue
  fi
  pass "$name REGISTRY.json parseable, $count concerns"

  # 5. scanner can actually invoke the registry from this host's path
  output=$(node "$path/scripts/scan-concerns.mjs" --paths /dev/null --json 2>&1 || true)
  if echo "$output" | python3 -c "import sys,json; json.loads(sys.stdin.read())" >/dev/null 2>&1; then
    pass "$name scanner runs and emits valid JSON"
  else
    fail "$name scanner failed to produce valid JSON from this host's path"
  fi
done

echo
echo "PASS: $PASS, FAIL: $FAIL, SKIPPED: $SKIPPED"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Recovery:"
  echo "  1. Add 'concerns' to provision/hosts/<host>.json under 'infra_dirs'"
  echo "  2. Re-run ./setup --host <host> to install the symlink"
  echo "  3. Or manually: ln -sf <repo>/concerns <skills_path>/concerns"
  exit 1
fi

exit 0
