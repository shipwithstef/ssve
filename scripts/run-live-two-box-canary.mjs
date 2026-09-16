#!/usr/bin/env node
/**
 * Bounded LIVE Two-Box canary (WI-FW-TWO-BOX-01).
 * Default --prepare: contained fixture + isolation preflight, no provider exec.
 * Explicit --live: exactly six runTwoBox planning calls, then one EXEC comprehension.
 * --self-check: OFFLINE scorer assertions, zero provider calls.
 * --rescore-retained: parse retained stdout/control-plan, zero provider calls.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runTwoBox } from "./two-box-plan.mjs";
import { resolveDispatchModel, resolveDispatchRoleTuple } from "./resolve-dispatch.mjs";
import { putObject, reviewEvidenceStoreRoot } from "./lib/review-evidence-store.mjs";
import { updateJsonAtomic } from "./state-io.mjs";
import {
  DEFAULT_LIMITS,
  IsolationUnsupported,
  PLANNING_ROLES,
  canonicalJson,
  getByRef,
  getStageEnvelope,
  outputSchemaForCall,
  sha256Bytes,
  sha256Utf8,
} from "./lib/two-box-protocol.mjs";
import { assertEffectiveIsolation } from "./lib/isolated-plan-analysis.mjs";
import { parseCodexJsonl, runBoundedProcess } from "./lib/two-box-role-launch.mjs";
import { validateControlPlan } from "./lib/control-plan-validate.mjs";

export const FACT_MARKER = "LIVE_CANARY_FACT_MARKER_7F3A9C";
export const INSTRUCTION_MARKER = "LIVE_CANARY_AGENTS_INSTRUCTION_MARKER_B2E8";
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WI_RE = /^WI-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SECRET_BASE = /^(?:\.env(?:\..*)?|credentials\.json|id_rsa|id_ed25519)$/i;
const WEAKEN = /weaken(?:s|ing)?.{0,32}(AC|acceptance|proof|test)|relax(?:es|ing)?.{0,16}(AC|test)|skip(?:ping)? tests/i;
const LOCAL_FORBIDDEN = /(change|alter|broaden).{0,40}(AC|acceptance criteria|proof mapping|envelope|authority|test scope)/i;
const EXECUTOR_ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["case_id", "classification", "source_rule", "justification", "affected_decisions", "required_proof"],
  properties: {
    case_id: { type: "string", minLength: 1 },
    classification: { type: "string", enum: ["local_repair", "amendment"] },
    source_rule: { type: "string", minLength: 1 },
    justification: { type: "string", minLength: 1 },
    affected_decisions: { type: "array", items: { type: "string", minLength: 1 } },
    required_proof: { type: "string", minLength: 1 },
  },
};
export const EXECUTOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["output"],
  properties: { output: { type: "array", minItems: 1, items: EXECUTOR_ITEM } },
};
const LIMITS = Object.freeze({
  timeoutMs: DEFAULT_LIMITS.timeoutMs,
  maxBytes: DEFAULT_LIMITS.maxBytes,
  maxOutputBytes: DEFAULT_LIMITS.maxOutputBytes,
  contentAttempts: 1,
  cap: Math.min(DEFAULT_LIMITS.maxBytes, DEFAULT_LIMITS.maxOutputBytes),
});
const MECHANICAL = "mechanical scorer does not prove semantic reasoning or future executor compliance";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

export function publicExecutorCases(cases) {
  if (!Array.isArray(cases)) throw new Error("cases array required");
  return cases.map((row) => {
    if (!isPlainObject(row) || typeof row.case_id !== "string" || !row.case_id) throw new Error("case_id required");
    const { expected, ...pub } = row;
    void expected;
    return pub;
  });
}

export function heldOutSourceRules(expected) {
  const errors = [];
  const rules = [];
  if (!isPlainObject(expected)) return { rules, errors: ["expected object required"] };
  if (typeof expected.source_rule === "string" && expected.source_rule.trim()) rules.push(expected.source_rule);
  if (Object.hasOwn(expected, "accepted_source_rules")) {
    if (!Array.isArray(expected.accepted_source_rules) || expected.accepted_source_rules.length < 1) {
      errors.push("accepted_source_rules must be a nonempty array when present");
    } else {
      for (const rule of expected.accepted_source_rules) {
        if (typeof rule !== "string" || !rule.trim()) errors.push("accepted_source_rules entries must be nonempty strings");
        else rules.push(rule);
      }
    }
  }
  return { rules: [...new Set(rules)], errors };
}

export function executorComprehensionPrompt(contractText, publicCases) {
  return [
    "Classify every case using only the execute-changeset contract.",
    "Reply with one JSON object {\"output\":[{case_id,classification,source_rule,justification,affected_decisions,required_proof}]}.",
    "classification must be local_repair or amendment.",
    "source_rule must be an exact contiguous excerpt copied from the contract.",
    "Do not weaken AC, proof, tests, or scope.",
    "",
    "CONTRACT:",
    contractText,
    "",
    "CASES:",
    canonicalJson(publicCases),
    "",
  ].join("\n");
}

export function executorComprehensionInputKey({ cases, contractText, tuple, schema = EXECUTOR_SCHEMA } = {}) {
  if (!isPlainObject(tuple) || typeof tuple.host !== "string" || typeof tuple.family !== "string" || typeof tuple.model !== "string" || typeof tuple.effort !== "string") {
    throw new Error("tuple host/family/model/effort required");
  }
  if (typeof contractText !== "string" || !contractText.trim()) throw new Error("contractText required");
  const publicCases = publicExecutorCases(cases);
  const visible = canonicalJson(publicCases);
  if (visible.includes('"expected"')) throw new Error("expected object leaked into model-visible cases");
  if (visible.includes("accepted_source_rules")) throw new Error("accepted_source_rules leaked into model-visible cases");
  const prompt = executorComprehensionPrompt(contractText, publicCases);
  return {
    key: sha256Utf8(canonicalJson({
      role: "executor_comprehension",
      prompt,
      schema,
      tuple: { host: tuple.host, family: tuple.family, model: tuple.model, effort: tuple.effort },
      evidence_class: "LIVE",
    })),
    prompt,
    publicCases,
    schema,
  };
}

export function scoreExecutorComprehension({ cases, output, contractText } = {}) {
  const errors = [];
  if (!Array.isArray(cases) || !cases.length) errors.push("cases required");
  if (typeof contractText !== "string" || !contractText.trim()) errors.push("contractText required");
  const rows = Array.isArray(output) ? output : output?.output;
  if (!Array.isArray(rows)) {
    return { ok: false, errors: [...errors, "output array required"], mechanical: true, limitation: MECHANICAL };
  }
  const expectedById = new Map();
  for (const entry of cases || []) {
    if (!isPlainObject(entry) || typeof entry.case_id !== "string" || !entry.case_id) {
      errors.push("case_id required on every held-out case");
      continue;
    }
    if (expectedById.has(entry.case_id)) errors.push(`duplicate held-out case_id ${entry.case_id}`);
    if (!isPlainObject(entry.expected) || (entry.expected.classification !== "local_repair" && entry.expected.classification !== "amendment")) {
      errors.push(`${entry.case_id}: expected.classification required`);
    }
    const held = heldOutSourceRules(entry.expected || {});
    for (const msg of held.errors) errors.push(`${entry.case_id}: ${msg}`);
    for (const rule of held.rules) {
      if (typeof contractText === "string" && !contractText.includes(rule)) {
        errors.push(`${entry.case_id}: accepted excerpt is not an excerpt of the actual skill contract`);
      }
    }
    expectedById.set(entry.case_id, { entry, heldOutRules: held.rules });
  }
  const seen = new Set();
  for (const row of rows) {
    if (!isPlainObject(row) || typeof row.case_id !== "string" || !row.case_id) {
      errors.push("output row missing case_id");
      continue;
    }
    if (seen.has(row.case_id)) errors.push(`duplicate output case_id ${row.case_id}`);
    seen.add(row.case_id);
    const held = expectedById.get(row.case_id);
    if (!held) {
      errors.push(`unexpected case_id ${row.case_id}`);
      continue;
    }
    const expected = held.entry.expected || {};
    if (row.classification !== expected.classification) {
      errors.push(`${row.case_id}: expected ${expected.classification}, got ${row.classification}`);
    }
    if (typeof row.source_rule !== "string" || !row.source_rule.trim()) errors.push(`${row.case_id}: source_rule required`);
    else if (typeof contractText === "string" && !contractText.includes(row.source_rule)) {
      errors.push(`${row.case_id}: source_rule is not an excerpt of the actual skill contract`);
    }
    if (typeof row.source_rule === "string" && held.heldOutRules.length && !held.heldOutRules.some((rule) => row.source_rule.includes(rule))) {
      errors.push(`${row.case_id}: source_rule must identify the applicable held-out rule`);
    }
    if (typeof row.justification !== "string" || !row.justification.trim()) errors.push(`${row.case_id}: justification required`);
    if (!Array.isArray(row.affected_decisions) || row.affected_decisions.some((id) => typeof id !== "string" || !id.trim())) {
      errors.push(`${row.case_id}: affected_decisions must be an array of nonempty strings`);
    }
    if (typeof row.required_proof !== "string" || !row.required_proof.trim()) errors.push(`${row.case_id}: required_proof required`);
    if (row.classification === "amendment" && (!Array.isArray(row.affected_decisions) || row.affected_decisions.length < 1)) {
      errors.push(`${row.case_id}: amendment requires nonempty affected_decisions`);
    }
    const blob = `${row.justification || ""}\n${row.required_proof || ""}`.split(/[.\n;]/).filter(sentence => !/\b(?:not|never|without|unchanged|preserv(?:e|es|ing))\b/i.test(sentence)).join("\n");
    if (WEAKEN.test(blob)) errors.push(`${row.case_id}: justification/proof weakens AC/tests/scope`);
    if (row.classification === "local_repair" && LOCAL_FORBIDDEN.test(blob)) {
      errors.push(`${row.case_id}: local_repair may not change AC/proof/envelope/authority/test scope`);
    }
  }
  for (const id of expectedById.keys()) {
    if (!seen.has(id)) errors.push(`missing case ${id}`);
  }
  return { ok: errors.length === 0, errors, mechanical: true, limitation: MECHANICAL };
}

export const RETAINED_CANARY03_EXECUTOR = Object.freeze({
  wi: "WI-FW-TWO-BOX-CANARY-03",
  key: "d63708d00d9f124d154cec9c114f98f0b24eb622001c931abb0093f176a7ef80",
  stdout_sha256: "fa5da28b6c7dc1510c4c9de940158f1f3c97b8113b637a8944da41e58de77873",
  stderr_sha256: "3e75d28a6681c31400a3f0fcb564c7613fd42796fb83294e4d53fea86bcbd401",
  control_plan_sha256: "52f53cf593839e5dcf46b59a8af20aeeba079f36fe83a461db45e3d138ff7d0e",
  stage_refs: Object.freeze({
    open_box: "661bf378bc841377bad77b17a99bccb6a0450c89e6c2f839a65f6fe35c8c3704",
    contract_box: "56f4f1f1d3cad45032fd43052a416bd478ce0d382330ff56176563d079588733",
    scout_forward: "b823625ae73a8f73033b24445ee32507a294932dccdabdfb74f5f36c4d5f9997",
    scout_reverse: "2368808f461dca6900e7ef9509d97c09485c1b125cdd9d5d81c314536e56b319",
    contract_revise: "32dd327fd479d151085dc8e15bcae433c65bc73867cb39bf47d45544cb71ec6e",
    assessor: "cb92ff5c50b10546441944ea284e25a71c6fffe308ba9e9c5b4d62737f8bb77b",
  }),
  original_status: "failed_score",
  original_error: "ED-02-new-or-upgraded-dependency: source_rule must identify the applicable held-out rule",
});

export function rescoreRetainedExecutorBytes({
  stdoutBytes,
  expectedStdoutSha = RETAINED_CANARY03_EXECUTOR.stdout_sha256,
  expectedKey,
  cases,
  contractText,
  tuple,
} = {}) {
  const raw = Buffer.isBuffer(stdoutBytes) ? stdoutBytes : Buffer.from(stdoutBytes || "");
  const stdoutSha = sha256Bytes(raw);
  if (typeof expectedStdoutSha !== "string" || stdoutSha !== expectedStdoutSha) {
    throw new Error(`stdout hash mismatch: ${stdoutSha}`);
  }
  const parsed = parseCodexJsonl(raw, EXECUTOR_SCHEMA);
  const input = executorComprehensionInputKey({ cases, contractText, tuple });
  if (typeof expectedKey === "string" && input.key !== expectedKey) {
    throw new Error("executor input key does not match retained key");
  }
  return {
    inference_calls: 0,
    stdout_sha256: stdoutSha,
    parsed,
    score: scoreExecutorComprehension({ cases, output: parsed, contractText }),
    ...input,
  };
}

function findMatchingControlPlan({ fixtureRoot, wi, assessorSha }) {
  const objects = path.join(reviewEvidenceStoreRoot(fixtureRoot), "objects");
  const hits = [];
  for (const dir of fs.readdirSync(objects)) {
    const folder = path.join(objects, dir);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const name of fs.readdirSync(folder)) {
      const bytes = fs.readFileSync(path.join(folder, name));
      if (bytes[0] !== 0x7b) continue;
      let body;
      try { body = JSON.parse(bytes.toString("utf8")); } catch { continue; }
      if (body?.receipt_type === "control-plan" && body.wi === wi && body.assessor_ref?.sha256 === assessorSha) {
        hits.push({ sha256: `${dir}${name}`, body });
      }
    }
  }
  if (hits.length !== 1) throw new Error(`expected exactly one matching control-plan, got ${hits.length}`);
  return hits[0];
}

export function rescoreRetainedCanary({ consumerRoot, wi } = {}) {
  if (!consumerRoot || !wi) throw new Error("explicit --wi and --root required");
  const fixtureRoot = fixtureRootFor(consumerRoot, wi);
  if (!fs.existsSync(fixtureRoot)) throw new Error("retained live canary fixture missing");
  const cases = loadCases();
  const contractText = loadExecContract();
  const journal = JSON.parse(fs.readFileSync(path.join(fixtureRoot, ".svc", "two-box", wi, "journal.json"), "utf8"));
  const executor = JSON.parse(fs.readFileSync(path.join(fixtureRoot, ".svc", "two-box", wi, "executor-comprehension.json"), "utf8"));
  const budget = JSON.parse(fs.readFileSync(path.join(fixtureRoot, ".svc", "two-box", wi, "live-canary-budget.json"), "utf8"));
  if (executor.status !== "failed_score") throw new Error(`retained executor status is ${executor.status}, not failed_score`);
  if (executor.key !== RETAINED_CANARY03_EXECUTOR.key) throw new Error("retained executor key mismatch");
  if (canonicalJson(executor.score) !== canonicalJson({
    ok: false,
    errors: [RETAINED_CANARY03_EXECUTOR.original_error],
    mechanical: true,
    limitation: MECHANICAL,
  })) {
    throw new Error("retained original score must stay the historical failed_score payload");
  }
  for (const role of PLANNING_ROLES) {
    const stage = journal.stages?.[role];
    if (stage?.status !== "completed" || !stage.ref) throw new Error(`planning role ${role} is not a completed retained stage`);
    if (stage.ref.sha256 !== RETAINED_CANARY03_EXECUTOR.stage_refs[role]) {
      throw new Error(`planning role ${role} envelope sha mismatch`);
    }
    getStageEnvelope(stage.ref, { start: fixtureRoot });
  }
  const stdoutGot = getByRef(executor.raw_stdout_ref, { start: fixtureRoot });
  const stderrGot = getByRef(executor.raw_stderr_ref, { start: fixtureRoot });
  if (sha256Bytes(stderrGot.bytes) !== RETAINED_CANARY03_EXECUTOR.stderr_sha256) {
    throw new Error("stderr hash mismatch");
  }
  const rescored = rescoreRetainedExecutorBytes({
    stdoutBytes: stdoutGot.bytes,
    expectedStdoutSha: RETAINED_CANARY03_EXECUTOR.stdout_sha256,
    expectedKey: RETAINED_CANARY03_EXECUTOR.key,
    cases,
    contractText,
    tuple: executor.requested,
  });
  const assessorSha = journal.stages.assessor.ref.sha256;
  const control = findMatchingControlPlan({ fixtureRoot, wi, assessorSha });
  if (control.sha256 !== RETAINED_CANARY03_EXECUTOR.control_plan_sha256) {
    throw new Error("control-plan sha mismatch");
  }
  if ("draft" in control.body || "draft_for" in control.body || "issuance" in control.body) {
    throw new Error("complete LIVE control-plan must not retain draft fields");
  }
  const controlVerdict = validateControlPlan({
    consumerRoot: fixtureRoot,
    body: control.body,
    requirementsRef: control.body.original_requirements_ref,
    sourceSnapshotRef: control.body.source_snapshot_ref,
  });
  verifyLiveOpenAndSource({
    stages: Object.fromEntries(PLANNING_ROLES.map((role) => [role, journal.stages[role]])),
    control_plan: control.body,
  }, fixtureRoot);
  const corrected = rescored.score.ok === true && controlVerdict?.ok === true && rescored.key === executor.key;
  return {
    status: "rescore-retained",
    evidence_class: "LIVE",
    inference_calls: 0,
    wi,
    original: {
      executor_status: executor.status,
      score: executor.score,
      claimed_attempt_at: executor.claimed_attempt_at,
      usage: executor.usage,
      key: executor.key,
    },
    budget_claim_preserved: {
      claimed_at: budget.claimed_at,
      recovery: budget.recovery ?? null,
    },
    hashes: {
      stdout: RETAINED_CANARY03_EXECUTOR.stdout_sha256,
      stderr: RETAINED_CANARY03_EXECUTOR.stderr_sha256,
      cases: sha256Bytes(namedFixture("executor-discretion-cases.json")),
      contract: sha256Bytes(contractText),
      scorer: sha256Bytes(fs.readFileSync(fileURLToPath(import.meta.url))),
    },
    input_key_matches: rescored.key === executor.key,
    public_cases_leak: false,
    planning_stages: Object.fromEntries(PLANNING_ROLES.map((role) => [role, {
      status: journal.stages[role].status,
      key: journal.stages[role].key,
      ref: journal.stages[role].ref,
    }])),
    control_plan_ref: { type: "object", sha256: control.sha256 },
    control_plan: {
      ok: controlVerdict?.ok === true,
      errors: controlVerdict?.errors || [],
      winner: control.body.chosen_solution?.winner ?? null,
      unresolved_conflicts: control.body.chosen_solution?.unresolved_conflicts ?? null,
      evidence_class: control.body.evidence_class,
    },
    corrected_score: rescored.score,
    corrected_verification: corrected,
    limitation: MECHANICAL,
    note: "Original failed_score remains historical. This record is a no-inference rescore of retained bytes against the corrected oracle.",
  };
}

function gitUtf8(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "SSVE Live Canary Fixture",
        GIT_AUTHOR_EMAIL: "two-box-canary@invalid.local",
        GIT_COMMITTER_NAME: "SSVE Live Canary Fixture",
        GIT_COMMITTER_EMAIL: "two-box-canary@invalid.local",
      },
      maxBuffer: LIMITS.maxBytes,
    }).trim();
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`git ${args.join(" ")} failed closed: ${detail}`);
  }
}

function hasHead(cwd) {
  try {
    if (!fs.existsSync(path.join(cwd, ".git"))) return false;
    if (fs.realpathSync(gitUtf8(cwd, ["rev-parse", "--show-toplevel"])) !== fs.realpathSync(cwd)) return false;
    gitUtf8(cwd, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function writeContained(root, rel, text) {
  const posix = containRel(root, rel);
  const full = path.join(root, posix);
  fs.mkdirSync(path.dirname(full), { recursive: true, mode: 0o700 });
  const body = text.endsWith("\n") ? text : `${text}\n`;
  fs.writeFileSync(full, body, { mode: 0o644 });
  return posix;
}

function namedFixture(name) {
  const rel = `test-framework/evals/tier-1/fixtures/two-box/${name}`;
  const full = path.join(PACKAGE_ROOT, rel);
  const stat = fs.lstatSync(full);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`named fixture missing: ${rel}`);
  return fs.readFileSync(full, "utf8");
}

function loadCases() {
  const raw = namedFixture("executor-discretion-cases.json");
  const doc = JSON.parse(raw);
  if (!isPlainObject(doc) || !Array.isArray(doc.cases) || doc.cases.length !== 6) {
    throw new Error("executor-discretion-cases.json must hold exactly six held-out cases");
  }
  for (const row of doc.cases) {
    if (!isPlainObject(row.expected)) throw new Error(`${row.case_id}: expected object required`);
  }
  return doc.cases;
}

function loadExecContract() {
  const full = path.join(PACKAGE_ROOT, "skills", "execute-changeset", "SKILL.md");
  const stat = fs.lstatSync(full);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("execute-changeset SKILL.md required");
  return fs.readFileSync(full, "utf8");
}

function boundedMethodContract(skillText) {
  const start = skillText.indexOf("## Original requirement handoff");
  const end = skillText.indexOf("## Step 0");
  if (start < 0 || end < 0 || end <= start) throw new Error("execute-changeset handoff section missing");
  const notStart = skillText.indexOf("## What Not To Do");
  const notEnd = skillText.indexOf("## Handoff");
  if (notStart < 0 || notEnd < 0 || notEnd <= notStart) throw new Error("execute-changeset What Not To Do section missing");
  return `${skillText.slice(start, end).trim()}\n\n${skillText.slice(notStart, notEnd).trim()}\n`;
}

function publicTuple(resolved) {
  const t = resolved.tuple;
  return { host: t.host, family: t.family, model: t.model, effort: t.effort };
}

function fixtureRootFor(consumerRoot, wi) {
  if (!WI_RE.test(wi)) throw new Error("stage WI required");
  const root = path.resolve(consumerRoot);
  assertNoSymlink(root);
  const rel = `.svc/external-review-artifacts/two-box/live-canary-${wi}`;
  containRel(root, rel);
  return path.join(root, rel);
}

function ensureFixture(consumerRoot, wi) {
  const fixture = fixtureRootFor(consumerRoot, wi);
  fs.mkdirSync(fixture, { recursive: true, mode: 0o700 });
  assertNoSymlink(fixture);
  const facts = JSON.parse(namedFixture("isolation-canary-facts.json")).facts;
  if (!facts.includes(FACT_MARKER)) throw new Error("isolation-canary-facts.json must contain the facts marker");
  if (!hasHead(fixture)) {
    gitUtf8(fixture, ["init", "-q"]);
    gitUtf8(fixture, ["config", "user.name", "SSVE Live Canary Fixture"]);
    gitUtf8(fixture, ["config", "user.email", "two-box-canary@invalid.local"]);
    gitUtf8(fixture, ["config", "commit.gpgsign", "false"]);
    writeContained(fixture, "AGENTS.md", `# Fixture instructions\n${INSTRUCTION_MARKER}\nThese instructions are a contamination canary. They are not product facts.\n`);
    writeContained(fixture, "docs/facts.md", facts);
    writeContained(fixture, "src/helper.mjs", [
      `export function canaryLabel() {`,
      `  return "${FACT_MARKER}";`,
      `}`,
      ``,
      `function formatPair(left, right) {`,
      `  return \`\${left}:\${right}\`;`,
      `}`,
      ``,
      `export function canaryHint(left, right) {`,
      `  return formatPair(canaryLabel(), String(Number(left) + Number(right)));`,
      `}`,
      ``,
    ].join("\n"));
    writeContained(fixture, "src/widget.mjs", [
      `import { canaryLabel } from "./helper.mjs";`,
      ``,
      `/** Product fact marker (not an instruction catalog). */`,
      `export const CANARY_FACT = "${FACT_MARKER}";`,
      ``,
      `export function canarySum(left, right) {`,
      `  return Number(left) + Number(right);`,
      `}`,
      ``,
      `export function canaryReport(left, right) {`,
      `  return \`\${canaryLabel()}:\${canarySum(left, right)}\`;`,
      `}`,
      ``,
    ].join("\n"));
    writeContained(fixture, "test/widget.test.mjs", [
      `import test from "node:test";`,
      `import assert from "node:assert/strict";`,
      `import { canarySum, canaryReport, CANARY_FACT } from "../src/widget.mjs";`,
      `import { canaryLabel } from "../src/helper.mjs";`,
      ``,
      `test("canarySum adds numbers", () => {`,
      `  assert.equal(canarySum(2, 3), 5);`,
      `});`,
      ``,
      `test("facts marker is grounded in source", () => {`,
      `  assert.equal(canaryLabel(), "${FACT_MARKER}");`,
      `  assert.equal(CANARY_FACT, canaryLabel());`,
      `});`,
      ``,
      `test("canaryReport includes the facts marker", () => {`,
      `  assert.match(canaryReport(1, 1), /${FACT_MARKER}/);`,
      `});`,
      ``,
    ].join("\n"));
    writeContained(fixture, "docs/specs/features/live-canary.md", [
      `# Live canary widget`,
      ``,
      `## Requirements`,
      ``,
      `- REQ-CANARY-1: Preserve the grounded facts marker ${FACT_MARKER} in shipped source and tests.`,
      `- REQ-CANARY-2: Add a bounded positive-integer scale helper for canarySum results without changing the marker or public report contract.`,
      ``,
    ].join("\n"));
    writeContained(fixture, "docs/specs/tech/live-canary.md", [
      `# Technical design: live canary widget`,
      ``,
      `- Entry: src/widget.mjs exports canarySum and canaryReport.`,
      `- Helper: src/helper.mjs exports canaryLabel and canaryHint.`,
      `- Tests: test/widget.test.mjs covers sum behavior and the facts marker.`,
      `- Scale helper, if added, multiplies a numeric result by a positive integer and must not rewrite ${FACT_MARKER}.`,
      ``,
    ].join("\n"));
    writeContained(fixture, "contracts/ssve-method-contract.md", boundedMethodContract(loadExecContract()));
    gitUtf8(fixture, ["add", "AGENTS.md", "docs/facts.md", "src/helper.mjs", "src/widget.mjs", "test/widget.test.mjs", "docs/specs/features/live-canary.md", "docs/specs/tech/live-canary.md", "contracts/ssve-method-contract.md"]);
    gitUtf8(fixture, ["commit", "-qm", "live-canary fixture base"]);
  }
  const helperPath = path.join(fixture, "src", "helper.mjs");
  const helper = fs.readFileSync(helperPath, "utf8");
  if (!helper.includes(FACT_MARKER)) throw new Error("fixture source must contain the facts marker");
  if (!helper.includes("export function canaryScale")) {
    fs.appendFileSync(helperPath, [
      ``,
      `export function canaryScale(value, factor) {`,
      `  if (!Number.isInteger(factor) || factor < 1) {`,
      `    throw new Error("factor must be a positive integer");`,
      `  }`,
      `  return value * factor;`,
      `}`,
      ``,
    ].join("\n"));
  }
  gitUtf8(fixture, ["add", "src/helper.mjs"]);
  const staged = gitUtf8(fixture, ["diff", "--cached", "--name-only"]);
  if (!staged) throw new Error("nonexempt staged source change required");
  const baseSha = gitUtf8(fixture, ["rev-parse", "--verify", "HEAD"]);
  return {
    fixtureRoot: fs.realpathSync(fixture),
    baseSha,
    scope: ["src/widget.mjs", "src/helper.mjs", "test/widget.test.mjs", "docs/facts.md"],
    contractContext: [
      "docs/specs/features/live-canary.md",
      "docs/specs/tech/live-canary.md",
      "contracts/ssve-method-contract.md",
    ],
    originalRequirements: [
      { id: "REQ-CANARY-1", text: `Preserve the grounded facts marker ${FACT_MARKER} in shipped source and tests.` },
      { id: "REQ-CANARY-2", text: "Add a bounded positive-integer scale helper for canarySum results without changing the marker or public report contract." },
    ],
    facts: {
      annotations: {
        facts_marker: FACT_MARKER,
        change_archetype: "feature",
        bounded_change_goal: "scale helper for canarySum",
      },
    },
  };
}

