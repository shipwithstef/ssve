#!/usr/bin/env node
/** Plan, validate, apply, compare, or roll back the frozen WI-472 backlog. */

import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeJsonAtomic } from "./state-io.mjs";
import { isExternalizedHistoryRange } from "./lib/history-epoch.mjs";

const EXPECTED_LEDGER_SHA = "5b71bdf66c7a5076a819c2e7c387d4ce924826e4ad53b547454560667868ffb6";
const EXPECTED_BASE = "6b026ea9fbcee849e682d7aa47c3eec894512de3";
const EXPECTED_CHECKPOINT = "985a8d5de2255288daaacda91c739e294b8a67d5";
const HISTORICAL_RANGE = `${EXPECTED_CHECKPOINT}..${EXPECTED_BASE}`;
const NOTES_REF = "refs/notes/svc-receipts";
const BACKUP_REF = "refs/notes/svc-receipts-wi472-backup";
const APPLY_RECEIPT = ".svc/reconcile-drive/wi472-backlog-apply.json";
const PRODUCER = { host: "codex", family: "openai", run_id: "019f8237-e398-7440-bb55-b2122714368b" };

function flag(name, fallback = null) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; }
function has(name) { return process.argv.includes(name); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function git(args, options = {}) {
  try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 100 * 1024 * 1024, ...options }).trim(); }
  catch (error) {
    if (options.allowFailure) return "";
    throw new Error(`git ${args.join(" ")} failed: ${String(error.stderr || error.message).trim()}`);
  }
}
function noteFor(sha) {
  const raw = git(["notes", `--ref=${NOTES_REF}`, "show", sha], { allowFailure: true });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
function normalizedPatch(sha) {
  const parent = git(["rev-parse", `${sha}^`]);
  return git(["diff", "--binary", "--no-ext-diff", parent, sha]).replace(/^index [0-9a-f]+\.\.[0-9a-f]+.*$/gm, "index <normalized>");
}
function dispositionEvidence(row) {
  const evidence = {
    subject: git(["show", "-s", "--format=%s", row.sha]),
    changed_files: row.changed_files,
    evidence_artifacts: row.evidence_artifacts,
    commit_object_sha256: sha256(git(["cat-file", "commit", row.sha])),
    patch_sha256: sha256(normalizedPatch(row.sha)),
  };
  const proof = { target_tree: git(["rev-parse", `${row.sha}^{tree}`]) };
  if (row.disposition === "copy_tree_equivalent_reviewed_envelope" && row.source_sha) {
    proof.source_sha = row.source_sha;
    proof.source_tree = git(["rev-parse", `${row.source_sha}^{tree}`]);
    proof.source_patch_sha256 = sha256(normalizedPatch(row.source_sha));
    proof.tree_equal = proof.target_tree === proof.source_tree;
    proof.patch_equal = evidence.patch_sha256 === proof.source_patch_sha256;
  }
  if (row.disposition === "promote_valid_main_mirror") {
    proof.prior_note_receipt_types = Object.keys(noteFor(row.sha)).sort();
    proof.mirror_evidence_recorded_by_frozen_ledger = row.main_mirror_valid === true;
  }
  if (row.disposition === "reissue_mechanically_eligible_quick_fix") {
    const result = JSON.parse(execFileSync(process.execPath, ["scripts/quick-fix-eligibility.mjs", "--sha", row.sha], { encoding: "utf8" }));
    proof.quick_fix_eligible = result.eligible === true;
    proof.quick_fix_tree = result.tree_hash;
    if (!proof.quick_fix_eligible || proof.quick_fix_tree !== proof.target_tree) throw new Error(`${row.sha} quick-fix proof drifted`);
  }
  return { evidence, proof };
}
function buildRow(row) {
  const { evidence, proof } = dispositionEvidence(row);
  const basis = {
    sha: row.sha,
    subject: row.subject,
    disposition: row.disposition,
    missing_before: row.missing,
    existing_receipts_before: row.existing_receipts,
    wi_ids: row.wi_ids,
    pr: row.pr,
    evidence,
    proof,
    attestation_contract: "retroactive-attestation-v1",
    historical_phase_claim: "none",
  };
  return { ...basis, basis_sha256: sha256(JSON.stringify(basis)) };
}
function bundleDigest(bundle) { const { bundle_sha256: ignored, ...bound } = bundle; return sha256(JSON.stringify(bound)); }
function validateBundle(bundle, ledgerSha, { allowExternalized = false } = {}) {
  if (bundle.ledger_sha256 !== ledgerSha) throw new Error("bundle ledger hash mismatch");
  if (bundle.historical_range !== HISTORICAL_RANGE) throw new Error("bundle range mismatch");
  if (bundle.rows.length !== 78 || new Set(bundle.rows.map((r) => r.sha)).size !== 78) throw new Error("bundle must contain exactly 78 unique SHAs");
  if (bundle.bundle_sha256 !== bundleDigest(bundle)) throw new Error("bundle hash mismatch");
  const externalized = allowExternalized && isExternalizedHistoryRange(process.cwd(), EXPECTED_CHECKPOINT, EXPECTED_BASE);
  for (const row of bundle.rows) {
    const { basis_sha256, ...basis } = row;
    if (basis_sha256 !== sha256(JSON.stringify(basis))) throw new Error(`${row.sha} basis hash mismatch`);
    if (!externalized && row.proof.target_tree !== git(["rev-parse", `${row.sha}^{tree}`])) throw new Error(`${row.sha} target tree drift`);
    if (row.historical_phase_claim !== "none") throw new Error(`${row.sha} asserts a historical phase`);
  }
  const text = JSON.stringify(bundle);
  if (text.includes("AUDIT_EXEMPT") || text.includes("EMERGENCY_OVERRIDE")) throw new Error("waiver token found in bundle");
}
function validateReview(review, bundle) {
  const allowed = ["schema_version", "wi", "ledger_sha256", "bundle_sha256", "producer", "reviewer", "zero_waivers_verified", "verdict", "reviewed_at", "rows"].sort();
  if (JSON.stringify(Object.keys(review || {}).sort()) !== JSON.stringify(allowed)) throw new Error("review contains missing or additional top-level properties");
  if (review.ledger_sha256 !== bundle.ledger_sha256 || review.bundle_sha256 !== bundle.bundle_sha256) throw new Error("review hash binding mismatch");
  if (review.producer?.run_id === review.reviewer?.run_id || review.producer?.family === review.reviewer?.family) throw new Error("producer/reviewer independence failed");
  if (review.zero_waivers_verified !== true || review.verdict !== "pass") throw new Error("review did not certify pass with zero waivers");
  if (review.rows?.length !== 78 || new Set(review.rows.map((r) => r.sha)).size !== 78) throw new Error("review coverage is not exactly 78 unique SHAs");
  const bySha = new Map(bundle.rows.map((r) => [r.sha, r]));
  for (const row of review.rows) {
    const basis = bySha.get(row.sha);
    if (!basis || row.verdict !== "approve") throw new Error(`${row.sha} is not explicitly approved`);
    if (row.disposition !== basis.disposition || !row.evidence_checked?.includes(basis.basis_sha256)) throw new Error(`${row.sha} approval is not basis-bound`);
  }
  for (const key of ["receipt_sha256", "findings_sha256"]) {
    if (!/^[0-9a-f]{64}$/.test(String(review.reviewer?.[key] || ""))) throw new Error(`reviewer.${key} invalid`);
  }
  if (!/^[0-9a-f]{64}$/.test(String(review.reviewer?.package_sha256 || ""))) throw new Error("reviewer.package_sha256 invalid");
  if (sha256(readFileSync(review.reviewer.receipt)) !== review.reviewer.receipt_sha256) throw new Error("canonical review receipt hash mismatch");
  if (sha256(readFileSync(review.reviewer.findings)) !== review.reviewer.findings_sha256) throw new Error("canonical review findings hash mismatch");
  const receipt = readJson(review.reviewer.receipt), findings = readJson(review.reviewer.findings);
  if (receipt.status !== "success" || receipt.request_id !== review.reviewer.request_id || !String(findings.verdict || "").startsWith("pass")) throw new Error("canonical review artifacts do not prove this pass");
  const certs = new Map((findings.certifications || []).map((cert) => [cert.key, cert]));
  if (certs.size !== 78 || review.rows.some((row) => { const cert = certs.get(`wi472-backlog-${row.sha}`); return !cert?.certified || cert.for_content_sha !== row.evidence_checked[0] || cert.reviewer_family !== review.reviewer.family; })) throw new Error("review rows do not re-bind to canonical certifications");
}
function attestationFor(row, bundle, review) {
  const { basis_sha256: ignored, ...basis } = row;
  return {
    receipt_type: "retroactive-attestation", schema_version: 1, wi: "WI-472",
    target_sha: row.sha, tree_hash: row.proof.target_tree, historical_range: HISTORICAL_RANGE,
    ledger_sha256: bundle.ledger_sha256, bundle_sha256: bundle.bundle_sha256, basis_sha256: row.basis_sha256, basis,
    disposition: row.disposition, evidence: row.evidence, producer: bundle.producer,
    reviewer: { host: review.reviewer.host, family: review.reviewer.family, model: review.reviewer.model, run_id: review.reviewer.run_id },
    review: { request_id: review.reviewer.request_id, package_sha256: review.reviewer.package_sha256, receipt_sha256: review.reviewer.receipt_sha256, findings_sha256: review.reviewer.findings_sha256, row_certification: `wi472-backlog-${row.sha}` },
    verdict: "approved", zero_waivers: true, timestamp: review.reviewed_at,
  };
}
function writeNote(sha, envelope) {
  execFileSync("git", ["notes", `--ref=${NOTES_REF}`, "add", "-f", "-F", "-", sha], { input: JSON.stringify(envelope), stdio: ["pipe", "pipe", "pipe"] });
}
function checkResult(args) {
  const result = spawnSync(process.execPath, ["scripts/check-chain-receipts.mjs", ...args], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
  if (!result.stdout) throw new Error(`receipt checker produced no JSON: ${String(result.stderr || result.error || "unknown")}`);
  return JSON.parse(result.stdout);
}
function checkOne(sha) {
  return checkResult(["--sha", sha]).results[0];
}

const ledgerPath = flag("--ledger", "docs/specs/audit/wi-472-reconcile-backlog.json");
const bundlePath = flag("--bundle", "docs/specs/audit/wi-472-reconcile-backlog-bundle.json");
const reviewPath = flag("--review", "docs/specs/reviews/wi-472-backlog-review.json");
const ledgerBytes = readFileSync(ledgerPath);
const ledgerSha = sha256(ledgerBytes);
if (ledgerSha !== EXPECTED_LEDGER_SHA) throw new Error(`frozen ledger hash drift: ${ledgerSha}`);
const externalizedRange = isExternalizedHistoryRange(process.cwd(), EXPECTED_CHECKPOINT, EXPECTED_BASE);
try { execFileSync("git", ["merge-base", "--is-ancestor", EXPECTED_CHECKPOINT, EXPECTED_BASE], { stdio: "ignore" }); }
catch { if (!externalizedRange) throw new Error("checkpoint is not an ancestor of frozen base"); }
const ledger = JSON.parse(ledgerBytes);

if (has("--record-review")) {
  const bundle = readJson(bundlePath);
  validateBundle(bundle, ledgerSha, { allowExternalized: true });
  const receiptPath = flag("--review-receipt");
  const findingsPath = flag("--review-findings");
  const packagePath = flag("--review-package", ".svc/review-cross-model-package.md");
  const archiveDir = flag("--archive-dir");
  if (!receiptPath || !findingsPath) throw new Error("--record-review requires --review-receipt and --review-findings");
  const receipt = readJson(receiptPath), findings = readJson(findingsPath);
  if (receipt.status !== "success" || receipt.classification !== "success" || receipt.review_kind !== "exec") throw new Error("canonical exec review launcher did not succeed");
  if (receipt.package_context?.base_package_sha256 !== sha256(readFileSync(packagePath))) throw new Error("launcher receipt is not bound to the supplied review package");
  if (receipt.artifacts?.findings !== join(process.cwd(), findingsPath) && receipt.artifacts?.findings !== findingsPath) throw new Error("launcher receipt is not bound to the supplied findings file");
  if (!String(findings.verdict || "").startsWith("pass")) throw new Error("review verdict is not pass");
  const tuple = receipt.effective_tuple || receipt.requested_tuple;
  if (findings.reviewer?.host !== tuple.host || findings.reviewer?.family !== tuple.family || findings.reviewer?.model !== tuple.model) throw new Error("findings reviewer tuple does not match launcher receipt");
  const certs = new Map((findings.certifications || []).map((cert) => [cert.key, cert]));
  const rows = bundle.rows.map((row) => {
    const key = `wi472-backlog-${row.sha}`;
    const cert = certs.get(key);
    if (!cert || cert.certified !== true || cert.reviewer_family !== tuple.family || cert.for_content_sha !== row.basis_sha256) throw new Error(`${row.sha} lacks an exact positive certification`);
    return { sha: row.sha, disposition: row.disposition, evidence_checked: [row.basis_sha256], verdict: "approve", finding_ids: [] };
  });
  if (certs.size !== 78) throw new Error(`expected 78 certifications, got ${certs.size}`);
  let durableReceiptPath = receiptPath, durableFindingsPath = findingsPath;
  if (archiveDir) {
    mkdirSync(archiveDir, { recursive: true });
    durableReceiptPath = join(archiveDir, "launcher-receipt.json"); durableFindingsPath = join(archiveDir, "launcher-findings.json");
    copyFileSync(receiptPath, durableReceiptPath); copyFileSync(findingsPath, durableFindingsPath);
  }
  const review = {
    schema_version: 1, wi: "WI-472", ledger_sha256: bundle.ledger_sha256, bundle_sha256: bundle.bundle_sha256,
    producer: bundle.producer,
    reviewer: { host: tuple.host, family: tuple.family, model: tuple.model, run_id: receipt.request_id, request_id: receipt.request_id, package_sha256: receipt.package_sha256, receipt: durableReceiptPath, receipt_sha256: sha256(readFileSync(durableReceiptPath)), findings: durableFindingsPath, findings_sha256: sha256(readFileSync(durableFindingsPath)) },
    zero_waivers_verified: true, verdict: "pass", reviewed_at: receipt.finished_at, rows,
  };
  validateReview(review, bundle);
  writeJsonAtomic(reviewPath, review);
  console.log(JSON.stringify({ ok: true, mode: "record-review", rows: rows.length, review: reviewPath }, null, 2));
} else if (has("--plan")) {
  const bundle = { schema_version: 2, wi: "WI-472", ledger_sha256: ledgerSha, producer: PRODUCER, historical_range: HISTORICAL_RANGE, rows: ledger.rows.map(buildRow) };
  bundle.bundle_sha256 = bundleDigest(bundle);
  writeJsonAtomic(bundlePath, bundle);
  console.log(JSON.stringify({ ok: true, mode: "plan", rows: bundle.rows.length, bundle_sha256: bundle.bundle_sha256 }, null, 2));
} else if (has("--validate") || has("--dry-run")) {
  const bundle = readJson(bundlePath); validateBundle(bundle, ledgerSha, { allowExternalized: true });
  if (!existsSync(reviewPath) && !has("--bundle-only")) throw new Error("independent review is required; use --bundle-only only before G6");
  if (existsSync(reviewPath)) validateReview(readJson(reviewPath), bundle);
  console.log(JSON.stringify({ ok: true, mode: "validate", rows: bundle.rows.length, review_present: existsSync(reviewPath), bundle_only: has("--bundle-only") }, null, 2));
} else if (has("--compare-range")) {
  const batch = checkResult(["--range", HISTORICAL_RANGE]);
  const perSha = ledger.rows.map((row) => checkOne(row.sha));
  const normalize = (rows) => rows.filter((r) => !r.ok).map((r) => [r.sha, r.type, r.missing]).sort((a, b) => a[0].localeCompare(b[0]));
  if (JSON.stringify(normalize(batch.results)) !== JSON.stringify(normalize(perSha))) throw new Error("range/per-SHA result sets differ");
  console.log(JSON.stringify({ ok: true, mode: "compare-range", rows: perSha.length, unaccounted: normalize(perSha).length }, null, 2));
} else if (has("--apply")) {
  const bundle = readJson(bundlePath), review = readJson(reviewPath);
  validateBundle(bundle, ledgerSha); validateReview(review, bundle);
  const notesOid = git(["rev-parse", NOTES_REF]);
  const existingBackup = git(["rev-parse", BACKUP_REF], { allowFailure: true });
  const prior = existsSync(APPLY_RECEIPT) ? readJson(APPLY_RECEIPT) : null;
  if (existingBackup && (!prior || prior.original_notes_oid !== existingBackup)) throw new Error("write-once backup exists without matching apply receipt; rollback required");
  if (!existingBackup) git(["update-ref", BACKUP_REF, notesOid]);
  const original = existingBackup || notesOid;
  let lastAppliedOid = notesOid;
  try {
    for (const row of bundle.rows) {
      writeNote(row.sha, { ...noteFor(row.sha), "retroactive-attestation": attestationFor(row, bundle, review) });
      lastAppliedOid = git(["rev-parse", NOTES_REF]);
    }
    const failed = bundle.rows.map((row) => checkOne(row.sha)).filter((r) => !r.ok);
    if (failed.length) throw new Error(`post-apply receipt check failed for ${failed.length} rows`);
  } catch (error) {
    try { git(["update-ref", NOTES_REF, original, lastAppliedOid]); }
    catch { throw new Error(`${error.message}; rollback refused because notes ref changed concurrently`); }
    throw error;
  }
  mkdirSync(dirname(APPLY_RECEIPT), { recursive: true });
  writeJsonAtomic(APPLY_RECEIPT, { schema_version: 2, wi: "WI-472", original_notes_oid: original, applied_notes_oid: git(["rev-parse", NOTES_REF]), bundle_sha256: bundle.bundle_sha256, review_sha256: sha256(readFileSync(reviewPath)), applied_at: new Date().toISOString(), rows: 78, zero_waivers: true });
  console.log(JSON.stringify({ ok: true, mode: "apply", rows: bundle.rows.length, backup_ref: BACKUP_REF }, null, 2));
} else if (has("--rollback")) {
  const backup = git(["rev-parse", BACKUP_REF]);
  const current = git(["rev-parse", NOTES_REF]);
  const prior = existsSync(APPLY_RECEIPT) ? readJson(APPLY_RECEIPT) : null;
  if (current !== backup) {
    if (!prior?.applied_notes_oid || current !== prior.applied_notes_oid) throw new Error("rollback refused because notes ref changed after WI-472 apply");
    git(["update-ref", NOTES_REF, backup, current]);
  }
  console.log(JSON.stringify({ ok: true, mode: "rollback", restored_oid: backup }, null, 2));
} else {
  console.error("Usage: reconcile-receipt-backlog.mjs --record-review|--plan|--validate|--compare-range|--apply|--rollback");
  process.exit(2);
}
