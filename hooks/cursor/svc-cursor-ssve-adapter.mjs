#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  SCHEMA_VERSION,
  parseHookInput,
  hookContext,
  authorityPath,
  atomicWriteJson,
  explicitWI,
  continuationIntent,
  sha256,
  readJson,
  findRepoRoot,
  sessionId,
  turnId,
  governanceBinding,
  isReadOnlyTool,
} from "../codex/lib/codex-hook-context.mjs";
import { armOwnerLease } from "../codex/lib/owner-lease.mjs";
import { evaluatePreToolObservation } from "../lib/pretool-decision-engine.mjs";
import { isShellTool } from "../lib/shell-tools.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function promptText(payload) {
  const value = payload.prompt ?? payload.user_prompt ?? payload.content ?? payload.message ?? "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((p) => typeof p === "string" ? p : p?.text || "").join("\n");
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

function handleBeforeSubmitPrompt(payload) {
  try {
    const text = promptText(payload);
    const match = String(text).split(/\r?\n/)[0].match(/^\s*SVC OWNER OVERRIDE:\s*(.+?)\s*$/i);
    if (match) {
      const sid = sessionId(payload);
      const rawCwd = payload.cwd || (Array.isArray(payload.workspace_roots) && payload.workspace_roots[0]) || process.cwd();
      const repo = findRepoRoot(rawCwd);
      const bound = governanceBinding({ ...payload, cwd: rawCwd });
      const worktree = bound?.worktree || repo;
      if (!sid || !repo || !worktree) {
        process.stdout.write(JSON.stringify({ continue: false, user_message: "SVC owner override requires a repository and stable session" }) + "\n");
        process.exit(0);
      }
      armOwnerLease({ repo_root: repo, worktree_root: worktree, wi: bound?.tuple?.wi || "owner-override", session_id: sid, reason: match[1] });
      process.stdout.write(JSON.stringify({ continue: true, user_message: "SVC owner override armed for 24 hours in the selected worktree; it will expire automatically." }) + "\n");
      process.exit(0);
    }

    const ctx = hookContext(payload);
    if (ctx.repo_root && ctx.session_id && ctx.turn_id && ctx.session_dir) {
      const previous = readJson(authorityPath(ctx));
      const explicit = explicitWI(text);
      const classified = continuationIntent(text, { distinguishNegative: true });
      const intent = classified === "negative" ? "none" : classified;
      const revoked = classified === "negative" || /(?:^|[.!?\n]\s*)(?:please\s+)?(?:stop|pause|cancel|abandon)(?:\s+(?:that|it))?(?:\s+(?:this|the|current|active)\s+(?:task|work|wi|session))?(?:\s+(?:please|now))?[.!?\s]*$/i.test(text)
        || /\b(?:do not|don['’]?t)\s+(?:continue|resume|work|implement|change|modify|touch|edit|write)\b|\b(?:only\s+(?:inspect|read|explain|analy[sz]e)|read.only|leave\s+(?:it|everything|this)\s+unchanged|no\s+(?:changes|edits|mutations))\b/i.test(text);
      const sameGoal = !explicit && previous?.session_id === ctx.session_id &&
        previous?.repo_root === ctx.repo_root && previous?.explicit_wi;
      const positive = ["resume", "continue", "finish", "complete", "work_on", "end_to_end"];
      const inherited = sameGoal && !revoked && positive.includes(previous.continuation_intent);
      const resumed = sameGoal && !revoked && positive.includes(intent);
      atomicWriteJson(authorityPath(ctx), {
        schema_version: SCHEMA_VERSION,
        session_id: ctx.session_id,
        turn_id: ctx.turn_id,
        prompt_hash: sha256(text),
        cwd: ctx.session_cwd || ctx.cwd,
        session_cwd: ctx.session_cwd || ctx.cwd,
        repo_root: ctx.repo_root,
        governance_worktree: ctx.governance_worktree || null,
        explicit_wi: sameGoal ? previous.explicit_wi : explicit,
        continuation_intent: revoked ? "none" : resumed ? intent : inherited ? previous.continuation_intent : intent,
        authorization_prompt_hash: inherited ? (previous.authorization_prompt_hash || previous.prompt_hash) : sha256(text),
        authorization_turn_id: inherited ? (previous.authorization_turn_id || previous.turn_id) : ctx.turn_id,
        recorded_at: new Date().toISOString(),
      });
      sweep(ctx.repo_root, ctx.session_dir, process.env);
    }
  } catch (err) {
    // Fail open for prompt submit so author can communicate even if advisory fails
    process.stderr.write(`[svc-cursor-adapter] prompt authority advisory: ${err.message}\n`);
  }
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
  process.exit(0);
}

function handlePreTool(payload, { isShellExecEvent = false } = {}) {
  try {
    const rawToolName = isShellExecEvent ? "Shell" : String(payload.tool_name || payload.toolName || payload.tool || "");
    const toolInput = isShellExecEvent
      ? { command: payload.command || "", cwd: payload.cwd || process.cwd() }
      : (payload.tool_input || payload.toolInput || payload.arguments || payload.args || {});
    const sid = sessionId(payload);
    const turn = turnId(payload);
    const rawCwd = payload.cwd || payload.working_directory || (Array.isArray(payload.workspace_roots) && payload.workspace_roots[0]) || process.cwd();

    const normalized = {
      ...payload,
      tool_name: rawToolName,
      tool_input: toolInput,
      session_id: sid,
      turn_id: turn,
      cwd: rawCwd,
    };

    // 1. Observation fast-path
    const observation = evaluatePreToolObservation(normalized);
    if (observation) {
      if (observation.execution_input && isShellTool(rawToolName) && !isShellExecEvent) {
        process.stdout.write(JSON.stringify({ permission: "allow", updated_input: observation.execution_input }) + "\n");
      } else {
        process.stdout.write(JSON.stringify({ permission: "allow" }) + "\n");
      }
      process.exit(0);
    }

    // 2. Governed mutation dispatcher
    const dispatcherPath = path.resolve(HERE, "..", "codex", "svc-codex-pretool-dispatcher.mjs");
    const result = spawnSync(process.execPath, [dispatcherPath], {
      input: JSON.stringify(normalized),
      encoding: "utf8",
      env: { ...process.env, SVC_HOST: "cursor", CURSOR_CONVERSATION_ID: sid },
    });

    if (result.status !== 0) {
      const reason = result.stderr?.trim() || "Cursor pretool failed closed";
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
      process.exit(0);
    }

    const stdout = String(result.stdout || "").trim();
    if (!stdout) {
      process.stdout.write(JSON.stringify({ permission: "allow" }) + "\n");
      process.exit(0);
    }

    let decision;
    try {
      decision = JSON.parse(stdout.split(/\r?\n/).filter(Boolean).at(-1));
    } catch {
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: "child emitted an unparseable decision; failing closed" }) + "\n");
      process.exit(0);
    }

    const isDeny = decision?.permission === "deny" || decision?.hookSpecificOutput?.permissionDecision === "deny" || decision?.decision === "deny";
    if (isDeny) {
      const reason = decision?.user_message || decision?.hookSpecificOutput?.permissionDecisionReason || decision?.reason || "operation denied";
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
      process.exit(0);
    }

    const updatedInput = decision?.updated_input || decision?.hookSpecificOutput?.updatedInput;
    if (updatedInput) {
      if (isShellTool(rawToolName) && !isShellExecEvent) {
        const msg = decision?.user_message || decision?.systemMessage;
        process.stdout.write(JSON.stringify({
          permission: "allow",
          updated_input: updatedInput,
          ...(msg ? { user_message: msg } : {}),
        }) + "\n");
        process.exit(0);
      }
      // Rewriting non-shell or beforeShellExecution is unsupported in Cursor: deny with instruction
      const loader = updatedInput.command || updatedInput.cmd || "";
      process.stdout.write(JSON.stringify({
        permission: "deny",
        user_message: `SSVE restored the authorized WI. Load its current skill before retrying: ${loader}`,
      }) + "\n");
      process.exit(0);
    }

    process.stdout.write(JSON.stringify({ permission: "allow" }) + "\n");
    process.exit(0);
  } catch (error) {
    process.stdout.write(JSON.stringify({ permission: "deny", user_message: `Cursor pretool failed closed: ${error.message}` }) + "\n");
    process.exit(0);
  }
}

