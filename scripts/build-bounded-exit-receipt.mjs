#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { candidateTreeIdentity, externalReviewCycleIdFromReceipt } from "./lib/external-review-provenance.mjs";
import { evaluateReviewRoundCap } from "./lib/bounded-exit.mjs";
import { verifyReviewerEvidence } from "./lib/reviewer-evidence.mjs";
import { writeJsonAtomic } from "./state-io.mjs";

const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const args = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => value.startsWith("--") ? [...rows, [value.slice(2), all[index + 1]]] : rows, []));
if (!args.config || !args.out) {
  console.error("usage: build-bounded-exit-receipt.mjs --config <json> --out <json>");
  process.exit(2);
}
const root = fs.realpathSync(process.cwd());
const configPath = path.resolve(root, args.config);
const outPath = path.resolve(root, args.out);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (config.schema_version !== 1 || !["plan", "exec"].includes(config.review_kind) || !String(config.wi || "") || !/^[0-9a-f]{40}$/.test(String(config.candidate_sha || ""))) {
  throw new Error("bounded-exit builder config identity is invalid");
}
if (!Array.isArray(config.launcher_receipts) || config.launcher_receipts.length < 1 || config.launcher_receipts.length > 3) throw new Error("bounded-exit builder requires one to three launcher receipts");
const artifact = (file) => {
  const absolute = path.isAbsolute(file) ? path.resolve(file) : path.resolve(root, file);
  const relative = path.relative(root, absolute);
  return { path: relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative, sha256: sha(fs.readFileSync(absolute)) };
};
const rounds = config.launcher_receipts.map((file) => {
  const receiptArtifact = artifact(file);
  const receipt = JSON.parse(fs.readFileSync(receiptArtifact.path, "utf8"));
  const findingsPath = receipt.artifacts?.findings;
  if (!findingsPath) throw new Error(`launcher receipt has no findings artifact: ${file}`);
  const findingsArtifact = artifact(findingsPath);
  const findings = JSON.parse(fs.readFileSync(findingsArtifact.path, "utf8"));
  return { receiptArtifact, receipt, findingsArtifact, findings };
});
const cycleId = externalReviewCycleIdFromReceipt(rounds[0].receipt);
if (rounds.some((round) => externalReviewCycleIdFromReceipt(round.receipt) !== cycleId)) throw new Error("launcher receipts do not share one review cycle");
const terminal = rounds.at(-1);
if (terminal.findings.verdict !== "fail") throw new Error("bounded-exit builder requires a terminal raw fail");
const identity = candidateTreeIdentity(root, { candidateSha: config.candidate_sha });
const reviewLog = artifact(config.review_log);
const cap = evaluateReviewRoundCap(fs.readFileSync(path.resolve(root, reviewLog.path)));
if (cap.exit_code !== 0) throw new Error(`review round cap rejected the configured log (exit ${cap.exit_code})`);
const dispositions = config.dispositions || {};
const findingsCensus = (terminal.findings.findings || []).map((finding) => {
  const declared = dispositions[finding.id];
  if (!declared) throw new Error(`missing disposition for terminal finding ${finding.id}`);
  return {
    id: finding.id,
    severity: String(finding.severity).toLowerCase(),
    disposition: declared.disposition,
    justification: declared.justification,
    ...(Array.isArray(declared.evidence) && declared.evidence.length ? { evidence: declared.evidence.map(artifact) } : {}),
  };
});
const rubricDispositions = config.rubric_dispositions || {};
const rubricFailureCensus = (terminal.findings.rubric_failures || []).map((rubricId) => {
  const declared = rubricDispositions[String(rubricId)];
  if (!declared) throw new Error(`missing disposition for terminal rubric failure ${rubricId}`);
  return {
    rubric_id: rubricId,
    finding_ids: declared.finding_ids,
    disposition: declared.disposition,
    justification: declared.justification,
    evidence: (declared.evidence || []).map(artifact),
  };
});
const commands = rounds.flatMap((round) => round.receipt.reviewer_run?.commands || []);
const outputArtifacts = rounds.flatMap((round) => (round.receipt.reviewer_run?.output_artifacts || []).map(artifact));
const body = {
  receipt_type: config.review_kind === "plan" ? "review-plan" : "review-exec",
  schema_version: 3,
  wi: config.wi,
  candidate_sha: config.candidate_sha,
  tree_hash: identity.tree_hash,
  candidate_digest: identity.candidate_digest,
  ...(config.review_kind === "exec" ? { diff_hash: config.diff_hash } : {}),
  self_review: config.self_review || { orchestrator: "codex", findings_count: 0, notes: "bounded-exit closeout" },
  adversarial_review: {
    primary_reviewer_host: terminal.receipt.effective_tuple?.host || terminal.receipt.requested_tuple?.host,
    primary_used: true,
    fallback_host: terminal.receipt.effective_tuple?.host || terminal.receipt.requested_tuple?.host,
    fallback_used: false,
    findings: terminal.findings.findings || [],
    iteration_count: rounds.length,
  },
  verdict: "pass-with-acks",
  timestamp: config.timestamp || new Date().toISOString(),
  reviewer_evidence: {
    independent: true,
    submitter_only: false,
    launcher_receipts: rounds.map((round) => round.receiptArtifact),
    commands,
    output_artifacts: outputArtifacts,
    deletion_bearing: config.deletion_bearing === true,
    parse_collect_evidence: (config.parse_collect_evidence || []).map(artifact),
    bounded_exit: {
      schema_version: 1,
      review_kind: config.review_kind,
      wi: config.wi,
      candidate_sha: config.candidate_sha,
      tree_hash: identity.tree_hash,
      candidate_digest: identity.candidate_digest,
      cycle_id: cycleId,
      rounds_run: rounds.length,
      hard_cap: 3,
      round_identities: rounds.map((round, index) => ({ round: index + 1, review_target_digest: round.receipt.candidate_digest, launcher_receipt_sha256: round.receiptArtifact.sha256, findings_sha256: round.findingsArtifact.sha256 })),
      terminal_launcher_receipt_sha256: terminal.receiptArtifact.sha256,
      terminal_findings_sha256: terminal.findingsArtifact.sha256,
      review_log: reviewLog,
      check_review_round_cap: { exit_code: cap.exit_code, result_digest: cap.result_digest },
      findings_census: findingsCensus,
      rubric_failure_census: rubricFailureCensus,
    },
  },
};
const reasons = verifyReviewerEvidence({ root, reviewKind: config.review_kind, body });
if (reasons.length) throw new Error(`bounded-exit receipt body rejected: ${reasons.join("; ")}`);
writeJsonAtomic(outPath, body, { mode: 0o600 });
console.log(JSON.stringify({ status: "pass", out: path.relative(root, outPath), cycle_id: cycleId, rounds: rounds.length }));
