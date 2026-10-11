#!/usr/bin/env node
/**
 * skill-ab-eval — A/B a skill against the bare model on a fixed task set.
 *
 * Two arms only: "bare" and "with-skill". For each task and arm the runner is
 * invoked --repeat times with the prompt on stdin. The with-skill arm gets the
 * skill's SKILL.md body in the prompt (so it pays the skill's real context cost)
 * AND the skill's whole folder (references/, scripts/, templates/ ...) mounted
 * in the run sandbox at .claude/skills/<skill>/, so the skill can read what it
 * points to. The mount is never graded as an artifact. Each run is graded
 * deterministically (regex over the answer, or a command that receives the
 * answer on stdin) and its token usage and served model ids are read from the
 * runner's JSON output when present (claude -p --output-format json). An empty
 * or whitespace-only graded text never passes. Regex graders can also require
 * `min_words` and per-heading `sections: [{heading, min_words}]` so a keyword
 * list or a heading skeleton is not an answer.
 *
 * Verdicts need evidence. Crashed runs do not count. Fewer than 3 finished runs
 * in either arm is "inconclusive". Adopting a direction (earns-keep / regresses)
 * needs >= 5 finished runs per arm, a pass-rate delta beyond --margin and a
 * permutation p < .05 (compareSamples from scripts/outcome-eval.mjs); no-gain
 * needs >= 5 per arm and a delta within --margin. Anything else is
 * "inconclusive" and the report says why; 3-4 runs per arm only record the
 * point-estimate direction in `exploratory`. A verdict is bound to the measured
 * candidate: each task row records `skill_hash` (sha256 over the whole skill
 * folder) and `models` (ids the runner reported serving). `--check-stale`
 * reports a verdict whose hash or model no longer matches as stale; stale
 * evidence is history, never a basis for a decision.
 *
 * Usage:
 *   node scripts/skill-ab-eval.mjs --tasks FILE --regrade REPORT.json [--json]
 *     re-applies the task file's current graders to a saved report's stored
 *     answers and artifacts: fixing a grader costs nothing to re-score.
 *   node scripts/skill-ab-eval.mjs --check-stale REPORT.json --model MODEL_ID [--json]
 *     exit 1 when any verdict's skill folder hash or served model differs from
 *     the current skill / MODEL_ID (or was never recorded).
 *   node scripts/skill-ab-eval.mjs --tasks FILE [--runner "CMD ARGS"]
 *        [--repeat 5] [--margin 0.15] [--only skill,skill] [--json] [--out FILE]
 *   (--arms bare,with-skill is accepted for old command lines; any other arm
 *   set is refused: there is no multi-arm matrix.)
 *
 * Every run executes in its own empty sandbox directory (or the shared --cwd),
 * so neither arm picks up this repo's CLAUDE.md/AGENTS.md and no run sees
 * another run's files. Skills that produce artifacts are graded on what they
 * actually wrote: files left in the sandbox are collected and, per the task's
 * grader `on` field ("answer" | "artifacts" | "either", default "either"),
 * graded instead of or alongside the chat answer. A run that only CLAIMS to
 * have written a file fails an artifacts grader.
 *
 * The default runner is `claude -p --output-format json` plus isolation flags
 * (`--setting-sources "" --strict-mcp-config --no-session-persistence`) for
 * BOTH arms, so neither arm loads the workstation's user/project settings,
 * rules, skills or MCP servers: the with-skill arm gets its skill only through
 * the prompt. HOME is left alone so the CLI keeps its credentials. A custom
 * --runner is used exactly as given. The default runner spends paid tokens:
 * it requires EVALS=1 (same contract as tier 1.5/2/3). An explicit --runner
 * (for example the hermetic fixture runner) needs no flag.
 *
 * A run whose runner crashed (non-zero exit, spawn error, or no result in its
 * output) is not evidence about the skill: it is left out of the arm's pass
 * rate and counted as `errors`. An arm with no successful run gets verdict
 * "error".
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { realpathSync as __svcRealpath } from "node:fs";
import { fileURLToPath as __svcToPath } from "node:url";
import { compareSamples } from "./outcome-eval.mjs";
// Real paths on both sides, so the entry runs through install symlinks; built-ins only,
// so a copied subset of files still loads.
const __svcIsMain = (url) => { try { return Boolean(process.argv[1]) && __svcRealpath(process.argv[1]) === __svcRealpath(__svcToPath(url)); } catch { return false; } };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ARMS = ["bare", "with-skill"];
/** Fewer finished runs per arm than this is no evidence at all. */
export const MIN_RUNS = 3;
/** Adopting a direction (earns-keep / regresses / no-gain) needs this many finished runs per arm and, for a difference, p < ALPHA. */
export const ADOPT_RUNS = 5;
export const ALPHA = 0.05;
export const DEFAULT_RUNNER = 'claude -p --output-format json --setting-sources "" --strict-mcp-config --no-session-persistence';

