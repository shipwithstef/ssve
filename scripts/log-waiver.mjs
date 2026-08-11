#!/usr/bin/env node
/**
 * Logs a structured waiver entry to `.svc/pipeline-decisions.jsonl`.
 *
 * Waiver types:
 *   - EMERGENCY_OVERRIDE: <issue-url>  (linked GitHub issue, capped 4/90d)
 *   - AUDIT_EXEMPT <sha>: <reason>      (commit on main without chain; capped 4/90d)
 *   - BOOTSTRAP_INSTALL: chain-introduction  (single-use ever)
 *   - PRE_RECONCILE_BASELINE: <range>   (one-time at chain install for legacy commits)
 *
 * Usage:
 *   log-waiver.mjs <type> <subject> [reason]
 *
 * Exits non-zero if quarterly cap exceeded for EMERGENCY_OVERRIDE / AUDIT_EXEMPT.
 */

import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LOG_PATH = ".svc/pipeline-decisions.jsonl";
const CAP_TYPES = ["EMERGENCY_OVERRIDE", "AUDIT_EXEMPT"];
const CAP_LIMIT = 4;
const CAP_WINDOW_DAYS = 90;

function ensureLogDir() {
  const dir = dirname(LOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readDecisions() {
  if (!existsSync(LOG_PATH)) return [];
  const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
  return lines.map((l) => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}

function countCappedInWindow(decisions) {
  const cutoff = new Date(Date.now() - CAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return decisions.filter((d) => {
    return d.kind === "waiver" &&
           CAP_TYPES.includes(d.waiver_type) &&
           new Date(d.timestamp) > cutoff;
  }).length;
}

function gitUser() {
  try {
    return execSync("git config user.name", { encoding: "utf8" }).trim();
  } catch (e) {
    return "unknown";
  }
}

function main() {
  const [type, subject, ...reasonParts] = process.argv.slice(2);
  if (!type || !subject) {
    console.error("Usage: log-waiver.mjs <type> <subject> [reason]");
    process.exit(2);
  }
  const reason = reasonParts.join(" ");

  ensureLogDir();
  const decisions = readDecisions();
  const cappedCount = countCappedInWindow(decisions);

  if (CAP_TYPES.includes(type) && cappedCount >= CAP_LIMIT) {
    console.error(JSON.stringify({
      ok: false,
      error: `Cap exhausted: ${cappedCount} ${CAP_TYPES.join("/")} usages in past ${CAP_WINDOW_DAYS} days; limit is ${CAP_LIMIT}.`,
      hint: "Resolve a prior override by landing its retroactive plan before logging another.",
    }, null, 2));
    process.exit(1);
  }

  if (type === "BOOTSTRAP_INSTALL") {
    const existing = decisions.filter((d) => d.kind === "waiver" && d.waiver_type === "BOOTSTRAP_INSTALL");
    if (existing.length >= 1) {
      console.error(JSON.stringify({
        ok: false,
        error: "BOOTSTRAP_INSTALL already used in repo history. Single-use only.",
      }, null, 2));
      process.exit(1);
    }
  }

  const entry = {
    kind: "waiver",
    waiver_type: type,
    subject,
    reason: reason || "(unspecified)",
    author: gitUser(),
    timestamp: new Date().toISOString(),
    cap_window_count: CAP_TYPES.includes(type) ? cappedCount + 1 : null,
  };
  appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  console.log(JSON.stringify({ ok: true, entry, cap_remaining: CAP_TYPES.includes(type) ? CAP_LIMIT - cappedCount - 1 : null }, null, 2));
}

main();
