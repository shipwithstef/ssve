#!/usr/bin/env node
/**
 * quality-probes.mjs — measure a build on the dimensions that hidden tests do not see.
 *
 *   node scripts/quality-probes.mjs <dir> [--mutants 30]     # one build, JSON to stdout
 *   node scripts/quality-probes.mjs --results <results.json> # every kept artifact in a results file
 *
 * Deterministic probes only (a judge covers taste separately):
 *   tests     the build's own tests: do they pass, how many, how many assertions, and how
 *             many are trivial (assert.ok(true)) or skipped.
 *   mutation  test strength: small seeded mutations of the source (flipped comparisons,
 *             operators, booleans, off-by-one constants); the share the build's own tests
 *             catch. A suite that passes whatever the code does scores near 0.
 *   size      source and test lines, files, dependencies, duplicated lines: the raw
 *             material of an over-engineering comparison between arms on the same task.
 *   slop      TODO/placeholder text, swallowed errors (empty catch), console logging in
 *             source, exports nothing uses (dead code).
 *   secrets   credentials written into source.
 * Each probe reports numbers, never a verdict: thresholds live in
 * references/quality-dimensions.json and comparisons happen between arms.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { isMain } from "./lib/is-main.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", "data", "coverage", "dist", "build"]);
const CODE = /\.(mjs|cjs|js|ts)$/;
const isTestFile = (rel) => /(^|\/)(test|tests|__tests__)\//.test(rel) || /[._-]test\.(m|c)?[jt]s$/.test(rel) || /(^|\/)test[^/]*\.(m|c)?js$/.test(rel);
// Client bundles and helper scripts are not reached by node tests; mutating them would
// measure nothing about the suite.
const isServerSource = (rel) => !isTestFile(rel) && !/(^|\/)(public|static|assets|scripts)\//.test(rel) && !rel.startsWith("__");

export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") && e.name !== ".") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); }
      else out.push(path.relative(dir, p).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

const codeLines = (text) => text.split("\n").filter((l) => { const t = l.trim(); return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); });

export function sizeAndSlop(dir) {
  const files = listFiles(dir).filter((f) => CODE.test(f) && !f.startsWith("__"));
  const src = files.filter((f) => !isTestFile(f));
  const tests = files.filter(isTestFile);
  const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
  const srcText = src.map(read);
  const allText = files.map(read).join("\n");
  const srcLines = srcText.flatMap(codeLines);
  const comments = srcText.flatMap((t) => t.split("\n")).filter((l) => /^\s*(\/\/|\*|\/\*)/.test(l)).length;
  const counts = new Map();
  for (const l of srcLines.map((x) => x.trim()).filter((x) => x.length > 30)) counts.set(l, (counts.get(l) || 0) + 1);
  const duplicated = [...counts.values()].filter((n) => n >= 3).reduce((a, n) => a + n, 0);
  const exported = srcText.flatMap((t) => [...t.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  const escape = (x) => x.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  // \b does not treat $ as a word character, so match on identifier edges instead.
  const unused = exported.filter((name) => (allText.match(new RegExp(`(?<![\\w$])${escape(name)}(?![\\w$])`, "g")) || []).length <= 1);
  let deps = 0;
  try { const p = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); deps = Object.keys({ ...p.dependencies, ...p.devDependencies }).length; } catch {}
  const join = srcText.join("\n");
  return {
    size: {
      source_files: src.length,
      test_files: tests.length,
      source_loc: srcLines.length,
      test_loc: tests.map(read).flatMap(codeLines).length,
      comment_ratio: srcLines.length ? +(comments / (srcLines.length + comments)).toFixed(3) : 0,
      dependencies: deps,
      duplicated_line_share: srcLines.length ? +(duplicated / srcLines.length).toFixed(3) : 0,
    },
    slop: {
      todo_or_placeholder: (join.match(/\b(TODO|FIXME|XXX|lorem ipsum|not implemented|placeholder)\b/gi) || []).length,
      empty_catch: (join.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/g) || []).length,
      console_in_source: (join.match(/\bconsole\.(log|debug)\(/g) || []).length,
      unused_exports: unused.length,
      unused_export_names: unused.slice(0, 10),
    },
    secrets: {
      hardcoded: (join.match(/sk_(live|test)_[A-Za-z0-9]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY|\b(password|secret|api_?key)\s*[:=]\s*["'][^"'\s]{6,}["']/gi) || []).length,
    },
  };
}

export function testHygiene(dir) {
  const tests = listFiles(dir).filter((f) => CODE.test(f) && isTestFile(f) && !f.startsWith("__"));
  const text = tests.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const cases = (text.match(/\b(test|it)\s*\(\s*["'`]/g) || []).length;
  const assertions = (text.match(/\bassert(\.\w+)?\s*\(|\bexpect\s*\(/g) || []).length;
  return {
    cases,
    assertions,
    assertions_per_case: cases ? +(assertions / cases).toFixed(2) : 0,
    trivial: (text.match(/assert(\.ok)?\s*\(\s*(true|1)\s*[,)]|expect\s*\(\s*true\s*\)/g) || []).length,
    skipped: (text.match(/\.(skip|todo)\s*\(|\{\s*(skip|todo)\s*:/g) || []).length,
  };
}

function runTests(dir, timeoutMs) {
  // NODE_TEST_CONTEXT (set when the probe itself runs under node --test) would make the
  // child report to the parent instead of printing its summary.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-timeout=20000"], { cwd: dir, encoding: "utf8", timeout: timeoutMs, env: { ...env, PORT: "0", NODE_ENV: "test" } });
  const out = `${r.stdout}\n${r.stderr}`;
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? 0);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? 0) + Number(/^# cancelled (\d+)/m.exec(out)?.[1] ?? 0);
  return { ok: r.status === 0 && pass > 0, pass, fail, timedOut: r.error?.code === "ETIMEDOUT" };
}

// Mutation sites: one operator change per site, never inside a string or a comment line.
const OPERATORS = [
  [/===/, "!=="], [/!==/, "==="], [/(?<![<>=!])<=(?!=)/, "<"], [/(?<![<>=!])>=(?!=)/, ">"],
  [/(?<![<>=!-])<(?![<=])/, "<="], [/(?<![<>=!-])>(?![>=])/, ">="], [/&&/, "||"], [/\|\|/, "&&"],
  [/\btrue\b/, "false"], [/\bfalse\b/, "true"], [/(?<![\w.])([1-9]\d*)(?![\w.])/, (m) => String(Number(m) + 1)],
  [/(?<![+\-*/])\s\+\s(?![+=])/, " - "], [/(?<![+\-*/])\s-\s(?![-=])/, " + "],
];

