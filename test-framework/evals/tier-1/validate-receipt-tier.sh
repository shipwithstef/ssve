#!/usr/bin/env bash
# Tier 1: risk-tiered receipt envelope (WI-385).
#
# This is a VALUE-REDUCTION on the chain-enforcement core, so the validator
# proves the fail-CLOSED directions hermetically: tier derivation defaults to
# full on infra/runtime-invisible/over-threshold/empty (AC3/AC4), there are
# EXACTLY two non-quick-fix tiers (AC5), the low tier's "never self-review" fence
# is MECHANICAL (author_family != reviewer_family, both required — AC1/AC2), and
# the whole graded path is DEFAULT-OFF (absent opt-in → full 5, byte-identical).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
echo "=== Tier 1: Risk-tiered receipt envelope (WI-385) ==="

DTR="scripts/derive-receipt-tier.mjs"; FAM="scripts/lib/cognitive-family.mjs"
for f in "$DTR" "$FAM" scripts/check-chain-receipts.mjs scripts/emit-receipt.mjs; do
  node --check "$f" 2>/dev/null && pass "$(basename "$f") parses" || fail "$(basename "$f") syntax error"
done

node - <<'NODE' && pass "plan/exec receipt schemas expose AGY as a truthful reviewer host" || fail "plan/exec receipt schemas still force AGY to masquerade as another host"
const fs = require("fs");
for (const name of ["review-plan", "review-exec"]) {
  const schema = JSON.parse(fs.readFileSync(`schemas/receipts/${name}.schema.json`, "utf8"));
  const review = schema.properties.adversarial_review.properties;
  for (const field of ["primary_reviewer_host", "fallback_host"]) {
    if (!review[field].enum.includes("agy")) process.exit(1);
  }
}
NODE

# ---- AC3/AC4/AC5: pure tier classifier — fail-closed + exactly two tiers ------
node --input-type=module -e '
import { classifyFiles } from "./scripts/derive-receipt-tier.mjs";
import { familyOf, crossFamily } from "./scripts/lib/cognitive-family.mjs";
let rc=0; const ok=(c,m)=>{if(!c){console.log("  ✗ "+m);rc=1;}};
// LOW: small, runtime-visible, no infra
ok(classifyFiles(["src/Button.tsx"],10).tier==="low","small visible diff → low");
// FULL: infra/hot-path
ok(classifyFiles(["hooks/svc-x.mjs"],5).tier==="full","hooks/ touch → full");
ok(classifyFiles(["scripts/wire-hooks.mjs"],5).tier==="full","scripts/wire-* → full");
ok(classifyFiles(["test-framework/evals/tier-1/x.sh"],5).tier==="full","tier-1 validator → full");
ok(classifyFiles(["skills-manifest.json"],5).tier==="full","skills-manifest.json → full");
// FULL: runtime-invisible logic (no exercisable file)
ok(classifyFiles(["scripts/foo.mjs"],5).tier==="full","runtime-invisible script logic → full (AC4)");
// FULL: over LOC threshold even when visible
ok(classifyFiles(["src/Button.tsx"],200).tier==="full","visible but 200 LOC → full");
// FULL: CRITICAL concern
ok(classifyFiles(["src/Button.tsx"],10,{criticalConcern:true}).tier==="full","CRITICAL concern → full (AC4)");
// FULL: empty + binary(Infinity) → fail-closed
ok(classifyFiles([],0).tier==="full","empty file set → full (fail-closed)");
ok(classifyFiles(["src/Button.tsx"],Infinity).tier==="full","binary/unknown LOC → full (fail-closed)");
// EXACTLY two tiers: classifier only ever returns low|full
const tiers=new Set();for(const c of [["src/a.tsx"],["hooks/a.mjs"],["scripts/a.mjs"],[]]) tiers.add(classifyFiles(c,10).tier);
ok([...tiers].every(t=>t==="low"||t==="full"),"only low|full ever returned (AC5: exactly two tiers)");
// family fence math
ok(crossFamily("claude","gemini").crossFamily===true,"claude/gemini → cross-family");
ok(crossFamily("claude","codex").crossFamily===true,"claude/codex → cross-family");
ok(crossFamily("claude","claude").crossFamily===false,"claude/claude → NOT cross-family (self-review)");
ok(familyOf("gemini")==="google"&&familyOf("codex")==="openai"&&familyOf("claude")==="anthropic","host→family map");
ok(familyOf("fake-host")==="unknown"&&crossFamily("claude","fake-host").crossFamily===false,"unknown host → unknown family, NOT cross-family (G6#4 strict, no literal-string bypass)");
ok(familyOf("agy")==="google"&&familyOf("agy-cli")==="google"&&familyOf("claude-opus-4")==="anthropic","host variants resolve (agy/agy-cli→google, claude-opus→anthropic)");
process.exit(rc);
' && pass "tier classifier fail-closed + exactly-two-tiers + family fence math (AC3/AC4/AC5)" || fail "tier/family unit logic wrong"

