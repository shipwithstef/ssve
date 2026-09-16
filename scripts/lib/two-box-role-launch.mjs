#!/usr/bin/env node
/**
 * Two-Box Codex role launcher (WI-FW-TWO-BOX-01).
 * One launch module for all six planning calls. Isolation/preflight is local;
 * this module spawns the inspected argv with the exact inspected prompt.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { validate } from "./json-schema-validator.mjs";
import { assertEffectiveIsolation } from "./isolated-plan-analysis.mjs";
import {
  DEFAULT_LIMITS,
  IsolationUnsupported,
  PLANNING_ROLES,
  canonicalJson,
  outputSchemaForCall,
  sha256Bytes,
  sha256Utf8,
  validateRoleOutput,
} from "./two-box-protocol.mjs";
import { PLANNING_REQUEST_MAX_BYTES, resolvePlanningTokenBudget } from "./frozen-request-input.mjs";

const EVENTS = new Set(["thread.started", "turn.started", "turn.completed", "turn.failed", "item.started", "item.completed", "error"]);
const ITEM_OK = new Set(["reasoning", "agent_message"]);
const ITEM_TOOL = new Set(["command_execution", "file_change", "web_search", "mcp_tool_call"]);
const INJECT = ["env", "launchImpl", "inspector", "customenv", "binary", "fsImpl", "spawnImpl"];
const LAUNCH_KEYS = new Set(["role", "tuple", "payload", "schema", "sourceBindings", "signal", "limits", "mode", "offline"]);
const PRE_KEYS = new Set(["role", "tuple", "payload", "schema", "sourceBindings", "mode", "offline"]);
const ISO_OFFLINE = ["binary", "helpText", "featuresText", "inspectPrompt", "discoveredSkills", "customenv", "extraRoots", "includeSystem", "version"];
const ROLE_INSTRUCTIONS = Object.freeze({
  open_box: "Propose the strongest plan you can for the user goal from the supplied requirements and repository facts. Choose your own approach. Reply with one JSON object {\"plan\": string}.",
  contract_box: "Write a contract plan with decisions bound to original requirement ids and source citations. Reply with JSON {\"plan\": string, \"decisions\": [...]}. Use unique decision ids and original requirement ids from the input. Source citations must identify supplied file paths and one-based line ranges; copy an exact supplied sha256 or use null, never invent a hash. Do not include another candidate plan.",
  scout_forward: "Challenge the supplied Contract for omissions and regressions using the assigned forward roots and questions. Compare planned behavior against supplied source; each finding should identify a concrete plan gap and its consequence. Mere summaries of existing code are not findings. An empty findings array is valid when no grounded gap is found. Use only supplied excerpts. Citations carry path, one-based range, and sha256 copied exactly from the supplied source_blob_sha256 or input_excerpt_sha256, or null; never calculate or invent hashes. A finding excerpt must copy exactly the source lines in its stated range, or use null. Echo assignment.value.supplied_denominator exactly and report unread gaps explicitly. Do not claim tool reads. Reply with JSON {\"findings\", \"citations\", \"unread_gaps\", \"supplied_denominator\", \"incomplete\"}.",
  scout_reverse: "Challenge the supplied Contract for omissions and regressions using the assigned reverse roots and questions. Compare planned behavior against supplied source; each finding should identify a concrete plan gap and its consequence. Mere summaries of existing code are not findings. An empty findings array is valid when no grounded gap is found. Use only supplied excerpts. Citations carry path, one-based range, and sha256 copied exactly from the supplied source_blob_sha256 or input_excerpt_sha256, or null; never calculate or invent hashes. A finding excerpt must copy exactly the source lines in its stated range, or use null. Echo assignment.value.supplied_denominator exactly and report unread gaps explicitly. Do not claim tool reads. Reply with JSON {\"findings\", \"citations\", \"unread_gaps\", \"supplied_denominator\", \"incomplete\"}.",
  contract_revise: "Revise the Contract using that Contract plus both scout reports. Reply with JSON {\"plan\", \"decisions\", \"dispositions\"}. For every finding and every consequential known/unread/coverage gap in both reports, include a disposition with its exact id as target_id and target_kind finding or consequential_gap. State a reason for accept, reject, reject_innovation, or defer. Preserve original requirement coverage and source citations. Do not use a competing original plan.",
  assessor: "Compare both original results and the revised Contract with both scout reports. Choose winner open_win, contract_win, or combination. Cover every original requirement in selected_decisions. source_ids are exactly the supplied open_paragraphs ids (open:P1 etc.), contract-original:<decision.id>, or contract-revised:<decision.id>. decision_id must be one of that row's source_ids. A contract source must belong to that requirement. origin open_box uses only Open sources; contract_box only Contract sources; combination requires both. Judge repo-grounded gaps and advantages without presuming the framework candidate is superior; retain useful frontier-model alternatives and explain rejections, including reject_innovation when warranted. Do not write an independent third plan. Reply with JSON {\"winner\", \"selected_decisions\", \"rejection_dispositions\", \"unresolved_conflicts\"}.",
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function modeNameOf(mode, fallback) {
  return String(mode || fallback).toLowerCase();
}

function isOfflineMode(modeName) {
  return modeName === "offline";
}

function requirePosInt(n, max, label) {
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`${label} must be a finite positive integer <= ${max}`);
  }
  return n;
}

function normalizeLimits(limits = {}) {
  const timeoutMs = requirePosInt(limits.timeoutMs ?? DEFAULT_LIMITS.timeoutMs, 600000, "timeoutMs");
  const maxBytes = requirePosInt(limits.maxBytes ?? DEFAULT_LIMITS.maxBytes, 524288, "maxBytes");
  const maxOutputBytes = requirePosInt(limits.maxOutputBytes ?? DEFAULT_LIMITS.maxOutputBytes ?? maxBytes, 524288, "maxOutputBytes");
  const contentAttempts = limits.contentAttempts ?? DEFAULT_LIMITS.contentAttempts;
  if (contentAttempts !== 1) throw new Error("contentAttempts must be 1");
  return { timeoutMs, maxBytes, maxOutputBytes, contentAttempts: 1, cap: Math.min(maxBytes, maxOutputBytes) };
}

function rejectInjected(opts, modeName, known) {
  for (const key of Object.keys(opts)) {
    if (!known.has(key)) throw new IsolationUnsupported(`unsupported or injected option: ${key}`);
  }
  const nested = [opts, opts.sourceBindings, opts.offline];
  if (!isOfflineMode(modeName)) {
    if (opts.offline && Object.keys(opts.offline).length) {
      throw new IsolationUnsupported(`offline fixture injection forbidden in ${modeName}`);
    }
    for (const src of nested) {
      if (!isPlainObject(src)) continue;
      for (const key of INJECT) {
        if (Object.prototype.hasOwnProperty.call(src, key)) {
          throw new IsolationUnsupported(`injected ${key} is forbidden in ${modeName}`);
        }
      }
    }
    return;
  }
  for (const src of [opts, opts.offline]) {
    if (!isPlainObject(src)) continue;
    if (src.launchImpl || src.inspector || Object.prototype.hasOwnProperty.call(src, "env")) {
      throw new IsolationUnsupported("injected launchImpl/inspector/env rejected");
    }
  }
}

function requireRoleTuple(role, tuple) {
  if (!PLANNING_ROLES.includes(role)) throw new Error(`unknown planning call: ${role}`);
  if (!isPlainObject(tuple)) throw new IsolationUnsupported("tuple required");
  if (tuple.host !== "codex") throw new IsolationUnsupported(`unsupported planning transport: ${tuple.host}`);
  if (tuple.family !== "openai") throw new IsolationUnsupported(`unsupported planning family: ${tuple.family}`);
  if (typeof tuple.model !== "string" || !tuple.model.trim()) throw new IsolationUnsupported("tuple.model required");
  if (typeof tuple.effort !== "string" || !tuple.effort.trim()) throw new IsolationUnsupported("tuple.effort required");
}

function localCatalogSupport(tuple) {
  const budget = resolvePlanningTokenBudget(tuple);
  return {
    path: budget.path,
    sha256: budget.sha256,
    fetched_at: budget.fetched_at,
    client_version: budget.client_version,
    slug: budget.slug,
    effort: budget.effort,
    identity: "local_support_not_server",
    evidence: "local_models_cache",
    context_window: budget.context_window,
    max_context_window: budget.max_context_window,
    contextWindow: budget.contextWindow,
    outputReserveTokens: budget.outputReserveTokens,
    maxInputTokens: budget.maxInputTokens,
  };
}

export function buildRolePrompt({role, payload} = {}) {
  if (!PLANNING_ROLES.includes(role) || !isPlainObject(payload)) throw new Error("known role and concrete payload required");
  const common = ["bindings"];
  const fields = {
    open_box:["requirements","facts"],
    contract_box:["requirements","facts","constraints"],
    scout_forward:["initial_contract","assignment"],
    scout_reverse:["initial_contract","assignment"],
    contract_revise:["requirements","facts","constraints","initial_contract","scout_reports"],
    assessor:["requirements","facts","original_open","original_contract","revised_contract","scout_reports","open_paragraphs", ...(Object.hasOwn(payload,"constraints") ? ["constraints"] : [])],
  }[role];
  const allowed = new Set([...common,...fields]);
  for (const key of Object.keys(payload)) if (!allowed.has(key)) throw new Error(`unexpected ${role} input: ${key}`);
  for (const key of allowed) if (payload[key] == null) throw new Error(`${role} requires concrete ${key}`);
  const candidateKeys = ["initial_contract","original_open","original_contract","revised_contract"].filter(key => fields.includes(key));
  for (const key of candidateKeys) if (!isPlainObject(payload[key]) || !payload[key].ref || !isPlainObject(payload[key].output)) throw new Error(`${key} requires ref and actual output`);
  if (fields.includes("assignment") && (!payload.assignment.ref || !isPlainObject(payload.assignment.value) || !Array.isArray(payload.assignment.value.excerpts))) throw new Error("actual assignment excerpts required");
  if (fields.includes("scout_reports") && (!Array.isArray(payload.scout_reports) || payload.scout_reports.length !== 2 || payload.scout_reports.some(report => !report.ref || !isPlainObject(report.output)))) throw new Error("both actual scout reports required");
  const prompt = `${ROLE_INSTRUCTIONS[role]}\n\n${canonicalJson(payload)}\n`;
  if (Buffer.byteLength(prompt) > PLANNING_REQUEST_MAX_BYTES) {
    throw new IsolationUnsupported(`frozen role input exceeds byte limit ${PLANNING_REQUEST_MAX_BYTES}; token/context/output budgets are separate`);
  }
  return prompt;
}

function enforceClosedAndBounds(schema, data, p) {
  if (data === null) return;
  if (typeof schema.minLength === "number" && typeof data === "string" && data.trim().length < schema.minLength) {
    throw new Error(`${p}: minLength ${schema.minLength}`);
  }
  if (Number.isInteger(schema.minItems) && Array.isArray(data) && data.length < schema.minItems) {
    throw new Error(`${p}: minItems ${schema.minItems}`);
  }
  if (schema.minimum != null && typeof data === "number" && data < schema.minimum) {
    throw new Error(`${p}: minimum ${schema.minimum}`);
  }
  if (schema.properties && isPlainObject(data)) {
    for (const key of Object.keys(data)) {
      if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) throw new Error(`${p}: unknown property "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (key in data) enforceClosedAndBounds(sub, data[key], `${p}.${key}`);
    }
  }
  if (schema.items && Array.isArray(data)) {
    data.forEach((item, i) => enforceClosedAndBounds(schema.items, item, `${p}[${i}]`));
  }
}

function applySchema(schemaOrRole, value) {
  if (typeof schemaOrRole === "function") throw new Error("tool callback rejected");
  if (typeof schemaOrRole === "string") {
    if (!PLANNING_ROLES.includes(schemaOrRole)) throw new Error(`unknown planning call: ${schemaOrRole}`);
    return validateRoleOutput(schemaOrRole, value);
  }
  if (!isPlainObject(schemaOrRole)) throw new Error("role string or schema object required");
  const result = validate(schemaOrRole, value);
  if (!result.valid) throw new Error(`invalid output: ${result.errors.join("; ")}`);
  enforceClosedAndBounds(schemaOrRole, value, "$");
  return value;
}

function agentText(item) {
  if (typeof item.text === "string" && item.text.trim()) return item.text;
  if (typeof item.content === "string" && item.content.trim()) return item.content;
  if (Array.isArray(item.content)) {
    const text = item.content.map((c) => (typeof c === "string" ? c : (c && (c.text || c.output_text)) || "")).join("");
    if (text.trim()) return text;
  }
  return "";
}

function parseAnswer(text) {
  let value;
  try { value = JSON.parse(String(text).trim()); }
  catch { throw new Error("final agent_message is not JSON"); }
  if (!isPlainObject(value)) throw new Error("final agent_message must be a JSON object");
  return value;
}

function noteObserved(ev, observed) {
  const model = ev.model ?? ev.thread?.model ?? ev.turn?.model;
  const effort = ev.effort ?? ev.model_reasoning_effort ?? ev.turn?.effort;
  if (typeof model === "string" && model.trim()) observed.model = model.trim();
  if (typeof effort === "string" && effort.trim()) observed.effort = effort.trim();
}

function decodeCodexJsonl(text) {
  const src = Buffer.isBuffer(text) ? new TextDecoder("utf-8", {fatal:true}).decode(text) : text;
  if (typeof src !== "string") throw new Error("JSONL text required");
  const events = [];
  for (const line of src.split("\n")) {
    const s = line.replace(/\r$/, "");
    if (s.trim() === "") continue;
    let value;
    try { value = JSON.parse(s); }
    catch { throw new Error("malformed JSONL line"); }
    if (!isPlainObject(value)) throw new Error("malformed JSONL line");
    events.push(value);
  }
  const observed = { model: "unknown", effort: "unknown" };
  let sawThread = false;
  let sawTurnStart = false;
  let sawTurnEnd = false;
  let agent = null;
  let usage = null;
  for (const ev of events) {
    if (sawTurnEnd) throw new Error("trailing events after turn.completed");
    const type = ev.type;
    if (typeof type !== "string" || !EVENTS.has(type)) throw new Error(`unknown event type ${type}`);
    if (type === "turn.failed") throw new Error(`turn.failed: ${ev.error?.message || "failed"}`);
    if (type === "error") throw new Error(`error: ${ev.message || "error"}`);
    if (type === "thread.started") {
      if (sawThread || sawTurnStart) throw new Error("duplicate or misplaced thread.started");
      sawThread = true;
      noteObserved(ev, observed);
      continue;
    }
    if (type === "turn.started") {
      if (!sawThread || sawTurnStart) throw new Error("duplicate or misplaced turn.started");
      sawTurnStart = true;
      noteObserved(ev, observed);
      continue;
    }
    // Native Codex reports these two startup diagnostics as error items even on
    // a successful tool-free turn. Accept only these exact known diagnostics,
    // only after thread.started and before turn.started. Raw bytes remain evidence.
    if (type === "item.completed" && ev.item?.type === "error" && sawThread && !sawTurnStart) {
      const unstableWarning = /^Under-development features enabled: skip_host_skill_discovery\. Under-development features are incomplete and may behave unpredictably\. To suppress this warning, set `suppress_unstable_features_warning = true` in (?:\/[^\r\n\0]+|[A-Za-z]:\\[^\r\n\0]+)[/\\]config\.toml\.$/;
      const codeModeWarning = "Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.";
      if (unstableWarning.test(ev.item.message || "") || ev.item.message === codeModeWarning) continue;
      throw new Error(`unrecognized native startup error: ${ev.item.message || "missing message"}`);
    }
    if (type === "item.started" || type === "item.completed") {
      if (!sawTurnStart) throw new Error("item before turn.started");
      const item = ev.item;
      if (!isPlainObject(item) || typeof item.type !== "string") throw new Error("item required");
      if (ITEM_TOOL.has(item.type)) throw new Error(`tool event ${item.type}`);
      if (!ITEM_OK.has(item.type)) throw new Error(`unknown item type ${item.type}`);
      if (type === "item.completed" && item.type === "agent_message") agent = agentText(item);
      continue;
    }
    if (!sawTurnStart) throw new Error("turn.completed without turn.started");
    sawTurnEnd = true;
    usage = isPlainObject(ev.usage) ? ev.usage : null;
    noteObserved(ev, observed);
  }
  if (!sawThread) throw new Error("missing thread.started");
  if (!sawTurnStart) throw new Error("missing turn.started");
  if (!sawTurnEnd) throw new Error("truncated/no terminal turn");
  if (!agent) throw new Error("missing final completed agent_message");
  return { value: parseAnswer(agent), usage, observed };
}

export function parseCodexJsonl(text, schemaOrRole) {
  if (typeof schemaOrRole === "function") throw new Error("tool callback rejected");
  if (typeof schemaOrRole !== "string" && !isPlainObject(schemaOrRole)) {
    throw new Error("role string or schema object required");
  }
  return applySchema(schemaOrRole, decodeCodexJsonl(text).value);
}

function isoOffline(offline) {
  const out = {};
  for (const key of ISO_OFFLINE) {
    if (offline && Object.prototype.hasOwnProperty.call(offline, key)) out[key] = offline[key];
  }
  return out;
}

export function preflightRole({ role, tuple, payload, schema, sourceBindings, mode = "inspect", offline = {} } = {}) {
  const opts = arguments[0] || {};
  const modeName = modeNameOf(mode, "inspect");
  if (!["inspect", "live", "offline"].includes(modeName)) throw new IsolationUnsupported(`unsupported mode ${mode}`);
  rejectInjected(opts, modeName, PRE_KEYS);
  requireRoleTuple(role, tuple);
  if (!sourceBindings?.consumerRoot) throw new IsolationUnsupported("consumerRoot required");
  const catalog = isOfflineMode(modeName) ? {path:null,sha256:null,fetched_at:null,client_version:null,slug:tuple.model,effort:tuple.effort,identity:"OFFLINE",evidence:"synthetic_fixture"} : localCatalogSupport(tuple);
  const prompt = buildRolePrompt({ role, payload });
  const roleSchema = outputSchemaForCall(role);
  if (schema && canonicalJson(schema) !== canonicalJson(roleSchema)) throw new IsolationUnsupported("role schema must match the canonical role contract");
  const iso = assertEffectiveIsolation({
    role,
    tuple,
    prompt,
    schema: roleSchema,
    consumerRoot: sourceBindings.consumerRoot,
    mode: modeName,
    ...(isOfflineMode(modeName) ? { offline: isoOffline(offline) } : {}),
  });
  catalog.version_compare = {
    catalog_client_version: catalog.client_version,
    proof_version_raw: iso.proof?.version?.raw ?? null,
    matched: catalog.client_version && iso.proof?.version?.raw
      ? String(iso.proof.version.raw).includes(String(catalog.client_version))
      : null,
  };
  iso.proof.local_catalog = catalog;
  if (isOfflineMode(modeName)) {
    iso.proof.effective = { ...iso.proof.effective, usable_live: false, status: "isolated_offline" };
  }
  return { ...iso, schema: roleSchema, catalog };
}

function preContentRetry(sourceBindings) {
  const retry = sourceBindings?.planning_transport?.pre_content_retry;
  if (!retry || retry.enabled !== true) return false;
  if (retry.max_classified_spawn_retries !== 1) {
    throw new Error("pre_content_retry requires max_classified_spawn_retries=1");
  }
  if (retry.retry_class != null && retry.retry_class !== "pre_content_spawn_failure") {
    throw new Error("pre_content_retry.retry_class must be pre_content_spawn_failure");
  }
  return true;
}

function asText(value) {
  if (value == null) return "";
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value === "string") return value;
  throw new Error("stdout/stderr must be string or bytes");
}

function launchFail(status, run, attempts) {
  const err = new Error(`codex launch ${status}`);
  err.name = "LaunchFailed";
  err.status = status;
  err.timeout = status === "timeout";
  err.abort = status === "abort";
  err.overflow = status === "overflow";
  err.rawStdout = Buffer.isBuffer(run.rawStdout) ? run.rawStdout : Buffer.from(asText(run.rawStdout));
  err.rawStderr = Buffer.isBuffer(run.rawStderr) ? run.rawStderr : Buffer.from(asText(run.rawStderr));
  err.exit_code = run.exit_code ?? null;
  err.signal = run.signal ?? null;
  err.attempts = attempts;
  err.spawnCode = run.spawnCode ?? null;
  throw err;
}

function waitClose(child) {
  return new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
}

async function terminateWait(child, closeP) {
  const pid = child.pid;
  if (pid) {
    try { process.kill(-pid, "SIGTERM"); }
    catch { try { child.kill("SIGTERM"); } catch { /* already closed */ } }
  }
  let graceTimer;
  const grace = new Promise((resolve) => { graceTimer = setTimeout(resolve, 2000, "grace"); });
  const winner = await Promise.race([closeP.then(() => "closed"), grace]);
  clearTimeout(graceTimer);
  if (winner !== "closed" && pid) {
    try { process.kill(-pid, "SIGKILL"); }
    catch { try { child.kill("SIGKILL"); } catch { /* already closed */ } }
  }
  await closeP;
}

