#!/usr/bin/env node
/**
 * v5 transmutation seal. Bootstrap v4 issuance is owned by receipt-issuance-epoch.
 */
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import * as planManifest from "./plan-manifest-contract.mjs";
import * as reviewerEvidence from "./reviewer-evidence.mjs";
import { putObject } from "./review-evidence-store.mjs";
import {
  SHA_RE,
  canonicalJson,
  digestRef,
  getByRef,
  objectRef,
  sha256Bytes,
  sha256Utf8,
} from "./two-box-protocol.mjs";

const SEAL_SCHEMA = "transmutation-seal";
const SEAL_VERSION = 1;
const TREE40_RE = /^[0-9a-f]{40}$/;
const EXCLUDED = new Set([
  "timestamp",
  "tree_hash",
  "target_sha",
  "planning_contract.sealed",
  "planning_contract.sealed_at",
  "planning_contract.semantic_contract_sha256",
]);
const ENVELOPE_KEYS = "artifact,body,candidate,evidence_class,manifest,review_ref,schema,sealed_at,semantic,version,wi";

function isPlain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exported(mod, name) {
  const fn = mod[name];
  if (typeof fn !== "function") throw new Error(`${name} is required`);
  return fn;
}

function exactPath(value) {
  return typeof value === "string" && value.trim().length > 0 && !path.posix.isAbsolute(value)
    && !value.includes("\\") && !value.includes("\0") && !/[\n\r*?\[\]]/.test(value)
    && value.split("/").every((part) => part && part !== "." && part !== "..");
}

function rejectCallerFlags(value) {
  if (!isPlain(value)) return;
  for (const key of ["verified", "historical", "eligible", "executable", "reviewPass", "effective"]) {
    if (value[key] === true) throw new Error(`unsigned supplied ${key} is not authority`);
  }
}

function omitExcluded(value, trail = "") {
  if (Array.isArray(value)) return value.map((item) => omitExcluded(item, trail));
  if (!isPlain(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) {
    const next = trail ? `${trail}.${key}` : key;
    if (EXCLUDED.has(next)) continue;
    out[key] = omitExcluded(value[key], next);
  }
  return out;
}

function assertObjectRef(ref, label) {
  if (!isPlain(ref) || ref.type !== "object") throw new Error(`${label} must be ObjectRef`);
  if (Object.keys(ref).sort().join(",") !== "sha256,type") throw new Error(`${label} is strict (only type, sha256)`);
  return objectRef(ref.sha256);
}

function assertDigestRef(ref, label, of) {
  if (!isPlain(ref) || ref.type !== "digest") throw new Error(`${label} must be DigestRef`);
  if (Object.keys(ref).sort().join(",") !== "of,sha256,type") throw new Error(`${label} is strict (only type, sha256, of)`);
  if (of && ref.of !== of) throw new Error(`${label}.of must be ${of}`);
  return digestRef(ref.sha256, of || ref.of);
}

function assertStored(value, label, of) {
  if (!isPlain(value) || Object.keys(value).sort().join(",") !== "digest,ref") {
    throw new Error(`${label} must be {ref,digest}`);
  }
  assertObjectRef(value.ref, `${label}.ref`);
  assertDigestRef(value.digest, `${label}.digest`, of);
  if (value.ref.sha256 !== value.digest.sha256) throw new Error(`${label} ref/digest mismatch`);
}

function storedPair(sha256, of) {
  return { ref: objectRef(sha256), digest: digestRef(sha256, of) };
}

function asBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (isPlain(value) && value.bytes != null) return asBytes(value.bytes);
  throw new Error("parsePlanBytes must expose exact JSON bytes");
}

function assertV5Schema(body) {
  const result = exported(planManifest, "validatePlanSchema")(body);
  if (Array.isArray(result) && result.length) throw new Error(`v5 schema invalid: ${result.join("; ")}`);
  if (result && Object.prototype.hasOwnProperty.call(result, "ok") && !result.ok) {
    throw new Error(`v5 schema invalid: ${(result.errors || []).join("; ")}`);
  }
  if (body.schema_version !== 5) throw new Error("semantic digest requires schema_version 5");
}

