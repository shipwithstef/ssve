#!/usr/bin/env node

/**
 * Stale state self-healing for svc hooks.
 *
 * Runs at session start (invoked by route-workflow or first hook).
 * Cleans up orphaned state from crashed sessions:
 *   - Stale WI claims (TTL expired or PID dead)
 *   - Orphaned accumulator files (>24h old)
 *   - /tmp/svc-completion-guard/ counter files (>48h old)
 *   - Stuck in_progress tasks (>8h old with no active claim)
 */

import fs from "node:fs";
import path from "node:path";
import { findSvcDir } from "./resolve-wi.mjs";
import { cleanStaleClaims, isClaimStale } from "./wi-claim.mjs";

const ACCUMULATOR_MAX_AGE_MS = 24 * 3600 * 1000; // 24h
const COUNTER_MAX_AGE_MS = 48 * 3600 * 1000; // 48h
const IN_PROGRESS_MAX_AGE_MS = 8 * 3600 * 1000; // 8h

/**
 * Clean orphaned accumulator files.
 * @param {string} svcDir
 * @returns {number} count cleaned
 */
function cleanOrphanedAccumulators(svcDir) {
  let cleaned = 0;
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(svcDir)) {
      if (!file.startsWith("svc-edited-files") || !file.endsWith(".json")) continue;
      const filePath = path.join(svcDir, file);
      const mtime = fs.statSync(filePath).mtimeMs;
      if (now - mtime > ACCUMULATOR_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
  } catch {
    // Fail open
  }
  return cleaned;
}

/**
 * Clean /tmp/svc-completion-guard/ counter files.
 * @returns {number} count cleaned
 */
function cleanCounterFiles() {
  const counterDir = path.join(process.env.TMPDIR || "/tmp", "svc-completion-guard");
  if (!fs.existsSync(counterDir)) return 0;
  let cleaned = 0;
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(counterDir)) {
      const filePath = path.join(counterDir, file);
      const mtime = fs.statSync(filePath).mtimeMs;
      if (now - mtime > COUNTER_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
  } catch {
    // Fail open
  }
  return cleaned;
}

/**
 * Reset stuck in_progress tasks (>8h old with no active claim).
 * @param {string} svcDir
 * @returns {number} count reset
 */
function resetStuckTasks(svcDir) {
  let reset = 0;
  const now = Date.now();
  const claimsDir = path.join(svcDir, "claims");

  try {
    for (const file of fs.readdirSync(svcDir)) {
      if (!file.startsWith("lane-tasks-") || !file.endsWith(".json") || file.includes(".completed")) continue;
      const filePath = path.join(svcDir, file);
      const graph = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const wi = graph.wi || file.replace("lane-tasks-", "").replace(".json", "");

      // Check if WI has an active claim
      let hasActiveClaim = false;
      const claimPath = path.join(claimsDir, `${wi}.claim.json`);
      if (fs.existsSync(claimPath)) {
        try {
          const claim = JSON.parse(fs.readFileSync(claimPath, "utf8"));
          hasActiveClaim = !isClaimStale(claim);
        } catch {}
      }

      if (hasActiveClaim) continue; // Someone is actively working on this

      let modified = false;
      for (const task of graph.tasks || []) {
        if (task.status !== "in_progress") continue;
        const taskAge = task.started_at ? now - Date.parse(task.started_at) : Infinity;
        if (taskAge > IN_PROGRESS_MAX_AGE_MS) {
          task.status = "pending";
          task.notes = (task.notes || "") + ` [auto-reset: stale in_progress after ${Math.round(taskAge / 3600000)}h, no active claim]`;
          modified = true;
          reset++;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2) + "\n");
      }
    }
  } catch {
    // Fail open
  }
  return reset;
}

/**
 * Run all stale cleanup tasks.
 * @returns {{ claims: number, accumulators: number, counters: number, tasks: number }}
 */
export function runStaleCleanup() {
  const svcDir = findSvcDir();
  const result = {
    claims: cleanStaleClaims(),
    accumulators: svcDir ? cleanOrphanedAccumulators(svcDir) : 0,
    counters: cleanCounterFiles(),
    tasks: svcDir ? resetStuckTasks(svcDir) : 0,
  };
  const total = result.claims + result.accumulators + result.counters + result.tasks;
  if (total > 0) {
    process.stderr.write(
      `[svc-stale-cleanup] Cleaned: ${result.claims} claims, ${result.accumulators} accumulators, ` +
      `${result.counters} counter files, ${result.tasks} stuck tasks\n`
    );
  }
  return result;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith("stale-cleanup.mjs")) {
  runStaleCleanup();
}
