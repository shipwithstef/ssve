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
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonAtomic, updateJsonAtomic } from "./state-io.mjs";
import { validateReceipt } from "./emit-receipt.mjs";

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
  const out = { root: ".", wi: null, done: null, receipt: null, template: null, sha: null, recipe: null };
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

/** Does this chain skill's receipt still match bytes on disk? Non-chain skills carry none. */
function chainLive(root, graph, task) {
  const type = EMIT_TYPE[taskSkill(task)];
  if (!type) return true;
  const cr = task.chain_receipt;
  return Boolean(cr && cr.type === type && liveReceipt(root, graph.wi, type, cr.sha256));
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

function findCardTask(root, graph) {
  const tasks = graph.tasks;
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
  const active = tasks.find((t) => t.status === "in_progress" && !downstreamOfStale(t) && blockersOk(t));
  if (active) return { task: active, kind: "active" };
  for (const t of tasks) {
    if (t.status !== "pending" || downstreamOfStale(t) || !blockersOk(t)) continue;
    return { task: t, kind: "runnable" };
  }
  if (stale.length) return { task: stale[0], kind: "repair" };
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
  const sha = `node ${SR}/svc-next.mjs --root . --wi ${wi} --sha ${type}`;
  const NO_SUBSTITUTE = "Adversarial review is cross-family by design: if the launcher cannot reach the reviewer, stop and report it; never substitute a same-host or self review.";
  if (type === "plan-manifest") {
    const manifest = `${PLAN_DIR(wi)}/manifest.md`;
    return [
      `# plan-manifest for ${wi} (run from the project root; .svc/ must be gitignored; two-box planning)`,
      `1. MODEL  write the original requirements and facts as the two-box input JSON, then: node ${SR}/two-box-plan.mjs --input <input.json> --mode live --out .svc/two-box-plan.out.json`,
      `   It runs the independent Open/Contract boxes, the two scouts and the assessor through the external reviewer CLI. ${NO_SUBSTITUTE}`,
      `2. MODEL  write ${manifest}: one <!-- SVC_PLAN_BODY --> fenced JSON object, schema_version 5, planning_contract.kind two_box with the refs from step 1 (shapes: references/manifest-templates.md; starting point: node ${SR}/svc-next.mjs --root . --template plan-manifest --wi ${wi}).`,
      `3. git add -A -- . ':!${PLAN_DIR(wi)}'      # stage the candidate; the manifest itself stays unstaged (the plan scope must equal the staged candidate)`,
      `4. node ${SR}/prepare-plan-handoff.mjs --manifest ${manifest} --write --out ${PLAN_BODY}`,
      `5. bash ${SR}/review-plan-codex.sh ${manifest} > .svc/review-plan.summary.json      # the cross-family plan review of the exact prepared bytes; note the review-plan receipt object sha256 as <review_ref>`,
      `   ${NO_SUBSTITUTE}`,
      `6. node ${SR}/prepare-plan-handoff.mjs --manifest ${manifest} --seal-after-review <review_ref>      # prints {"seal_ref":{...}}`,
      `7. node ${SR}/emit-receipt.mjs --type plan-manifest --wi ${wi} --body ${PLAN_BODY} --manifest ${manifest} --seal-ref '<seal_ref as printed>'`,
      `8. ${sha}      # prints plan-manifest:<sha256> for the CLOSEOUT line`,
    ];
  }
  if (type === "review-plan" || type === "review-exec") {
    const plan = type === "review-plan";
    return [
      `# ${type} for ${wi} (run from the project root)`,
      plan
        ? `1. bash ${SR}/review-plan-codex.sh ${PLAN_DIR(wi)}/manifest.md > .svc/review-plan.summary.json      # reuses the exact passing plan review when the plan stage already ran it`
        : `1. node ${SR}/run-external-review.mjs --orchestrator "\${SVC_HOST:-claude}" --review-kind exec --input-file .svc/review-cross-model-package.md --artifacts-dir .svc/external-review-artifacts/cross-model > .svc/review-exec.summary.json      # package and digest rules: skills/review-cross-model/SKILL.md`,
      `   ${NO_SUBSTITUTE}`,
      `2. MODEL  build the receipt body exactly as skills/${type}/SKILL.md describes (self_review, adversarial_review, verdict, candidate_digest, reviewer_evidence copied from the launcher receipt) and save it as .svc/${type}.body.json. Never hand-write reviewer_evidence.`,
      `3. node ${SR}/emit-receipt.mjs --type ${type} --wi ${wi} --sha "$(git rev-parse HEAD)" --body .svc/${type}.body.json`,
      `4. ${sha}      # prints ${type}:<sha256> for the CLOSEOUT line`,
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

/** Seam for in-process tests only; the CLI cannot reach it. */
export const __testing = { emitterValidator: null };

/**
 * Would emit-receipt.mjs accept this receipt body? Uses the emitter's own validateReceipt (schema,
 * required evidence, reviewer evidence, plan issuance) from the project root, and additionally
 * requires a passing verdict wherever the receipt carries one.
 */
export function emitterRejects(root, type, body) {
  const reasons = [];
  if (typeof body?.verdict === "string" && !PASSING.has(body.verdict.toLowerCase())) {
    reasons.push(`verdict ${JSON.stringify(body.verdict)} is not passing; a failed ${type} never completes a stage`);
  }
  const text = JSON.stringify(body || {});
  if (/same_host|host_subagent_declared/.test(text) || body?.adversarial_review?.different_family === false || body?.review_route?.different_family === false) {
    reasons.push(`${type} carries a same-host/self review; only a genuine cross-family review completes a stage`);
  }
  if (__testing.emitterValidator) return [...reasons, ...__testing.emitterValidator(root, type, body)];
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
  return reasons;
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

// ------------------------------------------------------------------------ main

function print(lines) { process.stdout.write(`${lines.join("\n")}\n`); }

const EMPTY_CARD = (closeout = "-") => [
  "STATUS not_done", "SKILL -", "TASK -", "INPUTS -", "EMIT -", "PROCESS -", `CLOSEOUT ${closeout}`, "MISSING -",
];

export function run(argv) {
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
