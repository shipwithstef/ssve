#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >/tmp/svc-cross-system-check.out 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat /tmp/svc-cross-system-check.out
    fail=$((fail + 1))
  fi
}

check_fail() {
  local label="$1"
  shift
  if "$@" >/tmp/svc-cross-system-check.out 2>&1; then
    echo "  ✗ $label"
    cat /tmp/svc-cross-system-check.out
    fail=$((fail + 1))
  else
    echo "  ✓ $label"
    pass=$((pass + 1))
  fi
}

cat >"$TMP/good-map.md" <<'EOF'
# Auth System Contract Map

## Flow Diagram

```mermaid
graph LR
  A[Hosted Login] --> B[OAuth Provider]
  B --> C[Callback Bridge]
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Hosted Login | OAuth Provider | HTTP redirect | state, from_url | URL query | provider session | callback bridge | callback rejected |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| localStorage | app origin | provider SDK | callback bridge | browser profile | native callback cannot read token |

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Provider preserves state | runtime probe | node probes/auth.mjs | verified |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| token arrives in URL | URL has access_token | URL lacks token while storage has token | rejected | probe.json |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| test login | FAIL auth loop | PASS dashboard | migration changes behavior | old-new.json |

## Iteration Escalation

On the third diagnose-bug invocation, halt and require review-cross-model before resuming.
EOF

cat >"$TMP/bad-map.md" <<'EOF'
# Login Notes

## Handoff Table

| From | To |
|---|---|
| A | B |
EOF

cat >"$TMP/good-probe.json" <<'EOF'
{
  "id": "auth-migration",
  "hypothesis": "switch to callback bridge fixes hosted login",
  "requires_old_new_path_proof": true,
  "same_input": "test account login",
  "confirmation_check": { "predicate": "dashboard visible", "result": "PASS" },
  "falsification_check": { "predicate": "auth loop absent after provider return", "result": "PASS" },
  "old_path": { "command": "node probes/old-login.mjs", "result": "FAIL" },
  "new_path": { "command": "node probes/new-login.mjs", "result": "PASS" },
  "verdict": "hypothesis-holds"
}
EOF

cat >"$TMP/bad-probe.json" <<'EOF'
{
  "hypothesis": "login works",
  "confirmation_check": { "predicate": "chooser visible", "result": "PASS" },
  "verdict": "hypothesis-holds"
}
EOF

cat >"$TMP/good-lane-tasks.json" <<'EOF'
{
  "wi": "WI-164",
  "diagnose_bug_invocations": 3,
  "labels": ["cross-system-suspected"],
  "system_contract_map": {
    "required": true,
    "path": "docs/specs/contract-maps/native-login.md"
  },
  "required_skills": ["review-cross-model"],
  "tasks": []
}
EOF

cat >"$TMP/bad-lane-tasks.json" <<'EOF'
{
  "wi": "WI-164",
  "diagnose_bug_invocations": 3,
  "tasks": []
}
EOF

echo "=== Tier 1: Cross-System Contract Map ==="
check "system contract map validator syntax valid" node --check "$ROOT/scripts/validate-system-contract-map.mjs"
check "cross-system probe validator syntax valid" node --check "$ROOT/scripts/validate-cross-system-probe-evidence.mjs"
check "iteration cap helper syntax valid" node --check "$ROOT/scripts/check-cross-system-iteration-cap.mjs"
check "valid system contract map passes" node "$ROOT/scripts/validate-system-contract-map.mjs" --map "$TMP/good-map.md"
check_fail "incomplete system contract map fails" node "$ROOT/scripts/validate-system-contract-map.mjs" --map "$TMP/bad-map.md"
check "valid falsification and old/new proof passes" node "$ROOT/scripts/validate-cross-system-probe-evidence.mjs" --evidence "$TMP/good-probe.json"
check_fail "confirmation-only probe fails" node "$ROOT/scripts/validate-cross-system-probe-evidence.mjs" --evidence "$TMP/bad-probe.json"
check "third diagnose-bug invocation with escalation passes" node "$ROOT/scripts/check-cross-system-iteration-cap.mjs" --lane-tasks "$TMP/good-lane-tasks.json"
check_fail "third diagnose-bug invocation without escalation fails" node "$ROOT/scripts/check-cross-system-iteration-cap.mjs" --lane-tasks "$TMP/bad-lane-tasks.json"

check "route-workflow wires cross-system contract map" grep -q "Cross-System Contract Map Gate" "$ROOT/skills/route-workflow/SKILL.md"
check "diagnose-bug requires cross-system falsification probes" grep -q "Cross-System Falsification Mode" "$ROOT/skills/diagnose-bug/SKILL.md"
check "design-tech requires system contract map for cross-system flows" grep -q "System Contract Map" "$ROOT/skills/design-tech/SKILL.md"
check "test-journeys validates cross-system contract map handoffs" grep -q "Cross-System Journey Validation" "$ROOT/skills/test-journeys/SKILL.md"
check "execute-changeset requires old-path/new-path proof" grep -q "Old-path-fails / new-path-passes" "$ROOT/skills/execute-changeset/SKILL.md"
check "review-gate blocks missing cross-system proof" grep -q "Cross-System Proof Gate" "$ROOT/skills/review-gate/SKILL.md"
check "shared contract-map reference exists" test -f "$ROOT/_shared/system-contract-map.md"

echo ""
echo "cross-system contract map: $pass passed, $fail failed"

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
