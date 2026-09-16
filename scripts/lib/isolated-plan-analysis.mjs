#!/usr/bin/env node
/**
 * Isolated Codex preflight (WI-FW-TWO-BOX-01). Open Box isolation is
 * invocation-scoped config + a neutral cwd, not --read-only, not
 * --ignore-rules, not HOME/CODEX_HOME edits, not continuation.
 *
 * Launcher (same generated -c config for exec and debug prompt-input):
 *   buildCodexConfigFlags({tuple, disabledSkills}) -> ['-c', 'k=v', ...]
 *     includes -c model=MODEL, -c model_reasoning_effort=EFFORT, project_doc_max_bytes=0,
 *     web_search="disabled", developer_instructions="", features.skip_host_skill_discovery=true,
 *     features.<name>=false for required-off features, and
 *     skills.config=[{path="/actual/SKILL.md",enabled=false}, ...]  (path array, never name keys)
 *   buildCodexExecArgs({tuple, outputSchemaPath, disabledSkills}) -> argv after the binary
 *     exec --ephemeral --sandbox read-only --ignore-user-config --skip-git-repo-check
 *     --json --output-schema PATH -m MODEL plus the same -c flags. Prompt is NOT in argv;
 *     launcher supplies the exact final prompt on stdin. Neutral cwd is spawn cwd (not -C).
 *   buildPromptInspectArgv({tuple, disabledSkills, prompt}) -> debug prompt-input argv
 *     ONLY those -c flags (including -c model=MODEL) plus positional EXACT final prompt
 *     when that prompt fits the platform single-argument limit. Oversized prompts freeze
 *     to a hashed file and use native-planning-request-capture (no paid inference).
 *     No exec flags, -m, --output-schema, --json, --ignore-user-config.
 *   discoverDisabledSkills({home, extraRoots, includeSystem, maxDepth, maxFiles})
 *     live: ~/.codex/skills and ~/.codex/plugins/cache (follow install symlinks, cycle-bounded,
 *     dedup path + content hash). extraRoots + system/skills only for OFFLINE tests.
 *   inheritEnv(env?) strips session/controller/delegation authority; keeps HOME/CODEX_HOME.
 *   diagnosePromptContamination(messages, {prompt, cwd}) structured parse (no JSON subtraction).
 *   assertEffectiveIsolation({role, tuple, prompt, schema, consumerRoot, mode='inspect', offline={}})
 *     -> {cwd, execArgs, prompt, env, proof, cleanup}
 *     inspect/live: real resolved binary/version/help/features; positional
 *     debug prompt-input when argv fits; otherwise native request capture qualified
 *     against a same-binary probe profile. Capture overlay is never live; live stdin
 *     of the frozen bytes is authorized only after native_prompt_input or
 *     qualified_native_request_inspect. No paid exec.
 *     Reject injected offline/customenv/binary/helpText/featuresText/discoveredSkills/inspectPrompt/fsImpl.
 *     OFFLINE fixtures allowed; proof.effective.usable_live=false. cleanup removes the temp dir.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  IsolationUnsupported,
  sha256Bytes,
  sha256Utf8,
  canonicalJson,
  DEFAULT_LIMITS,
  SHA_RE,
} from "./two-box-protocol.mjs";
import { putObject } from "./review-evidence-store.mjs";
import {
  freezeRequestBytes, assertArgvFits, assertRequestBudget, assertTokenContextOutputReserve,
  resolvePlanningTokenBudget, conservativeTokenUpperBound, PLANNING_REQUEST_MAX_BYTES, PLATFORM_SINGLE_ARG_MAX,
} from "./frozen-request-input.mjs";
import {
  NATIVE_PROFILE_PROBE, nativeProfileFromStable, framesFromInspectMessages,
  completeRequestBytes, nativeProfileBody, NATIVE_PROFILE_FIELD_KEYS,
} from "./native-planning-request-capture.mjs";

const FEATURES_OFF = Object.freeze([
  "shell_tool", "unified_exec", "multi_agent", "multi_agent_v2", "plugins", "apps",
  "view_image", "browser_use", "computer_use", "memories", "remote_plugin",
  "workspace_dependencies", "skill_search", "image_generation", "hooks",
  "code_mode", "code_mode_host", "tool_suggest",
]);
const FEATURE_SKIP_HOST = "skip_host_skill_discovery";
const EXEC_HELP_NEED = [
  "--ephemeral", "--sandbox", "--ignore-user-config", "--skip-git-repo-check",
  "--json", "--output-schema", "--config", "--model",
];
const DEBUG_HELP_NEED = ["prompt-input", "--config"];
const INSPECT_BAN = [
  "--ephemeral", "--sandbox", "-m", "--model", "--output-schema", "--json",
  "--ignore-user-config", "--ignore-rules", "--read-only", "--skip-git-repo-check",
];
const INJECT_KEYS = [
  "binary", "helpText", "featuresText", "discoveredSkills", "inspectPrompt", "fsImpl", "customenv",
];
const TIMEOUT_MS = Number(DEFAULT_LIMITS?.timeoutMs ?? DEFAULT_LIMITS?.timeout_ms ?? 600000);
const MAX_BYTES = Number(DEFAULT_LIMITS?.maxOutputBytes ?? DEFAULT_LIMITS?.max_output_bytes ?? 524288);
const INJECT_RE = /AGENTS\.md|CLAUDE\.md|\bSKILL\.md\b|includedSkills|route-workflow|plan-changeset|Serious Serious Vibe Engineering|\bDOCTRINE\.md\b|FRAMEWORK-STATE|skills-manifest|<project_instructions>|<user_instructions>|<additional_instructions>|<repo_instructions>/i;
const SSVE_CATALOG_RE = /includedSkills|route-workflow|plan-changeset|Serious Serious Vibe Engineering|\bDOCTRINE\.md\b|FRAMEWORK-STATE|skills-manifest/i;
const SOURCE_RE = /skills\/|AGENTS\.md|\bSSVE\b|DOCTRINE|SKILL\.md/;
const AUTH_DROP = /(?:^|_)(SESSION|CONTROLLER|DELEGATION|LEASE)(_|$)/;
const NATIVE_TEAM_COLLABORATION_TEMPLATE = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "native-codex-team-collaboration.wrapper.txt"),
  "utf8",
);

function fail(msg) {
  throw new IsolationUnsupported(msg);
}

function tomlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
}

function skillsConfigValue(disabledSkills) {
  const seen = new Set();
  const items = [];
  for (const entry of disabledSkills || []) {
    const p = typeof entry === "string" ? entry : entry?.path;
    if (!p || seen.has(p)) continue;
    seen.add(p);
    items.push(`{path=${tomlString(p)},enabled=false}`);
  }
  return `[${items.join(",")}]`;
}

function requireTuple(tuple) {
  if (!tuple || typeof tuple !== "object") fail("tuple required");
  const harness = tuple.host ?? tuple.harness;
  if (harness !== "codex") fail(`unsupported planning transport: ${harness}`);
  if (typeof tuple.model !== "string" || !tuple.model.trim()) fail("tuple.model required");
  if (!["low", "medium", "high", "xhigh", "max"].includes(tuple.effort)) fail("explicit supported Codex effort required");
  return tuple;
}

function effortOf(tuple) {
  const effort = tuple.effort ?? tuple.model_reasoning_effort;
  return effort == null || effort === "" ? null : String(effort);
}

export function buildCodexConfigFlags({ tuple, disabledSkills } = {}) {
  const t = requireTuple(tuple);
  const flags = [];
  const add = (k, v) => { flags.push("-c", `${k}=${v}`); };
  add("model", tomlString(t.model));
  const effort = effortOf(t);
  if (effort) add("model_reasoning_effort", tomlString(effort));
  add("project_doc_max_bytes", "0");
  add("web_search", tomlString("disabled"));
  add("developer_instructions", '""');
  add(`features.${FEATURE_SKIP_HOST}`, "true");
  for (const name of FEATURES_OFF) add(`features.${name}`, "false");
  add("skills.config", skillsConfigValue(disabledSkills));
  return flags;
}

function refuseIsolationFlags(args) {
  if (args.includes("--read-only") || args.includes("--ignore-rules")) {
    fail("refusing --read-only and --ignore-rules as isolation");
  }
  return args;
}

export function buildCodexExecArgs({ tuple, outputSchemaPath, disabledSkills } = {}) {
  requireTuple(tuple);
  if (!outputSchemaPath) fail("outputSchemaPath required");
  return refuseIsolationFlags([
    "exec",
    "--ephemeral",
    "--sandbox", "read-only",
    "--ignore-user-config",
    "--skip-git-repo-check",
    "--json",
    "--output-schema", String(outputSchemaPath),
    "-m", String(tuple.model),
    ...buildCodexConfigFlags({ tuple, disabledSkills }),
  ]);
}

export function buildPromptInspectArgv({ tuple, disabledSkills, prompt, includePrompt = true } = {}) {
  requireTuple(tuple);
  if (includePrompt && typeof prompt !== "string") fail("prompt required");
  const argv = ["debug", "prompt-input", ...buildCodexConfigFlags({ tuple, disabledSkills })];
  if (includePrompt) argv.push(prompt);
  if (INSPECT_BAN.some((f) => argv.includes(f))) fail("debug prompt-input must not carry exec flags");
  return refuseIsolationFlags(argv);
}

export function inheritEnv(source = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (value == null) continue;
    const u = key.toUpperCase();
    if (u === "HOME" || u === "CODEX_HOME") {
      env[key] = String(value);
      continue;
    }
    if (/^SVC_/.test(u) || /^(?:CODEX|CLAUDE|CURSOR|GROK|KIMI|GEMINI)_(?:THREAD|CONVERSATION|SESSION|AGENT|PARENT|CONTROLLER|DELEGATION|LEASE)(?:_|$)/.test(u)) continue;
    env[key] = String(value);
  }
  return env;
}

function safeReal(p) {
  try { return fs.realpathSync(p); } catch { return null; }
}

function walkSkills(root, acc, seenPath, seenReal, seenHash, depth, chain, maxDepth, maxFiles) {
  if (depth > maxDepth) fail("skill discovery depth bound exceeded");
  if (acc.length >= maxFiles) fail("skill discovery bound exceeded");
  let lst;
  try { lst = fs.lstatSync(root); } catch { return; }
  const real = safeReal(root);
  if (real && chain.includes(real)) return;
  const nextChain = real ? chain.concat(real) : chain;
  const follow = lst.isSymbolicLink() ? (() => { try { return fs.statSync(root); } catch { return null; } })() : lst;
  if (!follow) return;
  if (follow.isDirectory()) {
    let names;
    try { names = fs.readdirSync(root); } catch { return; }
    for (const name of names.sort()) {
      if (name === ".git" || name === "node_modules") continue;
      walkSkills(path.join(root, name), acc, seenPath, seenReal, seenHash, depth + 1, nextChain, maxDepth, maxFiles);
    }
    return;
  }
  if (!follow.isFile() || path.basename(root) !== "SKILL.md") return;
  if (seenPath.has(root)) return;
  let bytes;
  try { bytes = fs.readFileSync(root); } catch { return; }
  const digest = sha256Bytes(bytes);
  seenPath.add(root);
  acc.push({ path: root, sha256: digest });
}

export function discoverDisabledSkills({
  home = os.homedir(),
  extraRoots = [],
  includeSystem = false,
  maxDepth = 24,
  maxFiles = 4096,
} = {}) {
  const roots = [
    path.join(home, ".codex", "skills"),
    path.join(home, ".codex", "plugins", "cache"),
  ];
  if (includeSystem) {
    roots.push("/usr/share/codex/system/skills", "/usr/lib/codex/system/skills", "/usr/share/codex/skills");
  }
  for (const extra of extraRoots) roots.push(path.resolve(extra));
  const acc = [];
  const seenPath = new Set();
  const seenReal = new Set();
  const seenHash = new Set();
  for (const root of roots) walkSkills(root, acc, seenPath, seenReal, seenHash, 0, [], maxDepth, maxFiles);
  acc.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return acc;
}

function itemText(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  if (typeof item.text === "string") return item.text;
  if (typeof item.prefix === "string") return item.prefix;
  return "";
}

function nativeTeamAgent(text) {
  const prefix = "You are `";
  if (!text.startsWith(prefix)) return null;
  const end = text.indexOf("`", prefix.length);
  if (end < 0) return null;
  const agent = text.slice(prefix.length, end);
  if (!/^[A-Za-z0-9._/-]{1,64}$/.test(agent) || agent.includes("..")) return null;
  return agent;
}

export function isNativeTeamCollaborationWrapper(text) {
  const agent = nativeTeamAgent(text);
  if (!agent) return false;
  return text === NATIVE_TEAM_COLLABORATION_TEMPLATE.replaceAll("{{AGENT}}", agent);
}

export function isNativeCodexIdentity(text, profile) {
  if (typeof text !== "string" || !text) return false;
  const digest = sha256Utf8(text);
  const rows = [...(profile?.developer || []), ...(profile?.frames || [])];
  return rows.some((row) => row.sha256 === digest && (row.kind === "codex_identity" || row.kind === "native_developer"));
}

export function wrapperKind(text, profile) {
  if (profile) {
    const digest = sha256Utf8(text);
    const row = [...(profile.developer || []), ...(profile.frames || [])].find((r) => r.sha256 === digest);
    if (row?.kind) return row.kind;
  }
  if (text.startsWith("<permissions instructions>") || text.startsWith("<permissions>")) return "permissions";
  if (text.startsWith("<collaboration_mode>")) return "collaboration";
  if (text.startsWith("<multi_agent_role>") || text.startsWith("<multi_agent_mode>")) return "multi_agent";
  if (isNativeTeamCollaborationWrapper(text)) return "team_collaboration";
  return null;
}

function envContextOk(text, cwd) {
  return text.startsWith("<environment_context>")
    && text.trimEnd().endsWith("</environment_context>")
    && text.includes(`<cwd>${cwd}</cwd>`)
    && !INJECT_RE.test(text);
}

function profileRows(profile) {
  if (!profile || typeof profile !== "object") return [];
  if (Array.isArray(profile.frames) && profile.frames.length) return profile.frames;
  return profile.developer || [];
}

export function diagnosePromptContamination(messages, {
  prompt, cwd, profile, requireEnv = true, allowNativeDeveloper = false,
} = {}) {
  const reasons = [];
  let unknown = false;
  const native_wrappers = [];
  const extraHashes = [];
  let exact_prompt_count = 0;
  let env_count = 0;
  let arr = messages;
  if (typeof messages === "string") {
    try { arr = JSON.parse(messages); } catch { return { ok: false, unknown: true, reasons: ["unparseable inspect JSON"], native_wrappers, exact_prompt_count: 0, source_exposure: { in_declared_payload: false } }; }
  }
  if (!Array.isArray(arr)) {
    return { ok: false, unknown: true, reasons: ["inspect output is not a JSON array"], native_wrappers, exact_prompt_count: 0, source_exposure: { in_declared_payload: false } };
  }
  if (typeof prompt !== "string") {
    unknown = true;
    reasons.push("declared prompt missing");
  }
  const rows = profileRows(profile);
  const acceptNative = Boolean(profile) || allowNativeDeveloper;
  for (const msg of arr) {
    if (!msg || typeof msg !== "object") { unknown = true; reasons.push("non-object message"); continue; }
    if (msg.type === "additional_tools") {
      if (!Array.isArray(msg.tools)) { unknown = true; reasons.push("additional_tools.tools must be an array"); continue; }
      const raw = canonicalJson(msg.tools);
      if (SSVE_CATALOG_RE.test(raw)) reasons.push("injected catalog/methodology in tool advertisement");
      continue;
    }
    if (msg.type && msg.type !== "message") { unknown = true; reasons.push(`unknown message type ${msg.type}`); continue; }
    const items = Array.isArray(msg.content) ? msg.content : (typeof msg.content === "string" ? [msg.content] : null);
    if (!items) { unknown = true; reasons.push("message content is not input_text list"); continue; }
    if (msg.role === "developer") {
      for (const item of items) {
        if (item && typeof item === "object" && item.type && item.type !== "input_text") {
          unknown = true;
          reasons.push("developer non-input_text");
          continue;
        }
        const text = itemText(item);
        const digest = sha256Utf8(text);
        let kind = wrapperKind(text);
        const nativeText = text.replaceAll("applicable AGENTS.md/skill instructions", "applicable native instructions").replaceAll("applicable `AGENTS.md` instructions", "applicable native instructions");
        if (profile) {
          const row = rows.find((r) => r.sha256 === digest);
          if (!row) { unknown = true; reasons.push("developer wrapper not in native profile"); continue; }
          kind = row.kind || kind || "native_developer";
        } else if (!kind) {
          if (!allowNativeDeveloper) { unknown = true; reasons.push("unknown developer wrapper"); continue; }
          kind = "native_developer";
        }
        if (kind === "codex_identity" || kind === "native_developer") {
          if (SSVE_CATALOG_RE.test(text)) reasons.push(`injected catalog/methodology in ${kind} wrapper`);
        } else if (INJECT_RE.test(nativeText)) {
          reasons.push(`injected catalog/methodology in ${kind} wrapper`);
        }
        if (kind === "permissions" || kind === "collaboration" || kind === "multi_agent" || kind === "team_collaboration") {
          native_wrappers.push({ type: kind, sha256: digest });
        }
        extraHashes.push(digest);
      }
      continue;
    }
    if (msg.role === "user") {
      if (items.length !== 1) { reasons.push("user message must be a single input_text"); continue; }
      const item = items[0];
      if (item && typeof item === "object" && item.type && item.type !== "input_text") {
        unknown = true;
        reasons.push("user non-input_text");
        continue;
      }
      const text = itemText(item);
      if (text === prompt) { exact_prompt_count += 1; continue; }
      const digest = sha256Utf8(text);
      if (envContextOk(text, cwd)) {
        env_count += 1;
        extraHashes.push(digest);
        if (profile && !rows.some((r) => r.sha256 === digest)) {
          unknown = true;
          reasons.push("environment_context not in native profile");
        }
        continue;
      }
      if (acceptNative) {
        if (profile && !rows.some((r) => r.sha256 === digest)) {
          reasons.push("unexpected user message outside native profile");
          continue;
        }
        if (SSVE_CATALOG_RE.test(text)) {
          reasons.push("injected catalog/methodology in native user frame");
          continue;
        }
        extraHashes.push(digest);
        continue;
      }
      if (text.startsWith("<environment_context>")) reasons.push("environment_context cwd/instructions mismatch");
      else reasons.push("unexpected user message outside declared payload");
      continue;
    }
    unknown = true;
    reasons.push(`unknown role ${msg.role}`);
  }
  if (exact_prompt_count !== 1) reasons.push(`exact prompt must appear once as full input_text (got ${exact_prompt_count})`);
  if (requireEnv && env_count !== 1) reasons.push(`expected one native environment_context (got ${env_count})`);
  if (profile) {
    try {
      const derived = framesFromInspectMessages(arr, prompt);
      const want = (profile.frames || []).map((row) => {
        const frame = { type: row.type || "message", role: row.role, sha256: row.sha256 };
        if (frame.type === "additional_tools") return { type: "additional_tools", role: frame.role ?? null, sha256: frame.sha256 };
        return { type: "message", role: frame.role, sha256: frame.sha256 };
      });
      if (canonicalJson(derived) !== canonicalJson(want)) reasons.push("native frames differ from verified profile");
    } catch (error) {
      unknown = true;
      reasons.push(error.message);
    }
  }
  const source_exposure = { in_declared_payload: typeof prompt === "string" && SOURCE_RE.test(prompt) };
  return { ok: reasons.length === 0 && !unknown, unknown, reasons, native_wrappers, exact_prompt_count, source_exposure };
}

export const LIVE_INSPECTION_AUTHORITIES = Object.freeze(["native_prompt_input", "qualified_native_request_inspect"]);

/** Identity of executable isolation-proof requirements. Changing this invalidates cached stage keys. */
export const ISOLATION_PROOF_CONTRACT = Object.freeze({
  required_fields: Object.freeze(["frozen_request", "inspection_authority", "prompt_sha256", "token_budget"]),
  frozen_request_fields: Object.freeze(["sha256", "byteLength", "transport"]),
  live_authorities: LIVE_INSPECTION_AUTHORITIES,
  fixture_authority: "offline_fixture",
  diagnostic_cannot_authorize_live: true,
  token_budget_separate_from_bytes: true,
});

