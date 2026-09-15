#!/usr/bin/env node
/**
 * Two-Box shared protocol core (types, schemas, hashes, source, eligibility, CAS).
 * Not launching or orchestration.
 *
 * Public API:
 *   SHA_RE, WINNERS, PLANNING_ROLES, ROLE_INHERIT_LABEL, PACKAGE_ROOT, DEFAULT_LIMITS
 *   IsolationUnsupported, UnresolvedConflict, CoverageGap
 *   canonical, canonicalJson, sha256Bytes, sha256Utf8
 *   objectRef, digestRef, getByRef
 *   outputSchemaForCall, validateRoleOutput, normalizeSelection
 *   persistOriginalInputs, buildSourceSnapshot
 *   evaluateEligibility
 *   canonicalSourceHash, canonicalPolicyHash, resumeKey
 *   storeStageEnvelope, getStageEnvelope
 *   draftControlPlanV2
 *
 * ObjectRef {type:"object",sha256} is the only getObject address. DigestRef
 * {type:"digest",sha256,of} is not an object id. all DigestRef.sha256 values are SHA256 64-hex. Raw Git tree ids stay
 * separate and are bound by SHA256("git-tree:<40hex>\\n").
 *
 * json-schema-validator ignores minLength/minItems/additionalProperties;
 * validateRoleOutput enforces closed objects and those bounds.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { validate } from "./json-schema-validator.mjs";
import { putObject, getObject, repositoryIdentity } from "./review-evidence-store.mjs";

export const SHA_RE = /^[0-9a-f]{64}$/;
const TREE40_RE = /^[0-9a-f]{40}$/;
const SECRET_BASE = /^(?:\.env(?:\..*)?|credentials\.json|id_rsa|id_ed25519)$/i;

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const WINNERS = Object.freeze(["open_win", "contract_win", "combination"]);

export const PLANNING_ROLES = Object.freeze([
  "open_box",
  "contract_box",
  "scout_forward",
  "scout_reverse",
  "contract_revise",
  "assessor",
]);

export const ROLE_INHERIT_LABEL = Object.freeze({
  open_box: "PLAN",
  contract_box: "PLAN",
  contract_revise: "PLAN",
  assessor: "PLAN",
  scout_forward: "EXEC",
  scout_reverse: "EXEC",
});

export const DEFAULT_LIMITS = Object.freeze({
  timeoutMs: 600000,
  maxBytes: 524288,
  maxOutputBytes: 524288,
  contentAttempts: 1,
});

export class IsolationUnsupported extends Error {
  constructor(message = "Open Box isolation unsupported") {
    super(message);
    this.name = "IsolationUnsupported";
  }
}

export class UnresolvedConflict extends Error {
  constructor(message = "unresolved conflict") {
    super(message);
    this.name = "UnresolvedConflict";
  }
}

export class CoverageGap extends Error {
  constructor(message = "coverage gap") {
    super(message);
    this.name = "CoverageGap";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireSha256(value, label = "sha256") {
  const hex = String(value ?? "").trim().toLowerCase();
  if (!SHA_RE.test(hex)) throw new Error(`${label} must be SHA256 64-hex`);
  return hex;
}

function requireTree40(value, label = "tree") {
  const hex = String(value ?? "").trim().toLowerCase();
  if (!TREE40_RE.test(hex)) throw new Error(`${label} must be Git 40-hex, not SHA256`);
  return hex;
}

export function canonical(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
  return out;
}

export function canonicalJson(value) {
  const json = JSON.stringify(canonical(value));
  if (json === undefined) throw new Error("value is not JSON-serializable");
  return json;
}

export function sha256Bytes(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function sha256Utf8(text) {
  return sha256Bytes(Buffer.from(String(text), "utf8"));
}

/** Strict ObjectRef. Pass 64-hex SHA256, never a Git tree or DigestRef. */
export function objectRef(sha256) {
  if (isPlainObject(sha256)) throw new Error("objectRef takes SHA256 hex, not an object");
  return Object.freeze({ type: "object", sha256: requireSha256(sha256, "ObjectRef.sha256") });
}

/**
 * Strict SHA256 DigestRef. Raw Git tree ids are not SHA256. Never getObject this.
 */
export function digestRef(hex, of) {
  const allowed = new Set(["tree", "file", "policy", "bytes"]);
  if (!allowed.has(of)) throw new Error(`DigestRef.of invalid: ${of}`);
  const sha256 = requireSha256(hex, "DigestRef.sha256");
  return Object.freeze({ type: "digest", sha256, of });
}

