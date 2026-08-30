#!/usr/bin/env node
import fs from "node:fs";
import { parseHookInput, findRepoRoot, sessionId, governanceBinding } from "./lib/codex-hook-context.mjs";
import { armOwnerLease } from "./lib/owner-lease.mjs";
const payload = parseHookInput(fs.readFileSync(0, "utf8"));
const prompt = String(payload.prompt || payload.user_prompt || payload.content || payload.message || "");
const match = String(prompt).split(/\r?\n/)[0].match(/^\s*SVC OWNER OVERRIDE:\s*(.+?)\s*$/i);
if (!match) { process.stdout.write("{}\n"); process.exit(0); }
try { const sid = sessionId(payload); const repo = findRepoRoot(payload.cwd || process.cwd()); const bound = governanceBinding(payload); const worktree = bound?.worktree || repo; if (!sid || !repo || !worktree) throw new Error("owner override requires a repository and stable session"); armOwnerLease({ repo_root: repo, worktree_root: worktree, wi: bound?.tuple?.wi || "owner-override", session_id: sid, reason: match[1] }); process.stdout.write(JSON.stringify({ systemMessage: "SVC owner override armed for 24 hours in the selected worktree; it will expire automatically." }) + "\n"); } catch (error) { process.stdout.write(JSON.stringify({ systemMessage: `SVC owner override denied: ${error.message}` }) + "\n"); }
