#!/usr/bin/env node
// PreCompact hook — snapshot active task graph + last decisions to disk.
// Reads stdin (ignored). Never blocks.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { writeJsonAtomic } from "../scripts/state-io.mjs";
import { resolveSvcStateDir } from "./lib/svc-state-dir.mjs";

try {
  try { readFileSync(0, "utf8"); } catch {}
} catch {}

try {
  const cwd = process.cwd();
  const stateDir = resolveSvcStateDir(cwd);   // WI-452: skip if not in an svc repo (no /tmp pollution)
  if (!stateDir) process.exit(0);
  const sessDir = resolve(stateDir, "sessions");

  let branch = "";
  try {
    branch = execSync("git branch --show-current", { encoding: "utf8", timeout: 1000 }).trim();
  } catch {}

  let laneTasksFiles = [];
  try {
    const svcDir = resolve(cwd, ".svc");
    if (existsSync(svcDir)) {
      laneTasksFiles = readdirSync(svcDir)
        .filter((f) => f.startsWith("lane-tasks-") && f.endsWith(".json"));
    }
  } catch {}

  let lastDecisions = [];
  try {
    const decPath = resolve(cwd, ".svc/pipeline-decisions.jsonl");
    if (existsSync(decPath)) {
      const lines = readFileSync(decPath, "utf8").split("\n").filter(Boolean);
      lastDecisions = lines.slice(-5).map((l) => {
        try { return JSON.parse(l); } catch { return { raw: l }; }
      });
    }
  } catch {}

  const ts = new Date().toISOString();
  const safeTs = ts.replace(/[:.]/g, "-");
  const snapshot = { ts, branch, lane_tasks_files: laneTasksFiles, last_decisions: lastDecisions };
  writeJsonAtomic(resolve(sessDir, `${safeTs}.snapshot.json`), snapshot);
} catch {
  // never block
}
process.exit(0);
