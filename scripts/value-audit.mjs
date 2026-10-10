#!/usr/bin/env node
/**
 * value-audit.mjs — does a piece of framework content still change what the model does?
 *
 *   node scripts/value-audit.mjs run [--models haiku,sonnet] [--reps 5] [--judge opus]
 *                                    [--units id,id] [--out <results.json>]
 *   node scripts/value-audit.mjs decide <results.json>
 *
 * For each unit in references/value-units.json and each model, the scenario runs
 *   default  without the unit (what the model does on its own today)
 *   with     with the unit's text appended to the system prompt
 * in an isolated, tool-free session (empty directory, no settings, no MCP). A judge
 * model that is not the model under test grades each answer, blind to the arm, against
 * the unit's checkable claim. This is the evaluate-rule method (ask for the default
 * before showing the rule) made repeatable.
 *
 * `decide` turns the rates into a state per model:
 *   caught-up  the model already does it without the unit (default >= 0.8, and the unit
 *              adds no established gain): candidate to slim, make lazy or retire for that model
 *   keep       the unit raises the rate (established: CI above zero and p < 0.05)
 *   weak       neither: the unit does not reliably produce the behaviour; rewrite or test harder
 * A state is evidence for a decision, not the decision: safety units that guard rare,
 * irreversible events are tested with planted incidents before any retirement.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { compareSamples } from "./outcome-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNITS = path.join(ROOT, "references", "value-units.json");
const JUDGE_SCHEMA = JSON.stringify({ type: "object", properties: { pass: { type: "boolean" }, reason: { type: "string" } }, required: ["pass", "reason"] });

export function loadUnits(only) {
  const { units } = JSON.parse(fs.readFileSync(UNITS, "utf8"));
  return only ? units.filter((u) => only.includes(u.id)) : units;
}

const stripFrontmatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n/, "").trim();

// One isolated call: no tools, no settings, no MCP, no session file, an empty directory.
function ask({ model, prompt, system, schema, timeoutMs = 180000 }) {
  return new Promise((resolve) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "va-"));
    const args = ["-p", "--model", model, "--tools", "", "--setting-sources", "", "--strict-mcp-config", "--no-session-persistence", "--output-format", "json"];
    if (system) args.push("--append-system-prompt", system);
    if (schema) args.push("--json-schema", schema);
    const child = spawn("claude", args, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.end(prompt);
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      fs.rmSync(dir, { recursive: true, force: true });
      let j = null; try { j = JSON.parse(out); } catch {}
      resolve(j ? { text: typeof j.result === "string" ? j.result : "", structured: j.structured_output ?? null, cost_usd: j.total_cost_usd ?? 0, error: j.is_error ? j.subtype : null } : { error: "no JSON result" });
    });
  });
}

export function judgePrompt(unit, answer) {
  return [
    "You are grading one answer against one claim. You do not know how the answer was produced.",
    `Scenario the answerer was given:\n<scenario>\n${unit.scenario}\n</scenario>`,
    `Answer:\n<answer>\n${answer}\n</answer>`,
    `Claim to check:\n<claim>\n${unit.claim}\n</claim>`,
    "Set pass to true only if the answer clearly satisfies the claim; give a one-sentence reason.",
  ].join("\n\n");
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export async function run({ models, reps, judgeModel, only, parallel = 6 }) {
  const units = loadUnits(only);
  const jobs = [];
  for (const unit of units) for (const model of models) for (const arm of ["default", "with"]) for (let rep = 0; rep < reps; rep++) jobs.push({ unit, model, arm, rep });
  return pool(jobs, parallel, async ({ unit, model, arm, rep }) => {
    const system = arm === "with" ? `Follow this project rule:\n\n${stripFrontmatter(fs.readFileSync(path.join(ROOT, unit.source), "utf8"))}` : null;
    const a = await ask({ model, prompt: unit.scenario, system });
    const row = { unit: unit.id, model, arm, rep, cost_usd: a.cost_usd || 0 };
    if (a.error || !a.text) return { ...row, error: a.error || "empty answer" };
    // The judge is never the model under test.
    const jm = judgeModel === model ? "sonnet" : judgeModel;
    const j = await ask({ model: jm, prompt: judgePrompt(unit, a.text), schema: JUDGE_SCHEMA });
    const verdict = j.structured;
    process.stderr.write(`${unit.id} ${model} ${arm}#${rep}: ${verdict ? (verdict.pass ? "pass" : "fail") : "judge error"}\n`);
    return { ...row, answer: a.text.slice(0, 1500), judge_model: jm, pass: verdict ? verdict.pass : null, reason: verdict?.reason || j.error || "no verdict", judge_cost_usd: j.cost_usd || 0 };
  });
}

export function decide(rows) {
  const out = {};
  const graded = rows.filter((r) => typeof r.pass === "boolean");
  for (const unit of [...new Set(graded.map((r) => r.unit))]) for (const model of [...new Set(graded.map((r) => r.model))]) {
    const of = (arm) => graded.filter((r) => r.unit === unit && r.model === model && r.arm === arm).map((r) => (r.pass ? 1 : 0));
    const d = of("default"), w = of("with");
    if (!d.length || !w.length) continue;
    const rate = (xs) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
    const stats = compareSamples(w, d);
    const gain = stats.ci95[0] > 0 && stats.p < 0.05;
    const state = gain ? "keep" : rate(d) >= 0.8 ? "caught-up" : "weak";
    (out[unit] ??= {})[model] = { state, default_rate: rate(d), with_rate: rate(w), n: [d.length, w.length], stats };
  }
  return out;
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (argv[0] === "decide") {
    const data = JSON.parse(fs.readFileSync(argv[1], "utf8"));
    process.stdout.write(JSON.stringify(decide(data.rows), null, 2) + "\n");
    return 0;
  }
  if (argv[0] !== "run") { process.stderr.write("usage: value-audit.mjs run [--models haiku,sonnet] [--reps 5] [--judge opus] [--units a,b] [--out f] | decide <results.json>\n"); return 2; }
  const models = opt("--models", "haiku").split(","), reps = Number(opt("--reps", 5)), judgeModel = opt("--judge", "opus");
  const only = opt("--units") ? opt("--units").split(",") : null;
  const rows = await run({ models, reps, judgeModel, only, parallel: Number(opt("--parallel", 6)) });
  const result = { ran_at: new Date().toISOString(), models, reps, judge: judgeModel, decisions: decide(rows), rows };
  const out = opt("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result.decisions, null, 2) + "\n");
  return 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
