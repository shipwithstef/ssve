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
  runtimeRoot,
  repoIdentity,
} from "../codex/lib/codex-hook-context.mjs";
import { findSvcDir } from "../lib/resolve-wi.mjs";
import { isAuthoritativeMutatingBinding } from "../lib/authoritative-binding.mjs";
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

function logCursorHookEvent(eventData) {
  try {
    const root = runtimeRoot(process.env);
    if (!root || !fs.existsSync(root)) return;
    const logFile = path.join(root, "cursor-hook-events.jsonl");
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...eventData,
    }) + "\n";
    fs.appendFileSync(logFile, entry, { mode: 0o600 });
  } catch {}
}

function handleBeforeSubmitPrompt(payload) {
  try {
    const text = promptText(payload);
    const match = String(text).match(/(?:^|\r?\n)\s*SVC OWNER OVERRIDE:\s*(.+?)(?:\r?\n|$)/i);
    let overrideMessage = null;
    let overrideWorktree = null;
    if (match) {
      const sid = sessionId(payload);
      const rawCwd = payload.cwd || (Array.isArray(payload.workspace_roots) && payload.workspace_roots[0]) || process.cwd();
      const repo = findRepoRoot(rawCwd);
      const bound = governanceBinding({ ...payload, cwd: rawCwd });
      const worktree = bound?.worktree || repo;
      if (!sid || !repo || !worktree) {
        logCursorHookEvent({
          event: "beforeSubmitPrompt",
          payload_session_id: payload?.session_id || payload?.sessionId || null,
          payload_conversation_id: payload?.conversation_id || payload?.conversationId || null,
          decision: "deny",
          rejection_reason: "SVC owner override requires a repository and stable session",
        });
        process.stdout.write(JSON.stringify({ continue: false, user_message: "SVC owner override requires a repository and stable session" }) + "\n");
        process.exit(0);
      }
      armOwnerLease({ repo_root: repo, worktree_root: worktree, wi: bound?.tuple?.wi || explicitWI(text) || "owner-override", session_id: sid, reason: match[1] });
      overrideMessage = "SVC owner override armed for 24 hours in the selected worktree; it will expire automatically.";
      overrideWorktree = worktree;
    }

    const ctx = hookContext(payload);
    if (ctx.repo_root && ctx.session_id && ctx.turn_id && ctx.session_dir) {
      const previous = readJson(authorityPath(ctx));
      const explicit = explicitWI(text);
      const classified = continuationIntent(text, { distinguishNegative: true });
      const intent = match && classified !== "negative" ? "resume" : (classified === "negative" ? "none" : classified);
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
        governance_worktree: ctx.governance_worktree || overrideWorktree || null,
        explicit_wi: explicit || (sameGoal ? previous.explicit_wi : null) || ctx.governance_tuple?.wi || bound?.tuple?.wi || (match ? "owner-override" : null),
        continuation_intent: revoked ? "none" : resumed ? intent : inherited ? previous.continuation_intent : intent,
        authorization_prompt_hash: inherited ? (previous.authorization_prompt_hash || previous.prompt_hash) : sha256(text),
        authorization_turn_id: inherited ? (previous.authorization_turn_id || previous.turn_id) : ctx.turn_id,
        recorded_at: new Date().toISOString(),
      });
      try {
        const repoDir = path.join(runtimeRoot(process.env), repoIdentity(ctx.repo_root));
        const activeFile = path.join(repoDir, "active-cursor-session.json");
        atomicWriteJson(activeFile, {
          schema_version: SCHEMA_VERSION,
          session_id: ctx.session_id,
          turn_id: ctx.turn_id,
          repo_root: ctx.repo_root,
          recorded_at: new Date().toISOString(),
        });
      } catch {}
      logCursorHookEvent({
        event: "beforeSubmitPrompt",
        payload_session_id: payload?.session_id || payload?.sessionId || null,
        payload_conversation_id: payload?.conversation_id || payload?.conversationId || null,
        payload_generation_id: payload?.turn_id || payload?.turnId || payload?.generation_id || payload?.generationId || null,
        resolved_sid: ctx.session_id,
        resolved_turn: ctx.turn_id,
        repo_root: ctx.repo_root,
        authority_path: authorityPath(ctx),
        authority_exists: true,
        decision: "continue",
        rejection_reason: null,
        empty_id_recovered: false,
      });
      sweep(ctx.repo_root, ctx.session_dir, process.env);
    }
    process.stdout.write(JSON.stringify({ continue: true, ...(overrideMessage ? { user_message: overrideMessage } : {}) }) + "\n");
    process.exit(0);
  } catch (err) {
    // Fail open for prompt submit so author can communicate even if advisory fails
    process.stderr.write(`[svc-cursor-adapter] prompt authority advisory: ${err.message}\n`);
  }
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
  process.exit(0);
}

