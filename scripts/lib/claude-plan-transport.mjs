/**
 * claude-plan-transport.mjs — isolated Claude Code transport for Two-Box planning roles.
 *
 * The Codex transport (isolated-plan-analysis.mjs) was the only planning transport, so a
 * Claude Code orchestrator under the default policy could never issue a v5 plan-manifest.
 * This module gives the same-family roles (open_box, contract_box, scouts, revise) a
 * Claude Code transport with the same guarantees the Codex path enforces:
 *
 *   - tool-free: `--tools ""`, no project/user settings, no MCP, no session file;
 *   - neutral, empty working directory outside the consumer's instruction chain;
 *   - the exact frozen prompt arrives on stdin and is hashed before launch;
 *   - a canary isolation probe (scripts/lib/harness-transports.mjs) must pass first;
 *   - the output is the CLI's `structured_output`, schema-validated by the caller.
 *
 * It never decides who may judge: the cross-family assessor rule lives in
 * scripts/two-box-plan.mjs and scripts/lib/control-plan-validate.mjs.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_LIMITS, IsolationUnsupported, canonicalJson, sha256Bytes, sha256Utf8,
} from "./two-box-protocol.mjs";
import { putObject } from "./review-evidence-store.mjs";
import { assertArgvFits, assertRequestBudget, freezeRequestBytes, PLANNING_REQUEST_MAX_BYTES } from "./frozen-request-input.mjs";
import { claude } from "./harness-transports.mjs";

export const CLAUDE_TRANSPORT = "claude_isolated";
export const CODEX_TRANSPORT = "codex_exec";
export const CLAUDE_FROZEN_TRANSPORT = "claude_stdin";
export const CLAUDE_INSPECTION_AUTHORITY = "claude_isolation_probe";
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const HOST_FAMILY = Object.freeze({ claude: "anthropic", codex: "openai" });
// Mirrors isolated-plan-analysis: whether the declared payload itself quotes framework paths.
const SOURCE_RE = /skills\/|AGENTS\.md|\bSSVE\b|DOCTRINE|SKILL\.md/;
// Allowlist, not denylist: the isolated process gets only runtime and authentication values.
// Customization channels (CLAUDE_CODE_EXTRA_BODY, CLAUDE_CODE_PLUGIN_DIRS, ANTHROPIC_CUSTOM_HEADERS,
// parent-session and svc identity, ...) are never forwarded, whatever their names.
const ENV_ALLOW_EXACT = new Set([
  "PATH", "HOME", "USER", "LOGNAME", "LANG", "LANGUAGE", "TERM", "TMPDIR", "TMP", "TEMP", "SHELL", "TZ",
  "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "XDG_RUNTIME_DIR",
  "CLAUDE_CONFIG_DIR",
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "ANTHROPIC_VERTEX_PROJECT_ID", "CLOUD_ML_REGION",
  "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT",
  "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy", "ALL_PROXY", "all_proxy",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS", "REQUESTS_CA_BUNDLE",
]);
const ENV_ALLOW_PREFIX = ["LC_", "AWS_"];
// Request/extension channels that would change what the model receives or loads.
const ENV_DENY_PATTERN = /EXTRA_BODY|PLUGIN|CUSTOM_HEADERS|SYSTEM_PROMPT|SETTINGS|MCP|HOOK|SKILL|APPEND|^SVC_|^_SVC_|^CODEX_|^CURSOR_|^CLAUDECODE$|SESSION/i;

export function planningTransportOf(host) {
  if (host === "claude") return CLAUDE_TRANSPORT;
  if (host === "codex") return CODEX_TRANSPORT;
  return null;
}

export function planningHostFamily(host) {
  return HOST_FAMILY[host] ?? null;
}

function fail(message) {
  throw new IsolationUnsupported(message);
}

export function claudeEnv(source = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") continue;
    if (ENV_DENY_PATTERN.test(key)) continue;
    if (ENV_ALLOW_EXACT.has(key) || ENV_ALLOW_PREFIX.some((p) => key.startsWith(p))) env[key] = value;
  }
  return env;
}

export function requireClaudeTuple(tuple) {
  if (!tuple || typeof tuple !== "object") fail("tuple required");
  if (tuple.host !== "claude") fail(`unsupported planning transport: ${tuple.host}`);
  if (tuple.family !== "anthropic") fail(`unsupported planning family: ${tuple.family}`);
  if (typeof tuple.model !== "string" || !tuple.model.trim()) fail("tuple.model required");
  if (!EFFORTS.has(tuple.effort)) fail("explicit supported Claude effort required (low|medium|high|xhigh|max)");
  return tuple;
}

/** The canonical isolated argv. Used by preflight, launch and retained-proof recomputation. */
export function buildClaudeExecArgs({ tuple, schema } = {}) {
  requireClaudeTuple(tuple);
  if (!schema || typeof schema !== "object") fail("schema required");
  return claude.args({ model: tuple.model, effort: tuple.effort, schema });
}