# ---- Integration (temp git repo): the FENCE + DEFAULT-OFF, fail-closed --------
TMPR="$(mktemp -d)"; trap 'rm -rf "$TMPR"' EXIT
git -C "$TMPR" init -q; git -C "$TMPR" config user.email contact-0a7bb000f7@example.invalid; git -C "$TMPR" config user.name t
mkdir -p "$TMPR/src"; printf 'export const x = 1;\n' > "$TMPR/src/x.tsx"
git -C "$TMPR" add -A >/dev/null 2>&1; git -C "$TMPR" commit -qm "small visible change" >/dev/null 2>&1
LOWSHA="$(git -C "$TMPR" rev-parse HEAD)"; SHORT="${LOWSHA:0:7}"
DIR="$TMPR/.svc/receipts/$SHORT"; mkdir -p "$DIR"
CHK="$REPO_ROOT/scripts/check-chain-receipts.mjs"
# Fully-valid minimal low-set receipts (so the POSITIVE case reaches the per-receipt
# validation loop). plan-manifest uses mode:inline to skip the blueprint requirement.
PM='{"receipt_type":"plan-manifest","schema_version":1,"wi":"WI-TEST","scope":{},"dependencies":[],"decision_trace":[],"task_graph":[],"validation_plan":[],"risk_rollback":{},"timestamp":"2026-01-01T00:00:00Z","execution_command_sequence":[],"mode":"inline"}'
ER='{"receipt_type":"exec-record","schema_version":1,"wi":"WI-TEST","diff_hash":"x","files_touched":[],"dispatch_model":"x","timestamp":"2026-01-01T00:00:00Z"}'
# review-exec body: $1 = the USED reviewer host (the fence re-derives families
# from the HOSTS, not the declared family strings); $2 = extra top-level fields.
rx(){ printf '{"receipt_type":"review-exec","schema_version":1,"wi":"WI-TEST","diff_hash":"x","self_review":{"orchestrator":"claude","findings_count":0,"notes":"x"},"adversarial_review":{"primary_reviewer_host":"%s","primary_used":true,"fallback_host":"codex","fallback_used":false,"findings":[],"iteration_count":0},"verdict":"pass","timestamp":"2026-01-01T00:00:00Z"%s}\n' "$1" "$2"; }
echo "$PM" > "$DIR/plan-manifest.json"; echo "$ER" > "$DIR/exec-record.json"
run(){ cd "$TMPR" && node "$CHK" --sha "$LOWSHA" 2>/dev/null; cd "$REPO_ROOT"; }
ck(){ node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).results[0];process.exit(('"$1"')?0:1)})'; }

# (a) DEFAULT-OFF: no chain-policy → low set is INCOMPLETE (full 5 required)
rx gemini ',"author_family":"anthropic","reviewer_family":"google"' > "$DIR/review-exec.json"
rm -f "$TMPR/.svc/chain-policy.json"
run | ck 'r.type==="incomplete"&&!r.ok' && pass "default-OFF: low set rejected as incomplete (full 5 required) — value-reduction dormant" || fail "default-off did NOT require full 5"

# (b) OPT-IN + low-derive + cross-family HOSTS (claude→gemini) → low tier accepted
printf '{"risk_tiering":"graded"}\n' > "$TMPR/.svc/chain-policy.json"
run | ck 'r.ok&&r.type==="complete"' && pass "opt-in + low-derive + cross-family review → low tier accepted (complete)" || fail "low tier not accepted on a valid cross-family low envelope"

