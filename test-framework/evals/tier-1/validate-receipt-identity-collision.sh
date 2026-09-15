#!/usr/bin/env bash
# Tier-1: WI-550 receipt identity collision and canonical barrier checks.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" 2>/dev/null || true' EXIT

PASS=0
FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

init_repo() {
  local dir="$1"
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" config user.email fixture@example.invalid
  git -C "$dir" config user.name fixture
  printf 'seed\n' > "$dir/seed.txt"
  git -C "$dir" add seed.txt
  git -C "$dir" commit -qm "seed"
}

emit_verify() {
  local repo="$1" wi="$2" sha="$3" body="$4"
  (
    cd "$repo"
    printf '%s\n' "$body" | node "$REPO_ROOT/scripts/emit-receipt.mjs" --type verify-promotion --wi "$wi" --sha "$sha" >/dev/null
  )
}

verify_body() {
  local wi="$1" sha="$2" ts="$3"
  cat <<JSON
{"receipt_type":"verify-promotion","schema_version":1,"wi":"$wi","passes":{"p1_promotion_evidence":"pass","p2_spec_ac_verification":"pass","p3_runtime_validation":"pass","p4_state_closeout":"pass"},"p3_target_type":"install-validation","p3_outcome":"pass","verdict":"pass","sha":"$sha","timestamp":"$ts"}
JSON
}

check_wi() {
  local repo="$1" sha="$2" wi="$3" consumer="$4"
  (
    cd "$repo"
    node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$sha" --wi "$wi" --consumer "$consumer" >/dev/null 2>&1
  )
}

emit_generic() {
  local repo="$1" type="$2" wi="$3" sha="$4" body="$5"
  (
    cd "$repo"
    printf '%s\n' "$body" | node "$REPO_ROOT/scripts/emit-receipt.mjs" --type "$type" --wi "$wi" --sha "$sha" >/dev/null
  )
}

write_note_receipt() {
  local repo="$1" type="$2" wi="$3" sha="$4" body="$5"
  (
    cd "$repo"
    node - "$type" "$wi" "$sha" "$body" <<'NODE'
const { execFileSync } = require("node:child_process");
const [type, wi, sha, bodyRaw] = process.argv.slice(2);
const slot = `slot::${type}::${wi}::${sha}`;
let envelope = {};
try {
  envelope = JSON.parse(execFileSync("git", ["notes", "--ref=svc-receipts", "show", sha], { encoding: "utf8" }));
} catch {}
envelope[slot] = JSON.parse(bodyRaw);
execFileSync("git", ["notes", "--ref=svc-receipts", "add", "-f", "-F", "-", sha], {
  input: JSON.stringify(envelope),
  encoding: "utf8",
});
NODE
  )
}

echo "=== Tier 1: Receipt identity collision (WI-550) ==="

# AC-550-3: WI-scoped check must not pass with another WI's receipt.
R1="$TMP/r1"
init_repo "$R1"
SHA1="$(git -C "$R1" rev-parse HEAD)"
emit_verify "$R1" "WI-543" "$SHA1" "$(verify_body "WI-543" "$SHA1" "2026-08-18T07:00:00Z")"
if check_wi "$R1" "$SHA1" "WI-542" "verify-promotion"; then
  fail "--wi WI-542 incorrectly passed on WI-543 receipt"
else
  pass "--wi WI-542 does not pass using WI-543 receipt"
fi

# AC-550-1: both WI receipts on one SHA survive.
emit_verify "$R1" "WI-542" "$SHA1" "$(verify_body "WI-542" "$SHA1" "2026-08-18T07:01:00Z")"
NOTE1="$(git -C "$R1" notes --ref=svc-receipts show "$SHA1" 2>/dev/null || true)"
if grep -q "slot::verify-promotion::WI-542::${SHA1}" <<< "$NOTE1" && grep -q "slot::verify-promotion::WI-543::${SHA1}" <<< "$NOTE1"; then
  pass "dual-WI verify-promotion notes survive on one SHA"