export function isolationProofContractDigest() {
  return sha256Utf8(canonicalJson(ISOLATION_PROOF_CONTRACT));
}

function advertisementHashes(ads) {
  if (ads == null) return [];
  if (!Array.isArray(ads)) fail("native_tool_advertisements must be an array");
  return ads.map((t) => (typeof t === "string" ? t : t?.sha256)).filter(Boolean);
}

export function assertNativeProfileReplay(proof, { requested, schema, inspectMessages } = {}) {
  const profile = proof.native_profile;
  if (!profile || typeof profile !== "object") fail("native profile required");
  const digest = nativeProfileDigestFromCapture(profile);
  if (profile.sha256 !== digest) fail("native_profile.sha256 does not match canonical profile");
  if (!SHA_RE.test(String(profile.binary_sha256 || ""))) fail("native_profile.binary_sha256 required");
  if (!proof.binary || profile.binary_sha256 !== proof.binary.sha256) {
    fail("native_profile.binary_sha256 must match proof.binary.sha256");
  }
  const allowed = new Set(["sha256", ...NATIVE_PROFILE_FIELD_KEYS]);
  for (const key of Object.keys(profile)) {
    if (!allowed.has(key)) fail(`undeclared native profile field ${key}`);
  }
  if (requested) {
    if (profile.model !== requested.model) fail(`native profile model ${profile.model} !== requested ${requested.model}`);
    if (profile.effort !== requested.effort) fail(`native profile effort ${profile.effort} !== requested ${requested.effort}`);
  }
  if (schema) {
    if (profile.schema == null) fail("native profile schema required");
    if (canonicalJson(profile.schema) !== canonicalJson(schema)) fail("native profile schema differs from requested role schema");
  }
  if (Array.isArray(inspectMessages)) {
    if (typeof proof.prompt !== "string") fail("proof.prompt required to re-derive native frames");
    const derived = framesFromInspectMessages(inspectMessages, proof.prompt);
    if (canonicalJson(derived) !== canonicalJson(nativeProfileBody(profile).frames)) {
      fail("native frames differ from retained inspect evidence");
    }
    const canonical = completeRequestBytes({
      items: inspectMessages,
      schema: profile.schema,
      semantic: nativeProfileBody(profile),
    });
    const captured = Number.isInteger(proof.token_budget?.captured_body_bytes) ? proof.token_budget.captured_body_bytes : null;
    if (captured != null) {
      if (proof.token_budget.envelope_bytes !== captured) fail("token_budget.envelope_bytes must equal captured Responses body bytes");
      if (captured < canonical) fail("captured Responses body is smaller than the canonical inspect envelope");
    } else if (proof.token_budget.envelope_bytes !== canonical) {
      fail("token_budget.envelope_bytes does not match the complete captured request");
    }
  }
  const ads = advertisementHashes(proof.native_tool_advertisements);
  const tools = [...(nativeProfileBody(profile).tools || [])];
  if (proof.native_tool_advertisements != null && canonicalJson(ads) !== canonicalJson(tools)) {
    fail("native tool advertisements differ from native profile tools");
  }
  return profile;
}

