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
 *     ONLY those -c flags (including -c model=MODEL) plus positional EXACT final prompt.
 *     No exec flags, -m, --output-schema, --json, --ignore-user-config.
 *   discoverDisabledSkills({home, extraRoots, includeSystem, maxDepth, maxFiles})
 *     live: ~/.codex/skills and ~/.codex/plugins/cache (follow install symlinks, cycle-bounded,
 *     dedup path + content hash). extraRoots + system/skills only for OFFLINE tests.
 *   inheritEnv(env?) strips session/controller/delegation authority; keeps HOME/CODEX_HOME.
 *   diagnosePromptContamination(messages, {prompt, cwd}) structured parse (no JSON subtraction).
 *   assertEffectiveIsolation({role, tuple, prompt, schema, consumerRoot, mode='inspect', offline={}})
 *     -> {cwd, execArgs, prompt, env, proof, cleanup}
 *     inspect/live: real resolved binary/version/help/features + debug prompt-input; no paid exec.
 *     Reject injected offline/customenv/binary/helpText/featuresText/discoveredSkills/inspectPrompt/fsImpl.
 *     OFFLINE fixtures allowed; proof.effective.usable_live=false. cleanup removes the temp dir.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  IsolationUnsupported,
  sha256Bytes,
  sha256Utf8,
  canonicalJson,
  DEFAULT_LIMITS,
} from "./two-box-protocol.mjs";
import { putObject } from "./review-evidence-store.mjs";

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
const SOURCE_RE = /skills\/|AGENTS\.md|\bSSVE\b|DOCTRINE|SKILL\.md/;
const AUTH_DROP = /(?:^|_)(SESSION|CONTROLLER|DELEGATION|LEASE)(_|$)/;

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

export function buildPromptInspectArgv({ tuple, disabledSkills, prompt } = {}) {
  requireTuple(tuple);
  if (typeof prompt !== "string") fail("prompt required");
  const argv = ["debug", "prompt-input", ...buildCodexConfigFlags({ tuple, disabledSkills }), prompt];
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

function wrapperKind(text) {
  if (text.startsWith("<permissions instructions>") || text.startsWith("<permissions>")) return "permissions";
  if (text.startsWith("<collaboration_mode>")) return "collaboration";
  if (text.startsWith("<multi_agent_role>") || text.startsWith("<multi_agent_mode>")) return "multi_agent";
  return null;
}

function envContextOk(text, cwd) {
  return text.startsWith("<environment_context>")
    && text.trimEnd().endsWith("</environment_context>")
    && text.includes(`<cwd>${cwd}</cwd>`)
    && !INJECT_RE.test(text);
}

export function diagnosePromptContamination(messages, { prompt, cwd } = {}) {
  const reasons = [];
  let unknown = false;
  const native_wrappers = [];
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
  for (const msg of arr) {
    if (!msg || typeof msg !== "object") { unknown = true; reasons.push("non-object message"); continue; }
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
        const kind = wrapperKind(text);
        if (!kind) { unknown = true; reasons.push("unknown developer wrapper"); continue; }
        const nativeText = text.replaceAll("applicable AGENTS.md/skill instructions", "applicable native instructions").replaceAll("applicable `AGENTS.md` instructions", "applicable native instructions");
        if (INJECT_RE.test(nativeText)) reasons.push(`injected catalog/methodology in ${kind} wrapper`);
        native_wrappers.push({ type: kind, sha256: sha256Utf8(text) });
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
      if (envContextOk(text, cwd)) { env_count += 1; continue; }
      if (text.startsWith("<environment_context>")) reasons.push("environment_context cwd/instructions mismatch");
      else reasons.push("unexpected user message outside declared payload");
      continue;
    }
    unknown = true;
    reasons.push(`unknown role ${msg.role}`);
  }
  if (exact_prompt_count !== 1) reasons.push(`exact prompt must appear once as full input_text (got ${exact_prompt_count})`);
  if (env_count !== 1) reasons.push(`expected one native environment_context (got ${env_count})`);
  const source_exposure = { in_declared_payload: typeof prompt === "string" && SOURCE_RE.test(prompt) };
  return { ok: reasons.length === 0 && !unknown, unknown, reasons, native_wrappers, exact_prompt_count, source_exposure };
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
  const offlineMode = isOfflineMode(modeName);
  const env = mergeOfflineEnv(process.env, offlineMode ? offline.customenv : undefined);
  let cwd = null;
  try {
    const consumer = fs.realpathSync(path.resolve(consumerRoot));
    const tmpRoot = fs.realpathSync(os.tmpdir());
    if (inside(tmpRoot, consumer)) fail("tmpdir is inside consumer instruction chain");
    cwd = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot, "ssve-openbox-preflight-")));
    if (inside(cwd, consumer)) fail("neutral cwd is inside consumer instruction chain");
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
    const inspectArgv = buildPromptInspectArgv({ tuple, disabledSkills: skills, prompt });
    let binary;
    let versionRaw;
    let execHelp;
    let debugHelp;
    let featuresText;
    let inspectRaw;
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
      const resolved = resolveCodexExecutable();
      binary = { path: resolved, sha256: sha256Bytes(fs.readFileSync(resolved)) };
      versionRaw = runCodex(resolved, ["--version"], { env, timeout: 30000 }).trim();
      execHelp = runCodex(resolved, ["exec", "--help"], { env, timeout: 30000 });
      debugHelp = runCodex(resolved, ["debug", "prompt-input", "--help"], { env, timeout: 30000 });
      featuresText = runCodex(resolved, ["features", "list"], { env, timeout: 30000 });
      inspectRaw = Buffer.from(runCodex(resolved, inspectArgv, { cwd, env, timeout: TIMEOUT_MS, maxBuffer: MAX_BYTES }));
    }
    requireHelp(execHelp, EXEC_HELP_NEED, "exec");
    requireHelp(debugHelp, DEBUG_HELP_NEED, "debug prompt-input");
    requireFeatures(featuresText);
    let parsed;
    try { parsed = JSON.parse(inspectRaw.toString("utf8").trim()); } catch { fail("prompt inspect did not return a JSON array"); }
    const diagnosis = diagnosePromptContamination(parsed, { prompt, cwd });
    if (!diagnosis.ok || diagnosis.unknown) fail(`effective isolation inspect failed: ${(diagnosis.reasons || []).join("; ") || "unknown"}`);
    const stored = putObject(inspectRaw, { start: consumerRoot });
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
      inspect_argv_sha256: sha256Utf8(canonicalJson(inspectArgv)),
      schema_sha256,
      prompt_sha256: sha256Utf8(prompt),
      disabled_skills: skills,
      disabled_skills_sha256: skillsDigest(skills),
      native_prompt: { type: "object", sha256: stored.sha256 },
      native_prompt_sha256: stored.sha256,
      diagnosis,
      effective: {
        isolated: true,
        usable_live: !offlineMode,
        status: offlineMode ? "isolated_offline" : "isolated",
      },
    };
    const cleanup = () => { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* leftover dir is not authority */ } };
    return { cwd, execArgs, prompt, env, proof, cleanup };
  } catch (error) {
    if (cwd) { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* leftover dir is not authority */ } }
    throw error instanceof IsolationUnsupported ? error : new IsolationUnsupported(error.message);
  }
}