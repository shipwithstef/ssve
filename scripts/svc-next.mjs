#!/usr/bin/env node
/**
 * svc-next: the lane driver. Reads the ONE compiled `.svc/lane-tasks-<WI>.json`
 * (written by compile-delivery-graph.mjs) and prints a short card naming the
 * skill to run next. A skill hands control back with `--done <skill> --receipt ...`.
 *
 *   node "$SVC_ROOT/scripts/svc-next.mjs" --root . [--wi WI]
 *       [--done <skill> --receipt <type>:<sha256> | --receipt load-skill]
 *   node "$SVC_ROOT/scripts/svc-next.mjs" --template <receipt-type> [--wi WI]
 *   node "$SVC_ROOT/scripts/svc-next.mjs" --root . [--wi WI] --recipe <receipt-type>   # the complete command sequence for plan-manifest / review-*
 *   node "$SVC_ROOT/scripts/svc-next.mjs" --root . [--wi WI] --sha <receipt-type>   # prints <type>:<sha256> of the newest receipt
 *
 * Stdout is always exactly these lines (nothing else):
 *   STATUS next|done|not_done
 *   SKILL <skill>|-
 *   TASK <id>|-
 *   INPUTS <path>[:ABSENT],...|-
 *   EMIT <emit-receipt command>|-
 *   PROCESS <skill>[:<mode>],...|-
 *   CLOSEOUT <command>|-
 *   MISSING <receipt-type>,...|-
 *
 * Exit: 0 next or done; 3 no graph / ambiguous graphs; 4 bad --done/--receipt
 * or out of order (nothing is written); 5 not done: a required receipt is
 * missing or stale. Diagnostics go to stderr.
 *
 * The driver never compiles, classifies, reviews, or invents a receipt type.
 * A receipt is checked, never created: sha256(file bytes) must match a file
 * emit-receipt.mjs wrote (staging or SHA mirror) whose receipt_type and wi
 * match the graph.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonAtomic, updateJsonAtomic } from "./state-io.mjs";
import { validateReceipt } from "./emit-receipt.mjs";
import { familyOf } from "./lib/cognitive-family.mjs";
import { verifyReviewerEvidence } from "./lib/reviewer-evidence.mjs";
import { candidateTreeIdentity } from "./lib/external-review-provenance.mjs";
import { putObject } from "./lib/review-evidence-store.mjs";
import { validatePlanSchema } from "./lib/plan-manifest-contract.mjs";
import { loadPlanAuthority } from "./lib/receipt-issuance-epoch.mjs";
import { semanticContractDigest } from "./lib/transmutation-seal.mjs";
import { getByRef } from "./lib/two-box-protocol.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = resolve(SCRIPT_DIR, "..");

/** Chain skills that carry an emit-receipt receipt, and the type each emits. */
export const EMIT_TYPE = Object.freeze({
  "plan-changeset": "plan-manifest",
  "review-plan": "review-plan",
  "execute-changeset": "exec-record",
  "review-exec": "review-exec",
  "audit-implementation": "audit-implementation",
  "verify-promotion": "verify-promotion",
});
const CHAIN_SKILLS = new Set([...Object.keys(EMIT_TYPE), "review-gate", "land-changeset"]);
const SHA_RE = /^[0-9a-f]{64}$/;
const LOAD_SKILL = "load-skill";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const taskSkill = (task) => {
  for (const v of [task?.metadata?.skill, task?.skill, task?.process_skill]) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
};

