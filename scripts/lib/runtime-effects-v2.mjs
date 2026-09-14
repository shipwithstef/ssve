#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { authorizeEffect, compileCapsule } from "../svc-execution-controller-v2.mjs";

const MUTATING_KINDS = new Set(["filesystem_write", "git_checkpoint", "provider_write", "paid_write", "device", "deploy"]);
const ROOT_ONLY_KINDS = new Set(["paid_write", "device", "deploy"]);
const HTTP_WRITE_KINDS = new Set(["provider_write", "paid_write", "deploy"]);
export const BUILT_IN_EFFECT_ADAPTER_KINDS = Object.freeze({
  "filesystem.read-file-v2": "filesystem_read",
  "filesystem.write-file-v2": "filesystem_write",
  "filesystem.delete-file-v2": "filesystem_write",
  "git.checkpoint-v2": "git_checkpoint",
  "network.fetch-v2": "network_read",
  "provider.fetch-v2": "provider_write",
  "paid.fetch-v2": "paid_write",
  "deploy.fetch-v2": "deploy"
});

export const BUILT_IN_EFFECT_ADAPTER_IDS = Object.freeze(Object.keys(BUILT_IN_EFFECT_ADAPTER_KINDS));
export const BUILT_IN_EFFECT_KINDS = Object.freeze([...new Set(Object.values(BUILT_IN_EFFECT_ADAPTER_KINDS))].sort());

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(Buffer.isBuffer(value) || typeof value === "string" ? value : stable(value)).digest("hex");
}

function canonicalTime(value = new Date().toISOString()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || new Date(value).toISOString() !== value) throw new Error(`non-canonical timestamp ${value}`);
  return value;
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0 && !/[\0\r\n]/.test(value);
}

function atomicWrite(file, bytes, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try { if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`refusing symlinked runtime file ${file}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, mode);
    try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function secureTarget(repoRoot, relative, options = {}) {
  const root = fs.realpathSync(repoRoot);
  if (!nonEmpty(relative) || relative.includes("\\") || path.posix.isAbsolute(relative) || path.posix.normalize(relative) !== relative || relative === "." || relative.startsWith("../")) {
    throw new Error(`unsafe repository target ${relative}`);
  }
  const segments = relative.split("/");
  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    try {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error(`repository target traverses symlink ${relative}`);
      if (index < segments.length - 1 && !stat.isDirectory()) throw new Error(`repository target parent is not a directory ${relative}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (index < segments.length - 1 || options.must_exist) throw new Error(`repository target does not exist ${relative}`);
    }
  }
  if (cursor !== root && !cursor.startsWith(`${root}${path.sep}`)) throw new Error(`repository target escapes root ${relative}`);
  return cursor;
}

function boundedText(value, limit) {
  const text = value ?? "";
  const bytes = Buffer.byteLength(text);
  return bytes <= limit ? { text, bytes, truncated: false } : { text: Buffer.from(text).subarray(0, limit).toString("utf8"), bytes, truncated: true };
}

function containsShellEval(argv) {
  let commandIndex = 0;
  if (path.basename(argv[0]).toLowerCase() === "env") {
    if (argv.some((part) => new Set(["-s", "--split-string"]).has(part.toLowerCase()))) return true;
    commandIndex = 1;
    while (commandIndex < argv.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[commandIndex]) || argv[commandIndex].startsWith("-"))) commandIndex += 1;
  }
  const shell = path.basename(argv[commandIndex] ?? "").toLowerCase().replace(/\.exe$/, "");
  if (!new Set(["sh", "bash", "dash", "zsh", "fish", "ksh", "cmd", "powershell", "pwsh"]).has(shell)) return false;
  return argv.slice(commandIndex + 1).some((part) => {
    const lowered = part.toLowerCase();
    return new Set(["-c", "/c", "-command", "-encodedcommand"]).has(lowered) || /^-[a-z]*c[a-z]*$/.test(lowered);
  });
}