function dispatchShared(args, wi, cwd) {
  const opts = { wi, cwd };
  if (args.config) opts.configPath = args.config;
  if (args.dispatchMode) opts.mode = args.dispatchMode;
  if (args.dispatchOverlay) opts.workOverlayPath = args.dispatchOverlay;
  if (process.env.SVC_HOST) opts.orchestrator = process.env.SVC_HOST;
  if (process.env.SVC_SESSION_ID) opts.sessionId = process.env.SVC_SESSION_ID;
  return opts;
}

function assertCodexTuple(resolved, label) {
  const t = resolved?.tuple;
  if (!t || t.host !== "codex") throw new IsolationUnsupported(`unsupported configured host for ${label}: ${t?.host || "missing"}`);
  if (typeof t.model !== "string" || !t.model.trim() || typeof t.effort !== "string" || !t.effort.trim()) {
    throw new IsolationUnsupported(`${label} tuple.model and tuple.effort required`);
  }
  return t;
}

function assertLocalCatalog(tuple) {
  const catalogPath = path.join(os.homedir(), ".codex", "models_cache.json");
  let raw;
  try { raw = fs.readFileSync(catalogPath); }
  catch { throw new IsolationUnsupported("local Codex models_cache.json is not installed"); }
  let doc;
  try { doc = JSON.parse(raw.toString("utf8")); }
  catch { throw new IsolationUnsupported("local Codex models_cache.json is malformed"); }
  const models = Array.isArray(doc.models) ? doc.models : [];
  const row = models.find((m) => isPlainObject(m) && m.slug === tuple.model);
  if (!row) throw new IsolationUnsupported(`local catalog does not list slug ${tuple.model}`);
  const levels = Array.isArray(row.supported_reasoning_levels) ? row.supported_reasoning_levels : [];
  if (!levels.some((lv) => isPlainObject(lv) && lv.effort === tuple.effort)) {
    throw new IsolationUnsupported(`local catalog does not list effort ${tuple.effort} for ${tuple.model}`);
  }
}

