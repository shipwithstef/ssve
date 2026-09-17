// WI-562 IP-H5: shared process-liveness primitives (single source).
//
// Extracted from hooks/lib/authority-store.mjs so every lock/claim/lease site
// uses ONE liveness proof: a process is alive on this host iff its pid exists
// AND its /proc/<pid>/stat start time (field 22, index 19 after comm) matches
// the recorded start_token — PID reuse cannot impersonate a dead owner.
//
// Phase 5: owner identity walks past ephemeral shells to the persistent
// harness. An exited `bash`/`node script` child must not look like a dead
// controller while Codex/Cursor/Claude is still live.

import fs from "node:fs";
import os from "node:os";

const TRANSIENT_COMMS = new Set(["bash", "sh", "zsh", "env", "dash", "python", "python3", "python3.10", "python3.11", "python3.12", "ruby", "perl"]);
const NODE_VALUE_FLAGS = new Set(["-r", "--require", "--import", "--experimental-loader", "--loader"]);
const MAX_HARNESS_WALK = 64;

const PERSISTENT_HARNESS_NAMES = new Set([
  "claude", "grok", "cursor", "cursor-agent", "opencode", "codex", "gemini",
  "kimi", "mimo-code", "mimocode", "antigravity", "agy"
]);
const PERSISTENT_HARNESS_SCRIPTS = [
  /(?:^|[\\/])claude(?:\.js)?$/i,
  /(?:^|[\\/])grok(?:\.js)?$/i,
  /(?:^|[\\/])cursor-agent$/i,
  /(?:^|[\\/])cursor(?:\.js)?$/i,
  /(?:^|[\\/])opencode(?:\.js)?$/i,
  /(?:^|[\\/])codex$/i,
  /(?:^|[\\/])gemini(?:\.js)?$/i,
  /(?:^|[\\/])kimi(?:\.js)?$/i,
  /(?:^|[\\/])mimocode(?:\.js)?$/i,
  /(?:^|[\\/])mimo-code(?:\.js)?$/i,
  /(?:^|[\\/])antigravity(?:\.js)?$/i,
  /(?:^|[\\/])agy(?:\.js)?$/i,
];

export function processStartToken(pid = process.pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    return stat.slice(close + 2).trim().split(/\s+/)[19] || null;
  } catch {
    return null;
  }
}

function commBase(comm) {
  return String(comm || "").trim().split(/[\\/]/).pop().replace(/\.(exe|bin)$/i, "").toLowerCase();
}

export function isPersistentHarness(comm, cmdline) {
  const base = commBase(comm);
  if (PERSISTENT_HARNESS_NAMES.has(base)) return true;
  const args = String(cmdline || "").split("\0").filter(Boolean);
  // Find the first non-flag argument after node/executable (the entrypoint script)
  if (args.length > 1) {
    for (let i = 1; i < args.length; i++) {
      const token = args[i];
      if (token.startsWith("-")) continue;
      return PERSISTENT_HARNESS_SCRIPTS.some((pattern) => pattern.test(token));
    }
  }
  return false;
}

function isNodeRunningScript(comm, cmdline) {
  const base = commBase(comm);
  // Node v24+ reports "MainThread" as comm; treat it as a node process.
  if (base !== "node" && base !== "nodejs" && base !== "mainthread") return false;
  // If the node process is running a known persistent harness script (e.g. claude.js, grok.js),
  // it is NOT a transient script helper — it IS the persistent harness!
  if (isPersistentHarness(comm, cmdline)) return false;
  const args = String(cmdline || "").split("\0").filter(Boolean);
  for (let i = 1; i < args.length; i++) {
    const token = args[i];
    if (token === "-e" || token === "--eval" || token === "-p" || token === "--print") return true;
    if (token.startsWith("-")) {
      const flag = token.split("=")[0];
      if (NODE_VALUE_FLAGS.has(flag) && !token.includes("=")) i += 1;
      continue;
    }
    return true;
  }
  return false;
}

function isTransientProcess(comm, cmdline) {
  if (isPersistentHarness(comm, cmdline)) return false;
  if (TRANSIENT_COMMS.has(commBase(comm))) return true;
  return isNodeRunningScript(comm, cmdline);
}