function spawnCodex({ binary, args, cwd, env, prompt, timeoutMs, maxBytes, signal }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(binary, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"], detached: true });
    } catch (error) {
      resolve({
        ok: false, status: "spawn", spawnCode: error.code, gotBytes: false,
        rawStdout: Buffer.alloc(0), rawStderr: Buffer.alloc(0), exit_code: null, signal: null,
      });
      return;
    }
    const stdoutChunks = [];
    const stderrChunks = [];
    let combined = 0;
    let gotBytes = false;
    let overflow = false;
    let timedOut = false;
    let aborted = false;
    let spawnCode = null;
    let finished = false;
    const closeP = waitClose(child);
    child.once("error", (error) => { spawnCode = error.code || error.message; });
    const take = (chunks, buf) => {
      if (!buf || !buf.length || finished) return;
      gotBytes = true;
      if (overflow) return;
      const room = maxBytes - combined;
      if (buf.length > room) {
        if (room > 0) chunks.push(Buffer.from(buf.subarray(0, room)));
        combined = maxBytes;
        overflow = true;
        void stop("overflow");
        return;
      }
      chunks.push(Buffer.from(buf));
      combined += buf.length;
    };
    if (child.stdout) child.stdout.on("data", (b) => take(stdoutChunks, b));
    if (child.stderr) child.stderr.on("data", (b) => take(stderrChunks, b));
    if (child.stdin) {
      child.stdin.on("error", () => {});
      try { child.stdin.end(prompt, "utf8"); }
      catch { spawnCode = spawnCode || "EPIPE"; }
    }
    const timer = setTimeout(() => { timedOut = true; void stop("timeout"); }, timeoutMs);
    const onAbort = () => { aborted = true; void stop("abort"); };
    if (signal) {
      if (signal.aborted) { aborted = true; void stop("abort"); }
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    closeP.then(() => stop(null));
    async function stop(why) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      try {
        if (why) await terminateWait(child, closeP);
        const ended = await closeP;
        const status = overflow ? "overflow"
          : timedOut ? "timeout"
            : aborted ? "abort"
              : spawnCode && !gotBytes ? "spawn"
                : ended.code === 0 && !ended.signal ? "ok" : "exit";
        resolve({
          ok: status === "ok",
          status,
          spawnCode,
          gotBytes,
          rawStdout: Buffer.concat(stdoutChunks),
          rawStderr: Buffer.concat(stderrChunks),
          exit_code: ended.code,
          signal: ended.signal,
        });
      } catch (error) {
        resolve({
          ok: false, status: why || "spawn", spawnCode: error.code || spawnCode, gotBytes,
          rawStdout: Buffer.concat(stdoutChunks), rawStderr: Buffer.concat(stderrChunks),
          exit_code: null, signal: null,
        });
      }
    }
  });
}