function assertObjectRef(ref, label = "ObjectRef") {
  if (!isPlainObject(ref) || ref.type !== "object") throw new Error(`${label} must be {type:"object",sha256}`);
  const keys = Object.keys(ref).sort().join(",");
  if (keys !== "sha256,type") throw new Error(`${label} is strict (only type, sha256)`);
  return objectRef(ref.sha256);
}

/** Only ObjectRef addresses getObject. DigestRef/raw hex are rejected. */
export function getByRef(ref, opts = {}) {
  const object = assertObjectRef(ref, "getByRef");
  return getObject(object.sha256, opts);
}

function str() {
  return { type: "string", minLength: 1 };
}

function nstr() {
  return { type: ["string", "null"], minLength: 1 };
}

function nint() {
  return { type: ["integer", "null"], minimum: 1 };
}

function closed(properties) {
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

function arr(items, minItems = 0) {
  return { type: "array", items, minItems };
}

const CITATION = closed({
  path: str(),
  start_line: { type: "integer", minimum: 1 },
  end_line: { type: "integer", minimum: 1 },
  sha256: { type: ["string", "null"], minLength:64, maxLength:64, pattern:"^[0-9a-f]{64}$" },
});

const RANGE = closed({
  path: str(),
  start_line: { type: "integer", minimum: 1 },
  end_line: { type: "integer", minimum: 1 },
});

const DECISION = closed({
  id: str(),
  original_requirement_ids: arr(str(), 1),
  source_citations: arr(CITATION, 0),
  text: str(),
});

const DISPOSITION = closed({
  target_id: str(),
  target_kind: { type: "string", enum: ["finding", "consequential_gap"] },
  disposition: { type: "string", enum: ["accept", "reject", "reject_innovation", "defer"] },
  reason: str(),
});

const FINDING = closed({
  id: str(),
  claim: str(),
  path: nstr(),
  start_line: nint(),
  end_line: nint(),
  excerpt: nstr(),
  consequential: { type: "boolean" },
});

const GAP = closed({
  id: str(),
  path: nstr(),
  reason: str(),
  start_line: nint(),
  end_line: nint(),
});

const SCOUT = closed({
  findings: arr(FINDING, 0),
  citations: arr(CITATION, 0),
  unread_gaps: arr(GAP, 0),
  supplied_denominator: closed({
    files: arr(str(), 0),
    ranges: arr(RANGE, 0),
  }),
  incomplete: { type: "boolean" },
});

const CONTRACT = closed({
  plan: str(),
  decisions: arr(DECISION, 1),
});

const CONTRACT_REVISE = closed({
  plan: str(),
  decisions: arr(DECISION, 1),
  dispositions: arr(DISPOSITION, 0),
});

const SELECTED = closed({
  original_requirement_id: str(),
  decision_id: str(),
  source_ids: arr(str(), 1),
  origin: { type: "string", enum: ["open_box", "contract_box", "combination"] },
  reason: str(),
});

const REJECTION = closed({
  decision_id: str(),
  disposition: { type: "string", enum: ["reject", "reject_innovation"] },
  reason: str(),
});

const CONFLICT = closed({
  id: str(),
  original_requirement_ids: arr(str(), 1),
  reason: str(),
});

const SCHEMAS = Object.freeze({
  open_box: closed({ plan: str() }),
  contract_box: CONTRACT,
  scout_forward: SCOUT,
  scout_reverse: SCOUT,
  contract_revise: CONTRACT_REVISE,
  assessor: closed({
    winner: { type: "string", enum: [...WINNERS] },
    selected_decisions: arr(SELECTED, 0),
    rejection_dispositions: arr(REJECTION, 0),
    unresolved_conflicts: arr(CONFLICT, 0),
  }),
});

/** Recursive closed schema for one of the six planning calls. */
export function outputSchemaForCall(role) {
  const schema = SCHEMAS[role];
  if (!schema) throw new Error(`unknown planning call: ${role}`);
  return structuredClone(schema);
}

function enforceClosedAndBounds(schema, data, p) {
  if (data === null) return;
  if (typeof schema.minLength === "number" && typeof data === "string" && data.trim().length < schema.minLength) {
    throw new Error(`${p}: minLength ${schema.minLength}`);
  }
  if (typeof data === "string" && schema.maxLength != null && data.length > schema.maxLength) throw new Error(`${p}: maxLength ${schema.maxLength}`);
  if (typeof data === "string" && schema.pattern && !new RegExp(schema.pattern).test(data)) throw new Error(`${p}: pattern mismatch`);
  if (Number.isInteger(schema.minItems) && Array.isArray(data) && data.length < schema.minItems) {
    throw new Error(`${p}: minItems ${schema.minItems}`);
  }
  if (schema.minimum != null && typeof data === "number" && data < schema.minimum) {
    throw new Error(`${p}: minimum ${schema.minimum}`);
  }
  if (schema.properties && isPlainObject(data)) {
    for (const key of Object.keys(data)) {
      if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
        throw new Error(`${p}: unknown property "${key}"`);
      }
    }
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (key in data) enforceClosedAndBounds(sub, data[key], `${p}.${key}`);
    }
  }
  if (schema.items && Array.isArray(data)) {
    data.forEach((item, i) => enforceClosedAndBounds(schema.items, item, `${p}[${i}]`));
  }
}

