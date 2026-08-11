#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  SCHEMA_VERSION, parseHookInput, hookContext, authorityPath, atomicWriteJson,
  explicitWI, continuationIntent, sha256, runtimeRoot,
} from "./lib/codex-hook-context.mjs";

function promptText(payload) {
  const value = payload.prompt ?? payload.user_prompt ?? payload.content ?? payload.message ?? "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((part) => typeof part === "string" ? part : part?.text || "").join("\n");
  return String(value?.text || "");
}

function sweep(repoRoot, currentDir, env) {
  const ttlMinutes = Number(env.SVC_CODEX_AUTHORITY_TTL_MIN || 240);
  const repoDir = path.dirname(currentDir);
  const cutoff = Date.now() - Math.max(1, ttlMinutes) * 60_000;
  try {
    for (const entry of fs.readdirSync(repoDir, { withFileTypes: true })) {
      const candidate = path.join(repoDir, entry.name);
      if (!entry.isDirectory() || candidate === currentDir) continue;
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) continue;
      if (stat.mtimeMs < cutoff) fs.rmSync(candidate, { recursive: true, force: false });
    }
  } catch {}
}

const raw = fs.readFileSync(0, "utf8");
const payload = parseHookInput(raw);
try {
  const ctx = hookContext(payload);
  if (!ctx.repo_root || !ctx.session_id || !ctx.turn_id || !ctx.session_dir) {
    process.stdout.write("{}\n");
    process.exit(0);
  }
  const text = promptText(payload);
  atomicWriteJson(authorityPath(ctx), {
    schema_version: SCHEMA_VERSION,
    session_id: ctx.session_id,
    turn_id: ctx.turn_id,
    prompt_hash: sha256(text),
    cwd: ctx.session_cwd || ctx.cwd,
    session_cwd: ctx.session_cwd || ctx.cwd,
    repo_root: ctx.repo_root,
    governance_worktree: ctx.governance_worktree || null,
    explicit_wi: explicitWI(text),
    continuation_intent: continuationIntent(text),
    recorded_at: new Date().toISOString(),
  });
  sweep(ctx.repo_root, ctx.session_dir, process.env);
  process.stdout.write("{}\n");
} catch (error) {
  process.stdout.write(`${JSON.stringify({ systemMessage: `svc Codex authority advisory: ${error.message}` })}\n`);
}