function resolveCanaryTuples(shared) {
  const planning = {};
  for (const role of ["open_box", "contract_box", "scout_forward", "scout_reverse", "assessor"]) {
    planning[role] = resolveDispatchRoleTuple({ ...shared, role });
    assertCodexTuple(planning[role], role);
    assertLocalCatalog(planning[role].tuple);
  }
  const implementor = resolveDispatchModel({ ...shared, label: "EXEC" });
  assertCodexTuple(implementor, "implementor");
  assertLocalCatalog(implementor.tuple);
  return { planning, implementor };
}

function nativeText(messages) {
  if (!Array.isArray(messages)) return "";
  return messages.map((msg) => {
    const items = Array.isArray(msg?.content) ? msg.content : [msg?.content];
    return items.map((item) => (typeof item === "string" ? item : item?.text || "")).join("\n");
  }).join("\n");
}

function inspectOpenIsolation({ fixtureRoot, tuple, requirements, factsText }) {
  const prompt = `${requirements.map((r) => `${r.id}: ${r.text}`).join("\n")}\n\nFACTS:\n${factsText}\n`;
  if (!prompt.includes(FACT_MARKER)) throw new Error("inspect prompt missing facts marker");
  if (prompt.includes(INSTRUCTION_MARKER)) throw new Error("inspect prompt must not include the AGENTS instruction marker");
  const iso = assertEffectiveIsolation({
    role: "open_box",
    tuple,
    prompt,
    schema: outputSchemaForCall("open_box"),
    consumerRoot: fixtureRoot,
    mode: "inspect",
  });
  try {
    const native = nativeText(JSON.parse(getByRef(iso.proof.native_prompt, { start: fixtureRoot }).bytes.toString("utf8").trim()));
    if (!iso.proof.prompt.includes(FACT_MARKER) || !native.includes(FACT_MARKER)) {
      throw new IsolationUnsupported("native Open prompt missing facts marker");
    }
    if (iso.proof.prompt.includes(INSTRUCTION_MARKER) || native.includes(INSTRUCTION_MARKER)) {
      throw new IsolationUnsupported("native Open prompt contains AGENTS instruction marker");
    }
    return {
      ok: true,
      facts_marker_in_prompt: true,
      agents_marker_absent: true,
      usable_live: iso.proof.effective?.usable_live === true,
      native_prompt_sha256: iso.proof.native_prompt_sha256,
    };
  } finally {
    if (iso.cleanup) iso.cleanup();
  }
}

