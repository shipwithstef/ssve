#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendJsonlLine } from "./state-io.mjs";
import { loadLearningsDetailed } from "../hooks/lib/learning-index.mjs";
import { verifyReviewerEvidence } from "./lib/reviewer-evidence.mjs";

const arg = (argv, flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : ""; };
function realOwnedDirectory(candidate) {
  const lexical = path.resolve(candidate);
  const lexicalStat = fs.lstatSync(lexical);
  const real = fs.realpathSync(lexical);
  const stat = fs.lstatSync(real);
  if (!lexicalStat.isDirectory() || lexicalStat.isSymbolicLink() || real !== lexical ||
      !stat.isDirectory() || stat.isSymbolicLink() ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
    throw new Error(`insecure federated root: ${candidate}`);
  }
  return real;
}

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function secureEvidenceFile(root, candidate, requiredPrefix) {
  const absolute = path.resolve(candidate);
  const expected = path.resolve(root, requiredPrefix);
  if (path.relative(expected, absolute).startsWith("..") || path.isAbsolute(path.relative(expected, absolute))) throw new Error(`evidence file must be under ${requiredPrefix}`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(absolute) !== absolute ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error("evidence file is insecure or foreign-owned");
  return absolute;
}
function verifyCandidateSha(root, sha) {
  if (!/^[0-9a-f]{40}$/.test(String(sha || ""))) throw new Error("candidate_sha must be a 40-hex Git commit");
  try { execFileSync("git", ["-C", root, "cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore" }); }
  catch { throw new Error("candidate_sha is not a commit in the lifecycle repository"); }
}
function verifyArtifacts(root, evidence, candidateSha) {
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error("receipt requires at least one digested evidence artifact");
  for (const row of evidence) {
    const relative = String(row?.path || ""); const normalized = path.normalize(relative);
    if (!relative || path.isAbsolute(relative) || normalized.startsWith("..") || !/^[0-9a-f]{64}$/.test(String(row?.sha256 || ""))) throw new Error(`evidence row is invalid: ${relative || "(missing)"}`);
    let bytes;
    try { bytes = execFileSync("git", ["-C", root, "show", `${candidateSha}:${normalized}`], { encoding: null, stdio: ["ignore", "pipe", "pipe"] }); }
    catch { throw new Error(`evidence is not present in candidate tree: ${relative}`); }
    if (crypto.createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`candidate-tree evidence digest mismatch: ${relative}`);
  }
}
function lifecycleRows(root) {
  try { return fs.readFileSync(path.join(root, ".svc", "learning-lifecycle.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse); }
  catch { return []; }
}
function verifyEvaluateRuleAdapter(root, key, adapter, outcomeSha256) {
  if (adapter.schema_version !== 2 || adapter.skill !== "evaluate-rule" || adapter.learning_key !== key || adapter.outcome_sha256 !== outcomeSha256) throw new Error("evaluation adapter identity/outcome mismatch");
  verifyCandidateSha(root, adapter.candidate_sha);
  const verdictPath = String(adapter.verdict_path || ""); const normalized = path.normalize(verdictPath);
  if (path.isAbsolute(verdictPath) || normalized.startsWith("..") || !normalized.startsWith(`docs${path.sep}specs${path.sep}rules-evaluation${path.sep}`)) throw new Error("evaluation adapter must reference a canonical evaluate-rule verdict");
  const current = fs.readFileSync(path.resolve(root, normalized)); const candidate = execFileSync("git", ["-C", root, "show", `${adapter.candidate_sha}:${normalized}`], { encoding: null });
  const verdictDigest = crypto.createHash("sha256").update(candidate).digest("hex");
  if (!current.equals(candidate) || adapter.verdict_sha256 !== verdictDigest) throw new Error("evaluate-rule verdict is not candidate-bound");
  const verdict = JSON.parse(candidate.toString("utf8"));
  if (!hasText(verdict.rule_path) || verdict.scope !== "global" || !["adopt-as-is", "adopt-with-edits"].includes(verdict.verdict) || verdict.tier2_ran !== true || verdict.tier2_verdict !== "confirmed") throw new Error("canonical evaluate-rule verdict is not independently confirmed for global elevation");
  const reviewErrors = verifyReviewerEvidence({ root, reviewKind: "exec", body: adapter });
  if (reviewErrors.length) throw new Error(`evaluate-rule independent review invalid: ${reviewErrors.join("; ")}`);
  return true;
}
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

export function hasFrameworkLearningCredit(root, key) {
  const real = path.resolve(root); const rows = lifecycleRows(real).filter((row) => row.key === key);
  const consumption = [...rows].reverse().find((row) => row.event === "consumption" && row.decision === "used" && row.outcome_receipt && row.outcome_sha256);
  const elevated = [...rows].reverse().find((row) => row.event === "elevated" && row.source_outcome_sha256 === consumption?.outcome_sha256 && row.evaluation && row.evaluation_sha256);
  if (!consumption || !elevated) return false;
  try {
    const outcome = secureEvidenceFile(real, path.resolve(real, consumption.outcome_receipt), ".svc/learning-outcomes");
    const evaluation = secureEvidenceFile(real, path.resolve(real, elevated.evaluation), ".svc/evaluations");
    if (sha256File(outcome) !== consumption.outcome_sha256 || sha256File(evaluation) !== elevated.evaluation_sha256) return false;
    const outcomeBody = JSON.parse(fs.readFileSync(outcome, "utf8")); const evaluationBody = JSON.parse(fs.readFileSync(evaluation, "utf8"));
    verifyCandidateSha(real, outcomeBody.candidate_sha); verifyArtifacts(real, outcomeBody.evidence, outcomeBody.candidate_sha);
    verifyEvaluateRuleAdapter(real, key, evaluationBody, consumption.outcome_sha256);
    return elevated.candidate_sha === evaluationBody.candidate_sha;
  } catch { return false; }
}

export function run(argv = process.argv.slice(2), env = process.env) {
  try {
    const command = argv[0]; const root = realOwnedDirectory(path.resolve(arg(argv, "--root") || process.cwd()));
    const ledger = path.join(root, ".svc", "learning-lifecycle.jsonl");
    if (command === "normalize" || command === "triage") {
      const view = loadLearningsDetailed(root); const limit = Number(arg(argv, "--limit") || 50);
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be 1..500");
      process.stdout.write(JSON.stringify({ ...view, learnings: view.learnings.slice(0, limit), total: view.learnings.length }, null, 2) + "\n");
      return view.findings.length ? 1 : 0;
    }
    if (command === "record") {
      const key = arg(argv, "--key"); const decision = arg(argv, "--decision"); const outcome = arg(argv, "--outcome");
      if (!key || !["used", "ignored"].includes(decision)) throw new Error("record requires --key and --decision used|ignored");
      if (decision === "used" && !outcome) throw new Error("used learning requires --outcome evidence before credit");
      let outcomeReceipt = null; let outcomeSha256 = null;
      if (decision === "used") {
        const file = secureEvidenceFile(root, outcome, ".svc/learning-outcomes");
        const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
        if (receipt.schema_version !== 1 || receipt.learning_key !== key || receipt.result !== "used") throw new Error("outcome receipt identity/result mismatch");
        verifyCandidateSha(root, receipt.candidate_sha); verifyArtifacts(root, receipt.evidence, receipt.candidate_sha);
        outcomeReceipt = path.relative(root, file); outcomeSha256 = sha256File(file);
      }
      appendJsonlLine(ledger, { ts: new Date().toISOString(), event: "consumption", key, decision, outcome_receipt: outcomeReceipt, outcome_sha256: outcomeSha256 });
      process.stdout.write(JSON.stringify({ recorded: true, key, decision }) + "\n"); return 0;
    }
    if (command === "elevate") {
      const key = arg(argv, "--key"); const evaluation = secureEvidenceFile(root, path.resolve(arg(argv, "--evaluation")), ".svc/evaluations");
      const receipt = JSON.parse(fs.readFileSync(evaluation, "utf8"));
      const consumed = [...lifecycleRows(root)].reverse().find((row) => row.key === key && row.event === "consumption" && row.decision === "used");
      if (!consumed?.outcome_sha256) throw new Error("evaluation has no recorded product outcome");
      verifyEvaluateRuleAdapter(root, key, receipt, consumed.outcome_sha256);
      appendJsonlLine(ledger, { ts: new Date().toISOString(), event: "elevated", key, evaluation: path.relative(root, evaluation), evaluation_sha256: sha256File(evaluation), source_outcome_sha256: consumed.outcome_sha256, candidate_sha: receipt.candidate_sha });
      process.stdout.write(JSON.stringify({ elevated: true, key }) + "\n"); return 0;
    }
    if (command === "federate") {
      const sourceRoot = realOwnedDirectory(path.resolve(arg(argv, "--source-root")));
      const allowed = new Set([root, ...String(env.SVC_FEDERATED_PROJECT_ROOTS || "").split(path.delimiter).filter(Boolean).map(realOwnedDirectory)]);
      if (!allowed.has(sourceRoot)) throw new Error("federated root is not explicitly allowed");
      const view = loadLearningsDetailed(sourceRoot);
      appendJsonlLine(ledger, { ts: new Date().toISOString(), event: "federated", source_root: sourceRoot, accepted: view.learnings.length, malformed: view.findings.length });
      process.stdout.write(JSON.stringify({ source_root: sourceRoot, ...view }, null, 2) + "\n"); return view.findings.length ? 1 : 0;
    }
    throw new Error("usage: learning-lifecycle.mjs <normalize|triage|record|elevate|federate> --root <repo> ...");
  } catch (error) { process.stderr.write(`[learning-lifecycle] ${error.message}\n`); return 2; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
