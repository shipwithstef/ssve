import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateEvidenceSchema } from "./evidence-schema.mjs";
import { externalReviewCycleId, externalReviewCycleIdFromReceipt, listExternalReviewCycleProvenance } from "./external-review-provenance.mjs";

export const BOUNDED_EXIT_HARD_CAP = 3;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(fs.readFileSync(path.resolve(HERE, "../../schemas/receipts/bounded-exit.schema.json"), "utf8"));
const DISPOSITION_EVIDENCE_SCHEMA = JSON.parse(fs.readFileSync(path.resolve(HERE, "../../schemas/receipts/bounded-exit-evidence.schema.json"), "utf8"));
const CHECKER_PATH = path.resolve(HERE, "../check-review-round-cap.mjs");
const ALLOWED_DISPOSITIONS = new Set(["fixed", "accept-with-justification", "reject-with-justification"]);

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

export function boundedExitCycleId({ reviewKind, wi, candidateDigest = null, preExecutionBase = null, overrideSha = null }) {
  return externalReviewCycleId({ reviewKind, wi, candidateDigest, preExecutionBase, overrideSha });
}

function loadBoundRepositoryFile(root, artifact, label) {
  if (!artifact || typeof artifact.path !== "string" || !/^[0-9a-f]{64}$/.test(String(artifact.sha256 || ""))) {
    throw new Error(`${label} is not a hash-bound artifact`);
  }
  const repository = fs.realpathSync(path.resolve(root));
  const absolute = path.isAbsolute(artifact.path) ? path.resolve(artifact.path) : path.resolve(repository, artifact.path);
  const relative = path.relative(repository, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} escapes repository root`);
  if (!(relative.startsWith(`.svc${path.sep}`) || relative.startsWith(`docs${path.sep}`))) {
    throw new Error(`${label} must live under .svc/ or docs/`);
  }
  let cursor = repository;
  for (const [index, segment] of relative.split(path.sep).entries()) {
    cursor = path.join(cursor, segment);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || fs.realpathSync(cursor) !== cursor) throw new Error(`${label} traverses a symlink`);
    if ((stat.mode & 0o022) !== 0) throw new Error(`${label} is group/other writable`);
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`${label} is foreign-owned`);
    if (index < relative.split(path.sep).length - 1 && !stat.isDirectory()) throw new Error(`${label} parent is not a directory`);
    if (index === relative.split(path.sep).length - 1 && !stat.isFile()) throw new Error(`${label} is not a regular file`);
  }
  const bytes = fs.readFileSync(absolute);
  if (digest(bytes) !== artifact.sha256) throw new Error(`${label} digest mismatch`);
  return bytes;
}

function validateDispositionEvidence(root, artifact, { wi, candidateDigest, findingId = null, rubricId = null }) {
  const bytes = loadBoundRepositoryFile(root, artifact, `bounded-exit disposition evidence ${findingId || rubricId}`);
  let document;
  try { document = JSON.parse(bytes.toString("utf8")); }
  catch { throw new Error("bounded-exit disposition evidence is not valid JSON"); }
  const schemaErrors = validateEvidenceSchema(document, DISPOSITION_EVIDENCE_SCHEMA);
  if (schemaErrors.length) throw new Error(`bounded-exit disposition evidence schema: ${schemaErrors.slice(0, 4).join("; ")}`);
  if (document.wi !== wi || document.candidate_digest !== candidateDigest) throw new Error("bounded-exit disposition evidence candidate/WI binding mismatch");
  if (findingId && !document.finding_ids.includes(findingId)) throw new Error(`bounded-exit disposition evidence does not bind finding ${findingId}`);
  if (rubricId && !document.rubric_ids.includes(rubricId)) throw new Error(`bounded-exit disposition evidence does not bind rubric ${rubricId}`);
  loadBoundRepositoryFile(root, document.result_artifact, `bounded-exit disposition result ${findingId || rubricId}`);
}

function capResultDigest(result) {
  return digest(Buffer.from(`${String(result.stdout || "")}\n${String(result.stderr || "")}\n${Number(result.status)}`));
}

function uniqueLogInteger(logText, key) {
  const matches = [...logText.matchAll(new RegExp(`^\\s*${key}\\s*:\\s*(\\d+)\\s*(?:#.*)?$`, "gim"))];
  if (matches.length !== 1) return null;
  return Number(matches[0][1]);
}

function boundedExitLogDetails(logText) {
  const lines = logText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*bounded_exit\s*:/.test(line));
  if (start < 0) return null;
  const blockIndent = lines[start].match(/^\s*/)[0].length;
  let disposition = null;
  const residualHighs = [];
  let residualIndent = null;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)[0].length;
    if (indent <= blockIndent) break;
    const dispositionMatch = line.match(/^\s*disposition\s*:\s*([A-Za-z-]+)\s*(?:#.*)?$/);
    if (dispositionMatch && residualIndent === null) { disposition = dispositionMatch[1]; continue; }
    const inline = line.match(/^\s*residual_highs\s*:\s*\[(.*)\]\s*(?:#.*)?$/);
    if (inline) {
      residualHighs.push(...inline[1].split(",").map((value) => value.replace(/^[\s"']+|[\s"']+$/g, "")).filter(Boolean));
      continue;
    }
    if (/^\s*residual_highs\s*:\s*(?:#.*)?$/.test(line)) { residualIndent = indent; continue; }
    if (residualIndent !== null) {
      if (indent <= residualIndent) { residualIndent = null; index -= 1; continue; }
      const item = line.match(/^\s*-\s*(.+?)\s*$/);
      if (item) residualHighs.push(item[1].replace(/^["']|["']$/g, "").trim());
    }
  }
  return { disposition, residualHighs };
}

export function evaluateReviewRoundCap(logBytes, { checkerPath = CHECKER_PATH, nodePath = process.execPath } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "svc-bounded-exit-"));
  const logPath = path.join(directory, "review-log.yaml");
  try {
    fs.writeFileSync(logPath, logBytes, { mode: 0o600 });
    const result = spawnSync(nodePath, [checkerPath, "--log", logPath], { encoding: "utf8" });
    if (result.error || result.status === null || result.signal) {
      throw new Error(`round-cap checker did not exit normally${result.error ? `: ${result.error.message}` : result.signal ? `: signal ${result.signal}` : ""}`);
    }
    return {
      exit_code: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      result_digest: capResultDigest(result),
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function candidateCommitTree(root, candidateSha) {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", `${candidateSha}^{tree}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function validateBoundedExitAdjudication({ root, reviewKind, body, identity, rounds }) {
  const adjudication = body?.reviewer_evidence?.bounded_exit;
  if (!adjudication || typeof adjudication !== "object" || Array.isArray(adjudication)) {
    return ["bounded-exit adjudication is required for non-passing launcher findings"];
  }
  const schemaErrors = validateEvidenceSchema(adjudication, SCHEMA);
  if (schemaErrors.length) return schemaErrors.slice(0, 8).map((error) => `bounded-exit schema: ${error}`);

  const reasons = [];
  if (!Array.isArray(rounds) || rounds.length === 0) return ["bounded-exit requires verified launcher rounds"];
  if (rounds.length > BOUNDED_EXIT_HARD_CAP) reasons.push(`bounded-exit forbids more than ${BOUNDED_EXIT_HARD_CAP} launcher rounds`);
  const terminal = rounds.at(-1);
  if (String(terminal?.findings?.verdict || "") !== "fail") reasons.push("bounded-exit is only admissible for a terminal raw fail verdict");
  if (body?.verdict !== "pass-with-acks") reasons.push("bounded-exit receipt verdict must be pass-with-acks");

  const wi = String(body?.wi || "");
  const candidateDigest = String(body?.candidate_digest || "");
  if (adjudication.review_kind !== reviewKind) reasons.push(`bounded-exit review_kind=${adjudication.review_kind} expected ${reviewKind}`);
  if (adjudication.wi !== wi) reasons.push("bounded-exit WI does not match receipt WI");
  if (adjudication.candidate_digest !== candidateDigest) reasons.push("bounded-exit candidate digest does not match receipt");
  if (!identity || adjudication.tree_hash !== identity.tree_hash || adjudication.candidate_digest !== identity.candidate_digest) {
    reasons.push("bounded-exit candidate tree identity is stale or mismatched");
  }
  const bodySha = String(body?.candidate_sha || body?.target_sha || body?.sha || "");
  if (adjudication.candidate_sha !== bodySha) reasons.push("bounded-exit candidate SHA does not match receipt candidate SHA");
  if (candidateCommitTree(root, adjudication.candidate_sha) !== adjudication.tree_hash) reasons.push("bounded-exit candidate SHA does not resolve to the bound tree");
  let authoritativeCycleId = null;
  try {
    authoritativeCycleId = externalReviewCycleIdFromReceipt(rounds[0]?.receipt);
    if (rounds.some((round) => externalReviewCycleIdFromReceipt(round.receipt) !== authoritativeCycleId)) reasons.push("bounded-exit launcher rounds do not share one authoritative review cycle");
  } catch (error) { reasons.push(`cannot derive bounded-exit review cycle: ${error.message}`); }
  if (adjudication.cycle_id !== authoritativeCycleId) reasons.push("bounded-exit cycle identity is not derived from the launcher review lineage");
  if (adjudication.rounds_run !== rounds.length) reasons.push(`bounded-exit rounds_run=${adjudication.rounds_run} disagrees with ${rounds.length} launcher receipts`);
  if (body?.adversarial_review?.iteration_count !== rounds.length) reasons.push("adversarial_review.iteration_count disagrees with launcher receipts");
  if (reviewKind === "exec" && rounds.some((round) => round.receipt?.candidate_digest !== candidateDigest)) reasons.push("bounded-exit exec rounds must all review the final promotion candidate digest");
  if (reviewKind === "plan") {
    if (body?.reviewed_plan_digest !== terminal?.receipt?.candidate_digest) reasons.push("bounded-exit reviewed_plan_digest must bind the terminal plan-review subject");
    if (terminal?.receipt?.phase_guard?.plan_manifest_sha256 !== terminal?.receipt?.candidate_digest) reasons.push("bounded-exit terminal plan subject is not phase-guard bound");
  }

  const requestIds = rounds.map((round) => String(round.receipt?.request_id || ""));
  const receiptDigests = rounds.map((round) => round.receiptSha);
  if (requestIds.some((requestId) => !requestId) || new Set(requestIds).size !== requestIds.length) reasons.push("bounded-exit launcher rounds must have unique request IDs");
  if (new Set(receiptDigests).size !== receiptDigests.length) reasons.push("bounded-exit launcher rounds must have unique receipt digests");
  try {
    const inventory = listExternalReviewCycleProvenance({ receiptPath: rounds[0].receiptPath, wi, reviewKind, cycleId: adjudication.cycle_id, candidateDigests: rounds.map((round) => round.receipt?.candidate_digest) });
    if (inventory.length !== rounds.length) reasons.push(`bounded-exit declared ${rounds.length} round(s), but launcher authority issued ${inventory.length} for this candidate cycle`);
    const inventoryIds = inventory.map((entry) => entry.request_id);
    const inventoryDigests = inventory.map((entry) => entry.receipt_sha256);
    if (JSON.stringify(inventoryIds) !== JSON.stringify(requestIds) || JSON.stringify(inventoryDigests) !== JSON.stringify(receiptDigests)) {
      reasons.push("bounded-exit launcher rounds are incomplete, duplicated, or not in authoritative issuance order");
    }
  } catch (error) {
    reasons.push(`cannot reconcile bounded-exit launcher cycle inventory: ${error.message}`);
  }

  if (adjudication.round_identities.length !== rounds.length) {
    reasons.push("bounded-exit round identities must enumerate every launcher receipt exactly once");
  } else {
    rounds.forEach((round, index) => {
      const declared = adjudication.round_identities[index];
      if (declared.round !== index + 1) reasons.push(`bounded-exit round ${index + 1} has a non-canonical ordinal`);
      if (declared.review_target_digest !== round.receipt.candidate_digest) reasons.push(`bounded-exit round ${index + 1} review target digest mismatch`);
      if (reviewKind === "exec" && declared.review_target_digest !== candidateDigest) reasons.push(`bounded-exit exec round ${index + 1} does not bind the final promotion candidate`);
      if (declared.launcher_receipt_sha256 !== round.receiptSha) reasons.push(`bounded-exit round ${index + 1} launcher digest mismatch`);
      if (declared.findings_sha256 !== round.findingsSha) reasons.push(`bounded-exit round ${index + 1} findings digest mismatch`);
    });
  }
  if (adjudication.terminal_launcher_receipt_sha256 !== terminal.receiptSha) reasons.push("bounded-exit terminal launcher digest mismatch");
  if (adjudication.terminal_findings_sha256 !== terminal.findingsSha) reasons.push("bounded-exit terminal findings digest mismatch");

  let cap;
  try {
    const logBytes = loadBoundRepositoryFile(root, adjudication.review_log, "bounded-exit review log");
    cap = evaluateReviewRoundCap(logBytes);
    const logText = logBytes.toString("utf8");
    const terminalRows = Array.isArray(terminal.findings?.findings) ? terminal.findings.findings : [];
    const terminalCriticals = terminalRows.filter((finding) => String(finding?.severity || "").toLowerCase() === "critical").length;
    const terminalHighs = terminalRows.filter((finding) => String(finding?.severity || "").toLowerCase() === "high").length;
    if (uniqueLogInteger(logText, "rounds_run") !== rounds.length) reasons.push("bounded-exit review log round count disagrees with launcher receipts");
    if (uniqueLogInteger(logText, "unresolved_critical") !== terminalCriticals) reasons.push("bounded-exit review log Critical count disagrees with terminal findings");
    if (uniqueLogInteger(logText, "remaining_high") !== terminalHighs) reasons.push("bounded-exit review log High count disagrees with terminal findings");
    if (terminalHighs > 0) {
      const logExit = boundedExitLogDetails(logText);
      const terminalHighIds = terminalRows.filter((finding) => String(finding?.severity || "").toLowerCase() === "high").map((finding) => String(finding.id));
      if (!logExit || logExit.residualHighs.length !== terminalHighIds.length || new Set(logExit.residualHighs).size !== logExit.residualHighs.length || JSON.stringify([...logExit.residualHighs].sort()) !== JSON.stringify([...terminalHighIds].sort())) {
        reasons.push("bounded-exit review log residual High IDs disagree with terminal findings");
      }
      const censusById = new Map(adjudication.findings_census.map((entry) => [String(entry.id), entry]));
      if (!logExit?.disposition || terminalHighIds.some((id) => censusById.get(id)?.disposition !== logExit.disposition)) reasons.push("bounded-exit review log disposition disagrees with the High finding census");
    }
  } catch (error) {
    reasons.push(`cannot verify bounded-exit review log: ${error.message}`);
    return reasons;
  }
  if (cap.exit_code !== 0) reasons.push(`check-review-round-cap rejected the bound review log (exit ${cap.exit_code})`);
  if (adjudication.check_review_round_cap.exit_code !== cap.exit_code) reasons.push("bounded-exit round-cap exit code mismatch");
  if (adjudication.check_review_round_cap.result_digest !== cap.result_digest) reasons.push("bounded-exit round-cap result digest mismatch");

  const terminalFindings = Array.isArray(terminal.findings?.findings) ? terminal.findings.findings : [];
  const terminalRubricFailures = Array.isArray(terminal.findings?.rubric_failures) ? terminal.findings.rubric_failures : [];
  if (Array.isArray(terminal.findings?.dependencies_needing_read) && terminal.findings.dependencies_needing_read.length > 0) reasons.push("bounded-exit cannot admit unread dependencies outside the finding census");
  if (Array.isArray(terminal.findings?.certifications) && terminal.findings.certifications.some((certification) => certification?.certified !== true)) reasons.push("bounded-exit cannot admit failed reviewer certifications outside the finding census");
  const findingIds = terminalFindings.map((finding) => String(finding?.id || ""));
  if (findingIds.some((id) => !id)) reasons.push("terminal findings contain a missing ID");
  if (new Set(findingIds).size !== findingIds.length) reasons.push("terminal findings contain duplicate IDs");
  const byId = new Map(terminalFindings.map((finding) => [String(finding?.id || ""), finding]));
  const censusIds = adjudication.findings_census.map((entry) => String(entry?.id || ""));
  if (new Set(censusIds).size !== censusIds.length) reasons.push("bounded-exit census contains duplicate IDs");
  if (adjudication.findings_census.length !== terminalFindings.length) reasons.push("bounded-exit census does not cover the exact terminal finding count");
  for (const entry of adjudication.findings_census) {
    const finding = byId.get(entry.id);
    if (!finding) { reasons.push(`bounded-exit census contains unknown finding ${entry.id}`); continue; }
    const severity = String(finding.severity || "").toLowerCase();
    if (entry.severity !== severity) reasons.push(`bounded-exit census severity mismatch for ${entry.id}`);
    if (!ALLOWED_DISPOSITIONS.has(entry.disposition)) reasons.push(`bounded-exit disposition for ${entry.id} is not allowed`);
    if (!String(entry.justification || "").trim()) reasons.push(`bounded-exit justification for ${entry.id} is empty`);
    if (severity === "critical") reasons.push(`bounded-exit cannot admit unresolved Critical finding ${entry.id}`);
    if (severity === "high") {
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) reasons.push(`bounded-exit High ${entry.id} requires hash-verified evidence`);
      for (const artifact of entry.evidence || []) {
        try { validateDispositionEvidence(root, artifact, { wi, candidateDigest, findingId: entry.id }); }
        catch (error) { reasons.push(error.message); }
      }
    }
  }
  for (const finding of terminalFindings) {
    const id = String(finding?.id || "");
    if (id && !censusIds.includes(id)) reasons.push(`bounded-exit census omitted terminal finding ${id}`);
    if (String(finding?.severity || "").toLowerCase() === "critical") reasons.push(`bounded-exit cannot admit unresolved Critical finding ${id || "<missing-id>"}`);
  }
  const rubricIds = adjudication.rubric_failure_census.map((entry) => entry.rubric_id);
  if (new Set(rubricIds).size !== rubricIds.length) reasons.push("bounded-exit rubric-failure census contains duplicate rubric IDs");
  if (adjudication.rubric_failure_census.length !== terminalRubricFailures.length || JSON.stringify([...rubricIds].sort((a, b) => a - b)) !== JSON.stringify([...terminalRubricFailures].sort((a, b) => a - b))) {
    reasons.push("bounded-exit rubric-failure census does not exactly match terminal rubric failures");
  }
  for (const entry of adjudication.rubric_failure_census) {
    if (!ALLOWED_DISPOSITIONS.has(entry.disposition)) reasons.push(`bounded-exit rubric ${entry.rubric_id} disposition is not allowed`);
    if (!String(entry.justification || "").trim()) reasons.push(`bounded-exit rubric ${entry.rubric_id} justification is empty`);
    for (const findingId of entry.finding_ids || []) {
      if (!byId.has(findingId)) reasons.push(`bounded-exit rubric ${entry.rubric_id} maps to unknown terminal finding ${findingId}`);
      if (!censusIds.includes(findingId)) reasons.push(`bounded-exit rubric ${entry.rubric_id} maps to undispositioned terminal finding ${findingId}`);
    }
    for (const artifact of entry.evidence || []) {
      try { validateDispositionEvidence(root, artifact, { wi, candidateDigest, rubricId: entry.rubric_id }); }
      catch (error) { reasons.push(error.message); }
    }
  }
  return reasons;
}
