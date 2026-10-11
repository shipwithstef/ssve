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
 *   expect_base "pass" (default) or "fail": what the check must do on the unmodified base.
 *              Rewrite, simplify, merge and remove variants keep behaviour, so the base must
 *              pass; a repair experiment starts red and sets "fail". Any other base result,
 *              or a check that crashes, times out or cannot start, stops the run with status
 *              "checker broken" before any worker starts: a broken checker condemns no one.
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
 * The check runs under the same sandbox and private home as the worker, because it executes
 * worker-produced code. Ownership is inspected after the worker and again after the check,
 * and the produced files are hashed into the result (result_hash). apply refuses a result
 * whose files no longer match, walks every destination path with lstat (no symlink
 * component), validates the whole result before the first write, and rolls back if a write
 * fails midway.
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
  const mk = (after) => {
    const changed = changedFiles(before, after);
    const outside = [...changed.filter((f) => !insideOwned(f, spec.owned)), ...escapingLinks(dir).map((f) => `${f} (link outside the copy)`)];
    // The starting hash of every changed file, so apply() can refuse to overwrite a file
    // that changed in the target after the probe started; files holds the produced content.
    const baseline = Object.fromEntries(changed.map((f) => [f, before[f] ?? null]));
    const files = Object.fromEntries(changed.map((f) => [f, after[f] ?? null]));
    return { changed, outside, baseline, files };
  };
  const meta = (m) => ({ variant: i + 1, dir, contained: Boolean(sandbox), sandbox: sandbox?.name ?? null, changed: m.changed, baseline: m.baseline, files: m.files, result_hash: resultHash(m, spec.owned), cost_usd: worker.cost_usd ?? null, worker_ms: Date.now() - t0, note: (worker.text || "").trim().split("\n").slice(-2).join(" ").slice(0, 400) });
  const m1 = mk(snapshot(dir));
  if (!worker.ok && m1.changed.length === 0) return { ...meta(m1), status: "worker_error", score: 0, reason: worker.error || worker.stop || "worker failed" };
  if (m1.outside.length) return { ...meta(m1), status: "out_of_bounds", score: 0, outside: m1.outside };
  // The check runs worker-produced code, so it runs where the worker ran; whatever it
  // writes is inspected again and is part of the bound result.
  const r = runCheck(spec, dir, home, sandbox);
  const out = `${r.stdout || ""}`;
  const m2 = mk(snapshot(dir));
  if (m2.outside.length) return { ...meta(m2), status: "out_of_bounds", score: 0, outside: m2.outside, outside_phase: "check" };
  return { ...meta(m2), status: r.status === 0 ? "pass" : "fail", score: score(r.status, out), check_contained: Boolean(sandbox), check_tail: `${out}\n${r.stderr || ""}`.trim().slice(-600) };
}

// The check command in dir, inside the sandbox when there is one, with the private home.
function runCheck(spec, dir, home, sandbox) {
  const cmd = sandbox ? `${sandbox.prefix} sh -c ${shq(spec.check)}` : spec.check;
  return spawnSync("sh", ["-c", cmd], { cwd: dir, encoding: "utf8", timeout: (spec.check_timeout_s ?? 300) * 1000, env: { ...process.env, PROBE_DIR: dir, PROBE_HOME: home, HOME: home } });
}

// Why a check run on the unmodified base proves the checker unusable, or null when it is
// sound: it started, finished, and did what expect_base says.
export function baseCheckProblem(r, expect = "pass") {
  if (r.error) return `the check could not run to completion (${r.error.code || r.error.message})`;
  if (r.signal) return `the check was killed by ${r.signal}`;
  if (r.status === 126 || r.status === 127) return `the check command could not start (exit ${r.status})`;
  if (r.status >= 128 && r.status <= 159) return `the check crashed (exit ${r.status})`;
  if (expect === "fail" && r.status === 0) return "the check passes on the unmodified base but a failing base was expected (expect_base: fail)";
  if (expect !== "fail" && r.status !== 0) return `the check fails on the unmodified base (exit ${r.status}); if the base is meant to start red, set expect_base: "fail"`;
  return null;
}

