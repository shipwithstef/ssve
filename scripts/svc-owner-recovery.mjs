#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { currentPromotionTuple, mintPromotionCapability, consumePromotionCapability } from "../hooks/codex/lib/promotion-capability.mjs";
import { armOwnerLease, readOwnerLease, disarmOwnerLease } from "../hooks/codex/lib/owner-lease.mjs";
const env = process.env; const sid = String(env.SVC_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || ""); const args = process.argv.slice(2); const cmd = args.shift();
function value(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : ""; }
const repo = path.resolve(value("--repo") || process.cwd()); const worktree = path.resolve(value("--worktree") || repo); if (!sid) throw new Error("stable Codex session identity is required in the environment");
function processStartToken(pid = process.pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    return stat.slice(close + 2).trim().split(/\s+/)[19] || null;
  } catch { return null; }
}
function processIsAlive(identity) {
  if (!identity || identity.hostname !== os.hostname() || !Number.isInteger(identity.pid) || identity.pid < 1) return null;
  try { process.kill(identity.pid, 0); }
  catch (error) { return error.code === "ESRCH" ? false : null; }
  if (identity.start_token) {
    const current = processStartToken(identity.pid);
    if (!current) return null;
    return current === identity.start_token;
  }
  return true;
}
function reclaimProvablyDeadLock(lock) {
  try {
    const stat = fs.lstatSync(lock);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    const [pidText, hostname = "", startToken = ""] = fs.readFileSync(lock, "utf8").trim().split("\n");
    if (hostname !== os.hostname()) return false;
    const identity = { hostname, pid: Number(pidText), start_token: startToken || null };
    if (processIsAlive(identity) !== false) return false;
    const current = fs.lstatSync(lock);
    if (current.dev !== stat.dev || current.ino !== stat.ino) return false;
    fs.unlinkSync(lock);
    return true;
  } catch { return false; }
}
function withPromotionLock(operation) {
  const lock = path.join(worktree, ".svc", "promotion-exec.lock"); fs.mkdirSync(path.dirname(lock), { recursive: true }); let fd;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      fd = fs.openSync(lock, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
      fs.writeFileSync(fd, `${process.pid}\n${os.hostname()}\n${processStartToken(process.pid) || ""}\n`);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (reclaimProvablyDeadLock(lock)) continue;
      if (attempt === 499) throw new Error("promotion execution lock timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return operation(); }
  finally {
    if (fd !== undefined) {
      try {
        const stat = fs.fstatSync(fd);
        const current = fs.lstatSync(lock);
        if (current.dev === stat.dev && current.ino === stat.ino) fs.unlinkSync(lock);
      } catch {}
      fs.closeSync(fd);
    }
  }
}
function executeBoundPromotion(tuple, childArgv) {
  if (tuple.operation === "local-land") {
    const commit = execFileSync("git", ["-C", worktree, "commit-tree", tuple.tree_sha, "-p", tuple.head_sha, "-m", childArgv[3]], { encoding: "utf8", env }).trim();
    execFileSync("git", ["-C", worktree, "update-ref", `refs/heads/${tuple.branch}`, commit, tuple.head_sha], { env, stdio: "inherit" });
    return;
  }
  const launched = spawnSync(childArgv[0], childArgv.slice(1), { cwd: worktree, env, stdio: "inherit" });
  if (launched.error) throw launched.error; if (launched.status !== 0) throw Object.assign(new Error(`promotion command exited ${launched.status ?? 1}`), { exitCode: launched.status ?? 1 });
}
if (cmd === "arm") console.log(JSON.stringify(armOwnerLease({ repo_root: repo, worktree_root: worktree, wi: value("--wi") || "owner-override", session_id: sid, reason: value("--reason"), ttl_min: Number(value("--ttl-min") || 24 * 60), env }), null, 2));
else if (cmd === "status") console.log(JSON.stringify(readOwnerLease(repo, sid, env), null, 2));
else if (cmd === "disarm") console.log(JSON.stringify({ disarmed: disarmOwnerLease(repo, sid, env) }));
else if (cmd === "legacy-adopt") {
  const wi = value("--wi"); const branch = value("--branch");
  if (!wi || !branch) throw new Error("legacy-adopt requires --wi and --branch");
  const repoReal = fs.realpathSync(repo); const worktreeReal = fs.realpathSync(worktree);
  const registered = execFileSync("git", ["-C", repoReal, "worktree", "list", "--porcelain"], { encoding: "utf8" });
  if (!registered.includes(`worktree ${worktreeReal}\n`) || execFileSync("git", ["-C", worktreeReal, "branch", "--show-current"], { encoding: "utf8" }).trim() !== branch) throw new Error("legacy-adopt exact registered worktree/branch mismatch");
  for (const candidate of [worktreeReal, path.join(worktreeReal, ".svc")]) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error("legacy-adopt insecure or foreign-owned path");
  }
  const output = execFileSync(process.execPath, [path.join(repoReal, "scripts", "svc-ensure-worktree.mjs"), "--wi", wi, "--branch", branch, "--from", "origin/main", "--authority-v2", "--json"], { cwd: repoReal, env, encoding: "utf8" });
  process.stdout.write(output);
}
else if (["promote-mint", "promote-consume", "promote-exec"].includes(cmd)) {
  const separator = args.indexOf("--"); const childArgv = separator >= 0 ? args.slice(separator + 1) : [];
  if (childArgv.length === 0) throw new Error(`${cmd} requires -- <exact executable argv>`);
  const stateRoot = path.resolve(value("--state-root"));
  const act = () => {
    const tuple = currentPromotionTuple({ repoRoot: repo, worktreeRoot: worktree, wi: value("--wi"), sessionId: sid,
      generation: Number(value("--generation")), taskId: value("--task"), environment: value("--environment"), operation: value("--operation"), commandArgv: childArgv });
    for (const [flag, field] of [["--repo-id","repo_id"],["--branch","branch"],["--head-sha","head_sha"],["--tree-sha","tree_sha"]]) {
      const asserted = value(flag); if (asserted && asserted !== tuple[field]) throw new Error(`${flag} does not match current promotion authority`);
    }
    const result = cmd === "promote-mint" ? mintPromotionCapability({ stateRoot, tuple, ttlMs: Number(value("--ttl-ms") || 120000) })
      : consumePromotionCapability({ stateRoot, capabilityId: value("--capability"), token: value("--token"), expected: tuple });
    if (cmd === "promote-exec") executeBoundPromotion(tuple, childArgv);
    return result;
  };
  const result = cmd === "promote-exec" ? withPromotionLock(act) : act();
  console.log(JSON.stringify(result, null, 2));
}
else throw new Error("Usage: svc-owner-recovery.mjs <arm|status|disarm|legacy-adopt|promote-mint|promote-consume|promote-exec> --repo ABS --worktree ABS [exact tuple fields]");
