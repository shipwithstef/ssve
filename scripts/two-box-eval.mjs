#!/usr/bin/env node
/**
 * two-box-eval.mjs — run Two-Box planning on any harness and measure whether its plans
 * build better products than a single plan or no plan.
 *
 *   node scripts/two-box-eval.mjs plan --task <id> [--model sonnet] [--transport claude]
 *   node scripts/two-box-eval.mjs run --task <id> [--arms bare,open,contract,twobox] [--reps 3]
 *        [--planner sonnet] [--builder haiku] [--out <results.json>]
 *
 * This is the shipped protocol, not a paraphrase: role prompts (buildRolePrompt), output
 * schemas (outputSchemaForCall), output validation (validateRoleOutput), scout assignment
 * (assignDualPass, assignmentCoverage), the assessor's source checks (assertSourceIds) and
 * selection (normalizeSelection) all come from the Two-Box modules. What differs is the
 * transport: each role is one isolated, tool-free call through scripts/lib/
 * harness-transports.mjs, which proves isolation with a canary probe before the first
 * call. Results are evaluation evidence, not receipt authority: they carry no
 * control-plan v2 receipt and cannot seal a plan for execution.
 *
 * Arms for `run` (the builder and the task are the same in every arm):
 *   bare      the request only
 *   open      the request plus the Open box's plan (free planning, no framework method)
 *   contract  the request plus the Contract box's plan (specs and constraints, no scouts)
 *   twobox    the request plus the plan the assessor selected after scouts and revision
 * A task opts in with task.json `two_box: { scope: [files], contract_context: [files] }`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { transport } from "./lib/harness-transports.mjs";
import { buildRolePrompt } from "./lib/two-box-role-launch.mjs";
import { outputSchemaForCall, validateRoleOutput, normalizeSelection, buildSourceSnapshot, persistOriginalInputs, canonicalSourceHash, digestRef, sha256Utf8 } from "./lib/two-box-protocol.mjs";
import { assignDualPass, assignmentCoverage } from "./lib/two-box-scout-assign.mjs";
import { normalizeRequirements, readConstraints, sourceExposure, openParagraphs, putJson, assertSourceIds, scoutGapContext } from "./two-box-plan.mjs";
import { prepare, runAgent, grade, taskConfig, compareSamples } from "./outcome-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = path.join(ROOT, "test-framework", "outcome-evals", "tasks");
export const ARMS = ["bare", "open", "contract", "twobox"];

// A throwaway git checkout of the task repository: Two-Box snapshots sources at a commit.
function checkout(task) {
  const dir = prepare(task);
  const git = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
  git("init", "-q"); git("config", "user.email", "eval@example.invalid"); git("config", "user.name", "eval");
  git("add", "-A"); git("commit", "-qm", "base");
  return { dir, baseSha: git("rev-parse", "HEAD").stdout.trim() };
}

// The feature request as numbered requirements: one per AC line of the contract file, or
// the whole request as one requirement.
export function requirementsFor(task, contractFile) {
  const text = contractFile ? fs.readFileSync(path.join(TASKS, task, "repo", contractFile), "utf8") : fs.readFileSync(path.join(TASKS, task, "spec.md"), "utf8");
  const acs = [...text.matchAll(/^-\s*(AC\d+):\s*(.+)$/gm)].map((m) => ({ id: m[1], text: m[2].trim() }));
  return normalizeRequirements(acs.length ? acs : text);
}

// Turn the assessor's selection into the plan a builder receives.
export function chosenPlan({ winner, selected }, { open, contract, revised }) {
  if (winner === "open_win") return open.plan;
  if (winner === "contract_win") return revised.plan;
  const paragraphs = Object.fromEntries(openParagraphs(open.plan).map((p) => [p.id, p.text]));
  const decisions = Object.fromEntries([...(contract.decisions || []), ...(revised.decisions || [])].map((d) => [d.id, d.text]));
  return selected.map((s) => paragraphs[s.decision_id] || decisions[s.decision_id] || (s.source_ids || []).map((id) => paragraphs[id] || decisions[id]).filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
}

export async function planTwoBox({ task, model = "sonnet", effort = null, transportName = "claude", stopAfter = null }) {
  const cfg = JSON.parse(fs.readFileSync(path.join(TASKS, task, "task.json"), "utf8")).two_box;
  if (!cfg?.scope?.length) throw new Error(`${task}: task.json two_box.scope required`);
  const t = transport(transportName);
  const probe = await t.probeIsolation({ model: "haiku" });
  if (!probe.ok) throw new Error(`isolation probe failed for ${transportName}: ${probe.error || "canary leaked"}`);
  const { dir, baseSha } = checkout(task);
  try {
    const requirements = requirementsFor(task, cfg.contract_context?.[0]);
    const snapshot = buildSourceSnapshot({ consumerRoot: dir, start: dir, baseSha, scope: cfg.scope });
    const facts = { annotations: {}, source_exposure: sourceExposure(snapshot, dir), prompt_format: { version: 1, kind: "scout_context_projection" } };
    const persisted = persistOriginalInputs({ originalRequirements: requirements, facts }, { start: dir });
    const bindings = {
      wi: "WI-EVAL",
      original_requirements_ref: persisted.original_requirements_ref,
      frozen_facts_ref: persisted.frozen_facts_ref,
      source_snapshot_ref: putJson(snapshot, dir),
      policy_digest: digestRef(sha256Utf8(`eval:${transportName}:${model}`), "policy"),
      source_digest: digestRef(canonicalSourceHash(snapshot), "bytes"),
    };
    const constraints = readConstraints(dir, baseSha, cfg.contract_context || []);
    const outputs = {}, refs = {};
    let cost = 0, calls = 0;
    async function stage(role, payload, context = {}) {
      const prompt = buildRolePrompt({ role, payload });
      const schema = outputSchemaForCall(role);
      let last;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await t.ask({ prompt, schema, model, effort });
        calls++; cost += r.cost_usd || 0;
        if (r.error) { last = new Error(`${role}: ${r.error}`); continue; }
        try { outputs[role] = validateRoleOutput(role, r.output, context); refs[role] = putJson(outputs[role], dir); return outputs[role]; }
        catch (error) { last = error; }
      }
      throw last;
    }
    await stage("open_box", { bindings, requirements, facts });
    await stage("contract_box", { bindings, requirements, facts, constraints });
    if (stopAfter === "boxes") return { open: outputs.open_box, contract: outputs.contract_box, cost, calls, probe };
    const initial = outputs.contract_box;
    const assignments = assignDualPass({ sourceSnapshot: snapshot, initialContract: initial, consumerRoot: dir, constraints, changeArchetype: "feature" });
    const assignRefs = { scout_forward: putJson(assignments.scout_forward, dir), scout_reverse: putJson(assignments.scout_reverse, dir) };
    for (const role of ["scout_forward", "scout_reverse"]) {
      await stage(role, { bindings, initial_contract: { ref: refs.contract_box, output: initial }, assignment: { ref: assignRefs[role], value: assignments[role] } });
    }
    const coverages = Object.fromEntries(["scout_forward", "scout_reverse"].map((role) => [role, assignmentCoverage({ assignment: assignments[role], parsed: outputs[role], observed_reads: [] })]));
    const scoutReports = ["scout_forward", "scout_reverse"].map((role) => ({ role, ref: refs[role], output: outputs[role], assignment_ref: assignRefs[role], assignment: assignments[role], coverage_ref: putJson(coverages[role], dir), coverage: coverages[role] }));
    const gap = scoutGapContext(assignments, coverages, { scout_forward: outputs.scout_forward, scout_reverse: outputs.scout_reverse });
    await stage("contract_revise", { bindings, requirements, facts, constraints, initial_contract: { ref: refs.contract_box, output: initial }, scout_reports: scoutReports }, gap);
    const paragraphs = openParagraphs(outputs.open_box.plan);
    const assessor = await stage("assessor", {
      bindings, requirements, facts, ...(constraints.paths.length ? { constraints } : {}),
      original_open: { ref: refs.open_box, output: outputs.open_box, source_id_namespace: "open" },
      original_contract: { ref: refs.contract_box, output: initial, source_id_namespace: "contract-original" },
      revised_contract: { ref: refs.contract_revise, output: outputs.contract_revise, source_id_namespace: "contract-revised" },
      scout_reports: scoutReports, open_paragraphs: paragraphs,
    });
    assertSourceIds(assessor, { requirementIds: new Set(requirements.map((r) => r.id)), paragraphs, originalDecisions: initial.decisions, revisedDecisions: outputs.contract_revise.decisions });
    const selection = normalizeSelection(assessor);
    const plan = chosenPlan({ winner: assessor.winner, selected: assessor.selected_decisions }, { open: outputs.open_box, contract: initial, revised: outputs.contract_revise });
    return { winner: assessor.winner, plan, open: outputs.open_box, contract: initial, revised: outputs.contract_revise, scouts: { forward: outputs.scout_forward, reverse: outputs.scout_reverse }, assessor, selection, cost, calls, probe, evidence_class: "EVAL" };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const builderPrompt = (task, plan) => [
  fs.readFileSync(path.join(TASKS, task, "spec.md"), "utf8").trim(),
  ...(plan ? ["", "Follow this plan, written for this repository before any code was changed:", "<plan>", plan, "</plan>"] : []),
].join("\n");

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export async function runArms({ task, arms = ARMS, reps = 3, planner = "sonnet", builder = "haiku", transportName = "claude", parallel = 3 }) {
  const cfg = taskConfig(task);
  const jobs = [];
  for (let rep = 0; rep < reps; rep++) for (const arm of arms) jobs.push({ arm, rep });
  return pool(jobs, parallel, async ({ arm, rep }) => {
    const row = { task, arm, rep, planner: arm === "bare" ? null : planner, builder, transport: transportName };
    const t0 = Date.now();
    let plan = null, planCost = 0;
    try {
      if (arm === "open" || arm === "contract") {
        const p = await planTwoBox({ task, model: planner, transportName, stopAfter: "boxes" });
        plan = arm === "open" ? p.open.plan : p.contract.plan; planCost = p.cost;
      } else if (arm === "twobox") {
        const p = await planTwoBox({ task, model: planner, transportName });
        plan = p.plan; planCost = p.cost; row.winner = p.winner; row.calls = p.calls;
      }
    } catch (error) {
      return { ...row, error: `planning: ${error.message}`.slice(0, 400), plan_cost_usd: planCost };
    }
    const dir = prepare(task);
    try {
      const agent = await runAgent(dir, builderPrompt(task, plan), builder, cfg.timeout_ms, undefined, cfg.max_turns);
      if (agent.error) return { ...row, error: `build: ${agent.error}`, plan_cost_usd: planCost };
      const g = grade(dir, task);
      process.stderr.write(`${task}/${arm}#${rep}: ${g.hidden_pass}/${g.hidden_total}${g.solved ? " solved" : ""}${row.winner ? ` (${row.winner})` : ""} plan $${planCost.toFixed(3)} build $${agent.cost_usd}\n`);
      return { ...row, ...g, plan_chars: plan ? plan.length : 0, plan: plan ? plan.slice(0, 6000) : null, plan_cost_usd: planCost, build_cost_usd: agent.cost_usd, cost_usd: planCost + (agent.cost_usd || 0), turns: agent.turns, wall_ms: Date.now() - t0 };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

export function summarizeArms(rows) {
  const out = {};
  for (const arm of [...new Set(rows.map((r) => r.arm))]) {
    const xs = rows.filter((r) => r.arm === arm && !r.error);
    const mean = (k) => (xs.length ? +(xs.reduce((a, r) => a + (r[k] || 0), 0) / xs.length).toFixed(4) : null);
    out[arm] = { runs: rows.filter((r) => r.arm === arm).length, errors: rows.filter((r) => r.arm === arm && r.error).length, solved: `${xs.filter((r) => r.solved).length}/${xs.length}`, mean_score: mean("score"), mean_cost_usd: mean("cost_usd"), mean_plan_cost_usd: mean("plan_cost_usd") };
    const winners = xs.map((r) => r.winner).filter(Boolean);
    if (winners.length) out[arm].winners = Object.fromEntries([...new Set(winners)].map((w) => [w, winners.filter((x) => x === w).length]));
  }
  const score = (arm) => rows.filter((r) => r.arm === arm && !r.error).map((r) => r.score);
  for (const arm of Object.keys(out)) if (arm !== "bare" && score(arm).length && score("bare").length) out[arm].score_vs_bare = compareSamples(score(arm), score("bare"));
  return out;
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const task = opt("--task");
  if (!task) { process.stderr.write("usage: two-box-eval.mjs plan|run --task <id> ...\n"); return 2; }
  if (argv[0] === "plan") {
    const p = await planTwoBox({ task, model: opt("--model", "sonnet"), transportName: opt("--transport", "claude") });
    process.stdout.write(JSON.stringify({ winner: p.winner, cost_usd: p.cost, calls: p.calls, probe: p.probe, plan: p.plan, assessor: p.assessor }, null, 2) + "\n");
    return 0;
  }
  if (argv[0] === "run") {
    const rows = await runArms({ task, arms: opt("--arms", ARMS.join(",")).split(","), reps: Number(opt("--reps", 3)), planner: opt("--planner", "sonnet"), builder: opt("--builder", "haiku"), transportName: opt("--transport", "claude"), parallel: Number(opt("--parallel", 3)) });
    const result = { ran_at: new Date().toISOString(), task, summary: summarizeArms(rows), rows };
    if (opt("--out")) fs.writeFileSync(opt("--out"), JSON.stringify(result, null, 2) + "\n");
    process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
    return 0;
  }
  return 2;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