function verifyLiveOpenAndSource(result, fixtureRoot) {
  if (!result?.stages?.open_box?.ref) throw new Error("open_box stage ref required");
  const envelope = getStageEnvelope(result.stages.open_box.ref, { start: fixtureRoot });
  const launch = envelope.launch || {};
  if (!isPlainObject(launch.requested) || !isPlainObject(launch.invocation) || !isPlainObject(launch.observed)) {
    throw new Error("requested/invocation/observed must be retained separately");
  }
  if (canonicalJson(launch.requested) === canonicalJson(launch.invocation)) {
    throw new Error("requested and invocation must be separate identities");
  }
  if (!("model" in launch.observed)) throw new Error("observed.model may be unknown but must not be omitted");
  const prompt = launch.proof?.prompt || "";
  if (!prompt.includes(FACT_MARKER)) throw new Error("retained Open prompt missing facts marker");
  if (prompt.includes(INSTRUCTION_MARKER)) throw new Error("retained Open prompt contains AGENTS instruction marker");
  const nativeGot = getByRef(launch.proof.native_prompt, { start: fixtureRoot });
  const native = nativeText(JSON.parse(nativeGot.bytes.toString("utf8").trim()));
  if (!native.includes(FACT_MARKER)) throw new Error("native Open prompt missing facts marker");
  if (native.includes(INSTRUCTION_MARKER)) throw new Error("native Open prompt contains AGENTS instruction marker");
  const snap = JSON.parse(getByRef(result.control_plan.source_snapshot_ref, { start: fixtureRoot }).bytes.toString("utf8"));
  let found = false;
  for (const sf of snap.scoped_files || []) {
    const text = getByRef(sf.object_ref, { start: fixtureRoot }).bytes.toString("utf8");
    if (text.includes(FACT_MARKER)) found = true;
    if (text.includes(INSTRUCTION_MARKER)) throw new Error(`source snapshot includes instruction marker: ${sf.path}`);
  }
  if (!found) throw new Error("source snapshot missing facts marker");
}

