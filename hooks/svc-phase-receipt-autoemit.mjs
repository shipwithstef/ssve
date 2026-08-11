#!/usr/bin/env node
/** svc-phase-receipt-autoemit (WI-363) — records phase receipts when the
 * evidence is OBSERVABLE: a PostToolUse event touching a declared writes-path
 * of the active task's skill phases. One event -> at most one phase (first
 * unrecorded in declaration order). Judgment phases never auto-fire.
 * Fail-open; sync (Stop-guard reads receipts immediately after). */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHookPayload, extractFilePath, extractCommand, resolveHookOperation } from "./lib/hook-payload.mjs";

const SVC_ROOT = process.env.SVC_AUTOEMIT_SKILLS_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// WI-498 (F-006): the task-graph EXECUTABLE is always resolved from THIS hook's own
// install directory (self-located), never from the env override and never from the
// consumer `cwd`. An env-selected or consumer-relative executable path is an ACE
// vector; SVC_ROOT's env override is fine for reading data but must not choose code.
const SELF_TASK_GRAPH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "task-graph.mjs");

function activeGraph(cwd) {
  const dir = path.join(cwd, ".svc");
  let best = null;
  try {
    for (const f of readdirSync(dir)) {
      if (!/^lane-tasks-.*\.json$/.test(f)) continue;
      const p = path.join(dir, f);
      let g; try { g = JSON.parse(readFileSync(p, "utf8")); } catch { continue; }
      const t = (g.tasks || []).find((x) => x.status === "in_progress");
      if (!t) continue;
      const m = statSync(p).mtimeMs;
      if (!best || m > best.m) best = { p, g, t, m };
    }
  } catch { return null; }
  return best;
}

function phasesFor(skill) {
  if (!skill || !/^[A-Za-z0-9._-]+$/.test(skill)) return [];
  const packaged = path.join(SVC_ROOT, "skills", skill, "SKILL.md");
  const flatInstalled = path.join(SVC_ROOT, skill, "SKILL.md");
  const f = existsSync(packaged) ? packaged : flatInstalled;
  if (!existsSync(f)) return [];
  const text = readFileSync(f, "utf8");
  const start = text.match(/^phases:\s*$/m);
  if (!start) return [];
  const rest = text.slice(start.index);
  const end = rest.search(/^inputs:\s*$/m);
  const block = (end === -1 ? rest : rest.slice(0, end)).split(/\r?\n/);
  // G2 CRITICAL-1: state-accumulating parser — handles BOTH inline-map
  // (`- { id: X, writes: [..] }`) and block-style multi-line phase entries.
  const out = [];
  let cur = null;
  for (const line of block) {
    const idm = line.match(/(?:^|[-{,]\s*)id:\s*([A-Za-z0-9.-]+)/);
    if (idm) { if (cur) out.push(cur); cur = { id: idm[1], evidence_kind: "command_output", writes: [] }; }
    if (!cur) continue;
    const ekm = line.match(/evidence_kind:\s*(\w+)/);
    if (ekm) cur.evidence_kind = ekm[1];
    const wrm = line.match(/writes:\s*\[([^\]]*)\]/);
    if (wrm) {
      cur.writes.push(...wrm[1].split(",").map((x) => x.trim().replace(/^"|"$/g, "").split(/\s/)[0]).filter(Boolean));
    } else if (/^\s*-\s+"/.test(line) && /writesPending/.test("")) { /* reserved */ }
    // block-style list items under a `writes:` line:
    if (/^\s*writes:\s*$/.test(line)) cur._inWrites = true;
    else if (cur._inWrites) {
      const li = line.match(/^\s*-\s*"?([^"\s]+)/);
      if (li) cur.writes.push(li[1]);
      else if (!/^\s*$/.test(line)) cur._inWrites = false;
    }
  }
  if (cur) out.push(cur);
  return out.map(({ _inWrites, ...rest2 }) => rest2);
}

function main() {
  const call = readHookPayload();
  if (!call) process.exit(0);
  const tool = call.toolName;
  const operation = resolveHookOperation(call);
  if (operation.host === "codex" && !operation.scope?.ok) process.exit(0);
  const cwd = operation.root || call.cwd || process.cwd();
  let touched = "";
  if (tool === "Edit" || tool === "Write") touched = extractFilePath(call.toolInput) || "";
  else if (tool === "Bash") touched = extractCommand(call.toolInput) || "";
  else process.exit(0);
  if (!touched) process.exit(0);
  if (path.isAbsolute(touched) && (tool === "Edit" || tool === "Write")) touched = path.relative(cwd, touched);

  const act = activeGraph(cwd);
  if (!act) process.exit(0);
  const { p: graphPath, g, t } = act;
  if (!t.skill_receipt || typeof t.skill_receipt !== "object") process.exit(0); // 668-670 contract
  const skill = t.skill_receipt.skill || t.skill;
  const done = new Set((t.skill_receipt.phases_executed || []).map((x) => x.id));
  const wi = g.wi || "";

  // G2 CRITICAL-2: Bash matches only count as WRITES when a mutation operator
  // precedes the path occurrence (>>, >, tee [-a], sed -i, or the canonical
  // appenders). Read-only cat/grep/tail can never emit a receipt.
  function bashWrites(cmd, wp) {
    const i = cmd.indexOf(wp);
    if (i < 0) return false;
    const before = cmd.slice(0, i);
    return /(>>?\s*$|>>?\s*\S*$|tee(\s+-a)?\s+\S*$|sed\s+-i[\s\S]*$|pipeline-log\.mjs\s+append[\s\S]*$|task-graph\.mjs[\s\S]*$)/.test(before.slice(-200));
  }
  const matchPath = (wp) => (tool === "Bash" ? bashWrites(touched, wp) : (touched === wp || touched.endsWith(wp)));
  const phases = phasesFor(skill).filter((ph) => !done.has(ph.id) && ph.writes.length);
  // G2 HIGH: prefer phases whose matched path is EXCLUSIVE to them (not shared
  // with any other declared phase) — shared-ledger misattribution guard.
  const allWrites = new Map();
  for (const ph of phases) for (const w of ph.writes) allWrites.set(w, (allWrites.get(w) || 0) + 1);
  const tiers = [
    phases.filter((ph) => ph.writes.some((w) => allWrites.get(w) === 1 && matchPath(w.replace(/<WI>/g, wi)))),
    phases.filter((ph) => ph.writes.some((w) => matchPath(w.replace(/<WI>/g, wi)))),
  ];
  for (const tier of tiers) {
    const ph = tier[0];
    if (!ph) continue;
    const wp = ph.writes.map((w) => w.replace(/<WI>/g, wi)).find((w) => matchPath(w));
    const ev = `${ph.evidence_kind === "file" ? "file" : "command_output"}:${wp}`;
    try {
      execFileSync(process.execPath, [SELF_TASK_GRAPH, "record-phase", graphPath, String(t.id), ph.id, "--evidence", ev], { cwd, stdio: "ignore" });
    } catch { /* fail-open: absent script (cross-project) or any error */ }
    break; // one event, one phase
  }
  process.exit(0);
}

try { main(); } catch { process.exit(0); }
