#!/usr/bin/env bash
# WI-555: centrally installed check-chain-receipts accepts a consumer-local
# retroactive-attestation package under repoRootForCache(), and rejects
# tree / family / basis forgeries. WI-472 framework-package authority is
# covered by validate-retroactive-attestation.sh (unchanged).
# validator_path: test-framework/evals/tier-1/validate-consumer-retroactive-attestation.sh
# failure_class: SCRIPT_DIR-anchored retroactive authority for non-WI-472
# expected_runtime_budget: <15s, no network, no reviewer dispatch
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECKER="$ROOT/scripts/check-chain-receipts.mjs"

# Static contract: non-WI-472 authority must use repoRootForCache().
node --input-type=module - "$CHECKER" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(process.argv[2], "utf8");
assert.match(src, /function resolveRetroactiveAuthority/);
assert.match(src, /root:\s*repoRootForCache\(\)/);
assert.match(src, /WI472_HISTORICAL_RANGE/);
assert.match(src, /certPrefix:\s*"wi472-backlog"/);
assert.doesNotMatch(
  src,
  /receipt\.historical_range\s*!==\s*"985a8d5de2255288daaacda91c739e294b8a67d5\.\.6b026ea9fbcee849e682d7aa47c3eec894512de3"/,
  "consumer path must not hard-require the WI-472 frozen range for all attestations",
);
NODE

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