function readContainedBytes(root, relative) {
  if (!exactPath(relative)) throw new Error(`invalid repo-relative path: ${relative}`);
  const canonical = fs.realpathSync(root);
  const lexical = path.join(canonical, relative);
  let cursor = canonical;
  for (const part of relative.split("/")) { cursor = path.join(cursor, part); if(fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`symlink ancestor rejected: ${relative}`); }
  const st = fs.lstatSync(lexical);
  if (st.isSymbolicLink()) throw new Error(`refusing symlink: ${relative}`);
  const actual = fs.realpathSync(lexical);
  if (!actual.startsWith(canonical + path.sep)) throw new Error(`path escapes source root: ${relative}`);
  if (!fs.statSync(actual).isFile()) throw new Error(`not a regular source file: ${relative}`);
  return fs.readFileSync(actual);
}

function loadReviewReceipt(consumerRoot, reviewReceiptRef) {
  const ref = assertObjectRef(reviewReceiptRef, "reviewReceiptRef");
  const got = getByRef(ref, { start: consumerRoot });
  if (sha256Bytes(got.bytes) !== ref.sha256) throw new Error("review receipt object tampered");
  const body = JSON.parse(got.bytes.toString("utf8"));
  if (!isPlain(body)) throw new Error("review receipt must be a JSON object");
  rejectCallerFlags(body);
  return { ref, sha256: ref.sha256, bytes: got.bytes, body };
}

function loadLauncher(consumerRoot, reviewBody) {
  const entries = reviewBody?.reviewer_evidence?.launcher_receipts;
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("review receipt requires launcher receipts");
  const entry = entries[entries.length - 1];
  const got = getByRef(objectRef(entry.sha256), { start: consumerRoot });
  const receipt = JSON.parse(got.bytes.toString("utf8"));
  if (!isPlain(receipt)) throw new Error("launcher receipt must be a JSON object");
  return receipt;
}

function packageFiles(launcher) {
  const files = launcher?.package_context?.files;
  if (!Array.isArray(files)) throw new Error("canonical signed launcher uses package_context.files");
  return files;
}

function requireDigestInPackage(files, digest, label) {
  if (!files.some((entry) => entry?.sha256 === digest)) {
    throw new Error(`${label} is not in signed package_context.files`);
  }
}

function requirePathInPackage(files, relative, digest, label) {
  const labels = [`source:${relative}`, relative];
  const match = files.find((entry) => labels.includes(entry?.path));
  if (!match) throw new Error(`${label} missing from signed package_context.files`);
  if (match.sha256 !== digest) throw new Error(`${label} digest does not match signed package_context.files`);
}

export function verifyCandidatePackageBinding(review, files) {
  const digest = review.candidate_digest;
  if (!SHA_RE.test(String(digest || ""))) throw new Error("review receipt requires a 64-hex candidate_digest");
  const tree = review.tree_hash;
  if (!TREE40_RE.test(String(tree || ""))) throw new Error("review requires exact Git tree_hash");
  if (tree != null && String(tree).length) {
    if (!TREE40_RE.test(String(tree))) throw new Error("review tree_hash must be Git 40-hex");
    if (sha256Utf8(`git-tree:${tree}\n`) !== digest) {
      throw new Error("review candidate_digest does not bind signed tree_hash");
    }
  }
  const matches = files.filter(entry => entry?.path === "candidate:git-tree");
  const bytes = Buffer.from(JSON.stringify({tree_hash: tree, candidate_digest: digest}) + "\n");
  if (matches.length !== 1 || matches[0].sha256 !== sha256Bytes(bytes) || matches[0].bytes !== bytes.length) {
    throw new Error("review candidate tree missing or mismatched in signed package_context.files");
  }
  return digest;
}

function readCandidateBytes(root, candidateSha, relative) {
  if (!TREE40_RE.test(String(candidateSha || "")) || !exactPath(relative)) throw new Error("resolved commit SHA and contained path required");
  const run = args => execFileSync("git", ["-C", root, ...args], {stdio:["ignore","pipe","pipe"]});
  if (run(["rev-parse", "--verify", `${candidateSha}^{commit}`]).toString().trim() !== candidateSha) throw new Error("candidate must be a resolved commit");
  const row = run(["ls-tree", candidateSha, "--", relative]).toString().trim();
  if (!/^100(?:644|755) blob [0-9a-f]{40}\t/.test(row)) throw new Error(`candidate path must be a regular file: ${relative}`);
  return run(["show", `${candidateSha}:${relative}`]);
}