export function mutationSites(dir) {
  const sites = [];
  for (const rel of listFiles(dir).filter((f) => CODE.test(f) && isServerSource(f))) {
    // Lines inside a template literal are markup or text, not logic: a backtick count that
    // is odd so far means the line starts or ends inside one.
    let inTemplate = false;
    fs.readFileSync(path.join(dir, rel), "utf8").split("\n").forEach((line, i) => {
      const startsInside = inTemplate;
      const ticks = (line.replace(/\\`/g, "").match(/`/g) || []).length;
      if (ticks % 2) inTemplate = !inTemplate;
      if (startsInside || inTemplate) return;
      const t = line.trim();
      if (!t || /^(\/\/|\*|\/\*|import |export \{|export \* )/.test(t)) return;
      const code = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, (s) => " ".repeat(s.length));
      OPERATORS.forEach(([re], op) => { if (re.test(code)) sites.push({ file: rel, line: i, op }); });
    });
  }
  return sites;
}

function seededPick(xs, n, seed = 20261010) {
  const a = [...xs];
  let s = seed;
  const rand = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) | 0; return ((s >>> 0) % 1e9) / 1e9; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export function mutation(dir, { mutants = 30, timeoutMs = 120000 } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "qp-"));
  fs.cpSync(dir, work, { recursive: true, filter: (s) => !s.includes(`${path.sep}node_modules`) });
  for (const f of fs.readdirSync(work)) if (f.startsWith("__hidden")) fs.rmSync(path.join(work, f), { force: true });
  try {
    if (!listFiles(work).some((f) => CODE.test(f) && isTestFile(f))) return { score: null, reason: "no tests" };
    const base = runTests(work, timeoutMs);
    if (!base.ok) return { score: null, reason: `own tests do not pass as shipped (${base.pass} pass, ${base.fail} fail)` };
    const chosen = seededPick(mutationSites(work), mutants);
    let killed = 0, valid = 0;
    const survivors = [];
    for (const site of chosen) {
      const file = path.join(work, site.file);
      const original = fs.readFileSync(file, "utf8");
      const lines = original.split("\n");
      const [re, rep] = OPERATORS[site.op];
      lines[site.line] = lines[site.line].replace(re, rep);
      fs.writeFileSync(file, lines.join("\n"));
      // A mutant that does not even parse says nothing about the tests.
      const parses = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" }).status === 0;
      if (parses) {
        valid++;
        const r = runTests(work, timeoutMs);
        if (!r.ok) killed++; else survivors.push(`${site.file}:${site.line + 1}: ${lines[site.line].trim().slice(0, 100)}`);
      }
      fs.writeFileSync(file, original);
    }
    return { score: valid ? +(killed / valid).toFixed(3) : null, killed, mutants: valid, baseline_tests: base.pass, survivors: survivors.slice(0, 8) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

export function probe(dir, opts = {}) {
  return { ...sizeAndSlop(dir), tests: testHygiene(dir), mutation: mutation(dir, opts) };
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const mutants = Number(opt("--mutants", 30));
  const results = opt("--results");
  if (results) {
    // Adds `probes` to every row whose artifact is still on disk; agent and judge data are untouched.
    const data = JSON.parse(fs.readFileSync(results, "utf8"));
    for (const row of data.rows) {
      if (!row.artifact || !fs.existsSync(row.artifact)) continue;
      row.probes = probe(row.artifact, { mutants });
      process.stderr.write(`${row.task}/${row.arm}#${row.rep}: mutation ${row.probes.mutation.score ?? row.probes.mutation.reason}, ${row.probes.size.source_loc} src loc\n`);
    }
    fs.writeFileSync(results, JSON.stringify(data, null, 2) + "\n");
    return 0;
  }
  const dir = argv.find((a) => !a.startsWith("--") && a !== String(mutants));
  if (!dir) { process.stderr.write("usage: quality-probes.mjs <dir> [--mutants 30] | --results <results.json>\n"); return 2; }
  process.stdout.write(JSON.stringify(probe(dir, { mutants }), null, 2) + "\n");
  return 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
