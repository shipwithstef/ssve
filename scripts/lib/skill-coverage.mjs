#!/usr/bin/env node
/**
 * scripts/lib/skill-coverage.mjs — WI-556 compile/verify library.
 *
 * Pure, host-agnostic, Node-stdlib-only. The checker (check-chain-receipts)
 * and the merge finalizer wire their own child resolvers into verifyCoverage;
 * tier-1 fixtures inject fakes so every scenario runs hermetically with zero
 * subprocess spawns.
 *
 * Invariants implemented here (see manifest Architecture Decisions):
 *   D1  coverage receipt is an INDEX — verification recomputes children
 *   D2  required[] recompiled from canonicalized commit-tree graph; exact
 *       task_id+skill multiset equality; digest equality necessary-not-sufficient
 *   D3  AUTHORIZED_NA requires registered policy condition + decision evidence
 *   D4  producer binding: evidence identity = receipt-slot type emitted only
 *       after that skill's phases ran
 *   D7  applicable set = mandatory chain minus land-changeset/verify-promotion
 *       (the 5 skills whose producer receipt types exist pre-merge)
 */
import { createHash } from "node:crypto";
import { MANDATORY_DELIVERY_CHAIN } from "./mandatory-delivery-chain.mjs";

export const CANONICALIZER_VERSION = 1;

/** Chain skills whose authoritative producer receipt type exists pre-merge. */
export const COVERAGE_CHAIN = Object.freeze(
  MANDATORY_DELIVERY_CHAIN.filter((skill) =>
    skill !== "review-gate" && skill !== "land-changeset" && skill !== "verify-promotion"),
);
// review-gate excluded: no authoritative receipt type exists for it
// (chain-receipt-contract table); its G5 verdict rides exec-record phase
// evidence plus audit-implementation. COVERAGE_CHAIN therefore mirrors the
// checker's own REQUIRED_TYPES_FULL producer set exactly.

export const PRODUCER_RECEIPT_TYPE = Object.freeze({
  "plan-changeset": "plan-manifest",
  "review-plan": "review-plan",
  "execute-changeset": "exec-record",
  "review-exec": "review-exec",
  "audit-implementation": "audit-implementation",
});

export const POLICY_CONDITION_IDS = Object.freeze([
  "accepted_spec_substitution",
  "external_grade_addon",
  "no_product_surface",
  "conditional_route_rule",
]);

export const POLICY_REGISTRY_DIGEST = sha256Hex(JSON.stringify([...POLICY_CONDITION_IDS].sort()));

/** Receipt hard ceilings (codex C8): schema cannot express arithmetic. */
export const REQUIRED_ITEM_CAP = 64;
export const RECEIPT_BYTE_CEILING = 32768;

const VOLATILE_TASK_FIELDS = new Set([
  "status",
  "completed_at",
  "skill_receipt",
  "process_receipts",
  "skip_reason",
]);

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export { stableStringify };

/**
 * Canonical form of a lane-tasks graph: volatile execution state stripped,
 * keys recursively sorted, fixed serialization. Digest is lifecycle-stable by
 * construction (grok R2#2 / cursor-agent #2).
 */
const VOLATILE_GRAPH_FIELDS = new Set(["status", "completed_at", "updated_at"]);

export function canonicalizeLaneTasks(rawGraph) {
  const clone = JSON.parse(typeof rawGraph === "string" ? rawGraph : JSON.stringify(rawGraph));
  for (const key of Object.keys(clone)) {
    if (VOLATILE_GRAPH_FIELDS.has(key)) delete clone[key];
  }
  if (Array.isArray(clone.tasks)) {
    clone.tasks = clone.tasks.map((task) => {
      const out = {};
      for (const [key, value] of Object.entries(task)) {
        if (!VOLATILE_TASK_FIELDS.has(key)) out[key] = value;
      }
      return out;
    });
  }
  return stableStringify(clone);
}

export function graphDigestFromRaw(rawGraph) {
  return sha256Hex(canonicalizeLaneTasks(rawGraph));
}

export function taskSkillName(task) {
  return String(task?.metadata?.skill || task?.skill || "").trim();
}

/**
 * Compile the applicable mandatory set (D7). Throws when a chain-mandatory
 * skill has no owning task — that is a route violation surfaced at compile.
 */