// Claude Code exposes no request-inspect channel, so the complete request cannot be captured.
// What is recorded is a conservative UPPER BOUND, never a measurement: the exact JSON-escaped
// prompt, the schema and model fields as sent, plus a generous allowance for the built-in
// (tool-free, settings-free) system prompt and protocol framing.
export const CLAUDE_SYSTEM_ALLOWANCE_BYTES = 256 * 1024;
export const CLAUDE_ESTIMATE_KIND = "conservative_upper_bound_with_system_allowance";
export function claudeRequestUpperBound({ prompt, schema, tuple }) {
  return Buffer.byteLength(JSON.stringify(prompt), "utf8")
    + Buffer.byteLength(JSON.stringify(schema), "utf8")
    + Buffer.byteLength(JSON.stringify({ model: tuple.model, effort: tuple.effort }), "utf8")
    + CLAUDE_SYSTEM_ALLOWANCE_BYTES;
}

export function claudeSchemaSha256(schema) {
  return sha256Utf8(`${JSON.stringify(schema)}\n`);
}

/** The bytes the model sees besides Claude Code's built-in system prompt: one stdin user message. */
export function claudeNativePromptBytes(prompt) {
  return Buffer.from(`${canonicalJson([{ role: "user", transport: CLAUDE_FROZEN_TRANSPORT, text: prompt }])}\n`, "utf8");
}

const hashCache = new Map();
function fileIdentity(file) {
  const real = fs.realpathSync(file);
  const st = fs.statSync(real);
  const key = `${real}:${st.size}:${st.mtimeMs}`;
  if (!hashCache.has(key)) hashCache.set(key, { path: real, sha256: sha256Bytes(fs.readFileSync(real)) });
  return hashCache.get(key);
}

export function findExecutable(name, pathEnv = process.env.PATH || "") {
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch { /* keep looking */ }
  }
  return null;
}

/**
 * Is the host's CLI present at all? A cheap pre-spend check so a missing transport fails
 * closed with an actionable message before any model call.
 */
export function transportAvailability(host, pathEnv = process.env.PATH || "") {
  if (!planningTransportOf(host)) return { ok: false, reason: `no planning transport for host ${host}` };
  const bin = findExecutable(host, pathEnv);
  return bin ? { ok: true, binary: bin } : { ok: false, reason: `${host} executable not found on PATH` };
}

const versionCache = new Map();
function cliVersion(bin, env) {
  if (!versionCache.has(bin)) {
    const r = spawnSync(bin, ["--version"], { env, encoding: "utf8", timeout: 30000 });
    if (r.error || r.status !== 0) fail("claude --version probe failed");
    versionCache.set(bin, String(r.stdout).trim());
  }
  return versionCache.get(bin);
}

const probeCache = new Map();
/**
 * Run the canary isolation probe once per binary per process. A failed or errored probe
 * blocks live use; the result is recorded in every proof that relied on it.
 */