export class CliError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function parseArgs(argv) {
  const out = { root: ".", wi: null, done: null, receipt: null, template: null, sha: null, recipe: null, buildReview: null, summary: null, out: null, planBody: null, orchestrator: null, store: false, candidateDigest: null, orchestratorId: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v == null) throw new CliError(4, `${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === "--root") out.root = next();
    else if (a === "--wi") out.wi = next();
    else if (a === "--done") out.done = next();
    else if (a === "--receipt") out.receipt = next();
    else if (a === "--template") out.template = next();
    else if (a === "--sha") out.sha = next();
    else if (a === "--recipe") out.recipe = next();
    else if (a === "--build-review") out.buildReview = next();
    else if (a === "--summary") out.summary = next();
    else if (a === "--out") out.out = next();
    else if (a === "--plan-body") out.planBody = next();
    else if (a === "--orchestrator") out.orchestrator = next();
    else if (a === "--store") out.store = true;
    else if (a === "--candidate-digest") out.candidateDigest = next();
    else if (a === "--orchestrator-id") out.orchestratorId = true;
    else throw new CliError(4, `unknown argument: ${a}`);
  }
  return out;
}

// ---------------------------------------------------------------- graph lookup

function listGraphs(root) {
  const dir = join(root, ".svc");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^lane-tasks-.+\.json$/.test(n) && !/\.completed|\.tmp\./.test(n))
    .sort()
    .map((n) => join(dir, n));
}

function selectGraph(root, wi) {
  const files = listGraphs(root);
  const loaded = files.flatMap((file) => {
    try {
      const graph = readJsonAtomic(file);
      return graph && Array.isArray(graph.tasks) ? [{ file, graph }] : [];
    } catch { return []; }
  });
  if (wi) {
    const hit = loaded.filter((g) => g.graph.wi === wi || g.file.endsWith(`lane-tasks-${wi}.json`));
    if (hit.length === 1) return hit[0];
    throw new CliError(3, `no .svc/lane-tasks-${wi}.json under ${root}; compile one with compile-delivery-graph.mjs`);
  }
  if (loaded.length === 0) {
    throw new CliError(3, `no .svc/lane-tasks-<WI>.json under ${root}; compile the lane graph first with node "$SVC_ROOT/scripts/compile-delivery-graph.mjs" --wi <WI> --lane <lane> --change-type <type> --intent "<goal>" --out .svc/lane-tasks-<WI>.json`);
  }
  if (loaded.length === 1) return loaded[0];
  const open = loaded.filter((g) => !["completed", "skipped"].includes(g.graph.status));
  if (open.length === 1) return open[0];
  throw new CliError(3, `ambiguous: ${loaded.length} lane graphs (${loaded.map((g) => g.file).join(", ")}); pass --wi <WI> (one graph per work item; compile-delivery-graph.mjs writes it)`);
}

// ------------------------------------------------------------------- receipts

function receiptDirs(root) {
  const base = join(root, ".svc", "receipts");
  if (!existsSync(base)) return [];
  const dirs = [];
  const add = (d) => { try { if (statSync(d).isDirectory()) dirs.push(d); } catch { /* gone */ } };
  const staging = join(base, "staging");
  if (existsSync(staging)) for (const n of readdirSync(staging)) add(join(staging, n));
  for (const n of readdirSync(base)) if (n !== "staging") add(join(base, n));
  return dirs;
}

/** Every receipt file for (type, wi) under staging/<tree>/ and <sha>/ mirrors. */
function receiptCandidates(root, type, wi) {
  const found = [];
  for (const dir of receiptDirs(root)) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (name !== `${type}.json` && !(name.startsWith(`${type}--${wi}`) && name.endsWith(".json"))) continue;
      const file = join(dir, name);
      try {
        const bytes = readFileSync(file);
        const body = JSON.parse(bytes.toString("utf8"));
        if (body?.receipt_type !== type || String(body?.wi) !== String(wi)) continue;
        found.push({ file, sha256: sha256(bytes), bytes });
      } catch { /* unreadable or not JSON: not a receipt */ }
    }
  }
  return found;
}

function liveReceipt(root, wi, type, digest) {
  if (!type || !SHA_RE.test(String(digest || ""))) return null;
  return receiptCandidates(root, type, wi).find((c) => c.sha256 === digest) || null;
}

// ------------------------------------------------------------------ task model

const isSkipped = (task) => {
  if (task.status === "skipped") return true;
  return task.status === "completed" && typeof task.skip_reason === "string" && task.skip_reason.length > 0;
};

/**
 * Does this chain skill's receipt still stand? The recorded bytes must exist AND still pass the
 * receipt's own acceptance rules (current schema, passing verdict, authenticated cross-family
 * reviewer evidence): a hash match alone never keeps a stage complete.
 */
const acceptedCache = new Map();
function chainLive(root, graph, task) {
  const type = EMIT_TYPE[taskSkill(task)];
  if (!type) return true;
  const cr = task.chain_receipt;
  if (!cr || cr.type !== type) return false;
  const hit = liveReceipt(root, graph.wi, type, cr.sha256);
  if (!hit) return false;
  const key = `${root}\0${type}\0${cr.sha256}\0${Boolean(__testing.emitterValidator)}`;
  if (!acceptedCache.has(key)) {
    let ok = false;
    try { ok = acceptanceReasons(root, type, JSON.parse(hit.bytes.toString("utf8")), { issuance: false }).length === 0; } catch { ok = false; }
    acceptedCache.set(key, ok);
  }
  return acceptedCache.get(key);
}

/** A chain stage is unfinished unless it is completed (never skipped) with a live receipt. */
const chainBad = (root, graph, task) =>
  Boolean(EMIT_TYPE[taskSkill(task)]) && !(task.status === "completed" && !task.skip_reason && chainLive(root, graph, task));

/** A completed stage whose required process evidence is missing, changed or deleted. */
const processBad = (root, task) => task.status === "completed" && processSteps(root, task).length > 0;

const needsRepair = (root, graph, task) => chainBad(root, graph, task) || processBad(root, task);

/** A blocker is satisfied when completed (live receipt and process evidence) or validly skipped. */
function blockerSatisfied(root, graph, task) {
  return (task.status === "completed" || isSkipped(task)) && !needsRepair(root, graph, task);
}

/**
 * The same stage partition the card uses. `runnable` is every pending stage whose
 * blockers are satisfied under receipt and process evidence, in graph order.
 * `repair` is the first completed or skipped stage whose evidence is missing.
 * Ownership selectors import this so they cannot drift from the card.
 */
export function selectSchedule(root, graph) {
  const tasks = Array.isArray(graph?.tasks) ? graph.tasks : [];
  const byId = new Map(tasks.map((t) => [String(t.id), t]));
  // A finished stage whose receipt or process evidence is gone or changed holds back everything downstream.
  const stale = tasks.filter((t) => (t.status === "completed" || t.status === "skipped") && needsRepair(root, graph, t));
  const staleIds = new Set(stale.map((t) => String(t.id)));
  const downstreamOfStale = (task) => {
    const seen = new Set();
    const stack = [...(task.blocked_by || [])];
    while (stack.length) {
      const id = String(stack.pop());
      if (seen.has(id)) continue;
      seen.add(id);
      if (staleIds.has(id)) return true;
      stack.push(...(byId.get(id)?.blocked_by || []));
    }
    return false;
  };
  const blockersOk = (t) => (t.blocked_by || []).every((id) => {
    const b = byId.get(String(id));
    return b && blockerSatisfied(root, graph, b);
  });
  const active = tasks.find((t) => t.status === "in_progress" && !downstreamOfStale(t) && blockersOk(t)) || null;
  const runnable = tasks.filter((t) => t.status === "pending" && !downstreamOfStale(t) && blockersOk(t));
  const terminal = tasks.length > 0 && tasks.every((t) => t.status === "completed" || isSkipped(t));
  return { active, runnable, repair: stale[0] || null, terminal };
}

function findCardTask(root, graph) {
  const schedule = selectSchedule(root, graph);
  if (schedule.active) return { task: schedule.active, kind: "active" };
  if (schedule.runnable.length) return { task: schedule.runnable[0], kind: "runnable" };
  if (schedule.repair) return { task: schedule.repair, kind: "repair" };
  return null;
}

function missingTypes(root, graph) {
  const types = new Set();
  const out = [];
  for (const t of graph.tasks) {
    const type = EMIT_TYPE[taskSkill(t)];
    if (type) types.add(type);
  }
  // A type is satisfied only when EVERY task of that skill is completed with a live receipt.
  for (const type of types) {
    if (graph.tasks.some((t) => EMIT_TYPE[taskSkill(t)] === type && chainBad(root, graph, t))) out.push(type);
  }
  for (const t of graph.tasks) {
    if (!processBad(root, t)) continue;
    for (const step of processSteps(root, t)) {
      const entry = `process:${step}`;
      if (!out.includes(entry)) out.push(entry);
    }
  }
  return out;
}

const allTerminal = (graph) => graph.tasks.every((t) => t.status === "completed" || isSkipped(t));

// ---------------------------------------------------------------------- inputs

function skillFile(skill) {
  const root = process.env.SVC_ROOT || FRAMEWORK_ROOT;
  for (const base of [root, FRAMEWORK_ROOT]) {
    const f = join(base, "skills", skill, "SKILL.md");
    if (existsSync(f)) return f;
  }
  return null;
}

/** `inputs.required[].path` entries from a SKILL.md front matter. */
export function requiredInputPaths(skill) {
  const file = skillFile(skill);
  if (!file) return [];
  const text = readFileSync(file, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return [];
  const lines = m[1].split(/\r?\n/);
  const start = lines.findIndex((l) => /^inputs:\s*$/.test(l));
  if (start < 0) return [];
  const paths = [];
  let inRequired = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break;
    if (/^\s{2}required:\s*$/.test(line)) { inRequired = true; continue; }
    if (/^\s{2}\S/.test(line) && !/^\s{2}required:/.test(line) && !/^\s{4}/.test(line)) inRequired = false;
    if (!inRequired) continue;
    const p = /path:\s*["']?([^"',}\s]+)["']?/.exec(line);
    if (p) paths.push(p[1]);
  }
  return paths;
}

function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|\\]/g, "\\$&").replace(/<[^>]*>/g, "*").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp(`^${esc}$`);
}

function pathPresent(root, p) {
  if (!/[<*?]/.test(p)) return existsSync(join(root, p));
  const parts = p.split("/");
  let dirs = [root];
  for (let i = 0; i < parts.length; i += 1) {
    const last = i === parts.length - 1;
    const next = [];
    for (const d of dirs) {
      if (!/[<*?]/.test(parts[i])) {
        const c = join(d, parts[i]);
        if (existsSync(c)) next.push(c);
        continue;
      }
      let names = [];
      try { names = readdirSync(d); } catch { continue; }
      const re = globToRegex(parts[i]);
      for (const n of names) if (re.test(n)) next.push(join(d, n));
    }
    dirs = next;
    if (!dirs.length) return false;
    if (last) return true;
  }
  return dirs.length > 0;
}

// ------------------------------------------------------------------------ card

function processSteps(root, task) {
  const steps = task?.metadata?.required_process_steps || [];
  const unmet = [];
  for (const step of steps) {
    const r = (task.process_receipts || []).find((row) => row?.skill === step.skill && String(row?.mode || "") === String(step.mode || ""));
    let ok = false;
    if (r?.evidence?.path && SHA_RE.test(String(r.evidence.sha256 || ""))) {
      const file = resolve(root, r.evidence.path);
      try { ok = existsSync(file) && sha256(readFileSync(file)) === r.evidence.sha256; } catch { ok = false; }
    }
    if (!ok) unmet.push(`${step.skill}${step.mode ? `:${step.mode}` : ""}`);
  }
  return unmet;
}

const shq = (p) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(p) ? p : `'${String(p).replace(/'/g, "'\\''")}'`);