/** Bounded process primitive. This result alone grants no planning/receipt authority.
 * Used by the live adapter, offline subprocess tests, and the held-out canary.
 */
export async function runBoundedProcess(options = {}) {
  requirePosInt(options.timeoutMs, 600000, "timeoutMs");
  requirePosInt(options.maxBytes, 524288, "maxBytes");
  if (typeof options.binary !== "string" || !Array.isArray(options.args) || !options.args.every(arg => typeof arg === "string")) throw new Error("binary and string argv required");
  if (options.signal?.aborted) return {ok:false,status:"abort",spawnCode:null,gotBytes:false,rawStdout:Buffer.alloc(0),rawStderr:Buffer.alloc(0),exit_code:null,signal:null};
  return spawnCodex(options);
}

async function runLive(pre, limits, signal, sourceBindings) {
  const allowRetry = preContentRetry(sourceBindings);
  let attempts = 0;
  let last;
  while (true) {
    attempts += 1;
    last = await runBoundedProcess({
      binary: pre.proof.binary.path,
      args: pre.execArgs,
      cwd: pre.cwd,
      env: pre.env,
      prompt: pre.prompt,
      timeoutMs: limits.timeoutMs,
      maxBytes: limits.cap,
      signal,
    });
    if (last.ok) return { ...last, attempts };
    const classified = !last.gotBytes && (last.spawnCode === "ENOENT" || last.spawnCode === "EAGAIN");
    if (!(allowRetry && classified && attempts === 1)) launchFail(last.status, last, attempts);
  }
}

