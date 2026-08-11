#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

node scripts/reconcile-receipt-backlog.mjs \
  --ledger docs/specs/audit/wi-472-reconcile-backlog.json \
  --bundle docs/specs/audit/wi-472-reconcile-backlog-bundle.json \
  --validate

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if node scripts/reconcile-receipt-backlog.mjs --validate --review "$TMP/missing.json" >/dev/null 2>&1; then
  echo "validate-reconcile-backlog-review: FAIL (missing review accepted)" >&2
  exit 1
fi
printf 'review package fixture\n' > "$TMP/package.md"
node --input-type=module - "$TMP" <<'NODE'
import crypto from "node:crypto"; import fs from "node:fs"; import path from "node:path";
const dir=process.argv[2], sha=(v)=>crypto.createHash("sha256").update(v).digest("hex");
const bundle=JSON.parse(fs.readFileSync("docs/specs/audit/wi-472-reconcile-backlog-bundle.json"));
const findingsPath=path.join(dir,"findings.json"), packagePath=path.join(dir,"package.md");
const findings={review_kind:"exec",verdict:"pass",reviewer:{host:"claude",family:"anthropic",model:"claude-opus-4-8",effort:"high"},certifications:bundle.rows.map(r=>({key:`wi472-backlog-${r.sha}`,certified:true,reviewer_family:"anthropic",for_content_sha:r.basis_sha256}))};
fs.writeFileSync(findingsPath,JSON.stringify(findings));
fs.writeFileSync(path.join(dir,"receipt.json"),JSON.stringify({status:"success",classification:"success",review_kind:"exec",request_id:"fixture-review",package_sha256:"b".repeat(64),package_context:{base_package_sha256:sha(fs.readFileSync(packagePath))},effective_tuple:{orchestrator:"codex",host:"claude",family:"anthropic",model:"claude-opus-4-8",effort:"high"},artifacts:{findings:findingsPath},finished_at:"2026-07-21T00:00:00.000Z"}));
NODE
node scripts/reconcile-receipt-backlog.mjs --record-review --review "$TMP/review.json" --review-package "$TMP/package.md" --review-receipt "$TMP/receipt.json" --review-findings "$TMP/findings.json" >/dev/null
node scripts/reconcile-receipt-backlog.mjs --validate --review "$TMP/review.json" >/dev/null
printf 'tamper\n' >> "$TMP/package.md"
if node scripts/reconcile-receipt-backlog.mjs --record-review --review "$TMP/tampered.json" --review-package "$TMP/package.md" --review-receipt "$TMP/receipt.json" --review-findings "$TMP/findings.json" >/dev/null 2>&1; then
  echo "validate-reconcile-backlog-review: FAIL (package substitution accepted)" >&2
  exit 1
fi

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const ledgerPath = "docs/specs/audit/wi-472-reconcile-backlog.json";
const bundlePath = "docs/specs/audit/wi-472-reconcile-backlog-bundle.json";
const ledgerBytes = fs.readFileSync(ledgerPath);
assert.equal(crypto.createHash("sha256").update(ledgerBytes).digest("hex"), "5b71bdf66c7a5076a819c2e7c387d4ce924826e4ad53b547454560667868ffb6");
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
assert.equal(bundle.rows.length, 78);
assert.equal(new Set(bundle.rows.map((row) => row.sha)).size, 78);
assert.ok(bundle.rows.every((row) => row.attestation_contract === "retroactive-attestation-v1"));
assert.ok(bundle.rows.every((row) => row.historical_phase_claim === "none"));
assert.ok(bundle.rows.every((row) => /^[0-9a-f]{64}$/.test(row.basis_sha256)));
assert.equal(JSON.stringify(bundle).includes("proposed_envelope"), false);
assert.equal(JSON.stringify(bundle).includes("AUDIT_EXEMPT"), false);
assert.equal(JSON.stringify(bundle).includes("EMERGENCY_OVERRIDE"), false);

const reviewPath = "docs/specs/reviews/wi-472-backlog-review.json";
if (fs.existsSync(reviewPath)) {
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  assert.equal(review.ledger_sha256, bundle.ledger_sha256);
  assert.equal(review.bundle_sha256, bundle.bundle_sha256);
  assert.equal(review.rows.length, 78);
  assert.equal(review.zero_waivers_verified, true);
  assert.notEqual(review.producer.run_id, review.reviewer.run_id);
  assert.notEqual(review.producer.family, review.reviewer.family);
  assert.ok(review.rows.every((row) => row.verdict === "approve"));
  const basis = new Map(bundle.rows.map((row) => [row.sha, row.basis_sha256]));
  assert.ok(review.rows.every((row) => row.evidence_checked.includes(basis.get(row.sha))));
}
console.log("validate-reconcile-backlog-review: PASS");
NODE
