import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { familyOf } from "./cognitive-family.mjs";
import { EXTERNAL_REVIEW_LAUNCHER_VERSION, validateExternalReviewReceiptSemantics } from "../run-external-review.mjs";
import { candidateTreeIdentity, verifyExternalReviewProvenance } from "./external-review-provenance.mjs";
import { getObject, lookupRelocation, resolveEvidenceBytes } from "./review-evidence-store.mjs";

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../schemas");
const EXTERNAL_RECEIPT_SCHEMA = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, "external-review-receipt.schema.json"), "utf8"));
const EXTERNAL_FINDINGS_SCHEMA = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, "external-review-findings.schema.json"), "utf8"));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function validateEvidenceSchema(value, schema, rootSchema = schema, location = "$") {
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) return [`${location}: unsupported schema reference`];
    const target = schema.$ref.slice(2).split("/").reduce((cursor, key) => cursor?.[key], rootSchema);
    return target ? validateEvidenceSchema(value, target, rootSchema, location) : [`${location}: unresolved schema reference`];
  }
  if (schema.anyOf) {
    const branches = schema.anyOf.map((branch) => validateEvidenceSchema(value, branch, rootSchema, location));
    if (!branches.some((errors) => errors.length === 0)) return [`${location}: no anyOf branch matched`];
  }
  if (Object.prototype.hasOwnProperty.call(schema, "const") && canonical(value) !== canonical(schema.const)) return [`${location}: const mismatch`];
  const errors = []; const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
  if (types.length && !types.includes(actual) && !(actual === "integer" && types.includes("number"))) return [`${location}: expected ${types.join("|")}, got ${actual}`];
  if (schema.enum && !schema.enum.some((entry) => canonical(entry) === canonical(value))) errors.push(`${location}: outside enum`);
  if (typeof value === "string" && schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${location}: pattern mismatch`);
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: below minimum`);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${location}: missing ${key}`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) errors.push(`${location}: unexpected ${key}`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.prototype.hasOwnProperty.call(value, key)) errors.push(...validateEvidenceSchema(value[key], child, rootSchema, `${location}.${key}`));
  }
  if (Array.isArray(value) && schema.items) value.forEach((entry, index) => errors.push(...validateEvidenceSchema(entry, schema.items, rootSchema, `${location}[${index}]`)));
  return errors;
}

function localCheckoutArtifact(root, value, { externalOnly = true } = {}) {
  const absolute = path.isAbsolute(value.path) ? path.resolve(value.path) : path.resolve(root, value.path);
  const relToRoot = path.relative(root, absolute);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) return null;
  const svc = path.join(root, ".svc");
  const required = externalOnly ? path.join(svc, "external-review-artifacts") : svc;
  const rel = path.relative(required, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  if (!fs.existsSync(absolute)) return null;
  let cursor = path.resolve(required);
  for (const part of rel.split(path.sep).slice(0, -1)) {
    cursor = path.join(cursor, part); const parentStat = fs.lstatSync(cursor);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || fs.realpathSync(cursor) !== cursor || (typeof process.getuid === "function" && parentStat.uid !== process.getuid())) throw new Error(`evidence parent is insecure: ${value.path}`);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(absolute) !== absolute || (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error(`evidence artifact is insecure: ${value.path}`);
  const bytes = fs.readFileSync(absolute);
  if (digest(bytes) !== value.sha256) throw new Error(`evidence digest mismatch: ${value.path}`);
  return { absolute, bytes, source: "checkout" };
}

function secureArtifact(root, value, { externalOnly = true, extraPaths = [] } = {}) {
  const local = localCheckoutArtifact(root, value, { externalOnly });
  if (local) return local;
  return resolveEvidenceBytes(value, { start: root, extraPaths: [value.path, ...extraPaths] });
}

function artifactDigest(root, maybePath, declaredSha = null) {
  if (declaredSha && /^[0-9a-f]{64}$/.test(declaredSha)) {
    try { return getObject(declaredSha, { start: root }).sha256; } catch { /* try path */ }
  }
  const candidates = [maybePath, declaredSha].filter((value) => typeof value === "string" && value);
  for (const candidate of candidates) {
    try {
      const relocated = lookupRelocation(candidate, { start: root });
      if (relocated) return relocated.sha256;
    } catch { /* fail closed below */ }
    if (!path.isAbsolute(candidate) || fs.existsSync(candidate)) {
      try {
        if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile() && !fs.lstatSync(candidate).isSymbolicLink()) {
          return digest(fs.readFileSync(candidate));
        }
      } catch { /* continue */ }
    }
  }
  throw new Error(`cannot resolve artifact digest: ${maybePath || declaredSha}`);
}

function selfBindHolds(repository, entry, receipt, receiptBytes) {
  const historical = receipt.artifacts?.receipt || "";
  const checkoutResolved = path.resolve(repository, entry.path);
  if (historical && path.resolve(historical) === checkoutResolved) return true;
  if (digest(receiptBytes) !== entry.sha256) return false;
  const mappedHistorical = historical ? lookupRelocation(historical, { start: repository }) : null;
  const mappedEntry = lookupRelocation(entry.path, { start: repository })
    || lookupRelocation(checkoutResolved, { start: repository });
  const objectOk = (() => { try { return getObject(entry.sha256, { start: repository }).sha256 === entry.sha256; } catch { return false; } })();
  if (mappedHistorical && mappedHistorical.sha256 === entry.sha256 && objectOk) return true;
  if (mappedEntry && mappedEntry.sha256 === entry.sha256 && objectOk) return true;
  return false;
}

export function verifyReviewerEvidence({ root = process.cwd(), reviewKind, body }) {
  const reasons = []; const repository = fs.realpathSync(path.resolve(root));
  const evidence = body?.reviewer_evidence;
  if (!/^[0-9a-f]{64}$/.test(String(body?.candidate_digest || ""))) reasons.push("review receipt requires a 64-hex candidate_digest");
  try { const identity=candidateTreeIdentity(repository,{candidateSha:body?.candidate_sha,treeHash:body?.tree_hash});if(identity.candidate_digest!==body?.candidate_digest)reasons.push(`review candidate digest does not bind git tree ${identity.tree_hash}`); }
  catch(error){reasons.push(`cannot recompute review candidate identity: ${error.message}`);}
  if (!evidence || evidence.independent !== true || evidence.submitter_only !== false) return [...reasons, "reviewer evidence must be independent and non-submitter-only"];
  if (!Array.isArray(evidence.launcher_receipts) || evidence.launcher_receipts.length === 0) reasons.push("reviewer evidence requires hash-bound launcher receipts");
  if (!Array.isArray(evidence.commands) || evidence.commands.length === 0) reasons.push("reviewer evidence requires commands");
  if (!Array.isArray(evidence.output_artifacts) || evidence.output_artifacts.length === 0) reasons.push("reviewer evidence requires hash-bound output artifacts");
  if (reasons.length) return reasons;

  const launcherCommands = []; const launcherOutputs = [];
  for (const entry of evidence.launcher_receipts) {
    try {
      const loaded = secureArtifact(repository, entry, { extraPaths: [entry.path, path.resolve(repository, entry.path)] }); const bytes = loaded.bytes; const receipt = JSON.parse(bytes.toString("utf8"));
      const schemaErrors = validateEvidenceSchema(receipt, EXTERNAL_RECEIPT_SCHEMA);
      if (schemaErrors.length) throw new Error(`launcher receipt schema invalid: ${schemaErrors.slice(0, 3).join("; ")}`);
      const semanticErrors = validateExternalReviewReceiptSemantics(receipt);
      if (semanticErrors.length) throw new Error(`launcher receipt semantics invalid: ${semanticErrors.slice(0, 3).join("; ")}`);
      if (receipt.launcher_version !== EXTERNAL_REVIEW_LAUNCHER_VERSION) reasons.push(`launcher version is not current: ${entry.path}`);
      if (receipt.fixture_mode !== false || !Array.isArray(receipt.attempts) || receipt.attempts.length === 0) reasons.push(`launcher receipt is not a real external attempt: ${entry.path}`);
      if (!selfBindHolds(repository, entry, receipt, bytes)) reasons.push(`launcher receipt does not self-bind its canonical path: ${entry.path}`);
      if (receipt.findings_schema_sha256 !== digest(fs.readFileSync(path.join(SCHEMA_DIR, "external-review-findings.schema.json")))) reasons.push(`launcher findings schema digest mismatch: ${entry.path}`);
      if (receipt.status !== "success" || !["success", "cache_hit"].includes(receipt.classification)) reasons.push(`launcher receipt is not a successful review: ${entry.path}`);
      if (receipt.review_kind !== reviewKind) reasons.push(`launcher review_kind=${receipt.review_kind} expected ${reviewKind}`);
      if (receipt.candidate_digest !== body.candidate_digest) reasons.push(`launcher candidate digest mismatch: ${entry.path}`);
      const packageEntry={path:receipt.artifacts?.package,sha256:receipt.package_sha256};const packageArtifact=secureArtifact(repository,packageEntry,{extraPaths:[receipt.artifacts?.package]});
      if(!packageArtifact.bytes.includes(Buffer.from(body.candidate_digest)))reasons.push(`launcher package does not contain candidate digest: ${entry.path}`);
      const findingsEntry = { path: receipt.artifacts?.findings, sha256: receipt.findings_sha256 };
      const findingsBytes = secureArtifact(repository, findingsEntry, { extraPaths: [receipt.artifacts?.findings] }); const findings = JSON.parse(findingsBytes.bytes.toString("utf8"));
      const findingsSchemaErrors = validateEvidenceSchema(findings, EXTERNAL_FINDINGS_SCHEMA);
      if (findingsSchemaErrors.length) reasons.push(`launcher findings schema invalid: ${findingsSchemaErrors.slice(0, 3).join("; ")}`);
      if (findings.review_kind !== reviewKind || !String(findings.verdict || "").startsWith("pass")) reasons.push(`launcher findings do not carry a passing ${reviewKind} verdict: ${entry.path}`);
      if ((findings.findings || []).some((finding) => String(finding?.severity || "").toLowerCase() === "critical") || (findings.verdict !== "pass-with-findings" && (findings.findings || []).some((finding) => String(finding?.severity || "").toLowerCase() === "high"))) reasons.push(`launcher findings contain unresolved Critical/High: ${entry.path}`);
      const orchestrator = receipt.effective_tuple?.orchestrator; const reviewerFamily = familyOf(receipt.effective_tuple?.family || receipt.effective_tuple?.host); const authorFamily = familyOf(body.self_review?.orchestrator);
      if (orchestrator !== body.self_review?.orchestrator || authorFamily === "unknown" || reviewerFamily === "unknown" || authorFamily === reviewerFamily) reasons.push(`launcher reviewer is not independently cross-family: ${entry.path}`);
      if (!Array.isArray(receipt.reviewer_run?.commands) || receipt.reviewer_run.commands.length === 0 || !Array.isArray(receipt.reviewer_run?.output_artifacts) || receipt.reviewer_run.output_artifacts.length === 0) reasons.push(`launcher receipt lacks a concrete reviewer_run: ${entry.path}`);
      if (receipt.effective_tuple?.host === "agy") {
        try {
          const transportPath = receipt.usage?.agy_transport_receipt || "";
          const transportRel = path.isAbsolute(transportPath) ? transportPath : path.relative(repository, transportPath);
          const transport = secureArtifact(repository, { path: path.isAbsolute(transportPath) ? transportPath : transportRel, sha256: receipt.usage?.agy_transport_receipt_sha256 }, { extraPaths: [transportPath] });
          const transportReceipt = JSON.parse(transport.bytes.toString("utf8"));
          if (transportReceipt.schema_version !== 1 || transportReceipt.status !== "success" || transportReceipt.classification !== "success" || transportReceipt.requested_model !== receipt.effective_tuple.model || transportReceipt.requested_effort !== receipt.effective_tuple.effort || transportReceipt.sandbox !== true || transportReceipt.mode !== "plan" || Number(transportReceipt.exit_code) !== 0) reasons.push(`AGY transport receipt is not a successful exact sandboxed invocation: ${entry.path}`);
        } catch (error) { reasons.push(`cannot verify AGY transport receipt for ${entry.path}: ${error.message}`); }
      }
      const attemptCommands = receipt.attempts.map((attempt) => attempt.command).filter(Boolean);
      if (!sameJson(receipt.reviewer_run?.commands, attemptCommands)) reasons.push(`launcher reviewer_run commands do not match attempts: ${entry.path}`);
      launcherCommands.push(...(receipt.reviewer_run?.commands || []));
      launcherOutputs.push(...(receipt.reviewer_run?.output_artifacts || []).map((value) => artifactDigest(repository, value)));
      const receiptFile = bytes ? { absolute: entry.path, bytes } : null;
      verifyExternalReviewProvenance({
        receiptPath: receiptFile,
        receiptBytes: bytes,
        packagePath: packageArtifact.absolute,
        packageBytes: packageArtifact.bytes,
        findingsPath: findingsBytes.absolute,
        findingsBytes: findingsBytes.bytes,
      });
    } catch (error) { reasons.push(`cannot verify launcher receipt ${entry?.path || "<missing>"}: ${error.message}`); }
  }
  if (!sameJson(evidence.commands, launcherCommands)) reasons.push("declared reviewer commands do not exactly match launcher reviewer_run commands");
  const declaredOutputs = [];
  for (const entry of evidence.output_artifacts) {
    try {
      const loaded = secureArtifact(repository, entry, { extraPaths: [entry.path] });
      declaredOutputs.push(digest(loaded.bytes));
    } catch (error) { reasons.push(error.message); }
  }
  if (!sameJson([...declaredOutputs].sort(), [...launcherOutputs].sort())) reasons.push("declared output artifacts do not exactly match launcher reviewer_run outputs");
  if (evidence.deletion_bearing === true) {
    if (!Array.isArray(evidence.parse_collect_evidence) || evidence.parse_collect_evidence.length === 0) reasons.push("deletion-bearing review requires hash-bound parse/collect evidence");
    else for (const entry of evidence.parse_collect_evidence) try { secureArtifact(repository, entry, { externalOnly: false }); } catch (error) { reasons.push(error.message); }
  }
  return reasons;
}
