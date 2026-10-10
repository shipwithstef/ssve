#!/usr/bin/env node
/**
 * outcome-eval.mjs — measure whether the framework's method changes outcomes, per model.
 *
 *   node scripts/outcome-eval.mjs run [--model haiku] [--reps 3] [--arms plain,blueprint]
 *                                     [--tasks a,b] [--parallel 4] [--out <results.json>]
 *   node scripts/outcome-eval.mjs check            # graders pass their reference, fail planted bugs
 *
 * Each task in test-framework/outcome-evals/tasks/<id>/ has spec.md, visible.test.mjs, a
 * hidden.test.mjs grader the agent never sees, and ref.mjs (a reference solution used
 * only by `check`). Every arm gets the same files and tools in a fresh temporary
 * directory; only the instruction differs:
 *   plain      implement the spec.
 *   lean       plain plus the verifier loop: run every test, fix until green.
 *   blueprint  the svc method: rules → one test per rule → implement → run the tests,
 *              fix until green (a generator with an external verifier in the loop).
 * The score is the share of hidden tests passed and whether all passed. Cost, turns and
 * time come from the headless CLI's JSON result. Runs that error are reported as
 * errors, never as zero scores.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = path.join(ROOT, "test-framework", "outcome-evals", "tasks");

export const ARMS = {
  plain: "Implement the specification in spec.md in this directory. visible.test.mjs has some example tests; `node --test` runs every test file here.",
  // The verifier loop alone: the part of the method the literature credits with the gain
  // (generate, then check against tests, then repair), without the written ceremony.
  lean: "Implement the specification in spec.md in this directory. Keep every existing behaviour the spec does not change. Before you finish, run `node --test` (it runs every test file here) and fix whatever fails; finish only when it passes.",
  blueprint: [
    "Implement the specification in spec.md in this directory, following this plan exactly. Do every step; each one has a check.",
    "1. Read spec.md. Write RULES.md: a numbered list with one line per rule in the spec, including every input that must be rejected and every edge case it names. Check: every sentence of the spec maps to at least one rule.",
    "2. Write rules.test.mjs with node:test and node:assert/strict: at least one test per rule, importing the code the spec names, using exact expected values computed from the spec by hand. Include visible.test.mjs's cases. Check: each rule number appears in a test name.",
    "3. Write or change the code the spec asks for. Keep every existing behaviour the spec does not change.",
    "4. Run `node --test` (it runs every test file here, including any existing ones). If anything fails, decide from spec.md whether the code or the test is wrong, fix that one, and run again. Repeat until everything passes.",
    "5. Done when all tests pass and every rule in RULES.md has a passing test. Do not stop earlier.",
  ].join("\n"),
};

export function listTasks() {
  return fs.readdirSync(TASKS).filter((d) => fs.existsSync(path.join(TASKS, d, "hidden.test.mjs"))).sort();
}

// node --test summary → passed/failed counts of top-level tests.
export function parseTap(out) {
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? NaN);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? NaN);
  return Number.isNaN(pass) || Number.isNaN(fail) ? null : { pass, fail };
}

// Browser graders import Playwright from the global install (the container ships one).
let pwEntry;
function playwrightEntry() {
  if (pwEntry !== undefined) return pwEntry;
  const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout?.trim() || "";
  const entry = path.join(root, "playwright", "index.mjs");
  return (pwEntry = fs.existsSync(entry) ? entry : "playwright");
}

export function grade(dir, task) {
  fs.copyFileSync(path.join(TASKS, task, "hidden.test.mjs"), path.join(dir, "__hidden.test.mjs"));
  const r = spawnSync(process.execPath, ["--test", "--test-timeout=30000", "__hidden.test.mjs"], { cwd: dir, encoding: "utf8", timeout: 180000, env: { ...process.env, OE_PLAYWRIGHT: playwrightEntry() } });
  const t = parseTap(`${r.stdout}\n${r.stderr}`) || { pass: 0, fail: 1 };
  const total = t.pass + t.fail;
  return { hidden_pass: t.pass, hidden_total: total, score: total ? t.pass / total : 0, solved: t.fail === 0 && t.pass > 0 };
}

export const promptSha = (arm) => crypto.createHash("sha256").update(ARMS[arm]).digest("hex").slice(0, 12);

// A task is either greenfield (ref.mjs is the reference solution.mjs) or brownfield
// (repo/ is the starting codebase and ref/ overlays the reference change on it).
function prepare(task) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oe-${task}-`));
  const repo = path.join(TASKS, task, "repo");
  if (fs.existsSync(repo)) fs.cpSync(repo, dir, { recursive: true });
  for (const f of ["spec.md", "visible.test.mjs"]) fs.copyFileSync(path.join(TASKS, task, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
  return dir;
}

function runAgent(dir, prompt, model, timeoutMs) {
  return new Promise((resolve) => {
    const args = ["-p", "--model", model, "--output-format", "json", "--max-turns", "40",
      "--allowedTools", "Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(curl:*)"];
    // The prompt goes on stdin: --allowedTools is variadic and would swallow it.
    const child = spawn("claude", args, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.end(prompt);
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      let j = null; try { j = JSON.parse(out); } catch {}
      resolve(j ? { ok: !j.is_error, cost_usd: j.total_cost_usd ?? null, turns: j.num_turns ?? null, duration_ms: j.duration_ms ?? null, model_id: Object.keys(j.modelUsage || {})[0] || null, stop: j.subtype || j.terminal_reason || null }
        : { ok: false, error: `exit ${code}; no JSON result` });
    });
  });
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export function summarize(rows) {
  const by = {};
  for (const r of rows) {
    const k = r.arm; by[k] ??= { arm: k, runs: 0, errors: 0, solved: 0, score_sum: 0, cost: 0, turns: 0 };
    const s = by[k]; s.runs++;
    if (r.error) { s.errors++; continue; }
    s.solved += r.solved ? 1 : 0; s.score_sum += r.score; s.cost += r.cost_usd || 0; s.turns += r.turns || 0;
  }
  return Object.values(by).map((s) => { const n = s.runs - s.errors; return { arm: s.arm, runs: s.runs, errors: s.errors, solved: `${s.solved}/${n}`, solve_rate: n ? +(s.solved / n).toFixed(3) : null, mean_hidden_score: n ? +(s.score_sum / n).toFixed(3) : null, mean_cost_usd: n ? +(s.cost / n).toFixed(4) : null, mean_turns: n ? +(s.turns / n).toFixed(1) : null }; });
}

export function check() {
  const problems = [];
  for (const task of listTasks()) {
    const base = path.join(TASKS, task);
    if (fs.existsSync(path.join(base, "repo"))) {
      // Brownfield: the untouched repo must fail; repo + ref must pass, including the repo's own tests.
      const plain = prepare(task);
      if (grade(plain, task).solved) problems.push(`${task}: grader passes the unchanged repository`);
      fs.cpSync(path.join(base, "ref"), plain, { recursive: true });
      const good = grade(plain, task);
      if (!good.solved) problems.push(`${task}: reference fails its grader (${good.hidden_pass}/${good.hidden_total})`);
      fs.rmSync(path.join(plain, "__hidden.test.mjs"), { force: true });
      const own = spawnSync(process.execPath, ["--test"], { cwd: plain, encoding: "utf8", timeout: 120000, env: { ...process.env, OE_PLAYWRIGHT: playwrightEntry() } });
      if (own.status !== 0) problems.push(`${task}: reference breaks the repository's own tests`);
      fs.rmSync(plain, { recursive: true, force: true });
      continue;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oe-check-${task}-`));
    fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
    fs.copyFileSync(path.join(base, "ref.mjs"), path.join(dir, "solution.mjs"));
    const good = grade(dir, task);
    if (!good.solved) problems.push(`${task}: reference fails its grader (${good.hidden_pass}/${good.hidden_total})`);
    // A planted bug: every export returns a constant. The grader must catch it.
    const src = fs.readFileSync(path.join(base, "ref.mjs"), "utf8");
    const names = [...src.matchAll(/export function (\w+)/g)].map((m) => m[1]);
    fs.writeFileSync(path.join(dir, "solution.mjs"), names.map((n) => `export function ${n}() { return 0; }`).join("\n"));
    if (grade(dir, task).solved) problems.push(`${task}: grader passes a constant stub`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return problems;
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (argv[0] === "check") {
    const problems = check();
    for (const p of problems) process.stderr.write(p + "\n");
    process.stdout.write(problems.length ? `outcome-eval check: ${problems.length} problem(s)\n` : `outcome-eval check: ${listTasks().length} graders sound\n`);
    return problems.length ? 1 : 0;
  }
  if (argv[0] === "summarize") {
    // Recorded evidence, re-derived: per-arm solve rate and cost relative to plain.
    const rows = argv.slice(1).filter((a) => !a.startsWith("--")).flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")).rows);
    const by = Object.fromEntries(summarize(rows).map((s) => [s.arm, s]));
    const out = { runs: rows.length, errors: rows.filter((r) => r.error).length };
    for (const [arm, s] of Object.entries(by)) { out[`${arm}_solve_rate`] = s.solve_rate; out[`${arm}_mean_cost_usd`] = s.mean_cost_usd; }
    // Cost ratios compare matched tasks only: an arm run on harder tasks is not cheaper or dearer by that alone.
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const costOf = (arm, task) => { const xs = rows.filter((r) => r.arm === arm && r.task === task && !r.error).map((r) => r.cost_usd || 0); return xs.length ? mean(xs) : null; };
    for (const arm of Object.keys(by)) {
      const tasks = [...new Set(rows.map((r) => r.task))].filter((t) => costOf(arm, t) != null && costOf("plain", t) != null);
      if (!tasks.length) continue;
      const ratios = tasks.map((t) => costOf(arm, t) / costOf("plain", t));
      out[`${arm}_cost_vs_plain`] = +(tasks.reduce((a, t) => a + costOf(arm, t), 0) / tasks.reduce((a, t) => a + costOf("plain", t), 0)).toFixed(2);
      out[`${arm}_cost_vs_plain_range`] = [+Math.min(...ratios).toFixed(2), +Math.max(...ratios).toFixed(2)];
    }
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return 0;
  }
  if (argv[0] !== "run") { process.stderr.write("usage: outcome-eval.mjs run [--model haiku] [--reps 3] [--arms plain,blueprint] [--tasks ...] [--parallel 4] [--out file] | check\n"); return 2; }
  const model = opt("--model", "haiku"), reps = Number(opt("--reps", 3));
  const arms = opt("--arms", "plain,blueprint").split(",");
  const tasks = opt("--tasks") ? opt("--tasks").split(",") : listTasks();
  const jobs = [];
  for (const task of tasks) for (const arm of arms) for (let r = 0; r < reps; r++) jobs.push({ task, arm, rep: r });
  process.stderr.write(`running ${jobs.length} jobs on ${model}\n`);
  const rows = await pool(jobs, Number(opt("--parallel", 4)), async (job) => {
    const dir = prepare(job.task);
    const t = Date.now();
    const agent = await runAgent(dir, ARMS[job.arm], model, 900000);
    const row = { ...job, model, prompt_sha: promptSha(job.arm), wall_ms: Date.now() - t, ...agent };
    // A run that ended (even at its turn limit) is graded: hitting the limit is a failure to
    // count, not an error to hide. Only a crash or timeout with no result is an error.
    if (!agent.error) Object.assign(row, grade(dir, job.task));
    fs.rmSync(dir, { recursive: true, force: true });
    process.stderr.write(`${job.task}/${job.arm}#${job.rep}: ${row.error ? "ERROR " + row.error : `${row.hidden_pass}/${row.hidden_total}${row.solved ? " solved" : ""} $${row.cost_usd}`}\n`);
    return row;
  });
  const result = { ran_at: new Date().toISOString(), model, reps, tasks, arms, summary: summarize(rows), rows };
  const out = opt("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
  return 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
