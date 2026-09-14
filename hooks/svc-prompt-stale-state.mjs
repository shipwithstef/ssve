#!/usr/bin/env node
// UserPromptSubmit hook — record active user intent for Stop-hook reconciliation,
// then soft warn on stale active-WI / lane-tasks state and long in-progress tasks.
// Never blocks.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { writeActiveIntentState } from "./lib/active-intent.mjs";

let inputRaw = "";
try {
  if (!process.stdin.isTTY) {
    try { inputRaw = readFileSync(0, "utf8"); } catch {}
  }
} catch {}

let lifecycleCwd = process.cwd();
let lifecyclePayload = {};
try { lifecyclePayload = JSON.parse(inputRaw || "{}"); } catch {}
const lifecycleHost = String(lifecyclePayload.host || process.env.SVC_HOST || (process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID ? "codex" : "")).toLowerCase();
if (lifecycleHost === "codex") {
  try {
    const { hookContext } = await import("./codex/lib/codex-hook-context.mjs");
    const ctx = hookContext(lifecyclePayload);
    lifecycleCwd = ctx.governance_worktree || ctx.repo_root || lifecycleCwd;
  } catch {}
}

try {
  const result = writeActiveIntentState({ rawInput: inputRaw, cwd: lifecycleCwd, env: process.env });
  if (result.status === "suppressed") {
    process.stderr.write(
      `[svc-active-intent] recorded ${result.classification} suppression for ${result.wi || "stale WI"} completion guards.\n`
    );
  } else if (result.status === "continued") {
    process.stderr.write(
      `[svc-active-intent] recorded explicit continuation for ${result.wi || "requested WI"}.\n`
    );
  }
} catch {
  // never block
}

try {
  const cwd = lifecycleCwd;
  const orchPath = resolve(cwd, ".svc/orchestrator-state.json");

  if (existsSync(orchPath)) {
    let state;
    try {
      state = JSON.parse(readFileSync(orchPath, "utf8"));
    } catch {
      state = null;
    }

    const active = state?.active_wis || state?.active || [];
    const stale = [];
    for (const wi of active) {
      const id = typeof wi === "string" ? wi : wi.id || wi.wi;
      if (!id) continue;
      const tasksPath = resolve(cwd, `.svc/lane-tasks-${id}.json`);
      if (!existsSync(tasksPath)) stale.push(id);
    }
    if (stale.length > 0) {
      process.stderr.write(
        `[svc-prompt-stale-state] WARN: active WI(s) without lane-tasks file: ${stale.join(", ")}. Consider pruning orchestrator-state.\n`
      );
    }
  }

  const warnMinutes = Number.parseInt(process.env.SVC_PROMPT_PROGRESS_WARN_MINUTES || "45", 10);
  const now = Date.now();
  const svcDir = resolve(cwd, ".svc");
  if (!existsSync(svcDir)) process.exit(0);
  const taskFiles = readdirSync(svcDir)
    .filter((name) => /^lane-tasks-.*\.json$/.test(name) && !name.includes(".completed"))
    .map((name) => resolve(svcDir, name));
  const stalled = [];
  for (const file of taskFiles) {
    let graph;
    try {
      graph = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    for (const task of graph.tasks || []) {
      if (!task || task.status !== "in_progress") continue;
      const rawTs = task.updated_at || task.started_at || task.created_at || graph.updated_at || graph.created;
      const ts = rawTs ? Date.parse(rawTs) : NaN;
      if (!Number.isFinite(ts)) continue;
      const ageMinutes = Math.floor((now - ts) / 60000);
      if (ageMinutes >= warnMinutes) {
        stalled.push(`${graph.wi || "unknown"}:${task.id || "task"} ${ageMinutes}m`);
      }
    }
  }
  if (stalled.length > 0) {
    process.stderr.write(
      `[svc-prompt-progress-audit] WARN: stalled in-progress task(s) older than ${warnMinutes}m without waiting for Stop: ${stalled.join(", ")}. Update the lane-task graph, record a phase/skill receipt, or mark the blocker explicitly.\n`
    );
  }
} catch {
  // never block
}
process.exit(0);
