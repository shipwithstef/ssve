#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createExternalReviewFixture } from "./fixtures/external-review-fixture.mjs";
import { boundedExitCycleId, evaluateReviewRoundCap, validateBoundedExitAdjudication } from "../../../scripts/lib/bounded-exit.mjs";
import { hasFrameworkLearningCredit } from "../../../scripts/learning-lifecycle.mjs";
import { candidateTreeIdentity, issueExternalReviewProvenance, listExternalReviewCycleProvenance } from "../../../scripts/lib/external-review-provenance.mjs";
import { putObject, putRelocation, getObject } from "../../../scripts/lib/review-evidence-store.mjs";
import { verifyReviewerEvidence } from "../../../scripts/lib/reviewer-evidence.mjs";

const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-bounded-exit-eval-"));
process.on("exit", () => fs.rmSync(temp, { recursive: true, force: true }));
execFileSync("git", ["init", "-q", temp]);
execFileSync("git", ["-C", temp, "config", "user.name", "fixture"]);
execFileSync("git", ["-C", temp, "config", "user.email", "fixture@example.invalid"]);
fs.writeFileSync(path.join(temp, "candidate.txt"), "immutable candidate\n");
const learningVerdictPath = "docs/specs/rules-evaluation/cert-fixture/verdict.json";
fs.mkdirSync(path.dirname(path.join(temp, learningVerdictPath)), { recursive: true });
fs.writeFileSync(path.join(temp, learningVerdictPath), JSON.stringify({ rule_path: "fixture.md", scope: "global", verdict: "adopt-as-is", tier2_ran: true, tier2_verdict: "confirmed" }));
execFileSync("git", ["-C", temp, "add", "candidate.txt", learningVerdictPath]);
execFileSync("git", ["-C", temp, "commit", "-qm", "candidate"]);
const candidateSha = execFileSync("git", ["-C", temp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const identity = candidateTreeIdentity(temp, { candidateSha });

const finding = (id, severity) => ({ id, severity, claim: `${id} claim`, analysis: `${id} analysis`, evidence: [`${id} reviewer evidence`], proposed_fix: `${id} fix` });
const terminalFindings = [finding("H-1", "high"), finding("H-2", "high"), finding("H-3", "high"), finding("M-1", "medium")];

function artifact(file) { return { path: path.relative(temp, file), sha256: sha(fs.readFileSync(file)) }; }
function fixtureSet(reviewKind, count = 3, lastFindings = terminalFindings, { wi = "WI-HOURSHUB-POSTHOG", targetDigests = [], rubricFailures = [], launcherVersion } = {}) {
  return Array.from({ length: count }, (_, index) => createExternalReviewFixture({
    frameworkRoot,
    launcherVersion,
    repo: temp,
    reviewKind,
    candidateSha,
    candidateDigestOverride: targetDigests[index] || null,
    wi,
    roundLabel: `${reviewKind}-round-${index + 1}-${count}`,
    verdict: "fail",
    findings: index === count - 1 ? lastFindings : [finding(`R${index + 1}-H`, "high")],
    rubricFailures: index === count - 1 ? rubricFailures : [],
  }));
}

function boundedBody(reviewKind, rounds, wi = "WI-HOURSHUB-POSTHOG") {
  const directory = path.join(temp, ".svc", "bounded-exit", reviewKind);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const logPath = path.join(directory, "review-log.yaml");
  fs.writeFileSync(logPath, `rounds_run: 3\nunresolved_critical: 0\nremaining_high: 3\nself_review_passes: 1\nround_1:\n  status: complete\nround_2:\n  status: complete\nround_3:\n  status: complete\nbounded_exit:\n  disposition: accept-with-justification\n  residual_highs:\n    - H-1\n    - H-2\n    - H-3\n`, { mode: 0o600 });
  const resultPath = path.join(directory, "verification-result.md");
  fs.writeFileSync(resultPath, "candidate-bound verification evidence\n", { mode: 0o600 });
  const evidencePath = path.join(directory, "disposition-evidence.json");
  fs.writeFileSync(evidencePath, JSON.stringify({ schema_version: 1, wi, candidate_digest: identity.candidate_digest, finding_ids: terminalFindings.map((row) => row.id), rubric_ids: [2, 6, 7, 10], verification_method: "focused-regression", result: "pass", result_artifact: artifact(resultPath) }), { mode: 0o600 });
  const cap = evaluateReviewRoundCap(fs.readFileSync(logPath));
  assert.equal(cap.exit_code, 0, cap.stderr);
  const launcherReceipts = rounds.map((round) => artifact(round.receiptPath));
  const outputs = rounds.map((round) => artifact(round.output));
  const commands = rounds.flatMap((round) => round.reviewerEvidence.commands);
  const roundIdentities = rounds.map((round, index) => ({
    round: index + 1,
    review_target_digest: round.candidateDigest,
    launcher_receipt_sha256: launcherReceipts[index].sha256,
    findings_sha256: outputs[index].sha256,
  }));
  const census = terminalFindings.map((row) => ({
    id: row.id,
    severity: row.severity,
    disposition: "accept-with-justification",
    justification: `Disposition for ${row.id} is tied to immutable candidate evidence.`,
    ...(row.severity === "high" ? { evidence: [artifact(evidencePath)] } : {}),
  }));
  return {
    receipt_type: reviewKind === "plan" ? "review-plan" : "review-exec",
    schema_version: 3,
    wi,
    candidate_sha: candidateSha,
    tree_hash: identity.tree_hash,
    candidate_digest: identity.candidate_digest,
    ...(reviewKind === "plan" ? { reviewed_plan_digest: rounds.at(-1).candidateDigest } : {}),
    ...(reviewKind === "exec" ? { diff_hash: "fixture-diff" } : {}),
    self_review: { orchestrator: "codex", findings_count: 0, notes: "self review" },
    adversarial_review: { primary_reviewer_host: "agy", primary_used: true, fallback_host: "agy", fallback_used: false, findings: terminalFindings, iteration_count: rounds.length },
    verdict: "pass-with-acks",
    timestamp: "2026-09-02T00:00:00.000Z",
    reviewer_evidence: {
      independent: true,
      submitter_only: false,
      launcher_receipts: launcherReceipts,
      commands,
      output_artifacts: outputs,
      deletion_bearing: false,
      parse_collect_evidence: [],
      bounded_exit: {
        schema_version: 1,
        review_kind: reviewKind,
        wi,
        candidate_sha: candidateSha,
        tree_hash: identity.tree_hash,
        candidate_digest: identity.candidate_digest,
        cycle_id: boundedExitCycleId({ reviewKind, wi, candidateDigest: rounds[0].candidateDigest, preExecutionBase: candidateSha }),
        rounds_run: rounds.length,
        hard_cap: 3,
        round_identities: roundIdentities,
        terminal_launcher_receipt_sha256: launcherReceipts.at(-1).sha256,
        terminal_findings_sha256: outputs.at(-1).sha256,
        review_log: artifact(logPath),
        check_review_round_cap: { exit_code: cap.exit_code, result_digest: cap.result_digest },
        findings_census: census,
        rubric_failure_census: [],
      },
    },
  };
}

// Fixed certification closure retains the old plan digest and the corrected
// candidate digest as distinct authorities. Use signed producer fixtures.
const certWi = "WI-PLAN-CERTIFICATION";
const certDigest = sha(Buffer.from("reviewed-plan-before-correction"));
const certRows = [
  { key: "high-proof", certified: false, reviewer_family: "google", for_content_sha: certDigest },
  { key: "medium-proof", certified: false, reviewer_family: "google", for_content_sha: certDigest },
];
const certRounds = Array.from({ length: 3 }, (_, i) => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: certDigest, wi: certWi, roundLabel: `cert-${i}`, verdict: i === 2 ? "pass-with-findings" : "fail", findings: terminalFindings, certifications: i === 2 ? certRows : [] }));
const certBody = boundedBody("plan", certRounds, certWi);
const certDir = path.join(temp, ".svc/bounded-exit/plan");
const certLog = path.join(certDir, "review-log.yaml");
fs.writeFileSync(certLog, fs.readFileSync(certLog, "utf8").replace("accept-with-justification", "fixed"), { mode: 0o600 });
const certEvidence = path.join(certDir, "disposition-evidence.json");
const certEvidenceBody = JSON.parse(fs.readFileSync(certEvidence));
certEvidenceBody.certification_keys = certRows.map(row => row.key);
fs.writeFileSync(certEvidence, JSON.stringify(certEvidenceBody), { mode: 0o600 });
const certExit = certBody.reviewer_evidence.bounded_exit;
certExit.review_log = artifact(certLog);
const certCap = evaluateReviewRoundCap(fs.readFileSync(certLog));
assert.equal(certCap.exit_code, 0, "fixed High log disposition must be recognized");
certExit.check_review_round_cap = { exit_code: certCap.exit_code, result_digest: certCap.result_digest };
certExit.findings_census.forEach(row => { row.disposition = "fixed"; row.evidence = [artifact(certEvidence)]; });
certExit.certification_failure_census = certRows.map((row, i) => ({ key: row.key, reviewer_family: row.reviewer_family, for_content_sha: row.for_content_sha, finding_ids: [i ? "M-1" : "H-1"], disposition: "fixed", justification: "Candidate-bound correction proves the named certification and finding.", evidence: [artifact(certEvidence)] }));
const certRawHashes = certRounds.map(row => [artifact(row.receiptPath).sha256, artifact(row.output).sha256]);
const checkCert = body => verifyReviewerEvidence({ root: temp, reviewKind: "plan", body });
assert.deepEqual(checkCert(certBody), [], "fixed High and Medium certifications close with exact proof");
const certDirectRounds = certRounds.map(row => ({ receipt: JSON.parse(fs.readFileSync(row.receiptPath)), receiptPath: row.receiptPath, receiptSha: artifact(row.receiptPath).sha256, findings: JSON.parse(fs.readFileSync(row.output)), findingsSha: artifact(row.output).sha256 }));
assert.deepEqual(validateBoundedExitAdjudication({ root: temp, reviewKind: "plan", body: certBody, identity, rounds: certDirectRounds }), []);
for (const mutate of [
  exit => { delete exit.certification_failure_census; },
  exit => { exit.certification_failure_census.pop(); },
  exit => { exit.certification_failure_census.push(structuredClone(exit.certification_failure_census[0])); },
  exit => { exit.certification_failure_census[0].key = "unknown"; },
  exit => { exit.certification_failure_census[0].reviewer_family = "xai"; },
  exit => { exit.certification_failure_census[0].for_content_sha = identity.candidate_digest; },
  exit => { exit.certification_failure_census[0].for_content_sha = artifact(certRounds.at(-1).output).sha256; },
  exit => { exit.certification_failure_census[0].finding_ids = ["unknown"]; },
  exit => { exit.certification_failure_census[0].finding_ids = ["H-1", "H-1"]; },
  exit => { exit.certification_failure_census[0].disposition = "accept-with-justification"; },
  exit => { exit.findings_census[3].disposition = "reject-with-justification"; },
  exit => { exit.certification_failure_census[0].evidence = []; },
]) {
  const body = structuredClone(certBody); mutate(body.reviewer_evidence.bounded_exit);
  assert.notEqual(checkCert(body).length, 0, "invalid certification census must reject");
}
for (const mutate of [
  doc => { delete doc.certification_keys; },
  doc => { doc.certification_keys = ["another-key"]; },
  doc => { doc.finding_ids = ["M-1"]; },
  doc => { doc.candidate_digest = certDigest; },
  doc => { doc.result_artifact.sha256 = "0".repeat(64); },
]) {
  const doc = structuredClone(certEvidenceBody); mutate(doc);
  const file = path.join(certDir, "invalid-cert-evidence.json"); fs.writeFileSync(file, JSON.stringify(doc), { mode: 0o600 });
  const body = structuredClone(certBody); body.reviewer_evidence.bounded_exit.certification_failure_census[0].evidence = [artifact(file)];
  assert.notEqual(checkCert(body).length, 0, "missing/stale/corrupt certification proof rejects");
}
for (const mutate of [
  rows => { rows.at(-1).findings.certifications[0].for_content_sha = null; },
  rows => { rows.at(-1).findings.certifications[0].reviewer_family = null; },
  rows => { rows.at(-1).findings.certifications.push(rows.at(-1).findings.certifications[0]); },
  rows => { rows.at(-1).findings.findings[0].severity = "critical"; },
  rows => { rows.pop(); },
]) {
  const rows = structuredClone(certDirectRounds); mutate(rows);
  assert.notEqual(validateBoundedExitAdjudication({ root: temp, reviewKind: "plan", body: certBody, identity, rounds: rows }).length, 0);
}
const certConfig = { schema_version: 1, review_kind: "plan", wi: certWi, candidate_sha: candidateSha, launcher_receipts: certRounds.map(row => row.receiptPath), review_log: certLog, dispositions: Object.fromEntries(terminalFindings.map(row => [row.id, { disposition: "fixed", justification: "Correction verified.", evidence: [certEvidence] }])), certification_dispositions: certExit.certification_failure_census.map(row => ({ key: row.key, finding_ids: row.finding_ids, disposition: "fixed", justification: row.justification, evidence: [certEvidence] })) };
const certConfigPath = path.join(certDir, "cert-config.json"), certOut = path.join(certDir, "cert-built.json");
function buildCert(config) {
  fs.writeFileSync(certConfigPath, JSON.stringify(config), { mode: 0o600 });
  return spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/build-bounded-exit-receipt.mjs"), "--config", certConfigPath, "--out", certOut], { cwd: temp, encoding: "utf8" });
}
const certBuilt = buildCert(certConfig); assert.equal(certBuilt.status, 0, certBuilt.stderr);
const certBuiltBody = JSON.parse(fs.readFileSync(certOut)); assert.deepEqual(checkCert(certBuiltBody), []);
for (const mutate of [
  config => { delete config.certification_dispositions; },
  config => { config.certification_dispositions.pop(); },
  config => { config.certification_dispositions[1].key = config.certification_dispositions[0].key; },
  config => { config.certification_dispositions[0].key = "unknown"; },
  config => { config.certification_dispositions[0].reviewer_family = "google"; },
  config => { config.certification_dispositions[0].for_content_sha = certDigest; },
  config => { config.review_kind = "exec"; config.diff_hash = "fixture"; },
]) {
  const config = structuredClone(certConfig); mutate(config); assert.notEqual(buildCert(config).status, 0);
}
const certEmitted = spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/emit-receipt.mjs"), "--type", "review-plan", "--wi", certWi, "--sha", candidateSha, "--no-note"], { cwd: temp, input: JSON.stringify(certBuiltBody), encoding: "utf8" });
assert.equal(certEmitted.status, 0, certEmitted.stderr);
// The plan scaffold is historical schema1; the reviewed receipt under test is
// the actual schema3 emitter output. Exercise the checker, not just its library.
const certMirror = path.join(temp, ".svc/receipts", candidateSha.slice(0, 7));
fs.writeFileSync(path.join(certMirror, "plan-manifest.json"), JSON.stringify({ receipt_type: "plan-manifest", schema_version: 1, wi: certWi, mode: "inline", scope: {}, dependencies: [], decision_trace: [], task_graph: [], validation_plan: [], risk_rollback: {}, timestamp: "2026-09-02T00:00:00.000Z", execution_command_sequence: [] }));
const publishCertFixture = review => {
  const envelope = {
    [`slot::plan-manifest::${certWi}::${candidateSha}`]: JSON.parse(fs.readFileSync(path.join(certMirror, "plan-manifest.json"))),
    [`slot::review-plan::${certWi}::${candidateSha}`]: review,
  };
  execFileSync("git", ["-C", temp, "notes", "--ref=svc-receipts", "add", "-f", "-m", JSON.stringify(envelope), candidateSha], { stdio: "pipe" });
};
publishCertFixture(JSON.parse(fs.readFileSync(path.join(certMirror, "review-plan.json"))));
const certChain = () => spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/check-chain-receipts.mjs"), "--sha", candidateSha, "--wi", certWi, "--consumer", "stop", "--expected-stage", "review-plan"], { cwd: temp, encoding: "utf8" });
const certChainResult = certChain(); assert.equal(certChainResult.status, 0, certChainResult.stdout + certChainResult.stderr);
const certMirrorPath = path.join(certMirror, "review-plan.json");
const emittedBody = JSON.parse(fs.readFileSync(certMirrorPath));
const tamperedBody = structuredClone(emittedBody); tamperedBody.reviewer_evidence.bounded_exit.certification_failure_census[0].key = "tampered";
publishCertFixture(tamperedBody); assert.notEqual(certChain().status, 0, "checker must reject altered certification binding");
publishCertFixture(emittedBody);
assert.deepEqual(certRounds.map(row => [artifact(row.receiptPath).sha256, artifact(row.output).sha256]), certRawHashes, "adjudication never rewrites signed reviewer artifacts");

