// Orchestrator relay for the eval's framework arm. The framework's adversarial review is
// cross-family (Codex) and must never fall back to a same-model reviewer. Inside the builder
// sandbox every foreign agent CLI is a shim that exits 127, so the framework's own launchers
// (scripts/run-external-review.mjs and the two-box planner) cannot run. This module is the
// runner-side answer: a unix-socket server, started per job OUTSIDE the sandbox, that executes
// the REAL `codex` found on the runner's PATH for the framework's review and planning calls
// ONLY. It is not a general model proxy for the builder:
//   - an `exec` call is accepted only as a framework request: its prompt (read from stdin) must
//     begin with one of the framework's LOCKED reviewer or planner prompt templates (the caller
//     derives them from the installed framework source and passes them as `policies`), its
//     --output-schema must be the schema that template is bound to, and its phase must match
//     (a review runs in the job's own tree, a planning role in a neutral empty directory with
//     the job hidden). Anything else is refused, as is any exec call without --json;
//   - what comes back is the framework's JSON and nothing else: stdout is filtered to the
//     turn/usage events and the final message, which must parse, validate against the schema
//     and keep every string short (a reviewer that can read source cannot return it);
//   - the sandbox is forced to read-only; write/danger flags, sandbox/approval config and
//     feature enabling are refused, never passed on;
//   - the working directory must be the job's build dir, a path under the job home (the
//     sandbox HOME), or a neutral sandbox /tmp dir (mapped to a fresh empty host dir);
//   - output returned to the sandbox is capped;
//   - each job gets its own CODEX_HOME holding only the runner's auth, so a reviewer sees no
//     other conversation or session;
//   - a per-call timeout, a per-job call cap and a per-call spend ceiling; accounting is kept
//     apart from the bounded diagnostic log, updates as usage events arrive, and reserves an
//     estimate for a running call that has reported none.
// The client half (review-relay-client.mjs) is installed in the job home as the `codex` shim.
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SANDBOX_HOME = "/tmp/oe-home";
export const RELAY_DIR = ".oe-relay";
export const RELAY_SOCK = "s";
export const DEFAULT_MAX_CALLS = 12;
export const DEFAULT_CALL_TIMEOUT_MS = 1_800_000;
export const DEFAULT_MAX_CALL_USD = 2;
export const CTX_SENTINEL = "@@SVC_RELAY_CONTEXT_ROOT@@";
// Returned-JSON bounds per phase: a review can read the job's source, so its strings are short;
// a planning role sees only what its prompt supplied, so its strings may carry a plan.
export const PHASE_LIMITS = Object.freeze({ review: { maxString: 2048, maxTotal: 65536 }, plan: { maxString: 32768, maxTotal: 262144 } });
const CAPTURE_CAP = 16 * 1024 * 1024;
// Config the RELAY adds to every codex exec / debug prompt-input call (the caller cannot set or
// drop it). A fresh Codex home gets Codex's own bundled skills (imagegen, openai-docs,
// skill-creator, skill-installer) written into $CODEX_HOME/skills/.system, and the prompt then
// advertises them in a <skills_instructions> block that names SKILL.md. The framework's planner
// cannot disable them (it lists skills under the sandbox HOME, not the relay's CODEX_HOME) and
// its native-profile check rightly treats a skills catalog as injected. Starting Codex without
// its bundled skills is the clean native profile; nothing is hidden from or faked for the check.
export const RELAY_CONFIG = Object.freeze(["-c", "skills.bundled.enabled=false"]);
export const DEFAULT_STDOUT_CAP = 2 * 1024 * 1024;
export const DEFAULT_LAST_MESSAGE_CAP = 512 * 1024;
const STDERR_CAP = 256 * 1024;       // probes
const EXEC_STDERR_CAP = 4096;       // exec calls: a log line or two, never a data channel
const MAX_PROBES = 60;
const MAX_REJECT_LOG = 50;
const MAX_STDIN = 32 * 1024 * 1024;
export const CLIENT_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "review-relay-client.mjs");

const isUnder = (p, base) => { const r = path.relative(base, p); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };
export const sha256Hex = (b) => crypto.createHash("sha256").update(b).digest("hex");

// --- argv vetting ---------------------------------------------------------------------

const BOOL_FLAGS = new Set(["--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--strict-config", "--json"]);
const INFO_FLAGS = new Set(["--help", "-h", "--version", "-V"]);
// Flags that take a value, by canonical name.
const VALUE_FLAGS = { "-c": "config", "--config": "config", "-m": "model", "--model": "model", "-s": "sandbox", "--sandbox": "sandbox", "-C": "cd", "--cd": "cd", "--output-schema": "schema", "-o": "last", "--output-last-message": "last", "--color": "color" };
const REFUSED_NOTE = {
  "--dangerously-bypass-approvals-and-sandbox": "write/danger flag", "--full-auto": "write/danger flag", "--yolo": "write/danger flag",
  "--approve-for-me": "write/danger flag", "--dangerously-bypass-hook-trust": "write/danger flag", "--add-dir": "writable directory", "--worktree": "creates a worktree",
};
// Config a review or planning call may set: the model and its reasoning, and the isolation
// settings the two-box planner passes (project docs off, web search off, empty developer
// instructions, features off, skills disabled). Nothing that widens what the model may do.
function configOk(kv) {
  const m = /^([A-Za-z0-9_.]+)=(.*)$/s.exec(kv);
  if (!m) return "not key=value";
  const [, k, v] = m;
  if (/^(model|model_reasoning_effort|model_reasoning_summary|model_verbosity)$/.test(k)) return null;
  if (/^(hide_agent_reasoning|show_raw_agent_reasoning)$/.test(k)) return null;
  if (k === "project_doc_max_bytes") return /^\d+$/.test(v) ? null : "project_doc_max_bytes must be a number";
  if (k === "web_search") return /^"disabled"$/.test(v) ? null : "web_search must stay disabled";
  if (k === "developer_instructions") return v === '""' ? null : "developer_instructions must stay empty";
  if (k === "skills.config") return /^\[.*\]$/s.test(v) && !/enabled\s*=\s*true/.test(v) ? null : "skills.config may only disable skills";
  const f = /^features\.([a-z0-9_]+)$/.exec(k);
  if (f) return (f[1] === "skip_host_skill_discovery" || v === "false") ? null : "features may only be turned off";
  return `${k} may not be overridden`;
}

