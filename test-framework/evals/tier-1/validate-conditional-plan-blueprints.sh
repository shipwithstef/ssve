#!/usr/bin/env bash
# Tier 1: WI-386 — conditional plan blueprints. Asserts the plan-manifest receipt's
# `mode`-gated blueprint requirement is enforced FAIL-CLOSED across BOTH layers that
# can validate the receipt:
#   (A) the declarative schema (schemas/receipts/plan-manifest.schema.json) read by a
#       real JSON-Schema engine (python jsonschema, draft-07 if/then/else), and
#   (B) the chain's actual enforcement engine (scripts/emit-receipt.mjs validateReceipt,
#       the presence validator the receipt pipeline runs — exercised end-to-end, not
#       reimplemented).
#
# The contract under test:
#   - dispatch mode (mode:dispatch OR mode ABSENT) WITHOUT changeset_blueprints -> REJECT
#   - inline   mode (mode:inline)                  WITHOUT changeset_blueprints -> ACCEPT
#   - dispatch mode WITH blueprints                                            -> ACCEPT
# The absent-mode case is the load-bearing one: it must fail closed to dispatch
# semantics so WI-347's hard requirement is never silently relaxed (a vacuous
# `properties` constraint would fail OPEN — the regression this validator guards).
#
# Hermetic: no network, no LLM, no real receipts/notes. Layer B runs emit-receipt in a
# throwaway empty git repo (HOME + cwd redirected) so the real code path executes with
# zero side effects on this worktree. Expected runtime < 5s.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCHEMA="$REPO_ROOT/schemas/receipts/plan-manifest.schema.json"
EMIT="$REPO_ROOT/scripts/emit-receipt.mjs"

PASS=0
FAIL=0
ERRORS=""

ok() { PASS=$((PASS + 1)); }
bad() { ERRORS+="  FAIL: $1\n"; FAIL=$((FAIL + 1)); }

# ── Preconditions ──────────────────────────────────────────────────────────
[[ -f "$SCHEMA" ]] && ok || bad "schema missing: schemas/receipts/plan-manifest.schema.json"
[[ -f "$EMIT" ]]   && ok || bad "emitter missing: scripts/emit-receipt.mjs"

if ! command -v python3 >/dev/null 2>&1; then
  echo "=== Tier 1: Conditional Plan Blueprints (WI-386) ==="
  echo "  SKIP — python3 not on PATH (schema layer needs a JSON-Schema engine)"
  exit 0
fi
if ! python3 -c "import jsonschema" >/dev/null 2>&1; then
  echo "=== Tier 1: Conditional Plan Blueprints (WI-386) ==="
  echo "  SKIP — python jsonschema not installed (schema layer needs a JSON-Schema engine)"
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then
  echo "=== Tier 1: Conditional Plan Blueprints (WI-386) ==="
  echo "  SKIP — node not on PATH (chain-engine layer needs node)"
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Layer A: declarative schema via python jsonschema (draft-07 if/then/else) ──
# Emits one line per case: "<label>:<PASS|FAIL>" where PASS == validates clean.
SCHEMA_RESULT="$(python3 - "$SCHEMA" <<'PY'
import json, sys
import jsonschema

schema = json.load(open(sys.argv[1]))

# Confirm the schema is itself a well-formed draft-07 schema (a malformed allOf/if
# would make the engine a silent no-op — fail-open by construction).
try:
    jsonschema.Draft7Validator.check_schema(schema)
except Exception as e:
    print(f"SCHEMA_INVALID:{e}")
    sys.exit(0)

V = jsonschema.Draft7Validator(schema)

def receipt(extra):
    r = {
        "receipt_type": "plan-manifest", "schema_version": 3, "wi": "WI-386",
        "scope": {"included": ["x"], "excluded": []},
        "dependencies": [], "decision_trace": [], "task_graph": [],
        "validation_plan": [], "risk_rollback": {},
        "timestamp": "2026-06-08T00:00:00Z",
        "execution_command_sequence": [
            {"step": 1, "command": "echo hi", "expected_outcome": "hi"}
        ],
        "ac_digests": {"spec_path": "x.md", "spec_ac_table_sha256": "0" * 64, "entries": []},
    }
    r.update(extra)
    return r

def clean(r):
    # True iff the receipt validates with no blueprint-related error.
    return not any("changeset_blueprints" in e.message for e in V.iter_errors(r))

BP = [{"file": "a.txt", "action": "CREATE", "blueprint": "hello"}]

cases = {
    "dispatch_absent_no_bp": (receipt({}), False),                                  # must REJECT
    "dispatch_explicit_no_bp": (receipt({"mode": "dispatch"}), False),              # must REJECT
    "inline_no_bp": (receipt({"mode": "inline"}), True),                            # must ACCEPT
    "dispatch_with_bp": (receipt({"mode": "dispatch", "changeset_blueprints": BP}), True),  # ACCEPT
}
for label, (r, want_clean) in cases.items():
    got_clean = clean(r)
    print(f"{label}:{'PASS' if got_clean == want_clean else 'FAIL'}")
PY
)"

if echo "$SCHEMA_RESULT" | grep -q "SCHEMA_INVALID:"; then
  bad "schema is not valid draft-07: $(echo "$SCHEMA_RESULT" | grep SCHEMA_INVALID)"