export function compileCoverage({ graph, wi }) {
  const tasks = Array.isArray(graph?.tasks) ? graph.tasks : [];
  const required = [];
  const problems = [];
  for (const skill of COVERAGE_CHAIN) {
    const task = tasks.find((candidate) => taskSkillName(candidate) === skill);
    if (!task) { problems.push(`mandatory chain skill "${skill}" has no owning task in graph`); continue; }
    // D7: chain-mandatory skills cannot be skipped; optional upstream skills
    // with registered skip conditions are outside the applicable set entirely.
    required.push({
      task_id: String(task.id),
      skill,
      reason: "mandatory_chain",
      status: "pass",
      producer_receipt_type: PRODUCER_RECEIPT_TYPE[skill],
    });
  }
  return {
    receipt_type: "skill-coverage",
    wi,
    required,
    problems,
    graph_digest: graphDigestFromRaw(graph),
    canonicalizer_version: CANONICALIZER_VERSION,
  };
}

function multisetKey(entry) {
  return `${String(entry.task_id)}\u0000${String(entry.skill)}`;
}

function countsOf(required) {
  let pass = 0;
  let authorizedNa = 0;
  for (const entry of required) {
    if (entry.status === "authorized_na") authorizedNa += 1;
    else pass += 1;
  }
  return { required: required.length, pass, authorized_na: authorizedNa };
}

function slotSha(slot) {
  // Identity model (WI-550): slot::<type>::<wi>::<target_sha>[::<phase>]
  const parts = String(slot || "").split("::").filter(Boolean);
  const candidate = parts.length >= 4 ? parts[3] : "";
  return /^[0-9a-f]{40}$/.test(candidate) ? candidate : "";
}

/**
 * Verify one coverage receipt against the recomputed applicable set and the
 * live envelope. `resolveChild(slot)` must return the parsed child receipt or
 * null. Unknown vs No taxonomy: an unresolvable tree graph is UNKNOWN; any
 * concrete mismatch is NO — never YES on uncertainty (AC-2).
 */