function handleStop(payload) {
  const guardPath = path.resolve(HERE, "svc-cursor-task-completion-guard.sh");
  if (!fs.existsSync(guardPath)) {
    process.stderr.write("Cursor task completion guard missing\n");
    process.exit(2);
  }
  const result = spawnSync("bash", [guardPath], {
    input: JSON.stringify(payload),
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });
  process.exit(result.status ?? 2);
}

function handleSessionStart(payload) {
  const healthCheck = path.resolve(HERE, "..", "svc-session-start-healthcheck.mjs");
  if (fs.existsSync(healthCheck)) {
    spawnSync(process.execPath, [healthCheck], {
      input: JSON.stringify(payload),
      stdio: "inherit",
      env: process.env,
    });
  }
  process.stdout.write("{}\n");
  process.exit(0);
}

function handleAfterFileEdit(payload) {
  process.stdout.write("{}\n");
  process.exit(0);
}

function main() {
  const mode = process.argv[2] || "";
  const raw = readStdin();
  const payload = parseHookInput(raw);

  if (mode === "--before-submit-prompt") {
    handleBeforeSubmitPrompt(payload);
  } else if (mode === "--pretool") {
    handlePreTool(payload, { isShellExecEvent: false });
  } else if (mode === "--before-shell-execution") {
    handlePreTool(payload, { isShellExecEvent: true });
  } else if (mode === "--stop") {
    handleStop(payload);
  } else if (mode === "--session-start") {
    handleSessionStart(payload);
  } else if (mode === "--after-file-edit") {
    handleAfterFileEdit(payload);
  } else {
    // Default fallback: allow cleanly
    process.stdout.write("{}\n");
    process.exit(0);
  }
}

main();