function usageObservedFromJsonl(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "");
  const observed = { model: "unknown", effort: "unknown" };
  let usage = null;
  for (const line of text.split("\n")) {
    const s = line.replace(/\r$/, "");
    if (!s.trim()) continue;
    let ev;
    try { ev = JSON.parse(s); } catch { continue; }
    const model = ev.model ?? ev.thread?.model ?? ev.turn?.model;
    const effort = ev.effort ?? ev.model_reasoning_effort ?? ev.turn?.effort;
    if (typeof model === "string" && model.trim()) observed.model = model.trim();
    if (typeof effort === "string" && effort.trim()) observed.effort = effort.trim();
    if (ev.type === "turn.completed" && isPlainObject(ev.usage)) usage = ev.usage;
  }
  return { usage, observed };
}

function preContentRetry(transport) {
  const retry = transport?.pre_content_retry;
  if (!retry || retry.enabled !== true) return false;
  if (retry.max_classified_spawn_retries !== 1) throw new Error("pre_content_retry requires max_classified_spawn_retries=1");
  if (retry.retry_class != null && retry.retry_class !== "pre_content_spawn_failure") {
    throw new Error("pre_content_retry.retry_class must be pre_content_spawn_failure");
  }
  return true;
}

function goldRows(cases) {
  return cases.map((c) => ({
    case_id: c.case_id,
    classification: c.expected.classification,
    source_rule: c.expected.source_rule,
    justification: c.expected.justification,
    affected_decisions: c.expected.affected_decisions,
    required_proof: c.expected.required_proof,
  }));
}

