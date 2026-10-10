#!/usr/bin/env node
/**
 * outcome-eval.mjs — measure whether the framework's method changes outcomes, per model.
 *
 *   node scripts/outcome-eval.mjs run [--model haiku] [--judge sonnet|none] [--reps 3] [--arms plain,blueprint]
 *                                     [--tasks a,b] [--parallel 4] [--out <results.json>]
 *    node scripts/outcome-eval.mjs check            # graders pass their reference, fail planted bugs
 *   node scripts/outcome-eval.mjs regrade <results.json>  # re-score kept artifacts after a grader fix
 *
 * Each task in test-framework/outcome-evals/tasks/<id>/ has spec.md, visible.test.mjs, a
 * hidden.test.mjs grader the agent never sees, and ref.mjs (a reference solution used
 * only by `check`). Every arm gets the same files and tools in a fresh temporary
 * directory; only the instruction differs:
 *   plain      implement the spec.
 *   lean       plain plus the verifier loop: run every test, fix until green.
 *   production one-line request to a sellable product: spec with journeys, layers, e2e, verify.
 *   brief      plan-first for underspecified requests: brief, build, test, verify.
 *   studio     interactive products and games: design note, pure seeded rules, seed-bot
 *              tests, screenshot review against named stock looks.
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
import { probe } from "./quality-probes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = path.join(ROOT, "test-framework", "outcome-evals", "tasks");

export const ARMS = {
  plain: "Implement the specification in spec.md in this directory. visible.test.mjs has some example tests; `node --test` runs every test file here.",
  // The verifier loop alone: the part of the method the literature credits with the gain
  // (generate, then check against tests, then repair), without the written ceremony.
  lean: "Implement the specification in spec.md in this directory. Keep every existing behaviour the spec does not change. Before you finish, run `node --test` (it runs every test file here) and fix whatever fails; finish only when it passes.",
  // The framework's plan-first method for underspecified requests: decide what "good" means
  // before building, then build and verify against that.
  brief: [
    "Build what spec.md asks for. It is a short request from a founder, so first decide what good looks like, then build it and prove it.",
    "1. Write BRIEF.md: who plays, the core loop, the rules and numbers (prices, how they change, limits), the ways it could break (exploits, bad input, cheating) and how you prevent each, and 5-10 acceptance checks.",
    "2. Build it with the game rules in their own module, separate from HTTP and UI.",
    "3. Write tests with node:test for the rules and for every way-it-could-break from BRIEF.md.",
    "4. Run `node --test`, start the server with node and exercise the API, and fix whatever fails. Finish only when every acceptance check in BRIEF.md holds.",
  ].join("\n"),
  // The full svc method distilled into one instruction: from a one-line request to a product
  // a customer could pay for, at the lowest sensible cost.
  production: [
    "spec.md is a founder's one-line request for a product they will sell. Work like a principal engineer shipping to production at the lowest sensible cost. Choose proven patterns over invention.",
    "1. Write SPEC.md: users and roles; at least 10 user journeys (customer and owner, including failure paths), each with acceptance criteria; non-functional requirements (security, payments, data integrity, accessibility, operations); the architecture and why.",
    "2. Build in layers: domain rules, services, HTTP, UI. Configuration comes from the environment. Anything external (such as payments) sits behind an interface with a local implementation for tests.",
    "3. Tests: unit tests for the domain rules, and end-to-end tests that drive every journey through HTTP.",
    "4. Verify like a customer would: run `node --test`, start the server, and drive the main customer and owner journeys in a real browser when one is available, with zero console errors. Fix until every acceptance criterion holds. Finish with a README covering setup, configuration, running and deploying.",
    "Keep SPEC.md tight (one line per acceptance criterion) and reuse test helpers: depth comes from coverage, not length.",
  ].join("\n"),
  // Candidate method for interactive products and games (references/quality-dimensions.json
  // game layer). Sources: r/aigamedev practitioners (keep the simulation separate from
  // rendering, test with seeded bots, review screenshots against a reference) and the Opus
  // 5.5 prompting guide (name the default styles to avoid; verify in a real browser).
  studio: [
    "spec.md is a founder's request for an interactive product. Work like a small studio shipping a polished first version at the lowest sensible cost.",
    "1. Write DESIGN.md (one screen, no more): the core loop, the player's moment-to-moment decision, how difficulty rises over a run, the fail state, what each action looks and feels like (its feedback), and the visual direction: a palette of 4-6 named colours and shapes that fit the theme.",
    "2. Keep the rules in a pure, seeded module with no DOM; rendering and input only read state and send actions.",
    "3. Tests: unit tests for the rules, plus seeded bots (random, idle and greedy) that play many games and assert no crash, no NaN and no softlock, that idling loses and that a good player scores.",
    "4. Verify like a player: start the server, play in a real browser, take screenshots and look at them. Fix anything that reads as a placeholder or as a stock AI look: default rectangles on a plain background, a centered card on a gradient, emoji as the only art, unstyled system text. Keep frames under 16 ms and the console free of errors.",
    "5. Stop when the game is fun for a minute and every check passes. Do not add systems the game does not use.",
  ].join("\n"),
  blueprint: [
    "Implement the specification in spec.md in this directory, following this plan exactly. Do every step; each one has a check.",
    "1. Read spec.md. Write RULES.md: a numbered list with one line per rule in the spec, including every input that must be rejected and every edge case it names. Check: every sentence of the spec maps to at least one rule.",
    "2. Write rules.test.mjs with node:test and node:assert/strict: at least one test per rule, importing the code the spec names, using exact expected values computed from the spec by hand. Include visible.test.mjs's cases. Check: each rule number appears in a test name.",
    "3. Write or change the code the spec asks for. Keep every existing behaviour the spec does not change.",
    "4. Run `node --test` (it runs every test file here, including any existing ones). If anything fails, decide from spec.md whether the code or the test is wrong, fix that one, and run again. Repeat until everything passes.",
    "5. Done when all tests pass and every rule in RULES.md has a passing test. Do not stop earlier.",
  ].join("\n"),
};

// Optional per-task settings: tasks/<id>/task.json { max_turns, timeout_min, judge_model }.
// Pillar tasks (one svc stage or checkpoint each) also set `pillar`, and either
// `instruction` plus `svc` (framework files) or `steps: [{ instruction, svc }]` for a
// multi-session scenario; `copy_spec: false` keeps spec.md out of the agent's directory.
export function taskConfig(task) {
  const f = path.join(TASKS, task, "task.json");
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  return { max_turns: c.max_turns ?? 40, timeout_ms: (c.timeout_min ?? 15) * 60000, judge_model: c.judge_model ?? null, pillar: c.pillar ?? null, variants: c.variants ?? null, steps: c.steps ?? (c.instruction ? [{ instruction: c.instruction, svc: c.svc ?? [] }] : null), copy_spec: c.copy_spec ?? true };
}

// Pillar arms: `bare` gets the task's instruction only; `svc` gets the same instruction
// followed by the framework's own stage files, verbatim (frontmatter removed), so the
// eval measures what the shipped prompts do, not a paraphrase of them. `svc:<variant>`
// swaps in a candidate file set from task.json `variants` (one list per step), so a
// proposed prompt change is measured against the shipped one before it is adopted.
export const PILLAR_ARMS = ["bare", "svc"];
const isPillarArm = (arm) => PILLAR_ARMS.includes(arm) || arm.startsWith("svc:");
const stripFrontmatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n/, "");
export function armPrompts(task, arm) {
  const { steps } = taskConfig(task);
  if (!isPillarArm(arm)) {
    if (!ARMS[arm]) throw new Error(`unknown arm ${arm}`);
    return [ARMS[arm]];
  }
  if (!steps) throw new Error(`${task} is not a pillar task (no instruction or steps in task.json)`);
  const variant = arm.startsWith("svc:") ? taskConfig(task).variants?.[arm.slice(4)] : null;
  if (arm.startsWith("svc:") && !variant) throw new Error(`${task} has no variant ${arm.slice(4)}`);
  return steps.map((step, i) => {
    const s = variant ? { ...step, svc: variant[i] || [] } : step;
    return arm === "bare" || !(s.svc || []).length ? s.instruction : [
    s.instruction,
    "",
    "Work by the framework procedure below. Paths, scripts and receipts it mentions belong to the framework repository and do not exist here; apply its method and checks to this directory, and write your output where the instruction above says.",
    "",
    ...(s.svc || []).map((f) => `<procedure file="${f}">\n${stripFrontmatter(fs.readFileSync(path.join(ROOT, f), "utf8")).trim()}\n</procedure>`),
    ].join("\n");
  });
}

export function listTasks() {
  return fs.readdirSync(TASKS).filter((d) => fs.existsSync(path.join(TASKS, d, "hidden.test.mjs"))).sort();
}

// node --test summary → passed/failed counts of top-level tests.
// A cancelled test (it timed out) is a failure, not a test that never existed.
export function parseTap(out) {
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? NaN);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? NaN);
  const cancelled = Number(/^# cancelled (\d+)/m.exec(out)?.[1] ?? 0);
  return Number.isNaN(pass) || Number.isNaN(fail) ? null : { pass, fail: fail + cancelled };
}

// Browser graders import Playwright from the global install (the container ships one).
let pwEntry;
function playwrightEntry() {
  if (pwEntry !== undefined) return pwEntry;
  const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout?.trim() || "";
  const entry = path.join(root, "playwright", "index.mjs");
  return (pwEntry = fs.existsSync(entry) ? entry : "playwright");
}

// The failing test names and their first error line, so a failed run says why.
export function failureReasons(out) {
  const reasons = [];
  const lines = out.split("\n");
  lines.forEach((line, i) => {
    const m = /^not ok \d+ - (.*)$/.exec(line.trim());
    if (!m) return;
    const err = lines.slice(i + 1, i + 40).find((l) => /error:|message:|Error\b/.test(l)) || "";
    reasons.push(`${m[1]}: ${err.trim()}`.slice(0, 300));
  });
  return reasons.slice(0, 5);
}

export function grade(dir, task) {
  fs.copyFileSync(path.join(TASKS, task, "hidden.test.mjs"), path.join(dir, "__hidden.test.mjs"));
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-timeout=30000", "__hidden.test.mjs"], { cwd: dir, encoding: "utf8", timeout: 180000, env: { ...process.env, OE_PLAYWRIGHT: playwrightEntry() } });
  const out = `${r.stdout}\n${r.stderr}`;
  const t = parseTap(out) || { pass: 0, fail: 1 };
  const total = t.pass + t.fail;
  return { hidden_pass: t.pass, hidden_total: total, score: total ? t.pass / total : 0, solved: t.fail === 0 && t.pass > 0, ...(t.fail ? { hidden_failures: failureReasons(out) } : {}) };
}

export const promptSha = (arm, task) => crypto.createHash("sha256").update(task && isPillarArm(arm) ? armPrompts(task, arm).join("\n\0\n") : ARMS[arm]).digest("hex").slice(0, 12);

// A task is either greenfield (ref.mjs is the reference solution.mjs) or brownfield
// (repo/ is the starting codebase and ref/ overlays the reference change on it).
function prepare(task) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oe-${task}-`));
  const repo = path.join(TASKS, task, "repo");
  if (fs.existsSync(repo)) fs.cpSync(repo, dir, { recursive: true });
  const files = taskConfig(task).copy_spec ? ["spec.md", "visible.test.mjs"] : ["visible.test.mjs"];
  for (const f of files) if (fs.existsSync(path.join(TASKS, task, f))) fs.copyFileSync(path.join(TASKS, task, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
  return dir;
}

function runAgent(dir, prompt, model, timeoutMs, tools = "Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(curl:*),Bash(mkdir:*)", maxTurns = 40, effort = null) {
  return new Promise((resolve) => {
    // The model guides tell you to sweep effort on your own evals rather than assume a level.
    const args = ["-p", "--model", model, "--output-format", "json", "--max-turns", String(maxTurns), ...(effort ? ["--effort", effort] : []), "--allowedTools", tools];
    // The prompt goes on stdin: --allowedTools is variadic and would swallow it.
    const child = spawn("claude", args, { cwd: dir, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, OE_PLAYWRIGHT: playwrightEntry() } });
    child.stdin.end(prompt);
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      let j = null; try { j = JSON.parse(out); } catch {}
      resolve(j ? { ok: !j.is_error, cost_usd: j.total_cost_usd ?? null, turns: j.num_turns ?? null, duration_ms: j.duration_ms ?? null, model_id: Object.keys(j.modelUsage || {})[0] || null, stop: j.subtype || j.terminal_reason || null, text: typeof j.result === "string" ? j.result : "" }
        : { ok: false, error: `exit ${code}; no JSON result` });
    });
  });
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// Seeded statistics so recorded evidence re-derives to the same numbers every time.
function rng(seed = 20261010) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Difference of means (a - b) with a bootstrap 95% interval and a two-sided permutation p-value.
export function compareSamples(a, b, iterations = 10000) {
  if (!a.length || !b.length) return null;
  const rand = rng();
  const diff = avg(a) - avg(b);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const boots = [];
  for (let i = 0; i < iterations; i++) boots.push(avg(a.map(() => pick(a))) - avg(b.map(() => pick(b))));
  boots.sort((x, y) => x - y);
  const pooled = [...a, ...b];
  let extreme = 0;
  for (let i = 0; i < iterations; i++) {
    const shuffled = [...pooled];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    if (Math.abs(avg(shuffled.slice(0, a.length)) - avg(shuffled.slice(a.length))) >= Math.abs(diff) - 1e-12) extreme++;
  }
  return { diff: +diff.toFixed(2), ci95: [+boots[Math.floor(iterations * 0.025)].toFixed(2), +boots[Math.floor(iterations * 0.975)].toFixed(2)], p: +((extreme + 1) / (iterations + 1)).toFixed(4), n: [a.length, b.length] };
}

// Promotion rule for a prompt or method variant (candidate) over the current one
// (baseline), from recorded rows only. Judged tasks: promote when the judge-score gain is
// established (interval above zero and p < 0.05). Graded tasks: promote when the solve
// rate is higher, or equal at lower mean cost. Otherwise keep the baseline: a variant
// that costs more without a measured gain never wins.
export function promotionDecision(rows, candidate, baseline) {
  const of = (arm) => rows.filter((r) => r.arm === arm && !r.error);
  const c = of(candidate), b = of(baseline);
  if (!c.length || !b.length) return { promote: false, reason: "no runs for one of the arms" };
  const judged = (xs) => xs.filter((r) => typeof r.judge_total === "number").map((r) => r.judge_total);
  if (judged(c).length && judged(b).length) {
    const stats = compareSamples(judged(c), judged(b));
    const established = stats.ci95[0] > 0 && stats.p < 0.05;
    return { promote: established, reason: established ? "judge-score gain established" : "no established judge-score gain", stats };
  }
  const rate = (xs) => xs.filter((r) => r.solved).length / xs.length;
  const cost = (xs) => avg(xs.map((r) => r.cost_usd || 0));
  const [rc, rb, cc, cb] = [rate(c), rate(b), cost(c), cost(b)];
  if (rc > rb) return { promote: true, reason: `solves more (${rc.toFixed(2)} vs ${rb.toFixed(2)})` };
  if (rc === rb && cc < cb) return { promote: true, reason: `same solve rate at lower cost ($${cc.toFixed(4)} vs $${cb.toFixed(4)})` };
  return { promote: false, reason: rc < rb ? "solves less" : `same solve rate at equal or higher cost ($${cc.toFixed(4)} vs $${cb.toFixed(4)})` };
}

// The judge answers with one JSON object; take the last {...} block in its reply.
export function parseJudge(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const j = JSON.parse(m[0]); return typeof j.total === "number" && j.scores ? j : null; } catch { return null; }
}

// Blind rubric judging for tasks without a full contract (judge.md). The judge sees the
// product, never the arm or the instruction that produced it.
export async function judge(dir, task, model) {
  const rubric = path.join(TASKS, task, "judge.md");
  if (!model || !fs.existsSync(rubric)) return {};
  fs.rmSync(path.join(dir, "__hidden.test.mjs"), { force: true });
  for (const f of ["BRIEF.md", "RULES.md"]) if (fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(dir, f), path.join(dir, `NOTES-${f}`));
  const jm = taskConfig(task).judge_model || model;
  const r = await runAgent(dir, fs.readFileSync(rubric, "utf8"), jm, 1800000, "Read,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*)", 80);
  const verdict = parseJudge(r.text);
  return verdict ? { judge_model: jm, judge_total: verdict.total, judge_scores: verdict.scores, judge_verified_journeys: verdict.verified_journeys ?? null, judge_money_pump: verdict.money_pump_found ?? null, judge_notes: verdict.notes || "", judge_cost_usd: r.cost_usd } : { judge_model: jm, judge_error: r.error || "no JSON verdict" };
}

export function summarize(rows) {
  const by = {};
  for (const r of rows) {
    const k = r.arm; by[k] ??= { arm: k, runs: 0, errors: 0, solved: 0, score_sum: 0, cost: 0, turns: 0 };
    const s = by[k]; s.runs++;
    if (r.error) { s.errors++; continue; }
    s.solved += r.solved ? 1 : 0; s.score_sum += r.score; s.cost += r.cost_usd || 0; s.turns += r.turns || 0;
    if (typeof r.judge_total === "number") { s.judged = (s.judged || 0) + 1; s.judge_sum = (s.judge_sum || 0) + r.judge_total; }
  }
  return Object.values(by).map((s) => { const n = s.runs - s.errors; return { arm: s.arm, runs: s.runs, errors: s.errors, solved: `${s.solved}/${n}`, solve_rate: n ? +(s.solved / n).toFixed(3) : null, mean_hidden_score: n ? +(s.score_sum / n).toFixed(3) : null, mean_cost_usd: n ? +(s.cost / n).toFixed(4) : null, mean_turns: n ? +(s.turns / n).toFixed(1) : null, ...(s.judged ? { judged: s.judged, mean_judge_total: +(s.judge_sum / s.judged).toFixed(2) } : {}) }; });
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
      const own = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], { cwd: plain, encoding: "utf8", timeout: 120000, env: { ...process.env, OE_PLAYWRIGHT: playwrightEntry() } });
      if (own.status !== 0) problems.push(`${task}: reference breaks the repository's own tests`);
      fs.rmSync(plain, { recursive: true, force: true });
      // A plausible but wrong answer (ref-wrong/ overlay) must fail too.
      if (fs.existsSync(path.join(base, "ref-wrong"))) {
        const wrong = prepare(task);
        fs.cpSync(path.join(base, "ref-wrong"), wrong, { recursive: true });
        if (grade(wrong, task).solved) problems.push(`${task}: grader passes the plausible wrong answer in ref-wrong/`);
        fs.rmSync(wrong, { recursive: true, force: true });
      }
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
  if (argv[0] === "regrade") {
    // Re-score kept artifacts with the current graders; agent and judge results are unchanged.
    const file = argv[1];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const row of data.rows) {
      if (!row.artifact || !fs.existsSync(row.artifact)) continue;
      const before = `${row.hidden_pass}/${row.hidden_total}`;
      delete row.hidden_failures;
      Object.assign(row, grade(row.artifact, row.task), { regraded_at: new Date().toISOString() });
      fs.rmSync(path.join(row.artifact, "__hidden.test.mjs"), { force: true });
      process.stderr.write(`${row.task}/${row.arm}#${row.rep}: ${before} -> ${row.hidden_pass}/${row.hidden_total}\n`);
    }
    data.summary = summarize(data.rows);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    return 0;
  }
  if (argv[0] === "promote") {
    // node scripts/outcome-eval.mjs promote --candidate production --baseline plain <results.json...>
    const rest = argv.slice(1);
    const files = rest.filter((x, i) => !x.startsWith("--") && !["--candidate", "--baseline"].includes(rest[i - 1]));
    const rows = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")).rows);
    const out = promotionDecision(rows, opt("--candidate"), opt("--baseline", "plain"));
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return 0;
  }
  if (argv[0] === "summarize") {
    // Recorded evidence, re-derived: per-arm solve rate and cost relative to plain.
    const rows = argv.slice(1).filter((a) => !a.startsWith("--")).flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")).rows);
    const by = Object.fromEntries(summarize(rows).map((s) => [s.arm, s]));
    const out = { runs: rows.length, errors: rows.filter((r) => r.error).length };
    for (const [arm, s] of Object.entries(by)) {
      out[`${arm}_solve_rate`] = s.solve_rate; out[`${arm}_mean_cost_usd`] = s.mean_cost_usd;
      if (s.mean_judge_total !== undefined) out[`${arm}_mean_judge_total`] = s.mean_judge_total;
    }
    // Judge-score difference from plain, with uncertainty: a difference whose interval spans
    // zero, or whose permutation p is 0.05 or more (small samples make the bootstrap
    // interval optimistic), is reported as not established.
    const judged = (arm) => rows.filter((r) => r.arm === arm && typeof r.judge_total === "number").map((r) => r.judge_total);
    for (const arm of Object.keys(by)) {
      if (arm === "plain") continue;
      const c = compareSamples(judged(arm), judged("plain"));
      if (c) { out[`${arm}_judge_vs_plain`] = c; out[`${arm}_judge_vs_plain_ci_low`] = c.ci95[0]; out[`${arm}_judge_vs_plain_established`] = (c.ci95[0] > 0 || c.ci95[1] < 0) && c.p < 0.05; }
    }
    // Quality probes and judge claims per arm: the dimensions hidden tests do not see.
    const meanOf = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);
    for (const arm of Object.keys(by)) {
      const ok = rows.filter((r) => r.arm === arm && !r.error);
      const probed = ok.filter((r) => r.probes);
      if (probed.length) {
        out[`${arm}_mutation_score`] = meanOf(probed.map((r) => r.probes.mutation?.score).filter((x) => typeof x === "number"));
        out[`${arm}_mutation_scored`] = `${probed.filter((r) => typeof r.probes.mutation?.score === "number").length}/${probed.length}`;
        out[`${arm}_source_loc`] = meanOf(probed.map((r) => r.probes.size.source_loc));
        out[`${arm}_source_files`] = meanOf(probed.map((r) => r.probes.size.source_files));
        out[`${arm}_slop`] = meanOf(probed.map((r) => r.probes.slop.todo_or_placeholder + r.probes.slop.empty_catch + r.probes.slop.unused_exports));
      }
      const judged = ok.filter((r) => r.judge_scores);
      if (judged.length) out[`${arm}_judge_claims`] = Object.fromEntries(Object.keys(judged[0].judge_scores).map((k) => [k, meanOf(judged.map((r) => Number(r.judge_scores[k]) || 0))]));
    }
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
  const judgeModel = opt("--judge", "sonnet") === "none" ? null : opt("--judge", "sonnet");
  const arms = opt("--arms", "plain,blueprint").split(",");
  const probeMutants = Number(opt("--probes", 0));
  const effort = opt("--effort", null);
  const tasks = opt("--tasks") ? opt("--tasks").split(",") : listTasks();
  const keepRoot = opt("--keep", path.join(os.homedir(), ".svc", "outcome-eval-artifacts", new Date().toISOString().replace(/[:.]/g, "-")));
  fs.mkdirSync(keepRoot, { recursive: true });
  const jobs = [];
  for (const task of tasks) for (const arm of arms) for (let r = 0; r < reps; r++) jobs.push({ task, arm, rep: r });
  process.stderr.write(`running ${jobs.length} jobs on ${model}\n`);
  const rows = await pool(jobs, Number(opt("--parallel", 4)), async (job) => {
    const dir = prepare(job.task);
    const t = Date.now();
    const cfg = taskConfig(job.task);
    // Multi-step scenarios run each step as a fresh session in the same directory: only
    // what an earlier session left on disk carries over, as between real sessions.
    let agent = { cost_usd: 0, turns: 0, duration_ms: 0, steps: 0 };
    const replies = [];
    // Hash the prompts actually sent, not the files as they are when the row is written.
    const prompts = armPrompts(job.task, job.arm);
    const sha = crypto.createHash("sha256").update(isPillarArm(job.arm) ? prompts.join("\n\0\n") : prompts[0]).digest("hex").slice(0, 12);
    for (const prompt of prompts) {
      const step = await runAgent(dir, prompt, model, cfg.timeout_ms, undefined, cfg.max_turns, effort);
      replies.push(String(step.text || "").slice(-400));
      if (step.error) { agent = { ...agent, error: `step ${agent.steps + 1}: ${step.error}` }; break; }
      agent = { ...step, cost_usd: (agent.cost_usd || 0) + (step.cost_usd || 0), turns: (agent.turns || 0) + (step.turns || 0), duration_ms: (agent.duration_ms || 0) + (step.duration_ms || 0), steps: agent.steps + 1 };
    }
    // The end of each step's final reply, so a run that wrote nothing still says why.
    const row = { ...job, model, ...(effort ? { effort } : {}), pillar: cfg.pillar, prompt_sha: sha, wall_ms: Date.now() - t, ...agent, step_replies: replies };
    // A run that ended (even at its turn limit) is graded: hitting the limit is a failure to
    // count, not an error to hide. Only a crash or timeout with no result is an error.
    if (!agent.error) Object.assign(row, grade(dir, job.task), await judge(dir, job.task, judgeModel));
    delete row.text;
    // Keep what was built (minus dependencies) so a grader fix can re-score it for free.
    const keep = path.join(keepRoot, `${job.task}-${job.arm}-${job.rep}`);
    fs.cpSync(dir, keep, { recursive: true, filter: (src) => !src.includes(`${path.sep}node_modules`) });
    row.artifact = keep;
    fs.rmSync(dir, { recursive: true, force: true });
    process.stderr.write(`${job.task}/${job.arm}#${job.rep}: ${row.error ? "ERROR " + row.error : `${row.hidden_pass}/${row.hidden_total}${row.solved ? " solved" : ""} $${row.cost_usd}`}\n`);
    return row;
  });
  // Engineering-quality probes (test strength by mutation, size, slop, secrets) run on the
  // kept builds after every agent has finished: they run tests synchronously and would
  // otherwise stall the agents still working.
  if (probeMutants > 0) for (const row of rows) if (!row.error && row.artifact) row.probes = probe(row.artifact, { mutants: probeMutants });
  const result = { ran_at: new Date().toISOString(), model, reps, tasks, arms, summary: summarize(rows), rows };
  const out = opt("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
  return 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