function nativeProfileDigestFromCapture(profile) {
  return nativeProfileFromStable(profile, { binarySha256: profile.binary_sha256 }).sha256;
}

export function assertIsolationAuthority(proof, { fixture = false, requested, schema, inspectMessages } = {}) {
  if (!proof || typeof proof !== "object") fail("isolation proof required");
  const frozen = proof.frozen_request;
  if (!frozen || typeof frozen !== "object") fail("frozen_request required");
  if (!SHA_RE.test(String(frozen.sha256 || "")) || !Number.isInteger(frozen.byteLength) || frozen.byteLength < 1) {
    fail("frozen_request sha256 and byteLength required");
  }
  if (frozen.sha256 !== proof.prompt_sha256) fail("frozen_request sha256 must match prompt_sha256");
  if (typeof frozen.transport !== "string" || !frozen.transport) fail("frozen_request.transport required");
  if (typeof proof.prompt === "string" && frozen.byteLength !== Buffer.byteLength(proof.prompt)) {
    fail("frozen_request.byteLength must match prompt bytes");
  }
  const auth = proof.inspection_authority;
  const usable = proof.effective?.usable_live;
  if (auth === "diagnostic_capture_not_live") {
    if (usable !== false) fail("diagnostic capture cannot be usable_live");
    fail("diagnostic capture cannot authorize live planning");
  }
  if (fixture) {
    if (proof.mode !== "OFFLINE") fail("fixture proof mode must be OFFLINE");
    if (auth !== "offline_fixture") fail("fixture inspection_authority must be offline_fixture");
    if (frozen.transport !== "offline_fixture") fail("fixture frozen_request.transport must be offline_fixture");
    if (usable !== false) fail("fixture cannot be usable_live");
    if (!proof.token_budget || typeof proof.token_budget !== "object") fail("token_budget required");
    if (proof.token_budget.checked !== false) fail("fixture token_budget.checked must be false");
    if (proof.token_budget.fits !== false) fail("fixture token_budget.fits must be false");
    return proof;
  }
  if (!LIVE_INSPECTION_AUTHORITIES.includes(auth)) fail(`inspection_authority ${auth} cannot authorize live`);
  if (usable === true && proof.token_budget?.fits === false) fail("usable_live requires token budget to fit");
  if (usable !== true && proof.token_budget?.fits !== false) fail("live inspection_authority requires usable_live");
  if (auth === "qualified_native_request_inspect") {
    if (proof.capture_inference !== false) fail("qualified capture must refuse inference");
    if (frozen.transport !== "native_request_capture") fail("qualified capture frozen_request.transport mismatch");
  }
  if (auth === "native_prompt_input" && frozen.transport !== "positional_prompt_input") {
    fail("native_prompt_input transport mismatch");
  }
  assertNativeProfileReplay(proof, { requested, schema, inspectMessages });
  if (usable === true && !Array.isArray(inspectMessages)) {
    fail("usable_live requires inspect evidence to authenticate envelope bytes");
  }
  if (proof.token_budget?.checked !== true) fail("live inspection requires checked token/context/output reserve");
  if (proof.token_budget.fits !== false) {
    assertTokenContextOutputReserve({
      requestBytes: Number.isInteger(proof.token_budget.envelope_bytes) && proof.token_budget.envelope_bytes > 0
        ? proof.token_budget.envelope_bytes
        : frozen.byteLength + (Number.isInteger(proof.token_budget.envelope_bytes) ? proof.token_budget.envelope_bytes : 0),
      maxInputTokens: proof.token_budget.maxInputTokens ?? null,
      contextWindow: proof.token_budget.contextWindow ?? null,
      outputReserveTokens: proof.token_budget.outputReserveTokens ?? null,
      requireChecked: true,
    });
  }
  return proof;
}

