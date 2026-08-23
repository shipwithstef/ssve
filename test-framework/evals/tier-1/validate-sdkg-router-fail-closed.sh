#!/usr/bin/env bash
# Tier-1 validator: malformed SDKG registry must not silently fail-open during
# framework-evolution work. Origin: WI-206.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

write_fixture() {
  local bound_to="$1"
  rm -rf "$TMP_DIR"/*
  mkdir -p "$TMP_DIR/scripts/lib" "$TMP_DIR/references" "$TMP_DIR/.svc"
  cp "$REPO_ROOT/scripts/lib/post-task-trigger-router.mjs" "$TMP_DIR/scripts/lib/post-task-trigger-router.mjs"
  cp "$REPO_ROOT/scripts/state-io.mjs" "$TMP_DIR/scripts/state-io.mjs"
  printf '{ malformed registry json\n' > "$TMP_DIR/references/sdkg-registry.json"
  cat > "$TMP_DIR/.svc/lane-tasks-WI-999.json" <<'JSON'
{
  "wi": "WI-999",
  "status": "completed",
  "tasks": [
    {
      "id": 1,
      "skill": "route-workflow",
      "status": "completed",
      "subject": "verify loyalty rewards points flow"
    }
  ]
}
JSON
  printf '{"ts":"2026-05-10T00:00:00Z","bound_to":"%s","request":"fixture","wi":"WI-999","skill":"route-workflow","guard_override_count":0}\n' "$bound_to" > "$TMP_DIR/.svc/session-contract.jsonl"
}

echo "=== Tier 1: SDKG router fail-closed for framework work ==="

write_fixture "framework-evolution"
framework_out="$TMP_DIR/framework.out"
SVC_REPO_ROOT="$TMP_DIR" bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh" >"$framework_out" 2>&1 <<'JSON' || true
{"hook_event_name":"Stop"}
JSON

if grep -Fq '"decision":"block"' "$framework_out" && grep -Fq "SVC SDKG ROUTER" "$framework_out"; then
  pass "framework-evolution malformed registry blocks stop"
else
  fail "framework-evolution malformed registry blocks stop"
  sed -n '1,80p' "$framework_out"
fi

write_fixture "user-request"
user_out="$TMP_DIR/user.out"
SVC_REPO_ROOT="$TMP_DIR" SVC_COMPLETION_FAIL_OPEN=true bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh" >"$user_out" 2>&1 <<'JSON' || true
{"hook_event_name":"Stop"}
JSON

if grep -Fq '"decision":"block"' "$user_out"; then
  fail "user-request malformed registry fail-opens"
  sed -n '1,80p' "$user_out"
elif grep -Fq "svc SDKG router: fail-open after router error" "$user_out"; then
  pass "user-request malformed registry fail-opens"
else
  fail "user-request malformed registry logs fail-open"
  sed -n '1,80p' "$user_out"
fi

if grep -Fq "SVC_SDKG_FAIL_OPEN=true" "$REPO_ROOT/hooks/svc-task-completion-guard.sh" &&
  grep -Fq "framework-evolution" "$REPO_ROOT/hooks/svc-task-completion-guard.sh"; then
  pass "hook documents scoped emergency bypass"
else
  fail "hook documents scoped emergency bypass"
fi

if grep -Fq "router fail-opens for unrelated/user-request sessions" "$REPO_ROOT/skills/route-workflow/SKILL.md" &&
  grep -Fq "malformed registered SDKG registry" "$REPO_ROOT/skills/route-workflow/SKILL.md"; then
  pass "route-workflow documents scoped fail-closed behavior"
else
  fail "route-workflow documents scoped fail-closed behavior"
fi

echo
echo "SDKG router fail-closed: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