const noCertRows = structuredClone(certDirectRounds); noCertRows.at(-1).findings.certifications = [];
assert.match(validateBoundedExitAdjudication({ root: temp, reviewKind: "plan", body: certBody, identity, rounds: noCertRows }).join("\n"), /census supplied without failed certifications/);

const earlyWi = "WI-EARLY-CERTIFICATION";
const earlyRounds = Array.from({ length: 2 }, (_, i) => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: certDigest, wi: earlyWi, roundLabel: `early-cert-${i}`, verdict: "fail", findings: terminalFindings, certifications: i === 1 ? certRows : [] }));
const earlyBody = boundedBody("plan", earlyRounds, earlyWi);
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: earlyBody }).join("\n"), /failed reviewer certifications outside plan round three/, "signed early-round failure cannot use the census");


const execCertWi = "WI-EXEC-CERTIFICATION";
const execCertRows = [{ key: "exec-proof", certified: false, reviewer_family: "google", for_content_sha: identity.candidate_digest }];
const execCertRounds = Array.from({ length: 3 }, (_, i) => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "exec", candidateSha, wi: execCertWi, roundLabel: `exec-cert-${i}`, verdict: "fail", findings: terminalFindings, certifications: i === 2 ? execCertRows : [] }));
const execCertBody = boundedBody("exec", execCertRounds, execCertWi);
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: execCertBody }).join("\n"), /failed reviewer certifications outside plan round three/);
const execCertConfig = { ...certConfig, review_kind: "exec", diff_hash: sha(Buffer.from("exec-cert-diff")), wi: execCertWi, launcher_receipts: execCertRounds.map(row => row.receiptPath) };
assert.notEqual(buildCert(execCertConfig).status, 0, "builder must reject failed exec certification adjudication");
const learningKey = "cert-learning";
const learningOutcomePath = path.join(temp, ".svc/learning-outcomes/cert.json");
const learningAdapterPath = path.join(temp, ".svc/evaluations/cert.json");
fs.mkdirSync(path.dirname(learningOutcomePath), { recursive: true, mode: 0o700 });
fs.mkdirSync(path.dirname(learningAdapterPath), { recursive: true, mode: 0o700 });
fs.writeFileSync(learningOutcomePath, JSON.stringify({ candidate_sha: candidateSha, evidence: [artifact(path.join(temp, "candidate.txt"))] }), { mode: 0o600 });
const learningPass = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "exec", candidateSha, wi: "WI-CERT-LEARNING-PASS", roundLabel: "learning-pass" });
const learningBase = { schema_version: 2, skill: "evaluate-rule", learning_key: learningKey, candidate_sha: candidateSha, outcome_sha256: artifact(learningOutcomePath).sha256, verdict_path: learningVerdictPath, verdict_sha256: artifact(path.join(temp, learningVerdictPath)).sha256, candidate_digest: identity.candidate_digest, self_review: { orchestrator: "codex", findings_count: 0, notes: "fixture" }, reviewer_evidence: learningPass.reviewerEvidence };
function learningCredit(adapter) {
  fs.writeFileSync(learningAdapterPath, JSON.stringify(adapter), { mode: 0o600 });
  const outcomeSha = artifact(learningOutcomePath).sha256;
  fs.writeFileSync(path.join(temp, ".svc/learning-lifecycle.jsonl"), [
    { key: learningKey, event: "consumption", decision: "used", outcome_receipt: path.relative(temp, learningOutcomePath), outcome_sha256: outcomeSha },
    { key: learningKey, event: "elevated", source_outcome_sha256: outcomeSha, evaluation: path.relative(temp, learningAdapterPath), evaluation_sha256: artifact(learningAdapterPath).sha256, candidate_sha: candidateSha },
  ].map(JSON.stringify).join("\n") + "\n");
  return hasFrameworkLearningCredit(temp, learningKey);
}
assert.equal(learningCredit(learningBase), true, "learning fixture reaches independent review with valid prerequisites");
assert.equal(learningCredit({ ...execCertBody, ...learningBase, reviewer_evidence: execCertBody.reviewer_evidence }), false, "learning consumer cannot elevate failed exec certifications");

