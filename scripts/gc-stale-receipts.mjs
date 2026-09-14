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
import { existsSync, statSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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


// WI-562 IP-R9: a mirror is integrity-UNKNOWN when its note envelope carries
// digests that the mirror bytes FAIL to match, or the note itself is unreadable.
// Those mirrors are evidence of something anomalous — never GC them. Mirrors
// with no reachable note (the normal unreachable-commit case) or pre-charter
// envelopes without digest meta stay deletable.
function mirrorIntegrityUnknown(sha, mirrorPath) {
  let raw = null;
  try {
    raw = execSync(`git notes --ref=svc-receipts show ${sha}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return false; // no readable note -> nothing to verify against -> deletable
  }
  let envelope;
  try { envelope = JSON.parse(raw); } catch { return true; }
  const digests = envelope && typeof envelope === "object" ? envelope.digests : null;
  if (!digests || typeof digests !== "object") return false;
  const safe = (v) => String(v || "").replace(/[^A-Za-z0-9._-]/g, "_");
  for (const [identity, expected] of Object.entries(digests)) {
    if (!/^sha256:[0-9a-f]{64}$/.test(String(expected))) continue;
    const segs = String(identity).split("::");
    const fileName = `${safe(segs[0])}--${safe(segs[1])}${segs[2] ? `--${safe(segs.slice(2).join("::"))}` : ""}.json`;
    const slotFile = join(mirrorPath, fileName);
    if (!existsSync(slotFile)) return true;
    // Canonical-OBJECT hashing domain (charter): parse then serialize, matching
    // check-chain-receipts' verification — never raw bytes.
    try {
      const obj = JSON.parse(readFileSync(slotFile, "utf8"));
      const actual = createHash("sha256").update(JSON.stringify(obj)).digest("hex");
      if (`sha256:${actual}` !== expected) return true;
    } catch { return true; }
  }
  return false;
}

function main() {
  if (!existsSync(MIRROR_DIR)) {
    console.log("No mirror directory; nothing to GC.");
    process.exit(0);
  }
  const entries = readdirSync(MIRROR_DIR).filter((e) => e !== "staging" && /^[0-9a-f]+$/.test(e));
  const cutoff = Date.now() - AGE_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  let skipped_unverifiable = 0;
  for (const sha of entries) {
    const path = join(MIRROR_DIR, sha);
    const stat = statSync(path);
    if (stat.mtimeMs > cutoff) continue;
    if (isReachable(sha)) continue;
    // WI-562 IP-R9: refuse to GC mirrors whose integrity cannot be verified —
    // a tampered or unreadable mirror is evidence, not garbage. Only mirrors
    // that either verify clean against their note digests or have no digest
    // meta at all may be deleted.
    if (mirrorIntegrityUnknown(sha, path)) { skipped_unverifiable++; continue; }
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
  console.log(JSON.stringify({ ok: true, removed, skipped_unverifiable }, null, 2));
}

main();
