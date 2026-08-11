#!/usr/bin/env node
/**
 * GC for receipt working-tree mirror (`.svc/receipts/<sha>/`).
 *
 * Removes mirror entries for commits no longer reachable from any ref AND
 * older than 90 days. Git notes are NEVER deleted — they're durable history.
 *
 * Run on session-start (after reconcile).
 */

import { execSync } from "node:child_process";
import { existsSync, statSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIRROR_DIR = ".svc/receipts";
const STAGING_DIR = ".svc/receipts/staging";
const AGE_DAYS = 90;

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

function isReachable(sha) {
  try {
    git(`merge-base --is-ancestor ${sha} --all 2>/dev/null || git for-each-ref --contains=${sha} --format='%(refname)' | head -1`);
    const refs = execSync(`git for-each-ref --contains=${sha} 2>/dev/null || true`, { encoding: "utf8" }).trim();
    return refs.length > 0;
  } catch (e) {
    return false;
  }
}

function main() {
  if (!existsSync(MIRROR_DIR)) {
    console.log("No mirror directory; nothing to GC.");
    process.exit(0);
  }
  const entries = readdirSync(MIRROR_DIR).filter((e) => e !== "staging" && /^[0-9a-f]+$/.test(e));
  const cutoff = Date.now() - AGE_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const sha of entries) {
    const path = join(MIRROR_DIR, sha);
    const stat = statSync(path);
    if (stat.mtimeMs > cutoff) continue;
    if (isReachable(sha)) continue;
    rmSync(path, { recursive: true, force: true });
    removed++;
  }
  // Also clean up old staging entries (>7 days = orphaned)
  if (existsSync(STAGING_DIR)) {
    const stagingCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stagingEntries = readdirSync(STAGING_DIR);
    for (const treeHash of stagingEntries) {
      const path = join(STAGING_DIR, treeHash);
      const stat = statSync(path);
      if (stat.mtimeMs > stagingCutoff) continue;
      rmSync(path, { recursive: true, force: true });
      removed++;
    }
  }
  console.log(JSON.stringify({ ok: true, removed }, null, 2));
}

main();