function parseEnvelope(bytes) {
  const envelope = JSON.parse(bytes.toString("utf8"));
  if (!isPlain(envelope)) throw new Error("seal envelope must be an object");
  rejectCallerFlags(envelope);
  if (Object.keys(envelope).sort().join(",") !== ENVELOPE_KEYS) {
    throw new Error("seal envelope has unknown or missing fields");
  }
  if (envelope.schema !== SEAL_SCHEMA || envelope.version !== SEAL_VERSION) {
    throw new Error("unsupported transmutation seal schema/version");
  }
  if (envelope.evidence_class !== "LIVE") throw new Error("transmutation seal evidence_class must be LIVE");
  if (typeof envelope.wi !== "string" || !envelope.wi.trim()) throw new Error("seal WI required");
  if (typeof envelope.sealed_at !== "string" || !Number.isFinite(Date.parse(envelope.sealed_at))) {
    throw new Error("seal sealed_at must be an ISO timestamp");
  }
  assertDigestRef(envelope.semantic, "semantic", "bytes");
  assertStored(envelope.body, "body", "bytes");
  assertStored(envelope.artifact, "artifact", "file");
  assertStored(envelope.manifest, "manifest", "file");
  assertObjectRef(envelope.review_ref, "review_ref");
  assertDigestRef(envelope.candidate, "candidate", "tree");
  return envelope;
}

function bindTransmutation(args) {
  rejectCallerFlags(args);
  const { consumerRoot, body, planBytes, manifestPath, reviewReceiptRef, candidateSha, committedManifestBytes } = args || {};
  if (typeof consumerRoot !== "string" || !consumerRoot) throw new Error("consumerRoot required");
  if (!isPlain(body)) throw new Error("plan body must be an object");
  rejectCallerFlags(body);
  if (!exactPath(manifestPath)) throw new Error("manifestPath must be a contained consumer-relative Markdown path");
  if (!Buffer.isBuffer(planBytes) || planBytes.length === 0) {
    throw new Error("planBytes must be the exact prepared Buffer JSON");
  }
  assertV5Schema(body);
  const parsed = JSON.parse(planBytes.toString("utf8"));
  if (!isPlain(parsed) || canonicalJson(parsed) !== canonicalJson(body)) {
    throw new Error("prepared JSON does not parse to the exact prepared body");
  }
  const read = candidateSha
    ? relative => readCandidateBytes(consumerRoot, candidateSha, relative).toString("utf8")
    : exported(planManifest, "containedReader")(consumerRoot);
  const completeness = exported(planManifest, "validatePlanBody")(body, { readSpec: read, readFile: read });
  if (!completeness?.ok) throw new Error((completeness?.errors || ["plan body invalid"]).join("; "));
  const semantic = semanticContractDigest(body);
  const artifactSha = sha256Bytes(planBytes);
  // Plans may live in the evidence store instead of the committed product tree.
  // Replay uses the seal's exact stored manifest; spec/context still come from
  // the explicit target commit. The signed package verifies its path and hash.
  const manifestBytes = candidateSha ? committedManifestBytes : readContainedBytes(consumerRoot, manifestPath);
  if (!Buffer.isBuffer(manifestBytes)) throw new Error("exact stored manifest bytes required");
  const manifestSha = sha256Bytes(manifestBytes);
  const extracted = asBytes(exported(planManifest, "parsePlanBytes")(manifestBytes.toString("utf8")));
  if (!extracted.equals(planBytes)) throw new Error("manifest SVC_PLAN_BODY bytes do not match prepared planBytes");
  const review = loadReviewReceipt(consumerRoot, reviewReceiptRef);
  const reasons = exported(reviewerEvidence, "verifyReviewerEvidence")({
    root: consumerRoot,
    reviewKind: "plan",
    body: review.body,
  });
  if (!Array.isArray(reasons)) throw new Error("verifyReviewerEvidence must return a reasons array");
  if (reasons.length) throw new Error(`reviewer evidence failed: ${reasons.join("; ")}`);
  if (review.body.receipt_type !== "review-plan") throw new Error("seal requires receipt_type review-plan");
  if (review.body.wi !== body.wi) throw new Error("review receipt WI does not match plan body");
  if (!["pass","pass-with-acks","pass-with-findings"].includes(review.body.verdict)) throw new Error("review verdict is not passing");
  if (review.body.reviewed_plan_digest !== artifactSha) {
    throw new Error("reviewed_plan_digest does not match prepared artifact bytes");
  }
  const launcher = loadLauncher(consumerRoot, review.body);
  if (launcher.review_kind !== "plan") throw new Error("launcher review_kind must be plan");
  if (launcher.candidate_digest !== artifactSha) {
    throw new Error("launcher candidate_digest does not match prepared artifact bytes");
  }
  if (launcher.phase_guard?.kind != null && launcher.phase_guard.kind !== "plan") {
    throw new Error("launcher phase is not plan");
  }
  if (launcher.phase_guard?.wi != null && launcher.phase_guard.wi !== body.wi) {
    throw new Error("launcher phase WI does not match plan body");
  }
  if (launcher.phase_guard?.plan_manifest_sha256 != null && launcher.phase_guard.plan_manifest_sha256 !== artifactSha) {
    throw new Error("launcher phase plan digest does not match prepared artifact bytes");
  }
  const files = packageFiles(launcher);
  requireDigestInPackage(files, artifactSha, "prepared plan artifact");
  requirePathInPackage(files, manifestPath, manifestSha, "full markdown manifest");
  const candidate = verifyCandidatePackageBinding(review.body, files);
  return {
    wi: body.wi,
    semantic,
    artifactSha,
    artifact: planBytes,
    manifestSha,
    manifestBytes,
    review,
    candidate,
  };
}