/**
 * Schema + closed-object + minLength/minItems checks. Open `plan` is returned
 * unchanged (no trim/canonical rewrite). Assessor conflicts / empty selection
 * fail strictly. contract_revise dispositions must cover provided findings/gaps.
 */
export function validateRoleOutput(role, output, context = {}) {
  const schema = outputSchemaForCall(role);
  const result = validate(schema, output);
  if (!result.valid) throw new Error(`invalid ${role} output: ${result.errors.join("; ")}`);
  enforceClosedAndBounds(schema, output, "$");
  if (role === "open_box") return { plan: output.plan };
  if (role === "contract_revise") {
    const needed = [
      ...(context.scoutFindings || []).map((f) => ({ id: f.id, kind: "finding" })),
      ...(context.consequentialGaps || []).map((g) => ({ id: g.id, kind: "consequential_gap" })),
    ];
    for (const n of needed) {
      const hit = output.dispositions.find((d) => d.target_id === n.id && d.target_kind === n.kind);
      if (!hit) throw new CoverageGap(`undisposed ${n.kind} ${n.id}`);
    }
  }
  if (role === "assessor") {
    if (output.unresolved_conflicts.length > 0) {
      throw new UnresolvedConflict(output.unresolved_conflicts.map((c) => c.reason).join("; ") || "unresolved conflict");
    }
    if (!output.selected_decisions.length) throw new Error("empty or missing selected decisions");
  }
  return output;
}

/** Strict assessor selection. No third plan. Conflicts and empty selection fail. */
export function normalizeSelection(output, context = {}) {
  const data = validateRoleOutput("assessor", output, context);
  if (data.unresolved_conflicts.length > 0) {
    throw new UnresolvedConflict(data.unresolved_conflicts.map((c) => c.reason).join("; ") || "unresolved conflict");
  }
  if (!data.selected_decisions.length) throw new Error("empty or missing selected decisions");
  const origins = new Set(data.selected_decisions.map((d) => d.origin));
  if (data.winner === "open_win" && [...origins].some((o) => o !== "open_box")) {
    throw new UnresolvedConflict("open_win selected a non-open decision");
  }
  if (data.winner === "contract_win" && [...origins].some((o) => o !== "contract_box")) {
    throw new UnresolvedConflict("contract_win selected a non-contract decision");
  }
  return {
    winner: data.winner,
    selected_decisions: data.selected_decisions,
    rejection_dispositions: data.rejection_dispositions,
  };
}

function gitUtf8(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: DEFAULT_LIMITS.maxBytes,
    }).trim();
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`git ${args.join(" ")} failed closed: ${detail}`);
  }
}

