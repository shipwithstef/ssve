#!/usr/bin/env node
import path from "node:path";
import { armOwnerLease, readOwnerLease, disarmOwnerLease } from "../hooks/codex/lib/owner-lease.mjs";
const env = process.env; const sid = String(env.SVC_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || ""); const args = process.argv.slice(2); const cmd = args.shift();
function value(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : ""; }
const repo = path.resolve(value("--repo") || process.cwd()); const worktree = path.resolve(value("--worktree") || repo); if (!sid) throw new Error("stable Codex session identity is required in the environment");
if (cmd === "arm") console.log(JSON.stringify(armOwnerLease({ repo_root: repo, worktree_root: worktree, wi: value("--wi") || "owner-override", session_id: sid, reason: value("--reason"), ttl_min: Number(value("--ttl-min") || 15), env }), null, 2));
else if (cmd === "status") console.log(JSON.stringify(readOwnerLease(repo, sid, env), null, 2));
else if (cmd === "disarm") console.log(JSON.stringify({ disarmed: disarmOwnerLease(repo, sid, env) }));
else throw new Error("Usage: svc-owner-recovery.mjs <arm|status|disarm> --repo ABS --worktree ABS [--wi WI --reason TEXT --ttl-min 1..30]");