node --input-type=module - "$ROOT" "$TMP" "$CHECKER" <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [root, tmp, checker] = process.argv.slice(2);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  assert.equal(r.status, 0, `${cmd} ${args.join(" ")}\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
};
const runNode = (args, opts = {}) =>
  spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, ...opts });

const consumer = path.join(tmp, "consumer");
fs.mkdirSync(consumer, { recursive: true, mode: 0o700 });
run("git", ["init", "-b", "main"], { cwd: consumer });
run("git", ["config", "user.name", "fixture"], { cwd: consumer });
run("git", ["config", "user.email", "fixture@example.invalid"], { cwd: consumer });
fs.writeFileSync(path.join(consumer, "seed.txt"), "seed\n", { mode: 0o600 });
run("git", ["add", "seed.txt"], { cwd: consumer });
run("git", ["commit", "-m", "consumer seed"], { cwd: consumer });
fs.writeFileSync(path.join(consumer, "recovery.txt"), "consumer-recovery-row\n", { mode: 0o600 });
run("git", ["add", "recovery.txt"], { cwd: consumer });
run("git", ["commit", "-m", "consumer recovery seed"], { cwd: consumer });
const head = run("git", ["rev-parse", "HEAD"], { cwd: consumer });
const tree = run("git", ["rev-parse", "HEAD^{tree}"], { cwd: consumer });
const parent = run("git", ["rev-parse", `${head}^`], { cwd: consumer });
const commitObject = run("git", ["cat-file", "commit", head], { cwd: consumer });
const patch = run("git", ["diff", "--binary", "--no-ext-diff", parent, head], { cwd: consumer })
  .replace(/^index [0-9a-f]+\.\.[0-9a-f]+.*$/gm, "index <normalized>");

const wi = "WI-555-FIXTURE";
const slug = wi.toLowerCase();
const historicalRange = `${parent}..${head}`;
const disposition = "retroactive_evidence_review";
const evidence = {
  subject: "consumer recovery seed",
  changed_files: ["recovery.txt"],
  evidence_artifacts: ["docs/specs/reviews/pr-fixture-review-gate.json"],
  commit_object_sha256: sha256(commitObject),
  patch_sha256: sha256(patch),
};
const proof = { target_tree: tree };
const basis = {
  sha: head,
  subject: evidence.subject,
  disposition,
  missing_before: ["plan-manifest", "review-plan", "exec-record", "review-exec", "audit-implementation"],
  existing_receipts_before: ["verify-promotion"],
  wi_ids: [wi],
  pr: { number: 1, title: "fixture", merged_at: "2026-08-21T00:00:00Z" },
  evidence,
  proof,
  attestation_contract: "retroactive-attestation-v1",
  historical_phase_claim: "none",
};
const basis_sha256 = sha256(JSON.stringify(basis));
const row = { ...basis, basis_sha256 };

const ledger = {
  schema_version: 1,
  wi,
  generated_at: "2026-08-21T00:00:00.000Z",
  range: historicalRange,
  portable_unresolved_count: 1,
  rows: [{
    sha: head,
    short: head.slice(0, 7),
    subject: evidence.subject,
    tree,
    missing: basis.missing_before,
    existing_receipts: basis.existing_receipts_before,
    disposition,
    wi_ids: [wi],
    pr: basis.pr,
    changed_files: evidence.changed_files,
    evidence_artifacts: evidence.evidence_artifacts,
  }],
};
const ledgerRel = `docs/specs/audit/${slug}-reconcile-backlog.json`;
const bundleRel = `docs/specs/audit/${slug}-reconcile-backlog-bundle.json`;
const reviewRel = `docs/specs/reviews/${slug}-backlog-review.json`;
const artifactsDirRel = `docs/specs/reviews/${slug}-artifacts`;
fs.mkdirSync(path.join(consumer, path.dirname(ledgerRel)), { recursive: true, mode: 0o700 });
fs.mkdirSync(path.join(consumer, path.dirname(reviewRel)), { recursive: true, mode: 0o700 });
fs.mkdirSync(path.join(consumer, artifactsDirRel), { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(consumer, ledgerRel), JSON.stringify(ledger), { mode: 0o600 });
const ledger_sha256 = sha256(fs.readFileSync(path.join(consumer, ledgerRel)));

const producer = { host: "codex", family: "openai", run_id: "019f5555-0000-7000-8000-000000000001" };
const bundleBound = {
  schema_version: 2,
  wi,
  ledger_sha256,
  producer,
  historical_range: historicalRange,
  rows: [row],
};
const bundle = { ...bundleBound, bundle_sha256: sha256(JSON.stringify(bundleBound)) };
fs.writeFileSync(path.join(consumer, bundleRel), JSON.stringify(bundle), { mode: 0o600 });

const certKey = `${slug}-backlog-${head}`;
const findings = {
  schema_version: 1,
  review_kind: "exec",
  rubric_score: 10,
  rubric_failures: [],
  dependencies_needing_read: [],
  reviewer: { host: "claude", family: "anthropic", model: "claude-opus-4-8", effort: "high" },
  verdict: "pass",
  summary: "pass",
  findings: [],
  certifications: [{
    key: certKey,
    certified: true,
    reviewer_family: "anthropic",
    for_content_sha: basis_sha256,
  }],
};
const findingsPath = path.join(artifactsDirRel, "launcher-findings.json");
fs.writeFileSync(path.join(consumer, findingsPath), JSON.stringify(findings), { mode: 0o600 });
const requestId = "019f5555-1111-7111-8111-0000000000aa";
const launcherReceipt = {
  schema_version: 2,
  launcher_version: "2.4.0",
  cli_version: "fixture-cli",
  request_id: requestId,
  review_kind: "exec",
  status: "success",
  classification: "success",
  package_sha256: "b".repeat(64),
  findings_sha256: sha256(fs.readFileSync(path.join(consumer, findingsPath))),
};
const receiptPath = path.join(artifactsDirRel, "launcher-receipt.json");
fs.writeFileSync(path.join(consumer, receiptPath), JSON.stringify(launcherReceipt), { mode: 0o600 });

const review = {
  schema_version: 1,
  wi,
  ledger_sha256,
  bundle_sha256: bundle.bundle_sha256,
  producer,
  reviewer: {
    host: "claude",
    family: "anthropic",
    model: "claude-opus-4-8",
    run_id: requestId,
    request_id: requestId,
    package_sha256: launcherReceipt.package_sha256,
    receipt: receiptPath,
    receipt_sha256: sha256(fs.readFileSync(path.join(consumer, receiptPath))),
    findings: findingsPath,
    findings_sha256: launcherReceipt.findings_sha256,
  },
  zero_waivers_verified: true,
  verdict: "pass",
  reviewed_at: "2026-08-21T00:00:02.000Z",
  rows: [{
    sha: head,
    disposition,
    evidence_checked: [basis_sha256],
    verdict: "approve",
    finding_ids: [],
  }],
};
fs.writeFileSync(path.join(consumer, reviewRel), JSON.stringify(review), { mode: 0o600 });

const attestation = {
  receipt_type: "retroactive-attestation",
  schema_version: 1,
  wi,
  target_sha: head,
  tree_hash: tree,
  historical_range: historicalRange,
  ledger_sha256,
  bundle_sha256: bundle.bundle_sha256,
  basis_sha256,
  basis,
  disposition,
  evidence,
  producer,
  reviewer: {
    host: review.reviewer.host,
    family: review.reviewer.family,
    model: review.reviewer.model,
    run_id: review.reviewer.run_id,
  },
  review: {
    request_id: review.reviewer.request_id,
    package_sha256: review.reviewer.package_sha256,
    receipt_sha256: review.reviewer.receipt_sha256,
    findings_sha256: review.reviewer.findings_sha256,
    row_certification: certKey,
  },
  verdict: "approved",
  zero_waivers: true,
  timestamp: review.reviewed_at,
};

const mirror = path.join(consumer, ".svc", "receipts", head.slice(0, 7));
fs.mkdirSync(mirror, { recursive: true, mode: 0o700 });
const writeAttestation = (body) => {
  fs.writeFileSync(path.join(mirror, "retroactive-attestation.json"), JSON.stringify(body), { mode: 0o600 });
};
writeAttestation(attestation);

const good = runNode([checker, "--sha", head], { cwd: consumer });
assert.equal(good.status, 0, `consumer attestation rejected:\n${good.stdout}\n${good.stderr}`);
assert.match(good.stdout, /"type": "retroactive-attestation"/);

const cases = [
  ["bad-tree", { ...attestation, tree_hash: "0".repeat(40) }],
  ["bad-family", { ...attestation, reviewer: { ...attestation.reviewer, host: "codex", family: "openai" } }],
  ["bad-basis", { ...attestation, basis_sha256: "a".repeat(64) }],
];
for (const [label, body] of cases) {
  writeAttestation(body);
  const bad = runNode([checker, "--sha", head], { cwd: consumer });
  assert.notEqual(bad.status, 0, `${label} was accepted`);
}

console.log("validate-consumer-retroactive-attestation: PASS (consumer package accepted; 3 forgeries rejected)");
NODE
