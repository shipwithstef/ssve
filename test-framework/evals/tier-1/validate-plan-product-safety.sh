#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
node --input-type=module - "$ROOT" <<'NODE'
import assert from "node:assert/strict"; import path from "node:path"; import { pathToFileURL } from "node:url";
const root=process.argv[2]; const {validatePlanContract}=await import(pathToFileURL(path.join(root,"scripts/validate-plan-contract.mjs")));
const base={schema_version:1,manifest:"missing.md",ownership:[{task:"A",paths:["x"]}],resource_review:{verification:"changed-executable-census",denominator:0,disposition:"no-risky-resource-writers",evidence:"reviewed"},resource_writers:[],claims:[],executables:[]};
assert.ok(validatePlanContract({...base,ownership:[...base.ownership,{task:"B",paths:["x"]}]},{root}).some(e=>e.includes("ownership scopes overlap")));
assert.ok(validatePlanContract({...base,ownership:[{task:"A",paths:["src/**"]},{task:"B",paths:["src/auth.ts"]}]},{root}).some(e=>e.includes("ownership scopes overlap")));
assert.ok(validatePlanContract({...base,resource_writers:[{resource:"money",ordering:"",compensation:"",property_sweep:""}]},{root}).some(e=>e.includes("ordering")));
assert.ok(validatePlanContract({...base,claims:[{kind:"absence",evidence:{verification:"diff-manifest-parity"}}]},{root}).some(e=>e.includes("denominator")));
assert.ok(validatePlanContract({...base,executables:[{path:"scripts/validate-plan-contract.mjs",consumers:[]}]},{root}).some(e=>e.includes("named consumers")));
NODE

FIX="$TMP/repo"; mkdir -p "$FIX/.svc" "$FIX/docs"; git -C "$FIX" init -q; git -C "$FIX" config user.name t; git -C "$FIX" config user.email t@example.invalid
printf 'base\n' > "$FIX/base"; git -C "$FIX" add base; git -C "$FIX" commit -qm base
printf 'changed\n' > "$FIX/actual"; printf 'state\n' > "$FIX/.svc/durable.json"
printf '%s\n' '## Files Planned' '' '| Task | Action | File(s) | Purpose |' '|---|---|---|---|' '| T01 | CREATE | planned-only | x |' '' '## Task Graph' > "$FIX/manifest.md"
printf '%s\n' '{"schema_version":1,"manifest":"manifest.md","ownership":[{"task":"T01","paths":["planned-only"]}],"resource_review":{"verification":"changed-executable-census","denominator":0,"disposition":"no-risky-resource-writers","evidence":"reviewed"},"resource_writers":[],"claims":[],"executables":[]}' > "$FIX/contract.json"
if node "$ROOT/scripts/validate-plan-contract.mjs" "$FIX/contract.json" "$FIX" >"$TMP/parity.out" 2>&1; then echo "FAIL: asymmetric manifest parity passed" >&2; exit 1; fi
grep -q 'manifest path has no actual change: planned-only' "$TMP/parity.out"
grep -q 'changed path is undeclared.*\.svc/durable.json' "$TMP/parity.out"
WRITER="$TMP/writer"; mkdir -p "$WRITER/packages/accounts/src"; git -C "$WRITER" init -q; git -C "$WRITER" config user.name fixture; git -C "$WRITER" config user.email fixture@example.invalid
printf '%s\n' '## Files Planned' '| Task | Action | File(s) | Purpose |' '|---|---|---|---|' '| T01 | MODIFY | packages/accounts/src/billing.mjs | fixture |' '## Task Graph' > "$WRITER/manifest.md"
printf '%s\n' 'export function apply(amount) { return amount; }' > "$WRITER/packages/accounts/src/billing.mjs"; git -C "$WRITER" add .; git -C "$WRITER" commit -qm base
WRITER_BASE="$(git -C "$WRITER" rev-parse HEAD)"
printf '%s\n' 'export async function apply(prisma, amount) { return prisma.account.update({data:{balance:{decrement:amount}}}); }' > "$WRITER/packages/accounts/src/billing.mjs"
WRITER_CONTRACT="$TMP/writer-contract.json"; WRITER_ERR="$TMP/writer-contract.err"
printf '%s\n' '{"schema_version":1,"manifest":"manifest.md","ownership":[{"task":"T01","paths":["packages/accounts/src/billing.mjs"]}],"resource_review":{"verification":"changed-executable-census","denominator":1,"disposition":"no-risky-resource-writers","evidence":"reviewed"},"resource_writers":[],"claims":[],"executables":[]}' > "$WRITER_CONTRACT"
if node "$ROOT/scripts/validate-plan-contract.mjs" "$WRITER_CONTRACT" "$WRITER" 2>"$WRITER_ERR"; then echo "detected money writer omission accepted" >&2; exit 1; fi
grep -q 'detected money writer has no resource_writers contract row' "$WRITER_ERR"
node -e 'const fs=require("fs");const p=process.argv[1],c=require(p);c.resource_review.disposition="declared-risky-resource-writers";c.resource_writers=[{resource:"money",ordering:"debit before fulfillment with idempotency key",compensation:"credit exact debit on failure",property_sweep:"amount precision currency sign and retry"}];fs.writeFileSync(p,JSON.stringify(c))' "$WRITER_CONTRACT"
node "$ROOT/scripts/validate-plan-contract.mjs" "$WRITER_CONTRACT" "$WRITER" >/dev/null
git -C "$WRITER" add .; git -C "$WRITER" commit -qm writer
node -e 'const fs=require("fs");const p=process.argv[1],c=require(p);c.base_sha=process.argv[2];fs.writeFileSync(p,JSON.stringify(c))' "$WRITER_CONTRACT" "$WRITER_BASE"
node "$ROOT/scripts/validate-plan-contract.mjs" "$WRITER_CONTRACT" "$WRITER" >/dev/null
node -e 'const fs=require("fs");const p=process.argv[1],c=require(p);c.base_sha="missing-base";fs.writeFileSync(p,JSON.stringify(c))' "$WRITER_CONTRACT"
if node "$ROOT/scripts/validate-plan-contract.mjs" "$WRITER_CONTRACT" "$WRITER" >/dev/null 2>&1; then echo "unresolvable plan base accepted" >&2; exit 1; fi
node scripts/validate-plan-contract.mjs docs/plans/2026-08-15-wi541-full-framework-transition/plan-contract.json "$ROOT"
node scripts/find-callers.mjs --identifier validate-plan-contract.mjs --root "$ROOT" > "$TMP/callers.json"
node -e 'const r=require(process.argv[1]); if(r.scanned_files<1||r.denominator!==r.scanned_files||r.queries.length<5||r.matched_files<2)process.exit(1)' "$TMP/callers.json"
mkdir -p "$TMP/census"; printf 'invokeValidatePlanContract();\n' > "$TMP/census/caller.mjs"
node scripts/find-callers.mjs --identifier validate-plan-contract.mjs --root "$TMP/census" > "$TMP/variant.json"
node -e 'const r=require(process.argv[1]);if(!r.matches.some(x=>x.queries.some(q=>q.query==="invokeValidatePlanContract")))process.exit(1)' "$TMP/variant.json"
if node scripts/find-callers.mjs --identifier definitely-absent-route --root "$TMP/census" > "$TMP/absent.json"; then echo "FAIL: absent caller returned success" >&2; exit 1; fi
node -e 'const r=require(process.argv[1]);if(!r.canonical_absence_proven||r.denominator!==1)process.exit(1)' "$TMP/absent.json"
echo "PASS: plan product safety blocks unsafe writers, unbounded claims, overlap, and inert executables"