function runOffline(offline, role) {
  if (offline.spawn?.error && !(offline.stdout || offline.output)) {
    const run = { rawStdout: "", rawStderr: "", exit_code: null, signal: null, spawnCode: offline.spawn.error.code || offline.spawn.code };
    launchFail("spawn", run, 1);
  }
  if (isPlainObject(offline.output) && offline.stdout == null) {
    return {
      output: validateRoleOutput(role, offline.output),
      rawStdout: "",
      rawStderr: asText(offline.stderr),
      usage: isPlainObject(offline.usage) ? offline.usage : null,
      observed: { model: "unknown", effort: "unknown" },
      exit_code: offline.exit_code ?? 0,
      attempts: 1,
    };
  }
  const rawStdout = asText(offline.stdout ?? offline.output);
  const rawStderr = asText(offline.stderr);
  const decoded = decodeCodexJsonl(rawStdout);
  return {
    output: applySchema(role, decoded.value),
    rawStdout,
    rawStderr,
    usage: decoded.usage,
    observed: decoded.observed,
    exit_code: offline.exit_code ?? 0,
    attempts: 1,
  };
}

export async function launchRole({
  role, tuple, payload, schema, sourceBindings, signal, limits, mode = "live", offline = {},
} = {}) {
  const opts = arguments[0] || {};
  const modeName = modeNameOf(mode, "live");
  if (modeName === "inspect") throw new Error("launchRole does not inspect; use preflightRole");
  if (modeName !== "live" && modeName !== "offline") throw new IsolationUnsupported(`unsupported mode ${mode}`);
  rejectInjected(opts, modeName, LAUNCH_KEYS);
  if (signal != null && typeof signal.addEventListener !== "function") throw new Error("signal must be an AbortSignal");
  const boundLimits = normalizeLimits(limits);
  let pre;
  try {
    pre = preflightRole({ role, tuple, payload, schema, sourceBindings, mode: modeName, offline });
    if (isOfflineMode(modeName)) {
      if (pre.proof?.effective?.usable_live) throw new IsolationUnsupported("OFFLINE proof cannot be usable_live");
      const result = runOffline(offline, role);
      if (Buffer.byteLength(result.rawStdout) + Buffer.byteLength(result.rawStderr) > boundLimits.cap) launchFail("overflow", result, 1);
      if (result.exit_code !== 0) launchFail("exit", result, 1);
      return {
        output: result.output,
        rawStdout: result.rawStdout,
        rawStderr: result.rawStderr,
        evidence_class: "OFFLINE",
        requested: { host: tuple.host, family: tuple.family, model: tuple.model, effort: tuple.effort },
        invocation: { host: "codex", binary: pre.proof.binary.path, exec_args: pre.execArgs, cwd: pre.cwd },
        observed: result.observed,
        exit_code: result.exit_code,
        proof: { ...pre.proof, effective: { ...pre.proof.effective, usable_live: false, status: "isolated_offline" } },
        usage: result.usage,
        prompt_digest: sha256Utf8(pre.prompt),
        limits: boundLimits,
        attempts: result.attempts,
      };
    }
    if (pre.proof?.effective?.usable_live !== true) throw new IsolationUnsupported("isolation proof is not usable live");
    if (signal?.aborted) launchFail("abort", { rawStdout: "", rawStderr: "", exit_code: null, signal: null }, 0);
    const run = await runLive(pre, boundLimits, signal, sourceBindings);
    const rawStdout = Buffer.from(run.rawStdout);
    const rawStderr = Buffer.from(run.rawStderr);
    let decoded;
    try { decoded = decodeCodexJsonl(rawStdout); }
    catch (error) {
      error.rawStdout = rawStdout;
      error.rawStderr = rawStderr;
      error.exit_code = run.exit_code;
      throw error;
    }
    let output;
    try { output = applySchema(role, decoded.value); } catch (error) { error.rawStdout = rawStdout; error.rawStderr = rawStderr; error.exit_code = run.exit_code; throw error; }
    return {
      output,
      rawStdout,
      rawStderr,
      evidence_class: "LIVE",
      requested: { host: tuple.host, family: tuple.family, model: tuple.model, effort: tuple.effort },
      invocation: { host: "codex", binary: pre.proof.binary.path, exec_args: pre.execArgs, cwd: pre.cwd },
      observed: decoded.observed,
      exit_code: run.exit_code,
      proof: pre.proof,
      usage: decoded.usage,
      prompt_digest: sha256Utf8(pre.prompt),
      limits: boundLimits,
      attempts: run.attempts,
    };
  } catch (error) {
    throw error;
  } finally {
    if (pre?.cleanup) pre.cleanup();
  }
}
