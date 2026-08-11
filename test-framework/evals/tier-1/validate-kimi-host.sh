#!/bin/bash
# validate-kimi-host.sh — Tier 1 structural validation for Kimi CLI host integration.
#
# COST: $0 — no LLM calls. Purely structural checks (<10 seconds).
#
# Checks:
#   - Host manifest exists and is valid JSON
#   - Required infra files exist
#   - Hook wiring script is valid Node.js
#   - Kimi hook wrappers exist and are executable
#   - Model registry is valid JSON
#   - Host detection and resolution scripts exist
#
# Exit 0: all checks pass
# Exit 1: one or more checks fail

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
ERRORS=0

fail() {
  echo "  ✗ $1"
  ERRORS=$((ERRORS + 1))
}

pass() {
  echo "  ✓ $1"
}

echo "=== Tier 1: Kimi Host Validation ==="

# 1. Host manifest
if [ -f "$SCRIPT_DIR/provision/hosts/kimi.json" ]; then
  if python3 -c "import json; json.load(open('$SCRIPT_DIR/provision/hosts/kimi.json'))" 2>/dev/null; then
    pass "provision/hosts/kimi.json is valid JSON"
  else
    fail "provision/hosts/kimi.json is invalid JSON"
  fi
else
  fail "provision/hosts/kimi.json missing"
fi

# 2. Required infra files
for f in KIMI.md references/model-registry.json references/model-routing-kimi.md references/model-toggle.md references/host-capabilities.md; do
  if [ -f "$SCRIPT_DIR/$f" ]; then
    pass "$f exists"
  else
    fail "$f missing"
  fi
done

# 3. Hook wiring script
if [ -f "$SCRIPT_DIR/scripts/wire-kimi-hooks.mjs" ]; then
  if node --check "$SCRIPT_DIR/scripts/wire-kimi-hooks.mjs" 2>/dev/null; then
    pass "scripts/wire-kimi-hooks.mjs syntax valid"
  else
    fail "scripts/wire-kimi-hooks.mjs has syntax errors"
  fi
else
  fail "scripts/wire-kimi-hooks.mjs missing"
fi

# 3b. Project state init script
if [ -f "$SCRIPT_DIR/scripts/init-project-state.mjs" ]; then
  if node --check "$SCRIPT_DIR/scripts/init-project-state.mjs" 2>/dev/null; then
    pass "scripts/init-project-state.mjs syntax valid"
  else
    fail "scripts/init-project-state.mjs has syntax errors"
  fi
else
  fail "scripts/init-project-state.mjs missing"
fi

if [ -d "$SCRIPT_DIR/templates/.svc" ]; then
  pass "templates/.svc/ directory exists"
else
  fail "templates/.svc/ directory missing"
fi

# 4. Kimi hook wrappers
for f in svc-kimi-workflow-guard.sh svc-kimi-lane-tasks-validator.sh svc-kimi-stop-quality.sh svc-kimi-task-completion-guard.sh; do
  path="$SCRIPT_DIR/hooks/kimi/$f"
  if [ -f "$path" ]; then
    if [ -x "$path" ]; then
      pass "hooks/kimi/$f exists and is executable"
    else
      fail "hooks/kimi/$f exists but is not executable"
    fi
  else
    fail "hooks/kimi/$f missing"
  fi
done

# 5. Model registry
if [ -f "$SCRIPT_DIR/references/model-registry.json" ]; then
  if python3 -c "import json; reg=json.load(open('$SCRIPT_DIR/references/model-registry.json')); assert 'profiles' in reg; assert 'orchestrators' in reg; assert 'harnesses' in reg" 2>/dev/null; then
    pass "references/model-registry.json is valid and has required keys"
  else
    fail "references/model-registry.json missing required keys"
  fi
else
  fail "references/model-registry.json missing"
fi

# 6. Host detection and resolution scripts
for f in detect-host.sh resolve-model.sh; do
  path="$SCRIPT_DIR/scripts/$f"
  if [ -f "$path" ]; then
    if [ -x "$path" ]; then
      pass "scripts/$f exists and is executable"
    else
      fail "scripts/$f exists but is not executable"
    fi
  else
    fail "scripts/$f missing"
  fi
done

# 7. Agent definition
if [ -f "$SCRIPT_DIR/agents/svc-kimi-executor.yaml" ]; then
  pass "agents/svc-kimi-executor.yaml exists"
else
  fail "agents/svc-kimi-executor.yaml missing"
fi

# 8. Verify resolve-model.sh works for all profiles
for profile in svc-default kimi-native claude-native codex-native kimi-orchestrator-mixed; do
  result=$(SVC_MODEL_PROFILE="$profile" bash "$SCRIPT_DIR/scripts/resolve-model.sh" STRAT 2>/dev/null || true)
  if [ -n "$result" ] && [ "$result" != "Error:"* ]; then
    pass "resolve-model.sh STRAT works for profile '$profile'"
  else
    fail "resolve-model.sh STRAT failed for profile '$profile'"
  fi
done

# Summary
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "All Kimi host checks passed."
  exit 0
else
  echo "$ERRORS check(s) failed."
  exit 1
fi