for (const reviewKind of ["plan", "exec"]) {
  for (const verdict of ["pass", "pass-with-findings"]) {
    const wi = `WI-INCONSISTENT-${reviewKind.toUpperCase()}-${verdict.toUpperCase()}`;
    const fixture = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind, candidateSha, wi, roundLabel: wi, verdict, certifications: [{ key: "must-not-pass", certified: false, reviewer_family: "google", for_content_sha: identity.candidate_digest }] });
    const body = { wi, candidate_digest: identity.candidate_digest, reviewed_plan_digest: identity.candidate_digest, self_review: { orchestrator: "codex", findings_count: 0, notes: "fixture" }, reviewer_evidence: fixture.reviewerEvidence };
    assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body }).join("\n"), /passing launcher verdict contains failed reviewer certifications/, `${reviewKind} ${verdict} cannot contradict a failed certification`);
  }
}
// Non-passing cached rounds remain unsupported, even with a full bounded census.
const cachedWi = "WI-CACHED-BOUNDED";
const cachedRounds = fixtureSet("exec", 2, terminalFindings, { wi: cachedWi });
const cachedSource = cachedRounds[1];
const cachedSourceReceipt = JSON.parse(fs.readFileSync(cachedSource.receiptPath));
const cachedReceiptPath = path.join(path.dirname(cachedSource.receiptPath), "cached-terminal.json");
const cachedReceipt = { ...cachedSourceReceipt, request_id: crypto.randomUUID(), classification: "cache_hit", attempts: [],
  protocol: { ...cachedSourceReceipt.protocol, process_invocations: 0, terminal_reason: "cache_hit" },
  route: { kind: "cache_hit", switching_enabled: false, cli_fallback_configured: false, evidence: "cache_receipt_replay" },
  model_attestation: { ...cachedSourceReceipt.model_attestation, level: "cache_replay", evidence: "validated_content_addressed_receipt" },
  cache: { ...cachedSourceReceipt.cache, disposition: "hit" },
  artifacts: { ...cachedSourceReceipt.artifacts, receipt: cachedReceiptPath }, reviewer_run: { commands: [], output_artifacts: [] } };
