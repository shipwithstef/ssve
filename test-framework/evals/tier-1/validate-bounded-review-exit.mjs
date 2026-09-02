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
import { candidateTreeIdentity } from "../../../scripts/lib/external-review-provenance.mjs";
import { verifyReviewerEvidence } from "../../../scripts/lib/reviewer-evidence.mjs";

const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-bounded-exit-eval-"));
process.on("exit", () => fs.rmSync(temp, { recursive: true, force: true }));
execFileSync("git", ["init", "-q", temp]);
execFileSync("git", ["-C", temp, "config", "user.name", "fixture"]);
execFileSync("git", ["-C", temp, "config", "user.email", "fixture@example.invalid"]);
fs.writeFileSync(path.join(temp, "candidate.txt"), "immutable candidate\n");
execFileSync("git", ["-C", temp, "add", "candidate.txt"]);
execFileSync("git", ["-C", temp, "commit", "-qm", "candidate"]);
const candidateSha = execFileSync("git", ["-C", temp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const identity = candidateTreeIdentity(temp, { candidateSha });

const finding = (id, severity) => ({ id, severity, claim: `${id} claim`, analysis: `${id} analysis`, evidence: [`${id} reviewer evidence`], proposed_fix: `${id} fix` });
const terminalFindings = [finding("H-1", "high"), finding("H-2", "high"), finding("H-3", "high"), finding("M-1", "medium")];

function artifact(file) { return { path: path.relative(temp, file), sha256: sha(fs.readFileSync(file)) }; }
function fixtureSet(reviewKind, count = 3, lastFindings = terminalFindings, { wi = "WI-HOURSHUB-POSTHOG", targetDigests = [], rubricFailures = [] } = {}) {
  return Array.from({ length: count }, (_, index) => createExternalReviewFixture({
    frameworkRoot,
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
  const evidencePath = path.join(directory, "high-evidence.md");
  fs.writeFileSync(evidencePath, "candidate-bound verification evidence\n", { mode: 0o600 });
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

const multiRevisionWi = "WI-HOURSHUB-MULTI-REVISION";
const multiRevisionDigests = ["revision-1", "revision-2", "revision-3"].map((value) => sha(Buffer.from(value)));
const multiRevisionRubricFailures = [2, 6, 7, 10];
const multiRevisionRounds = fixtureSet("plan", 3, terminalFindings, { wi: multiRevisionWi, targetDigests: multiRevisionDigests, rubricFailures: multiRevisionRubricFailures });
const multiRevisionBody = boundedBody("plan", multiRevisionRounds, multiRevisionWi);
const rubricEvidencePath = path.join(temp, ".svc", "bounded-exit", "plan", "high-evidence.md");
multiRevisionBody.reviewer_evidence.bounded_exit.rubric_failure_census = multiRevisionRubricFailures.map((rubricId) => ({ rubric_id: rubricId, finding_ids: [rubricId === 2 ? "M-1" : "H-1"], disposition: "accept-with-justification", justification: `Rubric ${rubricId} is bound to a terminal finding disposition.`, evidence: [artifact(rubricEvidencePath)] }));
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: multiRevisionBody }), [], "one bounded review cycle must admit successive reviewed revisions while retaining final commit binding");
const builderConfigPath = path.join(temp, ".svc", "bounded-exit", "builder-config.json");
const builderOutPath = path.join(temp, ".svc", "bounded-exit", "builder-body.json");
const builderEvidencePath = path.join(temp, ".svc", "bounded-exit", "plan", "high-evidence.md");
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
const wrongSubjectRevision = structuredClone(multiRevisionBody);
wrongSubjectRevision.reviewer_evidence.bounded_exit.round_identities[1].review_target_digest = "0".repeat(64);
assert.match(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: wrongSubjectRevision }).join("\n"), /review target digest mismatch/);

const hiddenFourthWi = "WI-HOURSHUB-HIDDEN-FOURTH";
const hiddenFourthDigests = ["hidden-1", "hidden-2", "hidden-3", "hidden-4"].map((value) => sha(Buffer.from(value)));
assert.throws(() => fixtureSet("plan", 4, terminalFindings, { wi: hiddenFourthWi, targetDigests: hiddenFourthDigests }), /hard cap reached/, "launcher authority must refuse a modern fourth plan-review revision");

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
  candidate_sha: candidateSha,
  tree_hash: identity.tree_hash,
  candidate_digest: identity.candidate_digest,
  self_review: { orchestrator: "codex" },
  reviewer_evidence: passFixture.reviewerEvidence,
};
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: passBody }), [], "existing pass path regressed");
const passPlanRevision = createExternalReviewFixture({ frameworkRoot, repo: temp, reviewKind: "plan", candidateSha, candidateDigestOverride: sha(Buffer.from("passing-plan-revision")), wi: "WI-PASS-PLAN-REVISION", roundLabel: "passing-plan-revision" });
const passPlanRevisionBody = { ...passBody, reviewer_evidence: passPlanRevision.reviewerEvidence };
assert.deepEqual(verifyReviewerEvidence({ root: temp, reviewKind: "plan", body: passPlanRevisionBody }), [], "passing plan artifact revision must remain distinct from the final promotion tree identity");

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

assert.throws(() => evaluateReviewRoundCap(Buffer.from("rounds_run: 0\nunresolved_critical: 0\nremaining_high: 0\n"), { nodePath: path.join(temp, "missing-node") }), /did not exit normally/);

console.log("PASS: bounded review exits are candidate-bound, cap-bound, census-complete, and preserve existing pass evidence");