export function parseArgs(argv, env = process.env) {
  const o = { repeat: 5, margin: null, runner: null, only: null, json: false, out: null, tasks: null, cwd: null, arms: null, "check-stale": null, model: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") { o.json = true; continue; }
    if (a === "--help" || a === "-h") { o.help = true; continue; }
    if (!["--tasks", "--runner", "--repeat", "--margin", "--only", "--out", "--cwd", "--regrade", "--arms", "--check-stale", "--model"].includes(a)) throw new Error(`unknown option: ${a}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) throw new Error(`${a} requires a value`);
    o[a.slice(2)] = ["--repeat", "--margin"].includes(a) ? Number(v) : v;
  }
  if (o.help) return o;
  if (o.arms !== null && o.arms.split(",").map((x) => x.trim()).sort().join(",") !== [...ARMS].sort().join(",")) {
    throw new Error(`--arms: only the two arms ${ARMS.join(" and ")} exist (bare vs the skill with its whole folder); there is no multi-arm matrix`);
  }
  if (o["check-stale"]) {
    if (!o.model) throw new Error("--check-stale requires --model (the model id the evidence must have been served by)");
    return o;
  }
  if (!o.tasks) throw new Error("--tasks is required");
  if (!Number.isInteger(o.repeat) || o.repeat < 1 || o.repeat > 20) throw new Error("--repeat must be an integer 1..20");
  // A regrade keeps the margin its report was scored at unless --margin is given.
  if (o.margin === null && !o.regrade) o.margin = 0.15;
  if (o.margin !== null && !(o.margin >= 0 && o.margin < 1)) throw new Error("--margin must be in [0, 1)");
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

function skillDir(skill, root = ROOT) {
  const dir = path.join(root, "skills", skill);
  if (!fs.existsSync(path.join(dir, "SKILL.md"))) throw new Error(`unknown skill: ${skill}`);
  return dir;
}
function skillBody(skill) { return fs.readFileSync(path.join(skillDir(skill), "SKILL.md"), "utf8"); }

/** Where the with-skill arm finds the skill's whole folder, relative to the run sandbox. */
export const mountPath = (skill) => `.claude/skills/${skill}`;

const HASH_SKIP = new Set([".git", "node_modules", ".DS_Store"]);
/** sha256 over every file of the skill folder (relative path + content; symlinks by target), in a stable order. */
export function skillFolderHash(skill, root = ROOT) {
  const base = skillDir(skill, root);
  const h = crypto.createHash("sha256");
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (HASH_SKIP.has(e.name)) continue;
      const abs = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) h.update(`L ${r}\0${fs.readlinkSync(abs)}\0`);
      else if (e.isDirectory()) { h.update(`D ${r}\0`); walk(abs, r); }
      else if (e.isFile()) { const data = fs.readFileSync(abs); h.update(`F ${r}\0${data.length}\0`); h.update(data); h.update("\0"); }
    }
  };
  walk(base, "");
  return h.digest("hex");
}

/** Copy the whole skill folder into the run sandbox for the with-skill arm. Returns the mounted dir. */
export function mountSkill(cwd, skill) {
  const dest = path.join(cwd, mountPath(skill));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(skillDir(skill), dest, { recursive: true, filter: (src) => !HASH_SKIP.has(path.basename(src)) });
  return dest;
}

export function buildPrompt(task, arm) {
  if (!ARMS.includes(arm)) throw new Error(`unknown arm '${arm}': only ${ARMS.join(" and ")} exist`);
  if (arm === "bare") return task.prompt;
  return `Follow this skill for the task below. The skill's whole folder (references/, scripts/, templates/ ...) is available at ${mountPath(task.skill)}/ in the working directory; read from it when the skill points there.\n\n<skill name="${task.skill}">\n${skillBody(task.skill)}\n</skill>\n\nTask:\n${task.prompt}`;
}

/**
 * Extract answer text + usage from a runner's stdout (JSON envelope or plain text).
 * has_result is false when there is no answer at all: empty output, a JSON
 * envelope without result/text, or an envelope that reports is_error.
 */
export function parseRunnerOutput(stdout) {
  const text = String(stdout || "").trim();
  let j;
  try { j = JSON.parse(text); } catch { j = null; }
  if (!j || typeof j !== "object") return { answer: text, tokens: null, cost_usd: null, models: [], has_result: text.length > 0 };
  const field = typeof j.result === "string" ? j.result : typeof j.text === "string" ? j.text : null;
  const u = j.usage || {};
  const input = Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
  const output = Number(u.output_tokens || 0);
  const models = [...new Set([...Object.keys(j.modelUsage && typeof j.modelUsage === "object" ? j.modelUsage : {}), ...(typeof j.model === "string" && j.model ? [j.model] : [])])].sort();
  return { answer: field ?? text, tokens: input || output ? { input, output, total: input + output } : null, cost_usd: j.total_cost_usd ?? null, models,
    has_result: field !== null && j.is_error !== true };
}

/** A crashed run (runner failed or produced no result) is not evidence. Older reports lack `crashed`. */
export function isCrashed(r) { return r.crashed ?? r.exit !== 0; }

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

const wordCount = (text) => String(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Body of the first heading matching `heading` whose body has >= min_words words; text up to the next heading of the same or a higher level. */
function sectionOk(text, { heading, min_words = 1 }, flags) {
  const lines = text.split("\n"); const re = new RegExp(heading, flags);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m || !re.test(m[2])) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      const n = /^(#{1,6})\s/.exec(lines[j]);
      if (n && n[1].length <= m[1].length) break;
      body.push(lines[j]);
    }
    if (wordCount(body.join("\n")) >= min_words) return true;
  }
  return false;
}

export function grade(grader, answer, cwd = ROOT, artifacts = []) {
  if (!grader || !grader.type) throw new Error("task grader missing");
  answer = gradedText(grader, answer, artifacts);
  // An empty or whitespace-only answer has no substance for any grader to find.
  if (!String(answer).trim()) return false;
  if (grader.type === "regex") {
    answer = normalizeAnswer(answer);
    const flags = grader.flags ?? "im";
    const all = [].concat(grader.pattern);
    return all.every((p) => new RegExp(p, flags).test(answer)) &&
      ![].concat(grader.forbid || []).some((p) => new RegExp(p, flags).test(answer)) &&
      wordCount(answer) >= (grader.min_words ?? 0) &&
      (grader.sections || []).every((sec) => sectionOk(answer, sec, flags));
  }
  if (grader.type === "command") {
    const [bin, ...args] = grader.argv;
    return spawnSync(bin, args, { input: answer, cwd, encoding: "utf8", timeout: 60000 }).status === 0;
  }
  throw new Error(`unknown grader type: ${grader.type}`);
}

/**
 * Verdict from the finished pass/fail outcomes of the two arms (crashed runs already removed).
 * Returns { verdict, reason?, exploratory?, p? }. Incomplete evidence never recommends keep.
 */
export function decideVerdict(bare, skill, margin) {
  const nb = bare.length, ns = skill.length;
  const delta = skill.filter(Boolean).length / (ns || 1) - bare.filter(Boolean).length / (nb || 1);
  const direction = delta > margin ? "earns-keep" : delta < -margin ? "regresses" : "no-gain";
  if (nb < MIN_RUNS || ns < MIN_RUNS) {
    return { verdict: "inconclusive", reason: `needs at least ${MIN_RUNS} finished runs per arm (bare ${nb}, with-skill ${ns})` };
  }
  if (nb < ADOPT_RUNS || ns < ADOPT_RUNS) {
    return { verdict: "inconclusive", exploratory: direction, reason: `needs at least ${ADOPT_RUNS} finished runs per arm to adopt a verdict (bare ${nb}, with-skill ${ns}); point estimate only: ${direction}` };
  }
  const stats = compareSamples(skill.map(Number), bare.map(Number));
  const p = stats.p;
  if (direction === "no-gain") return { verdict: "no-gain", p };
  if (p < ALPHA) return { verdict: direction, p };
  return { verdict: "inconclusive", exploratory: direction, p, reason: `pass-rate delta ${delta.toFixed(2)} is not significant (permutation p ${p} >= ${ALPHA})` };
}

export function summarize(runs, margin) {
  const by = {};
  for (const r of runs) {
    if (!ARMS.includes(r.arm)) throw new Error(`unknown arm '${r.arm}': only ${ARMS.join(" and ")} exist`);
    ((by[r.task] ||= { skill: r.skill, bare: [], "with-skill": [] })[r.arm]).push(r);
  }
  const tasks = [];
  for (const [id, t] of Object.entries(by)) {
    const arm = (all) => {
      // Crashed runs are excluded from every rate and mean, and reported as errors.
      const xs = all.filter((x) => !isCrashed(x));
      const tok = xs.map((x) => x.tokens?.total).filter((n) => Number.isFinite(n));
      return { runs: xs.length, errors: all.length - xs.length, pass_rate: xs.filter((x) => x.pass).length / (xs.length || 1),
        mean_tokens: tok.length ? Math.round(tok.reduce((a, b) => a + b, 0) / tok.length) : null,
        mean_answer_chars: Math.round(xs.reduce((a, x) => a + x.answer_chars, 0) / (xs.length || 1)) };
    };
    const bare = arm(t.bare); const withSkill = arm(t["with-skill"]);
    const delta = withSkill.pass_rate - bare.pass_rate;
    // An arm whose runner never completed is a broken run, not evidence: it
    // must not read as "no-gain" (which would argue for retiring the skill).
    const finished = (xs) => xs.filter((x) => !isCrashed(x)).map((x) => Boolean(x.pass));
    const call = !finished(t.bare).length || !finished(t["with-skill"]).length ? { verdict: "error" } : decideVerdict(finished(t.bare), finished(t["with-skill"]), margin);
    // Evidence binding: what was measured. Hash and served models come from the runs themselves.
    const all = [...t.bare, ...t["with-skill"]];
    const hashes = [...new Set(all.map((x) => x.skill_hash).filter(Boolean))];
    const models = [...new Set(all.flatMap((x) => x.models || []))].sort();
    tasks.push({ task: id, skill: t.skill, bare, with_skill: withSkill, pass_delta: Number(delta.toFixed(3)),
      token_delta: bare.mean_tokens !== null && withSkill.mean_tokens !== null ? withSkill.mean_tokens - bare.mean_tokens : null, ...call,
      skill_hash: hashes.length === 1 ? hashes[0] : null, models });
  }
  return tasks;
}

/**
 * Is a verdict row still about the current skill and model? `current` = { skill_hash, model }.
 * Evidence that never recorded a hash or a served model cannot be shown fresh, so it is stale too.
 */
export function evidenceStatus(row, current) {
  const reasons = [];
  if (!row.skill_hash) reasons.push("no-hash"); else if (row.skill_hash !== current.skill_hash) reasons.push("skill-changed");
  const models = row.models || [];
  if (!models.length) reasons.push("model-unknown"); else if (models.length !== 1 || models[0] !== current.model) reasons.push("model-changed");
  return { stale: reasons.length > 0, reasons };
}

/** Stale check for a saved report against the skills in this checkout and the model id the evidence must match. */
export function checkStale(report, model, root = ROOT) {
  return report.tasks.map((t) => {
    let current = null;
    try { current = skillFolderHash(t.skill, root); } catch { /* skill removed: stale */ }
    const st = current === null ? { stale: true, reasons: ["skill-missing"] } : evidenceStatus(t, { skill_hash: current, model });
    return { task: t.task, skill: t.skill, verdict: t.verdict, ...st };
  });
}

/** Re-score stored runs with the task file's current graders (no runner calls). */
export function regrade(o) {
  const spec = JSON.parse(fs.readFileSync(o.tasks, "utf8"));
  const report = JSON.parse(fs.readFileSync(o.regrade, "utf8"));
  const byId = new Map(spec.tasks.map((t) => [t.id, t]));
  const runs = report.runs.map((r) => {
    const t = byId.get(r.task); if (!t) throw new Error(`report task '${r.task}' is not in ${o.tasks}`);
    if (typeof r.answer !== "string") throw new Error("report has no stored answers (made before answers were kept)");
    // Older reports kept only a prefix of each artifact. Grading a prefix could flip the
    // verdict, so such a run keeps its original grade and says why.
    const cut = (r.artifacts || []).filter((a) => Number.isFinite(a.chars) && a.text.length < a.chars).map((a) => a.path);
    if (cut.length) return { ...r, regrade_skipped: `artifact stored truncated: ${cut.join(", ")}` };
    return { ...r, pass: !isCrashed(r) && grade(t.grader, r.answer, ROOT, (r.artifacts || []).map((a) => ({ path: a.path, text: a.text }))) };
  });
  const margin = o.margin ?? report.margin ?? 0.15;
  return { ...report, regraded_from: o.regrade, margin, tasks: summarize(runs, margin), runs };
}

export function run(o) {
  const spec = JSON.parse(fs.readFileSync(o.tasks, "utf8"));
  const tasks = spec.tasks.filter((t) => !o.only || o.only.has(t.skill));
  if (!tasks.length) throw new Error("no tasks selected");
  const [bin, ...args] = splitArgv(o.runner);
  const runs = [];
  const hashes = new Map(); // skill -> folder hash, taken once before any run
  for (const task of tasks) if (!hashes.has(task.skill)) hashes.set(task.skill, skillFolderHash(task.skill));
  for (const task of tasks) {
    for (const arm of ARMS) {
      for (let i = 0; i < o.repeat; i++) {
        const cwd = o.cwd ? path.resolve(o.cwd) : fs.mkdtempSync(path.join(os.tmpdir(), "svc-ab-run-"));
        const mounted = arm === "with-skill" ? mountSkill(cwd, task.skill) : null;
        const r = spawnSync(bin, args, { input: buildPrompt(task, arm), cwd, encoding: "utf8",
          timeout: (spec.timeout_seconds || 600) * 1000, maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, SVC_AB_ARM: arm, SVC_AB_TASK: task.id } });
        const parsed = r.status === 0 ? parseRunnerOutput(r.stdout) : { answer: "", tokens: null, cost_usd: null, has_result: false };
        const crashed = r.status !== 0 || !parsed.has_result;
        const artifacts = collectArtifacts(cwd);
        if (!o.cwd) fs.rmSync(cwd, { recursive: true, force: true });
        else if (mounted) fs.rmSync(mounted, { recursive: true, force: true });
        runs.push({ task: task.id, skill: task.skill, arm, i, skill_hash: hashes.get(task.skill), models: parsed.models || [], exit: r.status, error: r.error?.code ?? null, signal: r.signal ?? null, crashed, pass: !crashed && grade(task.grader, parsed.answer, ROOT, artifacts),
          tokens: parsed.tokens, cost_usd: parsed.cost_usd, answer_chars: parsed.answer.length, answer: parsed.answer,
          artifacts: artifacts.map((a) => ({ path: a.path, chars: a.text.length, text: a.text })) });
      }
    }
  }
  return { runner: o.runner, arms: [...ARMS], repeat: o.repeat, margin: o.margin, min_runs: MIN_RUNS, adopt_runs: ADOPT_RUNS, alpha: ALPHA, tasks: summarize(runs, o.margin), runs };
}