const refuse = (reason) => ({ ok: false, reason });
const infoCall = (args, extra = {}) => ({ ok: true, kind: "info", info: true, args, cwdArg: null, schema: null, last: null, model: null, json: false, promptChars: 0, ...extra });

// Vet the client's argv. Returns {ok, kind: "exec"|"info", info, args, cwdArg, schema, last,
// model, json, promptChars}; `args` is the argv to run (after `codex`) with -s read-only
// enforced for exec and the file options kept as the client wrote them (the server swaps the
// paths for scratch files).
export function vetCodexArgv(argv) {
  if (!Array.isArray(argv) || argv.some((a) => typeof a !== "string") || argv.length > 200) return refuse("malformed argv");
  if (argv.some((a) => a.length > 4_000_000)) return refuse("argument too large");
  // Probes the launchers make before a paid call: no model is called.
  if (argv.length === 1 && (INFO_FLAGS.has(argv[0]) || argv[0] === "help")) return infoCall([...argv]);
  if (argv.length === 2 && argv[0] === "features" && argv[1] === "list") return infoCall([...argv]);
  if (argv[0] === "debug" && argv[1] === "prompt-input") return vetPromptInput(argv);
  if (argv[0] !== "exec") return refuse("only `codex exec` for review and planning is relayed; this CLI is otherwise blocked in the sandbox");
  const rest = argv.slice(1);
  const out = []; let info = false, sandboxSeen = false, cwdArg = null, schema = null, last = null, model = null, json = false, positional = 0, promptChars = 0;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-") { positional++; out.push(a); continue; }
    if (!a.startsWith("-")) {
      if (positional === 0 && ["resume", "fork", "review", "help"].includes(a)) return refuse(`codex exec ${a} is not relayed`);
      // The framework's launchers send the prompt on stdin; an argument prompt is the builder's own.
      return refuse("exec prompts come from stdin (the framework's locked templates); an argument prompt is not relayed");
    }
    if (a === "--") return refuse("`--` is not accepted");
    let name = a, val = null;
    const eq = a.startsWith("--") ? a.indexOf("=") : -1;
    if (eq > 0) { name = a.slice(0, eq); val = a.slice(eq + 1); }
    if (REFUSED_NOTE[name]) return refuse(`${name} refused: ${REFUSED_NOTE[name]} (reviews run read-only)`);
    if (INFO_FLAGS.has(name)) { info = true; out.push(name); continue; }
    if (BOOL_FLAGS.has(name) && val == null) { if (name === "--json") json = true; out.push(name); continue; }
    const kind = VALUE_FLAGS[name];
    if (!kind) return refuse(`${name} is not accepted by the review relay`);
    if (val == null) { val = rest[++i]; if (val == null) return refuse(`${name} needs a value`); }
    if (kind === "sandbox") {
      if (val !== "read-only") return refuse(`-s ${val} refused: reviews run read-only`);
      sandboxSeen = true; out.push("-s", "read-only"); continue;
    }
    if (kind === "config") {
      const bad = configOk(val);
      if (bad) return refuse(`-c ${String(val).slice(0, 60)} refused: ${bad}`);
      const m = /^model=(.*)$/s.exec(val);
      if (m) model = m[1].replace(/^"|"$/g, "");
      out.push("-c", val); continue;
    }
    if (kind === "model") {
      if (!/^[A-Za-z0-9._:/-]{1,100}$/.test(val)) return refuse("model name not accepted");
      model = val; out.push("-m", val); continue;
    }
    if (kind === "cd") { cwdArg = val; continue; }
    if (kind === "schema") { schema = val; out.push("--output-schema", val); continue; }
    if (kind === "last") { last = val; out.push("--output-last-message", val); continue; }
    if (kind === "color") { if (!["always", "never", "auto"].includes(val)) return refuse("--color value not accepted"); out.push("--color", val); continue; }
  }
  if (info) return infoCall(["exec", ...out], { model });
  if (!sandboxSeen) out.unshift("-s", "read-only");
  if (!json) return refuse("--json is required so that usage is reported and charged");
  if (schema == null) return refuse("exec calls must carry the framework's review or planning --output-schema; free-form generation is not relayed");
  return { ok: true, kind: "exec", info: false, args: ["exec", ...out], cwdArg, schema, last, model, json, promptChars };
}

// `codex debug prompt-input [-c k=v ...] [--help] [prompt]`: renders the prompt locally; no model.
function vetPromptInput(argv) {
  const rest = argv.slice(2); const out = ["debug", "prompt-input"]; let positional = 0;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (INFO_FLAGS.has(a)) { out.push(a); continue; }
    if (a === "-c" || a === "--config") {
      const v = rest[++i]; const bad = v == null ? "needs a value" : configOk(v);
      if (bad) return refuse(`-c ${String(v).slice(0, 60)} refused: ${bad}`);
      out.push("-c", v); continue;
    }
    if (a.startsWith("-")) return refuse(`${a} is not accepted by the review relay`);
    positional++; out.push(a);
  }
  if (positional > 1) return refuse("more than one prompt argument");
  return infoCall(out);
}