function isOfflineMode(mode) {
  return String(mode || "").toUpperCase() === "OFFLINE";
}

function assertNoInject(offline, mode) {
  if (isOfflineMode(mode)) return;
  const src = offline || {};
  for (const key of INJECT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) fail(`injected ${key} is forbidden in ${mode}`);
  }
}

function requireHelp(text, tokens, label) {
  for (const token of tokens) {
    if (!String(text).includes(token)) fail(`missing ${label} control ${token}`);
  }
}

function requireFeatures(text) {
  const names = new Set();
  for (const line of String(text).split("\n")) {
    const m = line.trim().match(/^(\S+)\s+(.+?)\s+(true|false)\s*$/);
    if (m) names.add(m[1]);
  }
  for (const name of [...FEATURES_OFF, FEATURE_SKIP_HOST]) {
    if (!names.has(name)) fail(`missing feature ${name}`);
  }
}

function resolveCodexExecutable() {
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "codex");
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      const real = fs.realpathSync(candidate);
      if (!fs.statSync(real).isFile()) continue;
      return real;
    } catch { /* try next PATH entry */ }
  }
  fail("codex executable not found on PATH");
}

function runCodex(bin, argv, { cwd, env, timeout = 30000, maxBuffer = MAX_BYTES } = {}) {
  const r = spawnSync(bin, argv, { cwd, env, timeout, maxBuffer, encoding: "utf8" });
  if (r.error) fail(`codex ${argv.slice(0, 2).join(" ")} probe failed`);
  if (r.status !== 0) fail(`codex ${argv.slice(0, 2).join(" ")} exited ${r.status}`);
  return r.stdout ?? "";
}