export async function runIsolationProbe(binary, env, { probeModel = "haiku" } = {}) {
  const key = `${binary.sha256}:${probeModel}`;
  if (!probeCache.has(key)) {
    const result = await claude.probeIsolation({ model: probeModel, bin: binary.path, env });
    probeCache.set(key, {
      ok: result.ok === true,
      canary_seen: result.canary_seen === true,
      error: result.error || null,
      model: probeModel,
      binary_sha256: binary.sha256,
      authority: CLAUDE_INSPECTION_AUTHORITY,
      ran_at: new Date().toISOString(),
    });
  }
  return probeCache.get(key);
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Preflight one Claude planning call. Mirrors assertEffectiveIsolation's return shape
 * ({ cwd, execArgs, prompt, env, proof, cleanup }) so callers stay transport-agnostic.
 * Live mode runs the canary probe and is async-free here: the probe result is supplied by
 * the caller via `probe` 
 */
export function assertClaudeIsolation({
  role, tuple, prompt, schema, consumerRoot, mode = "inspect", offline = {}, probe = null,
} = {}) {
  const modeName = String(mode || "inspect").toLowerCase();
  if (!["inspect", "live", "offline"].includes(modeName)) fail(`unsupported mode ${mode}`);
  if (!role) fail("role required");
  if (typeof prompt !== "string") fail("prompt required");
  if (!consumerRoot) fail("consumerRoot required");
  requireClaudeTuple(tuple);
  const offlineMode = modeName === "offline";
  if (!offlineMode && Object.keys(offline || {}).length) fail("offline fixture injection forbidden in live/inspect");
  assertRequestBudget(Buffer.from(prompt, "utf8"), PLANNING_REQUEST_MAX_BYTES);
  const env = claudeEnv(process.env);
  let cwd = null;
  try {
    const consumer = fs.realpathSync(path.resolve(consumerRoot));
    const tmpRoot = fs.realpathSync(os.tmpdir());
    if (inside(tmpRoot, consumer)) fail("tmpdir is inside consumer instruction chain");
    cwd = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot, "ssve-claude-plan-")));
    if (inside(cwd, consumer)) fail("neutral cwd is inside consumer instruction chain");
    const frozen = freezeRequestBytes({ bytes: Buffer.from(prompt, "utf8"), dir: cwd });
    const execArgs = buildClaudeExecArgs({ tuple, schema });
    assertArgvFits(execArgs);
    let binary;
    let versionRaw;
    if (offlineMode) {
      const b = offline.binary ?? process.execPath;
      if (typeof b === "string") binary = fileIdentity(path.resolve(b));
      else if (b?.path && (b.sha256 || b.bytes)) binary = { path: b.path, sha256: b.sha256 || sha256Bytes(Buffer.from(b.bytes)) };
      else fail("offline binary requires path and sha256");
      versionRaw = String(offline.version ?? "OFFLINE");
    } else {
      const found = findExecutable("claude");
      if (!found) fail("claude executable not found on PATH");
      binary = fileIdentity(found);
      versionRaw = cliVersion(binary.path, env);
      if (!probe) probe = cachedProbe(binary);
      if (modeName === "live" && !(probe && probe.ok === true && probe.binary_sha256 === binary.sha256)) {
        fail(`claude isolation probe did not pass${probe?.canary_seen ? " (canary reached the model)" : ""}${probe?.error ? `: ${probe.error}` : ""}`);
      }
    }
    const nativePrompt = claudeNativePromptBytes(prompt);
    const stored = putObject(nativePrompt, { start: consumerRoot });
    const envelopeBytes = claudeRequestUpperBound({ prompt, schema, tuple });
    const usableLive = !offlineMode && modeName === "live";
    const proof = {
      transport: CLAUDE_TRANSPORT,
      role,
      prompt,
      cwd,
      mode: offlineMode ? "OFFLINE" : modeName,
      binary,
      version: { raw: versionRaw, sha256: sha256Utf8(versionRaw) },
      config_flags: execArgs,
      config_sha256: sha256Utf8(canonicalJson(execArgs)),
      exec_args: execArgs,
      exec_args_sha256: sha256Utf8(canonicalJson(execArgs)),
      isolation_controls: { tools: "", setting_sources: "", strict_mcp_config: true, no_session_persistence: true, prompt_channel: "stdin" },
      isolation_probe: offlineMode
        ? { ok: true, canary_seen: false, error: null, authority: "offline_fixture", binary_sha256: binary.sha256 }
        : probe,
      schema_sha256: claudeSchemaSha256(schema),
      prompt_sha256: sha256Utf8(prompt),
      frozen_request: {
        sha256: frozen.sha256,
        byteLength: frozen.byteLength,
        transport: offlineMode ? "offline_fixture" : CLAUDE_FROZEN_TRANSPORT,
      },
      inspection_authority: offlineMode ? "offline_fixture" : CLAUDE_INSPECTION_AUTHORITY,
      limits: {
        request_bytes: PLANNING_REQUEST_MAX_BYTES,
        output_bytes: Number(DEFAULT_LIMITS.maxOutputBytes ?? 524288),
        timeout_ms: Number(DEFAULT_LIMITS.timeoutMs ?? 600000),
      },
      token_budget: offlineMode
        ? { checked: false, fits: false, estimated_tokens: null }
        : {
          checked: true,
          fits: null,
          enforcement: "native_runner",
          estimate_kind: CLAUDE_ESTIMATE_KIND,
          system_allowance_bytes: CLAUDE_SYSTEM_ALLOWANCE_BYTES,
          estimated_tokens: null,
          envelope_bytes: envelopeBytes,
          captured_body_bytes: null,
        },
      disabled_skills: [],
      disabled_skills_sha256: sha256Utf8(canonicalJson([])),
      native_prompt: { type: "object", sha256: stored.sha256 },
      native_prompt_sha256: stored.sha256,
      // Same closed shape as the Codex prompt-inspection diagnosis (control-plan schema). Claude
      // exposes no inspect channel: isolation rests on the controls, the canary probe and the
      // exact stdin request, so the only user-visible frame is the prompt itself.
      diagnosis: {
        ok: true,
        unknown: false,
        reasons: [],
        native_wrappers: [],
        exact_prompt_count: 1,
        source_exposure: { in_declared_payload: SOURCE_RE.test(prompt) },
      },
      effective: {
        isolated: true,
        usable_live: usableLive,
        status: offlineMode ? "isolated_offline" : usableLive ? "isolated" : "isolated_not_live",
      },
    };
    const cleanup = () => { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* leftover dir is not authority */ } };
    return { cwd, execArgs, prompt, env, proof, cleanup };
  } catch (error) {
    if (cwd) { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* leftover dir is not authority */ } }
    throw error instanceof IsolationUnsupported ? error : new IsolationUnsupported(error.message);
  }
}