async function runSeventh({ fixtureRoot, wi, implementor, transport, cases, contractText }) {
  const tuple = implementor.tuple;
  const { key, prompt } = executorComprehensionInputKey({ cases, contractText, tuple });
  const journalPath = path.join(fixtureRoot, ".svc", "two-box", wi, "executor-comprehension.json");
  containRel(fixtureRoot, `.svc/two-box/${wi}/executor-comprehension.json`);
  updateJsonAtomic(journalPath, (cur) => {
    const j = cur ?? { schema_version: 1, wi, role: "executor_comprehension", status: "idle" };
    if (j.status !== "idle") {
      throw new Error("executor comprehension already claimed; inspect retained evidence before any separately authorized new canary");
    }
    if (j.status === "running" && j.key === key) {
      throw new Error("interrupted provider attempt cannot be assumed zero-cost; change input or explicit decision to retry");
    }
    return {
      schema_version: 1,
      wi,
      role: "executor_comprehension",
      status: "running",
      key,
      claimed_attempt_at: new Date().toISOString(),
      evidence_class: "LIVE",
    };
  }, { schema_version: 1, wi, role: "executor_comprehension", status: "idle" });
  const started = Date.now();
  let iso;
  try {
    iso = assertEffectiveIsolation({
      role: "executor_comprehension",
      tuple,
      prompt,
      schema: EXECUTOR_SCHEMA,
      consumerRoot: fixtureRoot,
      mode: "live",
    });
    if (iso.proof?.effective?.usable_live !== true) throw new IsolationUnsupported("isolation proof is not usable live");
    const allowRetry = preContentRetry(transport);
    let attempts = 0;
    let last;
    while (true) {
      attempts += 1;
      last = await runBoundedProcess({
        binary: iso.proof.binary.path,
        args: iso.execArgs,
        cwd: iso.cwd,
        env: iso.env,
        prompt: iso.prompt,
        timeoutMs: LIMITS.timeoutMs,
        maxBytes: LIMITS.cap,
        signal: undefined,
      });
      if (last.ok) break;
      const classified = !last.gotBytes && (last.spawnCode === "ENOENT" || last.spawnCode === "EAGAIN");
      if (!(allowRetry && classified && attempts === 1)) break;
    }
    const rawStdout = Buffer.isBuffer(last.rawStdout) ? last.rawStdout : Buffer.from(last.rawStdout || "");
    const rawStderr = Buffer.isBuffer(last.rawStderr) ? last.rawStderr : Buffer.from(last.rawStderr || "");
    const out = putObject(rawStdout, { start: fixtureRoot });
    const err = putObject(rawStderr, { start: fixtureRoot });
    const identities = {
      requested: { host: tuple.host, family: tuple.family, model: tuple.model, effort: tuple.effort },
      invocation: { host: "codex", binary: iso.proof.binary.path, exec_args: iso.execArgs, cwd: iso.cwd },
      observed: { model: "unknown", effort: "unknown" },
    };
    if (!last.ok || last.exit_code !== 0) {
      updateJsonAtomic(journalPath, (j) => ({
        ...j,
        status: "failed",
        key,
        error: `codex launch ${last.status}`,
        attempts,
        raw_stdout_ref: { type: "object", sha256: out.sha256 },
        raw_stderr_ref: { type: "object", sha256: err.sha256 },
        stdout_sha256: sha256Bytes(rawStdout),
        stderr_sha256: sha256Bytes(rawStderr),
        ...identities,
      }));
      throw new Error(`executor comprehension launch ${last.status}`);
    }
    let parsed;
    try { parsed = parseCodexJsonl(rawStdout, EXECUTOR_SCHEMA); }
    catch (error) {
      updateJsonAtomic(journalPath, (j) => ({
        ...j,
        status: "failed",
        key,
        error: error.message,
        attempts,
        raw_stdout_ref: { type: "object", sha256: out.sha256 },
        raw_stderr_ref: { type: "object", sha256: err.sha256 },
        stdout_sha256: sha256Bytes(rawStdout),
        stderr_sha256: sha256Bytes(rawStderr),
        ...identities,
      }));
      throw error;
    }
    const decoded = usageObservedFromJsonl(rawStdout);
    identities.observed = decoded.observed;
    const score = scoreExecutorComprehension({ cases, output: parsed, contractText });
    updateJsonAtomic(journalPath, (j) => ({
      ...j,
      status: score.ok ? "completed" : "failed_score",
      key,
      attempts,
      elapsed_ms: Date.now() - started,
      raw_stdout_ref: { type: "object", sha256: out.sha256 },
      raw_stderr_ref: { type: "object", sha256: err.sha256 },
      stdout_sha256: sha256Bytes(rawStdout),
      stderr_sha256: sha256Bytes(rawStderr),
      usage: decoded.usage,
      score,
      ...identities,
    }));
    if (!score.ok) throw new Error(`executor comprehension score failed: ${score.errors.join("; ")}`);
    return {
      evidence_class: "LIVE",
      output: parsed.output,
      usage: decoded.usage,
      requested: identities.requested,
      invocation: identities.invocation,
      observed: identities.observed,
      attempts,
      elapsed_ms: Date.now() - started,
      score,
    };
  } finally {
    if (iso?.cleanup) iso.cleanup();
  }
}

