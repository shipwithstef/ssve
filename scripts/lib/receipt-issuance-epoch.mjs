#!/usr/bin/env node
import crypto from "node:crypto";
import {readJsonAtomic,writeJsonAtomic} from "../state-io.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { getObject, putObject, repositoryIdentity } from "./review-evidence-store.mjs";
import { verifyReviewerEvidence } from "./reviewer-evidence.mjs";
import { evaluateEligibility, getByRef, SHA_RE, canonicalJson, eligibilityDecisionDigest, evaluateCommittedEligibility } from "./two-box-protocol.mjs";
import { containedReader, validatePlanBody } from "./plan-manifest-contract.mjs";
import { validateEvidenceSchema } from "./evidence-schema.mjs";
import { acTableSha256 } from "./normalize-ac-table.mjs";
import * as controlPlanValidate from "./control-plan-validate.mjs";
import * as transmutationSeal from "./transmutation-seal.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOTSTRAP_SNAPSHOT_REL = "docs/specs/privacy/v4-bootstrap-snapshot.json";
export const BOOTSTRAP_SNAPSHOT_SHA256 = "e283a25d22cfb65416df2d5d2eca3116bf5cc732e7d11afa28a444cfc122c20c";

const V1_CONTROL_KEYS = [
  "receipt_type",
  "schema_version",
  "wi",
  "blind_model",
  "framework_model",
  "profile",
  "registry_version",
  "floor_verdict",
  "element_ledger",
  "judge",
  "tree_hash",
  "timestamp",
];

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)).digest("hex");
}

function sha256Utf8(text) {
  return sha256Bytes(Buffer.from(String(text), "utf8"));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactPath(value) {
  return typeof value === "string"
    && value.trim().length > 0
    && !path.posix.isAbsolute(value)
    && !value.includes("\\")
    && !value.includes("\0")
    && !/[\n\r*?\[\]]/.test(value)
    && value.split("/").every((part) => part && part !== "." && part !== "..");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isObjectRef(ref) {
  return isPlainObject(ref)
    && ref.type === "object"
    && SHA_RE.test(String(ref.sha256 || ""))
    && Object.keys(ref).sort().join(",") === "sha256,type";
}

function isTreeDigestRef(ref) {
  return isPlainObject(ref)
    && ref.type === "digest"
    && ref.of === "tree"
    && SHA_RE.test(String(ref.sha256 || ""));
}

function asPlanBytes(planBytes) {
  if (Buffer.isBuffer(planBytes)) return planBytes;
  if (planBytes instanceof Uint8Array) return Buffer.from(planBytes);
  throw new Error("planBytes must be the exact prepared JSON Buffer");
}

function parsePlanBytes(planBytes) {
  const buf = asPlanBytes(planBytes);
  let parsed;
  try {
    parsed = JSON.parse(buf.toString("utf8"));
  } catch {
    throw new Error("planBytes must be exact JSON");
  }
  if (!isPlainObject(parsed)) throw new Error("plan body must be an object");
  return { buf, parsed };
}

function requireConsumerRoot(consumerRoot) {
  if (!consumerRoot) throw new Error("consumerRoot required");
  return fs.realpathSync(path.resolve(consumerRoot));
}

function gitTrim(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`git ${args.join(" ")} failed closed: ${detail}`);
  }
}