/**
 * Run (and cache) the canary probe for the claude binary on PATH. Call once, before any
 * live preflight; the synchronous preflight then reads the cached verdict.
 */
export async function primeClaudeProbe({ probeModel } = {}) {
  const found = findExecutable("claude");
  if (!found) fail("claude executable not found on PATH");
  return runIsolationProbe(fileIdentity(found), claudeEnv(process.env), probeModel ? { probeModel } : {});
}

function cachedProbe(binary) {
  for (const [key, value] of probeCache) if (key.startsWith(`${binary.sha256}:`)) return value;
  return null;
}

/**
 * Parse the Claude Code `--output-format json` result. Strict: a successful, tool-free,
 * single result carrying a structured_output object. Anything else is a failed content try.
 */
export function decodeClaudeResult(text) {
  const src = Buffer.isBuffer(text) ? new TextDecoder("utf-8", { fatal: true }).decode(text) : text;
  if (typeof src !== "string") throw new Error("claude result text required");
  let j;
  try { j = JSON.parse(src.trim()); } catch { throw new Error("claude result is not JSON"); }
  if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("claude result must be a JSON object");
  if (j.type !== undefined && j.type !== "result") throw new Error(`unexpected claude result type ${j.type}`);
  if (j.is_error === true) throw new Error(`claude result error: ${j.subtype || "error"}`);
  if (Array.isArray(j.permission_denials) && j.permission_denials.length) throw new Error("tool event: permission denial in tool-free transport");
  const value = j.structured_output;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("claude result has no structured_output object");
  const model = Object.keys(j.modelUsage || {})[0];
  return {
    value,
    usage: j.usage && typeof j.usage === "object" ? j.usage : null,
    observed: { model: typeof model === "string" && model ? model : "unknown", effort: "unknown" },
  };
}

/** Random fixture id helper for tests that need a claude result envelope. */
export function claudeResultFixture(output, { model = "offline-claude", usage = { input_tokens: 0, output_tokens: 0 } } = {}) {
  return JSON.stringify({
    type: "result", subtype: "success", is_error: false, session_id: `offline-${crypto.randomBytes(4).toString("hex")}`,
    structured_output: output, usage, modelUsage: { [model]: {} }, permission_denials: [],
  });
}