export function semanticContractDigest(body) {
  if (!isPlain(body)) throw new Error("plan body must be an object");
  assertV5Schema(body);
  return sha256Utf8(canonicalJson(omitExcluded(body)));
}

export function createTransmutationSeal(args) {
  if (args?.candidateSha != null) throw new Error("fresh seal creation cannot select a historical candidate");
  const bound = bindTransmutation(args);
  const opts = { start: args.consumerRoot };
  const artifactPut = putObject(bound.artifact, opts);
  if (artifactPut.sha256 !== bound.artifactSha) throw new Error("artifact CAS digest mismatch");
  const manifestPut = putObject(bound.manifestBytes, opts);
  if (manifestPut.sha256 !== bound.manifestSha) throw new Error("manifest CAS digest mismatch");
  const envelope = {
    schema: SEAL_SCHEMA,
    version: SEAL_VERSION,
    evidence_class: "LIVE",
    wi: bound.wi,
    semantic: digestRef(bound.semantic, "bytes"),
    body: storedPair(artifactPut.sha256, "bytes"),
    artifact: storedPair(artifactPut.sha256, "file"),
    manifest: storedPair(manifestPut.sha256, "file"),
    review_ref: objectRef(bound.review.sha256),
    candidate: digestRef(bound.candidate, "tree"),
    sealed_at: new Date().toISOString(),
  };
  if (Object.keys(envelope).sort().join(",") !== ENVELOPE_KEYS) throw new Error("internal seal envelope key set");
  const stored = putObject(Buffer.from(`${canonicalJson(envelope)}\n`, "utf8"), opts);
  return objectRef(stored.sha256);
}

export function verifyTransmutationSeal(args) {
  rejectCallerFlags(args);
  const { consumerRoot, body, planBytes, manifestPath, sealRef, candidateSha } = args || {};
  const ref = assertObjectRef(sealRef, "sealRef");
  const got = getByRef(ref, { start: consumerRoot });
  if (sha256Bytes(got.bytes) !== ref.sha256) throw new Error("seal object tampered");
  const envelope = parseEnvelope(got.bytes);
  const bound = bindTransmutation({
    consumerRoot,
    body,
    planBytes,
    manifestPath,
    reviewReceiptRef: envelope.review_ref,
    candidateSha,
    committedManifestBytes: candidateSha ? getByRef(envelope.manifest.ref, {start:consumerRoot}).bytes : undefined,
  });
  if (envelope.wi !== bound.wi) throw new Error("seal WI mismatch");
  if (envelope.semantic.sha256 !== bound.semantic) throw new Error("seal semantic digest mismatch");
  if (envelope.body.digest.sha256 !== bound.artifactSha) throw new Error("seal body digest mismatch");
  if (envelope.artifact.digest.sha256 !== bound.artifactSha) throw new Error("seal artifact digest mismatch");
  if (envelope.manifest.digest.sha256 !== bound.manifestSha) throw new Error("seal manifest digest mismatch");
  if (envelope.review_ref.sha256 !== bound.review.sha256) throw new Error("seal review_ref mismatch");
  if (envelope.candidate.sha256 !== bound.candidate) throw new Error("seal candidate mismatch");
  const bodyObj = getByRef(envelope.body.ref, { start: consumerRoot });
  if (!bodyObj.bytes.equals(bound.artifact)) throw new Error("stored body bytes disagree");
  const artifactObj = getByRef(envelope.artifact.ref, { start: consumerRoot });
  if (!artifactObj.bytes.equals(bound.artifact)) throw new Error("stored artifact bytes disagree");
  const manifestObj = getByRef(envelope.manifest.ref, { start: consumerRoot });
  if (!manifestObj.bytes.equals(bound.manifestBytes)) throw new Error("stored manifest bytes disagree");
  return envelope;
}
