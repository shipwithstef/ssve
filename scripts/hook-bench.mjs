#!/usr/bin/env node
/**
 * hook-bench.mjs — measure what svc hooks add to each tool call, against budgets.
 *
 *   node scripts/hook-bench.mjs [--runs 5] [--json] [--budgets references/hook-budgets.json]
 *
 * Wires the Claude hooks into a throwaway HOME, creates a throwaway governed repository,
 * and replays one payload per event. Handlers of one event start together, as Claude
 * Code starts them, so an event costs its slowest synchronous handler. `async` handlers
 * are skipped (they never delay the call) and an `if` filter is applied to file tools.
 *
 * Machines differ, so budgets are in units of one bare Node start on this machine
 * ("node starts"), measured first. Exit 1 when an event is over budget; the report names
 * the slowest handler of each event. Nothing outside the temporary directories is touched.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal permission-rule glob for `if` filters on file tools: Edit(//**/x/*.json).
export function ifMatches(rule, tool, filePath) {
  const m = /^(\w+)\((.*)\)$/.exec(rule || "");
  if (!m) return true;
  const fileTools = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
  if (m[1] === "Edit" ? !fileTools.includes(tool) : m[1] !== tool) return false;
  if (!filePath || m[1] === "Bash") return true;
  let pat = m[2];
  if (pat.startsWith("//")) pat = pat.slice(1);
  else if (!pat.startsWith("/")) pat = "**/" + pat;
  const re = pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${re}$`).test(filePath);
}

const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];

function run(cmd, cwd, input, env) {
  return new Promise((resolve) => {
    const t = process.hrtime.bigint();
    const child = spawn("sh", ["-c", cmd], { cwd, env, stdio: ["pipe", "ignore", "ignore"] });
    child.on("close", () => resolve(Number(process.hrtime.bigint() - t) / 1e6));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function nodeStartMs(runs) {
  const times = [];
  for (let i = 0; i < runs * 2; i++) { const t = process.hrtime.bigint(); spawnSync(process.execPath, ["-e", "0"]); times.push(Number(process.hrtime.bigint() - t) / 1e6); }
  return median(times);
}

function setup() {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "svc-hook-bench-")));
  const home = path.join(tmp, "home");
  const repo = path.join(tmp, "repo");
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "a.ts"), "export const a = 1;\n"); // fixture source only
  const env = { ...process.env, HOME: home };
  // The repository counts as svc-governed when it has an (empty) marker directory.
  fs.mkdirSync(path.join(repo, ".svc"));
  delete env.SVC_HOOK_MODE;
  execFileSync("git", ["init", "-q", repo]);
  execFileSync("git", ["-C", repo, "-c", "user.email=b@b", "-c", "user.name=b", "add", "-A"]);
  execFileSync("git", ["-C", repo, "-c", "user.email=b@b", "-c", "user.name=b", "commit", "-q", "-m", "bench"]);
  const settings = path.join(home, ".claude", "settings.json");
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "wire-hooks.mjs"), "--skills-path", ROOT, "--settings", settings], { env, stdio: "ignore" });
  return { tmp, home, repo, env: { ...env, CLAUDE_PROJECT_DIR: repo }, hooks: JSON.parse(fs.readFileSync(settings, "utf8")).hooks || {} };
}

export async function bench({ runs = 5, budgets } = {}) {
  const unit = nodeStartMs(runs);
  const ctx = setup();
  const file = path.join(ctx.repo, "src", "a.ts");
  const cases = [
    ["PreToolUse", "Edit", { file_path: file, old_string: "1", new_string: "2" }],
    ["PostToolUse", "Edit", { file_path: file }],
    ["PreToolUse", "Bash", { command: "git status" }],
    ["PostToolUse", "Bash", { command: "git status" }],
    ["PostToolUse", "Read", { file_path: file }],
    ["UserPromptSubmit", null, null],
    ["Stop", null, null],
  ];
  const events = [];
  try {
    for (const [event, tool, input] of cases) {
      const handlers = [];
      for (const group of ctx.hooks[event] || []) {
        if (group.matcher && group.matcher !== "*" && !(tool && new RegExp(`^(?:${group.matcher})$`).test(tool))) continue;
        for (const h of group.hooks || []) {
          if (h.async || h.asyncRewake || h.type !== "command") continue;
          if (h.if && !ifMatches(h.if, tool, input?.file_path)) continue;
          handlers.push({ name: (h.command.match(/svc-[\w.-]+\.(?:mjs|js|sh)|[\w-]+\.mjs(?= (?:pre|post)\b)/g) || ["?"]).at(-1), command: h.command + (h.args ? " " + h.args.map((a) => `'${a}'`).join(" ") : "") });
        }
      }
      const payload = JSON.stringify({ session_id: "bench", hook_event_name: event, cwd: ctx.repo, tool_name: tool, tool_input: input, prompt: "fix the login bug" });
      const walls = [], per = handlers.map(() => []);
      for (let r = 0; r < runs; r++) {
        const t = process.hrtime.bigint();
        const times = await Promise.all(handlers.map((h) => run(h.command, ctx.repo, payload, ctx.env)));
        walls.push(Number(process.hrtime.bigint() - t) / 1e6);
        times.forEach((ms, i) => per[i].push(ms));
      }
      const key = tool ? `${event}:${tool}` : event;
      const wall = handlers.length ? median(walls) : 0;
      const slowest = handlers.map((h, i) => ({ name: h.name, ms: Math.round(median(per[i])) })).sort((a, b) => b.ms - a.ms);
      const budget = budgets?.events?.[key];
      events.push({ event: key, handlers: handlers.length, wall_ms: Math.round(wall), node_starts: +(wall / unit).toFixed(1), budget_node_starts: budget ?? null, over: budget != null && wall / unit > budget, slowest: slowest.slice(0, 3) });
    }
  } finally {
    fs.rmSync(ctx.tmp, { recursive: true, force: true });
  }
  return { node_start_ms: Math.round(unit), runs, events };
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const budgetFile = opt("--budgets", path.join(ROOT, "references", "hook-budgets.json"));
  const budgets = fs.existsSync(budgetFile) ? JSON.parse(fs.readFileSync(budgetFile, "utf8")) : null;
  const result = await bench({ runs: Number(opt("--runs", 5)), budgets });
  if (argv.includes("--json")) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  else {
    process.stdout.write(`one bare node start = ${result.node_start_ms} ms; ${result.runs} runs per event\n`);
    for (const e of result.events) {
      const b = e.budget_node_starts == null ? "" : ` (budget ${e.budget_node_starts})`;
      process.stdout.write(`${e.over ? "OVER" : "ok  "} ${e.event.padEnd(22)} ${String(e.wall_ms).padStart(5)} ms = ${String(e.node_starts).padStart(4)} node starts${b}; ${e.handlers} sync handlers; slowest ${e.slowest.map((s) => `${s.name} ${s.ms}ms`).join(", ") || "-"}\n`);
    }
  }
  return result.events.some((e) => e.over) ? 1 : 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));
