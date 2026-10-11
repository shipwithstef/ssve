#!/usr/bin/env node
/**
 * trace-check-deps.mjs — which repository files each tier-1 check actually reads.
 *
 *   node scripts/trace-check-deps.mjs trace [--only a.sh,b.mjs] [--jobs 4]   # (re)trace, writes the map
 *   node scripts/trace-check-deps.mjs select [--base <ref>]                  # checks affected by the diff
 *
 * Declared dependency lists go stale; this measures them. Each check runs once under strace;
 * every repository file it opens, stats or executes is recorded in
 * references/check-deps.json. A check is selected when its read set touches a changed path,
 * when the check itself changed, or when it has no trace yet (unknown means run it). The
 * full suite stays the gate for a batch and in CI; selection is for the fast inner loop.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { realpathSync as __svcRealpath } from "node:fs";
const __svcIsMain = (url) => { try { return Boolean(process.argv[1]) && __svcRealpath(process.argv[1]) === __svcRealpath(fileURLToPath(url)); } catch { return false; } };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIER1 = path.join(ROOT, "test-framework", "evals", "tier-1");
const MAP = path.join(ROOT, "references", "check-deps.json");

export const listChecks = () => fs.readdirSync(TIER1).filter((f) => /\.(sh|mjs)$/.test(f)).sort();

// Repository-relative paths a strace log shows were opened, statted or executed. Writes to
// temporary copies are outside the repository and ignored; directory reads count (a check
// that lists skills/ depends on every skill).
export function repoPathsFromTrace(text, root = ROOT) {
  const out = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^(?:\d+\s+)?(\w+)\([^"]*"([^"]+)"(.*)$/);
    if (!m) continue;
    const [, call, raw, rest] = m;
    if (/= -1 /.test(rest)) continue; // a failed lookup is not a dependency on an existing file
    if (!path.isAbsolute(raw) || !(raw === root || raw.startsWith(root + path.sep))) continue;
    const rel = path.relative(root, raw);
    if (!rel || /^(\.git|node_modules|\.claude\/worktrees|\.svc)(\/|$)/.test(rel)) continue;
    let isDir = false;
    try { isDir = fs.statSync(raw).isDirectory(); } catch { continue; }
    // A directory counts only when it is listed (opened as a directory); stat calls on parent
    // directories during module resolution would otherwise select the check for any change.
    if (isDir && !(/^open/.test(call) && /O_DIRECTORY/.test(rest))) continue;
    out.add(rel);
  }
  return [...out].sort();
}

function traceOne(check) {
  return new Promise((resolve) => {
    const log = path.join(os.tmpdir(), `trace-${process.pid}-${check}.log`);
    const runner = check.endsWith(".sh") ? ["bash", path.join(TIER1, check)] : [process.execPath, "--test", path.join(TIER1, check)];
    const t0 = Date.now();
    const child = spawn("strace", ["-f", "-qq", "-e", "trace=open,openat,openat2,stat,newfstatat,statx,lstat,access,faccessat,faccessat2,execve,readlink", "-o", log, ...runner], { cwd: ROOT, stdio: "ignore" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15 * 60000);
    child.on("close", (code) => {
      clearTimeout(timer);
      let text = ""; try { text = fs.readFileSync(log, "utf8"); fs.rmSync(log, { force: true }); } catch {}
      resolve({ check, ok: code === 0, seconds: +((Date.now() - t0) / 1000).toFixed(1), reads: repoPathsFromTrace(text) });
    });
  });
}

export async function trace({ only = null, jobs = 4 } = {}) {
  const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, "utf8")) : { traced_at: null, checks: {} };
  const queue = (only || listChecks()).slice();
  const run = async () => { while (queue.length) { const c = queue.shift(); const r = await traceOne(c); map.checks[c] = { reads: r.reads, seconds: r.seconds, passed: r.ok }; process.stderr.write(`${c}: ${r.reads.length} files, ${r.seconds}s${r.ok ? "" : " (failed while traced)"}\n`); } };
  await Promise.all(Array.from({ length: jobs }, run));
  map.traced_at = new Date().toISOString();
  map.checks = Object.fromEntries(Object.entries(map.checks).filter(([c]) => listChecks().includes(c)).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MAP, JSON.stringify(map, null, 1) + "\n");
  return map;
}

// A changed path touches a read path when they are equal or one contains the other
// (a check that read a directory depends on what is inside it).
const touches = (changed, read) => changed === read || changed.startsWith(read + "/") || read.startsWith(changed + "/");

export function select(changed, map = JSON.parse(fs.readFileSync(MAP, "utf8")), checks = listChecks()) {
  const picked = [];
  for (const c of checks) {
    const entry = map.checks?.[c];
    if (!entry) { picked.push({ check: c, why: "no trace yet" }); continue; }
    if (changed.includes(`test-framework/evals/tier-1/${c}`)) { picked.push({ check: c, why: "check changed" }); continue; }
    const hit = changed.find((f) => entry.reads.some((r) => touches(f, r)));
    if (hit) picked.push({ check: c, why: hit });
  }
  return picked;
}

function changedFiles(base) {
  const run = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  return [...new Set([...run(["diff", "--name-only", base]), ...run(["ls-files", "--others", "--exclude-standard"])])];
}

if (__svcIsMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  if (argv[0] === "trace") {
    trace({ only: opt("--only") ? opt("--only").split(",") : null, jobs: Number(opt("--jobs", 4)) }).then((m) => process.stdout.write(`traced ${Object.keys(m.checks).length} checks\n`));
  } else if (argv[0] === "select") {
    const picked = select(changedFiles(opt("--base", "HEAD")));
    if (argv.includes("--json")) process.stdout.write(JSON.stringify(picked, null, 2) + "\n");
    else process.stdout.write(picked.map((p) => p.check).join("\n") + (picked.length ? "\n" : ""));
  } else {
    process.stderr.write("usage: trace-check-deps.mjs trace [--only a,b] [--jobs 4] | select [--base <ref>] [--json]\n");
    process.exit(2);
  }
}
