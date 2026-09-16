#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveDispatchRoleTuple } from "./resolve-dispatch.mjs";
import { putObject } from "./lib/review-evidence-store.mjs";
import { readJsonAtomic, updateJsonAtomic, withStateLock } from "./state-io.mjs";
import {
  CoverageGap,
  DEFAULT_LIMITS,
  IsolationUnsupported,
  PLANNING_ROLES,
  UnresolvedConflict,
  buildSourceSnapshot,
  canonicalJson,
  canonicalPolicyHash,
  canonicalSourceHash,
  digestRef,
  draftControlPlanV2,
  evaluateEligibility,
  getByRef,
  getStageEnvelope,
  normalizeSelection,
  objectRef,
  outputSchemaForCall,
  persistOriginalInputs,
  resumeKey,
  sha256Bytes,
  sha256Utf8,
  storeStageEnvelope,
  validateRoleOutput,
} from "./lib/two-box-protocol.mjs";
import { diagnosePromptContamination } from "./lib/isolated-plan-analysis.mjs";
import { assignDualPass, assignmentCoverage, constraintSources } from "./lib/two-box-scout-assign.mjs";
import { buildRolePrompt, launchRole, preflightRole, parseCodexJsonl } from "./lib/two-box-role-launch.mjs";

const PROBE = "CAPABILITY_PROBE_NOT_STAGE_RESULT";
const DESCENDANTS = Object.freeze({
  open_box: ["open_box", "assessor"],
  contract_box: ["contract_box", "scout_forward", "scout_reverse", "contract_revise", "assessor"],
  scout_forward: ["scout_forward", "contract_revise", "assessor"],
  scout_reverse: ["scout_reverse", "contract_revise", "assessor"],
  contract_revise: ["contract_revise", "assessor"],
  assessor: ["assessor"],
});
const FEATURES_OFF = [
  "shell_tool", "unified_exec", "multi_agent", "multi_agent_v2", "plugins", "apps",
  "view_image", "browser_use", "computer_use", "memories", "remote_plugin",
  "workspace_dependencies", "skill_search", "image_generation", "hooks",
  "code_mode", "code_mode_host", "tool_suggest",
];
const FEATURES_TEXT = [...FEATURES_OFF.map((n) => `${n} disabled false`), "skip_host_skill_discovery skip true"].join("\n");
const HELP_EXEC = [
  "Usage: codex exec [OPTIONS]",
  "--ephemeral  ephemeral thread",
  "--sandbox <mode>",
  "--ignore-user-config",
  "--skip-git-repo-check",
  "--json",
  "--output-schema <path>",
  "--config",
  "--model",
].join("\n");
const HELP_DEBUG = "Usage: codex debug prompt-input [--config] <prompt>";
const DISPATCH_PASS = [
  ["configPath", "configPath"], ["config", "configPath"], ["mode", "mode"],
  ["orchestrator", "orchestrator"], ["sessionId", "sessionId"],
  ["workOverlayPath", "workOverlayPath"], ["sessionOverrideSpec", "sessionOverrideSpec"],
  ["sessionOverrideRequested", "sessionOverrideRequested"],
  ["sessionOverrideReceiptSpec", "sessionOverrideReceiptSpec"],
];
const DISPATCH_BAN = ["tuple", "tuples", "host", "model", "effort", "runners", "runner", "customenv", "source_tree"];
const REAL_BAN = ["source_tree", "sourceTree", "runners", "runner", "customenv", "commitSha", "historicalSha"];
const SECRET_BASE = /^(?:\.env(?:\..*)?|credentials\.json|id_rsa|id_ed25519)$/i;
const WI_RE = /^WI-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TREE40_RE = /^[0-9a-f]{40}$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function assertNoSymlink(target) {
  try {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`refusing symlink: ${target}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function containRel(root, rel) {
  if (typeof rel !== "string" || !rel) throw new Error("scoped path required");
  if (path.isAbsolute(rel) || rel.includes("\0") || rel.startsWith("~")) throw new Error(`refusing non-contained path: ${rel}`);
  if (rel.includes("\\") || rel.split("/").some((p) => p === ".." || p === "." || !p)) {
    throw new Error(`refusing non-canonical scoped path: ${rel}`);
  }
  if (rel === ".git" || rel.startsWith(".git/")) throw new Error(`refusing .git path: ${rel}`);
  const base = path.posix.basename(rel);
  if (SECRET_BASE.test(base) || /\.pem$/i.test(base)) throw new Error(`refusing secret config path: ${rel}`);
  let acc = root;
  for (const part of rel.split("/")) {
    acc = path.join(acc, part);
    assertNoSymlink(acc);
  }
  return rel;
}

function publicTuple(resolved) {
  const t = resolved.tuple;
  return { host: t.host, family: t.family, model: t.model, effort: t.effort };
}

function nativeInspectionFixture({ cwd, prompt } = {}) {
  const permissions = "<permissions instructions>\nFollow native host safety. Do not use tools.\n</permissions instructions>";
  const env = `<environment_context>\n<cwd>${cwd}</cwd>\n</environment_context>`;
  return [
    { role: "developer", content: [{ type: "input_text", text: permissions }] },
    { role: "user", content: [{ type: "input_text", text: env }] },
    { role: "user", content: [{ type: "input_text", text: prompt }] },
  ];
}

function resolveInspect(value) {
  if (value == null || value === "native" || value === "nativeInspectionFixture") return nativeInspectionFixture;
  if (typeof value === "function") return value;
  throw new Error("unsupported OFFLINE inspect fixture");
}

function normalizeRequirements(original) {
  if (original === undefined || original === null) throw new Error("original requirements required");
  if (typeof original === "string") {
    if (!original.trim()) throw new Error("original requirements required");
    return [{ id: "REQ1", text: original }];
  }
  if (!Array.isArray(original) || !original.length) throw new Error("original requirements required");
  const out = original.map((row) => {
    if (!isPlainObject(row) || typeof row.id !== "string" || !row.id || typeof row.text !== "string" || !row.text) {
      throw new Error("original requirements array entries must be {id,text}");
    }
    return { id: row.id, text: row.text };
  });
  if (new Set(out.map((r) => r.id)).size !== out.length) throw new Error("original requirement ids must be unique");
  return out;
}

function journalPaths(root, wi) {
  if (!WI_RE.test(wi)) throw new Error("stage WI required");
  const parts = [".svc", "two-box", wi];
  let acc = path.resolve(root);
  assertNoSymlink(acc);
  for (const part of parts) {
    acc = path.join(acc, part);
    assertNoSymlink(acc);
  }
  const journalPath = path.join(acc, "journal.json");
  const runPath = path.join(acc, "run.json");
  assertNoSymlink(journalPath);
  assertNoSymlink(runPath);
  return { journalPath, runPath };
}

function emptyJournal(wi) {
  return { schema_version: 1, wi, stages: {}, history: [] };
}

function patchJournal(journalPath, wi, updater) {
  assertNoSymlink(journalPath);
  return updateJsonAtomic(journalPath, (cur) => updater(cur ?? emptyJournal(wi)), emptyJournal(wi));
}

function invalidateFrom(journal, role, reason) {
  const chain = DESCENDANTS[role] || [role];
  const history = [...(journal.history || [])];
  const stages = { ...journal.stages };
  const at = new Date().toISOString();
  for (const r of chain) {
    if (stages[r]) {
      history.push({ ...stages[r], role: r, invalidated_at: at, reason });
      delete stages[r];
    }
  }
  return { ...journal, stages, history };
}

async function withRunClaim(runPath, fn) {
  withStateLock(runPath, () => {
    const cur = readJsonAtomic(runPath);
    if (cur && pidAlive(cur.pid)) throw new Error("concurrent two-box run");
    fs.writeFileSync(runPath, `${JSON.stringify({ pid: process.pid, ts: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  });
  try {
    return await fn();
  } finally {
    withStateLock(runPath, () => {
      const cur = readJsonAtomic(runPath);
      if (cur?.pid === process.pid) {
        try { fs.unlinkSync(runPath); } catch { /* claim already gone */ }
      }
    });
  }
}

function dispatchOpts(dispatch, wi, consumerRoot) {
  if (!isPlainObject(dispatch)) throw new Error("dispatch must be an object");
  for (const key of DISPATCH_BAN) {
    if (Object.hasOwn(dispatch, key)) throw new Error(`dispatch must not supply ${key} authority`);
  }
  if (dispatch.cwd && path.resolve(dispatch.cwd) !== path.resolve(consumerRoot)) throw new Error("dispatch cwd must be the consumer root");
  const opts = { wi, cwd: consumerRoot };
  for (const [from, to] of DISPATCH_PASS) {
    if (dispatch[from] != null) opts[to] = dispatch[from];
  }
  return opts;
}

function inheritRevise(contractBox) {
  return {
    ...contractBox,
    role: "contract_revise",
    requested_role: "contract_revise",
    inherited_role: "contract_box",
    inherited_label: contractBox.inherited_label ?? "PLAN",
    tuple: { ...contractBox.tuple },
  };
}

function eligibilityInject(offline) {
  if (typeof offline?.inject?.runner === "function") return offline.inject;
  const recorded = offline?.eligibility;
  if (recorded && typeof recorded.stdout === "string") {
    return { runner: () => ({ stdout: recorded.stdout, status: recorded.status ?? 1 }) };
  }
  return {
    runner: () => ({
      stdout: JSON.stringify({ eligible: false, reasons: ["OFFLINE default nonexempt"], tree_hash: "unknown" }),
      status: 1,
    }),
  };
}

function offlineIsolation(offline) {
  const iso = {
    binary: offline.binary ?? process.execPath,
    helpText: offline.helpText ?? { exec: HELP_EXEC, debug: HELP_DEBUG },
    featuresText: offline.featuresText ?? FEATURES_TEXT,
    inspectPrompt: resolveInspect(offline.inspectPrompt),
    version: offline.version ?? "OFFLINE",
    discoveredSkills: offline.discoveredSkills ?? [],
  };
  if (offline.extraRoots) iso.extraRoots = offline.extraRoots;
  if (offline.includeSystem) iso.includeSystem = true;
  if (offline.customenv) iso.customenv = offline.customenv;
  return iso;
}

function offlineForRole(offline, role) {
  const iso = offlineIsolation(offline);
  const row = offline.outputs?.[role] ?? offline.stages?.[role];
  if (row == null) throw new Error(`OFFLINE missing recorded output for ${role}`);
  if (isPlainObject(row) && row.stdout == null && row.output == null && (row.plan || row.decisions || row.winner || row.findings)) {
    return { ...iso, output: row, usage: row.usage ?? null, stderr: row.stderr, exit_code: row.exit_code ?? 0 };
  }
  if (isPlainObject(row) && row.output && row.stdout == null) {
    return { ...iso, output: row.output, usage: row.usage ?? null, stderr: row.stderr, exit_code: row.exit_code ?? 0 };
  }
  return {
    ...iso,
    stdout: isPlainObject(row) ? row.stdout : row,
    stderr: row.stderr,
    usage: row.usage,
    exit_code: row.exit_code ?? 0,
  };
}

function contextPaths(contractContext) {
  if (contractContext == null) return [];
  if (Array.isArray(contractContext)) return contractContext;
  if (isPlainObject(contractContext) && Array.isArray(contractContext.paths)) return contractContext.paths;
  throw new Error("contractContext must name contained spec/design paths");
}

function readConstraints(cwd, baseSha, contractContext) {
  const paths = contextPaths(contractContext);
  const files = [];
  for (const relRaw of paths) {
    const rel = containRel(cwd, relRaw);
    const full = path.join(cwd, rel);
    if (!fs.statSync(full).isFile()) throw new CoverageGap(`contractContext is not a file: ${rel}`);
    const bytes = fs.readFileSync(full);
    if (bytes.length > DEFAULT_LIMITS.maxBytes || bytes.includes(0)) throw new CoverageGap(`contractContext exceeds text budget: ${rel}`);
    files.push({ path: rel, sha256: sha256Bytes(bytes), text: Buffer.from(bytes).toString("utf8") });
  }
  return { paths: files };
}

function sourceExposure(snapshot, start) {
  return {
    declared: true,
    gitCommonDir: snapshot.identity.gitCommonDir,
    repoRoot: snapshot.identity.repoRoot,
    base_sha: snapshot.base_sha,
    tree: snapshot.tree,
    files: snapshot.scoped_files.map((sf) => {
      const { bytes } = getByRef(sf.object_ref, { start });
      return {
        path: sf.path,
        sha256: sf.sha256,
        truncated: sf.truncated,
        ranges: sf.ranges,
        text: Buffer.from(bytes).toString("utf8"),
      };
    }),
  };
}

function openParagraphs(plan) {
  const paras = String(plan).split(/\n\n+/).filter(text => text.trim());
  return paras.map((text, i) => ({ id: `open:P${i + 1}`, text, sha256: sha256Utf8(text) }));
}

function putJson(value, start) {
  const stored = putObject(Buffer.from(`${canonicalJson(value)}\n`, "utf8"), { start });
  return objectRef(stored.sha256);
}

function stageKey({ role, input, prompt, schema, sourceDigest, policyDigest, tuple, proof, parents, evidenceClass }) {
  return sha256Utf8(canonicalJson({
    role,
    input_digest: sha256Utf8(canonicalJson(input)),
    prompt_digest: sha256Utf8(prompt),
    schema_digest: sha256Utf8(canonicalJson(schema)),
    source_digest: sourceDigest,
    policy_digest: policyDigest,
    tuple: { host: tuple.host, family: tuple.family, model: tuple.model, effort: tuple.effort },
    binary_sha256: proof.binary?.sha256 ?? null,
    skills_sha256: proof.disabled_skills_sha256 ?? null,
    config_sha256: proof.config_sha256 ?? null,
    parents,
    evidence_class: evidenceClass,
  }));
}

function verifyEnvelope(ref, { consumerRoot, wi, role, input, policyDigest, sourceDigest, parents, evidenceClass, context }) {
  const envelope = getStageEnvelope(ref, { start: consumerRoot });
  if (envelope.wi !== wi || envelope.role !== role) return null;
  if (envelope.evidence_class !== evidenceClass) return null;
  if (envelope.policy_digest !== policyDigest || envelope.source_digest !== sourceDigest) return null;
  if (canonicalJson(envelope.input) !== canonicalJson(input)) return null;
  if (canonicalJson(envelope.parents) !== canonicalJson(parents)) return null;
  const stdout = getByRef(envelope.launch.raw_stdout_ref, { start: consumerRoot });
  const stderr = getByRef(envelope.launch.raw_stderr_ref, { start: consumerRoot });
  if (sha256Bytes(stdout.bytes) !== envelope.launch.stdout_sha256) return null;
  if (sha256Bytes(stderr.bytes) !== envelope.launch.stderr_sha256) return null;
  validateRoleOutput(role, envelope.output, context);
  if (role === "scout_forward" || role === "scout_reverse") assignmentCoverage({assignment:input.assignment.value,parsed:envelope.output});
  if (evidenceClass === "LIVE" || stdout.bytes.length) {
    if(canonicalJson(parseCodexJsonl(stdout.bytes,role)) !== canonicalJson(envelope.output)) return null;
  }
  if(envelope.launch.prompt_digest !== sha256Utf8(buildRolePrompt({role,payload:input}))) return null;
  if(envelope.launch.exit_code !== 0 || envelope.input_digest !== sha256Utf8(canonicalJson(input))) return null;
  return envelope;
}

function probePayload(role, bindings, probeRef, requirements) {
  const rid = requirements[0].id;
  const contract = {
    plan: PROBE,
    decisions: [{ id: "PROBE-D1", original_requirement_ids: [rid], source_citations: [], text: PROBE }],
  };
  const scout = {
    findings: [],
    citations: [],
    unread_gaps: [],
    supplied_denominator: { files: [], ranges: [] },
    incomplete: true,
  };
  const assignment = {
    ref: probeRef,
    value: { excerpts: [{ path: "probe", start_line: 1, end_line: 1, text: PROBE }] },
  };
  const reports = [
    { role: "scout_forward", ref: probeRef, output: scout },
    { role: "scout_reverse", ref: probeRef, output: scout },
  ];
  const facts = { annotations: { [PROBE]: true } };
  const constraints = { paths: [] };
  const common = { bindings, requirements, facts };
  if (role === "open_box") return { ...common };
  if (role === "contract_box") return { ...common, constraints };
  if (role === "scout_forward" || role === "scout_reverse") {
    return { bindings, initial_contract: { ref: probeRef, output: contract }, assignment };
  }
  if (role === "contract_revise") {
    return { ...common, constraints, initial_contract: { ref: probeRef, output: contract }, scout_reports: reports };
  }
  return {
    ...common,
    original_open: { ref: probeRef, output: { plan: PROBE } },
    original_contract: { ref: probeRef, output: contract },
    revised_contract: { ref: probeRef, output: contract },
    scout_reports: reports,
    open_paragraphs: [{ id: "open:P1", text: PROBE, sha256: sha256Utf8(PROBE) }],
  };
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new Error("aborted");
}

function assertSourceIds(output, { requirementIds, paragraphs, originalDecisions, revisedDecisions }) {
  const allowed = new Set(paragraphs.map((p) => p.id));
  for (const d of originalDecisions) allowed.add(`contract-original:${d.id}`);
  for (const d of revisedDecisions) allowed.add(`contract-revised:${d.id}`);
  const bySource = new Map([...originalDecisions.map(d=>[`contract-original:${d.id}`,d]),...revisedDecisions.map(d=>[`contract-revised:${d.id}`,d])]);
  const covered = new Set();
  const allIds = [];
  for (const row of output.selected_decisions) {
    if (!requirementIds.has(row.original_requirement_id)) throw new UnresolvedConflict(`unknown selected requirement ${row.original_requirement_id}`);
    covered.add(row.original_requirement_id);
    if (!row.source_ids.includes(row.decision_id)) throw new UnresolvedConflict(`decision_id must name a selected source: ${row.decision_id}`);
    for (const sid of row.source_ids) {
      if (!allowed.has(sid)) throw new UnresolvedConflict(`unknown source_id ${sid}`);
      if (bySource.has(sid) && !bySource.get(sid).original_requirement_ids.includes(row.original_requirement_id)) throw new UnresolvedConflict(`source ${sid} belongs to another requirement`);
      allIds.push(sid);
    }
    if (row.origin === "open_box" && row.source_ids.some((s) => !s.startsWith("open:"))) {
      throw new UnresolvedConflict("open origin cited a non-open source_id");
    }
    if (row.origin === "contract_box" && row.source_ids.some((s) => !s.startsWith("contract-"))) {
      throw new UnresolvedConflict("contract origin cited a non-contract source_id");
    }
    if (row.origin === "combination") {
      const hasOpen = row.source_ids.some((s) => s.startsWith("open:"));
      const hasContract = row.source_ids.some((s) => s.startsWith("contract-"));
      if (!hasOpen || !hasContract) throw new UnresolvedConflict("combination row is not grounded in both parts");
    }
  }
  for (const id of requirementIds) {
    if (!covered.has(id)) throw new UnresolvedConflict(`unselected original requirement ${id}`);
  }
  if (output.winner === "open_win" && allIds.some(id => !id.startsWith("open:"))) throw new UnresolvedConflict("open winner cannot retain Contract decisions");
  if (output.winner === "contract_win" && allIds.some(id => !id.startsWith("contract-"))) throw new UnresolvedConflict("Contract winner cannot retain Open decisions");
  if (output.winner === "combination") {
    const hasOpen = allIds.some((s) => s.startsWith("open:"));
    const hasContract = allIds.some((s) => s.startsWith("contract-"));
    if (!hasOpen || !hasContract) throw new UnresolvedConflict("combination is not grounded in both parts");
  }
}

function scoutGapContext(assignments, coverages, outputs) {
  const scoutFindings = [...(outputs.scout_forward.findings || []), ...(outputs.scout_reverse.findings || [])];
  const gapLists = [
    assignments.scout_forward.known_gaps,
    assignments.scout_reverse.known_gaps,
    coverages.scout_forward.unresolved_gaps,
    coverages.scout_reverse.unresolved_gaps,
    outputs.scout_forward.unread_gaps,
    outputs.scout_reverse.unread_gaps,
  ];
  const map = new Map();
  for (const gap of gapLists.flat()) {
    if (!gap || typeof gap.reason !== "string") continue;
    if (gap.consequential === false) continue;
    const key = canonicalJson({ path: gap.path ?? null, reason: gap.reason, start_line: gap.start_line ?? null, end_line: gap.end_line ?? null });
    if (!map.has(key)) map.set(key, gap);
  }
  return { scoutFindings, consequentialGaps: [...map.values()] };
}

function usageFrom(collected) {
  const usage = {};
  for (const role of PLANNING_ROLES) {
    const u = collected[role]?.envelope?.launch?.usage;
    if (u != null) usage[role] = u;
  }
  return Object.keys(usage).length ? usage : null;
}

async function loadValidateControlPlan() {
  try {
    const mod = await import("./lib/control-plan-validate.mjs");
    return typeof mod.validateControlPlan === "function" ? mod.validateControlPlan : null;
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  }
}

async function runSix(ctx) {
  const {
    mode, offline, consumerRoot, wi, requirements, snapshot, bindings, tuples,
    policyHash, journalPath, signal, limits, contractContext, eligibility, resume, sourceHash,
  } = ctx;
  const evidenceClass = mode === "OFFLINE" ? "OFFLINE" : "LIVE";
  const isoMode = mode === "OFFLINE" ? "offline" : "live";
  const offlineOpts = mode === "OFFLINE" ? offline : {};
  const start = consumerRoot;
  const frozenFacts = JSON.parse(getByRef(bindings.frozen_facts_ref, { start }).bytes.toString("utf8"));
  const factsPayload = frozenFacts;
  const constraints = readConstraints(consumerRoot, snapshot.base_sha, contractContext);
  constraintSources(constraints);
  const probeRef = putJson({ [PROBE]: true }, start);
  const cleanups = [];
  try {
    for (const role of PLANNING_ROLES) {
      throwIfAborted(signal);
      const pre = preflightRole({
        role,
        tuple: tuples[role].tuple,
        payload: probePayload(role, bindings, probeRef, requirements),
        schema: outputSchemaForCall(role),
        sourceBindings: { consumerRoot, planning_transport: tuples[role].planning_transport },
        mode: isoMode,
        ...(mode === "OFFLINE" ? { offline: offlineIsolation(offlineOpts) } : {}),
      });
      cleanups.push(pre.cleanup);
      if (mode === "OFFLINE" && pre.proof?.effective?.usable_live) throw new IsolationUnsupported("OFFLINE proof cannot be usable_live");
      if (mode === "live" && pre.proof?.effective?.usable_live !== true) throw new IsolationUnsupported("isolation proof is not usable live");
    }
  } finally {
    for (const cleanup of cleanups) {
      try { cleanup(); } catch { /* leftover dir is not authority */ }
    }
  }

  const collected = {};
  const maxNewCalls = limits?.maxNewCalls ?? 6;
  if (!Number.isInteger(maxNewCalls) || maxNewCalls < 0 || maxNewCalls > 6) throw new Error("maxNewCalls must be an integer from 0 to 6");
  let newProviderCalls = 0;
  const sourceBindingsFor = (role) => ({ consumerRoot, planning_transport: tuples[role].planning_transport });

  async function runStage(role, payload, parents, context = {}) {
    throwIfAborted(signal);
    const schema = outputSchemaForCall(role);
    const tuple = tuples[role].tuple;
    const prompt = buildRolePrompt({ role, payload });
    const pre = preflightRole({
      role, tuple, payload, schema,
      sourceBindings: sourceBindingsFor(role),
      mode: isoMode,
      ...(mode === "OFFLINE" ? { offline: offlineIsolation(offlineOpts) } : {}),
    });
    try {
      const key = stageKey({
        role, input: payload, prompt, schema, sourceDigest: sourceHash, policyDigest: policyHash,
        tuple, proof: pre.proof, parents, evidenceClass,
      });
      const current = (readJsonAtomic(journalPath) ?? emptyJournal(wi)).stages?.[role];
      if (current?.status === "failed" && current.key === key) {
        throw new Error(`failed content attempt blocked until input changes (${role}): ${current.error || "failed"}`);
      }
      if (current?.status === "running" && current.key === key) {
        throw new Error("interrupted provider attempt cannot be assumed zero-cost; change input or explicit decision to retry");
      }
      if (current && current.key !== key) {
        patchJournal(journalPath, wi, (j) => invalidateFrom(j, role, "stage_input_changed"));
      } else if (current?.status === "completed" && current.ref) {
        const reused = verifyEnvelope(current.ref, {
          consumerRoot, wi, role, input: payload, policyDigest: policyHash,
          sourceDigest: sourceHash, parents, evidenceClass, context,
        });
        if (!reused) throw new Error(`completed ${role} failed CAS/binding verification`);
        collected[role] = { ref: current.ref, envelope: reused, key };
        return collected[role];
      }
      if (newProviderCalls >= maxNewCalls) throw new Error("new provider call budget exhausted; retained stages remain resumable");
      newProviderCalls += 1;
      patchJournal(journalPath, wi, (j) => ({
        ...j,
        stages: { ...j.stages, [role]: { status: "running", key, started_at: new Date().toISOString() } },
        attempts: [...(j.attempts || []), {role,key,started_at:new Date().toISOString()}],
      }));
      let launch, output;
      try {
        launch = await launchRole({
          role, tuple, payload, schema,
          sourceBindings: sourceBindingsFor(role),
          signal, limits,
          mode: isoMode,
          ...(mode === "OFFLINE" ? { offline: offlineForRole(offlineOpts, role) } : {}),
        });
        output = validateRoleOutput(role, launch.output, context);
        if (role === "scout_forward" || role === "scout_reverse") assignmentCoverage({assignment:payload.assignment.value,parsed:output});
      } catch (error) {
        if (launch) {
          error.rawStdout = launch.rawStdout;
          error.rawStderr = launch.rawStderr;
          error.attempts = launch.attempts;
        }
        const spawned = error.name === "LaunchFailed" || error.rawStdout != null || error.rawStderr != null;
        if (spawned) {
          const out = putObject(Buffer.isBuffer(error.rawStdout) ? error.rawStdout : Buffer.from(error.rawStdout ?? ""), { start });
          const err = putObject(Buffer.isBuffer(error.rawStderr) ? error.rawStderr : Buffer.from(error.rawStderr ?? ""), { start });
          patchJournal(journalPath, wi, (j) => ({
            ...j,
            stages: {
              ...j.stages,
              [role]: {
                status: "failed",
                key,
                error: error.message,
                attempts: error.attempts ?? 1,
                raw_stdout_ref: objectRef(out.sha256),
                raw_stderr_ref: objectRef(err.sha256),
              },
            },
          }));
        } else {
          patchJournal(journalPath, wi, (j) => {
            const stages = { ...j.stages };
            if (stages[role]?.status === "running" && stages[role].key === key) delete stages[role];
            return { ...j, stages };
          });
        }
        throw error;
      }
      const stored = storeStageEnvelope({
        wi, role, input: payload, launch: { ...launch, output, evidence_class: evidenceClass },
        policy: policyHash, source: snapshot, parents, schema, start, env: undefined,
      });
      patchJournal(journalPath, wi, (j) => ({
        ...j,
        stages: { ...j.stages, [role]: { status: "completed", key, ref: stored.ref } },
      }));
      collected[role] = { ref: stored.ref, envelope: stored.envelope, key, launch };
      return collected[role];
    } finally {
      if (pre?.cleanup) pre.cleanup();
    }
  }

  const openPayload = { bindings, requirements, facts: factsPayload };
  await runStage("open_box", openPayload, []);
  const contractPayload = { bindings, requirements, facts: factsPayload, constraints };
  await runStage("contract_box", contractPayload, []);
  const initialContract = collected.contract_box.envelope.output;
  const assignments = assignDualPass({
    sourceSnapshot: snapshot,
    initialContract,
    consumerRoot,
    constraints,
    changeArchetype: typeof frozenFacts.annotations?.change_archetype === "string" ? frozenFacts.annotations.change_archetype : "feature",
  });
  const assignRefs = {
    scout_forward: putJson(assignments.scout_forward, start),
    scout_reverse: putJson(assignments.scout_reverse, start),
  };
  const contractParents = [collected.contract_box.ref];
  for (const role of ["scout_forward", "scout_reverse"]) {
    await runStage(role, {
      bindings,
      initial_contract: { ref: collected.contract_box.ref, output: initialContract },
      assignment: { ref: assignRefs[role], value: assignments[role] },
    }, contractParents);
  }
  const coverages = {
    scout_forward: assignmentCoverage({ assignment: assignments.scout_forward, parsed: collected.scout_forward.envelope.output, observed_reads: [] }),
    scout_reverse: assignmentCoverage({ assignment: assignments.scout_reverse, parsed: collected.scout_reverse.envelope.output, observed_reads: [] }),
  };
  const coverageRefs = {
    scout_forward: putJson(coverages.scout_forward, start),
    scout_reverse: putJson(coverages.scout_reverse, start),
  };
  const scoutReports = ["scout_forward", "scout_reverse"].map((role) => ({
    role,
    ref: collected[role].ref,
    output: collected[role].envelope.output,
    assignment_ref: assignRefs[role],
    assignment: assignments[role],
    coverage_ref: coverageRefs[role],
    coverage: coverages[role],
  }));
  const gapCtx = scoutGapContext(assignments, coverages, {
    scout_forward: collected.scout_forward.envelope.output,
    scout_reverse: collected.scout_reverse.envelope.output,
  });
  await runStage("contract_revise", {
    bindings, requirements, facts: factsPayload, constraints,
    initial_contract: { ref: collected.contract_box.ref, output: initialContract },
    scout_reports: scoutReports,
  }, [collected.contract_box.ref, collected.scout_forward.ref, collected.scout_reverse.ref], gapCtx);
  const paragraphs = openParagraphs(collected.open_box.envelope.output.plan);
  const revised = collected.contract_revise.envelope.output;
  await runStage("assessor", {
    bindings,
    requirements,
    facts: factsPayload,
    ...(constraints.paths.length ? { constraints } : {}),
    original_open: { ref: collected.open_box.ref, output: collected.open_box.envelope.output, source_id_namespace: "open" },
    original_contract: { ref: collected.contract_box.ref, output: initialContract, source_id_namespace: "contract-original" },
    revised_contract: { ref: collected.contract_revise.ref, output: revised, source_id_namespace: "contract-revised" },
    scout_reports: scoutReports,
    open_paragraphs: paragraphs,
  }, [
    collected.open_box.ref,
    collected.contract_box.ref,
    collected.contract_revise.ref,
    collected.scout_forward.ref,
    collected.scout_reverse.ref,
  ]);
  const assessorOut = collected.assessor.envelope.output;
  validateRoleOutput("assessor", assessorOut);
  assertSourceIds(assessorOut, {
    requirementIds: new Set(requirements.map((r) => r.id)),
    paragraphs,
    originalDecisions: initialContract.decisions,
    revisedDecisions: revised.decisions,
  });
  const chosen = normalizeSelection(assessorOut);
  const promptDigests = PLANNING_ROLES.map((role) => collected[role].envelope.launch.prompt_digest);
  const prompt_digest = promptDigests.every(Boolean) ? sha256Utf8(canonicalJson(promptDigests)) : null;
  const scout_reports = [
    { role: "scout_forward", report_ref: collected.scout_forward.ref, coverage_ref: coverageRefs.scout_forward },
    { role: "scout_reverse", report_ref: collected.scout_reverse.ref, coverage_ref: coverageRefs.scout_reverse },
  ];
  const tuple = Object.fromEntries(PLANNING_ROLES.map((role) => [role, publicTuple(tuples[role])]));
  const draft = draftControlPlanV2({
    mode: evidenceClass,
    wi,
    original_requirements_ref: bindings.original_requirements_ref,
    frozen_facts_ref: bindings.frozen_facts_ref,
    source_snapshot_ref: bindings.source_snapshot_ref,
    assessor_ref: collected.assessor.ref,
    source: snapshot,
    policy_digest: policyHash,
    prompt_digest,
    tuple,
    open_original_ref: collected.open_box.ref,
    contract_original_ref: collected.contract_box.ref,
    contract_revised_ref: collected.contract_revise.ref,
    scout_reports,
    chosen_solution: assessorOut,
    dispositions: revised.dispositions ?? [],
    contamination_diagnosis: collected.open_box.envelope.launch.proof?.diagnosis ?? null,
    usage: usageFrom(collected),
    cost: null,
  });
  const stages = Object.fromEntries(PLANNING_ROLES.map((role) => [role, {
    ref: collected[role].ref,
    status: "completed",
    evidence_class: collected[role].envelope.evidence_class,
    usage: collected[role].envelope.launch.usage ?? null,
  }]));
  if (mode === "OFFLINE") {
    const control_plan_ref = putJson(draft, start);
    return {
      status: "completed",
      new_provider_calls: newProviderCalls,
      evidence_class: "OFFLINE",
      eligibility,
      control_plan_ref,
      control_plan: draft,
      stages,
      resume,
    };
  }
  const complete = { ...draft };
  delete complete.draft;
  delete complete.draft_for;
  delete complete.issuance;
  complete.evidence_class = "LIVE";
  complete.timestamp = new Date().toISOString();
  complete.tree_hash = snapshot.tree;
  const validateControlPlan = await loadValidateControlPlan();
  if (typeof validateControlPlan !== "function") {
    throw new Error("missing active v2 control-plan validator; refusing COMPLETE/issuance");
  }
  const verdict = validateControlPlan({
    consumerRoot,
    body: complete,
    requirementsRef: bindings.original_requirements_ref,
    sourceSnapshotRef: bindings.source_snapshot_ref,
    open_original_ref: collected.open_box.ref,
    contract_original_ref: collected.contract_box.ref,
    contract_revised_ref: collected.contract_revise.ref,
    scout_reports,
  });
  if (!verdict || verdict.ok !== true) {
    throw new Error(`control-plan v2 invalid: ${(verdict?.errors || []).join("; ") || "unknown"}`);
  }
  const control_plan_ref = putJson(complete, start);
  return {
    status: "completed",
    new_provider_calls: newProviderCalls,
    evidence_class: "LIVE",
    eligibility,
    control_plan_ref,
    control_plan: complete,
    stages,
    resume,
  };
}

export async function runTwoBox(opts = {}) {
  const mode = opts.mode ?? "prepare";
  if (!["prepare", "live", "OFFLINE"].includes(mode)) throw new Error(`unknown mode: ${mode}`);
  const offline = opts.offline ?? {};
  if (mode !== "OFFLINE") {
    if (isPlainObject(offline) && Object.keys(offline).length) {
      throw new IsolationUnsupported("offline fixture injection forbidden in live");
    }
    for (const key of REAL_BAN) {
      if (Object.hasOwn(opts, key)) throw new Error(`real modes reject ${key}`);
    }
  }
  if (opts.signal != null && typeof opts.signal.addEventListener !== "function") throw new Error("signal must be an AbortSignal");
  if (!opts.consumerRoot) throw new Error("consumerRoot required");
  const consumerRoot = path.resolve(opts.consumerRoot);
  const wi = opts.wi;
  if (!WI_RE.test(wi || "")) throw new Error("stage WI required");
  const requirements = normalizeRequirements(opts.originalRequirements);
  const facts = opts.facts ?? {};
  if (!isPlainObject(facts)) throw new Error("facts must be an object");
  if ("source_tree" in facts) throw new Error("user-invented source_tree refused");
  const dispatch = opts.dispatch ?? {};
  const { journalPath, runPath } = journalPaths(consumerRoot, wi);
  const baseSha = opts.baseSha || gitUtf8(consumerRoot, ["rev-parse", "--verify", "HEAD"]);
  if (!TREE40_RE.test(String(baseSha).trim().toLowerCase())) throw new Error("baseSha must be Git 40-hex, not SHA256");
  const snapshot = buildSourceSnapshot({
    consumerRoot,
    start: consumerRoot,
    baseSha,
    scope: opts.scope,
    ranges: Array.isArray(facts.ranges) ? facts.ranges : [],
  });
  const persisted = persistOriginalInputs({ originalRequirements: requirements,
    facts: { annotations: facts, source_exposure: sourceExposure(snapshot, consumerRoot) },
  }, { start: consumerRoot });
  const source_snapshot_ref = putJson(snapshot, consumerRoot);
  const sourceHash = canonicalSourceHash(snapshot);
  const eligibility = evaluateEligibility(
    mode === "OFFLINE"
      ? { consumerRoot, start: consumerRoot, mode: "OFFLINE", inject: eligibilityInject(offline) }
      : { consumerRoot, start: consumerRoot, mode: "LIVE" },
  );
  if (eligibility.eligible === true && mode !== "OFFLINE") return {
    status: "lightweight", evidence_class: eligibility.evidence_class, eligibility,
    control_plan_ref: null, control_plan: null, stages: {}, resume: null,
  };
  const tuples = {};
  const shared = dispatchOpts(dispatch, wi, consumerRoot);
  for (const role of ["open_box", "contract_box", "scout_forward", "scout_reverse", "assessor"]) {
    tuples[role] = resolveDispatchRoleTuple({ ...shared, role });
  }
  tuples.contract_revise = inheritRevise(tuples.contract_box);
  const policyHash = canonicalPolicyHash(tuples.open_box.effective_policy_sha256);
  for (const role of PLANNING_ROLES) {
    if (canonicalPolicyHash(tuples[role].effective_policy_sha256) !== policyHash) throw new Error("role policy digests diverged");
    if (tuples[role].tuple.host !== "codex") throw new IsolationUnsupported(`unsupported planning transport: ${tuples[role].tuple.host}`);
  }
  const bindings = {
    wi,
    original_requirements_ref: persisted.original_requirements_ref,
    frozen_facts_ref: persisted.frozen_facts_ref,
    source_snapshot_ref,
    policy_digest: digestRef(policyHash, "policy"),
    source_digest: digestRef(sourceHash, "bytes"),
  };
  const resume = {
    key: resumeKey({
      wi,
      objectRefs: [persisted.original_requirements_ref, persisted.frozen_facts_ref, source_snapshot_ref],
      digestRefs: [bindings.policy_digest, bindings.source_digest, eligibility.staged_tree],
      roleTuples: PLANNING_ROLES.map((role) => ({ role, ...publicTuple(tuples[role]) })),
      policyDigest: policyHash,
      sourceDigest: sourceHash,
    }),
    journal: path.relative(consumerRoot, journalPath),
  };
  if (mode === "prepare") {
    return {
      status: "prepared",
      evidence_class: "PREPARE",
      eligibility,
      control_plan_ref: null,
      control_plan: null,
      stages: {},
      resume,
    };
  }
  if (eligibility.eligible === true && mode !== "OFFLINE") {
    return {
      status: "lightweight",
      evidence_class: eligibility.evidence_class,
      eligibility,
      control_plan_ref: null,
      control_plan: null,
      stages: {},
      resume: { ...resume, eligible: true },
    };
  }
  return await withRunClaim(runPath, () => runSix({
    mode, offline, consumerRoot, wi, requirements, snapshot, bindings, tuples,
    policyHash, journalPath, signal: opts.signal, limits: opts.limits,
    contractContext: opts.contractContext, eligibility, resume, sourceHash,
  }));
}

async function selfCheck() {
  const prompt = "SELF_CHECK_PROMPT_MARKER";
  const cwd = "/tmp/ssve-two-box-self-check";
  const messages = nativeInspectionFixture({ cwd, prompt });
  const diagnosis = diagnosePromptContamination(messages, { cwd, prompt });
  if (!diagnosis.ok) throw new Error(`self-check inspect fixture: ${diagnosis.reasons.join("; ")}`);
  let liveRejected = false;
  try {
    await runTwoBox({
      consumerRoot: cwd,
      wi: "WI-SELF-CHECK",
      originalRequirements: "keep this text",
      scope: ["README.md"],
      facts: {},
      mode: "live",
      offline: { binary: process.execPath, helpText: { exec: HELP_EXEC, debug: HELP_DEBUG } },
    });
  } catch (error) {
    liveRejected = /offline|forbidden|injected/i.test(error.message);
    if (!liveRejected) throw error;
  }
  if (!liveRejected) throw new Error("live mode must reject offline fixtures");
  const treeDigest = sha256Utf8(`git-tree:${"a".repeat(40)}\n`);
  if (!/^[0-9a-f]{64}$/.test(treeDigest) || treeDigest === "a".repeat(40)) {
    throw new Error("tree digest must be SHA256(git-tree:<40hex>\\n)");
  }
  try {
    buildRolePrompt({
      role: "assessor",
      payload: {
        bindings: { wi: "WI-X" },
        requirements: [{ id: "REQ1", text: "t" }],
        facts: { a: 1 },
        original_open: { ref: objectRef(sha256Utf8("p")), output: { plan: "p" } },
        original_contract: { ref: objectRef(sha256Utf8("c")), output: { plan: "c", decisions: [{ id: "D1", original_requirement_ids: ["REQ1"], source_citations: [], text: "t" }] } },
        revised_contract: { ref: objectRef(sha256Utf8("r")), output: { plan: "r", decisions: [{ id: "D1", original_requirement_ids: ["REQ1"], source_citations: [], text: "t" }] } },
        scout_reports: [
          { ref: objectRef(sha256Utf8("f")), output: { findings: [], citations: [], unread_gaps: [], supplied_denominator: { files: [], ranges: [] }, incomplete: true } },
          { ref: objectRef(sha256Utf8("v")), output: { findings: [], citations: [], unread_gaps: [], supplied_denominator: { files: [], ranges: [] }, incomplete: true } },
        ],
      },
    });
    throw new Error("assessor must require open_paragraphs");
  } catch (error) {
    if (!/open_paragraphs/.test(error.message)) throw error;
  }
}

function parseCli(argv) {
  const out = { mode: "prepare" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--self-check") out.selfCheck = true;
    else if (token === "--input") out.input = argv[++i];
    else if (token === "--mode") out.mode = argv[++i];
    else if (token === "--out") out.out = argv[++i];
    else throw new Error(`unsupported argument ${token}`);
  }
  if (out.mode && !["prepare", "live", "OFFLINE"].includes(out.mode)) throw new Error(`unknown mode: ${out.mode}`);
  return out;
}

async function main(argv) {
  const args = parseCli(argv);
  if (args.selfCheck) {
    await selfCheck();
    process.stdout.write("self-check ok\n");
    return;
  }
  if (!args.input) throw new Error("missing --input");
  const raw = fs.readFileSync(args.input, "utf8");
  const input = JSON.parse(raw);
  if (!isPlainObject(input)) throw new Error("input must be ONE JSON object");
  if (args.mode !== "OFFLINE" && input.offline) throw new Error("offline fixtures forbidden");
  const result = await runTwoBox({
    consumerRoot: input.consumerRoot || process.cwd(),
    wi: input.wi,
    originalRequirements: input.originalRequirements,
    scope: input.scope,
    baseSha: input.baseSha,
    facts: input.facts,
    contractContext: input.contractContext,
    mode: args.mode,
    dispatch: input.dispatch,
    signal: undefined,
    limits: input.limits,
    offline: args.mode === "OFFLINE" ? input.offline : undefined,
  });
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) fs.writeFileSync(args.out, text);
  else process.stdout.write(text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
