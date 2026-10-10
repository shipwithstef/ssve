#!/usr/bin/env node
/**
 * skill-ab-eval — A/B a skill against the bare model on a fixed task set.
 *
 * For each task and each arm ("bare", "with-skill") the runner is invoked
 * --repeat times with the prompt on stdin. The with-skill arm prepends the
 * skill's SKILL.md body, so the arm pays the skill's real context cost. Each
 * run is graded deterministically (regex over the answer, or a command that
 * receives the answer on stdin) and its token usage is read from the
 * runner's JSON output when present (claude -p --output-format json).
 *
 * The report answers the audit question per skill: does it raise the pass
 * rate, or only add tokens? verdict = "earns-keep" | "no-gain" | "regresses".
 * Pass-rate deltas within --margin count as no gain; a skill that ties the
 * bare model is a SLIM/RETIRE candidate unless it owns a contract artifact
 * (then the grader should test that contract and it will not tie).
 *
 * Usage:
 *   node scripts/skill-ab-eval.mjs --tasks FILE --regrade REPORT.json [--json]
 *     re-applies the task file's current graders to a saved report's stored
 *     answers and artifacts: fixing a grader costs nothing to re-score.
 *   node scripts/skill-ab-eval.mjs --tasks FILE [--runner "CMD ARGS"]
 *        [--repeat 3] [--margin 0.15] [--only skill,skill] [--json] [--out FILE]
 *
 * Every run executes in its own empty sandbox directory (or the shared --cwd),
 * so neither arm picks up this repo's CLAUDE.md/AGENTS.md and no run sees
 * another run's files. Skills that produce artifacts are graded on what they
 * actually wrote: files left in the sandbox are collected and, per the task's
 * grader `on` field ("answer" | "artifacts" | "either", default "either"),
 * graded instead of or alongside the chat answer. A run that only CLAIMS to
 * have written a file fails an artifacts grader.
 *
 * The default runner is `claude -p --output-format json`, which spends paid
 * tokens: it requires EVALS=1 (same contract as tier 1.5/2/3). An explicit
 * --runner (for example the hermetic fixture runner) needs no flag.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_RUNNER = "claude -p --output-format json";

export function parseArgs(argv, env = process.env) {
  const o = { repeat: 3, margin: 0.15, runner: null, only: null, json: false, out: null, tasks: null, cwd: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") { o.json = true; continue; }
    if (a === "--help" || a === "-h") { o.help = true; continue; }
    if (!["--tasks", "--runner", "--repeat", "--margin", "--only", "--out", "--cwd", "--regrade"].includes(a)) throw new Error(`unknown option: ${a}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
    o[a.slice(2)] = ["--repeat", "--margin"].includes(a) ? Number(v) : v;
  }
  if (o.help) return o;
  if (!o.tasks) throw new Error("--tasks is required");
  if (!Number.isInteger(o.repeat) || o.repeat < 1 || o.repeat > 20) throw new Error("--repeat must be an integer 1..20");
  if (!(o.margin >= 0 && o.margin < 1)) throw new Error("--margin must be in [0, 1)");
  if (!o.runner && !o.regrade) {
    if (env.EVALS !== "1") throw new Error(`default runner '${DEFAULT_RUNNER}' spends paid tokens; set EVALS=1 or pass --runner`);
    o.runner = DEFAULT_RUNNER;
  }
  o.only = o.only ? new Set(o.only.split(",").map((s) => s.trim()).filter(Boolean)) : null;
  return o;
}

/** Split a runner string into argv without invoking a shell. */
export function splitArgv(cmd) {
  const out = []; let cur = ""; let q = null; let any = false;
  for (const ch of cmd) {
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; any = true; continue; }
    if (/\s/.test(ch)) { if (cur || any) out.push(cur); cur = ""; any = false; continue; }
    cur += ch;
  }
  if (q) throw new Error("unterminated quote in --runner");
  if (cur || any) out.push(cur);
  return out;
}

function skillBody(skill) {
  const file = path.join(ROOT, "skills", skill, "SKILL.md");
  if (!fs.existsSync(file)) throw new Error(`unknown skill: ${skill}`);
  return fs.readFileSync(file, "utf8");
}

