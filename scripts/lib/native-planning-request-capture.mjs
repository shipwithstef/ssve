#!/usr/bin/env node
/**
 * Native-request capture for Codex planning inspection when `debug prompt-input`
 * cannot take stdin/file. Spawns the same exec flags as live launch plus an
 * invocation-only local provider. Captures one Responses request and refuses
 * inference. The capture overlay is never live authority; live exec uses the
 * inspected frozen stdin bytes without the overlay.
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { IsolationUnsupported, sha256Bytes, sha256Utf8, canonicalJson } from "./two-box-protocol.mjs";
import { PLANNING_REQUEST_MAX_BYTES, freezeRequestBytes, readFrozenFile, assertArgvFits } from "./frozen-request-input.mjs";

const CAPTURE_KEY = "SSVE_CAPTURE_KEY";
const PROVIDER = "ssve_cap";
const SSVE_CATALOG = /includedSkills|route-workflow|plan-changeset|Serious Serious Vibe Engineering|\bDOCTRINE\.md\b|FRAMEWORK-STATE|skills-manifest/i;
const MAX_CHILD_BYTES = PLANNING_REQUEST_MAX_BYTES;
export const PLANNING_CAPTURE_BODY_MAX_BYTES = PLANNING_REQUEST_MAX_BYTES * 8;
export const NATIVE_PROFILE_PROBE = "SSVE_NATIVE_PROFILE_PROBE\n";

export function qualifyInspectHelp(debugHelp) {
  const text = String(debugHelp || "");
  const stdin = /stdin/i.test(text) && /PROMPT/i.test(text) && /If not provided as an argument|\(or if `-` is used\)/i.test(text);
  const promptFile = /--prompt-file\b/.test(text);
  return {
    command: "codex debug prompt-input",
    positional: /\[PROMPT\]/.test(text) || /<prompt>/i.test(text),
    stdin,
    prompt_file: promptFile,
    native_complete_input: Boolean(stdin || promptFile),
  };
}

function fail(message, extra = {}) {
  const error = new IsolationUnsupported(message);
  Object.assign(error, extra);
  throw error;
}

function itemText(item) {
  if (!item || typeof item !== "object") return "";
  if (typeof item.content === "string") return item.content;
  if (typeof item.text === "string") return item.text;
  if (Array.isArray(item.content)) {
    return item.content.map((c) => (typeof c === "string" ? c : (c && (c.text || c.output_text)) || "")).join("");
  }
  return "";
}

function closedMessageContent(item) {
  if (item.role !== "developer" && item.role !== "user") fail(`unknown captured message role ${item.role}`);
  const content = item.content;
  if (typeof content === "string") return [{ type: "input_text", text: content }];
  if (!Array.isArray(content) || !content.length) fail("captured message content must be a closed input_text list");
  const out = [];
  for (const part of content) {
    if (!part || typeof part !== "object") fail("captured message content item is not an object");
    for (const key of Object.keys(part)) {
      if (key !== "type" && key !== "text") fail(`unrecognized captured content field ${key}`);
    }
    const type = part.type || "input_text";
    if (type !== "input_text") fail(`unknown captured content type ${type}`);
    if (typeof part.text !== "string") fail("captured input_text requires text");
    out.push({ type: "input_text", text: part.text });
  }
  return out;
}

function collectToolNames(tools, acc = []) {
  if (!Array.isArray(tools)) return acc;
  for (const t of tools) {
    if (t && typeof t === "object") {
      if (typeof t.name === "string") acc.push(t.name);
      if (Array.isArray(t.tools)) collectToolNames(t.tools, acc);
    }
  }
  return acc;
}

export const ACCEPTED_RESPONSES_KEYS = Object.freeze([
  "model", "input", "tool_choice", "parallel_tool_calls", "reasoning",
  "store", "stream", "include", "prompt_cache_key", "text", "client_metadata",
]);
const ACCEPTED_REASONING_KEYS = Object.freeze(["effort", "context"]);
const ACCEPTED_TEXT_KEYS = Object.freeze(["verbosity", "format"]);
const ACCEPTED_TEXT_FORMAT_KEYS = Object.freeze(["type", "name", "strict", "schema"]);
const ACCEPTED_MESSAGE_KEYS = Object.freeze(["type", "id", "role", "content"]);
const ACCEPTED_ADDITIONAL_TOOLS_KEYS = Object.freeze(["type", "id", "role", "tools"]);
export const NATIVE_PROFILE_FIELD_KEYS = Object.freeze([
  "binary_sha256", "model", "effort", "reasoning_context", "schema", "text_format",
  "text_verbosity", "tool_choice", "parallel_tool_calls", "store", "stream", "include",
  "prompt_cache_key", "client_metadata", "frames", "tools",
]);

function assertClosedObject(value, allowed, label) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`unrecognized ${label} field ${key}`);
  }
}

export function assertClosedResponsesRequest(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("captured Responses body required");
  if (parsed.instructions != null) fail("captured request has unexpected top-level instructions");
  for (const key of Object.keys(parsed)) {
    if (!ACCEPTED_RESPONSES_KEYS.includes(key)) fail(`unrecognized Responses field ${key}`);
  }
  assertClosedObject(parsed.reasoning, ACCEPTED_REASONING_KEYS, "reasoning");
  assertClosedObject(parsed.text, ACCEPTED_TEXT_KEYS, "text");
  assertClosedObject(parsed.text?.format, ACCEPTED_TEXT_FORMAT_KEYS, "text.format");
}

function assertClosedInputItem(item) {
  if (!item || typeof item !== "object") fail("captured request contains a non-object input item");
  if (item.type === "additional_tools") {
    for (const key of Object.keys(item)) {
      if (!ACCEPTED_ADDITIONAL_TOOLS_KEYS.includes(key)) fail(`unrecognized additional_tools field ${key}`);
    }
    return;
  }
  if (item.type !== "message") fail(`unknown captured input type ${item.type}`);
  for (const key of Object.keys(item)) {
    if (!ACCEPTED_MESSAGE_KEYS.includes(key)) fail(`unrecognized captured message field ${key}`);
  }
}

export function inspectMessagesFromResponses(input) {
  if (!Array.isArray(input)) fail("captured Responses input must be an array");
  const tools = [];
  const messages = [];
  const frames = [];
  const items = [];
  for (const item of input) {
    assertClosedInputItem(item);
    if (item.type === "additional_tools") {
      if (!Array.isArray(item.tools)) fail("additional_tools.tools must be an array");
      const raw = Buffer.from(canonicalJson(item.tools), "utf8");
      if (SSVE_CATALOG.test(raw.toString("utf8"))) {
        fail("captured tool advertisement contains injected catalog or instruction text");
      }
      const sha = sha256Bytes(raw);
      const toolsItem = { type: "additional_tools", role: item.role ?? null, tools: item.tools };
      tools.push({ sha256: sha, names: collectToolNames(item.tools) });
      frames.push({ type: "additional_tools", role: item.role ?? null, sha256: sha });
      items.push(toolsItem);
      continue;
    }
    const content = closedMessageContent(item);
    const text = content.map((c) => c.text).join("");
    const message = { type: "message", role: item.role, content };
    messages.push(message);
    frames.push({ type: "message", role: item.role, sha256: sha256Utf8(text) });
    items.push(message);
  }
  return { messages, tools, frames, items };
}

export function capturedSchema(parsed) {
  return parsed?.text?.format?.schema ?? null;
}

export function capturedTextFormat(parsed) {
  const format = parsed?.text?.format;
  if (!format || typeof format !== "object") return null;
  return {
    type: format.type ?? null,
    name: format.name ?? null,
    strict: format.strict ?? null,
  };
}

export function normalizeNativeFrame(frame) {
  if (!frame || typeof frame !== "object") fail("native frame required");
  if (frame.type === "additional_tools") {
    if (typeof frame.sha256 !== "string") fail("additional_tools frame sha256 required");
    return { type: "additional_tools", role: frame.role ?? null, sha256: frame.sha256 };
  }
  if (typeof frame.role !== "string" || typeof frame.sha256 !== "string") fail("message frame role and sha256 required");
  return { type: "message", role: frame.role, sha256: frame.sha256 };
}

export function framesFromInspectMessages(messages, prompt) {
  if (!Array.isArray(messages)) fail("inspect messages required");
  const frames = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") fail("inspect message is not an object");
    if (msg.type === "additional_tools") {
      if (!Array.isArray(msg.tools)) fail("additional_tools.tools must be an array");
      frames.push({
        type: "additional_tools",
        role: msg.role ?? null,
        sha256: sha256Bytes(Buffer.from(canonicalJson(msg.tools), "utf8")),
      });
      continue;
    }
    const items = Array.isArray(msg.content) ? msg.content : [msg.content];
    const text = items.map(itemText).join("");
    if (text === prompt) continue;
    frames.push({ type: "message", role: msg.role, sha256: sha256Utf8(text) });
  }
  return frames;
}

export function completeRequestBytes({ items, schema, semantic, capturedBodyBytes = null } = {}) {
  if (Number.isInteger(capturedBodyBytes) && capturedBodyBytes > 0) return capturedBodyBytes;
  if (!Array.isArray(items)) fail("complete request requires inspect items");
  const semanticBody = nativeProfileBody({ ...semantic, schema: schema ?? semantic?.schema ?? null, frames: [], tools: [], binary_sha256: null });
  delete semanticBody.frames;
  delete semanticBody.tools;
  delete semanticBody.binary_sha256;
  return Buffer.byteLength(canonicalJson({
    input: items,
    schema: schema ?? null,
    model: semanticBody.model,
    effort: semanticBody.effort,
    reasoning_context: semanticBody.reasoning_context,
    text_format: semanticBody.text_format,
    text_verbosity: semanticBody.text_verbosity,
    tool_choice: semanticBody.tool_choice,
    parallel_tool_calls: semanticBody.parallel_tool_calls,
    store: semanticBody.store,
    stream: semanticBody.stream,
    include: semanticBody.include,
    prompt_cache_key: semanticBody.prompt_cache_key,
    client_metadata: semanticBody.client_metadata,
  }), "utf8");
}

export function completeEnvelopeBytes(opts = {}) {
  return completeRequestBytes(opts);
}

export function semanticEnvelopeFromParsed(parsed) {
  return {
    model: parsed.model ?? null,
    effort: parsed.reasoning?.effort ?? null,
    reasoning_context: parsed.reasoning?.context ?? null,
    schema: capturedSchema(parsed),
    text_format: capturedTextFormat(parsed),
    text_verbosity: parsed.text?.verbosity ?? null,
    tool_choice: parsed.tool_choice ?? null,
    parallel_tool_calls: parsed.parallel_tool_calls ?? null,
    store: parsed.store ?? null,
    stream: parsed.stream ?? null,
    include: parsed.include ?? null,
    prompt_cache_key: parsed.prompt_cache_key == null ? null : typeof parsed.prompt_cache_key,
    client_metadata: parsed.client_metadata == null
      ? null
      : (typeof parsed.client_metadata === "object" && !Array.isArray(parsed.client_metadata)
        ? Object.keys(parsed.client_metadata).sort()
        : typeof parsed.client_metadata),
  };
}

export function stableNativeEnvelope(parsed, prompt) {
  assertClosedResponsesRequest(parsed);
  if (!Array.isArray(parsed.input)) fail("captured Responses body missing input");
  const converted = inspectMessagesFromResponses(parsed.input);
  const promptHits = converted.messages.filter((m) => itemText(m) === prompt);
  if (promptHits.length !== 1) fail(`captured request must contain the frozen prompt once (got ${promptHits.length})`);
  const frames = converted.items.flatMap((item) => {
    if (item.type === "additional_tools") {
      return [{ type: "additional_tools", role: item.role ?? null, sha256: sha256Bytes(Buffer.from(canonicalJson(item.tools), "utf8")) }];
    }
    const text = itemText(item);
    if (text === prompt) return [];
    return [{ type: "message", role: item.role, sha256: sha256Utf8(text) }];
  });
  const semantic = semanticEnvelopeFromParsed(parsed);
  return {
    ...semantic,
    frames,
    tools: converted.tools.map((t) => t.sha256),
    envelope_bytes: completeRequestBytes({
      items: converted.items,
      schema: semantic.schema,
      semantic,
    }),
  };
}

export function nativeProfileBody(profile) {
  return {
    binary_sha256: profile?.binary_sha256 ?? null,
    model: profile?.model ?? null,
    effort: profile?.effort ?? null,
    reasoning_context: profile?.reasoning_context ?? null,
    schema: profile?.schema ?? null,
    text_format: profile?.text_format ?? null,
    text_verbosity: profile?.text_verbosity ?? null,
    tool_choice: profile?.tool_choice ?? null,
    parallel_tool_calls: profile?.parallel_tool_calls ?? null,
    store: profile?.store ?? null,
    stream: profile?.stream ?? null,
    include: profile?.include ?? null,
    prompt_cache_key: profile?.prompt_cache_key ?? null,
    client_metadata: profile?.client_metadata ?? null,
    frames: Array.isArray(profile?.frames) ? profile.frames.map(normalizeNativeFrame) : [],
    tools: Array.isArray(profile?.tools) ? [...profile.tools] : [],
  };
}

export function nativeProfileDigest(profile) {
  return sha256Utf8(canonicalJson(nativeProfileBody(profile)));
}

export function nativeProfileFromStable(envelope, { binarySha256 } = {}) {
  const body = nativeProfileBody({
    ...envelope,
    binary_sha256: binarySha256 || envelope?.binary_sha256 || null,
  });
  return { ...body, sha256: nativeProfileDigest(body) };
}

export function nativeProfileFromCapture(result, { binarySha256, tuple, schema } = {}) {
  if (!result || result.inference !== false) fail("native profile requires a no-inference capture");
  const envelope = result.stable || stableNativeEnvelope(result.parsed, result.prompt_text);
  const profile = nativeProfileFromStable(envelope, { binarySha256 });
  if (tuple?.model && profile.model !== tuple.model) fail(`captured model ${profile.model} !== requested ${tuple.model}`);
  if (tuple?.effort && profile.effort !== tuple.effort) fail(`captured effort ${profile.effort} !== requested ${tuple.effort}`);
  if (schema && profile.schema && canonicalJson(profile.schema) !== canonicalJson(schema)) {
    fail("captured output schema differs from requested schema");
  }
  return profile;
}

export function assertCapturedEnvelope({ result, frozen, cwd, tuple, schema, profile }) {
  if (!result || result.inference !== false) fail("capture must refuse inference");
  if (typeof tuple?.model !== "string" || !tuple.model) fail("requested model required");
  if (typeof tuple?.effort !== "string" || !tuple.effort) fail("requested effort required");
  const promptText = frozen.bytes.toString("utf8");
  const envelope = result.stable || stableNativeEnvelope(result.parsed, promptText);
  if (envelope.model !== tuple.model) fail(`captured model ${envelope.model} !== requested ${tuple.model}`);
  if (envelope.effort !== tuple.effort) fail(`captured effort ${envelope.effort} !== requested ${tuple.effort}`);
  if (schema) {
    if (!envelope.schema) fail("captured request missing output schema");
    if (canonicalJson(envelope.schema) !== canonicalJson(schema)) fail("captured output schema differs from requested schema");
  }
  const messages = JSON.parse(String(result.inspect_json).trim());
  const promptHits = messages.filter((m) => m.role === "user" && m.content?.[0]?.text === promptText);
  if (promptHits.length !== 1) fail(`captured request must contain the frozen prompt once (got ${promptHits.length})`);
  const envHits = messages.filter((m) => m.role === "user" && String(m.content?.[0]?.text || "").includes(`<cwd>${cwd}</cwd>`));
  if (envHits.length !== 1) fail(`captured request must contain exactly one environment_context cwd frame (got ${envHits.length})`);
  if (!profile) fail("verified native profile required");
  if (profile.binary_sha256 && result.binary_sha256 && profile.binary_sha256 !== result.binary_sha256) {
    fail("captured binary does not match native profile");
  }
  const want = canonicalJson(nativeProfileBody({ ...profile, binary_sha256: null }));
  const got = canonicalJson(nativeProfileBody({ ...envelope, binary_sha256: null }));
  if (want !== got) {
    const wantObj = nativeProfileBody({ ...profile, binary_sha256: null });
    const gotObj = nativeProfileBody({ ...envelope, binary_sha256: null });
    const keys = new Set([...Object.keys(wantObj), ...Object.keys(gotObj)]);
    const differ = [...keys].filter((key) => canonicalJson(wantObj[key]) !== canonicalJson(gotObj[key]));
    fail(`captured native envelope differs from verified native profile (${differ.join(",") || "unknown"})`);
  }
  return true;
}

function captureFlags(port, nonce) {
  return [
    "-c", `model_providers.${PROVIDER}.name="ssve-capture"`,
    "-c", `model_providers.${PROVIDER}.base_url="http://127.0.0.1:${port}/ssve-capture/${nonce}/v1"`,
    "-c", `model_providers.${PROVIDER}.env_key="${CAPTURE_KEY}"`,
    "-c", `model_providers.${PROVIDER}.wire_api="responses"`,
    "-c", `model_providers.${PROVIDER}.requires_openai_auth=false`,
    "-c", `model_providers.${PROVIDER}.request_max_retries=0`,
    "-c", `model_providers.${PROVIDER}.stream_max_retries=0`,
    "-c", `model_provider="${PROVIDER}"`,
  ];
}

function captureEnv(base) {
  const env = { ...base };
  for (const key of Object.keys(env)) {
    if (/^(?:OPENAI|CHATGPT|ANTHROPIC)_API_KEY$/i.test(key)) delete env[key];
  }
  env[CAPTURE_KEY] = "ssve-capture-not-a-secret";
  return env;
}

function waitClose(child) {
  return new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
}

export function processGone(pid) {
  if (!Number.isInteger(pid) || pid < 1) return true;
  try { process.kill(pid, 0); return false; }
  catch (error) { return error.code === "ESRCH"; }
}

export async function terminate(child, closeP, { graceMs = 2000 } = {}) {
  const pid = child?.pid;
  if (pid) {
    try { process.kill(-pid, "SIGTERM"); }
    catch { try { child.kill("SIGTERM"); } catch { /* already gone */ } }
  }
  let timer;
  const grace = new Promise((resolve) => { timer = setTimeout(resolve, graceMs, "grace"); });
  const winner = await Promise.race([closeP.then(() => "closed"), grace]);
  clearTimeout(timer);
  if (winner !== "closed" && pid) {
    try { process.kill(-pid, "SIGKILL"); }
    catch { try { child.kill("SIGKILL"); } catch { /* already gone */ } }
  }
  await closeP;
  if (pid && !processGone(pid)) fail(`capture child ${pid} still present after TERM/KILL`, { pid });
}

