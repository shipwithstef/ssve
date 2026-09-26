#!/usr/bin/env node
// Hook-only boundary. Standalone validators and CLI commands stay strict.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { lexSimpleCommand } from "./codex/lib/argv-lex.mjs";
import { resolveHookMode, hookPolicyWarning } from "./lib/hook-policy.mjs";

const MAX_INPUT = 8 * 1024 * 1024;
const MAX_OUTPUT = 1024 * 1024;
const KNOWN_HOSTS = new Set(["claude", "codex", "kimi", "gemini", "cursor", "grok"]);

export function parseManagedCommand(raw, env = process.env) {
  // Every SVC wirer emits one literal command. Expand only its documented
  // default-host spelling and home shorthand; never invoke a shell here.
  const chosenHost = KNOWN_HOSTS.has(env.SVC_HOST) ? env.SVC_HOST : "claude";
  const home = env.HOME || os.homedir();
  const text = String(raw)
    .replaceAll('SVC_HOST="${SVC_HOST:-claude}"', `SVC_HOST=${chosenHost}`)
    .replace(/(^|\s)~(?=\/)/g, "$1__SVC_HOME__");
  const parsed = lexSimpleCommand(text);
  if (!parsed.ok) throw new Error(`unsupported managed command: ${parsed.reason}`);
  const argv = parsed.argv.map((arg) => arg.replace(/^__SVC_HOME__(?=\/)/, home));
  if (argv[0] === "env") argv.shift();
  const additions = {};
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0] || "")) {
    const word = argv.shift();
    const split = word.indexOf("=");
    additions[word.slice(0, split)] = word.slice(split + 1);
  }
  if (argv.length < 2 || !argv[0]) {
    throw new Error("managed hook command has no executable and script");
  }
  return { file: argv[0], args: argv.slice(1), env: { ...env, ...additions } };
}

const BLOCK_VALUES = new Set(["deny", "denied", "block", "blocked", "reject", "rejected", "ask"]);
export function isBlockingPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const nested = payload.hookSpecificOutput || {};
  return [payload.decision, payload.permission, payload.permissionDecision, nested.permissionDecision]
    .some((value) => BLOCK_VALUES.has(String(value || "").toLowerCase()))
    || payload.continue === false || payload.allow === false;
}

export function advisoryPayload(payload, message) {
  const clean = structuredClone(payload);
  delete clean.decision;
  delete clean.permission;
  delete clean.permissionDecision;
  delete clean.continue;
  delete clean.allow;
  delete clean.stopReason;
  delete clean.updatedInput;
  delete clean.updated_input;
  if (clean.hookSpecificOutput) {
    delete clean.hookSpecificOutput.permissionDecision;
    delete clean.hookSpecificOutput.permissionDecisionReason;
    delete clean.hookSpecificOutput.updatedInput;
    delete clean.hookSpecificOutput.updated_input;
    if (message) clean.hookSpecificOutput.additionalContext = [clean.hookSpecificOutput.additionalContext, message].filter(Boolean).join("\n");
  } else if (message) {
    clean.systemMessage = [clean.systemMessage, message].filter(Boolean).join("\n");
  }
  return clean;
}

function warning(id, reason) {
  return `[svc advisory ${id}] ${String(reason || "SVC hook requested a block").replace(/\s+/g, " ").slice(0, 1200)}`;
}

function deferredAdvisoryCommand(spec) {
  if (spec.event.toLowerCase().includes("sessionstart") && spec.command.includes("svc-session-start-healthcheck")) {
    let source = "";
    try {
      const receipt = JSON.parse(fs.readFileSync(path.join(process.env.HOME || os.homedir(), ".svc", "install-state", `${spec.host}.json`), "utf8"));
      if (typeof receipt.effective_source === "string" && path.isAbsolute(receipt.effective_source)) source = receipt.effective_source;
    } catch {}
    const command = source ? `cd '${source.replace(/'/g, "'\\''")}' && ./setup --host ${spec.host}`
      : `run setup --host ${spec.host} from the canonical SSVE source checkout`;
    return `automatic SessionStart install check deferred; if installation needs refresh, ${command}`;
  }
  if (spec.event.toLowerCase() === "stop" && /svc-(?:kimi-)?stop-quality/.test(spec.command)) {
    let quality = spec.command;
    try {
      const script = parseManagedCommand(spec.command).args[0];
      if (script.includes("svc-kimi-stop-quality.sh")) {
        quality = `node '${path.join(path.dirname(path.dirname(script)), "svc-stop-quality.js").replace(/'/g, "'\\''")}' --check`;
      }
    } catch {}
    return `automatic Stop quality check deferred; if files changed, run ${quality} from the project worktree`;
  }
  return "";
}

function decodeSpec(encoded) {
  if (!/^[A-Za-z0-9_-]{1,16384}$/.test(encoded || "")) throw new Error("invalid boundary specification");
  const spec = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!spec || typeof spec.command !== "string" || !KNOWN_HOSTS.has(spec.host) || typeof spec.event !== "string") throw new Error("invalid boundary fields");
  if (!Number.isInteger(spec.timeoutMs) || spec.timeoutMs < 100 || spec.timeoutMs > 660000) throw new Error("invalid boundary timeout");
  return spec;
}