/** The svc-next invocation a card hands out: it keeps the selected project root AND the selected WI. */
function nextCmd(ctx) {
  return `node "$SVC_ROOT/scripts/svc-next.mjs" --root ${shq(ctx.rootArg)} --wi ${ctx.wi}`;
}

const inRoot = (ctx, command) => (ctx.rootArg === "." ? command : `cd ${shq(ctx.rootArg)} && ${command}`);

/** Types whose body svc-next can finish from the repository alone (plus the model's verdict fields). */
const BODY_FILE_TYPES = new Set(["exec-record", "audit-implementation", "verify-promotion"]);

function emitCommand(type, ctx) {
  if (!BODY_FILE_TYPES.has(type)) return `${nextCmd(ctx)} --recipe ${type}`;
  const body = `.svc/${type}.body.json`;
  const tpl = `node "$SVC_ROOT/scripts/svc-next.mjs" --root . --template ${type} --wi ${ctx.wi}`;
  const emit = `node "$SVC_ROOT/scripts/emit-receipt.mjs" --type ${type} --wi ${ctx.wi} --body ${body}`;
  const sha = `node "$SVC_ROOT/scripts/svc-next.mjs" --root . --wi ${ctx.wi} --sha ${type}`;
  return inRoot(ctx, `git add -A && { test -f ${body} || ${tpl} > ${body}; } && if grep -q 'FILL: ' ${body}; then echo "edit ${body}: replace every FILL: value, then run this EMIT command again"; else ${emit} && ${sha}; fi`);
}

const PLAN_DIR = (wi) => `docs/plans/${wi}`;
const PLAN_BODY = ".svc/external-review-artifacts/plan-handoff/body.json";

/**
 * The complete working sequence for the receipts that have no one-line form. Every step is a shell
 * command run from the project root, except the ones marked MODEL (authoring / reviewer work).
 * Placeholders in <angle brackets> are values the previous step printed.
 */