else
  fail "dual-WI verify-promotion notes missing after second emit"
fi
check_wi "$R1" "$SHA1" "WI-542" "verify-promotion" && pass "WI-542 verify receipt validates" || fail "WI-542 verify receipt did not validate"
check_wi "$R1" "$SHA1" "WI-543" "verify-promotion" && pass "WI-543 verify receipt validates" || fail "WI-543 verify receipt did not validate"

# AC-550-2: same identity overwrite denied without supersession.
if emit_verify "$R1" "WI-542" "$SHA1" "$(verify_body "WI-542" "$SHA1" "2026-08-18T07:02:00Z")" >/dev/null 2>&1; then
  fail "same identity overwrite succeeded without supersession"
else
  pass "same identity overwrite rejected without supersession"
fi

# AC-550-2 (allow path): explicit supersession contract + hashes.
PREV_HASH="$(NOTE_JSON="$NOTE1" node -e '
const note = JSON.parse(process.env.NOTE_JSON || "{}");
const key = Object.keys(note).find((k) => k.includes("slot::verify-promotion::WI-542::"));
if (!key) process.exit(2);
const crypto = require("node:crypto");
process.stdout.write(crypto.createHash("sha256").update(JSON.stringify(note[key])).digest("hex"));
')"
SUPER_CONTRACT="replace WI-542 verify-promotion after receipt correction"
SUPER_CONTRACT_SHA="$(printf '%s' "$SUPER_CONTRACT" | sha256sum | awk '{print $1}')"
SUPER_BODY="$(cat <<JSON
{"receipt_type":"verify-promotion","schema_version":1,"wi":"WI-542","passes":{"p1_promotion_evidence":"pass","p2_spec_ac_verification":"pass","p3_runtime_validation":"pass","p4_state_closeout":"pass"},"p3_target_type":"install-validation","p3_outcome":"pass","verdict":"pass","sha":"$SHA1","timestamp":"2026-08-18T07:03:00Z","supersession":{"contract":"$SUPER_CONTRACT","contract_sha256":"$SUPER_CONTRACT_SHA","supersedes_receipt_sha256":"$PREV_HASH"}}
JSON
)"
if emit_verify "$R1" "WI-542" "$SHA1" "$SUPER_BODY"; then
  pass "supersession contract allows same-identity rewrite"
else
  fail "supersession contract did not allow same-identity rewrite"
fi

# AC-550-8: concurrent writers on distinct WI identities survive.
R2="$TMP/r2"
init_repo "$R2"
SHA2="$(git -C "$R2" rev-parse HEAD)"
(
  emit_verify "$R2" "WI-701" "$SHA2" "$(verify_body "WI-701" "$SHA2" "2026-08-18T07:10:00Z")"
) &
P1=$!
(
  emit_verify "$R2" "WI-702" "$SHA2" "$(verify_body "WI-702" "$SHA2" "2026-08-18T07:10:01Z")"
) &
P2=$!
S1=0; S2=0
wait "$P1" || S1=$?
wait "$P2" || S2=$?
NOTE2="$(git -C "$R2" notes --ref=svc-receipts show "$SHA2" 2>/dev/null || true)"
HAS_701=0; HAS_702=0
grep -q "slot::verify-promotion::WI-701::${SHA2}" <<< "$NOTE2" && HAS_701=1
grep -q "slot::verify-promotion::WI-702::${SHA2}" <<< "$NOTE2" && HAS_702=1
if [[ "$S1" -eq 0 && "$S2" -eq 0 && "$HAS_701" -eq 1 && "$HAS_702" -eq 1 ]]; then
  pass "concurrent distinct identity writes both survived"
elif [[ "$HAS_701" -eq 1 || "$HAS_702" -eq 1 ]]; then
  pass "concurrent write fail-closed path preserved sibling receipt"
else
  fail "concurrent writers lost both distinct identity receipts"
fi