export function executeValidatorArgv(capsule, validationId, options = {}) {
  const compiled = compileCapsule(capsule);
  if (!compiled.valid) return { valid: false, passed: false, errors: compiled.errors };
  const validation = capsule.validations.find((candidate) => candidate.id === validationId);
  if (!validation) return { valid: false, passed: false, errors: [`unknown validator ${validationId}`] };
  if (!Array.isArray(validation.argv) || validation.argv.length === 0 || validation.argv.some((part) => !nonEmpty(part))) {
    return { valid: false, passed: false, errors: ["validator argv must be a non-empty NUL/newline-free string array"] };
  }
  if (containsShellEval(validation.argv)) return { valid: false, passed: false, errors: ["validator argv cannot invoke a shell command string"] };
  const cwd = fs.realpathSync(options.cwd ?? process.cwd());
  const startedAt = canonicalTime(options.started_at ?? new Date().toISOString());
  const startedNs = process.hrtime.bigint();
  const result = (options.spawn_sync ?? spawnSync)(validation.argv[0], validation.argv.slice(1), {
    cwd, env: options.env ?? process.env, encoding: "utf8", input: options.input,
    timeout: options.timeout_ms ?? 300_000, maxBuffer: options.max_buffer_bytes ?? 4 * 1024 * 1024,
    windowsHide: true, shell: false
  });
  const finishedAt = canonicalTime(options.finished_at ?? new Date().toISOString());
  const stdout = boundedText(result.stdout, options.receipt_output_bytes ?? 64 * 1024);
  const stderr = boundedText(result.stderr, options.receipt_output_bytes ?? 64 * 1024);
  const exitCode = Number.isInteger(result.status) ? result.status : null;
  const signal = result.signal ?? null;
  const invocationError = result.error ? `${result.error.code ?? "SPAWN_ERROR"}: ${result.error.message}` : null;
  const receipt = {
    schema_version: 2, kind: "validator-argv", task_id: capsule.task_id, capsule_digest: compiled.capsule_digest,
    validation_id: validation.id, validator_digest: validation.validator_digest, argv: [...validation.argv], cwd,
    started_at: startedAt, finished_at: finishedAt, duration_ms: Number(process.hrtime.bigint() - startedNs) / 1e6,
    exit_code: exitCode, signal, timed_out: result.error?.code === "ETIMEDOUT", invocation_error: invocationError,
    stdout_sha256: digest(result.stdout ?? ""), stderr_sha256: digest(result.stderr ?? ""),
    stdout: stdout.text, stderr: stderr.text, stdout_bytes: stdout.bytes, stderr_bytes: stderr.bytes,
    output_truncated: stdout.truncated || stderr.truncated
  };
  receipt.receipt_digest = digest(receipt);
  return { valid: !invocationError && exitCode !== null, passed: !invocationError && exitCode === 0, errors: invocationError ? [invocationError] : [], receipt };
}