function loadReceiptSchema(receiptType) {
  const schemaPath = path.join(PACKAGE_ROOT, "schemas", "receipts", `${receiptType}.schema.json`);
  const stat = fs.lstatSync(schemaPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`schema unavailable: ${receiptType}`);
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

function readTrustedSnapshot() {
  const lexical = path.resolve(PACKAGE_ROOT, BOOTSTRAP_SNAPSHOT_REL);
  const rel = path.relative(PACKAGE_ROOT, lexical);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("bootstrap snapshot path escapes package");
  const stat = fs.lstatSync(lexical);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("bootstrap snapshot is not a regular trusted file");
  const bytes = fs.readFileSync(lexical);
  if (sha256Bytes(bytes) !== BOOTSTRAP_SNAPSHOT_SHA256) {
    throw new Error("bootstrap snapshot digest mismatch");
  }
  const snapshot = JSON.parse(bytes.toString("utf8"));
  if (!isPlainObject(snapshot) || snapshot.schema_version !== 1) {
    throw new Error("bootstrap snapshot schema invalid");
  }
  return snapshot;
}

function readContainedBytes(root, rel) {
  const canonical = fs.realpathSync(root);
  if (!exactPath(rel)) throw new Error(`invalid repo-relative path: ${rel}`);
  const joined = path.join(canonical, rel);
  let ancestor = canonical;
  for (const segment of rel.split("/")) { ancestor = path.join(ancestor, segment); if (fs.lstatSync(ancestor).isSymbolicLink()) throw new Error(`refusing symlink ancestor: ${rel}`); }
  const listed = fs.lstatSync(joined);
  if (listed.isSymbolicLink()) throw new Error(`refusing symlink: ${rel}`);
  const actual = fs.realpathSync(joined);
  if (actual !== joined && !actual.startsWith(canonical + path.sep)) {
    throw new Error(`path escapes source root: ${rel}`);
  }
  if (!fs.statSync(actual).isFile()) throw new Error(`not a regular source file: ${rel}`);
  return fs.readFileSync(actual);
}

function readCommitUtf8(cwd, commitSha, rel) {
  if (!exactPath(rel)) throw new Error(`invalid repo-relative path: ${rel}`);
  const listing = gitTrim(cwd, ["ls-tree", commitSha, "--", rel]);
  if (!listing) throw new Error(`missing from commit tree: ${rel}`);
  const line = listing.split("\n")[0];
  if (!/^100(?:644|755) blob [0-9a-f]{40}\t/.test(line)) {
    throw new Error(`commit tree path is not a regular file: ${rel}`);
  }
  return execFileSync("git", ["-C", cwd, "show", `${commitSha}:${rel}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

function casObject(ref, consumer, expectedSha = null) {
  if (!isObjectRef(ref)) throw new Error("snapshot ObjectRef required");
  const loaded = getByRef(ref, { start: consumer });
  if (expectedSha && loaded.sha256 !== expectedSha) throw new Error("CAS digest mismatch");
  return loaded;
}

function requireControlOk(result) {
  if (result?.ok !== true) {
    const errors = Array.isArray(result?.errors) ? result.errors : [];
    throw new Error((errors.length !== 0 ? errors : ["control-plan validation failed"]).join("; "));
  }
  if (Array.isArray(result.errors) && result.errors.length !== 0) {
    throw new Error(result.errors.join("; "));
  }
}

function requireLocalPlan(body, readers) {
  const result = validatePlanBody(body, readers);
  if (result?.ok !== true) {
    const errors = Array.isArray(result?.errors) ? result.errors : [];
    throw new Error((errors.length !== 0 ? errors : ["validatePlanBody failed"]).join("; "));
  }
  if (Array.isArray(result.errors) && result.errors.length !== 0) {
    throw new Error(result.errors.join("; "));
  }
}

function originalRequirementIds(ref, consumer) {
  const { bytes } = getByRef(ref, { start: consumer });
  try {
    const data = JSON.parse(bytes.toString("utf8"));
    const rows = Array.isArray(data) ? data : Array.isArray(data?.requirements) ? data.requirements : null;
    if (!rows) return null;
    const ids = rows.map((row) => (typeof row === "string" ? row : row?.id)).filter((id) => typeof id === "string" && id.length > 0);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

function assertChosenCoverage(body, control, requiredIds) {
  const selected = control.chosen_solution?.selected_decisions;
  if (!Array.isArray(selected) || selected.length === 0) throw new Error("control-plan has no selected decisions");
  const sourceIds = new Set();
  const selectedReqs = new Set();
  for (const row of selected) {
    if (typeof row.original_requirement_id === "string" && row.original_requirement_id) selectedReqs.add(row.original_requirement_id);
    for (const id of Array.isArray(row.source_ids) ? row.source_ids : []) sourceIds.add(id);
  }
  const approaches = body.implementation_approach;
  if (!Array.isArray(approaches) || approaches.length === 0) throw new Error("implementation_approach required");
  const coveredReqs = new Set();
  for (const approach of approaches) {
    if (!Array.isArray(approach.source_ids) || approach.source_ids.length === 0) {
      throw new Error(`approach ${approach.id} missing source_ids`);
    }
    for (const sourceId of approach.source_ids) {
      if (!sourceIds.has(sourceId)) throw new Error(`approach ${approach.id} source_id ${sourceId} is not assessor-selected`);
      if (!selected.some(row=>approach.requirement_ids.includes(row.original_requirement_id) && row.source_ids.includes(sourceId))) throw new Error(`approach ${approach.id} source does not belong to its selected requirement`);
    }
    if (!Array.isArray(approach.requirement_ids) || approach.requirement_ids.length === 0) {
      throw new Error(`approach ${approach.id} missing requirement_ids`);
    }
    for (const requirementId of approach.requirement_ids) {
      coveredReqs.add(requirementId);
      if(!selected.some(row=>row.original_requirement_id===requirementId && row.source_ids.some(id=>approach.source_ids.includes(id)))) throw new Error(`approach ${approach.id} lacks the chosen source for ${requirementId}`);
    }
  }
  if (!requiredIds?.length) throw new Error("original requirement IDs required");
  const needed = requiredIds;
  if ([...coveredReqs].some(id=>!needed.includes(id)) || [...selectedReqs].some(id=>!needed.includes(id))) throw new Error("unknown requirement in selected approach");
  for (const requirementId of needed) {
    if (!selectedReqs.has(requirementId) || !coveredReqs.has(requirementId)) {
      throw new Error(`requirement ${requirementId} is not bound to a chosen source and approach`);
    }
  }
}

function assertCompleteLiveControl(control) {
  if (!isPlainObject(control) || control.receipt_type !== "control-plan") throw new Error("control-plan body required");
  if (control.schema_version !== 2) throw new Error("current control-plan issuance requires schema_version 2");
  if (Object.hasOwn(control, "draft") || Object.hasOwn(control, "draft_for") || Object.hasOwn(control, "issuance")) {
    throw new Error("current issuance requires complete LIVE control-plan v2");
  }
  if (Object.hasOwn(control, "floor_verdict")) throw new Error("control-plan v2 forbids floor_verdict");
  if (control.evidence_class !== "LIVE") throw new Error("current issuer/executor rejects OFFLINE and draft control-plan");
}

function verifySeal({ consumerRoot, body, planBytes, manifestPath, sealRef, candidateSha }) {
  if (!isObjectRef(sealRef)) throw new Error("sealRef must be an ObjectRef");
  const result = transmutationSeal.verifyTransmutationSeal({
    consumerRoot,
    body,
    planBytes,
    manifestPath,
    sealRef,
    candidateSha,
  });
  if (!result || (Array.isArray(result) && result.length !== 0) || result.ok === false || result.verified === false) throw new Error("transmutation seal verification failed");
  return result;
}

function assertBootstrap({ consumer, body, planBytes, manifestPath }) {
  const snapshot = readTrustedSnapshot();
  const { buf, parsed } = parsePlanBytes(planBytes);
  if (!sameJson(parsed, body)) throw new Error("planBytes do not parse to the supplied body");
  if (body.receipt_type !== "plan-manifest" || body.schema_version !== 4 || body.mode !== "inline") {
    throw new Error("bootstrap requires the exact reviewed v4 inline plan body");
  }
  if (body.wi !== snapshot.wi) throw new Error("bootstrap WI mismatch");
  const identity = repositoryIdentity(consumer);
  const publicRoot = snapshot.public_root;
  const roots = gitTrim(identity.checkout, ["rev-list", "--max-parents=0", "HEAD"]).split("\n").filter(Boolean);
  if (!roots.includes(publicRoot)) throw new Error("consumer public root does not match bootstrap snapshot");
  const repositoryId = sha256Utf8(`${identity.gitCommonDir}\n${publicRoot}\n`);
  if (repositoryId !== snapshot.consumer_repository_id) throw new Error("consumer repository identity mismatch");
  if (sha256Bytes(buf) !== snapshot.plan_body_sha256) throw new Error("planBytes do not match frozen plan body digest");
  const reviewedPlan = casObject(snapshot.reviewed_plan, consumer, snapshot.plan_body_sha256);
  if (Buffer.compare(reviewedPlan.bytes, buf) !== 0) throw new Error("planBytes do not match frozen reviewed plan object");
  if (!exactPath(manifestPath)) throw new Error("manifestPath required");
  const manifestBytes = readContainedBytes(consumer, manifestPath);
  if (sha256Bytes(manifestBytes) !== snapshot.manifest_sha256) throw new Error("manifest digest mismatch");
  casObject(snapshot.reviewed_manifest, consumer, snapshot.manifest_sha256);
  casObject(snapshot.companion_contract, consumer, snapshot.plan_contract_sha256);
  if (sha256Bytes(readContainedBytes(consumer, path.posix.join(path.posix.dirname(manifestPath),"plan-contract.json"))) !== snapshot.plan_contract_sha256) throw new Error("current companion contract differs from frozen bytes");
  requireLocalPlan(body, {readSpec: p=>readContainedBytes(consumer,p).toString("utf8"),readFile:p=>readContainedBytes(consumer,p).toString("utf8")});
  casObject(snapshot.freeze_producer, consumer);
  if (!Array.isArray(snapshot.reviewer_launcher_receipts) || snapshot.reviewer_launcher_receipts.length === 0) {
    throw new Error("bootstrap snapshot missing launcher refs");
  }
  for (const ref of snapshot.reviewer_launcher_receipts) casObject(ref, consumer);
  if (!Array.isArray(snapshot.immutable_context) || snapshot.immutable_context.length === 0) {
    throw new Error("bootstrap snapshot missing immutable context");
  }
  for (const ref of snapshot.immutable_context) {
    const text = readContainedBytes(consumer, ref.path).toString("utf8");
    const lines = text.split("\n");
    if (!Number.isInteger(ref.start_line) || !Number.isInteger(ref.end_line) || ref.start_line < 1 || ref.end_line < ref.start_line) {
      throw new Error(`invalid bootstrap context range: ${ref.path}`);
    }
    if (ref.end_line > lines.length) throw new Error(`stale bootstrap context range: ${ref.path}`);
    const excerpt = lines.slice(ref.start_line - 1, ref.end_line).join("\n");
    if (sha256Utf8(excerpt) !== ref.excerpt_sha256) throw new Error(`stale bootstrap context hash: ${ref.path}`);
  }
  if (!isPlainObject(body.ac_digests) || body.ac_digests.spec_ac_table_sha256 !== snapshot.spec_ac_table_sha256) {
    throw new Error("body AC digest does not match snapshot");
  }
  const spec = readContainedBytes(consumer, body.ac_digests.spec_path).toString("utf8");
  if (acTableSha256(spec) !== snapshot.spec_ac_table_sha256) throw new Error("bootstrap AC table mismatch");
  const reviewObj = casObject(snapshot.review_plan_receipt, consumer);
  const review = JSON.parse(reviewObj.bytes.toString("utf8"));
  if (review.receipt_type !== "review-plan" || review.wi !== snapshot.wi) throw new Error("bootstrap review receipt identity mismatch");
  if (!["pass", "pass-with-acks"].includes(review.verdict)) throw new Error("bootstrap review is not passing");
  if (review.reviewed_plan_digest !== snapshot.plan_body_sha256) throw new Error("bootstrap review plan digest mismatch");
  const reasons = verifyReviewerEvidence({ root: consumer, reviewKind: "plan", body: review });
  if (!Array.isArray(reasons) || reasons.length !== 0) {
    throw new Error(`bootstrap review evidence failed: ${reasons.join("; ")}`);
  }
  return {
    kind: "bootstrap_v4",
    wi: body.wi,
    schema_version: 4,
    mode: "inline",
    consumer_repository_id: repositoryId,
    public_root: publicRoot,
    plan_body_sha256: snapshot.plan_body_sha256,
    manifest_sha256: snapshot.manifest_sha256,
  };
}

function assertLightweight({ consumer, body, planBytes, manifestPath, sealRef, candidateSha }) {
  const contract = body.planning_contract;
  if (contract.control_plan_ref != null || contract.source_snapshot_ref != null) {
    throw new Error("lightweight forbids two_box control fields");
  }
  if (!isObjectRef(contract.original_requirements_ref)) throw new Error("lightweight original_requirements_ref required");
  if (!isObjectRef(contract.eligibility_ref)) throw new Error("lightweight eligibility_ref required");
  if (!isTreeDigestRef(contract.eligibility_tree)) throw new Error("lightweight eligibility_tree required");
  getByRef(contract.original_requirements_ref, { start: consumer });
  const saved = getByRef(contract.eligibility_ref, { start: consumer });
  let savedBody;
  try {
    savedBody = JSON.parse(saved.bytes.toString("utf8"));
  } catch {
    throw new Error("eligibility artifact is not JSON");
  }
  if (!isPlainObject(savedBody)) throw new Error("eligibility artifact is not a JSON object");
  // Authenticate before treating any committed candidate as replay evidence.
  const seal = candidateSha ? verifySeal({consumerRoot:consumer,body,planBytes,manifestPath,sealRef,candidateSha}) : null;
  const recomputed = candidateSha ? evaluateCommittedEligibility({consumerRoot:consumer,candidateSha}) : evaluateEligibility({ consumerRoot: consumer, start: consumer });
  if (seal && seal.candidate.sha256 !== recomputed.staged_tree.sha256) throw new Error("sealed candidate differs from committed eligibility tree");
  const savedRaw = JSON.parse(getByRef(savedBody.eligibility_output,{start:consumer}).bytes.toString("utf8"));
  if (savedRaw.wi != null && savedRaw.wi !== body.wi) throw new Error("saved eligibility WI mismatch");
  if (recomputed.staged_tree.sha256 !== contract.eligibility_tree.sha256) {
    throw new Error("eligibility tree digest does not match current staged index");
  }
  if (recomputed.eligible !== true) throw new Error("recomputed eligibility is not eligible");
  if (savedBody.evidence_class !== "LIVE" || savedBody.eligible !== true || savedBody.staged_tree?.sha256 !== recomputed.staged_tree.sha256 || eligibilityDecisionDigest(savedBody,{consumerRoot:consumer}) !== eligibilityDecisionDigest(recomputed,{consumerRoot:consumer})) throw new Error("saved eligibility differs from current staged evidence");
  if(canonicalJson([...new Set(body.scope.included)].sort()) !== canonicalJson([...new Set(recomputed.files)].sort())) throw new Error("lightweight plan scope differs from classified staged files");
  const requirements = originalRequirementIds(contract.original_requirements_ref,consumer);
  if (!requirements?.length) throw new Error("original requirement IDs required");
  const covered = new Set(body.implementation_approach.flatMap(a=>a.requirement_ids));
  if (requirements.some(id=>!covered.has(id)) || [...covered].some(id=>!requirements.includes(id))) throw new Error("lightweight approach must cover exact original requirements");
  if (!seal) verifySeal({ consumerRoot: consumer, body, planBytes, manifestPath, sealRef });
  return {
    kind: "v5_lightweight",
    wi: body.wi,
    schema_version: 5,
    mode: body.mode,
    planning_kind: "lightweight",
    eligibility_ref: contract.eligibility_ref,
    eligibility_tree: contract.eligibility_tree,
    sealRef,
  };
}

function assertTwoBox({ consumer, body, planBytes, manifestPath, sealRef }) {
  const contract = body.planning_contract;
  if (contract.eligibility_ref != null || contract.eligibility_tree != null) {
    throw new Error("two_box forbids lightweight eligibility fields");
  }
  if (!isObjectRef(contract.original_requirements_ref) || !isObjectRef(contract.source_snapshot_ref) || !isObjectRef(contract.control_plan_ref)) {
    throw new Error("two_box requires original_requirements_ref, source_snapshot_ref and control_plan_ref");
  }
  const control = JSON.parse(getByRef(contract.control_plan_ref, { start: consumer }).bytes.toString("utf8"));
  assertCompleteLiveControl(control);
  if (control.wi !== body.wi) throw new Error("control-plan WI does not match plan body");
  if (!isObjectRef(control.original_requirements_ref) || control.original_requirements_ref.sha256 !== contract.original_requirements_ref.sha256) {
    throw new Error("original_requirements_ref does not match control-plan");
  }
  if (!isObjectRef(control.source_snapshot_ref) || control.source_snapshot_ref.sha256 !== contract.source_snapshot_ref.sha256) {
    throw new Error("source_snapshot_ref does not match control-plan");
  }
  requireControlOk(controlPlanValidate.validateControlPlan({
    consumerRoot: consumer,
    body: control,
    requirementsRef: contract.original_requirements_ref,
    sourceSnapshotRef: contract.source_snapshot_ref,
    specBindings: {
      wi: body.wi,
      spec_path: body.ac_digests?.spec_path,
      spec_ac_table_sha256: body.ac_digests?.spec_ac_table_sha256,
    },
  }));
  const requiredIds = originalRequirementIds(contract.original_requirements_ref, consumer);
  assertChosenCoverage(body, control, requiredIds);
  verifySeal({ consumerRoot: consumer, body, planBytes, manifestPath, sealRef });
  return {
    kind: "v5_two_box",
    wi: body.wi,
    schema_version: 5,
    mode: body.mode,
    planning_kind: "two_box",
    control_plan_ref: contract.control_plan_ref,
    original_requirements_ref: contract.original_requirements_ref,
    source_snapshot_ref: contract.source_snapshot_ref,
    sealRef,
  };
}

function assertCurrentPlan({ consumerRoot, body, planBytes, manifestPath, sealRef, candidateSha }) {
  const consumer = requireConsumerRoot(consumerRoot);
  if (!isPlainObject(body) || body.receipt_type !== "plan-manifest") throw new Error("plan-manifest body required");
  if (body.schema_version === 4) return assertBootstrap({ consumer, body, planBytes, manifestPath });
  if (body.schema_version !== 5) throw new Error("current issuance requires plan-manifest schema_version 5");
  if (body.mode !== "inline" && body.mode !== "dispatch") throw new Error("v5 requires explicit inline or dispatch mode");
  const { buf, parsed } = parsePlanBytes(planBytes);
  if (!sameJson(parsed, body)) throw new Error("planBytes do not parse to the supplied body");
  if (!exactPath(manifestPath)) throw new Error("manifestPath required");
  const read = candidateSha ? relative => readCommitUtf8(consumer,candidateSha,relative) : containedReader(consumer);
  requireLocalPlan(body, { readSpec: read, readFile: read });
  const contract = body.planning_contract;
  if (!isPlainObject(contract)) throw new Error("v5 requires planning_contract");
  if (contract.kind === "lightweight") {
    return assertLightweight({ consumer, body, planBytes: buf, manifestPath, sealRef, candidateSha });
  }
  if (contract.kind === "two_box") {
    return assertTwoBox({ consumer, body, planBytes: buf, manifestPath, sealRef });
  }
  throw new Error("planning_contract.kind must be two_box or lightweight");
}

function assertCurrentControl({ consumerRoot, body, planBytes }) {
  const consumer = requireConsumerRoot(consumerRoot);
  if (planBytes != null) {
    const { parsed } = parsePlanBytes(planBytes);
    if (!sameJson(parsed, body)) throw new Error("planBytes do not parse to the supplied body");
  }
  assertCompleteLiveControl(body);
  requireControlOk(controlPlanValidate.validateControlPlan({
    consumerRoot: consumer,
    body,
    requirementsRef: body.original_requirements_ref,
    sourceSnapshotRef: body.source_snapshot_ref,
    specBindings: { wi: body.wi },
  }));
  return {
    kind: "v2_control",
    wi: body.wi,
    schema_version: 2,
    original_requirements_ref: body.original_requirements_ref,
    source_snapshot_ref: body.source_snapshot_ref,
  };
}

export function assertCurrentIssuance({ consumerRoot, receiptType, body, planBytes, manifestPath, sealRef } = {}) {
  if (!isPlainObject(body)) throw new Error("receipt body required");
  const type = receiptType || body.receipt_type;
  if (receiptType && body.receipt_type && receiptType !== body.receipt_type) {
    throw new Error("receiptType does not match body.receipt_type");
  }
  if (type !== "plan-manifest" && type !== "control-plan") {
    return { kind: "unrelated", receiptType: type };
  }
  if (type === "control-plan") return assertCurrentControl({ consumerRoot, body, planBytes });
  return assertCurrentPlan({ consumerRoot, body, planBytes, manifestPath, sealRef });
}

export function assertCurrentExecution({ consumerRoot, body, planBytes, manifestPath, sealRef } = {}) {
  if (!isPlainObject(body) || body.receipt_type !== "plan-manifest") {
    throw new Error("current execution requires a plan-manifest");
  }
  const consumer = requireConsumerRoot(consumerRoot);
  if (body.schema_version === 5 && body.planning_contract?.kind === "lightweight"
      && !gitTrim(consumer,["diff","--cached","--name-only"])) {
    const candidateSha = gitTrim(consumer,["rev-parse","--verify","HEAD^{commit}"]);
    if (gitTrim(consumer,["diff",candidateSha,"--name-only"])) throw new Error("current task checkout differs from committed candidate");
    const verified = assertCommittedPlanEvidence({consumerRoot:consumer,body,planBytes,manifestPath,sealRef,candidateSha});
    return {...verified,executable:true};
  }
  if (body.schema_version === 5 && body.planning_contract?.kind === "lightweight" && gitTrim(consumer,["diff","--name-only"])) throw new Error("current task tracked worktree differs from staged candidate");
  const verified = assertCurrentPlan({ consumerRoot:consumer, body, planBytes, manifestPath, sealRef });
  return { executable: true, ...verified };
}

/** Read-only target verification; never grants mutation authority to a checkout. */
export function assertCommittedPlanEvidence({consumerRoot,body,planBytes,manifestPath,sealRef,candidateSha} = {}) {
  const consumer = requireConsumerRoot(consumerRoot);
  if (!/^[0-9a-f]{40}$/.test(String(candidateSha || "")) || gitTrim(consumer,["rev-parse","--verify",`${candidateSha}^{commit}`]) !== candidateSha) throw new Error("explicit resolved candidate SHA required");
  if (body?.schema_version !== 5 || body.planning_contract?.kind !== "lightweight") throw new Error("committed eligibility replay requires sealed v5 lightweight evidence");
  const verified=assertCurrentPlan({consumerRoot:consumer,body,planBytes,manifestPath,sealRef,candidateSha});
  return {...verified,executable:false,candidate_sha:candidateSha,evidence_kind:"sealed_committed"};
}

function pickReceiptFromEnvelope(envelope, receiptType, wi) {
  if (!isPlainObject(envelope)) throw new Error("receipt envelope is not an object");
  if (envelope.receipt_type === receiptType) {
    if (wi && envelope.wi && envelope.wi !== wi) throw new Error("historical receipt WI mismatch");
    return envelope;
  }
  const matches = [];
  for (const [key, value] of Object.entries(envelope)) {
    if (key === "digests" || !isPlainObject(value)) continue;
    const keyed = key === receiptType || key.startsWith(`slot::${receiptType}::`);
    if (value.receipt_type !== receiptType && !keyed) continue;
    if (wi && value.wi && value.wi !== wi) continue;
    if (wi && key.startsWith("slot::") && !key.includes(`::${wi}::`)) continue;
    // A compatibility alias may duplicate the canonical WI slot byte-for-byte.
    // Distinct slot bodies remain ambiguous and fail closed.
    if (key === receiptType && Object.entries(envelope).some(([otherKey,other]) => otherKey.startsWith(`slot::${receiptType}::`) && isPlainObject(other) && canonicalJson(other)===canonicalJson(value))) continue;
    matches.push(value);
  }
  if (matches.length === 1) return matches[0];
  const narrowed = wi ? matches.filter((row) => row.wi === wi) : matches;
  if (narrowed.length === 1) return narrowed[0];
  if (narrowed.length === 0) throw new Error(`historical ${receiptType} not found`);
  throw new Error(`ambiguous historical ${receiptType} receipts`);
}

function validateHistoricalControl(body) {
  if (!isPlainObject(body) || body.receipt_type !== "control-plan") throw new Error("control-plan body required");
  if (body.schema_version === 1) {
    const schema = loadReceiptSchema("control-plan");
    const errors = [...validateEvidenceSchema(body,schema),...validateEvidenceSchema(body,schema.$defs.v1,schema)];
    for (const key of V1_CONTROL_KEYS) {
      if (!Object.hasOwn(body, key)) errors.push(`missing ${key}`);
    }
    if (errors.length !== 0) throw new Error(errors.join("; "));
    return;
  }
  if (body.schema_version === 2) {
    const schema = loadReceiptSchema("control-plan");
    const errors = [...validateEvidenceSchema(body,schema),...validateEvidenceSchema(body,schema.$defs.v2,schema)];
    if (errors.length) throw new Error(errors.join("; "));
    return;
  }
  throw new Error("unsupported control-plan schema_version");
}

function validateHistoricalPlan(body, cwd, commitSha) {
  if (!isPlainObject(body) || body.receipt_type !== "plan-manifest") throw new Error("plan-manifest body required");
  if (!Number.isInteger(body.schema_version) || body.schema_version < 1) throw new Error("unsupported plan schema_version");
  const readers = {
    readSpec: (rel) => readCommitUtf8(cwd, commitSha, rel),
    readFile: (rel) => readCommitUtf8(cwd, commitSha, rel),
  };
  const result = validatePlanBody(body, readers);
  if (body.schema_version >= 4) {
    if (result?.ok !== true || (Array.isArray(result.errors) && result.errors.length !== 0)) {
      throw new Error((Array.isArray(result?.errors) && result.errors.length !== 0 ? result.errors : ["historical plan invalid"]).join("; "));
    }
    return;
  }
  if (Array.isArray(result?.errors) && result.errors.length !== 0) throw new Error(result.errors.join("; "));
}

function validateHistoricalSchemaOnly(body, receiptType) {
  if (receiptType === "control-plan") {
    validateHistoricalControl(body);
    return;
  }
  if (receiptType === "plan-manifest") {
    if (!isPlainObject(body) || body.receipt_type !== "plan-manifest") throw new Error("plan-manifest body required");
    const errors = validateEvidenceSchema(body, loadReceiptSchema("plan-manifest"));
    if (!Number.isInteger(body.schema_version)) errors.push("schema_version required");
    if (errors.length !== 0) throw new Error(errors.join("; "));
    return;
  }
  const errors = validateEvidenceSchema(body, loadReceiptSchema(receiptType));
  if (errors.length !== 0) throw new Error(errors.join("; "));
}

export function readHistoricalReceipt({ consumerRoot, commitSha, receiptType, wi } = {}) {
  const consumer = requireConsumerRoot(consumerRoot);
  if (!receiptType) throw new Error("receiptType required");
  const cwd = repositoryIdentity(consumer).checkout;
  if (!/^[0-9a-f]{7,40}$/i.test(String(commitSha || ""))) throw new Error("commitSha required");
  if (gitTrim(cwd, ["cat-file", "-t", commitSha]) !== "commit") throw new Error("target commit does not exist");
  const resolvedSha = gitTrim(cwd, ["rev-parse", "--verify", commitSha]);
  const note = gitTrim(cwd, ["notes", "--ref=svc-receipts", "show", resolvedSha]);
  let envelope;
  try {
    envelope = JSON.parse(note);
  } catch {
    throw new Error("historical note is not JSON");
  }
  const receipt = pickReceiptFromEnvelope(envelope, receiptType, wi);
  if (wi && receipt.wi && receipt.wi !== wi) throw new Error("historical receipt WI mismatch");
  if (receiptType === "plan-manifest") validateHistoricalPlan(receipt, cwd, resolvedSha);
  else if (receiptType === "control-plan") validateHistoricalControl(receipt);
  else validateHistoricalSchemaOnly(receipt, receiptType);
  return {
    executable: false,
    kind: "historical",
    receiptType,
    schema_version: receipt.schema_version,
    wi: receipt.wi,
    commitSha: resolvedSha,
    body: receipt,
  };
}

export function validateHistoricalFixture({ body, receiptType, evidence_class } = {}) {
  if (evidence_class !== "OFFLINE") {
    throw new Error("validateHistoricalFixture requires evidence_class OFFLINE and never reads notes");
  }
  if (!isPlainObject(body)) throw new Error("fixture body required");
  const type = receiptType || body.receipt_type;
  if (!type) throw new Error("receiptType required");
  if (body.receipt_type && body.receipt_type !== type) throw new Error("receiptType does not match body.receipt_type");
  validateHistoricalSchemaOnly(body, type);
  return {
    executable: false,
    kind: "fixture",
    evidence_class: "OFFLINE",
    receiptType: type,
    schema_version: body.schema_version,
    wi: body.wi,
    body,
  };
}

// This index only locates evidence. Every consumer recomputes authority afterward.
// It lives with repository-shared CAS so worktree cleanup cannot lose the seal.
function authorityIndexPath(consumerRoot, body) {
  const identity = repositoryIdentity(requireConsumerRoot(consumerRoot));
  const name = sha256Utf8(JSON.stringify(body));
  const parent = path.join(identity.gitCommonDir, 'svc-review-evidence', 'plan-authority');
  let cursor = identity.gitCommonDir;
  for (const part of ['svc-review-evidence','plan-authority']) {
    cursor = path.join(cursor,part);
    if (fs.existsSync(cursor) && (fs.lstatSync(cursor).isSymbolicLink() || !fs.statSync(cursor).isDirectory())) throw new Error('unsafe plan authority index');
  }
  return path.join(parent, `${name}.json`);
}

export function recordPlanAuthority({consumerRoot, body, planBytes, manifestPath, sealRef} = {}) {
  assertCurrentExecution({consumerRoot,body,planBytes,manifestPath,sealRef});
  const stored = putObject(planBytes,{start:consumerRoot});
  const indexPath = authorityIndexPath(consumerRoot,body);
  if (fs.existsSync(indexPath) && fs.lstatSync(indexPath).isSymbolicLink()) throw new Error('unsafe plan authority index');
  const record = {schema_version:1,wi:body.wi,plan_ref:{type:'object',sha256:stored.sha256},manifest_path:manifestPath,seal_ref:sealRef || null};
  writeJsonAtomic(indexPath,record);
  return record;
}

export function loadPlanAuthority({consumerRoot,body} = {}) {
  if (!isPlainObject(body)) throw new Error('plan body required');
  if (body.schema_version === 4) {
    const snapshot=readTrustedSnapshot();
    if(body.wi!==snapshot.wi)throw new Error("legacy body is not the frozen bootstrap WI");
    const bytes=casObject(snapshot.reviewed_plan,consumerRoot,snapshot.plan_body_sha256).bytes;
    if (!sameJson(JSON.parse(bytes),body)) throw new Error('legacy body is not the frozen bootstrap');
    // Snapshot digest and full-manifest digest still supply authority, not this path.
    return {planBytes:bytes,manifestPath:'docs/plans/two-box-transmutation/manifest.md',sealRef:undefined};
  }
  if(body.schema_version!==5)throw new Error("current plan authority requires schema_version 5 or the exact bootstrap v4");
  const indexPath=authorityIndexPath(consumerRoot,body);
  if (fs.lstatSync(indexPath).isSymbolicLink()) throw new Error('unsafe plan authority index');
  const record=readJsonAtomic(indexPath);
  if (!record || record.schema_version!==1 || record.wi!==body.wi || !isObjectRef(record.plan_ref) || !isObjectRef(record.seal_ref) || !exactPath(record.manifest_path)) throw new Error('invalid plan authority locator');
  const bytes=casObject(record.plan_ref,consumerRoot).bytes;
  if (!sameJson(JSON.parse(bytes),body)) throw new Error('located plan bytes differ from receipt');
  return {planBytes:bytes,manifestPath:record.manifest_path,sealRef:record.seal_ref};
}
