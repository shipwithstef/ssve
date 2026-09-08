#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone -q --no-local "$ROOT" "$TMP/repo"
mkdir -p "$TMP/repo/scripts/lib" "$TMP/repo/schemas/receipts" "$TMP/repo/docs/specs/audit" "$TMP/repo/docs/specs/reviews"
cp "$ROOT/scripts/check-chain-receipts.mjs" "$ROOT/scripts/check-review-round-cap.mjs" "$ROOT/scripts/state-io.mjs" "$ROOT/scripts/derive-receipt-tier.mjs" "$ROOT/scripts/quick-fix-eligibility.mjs" "$TMP/repo/scripts/"
cp "$ROOT/scripts/run-external-review.mjs" "$TMP/repo/scripts/"
cp "$ROOT/scripts/lib/review-report-recovery.mjs" "$ROOT/scripts/lib/normalize-ac-table.mjs" "$ROOT/scripts/lib/cognitive-family.mjs" "$ROOT/scripts/lib/reviewer-evidence.mjs" "$ROOT/scripts/lib/external-review-provenance.mjs" "$ROOT/scripts/lib/bounded-exit.mjs" "$ROOT/scripts/lib/evidence-schema.mjs" "$TMP/repo/scripts/lib/"
cp "$ROOT/scripts/lib/reviewer-resources.mjs" "$TMP/repo/scripts/lib/"
cp "$ROOT/scripts/lib/history-epoch.mjs" "$TMP/repo/scripts/lib/"
mkdir -p "$TMP/repo/docs/specs/privacy"
cp "$ROOT/docs/specs/privacy/history-epoch.json" "$TMP/repo/docs/specs/privacy/"
cp "$ROOT/schemas/receipts/retroactive-attestation.schema.json" "$TMP/repo/schemas/receipts/"
cp "$ROOT/schemas/receipts/bounded-exit.schema.json" "$TMP/repo/schemas/receipts/"
cp "$ROOT/schemas/receipts/bounded-exit-evidence.schema.json" "$TMP/repo/schemas/receipts/"
cp "$ROOT/docs/specs/audit/wi-472-reconcile-backlog.json" "$ROOT/docs/specs/audit/wi-472-reconcile-backlog-bundle.json" "$TMP/repo/docs/specs/audit/"
cp "$ROOT/docs/specs/reviews/wi-472-backlog-review.json" "$TMP/repo/docs/specs/reviews/"
cp -R "$ROOT/docs/specs/reviews/WI-472-g6-round3-artifacts" "$TMP/repo/docs/specs/reviews/"
cd "$TMP/repo"
node --input-type=module <<'NODE'
import fs from "node:fs";
const bundle=JSON.parse(fs.readFileSync("docs/specs/audit/wi-472-reconcile-backlog-bundle.json"));
const review=JSON.parse(fs.readFileSync("docs/specs/reviews/wi-472-backlog-review.json"));
const row=bundle.rows[0], {basis_sha256,...basis}=row;
const receipt={receipt_type:"retroactive-attestation",schema_version:1,wi:"WI-472",target_sha:row.sha,tree_hash:row.proof.target_tree,historical_range:bundle.historical_range,ledger_sha256:bundle.ledger_sha256,bundle_sha256:bundle.bundle_sha256,basis_sha256,basis,disposition:row.disposition,evidence:row.evidence,producer:bundle.producer,reviewer:{host:review.reviewer.host,family:review.reviewer.family,model:review.reviewer.model,run_id:review.reviewer.run_id},review:{request_id:review.reviewer.request_id,package_sha256:review.reviewer.package_sha256,receipt_sha256:review.reviewer.receipt_sha256,findings_sha256:review.reviewer.findings_sha256,row_certification:`wi472-backlog-${row.sha}`},verdict:"approved",zero_waivers:true,timestamp:review.reviewed_at};
fs.writeFileSync("good.json",JSON.stringify({"retroactive-attestation":receipt}));
fs.writeFileSync("bad-tree.json",JSON.stringify({"retroactive-attestation":{...receipt,tree_hash:"0".repeat(40)}}));
fs.writeFileSync("bad-family.json",JSON.stringify({"retroactive-attestation":{...receipt,reviewer:{...receipt.reviewer,host:"codex",family:"openai"}}}));
fs.writeFileSync("bad-basis.json",JSON.stringify({"retroactive-attestation":{...receipt,basis_sha256:"a".repeat(64)}}));
fs.writeFileSync("bad-extra.json",JSON.stringify({"retroactive-attestation":{...receipt,AUDIT_EXEMPT:true}}));
fs.writeFileSync("sha.txt",row.sha);
NODE
SHA="$(cat sha.txt)"
MIRROR="$TMP/repo/.svc/receipts/${SHA:0:7}"
mkdir -p "$MIRROR"
node -e 'const fs=require("fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); fs.writeFileSync(process.argv[2],JSON.stringify(value["retroactive-attestation"]));' good.json "$MIRROR/retroactive-attestation.json"
RESULT="$(node scripts/check-chain-receipts.mjs --sha "$SHA" || true)"
if ! grep -q '"type": "retroactive-attestation"' <<<"$RESULT"; then
  echo "validate-retroactive-attestation: FAIL (tracked authority rejected)" >&2
  echo "$RESULT" >&2
  exit 1
fi
for BAD in bad-tree bad-family bad-basis bad-extra; do
  node -e 'const fs=require("fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); fs.writeFileSync(process.argv[2],JSON.stringify(value["retroactive-attestation"]));' "$BAD.json" "$MIRROR/retroactive-attestation.json"
  if node scripts/check-chain-receipts.mjs --sha "$SHA" >/dev/null 2>&1; then
    echo "validate-retroactive-attestation: FAIL ($BAD accepted)" >&2
    exit 1
  fi
done
MARKER="$TMP/injected"
if node scripts/check-chain-receipts.mjs --sha "HEAD; touch $MARKER #" >/dev/null 2>&1; then true; fi
test ! -e "$MARKER"
echo "validate-retroactive-attestation: PASS (tracked authority accepted; 4 forgeries + shell injection rejected)"
