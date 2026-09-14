#!/usr/bin/env bash
# Tier 1: Validate every provisioned host manifest.
# Ensures setup script has everything it needs to symlink skills + infrastructure.
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PASS=0
FAIL=0
ERRORS=""

pass() {
  PASS=$((PASS + 1))
}

fail() {
  ERRORS+="  FAIL: $1\n"
  FAIL=$((FAIL + 1))
}

echo "=== Tier 1: Host Manifest Validation ==="

mapfile -t HOSTS < <(find "$REPO_ROOT/provision/hosts" -maxdepth 1 -name '*.json' -printf '%f\n' | sed 's/\.json$//' | sort)

if [ "${#HOSTS[@]}" -eq 0 ]; then
  fail "no host manifests found under provision/hosts/"
fi

for host in "${HOSTS[@]}"; do
  MANIFEST="$REPO_ROOT/provision/hosts/$host.json"

  if [ ! -f "$MANIFEST" ]; then
    fail "provision/hosts/$host.json missing"
    continue
  fi

  if ! python3 -c "import json; json.load(open('$MANIFEST'))" 2>/dev/null; then
    fail "provision/hosts/$host.json is invalid JSON"
    continue
  fi
  pass "provision/hosts/$host.json is valid JSON"

  # Check infra_files exist
  while IFS= read -r f; do
    if [ -z "$f" ]; then continue; fi
    if [ -e "$REPO_ROOT/$f" ]; then
      pass "infra_files[$host]: $f exists"
    else
      fail "infra_files[$host]: $f missing (setup will fail to symlink)"
    fi
  done < <(python3 -c "import json; m=json.load(open('$MANIFEST')); [print(x) for x in m.get('infra_files',[])]")

  # Check infra_dirs exist
  while IFS= read -r d; do
    if [ -z "$d" ]; then continue; fi
    if [ -d "$REPO_ROOT/$d" ]; then
      pass "infra_dirs[$host]: $d/ exists"
    else
      fail "infra_dirs[$host]: $d/ missing (setup will fail to symlink)"
    fi
  done < <(python3 -c "import json; m=json.load(open('$MANIFEST')); [print(x) for x in m.get('infra_dirs',[])]")

done

# Cross-host consistency: all manifests must include 'templates' in infra_dirs
# (templates/.svc is required by setup verification)
for host in "${HOSTS[@]}"; do
  MANIFEST="$REPO_ROOT/provision/hosts/$host.json"
  HAS_TEMPLATES=$(python3 -c "import json; m=json.load(open('$MANIFEST')); print('templates' in m.get('infra_dirs', []))")
  if [ "$HAS_TEMPLATES" = "True" ]; then
    pass "infra_dirs[$host] includes 'templates'"
  else
    fail "infra_dirs[$host] missing 'templates' — setup will fail templates/.svc verification"
  fi
done

# Cross-host consistency: all manifests must include 'scripts' in infra_dirs
for host in "${HOSTS[@]}"; do
  MANIFEST="$REPO_ROOT/provision/hosts/$host.json"
  HAS_SCRIPTS=$(python3 -c "import json; m=json.load(open('$MANIFEST')); print('scripts' in m.get('infra_dirs', []))")
  if [ "$HAS_SCRIPTS" = "True" ]; then
    pass "infra_dirs[$host] includes 'scripts'"
  else
    fail "infra_dirs[$host] missing 'scripts'"
  fi
done

# Validate setup parsing for each host (fast, no writes, no post-install hooks).
# Tier-1 must not mutate global host directories or start browser daemons just
# to prove that a manifest is setup-ready.
for host in "${HOSTS[@]}"; do
  if SVC_SETUP_VALIDATE_ONLY=1 bash "$REPO_ROOT/setup" --host "$host" >/dev/null 2>&1; then
    pass "setup --host $host validates without error"
  else
    fail "setup --host $host validate-only failed — run manually to see details"
  fi
done

echo ""
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all host manifests valid and setup-ready"
  exit 0
fi
