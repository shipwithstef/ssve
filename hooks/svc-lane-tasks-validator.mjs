#!/usr/bin/env node
/**
 * svc-lane-tasks-validator.mjs — framework gap G3 enforcement.
 *
 * Fires as a PostToolUse hook on Edit|Write. If the written/edited path
 * matches `.svc/lane-tasks-*.json`, validate the file. If invalid:
 *   - print a clear fix-it message
 *   - exit 1 (visible to the agent in the next turn)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { readHookPayload, extractFilePath } = await import(
  path.join(__dirname, "lib", "hook-payload.mjs")
);
// WI-487 (F-003/AC-487-7): actionable-denial helper — replaces anonymous `exit 1`
// block paths with a structured {hook_id,reason_code,cause,operation,recovery}
// denial + durable receipt, then a canonical exit 2 hard-block.
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "lib", "hook-denial.mjs"))); } catch { /* older install */ }
function denyLaneTasks(reasonCode, cause, filePath) {
  if (emitDenial) {
    emitDenial({
      hook_id: "svc-lane-tasks-validator",
      reason_code: reasonCode,
      cause: String(cause || "").slice(0, 1200),
      operation: `edit of a lane-tasks graph (${filePath})`,
      recovery: "Repair the .svc/lane-tasks-<WI>.json graph so `node scripts/task-graph.mjs validate <path>` passes before continuing.",
      // Per-file denial identity so distinct graphs never dedup each other.
      resolved_command_path: filePath,
      session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
    });
  } else {
    process.stderr.write(`SVC DENIAL svc-lane-tasks-validator ${reasonCode}: ${cause}\n`);
  }
  process.exit(2);
}

// Unified host-agnostic payload extraction (shared with loop-guard, workflow-guard).
const call = readHookPayload();
if (!call) process.exit(0);
const filePath = extractFilePath(call.toolInput);
if (!filePath) process.exit(0);

// Only care about lane-tasks JSON files
if (!/\.svc\/lane-tasks-[^/]+\.json$/.test(filePath)) {
  process.exit(0);
}

if (!fs.existsSync(filePath)) process.exit(0);

// 1. JSON syntax check
try {
  JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (e) {
  denyLaneTasks("SVC-LANE-TASKS-INVALID-JSON", `invalid JSON in ${filePath}: ${e.message}`, filePath);
}

// 2. Schema check (task-graph.mjs validate catches deeper issues)
try {
  execSync(`node scripts/task-graph.mjs validate "${filePath}"`, { stdio: "pipe" });
} catch (e) {
  const msg = (e.stderr || e.stdout || Buffer.from(e.message)).toString();
  denyLaneTasks("SVC-LANE-TASKS-SCHEMA-VIOLATION", `schema violation in ${filePath}: ${msg}`, filePath);
}

// 3. Status-transition discipline (G-1 / WI-113 — closes the Edit-tool bypass).
//
// Past sessions used the Edit/Write tools to flip task `status` to `completed`
// directly in the JSON, bypassing the PreToolUse(TaskUpdate) eval-gate which
// only fires on the TaskUpdate tool. Compare pre-edit vs post-edit content
// via git and fail when any task transitioned pending|in_progress -> completed
// without a populated eval_matrix. Override: SVC_LANE_TASKS_ALLOW_RAW_EDIT=1
// (use only for wholesale file rebuilds, not individual transitions).
try {
  const newJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const newTasks = Array.isArray(newJson?.tasks) ? newJson.tasks : [];

  let priorJson = null;
  try {
    const priorContent = execSync(`git show "HEAD:${filePath}" 2>/dev/null`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    if (priorContent.trim()) priorJson = JSON.parse(priorContent);
  } catch {
    // file is brand-new; no transitions to evaluate
  }

  if (priorJson && process.env.SVC_LANE_TASKS_ALLOW_RAW_EDIT !== "1") {
    const priorTasks = Array.isArray(priorJson?.tasks) ? priorJson.tasks : [];
    const priorById = new Map(priorTasks.map((t) => [t.id, t]));

    const violations = [];
    for (const task of newTasks) {
      const before = priorById.get(task.id);
      if (!before) continue;
      const wasNotComplete = before.status !== "completed";
      const isCompleteNow = task.status === "completed";
      if (!(wasNotComplete && isCompleteNow)) continue;

      const matrix = Array.isArray(task.eval_matrix) ? task.eval_matrix : [];
      if (matrix.length === 0) {
        violations.push({
          taskId: task.id,
          reason: "transition pending|in_progress -> completed but eval_matrix is empty",
        });
        continue;
      }
      const unfilled = matrix.filter(
        (i) => i.value === null || i.value === undefined || i.value === ""
      );
      if (unfilled.length > 0) {
        violations.push({
          taskId: task.id,
          reason: `transition pending|in_progress -> completed with ${unfilled.length}/${matrix.length} eval_matrix pillars unfilled`,
        });
      }

      // AP-27: skill_receipt check — catch ghost completion at Edit/Write time
      const expectedSkill = task.metadata?.skill || task.skill;
      if (expectedSkill && !task.skill_receipt) {
        violations.push({
          taskId: task.id,
          reason: `transition pending|in_progress -> completed but skill_receipt is missing for skill "${expectedSkill}"`,
        });
      }
    }

    if (violations.length > 0) {
      console.error(
        "❌ svc-lane-tasks-validator: status-transition discipline (G-1) violated."
      );
      console.error(
        "   The Edit/Write tools cannot flip a task status to 'completed' unless"
      );
      console.error(
        "   eval_matrix is populated. This closes the bypass where lane-tasks JSON"
      );
      console.error(
        "   was edited directly to dodge the TaskUpdate PreToolUse eval-gate."
      );
      console.error("");
      for (const v of violations) {
        console.error(`   - task ${v.taskId}: ${v.reason}`);
      }
      console.error("");
      console.error(
        "   Proper path: use the TaskUpdate tool (Claude/Kimi) so the eval-gate fires,"
      );
      console.error(
        "   OR fill the eval_matrix in this file BEFORE flipping status to completed,"
      );
      console.error(
        "   OR (rare) export SVC_LANE_TASKS_ALLOW_RAW_EDIT=1 if you are doing a wholesale"
      );
      console.error(
        "   file rebuild and no individual transition is occurring."
      );
      process.exit(2);
    }
  }
} catch (e) {
  // Don't block on the diff check itself failing in unusual environments —
  // the schema check above already enforces structural integrity.
  console.error(
    `⚠ svc-lane-tasks-validator: status-transition check skipped (${e.message})`
  );
}

// Valid — silent success
process.exit(0);
