#!/usr/bin/env node
/**
 * probe-loop.mjs — settle one open question by trying many cheap variants against a check.
 *
 *   node scripts/probe-loop.mjs run --spec <spec.json> [--out <result.json>]
 *   node scripts/probe-loop.mjs apply --result <result.json> --to <dir>
 *   node scripts/probe-loop.mjs sandbox-check          (can this host contain workers?)
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
 *              and HOME pointed at a private, throwaway home
 *   sandbox_cmd optional shell prefix for an OS sandbox of your own; it sees $PROBE_DIR (the
 *              variant, its only writable place) and $PROBE_HOME (the private home)
 *
 * Containment. Model workers run only inside an OS sandbox whose writable places are the
 * variant copy and a private home: bubblewrap by default (read-only root, private /tmp),
 * or sandbox_cmd. Every sandbox must pass a live probe first (a write inside the variant
 * succeeds; writes to another temp dir and to the real home fail); one that does not
 * confine is refused. With no sandbox, model workers do not run (exit 2; install
 * bubblewrap, and check with sandbox-check). A worker_cmd is the caller's own command: it
 * gets the sandbox when there is one, and otherwise runs with contained: false recorded.
 * On top of that, each variant is a copy with real files (no links back to the source),
 * a new link pointing outside the copy fails the variant, and the original project is
 * fingerprinted before and after: any change aborts the run.
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

// Single-quote a string for sh.
const shq = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`;

// Read-only root, private /tmp, and only the variant and its private home writable. The
// empty /sys/fs/cgroup lets the Claude CLI start Bash commands without touching host cgroups.
export const BWRAP = 'bwrap --ro-bind / / --tmpfs /tmp --bind "$PROBE_DIR" "$PROBE_DIR" --bind "$PROBE_HOME" "$PROBE_HOME" --tmpfs /sys/fs/cgroup --dev /dev --proc /proc --unshare-pid --die-with-parent --';

export function hasBwrap() {
  return spawnSync("sh", ["-c", "command -v bwrap"], { encoding: "utf8" }).status === 0;
}

// Live proof that a sandbox prefix confines: inside it, a write to the variant succeeds
// and writes to another temp dir and to the real home fail.
export function confines(prefix) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "probe-sbx-"));
  const dir = path.join(work, "variant");
  const home = path.join(work, "home");
  fs.mkdirSync(dir); fs.mkdirSync(home);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-out-"));
  const outTmp = path.join(outDir, "escape");
  const outHome = path.join(os.homedir(), `.probe-loop-escape-${process.pid}-${Date.now()}`);
  const inner = 'touch "$PROBE_DIR/in"; touch "$OUT_TMP" 2>/dev/null; touch "$OUT_HOME" 2>/dev/null; true';
  const r = spawnSync("sh", ["-c", `${prefix} sh -c ${shq(inner)}`], { encoding: "utf8", timeout: 30000, env: { ...process.env, PROBE_DIR: dir, PROBE_HOME: home, OUT_TMP: outTmp, OUT_HOME: outHome } });
  const inside = fs.existsSync(path.join(dir, "in")), escapedTmp = fs.existsSync(outTmp), escapedHome = fs.existsSync(outHome);
  fs.rmSync(outHome, { force: true }); fs.rmSync(outDir, { recursive: true, force: true }); fs.rmSync(work, { recursive: true, force: true });
  return { contained: inside && !escapedTmp && !escapedHome, inside, escaped_tmp: escapedTmp, escaped_home: escapedHome, stderr: (r.stderr || "").trim().slice(-300) };
}

// The sandbox for this run: sandbox_cmd if given (refused when it does not confine),
// else bubblewrap when installed and working, else none.
export function resolveSandbox(spec, { which = hasBwrap, probe = confines } = {}) {
  if (spec.sandbox_cmd) {
    const p = probe(spec.sandbox_cmd);
    if (!p.contained) throw new Error(`sandbox_cmd does not confine writes (inside ${p.inside}, escaped tmp ${p.escaped_tmp}, escaped home ${p.escaped_home})`);
    return { name: "custom", prefix: spec.sandbox_cmd };
  }
  if (which() && probe(BWRAP).contained) return { name: "bwrap", prefix: BWRAP };
  return null;
}

// path → sha256 for every file under dir, skipping .git and node_modules.
export function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) out[r] = `link:${fs.readlinkSync(path.join(dir, r))}`;
      else if (e.isDirectory()) walk(r);
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

// Each variant gets real files: links are dereferenced and dependencies are copied, so
// nothing in the copy points back into the source and a worker cannot write through it.
function copyBase(base, dir) {
  fs.cpSync(base, dir, { recursive: true, dereference: true, filter: (src) => !SKIP.has(path.basename(src)) || src === base });
  const nm = path.join(base, "node_modules");
  if (fs.existsSync(nm)) fs.cpSync(nm, path.join(dir, "node_modules"), { recursive: true, dereference: true });
}

// Symlinks a worker created that resolve outside its own copy.
export function escapingLinks(dir) {
  const root = fs.realpathSync(dir);
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) {
        const target = path.resolve(path.dirname(path.join(root, r)), fs.readlinkSync(path.join(dir, r)));
        if (target !== root && !target.startsWith(root + path.sep)) out.push(r);
      } else if (e.isDirectory()) walk(r);
    }
  };
  walk("");
  return out;
}

function workerPrompt(spec, i) {
  const hint = spec.hints?.[i] ? `\nApproach for this variant: ${spec.hints[i]}` : spec.variants > 1 ? `\nThis is variant ${i + 1} of ${spec.variants}; others try the same task, so a different sound approach is welcome.` : "";
  const owned = spec.owned.length ? `You may change only these paths: ${spec.owned.join(", ")}. A change anywhere else fails this attempt.` : "Do not change any files; report what you found.";
  return `${spec.prompt}\n\nQuestion this settles: ${spec.question}\n${owned}\nThe result is judged by running: ${spec.check}${hint}\nEnd with two lines: what you did, and what you learned that the lead should know.`;
}

async function runVariant(spec, i, root, spent, sandbox) {
  const dir = path.join(root, `v${i + 1}`);
  if (spec.budget_usd != null && spent.usd >= spec.budget_usd) return { variant: i + 1, status: "skipped", reason: "budget reached" };
  copyBase(spec.base, dir);
  const before = snapshot(dir);
  const t0 = Date.now();
  let worker;
  const home = fs.mkdtempSync(path.join(root, `home${i + 1}-`));
  const sandboxEnv = { PROBE_DIR: dir, PROBE_HOME: home };
  if (spec.worker_cmd) {
    const cmd = sandbox ? `${sandbox.prefix} sh -c ${shq(spec.worker_cmd)}` : spec.worker_cmd;
    const r = spawnSync("sh", ["-c", cmd], { cwd: dir, encoding: "utf8", timeout: (spec.timeout_s ?? 600) * 1000, env: { ...process.env, ...sandboxEnv, PROBE_VARIANT: String(i + 1), HOME: home } });
    worker = { ok: r.status === 0, cost_usd: 0, text: (r.stdout || "").slice(-400) };
  } else {
    // A worker edits a throwaway copy with no .git; the ownership fence is checked after
    // it finishes and the lead applies the winner inside the governed repo, where every
    // hook runs. So workers start without user or project settings: no hook start-up on
    // each of their tool calls (the same isolation flags as harness-transports.mjs).
    const isolated = ["--setting-sources", "", "--strict-mcp-config", "--no-session-persistence"];
    worker = await runAgent(dir, workerPrompt(spec, i), spec.model ?? "haiku", (spec.timeout_s ?? 600) * 1000, spec.tools, spec.max_turns ?? 25, spec.effort ?? null, isolated, { prefix: sandbox.prefix, env: sandboxEnv });
  }
  spent.usd += worker.cost_usd ?? 0;
  const changed = changedFiles(before, snapshot(dir));
  const outside = [...changed.filter((f) => !insideOwned(f, spec.owned)), ...escapingLinks(dir).map((f) => `${f} (link outside the copy)`)];
  // The starting hash of every changed file, so apply() can refuse to overwrite a file
  // that changed in the target after the probe started.
  const baseline = Object.fromEntries(changed.map((f) => [f, before[f] ?? null]));
  const base = { variant: i + 1, dir, contained: Boolean(sandbox), sandbox: sandbox?.name ?? null, changed, baseline, cost_usd: worker.cost_usd ?? null, worker_ms: Date.now() - t0, note: (worker.text || "").trim().split("\n").slice(-2).join(" ").slice(0, 400) };
  if (!worker.ok && changed.length === 0) return { ...base, status: "worker_error", score: 0, reason: worker.error || worker.stop || "worker failed" };
  if (outside.length) return { ...base, status: "out_of_bounds", score: 0, outside };
  const r = spawnSync("sh", ["-c", spec.check], { cwd: dir, encoding: "utf8", timeout: (spec.check_timeout_s ?? 300) * 1000 });
  const out = `${r.stdout || ""}`;
  return { ...base, status: r.status === 0 ? "pass" : "fail", score: score(r.status, out), check_tail: `${out}\n${r.stderr || ""}`.trim().slice(-600) };
}

// options.sandbox (programmatic only, for tests): a resolved sandbox, or null for none.
export async function run(spec, { lanes, sandbox } = {}) {
  spec = { variants: 4, owned: [], ...spec, base: path.resolve(spec.base) };
  for (const k of ["question", "base", "prompt", "check"]) if (!spec[k]) throw new Error(`spec.${k} is required`);
  if (sandbox === undefined) sandbox = resolveSandbox(spec);
  if (!sandbox && !spec.worker_cmd) throw new Error("model workers run only inside a sandbox: install bubblewrap (apt install bubblewrap) or give sandbox_cmd; check this host with probe-loop.mjs sandbox-check");
  const cap = lanes ?? maxParallel({ plan: process.env.SVC_PLAN, override: process.env.SVC_MAX_PARALLEL });
  const n = Math.max(1, Math.min(spec.variants, cap.max_parallel));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "probe-"));
  const spent = { usd: 0 };
  const t0 = Date.now();
  // Workers must never touch the original project. Its fingerprint is taken before and
  // after; any difference aborts the run rather than reporting variants as clean.
  const original = snapshot(spec.base);
  const variants = await pool(Array.from({ length: spec.variants }, (_, i) => i), n, (i) => runVariant(spec, i, root, spent, sandbox));
  const touched = changedFiles(original, snapshot(spec.base));
  if (touched.length) throw new Error(`a worker changed the original project: ${touched.join(", ")}`);
  const ranking = rank(variants);
  const winner = variants.find((v) => v.variant === ranking[0] && v.status === "pass") || null;
  return {
    question: spec.question, check: spec.check, owned: spec.owned, model: spec.worker_cmd ? "worker_cmd" : spec.model ?? "haiku",
    sandbox: sandbox?.name ?? null, contained: Boolean(sandbox), lanes: n, lanes_why: cap.why, wall_ms: Date.now() - t0, cost_usd: Math.round(spent.usd * 10000) / 10000,
    passed: variants.filter((v) => v.status === "pass").length, variants, ranking, winner: winner?.variant ?? null, work_dir: root,
  };
}

// Copy the winner's changed files into the target and remove the ones it deleted.
const hashOf = (file) => {
  try {
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink()) return `link:${fs.readlinkSync(file)}`;
    return st.isFile() ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") : null;
  } catch { return null; }
};

// Every destination is checked before anything is written: it must stay inside the
// target and still hold the content the probe started from. A file changed since (by the
// owner or another stream) makes the whole result stale; nothing is written.
export function apply(result, to) {
  const w = result.variants.find((v) => v.variant === result.winner);
  if (!w) throw new Error("no passing variant to apply");
  const root = path.resolve(to);
  const stale = [];
  for (const f of w.changed) {
    const dst = path.resolve(root, f);
    if (dst !== root && !dst.startsWith(root + path.sep)) throw new Error(`refusing to write outside the target: ${f}`);
    if (w.baseline && Object.hasOwn(w.baseline, f) && hashOf(dst) !== w.baseline[f]) stale.push(f);
  }
  if (stale.length) throw new Error(`stale result: changed in the target since the probe started: ${stale.join(", ")}`);
  for (const f of w.changed) {
    const src = path.join(w.dir, f);
    const dst = path.join(to, f);
    // lstat, not existsSync: a link (even one whose target is missing) is applied as a link,
    // and only a path that is really gone in the winner is removed from the target.
    let st = null; try { st = fs.lstatSync(src); } catch {}
    if (!st) { fs.rmSync(dst, { force: true }); continue; }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (st.isSymbolicLink()) { fs.rmSync(dst, { force: true }); fs.symlinkSync(fs.readlinkSync(src), dst); }
    else fs.copyFileSync(src, dst);
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
  if (cmd === "sandbox-check") {
    const bwrap = hasBwrap();
    const probe = bwrap ? confines(BWRAP) : null;
    process.stdout.write(JSON.stringify({ bwrap_found: bwrap, contained: Boolean(probe?.contained), probe }, null, 2) + "\n");
    if (!probe?.contained) process.stderr.write("probe-loop: this host cannot contain model workers; install bubblewrap (apt install bubblewrap) with unprivileged user namespaces enabled, or pass sandbox_cmd\n");
    return probe?.contained ? 0 : 1;
  }
  process.stderr.write("usage: probe-loop.mjs run --spec <json> [--out <json>] | apply --result <json> --to <dir> | sandbox-check\n");
  return 2;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`probe-loop: ${e.message}\n`); process.exit(2); });