fs.writeFileSync(cachedReceiptPath, JSON.stringify(cachedReceipt), { mode: 0o600 });
issueExternalReviewProvenance({ receiptPath: cachedReceiptPath, packagePath: cachedSourceReceipt.artifacts.package, findingsPath: cachedSource.output });
cachedRounds.push({ ...cachedSource, receiptPath: cachedReceiptPath });
const cachedBody = boundedBody("exec", cachedRounds, cachedWi);
cachedBody.reviewer_evidence.cache_sources = [{ replay_sha256: artifact(cachedReceiptPath).sha256, source: artifact(cachedSource.receiptPath) }];
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: cachedBody }).join("\n"), /cached non-passing reviews are unsupported/, "bounded disposition must not imply support for cached failing reviews");
const cachedWithoutDisposition = structuredClone(cachedBody); delete cachedWithoutDisposition.reviewer_evidence.bounded_exit;
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: cachedWithoutDisposition }).join("\n"), /bounded-exit adjudication is required/);

// A cached passing verdict still rejects failed certifications at the selected replay.
const cachedCertWi = "WI-CACHED-PASS-CERTIFICATION";
const cachedCertSource = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "exec", candidateSha, wi: cachedCertWi, roundLabel: cachedCertWi, verdict: "pass", certifications: [{ key: "must-not-pass", certified: false, reviewer_family: "google", for_content_sha: identity.candidate_digest }] });
const cachedCertSourceReceipt = JSON.parse(fs.readFileSync(cachedCertSource.receiptPath));
const cachedCertPath = path.join(path.dirname(cachedCertSource.receiptPath), "cached-pass.json");
const cachedCertReceipt = { ...cachedCertSourceReceipt, request_id: crypto.randomUUID(), classification: "cache_hit", attempts: [],
  protocol: { ...cachedCertSourceReceipt.protocol, process_invocations: 0, terminal_reason: "cache_hit" },
  route: cachedReceipt.route, model_attestation: cachedReceipt.model_attestation,
  cache: { ...cachedCertSourceReceipt.cache, disposition: "hit" },
  artifacts: { ...cachedCertSourceReceipt.artifacts, receipt: cachedCertPath }, reviewer_run: { commands: [], output_artifacts: [] } };
fs.writeFileSync(cachedCertPath, JSON.stringify(cachedCertReceipt), { mode: 0o600 });
issueExternalReviewProvenance({ receiptPath: cachedCertPath, packagePath: cachedCertSourceReceipt.artifacts.package, findingsPath: cachedCertSource.output });
const cachedCertBody = { wi: cachedCertWi, candidate_digest: identity.candidate_digest,
  self_review: { orchestrator: "codex", findings_count: 0, notes: "fixture" },
  reviewer_evidence: { ...cachedCertSource.reviewerEvidence, launcher_receipts: [artifact(cachedCertPath)],
    cache_sources: [{ replay_sha256: artifact(cachedCertPath).sha256, source: artifact(cachedCertSource.receiptPath) }] } };
const cachedCertErrors = verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: cachedCertBody }).join("\n");
assert.match(cachedCertErrors, /passing launcher verdict contains failed reviewer certifications/);
assert.doesNotMatch(cachedCertErrors, /cache source invalid/, "historical source authentication must not adjudicate the selected replay's certification");

