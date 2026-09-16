#!/usr/bin/env node
/**
 * Active LIVE control-plan v2 validator (WI-FW-TWO-BOX-01 T3).
 * v1 is historical-reader only. Review-plan seal is out of scope.
 *
 * parseCodexJsonl(raw) -> { output, tool_events: [] }
 * Throws on tool events, malformed JSONL, truncated or partial stdout.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validateEvidenceSchema } from "./evidence-schema.mjs";
import { getObject, repositoryIdentity } from "./review-evidence-store.mjs";
import {
  SHA_RE,
  PACKAGE_ROOT,
  digestRef,
  canonicalJson,
  sha256Bytes,
  sha256Utf8,
  canonicalSourceHash,
  getStageEnvelope,
  validateRoleOutput,
  normalizeSelection,
  outputSchemaForCall,
} from "./two-box-protocol.mjs";
import { buildCodexConfigFlags, buildCodexExecArgs, diagnosePromptContamination, assertIsolationAuthority } from "./isolated-plan-analysis.mjs";
import { assignDualPass, assignmentCoverage, constraintSources } from "./two-box-scout-assign.mjs";
import { buildRolePrompt, parseCodexJsonl } from "./two-box-role-launch.mjs";

const SCHEMA = JSON.parse(
  fs.readFileSync(new URL("../../schemas/receipts/control-plan.schema.json", import.meta.url), "utf8"),
);

const ROLES = ["open_box", "contract_box", "scout_forward", "scout_reverse", "contract_revise", "assessor"];
const INPUT_KEYS = {
  open_box: ["facts", "requirements"],
  contract_box: ["constraints", "facts", "requirements"],
  scout_forward: ["assignment", "initial_contract"],
  scout_reverse: ["assignment", "initial_contract"],
  contract_revise: ["constraints", "facts", "initial_contract", "requirements", "scout_reports"],
  assessor: ["facts", "original_contract", "original_open", "requirements", "revised_contract", "scout_reports", "open_paragraphs"],
};

function isPlain(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isObjectRef(ref) {
  return isPlain(ref) && ref.type === "object" && SHA_RE.test(String(ref.sha256)) && Object.keys(ref).sort().join(",") === "sha256,type";
}

function refEq(a, b) {
  return isObjectRef(a) && isObjectRef(b) && a.sha256 === b.sha256;
}

function callerFlag(node) {
  return isPlain(node) && (node.verified === true || node.effective === true);
}

function openParagraphs(plan) {
  return String(plan ?? "").split(/\n\n+/).filter(t => t.trim())
    .map((text, i) => ({ id: `open:P${i + 1}`, text, sha256: sha256Utf8(text) }));
}

function idsFrom(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(idsFrom);
  if (typeof value === "string") return value ? [value] : [];
  if (isPlain(value)) {
    if (typeof value.id === "string" && !Array.isArray(value.requirements) && !Array.isArray(value.ids)) return [value.id];
    return [...idsFrom(value.requirements), ...idsFrom(value.ids), ...idsFrom(value.original_requirement_ids)];
  }
  return [];
}

function loadCas(ref, consumerRoot, errors, label) {
  if (isPlain(ref) && ref.type === "digest") {
    errors.push(`${label}: getObject must never receive DigestRef`);
    return null;
  }
  if (!isObjectRef(ref)) {
    errors.push(`${label}: ObjectRef required`);
    return null;
  }
  try {
    const got = getObject(ref.sha256, { start: consumerRoot });
    if (sha256Bytes(got.bytes) !== ref.sha256) errors.push(`${label}: CAS bytes digest mismatch`);
    return got;
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    return null;
  }
}

export function collectRetainedStageProofErrors(env, { consumerRoot, fixture = false, role } = {}) {
  const errors = [];
  const fail = (msg) => { errors.push(msg); };
  const launch = env?.launch || {};
  if (!("requested" in launch) || !("invocation" in launch) || !("observed" in launch)) fail(`${role}: requested/invocation/observed required`);
  if (!isPlain(launch.requested) || !isPlain(launch.invocation)) fail(`${role}: requested and invocation identities required`);
  if (launch.requested === launch.invocation || launch.requested === launch.observed || launch.invocation === launch.observed) {
    fail(`${role}: requested/invocation/observed must be separate identities`);
  }
  if (launch.observed !== null && !isPlain(launch.observed)) fail(`${role}: observed identity invalid`);
  if (isPlain(launch.observed) && !Object.prototype.hasOwnProperty.call(launch.observed, "model")) {
    fail(`${role}: observed.model may be null but must not be fabricated`);
  }
  if (callerFlag(launch) || callerFlag(launch.requested) || callerFlag(launch.invocation) || callerFlag(launch.observed)) {
    fail(`${role}: caller verified/effective is not authority`);
  }
  const proof = launch.proof;
  if (!isPlain(proof)) {
    fail(`${role}: launch.proof required`);
    return errors;
  }
  if (callerFlag(proof) || callerFlag(proof.effective)) fail(`${role}: proof verified/effective is not authority`);
  let proofPrompt;
  try { proofPrompt = buildRolePrompt({role, payload: env.input}); } catch (err) { fail(`${role}: prompt reconstruction ${err.message}`); proofPrompt = ""; }
  if (typeof proof.prompt !== "string") fail(`${role}: proof/payload prompt required`);
  else if (proof.prompt !== proofPrompt) fail(`${role}: proof prompt differs from exact role input`);
  const proofCwd = launch.invocation?.cwd;
  if (proof.cwd !== proofCwd) fail(`${role}: native cwd differs from invocation`);
  if (proof.mode !== (fixture ? "OFFLINE" : "live") || proof.effective?.usable_live !== !fixture) fail(`${role}: effective provenance class mismatch`);
  if (typeof proofPrompt !== "string") fail(`${role}: proof/payload prompt required`);
  if (typeof proofCwd !== "string" || !proofCwd) fail(`${role}: proof.cwd required`);
  if (SHA_RE.test(String(proofPrompt).trim())) fail(`${role}: prompt must include content, not only hashes`);
  if (sha256Utf8(proofPrompt) !== proof.prompt_sha256 || proof.prompt_sha256 !== launch.prompt_digest) fail(`${role}: prompt hash mismatch`);
  if (typeof proof.prompt === "string" && proof.frozen_request && Number.isInteger(proof.frozen_request.byteLength)
    && proof.frozen_request.byteLength !== Buffer.byteLength(proof.prompt)) {
    fail(`${role}: frozen_request.byteLength must match prompt bytes`);
  }
  const nativeGot = loadCas(proof.native_prompt, consumerRoot, errors, `${role} native_prompt`);
  let messages = null;
  if (nativeGot) {
    if (sha256Bytes(nativeGot.bytes) !== proof.native_prompt_sha256 || proof.native_prompt.sha256 !== nativeGot.sha256) {
      fail(`${role}: native_prompt hash mismatch`);
    }
    try { messages = JSON.parse(nativeGot.bytes.toString("utf8").trim()); } catch (err) {
      fail(`${role}: native prompt bytes are not JSON: ${err.message}`);
    }
  } else {
    fail(`${role}: native inspection object required`);
  }
  try {
    assertIsolationAuthority(proof, {
      fixture,
      requested: launch.requested,
      schema: outputSchemaForCall(role),
      inspectMessages: messages || undefined,
    });
  } catch (err) { fail(`${role}: isolation authority: ${err.message}`); }
  if (messages) {
    const diagnosis = diagnosePromptContamination(messages, {
      prompt: proofPrompt,
      cwd: proofCwd,
      profile: proof.native_profile,
      requireEnv: true,
    });
    if (!diagnosis.ok || diagnosis.unknown) fail(`${role}: prompt contamination: ${(diagnosis.reasons || []).join("; ")}`);
    if (isPlain(proof.diagnosis) && proof.diagnosis.ok !== diagnosis.ok) fail(`${role}: recorded diagnosis disagrees with recomputation`);
  }
  try {
    const expectedConfig = buildCodexConfigFlags({tuple: launch.requested, disabledSkills: proof.disabled_skills});
    if (canonicalJson(expectedConfig) !== canonicalJson(proof.config_flags)) fail(`${role}: isolation controls differ from canonical builder`);
    const at = proof.exec_args?.indexOf("--output-schema");
    const expectedArgs = buildCodexExecArgs({tuple: launch.requested, disabledSkills: proof.disabled_skills, outputSchemaPath: proof.exec_args?.[at + 1]});
    if (canonicalJson(expectedArgs) !== canonicalJson(proof.exec_args) || canonicalJson(launch.invocation.exec_args) !== canonicalJson(proof.exec_args)) fail(`${role}: actual invocation/config/tuple disagreement`);
  } catch (err) { fail(`${role}: controls ${err.message}`); }
  if (!Array.isArray(proof.config_flags)) fail(`${role}: config_flags required`);
  if (Array.isArray(proof.config_flags) && proof.config_sha256 !== sha256Utf8(canonicalJson(proof.config_flags))) {
    fail(`${role}: config_sha256 mismatch`);
  }
  if (proof.schema_sha256 !== sha256Utf8(`${JSON.stringify(outputSchemaForCall(role))}\n`)) fail(`${role}: proof.schema_sha256 mismatch`);
  const bin = proof.binary;
  if (!isPlain(bin) || !SHA_RE.test(bin.sha256) || typeof bin.path !== "string") fail(`${role}: binary identity required`);
  else {
    try {
      const real = path.resolve(bin.path);
      const pkg = path.resolve(PACKAGE_ROOT);
      if (real === pkg || real.startsWith(pkg + path.sep)) {
        const st = fs.lstatSync(real);
        if (st.isSymbolicLink()) fail(`${role}: refusing symlink binary`);
        else if (sha256Bytes(fs.readFileSync(real)) !== bin.sha256) fail(`${role}: package binary bytes mismatch`);
      }
    } catch (err) { fail(`${role} binary: ${err.message}`); }
  }
  return errors;
}

export function assertRetainedStageProof(env, options = {}) {
  const errors = collectRetainedStageProofErrors(env, options);
  if (errors.length) throw new Error(errors[0]);
  return env;
}

function parseJson(got, errors, label) {
  if (!got) return null;
  try {
    return JSON.parse(got.bytes.toString("utf8"));
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    return null;
  }
}

function containRel(root, rel) {
  if (typeof rel !== "string" || !rel) throw new Error("path required");
  if (path.isAbsolute(rel) || rel.includes("\0") || rel.startsWith("~") || rel.includes("\\")) {
    throw new Error(`refusing non-contained path: ${rel}`);
  }
  if (rel.split("/").some((p) => p === ".." || p === "." || !p)) throw new Error(`refusing traversal path: ${rel}`);
  if (rel === ".git" || rel.startsWith(".git/")) throw new Error(`refusing .git path: ${rel}`);
  let acc = root;
  for (const part of rel.split("/")) {
    acc = path.join(acc, part);
    let st;
    try { st = fs.lstatSync(acc); } catch (err) {
      if (err.code === "ENOENT") continue;
      throw err;
    }
    if (st.isSymbolicLink()) throw new Error(`refusing symlink: ${rel}`);
  }
  return rel;
}

function gitBlobBytes(cwd, base, rel) {
  const entry = execFileSync("git", ["-C", cwd, "ls-tree", base, "--", rel], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
  if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(entry)) {
    throw new Error(`base path missing, non-regular, or symlink: ${rel}`);
  }
  const blob = entry.split(/\s+/)[2];
  const bytes = execFileSync("git", ["-C", cwd, "cat-file", "blob", blob], {
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!Buffer.isBuffer(bytes) || bytes.includes(0)) throw new Error(`invalid base blob: ${rel}`);
  return bytes;
}

function validateControlPlanCore({
  consumerRoot,
  body,
  requirementsRef,
  sourceSnapshotRef,
  specBindings,
} = {}, fixture = false) {
  const errors = [];
  const fail = (msg) => { errors.push(msg); };

  if (typeof consumerRoot !== "string" || !consumerRoot) return { ok: false, errors: ["consumerRoot required"] };
  if (!isPlain(body)) return { ok: false, errors: ["control-plan body required"] };

  const schemaBody = fixture ? {...body, evidence_class:"LIVE"} : body;
  for (const msg of validateEvidenceSchema(schemaBody, SCHEMA, SCHEMA)) fail(msg);
  if (body.schema_version !== 2) {
    fail("validateControlPlan is active v2 only; v1 remains historical-reader without execution authority");
    return { ok: false, errors };
  }
  for (const msg of validateEvidenceSchema(schemaBody, SCHEMA.$defs.v2, SCHEMA)) fail(msg);

  const expectedClass = fixture ? "OFFLINE" : "LIVE";
  if (body.evidence_class !== expectedClass) fail(`complete control-plan v2 requires evidence_class ${expectedClass}`);
  if ("draft" in body || "draft_for" in body || "issuance" in body) fail("complete v2 forbids draft/draft_for/issuance");
  if ("floor_verdict" in body) fail("control-plan v2 forbids floor_verdict");
  if (callerFlag(body)) fail("caller verified/effective is not authority");
  if (!SHA_RE.test(body.policy_digest) || !SHA_RE.test(body.prompt_digest)) fail("concrete policy_digest and prompt_digest required");
  if (typeof body.timestamp !== "string" || !body.timestamp.trim()) fail("actual timestamp required");

  const identity = repositoryIdentity(consumerRoot);
  const cwd = identity.checkout;
  const store = { start: consumerRoot };
  const reqGot = loadCas(body.original_requirements_ref, consumerRoot, errors, "original_requirements_ref");
  const factsGot = loadCas(body.frozen_facts_ref, consumerRoot, errors, "frozen_facts_ref");
  const snapshot = parseJson(loadCas(body.source_snapshot_ref, consumerRoot, errors, "source_snapshot_ref"), errors, "source_snapshot");

  if (requirementsRef !== undefined && !refEq(requirementsRef, body.original_requirements_ref)) {
    fail("requirementsRef does not match original_requirements_ref");
  }
  if (sourceSnapshotRef !== undefined && !refEq(sourceSnapshotRef, body.source_snapshot_ref)) {
    fail("sourceSnapshotRef does not match source_snapshot_ref");
  }

  let sourceHash = null;
  if (snapshot) {
    if ("source_tree" in snapshot) fail("user-invented source_tree refused");
    try { sourceHash = canonicalSourceHash(snapshot); } catch (err) { fail(`source hash: ${err.message}`); }
    if (snapshot.identity?.gitCommonDir !== identity.gitCommonDir || snapshot.identity?.repoRoot !== identity.repoRoot) {
      fail("source snapshot common-dir/repoRoot mismatch vs consumerRoot");
    }
    if (execFileSync("git",["-C",cwd,"rev-parse",`${snapshot.base_sha}^{tree}`],{encoding:"utf8"}).trim() !== snapshot.tree) fail("base tree does not match actual Git object");
    if (snapshot.tree !== body.source?.tree || snapshot.base_sha !== body.source?.base_sha) fail("body.source base/tree mismatch vs snapshot");
    if (body.tree_hash !== snapshot.tree && body.tree_hash !== sha256Utf8(`git-tree:${snapshot.tree}\n`)) {
      fail("tree_hash is not the pre-execution bound base tree");
    }
    for (const sf of snapshot.scoped_files || []) {
      try {
        containRel(cwd, sf.path);
        const actualBytes = gitBlobBytes(cwd, snapshot.base_sha, sf.path);
        if (sha256Bytes(actualBytes) !== sf.sha256) fail(`base git blob hash mismatch: ${sf.path}`);
        const retained = loadCas(sf.object_ref, consumerRoot, errors, `scoped ${sf.path}`);
        if (retained && (!retained.bytes.equals(actualBytes.subarray(0, sf.retained_bytes)) || actualBytes.length !== sf.byte_length || (actualBytes.length > retained.bytes.length) !== sf.truncated)) fail(`retained bytes not from actual base: ${sf.path}`);
        if (retained && sha256Bytes(retained.bytes) !== (sf.retained_sha256 || sf.object_ref.sha256)) {
          fail(`retained scoped bytes mismatch: ${sf.path}`);
        }
      } catch (err) { fail(`source ${sf.path}: ${err.message}`); }
    }
    const rows = (arr, x) => (arr || []).map(x);
    if (canonicalJson(rows(body.source?.scoped_file_digests, (f) => [f.path, f.sha256, f.truncated === true]))
      !== canonicalJson(rows(snapshot.scoped_files, (f) => [f.path, f.sha256, f.truncated === true]))) {
      fail("scoped_file_digests mismatch vs snapshot");
    }
  }

  const scoutsMeta = body.scout_reports || [];
  if (scoutsMeta.length !== 2 || scoutsMeta[0]?.role !== "scout_forward" || scoutsMeta[1]?.role !== "scout_reverse") {
    fail("scout_reports must be exactly [scout_forward, scout_reverse]");
  }

  const refs = {
    open_box: body.open_original_ref,
    contract_box: body.contract_original_ref,
    scout_forward: scoutsMeta[0]?.report_ref,
    scout_reverse: scoutsMeta[1]?.report_ref,
    contract_revise: body.contract_revised_ref,
    assessor: body.assessor_ref,
  };
  const coverageRefs = { scout_forward: scoutsMeta[0]?.coverage_ref, scout_reverse: scoutsMeta[1]?.coverage_ref };
  const seen = new Set();
  for (const role of ROLES) {
    if (!isObjectRef(refs[role])) { fail(`${role} stage ObjectRef required`); continue; }
    if (seen.has(refs[role].sha256)) fail(`stage refs must be distinct CAS objects (${role})`);
    seen.add(refs[role].sha256);
  }
  if (refEq(body.contract_original_ref, body.contract_revised_ref)) {
    fail("original and revised Contract stage refs must be distinct even if text is unchanged");
  }

  const expectedParents = {
    open_box: [],
    contract_box: [],
    scout_forward: [refs.contract_box],
    scout_reverse: [refs.contract_box],
    contract_revise: [refs.contract_box, refs.scout_forward, refs.scout_reverse],
    assessor: [refs.open_box, refs.contract_box, refs.contract_revise, refs.scout_forward, refs.scout_reverse],
  };
  const copies = [
    ["scout_forward", "initial_contract", "contract_box"],
    ["scout_reverse", "initial_contract", "contract_box"],
    ["contract_revise", "initial_contract", "contract_box"],
    ["assessor", "original_open", "open_box"],
    ["assessor", "original_contract", "contract_box"],
    ["assessor", "revised_contract", "contract_revise"],
  ];

  const stages = {};
  for (const role of ROLES) {
    if (!isObjectRef(refs[role])) continue;
    try { stages[role] = getStageEnvelope(refs[role], store); } catch (err) { fail(`${role} envelope: ${err.message}`); }
  }

  for (const role of ROLES) {
    const env = stages[role];
    if (!env) continue;
    const envelopeKeys = ["schema_version","evidence_class","wi","role","input","input_digest","output","launch","policy_digest","source_digest","parents","schema_digest"];
    if (Object.keys(env).some(k => !envelopeKeys.includes(k)) || envelopeKeys.some(k => !(k in env))) fail(`${role}: invalid envelope shape`);
    if (env.schema_version !== 1 || env.role !== role || env.wi !== body.wi) fail(`${role}: envelope schema/role/wi mismatch`);
    if (env.evidence_class !== expectedClass || env.launch?.evidence_class !== expectedClass) fail(`${role}: LIVE evidence_class required`);
    if (env.launch?.exit_code !== 0) fail(`${role}: exit_code 0 required`);
    if (!SHA_RE.test(env.policy_digest) || env.policy_digest !== body.policy_digest) fail(`${role}: policy_digest mismatch`);
    if (!SHA_RE.test(env.source_digest) || (sourceHash && env.source_digest !== sourceHash)) fail(`${role}: source_digest mismatch`);
    if (!SHA_RE.test(env.launch?.prompt_digest)) fail(`${role}: concrete prompt_digest required`);
    if (sha256Utf8(canonicalJson(env.input)) !== env.input_digest) fail(`${role}: input_digest mismatch`);
    try {
      if (env.schema_digest !== sha256Utf8(canonicalJson(outputSchemaForCall(role)))) fail(`${role}: schema_digest mismatch`);
    } catch (err) { fail(`${role}: schema ${err.message}`); }

    const bind = env.input?.bindings;
    if (!isPlain(bind) || bind.wi !== body.wi || canonicalJson(bind.policy_digest) !== canonicalJson(digestRef(body.policy_digest,"policy")) || canonicalJson(bind.source_digest) !== canonicalJson(digestRef(env.source_digest,"bytes"))
      || !refEq(bind.original_requirements_ref, body.original_requirements_ref)
      || !refEq(bind.frozen_facts_ref, body.frozen_facts_ref)
      || !refEq(bind.source_snapshot_ref, body.source_snapshot_ref)) {
      fail(`${role}: common bindings mismatch`);
    }
    const keys = Object.keys(env.input || {}).filter((k) => k !== "bindings").sort();
    const expectedKeys = [...INPUT_KEYS[role], ...(role === "assessor" && Object.hasOwn(env.input || {}, "constraints") ? ["constraints"] : [])];
    if (canonicalJson(keys) !== canonicalJson(expectedKeys.sort())) fail(`${role}: input shape ${keys.join(",")}`);
    if ((role === "scout_forward" || role === "scout_reverse" || role === "contract_revise")
      && Object.keys(env.input || {}).some((k) => /open/i.test(k))) {
      fail(`${role}: Open content refused`);
    }
    if ((role === "scout_forward" || role === "scout_reverse")
      && !Array.isArray(env.input?.initial_contract?.output?.decisions)) {
      fail(`${role}: Contract-only initial_contract required`);
    }

    const parents = Array.isArray(env.parents) ? env.parents : [];
    const want = expectedParents[role];
    if (parents.length !== want.length || want.some((p, i) => !refEq(parents[i], p))) fail(`${role}: parent graph mismatch`);

    const launch = env.launch || {};
    try { validateRoleOutput(role, env.output); } catch (err) { fail(`${role} output: ${err.message}`); }

    const stdoutGot = loadCas(launch.raw_stdout_ref, consumerRoot, errors, `${role} raw_stdout`);
    if (stdoutGot) {
      if (sha256Bytes(stdoutGot.bytes) !== launch.stdout_sha256 || launch.raw_stdout_ref.sha256 !== launch.stdout_sha256) {
        fail(`${role}: stdout_sha256 mismatch`);
      }
      try {
        const parsed = parseCodexJsonl(stdoutGot.bytes, role);
        if (canonicalJson(parsed) !== canonicalJson(env.output)) fail(`${role}: parsed stdout output !== stored output`);
      } catch (err) { fail(`${role} parseCodexJsonl: ${err.message}`); }
    }
    const stderrGot = loadCas(launch.raw_stderr_ref, consumerRoot, errors, `${role} raw_stderr`);
    if (stderrGot && sha256Bytes(stderrGot.bytes) !== launch.stderr_sha256) fail(`${role}: stderr_sha256 mismatch`);

    for (const msg of collectRetainedStageProofErrors(env, { consumerRoot, fixture, role })) fail(msg);

    if ((role === "open_box" || role === "contract_box" || role === "contract_revise" || role === "assessor") && reqGot && env.input?.requirements != null) {
      const actual = typeof env.input.requirements === "string"
        ? Buffer.from(env.input.requirements, "utf8")
        : Buffer.from(canonicalJson(env.input.requirements), "utf8");
      if (sha256Bytes(actual) !== reqGot.sha256) fail(`${role}: requirements payload !== original_requirements_ref`);
    }
    if ((role === "open_box" || role === "contract_box" || role === "contract_revise" || role === "assessor") && factsGot && env.input?.facts != null) {
      if (sha256Utf8(canonicalJson(env.input.facts)) !== factsGot.sha256) fail(`${role}: facts payload !== frozen_facts_ref`);
    }
  }

  const constraints = stages.contract_box?.input?.constraints;
  try {
    constraintSources(constraints);
    if (canonicalJson(stages.contract_revise?.input?.constraints) !== canonicalJson(constraints)) fail("revision constraints differ from frozen Contract input");
    // Historic empty-context packets need no new assessor field. Nonempty
    // constraints must be supplied identically to the decision maker.
    if (constraints?.paths?.length || stages.assessor?.input?.constraints != null) {
      if (canonicalJson(stages.assessor?.input?.constraints) !== canonicalJson(constraints)) fail("assessor constraints differ from frozen Contract input");
    }
  } catch (err) { fail(`constraints: ${err.message}`); }

  const promptDigests = ROLES.map(role => stages[role]?.launch?.prompt_digest);
  if (promptDigests.some(x=>!SHA_RE.test(x || "")) || body.prompt_digest !== sha256Utf8(canonicalJson(promptDigests))) fail("body.prompt_digest must bind all six launch prompts");
  if (canonicalJson(body.contamination_diagnosis) !== canonicalJson(stages.open_box?.launch?.proof?.diagnosis)) fail("Open contamination diagnosis differs from retained proof");
  for (const role of ROLES) {
    if (canonicalJson(body.tuple?.[role]) !== canonicalJson(stages[role]?.launch?.requested)) fail(`${role}: requested tuple differs from control`);
  }
  if (canonicalJson(body.tuple?.contract_revise) !== canonicalJson(body.tuple?.contract_box)) fail("revision must reuse Contract tuple");
  if (stages.contract_revise && canonicalJson(body.dispositions || []) !== canonicalJson(stages.contract_revise.output?.dispositions || [])) {
    fail("body.dispositions mismatch vs revised Contract");
  }

  for (const [role, field, parentRole] of copies) {
    const env = stages[role];
    const parent = stages[parentRole];
    if (!env || !parent) continue;
    const slot = env.input?.[field];
    if (!isPlain(slot) || slot.output == null) fail(`${role}: ${field} must include actual parent output, not only a hash`);
    else if (canonicalJson(slot.output) !== canonicalJson(parent.output)) fail(`${role}: ${field} output !== reopened ${parentRole}`);
    if (slot.ref && !refEq(slot.ref, refs[parentRole])) fail(`${role}: ${field} ref mismatch`);

  }

  for (const role of ["contract_revise", "assessor"]) {
    const reports = stages[role]?.input?.scout_reports;
    if (!Array.isArray(reports)) { fail(`${role}: scout_reports missing`); continue; }
    if (reports.length !== 2 || reports[0]?.role !== "scout_forward" || reports[1]?.role !== "scout_reverse") fail("reviser requires exactly two scout_reports");
    for (const entry of reports) {
      const st = stages[entry?.role];
      if (!st) { fail(`${role} scout ${entry?.role} missing`); continue; }
      if (canonicalJson(entry.output) !== canonicalJson(st.output) || !refEq(entry.ref, refs[entry.role])) fail(`${role} ${entry.role} output/ref !== reopened stage`);
      if (!refEq(entry.assignment_ref, st.input?.assignment?.ref) || canonicalJson(entry.assignment) !== canonicalJson(st.input?.assignment?.value)) fail(`${role} ${entry.role}: assignment differs`);
      const cov = parseJson(loadCas(coverageRefs[entry.role], consumerRoot, errors, `${role} coverage`),errors,`${role} coverage`);
      if (!refEq(entry.coverage_ref, coverageRefs[entry.role]) || canonicalJson(entry.coverage) !== canonicalJson(cov)) fail(`${role} ${entry.role}: coverage differs`);
    }
  }

  const assignments = {};
  for (const role of ["scout_forward", "scout_reverse"]) {
    const env = stages[role];
    if (!env) continue;
    const slot = env.input?.assignment;
    if (!isPlain(slot) || !isPlain(slot.value)) { fail(`${role}: assignment:{ref,value} required`); continue; }
    const assignment = slot.value;
    if (assignment.role !== role) fail(`${role}: assignment.role mismatch`);
    const { id, ...rest } = assignment;
    if (id !== sha256Utf8(canonicalJson(rest))) fail(`${role}: assignment id !== content hash`);
    if (slot.ref) {
      const stored = parseJson(loadCas(slot.ref, consumerRoot, errors, `${role} assignment.ref`), errors, `${role} assignment.ref json`);
      if (stored && canonicalJson(stored) !== canonicalJson(assignment)) fail(`${role}: assignment.ref bytes !== value`);
    }
    if (!Array.isArray(assignment.roots) || !Array.isArray(assignment.questions) || !assignment.roots.length || !assignment.questions.length) {
      fail(`${role}: roots and questions required`);
    }
    try {
      const computed = assignmentCoverage({ assignment, parsed: env.output, observed_reads: [] });
      const storedCov = parseJson(loadCas(coverageRefs[role], consumerRoot, errors, `${role} coverage_ref`), errors, `${role} coverage`);
      if (computed.assignment_id !== assignment.id) fail(`${role}: coverage assignment_id mismatch`);
      if (storedCov && canonicalJson(storedCov) !== canonicalJson(computed)) fail(`${role}: coverage object differs from recomputation`);
      assignments[role] = assignment;
    } catch (err) { fail(`${role} assignmentCoverage: ${err.message}`); }
  }
  if (assignments.scout_forward && assignments.scout_reverse && snapshot && stages.contract_box) {
    try {
      const facts = JSON.parse(factsGot.bytes.toString("utf8"));
      const computed = assignDualPass({sourceSnapshot:snapshot,initialContract:stages.contract_box.output,consumerRoot,constraints,changeArchetype:facts.annotations?.change_archetype || "feature"});
      for (const role of ["scout_forward","scout_reverse"]) if (canonicalJson(assignments[role]) !== canonicalJson(computed[role])) fail(`${role}: assignment not derived from actual source snapshot`);
      const exposure = facts.source_exposure;
      if (!exposure || exposure.base_sha !== snapshot.base_sha || exposure.tree !== snapshot.tree || exposure.gitCommonDir !== identity.gitCommonDir || exposure.repoRoot !== identity.repoRoot) fail("factual source exposure differs from actual snapshot");
      const expectedFiles = snapshot.scoped_files.map(sf=>({path:sf.path,sha256:sf.sha256,truncated:sf.truncated,ranges:sf.ranges,text:getObject(sf.object_ref.sha256,{start:consumerRoot}).bytes.toString("utf8")}));
      if (canonicalJson(exposure?.files) !== canonicalJson(expectedFiles)) fail("factual source bytes differ from snapshot");
    } catch (err) { fail(`assignment/source recomputation: ${err.message}`); }
  }

  if (stages.contract_revise && stages.scout_forward && stages.scout_reverse) {
    const findings = [...(stages.scout_forward.output?.findings || []), ...(stages.scout_reverse.output?.findings || [])];
    const gaps = [...(assignments.scout_forward?.known_gaps || []), ...(assignments.scout_reverse?.known_gaps || []), ...(stages.scout_forward.output?.unread_gaps || []), ...(stages.scout_reverse.output?.unread_gaps || [])]
      .filter((g) => g && g.consequential !== false);
    try {
      validateRoleOutput("contract_revise", stages.contract_revise.output, { scoutFindings: findings, consequentialGaps: gaps });
    } catch (err) { fail(`revise dispositions: ${err.message}`); }
  }

  if (stages.assessor) {
    try {
      const normalized = normalizeSelection(stages.assessor.output);
      if (body.chosen_solution?.winner !== normalized.winner) fail("chosen_solution.winner mismatch vs assessor");
      if (canonicalJson(body.chosen_solution?.selected_decisions) !== canonicalJson(normalized.selected_decisions)) {
        fail("chosen_solution.selected_decisions mismatch vs assessor");
      }
      if (canonicalJson(body.chosen_solution?.rejection_dispositions || []) !== canonicalJson(normalized.rejection_dispositions || [])) {
        fail("chosen_solution.rejection_dispositions mismatch vs assessor");
      }
      if ((body.chosen_solution?.unresolved_conflicts || []).length || (stages.assessor.output.unresolved_conflicts || []).length) {
        fail("unresolved conflicts block control-plan");
      }
    } catch (err) { fail(`assessor selection: ${err.message}`); }

    const paras = openParagraphs(stages.open_box?.output?.plan);
    const openIds = new Set(paras.map((p) => p.id));
    const contractIds = new Set([
      ...(stages.contract_box?.output?.decisions || []).map((d) => `contract-original:${d.id}`),
      ...(stages.contract_revise?.output?.decisions || []).map((d) => `contract-revised:${d.id}`),
    ]);
    const known = new Set([...openIds, ...contractIds]);
    const bySource=new Map([
      ...(stages.contract_box?.output?.decisions || []).map(d=>[`contract-original:${d.id}`,d]),
      ...(stages.contract_revise?.output?.decisions || []).map(d=>[`contract-revised:${d.id}`,d]),
    ]);
    const reqSet = new Set();

    if (reqGot) {
      const text = reqGot.bytes.toString("utf8");
      try {
        for (const id of idsFrom(JSON.parse(text))) reqSet.add(id);
      } catch (err) {
        if (String(text).trim().startsWith("{") || String(text).trim().startsWith("[")) fail(`original requirements JSON: ${err.message}`);
      }
    }
    if (specBindings != null) {
      if (!isPlain(specBindings)) fail("specBindings must be an object");
      else {
        if (callerFlag(specBindings)) fail("specBindings verified/effective is not authority");
        for (const rel of specBindings.spec_paths || specBindings.specPaths || []) {
          try {
            containRel(cwd, rel);
            if (snapshot?.base_sha) gitBlobBytes(cwd, snapshot.base_sha, rel);
          } catch (err) { fail(`specBindings path: ${err.message}`); }
        }
        if (specBindings.requirements != null && reqGot) {
          const bytes = typeof specBindings.requirements === "string"
            ? Buffer.from(specBindings.requirements, "utf8")
            : Buffer.from(canonicalJson(specBindings.requirements), "utf8");
          if (sha256Bytes(bytes) !== reqGot.sha256) fail("specBindings.requirements !== original_requirements_ref bytes");
          for (const id of idsFrom(specBindings.requirements)) reqSet.add(id);
        }
        for (const id of idsFrom(specBindings.spec)) reqSet.add(id);
        if (Array.isArray(specBindings.requirement_ids)) {
          if (canonicalJson([...reqSet].sort()) !== canonicalJson([...specBindings.requirement_ids].sort())) fail("supplied requirement IDs differ from original source; cannot narrow coverage");
        }
      }
    }
    for(const candidate of [stages.contract_box?.output,stages.contract_revise?.output]) {
      const decisions=candidate?.decisions || [];
      if(new Set(decisions.map(d=>d.id)).size!==decisions.length) fail("duplicate Contract decision IDs");
      for(const decision of decisions) if(decision.original_requirement_ids.some(id=>!reqSet.has(id))) fail("Contract decision cites unknown original requirement");
    }
    const selected = stages.assessor.output?.selected_decisions || [];
    const covered = new Set(selected.map((s) => s.original_requirement_id));
    for (const id of reqSet) if (!covered.has(id)) fail(`missing selected decision for requirement ${id}`);
    {
      for (const id of covered) if (!reqSet.has(id)) fail(`selected requirement ${id} is not in authoritative specBindings`);
    }
    if (canonicalJson(stages.assessor.input?.open_paragraphs) !== canonicalJson(paras)) fail("Open paragraph IDs/text must derive from unmodified original");
    for (const sel of selected) {
      for (const sid of sel.source_ids || []) {
        if (!known.has(sid)) fail(`invented source_id ${sid}`);
        if (bySource.has(sid) && !bySource.get(sid).original_requirement_ids.includes(sel.original_requirement_id)) fail(`Contract source ${sid} belongs to another requirement`);
        if (sel.origin === "open_box" && !openIds.has(sid)) fail(`open_box origin requires Open paragraph id ${sid}`);
        if (sel.origin === "contract_box" && !contractIds.has(sid)) fail(`contract_box origin requires Contract decision id ${sid}`);
      }
      if (!known.has(sel.decision_id) || !(sel.source_ids || []).includes(sel.decision_id)) {
        fail(`invented decision_id ${sel.decision_id}`);
      }
      if (sel.origin === "combination" && !(sel.source_ids.some(id=>openIds.has(id)) && sel.source_ids.some(id=>contractIds.has(id)))) fail("combination selection must cite both origins");
    }
    const allSourceIds = selected.flatMap(sel=>sel.source_ids);
    if (stages.assessor.output.winner === "open_win" && allSourceIds.some(id=>!openIds.has(id))) fail("Open winner cannot retain Contract decisions");
    if (stages.assessor.output.winner === "contract_win" && allSourceIds.some(id=>!contractIds.has(id))) fail("Contract winner cannot retain Open decisions");
    if (stages.assessor.output.winner === "combination" && !(allSourceIds.some(id=>openIds.has(id)) && allSourceIds.some(id=>contractIds.has(id)))) fail("combination winner must retain both origins");
  }

  return { ok: errors.length === 0, errors };
}

export function validateControlPlan(options = {}) {
  try { return validateControlPlanCore(options); } catch (error) { return {ok:false,errors:[error.message]}; }
}
// Explicit synthetic evidence validation; never issuance/execution authority.
export function validateControlPlanFixture(options = {}) {
  if (options.body?.evidence_class !== "OFFLINE") return {ok:false,executable:false,evidence_class:"OFFLINE",errors:["OFFLINE fixture required"]};
  try { return {...validateControlPlanCore(options,true),executable:false,evidence_class:"OFFLINE"}; }
  catch (error) { return {ok:false,executable:false,evidence_class:"OFFLINE",errors:[error.message]}; }
}