function defaultInspectProcess(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    const rest = stat.slice(close + 2).trim().split(/\s+/);
    const ppid = Number(rest[1]);
    let comm = "";
    try { comm = fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim(); }
    catch { comm = stat.slice(stat.indexOf("(") + 1, close); }
    let cmdline = "";
    try { cmdline = fs.readFileSync(`/proc/${pid}/cmdline`); }
    catch { cmdline = ""; }
    return {
      comm,
      cmdline,
      ppid: Number.isInteger(ppid) ? ppid : null,
    };
  } catch {
    return null;
  }
}

/**
 * Walk past ephemeral shells / node-script helpers to the persistent host
 * harness. Returns harness_tracked:true only when a pid > 1 that is not a
 * transient shell was identified.
 *
 * @param {{ pid?: number, inspect?: (pid: number) => ({ comm: string, cmdline?: string, ppid?: number } | null) }} [options]
 */
export function findHarnessProcessIdentity(options = {}) {
  const inspect = typeof options.inspect === "function" ? options.inspect : defaultInspectProcess;
  const startPid = Number.isInteger(options.pid) ? options.pid : process.pid;
  const seen = new Set();
  let pid = startPid;
  let harnessPid = null;

  for (let depth = 0; depth < MAX_HARNESS_WALK; depth++) {
    if (!Number.isInteger(pid) || pid <= 1 || seen.has(pid)) break;
    seen.add(pid);
    const info = inspect(pid);
    if (!info) break;
    if (isPersistentHarness(info.comm, info.cmdline)) {
      harnessPid = pid;
      break;
    }
    if (isTransientProcess(info.comm, info.cmdline)) {
      pid = Number.isInteger(info.ppid) ? info.ppid : null;
      continue;
    }
    // Non-transient, but not a recognized harness (e.g. random compiled binary or desktop app):
    harnessPid = pid;
    break;
  }

  if (Number.isInteger(harnessPid) && harnessPid > 1) {
    const info = inspect(harnessPid);
    const isKnown = info ? isPersistentHarness(info.comm, info.cmdline) : false;
    return {
      pid: harnessPid,
      harness_tracked: isKnown,
      start_token: processStartToken(harnessPid),
    };
  }
  return {
    pid: process.pid,
    harness_tracked: false,
    start_token: processStartToken(process.pid),
  };
}

export function ownerProcessIdentity() {
  const found = findHarnessProcessIdentity();
  return {
    hostname: os.hostname(),
    pid: found.pid,
    start_token: found.start_token,
    harness_tracked: found.harness_tracked === true,
  };
}

/**
 * @returns {true|false|null} true=provably alive, false=provably dead,
 *          null=undecidable (foreign host, missing identity, unreadable proc).
 */
export function processIsAlive(identity) {
  if (typeof identity === "number") {
    if (!Number.isInteger(identity) || identity < 1) return null;
    identity = { hostname: os.hostname(), pid: identity };
  }
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

function ownerProcessPid(ownerProcess) {
  if (typeof ownerProcess === "number") return ownerProcess;
  if (ownerProcess && typeof ownerProcess === "object" && Number.isInteger(ownerProcess.pid)) {
    return ownerProcess.pid;
  }
  return null;
}

/**
 * True when the requester is the same live harness application that already
 * owns this lease (same PID, or this process's live harness parent) on this
 * host. A new Cursor/Codex tab or conversation under that live PID is a
 * successor, not a foreign owner. Untracked test/shell pids never qualify.
 */
export function isSameLiveHarnessSuccessor(lease, options = {}) {
  const stored = lease?.owner_process;
  const storedPid = ownerProcessPid(stored);
  if (!Number.isInteger(storedPid) || storedPid <= 1) return false;
  if (stored && typeof stored === "object" && stored.hostname && stored.hostname !== os.hostname()) {
    return false;
  }
  if (processIsAlive(stored) !== true) return false;

  const host = String(options.host || process.env.SVC_HOST || "").trim().toLowerCase();
  if (host === "cursor") return false;

  const inspect = typeof options.inspect === "function" ? options.inspect : undefined;
  const current = findHarnessProcessIdentity(inspect ? { inspect, pid: options.pid, host } : { host, ...options });
  const storedTracked = lease?.owner_harness_tracked === true || stored?.harness_tracked === true;
  if (!storedTracked || current.harness_tracked !== true) return false;
  return Number.isInteger(current.pid) && current.pid > 1 && storedPid === current.pid;
}