const multiRevisionWi = "WI-HOURSHUB-MULTI-REVISION";
const multiRevisionDigests = ["revision-1", "revision-2", "revision-3"].map((value) => sha(Buffer.from(value)));
const multiRevisionRubricFailures = [2, 6, 7, 10];
const multiRevisionRounds = fixtureSet("plan", 3, terminalFindings, { wi: multiRevisionWi, targetDigests: multiRevisionDigests, rubricFailures: multiRevisionRubricFailures });
const multiRevisionBody = boundedBody("plan", multiRevisionRounds, multiRevisionWi);
const rubricEvidencePath = path.join(temp, ".svc", "bounded-exit", "plan", "disposition-evidence.json");
multiRevisionBody.reviewer_evidence.bounded_exit.rubric_failure_census = multiRevisionRubricFailures.map((rubricId) => ({ rubric_id: rubricId, finding_ids: [rubricId === 2 ? "M-1" : "H-1"], disposition: "accept-with-justification", justification: `Rubric ${rubricId} is bound to a terminal finding disposition.`, evidence: [artifact(rubricEvidencePath)] }));
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: multiRevisionBody }), [], "one bounded review cycle must admit successive reviewed revisions while retaining final commit binding");
const builderConfigPath = path.join(temp, ".svc", "bounded-exit", "builder-config.json");
const builderOutPath = path.join(temp, ".svc", "bounded-exit", "builder-body.json");
const builderEvidencePath = path.join(temp, ".svc", "bounded-exit", "plan", "disposition-evidence.json");
fs.writeFileSync(builderConfigPath, JSON.stringify({ schema_version: 1, review_kind: "plan", wi: multiRevisionWi, candidate_sha: candidateSha, launcher_receipts: multiRevisionRounds.map((round) => round.receiptPath), review_log: path.relative(temp, path.join(temp, ".svc", "bounded-exit", "plan", "review-log.yaml")), dispositions: Object.fromEntries(terminalFindings.map((row) => [row.id, { disposition: "accept-with-justification", justification: `Disposition for ${row.id} is tied to immutable candidate evidence.`, ...(row.severity === "high" ? { evidence: [path.relative(temp, builderEvidencePath)] } : {}) }])), rubric_dispositions: Object.fromEntries(multiRevisionRubricFailures.map((rubricId) => [String(rubricId), { finding_ids: [rubricId === 2 ? "M-1" : "H-1"], disposition: "accept-with-justification", justification: `Rubric ${rubricId} is bound to a terminal finding disposition.`, evidence: [path.relative(temp, builderEvidencePath)] }])) }), { mode: 0o600 });
const built = spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/build-bounded-exit-receipt.mjs"), "--config", path.relative(temp, builderConfigPath), "--out", path.relative(temp, builderOutPath)], { cwd: temp, encoding: "utf8" });
assert.equal(built.status, 0, `bounded-exit builder failed: ${built.stderr}`);
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: JSON.parse(fs.readFileSync(builderOutPath, "utf8")) }), [], "builder output must pass the same fail-closed verifier");
const missingRubric = structuredClone(multiRevisionBody); missingRubric.reviewer_evidence.bounded_exit.rubric_failure_census.pop();
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: missingRubric }).join("\n"), /does not exactly match terminal rubric failures/);
const unknownRubricFinding = structuredClone(multiRevisionBody); unknownRubricFinding.reviewer_evidence.bounded_exit.rubric_failure_census[0].finding_ids = ["UNKNOWN"];
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: unknownRubricFinding }).join("\n"), /unknown terminal finding|undispositioned terminal finding/);
const noRubricEvidence = structuredClone(multiRevisionBody); noRubricEvidence.reviewer_evidence.bounded_exit.rubric_failure_census[0].evidence = [];
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: noRubricEvidence }).join("\n"), /must NOT have fewer than 1 items|schema/);
const duplicateRubricFinding = structuredClone(multiRevisionBody); duplicateRubricFinding.reviewer_evidence.bounded_exit.rubric_failure_census[0].finding_ids = ["M-1", "M-1"];
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: duplicateRubricFinding }).join("\n"), /uniqueItems|duplicate items/);
const wrongSubjectRevision = structuredClone(multiRevisionBody);
wrongSubjectRevision.reviewer_evidence.bounded_exit.round_identities[1].review_target_digest = "0".repeat(64);
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: wrongSubjectRevision }).join("\n"), /review target digest mismatch/);
const wrongReviewedPlan = structuredClone(multiRevisionBody); wrongReviewedPlan.reviewed_plan_digest = multiRevisionRounds[0].candidateDigest;
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: wrongReviewedPlan }).join("\n"), /reviewed_plan_digest must bind the terminal/);

const hiddenFourthWi = "WI-HOURSHUB-HIDDEN-FOURTH";
const hiddenFourthDigests = ["hidden-1", "hidden-2", "hidden-3", "hidden-4"].map((value) => sha(Buffer.from(value)));
assert.throws(() => fixtureSet("plan", 4, terminalFindings, { wi: hiddenFourthWi, targetDigests: hiddenFourthDigests }), /hard cap reached/, "launcher authority must refuse a modern fourth plan-review revision");

const panelWi = "WI-PANEL-ROUNDS";
const panelDigests = ["panel-1", "panel-2", "panel-3"].map((value) => sha(Buffer.from(value)));
const advisoryTuple = { orchestrator: "codex", host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" };
const panelIndependentRounds = [];
const panelAdvisoryRounds = [];
for (const [index, panelDigest] of panelDigests.entries()) {
  panelAdvisoryRounds.push(createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: panelDigest, tupleOverride: advisoryTuple, wi: panelWi, roundLabel: `panel-advisory-${index + 1}`, verdict: "fail", findings: terminalFindings }));
  panelIndependentRounds.push(createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: panelDigest, wi: panelWi, roundLabel: `panel-independent-${index + 1}`, verdict: "fail", findings: index === 2 ? terminalFindings : [finding(`PANEL-${index + 1}`, "high")] }));
}
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: boundedBody("plan", panelIndependentRounds, panelWi) }), [], "advisory panel stations must not consume independent review rounds or bounded inventory slots");
const damagedAdvisoryReceipt = JSON.parse(fs.readFileSync(panelAdvisoryRounds[0].receiptPath, "utf8"));
const damagedAdvisoryMarker = JSON.parse(fs.readFileSync(path.join(process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT, "issuance", `${damagedAdvisoryReceipt.request_id}.json`), "utf8"));
fs.unlinkSync(panelAdvisoryRounds[0].receiptPath);
fs.unlinkSync(path.join(process.env.SVC_REVIEW_EVIDENCE_STORE, "objects", damagedAdvisoryMarker.receipt_sha256.slice(0, 2), damagedAdvisoryMarker.receipt_sha256.slice(2)));
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: boundedBody("plan", panelIndependentRounds, panelWi) }), [], "damaged signed advisory evidence must not block independent cycle reconciliation");

const malformedMarkerCount = fs.readdirSync(path.join(process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT, "issuance")).length;
assert.throws(() => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("malformed-cycle")), preExecutionBaseOverride: null, wi: "WI-MALFORMED-CYCLE", roundLabel: "malformed-cycle", verdict: "fail", findings: terminalFindings }), /plan review cycle requires a pre-execution base/);
assert.equal(fs.readdirSync(path.join(process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT, "issuance")).length, malformedMarkerCount, "unclassifiable modern review must not publish a marker");