export function recipeFor(type, ctx) {
  const wi = ctx.wi;
  const SR = '"$SVC_ROOT"/scripts';
  const NEXT = `node ${SR}/svc-next.mjs --root . --wi ${wi}`;
  const sha = `${NEXT} --sha ${type}`;
  const NO_SUBSTITUTE = "Adversarial review is cross-family by design: if the launcher cannot reach the reviewer, stop and report it; never substitute a same-host or self review.";
  const planReviewDir = ".svc/external-review-artifacts/plan-review";
  const manifest = `${PLAN_DIR(wi)}/manifest.md`;
  const planReview = `SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$PWD/${planReviewDir}" bash ${SR}/review-plan-codex.sh ${manifest} > .svc/review-plan.findings.json`;
  const buildPlan = `${NEXT} --build-review plan --summary ${planReviewDir}/summary.json --out .svc/review-plan.body.json`;
  if (type === "plan-manifest") {
    return [
      `# plan-manifest for ${wi} (run from the project root; .svc/ must be gitignored; two-box planning)`,
      `1. MODEL  write the original requirements and facts as the two-box input JSON, then: node ${SR}/two-box-plan.mjs --input <input.json> --mode live --out .svc/two-box-plan.out.json`,
      `   It runs the independent Open/Contract boxes, the two scouts and the assessor through the external reviewer CLI. ${NO_SUBSTITUTE}`,
      `2. MODEL  write ${manifest} with frontmatter "work_item: ${wi}" and one <!-- SVC_PLAN_BODY --> fenced JSON object, schema_version 5, planning_contract.kind two_box with the refs from step 1 (shapes: references/manifest-templates.md; starting point: node ${SR}/svc-next.mjs --root . --template plan-manifest --wi ${wi}).`,
      `3. git add -A -- . ':!${PLAN_DIR(wi)}'      # stage the candidate; the manifest itself stays unstaged (the plan scope must equal the staged candidate)`,
      `4. node ${SR}/prepare-plan-handoff.mjs --manifest ${manifest} --write --out ${PLAN_BODY}`,
      `5. ${planReview}      # the cross-family plan review of the exact prepared bytes. ${NO_SUBSTITUTE}`,
      `6. ${buildPlan} --store      # builds the canonical review-plan body from the launcher run, proves it, stores it; prints review_ref <sha256>`,
      `7. node ${SR}/prepare-plan-handoff.mjs --manifest ${manifest} --seal-after-review <review_ref>      # prints {"seal_ref":{...}}`,
      `8. node ${SR}/emit-receipt.mjs --type plan-manifest --wi ${wi} --body ${PLAN_BODY} --manifest ${manifest} --seal-ref '<seal_ref as printed>'`,
      `9. ${sha}      # prints plan-manifest:<sha256> for the CLOSEOUT line`,
    ];
  }
  if (type === "review-plan") {
    return [
      `# review-plan for ${wi} (run from the project root)`,
      `1. ${planReview}      # an exact repeat of the plan-stage review replays the signed result; ${NO_SUBSTITUTE}`,
      `2. ${buildPlan}      # canonical review-plan body from the launcher run: current schema, authenticated reviewer evidence, cross-family check`,
      `3. node ${SR}/emit-receipt.mjs --type review-plan --wi ${wi} --sha "$(git rev-parse HEAD)" --body .svc/review-plan.body.json`,
      `4. ${sha}      # prints review-plan:<sha256> for the CLOSEOUT line`,
    ];
  }
  if (type === "review-exec") {
    const pkg = ".svc/review-cross-model-package.md";
    return [
      `# review-exec for ${wi} (run from the project root; package rules: skills/review-cross-model/SKILL.md)`,
      `1. MODEL  write the review package to ${pkg} (the frozen diff and entry points).`,
      `2. DIGEST="$(${NEXT} --candidate-digest exec)" && printf '\\ncandidate_digest=%s\\n' "$DIGEST" >> ${pkg}      # the launcher needs the frozen candidate digest inside the request`,
      `3. SVC_WI=${wi} node ${SR}/run-external-review.mjs --orchestrator "$(${NEXT} --orchestrator-id)" --review-kind exec --candidate-digest "$DIGEST" --input-file ${pkg} --artifacts-dir .svc/external-review-artifacts/cross-model > .svc/review-exec.summary.json      # ${NO_SUBSTITUTE}`,
      `4. ${NEXT} --build-review exec --summary .svc/review-exec.summary.json --out .svc/review-exec.body.json      # canonical review-exec body from the launcher run`,
      `5. node ${SR}/emit-receipt.mjs --type review-exec --wi ${wi} --sha "$(git rev-parse HEAD)" --body .svc/review-exec.body.json`,
      `6. ${sha}      # prints review-exec:<sha256> for the CLOSEOUT line`,
    ];
  }
  if (BODY_FILE_TYPES.has(type)) {
    return [`# ${type}`, `1. ${emitCommand(type, ctx)}`];
  }
  throw new CliError(4, `no recipe for receipt type: ${type}`);
}

function buildCard(root, graph, file, rootArg = ".") {
  const wi = graph.wi;
  const ctx = { rootArg, wi };
  const pick = findCardTask(root, graph);
  const missing = missingTypes(root, graph);
  let status;
  let exit = 0;
  if (pick) {
    status = pick.kind === "repair" ? "not_done" : "next";
    if (pick.kind === "repair") exit = 5;
  } else if (allTerminal(graph) && missing.length === 0) {
    status = "done";
  } else {
    status = "not_done";
    exit = 5;
  }
  const lines = [];
  const task = pick?.task || null;
  const skill = task ? taskSkill(task) : null;
  const type = skill ? EMIT_TYPE[skill] : null;
  const inputs = skill ? requiredInputPaths(skill).map((p) => (pathPresent(root, p) ? p : `${p}:ABSENT`)) : [];
  const unmet = task ? processSteps(root, task) : [];
  lines.push(`STATUS ${status}`);
  lines.push(`SKILL ${skill || "-"}`);
  lines.push(`TASK ${task ? task.id : "-"}`);
  lines.push(`INPUTS ${inputs.length ? inputs.join(",") : "-"}`);
  lines.push(`EMIT ${type ? emitCommand(type, ctx) : "-"}`);
  lines.push(`PROCESS ${unmet.length ? unmet.join(",") : "-"}`);
  lines.push(`CLOSEOUT ${skill ? `${nextCmd(ctx)} --done ${skill} --receipt ${type ? `${type}:<sha256>` : LOAD_SKILL}` : "-"}`);
  lines.push(`MISSING ${missing.length ? missing.join(",") : "-"}`);
  return { lines, exit, status, task, skill, type, file };
}

// ------------------------------------------------------------------ --template

function gitOut(args, root) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
}

const FILL = "FILL: ";
const PASSING = new Set(["pass", "pass-with-acks"]);