function writeReport(args, report) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) fs.writeFileSync(args.out, text);
  else process.stdout.write(text);
}

async function selfCheck() {
  const cases = loadCases();
  const contractText = loadExecContract();
  const gold = goldRows(cases);
  const good = scoreExecutorComprehension({ cases, output: { output: gold }, contractText });
  if (!good.ok) throw new Error(`gold score failed: ${good.errors.join("; ")}`);
  const swapped = gold.map((row, i) => (i === 0 || i === 1 ? { ...row, classification: gold[1 - i].classification } : row));
  const sw = scoreExecutorComprehension({ cases, output: { output: swapped }, contractText });
  if (sw.ok) throw new Error("scorer must reject swapped labels");
  const incomplete = gold.slice(0, -1);
  const inc = scoreExecutorComprehension({ cases, output: { output: incomplete }, contractText });
  if (inc.ok) throw new Error("scorer must reject incomplete cases");
  const weak = gold.map((row) => (row.classification === "local_repair"
    ? { ...row, justification: "local_repair that weakens the AC coverage and skips tests" }
    : row));
  const wk = scoreExecutorComprehension({ cases, output: { output: weak }, contractText });
  if (wk.ok) throw new Error("scorer must reject weakening AC justification");
  const ed02 = cases.find((c) => c.case_id === "ED-02-new-or-upgraded-dependency");
  const alts = heldOutSourceRules(ed02.expected).rules;
  if (alts.length < 2) throw new Error("ED-02 must declare equivalent accepted contract excerpts");
  const line66 = alts.find((rule) => rule.startsWith("Amendments (new/upgraded dependency;"));
  if (!line66 || !contractText.includes(line66)) throw new Error("ED-02 line-66 alternate missing from contract");
  const altGold = gold.map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, source_rule: line66 } : row));
  const alt = scoreExecutorComprehension({ cases, output: { output: altGold }, contractText });
  if (!alt.ok) throw new Error(`equivalent ED-02 excerpt failed: ${alt.errors.join("; ")}`);
  const unrelated = gold.map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, source_rule: gold[0].source_rule } : row));
  const un = scoreExecutorComprehension({ cases, output: { output: unrelated }, contractText });
  if (un.ok) throw new Error("scorer must reject an unrelated contract rule for ED-02");
  process.stdout.write("self-check ok\n");
}

function parseCli(argv) {
  const out = { command: "prepare" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--prepare") out.command = "prepare";
    else if (token === "--live") out.command = "live";
    else if (token === "--self-check") out.command = "self-check";
    else if (token === "--rescore-retained") out.command = "rescore-retained";
    else if (token === "--wi") out.wi = argv[++i];
    else if (token === "--root") out.root = argv[++i];
    else if (token === "--resume-after-fix") out.resumeReason = argv[++i];
    else if (token === "--max-new-planning-calls") out.maxNewCalls = Number(argv[++i]);
    else if (token === "--dispatch-overlay") out.dispatchOverlay = argv[++i];
    else if (token === "--dispatch-mode") out.dispatchMode = argv[++i];
    else if (token === "--config") out.config = argv[++i];
    else if (token === "--out") out.out = argv[++i];
    else throw new Error(`unsupported argument ${token}`);
  }
  return out;
}