for (const reviewKind of ["plan", "exec"]) {
  const rounds = fixtureSet(reviewKind);
  const body = boundedBody(reviewKind, rounds);
  assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind, body }), [], `${reviewKind} bounded exit should validate`);
  const emitted = spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/emit-receipt.mjs"), "--type", body.receipt_type, "--wi", body.wi, "--sha", candidateSha, "--no-note"], { cwd: temp, input: JSON.stringify(body), encoding: "utf8" });
  assert.equal(emitted.status, 0, `${reviewKind} bounded receipt emission failed: ${emitted.stderr}`);
  const emittedPath = path.join(temp, ".svc", "receipts", candidateSha.slice(0, 7), `${body.receipt_type}.json`);
  assert.equal(JSON.parse(fs.readFileSync(emittedPath, "utf8")).schema_version, 3, `${reviewKind} emitter did not produce schema v3`);

  const absent = structuredClone(body); delete absent.reviewer_evidence.bounded_exit;
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: absent }).join("\n"), /bounded-exit adjudication is required/);

  const omitted = structuredClone(body); omitted.reviewer_evidence.bounded_exit.findings_census.pop();
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: omitted }).join("\n"), /exact terminal finding count|omitted/);

  const stale = structuredClone(body); stale.reviewer_evidence.bounded_exit.cycle_id = "0".repeat(64);
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: stale }).join("\n"), /cycle identity/);

  const noEvidence = structuredClone(body); delete noEvidence.reviewer_evidence.bounded_exit.findings_census[0].evidence;
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: noEvidence }).join("\n"), /requires hash-verified evidence/);

  const genericEvidence = structuredClone(body); genericEvidence.reviewer_evidence.bounded_exit.findings_census[0].evidence = [artifact(path.join(temp, ".svc", "bounded-exit", reviewKind, "verification-result.md"))];
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: genericEvidence }).join("\n"), /not valid JSON|disposition evidence/);

  const duplicateCensus = structuredClone(body); duplicateCensus.reviewer_evidence.bounded_exit.findings_census[1].id = "H-1";
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: duplicateCensus }).join("\n"), /duplicate IDs|omitted/);

  const unknownCensus = structuredClone(body); unknownCensus.reviewer_evidence.bounded_exit.findings_census[0].id = "UNKNOWN";
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: unknownCensus }).join("\n"), /unknown finding|omitted/);

  const severityMismatch = structuredClone(body); severityMismatch.reviewer_evidence.bounded_exit.findings_census[0].severity = "medium";
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: severityMismatch }).join("\n"), /severity mismatch/);

  for (const [field, value, expected] of [
    ["review_kind", reviewKind === "plan" ? "exec" : "plan", /review_kind/],
    ["wi", "WI-WRONG", /WI does not match/],
    ["candidate_sha", "0".repeat(40), /candidate SHA/],
    ["tree_hash", "0".repeat(40), /tree identity|bound tree/],
    ["candidate_digest", "0".repeat(64), /candidate digest|tree identity/],
  ]) {
    const wrongBinding = structuredClone(body); wrongBinding.reviewer_evidence.bounded_exit[field] = value;
    assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: wrongBinding }).join("\n"), expected, `${field} mismatch passed`);
  }

  const replayed = structuredClone(body);
  replayed.reviewer_evidence.launcher_receipts = Array(3).fill(body.reviewer_evidence.launcher_receipts.at(-1));
  replayed.reviewer_evidence.commands = Array(3).fill(rounds.at(-1).reviewerEvidence.commands[0]);
  replayed.reviewer_evidence.output_artifacts = Array(3).fill(body.reviewer_evidence.output_artifacts.at(-1));
  replayed.reviewer_evidence.bounded_exit.round_identities = Array.from({ length: 3 }, (_, index) => ({ round: index + 1, review_target_digest: rounds.at(-1).candidateDigest, launcher_receipt_sha256: body.reviewer_evidence.launcher_receipts.at(-1).sha256, findings_sha256: body.reviewer_evidence.output_artifacts.at(-1).sha256 }));
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: replayed }).join("\n"), /unique|duplicated|authoritative issuance order/);

  const reordered = structuredClone(body);
  reordered.reviewer_evidence.launcher_receipts.reverse();
  reordered.reviewer_evidence.output_artifacts.reverse();
  reordered.reviewer_evidence.commands.reverse();
  reordered.reviewer_evidence.bounded_exit.round_identities.reverse().forEach((row, index) => { row.round = index + 1; });
  reordered.reviewer_evidence.bounded_exit.terminal_launcher_receipt_sha256 = reordered.reviewer_evidence.launcher_receipts.at(-1).sha256;
  reordered.reviewer_evidence.bounded_exit.terminal_findings_sha256 = reordered.reviewer_evidence.output_artifacts.at(-1).sha256;
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: reordered }).join("\n"), /authoritative issuance order/);

  const falseLog = structuredClone(body);
  const falseLogPath = path.join(temp, falseLog.reviewer_evidence.bounded_exit.review_log.path);
  const originalLog = fs.readFileSync(falseLogPath, "utf8");
  fs.writeFileSync(falseLogPath, originalLog.replace("remaining_high: 3", "remaining_high: 0"), { mode: 0o600 });
  falseLog.reviewer_evidence.bounded_exit.review_log.sha256 = sha(fs.readFileSync(falseLogPath));
  const falseCap = evaluateReviewRoundCap(fs.readFileSync(falseLogPath));
  falseLog.reviewer_evidence.bounded_exit.check_review_round_cap = { exit_code: falseCap.exit_code, result_digest: falseCap.result_digest };
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: falseLog }).join("\n"), /High count disagrees/);
  fs.writeFileSync(falseLogPath, originalLog, { mode: 0o600 });

  const wrongLogIds = structuredClone(body);
  fs.writeFileSync(falseLogPath, originalLog.replace("    - H-1", "    - NOT-H-1"), { mode: 0o600 });
  wrongLogIds.reviewer_evidence.bounded_exit.review_log.sha256 = sha(fs.readFileSync(falseLogPath));
  const wrongIdsCap = evaluateReviewRoundCap(fs.readFileSync(falseLogPath));
  wrongLogIds.reviewer_evidence.bounded_exit.check_review_round_cap = { exit_code: wrongIdsCap.exit_code, result_digest: wrongIdsCap.result_digest };
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: wrongLogIds }).join("\n"), /residual High IDs disagree/);
  fs.writeFileSync(falseLogPath, originalLog, { mode: 0o600 });

  const wrongLogDisposition = structuredClone(body);
  fs.writeFileSync(falseLogPath, originalLog.replace("disposition: accept-with-justification", "disposition: reject-with-justification"), { mode: 0o600 });
  wrongLogDisposition.reviewer_evidence.bounded_exit.review_log.sha256 = sha(fs.readFileSync(falseLogPath));
  const wrongDispositionCap = evaluateReviewRoundCap(fs.readFileSync(falseLogPath));
  wrongLogDisposition.reviewer_evidence.bounded_exit.check_review_round_cap = { exit_code: wrongDispositionCap.exit_code, result_digest: wrongDispositionCap.result_digest };
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: wrongLogDisposition }).join("\n"), /disposition disagrees/);
  fs.writeFileSync(falseLogPath, originalLog, { mode: 0o600 });

  const overCap = structuredClone(body);
  overCap.reviewer_evidence.bounded_exit.rounds_run = 4;
  overCap.reviewer_evidence.bounded_exit.round_identities.push({ ...overCap.reviewer_evidence.bounded_exit.round_identities.at(-1), round: 4 });
  overCap.adversarial_review.iteration_count = 4;
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind, body: overCap }).join("\n"), /maximum|more than 3|rounds_run/);
}

const criticalRounds = fixtureSet("plan", 3, [finding("C-1", "critical")], { wi: "WI-CRITICAL" });
const criticalBody = boundedBody("plan", criticalRounds, "WI-CRITICAL");
criticalBody.reviewer_evidence.bounded_exit.findings_census = [{ id: "C-1", severity: "critical", disposition: "accept-with-justification", justification: "never enough" }];
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: criticalBody }).join("\n"), /Critical/);

const passFixture = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, wi: "WI-PASS-PLAN", roundLabel: "existing-pass" });
const passBody = {
  wi: "WI-PASS-PLAN",
  candidate_sha: candidateSha,
  tree_hash: identity.tree_hash,
  candidate_digest: identity.candidate_digest,
  self_review: { orchestrator: "codex" },
  reviewer_evidence: passFixture.reviewerEvidence,
};
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: passBody }), [], "existing pass path regressed");
const passPlanRevision = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("passing-plan-revision")), wi: "WI-PASS-PLAN-REVISION", roundLabel: "passing-plan-revision" });
const passPlanRevisionBody = { ...passBody, wi: "WI-PASS-PLAN-REVISION", reviewed_plan_digest: passPlanRevision.candidateDigest, reviewer_evidence: passPlanRevision.reviewerEvidence };
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: passPlanRevisionBody }), [], "passing plan artifact revision must remain distinct from the final promotion tree identity");
const crossWiPass = { ...passPlanRevisionBody, wi: "WI-OTHER" };
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: crossWiPass }).join("\n"), /plan WI does not match/);

