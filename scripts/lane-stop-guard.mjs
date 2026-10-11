#!/usr/bin/env node
// lane-stop-guard.mjs - read-only "is the active lane still owed work?" decision for the Stop hook.
//
//   node scripts/lane-stop-guard.mjs --cwd <project> [--session <id>] [--graph <lane-tasks.json>]
//        [--stdin] [--checker <check-chain-receipts.mjs>]
//
// Prints exactly one JSON object on stdout and always exits 0:
//   {"decision":"allow"}                                   no active lane, ambiguous lane, or nothing owed
//   {"decision":"block","laneContinue":true,"next_skill":...,"missing":[...],"remaining":[...],"wi":...,"reason":"SVC_LANE_CONTINUE ..."}
//
// Source of truth for "what is next": $SVC_ROOT/scripts/svc-next.mjs when it exists (exit 5 or
// STATUS next => block). Otherwise a fallback walk over references/stage-registry.json
// mandatory_chain_segments: a step is satisfied by a completed lane task that carries a
// non-empty skill_receipt, or by a chain receipt present on a committed HEAD.
// Quiet (allow) when there is no non-archived .svc/lane-tasks-<WI>.json. Never writes anything.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OWN_ROOT = path.resolve(HERE, "..");

export const RECEIPT_TYPE = Object.freeze({
  "plan-changeset": "plan-manifest",
  "review-plan": "review-plan",
  "execute-changeset": "exec-record",
  "review-exec": "review-exec",
  "audit-implementation": "audit-implementation",
  "verify-promotion": "verify-promotion",
});
const SKILL_FOR_TYPE = Object.freeze(Object.fromEntries(Object.entries(RECEIPT_TYPE).map(([s, t]) => [t, s])));
// Stop's required set on a committed HEAD (mirrors REQUIRED_TYPES_FULL in check-chain-receipts.mjs).
export const STOP_REQUIRED_TYPES = Object.freeze(["plan-manifest", "review-plan", "exec-record", "review-exec", "audit-implementation"]);
const NON_EXECUTION_ROLES = new Set(["reviewer", "adversarial", "research", "audit", "cross-model-review"]);

const truthy = (v) => v === true || v === "true" || v === 1 || v === "1";
const taskSkill = (t) => t?.metadata?.skill || t?.skill || null;

export function chainSteps(registry) {
  const out = [];
  for (const seg of registry?.mandatory_chain_segments || []) {
    for (const step of seg.steps || []) if (step?.skill) out.push(step.skill);
  }
  return out;
}

export function graphMatchesWi(graph, wi) {
  const deps = Array.isArray(graph?.depends_on) ? graph.depends_on.map(String) : [];
  return String(graph?.wi || "") === wi || String(graph?.parent_wi || graph?.parent || "") === wi || deps.includes(wi);
}

function targetWi(payload, cwd) {
  const explicit = process.env.SVC_WORKER_WI || (typeof payload?.wi === "string" ? payload.wi : "");
  if (explicit) return explicit;
  const branch = git(cwd, ["symbolic-ref", "--short", "HEAD"]);
  const m = /WI-(\d+)/i.exec(branch);
  return m ? `WI-${m[1]}` : "";
}

export function isDeliveryLane(graph) {
  const skills = new Set((Array.isArray(graph?.tasks) ? graph.tasks : []).map(taskSkill));
  return skills.has("plan-changeset") && skills.has("execute-changeset");
}

function hasReceipt(task) {
  const r = task?.skill_receipt;
  if (!r) return false;
  if (typeof r === "string") return r.trim().length > 0;
  return typeof r === "object" && Object.keys(r).length > 0;
}

/**
 * Pure walk. Returns the unsatisfied chain steps in chain order as [{skill, type}].
 * receiptIndex: null (no committed HEAD / no checker answer) or
 *   {ok:boolean, requiredTypes:string[], missingTypes:string[]} from check-chain-receipts --consumer stop.
 * A chain skill with no task in the graph is not owed by this lane (skipped) unless the HEAD
 * checker names its receipt type as missing.
 */
