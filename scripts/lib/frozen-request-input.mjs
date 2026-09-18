#!/usr/bin/env node
/**
 * Shared frozen request bytes for ordinary review and Two-Box planning.
 * Hash/length are computed from the complete bytes. Byte/resource limits are
 * independent of model token/context/output reserve.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { IsolationUnsupported, sha256Bytes } from "./two-box-protocol.mjs";

export const DEFAULT_PLANNING_REQUEST_MAX_BYTES = 8 * 1024 * 1024;
export const PLANNING_REQUEST_MAX_BYTES = Number.parseInt(process.env.SVC_PLANNING_REQUEST_MAX_BYTES || "", 10) || DEFAULT_PLANNING_REQUEST_MAX_BYTES;
/** Ordinary external-review packages already reach the 8 MiB bound. */
export const GENERAL_REVIEW_MAX_BYTES = 8 * 1024 * 1024;
/** Linux MAX_ARG_STRLEN is 131072 including NUL; one fewer usable payload byte. */
export const PLATFORM_SINGLE_ARG_MAX = 131071;

function fail(message) {
  throw new IsolationUnsupported(message);
}

export function requestIdentity(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? "");
  return { bytes: buf, byteLength: buf.length, sha256: sha256Bytes(buf) };
}

export function assertRequestBudget(bytes, maxBytes = PLANNING_REQUEST_MAX_BYTES) {
  const ident = requestIdentity(bytes);
  if (!Number.isInteger(maxBytes) || maxBytes < 1) fail("request byte limit must be a positive integer");
  if (ident.byteLength < 1) fail("frozen request is empty");
  if (ident.byteLength > maxBytes) {
    fail(`frozen request exceeds byte limit ${maxBytes} (${ident.byteLength} bytes); token/context/output budgets are separate`);
  }
  return ident;
}

export function conservativeTokenUpperBound(byteLength) {
  if (!Number.isInteger(byteLength) || byteLength < 0) fail("request byte length required for token estimate");
  // One token per UTF-8 byte is a tokenizer-independent upper bound.
  return byteLength;
}

export function estimateTokensFromBytes(byteLength) {
  return conservativeTokenUpperBound(byteLength);
}

export function resolvePlanningTokenBudget(tuple) {
  if (typeof tuple?.model !== "string" || !tuple.model) fail("tuple.model required for token budget");
  if (typeof tuple?.effort !== "string" || !tuple.effort) fail("tuple.effort required for token budget");
  const catalogPath = path.join(os.homedir(), ".codex", "models_cache.json");
  let raw;
  try { raw = fs.readFileSync(catalogPath); }
  catch { fail("local Codex models_cache.json is not installed"); }
  let doc;
  try { doc = JSON.parse(raw.toString("utf8")); }
  catch { fail("local Codex models_cache.json is malformed"); }
  const models = Array.isArray(doc.models) ? doc.models : [];
  const row = models.find((m) => m && typeof m === "object" && m.slug === tuple.model);
  if (!row) fail(`local catalog does not list slug ${tuple.model}`);
  const levels = Array.isArray(row.supported_reasoning_levels) ? row.supported_reasoning_levels : [];
  if (!levels.some((lv) => lv && typeof lv === "object" && lv.effort === tuple.effort)) {
    fail(`local catalog does not list effort ${tuple.effort} for ${tuple.model}`);
  }
  const contextWindowRaw = Number.isInteger(row.max_context_window)
    ? row.max_context_window
    : (Number.isInteger(row.context_window) ? row.context_window : null);
  if (!Number.isInteger(contextWindowRaw) || contextWindowRaw < 1) {
    fail(`local catalog missing context window for ${tuple.model}`);
  }
  const pct = Number.isInteger(row.effective_context_window_percent) ? row.effective_context_window_percent : 100;
  if (pct < 1 || pct > 100) fail("effective_context_window_percent must be 1..100");
  const contextWindow = Math.floor(contextWindowRaw * pct / 100);
  const tokenBudget = row.model_messages && typeof row.model_messages === "object"
    ? row.model_messages.token_budget
    : null;
  if (!Number.isInteger(tokenBudget?.auto_compact_fallback_buffer_tokens) || tokenBudget.auto_compact_fallback_buffer_tokens < 1) {
    fail(`local catalog missing output reserve for ${tuple.model}`);
  }
  const outputReserveTokens = tokenBudget.auto_compact_fallback_buffer_tokens;
  return {
    path: catalogPath,
    sha256: sha256Bytes(raw),
    fetched_at: doc.fetched_at ?? null,
    client_version: doc.client_version ?? null,
    slug: tuple.model,
    effort: tuple.effort,
    context_window: Number.isInteger(row.context_window) ? row.context_window : null,
    max_context_window: Number.isInteger(row.max_context_window) ? row.max_context_window : null,
    effective_context_window_percent: pct,
    contextWindow,
    outputReserveTokens,
    maxInputTokens: contextWindow,
  };
}