export async function executeValidatorArgvAsync(capsule, validationId, options = {}) {
  const compiled = compileCapsule(capsule);
  if (!compiled.valid) return { valid: false, passed: false, errors: compiled.errors };
  const validation = capsule.validations.find((candidate) => candidate.id === validationId);
  if (!validation) return { valid: false, passed: false, errors: [`unknown validator ${validationId}`] };
  if (!Array.isArray(validation.argv) || validation.argv.length === 0 || validation.argv.some((part) => !nonEmpty(part))) {
    return { valid: false, passed: false, errors: ["validator argv must be a non-empty NUL/newline-free string array"] };
  }
  if (containsShellEval(validation.argv)) return { valid: false, passed: false, errors: ["validator argv cannot invoke a shell command string"] };
  const cwd = fs.realpathSync(options.cwd ?? process.cwd());
  const startedAt = canonicalTime(options.started_at ?? new Date().toISOString());
  const startedNs = process.hrtime.bigint();
  const maxBuffer = options.max_buffer_bytes ?? 4 * 1024 * 1024;
  const timeoutMs = options.timeout_ms ?? 300_000;
  const result = await new Promise((resolve) => {
    let child;
    try {
      child = (options.spawn ?? spawn)(validation.argv[0], validation.argv.slice(1), {
        cwd, env: options.env ?? process.env, windowsHide: true, shell: false,
        stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
      });
    } catch (error) {
      resolve({ status: null, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), error });
      return;
    }
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;
    let overflow = null;
    let timer;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const collect = (target, chunk, stream) => {
      if (overflow) return;
      if (stream === "stdout") stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;
      if (stdoutBytes + stderrBytes > maxBuffer) {
        overflow = new Error(`validator output exceeded ${maxBuffer} bytes`);
        overflow.code = "MAX_BUFFER";
        child.kill("SIGKILL");
        return;
      }
      target.push(Buffer.from(chunk));
    };
    child.stdout?.on("data", (chunk) => collect(stdout, chunk, "stdout"));
    child.stderr?.on("data", (chunk) => collect(stderr, chunk, "stderr"));
    child.on("error", (error) => finish({ status: null, signal: null, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), error }));
    child.on("close", (status, signal) => {
      const error = overflow ?? (timedOut ? Object.assign(new Error(`validator timed out after ${timeoutMs}ms`), { code: "ETIMEDOUT" }) : null);
      finish({ status, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), error });
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    timer.unref();
  });
  const finishedAt = canonicalTime(options.finished_at ?? new Date().toISOString());
  const stdoutText = result.stdout.toString("utf8");
  const stderrText = result.stderr.toString("utf8");
  const stdout = boundedText(stdoutText, options.receipt_output_bytes ?? 64 * 1024);
  const stderr = boundedText(stderrText, options.receipt_output_bytes ?? 64 * 1024);
  const exitCode = Number.isInteger(result.status) ? result.status : null;
  const signal = result.signal ?? null;
  const invocationError = result.error ? `${result.error.code ?? "SPAWN_ERROR"}: ${result.error.message}` : null;
  const receipt = {
    schema_version: 2, kind: "validator-argv", task_id: capsule.task_id, capsule_digest: compiled.capsule_digest,
    validation_id: validation.id, validator_digest: validation.validator_digest, argv: [...validation.argv], cwd,
    started_at: startedAt, finished_at: finishedAt, duration_ms: Number(process.hrtime.bigint() - startedNs) / 1e6,
    exit_code: exitCode, signal, timed_out: result.error?.code === "ETIMEDOUT", invocation_error: invocationError,
    stdout_sha256: digest(stdoutText), stderr_sha256: digest(stderrText),
    stdout: stdout.text, stderr: stderr.text, stdout_bytes: stdout.bytes, stderr_bytes: stderr.bytes,
    output_truncated: stdout.truncated || stderr.truncated
  };
  receipt.receipt_digest = digest(receipt);
  return { valid: !invocationError && exitCode !== null, passed: !invocationError && exitCode === 0, errors: invocationError ? [invocationError] : [], receipt };
}

function receiptPaths(receiptRoot, keyDigest) {
  const requestedRoot = path.resolve(receiptRoot);
  fs.mkdirSync(requestedRoot, { recursive: true, mode: 0o700 });
  const root = fs.realpathSync(requestedRoot);
  if (root !== requestedRoot) throw new Error(`refusing symlinked effect receipt root ${requestedRoot}`);
  for (const directory of [path.join(root, "effects"), path.join(root, "snapshots")]) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`refusing symlinked effect receipt directory ${directory}`);
  }
  return {
    root,
    receipt: path.join(root, "effects", `${keyDigest}.json`),
    compensation: path.join(root, "effects", `${keyDigest}.compensated.json`),
    snapshot: path.join(root, "snapshots", `${keyDigest}.json`),
    lock: path.join(root, "effects", `${keyDigest}.lock`)
  };
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