function runNativeCaptureHelper({ binary, cwd, env, execArgs, frozenPath, frozenSha256, tuple, schema, binarySha256 }) {
  const helper = fileURLToPath(new URL("./native-planning-request-capture.mjs", import.meta.url));
  const packet = {
    mode: "qualify",
    binary,
    cwd,
    env,
    execArgs,
    frozenPath,
    expectedSha256: frozenSha256,
    timeoutMs: TIMEOUT_MS,
    model: tuple.model,
    effort: tuple.effort,
    schema,
    binarySha256,
  };
  const r = spawnSync(process.execPath, [helper], {
    cwd,
    env,
    input: `${JSON.stringify(packet)}\n`,
    encoding: "utf8",
    timeout: (TIMEOUT_MS * 2) + 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error) fail(`native capture helper failed: ${r.error.message}`);
  if (r.status !== 0) fail(`native capture helper: ${(r.stderr || "").trim() || `exit ${r.status}`}`);
  let parsed;
  try { parsed = JSON.parse((r.stdout || "").trim()); }
  catch { fail("native capture helper did not return JSON"); }
  if (!parsed?.inspect_json || parsed.inference !== false) fail("native capture helper must refuse inference and return inspect JSON");
  if (parsed.inspection_authority !== "qualified_native_request_inspect" || !parsed.native_profile?.sha256) {
    fail("native capture helper must return a qualified native profile");
  }
  return parsed;
}

function schemaToBytes(schema) {
  if (Buffer.isBuffer(schema)) return schema;
  if (typeof schema === "string") return Buffer.from(schema);
  if (schema && typeof schema === "object") return Buffer.from(`${JSON.stringify(schema)}\n`);
  fail("role schema required");
}

function inside(child, parent) {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  return c === p || c.startsWith(p + path.sep);
}

function skillsDigest(list) {
  return sha256Utf8(canonicalJson(list.map((s) => ({ path: s.path, sha256: s.sha256 }))));
}

function mergeOfflineEnv(base, customenv) {
  const env = inheritEnv(base);
  const home = env.HOME;
  const codexHome = env.CODEX_HOME;
  if (customenv && typeof customenv === "object") {
    const extra = inheritEnv(customenv);
    for (const [k, v] of Object.entries(extra)) {
      if (k === "HOME" || k === "CODEX_HOME") continue;
      env[k] = v;
    }
  }
  if (home != null) env.HOME = home; else delete env.HOME;
  if (codexHome != null) env.CODEX_HOME = codexHome; else delete env.CODEX_HOME;
  return env;
}

export function assertEffectiveIsolation({
  role, tuple, prompt, schema, consumerRoot, mode = "inspect", offline = {},
} = {}) {
  const supplied = arguments[0] || {};
  const known = new Set(["role", "tuple", "prompt", "schema", "consumerRoot", "mode", "offline"]);
  for (const key of Object.keys(supplied)) if (!known.has(key)) fail(`unsupported or injected preflight option: ${key}`);
  const modeName = String(mode || "inspect").toLowerCase();
  if (modeName !== "offline" && Object.keys(offline || {}).length) fail("offline fixture injection forbidden in live/inspect");
  if (modeName !== "inspect" && modeName !== "live" && modeName !== "offline") fail(`unsupported mode ${mode}`);
  assertNoInject(offline || {}, modeName);
  if (!role) fail("role required");
  if (typeof prompt !== "string") fail("prompt required");
  if (!consumerRoot) fail("consumerRoot required");
  requireTuple(tuple);
  assertRequestBudget(Buffer.from(prompt, "utf8"), PLANNING_REQUEST_MAX_BYTES);
  const offlineMode = isOfflineMode(modeName);
  const env = mergeOfflineEnv(process.env, offlineMode ? offline.customenv : undefined);
  let cwd = null;
  try {
    const consumer = fs.realpathSync(path.resolve(consumerRoot));
    const tmpRoot = fs.realpathSync(os.tmpdir());
    if (inside(tmpRoot, consumer)) fail("tmpdir is inside consumer instruction chain");
    cwd = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot, "ssve-openbox-preflight-")));
    if (inside(cwd, consumer)) fail("neutral cwd is inside consumer instruction chain");
    const frozen = freezeRequestBytes({ bytes: Buffer.from(prompt, "utf8"), dir: cwd });
    let tokenBudget = null;
    let tokenCheck = { estimated_tokens: null, checked: false, fits: false };
    const evaluateBudget = (requestBytes, mustFit) => {
      try {
        const checked = assertTokenContextOutputReserve({
          requestBytes,
          maxInputTokens: tokenBudget.maxInputTokens,
          contextWindow: tokenBudget.contextWindow,
          outputReserveTokens: tokenBudget.outputReserveTokens,
          requireChecked: true,
        });
        return { ...checked, fits: true };
      } catch (error) {
        if (mustFit) throw error;
        return {
          estimated_tokens: conservativeTokenUpperBound(requestBytes),
          checked: true,
          fits: false,
          reason: error.message,
        };
      }
    };
    if (!offlineMode) {
      tokenBudget = resolvePlanningTokenBudget(tuple);
      tokenCheck = evaluateBudget(frozen.byteLength, modeName === "live");
    } else {
      tokenCheck = { ...assertTokenContextOutputReserve({ requestBytes: frozen.byteLength }), fits: false };
    }
    const schemaPath = path.join(cwd, "output-schema.json");
    fs.writeFileSync(schemaPath, schemaToBytes(schema), { mode: 0o600 });
    const schemaBytes = fs.readFileSync(schemaPath);
    const schema_sha256 = sha256Bytes(schemaBytes);
    const skills = offlineMode && Object.prototype.hasOwnProperty.call(offline, "discoveredSkills")
      ? (offline.discoveredSkills || []).map((s) => (typeof s === "string" ? { path: s, sha256: sha256Utf8(s) } : s))
      : discoverDisabledSkills({
        home: os.homedir(),
        extraRoots: offlineMode ? (offline.extraRoots || []) : [],
        includeSystem: Boolean(offlineMode && offline.includeSystem),
      });
    const configFlags = buildCodexConfigFlags({ tuple, disabledSkills: skills });
    const execArgs = buildCodexExecArgs({ tuple, outputSchemaPath: schemaPath, disabledSkills: skills });
    try {
      assertArgvFits(configFlags);
      assertArgvFits(execArgs);
    } catch (error) {
      if (error instanceof IsolationUnsupported && /argv element exceeds platform single-argument limit/.test(error.message)) {
        fail("host config/schema argv exceeds platform single-argument limit; cannot inspect or capture");
      }
      throw error;
    }
    const inspectArgv = buildPromptInspectArgv({ tuple, disabledSkills: skills, prompt });
    let binary;
    let versionRaw;
    let execHelp;
    let debugHelp;
    let featuresText;
    let inspectRaw;
    let inspectTransport = offlineMode ? "offline_fixture" : "positional_prompt_input";
    let captureProof = null;
    let resolved = null;
    if (offlineMode) {
      if (!offline.helpText || !offline.featuresText || !offline.inspectPrompt || !offline.binary) {
        fail("OFFLINE fixtures require binary, helpText, featuresText, inspectPrompt");
      }
      const b = offline.binary;
      if (typeof b === "string") {
        const p = fs.realpathSync(path.resolve(b));
        binary = { path: p, sha256: sha256Bytes(fs.readFileSync(p)) };
      } else {
        const bytes = b.bytes != null ? Buffer.from(b.bytes) : null;
        const sha = b.sha256 || (bytes ? sha256Bytes(bytes) : "");
        if (!b.path || !sha) fail("offline binary requires path and sha256");
        binary = { path: b.path, sha256: sha };
      }
      const help = offline.helpText;
      execHelp = typeof help === "object" ? String(help.exec ?? "") : "";
      debugHelp = typeof help === "object" ? String(help.debug ?? "") : "";
      if (!execHelp || !debugHelp) fail("offline helpText must include exec and debug strings");
      featuresText = String(offline.featuresText);
      versionRaw = String(offline.version ?? "OFFLINE");
      const inspectedFixture = typeof offline.inspectPrompt === "function" ? offline.inspectPrompt({cwd, prompt, schema:role, configFlags}) : offline.inspectPrompt;
      inspectRaw = Buffer.isBuffer(inspectedFixture)
        ? inspectedFixture
        : Buffer.from(typeof inspectedFixture === "string" ? inspectedFixture : JSON.stringify(inspectedFixture));
    } else {
      resolved = resolveCodexExecutable();
      binary = { path: resolved, sha256: sha256Bytes(fs.readFileSync(resolved)) };
      versionRaw = runCodex(resolved, ["--version"], { env, timeout: 30000 }).trim();
      execHelp = runCodex(resolved, ["exec", "--help"], { env, timeout: 30000 });
      debugHelp = runCodex(resolved, ["debug", "prompt-input", "--help"], { env, timeout: 30000 });
      featuresText = runCodex(resolved, ["features", "list"], { env, timeout: 30000 });
      if (/--prompt-file\b/.test(debugHelp) || (/\bstdin\b/i.test(debugHelp) && /If not provided as an argument/.test(debugHelp))) {
        fail("installed debug prompt-input now advertises file/stdin; wire that native path instead of capture");
      }
      try {
        assertArgvFits(inspectArgv);
        inspectRaw = Buffer.from(runCodex(resolved, inspectArgv, { cwd, env, timeout: TIMEOUT_MS, maxBuffer: MAX_BYTES }));
      } catch (error) {
        if (!(error instanceof IsolationUnsupported) || !/argv element exceeds platform single-argument limit/.test(error.message)) {
          throw error;
        }
        if (inspectArgv.at(-1) !== prompt || Buffer.byteLength(prompt) <= PLATFORM_SINGLE_ARG_MAX) throw error;
        inspectTransport = "native_request_capture";
        captureProof = runNativeCaptureHelper({
          binary: resolved,
          cwd,
          env,
          execArgs,
          frozenPath: frozen.path,
          frozenSha256: frozen.sha256,
          tuple,
          schema: JSON.parse(schemaBytes.toString("utf8")),
          binarySha256: binary.sha256,
        });
        inspectRaw = Buffer.from(captureProof.inspect_json);
      }
    }
    requireHelp(execHelp, EXEC_HELP_NEED, "exec");
    requireHelp(debugHelp, DEBUG_HELP_NEED, "debug prompt-input");
    requireFeatures(featuresText);
    let parsed;
    try { parsed = JSON.parse(inspectRaw.toString("utf8").trim()); } catch { fail("prompt inspect did not return a JSON array"); }
    let nativeProfile = captureProof?.native_profile || null;
    if (!offlineMode && inspectTransport === "positional_prompt_input") {
      const probeArgv = buildPromptInspectArgv({ tuple, disabledSkills: skills, prompt: NATIVE_PROFILE_PROBE });
      assertArgvFits(probeArgv);
      const probeRaw = runCodex(resolved, probeArgv, { cwd, env, timeout: TIMEOUT_MS, maxBuffer: MAX_BYTES });
      let probeParsed;
      try { probeParsed = JSON.parse(String(probeRaw).trim()); } catch { fail("native profile probe did not return a JSON array"); }
      const probeDiag = diagnosePromptContamination(probeParsed, {
        prompt: NATIVE_PROFILE_PROBE, cwd, requireEnv: true, allowNativeDeveloper: true,
      });
      if (!probeDiag.ok || probeDiag.unknown) {
        fail(`native profile probe failed: ${(probeDiag.reasons || []).join("; ") || "unknown"}`);
      }
      const probeFrames = framesFromInspectMessages(probeParsed, NATIVE_PROFILE_PROBE);
      nativeProfile = nativeProfileFromStable({
        model: tuple.model,
        effort: tuple.effort,
        schema: JSON.parse(schemaBytes.toString("utf8")),
        tool_choice: null,
        parallel_tool_calls: null,
        frames: probeFrames,
        tools: [],
      }, { binarySha256: binary.sha256 });
    }
    const diagnosis = diagnosePromptContamination(parsed, {
      prompt,
      cwd,
      profile: nativeProfile,
      requireEnv: true,
      allowNativeDeveloper: inspectTransport === "native_request_capture",
    });
    if (!diagnosis.ok || diagnosis.unknown) fail(`effective isolation inspect failed: ${(diagnosis.reasons || []).join("; ") || "unknown"}`);
    if (!offlineMode && nativeProfile) {
      const completeBytes = Number.isInteger(captureProof?.body_bytes)
        ? captureProof.body_bytes
        : completeRequestBytes({
          items: parsed,
          schema: nativeProfile.schema,
          semantic: nativeProfileBody(nativeProfile),
        });
      tokenCheck = evaluateBudget(completeBytes, modeName === "live");
      tokenCheck.envelope_bytes = completeBytes;
      tokenCheck.captured_body_bytes = Number.isInteger(captureProof?.body_bytes) ? captureProof.body_bytes : null;
    }
    const stored = putObject(inspectRaw, { start: consumerRoot });
    const liveEligible = !offlineMode && tokenCheck.fits === true;
    const proof = {
      role,
      prompt,
      cwd,
      mode: offlineMode ? "OFFLINE" : modeName,
      binary,
      version: { raw: versionRaw, sha256: sha256Utf8(versionRaw) },
      help: { exec_sha256: sha256Utf8(execHelp), debug_sha256: sha256Utf8(debugHelp) },
      features_sha256: sha256Utf8(featuresText),
      config_flags: configFlags,
      config_sha256: sha256Utf8(canonicalJson(configFlags)),
      exec_args: execArgs,
      exec_args_sha256: sha256Utf8(canonicalJson(execArgs)),
      inspect_argv_sha256: sha256Utf8(canonicalJson(inspectTransport === "native_request_capture"
        ? buildPromptInspectArgv({ tuple, disabledSkills: skills, includePrompt: false })
        : inspectArgv)),
      schema_sha256,
      prompt_sha256: sha256Utf8(prompt),
      frozen_request: {
        sha256: frozen.sha256,
        byteLength: frozen.byteLength,
        transport: inspectTransport,
      },
      inspection_authority: inspectTransport === "native_request_capture"
        ? "qualified_native_request_inspect"
        : (offlineMode ? "offline_fixture" : "native_prompt_input"),
      limits: {
        request_bytes: PLANNING_REQUEST_MAX_BYTES,
        output_bytes: MAX_BYTES,
        timeout_ms: TIMEOUT_MS,
      },
      token_budget: offlineMode ? { checked: false, fits: false, estimated_tokens: tokenCheck.estimated_tokens } : {
        checked: true,
        fits: tokenCheck.fits === true,
        estimated_tokens: tokenCheck.estimated_tokens,
        envelope_bytes: tokenCheck.envelope_bytes ?? 0,
        captured_body_bytes: tokenCheck.captured_body_bytes ?? null,
        maxInputTokens: tokenBudget.maxInputTokens,
        contextWindow: tokenBudget.contextWindow,
        outputReserveTokens: tokenBudget.outputReserveTokens,
        context_window: tokenBudget.context_window,
        max_context_window: tokenBudget.max_context_window,
        catalog_sha256: tokenBudget.sha256,
        reason: tokenCheck.reason ?? null,
      },
      native_profile: nativeProfile,
      native_tool_advertisements: captureProof?.tools ?? nativeProfile?.tools ?? null,
      capture_inference: captureProof ? false : null,
      disabled_skills: skills,
      disabled_skills_sha256: skillsDigest(skills),
      native_prompt: { type: "object", sha256: stored.sha256 },
      native_prompt_sha256: stored.sha256,
      diagnosis,
      effective: {
        isolated: true,
        usable_live: liveEligible,
        status: offlineMode ? "isolated_offline" : (liveEligible ? "isolated" : "isolated_not_live"),
      },
    };
    assertIsolationAuthority(proof, {
      fixture: offlineMode,
      requested: tuple,
      schema: JSON.parse(schemaBytes.toString("utf8")),
      inspectMessages: parsed,
    });
    const cleanup = () => { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* leftover dir is not authority */ } };
    return { cwd, execArgs, prompt, env, proof, cleanup };
  } catch (error) {
    if (cwd) { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* leftover dir is not authority */ } }
    throw error instanceof IsolationUnsupported ? error : new IsolationUnsupported(error.message);
  }
}