export function receiptTemplate(type, wi, root = ".") {
  const timestamp = new Date().toISOString();
  const base = { receipt_type: type, schema_version: 1, wi, timestamp };
  switch (type) {
    case "exec-record": {
      const diff = gitOut(["diff", "--cached", "--binary"], root);
      const names = gitOut(["diff", "--cached", "--name-only"], root).split("\n").filter(Boolean);
      return { ...base, diff_hash: sha256(diff), files_touched: names, dispatch_model: process.env.SVC_MODEL || "orchestrator" };
    }
    case "audit-implementation":
      return { ...base, verdict: `${FILL}pass | fail | pass-with-acks`, findings: [] };
    case "verify-promotion":
      return { ...base, passes: { p1_promotion_evidence: `${FILL}evidence`, p2_spec_ac_verification: `${FILL}evidence`, p3_runtime_validation: `${FILL}evidence`, p4_state_closeout: `${FILL}evidence` }, p3_target_type: "smoke-http", verdict: `${FILL}pass | fail` };
    case "plan-manifest": {
      // The canonical v5 shape (see schemas/receipts/plan-manifest.schema.json). Replace every FILL: value.
      const ref = { type: "object", sha256: `${FILL}64-hex object sha256` };
      return {
        receipt_type: "plan-manifest", schema_version: 5, wi, mode: "inline", timestamp,
        scope: { included: [`${FILL}path`], excluded: [] },
        dependencies: [], decision_trace: [],
        task_graph: [{ id: "T1", files: [`${FILL}path`], blocked_by: [], ac_ids: [`${FILL}AC id`], validation_ids: ["V1"], context_refs: [] }],
        validation_plan: [{ id: "V1", ac_ids: [`${FILL}AC id`], observation_kind: "unit", command: `${FILL}proof command`, expected_outcome: `${FILL}outcome`, sufficiency: `${FILL}why this proves it` }],
        risk_rollback: { risks: [`${FILL}risk`], rollback: `${FILL}rollback`, verification: `${FILL}verification` },
        execution_command_sequence: [{ step: 1, producer: { artifact: `${FILL}artifact`, field: "sha", command: `${FILL}command` }, verifier: { command: `${FILL}command`, expected_outcome: `${FILL}outcome` }, consumer_skill: "land-changeset", expected_outcome: `${FILL}outcome` }],
        ac_digests: { spec_path: `${FILL}spec path`, spec_ac_table_sha256: `${FILL}sha256 of the AC table`, entries: [{ ac_id: `${FILL}AC id`, digest: `${FILL}digest` }] },
        planning_contract: { kind: "lightweight", original_requirements_ref: ref, eligibility_ref: ref, eligibility_tree: { type: "digest", of: "tree", sha256: `${FILL}tree digest` } },
        implementation_approach: [{ id: "A1", requirement_ids: [`${FILL}AC id`], source_ids: [], approach: `${FILL}approach`, interfaces: `${FILL}interfaces`, state_and_ownership: `${FILL}ownership`, failure_and_recovery: `${FILL}recovery`, task_ids: ["T1"], validation_ids: ["V1"] }],
        executor_discretion: { local_repairs: [], amendment_triggers: [`${FILL}trigger`], disagreement_protocol: `${FILL}protocol` },
      };
    }
    case "review-plan":
      return { ...base, schema_version: 3, candidate_digest: `${FILL}from the review route`, reviewed_plan_digest: `${FILL}sha256 of the prepared plan JSON`, self_review: { orchestrator: `${FILL}host`, findings_count: 0, notes: `${FILL}notes` }, adversarial_review: `${FILL}copy from the review route`, verdict: `${FILL}pass | fail | pass-with-acks`, reviewer_evidence: `${FILL}copy from the review route` };
    case "review-exec":
      return { ...base, schema_version: 3, candidate_digest: `${FILL}from the review route`, diff_hash: `${FILL}hash`, self_review: { orchestrator: `${FILL}host`, findings_count: 0, notes: `${FILL}notes` }, adversarial_review: `${FILL}copy from the review route`, verdict: `${FILL}pass | fail | pass-with-acks`, reviewer_evidence: `${FILL}copy from the review route` };
    default:
      throw new CliError(4, `no template for receipt type: ${type}`);
  }
}

// ------------------------------------------------------- canonical acceptance

/** Seam for in-process tests only; the CLI cannot reach it. A validator returns an array to decide, or null to leave the receipt to the real checks. */
export const __testing = { emitterValidator: null };

const VERDICTS = {
  "review-plan": new Set(["pass", "pass-with-acks"]),
  "review-exec": new Set(["pass", "pass-with-acks"]),
  "audit-implementation": new Set(["pass", "pass-with-acks"]),
  "verify-promotion": new Set(["pass"]),
};
const REVIEW_KIND = { "review-plan": "plan", "review-exec": "exec" };

function schemaRequired(type) {
  try { return JSON.parse(readFileSync(join(FRAMEWORK_ROOT, "schemas", "receipts", `${type}.schema.json`), "utf8")).required || []; }
  catch { return null; }
}

/** The reviewer host of a review receipt: the fallback when it was used, else the primary. */
function reviewerHostOf(body) {
  const ar = body?.adversarial_review || {};
  return ar.fallback_used ? ar.fallback_host : ar.primary_reviewer_host;
}

/**
 * Immutable structure and sealed evidence of a v5 plan, independent of the live tree: the current v5
 * schema (null or missing evidence fields fail), the recorded seal envelope, the stored prepared bytes,
 * and the sealed plan review with its authenticated cross-family reviewer evidence. Live-tree issuance
 * (staged-tree eligibility) is deliberately left to completion time.
 */
export function planSealReasons(root, body) {
  const reasons = [];
  const schema = validatePlanSchema(body);
  if (!schema.ok) return schema.errors.slice(0, 6).map((e) => `plan schema: ${e}`);
  try {
    const authority = loadPlanAuthority({ consumerRoot: root, body });
    const envelope = JSON.parse(getByRef(authority.sealRef, { start: root }).bytes.toString("utf8"));
    if (envelope.wi !== body.wi) reasons.push("seal WI does not match the plan");
    if (envelope.semantic?.sha256 !== semanticContractDigest(body)) reasons.push("seal semantic digest does not match the plan body");
    const artifact = getByRef(envelope.artifact.ref, { start: root }).bytes;
    if (sha256(artifact) !== envelope.artifact.digest?.sha256) reasons.push("stored plan artifact does not match the seal");
    if (JSON.stringify(JSON.parse(artifact.toString("utf8"))) !== JSON.stringify(body)) reasons.push("stored plan artifact differs from the receipt body");
    const reviewBytes = getByRef(envelope.review_ref, { start: root }).bytes;
    const review = JSON.parse(reviewBytes.toString("utf8"));
    if (review.receipt_type !== "review-plan" || review.wi !== body.wi) reasons.push("sealed review is not this work item's review-plan");
    if (!["pass", "pass-with-acks", "pass-with-findings"].includes(review.verdict)) reasons.push("sealed plan review is not passing");
    if (review.reviewed_plan_digest !== sha256(artifact)) reasons.push("sealed plan review covers different plan bytes");
    if (!Number.isInteger(review.schema_version) || review.schema_version < 3) reasons.push("sealed plan review is a legacy schema");
    const af = familyOf(review.self_review?.orchestrator);
    const rf = familyOf(reviewerHostOf(review));
    if (af === "unknown" || rf === "unknown" || af === rf) reasons.push("sealed plan review is not a genuine cross-family review");
    reasons.push(...verifyReviewerEvidence({ root, reviewKind: "plan", body: review }));
  } catch (error) {
    reasons.push(`sealed plan evidence cannot be verified: ${error.message}`);
  }
  return reasons;
}

/**
 * Would this receipt body be accepted? Same rules the canonical emitter and chain checker apply:
 *  - an explicit allowed passing verdict wherever the type carries one (null, non-strings and
 *    anything else never pass);
 *  - current schemas: review receipts need an integer schema_version >= 3, plan-manifest 5;
 *  - review receipts need authenticated reviewer evidence (verifyReviewerEvidence) and a genuine
 *    cross-family pair: author and reviewer families both known and different;
 *  - emit-receipt's own validateReceipt (required fields; plan issuance only at completion time,
 *    because it binds the live staged tree).
 */