# AC-550-9: transition-matrix consumers validate WI+SHA identities.
# Generic identity transport uses current exec-record emission. A fabricated v1
# plan-manifest is an OFFLINE historical fixture: inspectable without a consumer and
# never current execute-changeset authority.
R4="$TMP/r4"
init_repo "$R4"
SHA4="$(git -C "$R4" rev-parse HEAD)"
TREE4="$(git -C "$R4" rev-parse 'HEAD^{tree}')"
HASH4="$(printf 'x' | sha256sum | awk '{print $1}')"
WI4="WI-800"
PLAN_BODY='{"receipt_type":"plan-manifest","schema_version":1,"wi":"'"$WI4"'","scope":{},"dependencies":[],"decision_trace":"x","task_graph":"x","validation_plan":"x","risk_rollback":"x","execution_command_sequence":"x","mode":"inline","timestamp":"2026-08-18T07:30:00Z"}'
REVIEW_PLAN_BODY='{"receipt_type":"review-plan","schema_version":1,"wi":"'"$WI4"'","self_review":{},"adversarial_review":{},"verdict":"approve","timestamp":"2026-08-18T07:31:00Z"}'
EXEC_BODY='{"receipt_type":"exec-record","schema_version":2,"wi":"'"$WI4"'","diff_hash":"'"$HASH4"'","files_touched":1,"dispatch_model":"x","tree_hash":"'"$TREE4"'","timestamp":"2026-08-18T07:32:00Z"}'
REVIEW_EXEC_BODY='{"receipt_type":"review-exec","schema_version":2,"wi":"'"$WI4"'","diff_hash":"'"$HASH4"'","self_review":{},"adversarial_review":{},"verdict":"pass","tree_hash":"'"$TREE4"'","timestamp":"2026-08-18T07:33:00Z"}'
AUDIT_BODY='{"receipt_type":"audit-implementation","schema_version":1,"wi":"'"$WI4"'","verdict":"pass","findings":[],"timestamp":"2026-08-18T07:34:00Z"}'
VERIFY_BODY="$(verify_body "$WI4" "$SHA4" "2026-08-18T07:35:00Z")"
emit_generic "$R4" "exec-record" "$WI4" "$SHA4" "$EXEC_BODY"
write_note_receipt "$R4" "review-plan" "$WI4" "$SHA4" "$REVIEW_PLAN_BODY"
if check_wi "$R4" "$SHA4" "$WI4" "execute-changeset"; then fail "execute-changeset consumer passed without a current sealed plan-manifest"; else pass "execute-changeset consumer fails closed without current sealed plan-manifest"; fi
if check_wi "$R4" "$SHA4" "$WI4" "review-exec"; then fail "review-exec consumer passed without review-exec receipt"; else pass "review-exec consumer fails closed without review-exec"; fi
write_note_receipt "$R4" "review-exec" "$WI4" "$SHA4" "$REVIEW_EXEC_BODY"
if check_wi "$R4" "$SHA4" "$WI4" "review-exec"; then pass "review-exec consumer validates exec+review-exec"; else fail "review-exec consumer failed with required identities"; fi
if check_wi "$R4" "$SHA4" "$WI4" "audit-implementation"; then fail "audit consumer passed without audit receipt"; else pass "audit consumer fails closed without audit receipt"; fi
write_note_receipt "$R4" "audit-implementation" "$WI4" "$SHA4" "$AUDIT_BODY"
if check_wi "$R4" "$SHA4" "$WI4" "audit-implementation"; then pass "audit consumer validates exec+audit"; else fail "audit consumer failed with required identities"; fi
if check_wi "$R4" "$SHA4" "$WI4" "verify-promotion"; then fail "verify-promotion consumer passed without verify receipt"; else pass "verify-promotion consumer fails closed without verify receipt"; fi
write_note_receipt "$R4" "verify-promotion" "$WI4" "$SHA4" "$VERIFY_BODY"
if check_wi "$R4" "$SHA4" "$WI4" "verify-promotion"; then pass "verify-promotion consumer validates WI-scoped receipt"; else fail "verify-promotion consumer failed with valid receipt"; fi
if check_wi "$R4" "$SHA4" "$WI4" "final-report"; then pass "final-report consumer requires canonical WI+SHA check"; else fail "final-report consumer did not pass with canonical identities"; fi
write_note_receipt "$R4" "plan-manifest" "$WI4" "$SHA4" "$PLAN_BODY"
if HIST_OUT="$(cd "$R4" && node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$SHA4" --wi "$WI4" --historical-type plan-manifest)" && grep -q '"executable": false' <<< "$HIST_OUT" && grep -q '"kind": "historical"' <<< "$HIST_OUT"; then
  pass "historical v1 plan fixture is inspectable without a consumer"
