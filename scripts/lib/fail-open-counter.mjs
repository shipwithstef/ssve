// Fail-open counter (measurement hygiene): every hook path that swallows an error and
// lets the action continue records ONE increment here, so a run can report how often
// the safety net silently stood down.
//
// File:  <project root>/.svc/fail-open-counter.json
// Shape: { "total": <int>, "by_hook": { "<hook name>": { "<error class>": <int> } } }
//
// Contract: recordFailOpen is called on a failure path. It never throws, never prints,
// never touches the hook's exit code, and stores only the hook name and error class
// (error.code || error.name || "Error"), never the message.
import fs from "node:fs";
import path from "node:path";
import { withStateLock } from "../state-io.mjs";
import { isMain } from "./is-main.mjs";

export const COUNTER_FILE = "fail-open-counter.json";

const clean = (value, fallback) => {
  const text = String(value ?? "").replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80);
  return text || fallback;
};

export function errorClass(error) {
  if (error && typeof error === "object") return clean(error.code || error.name, "Error");
  return "Error";
}

// The nearest ancestor holding a .git entry (directory, or the file a linked worktree has).
// A filesystem walk, not a git spawn: this runs on a failure path, often under load, and
// a timed-out spawn would silently drop the count.
function gitTopLevel(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return "";
    dir = parent;
  }
}

// The project root a hook resolves: git toplevel of cwd, else cwd itself.
export function resolveRoot(cwd = process.cwd()) {
  return gitTopLevel(cwd) || path.resolve(cwd);
}

export function counterPath(root) {
  return path.join(root, ".svc", COUNTER_FILE);
}

function readCounter(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.by_hook && typeof parsed.by_hook === "object") return parsed;
  } catch { /* absent or corrupt: start over */ }
  return { total: 0, by_hook: {} };
}

// Read the counter for a project root (used by the cockpit). Absent file = zero.
export function readFailOpen(root) {
  const c = readCounter(counterPath(root));
  const total = Number.isInteger(c.total) && c.total >= 0 ? c.total : 0;
  return { total, by_hook: c.by_hook };
}

export function recordFailOpen(hookName, error, { root, cwd } = {}) {
  try {
    const base = root || resolveRoot(cwd || process.cwd());
    const dir = path.join(base, ".svc");
    if (!fs.existsSync(dir)) {
      // Only a git work tree gets a fresh .svc/; anywhere else stay out of the way.
      if (!gitTopLevel(base)) return;
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = path.join(dir, COUNTER_FILE);
    const hook = clean(hookName, "unknown-hook");
    const cls = errorClass(error);
    withStateLock(file, () => {
      const c = readCounter(file);
      const byHook = Object.assign(Object.create(null), c.by_hook);
      const classes = Object.assign(Object.create(null), byHook[hook]);
      classes[cls] = (Number.isInteger(classes[cls]) ? classes[cls] : 0) + 1;
      byHook[hook] = classes;
      const total = Object.values(byHook).reduce((n, cs) => n + Object.values(cs).reduce((m, v) => m + (Number.isInteger(v) ? v : 0), 0), 0);
      const tmp = `${file}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 10)}`;
      fs.writeFileSync(tmp, JSON.stringify({ total, by_hook: byHook }, null, 2) + "\n");
      try { fs.renameSync(tmp, file); } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
    }, { timeoutMs: 3000, staleMs: 10000, retryMs: 5 });
  } catch { /* a failure path must never fail again */ }
}

// Shell hooks: node fail-open-counter.mjs record <hook name> <error class> [project dir]
// Silent, always exits 0.
if (isMain(import.meta.url)) {
  const [verb, hook, cls, dir] = process.argv.slice(2);
  if (verb === "record") recordFailOpen(hook, { name: cls }, dir ? { root: dir } : {});
  process.exit(0);
}