if (__svcIsMain(import.meta.url)) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`skill-ab-eval: ${e.message}`); process.exit(2); }
  if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)[1]); process.exit(0); }
  if (o["check-stale"]) {
    try {
      const rows = checkStale(JSON.parse(fs.readFileSync(o["check-stale"], "utf8")), o.model);
      if (o.json) console.log(JSON.stringify(rows, null, 2));
      else for (const r of rows) console.log(`${r.stale ? "stale" : "fresh"}  ${r.skill.padEnd(22)} ${r.task}${r.stale ? `: ${r.reasons.join(", ")}` : ""}`);
      process.exit(rows.some((r) => r.stale) ? 1 : 0);
    } catch (e) { console.error(`skill-ab-eval: ${e.message}`); process.exit(2); }
  }
  try {
    const report = o.regrade ? regrade(o) : run(o);
    if (o.out) fs.writeFileSync(o.out, JSON.stringify(report, null, 2) + "\n");
    const broken = report.tasks.filter((t) => t.verdict === "error");
    if (broken.length) { process.exitCode = 1; const r0 = report.runs.find(isCrashed); console.error(`skill-ab-eval: runner failed for ${broken.map((t) => t.task).join(", ")} (first failure: exit ${r0?.exit} ${r0?.error || r0?.signal || (r0?.exit === 0 ? "no result" : "")}); no verdict for those tasks`); }
    if (o.json) console.log(JSON.stringify(report, null, 2));
    else for (const t of report.tasks) {
      console.log(`${t.verdict.padEnd(12)} ${t.skill.padEnd(22)} ${t.task}: pass ${t.bare.pass_rate.toFixed(2)} -> ${t.with_skill.pass_rate.toFixed(2)}` +
        (t.reason ? ` (${t.reason})` : "") +
        (t.token_delta === null ? "" : `, tokens ${t.token_delta >= 0 ? "+" : ""}${t.token_delta}`) +
        (t.bare.errors || t.with_skill.errors ? `, errors ${t.bare.errors}/${t.with_skill.errors}` : ""));
    }
  } catch (e) { console.error(`skill-ab-eval: ${e.message}`); process.exit(1); }
}
