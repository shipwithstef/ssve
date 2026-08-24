// WI-562 IP-H5: shared process-liveness primitives (single source).
//
// Extracted from hooks/lib/authority-store.mjs so every lock/claim/lease site
// uses ONE liveness proof: a process is alive on this host iff its pid exists
// AND its /proc/<pid>/stat start time (field 22, index 19 after comm) matches
// the recorded start_token — PID reuse cannot impersonate a dead owner.

import fs from "node:fs";
import os from "node:os";

export function processStartToken(pid = process.pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    return stat.slice(close + 2).trim().split(/\s+/)[19] || null;
  } catch {
    return null;
  }
}

export function ownerProcessIdentity() {
  return { hostname: os.hostname(), pid: process.pid, start_token: processStartToken() };
}

/**
 * @returns {true|false|null} true=provably alive, false=provably dead,
 *          null=undecidable (foreign host, missing identity, unreadable proc).
 */
export function processIsAlive(identity) {
  if (!identity || identity.hostname !== os.hostname() || !Number.isInteger(identity.pid) || identity.pid < 1) return null;
  try {
    process.kill(identity.pid, 0);
  } catch (error) {
    return error.code === "ESRCH" ? false : null;
  }
  if (identity.start_token) {
    const current = processStartToken(identity.pid);
    if (!current) return null;
    return current === identity.start_token;
  }
  return true;
}