async function withEffectLock(lockPath, action, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      fs.writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`, { flag: "wx", mode: 0o600 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner = null;
      try { owner = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch {}
      if (owner && !processAlive(owner.pid)) {
        try { fs.unlinkSync(lockPath); continue; } catch (unlinkError) { if (unlinkError.code !== "ENOENT") throw unlinkError; }
      }
      if (Date.now() >= deadline) throw new Error("effect idempotency lock busy");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  try { return await action(); }
  finally { try { fs.unlinkSync(lockPath); } catch (error) { if (error.code !== "ENOENT") throw error; } }
}

function requestIdentity(capsule, effect, adapterId) {
  return {
    task_id: capsule.task_id, task_revision: capsule.revision, generation_bindings: capsule.generation_bindings,
    adapter_id: adapterId, effect: {
      capability_id: effect.capability_id, principal: effect.principal, kind: effect.kind, target: effect.target,
      file_action: effect.file_action ?? null, cost_usd: effect.cost_usd ?? 0, idempotency_key: effect.idempotency_key,
      adapter_input: effect.adapter_input ?? null, readback: effect.readback ?? null, compensation: effect.compensation ?? null
    }
  };
}

function safeReceiptView(effect, adapterId) {
  const input = effect.adapter_input ?? {};
  return {
    adapter_id: adapterId, capability_id: effect.capability_id, principal: effect.principal, kind: effect.kind,
    target: effect.target, file_action: effect.file_action ?? null, cost_usd: effect.cost_usd ?? 0,
    idempotency_key_sha256: digest(effect.idempotency_key), method: input.method ?? null,
    body_sha256: input.body === undefined ? null : digest(typeof input.body === "string" ? input.body : stable(input.body))
  };
}

function readJsonIfPresent(file) {
  try {
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`refusing symlinked effect receipt ${file}`);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function readIntegrityReceipt(file) {
  const receipt = readJsonIfPresent(file);
  if (!receipt) return null;
  const claimed = receipt.receipt_digest;
  const unsigned = { ...receipt };
  delete unsigned.receipt_digest;
  if (!/^[a-f0-9]{64}$/.test(claimed ?? "") || digest(unsigned) !== claimed) throw new Error(`effect receipt integrity mismatch ${file}`);
  return receipt;
}

function fileReadback(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("effect target is not a regular file");
    const bytes = fs.readFileSync(file);
    return { confirmed: true, exists: true, sha256: digest(bytes), byte_length: bytes.length };
  } catch (error) {
    if (error.code === "ENOENT") return { confirmed: true, exists: false, sha256: null, byte_length: 0 };
    throw error;
  }
}

function decodeContent(input) {
  const hasUtf8 = typeof input?.content_utf8 === "string";
  const hasBase64 = typeof input?.content_base64 === "string";
  if (hasUtf8 === hasBase64) throw new Error("filesystem write requires exactly one of content_utf8 or content_base64");
  return hasUtf8 ? Buffer.from(input.content_utf8, "utf8") : Buffer.from(input.content_base64, "base64");
}

function fileSnapshot(file, limit) {
  const readback = fileReadback(file);
  if (!readback.exists) return { exists: false, bytes_base64: null, mode: null, sha256: null };
  if (readback.byte_length > limit) throw new Error(`reversible snapshot exceeds ${limit} bytes`);
  const stat = fs.statSync(file);
  const bytes = fs.readFileSync(file);
  return { exists: true, bytes_base64: bytes.toString("base64"), mode: stat.mode & 0o777, sha256: digest(bytes) };
}

function runFilesystemAdapter(context) {
  const { effect, adapterId, repoRoot, snapshotPath, snapshotLimit } = context;
  if (adapterId === "filesystem.read-file-v2") {
    const file = secureTarget(repoRoot, effect.target, { must_exist: true });
    return { output: fileReadback(file), readback: fileReadback(file), reversible: false };
  }
  const mustExist = effect.file_action !== "CREATE";
  const file = secureTarget(repoRoot, effect.target, { must_exist: mustExist });
  const before = fileSnapshot(file, snapshotLimit);
  atomicWrite(snapshotPath, `${JSON.stringify(before)}\n`);
  if (adapterId === "filesystem.delete-file-v2") {
    if (effect.file_action !== "DELETE") throw new Error("filesystem.delete-file-v2 requires DELETE file_action");
    if (!before.exists) throw new Error("delete target does not exist");
    fs.unlinkSync(file);
  } else {
    if (!new Set(["CREATE", "MODIFY"]).has(effect.file_action)) throw new Error("filesystem.write-file-v2 requires CREATE or MODIFY file_action");
    if (effect.file_action === "CREATE" && before.exists) throw new Error("create target already exists");
    if (effect.file_action === "MODIFY" && !before.exists) throw new Error("modify target does not exist");
    const bytes = decodeContent(effect.adapter_input);
    atomicWrite(file, bytes, effect.adapter_input?.mode ?? before.mode ?? 0o600);
  }
  const readback = fileReadback(file);
  return { output: readback, readback, reversible: true, compensation_digest: digest(before) };
}

function restoreFilesystem(context) {
  const snapshot = readJsonIfPresent(context.snapshotPath);
  if (!snapshot) throw new Error("filesystem compensation snapshot is missing");
  if (digest(snapshot) !== context.receipt.compensation_digest) throw new Error("filesystem compensation snapshot digest mismatch");
  const file = secureTarget(context.repoRoot, context.effect.target, { must_exist: snapshot.exists });
  if (snapshot.exists) atomicWrite(file, Buffer.from(snapshot.bytes_base64, "base64"), snapshot.mode);
  else {
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const readback = fileReadback(file);
  if (readback.exists !== snapshot.exists || readback.sha256 !== snapshot.sha256) throw new Error("filesystem compensation readback mismatch");
  return readback;
}

function runGitCheckpoint(context) {
  const input = context.effect.adapter_input ?? {};
  if (!Array.isArray(input.paths) || input.paths.length === 0 || input.paths.some((entry) => !nonEmpty(entry) || entry.startsWith("-") || path.posix.isAbsolute(entry) || path.posix.normalize(entry) !== entry || entry.startsWith("../"))) {
    throw new Error("git checkpoint paths must be safe relative pathspecs");
  }
  if (!nonEmpty(input.message)) throw new Error("git checkpoint message is required");
  const git = context.spawnSync ?? spawnSync;
  const staged = git("git", ["add", "--", ...input.paths], { cwd: context.repoRoot, encoding: "utf8", shell: false, timeout: context.timeoutMs });
  if (staged.error || staged.status !== 0) throw new Error(`git add failed: ${staged.error?.message ?? staged.stderr}`);
  const committed = git("git", ["commit", "-m", input.message], { cwd: context.repoRoot, encoding: "utf8", shell: false, timeout: context.timeoutMs });
  if (committed.error || committed.status !== 0) throw new Error(`git commit failed: ${committed.error?.message ?? committed.stderr}`);
  const head = git("git", ["rev-parse", "HEAD"], { cwd: context.repoRoot, encoding: "utf8", shell: false, timeout: context.timeoutMs });
  if (head.error || head.status !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim())) throw new Error("git checkpoint readback failed");
  return { output: { sha: head.stdout.trim() }, readback: { confirmed: true, sha: head.stdout.trim() }, reversible: false };
}

function checkedUrl(value, expected) {
  const url = new URL(value);
  if (!new Set(["https:", ...(expected?.allow_http_for_test ? ["http:"] : [])]).has(url.protocol)) throw new Error("effect URL must use HTTPS");
  if (url.username || url.password || url.hash) throw new Error("effect URL cannot contain credentials or fragments");
  return url.toString();
}

async function fetchRequest(spec, context, write) {
  const url = checkedUrl(spec.url, context.options);
  const method = (spec.method ?? (write ? "POST" : "GET")).toUpperCase();
  const allowed = write ? new Set(["POST", "PUT", "PATCH", "DELETE"]) : new Set(["GET", "HEAD"]);
  if (!allowed.has(method)) throw new Error(`HTTP adapter forbids method ${method}`);
  const headers = { ...(spec.headers ?? {}) };
  for (const key of Object.keys(headers)) if (key.toLowerCase() === "idempotency-key") delete headers[key];
  if (write) headers["idempotency-key"] = spec.idempotency_key ?? context.effect.idempotency_key;
  const body = spec.body === undefined ? undefined : (typeof spec.body === "string" ? spec.body : JSON.stringify(spec.body));
  const response = await (context.options.fetch ?? globalThis.fetch)(url, { method, headers, body, redirect: "error", signal: AbortSignal.timeout(context.options.timeout_ms ?? 30_000) });
  const responseBody = await response.text();
  if (Buffer.byteLength(responseBody) > (context.options.max_response_bytes ?? 1024 * 1024)) throw new Error("HTTP effect response exceeds limit");
  return { ok: response.ok, status: response.status, url, body_sha256: digest(responseBody), byte_length: Buffer.byteLength(responseBody) };
}

async function httpReadback(spec, context) {
  if (!spec || typeof spec !== "object" || !spec.url) throw new Error("external write requires explicit readback");
  const observed = await fetchRequest({ ...spec, method: spec.method ?? "GET" }, context, false);
  const expected = spec.expected ?? {};
  if (expected.status === undefined && expected.body_sha256 === undefined) throw new Error("external readback requires an expected status or body digest");
  const confirmed = observed.ok && (expected.status === undefined || observed.status === expected.status) &&
    (expected.body_sha256 === undefined || observed.body_sha256 === expected.body_sha256);
  return { ...observed, confirmed };
}

async function runHttpAdapter(context) {
  const write = HTTP_WRITE_KINDS.has(context.effect.kind);
  const input = context.effect.adapter_input ?? {};
  const authorizedUrl = new URL(checkedUrl(context.effect.target, context.options));
  if (checkedUrl(input.url, context.options) !== authorizedUrl.toString()) throw new Error("HTTP adapter URL must equal authorized target");
  if (write && input.idempotency_key !== undefined && input.idempotency_key !== context.effect.idempotency_key) throw new Error("HTTP adapter cannot override the authorized idempotency_key");
  for (const candidate of [context.effect.readback?.url, context.effect.compensation?.request?.url, context.effect.compensation?.readback?.url].filter(Boolean)) {
    if (new URL(checkedUrl(candidate, context.options)).origin !== authorizedUrl.origin) throw new Error("readback and compensation must stay on the authorized target origin");
  }
  const output = await fetchRequest(write ? { ...input, idempotency_key: context.effect.idempotency_key } : input, context, write);
  if (!output.ok) throw new Error(`HTTP effect returned ${output.status}`);
  const readback = write ? await httpReadback(context.effect.readback, context) : { ...output, confirmed: true };
  if (!readback.confirmed) throw new Error("HTTP effect readback did not confirm expected remote identity");
  if (context.authorization.reversible && (!context.effect.compensation?.request || !context.effect.compensation?.readback)) {
    throw new Error("reversible external effect requires compensation request and readback");
  }
  return {
    output, readback, reversible: context.authorization.reversible,
    compensation_digest: context.effect.compensation ? digest(context.effect.compensation) : null
  };
}

async function rerunReadback(receipt, context) {
  if (receipt.adapter_id.startsWith("filesystem.")) {
    const file = secureTarget(context.repoRoot, context.effect.target, { must_exist: false });
    const observed = fileReadback(file);
    return { ...observed, confirmed: observed.exists === receipt.readback.exists && observed.sha256 === receipt.readback.sha256 };
  }
  if (receipt.adapter_id === "git.checkpoint-v2") {
    const result = (context.options.spawn_sync ?? spawnSync)("git", ["rev-parse", "HEAD"], { cwd: context.repoRoot, encoding: "utf8", shell: false, timeout: context.options.timeout_ms ?? 30_000 });
    return { confirmed: !result.error && result.status === 0 && result.stdout.trim() === receipt.readback.sha, sha: result.stdout?.trim() ?? null };
  }
  return HTTP_WRITE_KINDS.has(context.effect.kind) ? httpReadback(context.effect.readback, context) : receipt.readback;
}

function validateAdapter(effect, adapterId) {
  const expectedKind = BUILT_IN_EFFECT_ADAPTER_KINDS[adapterId];
  if (!expectedKind) throw new Error(`unknown built-in effect adapter ${adapterId}`);
  if (expectedKind !== effect.kind) throw new Error(`adapter ${adapterId} cannot execute ${effect.kind}`);
  if (adapterId === "filesystem.delete-file-v2" && effect.file_action !== "DELETE") throw new Error("delete adapter requires DELETE action");
  if (adapterId === "filesystem.write-file-v2" && effect.file_action === "DELETE") throw new Error("write adapter cannot execute DELETE action");
}

function authorizeForExecution(capsule, effect, adapterId) {
  validateAdapter(effect, adapterId);
  const authorization = authorizeEffect(capsule, effect);
  if (!authorization.authorized) throw new Error(`effect authorization denied: ${authorization.errors.join("; ")}`);
  if (ROOT_ONLY_KINDS.has(effect.kind) && effect.principal !== "root") throw new Error(`${effect.kind} remains root-only`);
  if (!nonEmpty(effect.idempotency_key)) throw new Error("effect execution requires idempotency_key");
  return authorization;
}

export async function executeAuthorizedEffect(capsule, effect, options = {}) {
  const compiled = compileCapsule(capsule);
  if (!compiled.valid) return { valid: false, executed: false, errors: compiled.errors };
  let authorization;
  try { authorization = authorizeForExecution(capsule, effect, effect.adapter_id); }
  catch (error) { return { valid: false, executed: false, errors: [error.message] }; }
  if (authorization.reversible && effect.adapter_id === "git.checkpoint-v2") {
    return { valid: false, executed: false, errors: ["git checkpoint adapter has no reversible compensation implementation"] };
  }
  if (authorization.reversible && HTTP_WRITE_KINDS.has(effect.kind) && (!effect.compensation?.request || !effect.compensation?.readback)) {
    return { valid: false, executed: false, errors: ["reversible external effect requires compensation request and readback before execution"] };
  }
  if (authorization.reversible && HTTP_WRITE_KINDS.has(effect.kind) && (!nonEmpty(effect.compensation.request.idempotency_key) || effect.compensation.request.idempotency_key === effect.idempotency_key)) {
    return { valid: false, executed: false, errors: ["external compensation requires a distinct idempotency_key"] };
  }
  const repoRoot = fs.realpathSync(options.repo_root ?? process.cwd());
  const identity = requestIdentity(capsule, effect, effect.adapter_id);
  const requestDigest = digest(identity);
  const keyDigest = digest({ task_id: capsule.task_id, capability_id: effect.capability_id, idempotency_key: effect.idempotency_key });
  const paths = receiptPaths(options.receipt_root ?? path.join(repoRoot, ".svc", "runtime-v2"), keyDigest);
  const context = {
    capsule, effect, adapterId: effect.adapter_id, authorization, repoRoot, options,
    snapshotPath: paths.snapshot, snapshotLimit: options.snapshot_limit_bytes ?? 4 * 1024 * 1024,
    spawnSync: options.spawn_sync, timeoutMs: options.timeout_ms ?? 30_000
  };
  try { return await withEffectLock(paths.lock, async () => {
    const existing = readIntegrityReceipt(paths.receipt);
    if (existing) {
      if (existing.request_digest !== requestDigest) return { valid: false, executed: false, errors: ["idempotency key already binds a different effect request"] };
      if (existing.status !== "CONFIRMED" && existing.status !== "OBSERVED") return { valid: false, executed: false, errors: [`prior effect status ${existing.status} requires operator resolution`] };
      try {
        const readback = await rerunReadback(existing, context);
        if (!readback.confirmed) return { valid: false, executed: false, errors: ["idempotent effect receipt no longer matches live readback"], receipt: existing };
        return { valid: true, executed: false, idempotent: true, authorization, readback, receipt: existing };
      } catch (error) { return { valid: false, executed: false, errors: [`idempotent readback failed: ${error.message}`], receipt: existing }; }
    }

    const startedAt = canonicalTime(options.started_at ?? new Date().toISOString());
    try {
      let result;
      if (effect.adapter_id.startsWith("filesystem.")) result = runFilesystemAdapter(context);
      else if (effect.adapter_id === "git.checkpoint-v2") result = runGitCheckpoint(context);
      else result = await runHttpAdapter(context);
      const receipt = {
        schema_version: 2, kind: "effect", task_id: capsule.task_id, capsule_digest: compiled.capsule_digest,
        generation_bindings: capsule.generation_bindings, authorization_digest: authorization.effect_digest,
        request_digest: requestDigest, adapter_id: effect.adapter_id, effect: safeReceiptView(effect, effect.adapter_id),
        status: MUTATING_KINDS.has(effect.kind) ? "CONFIRMED" : "OBSERVED", started_at: startedAt,
        finished_at: canonicalTime(options.finished_at ?? new Date().toISOString()), output: result.output,
        readback: result.readback, reversible: result.reversible, compensation_digest: result.compensation_digest ?? null
      };
      receipt.receipt_digest = digest(receipt);
      atomicWrite(paths.receipt, `${JSON.stringify(receipt)}\n`);
      return { valid: true, executed: true, idempotent: false, authorization, receipt, receipt_path: paths.receipt };
    } catch (error) {
      const failure = {
        schema_version: 2, kind: "effect", task_id: capsule.task_id, capsule_digest: compiled.capsule_digest,
        generation_bindings: capsule.generation_bindings, authorization_digest: authorization.effect_digest,
        request_digest: requestDigest, adapter_id: effect.adapter_id, effect: safeReceiptView(effect, effect.adapter_id),
        status: "UNKNOWN", started_at: startedAt, finished_at: canonicalTime(options.finished_at ?? new Date().toISOString()),
        error: error.message, readback: null, reversible: authorization.reversible, compensation_digest: effect.compensation ? digest(effect.compensation) : null
      };
      failure.receipt_digest = digest(failure);
      atomicWrite(paths.receipt, `${JSON.stringify(failure)}\n`);
      return { valid: false, executed: false, errors: [error.message], authorization, receipt: failure, receipt_path: paths.receipt };
    }
  }, options.lock_timeout_ms ?? 5000); }
  catch (error) { return { valid: false, executed: false, errors: [error.message] }; }
}

export async function compensateAuthorizedEffect(capsule, effect, options = {}) {
  let authorization;
  try { authorization = authorizeForExecution(capsule, effect, effect.adapter_id); }
  catch (error) { return { valid: false, compensated: false, errors: [error.message] }; }
  if (!authorization.reversible) return { valid: false, compensated: false, errors: ["effect capability is not reversible"] };
  const repoRoot = fs.realpathSync(options.repo_root ?? process.cwd());
  const requestDigest = digest(requestIdentity(capsule, effect, effect.adapter_id));
  const keyDigest = digest({ task_id: capsule.task_id, capability_id: effect.capability_id, idempotency_key: effect.idempotency_key });
  const paths = receiptPaths(options.receipt_root ?? path.join(repoRoot, ".svc", "runtime-v2"), keyDigest);
  try { return await withEffectLock(paths.lock, async () => {
    const receipt = readIntegrityReceipt(paths.receipt);
    if (!receipt || receipt.request_digest !== requestDigest || receipt.status !== "CONFIRMED") return { valid: false, compensated: false, errors: ["confirmed matching effect receipt is required before compensation"] };
    const existing = readIntegrityReceipt(paths.compensation);
    if (existing) {
    try {
      let confirmed = false;
      if (effect.adapter_id.startsWith("filesystem.")) {
        const observed = fileReadback(secureTarget(repoRoot, effect.target, { must_exist: false }));
        confirmed = observed.exists === existing.readback.exists && observed.sha256 === existing.readback.sha256;
      } else if (HTTP_WRITE_KINDS.has(effect.kind)) {
        const observed = await httpReadback(effect.compensation?.readback, { effect, options });
        confirmed = observed.confirmed;
      }
      if (!confirmed) return { valid: false, compensated: false, errors: ["compensation receipt no longer matches live readback"], receipt: existing };
      return { valid: true, compensated: false, idempotent: true, receipt: existing };
    } catch (error) { return { valid: false, compensated: false, errors: [`compensation readback failed: ${error.message}`], receipt: existing }; }
    }
    try {
      let readback;
      if (effect.adapter_id.startsWith("filesystem.")) {
        readback = restoreFilesystem({ effect, receipt, repoRoot, snapshotPath: paths.snapshot });
      } else if (HTTP_WRITE_KINDS.has(effect.kind)) {
        if (!effect.compensation || digest(effect.compensation) !== receipt.compensation_digest) throw new Error("compensation request does not match effect receipt");
        const context = { effect, options };
        const output = await fetchRequest(effect.compensation.request, context, true);
        if (!output.ok) throw new Error(`compensation returned ${output.status}`);
        readback = await httpReadback(effect.compensation.readback, context);
        if (!readback.confirmed) throw new Error("compensation readback did not confirm rollback");
      } else throw new Error(`adapter ${effect.adapter_id} has no reversible compensation implementation`);
      const compensation = {
        schema_version: 2, kind: "effect-compensation", effect_receipt_digest: receipt.receipt_digest,
        request_digest: requestDigest, adapter_id: effect.adapter_id, task_id: capsule.task_id,
        compensated_at: canonicalTime(options.compensated_at ?? new Date().toISOString()), readback
      };
      compensation.receipt_digest = digest(compensation);
      atomicWrite(paths.compensation, `${JSON.stringify(compensation)}\n`);
      return { valid: true, compensated: true, idempotent: false, receipt: compensation, receipt_path: paths.compensation };
    } catch (error) { return { valid: false, compensated: false, errors: [error.message] }; }
  }, options.lock_timeout_ms ?? 5000); }
  catch (error) { return { valid: false, compensated: false, errors: [error.message] }; }
}

export function readEffectReceipt(receiptRoot, capsule, effect) {
  const keyDigest = digest({ task_id: capsule.task_id, capability_id: effect.capability_id, idempotency_key: effect.idempotency_key });
  const paths = receiptPaths(receiptRoot, keyDigest);
  return { effect: readIntegrityReceipt(paths.receipt), compensation: readIntegrityReceipt(paths.compensation) };
}