// What the row keeps of a call: the whole argv (flag values included: an argv carries no
// secrets, the prompt travels on stdin), except a trailing prompt argument, which is replaced by
// its length. Never truncated: a failed call must be reproducible from its record.
const VALUE_TAKING = new Set(["-c", "--config", "-m", "--model", "-s", "--sandbox", "-C", "--cd", "--output-schema", "-o", "--output-last-message", "--color"]);
export function sanitizeArgv(argv) {
  if (!Array.isArray(argv)) return [];
  return argv.map((a, i) => {
    const s = String(a);
    const isValue = i > 0 && VALUE_TAKING.has(String(argv[i - 1]));
    if (!isValue && !s.startsWith("-") && s.length > 60 && i > 0) return `<${s.length} chars>`;
    return s.length > 8000 ? `${s.slice(0, 8000)}...[${s.length} chars]` : s;
  });
}

// A short tail of what codex wrote to stderr, safe to keep on a row: the user's home and temp
// paths are shortened, long token-like strings and bearer values are removed.
export function redactTail(text, { max = 2048, homes = [os.homedir(), process.env.HOME] } = {}) {
  let t = String(text ?? "");
  for (const h of homes) if (h && h.length > 1) t = t.split(h).join("~");
  t = t.replace(/\/(?:tmp|var\/tmp)\/[A-Za-z0-9._-]*[A-Za-z0-9_-]{6,}/g, "/tmp/<tmp>")
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]{8,}/gi, "$1 <redacted>")
    .replace(/\b(sk|rk|pk|ghp|gho|ghs|xox[a-z])-?[A-Za-z0-9_-]{16,}/g, "<redacted>")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "<redacted>")
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
  t = t.trim();
  return t.length > max ? `...${t.slice(t.length - max)}` : t;
}

// --- usage ----------------------------------------------------------------------------

// Codex prints usage as JSONL when --json is set: a `turn.completed` event carries
// usage {input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens,
// reasoning_output_tokens} (checked against codex-cli 0.162). A call can run more than one
// turn, so turn totals are summed; an event outside turn.completed with a usage object is used
// only when no turn reported one. Input tokens include the cached ones; output tokens include
// reasoning. Returns null when the output has no usage.
export function parseCodexUsage(lines) {
  const turns = []; let other = null; const models = new Set();
  for (const line of lines) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    for (const m of [e.model, e.response?.model, e.turn?.model]) if (typeof m === "string") models.add(m);
    if (e.usage && typeof e.usage === "object") { if (e.type === "turn.completed") turns.push(e.usage); else other = e.usage; }
  }
  const use = turns.length ? turns : other ? [other] : [];
  if (!use.length) return null;
  const sum = (k) => use.reduce((n, u) => n + (Number(u[k]) || 0), 0);
  return { input_tokens: sum("input_tokens"), cached_input_tokens: sum("cached_input_tokens"), output_tokens: sum("output_tokens"), reasoning_output_tokens: sum("reasoning_output_tokens"), cache_write_input_tokens: sum("cache_write_input_tokens"), observed_models: [...models] };
}

// Usage in the shape the runner's model_usage uses (and priceUsage takes).
export function usageForPricing(u) {
  const cached = Math.min(u.cached_input_tokens || 0, u.input_tokens || 0);
  return { inputTokens: Math.max(0, (u.input_tokens || 0) - cached), cacheReadInputTokens: cached, outputTokens: u.output_tokens || 0, ...(u.cache_write_input_tokens ? { cacheCreationInputTokens: u.cache_write_input_tokens } : {}) };
}

// --- path mapping ---------------------------------------------------------------------

// Map a sandbox path to a host path, or null. The sandbox HOME is the job home on the host and
// the build dir is bound at the same path. The host path is resolved through symlinks and must
// stay inside one of the two; it must be an existing directory.
export function mapSandboxDir(p, { jobHome, buildDir }) {
  if (typeof p !== "string" || !path.isAbsolute(p)) return null;
  const norm = path.resolve(p);
  let host = null;
  if (isUnder(norm, SANDBOX_HOME)) host = path.join(jobHome, path.relative(SANDBOX_HOME, norm));
  else if (isUnder(norm, buildDir)) host = norm;
  else return null;
  try {
    const real = fs.realpathSync(host);
    if (!fs.statSync(real).isDirectory()) return null;
    const roots = [jobHome, buildDir].map((r) => { try { return fs.realpathSync(r); } catch { return r; } });
    return roots.some((r) => isUnder(real, r)) ? real : null;
  } catch { return null; }
}

// A working directory that lives only in the sandbox's private /tmp (two-box planning runs
// its reviewers from a fresh neutral temp dir there). It has no host counterpart, so it is
// never mapped to a host path: the call gets a new empty directory instead.
export function isNeutralSandboxDir(p, { buildDir }) {
  if (typeof p !== "string" || !path.isAbsolute(p)) return false;
  const norm = path.resolve(p);
  return norm !== "/tmp" && isUnder(norm, "/tmp") && !isUnder(norm, SANDBOX_HOME) && !isUnder(norm, buildDir);
}

// First executable named `name` on pathEnv.
export function findOnPath(name, pathEnv = process.env.PATH) {
  for (const d of String(pathEnv || "").split(path.delimiter).filter(Boolean)) {
    const f = path.join(d, name);
    try { fs.accessSync(f, fs.constants.X_OK); if (fs.statSync(f).isFile()) return f; } catch { /* next */ }
  }
  return null;
}

// --- server ---------------------------------------------------------------------------

function frame(type, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const head = Buffer.alloc(5);
  head.write(type, 0, 1, "latin1");
  head.writeUInt32BE(body.length, 1);
  return Buffer.concat([head, body]);
}