function boundAppend(store, chunk, max, onOverflow) {
  if (store.overflow) return;
  const buf = Buffer.from(chunk);
  if (store.bytes.length + buf.length > max) {
    store.overflow = true;
    onOverflow();
    return;
  }
  store.bytes = Buffer.concat([store.bytes, buf]);
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (typeof server.closeAllConnections === "function") {
      try { server.closeAllConnections(); } catch { /* Node version */ }
    }
    server.close(() => resolve());
    setTimeout(resolve, 1000);
  });
}

export async function capturePlanningRequest({
  binary, cwd, env, execArgs, frozenPath, prompt, expectedSha256, timeoutMs = 60000,
  maxBodyBytes = PLANNING_CAPTURE_BODY_MAX_BYTES, maxChildBytes = MAX_CHILD_BYTES, signal, model, effort, schema, binarySha256,
  killGraceMs = 2000,
} = {}) {
  if (typeof binary !== "string" || !binary) fail("capture binary required");
  if (typeof cwd !== "string" || !cwd) fail("capture cwd required");
  if (!Array.isArray(execArgs)) fail("live exec args required");
  if (execArgs.includes("-") || (typeof prompt === "string" && execArgs.includes(prompt))) {
    fail("live exec argv must not carry the frozen prompt");
  }
  const frozen = readFrozenFile(frozenPath);
  if (expectedSha256 && frozen.sha256 !== expectedSha256) fail("frozen request changed after freeze");
  if (typeof prompt === "string" && sha256Bytes(Buffer.from(prompt, "utf8")) !== frozen.sha256) {
    fail("capture prompt does not match frozen request");
  }
  if (signal?.aborted) fail("capture cancelled before start");
  const nonce = crypto.randomBytes(16).toString("hex");
  let captured = null;
  let capturedSha = null;
  let modelsHits = 0;
  let responsesHits = 0;
  let retryHits = 0;
  let bodyOverflow = false;
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const chunks = [];
    let total = 0;
    let overflow = false;
    req.on("data", (c) => {
      total += c.length;
      if (total > maxBodyBytes) {
        overflow = true;
        bodyOverflow = true;
        try { res.writeHead(413).end(); } catch { /* already closed */ }
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("error", () => {});
    req.on("end", () => {
      if (overflow) return;
      const body = Buffer.concat(chunks);
      const url = String(req.url || "");
      if (!url.includes(`/ssve-capture/${nonce}/`)) {
        res.writeHead(404).end();
        return;
      }
      const route = url.split("?")[0];
      if (req.method === "GET" && route.endsWith("/models")) {
        modelsHits += 1;
        res.writeHead(200, { "content-type": "application/json", connection: "close" });
        res.end(JSON.stringify({ data: [{ id: model || "captured-model", object: "model" }] }));
        return;
      }
      if (req.method === "POST" && route.endsWith("/responses")) {
        const digest = sha256Bytes(body);
        if (!captured) {
          captured = body;
          capturedSha = digest;
          responsesHits += 1;
        } else if (digest === capturedSha) {
          retryHits += 1;
        } else {
          responsesHits += 1;
        }
      }
      res.writeHead(400, { "content-type": "application/json", connection: "close" });
      res.end(JSON.stringify({ error: { message: "ssve-capture-no-inference", type: "ssve_capture" } }));
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (err) => err ? reject(err) : resolve()));
  const { port } = server.address();
  const args = [...execArgs, ...captureFlags(port, nonce)];
  assertArgvFits(args);
  let child = null;
  let spawnCode = null;
  const stdout = { bytes: Buffer.alloc(0), overflow: false };
  const stderr = { bytes: Buffer.alloc(0), overflow: false };
  let closeP;
  try {
    child = spawn(binary, args, { cwd, env: captureEnv(env || process.env), stdio: ["pipe", "pipe", "pipe"], detached: true });
  } catch (error) {
    spawnCode = error.code || error.message;
    await closeServer(server);
    fail(`native capture spawn failed (${spawnCode})`);
  }
  closeP = waitClose(child);
  child.on("error", (error) => { spawnCode = error.code || error.message; });
  const overflowKill = () => { void terminate(child, closeP, { graceMs: Math.min(killGraceMs, 200) }); };
  if (child.stdout) child.stdout.on("data", (b) => boundAppend(stdout, b, maxChildBytes, overflowKill));
  if (child.stderr) child.stderr.on("data", (b) => boundAppend(stderr, b, maxChildBytes, overflowKill));
  if (child.stdin) {
    child.stdin.on("error", () => {});
    try { child.stdin.end(frozen.bytes); }
    catch { spawnCode = spawnCode || "EPIPE"; }
  }
  const onAbort = () => { void terminate(child, closeP, { graceMs: killGraceMs }); };
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void terminate(child, closeP, { graceMs: killGraceMs }); }, timeoutMs);
  try {
    const ended = await closeP;
    if (signal?.aborted) fail("capture cancelled", { pid: child.pid });
    if (timedOut) fail("capture timed out before a complete request", { pid: child.pid });
    if (stdout.overflow || stderr.overflow) fail("capture child output exceeded byte limit", { pid: child.pid });
    if (bodyOverflow && !captured) fail("captured Responses body exceeded byte limit while streaming", { pid: child.pid });
    if (spawnCode && !captured) fail(`native capture spawn failed (${spawnCode})`, { pid: child.pid });
    if (!captured) fail(`native capture did not observe a Responses request (${spawnCode || ended.code || "no-body"})`, { pid: child.pid });
    if (responsesHits !== 1) fail(`capture observed ${responsesHits} distinct Responses bodies; expected one request`, { pid: child.pid });
    let parsed;
    try { parsed = JSON.parse(captured.toString("utf8")); }
    catch { fail("captured Responses body is not JSON", { pid: child.pid }); }
    if (parsed?.error?.type !== undefined && parsed.input == null) fail("captured error object is not a model request", { pid: child.pid });
    const promptText = frozen.bytes.toString("utf8");
    const converted = inspectMessagesFromResponses(parsed.input);
    if (!converted.messages.some((m) => itemText(m) === promptText)) {
      fail("captured request does not contain the frozen prompt bytes", { pid: child.pid });
    }
    const stable = stableNativeEnvelope(parsed, promptText);
    const wrapper_rows = converted.messages.map((m) => ({
      role: m.role,
      sha256: sha256Utf8(itemText(m)),
      kind: m.role === "developer" ? null : "user",
    }));
    return {
      inference: false,
      transport: "native_request_capture",
      modelsHits,
      responsesHits,
      retryHits,
      body_sha256: sha256Bytes(captured),
      body_bytes: captured.length,
      inspect_json: `${JSON.stringify(converted.items)}\n`,
      tools: converted.tools,
      frames: converted.frames,
      wrapper_rows,
        model: stable.model,
      effort: stable.effort,
      schema: stable.schema,
      binary_sha256: binarySha256 || null,
      parsed,
      stable,
      prompt_text: promptText,
      stdout: stdout.bytes,
      stderr: stderr.bytes,
      pid: child.pid,
    };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
    for (const socket of sockets) {
      try { socket.destroy(); } catch { /* already closed */ }
    }
    await closeServer(server);
    if (child?.pid && !processGone(child.pid)) {
      await terminate(child, closeP, { graceMs: Math.min(killGraceMs, 200) });
    }
  }
}

export async function qualifyNativePlanningRequest(opts = {}) {
  const frozen = readFrozenFile(opts.frozenPath);
  const dir = path.dirname(opts.frozenPath);
  const probe = freezeRequestBytes({
    bytes: Buffer.from(NATIVE_PROFILE_PROBE, "utf8"),
    dir,
    filename: "native-profile-probe.txt",
  });
  const probeResult = await capturePlanningRequest({
    ...opts,
    frozenPath: probe.path,
    expectedSha256: probe.sha256,
    prompt: NATIVE_PROFILE_PROBE,
  });
  const result = await capturePlanningRequest({
    ...opts,
    frozenPath: frozen.path,
    expectedSha256: frozen.sha256,
    prompt: opts.prompt ?? frozen.bytes.toString("utf8"),
  });
  const tuple = { model: opts.model, effort: opts.effort };
  const probeProfile = nativeProfileFromCapture(probeResult, {
    binarySha256: opts.binarySha256,
    tuple,
    schema: opts.schema,
  });
  assertCapturedEnvelope({
    result,
    frozen,
    cwd: opts.cwd,
    tuple,
    schema: opts.schema,
    profile: probeProfile,
  });
  return {
    ...result,
    native_profile: probeProfile,
    inspection_authority: "qualified_native_request_inspect",
    capture_inference: false,
    probe_pid: probeResult.pid,
    pid: result.pid,
  };
}

function publicCapture(result) {
  return {
    inference: result.inference,
    transport: result.transport,
    modelsHits: result.modelsHits,
    responsesHits: result.responsesHits,
    retryHits: result.retryHits,
    body_sha256: result.body_sha256,
    body_bytes: result.body_bytes,
    inspect_json: result.inspect_json,
    tools: result.tools,
    frames: result.frames,
    wrapper_rows: result.wrapper_rows,
    model: result.model,
    effort: result.effort,
    schema: result.schema,
    binary_sha256: result.binary_sha256,
    native_profile: result.native_profile || null,
    inspection_authority: result.inspection_authority || null,
    capture_inference: result.capture_inference ?? false,
  };
}

async function main() {
  const raw = fs.readFileSync(0);
  const packet = JSON.parse(raw.toString("utf8"));
  const result = packet.mode === "qualify"
    ? await qualifyNativePlanningRequest(packet)
    : await capturePlanningRequest(packet);
  process.stdout.write(`${JSON.stringify(publicCapture(result))}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}