export function acceptanceReasons(root, type, body, { issuance = true } = {}) {
  const reasons = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) return ["receipt is not a JSON object"];
  if (body.receipt_type !== type) reasons.push(`receipt_type ${JSON.stringify(body.receipt_type)} is not ${type}`);
  if (VERDICTS[type] && !(typeof body.verdict === "string" && VERDICTS[type].has(body.verdict))) {
    reasons.push(`verdict ${JSON.stringify(body.verdict)} is not an allowed passing verdict (${[...VERDICTS[type]].join(" | ")}); a failed or unstated ${type} never completes a stage`);
  }
  const text = JSON.stringify(body);
  if (/same_host|host_subagent_declared/.test(text) || body?.adversarial_review?.different_family === false || body?.review_route?.different_family === false) {
    reasons.push(`${type} carries a same-host/self review; only a genuine cross-family review completes a stage`);
  }
  if (__testing.emitterValidator) {
    const verdictOnly = __testing.emitterValidator(root, type, body); // null = no opinion: validate for real
    if (Array.isArray(verdictOnly)) return [...reasons, ...verdictOnly];
  }
  if (type === "plan-manifest") {
    if (body.schema_version !== 5) reasons.push(`plan-manifest schema_version ${JSON.stringify(body.schema_version)} is not the current 5`);
    else reasons.push(...planSealReasons(root, body));
  }
  if (REVIEW_KIND[type]) {
    if (!Number.isInteger(body.schema_version) || body.schema_version < 3) {
      reasons.push(`${type} schema_version ${JSON.stringify(body.schema_version)} is below the current 3; legacy v1/v2 review receipts never complete a stage`);
    }
    const authorFamily = familyOf(body.self_review?.orchestrator);
    const reviewerFamily = familyOf(reviewerHostOf(body));
    if (authorFamily === "unknown" || reviewerFamily === "unknown" || authorFamily === reviewerFamily) {
      reasons.push(`${type} is not a genuine cross-family review (author host ${JSON.stringify(body.self_review?.orchestrator)} -> ${authorFamily}, reviewer host ${JSON.stringify(reviewerHostOf(body))} -> ${reviewerFamily})`);
    }
    try { reasons.push(...verifyReviewerEvidence({ root, reviewKind: REVIEW_KIND[type], body })); }
    catch (error) { reasons.push(`reviewer evidence verification threw: ${error.message}`); }
    if (issuance) {
      // The review must cover the candidate that is about to advance, not an earlier one.
      try {
        const current = candidateTreeIdentity(root);
        if (body.candidate_digest !== current.candidate_digest) reasons.push(`${type} binds candidate ${String(body.candidate_digest).slice(0, 12)} but the current candidate tree is ${current.candidate_digest.slice(0, 12)}; changed code needs a fresh review`);
      } catch (error) { reasons.push(`cannot compute the current candidate: ${error.message}`); }
    }
  }
  const required = schemaRequired(type);
  if (required === null) reasons.push(`schema for ${type} is unavailable`);
  else for (const key of required) if (!(key in body)) reasons.push(`missing required: ${key}`);
  if (type !== "plan-manifest" || issuance) {
    const previous = process.cwd();
    try {
      process.chdir(root);
      const result = validateReceipt(type, body, null, {});
      if (!result.valid) reasons.push(...result.reasons);
    } catch (error) {
      reasons.push(`emitter validation threw: ${error.message}`);
    } finally {
      process.chdir(previous);
    }
  }
  return [...new Set(reasons)];
}

/** Completion-time check (includes plan issuance). */
export function emitterRejects(root, type, body) {
  return acceptanceReasons(root, type, body, { issuance: true });
}

// ------------------------------------------------------------------- --done

function validateDone(root, graph, pick, args) {
  const fail = (m) => { throw new CliError(4, m); };
  if (!pick) fail(`--done ${args.done}: nothing is runnable`);
  const skill = taskSkill(pick.task);
  if (args.done !== skill) fail(`OUT_OF_ORDER: --done ${args.done} but the current stage is ${skill} (task ${pick.task.id}); run only the printed SKILL`);
  if (!args.receipt) fail(`--done ${args.done} needs --receipt ${EMIT_TYPE[skill] ? `${EMIT_TYPE[skill]}:<sha256>` : LOAD_SKILL}`);
  const wantType = EMIT_TYPE[skill] || null;
  const unmet = processSteps(root, pick.task);
  if (unmet.length) fail(`task ${pick.task.id} requires a digest-bound process receipt before completion: ${unmet.join(", ")} (node "$SVC_ROOT/scripts/task-graph.mjs" record-process <graph> ${pick.task.id} <skill> --evidence <type>:<path> [--mode <mode>])`);
  if (!wantType) {
    if (args.receipt !== LOAD_SKILL) fail(`${skill} completes with --receipt ${LOAD_SKILL}, got ${args.receipt}`);
    return { chain: null };
  }
  const m = /^([a-z0-9-]+):([0-9a-f]{64})$/.exec(args.receipt);
  if (!m) fail(`--receipt must be ${wantType}:<64-hex sha256 of the emitted receipt file>, got ${args.receipt}`);
  if (m[1] !== wantType) fail(`${skill} emits receipt type ${wantType}, got ${m[1]}`);
  const hit = liveReceipt(root, graph.wi, wantType, m[2]);
  if (!hit) {
    const seen = receiptCandidates(root, wantType, graph.wi).map((c) => `${relative(root, c.file)} sha256=${c.sha256}`);
    fail(`no ${wantType} receipt for ${graph.wi} with sha256 ${m[2]} under .svc/receipts/staging/*/ or .svc/receipts/*/${seen.length ? `; found: ${seen.join("; ")}` : "; none emitted yet (run the EMIT command first)"}`);
  }
  if (hit.bytes.toString("utf8").includes(`"${FILL}`)) fail(`${relative(root, hit.file)} still contains unfilled "${FILL}" placeholders`);
  const body = JSON.parse(hit.bytes.toString("utf8"));
  const reasons = emitterRejects(root, wantType, body);
  if (reasons.length) fail(`${relative(root, hit.file)} is not a receipt emit-receipt.mjs would accept: ${reasons.join("; ")}`);
  return { chain: { type: wantType, sha256: m[2], path: relative(root, hit.file) } };
}