export function buildPrompt(task, arm) {
  if (arm === "bare") return task.prompt;
  return `Follow this skill for the task below.\n\n<skill name="${task.skill}">\n${skillBody(task.skill)}\n</skill>\n\nTask:\n${task.prompt}`;
}

/** Extract answer text + usage from a runner's stdout (JSON envelope or plain text). */
export function parseRunnerOutput(stdout) {
  const text = String(stdout || "").trim();
  try {
    const j = JSON.parse(text);
    const answer = typeof j.result === "string" ? j.result : typeof j.text === "string" ? j.text : text;
    const u = j.usage || {};
    const input = Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
    const output = Number(u.output_tokens || 0);
    return { answer, tokens: input || output ? { input, output, total: input + output } : null, cost_usd: j.total_cost_usd ?? null };
  } catch { return { answer: text, tokens: null, cost_usd: null }; }
}

/** Markdown emphasis and code ticks are presentation, not content: `**Status:** Draft` must match `Status: DRAFT`. */
export function normalizeAnswer(text) { return String(text).replace(/[*_`]+/g, ""); }

/** Text files a run left in its sandbox (host config dirs excluded), capped for safety. */
export function collectArtifacts(dir, limit = 1024 * 1024) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".claude" || e.name === ".git" || e.name === "node_modules") continue;
      const abs = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else if (e.isFile() && fs.statSync(abs).size <= limit) {
        const text = fs.readFileSync(abs, "utf8"); if (!text.includes("\u0000")) out.push({ path: r, text });
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** What a grader reads: the answer, the artifacts, or both. */
export function gradedText(grader, answer, artifacts = []) {
  const files = artifacts.map((a) => `\n--- ${a.path} ---\n${a.text}`).join("");
  const on = grader.on || "either";
  if (on === "answer") return answer;
  if (on === "artifacts") return files;
  if (on === "either") return `${answer}\n${files}`;
  throw new Error(`grader.on must be answer | artifacts | either (got ${on})`);
}

export function grade(grader, answer, cwd = ROOT, artifacts = []) {
  if (!grader || !grader.type) throw new Error("task grader missing");
  answer = gradedText(grader, answer, artifacts);
  if (grader.type === "regex") {
    answer = normalizeAnswer(answer);
    const all = [].concat(grader.pattern);
    return all.every((p) => new RegExp(p, grader.flags ?? "im").test(answer)) &&
      ![].concat(grader.forbid || []).some((p) => new RegExp(p, grader.flags ?? "im").test(answer));
  }
  if (grader.type === "command") {
    const [bin, ...args] = grader.argv;
    return spawnSync(bin, args, { input: answer, cwd, encoding: "utf8", timeout: 60000 }).status === 0;
  }
  throw new Error(`unknown grader type: ${grader.type}`);
}

export function summarize(runs, margin) {
  const by = {};
  for (const r of runs) ((by[r.task] ||= { skill: r.skill, bare: [], "with-skill": [] })[r.arm]).push(r);
  const tasks = [];
  for (const [id, t] of Object.entries(by)) {
    const arm = (xs) => {
      const tok = xs.map((x) => x.tokens?.total).filter((n) => Number.isFinite(n));
      return { runs: xs.length, pass_rate: xs.filter((x) => x.pass).length / (xs.length || 1),
        mean_tokens: tok.length ? Math.round(tok.reduce((a, b) => a + b, 0) / tok.length) : null,
        mean_answer_chars: Math.round(xs.reduce((a, x) => a + x.answer_chars, 0) / (xs.length || 1)) };
    };
    const bare = arm(t.bare); const withSkill = arm(t["with-skill"]);
    const delta = withSkill.pass_rate - bare.pass_rate;
    // An arm whose runner never completed is a broken run, not evidence: it
    // must not read as "no-gain" (which would argue for retiring the skill).
    const ran = (xs) => xs.some((x) => x.exit === 0);
    const verdict = !ran(t.bare) || !ran(t["with-skill"]) ? "error" : delta > margin ? "earns-keep" : delta < -margin ? "regresses" : "no-gain";
    tasks.push({ task: id, skill: t.skill, bare, with_skill: withSkill, pass_delta: Number(delta.toFixed(3)),
      token_delta: bare.mean_tokens !== null && withSkill.mean_tokens !== null ? withSkill.mean_tokens - bare.mean_tokens : null, verdict });
  }
  return tasks;
}

/** Re-score stored runs with the task file's current graders (no runner calls). */
export function regrade(o) {
  const spec = JSON.parse(fs.readFileSync(o.tasks, "utf8"));
  const report = JSON.parse(fs.readFileSync(o.regrade, "utf8"));
  const byId = new Map(spec.tasks.map((t) => [t.id, t]));
  const runs = report.runs.map((r) => {
    const t = byId.get(r.task); if (!t) throw new Error(`report task '${r.task}' is not in ${o.tasks}`);
    if (typeof r.answer !== "string") throw new Error("report has no stored answers (made before answers were kept)");
    return { ...r, pass: r.exit === 0 && grade(t.grader, r.answer, ROOT, (r.artifacts || []).map((a) => ({ path: a.path, text: a.text }))) };
  });
  return { ...report, regraded_from: o.regrade, margin: o.margin, tasks: summarize(runs, o.margin), runs };
}

export function run(o) {
  const spec = JSON.parse(fs.readFileSync(o.tasks, "utf8"));
  const tasks = spec.tasks.filter((t) => !o.only || o.only.has(t.skill));
  if (!tasks.length) throw new Error("no tasks selected");
  const [bin, ...args] = splitArgv(o.runner);
  const runs = [];
  for (const task of tasks) {
    for (const arm of ["bare", "with-skill"]) {
      for (let i = 0; i < o.repeat; i++) {
        const cwd = o.cwd ? path.resolve(o.cwd) : fs.mkdtempSync(path.join(os.tmpdir(), "svc-ab-run-"));
        const r = spawnSync(bin, args, { input: buildPrompt(task, arm), cwd, encoding: "utf8",
          timeout: (spec.timeout_seconds || 600) * 1000, maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, SVC_AB_ARM: arm, SVC_AB_TASK: task.id } });
        const parsed = r.status === 0 ? parseRunnerOutput(r.stdout) : { answer: "", tokens: null, cost_usd: null };
        const artifacts = collectArtifacts(cwd);
        if (!o.cwd) fs.rmSync(cwd, { recursive: true, force: true });
        runs.push({ task: task.id, skill: task.skill, arm, i, exit: r.status, error: r.error?.code ?? null, signal: r.signal ?? null, pass: r.status === 0 && grade(task.grader, parsed.answer, ROOT, artifacts),
          tokens: parsed.tokens, cost_usd: parsed.cost_usd, answer_chars: parsed.answer.length, answer: parsed.answer,
          artifacts: artifacts.map((a) => ({ path: a.path, chars: a.text.length, text: a.text.slice(0, 20000) })) });
      }
    }
  }
  return { runner: o.runner, repeat: o.repeat, margin: o.margin, tasks: summarize(runs, o.margin), runs };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`skill-ab-eval: ${e.message}`); process.exit(2); }
  if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1]); process.exit(0); }
  try {
    const report = o.regrade ? regrade(o) : run(o);
    if (o.out) fs.writeFileSync(o.out, JSON.stringify(report, null, 2) + "\n");
    const broken = report.tasks.filter((t) => t.verdict === "error");
    if (broken.length) { process.exitCode = 1; const r0 = report.runs.find((x) => x.exit !== 0); console.error(`skill-ab-eval: runner failed for ${broken.map((t) => t.task).join(", ")} (first failure: exit ${r0?.exit} ${r0?.error || r0?.signal || ""}); no verdict for those tasks`); }
    if (o.json) console.log(JSON.stringify(report, null, 2));
    else for (const t of report.tasks) {
      console.log(`${t.verdict.padEnd(10)} ${t.skill.padEnd(22)} ${t.task}: pass ${t.bare.pass_rate.toFixed(2)} -> ${t.with_skill.pass_rate.toFixed(2)}` +
        (t.token_delta === null ? "" : `, tokens ${t.token_delta >= 0 ? "+" : ""}${t.token_delta}`));
    }
  } catch (e) { console.error(`skill-ab-eval: ${e.message}`); process.exit(1); }
}
