#!/usr/bin/env node
/**
 * Post-task trigger router (SDKG primitive).
 *
 * Reads references/sdkg-registry.json + a completed-task subject; for each
 * registered SDKG instance, checks if the subject matches any trigger keyword;
 * appends a deduped trigger event to the instance's monitor-triggers jsonl.
 *
 * DEDUPE per RP-006: event key = {task_id, subject_hash, registry_instance,
 * date_bucket}. Router checks last N=100 events before append. Same Stop event
 * fired twice → exactly one entry.
 *
 * Usage from hook:
 *   echo '{"task_id":"...","subject":"..."}' | node scripts/lib/post-task-trigger-router.mjs
 *
 * Programmatic:
 *   import { route } from "./post-task-trigger-router.mjs";
 *   route({ taskId, subject, repoRoot, registryPath });
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { appendJsonlLine } from "../state-io.mjs";

const DEFAULT_DEDUPE_WINDOW = 100;
const DEFAULT_REGISTRY = "references/sdkg-registry.json";

function hashSubject(subject) {
  return crypto.createHash("sha256").update(subject || "").digest("hex").slice(0, 16);
}

function todayBucket() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function eventKey({ taskId, subject, instance, dateBucket }) {
  return `${taskId}|${hashSubject(subject)}|${instance}|${dateBucket}`;
}

function readLastEvents(jsonlPath, windowSize) {
  if (!fs.existsSync(jsonlPath)) return [];
  const raw = fs.readFileSync(jsonlPath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  return lines.slice(-windowSize).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function matchesAnyKeyword(subject, keywords) {
  if (!subject || !keywords?.length) return false;
  const lower = subject.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function route({ taskId, subject, repoRoot = process.cwd(), registryPath, dedupeWindow = DEFAULT_DEDUPE_WINDOW, env = process.env, _now = Date.now }) {
  const regPath = registryPath || path.join(repoRoot, DEFAULT_REGISTRY);
  if (!fs.existsSync(regPath)) {
    return { dispatched: [], skipped: [], reason: "no-registry" };
  }
  const registry = JSON.parse(fs.readFileSync(regPath, "utf8"));
  const dispatched = [], skipped = [];
  const dateBucket = todayBucket();

  for (const [instanceId, cfg] of Object.entries(registry.instances || {})) {
    if (!matchesAnyKeyword(subject, cfg.trigger_keywords)) {
      skipped.push({ instance: instanceId, reason: "no-keyword-match" });
      continue;
    }
    const jsonlPath = path.join(repoRoot, cfg.monitor_triggers_path || `.svc/${instanceId}-monitor-triggers.jsonl`);
    const recent = readLastEvents(jsonlPath, dedupeWindow);
    const key = eventKey({ taskId, subject, instance: instanceId, dateBucket });
    const isDuplicate = recent.some((ev) => eventKey({
      taskId: ev.task_id, subject: ev.subject, instance: instanceId, dateBucket: ev.date_bucket
    }) === key);
    if (isDuplicate) {
      skipped.push({ instance: instanceId, reason: "duplicate", key });
      continue;
    }
    const event = {
      ts: new Date(_now()).toISOString(),
      task_id: taskId,
      subject,
      subject_hash: hashSubject(subject),
      instance: instanceId,
      date_bucket: dateBucket,
      matched_keywords: cfg.trigger_keywords.filter((kw) => subject.toLowerCase().includes(kw.toLowerCase())),
    };
    appendJsonlLine(jsonlPath, event);
    dispatched.push({ instance: instanceId, event });
  }
  return { dispatched, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let stdin = "";
  process.stdin.on("data", (chunk) => stdin += chunk);
  process.stdin.on("end", () => {
    let payload;
    try { payload = JSON.parse(stdin); } catch (e) {
      console.error("ERROR: invalid JSON stdin:", e.message);
      process.exit(1);
    }
    const result = route({ taskId: payload.task_id, subject: payload.subject });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  });
  // Fail-open if no stdin within 1s (hook-friendly)
  setTimeout(() => {
    if (!stdin) { console.error("post-task-trigger-router: no stdin (fail-open)"); process.exit(0); }
  }, 1000);
}