function applyDone(root, file, pick, chain) {
  const id = pick.task.id;
  updateJsonAtomic(file, (current) => {
    // Re-decide under the lock: the stage must still be the single current stage with satisfied blockers.
    const again = findCardTask(root, current);
    if (!again || again.task.id !== id) throw new CliError(4, `OUT_OF_ORDER: task ${id} is no longer the current stage (the graph changed); read the card again`);
    const task = (current.tasks || []).find((t) => t.id === id);
    const now = new Date().toISOString();
    task.status = "completed";
    task.completed_at = task.completed_at && pick.kind === "repair" ? task.completed_at : now;
    delete task.skip_reason;
    const skill = taskSkill(task);
    if (!task.skill_receipt || task.skill_receipt.skill !== skill) {
      task.skill_receipt = { skill, loaded_at: now, loaded_via: "svc-next" };
    }
    task.chain_receipt = chain.chain ? { ...chain.chain } : { type: LOAD_SKILL };
    // graph status follows the tasks (same derivation task-graph.mjs applies)
    const tasks = current.tasks;
    let status;
    if (tasks.every((t) => t.status === "completed")) status = "completed";
    else if (tasks.some((t) => t.status === "in_progress")) status = "in_progress";
    else if (tasks.some((t) => t.status === "pending")) status = "pending";
    else if (tasks.some((t) => t.status === "blocked")) status = "blocked";
    else if (tasks.every((t) => t.status === "skipped")) status = "skipped";
    else status = "completed";
    const terminal = (s) => ["completed", "skipped"].includes(s);
    if (terminal(status) && !terminal(current.status)) current.completed_at = now;
    else if (!terminal(status)) delete current.completed_at;
    current.status = status;
    return current;
  });
}

// ------------------------------------------------------- review body builder

const sha256File = (file) => sha256(readFileSync(file));

/** The frozen digest a launcher run must be bound to. plan: the prepared plan JSON; exec: the candidate tree. */
export function candidateDigestFor(root, kind, planBody = PLAN_BODY) {
  if (kind === "plan") {
    const file = resolve(root, planBody);
    if (!existsSync(file)) throw new CliError(4, `prepared plan ${planBody} not found; run prepare-plan-handoff.mjs --write first`);
    return sha256File(file);
  }
  if (kind === "exec") return candidateTreeIdentity(root).candidate_digest;
  throw new CliError(4, `candidate digest kind must be plan or exec, got ${kind}`);
}

/**
 * The real orchestrator host of this session: an explicit value, SVC_HOST, the Codex session
 * markers, then scripts/detect-host.sh. There is no default: an unknown host is refused, because
 * guessing one could label a same-family reviewer as cross-family.
 */