const passWithFindingsFixture = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "exec", candidateSha, wi: "WI-PASS-EXEC", roundLabel: "existing-pass-with-findings", verdict: "pass-with-findings", findings: [finding("H-PASS", "high")] });
const passWithFindingsBody = { ...passBody, self_review: { orchestrator: "codex" }, reviewer_evidence: passWithFindingsFixture.reviewerEvidence };
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: passWithFindingsBody }), [], "existing pass-with-findings path regressed");

const directFixtures = fixtureSet("exec", 3, terminalFindings, { wi: "WI-DIRECT-RAW-FAIL" });
const directBody = boundedBody("exec", directFixtures, "WI-DIRECT-RAW-FAIL");
const directRounds = directFixtures.map((round) => ({ receipt: JSON.parse(fs.readFileSync(round.receiptPath)), receiptPath: round.receiptPath, receiptSha: artifact(round.receiptPath).sha256, findings: JSON.parse(fs.readFileSync(round.output)), findingsSha: artifact(round.output).sha256 }));
for (const [mutation, expected] of [
  [(findings) => { findings.rubric_failures = [1]; }, /rubric failures/],
  [(findings) => { findings.dependencies_needing_read = ["missing.md"]; }, /unread dependencies/],
  [(findings) => { findings.certifications = [{ key: "scope", certified: false, reviewer_family: "google", for_content_sha: null }]; }, /failed reviewer certifications/],
]) {
  const alteredRounds = structuredClone(directRounds); mutation(alteredRounds.at(-1).findings);
assert.match(validateBoundedExitAdjudication({ root: temp, reviewKind: "exec", body: directBody, identity, rounds: alteredRounds }).join("\n"), expected);
}

const staleExecDigest = sha(Buffer.from("stale-exec-tree"));
const staleExecRounds = fixtureSet("exec", 3, terminalFindings, { wi: "WI-STALE-EXEC", targetDigests: [staleExecDigest, staleExecDigest, staleExecDigest] });
const staleExecBody = boundedBody("exec", staleExecRounds, "WI-STALE-EXEC");
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: staleExecBody }).join("\n"), /exec rounds must all review the final promotion candidate digest/);

const builderExecWi = "WI-BUILDER-EXEC";
const builderExecRounds = fixtureSet("exec", 3, terminalFindings, { wi: builderExecWi, launcherVersion: "2.5.4" });
boundedBody("exec", builderExecRounds, builderExecWi);
const builderExecConfig = { schema_version: 1, review_kind: "exec", wi: builderExecWi, candidate_sha: candidateSha, launcher_receipts: builderExecRounds.map((round) => round.receiptPath), review_log: path.relative(temp, path.join(temp, ".svc", "bounded-exit", "exec", "review-log.yaml")), dispositions: Object.fromEntries(terminalFindings.map((row) => [row.id, { disposition: "accept-with-justification", justification: `Disposition for ${row.id} is tied to immutable candidate evidence.`, ...(row.severity === "high" ? { evidence: [path.relative(temp, path.join(temp, ".svc", "bounded-exit", "exec", "disposition-evidence.json"))] } : {}) }])) };
const builderExecConfigPath = path.join(temp, ".svc", "bounded-exit", "builder-exec-config.json");
const builderExecOutPath = path.join(temp, ".svc", "bounded-exit", "builder-exec-body.json");
fs.writeFileSync(builderExecConfigPath, JSON.stringify(builderExecConfig), { mode: 0o600 });
const missingExecDiff = spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/build-bounded-exit-receipt.mjs"), "--config", path.relative(temp, builderExecConfigPath), "--out", path.relative(temp, builderExecOutPath)], { cwd: temp, encoding: "utf8" });
assert.notEqual(missingExecDiff.status, 0, "exec builder must reject a missing diff_hash");
builderExecConfig.diff_hash = sha(Buffer.from("builder-exec-diff"));
fs.writeFileSync(builderExecConfigPath, JSON.stringify(builderExecConfig), { mode: 0o600 });
const builtExec = spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/build-bounded-exit-receipt.mjs"), "--config", path.relative(temp, builderExecConfigPath), "--out", path.relative(temp, builderExecOutPath)], { cwd: temp, encoding: "utf8" });
assert.equal(builtExec.status, 0, `bounded-exit exec builder failed: ${builtExec.stderr}`);
assert.equal(JSON.parse(fs.readFileSync(builderExecOutPath, "utf8")).diff_hash, builderExecConfig.diff_hash);
const legacyBuiltBody = JSON.parse(fs.readFileSync(builderExecOutPath));
const legacyEmitted = spawnSync(process.execPath, [path.join(frameworkRoot, "scripts/emit-receipt.mjs"), "--type", "review-exec", "--wi", builderExecWi, "--sha", candidateSha, "--no-note"], { cwd: temp, input: JSON.stringify(legacyBuiltBody), encoding: "utf8" });
assert.equal(legacyEmitted.status, 0, `legacy builder/emitter boundary: ${legacyEmitted.stderr}`);


const legacyCorruptionWi = "WI-LEGACY-CORRUPTION";
const legacyCorruptionRounds = fixtureSet("plan", 3, terminalFindings, { wi: legacyCorruptionWi, targetDigests: ["legacy-1", "legacy-2", "legacy-3"].map((value) => sha(Buffer.from(value))) });
const legacyReceipt = JSON.parse(fs.readFileSync(legacyCorruptionRounds[0].receiptPath, "utf8"));
const authorityRoot = process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT;
const markerPath = path.join(authorityRoot, "issuance", `${legacyReceipt.request_id}.json`);
const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
delete marker.authority_hmac_sha256; delete marker.review_kind; delete marker.wi; delete marker.review_cycle_id; delete marker.cycle_sequence;
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
marker.authority_hmac_sha256 = crypto.createHmac("sha256", fs.readFileSync(path.join(authorityRoot, "authority.key"))).update(canonical(marker)).digest("hex");
fs.writeFileSync(markerPath, JSON.stringify(marker), { mode: 0o600 });
fs.writeFileSync(legacyCorruptionRounds[0].receiptPath, `${JSON.stringify({ ...legacyReceipt, phase_guard: { ...legacyReceipt.phase_guard, wi: "WI-ALTERED" } })}\n`, { mode: 0o600 });
const legacyObject = path.join(process.env.SVC_REVIEW_EVIDENCE_STORE, "objects", marker.receipt_sha256.slice(0, 2), marker.receipt_sha256.slice(2));
fs.unlinkSync(legacyObject);
const legacyCycle = boundedExitCycleId({ reviewKind: "plan", wi: legacyCorruptionWi, preExecutionBase: candidateSha });
assert.throws(() => listExternalReviewCycleProvenance({ receiptPath: legacyCorruptionRounds[1].receiptPath, wi: legacyCorruptionWi, reviewKind: "plan", cycleId: legacyCycle, candidateDigests: legacyCorruptionRounds.map((round) => round.candidateDigest) }), /(legacy|cycle) receipt is unavailable or digest-mismatched/);
assert.throws(() => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("legacy-4")), wi: legacyCorruptionWi, roundLabel: "legacy-round-4", verdict: "fail", findings: terminalFindings }), /hard cap reached/, "signed legacy classification must prevent an effective fourth independent round after receipt loss");
assert.doesNotThrow(() => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("unrelated-after-broken-legacy")), wi: "WI-UNRELATED-AFTER-BROKEN-LEGACY", roundLabel: "unrelated-after-broken-legacy", verdict: "fail", findings: terminalFindings }), "an unrelated broken legacy marker must not poison a different review cycle");
assert.doesNotThrow(() => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: legacyCorruptionRounds[0].candidateDigest, wi: "WI-SAME-SUBJECT-DIFFERENT-CYCLE", roundLabel: "same-subject-different-wi", verdict: "fail", findings: terminalFindings }), "a classified broken marker from another WI must not poison a same-subject cycle");