export function assertTokenContextOutputReserve({
  requestBytes,
  maxInputTokens = null,
  contextWindow = null,
  outputReserveTokens = null,
  requireChecked = false,
} = {}) {
  if (!Number.isInteger(requestBytes) || requestBytes < 1) fail("requestBytes required for token/context/output reserve");
  const supplied = [maxInputTokens, contextWindow, outputReserveTokens].filter((n) => n != null);
  if (!supplied.length) {
    if (requireChecked) fail("token/context/output reserve required before live/inspect");
    return { estimated_tokens: conservativeTokenUpperBound(requestBytes), checked: false };
  }
  for (const [label, value] of [["maxInputTokens", maxInputTokens], ["contextWindow", contextWindow], ["outputReserveTokens", outputReserveTokens]]) {
    if (value != null && (!Number.isInteger(value) || value < 0)) fail(`${label} must be a non-negative integer`);
  }
  if (maxInputTokens === 0) fail("maxInputTokens must allow input");
  if (contextWindow != null && (outputReserveTokens ?? 0) >= contextWindow) {
    fail("output reserve leaves no input space in contextWindow");
  }
  const estimated = conservativeTokenUpperBound(requestBytes);
  const upperBoundFits = (maxInputTokens == null || estimated <= maxInputTokens)
    && (contextWindow == null || estimated + (outputReserveTokens ?? 0) <= contextWindow);
  // An upper bound below the limit can establish fit; one above it cannot
  // establish overflow. Do not reject valid text as though bytes were tokens.
  // The native runner enforces actual model capacity when fit is unknown.
  return {
    estimated_tokens: estimated,
    estimate_kind: "utf8_byte_upper_bound",
    checked: true, // Budget metadata checked, not a model-specific token count.
    fits: upperBoundFits ? true : null,
    enforcement: upperBoundFits ? "byte_upper_bound" : "native_runner",
    reason: upperBoundFits ? null : "Token fit unknown: byte upper bound exceeds budget; native runner enforces actual context capacity.",
  };
}

export function freezeRequestBytes({ bytes, dir, filename = "frozen-request.txt", maxBytes = PLANNING_REQUEST_MAX_BYTES } = {}) {
  if (typeof dir !== "string" || !dir) fail("freeze directory required");
  const ident = assertRequestBudget(bytes, maxBytes);
  const target = path.join(dir, filename);
  fs.writeFileSync(target, ident.bytes, { mode: 0o600 });
  const written = fs.readFileSync(target);
  if (sha256Bytes(written) !== ident.sha256 || written.length !== ident.byteLength) {
    fail("frozen request changed while writing");
  }
  return { path: target, byteLength: ident.byteLength, sha256: ident.sha256, bytes: written };
}

export function readFrozenFile(filePath, { maxBytes = PLANNING_REQUEST_MAX_BYTES } = {}) {
  if (typeof filePath !== "string" || !filePath) fail("frozen request path required");
  let st;
  try { st = fs.lstatSync(filePath); }
  catch (error) { fail(`frozen request file missing: ${error.message}`); }
  if (st.isSymbolicLink() || !st.isFile()) fail("frozen request must be a regular file");
  const bytes = fs.readFileSync(filePath);
  const ident = assertRequestBudget(bytes, maxBytes);
  return { path: filePath, ...ident };
}

export function readFrozenStream(stream, { maxBytes = PLANNING_REQUEST_MAX_BYTES, timeoutMs = 30_000 } = {}) {
  if (!stream || typeof stream.on !== "function") fail("frozen request stream required");
  if (stream.isTTY) fail("interactive stdin is not a frozen request");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) fail("request input timeout must be 1..60000 ms");
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    const failRead = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new IsolationUnsupported(message));
    };
    const onData = (chunk) => {
      const buf = Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        stream.destroy();
        failRead(`frozen request exceeds byte limit ${maxBytes} (${total} bytes); token/context/output budgets are separate`);
        return;
      }
      chunks.push(buf);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try { resolve(assertRequestBudget(Buffer.concat(chunks), maxBytes)); }
      catch (error) { reject(error); }
    };
    const onError = (error) => failRead(`frozen request stream failed: ${error.message}`);
    const onClose = () => {
      if (!settled) failRead("frozen request stream closed before EOF");
    };
    const timer = setTimeout(() => {
      stream.destroy();
      failRead(`frozen request did not finish within ${timeoutMs} ms; partial input discarded`);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", onError);
      stream.removeListener("close", onClose);
      if (typeof stream.pause === "function") stream.pause();
    };
    stream.on("data", onData);
    stream.once("end", onEnd);
    stream.once("error", onError);
    stream.once("close", onClose);
  });
}

export function argvElementBytes(arg) {
  return Buffer.byteLength(String(arg), "utf8");
}

export function assertArgvFits(argv, maxBytes = PLATFORM_SINGLE_ARG_MAX) {
  if (!Array.isArray(argv) || argv.some((a) => typeof a !== "string")) fail("argv must be strings");
  for (const arg of argv) {
    const n = argvElementBytes(arg);
    if (n > maxBytes) fail(`argv element exceeds platform single-argument limit ${maxBytes} (${n} bytes)`);
  }
  return true;
}

export function measureSingleArgLimit({ binary = "/usr/bin/true", sizes = [131071, 131072] } = {}) {
  return sizes.map((argument_bytes) => {
    const r = spawnSync(binary, ["x".repeat(argument_bytes)], { encoding: "utf8" });
    return {
      argument_bytes,
      exit_code: r.status,
      error_code: r.error?.code ?? null,
      platform: os.platform(),
    };
  });
}
