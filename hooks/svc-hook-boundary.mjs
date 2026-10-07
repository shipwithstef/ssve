#!/usr/bin/env node
// Hook-only boundary. Standalone validators and CLI commands stay strict.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { lexSimpleCommand } from "./codex/lib/argv-lex.mjs";
import { resolveHookMode, hookPolicyWarning } from "./lib/hook-policy.mjs";
import { diagnosticReason, steeringReason } from "./lib/advisory-diagnostic.mjs";

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
const RESTORED_OPERATION_CLAIM = "SSVE restored the authorized WI. This call loads its current skill; the original operation has not run. Read the skill output, then retry the original operation.";
function withoutRestoredOperationClaim(value) {
  return typeof value === "string" ? value.replaceAll(RESTORED_OPERATION_CLAIM, "").trim() : value;
}
export function isBlockingPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const nested = payload.hookSpecificOutput || {};
  return [payload.decision, payload.permission, payload.permissionDecision, nested.permissionDecision]
    .some((value) => BLOCK_VALUES.has(String(value || "").toLowerCase()))
    || payload.continue === false || payload.allow === false;
}

export function advisoryPayload(payload, message, { rewritten = false } = {}) {
  const clean = structuredClone(payload);
  delete clean.decision;
  delete clean.permission;
  delete clean.permissionDecision;
  delete clean.continue;
  delete clean.allow;
  delete clean.stopReason;
  delete clean.updatedInput;
  delete clean.updated_input;
  if (rewritten) {
    // Remove only the claim tied to the discarded skill-loader substitution.
    // Independent findings from the same hook must still reach the agent.
    for (const key of ["systemMessage", "user_message"]) {
      if (typeof clean[key] === "string") {
        clean[key] = withoutRestoredOperationClaim(clean[key]);
        if (!clean[key]) delete clean[key];
      }
    }
    if (typeof clean.hookSpecificOutput?.additionalContext === "string") {
      clean.hookSpecificOutput.additionalContext = withoutRestoredOperationClaim(clean.hookSpecificOutput.additionalContext);
      if (!clean.hookSpecificOutput.additionalContext) delete clean.hookSpecificOutput.additionalContext;
    }
  }
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
  const text = String(reason || "SVC hook requested a block").replace(/\s+/g, " ");
  const hint = text.lastIndexOf(" Next step:");
  const bounded = hint < 0 ? text.slice(0, 1200) : text.slice(0, Math.min(hint, 1000)) + text.slice(hint, hint + 250);
  return `[svc advisory ${id}] ${bounded}`;
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

function readInputBounded(deadline) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onError);
      process.stdin.pause();
      if (error) reject(error);
      else resolve(Buffer.concat(chunks));
    };
    const onData = (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_INPUT) { finish(new Error("hook payload exceeds 8 MiB")); return; }
      chunks.push(chunk);
    };
    const onEnd = () => finish(null);
    const onError = (error) => finish(error);
    const timer = setTimeout(() => finish(new Error("hook payload read timed out")), Math.max(1, deadline - Date.now()));
    process.stdin.on("data", onData);
    process.stdin.once("end", onEnd);
    process.stdin.once("error", onError);
    process.stdin.resume();
  });
}