export function resolveOrchestrator(explicit = null) {
  let host = explicit || process.env.SVC_HOST || "";
  if (!host && (process.env.CODEX_THREAD_ID || process.env.CODEX_HOME || process.env.CODEX_CLI)) host = "codex";
  if (!host) {
    try { host = execFileSync("bash", [join(FRAMEWORK_ROOT, "scripts", "detect-host.sh")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { host = ""; }
  }
  if (!host || host === "unknown" || familyOf(host) === "unknown") {
    throw new CliError(4, `cannot identify the orchestrator host${host ? ` (${JSON.stringify(host)} is not a known family)` : ""}; set SVC_HOST (claude, codex, gemini, grok, ...) or pass --orchestrator`);
  }
  return host;
}

/** Hash-bound launcher evidence for the review body, including the authenticated source of a cache replay. */
export function launcherEvidence(root, receiptFile, launcher) {
  const rel = (f) => relative(resolve(root), f);
  const entry = { path: rel(receiptFile), sha256: sha256File(receiptFile) };
  const evidence = { independent: true, submitter_only: false, launcher_receipts: [entry], deletion_bearing: false, parse_collect_evidence: [] };
  let run = launcher;
  if (launcher.classification === "cache_hit") {
    const sourceFile = resolve(launcher.cache?.entry || "", "receipt.json");
    if (!launcher.cache?.entry || !existsSync(sourceFile)) throw new CliError(4, "cache-hit launcher receipt has no readable source receipt; re-run the review without the cache");
    const source = JSON.parse(readFileSync(sourceFile, "utf8"));
    evidence.cache_sources = [{ replay_sha256: entry.sha256, source: { path: rel(sourceFile), sha256: sha256File(sourceFile) } }];
    run = source;
  }
  const outputs = run.reviewer_run?.output_artifacts || [];
  evidence.commands = run.reviewer_run?.commands || [];
  evidence.output_artifacts = outputs.map((f) => ({ path: rel(resolve(root, f)), sha256: sha256File(resolve(root, f)) }));
  return evidence;
}

/**
 * Build the canonical review-plan / review-exec receipt body from a REAL launcher run (the summary
 * run-external-review.mjs printed: ok, findings path, receipt path), prove it with the same verifier the
 * chain uses, and optionally persist it in the review evidence store (the object --seal-after-review needs).
 * Nothing here can fabricate a review: the launcher receipt must verify, the verdict must be the
 * reviewer's, and author and reviewer families must both be known and different.
 */
export function buildReviewBody(root, { kind, wi, summaryPath, planBody = PLAN_BODY, orchestrator, store = false }) {
  if (!["plan", "exec"].includes(kind)) throw new CliError(4, "--build-review needs plan or exec");
  if (!summaryPath) throw new CliError(4, "--build-review needs --summary <launcher summary json>");
  const summary = JSON.parse(readFileSync(resolve(root, summaryPath), "utf8"));
  if (summary.ok !== true || !summary.findings || !summary.receipt) throw new CliError(4, "launcher summary must carry ok:true, findings and receipt");
  const findingsFile = resolve(root, summary.findings);
  const receiptFile = resolve(root, summary.receipt);
  const findings = JSON.parse(readFileSync(findingsFile, "utf8"));
  const launcher = JSON.parse(readFileSync(receiptFile, "utf8"));
  const host = resolveOrchestrator(orchestrator);
  const launcherHost = launcher.effective_tuple?.orchestrator;
  if (launcherHost && launcherHost !== host) throw new CliError(4, `the launcher ran for orchestrator ${JSON.stringify(launcherHost)} but this session is ${JSON.stringify(host)}; rebuild with the matching host`);
  const identity = candidateTreeIdentity(root);
  const requested = launcher.requested_tuple?.host;
  const effective = launcher.effective_tuple?.host || requested;
  const fv = String(findings.verdict || "");
  const severe = (findings.findings || []).some((f) => f.blocking === true || ["critical", "high"].includes(f.severity));
  const verdict = fv === "pass" && !severe ? "pass" : fv === "pass-with-findings" && !severe ? "pass-with-acks" : "fail";
  const rel = (f) => relative(resolve(root), f);
  const type = kind === "plan" ? "review-plan" : "review-exec";
  const body = {
    receipt_type: type, schema_version: 3, wi,
    candidate_digest: identity.candidate_digest, tree_hash: identity.tree_hash,
    self_review: { orchestrator: host, findings_count: (findings.findings || []).length, notes: `launcher run ${launcher.request_id || ""}`.trim() },
    adversarial_review: {
      primary_reviewer_host: requested, primary_used: !launcher.fallback?.used,
      fallback_host: effective, fallback_used: Boolean(launcher.fallback?.used),
      findings: findings.findings || [], iteration_count: Array.isArray(launcher.attempts) ? Math.max(1, launcher.attempts.length) : 1,
    },
    verdict,
    timestamp: new Date().toISOString(),
    reviewer_evidence: launcherEvidence(root, receiptFile, launcher),
  };
  const head = gitOut(["rev-parse", "--verify", "HEAD"], root).trim();
  if (head) body.candidate_sha = head;
  if (kind === "plan") body.reviewed_plan_digest = sha256File(resolve(root, planBody));
  else {
    const execDir = receiptCandidates(root, "exec-record", wi).sort((a, b) => statSync(b.file).mtimeMs - statSync(a.file).mtimeMs)[0];
    body.diff_hash = execDir ? JSON.parse(execDir.bytes.toString("utf8")).diff_hash : sha256(gitOut(["diff", "--cached", "--binary"], root));
  }
  const reasons = acceptanceReasons(root, type, body, { issuance: true });
  if (reasons.length) throw new CliError(4, `the ${type} body built from ${summaryPath} would not be accepted: ${reasons.join("; ")}`);
  const result = { body };
  if (store) result.ref = putObject(Buffer.from(JSON.stringify(body)), { start: root }).sha256;
  return result;
}

// ------------------------------------------------------------------------ main

function print(lines) { process.stdout.write(`${lines.join("\n")}\n`); }

const EMPTY_CARD = (closeout = "-") => [
  "STATUS not_done", "SKILL -", "TASK -", "INPUTS -", "EMIT -", "PROCESS -", `CLOSEOUT ${closeout}`, "MISSING -",
];

export function run(argv) {
  acceptedCache.clear();
  let args;
  try { args = parseArgs(argv); } catch (e) {
    print(EMPTY_CARD()); process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4;
  }
  if (args.template) {
    try {
      const wi = args.wi || "WI-UNKNOWN";
      process.stdout.write(`${JSON.stringify(receiptTemplate(args.template, wi, resolve(args.root)), null, 2)}\n`);
      return 0;
    } catch (e) { process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4; }
  }
  const root = resolve(args.root);
  if (args.orchestratorId) {
    try { process.stdout.write(`${resolveOrchestrator(args.orchestrator)}\n`); return 0; }
    catch (e) { process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4; }
  }
  if (args.candidateDigest) {
    try { process.stdout.write(`${candidateDigestFor(root, args.candidateDigest, args.planBody || PLAN_BODY)}\n`); return 0; }
    catch (e) { process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4; }
  }
  if (args.buildReview) {
    try {
      const sel0 = selectGraph(root, args.wi);
      const built = buildReviewBody(root, { kind: args.buildReview, wi: sel0.graph.wi, summaryPath: args.summary, planBody: args.planBody || PLAN_BODY, orchestrator: args.orchestrator, store: args.store });
      const text = `${JSON.stringify(built.body, null, 2)}\n`;
      if (args.out) { mkdirSync(dirname(resolve(root, args.out)), { recursive: true }); writeFileSync(resolve(root, args.out), text); }
      else process.stdout.write(text);
      if (built.ref) process.stdout.write(`review_ref ${built.ref}\n`);
      return 0;
    } catch (e) { process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4; }
  }
  if (args.recipe) {
    try {
      const sel0 = selectGraph(root, args.wi);
      process.stdout.write(`${recipeFor(args.recipe, { rootArg: args.root, wi: sel0.graph.wi }).join("\n")}\n`);
      return 0;
    } catch (e) { process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4; }
  }
  if (args.sha) {
    try {
      const sel0 = selectGraph(root, args.wi);
      const newest = receiptCandidates(root, args.sha, sel0.graph.wi)
        .map((c) => ({ ...c, mtime: statSync(c.file).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)[0];
      if (!newest) throw new CliError(4, `no ${args.sha} receipt for ${sel0.graph.wi} under .svc/receipts/`);
      process.stdout.write(`${args.sha}:${newest.sha256}\n`);
      return 0;
    } catch (e) { process.stderr.write(`svc-next: ${e.message}\n`); return e.code || 4; }
  }
  let sel;
  try { sel = selectGraph(root, args.wi); } catch (e) {
    print(EMPTY_CARD('node "$SVC_ROOT/scripts/compile-delivery-graph.mjs" --wi <WI> --lane <lane> --change-type <type> --intent "<goal>" --out .svc/lane-tasks-<WI>.json'));
    process.stderr.write(`svc-next: ${e.message}\n`);
    return e.code || 3;
  }
  if (args.receipt && !args.done) {
    print(buildCard(root, sel.graph, sel.file, args.root).lines);
    process.stderr.write("svc-next: --receipt needs --done <skill>\n");
    return 4;
  }
  if (args.done) {
    const pick = findCardTask(root, sel.graph);
    try {
      const chain = validateDone(root, sel.graph, pick, args);
      applyDone(root, sel.file, pick, chain);
    } catch (e) {
      if (!(e instanceof CliError)) throw e;
      print(buildCard(root, readJsonAtomic(sel.file), sel.file, args.root).lines);
      process.stderr.write(`svc-next: ${e.message}\n`);
      return e.code;
    }
    sel = { file: sel.file, graph: readJsonAtomic(sel.file) };
  }
  const card = buildCard(root, sel.graph, sel.file, args.root);
  print(card.lines);
  if (card.exit === 5) {
    process.stderr.write(`svc-next: not done; required receipt(s) or process evidence missing or stale: ${card.lines[7].slice("MISSING ".length)}\n`);
  }
  return card.exit;
}

const isMain = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) process.exitCode = run(process.argv.slice(2));