function containRel(root, rel) {
  if (typeof rel !== "string" || rel.length === 0) throw new Error("scoped path required");
  if (path.isAbsolute(rel) || rel.includes("\0") || rel.startsWith("~")) {
    throw new Error(`refusing non-contained path: ${rel}`);
  }
  if (rel.includes("\\") || rel.split("/").some(p => p === ".." || p === "." || !p)) throw new Error(`refusing non-canonical scoped path: ${rel}`);
  const norm = rel;
  if (norm === "." || norm === ".." || norm.startsWith("../") || norm.startsWith("/")) {
    throw new Error(`refusing traversal path: ${rel}`);
  }
  if (norm === ".git" || norm.startsWith(".git/")) throw new Error(`refusing .git path: ${rel}`);
  const base = path.posix.basename(norm);
  if (SECRET_BASE.test(base) || /\.pem$/i.test(base)) throw new Error(`refusing secret config path: ${rel}`);
  let acc = root;
  for (const part of norm.split("/")) {
    acc = path.join(acc, part);
    try {
      if (fs.lstatSync(acc).isSymbolicLink()) throw new Error(`refusing symlink: ${rel}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return norm;
}

function gitBlob(cwd, rev, rel, maxFileBytes) {
  const entry = gitUtf8(cwd, ["ls-tree", rev, "--", rel]);
  if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(entry)) throw new CoverageGap(`scoped path is missing, non-regular, or a symlink at base: ${rel}`);
  const blob = gitUtf8(cwd, ["rev-parse", "--verify", `${rev}:${rel}`]);
  const size = Number(gitUtf8(cwd, ["cat-file", "-s", blob]));
  const fullReadCap = 16 * 1024 * 1024;
  if (!Number.isSafeInteger(size) || size < 0 || size > fullReadCap) throw new CoverageGap(`source exceeds bounded hash/read capacity: ${rel}`);
  const r = spawnSync("git", ["-C", cwd, "cat-file", "blob", blob], {maxBuffer: fullReadCap + 1024, timeout: 10000});
  if (r.error || r.signal || r.status !== 0 || !Buffer.isBuffer(r.stdout) || r.stdout.length !== size) throw new CoverageGap(`cannot read complete source blob: ${rel}`);
  if (r.stdout.includes(0)) throw new CoverageGap(`binary scoped source: ${rel}`);
  return {bytes: r.stdout.subarray(0, maxFileBytes), sha256: sha256Bytes(r.stdout), byte_length: size, truncated: size > maxFileBytes};
}

/**
 * Persist full original requirements and the frozen facts object as distinct
 * CAS objects. Not part of the source snapshot.
 */
export function persistOriginalInputs({ originalRequirements, facts }, opts = {}) {
  if (originalRequirements === undefined || originalRequirements === null || (typeof originalRequirements === "string" && !originalRequirements.trim())) {
    throw new Error("original requirements required");
  }
  if (!isPlainObject(facts)) throw new Error("facts must be an object");
  const reqBytes = typeof originalRequirements === "string"
    ? Buffer.from(originalRequirements, "utf8")
    : Buffer.from(canonicalJson(originalRequirements), "utf8");
  const req = putObject(reqBytes, opts);
  const factsPut = putObject(Buffer.from(canonicalJson(facts), "utf8"), opts);
  return {
    original_requirements_ref: objectRef(req.sha256),
    frozen_facts_ref: objectRef(factsPut.sha256),
  };
}

/**
 * Snapshot scoped blobs at the consumer Git base. Binds common-dir identity,
 * base 40-hex, tree 40-hex, per-file SHA256/object bytes, ranges, truncation.
 * Reads listed paths only (no walk / secret discovery). Rejects invented source_tree.
 */
export function buildSourceSnapshot({
  consumerRoot,
  start,
  env = process.env,
  baseSha,
  scope = [],
  ranges = [],
  maxFileBytes = DEFAULT_LIMITS.maxBytes,
} = {}) {
  if (arguments[0] && "source_tree" in arguments[0]) throw new Error("user-invented source_tree refused");
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1 || maxFileBytes > DEFAULT_LIMITS.maxBytes) throw new Error("invalid bounded source size");
  if (!Array.isArray(scope) || !scope.length || new Set(scope).size !== scope.length) throw new CoverageGap("nonempty distinct scoped files required");
  const root = consumerRoot || start || process.cwd();
  const identity = repositoryIdentity(root);
  const cwd = identity.checkout;
  const storeOpts = { start: start || cwd, env };
  const base = requireTree40(baseSha, "baseSha");
  const tree = requireTree40(gitUtf8(cwd, ["rev-parse", "--verify", `${base}^{tree}`]), "tree");
  const scoped = Array.isArray(scope) ? scope.map((rel) => containRel(cwd, rel)) : [];
  const scopedSet = new Set(scoped);
  const boundRanges = [];
  for (const range of Array.isArray(ranges) ? ranges : []) {
    const pathRel = containRel(cwd, range.path);
    if (!scopedSet.has(pathRel)) throw new CoverageGap(`range path not in scope: ${range.path}`);
    boundRanges.push({ path: pathRel, start_line: range.start_line, end_line: range.end_line });
  }
  const scoped_files = [];
  for (const rel of scoped) {
    const blob = gitBlob(cwd, base, rel, maxFileBytes);
    const stored = putObject(blob.bytes, storeOpts);
    const fileRanges = boundRanges.filter((r) => r.path === rel);
    const text = blob.bytes.toString("utf8");
    const lines = text.split("\n");
    for (const range of fileRanges) {
      if (!Number.isInteger(range.start_line) || !Number.isInteger(range.end_line) || range.start_line < 1 || range.end_line < range.start_line) {
        throw new CoverageGap(`invalid range for ${rel}`);
      }
      if (range.end_line > lines.length) {
        throw new CoverageGap(blob.truncated ? `range exceeds truncated ${rel}` : `range exceeds ${rel}`);
      }
    }
    scoped_files.push({
      path: rel,
      sha256: blob.sha256,
      retained_sha256: stored.sha256,
      object_ref: objectRef(stored.sha256),
      byte_length: blob.byte_length,
      retained_bytes: blob.bytes.length,
      truncated: blob.truncated,
      ranges: fileRanges,
    });
  }
  return {
    identity: {
      checkout: identity.checkout,
      gitCommonDir: identity.gitCommonDir,
      repoRoot: identity.repoRoot,
    },
    base_sha: base,
    tree,
    scoped_files,
  };
}

function parseOneJsonObject(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) throw new Error("stdout empty");
  const value = JSON.parse(trimmed);
  if (!isPlainObject(value)) throw new Error("stdout must be ONE JSON object");
  return value;
}

/**
 * Recompute quick-fix eligibility on the CURRENT STAGED consumer diff only.
 * Spawns the installed classifier with no CLI flags. No commit SHA exemption.
 * Nonzero + eligible:false is normal. Unexpected failure fails closed.
 * inject.runner/env/eligible/sourceHash allowed only when mode==="OFFLINE".
 */
export function evaluateEligibility({
  consumerRoot,
  start,
  env = process.env,
  mode = "LIVE",
  inject,
} = {}) {
  if (mode !== "LIVE" && mode !== "OFFLINE") throw new Error(`unknown eligibility mode: ${mode}`);
  if (mode !== "OFFLINE") {
    if (inject !== undefined || Object.hasOwn(arguments[0] || {}, "env") ||
        ["runner", "eligible", "sourceHash", "commitSha", "sha"].some(key => Object.hasOwn(arguments[0] || {}, key))) {
      throw new Error("real modes reject injected runner/env/eligible/source hash or historical candidate");
    }
  } else if (typeof inject?.runner !== "function") {
    throw new Error("OFFLINE requires explicit inject.runner; CLI flags cannot elevate synthetic data");
  }
  const identity = repositoryIdentity(consumerRoot || start || process.cwd());
  const cwd = identity.checkout;
  const storeOpts = { start: start || cwd, env };
  const classifier = path.join(PACKAGE_ROOT, "scripts", "quick-fix-eligibility.mjs");
  const classifierStat = fs.lstatSync(classifier);
  if (!classifierStat.isFile()) throw new Error("installed classifier missing");
  const index_tree_before = requireTree40(gitUtf8(cwd, ["write-tree"]), "index_tree_before");
  let stdout;
  let status;
  if (mode === "OFFLINE") {
    const recorded = inject.runner();
    stdout = recorded?.stdout ?? "";
    status = recorded?.status;
  } else {
    const spawned = spawnSync(process.execPath, [classifier], {
      cwd,
      env,
      encoding: "utf8",
      timeout: DEFAULT_LIMITS.timeoutMs,
      maxBuffer: DEFAULT_LIMITS.maxBytes,
    });
    if (spawned.error) throw new Error(`eligibility classifier failed closed: ${spawned.error.message}`);
    if (spawned.signal) throw new Error(`eligibility classifier failed closed: signal ${spawned.signal}`);
    stdout = spawned.stdout ?? "";
    status = spawned.status;
  }
  const index_tree_after = requireTree40(gitUtf8(cwd, ["write-tree"]), "index_tree_after");
  if (index_tree_after !== index_tree_before) throw new Error("eligibility classifier mutated the index");
  let parsed;
  try {
    parsed = parseOneJsonObject(stdout);
  } catch (error) {
    throw new Error(`eligibility classifier failed closed: ${error.message}`);
  }
  if (typeof parsed.eligible !== "boolean" || ![0,1].includes(status) || (status === 0) !== parsed.eligible) throw new Error("classifier status/verdict is invalid");
  if (parsed.eligible === true && status !== 0) {
    throw new Error("eligibility classifier failed closed: eligible true with nonzero status");
  }
  if (parsed.eligible === true && (parsed.tree_hash === "unknown" || parsed.staged_tree === "unknown")) {
    throw new Error("eligibility failed closed: unknown staged tree");
  }
  const claimed = parsed.tree_hash || parsed.staged_tree;
  if (claimed && claimed !== "unknown" && claimed !== index_tree_before) {
    throw new Error("classifier staged_tree mismatch vs index");
  }
  const stagedNames = gitUtf8(cwd, ["diff", "--cached", "--name-only"]);
  const stagedFiles = stagedNames ? stagedNames.split("\n").filter(Boolean) : [];
  let eligible = parsed.eligible === true && status === 0;
  if (stagedFiles.length === 0) eligible = false;
  const output = { ...parsed, eligible, staged_tree: index_tree_before, files: parsed.files || stagedFiles };
  const stored = putObject(Buffer.from(String(stdout), "utf8"), storeOpts);
  return {
    eligible,
    reasons: output.reasons || [],
    files: output.files,
    eligibility_output: objectRef(stored.sha256),
    staged_tree: digestRef(sha256Utf8(`git-tree:${index_tree_before}\n`), "tree"),
    index_tree_before,
    index_tree_after,
    classifier_status: status,
    mode,
    evidence_class: mode === "OFFLINE" ? "OFFLINE" : "LIVE",
  };
}

/** Source identity digest: common-dir / repoRoot / Git tree / scoped file hashes. Checkout path is metadata. */
export function canonicalSourceHash(snapshot) {
  if (typeof snapshot === "string") return requireSha256(snapshot, "source digest");
  if (!isPlainObject(snapshot)) throw new Error("source snapshot required");
  if ("source_tree" in snapshot) throw new Error("user-invented source_tree refused");
  return sha256Utf8(canonicalJson({
    gitCommonDir: snapshot.identity?.gitCommonDir,
    repoRoot: snapshot.identity?.repoRoot,
    base_sha: snapshot.base_sha,
    tree: snapshot.tree,
    scoped_files: (snapshot.scoped_files || []).map((f) => ({
      path: f.path,
      sha256: f.sha256,
      byte_length: f.byte_length,
      retained_bytes: f.retained_bytes,
      retained_sha256: f.retained_sha256,
      truncated: f.truncated,
      ranges: f.ranges,
    })),
  }));
}

export function canonicalPolicyHash(policy) {
  if (policy == null) throw new Error("policy required");
  if (typeof policy === "string") return requireSha256(policy, "policy digest");
  return sha256Utf8(canonicalJson(policy));
}

export function resumeKey({ wi, objectRefs = [], digestRefs = [], roleTuples = [], policyDigest, sourceDigest }) {
  if (!wi) throw new Error("resumeKey requires wi");
  return sha256Utf8(canonicalJson({ wi, objectRefs, digestRefs, roleTuples, policyDigest, sourceDigest }));
}

function asBuffer(value) {
  if (value == null) return Buffer.alloc(0);
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

/** CAS stage envelope: full input + launch raw stdout/stderr refs and byte hashes + digests. */
export function storeStageEnvelope({
  wi,
  role,
  input,
  launch = {},
  policy,
  source,
  parents = [],
  schema,
  start,
  env,
} = {}) {
  if (!PLANNING_ROLES.includes(role)) throw new Error(`unknown planning call: ${role}`);
  if (!start) throw new Error("stage storage requires explicit consumer start");
  if (!/^WI-/.test(wi || "")) throw new Error("stage WI required");
  if (!["LIVE", "OFFLINE"].includes(launch.evidence_class)) throw new Error("stage launch evidence class required");
  const output = validateRoleOutput(role, launch.output ?? launch.parsed);
  const opts = { start, env };
  const stdoutBuf = asBuffer(launch.rawStdout ?? launch.raw_stdout);
  const stderrBuf = asBuffer(launch.rawStderr ?? launch.raw_stderr);
  const stdoutPut = putObject(stdoutBuf, opts);
  const stderrPut = putObject(stderrBuf, opts);
  const envelope = {
    schema_version: 1,
    evidence_class: launch.evidence_class,
    wi,
    role,
    input,
    input_digest: sha256Utf8(canonicalJson(input)),
    output,
    launch: {
      evidence_class: launch.evidence_class,
      proof: launch.proof ?? null,
      usage: launch.usage ?? null,
      prompt_digest: launch.prompt_digest ?? null,
      limits: launch.limits ?? null,
      attempts: launch.attempts ?? 1,
      requested: launch.requested ?? null,
      invocation: launch.invocation ?? null,
      observed: launch.observed ?? null,
      exit_code: launch.exitCode ?? launch.exit_code ?? null,
      raw_stdout_ref: objectRef(stdoutPut.sha256),
      raw_stderr_ref: objectRef(stderrPut.sha256),
      stdout_sha256: sha256Bytes(stdoutBuf),
      stderr_sha256: sha256Bytes(stderrBuf),
    },
    policy_digest: canonicalPolicyHash(policy),
    source_digest: canonicalSourceHash(source),
    parents: (parents || []).map((p) => assertObjectRef(p, "parent")),
    schema_digest: sha256Utf8(canonicalJson(schema ?? outputSchemaForCall(role))),
  };
  const stored = putObject(Buffer.from(`${canonicalJson(envelope)}\n`, "utf8"), opts);
  return { ref: objectRef(stored.sha256), sha256: stored.sha256, envelope };
}

export function getStageEnvelope(ref, opts = {}) {
  const { bytes } = getByRef(ref, opts);
  return JSON.parse(bytes.toString("utf8"));
}

function assertScoutBinding(entry) {
  if (!isPlainObject(entry)) throw new Error("scout binding must be an object");
  if (entry.role !== "scout_forward" && entry.role !== "scout_reverse") {
    throw new Error("scout binding role must be scout_forward or scout_reverse");
  }
  return {
    role: entry.role,
    report_ref: assertObjectRef(entry.report_ref, "scout report_ref"),
    coverage_ref: assertObjectRef(entry.coverage_ref, "scout coverage_ref"),
  };
}

/**
 * Draft control-plan v2 for orchestration/T3 only. Never live issuance.
 * Exact draft schema (all keys present; nullable fields are JSON null):
 * {
 *   receipt_type: "control-plan",
 *   schema_version: 2,
 *   wi: string,
 *   original_requirements_ref: ObjectRef,
 *   frozen_facts_ref: ObjectRef,
 *   source_snapshot_ref: ObjectRef,
 *   assessor_ref: ObjectRef,
 *   source: { identity, base_sha, tree, scoped_file_digests },
 *   policy_digest: 64-hex,
 *   prompt_digest: 64-hex | null,
 *   tuple: object,
 *   open_original_ref: ObjectRef,
 *   contract_original_ref: ObjectRef,
 *   contract_revised_ref: ObjectRef,
 *   scout_reports: [{role, report_ref, coverage_ref}, {role, report_ref, coverage_ref}],  // exactly 2, forward+reverse
 *   chosen_solution: { winner: open_win|contract_win|combination, selected_decisions, rejection_dispositions, unresolved_conflicts },
 *   dispositions: array,
 *   contamination_diagnosis: object,
 *   usage: object | null,
 *   cost: object | null,
 *   draft: true,
 *   draft_for: "orchestration/T3",
 *   issuance: "draft",
 *   evidence_class: "LIVE_DRAFT" | "OFFLINE"
 * }
 * No floor_verdict. OFFLINE + live/executable issuance is rejected.
 */
export function draftControlPlanV2(input = {}) {
  const mode = input.mode ?? "LIVE";
  if (!["LIVE", "OFFLINE"].includes(mode)) throw new Error("unknown control draft mode");
  if ("floor_verdict" in input || (input.chosen_solution && "floor_verdict" in input.chosen_solution)) {
    throw new Error("control-plan v2 forbids floor_verdict");
  }
  if (mode === "OFFLINE" && (input.issuance === "live" || input.live === true || input.executable === true)) {
    throw new Error("OFFLINE live issuance rejected");
  }
  if (!input.wi) throw new Error("draft control-plan v2 requires wi");
  const scouts = (input.scout_reports || []).map(assertScoutBinding);
  if (scouts.length !== 2) throw new Error("exactly 2 assigned scout reports required");
  const roles = scouts.map((s) => s.role).sort();
  if (roles[0] !== "scout_forward" || roles[1] !== "scout_reverse") {
    throw new Error("scout_reports must be scout_forward and scout_reverse");
  }
  const chosen = input.chosen_solution;
  normalizeSelection(chosen);
  if (!isPlainObject(input.source)) throw new Error("source bindings required");
  if (input.source.source_tree) throw new Error("user-invented source_tree refused");
  return {
    receipt_type: "control-plan",
    schema_version: 2,
    wi: input.wi,
    original_requirements_ref: assertObjectRef(input.original_requirements_ref, "original_requirements_ref"),
    frozen_facts_ref: assertObjectRef(input.frozen_facts_ref, "frozen_facts_ref"),
    source_snapshot_ref: assertObjectRef(input.source_snapshot_ref, "source_snapshot_ref"),
    assessor_ref: assertObjectRef(input.assessor_ref, "assessor_ref"),
    source: {
      identity: input.source.identity,
      base_sha: requireTree40(input.source.base_sha, "source.base_sha"),
      tree: requireTree40(input.source.tree, "source.tree"),
      scoped_file_digests: input.source.scoped_file_digests ?? (input.source.scoped_files || []).map((f) => ({
        path: f.path,
        sha256: f.sha256,
        truncated: f.truncated,
      })),
    },
    policy_digest: canonicalPolicyHash(input.policy_digest ?? input.policy),
    prompt_digest: input.prompt_digest == null ? null : requireSha256(input.prompt_digest, "prompt_digest"),
    tuple: input.tuple ?? null,
    open_original_ref: assertObjectRef(input.open_original_ref, "open_original_ref"),
    contract_original_ref: assertObjectRef(input.contract_original_ref, "contract_original_ref"),
    contract_revised_ref: assertObjectRef(input.contract_revised_ref, "contract_revised_ref"),
    scout_reports: scouts,
    chosen_solution: {
      winner: chosen.winner,
      selected_decisions: chosen.selected_decisions,
      rejection_dispositions: chosen.rejection_dispositions ?? [],
      unresolved_conflicts: chosen.unresolved_conflicts ?? [],
    },
    dispositions: input.dispositions ?? [],
    contamination_diagnosis: input.contamination_diagnosis ?? null,
    usage: input.usage ?? null,
    cost: input.cost ?? null,
    draft: true,
    draft_for: "orchestration/T3",
    issuance: "draft",
    evidence_class: mode === "OFFLINE" ? "OFFLINE" : "LIVE_DRAFT",
  };
}


/** Compare the actual classifier verdict while retaining each raw timed receipt.
 * Its observation timestamp changes on every invocation; all other fields bind.
 */
export function eligibilityDecisionDigest(record, {consumerRoot} = {}) {
  const raw=JSON.parse(getByRef(record.eligibility_output,{start:consumerRoot}).bytes.toString('utf8'));
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('classifier receipt object required');
  // Attribution and CLI transport fields differ across staged/committed reads.
  // Keep all decision fields, including any future fields, in the digest.
  const {timestamp,receipt_type,schema_version,git_user,sha,wi,added_lines,removed_lines,addedLines,removedLines,...rest}=raw;
  if (added_lines != null && addedLines != null && added_lines !== addedLines) throw new Error('conflicting classifier added-line counts');
  if (removed_lines != null && removedLines != null && removed_lines !== removedLines) throw new Error('conflicting classifier removed-line counts');
  const decision={...rest,added_lines:added_lines ?? addedLines,removed_lines:removed_lines ?? removedLines};
  return sha256Utf8(canonicalJson({decision,eligible:record.eligible,evidence_class:record.evidence_class,files:record.files,staged_tree:record.staged_tree,classifier_status:record.classifier_status}));
}

/** Read-only replay of a resolved commit. This is not current issuance authority. */
export function evaluateCommittedEligibility({consumerRoot, candidateSha} = {}) {
  const cwd = repositoryIdentity(consumerRoot).checkout;
  if (!TREE40_RE.test(String(candidateSha || "")) || gitUtf8(cwd, ["rev-parse", "--verify", `${candidateSha}^{commit}`]).trim() !== candidateSha) {
    throw new Error("committed eligibility requires an explicit resolved commit SHA");
  }
  const parents = gitUtf8(cwd, ["rev-list", "--parents", "-n", "1", candidateSha]).trim().split(/\s+/);
  if (parents.length !== 2) throw new Error("committed eligibility requires exactly one parent; root and merge commits are unsupported");
  const tree = requireTree40(gitUtf8(cwd, ["rev-parse", `${candidateSha}^{tree}`]), "committed tree");
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, "scripts/quick-fix-eligibility.mjs"), "--sha", candidateSha], {
    cwd, encoding: "utf8", timeout: DEFAULT_LIMITS.timeoutMs, maxBuffer: DEFAULT_LIMITS.maxBytes,
  });
  if (run.error || run.signal) throw new Error(`committed classifier failed closed: ${run.error?.message || run.signal}`);
  const raw = parseOneJsonObject(run.stdout);
  if (typeof raw.eligible !== "boolean" || ![0,1].includes(run.status) || (run.status === 0) !== raw.eligible || raw.tree_hash !== tree || !Array.isArray(raw.files) || !raw.files.length) {
    throw new Error("invalid committed classifier evidence");
  }
  return {eligible:raw.eligible,reasons:raw.reasons,files:raw.files,
    eligibility_output:objectRef(putObject(Buffer.from(run.stdout),{start:cwd}).sha256),
    staged_tree:digestRef(sha256Utf8(`git-tree:${tree}\n`),"tree"),classifier_status:run.status,evidence_class:"LIVE",mode:"COMMITTED"};
}