// A per-job Codex state directory: only the runner's login, nothing of its conversations,
// sessions, history or config. Returns the directory (0700).
export function makeIsolatedCodexHome(from = process.env.CODEX_HOME || path.join(os.homedir(), ".codex")) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "oe-codex-home-"));
  fs.chmodSync(d, 0o700);
  const auth = path.join(from, "auth.json");
  try { fs.copyFileSync(auth, path.join(d, "auth.json")); fs.chmodSync(path.join(d, "auth.json"), 0o600); } catch { /* API-key auth in the environment, or none */ }
  return d;
}

// --- request policies and output checks -------------------------------------------------

// A policy binds one framework request kind: its output schema (by content hash), its phase and
// its locked prompt text.
//   {label, phase: "review"|"plan", schemaHash, prefixes: [text...], templateSha256}
// review prefixes hold CTX_SENTINEL where the launcher writes the context root; plan prefixes
// are the role instruction followed by a blank line.
export function matchPrompt(policy, prompt, contextRoot) {
  if (typeof prompt !== "string" || !prompt.length) return "empty prompt";
  if (policy.phase === "review") {
    for (const t of policy.prefixes) {
      const head = t.split(CTX_SENTINEL).join(contextRoot);
      if (!prompt.startsWith(head)) continue;
      const body = prompt.slice(head.length);
      // The launcher refuses a request that does not carry the candidate digest; so does the relay.
      if (!/(^|[^0-9a-f])[0-9a-f]{64}([^0-9a-f]|$)/.test(body)) return "review request lacks a candidate digest";
      return null;
    }
    return "prompt does not begin with the framework's locked reviewer template for this context root";
  }
  for (const t of policy.prefixes) {
    if (!prompt.startsWith(t)) continue;
    const rest = prompt.slice(t.length);
    if (!rest.endsWith("\n")) return "planner payload is not newline terminated";
    let doc; try { doc = JSON.parse(rest); } catch { return "planner payload is not JSON"; }
    return doc && typeof doc === "object" && !Array.isArray(doc) ? null : "planner payload is not a JSON object";
  }
  return "prompt does not begin with the framework's locked planner template for this role";
}