async function runChild(spec, input, deadline) {
  if (Date.now() >= deadline) throw new Error("hook deadline exceeded before child start");
  const command = parseManagedCommand(spec.command);
  return new Promise((resolve) => {
    const child = spawn(command.file, command.args, { env: command.env, stdio: ["pipe", "pipe", "pipe"], detached: true });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let oversized = false;
    let spawnError = null;
    let interrupted = null;
    const killGroup = () => {
      try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
    };
    const signals = ["SIGTERM", "SIGINT", "SIGHUP"];
    const onSignal = (signal) => { interrupted = signal; killGroup(); };
    for (const signal of signals) process.once(signal, onSignal);
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, Math.max(1, deadline - Date.now()));
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
      for (const name of signals) process.off(name, onSignal);
      resolve({ stdout, stderr, code: code ?? 2, signal, timedOut, oversized, spawnError, interrupted });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

// The durable boundary is intentionally small. Runtime classification comes
// from its receipt-bound source, just as the durable launcher delegates policy.
// A deleted/insecure source never prevents the child launcher from reporting its
// own fail-closed decision and durable denial receipt.
async function boundaryRuntimeSource() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (fs.existsSync(path.join(here, "lib/pretool-decision-engine.mjs"))) return here;
  const bundle = path.dirname(here);
  const state = path.join(fs.realpathSync(process.env.HOME || os.homedir()), ".svc");
  if (!bundle.startsWith(path.join(state, "enforcement") + path.sep)) return null;
  try {
    for (let dir = bundle; ; dir = path.dirname(dir)) {
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o022 ||
          (typeof process.getuid === "function" && stat.uid !== process.getuid())) return null;
      if (dir === state) break;
      if (dir === path.dirname(dir)) return null;
    }
    const corePath = path.join(bundle, "lib/enforcement-core.mjs");
    const stat = fs.lstatSync(corePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o022 ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid())) return null;
    const core = await import(pathToFileURL(corePath));
    const manifest = core.validateReceiptFile(path.join(bundle, "manifest.json"), {
      boundary: state, requiredFields: ["effective_source"], fieldTypes: { effective_source: "string" }, identity: { schema_version: 1 },
    });
    if (!manifest || core.classifySource(manifest.effective_source) !== "durable-canonical") return null;
    const hooks = path.join(manifest.effective_source, "hooks");
    return fs.existsSync(path.join(hooks, "lib/pretool-decision-engine.mjs")) ? hooks : null;
  } catch { return null; }
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
  const deadline = Date.now() + spec.timeoutMs;
  let input;
  try { input = await readInputBounded(deadline); }
  catch (error) { process.stderr.write(warning(marker, `cannot read hook payload: ${error.message}`) + "\n"); process.exitCode = mode.mode === "enforce" ? 2 : 0; return; }
  let original;
  try { original = JSON.parse(input.toString("utf8")); } catch {}
  const pretool = /^(?:PreToolUse|BeforeTool|preToolUse|beforeShellExecution)$/i.test(spec.event);
  const toolEvent = pretool || /^(?:PostToolUse|AfterTool|postToolUse|afterShellExecution)$/i.test(spec.event);
  const hasTool = original?.tool_name || original?.toolName || original?.command;
  let evaluatePreToolObservation = null, evaluateAdvisoryObservation = null, resolveOperationScope = null;
  if (toolEvent && hasTool) {
    const runtimeSource = await boundaryRuntimeSource();
    if (runtimeSource) {
      ({ evaluatePreToolObservation, evaluateAdvisoryObservation } = await import(pathToFileURL(path.join(runtimeSource, "lib/pretool-decision-engine.mjs"))));
      ({ resolveOperationScope } = await import(pathToFileURL(path.join(runtimeSource, "lib/operation-scope.mjs"))));
    }
  }
  const observation = evaluatePreToolObservation?.(original) || (mode.mode === "advisory" && evaluateAdvisoryObservation?.(original));
  if (observation) {
    // Observation never runs children, self-heal, contract IO or denial counters.
    if (pretool && mode.mode === "enforce" && observation.execution_input) {
      const output = spec.host === "cursor" ? { permission: "allow", updated_input: observation.execution_input }
        : { hookSpecificOutput: { hookEventName: spec.event, permissionDecision: "allow", updatedInput: observation.execution_input } };
      process.stdout.write(JSON.stringify(output) + "\n");
    } else process.stdout.write("{}\n");
    return;
  }
  let repository = original?.cwd || original?.working_directory || process.cwd();
  if (mode.mode === "advisory" && pretool && hasTool && resolveOperationScope) {
    const scope = resolveOperationScope(original, { host: spec.host });
    const roots = [scope.operation_repository?.worktree_root, scope.session_repository?.worktree_root,
      ...(scope.targets || []).map(t => t.worktree_root)].filter(Boolean);
    const governed = roots.filter(root => fs.existsSync(path.join(root, ".svc")));
    if (!governed.length) { process.stdout.write("{}\n"); return; }
    repository = governed[0];
  }
  let firstSessionFinding = () => true, findingClass = value => String(value);
  try { ({ firstSessionFinding, findingClass } = await import("./lib/session-findings.mjs")); }
  catch { /* Legacy partial fixture: enforcement still delegates to its launcher. */ }
  const visible = reason => firstSessionFinding(original, repository, marker, findingClass(reason));
  const steering = reason => steeringReason(reason, original, repository);
  const diagnostic = reason => diagnosticReason(reason, original, repository);
  let result;
  try { result = await runChild(spec, input, deadline); }
  catch (error) { process.stderr.write(warning(marker, error.message) + "\n"); process.exitCode = mode.mode === "enforce" ? 2 : 0; return; }
  if (result.interrupted) {
    process.exitCode = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 }[result.interrupted] || 2;
    return;
  }
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
    if (!visible(diagnostic(result.stderr.toString("utf8") || cause))) return;
    process.stderr.write(warning(marker, steering(cause)) + "\n");
    if (result.stdout.length) {
      let advice = result.stdout.toString("utf8").slice(0, 4096);
      try {
        const payload = JSON.parse(advice);
        if (payload && typeof payload === "object") {
          advice = payload.hookSpecificOutput?.permissionDecisionReason || payload.reason || payload.user_message ||
            payload.stopReason || payload.hookSpecificOutput?.additionalContext || payload.systemMessage || "";
        }
      } catch {}
      if (advice) process.stderr.write(warning(marker, steering(advice)) + "\n");
    }
    if (result.stderr.length) process.stderr.write(diagnostic(result.stderr.subarray(0, 4096).toString("utf8")));
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
    for (const object of [payload, payload.hookSpecificOutput].filter(Boolean)) {
      for (const key of ["systemMessage", "user_message", "reason", "stopReason", "permissionDecisionReason", "additionalContext"]) {
        if (typeof object[key] === "string" && diagnostic(object[key]) !== object[key]) object[key] = steering(object[key]);
      }
    }
    const blocked = isBlockingPayload(payload);
    const rewritten = payload.updatedInput !== undefined || payload.updated_input !== undefined ||
      payload.hookSpecificOutput?.updatedInput !== undefined || payload.hookSpecificOutput?.updated_input !== undefined;
    const reason = blocked
      ? `would have blocked this call; the original tool input continues unchanged. Finding: ${steering(payload.hookSpecificOutput?.permissionDecisionReason || payload.reason || payload.user_message || payload.stopReason || "SVC hook requested a block")}`
      : "";
    const informational = payload.systemMessage || payload.user_message || payload.hookSpecificOutput?.additionalContext || diagnostic(result.stderr.toString("utf8"));
    const show = reason ? visible(reason) : !informational || /svc-rule-injector/.test(spec.command) || visible(informational);
    if (!show) { process.stdout.write("{}\n"); return; }
    const message = reason ? warning(marker, reason) : "";
    if (message) process.stderr.write(message + "\n");
    process.stdout.write(JSON.stringify(advisoryPayload(payload, message, { rewritten })) + "\n");
    if (result.stderr.length) process.stderr.write(diagnostic(result.stderr.toString("utf8")));
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