# (b2) The active independent Google route is AGY, not a relabeled Gemini CLI.
#      It must satisfy the same schema + mechanical family fence truthfully.
rx agy ',"author_family":"anthropic","reviewer_family":"google"' > "$DIR/review-exec.json"
run | ck 'r.ok&&r.type==="complete"' && pass "truthful AGY reviewer host → accepted as independent Google review" || fail "AGY review cannot close the chain truthfully"

# (c) OPT-IN + SAME-family HOSTS (claude reviewing claude) → REJECTED (AC1/AC2)
rx claude ',"author_family":"anthropic","reviewer_family":"anthropic"' > "$DIR/review-exec.json"
run | ck '!r.ok&&r.type==="invalid"&&/cross-family|self-review/.test(r.missing.join(" "))' && pass "same-family review HOSTS (claude/claude) → REJECTED (mechanical fence)" || fail "same-family low review was NOT rejected"

# (f) FORGED declared families: declared cross-family BUT same-family HOSTS → REJECTED
#     (Gemini G6 #3 defense — check-chain re-derives from hosts, never trusts declared)
rx claude ',"author_family":"anthropic","reviewer_family":"google"' > "$DIR/review-exec.json"
run | ck '!r.ok&&r.type==="invalid"&&/cross-family|self-review|hosts/.test(r.missing.join(" "))' && pass "FORGED declared cross-family over same-family hosts → REJECTED (declared families not trusted)" || fail "forged cross-family declaration slipped the fence"

# (g) unknown reviewer host → REJECTED (Gemini G6 #4 — unknown family is not cross-family)
rx fakehost ',"author_family":"anthropic","reviewer_family":"google"' > "$DIR/review-exec.json"
run | ck '!r.ok&&r.type==="invalid"' && pass "unknown reviewer host → REJECTED (familyOf strict-unknown, not a literal-string bypass)" || fail "unknown host slipped the fence"

# (d) OPT-IN + missing declared families on low review → REJECTED (required fields)
rx gemini '' > "$DIR/review-exec.json"
run | ck '!r.ok&&/author_family|reviewer_family/.test(r.missing.join(" "))' && pass "low review missing author_family/reviewer_family → REJECTED (required)" || fail "low review without families was accepted"

# (e) declared-low-but-derives-FULL: infra file → full 5 required even with opt-in
git -C "$TMPR" rm -q src/x.tsx >/dev/null 2>&1; mkdir -p "$TMPR/hooks"; printf 'x\n' > "$TMPR/hooks/svc-x.mjs"
git -C "$TMPR" add -A >/dev/null 2>&1; git -C "$TMPR" commit -qm "infra change" >/dev/null 2>&1
FULLSHA="$(git -C "$TMPR" rev-parse HEAD)"; FDIR="$TMPR/.svc/receipts/${FULLSHA:0:7}"; mkdir -p "$FDIR"
echo "$PM" > "$FDIR/plan-manifest.json"; echo "$ER" > "$FDIR/exec-record.json"
rx gemini ',"author_family":"anthropic","reviewer_family":"google"' > "$FDIR/review-exec.json"
cd "$TMPR" && OUTF="$(node "$CHK" --sha "$FULLSHA" 2>/dev/null)"; cd "$REPO_ROOT"
echo "$OUTF" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).results[0];process.exit(!r.ok&&r.type==="incomplete"?0:1)})' && pass "declared-low but diff derives FULL (infra touch) → full 5 required (never trusts declared tier; fail-closed)" || fail "an infra commit slipped through on the low set"

# (h) Gemini G6 #1 (CRITICAL): RENAME an infra file to a runtime-visible path → must derive FULL
#     (--name-only would show only the new path; --name-status exposes the infra old path)
mkdir -p "$TMPR/src"
git -C "$TMPR" mv hooks/svc-x.mjs src/renamed.tsx >/dev/null 2>&1
git -C "$TMPR" add -A >/dev/null 2>&1; git -C "$TMPR" commit -qm "rename infra to visible" >/dev/null 2>&1
RENSHA="$(git -C "$TMPR" rev-parse HEAD)"
RTIER=$(cd "$TMPR" && node "$REPO_ROOT/scripts/derive-receipt-tier.mjs" --sha "$RENSHA" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).tier))'; cd "$REPO_ROOT")
[ "$RTIER" = "full" ] && pass "rename of an infra file to a runtime-visible path → derives FULL (old path caught via --name-status, G6#1)" || fail "rename bypassed infra → derived '$RTIER' (CRITICAL fail-open)"

echo "receipt-tier: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