export function verifyCoverage({ receipt, treeGraphRaw = null, resolveChild }) {
  const reasons = [];
  const rows = [];
  const fail = (reason) => reasons.push(reason);
  if (!receipt || receipt.receipt_type !== "skill-coverage") return { verdict: "no", reasons: ["receipt is not a skill-coverage index"], rows };
  if (!treeGraphRaw) return { verdict: "unknown", reasons: ["coverage graph source unresolvable from target tree"], rows };
  if (stableStringify(receipt).length > RECEIPT_BYTE_CEILING) fail(`receipt exceeds byte ceiling ${RECEIPT_BYTE_CEILING}`);
  if (Number(receipt.canonicalizer_version) !== CANONICALIZER_VERSION) fail(`canonicalizer_version ${receipt.canonicalizer_version} does not match library ${CANONICALIZER_VERSION}`);
  const digest = graphDigestFromRaw(treeGraphRaw);
  if (receipt.graph_digest !== digest) fail(`graph_digest mismatch: receipt=${receipt.graph_digest} recomputed=${digest}`);
  if (receipt.policy_registry_digest && receipt.policy_registry_digest !== POLICY_REGISTRY_DIGEST) fail(`policy_registry_digest mismatch`);

  // Recompile from the SAME canonicalized tree graph and require exact multiset
  // equality — digest-equal alone does not defeat under-compilation (grok R2#2).
  // Present-graph inventory problems are NO; only unreadable graphs stay UNKNOWN.
  let expected;
  try {
    const parsedTreeGraph = JSON.parse(canonicalizeLaneTasks(treeGraphRaw));
    expected = compileCoverage({ graph: parsedTreeGraph, wi: receipt.wi });
    if (expected.problems.length > 0) {
      for (const problem of expected.problems) fail(problem);
      expected.required = [];
    }
  } catch (error) {
    return { verdict: "unknown", reasons: [`tree graph unreadable: ${error.message}`], rows };
  }
  const got = Array.isArray(receipt.required) ? receipt.required : [];
  const expectedKeys = new Map();
  for (const entry of expected.required) expectedKeys.set(multisetKey(entry), (expectedKeys.get(multisetKey(entry)) || 0) + 1);
  const gotKeys = new Map();
  for (const entry of got) gotKeys.set(multisetKey(entry), (gotKeys.get(multisetKey(entry)) || 0) + 1);
  for (const [key, count] of expectedKeys) {
    if ((gotKeys.get(key) || 0) !== count) fail(`required[] inventory missing entry ${JSON.stringify(key.replace("\u0000", "::"))}`);
  }
  for (const [key, count] of gotKeys) {
    if ((expectedKeys.get(key) || 0) !== count) fail(`required[] carries non-applicable entry ${JSON.stringify(key.replace("\u0000", "::"))}`);
  }

  const seenTasks = new Set();
  for (const entry of got) {
    if (seenTasks.has(entry.task_id)) fail(`duplicate task_id in required[]: ${entry.task_id}`);
    seenTasks.add(entry.task_id);
  }

  const actualCounts = countsOf(got);
  const declaredCounts = receipt.counts || {};
  for (const field of ["required", "pass", "authorized_na"]) {
    if (Number(declaredCounts[field]) !== actualCounts[field]) fail(`counts.${field} declared=${declaredCounts[field]} actual=${actualCounts[field]}`);
  }

  for (const entry of got) {
    if (entry.status === "authorized_na") {
      const okCondition = POLICY_CONDITION_IDS.includes(String(entry.policy_condition_id || ""));
      const okDecision = Boolean(entry.decision_ref) && !Number.isNaN(Date.parse(entry.decided_at || ""));
      rows.push({ ...pickRowFields(entry), result: okCondition && okDecision ? "PASS" : "NO", detail: okCondition && okDecision ? "policy NA verified against registry" : "unregistered condition or missing decision evidence" });
      if (!okCondition) fail(`${entry.skill}: policy_condition_id not in registry`);
      if (!okDecision) fail(`${entry.skill}: AUTHORIZED_NA lacks decision_ref/decided_at`);
      continue;
    }
    const slot = String(entry.receipt_slot || "");
    const child = typeof resolveChild === "function" ? resolveChild(slot) : null;
    if (!child) {
      rows.push({ ...pickRowFields(entry), result: "MISSING", detail: `child slot not found in envelope` });
      fail(`${entry.skill}: child receipt slot missing`);
      continue;
    }
    const beforeLen = reasons.length;
    if (child.receipt_type !== entry.producer_receipt_type) fail(`${entry.skill}: child receipt_type=${child.receipt_type} expected ${entry.producer_receipt_type}`);
    if (String(child.wi || "") !== String(receipt.wi)) fail(`${entry.skill}: child wi binding mismatch`);
    if (slotSha(slot) !== receipt.target_sha) fail(`${entry.skill}: slot bound to different SHA than coverage target`);
    if (entry.receipt_sha256 && entry.receipt_sha256 !== sha256Hex(stableStringify(child))) fail(`${entry.skill}: child receipt bytes fail digest rebinding (tamper or drift)`);
    rows.push({ ...pickRowFields(entry), result: reasons.length === beforeLen ? "PASS" : "INVALID", detail: reasons.length === beforeLen ? `${entry.producer_receipt_type} slot verified` : "child binding check failed" });
  }

  if (got.length > REQUIRED_ITEM_CAP) fail(`required[] exceeds item cap ${REQUIRED_ITEM_CAP}`);
  if (receipt.verdict !== "pass") fail("emitted verdict must be pass; failures are never emitted");

  return { verdict: reasons.length === 0 ? "pass" : "no", reasons, rows };
}

function pickRowFields(entry) {
  return { task_id: entry.task_id, skill: entry.skill, status: entry.status };
}

export function renderCoverageTable(result, { targetSha, displayVerdict } = {}) {
  const lines = [];
  lines.push(`coverage target ${targetSha || "<sha>"} verdict=${(displayVerdict || result.verdict).toUpperCase()}`);
  for (const row of result.rows) {
    lines.push(`| ${row.task_id} | ${row.skill} | ${row.status} | ${row.result} | ${row.detail} |`);
  }
  for (const reason of result.reasons) lines.push(`REASON: ${reason}`);
  return lines;
}