function handlePreTool(payload, { isShellExecEvent = false } = {}) {
  let extractedToolName = "";
  let extractedToolInput = null;
  if (payload?.tool_call && typeof payload.tool_call === "object") {
    const keys = Object.keys(payload.tool_call);
    if (keys.length > 0) {
      extractedToolName = keys[0];
      const callObj = payload.tool_call[keys[0]];
      extractedToolInput = callObj?.args || callObj?.arguments || callObj?.input || callObj;
    }
  } else if (payload?.toolCall && typeof payload.toolCall === "object") {
    const keys = Object.keys(payload.toolCall);
    if (keys.length > 0) {
      extractedToolName = keys[0];
      const callObj = payload.toolCall[keys[0]];
      extractedToolInput = callObj?.args || callObj?.arguments || callObj?.input || callObj;
    }
  }
  let mappedToolName = extractedToolName;
  if (extractedToolName === "shellToolCall") mappedToolName = "Shell";

  const rawToolName = isShellExecEvent ? "Shell" : String(payload?.tool_name || payload?.toolName || payload?.tool || mappedToolName || "");

  const initialInput = isShellExecEvent
    ? { command: payload?.command || "", cwd: payload?.cwd || payload?.workingDirectory || process.cwd() }
    : (payload?.tool_input || payload?.toolInput || payload?.arguments || payload?.args || extractedToolInput || {});
  const toolInput = initialInput && typeof initialInput === "object" ? { ...initialInput } : {};

  // Payload identity first. Launch-env conversation IDs must not preempt
  // repo-local recovery when Cursor omits conversation_id or a later chat
  // owns the active session file.
  let sid = String(
    payload?.session_id ||
    payload?.sessionId ||
    payload?.conversation_id ||
    payload?.conversationId ||
    payload?.thread_id ||
    payload?.threadId ||
    payload?.metadata?.session_id ||
    payload?.metadata?.sessionId ||
    payload?.metadata?.conversation_id ||
    payload?.metadata?.conversationId ||
    ""
  );
  let turn = String(payload?.turn_id || payload?.turnId || payload?.generation_id || payload?.generationId || "");
  let emptyIdRecovered = false;
  const rawCwd = payload?.cwd || payload?.working_directory || payload?.workingDirectory ||
    toolInput?.workingDirectory || toolInput?.workdir || toolInput?.cwd ||
    (Array.isArray(payload?.workspace_roots) && payload.workspace_roots[0]) ||
    process.cwd();
  const repo = findRepoRoot(rawCwd);

  if (!sid && repo) {
    try {
      const repoDir = path.join(runtimeRoot(process.env), repoIdentity(repo));
      const activeFile = path.join(repoDir, "active-cursor-session.json");
      const active = readJson(activeFile);
      if (active?.session_id) {
        const ttlMinutes = Number(process.env.SVC_CODEX_AUTHORITY_TTL_MIN || 240);
        const recorded = Date.parse(active.recorded_at || "");
        if (Number.isFinite(recorded) && Date.now() - recorded <= Math.max(1, ttlMinutes) * 60_000) {
          sid = String(active.session_id);
          if (!turn || turn.startsWith("session:")) {
            turn = String(active.turn_id || turn || `session:${sid}`);
          }
          emptyIdRecovered = true;
        }
      }
    } catch {}
    if (!sid) {
      try {
        const svcDir = findSvcDir(repo);
        if (svcDir) {
          const bDir = path.join(svcDir, "bindings");
          if (fs.existsSync(bDir)) {
            const activeBindings = [];
            for (const name of fs.readdirSync(bDir)) {
              if (!name.endsWith(".json")) continue;
              const b = readJson(path.join(bDir, name));
              if (b?.session_id && isAuthoritativeMutatingBinding(b, { sessionId: b.session_id, host: "cursor", env: process.env })) {
                activeBindings.push(b);
              }
            }
            if (activeBindings.length === 1) {
              sid = String(activeBindings[0].session_id);
              if (!turn || turn.startsWith("session:")) turn = `session:${sid}`;
              emptyIdRecovered = true;
            }
          }
        }
      } catch {}
    }
  }

  if (!sid) {
    sid = sessionId(payload);
  }
  if (!turn) {
    turn = sid ? `session:${sid}` : "";
  }

  let authPath = null;
  let authExists = false;
  if (repo && sid) {
    try {
      const ctx = hookContext({ ...payload, session_id: sid, cwd: rawCwd });
      if (ctx.session_dir) {
        authPath = authorityPath(ctx);
        authExists = fs.existsSync(authPath);
      }
    } catch {}
  }

  const logExit = (decision, reason = null) => {
    logCursorHookEvent({
      event: isShellExecEvent ? "beforeShellExecution" : "pretool",
      tool_name: rawToolName,
      payload_session_id: payload?.session_id || payload?.sessionId || null,
      payload_conversation_id: payload?.conversation_id || payload?.conversationId || null,
      payload_generation_id: payload?.turn_id || payload?.turnId || payload?.generation_id || payload?.generationId || null,
      resolved_sid: sid || null,
      resolved_turn: turn || null,
      repo_root: repo,
      authority_path: authPath,
      authority_exists: authExists,
      decision,
      rejection_reason: reason,
      empty_id_recovered: emptyIdRecovered,
    });
  };

  try {
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
      logExit("allow", null);
      if (observation.execution_input && isShellTool(rawToolName) && !isShellExecEvent) {
        process.stdout.write(JSON.stringify({ permission: "allow", updated_input: observation.execution_input }) + "\n");
      } else {
        process.stdout.write(JSON.stringify({ permission: "allow" }) + "\n");
      }
      process.exit(0);
    }

    // 2. Governed mutation dispatcher
    const defaultDispatcherPath = path.resolve(HERE, "..", "codex", "svc-codex-pretool-dispatcher.mjs");
    const dispatcherPath = process.env.SVC_CURSOR_DISPATCHER_OVERRIDE || defaultDispatcherPath;
    const result = spawnSync(process.execPath, [dispatcherPath], {
      input: JSON.stringify(normalized),
      encoding: "utf8",
      env: { ...process.env, SVC_HOST: "cursor", CURSOR_CONVERSATION_ID: sid },
    });

    if (result.error || result.status !== 0) {
      const reason = result.error?.message || result.stderr?.trim() || "Cursor pretool child process failed closed";
      logExit("deny", reason);
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
      process.exit(0);
    }

    const stdout = String(result.stdout || "").trim();
    if (!stdout) {
      const reason = "child dispatcher emitted no output; failing closed";
      logExit("deny", reason);
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
      process.exit(0);
    }

    let decision;
    try {
      decision = JSON.parse(stdout.split(/\r?\n/).filter(Boolean).at(-1));
    } catch {
      const reason = "child emitted an unparseable decision; failing closed";
      logExit("deny", reason);
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
      process.exit(0);
    }

    const isDeny = decision?.permission === "deny" || decision?.hookSpecificOutput?.permissionDecision === "deny" || decision?.decision === "deny";
    if (isDeny) {
      const reason = decision?.user_message || decision?.hookSpecificOutput?.permissionDecisionReason || decision?.reason || "operation denied";
      logExit("deny", reason);
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
      process.exit(0);
    }

    const updatedInput = decision?.updated_input || decision?.hookSpecificOutput?.updatedInput;
    if (updatedInput) {
      const loader = (typeof updatedInput.command === "string" && updatedInput.command) ||
                     (typeof updatedInput.cmd === "string" && updatedInput.cmd) || "";
      const isSkillLoader = /codex-load-skill/i.test(loader);

      if (isShellTool(rawToolName) && !isShellExecEvent) {
        logExit("allow", null);
        const msg = decision?.user_message || decision?.systemMessage;
        process.stdout.write(JSON.stringify({
          permission: "allow",
          updated_input: updatedInput,
          ...(msg ? { user_message: msg } : {}),
        }) + "\n");
        process.exit(0);
      }

      // If a non-shell tool was given a skill loader command rewrite, it cannot run shell commands:
      // deny with the specific loader instruction so the user/agent can load the skill.
      if (isSkillLoader && loader) {
        const reason = `SSVE restored the authorized WI. Load its current skill before retrying: ${loader}`;
        logExit("deny", reason);
        process.stdout.write(JSON.stringify({
          permission: "deny",
          user_message: reason,
        }) + "\n");
        process.exit(0);
      }

      // Ordinary tool updates: clean shell-only workdir out of non-shell tool schemas
      const cleaned = { ...updatedInput };
      if (!isShellTool(rawToolName)) {
        delete cleaned.workdir;
      }

      logExit("allow", null);
      const msg = decision?.user_message || decision?.systemMessage;
      const hasUpdates = Object.keys(cleaned).length > 0;
      process.stdout.write(JSON.stringify({
        permission: "allow",
        ...(hasUpdates && !isShellExecEvent ? { updated_input: cleaned } : {}),
        ...(msg ? { user_message: msg } : {}),
      }) + "\n");
      process.exit(0);
    }

    logExit("allow", null);
    process.stdout.write(JSON.stringify({ permission: "allow" }) + "\n");
    process.exit(0);
  } catch (error) {
    const reason = `Cursor pretool failed closed: ${error.message}`;
    logExit("deny", reason);
    process.stdout.write(JSON.stringify({ permission: "deny", user_message: reason }) + "\n");
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
  let payload;
  if (raw && raw.trim()) {
    try {
      payload = JSON.parse(raw);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("payload must be a JSON object");
      }
    } catch (err) {
      if (mode === "--before-submit-prompt") {
        process.stdout.write(JSON.stringify({ continue: false, user_message: `Cursor hook received malformed payload: ${err.message}` }) + "\n");
        process.exit(0);
      }
      process.stdout.write(JSON.stringify({ permission: "deny", user_message: `Cursor hook received malformed payload: ${err.message}` }) + "\n");
      process.exit(0);
    }
  } else {
    payload = {};
  }

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