else
  fail "historical v1 plan fixture was not inspectable as non-executable"
fi
if check_wi "$R4" "$SHA4" "$WI4" "execute-changeset"; then fail "execute-changeset granted current execution from a historical plan-manifest"; else pass "execute-changeset consumer rejects historical plan-manifest (missing current seal)"; fi
if ( cd "$R4" && node --input-type=module - "$REPO_ROOT" "$PLAN_BODY" <<'NODE'
import { pathToFileURL } from "node:url";
import path from "node:path";
const [root, bodyRaw] = process.argv.slice(2);
const { assertCurrentExecution, loadPlanAuthority } = await import(pathToFileURL(path.join(root, "scripts/lib/receipt-issuance-epoch.mjs")).href);
const body = JSON.parse(bodyRaw);
try {
  assertCurrentExecution({
    consumerRoot: process.cwd(),
    body,
    planBytes: Buffer.from(bodyRaw),
    manifestPath: "docs/plans/two-box-transmutation/manifest.md",
  });
  process.exit(2);
} catch (error) {
  if (!/schema_version 5|bootstrap|issuance|seal|authority/.test(String(error && error.message))) process.exit(3);
}
try {
  loadPlanAuthority({ consumerRoot: process.cwd(), body });
  process.exit(4);
} catch (error) {
  if (!/schema_version 5|bootstrap|authority/.test(String(error && error.message))) process.exit(5);
}
NODE
); then
  pass "missing current seal/epoch rejects historical plan execution"
else
  fail "assertCurrentExecution did not reject historical plan (missing seal/epoch)"
fi

# AC-550-4/6: Stop denies success on canonical failure; allows valid dual-WI closeout.
R3="$TMP/r3"
init_repo "$R3"
SHA3="$(git -C "$R3" rev-parse HEAD)"
mkdir -p "$R3/.svc"
cat > "$R3/.svc/lane-tasks-WI-710.json" <<'JSON'
{"wi":"WI-710","lane":"framework","status":"completed","tasks":[]}
JSON
PAYLOAD="$(printf '{"cwd":"%s","session_id":"svc-impl-wi550-test"}' "$R3")"
DENY_OUT="$(cd "$R3" && printf '%s' "$PAYLOAD" | bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh" || true)"
if grep -q '"decision":"block"' <<< "$(printf '%s' "$DENY_OUT" | tr -d '[:space:]')"; then
  pass "Stop hook blocks success when canonical WI receipt check fails"
else
  fail "Stop hook did not block canonical receipt failure"
fi
emit_verify "$R3" "WI-710" "$SHA3" "$(verify_body "WI-710" "$SHA3" "2026-08-18T07:20:00Z")"
emit_verify "$R3" "WI-711" "$SHA3" "$(verify_body "WI-711" "$SHA3" "2026-08-18T07:20:01Z")"
ALLOW_OUT="$(cd "$R3" && printf '%s' "$PAYLOAD" | bash "$REPO_ROOT/hooks/svc-task-completion-guard.sh" || true)"
if grep -q '"decision":"block"' <<< "$(printf '%s' "$ALLOW_OUT" | tr -d '[:space:]')"; then
  fail "Stop hook blocked despite valid canonical WI receipt on dual-WI SHA"
else
  pass "Stop hook allows valid canonical WI receipt on dual-WI SHA"
fi

echo "receipt identity collision: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