/**
 * Recompute what a retained Claude proof must satisfy. Returns error strings.
 * `proofPrompt` is the prompt rebuilt from the stored input; `schema` the role schema.
 */
export function collectClaudeProofErrors(proof, { launch, role, schema, proofPrompt, fixture, nativeBytes } = {}) {
  const errors = [];
  const fail2 = (msg) => errors.push(`${role}: ${msg}`);
  const req = launch?.requested;
  if (!req || req.host !== "claude" || req.family !== "anthropic") fail2("claude proof requires a claude/anthropic requested tuple");
  else {
    try { requireClaudeTuple(req); } catch (err) { fail2(err.message); }
  }
  if (proof.transport !== CLAUDE_TRANSPORT) fail2("proof.transport must be claude_isolated");
  if (launch?.invocation?.host !== "claude" || launch.invocation.transport !== CLAUDE_TRANSPORT) fail2("invocation host/transport differs from claude proof");
  let expectedArgs = null;
  try { expectedArgs = buildClaudeExecArgs({ tuple: req, schema }); } catch (err) { fail2(`controls ${err.message}`); }
  if (expectedArgs) {
    if (canonicalJson(expectedArgs) !== canonicalJson(proof.exec_args) || canonicalJson(launch?.invocation?.exec_args) !== canonicalJson(proof.exec_args)) {
      fail2("actual invocation/config/tuple disagreement");
    }
    if (canonicalJson(proof.config_flags) !== canonicalJson(proof.exec_args)) fail2("config_flags must equal the canonical isolated argv");
  }
  const args = Array.isArray(proof.exec_args) ? proof.exec_args : [];
  const at = (flag) => args.indexOf(flag);
  if (at("--tools") < 0 || args[at("--tools") + 1] !== "") fail2("isolation control missing: --tools \"\"");
  if (at("--setting-sources") < 0 || args[at("--setting-sources") + 1] !== "") fail2("isolation control missing: --setting-sources \"\"");
  for (const flag of ["--strict-mcp-config", "--no-session-persistence"]) if (at(flag) < 0) fail2(`isolation control missing: ${flag}`);
  if (proof.exec_args_sha256 !== sha256Utf8(canonicalJson(proof.exec_args))) fail2("exec_args_sha256 mismatch");
  if (proof.schema_sha256 !== claudeSchemaSha256(schema)) fail2("proof.schema_sha256 mismatch");
  if (proof.frozen_request?.sha256 !== proof.prompt_sha256) fail2("frozen_request sha256 must match prompt_sha256");
  if (proof.frozen_request?.transport !== (fixture ? "offline_fixture" : CLAUDE_FROZEN_TRANSPORT)) fail2("frozen_request.transport mismatch");
  if (proof.inspection_authority !== (fixture ? "offline_fixture" : CLAUDE_INSPECTION_AUTHORITY)) fail2("inspection_authority mismatch");
  if (!fixture) {
    const probe = proof.isolation_probe;
    if (!probe || probe.ok !== true || probe.canary_seen !== false || probe.authority !== CLAUDE_INSPECTION_AUTHORITY) fail2("live proof requires a passing canary isolation probe");
    else if (probe.binary_sha256 !== proof.binary?.sha256) fail2("isolation probe was not run on the launched binary");
    const tb = proof.token_budget || {};
    if (tb.estimate_kind !== CLAUDE_ESTIMATE_KIND || tb.system_allowance_bytes !== CLAUDE_SYSTEM_ALLOWANCE_BYTES || tb.captured_body_bytes !== null) {
      fail2("claude request size must be the declared conservative upper bound, not a claimed capture");
    } else if (req && tb.envelope_bytes !== claudeRequestUpperBound({ prompt: proofPrompt, schema, tuple: req })) {
      fail2("request upper bound differs from recomputation");
    }
  }
  if (nativeBytes && Buffer.compare(nativeBytes, claudeNativePromptBytes(proofPrompt)) !== 0) fail2("native prompt differs from the exact stdin request");
  if (proof.diagnosis?.ok !== true || proof.diagnosis?.unknown !== false || proof.diagnosis?.exact_prompt_count !== 1
    || (proof.diagnosis?.native_wrappers || []).length) fail2("claude diagnosis must record one exact prompt and no native wrappers");
  return errors;
}
