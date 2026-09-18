#!/usr/bin/env node
/**
 * scripts/sync-github-issues.mjs
 *
 * Synchronize local SSVE Work Items (docs/specs/work-items/WI-*.md)
 * with GitHub Issues on the upstream repository (shipwithstef/ssve).
 *
 * Follows the standard defined in rules/github-projects.md:
 * - Title: [Type] <WI-ID>: <Title>
 * - Labels: priority:<level>, lane:<lane>, ssve
 * - Status: Closed when VERIFIED/CLOSED/DONE; Open when in_progress/backlog
 * - State Map: .svc/github-issues-map.json
 *
 * Usage:
 *   node scripts/sync-github-issues.mjs --wi WI-567
 *   node scripts/sync-github-issues.mjs --active
 *   node scripts/sync-github-issues.mjs --all
 *   node scripts/sync-github-issues.mjs --dry-run --active
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK_ITEMS_DIR = path.join(REPO_ROOT, "docs", "specs", "work-items");
const SYNC_MAP_PATH = path.join(REPO_ROOT, ".svc", "github-issues-map.json");

function getGitHubRepo() {
  try {
    const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
    if (match) return match[1];
  } catch {}
  return "shipwithstef/ssve";
}

function loadSyncMap() {
  try {
    if (fs.existsSync(SYNC_MAP_PATH)) {
      return JSON.parse(fs.readFileSync(SYNC_MAP_PATH, "utf8"));
    }
  } catch {}
  return { schema_version: 1, repository: getGitHubRepo(), updated_at: null, issues: {} };
}

function saveSyncMap(syncMap) {
  syncMap.updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(SYNC_MAP_PATH), { recursive: true });
  fs.writeFileSync(SYNC_MAP_PATH, JSON.stringify(syncMap, null, 2) + "\n");
}

function parseWorkItemFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const fileName = path.basename(filePath);
  const wiMatch = fileName.match(/^(WI-[A-Z0-9_-]+)\.md$/i);
  if (!wiMatch) return null;

  const wiId = wiMatch[1];
  const lines = content.split("\n");
  let title = wiId;
  let status = "backlog";
  let severity = "medium";
  let lane = "framework";
  let type = "Feature";

  // Parse header
  const titleLine = lines.find((l) => l.startsWith("# "));
  if (titleLine) {
    const rawTitle = titleLine.replace(/^#\s+/, "").trim();
    // E.g. "# WI-567 — Active-intent stop detection..."
    const parts = rawTitle.split(/\s+[—–-]\s+/);
    if (parts.length > 1) {
      title = parts.slice(1).join(" — ").trim();
    } else {
      title = rawTitle;
    }
  }

  // Parse status line or metadata
  for (const line of lines.slice(0, 30)) {
    const cleanLine = line.replace(/\*\*/g, "").trim();
    const statusMatch = cleanLine.match(/Status:\s*([^.\n]+)/i);
    if (statusMatch) {
      status = statusMatch[1].trim();
    }
    const typeMatch = cleanLine.match(/Type:\s*([^.\n,]+)/i);
    if (typeMatch) {
      const rawType = typeMatch[1].trim().toLowerCase();
      if (rawType.includes("bug")) type = "Bug";
      else if (rawType.includes("refactor")) type = "Refactor";
      else if (rawType.includes("doc")) type = "Docs";
      else if (rawType.includes("test")) type = "Test";
      else type = "Feature";
    }
    const laneMatch = cleanLine.match(/Lane:\s*([^.\n,]+)/i);
    if (laneMatch) lane = laneMatch[1].replace(/[`*]/g, "").trim().toLowerCase();

    const sevMatch = cleanLine.match(/Severity:\s*([^.\n,]+)/i);
    if (sevMatch) {
      const rawSev = sevMatch[1].toLowerCase();
      if (rawSev.includes("crit")) severity = "critical";
      else if (rawSev.includes("high")) severity = "high";
      else if (rawSev.includes("low")) severity = "low";
      else severity = "medium";
    }
  }

  const isClosed = /CLOSED|VERIFIED|DONE|RESOLVED|PROMOTED/i.test(status);

  return {
    id: wiId,
    filePath,
    title,
    rawStatus: status,
    isClosed,
    severity,
    lane,
    type,
    content,
  };
}

function runGh(args) {
  try {
    return execFileSync("gh", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch (err) {
    throw new Error(`gh ${args.join(" ")} failed: ${err.message}\n${err.stderr || ""}`);
  }
}

function syncWorkItem(wi, syncMap, { dryRun = false } = {}) {
  const ghRepo = syncMap.repository || getGitHubRepo();
  const existing = syncMap.issues[wi.id];

  const formattedTitle = `[${wi.type}] ${wi.id}: ${wi.title}`;
  const labels = [
    `type:${wi.type.toLowerCase()}`,
    `priority:${wi.severity}`,
    `lane:${wi.lane}`,
    "ssve",
  ];

  if (dryRun) {
    console.log(`[DRY-RUN] Syncing ${wi.id}:`);
    console.log(`  Title:  ${formattedTitle}`);
    console.log(`  Labels: ${labels.join(", ")}`);
    console.log(`  Status: ${wi.isClosed ? "CLOSED" : "OPEN"} (raw: ${wi.rawStatus})`);
    console.log(`  Current mapping: ${existing ? `#${existing.number} (${existing.url})` : "none"}`);
    return;
  }

  if (existing && existing.number) {
    // Update existing issue
    console.log(`Updating #${existing.number} for ${wi.id}...`);
    try {
      runGh([
        "issue", "edit", String(existing.number),
        "-R", ghRepo,
        "--title", formattedTitle,
      ]);

      if (wi.isClosed && existing.state !== "closed") {
        console.log(`  Closing #${existing.number} (Status: ${wi.rawStatus})...`);
        runGh(["issue", "close", String(existing.number), "-R", ghRepo, "--reason", "completed"]);
        existing.state = "closed";
      } else if (!wi.isClosed && existing.state === "closed") {
        console.log(`  Reopening #${existing.number}...`);
        runGh(["issue", "reopen", String(existing.number), "-R", ghRepo]);
        existing.state = "open";
      }
      existing.updated_at = new Date().toISOString();
      existing.raw_status = wi.rawStatus;
    } catch (err) {
      console.warn(`  Warning: failed to update #${existing.number}: ${err.message}`);
    }
  } else {
    // Create new issue
    console.log(`Creating GitHub issue for ${wi.id}: "${formattedTitle}"...`);
    const body = `## Work Item: ${wi.id}\n\n**Status:** \`${wi.rawStatus}\`\n**Severity:** \`${wi.severity}\`\n**Lane:** \`${wi.lane}\`\n\n---\n\n${wi.content.slice(0, 4000)}\n\n---\n*Managed autonomously by SSVE Framework*`;

    try {
      const issueUrl = runGh([
        "issue", "create",
        "-R", ghRepo,
        "--title", formattedTitle,
        "--body", body,
      ]);

      const issueNumMatch = issueUrl.match(/\/issues\/(\d+)$/);
      const issueNum = issueNumMatch ? parseInt(issueNumMatch[1], 10) : null;

      syncMap.issues[wi.id] = {
        number: issueNum,
        url: issueUrl,
        title: formattedTitle,
        state: wi.isClosed ? "closed" : "open",
        raw_status: wi.rawStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (wi.isClosed && issueNum) {
        runGh(["issue", "close", String(issueNum), "-R", ghRepo, "--reason", "completed"]);
        syncMap.issues[wi.id].state = "closed";
      }

      console.log(`  Created: ${issueUrl} (#${issueNum})`);
    } catch (err) {
      console.error(`  Failed to create issue for ${wi.id}: ${err.message}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const active = args.includes("--active");
  const listOnly = args.includes("--list");

  let targetWi = null;
  const wiIdx = args.indexOf("--wi");
  if (wiIdx !== -1 && args[wiIdx + 1]) {
    targetWi = args[wiIdx + 1].toUpperCase();
  }

  const syncMap = loadSyncMap();

  if (listOnly) {
    console.log(`\nSSVE <-> GitHub Issues Sync Map (${syncMap.repository || getGitHubRepo()}):`);
    console.log("----------------------------------------------------------------------");
    const entries = Object.entries(syncMap.issues);
    if (!entries.length) {
      console.log("  No mapped issues yet. Run with --active or --wi <WI-ID> to sync.");
    } else {
      for (const [id, info] of entries) {
        console.log(`  ${id.padEnd(35)} -> #${String(info.number || "?").padEnd(5)} [${info.state.toUpperCase()}] ${info.url}`);
      }
    }
    return;
  }

  const files = fs.readdirSync(WORK_ITEMS_DIR)
    .filter((f) => f.startsWith("WI-") && f.endsWith(".md"))
    .map((f) => path.join(WORK_ITEMS_DIR, f));

  const items = files.map(parseWorkItemFile).filter(Boolean);

  let selected = [];
  if (targetWi) {
    selected = items.filter((i) => i.id === targetWi);
    if (!selected.length) {
      console.error(`Work item not found: ${targetWi}`);
      process.exit(1);
    }
  } else if (active) {
    selected = items.filter((i) => !i.isClosed);
  } else if (all) {
    selected = items;
  } else {
    // Default to active unverified work items
    selected = items.filter((i) => !i.isClosed);
  }

  console.log(`Found ${selected.length} work items to sync (dry-run: ${dryRun})...\n`);

  for (const item of selected) {
    syncWorkItem(item, syncMap, { dryRun });
  }

  if (!dryRun) {
    saveSyncMap(syncMap);
    console.log(`\nSync map saved to ${SYNC_MAP_PATH}`);
  }
}

main();