else
  for label in dispatch_absent_no_bp dispatch_explicit_no_bp inline_no_bp dispatch_with_bp; do
    line="$(echo "$SCHEMA_RESULT" | grep "^${label}:" || true)"
    if [[ "$line" == "${label}:PASS" ]]; then
      ok
    else
      bad "schema layer: case '$label' did not behave per contract (got: ${line:-<no output>})"
    fi
  done
fi

# ── Layer B: chain engine via real emit-receipt.mjs in a throwaway empty repo ──
# emit-receipt validates the body (line ~192) BEFORE any SHA-bound git op; with no
# HEAD it takes the staging path (git write-tree on an empty index works). So the
# validation verdict is reached hermetically. We assert the EXACT fail-closed contract.
SANDBOX="$TMP_DIR/sandbox"
mkdir -p "$SANDBOX"
git -C "$SANDBOX" init -q
git -C "$SANDBOX" config user.email "t@t" >/dev/null 2>&1
git -C "$SANDBOX" config user.name "t" >/dev/null 2>&1

# Reuse python to emit the three body fixtures (keeps them identical to layer A).
python3 - "$TMP_DIR" <<'PY'
import json, sys, os
out = sys.argv[1]
def receipt(extra):
    r = {
        "receipt_type": "plan-manifest", "schema_version": 3, "wi": "WI-386",
        "scope": {"included": ["x"], "excluded": []},
        "dependencies": [], "decision_trace": [], "task_graph": [],
        "validation_plan": [], "risk_rollback": {},
        "timestamp": "2026-06-08T00:00:00Z",
        "execution_command_sequence": [
            {"step": 1, "command": "echo hi", "expected_outcome": "hi"}
        ],
        "ac_digests": {"spec_path": "x.md", "spec_ac_table_sha256": "0" * 64, "entries": []},
    }
    r.update(extra)
    return r
BP = [{"file": "a.txt", "action": "CREATE", "blueprint": "hello"}]
json.dump(receipt({}), open(os.path.join(out, "b_dispatch_absent_no_bp.json"), "w"))
json.dump(receipt({"mode": "inline"}), open(os.path.join(out, "b_inline_no_bp.json"), "w"))
json.dump(receipt({"mode": "dispatch", "changeset_blueprints": BP}), open(os.path.join(out, "b_dispatch_with_bp.json"), "w"))
PY

# emit-receipt reads the receipt body from `--body <path>` or, by default, stdin
# (scripts/emit-receipt.mjs readBody). Drive it via stdin — the mode-conditional
# validateReceipt check runs before any SHA-bound git op, so the empty-repo sandbox
# reaches the verdict hermetically.
run_layer_b() {
  local body="$1" outfile="$2"
  ( cd "$SANDBOX" && HOME="$SANDBOX" node "$EMIT" --type plan-manifest --wi WI-386 < "$body" ) >"$outfile" 2>&1
  return $?
}

# Case B1: dispatch (mode ABSENT), no blueprints -> emitter MUST reject (exit != 0, blueprint reason)
run_layer_b "$TMP_DIR/b_dispatch_absent_no_bp.json" "$TMP_DIR/b1.out"; rc=$?
if [[ $rc -ne 0 ]] && grep -q "changeset_blueprints" "$TMP_DIR/b1.out"; then
  ok
else
  bad "chain engine FAIL-OPEN: absent-mode receipt without blueprints was NOT rejected (rc=$rc). Output: $(tr '\n' ' ' < "$TMP_DIR/b1.out" | head -c 300)"
fi

# Case B2: inline, no blueprints -> emitter MUST NOT reject on blueprint grounds.
run_layer_b "$TMP_DIR/b_inline_no_bp.json" "$TMP_DIR/b2.out"; rc=$?
if grep -q "changeset_blueprints" "$TMP_DIR/b2.out"; then
  bad "chain engine over-strict: inline receipt rejected for missing blueprints (WI-386 should exempt it). Output: $(tr '\n' ' ' < "$TMP_DIR/b2.out" | head -c 300)"
else
  ok
fi

# Case B3: dispatch WITH blueprints -> emitter MUST NOT reject on blueprint grounds.
run_layer_b "$TMP_DIR/b_dispatch_with_bp.json" "$TMP_DIR/b3.out"; rc=$?
if grep -q "changeset_blueprints" "$TMP_DIR/b3.out"; then
  bad "chain engine over-strict: dispatch receipt WITH blueprints flagged for missing blueprints. Output: $(tr '\n' ' ' < "$TMP_DIR/b3.out" | head -c 300)"
else
  ok
fi

# ── Layer C: the docs/SKILL surface actually wires the mode contract ──────────
# Cheap grep guards so a future edit that drops the contract from the human-facing
# surface fails here (the schema/engine could stay correct while the SKILL drifts).
grep -q 'mode' "$REPO_ROOT/schemas/receipts/plan-manifest.schema.json" && ok \
  || bad "schema lost the 'mode' property"
grep -q 'Execution Mode' "$REPO_ROOT/skills/plan-changeset/SKILL.md" && ok \
  || bad "skills/plan-changeset/SKILL.md missing the 'Execution Mode' section (WI-386 §3a contract)"
grep -q 'inline' "$REPO_ROOT/references/plan-review-protocol.md" && ok \
  || bad "plan-review-protocol.md dimension (i) not reconciled for inline mode"

# ── Report ──────────────────────────────────────────────────────────────────
echo "=== Tier 1: Conditional Plan Blueprints (WI-386) ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
fi
echo "  PASS — mode-gated blueprint requirement enforced fail-closed (schema + chain engine)"
exit 0