// A small JSON-Schema checker for the keywords the framework's review and planning schemas
// use (plus anyOf/oneOf/const/$ref): the relay cannot trust a model's output to be valid.
export function validateAgainstSchema(value, schema, root = schema, where = "$") {
  const errs = [];
  if (schema === true || schema == null) return errs;
  if (schema.$ref) {
    const ref = String(schema.$ref); const target = ref.startsWith("#/") ? ref.slice(2).split("/").reduce((o, k) => o?.[k.replace(/~1/g, "/").replace(/~0/g, "~")], root) : null;
    return target ? validateAgainstSchema(value, target, root, where) : [`${where}: unresolved ${ref}`];
  }
  for (const key of ["anyOf", "oneOf"]) if (schema[key]) { if (!schema[key].some((b) => validateAgainstSchema(value, b, root, where).length === 0)) return [`${where}: no ${key} branch matched`]; }
  if (schema.allOf) for (const b of schema.allOf) errs.push(...validateAgainstSchema(value, b, root, where));
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) errs.push(`${where}: not the const`);
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((t) => t === actual || (t === "number" && actual === "integer"))) return [...errs, `${where}: expected ${types.join("|")}, got ${actual}`];
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) errs.push(`${where}: outside enum`);
  if (typeof value === "string") {
    if (Number.isInteger(schema.minLength) && value.trim().length < schema.minLength) errs.push(`${where}: shorter than ${schema.minLength}`);
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) errs.push(`${where}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${where}: pattern mismatch`);
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) errs.push(`${where}: below minimum`);
    if (typeof schema.maximum === "number" && value > schema.maximum) errs.push(`${where}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errs.push(`${where}: fewer than ${schema.minItems} items`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errs.push(`${where}: more than ${schema.maxItems} items`);
    if (schema.items && !Array.isArray(schema.items)) value.forEach((v, k) => errs.push(...validateAgainstSchema(v, schema.items, root, `${where}[${k}]`)));
  }
  if (actual === "object") {
    for (const k of schema.required || []) if (!Object.hasOwn(value, k)) errs.push(`${where}: missing ${k}`);
    const props = schema.properties || {};
    if (schema.additionalProperties === false) for (const k of Object.keys(value)) if (!Object.hasOwn(props, k)) errs.push(`${where}: unexpected ${k}`);
    for (const [k, sub] of Object.entries(props)) if (Object.hasOwn(value, k)) errs.push(...validateAgainstSchema(value[k], sub, root, `${where}.${k}`));
    if (schema.additionalProperties && typeof schema.additionalProperties === "object") for (const [k, v] of Object.entries(value)) if (!Object.hasOwn(props, k)) errs.push(...validateAgainstSchema(v, schema.additionalProperties, root, `${where}.${k}`));
  }
  return errs;
}

// Every string in the value is at most maxString characters and all of them together at most
// maxTotal. Returns an error text or null.
export function boundStrings(value, { maxString, maxTotal }) {
  let total = 0;
  const walk = (v, where) => {
    if (typeof v === "string") { total += v.length; return v.length > maxString ? `${where}: string of ${v.length} characters exceeds ${maxString}` : null; }
    if (Array.isArray(v)) { for (let k = 0; k < v.length; k++) { const e = walk(v[k], `${where}[${k}]`); if (e) return e; } return null; }
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) { const e = walk(x, `${where}.${k}`); if (e) return e; } }
    return null;
  };
  const e = walk(value, "$");
  return e || (total > maxTotal ? `returned strings total ${total} characters, over ${maxTotal}` : null);
}

// The framework's answer as text: parsed, schema-valid and short, or an error.
export function checkAnswer(text, schema, limits) {
  let doc; try { doc = JSON.parse(text); } catch { return "answer is not JSON"; }
  const bad = validateAgainstSchema(doc, schema);
  if (bad.length) return `answer is not schema-valid (${bad[0]})`;
  return boundStrings(doc, limits);
}

// Events a sandbox may see from an exec call. Tool output (file contents a reviewer read),
// reasoning and every other item type are dropped; only the final answer survives, and only if
// it passed checkAnswer.
const KEEP_EVENTS = new Set(["thread.started", "turn.started", "turn.completed", "turn.failed", "error"]);
export function filterEvents(stdoutText, onAnswer) {
  const kept = []; let badAnswer = null;
  for (const line of stdoutText.split("\n")) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    if (e.type === "item.completed" && e.item?.type === "agent_message") {
      const bad = onAnswer(String(e.item.text ?? ""));
      if (bad) { badAnswer = bad; continue; }
      kept.push(JSON.stringify({ type: e.type, item: { id: e.item.id, type: "agent_message", text: e.item.text } }));
    } else if (KEEP_EVENTS.has(e.type)) {
      const slim = { type: e.type };
      if (e.thread_id) slim.thread_id = String(e.thread_id).slice(0, 100);
      if (e.usage && typeof e.usage === "object") slim.usage = e.usage;
      if (e.error && typeof e.error === "object") slim.error = { message: String(e.error.message ?? "").slice(0, 1000) };
      if (typeof e.message === "string") slim.message = e.message.slice(0, 1000);
      kept.push(JSON.stringify(slim));
    }
  }
  return { text: kept.length ? `${kept.join("\n")}\n` : "", badAnswer };
}

// startRelay({ jobHome, buildDir, ... }) -> relay handle. Options:
//   policies       the framework's locked requests (see matchPrompt); without any, no exec call is accepted
//   codexBin       the real codex (default: first `codex` on pathEnv)
//   maxCalls       per-job cap on exec calls (default 12)
//   callTimeoutMs  per-call deadline (default 30 minutes)
//   deadlineAt     epoch ms after which no call may start and a running one is cut short
//   price(model, usage) -> {usd, known, basis}   prices one call's usage
//   maxCallUsd     the most a call may cost: while it runs and has reported no usage, this whole
//                  amount is counted against the job; a call whose reported usage passes it is stopped
//   unmeasuredCallUsd  charged for a finished call that reported no usage (default maxCallUsd)
//   stdoutCap      bytes of probe output returned to the sandbox
//   confine(ctx) -> argv prefix (e.g. a bwrap command) to run codex under;
//                  ctx = {cwd, logicalCwd, phase, scratch, neutral, codexHome, codexBin, info}
//   codexHomeFrom  where the runner's codex login lives (default CODEX_HOME or ~/.codex); the job gets an isolated copy of auth.json only
//   env            environment for codex (default: the runner's, minus SVC_* variables)
export async function startRelay({ jobHome, buildDir, policies = [], codexBin = null, pathEnv = process.env.PATH, maxCalls = DEFAULT_MAX_CALLS, callTimeoutMs = DEFAULT_CALL_TIMEOUT_MS, deadlineAt = null, price = null, maxCallUsd = DEFAULT_MAX_CALL_USD, unmeasuredCallUsd = undefined, stdoutCap = DEFAULT_STDOUT_CAP, confine = null, codexHomeFrom = undefined, env = null } = {}) {
  if (!jobHome || !buildDir) throw new Error("startRelay needs jobHome and buildDir");
  const bin = codexBin || findOnPath("codex", pathEnv);
  if (!bin) throw new Error("no codex binary on the runner's PATH");
  const charge = unmeasuredCallUsd ?? maxCallUsd;
  const dir = path.join(jobHome, RELAY_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const socketPath = path.join(dir, RELAY_SOCK);
  fs.rmSync(socketPath, { force: true });
  const codexHome = makeIsolatedCodexHome(codexHomeFrom);
  const childEnv = { ...(env || Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SVC_/.test(k) && k !== "CLAUDE_CONFIG_DIR" && k !== "OE_RELAY_SOCK"))), CODEX_HOME: codexHome };
  // Accounting is kept apart from the diagnostic log: the log is bounded, the ledger is not
  // (it holds at most maxCalls exec records), so a flood of refused requests cannot hide a paid call.
  const log = []; let rejectedTotal = 0, probeLogged = 0;
  const ledger = [];            // finished exec calls
  const running = new Set();    // exec calls in flight: {cost}
  const live = new Set();       // child processes
  let used = 0, probes = 0, closed = false;
  const sumLedger = () => ledger.reduce((n, c) => n + (c.cost_usd || 0), 0);
  const runningCost = () => { let n = 0; for (const r of running) n += r.cost; return n; };

  function priceUsage(model, usage) {
    if (!price || !usage) return null;
    try { const p = price(model, usageForPricing(usage)); return { usd: +p.usd.toFixed(6), known: p.known !== false, basis: p.basis || null }; } catch { return null; }
  }

  async function handle(sock) {
    let buf = Buffer.alloc(0), gotRequest = false, child = null, stdinBytes = 0, finished = false;
    const inChunks = []; let inEnded = false; let inWaiter = null;
    const send = (type, payload) => { if (!sock.destroyed && sock.writable) sock.write(frame(type, payload)); };
    const finish = (rec, exit, lastMessage = null) => {
      if (finished) return; finished = true;
      if (rec.rejected) { rejectedTotal++; if (log.filter((c) => c.rejected).length < MAX_REJECT_LOG) log.push(rec); }
      else if (rec.probe) { if (probeLogged++ < MAX_PROBES) log.push(rec); }
      else { ledger.push(rec); log.push(rec); }
      send("F", JSON.stringify({ exit, last_message: lastMessage }));
      sock.end();
    };
    const reject = (argv, reason) => {
      send("E", `codex: ${reason}\n`);
      finish({ argv_sanitized: sanitizeArgv(argv), exit: 126, wall_ms: 0, usage: null, rejected: reason }, 126);
    };
    const stdinAll = () => (inEnded ? Promise.resolve(Buffer.concat(inChunks)) : new Promise((res) => { inWaiter = res; }));
    async function start(req) {
      const argv = req.argv;
      const vet = vetCodexArgv(argv);
      if (!vet.ok) return reject(argv, vet.reason);
      if (closed) return reject(argv, "the review relay is closed");
      if (vet.info) { if (probes >= MAX_PROBES) return reject(argv, "too many probe calls"); }
      else {
        if (used >= maxCalls) return reject(argv, `review call cap reached (${maxCalls} per job)`);
        if (deadlineAt != null && Date.now() >= deadlineAt) return reject(argv, "the job's time is spent");
        if (typeof req.schema !== "string") return reject(argv, "--output-schema file was not provided");
      }
      // Which framework request is this? Exec calls must be one: the schema picks the candidates,
      // the prompt must carry the locked template of one of them, and the phase fixes where it runs.
      let policy = null, schemaDoc = null, prompt = null;
      if (!vet.info) {
        const h = sha256Hex(Buffer.from(req.schema, "utf8"));
        const cands = policies.filter((p) => p.schemaHash === h);
        if (!cands.length) return reject(argv, "--output-schema is not one of the framework's review or planning schemas; free-form generation is not relayed");
        try { schemaDoc = JSON.parse(req.schema); } catch { return reject(argv, "--output-schema is not JSON"); }
        prompt = (await stdinAll()).toString("utf8");
        const sandboxCwd = path.resolve(typeof req.cwd === "string" ? req.cwd : "/", vet.cwdArg ?? ".");
        const reasons = [];
        for (const c of cands) { const why = matchPrompt(c, prompt, sandboxCwd); if (!why) { policy = c; break; } reasons.push(why); }
        if (!policy) return reject(argv, `not a framework request: ${reasons[0]}`);
      }
      // Working directory. Info probes and planning calls run in a fresh empty directory; a review runs in the job.
      let cwd = null, mappedCd = null, neutralCwd = vet.info, neutralCd = false;
      const reqCwd = typeof req.cwd === "string" ? req.cwd : "";
      const logicalCwd = path.resolve(reqCwd || "/", vet.cwdArg ?? ".");
      if (!vet.info) {
        cwd = mapSandboxDir(reqCwd, { jobHome, buildDir });
        if (!cwd) {
          if (isNeutralSandboxDir(reqCwd, { buildDir })) neutralCwd = true;
          else return reject(argv, `working directory ${reqCwd || "<none>"} is outside the job (allowed: the build dir, the job home, or a neutral temp dir)`);
        }
        if (vet.cwdArg != null) {
          mappedCd = mapSandboxDir(logicalCwd, { jobHome, buildDir });
          if (!mappedCd) {
            if (isNeutralSandboxDir(logicalCwd, { buildDir })) neutralCd = true;
            else return reject(argv, `-C ${vet.cwdArg} is outside the job (allowed: the build dir, the job home, or a neutral temp dir)`);
          }
        }
        const neutralNow = vet.cwdArg != null ? neutralCd : neutralCwd;
        if (policy.phase === "plan" && !neutralNow) return reject(argv, "planning calls run from a neutral directory, not in the job");
        if (policy.phase === "review" && neutralNow) return reject(argv, "review calls run in the job's own tree");
      }
      const phase = vet.info ? "info" : policy.phase;
      if (vet.info) probes++; else used++;
      const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "oe-relay-"));
      const args = [...vet.args];
      let lastFile = null, neutral = null;
      try {
        if (neutralCwd || neutralCd) {
          // A fresh, empty directory per call; never an existing host path.
          neutral = path.join(scratch, "neutral"); fs.mkdirSync(neutral);
          if (neutralCwd) cwd = neutral;
          if (neutralCd) mappedCd = neutral;
        }
        if (vet.schema != null) {
          const f = path.join(scratch, "schema.json"); fs.writeFileSync(f, req.schema);
          args[args.indexOf(vet.schema, args.indexOf("--output-schema"))] = f;
        }
        if (vet.last != null) {
          lastFile = path.join(scratch, "last-message.txt");
          args[args.indexOf(vet.last, args.indexOf("--output-last-message"))] = lastFile;
        }
        if (mappedCd) args.splice(1, 0, "-C", mappedCd);
        if (args[0] === "exec") args.splice(1, 0, ...RELAY_CONFIG);
        else if (args[0] === "debug") args.splice(2, 0, ...RELAY_CONFIG);
      } catch (e) { fs.rmSync(scratch, { recursive: true, force: true }); return reject(argv, e.message); }
      // Inside a confinement the binary is run by its real path: a symlink such as ~/.codex/packages/
      // standalone/current points into a directory the confinement hides. Resolved when the call is built.
      let runBin = bin;
      if (confine) { try { runBin = fs.realpathSync(bin); } catch { /* run as given */ } }
      const prefix = confine ? confine({ cwd: mappedCd || cwd, logicalCwd, phase, scratch, neutral, codexHome, codexBin: runBin, info: vet.info }) : [];
      const cmd = prefix.length ? prefix[0] : bin;
      const cmdArgs = prefix.length ? [...prefix.slice(1), runBin, ...args] : args;
      const t0 = Date.now();
      let timedOut = false, stopped = null;
      const limit = Math.max(1, Math.min(callTimeoutMs, deadlineAt != null ? deadlineAt - Date.now() : Infinity));
      const usageLines = []; let partial = "", sentOut = 0, sentErr = 0, truncatedOut = false, captured = 0;
      let errTail = "", sawTurn = false;
      const errorEvents = [];   // codex's own error / turn.failed messages (--json prints them on stdout)
      let apiRejected = null;   // HTTP status (4xx) of an API rejection codex reported
      const chunks = [];
      // A running exec call counts its whole ceiling until it reports usage.
      const cur = vet.info ? null : { cost: maxCallUsd };
      if (cur) running.add(cur);
      const model = () => vet.model || null;
      try { child = spawn(cmd, cmdArgs, { cwd, env: childEnv, stdio: ["pipe", "pipe", "pipe"], detached: true }); }
      catch (e) { if (cur) running.delete(cur); fs.rmSync(scratch, { recursive: true, force: true }); return reject(argv, `cannot start codex: ${e.code || e.message}`); }
      live.add(child);
      const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* gone */ } } };
      const stop = (why) => { if (stopped) return; stopped = why; killGroup("SIGTERM"); setTimeout(() => killGroup("SIGKILL"), 1500).unref(); };
      const timer = setTimeout(() => { timedOut = true; stop("timeout"); }, limit);
      // Usage lines are priced as they arrive, so the watchdog sees a running call's spend.
      const noteLine = (l) => {
        // Did a model turn begin? Codex says so with thread.started / turn.started / turn.completed.
        if (!sawTurn && /"type"\s*:\s*"(thread\.started|turn\.started|turn\.completed)"/.test(l)) sawTurn = true;
        if (errorEvents.length < 3 && /"type"\s*:\s*"(error|turn\.failed)"/.test(l)) {
          try {
            const e = JSON.parse(l); const m = e.message ?? e.error?.message;
            if (typeof m === "string") {
              errorEvents.push(redactTail(m, { max: 500 }));
              // codex wraps the API's reply as JSON text: {"type":"error","status":400,...}
              try { const st = Number(JSON.parse(m).status); if (st >= 400 && st < 500) apiRejected = st; } catch { /* plain text */ }
            }
          } catch { /* not JSON */ }
        }
        if (!l.includes("\"usage\"") && !l.includes("\"model\"")) return;
        usageLines.push(l.length > 20000 ? l.slice(0, 20000) : l);
        if (!cur || !l.includes("\"usage\"")) return;
        const u = parseCodexUsage(usageLines);
        const p = u && priceUsage(model() || u.observed_models[0] || null, u);
        if (p) { cur.cost = p.usd; if (p.usd > maxCallUsd) stop("call-budget"); }
      };
      const absorb = (chunk) => {
        partial += chunk.toString("utf8");
        let nl;
        while ((nl = partial.indexOf("\n")) >= 0) { const l = partial.slice(0, nl); partial = partial.slice(nl + 1); noteLine(l); }
        if (partial.length > 1_000_000) partial = "";
      };
      child.stdout.on("data", (c) => {
        absorb(c);
        if (vet.info) {
          // Probe output streams back, capped.
          const room = stdoutCap - sentOut;
          if (room > 0) { const part = c.length > room ? c.subarray(0, room) : c; sentOut += part.length; send("O", part); }
          if (c.length > room && !truncatedOut) { truncatedOut = true; send("E", `codex: output beyond ${stdoutCap} bytes is not returned to the sandbox\n`); }
        } else if (captured <= CAPTURE_CAP) { captured += c.length; chunks.push(c); }
      });
      child.stderr.on("data", (c) => {
        errTail = (errTail + c.toString("utf8")).slice(-8192); const room = (vet.info ? STDERR_CAP : EXEC_STDERR_CAP) - sentErr; if (room > 0) { const part = c.length > room ? c.subarray(0, room) : c; sentErr += part.length; send("E", part); } });
      child.stdin.on("error", () => {});
      child.on("error", (e) => send("E", `codex: ${e.code || e.message}\n`));
      child.on("close", (code, signal) => {
        clearTimeout(timer); live.delete(child);
        if (partial) noteLine(partial);
        let exit = code ?? (signal ? 128 + (os.constants.signals[signal] || 9) : 1);
        if (timedOut) { exit = 124; send("E", `codex: review call exceeded its ${Math.round(limit / 1000)}s limit and was stopped\n`); }
        else if (stopped === "call-budget") { exit = 125; send("E", `codex: review call stopped at its spend ceiling ($${maxCallUsd})\n`); }
        const usage = vet.info ? null : parseCodexUsage(usageLines);
        let rec, last = null;
        if (vet.info) rec = { argv_sanitized: sanitizeArgv(argv), exit, wall_ms: Date.now() - t0, usage: null, probe: true, ...(errTail ? { stderr_tail: redactTail(errTail) } : {}) };
        else {
          const p = usage ? priceUsage(model() || usage.observed_models[0] || null, usage) : null;
          rec = { argv_sanitized: sanitizeArgv(argv), exit, wall_ms: Date.now() - t0, usage, request: policy.label, phase: policy.phase, template_sha256: policy.templateSha256 || null,
            model: model() || usage?.observed_models?.[0] || null,
            // Priced honestly: reported usage at its rate; a non-zero exit before any model turn
            // began cost nothing; a turn that began but reported no usage is charged the estimate.
            ...(p ? { cost_usd: p.usd, priced: { known: p.known, basis: p.basis } }
              : (exit !== 0 && !sawTurn) ? { cost_usd: 0, failed_before_turn: true, priced: { known: true, basis: "failed before a model turn" } }
                : (exit !== 0 && apiRejected) ? { cost_usd: 0, failed_before_turn: true, priced: { known: true, basis: `rejected by the API (status ${apiRejected}) before any model output` } }
                  : { cost_usd: charge, unmeasured: true, priced: { known: false, basis: "estimate: no usage reported" } }),
            ...(errTail ? { stderr_tail: redactTail(errTail) } : {}),
            ...(errorEvents.length ? { error_events: errorEvents } : {}),
            ...(p && p.usd > maxCallUsd ? { over_ceiling: true } : {}),
            ...(timedOut ? { timed_out: true } : {}), ...(stopped === "call-budget" ? { stopped: "call-budget" } : {}) };
          // What the sandbox gets back: the framework's answer, valid and short, and the turn events.
          const limits = PHASE_LIMITS[policy.phase];
          const answerBad = (text) => checkAnswer(text, schemaDoc, limits);
          let violation = null;
          if (captured > CAPTURE_CAP) violation = "output beyond the capture cap";
          const filtered = filterEvents(Buffer.concat(chunks).toString("utf8"), (t) => { const bad = answerBad(t); if (bad && !violation) violation = bad; return bad; });
          if (filtered.text) send("O", filtered.text);
          if (lastFile) {
            try {
              const text = fs.readFileSync(lastFile, "utf8");
              const bad = answerBad(text);
              if (bad) violation = violation || bad; else last = Buffer.from(text).toString("base64");
            } catch { /* none written */ }
          }
          if (violation) { send("E", `codex: output not returned: ${violation}\n`); if (exit === 0) exit = 125; rec.exit = exit; rec.output_refused = violation; }
        }
        if (cur) running.delete(cur);
        fs.rmSync(scratch, { recursive: true, force: true });
        finish(rec, exit, last);
      });
      for (const c of inChunks) child.stdin.write(c);
      child.stdin.end();
    }
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 5) {
        const len = buf.readUInt32BE(1);
        if (len > MAX_STDIN + 1_000_000) { sock.destroy(); return; }
        if (buf.length < 5 + len) break;
        const type = buf.toString("latin1", 0, 1), body = buf.subarray(5, 5 + len);
        buf = buf.subarray(5 + len);
        if (type === "R" && !gotRequest) {
          let req; try { req = JSON.parse(body.toString("utf8")); } catch { sock.destroy(); return; }
          gotRequest = true;
          start(req).catch((e) => { try { reject(req?.argv, `relay error: ${e.message}`); } catch { sock.destroy(); } });
        } else if (type === "I") {
          stdinBytes += body.length;
          if (stdinBytes > MAX_STDIN) { sock.destroy(); return; }
          inChunks.push(Buffer.from(body));
        } else if (type === "Z") {
          inEnded = true; if (inWaiter) { inWaiter(Buffer.concat(inChunks)); inWaiter = null; }
        }
      }
    });
    sock.on("close", () => { inEnded = true; if (inWaiter) { inWaiter(Buffer.concat(inChunks)); inWaiter = null; } if (child && child.exitCode == null && child.signalCode == null) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } } });
    sock.on("error", () => {});
  }

  const server = net.createServer((s) => { handle(s).catch(() => s.destroy()); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(socketPath, () => { server.off("error", reject); resolve(); }); });
  fs.chmodSync(socketPath, 0o600);

  return {
    socketPath,
    sandboxSocket: path.posix.join(SANDBOX_HOME, RELAY_DIR, RELAY_SOCK),
    codexBin: bin,
    codexHome,
    calls: () => log.slice(),
    execCalls: () => used,
    // Spend so far: finished calls plus every running call (its reported usage, or its whole ceiling).
    costUsd: () => sumLedger() + runningCost(),
    summary() {
      // Measured: every exec call reported usage AND was priced at a listed rate. Anything else
      // is an estimate and the row's cost cannot be compared.
      const measured = ledger.filter((c) => !c.unmeasured && c.priced?.known);
      const unmeasured = ledger.length - measured.length;
      const modelUsage = {};
      for (const c of ledger) {
        if (!c.usage) continue;
        const id = c.model || "codex-unspecified";
        const u = usageForPricing(c.usage);
        const t = (modelUsage[id] ??= { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 });
        t.inputTokens += u.inputTokens; t.outputTokens += u.outputTokens; t.cacheReadInputTokens += u.cacheReadInputTokens; t.cacheCreationInputTokens += u.cacheCreationInputTokens || 0; t.costUSD += c.cost_usd || 0;
      }
      return {
        reviewer_calls: log.slice(),
        reviewer_cost_usd: ledger.length === 0 ? 0 : +sumLedger().toFixed(6),
        reviewer_cost_basis: ledger.length === 0 ? null : unmeasured ? "estimate" : "list_price",
        reviewer_accounting: unmeasured ? "unmeasured" : "measured",
        reviewer_unpriced_calls: unmeasured,
        reviewer_rejected_calls: rejectedTotal,
        reviewer_wall_ms: ledger.reduce((n, c) => n + (c.wall_ms || 0), 0),
        reviewer_model_usage: modelUsage,
      };
    },
    async close() {
      closed = true;
      for (const c of live) { try { process.kill(-c.pid, "SIGKILL"); } catch { try { c.kill("SIGKILL"); } catch { /* gone */ } } }
      await new Promise((r) => server.close(() => r()));
      fs.rmSync(socketPath, { force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    },
  };
}

// The `codex` command placed in a framework-arm job home: runs the client over the relay socket.
export function writeRelayShim(home) {
  const d = path.join(home, ".oe-shims");
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(CLIENT_SOURCE, path.join(d, "codex-relay-client.mjs"));
  const sock = path.posix.join(SANDBOX_HOME, RELAY_DIR, RELAY_SOCK);
  fs.writeFileSync(path.join(d, "codex"), `#!/bin/sh\nOE_RELAY_SOCK=${sock} exec node "$(dirname "$0")/codex-relay-client.mjs" "$@"\n`, { mode: 0o755 });
}