export function missingEssential(graph, registry, receiptIndex = null) {
  const steps = chainSteps(registry);
  const tasks = Array.isArray(graph?.tasks) ? graph.tasks.filter(Boolean) : [];
  const present = steps.filter((s) => tasks.some((t) => taskSkill(t) === s));
  if (present.length === 0) return [];
  const idx = receiptIndex && typeof receiptIndex === "object" ? receiptIndex : null;
  const receiptPresent = (type) => Boolean(idx && type && (idx.requiredTypes || []).includes(type) && !(idx.missingTypes || []).includes(type));
  const missing = [];
  const seen = new Set();
  for (const skill of steps) {
    const type = RECEIPT_TYPE[skill] || null;
    const mine = tasks.filter((t) => taskSkill(t) === skill);
    if (mine.length === 0) continue;
    const taskDone = mine.every((t) => t.status === "completed" && hasReceipt(t));
    if (taskDone || receiptPresent(type)) continue;
    missing.push({ skill, type });
    seen.add(skill);
  }
  if (idx && idx.ok === false) {
    for (const type of idx.missingTypes || []) {
      const skill = SKILL_FOR_TYPE[type] || type;
      if (!seen.has(skill)) { missing.push({ skill, type }); seen.add(skill); }
    }
    missing.sort((a, b) => {
      const ia = steps.indexOf(a.skill), ib = steps.indexOf(b.skill);
      return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
    });
  }
  return missing;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--stdin") o.stdin = true;
    else if (["--cwd", "--session", "--graph", "--checker", "--root"].includes(a)) o[a.slice(2)] = argv[++i];
  }
  return o;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function isActiveLaneFile(name) {
  return /^lane-tasks(?:-.+)?\.json$/.test(name) && !name.includes(".completed");
}

function findLaneFiles(start) {
  let dir = path.resolve(start);
  for (;;) {
    const svc = path.join(dir, ".svc");
    let names = [];
    try { names = fs.readdirSync(svc).filter(isActiveLaneFile); } catch { /* none here */ }
    if (names.length) return names.sort().map((n) => path.join(svc, n));
    const up = path.dirname(dir);
    if (up === dir) return [];
    dir = up;
  }
}

function isSubagentPayload(p) {
  if (!p || typeof p !== "object") return false;
  return truthy(p.is_subagent) || truthy(p.metadata?.is_subagent) || p.agent_type === "subagent" || p.role === "subagent"
    || p.invocation?.source === "subagent" || p.parent_session_id != null || p.parentSessionId != null
    || /^SubagentStop$/i.test(String(p.hook_event_name || p.hookEventName || ""));
}

function nonExecutionRole(p, svcDir) {
  const role = String(p?.session_role || p?.role || process.env.SVC_SESSION_ROLE || "");
  if (NON_EXECUTION_ROLES.has(role)) return true;
  try {
    const lines = fs.readFileSync(path.join(svcDir, "session-contract.jsonl"), "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length) {
      const last = JSON.parse(lines[lines.length - 1]);
      if (NON_EXECUTION_ROLES.has(String(last.session_role || last.role || ""))) return true;
    }
  } catch { /* no contract */ }
  return false;
}

function git(root, args) {
  const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: 5000 });
  return r.status === 0 ? String(r.stdout).trim() : "";
}

function receiptIndexFor(root, wi, checkerPath) {
  const sha = git(root, ["rev-parse", "--verify", "HEAD"]);
  if (!/^[0-9a-f]{40}$/.test(sha)) return null; // no commit yet: never ask the checker
  if (!checkerPath || !fs.existsSync(checkerPath)) return null;
  const args = [checkerPath, "--sha", sha, "--consumer", "stop"];
  if (/^WI-[A-Za-z0-9-]+$/.test(wi || "")) args.push("--wi", wi);
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 60000, env: process.env });
  let row = null;
  try { row = JSON.parse(String(r.stdout)).results?.[0] || null; } catch { return null; }
  if (!row) return null;
  if (row.ok === true) return { ok: true, requiredTypes: [...STOP_REQUIRED_TYPES], missingTypes: [] };
  const lines = Array.isArray(row.missing) ? row.missing.map(String) : [];
  const parsed = new Set();
  for (const line of lines) {
    const m = /^([a-z][a-z-]*)\s*:/.exec(line.trim());
    if (m && STOP_REQUIRED_TYPES.includes(m[1])) parsed.add(m[1]);
  }
  let missingTypes = STOP_REQUIRED_TYPES.filter((t) => parsed.has(t));
  if (!missingTypes.length) {
    if (row.type === "unaccounted" || row.type === "incomplete") missingTypes = [...STOP_REQUIRED_TYPES];
    else return null; // an unparseable validity failure is not a "next skill" signal
  }
  return { ok: false, requiredTypes: [...STOP_REQUIRED_TYPES], missingTypes };
}

function parseCard(stdout) {
  const card = {};
  for (const line of String(stdout).split(/\r?\n/)) {
    const m = /^([A-Z_]+)\s+(.*)$/.exec(line.trim());
    if (m && !(m[1] in card)) card[m[1]] = m[2].trim();
  }
  return card;
}