function readInputBounded() {
  const chunks = [];
  let bytes = 0;
  const buffer = Buffer.alloc(65536);
  for (;;) {
    const count = fs.readSync(0, buffer, 0, buffer.length, null);
    if (count === 0) break;
    bytes += count;
    if (bytes > MAX_INPUT) throw new Error("hook payload exceeds 8 MiB");
    chunks.push(Buffer.from(buffer.subarray(0, count)));
  }
  return Buffer.concat(chunks);
}

async function runChild(spec, input) {
  const command = parseManagedCommand(spec.command);
  return new Promise((resolve) => {
    const child = spawn(command.file, command.args, { env: command.env, stdio: ["pipe", "pipe", "pipe"], detached: true });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let oversized = false;
    let spawnError = null;
    const killGroup = () => {
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
    };
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, spec.timeoutMs);
    const append = (which, chunk) => {
      const current = which === "stdout" ? stdout : stderr;
      if (current.length + chunk.length > MAX_OUTPUT) { oversized = true; killGroup(); return; }
      if (which === "stdout") stdout = Buffer.concat([current, chunk]);
      else stderr = Buffer.concat([current, chunk]);
    };
    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => { spawnError = error; });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 2, signal, timedOut, oversized, spawnError });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

async function main() {
  const mode = resolveHookMode();
  hookPolicyWarning(mode);
  const marker = process.argv.slice(2, process.argv.indexOf("--spec")).join(" ") || "svc-hook";
  let spec;
  try { spec = decodeSpec(process.argv[process.argv.indexOf("--spec") + 1]); }
  catch (error) { process.stderr.write(warning(marker, error.message) + "\n"); process.exitCode = mode.mode === "enforce" ? 2 : 0; return; }
  if (mode.mode === "advisory") {
    const deferred = deferredAdvisoryCommand(spec);
    if (deferred) { process.stderr.write(warning(marker, deferred) + "\n"); return; }
  }
  let input;
  try { input = readInputBounded(); }
  catch (error) { process.stderr.write(warning(marker, `cannot read hook payload: ${error.message}`) + "\n"); process.exitCode = mode.mode === "enforce" ? 2 : 0; return; }
  let result;
  try { result = await runChild(spec, input); }
  catch (error) { process.stderr.write(warning(marker, error.message) + "\n"); process.exitCode = mode.mode === "enforce" ? 2 : 0; return; }
  if (mode.mode === "enforce") {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.timedOut || result.oversized || result.spawnError) {
      process.stderr.write(`[svc hook ${marker}] ${result.timedOut ? "timed out" : result.oversized ? "output limit exceeded" : result.spawnError.message}\n`);
      process.exitCode = 2;
      return;
    }
    process.exitCode = result.code;
    return;
  }
  if (result.timedOut || result.oversized || result.spawnError || result.code !== 0) {
    const cause = result.timedOut ? "timed out" : result.oversized ? "output limit exceeded" : result.spawnError ? result.spawnError.message : `exited ${result.code}`;
    process.stderr.write(warning(marker, cause) + "\n");
    if (result.stdout.length) {
      let advice = result.stdout.toString("utf8").slice(0, 4096);
      try {
        const payload = JSON.parse(advice);
        if (payload && typeof payload === "object") {
          advice = payload.hookSpecificOutput?.permissionDecisionReason || payload.reason || payload.user_message ||
            payload.stopReason || payload.hookSpecificOutput?.additionalContext || payload.systemMessage || "";
        }
      } catch {}
      if (advice) process.stderr.write(warning(marker, advice) + "\n");
    }
    if (result.stderr.length) process.stderr.write(result.stderr.subarray(0, 4096));
    return;
  }
  let payload;
  try { payload = JSON.parse(result.stdout.toString("utf8")); } catch {}
  if (result.stdout.length && payload === undefined) {
    // Claude/Kimi/Cursor lifecycle hooks use plain stdout as agent context.
    // Gemini requires pure JSON; Codex/Grok tool events also expect JSON.
    // Keep the advice while using each stricter host's context field.
    if (spec.host === "gemini") {
      process.stdout.write(JSON.stringify({ systemMessage: result.stdout.toString("utf8") }) + "\n");
    } else if (["codex", "grok"].includes(spec.host) && spec.event === "PreToolUse") {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: spec.event, additionalContext: result.stdout.toString("utf8") } }) + "\n");
    } else {
      process.stdout.write(result.stdout);
    }
    process.stderr.write(result.stderr);
    return;
  }
  if (payload && typeof payload === "object") {
    const blocked = isBlockingPayload(payload);
    const rewritten = payload.updatedInput !== undefined || payload.updated_input !== undefined ||
      payload.hookSpecificOutput?.updatedInput !== undefined || payload.hookSpecificOutput?.updated_input !== undefined;
    const reason = blocked
      ? payload.hookSpecificOutput?.permissionDecisionReason || payload.reason || payload.user_message || payload.stopReason || "SVC hook requested a block"
      : "SVC hook proposed changing the tool input; original input retained";
    const message = blocked || rewritten ? warning(marker, reason) : "";
    if (message) process.stderr.write(message + "\n");
    process.stdout.write(JSON.stringify(advisoryPayload(payload, message)) + "\n");
    process.stderr.write(result.stderr);
    return;
  }
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}

let invokedAsMain = false;
try { invokedAsMain = Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch {}
if (invokedAsMain) {
  main().catch((error) => { process.stderr.write(warning("svc-hook", error.message) + "\n"); process.exitCode = resolveHookMode().mode === "enforce" ? 2 : 0; });
}