const swappedClassificationWi = "WI-SWAPPED-CLASSIFICATION";
const advisoryClassification = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("swapped-advisory")), wi: swappedClassificationWi, roundLabel: "swapped-advisory", verdict: "fail", findings: terminalFindings, tupleOverride: { orchestrator: "codex", host: "cursor", family: "openai", model: "gpt-5.6-sol", effort: "high" } });
const independentClassification = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("swapped-independent")), wi: swappedClassificationWi, roundLabel: "swapped-independent", verdict: "fail", findings: terminalFindings });
const advisoryRequestId = JSON.parse(fs.readFileSync(advisoryClassification.receiptPath, "utf8")).request_id;
const independentRequestId = JSON.parse(fs.readFileSync(independentClassification.receiptPath, "utf8")).request_id;
fs.copyFileSync(path.join(authorityRoot, "classifications", `${advisoryRequestId}.json`), path.join(authorityRoot, "classifications", `${independentRequestId}.json`));
const swappedCycle = boundedExitCycleId({ reviewKind: "plan", wi: swappedClassificationWi, preExecutionBase: candidateSha });
assert.throws(() => listExternalReviewCycleProvenance({ receiptPath: independentClassification.receiptPath, wi: swappedClassificationWi, reviewKind: "plan", cycleId: swappedCycle, candidateDigests: [independentClassification.candidateDigest] }), /classification identity mismatch/, "a valid classification copied under another request ID must fail inventory closed");
assert.throws(() => createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("swapped-independent-2")), wi: swappedClassificationWi, roundLabel: "swapped-independent-2", verdict: "fail", findings: terminalFindings }), /classification identity mismatch/, "a swapped advisory classification must not hide an independent round during issuance");

assert.throws(() => evaluateReviewRoundCap(Buffer.from("rounds_run: 0\nunresolved_critical: 0\nremaining_high: 0\n"), { nodePath: path.join(temp, "missing-node") }), /did not exit normally/);

console.log("PASS: bounded review exits are candidate-bound, cap-bound, census-complete, and preserve existing pass evidence");

// Historical formats are issued once by the fixture authority, not relabeled.
// Earlier negative cases intentionally poison their isolated issuance index.
process.env.SVC_EXTERNAL_REVIEW_ISSUANCE_ROOT = path.join(temp, ".svc/archive-test-authority");
process.env.SVC_REVIEW_EVIDENCE_STORE = path.join(temp, ".svc/archive-test-objects");
const archivedWi = "WI-ARCHIVED-BOUNDED";
const archivedRounds = fixtureSet("exec", 3, terminalFindings, { wi: archivedWi, launcherVersion: "2.5.4" });
const archivedBody = boundedBody("exec", archivedRounds, archivedWi);
const archivedCheck = () => verifyReviewerEvidence({ root: temp, reviewKind: "exec", body: archivedBody });
assert.deepEqual(archivedCheck(), [], "compatible producer evidence remains valid");
const boundedDir = path.join(temp, ".svc/bounded-exit/exec");
const stored = fs.readdirSync(boundedDir).map(name => {
  const file = path.join(boundedDir, name);
  return { file, bytes: fs.readFileSync(file), object: putObject(fs.readFileSync(file), { start: temp }) };
});
const log = stored.find(row => row.file.endsWith("review-log.yaml"));
const relocationDir = path.join(process.env.SVC_REVIEW_EVIDENCE_STORE, "relocations");
fs.mkdirSync(relocationDir, { mode: 0o700 });
const relocationFile = path.join(relocationDir, `${sha(Buffer.from(archivedBody.reviewer_evidence.bounded_exit.review_log.path))}.json`);
fs.symlinkSync(path.join(temp, "nonexistent-relocation"), relocationFile);
fs.unlinkSync(log.object.path);
assert.match(archivedCheck().join("\n"), /insecure|symlink/, "dangling relocation cannot become absent and accept the local copy");
fs.unlinkSync(relocationFile);
putObject(log.bytes, { start: temp });
fs.chmodSync(log.object.path, 0o666);
assert.match(archivedCheck().join("\n"), /writable/, "writable archive cannot bypass local restrictions");
fs.chmodSync(log.object.path, 0o600);
fs.chmodSync(process.env.SVC_REVIEW_EVIDENCE_STORE, 0o777);
assert.match(archivedCheck().join("\n"), /writable/, "writable store must fail before local fallback");
fs.chmodSync(process.env.SVC_REVIEW_EVIDENCE_STORE, 0o700);

fs.unlinkSync(log.object.path);
assert.deepEqual(archivedCheck(), [], "absent bare object permits a secure matching local file");
putObject(log.bytes, { start: temp });
fs.renameSync(log.object.path, `${log.object.path}.saved`);
fs.symlinkSync(`${log.object.path}.saved`, log.object.path);
assert.match(archivedCheck().join("\n"), /insecure/, "symlinked object cannot use a valid local fallback");
fs.unlinkSync(log.object.path);
fs.renameSync(`${log.object.path}.saved`, log.object.path);

// A corrupt object must not silently fall back to the valid private local copy.
fs.writeFileSync(log.object.path, "corrupt object");
assert.match(archivedCheck().join("\n"), /tamper|digest/, "bare-object corruption is not absence");
fs.writeFileSync(log.object.path, log.bytes);
for (const row of stored) fs.unlinkSync(row.file);
assert.deepEqual(archivedCheck(), [], "log, disposition and nested result survive deleted originals");
fs.unlinkSync(log.object.path);
assert.notEqual(archivedCheck().length, 0, "missing archived and local log fails");
putObject(log.bytes, { start: temp });
const wrong = putObject(Buffer.from("wrong relocation"), { start: temp });
putRelocation({ historical_path: archivedBody.reviewer_evidence.bounded_exit.review_log.path, sha256: wrong.sha256 }, { start: temp });
assert.match(archivedCheck().join("\n"), /relocation.*mismatch/, "conflicting relocation cannot fall back to correct bare object");

for (const version of ["2.5.3", "99.0.0"]) {
  const wi = `WI-UNSUPPORTED-${version.replaceAll(".", "-")}`;
  const rounds = fixtureSet("exec", 3, terminalFindings, { wi, launcherVersion: version });
  const body = boundedBody("exec", rounds, wi);
  assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "exec", body }).join("\n"), /launcher version.*unsupported/);
}
console.log("PASS: supported producer and archived bounded evidence retain fail-closed checks");