// Canonical digest of what a variant produced: the changed paths, where each started, the
// hash of what it produced, and the ownership it was held to.
export function resultHash(v, owned) {
  const sorted = (o) => Object.keys(o).sort().map((k) => [k, o[k]]);
  return crypto.createHash("sha256").update(JSON.stringify({ changed: [...v.changed].sort(), baseline: sorted(v.baseline), files: sorted(v.files), owned: [...owned].sort() })).digest("hex");
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
  // The checker is proven on an unmodified copy before any worker starts. A checker that
  // is broken would fail every variant for the wrong reason; the run stops instead.
  const baseDir = path.join(root, "base-check");
  copyBase(spec.base, baseDir);
  const baseHome = fs.mkdtempSync(path.join(root, "home-base-"));
  const baseRun = runCheck(spec, baseDir, baseHome, sandbox);
  const problem = baseCheckProblem(baseRun, spec.expect_base);
  if (problem) {
    const touchedBase = changedFiles(original, snapshot(spec.base));
    if (touchedBase.length) throw new Error(`the check changed the original project: ${touchedBase.join(", ")}`);
    return {
      question: spec.question, check: spec.check, owned: spec.owned, status: "checker broken", reason: problem,
      base_check: { exit: baseRun.status, signal: baseRun.signal ?? null, tail: `${baseRun.stdout || ""}\n${baseRun.stderr || ""}`.trim().slice(-600) },
      sandbox: sandbox?.name ?? null, contained: Boolean(sandbox), lanes: 0, wall_ms: Date.now() - t0, cost_usd: 0, passed: 0,
      variants: Array.from({ length: spec.variants }, (_, i) => ({ variant: i + 1, status: "skipped", reason: "checker broken" })),
      ranking: [], winner: null, work_dir: root,
    };
  }
  const variants = await pool(Array.from({ length: spec.variants }, (_, i) => i), n, (i) => runVariant(spec, i, root, spent, sandbox));
  const touched = changedFiles(original, snapshot(spec.base));
  if (touched.length) throw new Error(`a worker changed the original project: ${touched.join(", ")}`);
  const ranking = rank(variants);
  const winner = variants.find((v) => v.variant === ranking[0] && v.status === "pass") || null;
  return {
    status: "complete", question: spec.question, check: spec.check, owned: spec.owned, model: spec.worker_cmd ? "worker_cmd" : spec.model ?? "haiku",
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

const relProblem = (f) => typeof f !== "string" || !f || path.isAbsolute(f) || f.includes("\0") || f.split("/").some((seg) => seg === "" || seg === "." || seg === ".." || SKIP.has(seg));

// Walk the directories above rel under root with lstat, never following a link. Returns a
// reason when a component is a symlink (escaping or not) or not a directory; a component
// that does not exist yet ends the walk cleanly (it will be created, below real
// directories only).
function ancestorProblem(root, rel) {
  const parts = rel.split("/").slice(0, -1);
  let cur = root;
  for (const seg of parts) {
    cur = path.join(cur, seg);
    let st;
    try { st = fs.lstatSync(cur); } catch (e) { if (e.code === "ENOENT") return null; return `${path.relative(root, cur)} (${e.code})`; }
    if (st.isSymbolicLink()) return `${path.relative(root, cur)} is a symlink`;
    if (!st.isDirectory()) return `${path.relative(root, cur)} is not a directory`;
  }
  return null;
}

// The whole result is validated before the first write, and a write that still fails
// midway is rolled back, so a result lands completely or not at all. Validation:
//   - the result carries its hashes and they match (result_hash, then every produced file
//     in the work dir against its recorded hash): a tampered result or file is refused;
//   - every path is relative, inside the target and the owned set, outside .git and
//     node_modules;
//   - no directory above a destination is a symlink (lstat walk, never realpath-then-trust)
//     and a produced link must resolve inside the target;
//   - every destination still holds the content the probe started from (else stale).
// options.onWrite (tests only) is called after each file is written.
export function apply(result, to, { onWrite } = {}) {
  const w = result.variants.find((v) => v.variant === result.winner);
  if (!w) throw new Error("no passing variant to apply");
  if (!w.files || !w.baseline || !w.result_hash) throw new Error("unbound result: it has no recorded file hashes; run the probe again");
  const root = path.resolve(to);
  let rootSt; try { rootSt = fs.statSync(root); } catch { rootSt = null; }
  if (!rootSt?.isDirectory()) throw new Error(`target is not a directory: ${to}`);
  const tampered = [], escaping = [], stale = [];
  if (resultHash(w, result.owned ?? []) !== w.result_hash) tampered.push("result record (changed/baseline/files/owned)");
  const plan = [];
  for (const f of w.changed) {
    if (relProblem(f)) { escaping.push(`${f} (not a plain relative path)`); continue; }
    if (!insideOwned(f, result.owned ?? [])) { tampered.push(`${f} (not in the owned set)`); continue; }
    const src = path.join(w.dir, f), dst = path.join(root, f);
    if (!Object.hasOwn(w.files, f) || !Object.hasOwn(w.baseline, f)) { tampered.push(`${f} (no recorded hash)`); continue; }
    if (ancestorProblem(w.dir, f) || hashOf(src) !== w.files[f]) { tampered.push(f); continue; }
    const why = ancestorProblem(root, f);
    if (why) { escaping.push(`${f} (${why})`); continue; }
    let dstSt = null; try { dstSt = fs.lstatSync(dst); } catch {}
    if (dstSt?.isDirectory()) { escaping.push(`${f} (destination is a directory)`); continue; }
    const want = w.files[f];
    if (want?.startsWith("link:") && path.resolve(path.dirname(dst), want.slice(5)) !== root && !path.resolve(path.dirname(dst), want.slice(5)).startsWith(root + path.sep)) { escaping.push(`${f} (link leaves the target)`); continue; }
    if (hashOf(dst) !== w.baseline[f]) stale.push(f);
    plan.push({ f, src, dst, want });
  }
  if (tampered.length) throw new Error(`result does not match its recorded hashes: ${tampered.join(", ")}`);
  if (escaping.length) throw new Error(`refusing to write outside the target: ${escaping.join(", ")}`);
  if (stale.length) throw new Error(`stale result: changed in the target since the probe started: ${stale.join(", ")}`);
  const undo = [];
  try {
    for (const { f, src, dst, want } of plan) {
      let prev = null; try { const st = fs.lstatSync(dst); prev = st.isSymbolicLink() ? { link: fs.readlinkSync(dst) } : { data: fs.readFileSync(dst), mode: st.mode }; } catch {}
      let top = null; for (let d = path.dirname(dst); d !== root && !fs.existsSync(d); d = path.dirname(d)) top = d;
      if (top) { fs.mkdirSync(path.dirname(dst), { recursive: true }); undo.push(() => fs.rmSync(top, { recursive: true, force: true })); }
      undo.push(() => { fs.rmSync(dst, { force: true }); if (prev?.link != null) fs.symlinkSync(prev.link, dst); else if (prev) fs.writeFileSync(dst, prev.data, { mode: prev.mode }); });
      // unlink first: copying onto an existing link would write through it
      fs.rmSync(dst, { force: true });
      if (want === null) { onWrite?.(f); continue; }
      if (want.startsWith("link:")) fs.symlinkSync(fs.readlinkSync(src), dst);
      else fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL);
      onWrite?.(f);
    }
  } catch (e) {
    for (const u of undo.reverse()) { try { u(); } catch {} }
    throw new Error(`apply failed and was rolled back: ${e.message}`);
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
    if (result.status === "checker broken") { process.stderr.write(`probe-loop: checker broken: ${result.reason}; no variant was run or judged\n`); return 3; }
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