// svc-next is authoritative when present. Returns {owed:true, skill, missing[]} | {owed:false} | null (unusable).
function askSvcNext(svcRoot, projectRoot) {
  const script = path.join(svcRoot, "scripts", "svc-next.mjs");
  if (!fs.existsSync(script)) return null;
  const r = spawnSync(process.execPath, [script, "--root", projectRoot], { cwd: projectRoot, encoding: "utf8", timeout: 30000, env: process.env });
  if (r.error || r.signal) return null;
  const card = parseCard(r.stdout);
  if (r.status === 3 || r.status === 4) return { owed: false };
  const status = (card.STATUS || "").toLowerCase();
  if (r.status === 5 || status === "next" || status === "not_done") {
    const skill = card.SKILL && card.SKILL !== "-" ? card.SKILL : "";
    const missing = card.MISSING && card.MISSING !== "-" ? card.MISSING.split(/[\s,]+/).filter(Boolean) : [];
    return { owed: true, skill, missing };
  }
  if (r.status === 0 && status === "done") return { owed: false };
  return null;
}

function reasonFor(skill, missing) {
  return `SVC_LANE_CONTINUE next=${skill || "-"} missing=${missing.length ? missing.join(",") : "-"}. Run that skill now and follow its handback; do not ask the user.`;
}

export function decide({ cwd, session = "", graph = "", payload = null, checker = "", svcRoot = "" }) {
  const allow = { decision: "allow" };
  if (isSubagentPayload(payload) || truthy(process.env.SVC_SUBAGENT)) return allow;
  let files = graph ? [path.resolve(graph)] : findLaneFiles(cwd);
  if (!files.length) return allow;
  const svcDir = path.dirname(files[0]);
  if (nonExecutionRole(payload, svcDir)) return allow;

  let loaded = files.map((file) => ({ file, g: readJson(file) })).filter((x) => x.g && Array.isArray(x.g.tasks));
  loaded = loaded.filter((x) => !["completed", "archived", "cancelled"].includes(String(x.g.status || "")));
  // Only a compiled delivery lane (plan -> execute) is continued here; any other task graph keeps
  // the completion guard's own bounded pressure.
  loaded = loaded.filter((x) => isDeliveryLane(x.g));
  // An explicit WI target (env, payload, or a WI branch) applies to any number of graphs,
  // a single legacy graph included: a session aimed at another WI is not this lane's session.
  const want = targetWi(payload, cwd);
  if (want) loaded = loaded.filter((x) => graphMatchesWi(x.g, want));
  if (loaded.length !== 1) return allow; // none, or ambiguous: stay quiet
  const { file, g } = loaded[0];
  const projectRoot = path.dirname(path.dirname(file));
  const wi = String(g.wi || path.basename(file).replace(/^lane-tasks-?/, "").replace(/\.json$/, "") || "");

  let skill = "";
  let missing = [];
  let remaining = [];
  const next = askSvcNext(svcRoot || OWN_ROOT, projectRoot);
  if (next) {
    if (!next.owed) return allow;
    skill = next.skill;
    missing = next.missing;
    remaining = [skill, ...missing].filter(Boolean);
  } else {
    const registry = readJson(path.join(OWN_ROOT, "references", "stage-registry.json"));
    if (!registry) return allow;
    const index = receiptIndexFor(projectRoot, wi, checker || path.join(OWN_ROOT, "scripts", "check-chain-receipts.mjs"));
    const gaps = missingEssential(g, registry, index);
    if (!gaps.length) return allow;
    skill = gaps[0].skill;
    missing = gaps[0].type ? [gaps[0].type] : [];
    remaining = gaps.map((x) => x.type || x.skill);
  }
  void session;
  return {
    decision: "block",
    laneContinue: true,
    next_skill: skill,
    missing,
    remaining,
    wi,
    reason: reasonFor(skill, missing),
  };
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  let payload = null;
  if (o.stdin) {
    try { payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { payload = null; }
  }
  const cwd = o.cwd || payload?.cwd || payload?.working_directory || process.cwd();
  // Test seam: an explicit root; without it SVC_ROOT (framework root) or this script's own root.
  const svcRoot = o.root || process.env.SVC_ROOT || "";
  let out;
  try {
    out = decide({ cwd, session: o.session || payload?.session_id || "", graph: o.graph || "", payload, checker: o.checker || "", svcRoot });
  } catch {
    out = { decision: "allow" };
  }
  process.stdout.write(JSON.stringify(out) + "\n");
}

let invoked = false;
try { invoked = Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { /* not main */ }
if (invoked) main();
