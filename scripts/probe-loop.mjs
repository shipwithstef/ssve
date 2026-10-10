#!/usr/bin/env node
/**
 * probe-loop.mjs — settle one open question by trying many cheap variants against a check.
 *
 *   node scripts/probe-loop.mjs run --spec <spec.json> [--out <result.json>]
 *   node scripts/probe-loop.mjs apply --result <result.json> --to <dir>
 *
 * Each variant gets its own copy of the base directory and one worker (a cheap model by
 * default). The worker may change only the owned paths; a write anywhere else fails the
 * variant. The question's check command then runs in the copy, and the variants are
 * ranked: passing first, then by score, then by cost. The lead applies the winner and
 * records the losers' notes in the brief's decision log.
 *
 * This is the generate-and-select loop of FunSearch/AlphaEvolve with a deterministic
 * evaluator: more variants per minute, a check that catches real defects, and an
 * outcome-based pick (docs/decisions/2026-10-10-bounded-delivery.md).
 *
 * Spec (JSON):
 *   question   what the variants settle (shown to workers and recorded)
 *   base       directory copied for each variant (node_modules is linked, .git skipped)
 *   prompt     the task for each worker
 *   owned      paths the workers may change (relative to base); [] means none
 *   check      shell command run in each variant; exit 0 passes. If it prints TAP the
 *              score is the pass share; a last stdout line {"score": n} overrides it.
 *   variants   how many to try (default 4)
 *   hints      optional per-variant approach hints, to spread the search
 *   model, effort, max_turns, timeout_s, tools   worker settings (default haiku, 25 turns,
 *              600 s, outcome-eval's tool list)
 *   budget_usd stop starting new variants once spent cost reaches this
 *   worker_cmd optional shell command instead of the Claude worker (another harness, or
 *              a test double); it runs in the variant directory with PROBE_VARIANT set
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { isMain } from "./lib/is-main.mjs";
import { maxParallel } from "./lib/parallelism.mjs";
import { norm, unsafeScope } from "./lib/disjoint-scopes.mjs";
import { parseTap, pool, runAgent } from "./outcome-eval.mjs";

const SKIP = new Set([".git", "node_modules"]);

// path → sha256 for every file under dir, skipping .git and node_modules.
export function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out[r] = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, r))).digest("hex");
    }
  };
  walk("");
  return out;
}

export function changedFiles(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => before[k] !== after[k]).sort();
}

// True when file sits inside one of the owned scopes. An unsafe scope ("", ".", "..")
// owns nothing: ownership must be explicit.
export function insideOwned(file, owned) {
  const f = norm(file);
  return owned.some((s) => { const o = norm(s); return !unsafeScope(o) && (f === o || f.startsWith(`${o}/`)); });
}

export function score(code, stdout) {
  const last = stdout.trim().split("\n").pop() || "";
  try { const j = JSON.parse(last); if (Number.isFinite(j.score)) return j.score; } catch {}
  const t = parseTap(stdout);
  if (t && t.pass + t.fail > 0) return t.pass / (t.pass + t.fail);
  return code === 0 ? 1 : 0;
}

// Passing first, then higher score, then lower cost. Failed or out-of-bounds variants
// never outrank a passing one.
export function rank(variants) {
  const order = { pass: 0, fail: 1, out_of_bounds: 2, worker_error: 3, skipped: 4 };
  return [...variants].sort((a, b) => order[a.status] - order[b.status] || (b.score ?? 0) - (a.score ?? 0) || (a.cost_usd ?? 0) - (b.cost_usd ?? 0)).map((v) => v.variant);
}

function copyBase(base, dir) {
  fs.cpSync(base, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) || src === base });
  const nm = path.join(base, "node_modules");
  if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(dir, "node_modules"), "dir");
}

function workerPrompt(spec, i) {
  const hint = spec.hints?.[i] ? `\nApproach for this variant: ${spec.hints[i]}` : spec.variants > 1 ? `\nThis is variant ${i + 1} of ${spec.variants}; others try the same task, so a different sound approach is welcome.` : "";
  const owned = spec.owned.length ? `You may change only these paths: ${spec.owned.join(", ")}. A change anywhere else fails this attempt.` : "Do not change any files; report what you found.";
  return `${spec.prompt}\n\nQuestion this settles: ${spec.question}\n${owned}\nThe result is judged by running: ${spec.check}${hint}\nEnd with two lines: what you did, and what you learned that the lead should know.`;
}

async function runVariant(spec, i, root, spent) {
  const dir = path.join(root, `v${i + 1}`);
  if (spec.budget_usd != null && spent.usd >= spec.budget_usd) return { variant: i + 1, status: "skipped", reason: "budget reached" };
  copyBase(spec.base, dir);
  const before = snapshot(dir);
  const t0 = Date.now();
  let worker;
  if (spec.worker_cmd) {
    const r = spawnSync("sh", ["-c", spec.worker_cmd], { cwd: dir, encoding: "utf8", timeout: (spec.timeout_s ?? 600) * 1000, env: { ...process.env, PROBE_VARIANT: String(i + 1) } });
    worker = { ok: r.status === 0, cost_usd: 0, text: (r.stdout || "").slice(-400) };
  } else {
    // A worker edits a throwaway copy with no .git; the ownership fence is checked after
    // it finishes and the lead applies the winner inside the governed repo, where every
    // hook runs. So workers start without user or project settings: no hook start-up on
    // each of their tool calls (the same isolation flags as harness-transports.mjs).
    const isolated = ["--setting-sources", "", "--strict-mcp-config", "--no-session-persistence"];
    worker = await runAgent(dir, workerPrompt(spec, i), spec.model ?? "haiku", (spec.timeout_s ?? 600) * 1000, spec.tools, spec.max_turns ?? 25, spec.effort ?? null, isolated);
  }
  spent.usd += worker.cost_usd ?? 0;
  const changed = changedFiles(before, snapshot(dir));
  const outside = changed.filter((f) => !insideOwned(f, spec.owned));
  const base = { variant: i + 1, dir, changed, cost_usd: worker.cost_usd ?? null, worker_ms: Date.now() - t0, note: (worker.text || "").trim().split("\n").slice(-2).join(" ").slice(0, 400) };
  if (!worker.ok && changed.length === 0) return { ...base, status: "worker_error", score: 0, reason: worker.error || worker.stop || "worker failed" };
  if (outside.length) return { ...base, status: "out_of_bounds", score: 0, outside };
  const r = spawnSync("sh", ["-c", spec.check], { cwd: dir, encoding: "utf8", timeout: (spec.check_timeout_s ?? 300) * 1000 });
  const out = `${r.stdout || ""}`;
  return { ...base, status: r.status === 0 ? "pass" : "fail", score: score(r.status, out), check_tail: `${out}\n${r.stderr || ""}`.trim().slice(-600) };
}

export async function run(spec, { lanes } = {}) {
  spec = { variants: 4, owned: [], ...spec, base: path.resolve(spec.base) };
  for (const k of ["question", "base", "prompt", "check"]) if (!spec[k]) throw new Error(`spec.${k} is required`);
  const cap = lanes ?? maxParallel({ plan: process.env.SVC_PLAN, override: process.env.SVC_MAX_PARALLEL });
  const n = Math.max(1, Math.min(spec.variants, cap.max_parallel));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "probe-"));
  const spent = { usd: 0 };
  const t0 = Date.now();
  const variants = await pool(Array.from({ length: spec.variants }, (_, i) => i), n, (i) => runVariant(spec, i, root, spent));
  const ranking = rank(variants);
  const winner = variants.find((v) => v.variant === ranking[0] && v.status === "pass") || null;
  return {
    question: spec.question, check: spec.check, owned: spec.owned, model: spec.worker_cmd ? "worker_cmd" : spec.model ?? "haiku",
    lanes: n, lanes_why: cap.why, wall_ms: Date.now() - t0, cost_usd: Math.round(spent.usd * 10000) / 10000,
    passed: variants.filter((v) => v.status === "pass").length, variants, ranking, winner: winner?.variant ?? null, work_dir: root,
  };
}

// Copy the winner's changed files into the target and remove the ones it deleted.
export function apply(result, to) {
  const w = result.variants.find((v) => v.variant === result.winner);
  if (!w) throw new Error("no passing variant to apply");
  for (const f of w.changed) {
    const src = path.join(w.dir, f);
    const dst = path.join(to, f);
    if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
    else fs.rmSync(dst, { force: true });
  }
  return w.changed;
}

const arg = (argv, name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };

async function main(argv) {
  const cmd = argv[0];
  if (cmd === "run") {
    const spec = JSON.parse(fs.readFileSync(arg(argv, "--spec"), "utf8"));
    const result = await run(spec);
    const text = JSON.stringify(result, null, 2) + "\n";
    if (arg(argv, "--out")) fs.writeFileSync(arg(argv, "--out"), text); else process.stdout.write(text);
    process.stderr.write(`probe-loop: ${result.passed}/${result.variants.length} passed in ${Math.round(result.wall_ms / 1000)} s on ${result.lanes} lanes, $${result.cost_usd}; winner ${result.winner ?? "none"}\n`);
    return result.winner ? 0 : 1;
  }
  if (cmd === "apply") {
    const result = JSON.parse(fs.readFileSync(arg(argv, "--result"), "utf8"));
    process.stdout.write(apply(result, arg(argv, "--to")).join("\n") + "\n");
    return 0;
  }
  process.stderr.write("usage: probe-loop.mjs run --spec <json> [--out <json>] | apply --result <json> --to <dir>\n");
  return 2;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`probe-loop: ${e.message}\n`); process.exit(2); });