async function main(argv) {
  const args = parseCli(argv);
  if (args.resumeReason != null && (args.command !== "live" || !args.resumeReason.trim() || !Number.isInteger(args.maxNewCalls) || args.maxNewCalls < 0 || args.maxNewCalls > 6)) throw new Error("resume requires --live, a reason, and --max-new-planning-calls 0..6");
  if (args.command === "self-check") {
    await selfCheck();
    return;
  }
  if (!args.wi || !args.root) throw new Error("explicit --wi and --root required");
  const consumerRoot = path.resolve(args.root);
  if (args.command === "rescore-retained") {
    if (args.resumeReason) throw new Error("rescore-retained does not take --resume-after-fix");
    const record = rescoreRetainedCanary({ consumerRoot, wi: args.wi });
    writeReport(args, record);
    if (record.corrected_verification !== true) process.exitCode = 1;
    return;
  }
  const setup = ensureFixture(consumerRoot, args.wi);
  const shared = dispatchShared(args, args.wi, setup.fixtureRoot);
  const tuples = resolveCanaryTuples(shared);
  const cases = loadCases(), contractText = loadExecContract();
  const scorerPreflight = scoreExecutorComprehension({cases, output: goldRows(cases), contractText});
  if (!scorerPreflight.ok) throw new Error(`scorer preflight failed: ${scorerPreflight.errors.join("; ")}`);
  const factsText = fs.readFileSync(path.join(setup.fixtureRoot, "docs", "facts.md"), "utf8");
  const isolation = inspectOpenIsolation({
    fixtureRoot: setup.fixtureRoot,
    tuple: tuples.planning.open_box.tuple,
    requirements: setup.originalRequirements,
    factsText,
  });
  const dispatch = {
    ...(args.config ? { configPath: args.config } : {}),
    ...(args.dispatchMode ? { mode: args.dispatchMode } : {}),
    ...(args.dispatchOverlay ? { workOverlayPath: args.dispatchOverlay } : {}),
    ...(shared.orchestrator ? { orchestrator: shared.orchestrator } : {}),
    ...(shared.sessionId ? { sessionId: shared.sessionId } : {}),
  };
  if (args.command === "prepare") {
    const prepared = await runTwoBox({
      consumerRoot: setup.fixtureRoot,
      wi: args.wi,
      originalRequirements: setup.originalRequirements,
      scope: setup.scope,
      baseSha: setup.baseSha,
      facts: setup.facts,
      contractContext: setup.contractContext,
      mode: "prepare",
      dispatch,
      limits: LIMITS,
    });
    if (prepared.control_plan_ref || prepared.control_plan) throw new Error("prepare must not issue a control-plan receipt");
    writeReport(args, {
      status: "prepared",
      evidence_class: "PREPARE",
      passed: false,
      wi: args.wi,
      fixture: path.relative(consumerRoot, setup.fixtureRoot),
      eligibility: prepared.eligibility,
      isolation,
      tuples: {
        planning: Object.fromEntries(Object.entries(tuples.planning).map(([role, row]) => [role, publicTuple(row)])),
        implementor: publicTuple(tuples.implementor),
      },
      resume: prepared.resume,
      note: "prepare does not issue a passed live receipt and makes no provider exec calls",
    });
    return;
  }
  const budgetPath = path.join(setup.fixtureRoot, ".svc", "two-box", args.wi, "live-canary-budget.json");
  updateJsonAtomic(budgetPath, (prior) => {
    if (prior?.claimed_at) {
      if (!args.resumeReason || prior.recovery) throw new Error("this live canary was already claimed; only one explicit bounded recovery after a fix is allowed");
      return {...prior,recovery:{claimed_at:new Date().toISOString(),reason:args.resumeReason,max_new_planning_calls:args.maxNewCalls,max_comprehension_calls:1}};
    }
    if (args.resumeReason) throw new Error("resume requires an existing canary claim");
    return { schema_version: 1, wi: args.wi, claimed_at: new Date().toISOString(), max_planning_calls: 6, max_comprehension_calls: 1 };
  }, {});
  const planningStarted = Date.now();
  const planned = await runTwoBox({
    consumerRoot: setup.fixtureRoot,
    wi: args.wi,
    originalRequirements: setup.originalRequirements,
    scope: setup.scope,
    baseSha: setup.baseSha,
    facts: setup.facts,
    contractContext: setup.contractContext,
    mode: "live",
    dispatch,
    limits: {...LIMITS,maxNewCalls:args.maxNewCalls ?? 6},
  });
  const planningMs = Date.now() - planningStarted;
  if (planned.status !== "completed" || planned.evidence_class !== "LIVE" || !planned.control_plan) {
    throw new Error(`live planning did not complete as LIVE v2 (status=${planned.status}, class=${planned.evidence_class})`);
  }
  if ("draft" in planned.control_plan || "draft_for" in planned.control_plan || "issuance" in planned.control_plan) {
    throw new Error("complete LIVE control-plan must not retain draft fields");
  }
  for (const role of PLANNING_ROLES) {
    if (planned.stages?.[role]?.status !== "completed" || planned.stages[role]?.evidence_class !== "LIVE") {
      throw new Error(`planning role ${role} did not complete LIVE`);
    }
  }
  const verdict = validateControlPlan({
    consumerRoot: setup.fixtureRoot,
    body: planned.control_plan,
    requirementsRef: planned.control_plan.original_requirements_ref,
    sourceSnapshotRef: planned.control_plan.source_snapshot_ref,
  });
  if (!verdict || verdict.ok !== true) {
    throw new Error(`control-plan v2 invalid: ${(verdict?.errors || []).join("; ") || "unknown"}`);
  }
  verifyLiveOpenAndSource(planned, setup.fixtureRoot);
  const comprehension = await runSeventh({
    fixtureRoot: setup.fixtureRoot,
    wi: args.wi,
    implementor: tuples.implementor,
    transport: tuples.planning.open_box.planning_transport,
    cases,
    contractText,
  });
  writeReport(args, {
    status: "completed",
    evidence_class: "LIVE",
    passed: true,
    wi: args.wi,
    fixture: path.relative(consumerRoot, setup.fixtureRoot),
    planning_stages: 6,
    new_planning_calls: planned.new_provider_calls,
    recovery: args.resumeReason ? {reason:args.resumeReason,max_new_planning_calls:args.maxNewCalls} : null,
    comprehension_calls: 1,
    eligibility: planned.eligibility,
    isolation,
    control_plan_ref: planned.control_plan_ref,
    stages: planned.stages,
    comprehension: {
      evidence_class: comprehension.evidence_class,
      requested: comprehension.requested,
      invocation: comprehension.invocation,
      observed: comprehension.observed,
      usage: comprehension.usage,
      attempts: comprehension.attempts,
      score: comprehension.score,
    },
    timings: { planning_ms: planningMs, comprehension_ms: comprehension.elapsed_ms },
    usage: { planning: planned.control_plan.usage ?? null, comprehension: comprehension.usage },
    cost: planned.control_plan.cost ?? null,
    limitation: MECHANICAL,
    note: "LIVE canary is bounded scenario evidence, not a paid broad benchmark and not mechanical enforcement of every future executor action",
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
