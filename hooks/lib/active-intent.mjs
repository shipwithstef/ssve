#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const STATE_BASENAME = "active-intent-state.json";
const DEFAULT_TTL_MINUTES = 240;

export function findSvcDir(startDir = process.cwd()) {
  let dir = path.resolve(startDir || process.cwd());
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, ".svc");
    if (existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

export function activeIntentStatePath(svcDir) {
  return path.join(svcDir, STATE_BASENAME);
}

function parseJsonMaybe(raw) {
  if (!raw || !String(raw).trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { prompt: String(raw) };
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function contentToText(content, depth = 0) {
  if (depth > 5 || content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => contentToText(part, depth + 1)).filter(Boolean).join("\n");
  }
  if (typeof content !== "object") return "";

  const direct = firstString(
    content.prompt,
    content.user_prompt,
    content.userPrompt,
    content.user_message,
    content.userMessage,
    content.last_user_message,
    content.lastUserMessage,
    content.message,
    content.text,
    content.input
  );
  if (direct) return direct;

  if (Array.isArray(content.messages)) {
    for (let i = content.messages.length - 1; i >= 0; i -= 1) {
      const message = content.messages[i];
      const role = message?.role || message?.type || "";
      if (role && !/user|human|prompt/i.test(role)) continue;
      const text = contentToText(message?.content || message?.message || message?.text, depth + 1);
      if (text.trim()) return text;
    }
  }

  return firstString(
    contentToText(content.content, depth + 1),
    contentToText(content.payload, depth + 1),
    contentToText(content.data, depth + 1),
    contentToText(content.event, depth + 1),
    contentToText(content.hook_input, depth + 1),
    contentToText(content.hookInput, depth + 1)
  );
}

export function promptTextFromRaw(rawInput) {
  return contentToText(parseJsonMaybe(rawInput));
}

export function sessionIdFromPayload(payload = {}, env = process.env) {
  return firstString(
    payload.session_id,
    payload.sessionId,
    payload.thread_id,
    payload.threadId,
    payload?.metadata?.session_id,
    payload?.metadata?.sessionId,
    env.SVC_SESSION_ID,
    env.CODEX_THREAD_ID,
    env.CODEX_SESSION_ID,
    env.CLAUDE_SESSION_ID,
    env.KIMI_SESSION_ID,
    env.GEMINI_SESSION_ID
  );
}

export function turnIdFromPayload(payload = {}, env = process.env) {
  return firstString(
    payload.turn_id,
    payload.turnId,
    payload?.metadata?.turn_id,
    payload?.metadata?.turnId,
    env.CODEX_TURN_ID,
    env.SVC_TURN_ID
  );
}

function normalizeText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

const NEGATED_STOP_SPAN = /\b(?:do\s+not|don['’]?t|dont|never)(?:\s+[\p{L}\p{N}_'’-]+){0,6}\s+stop\b/giu;
const CONTRASTIVE_STOP = /\b(?:but|however|instead)\b/i;

function hasAffirmativeStop(text) {
  const withoutNegatedStops = String(text || "").replace(
    NEGATED_STOP_SPAN,
    (span) => (CONTRASTIVE_STOP.test(span) ? span : "")
  );
  return /\bstop\b/i.test(withoutNegatedStops);
}

export function detectReferencedWI(text) {
  const match = String(text || "").match(/\bWI[-\s]?(\d{2,5})\b/i);
  return match ? `WI-${match[1]}` : "";
}

export function isExplicitContinueForWI(text) {
  return /\b(?:continue|resume|proceed|keep\s+going|carry\s+on|finish|complete)\s+(?:with\s+|on\s+|the\s+)?WI[-\s]?\d{2,5}\b/i.test(
    String(text || "")
  );
}

export function classifyActiveIntent(text) {
  const raw = String(text || "");
  const normalized = normalizeText(raw);
  const referencedWi = detectReferencedWI(raw);

  if (isExplicitContinueForWI(raw)) {
    return {
      classification: "continue-wi",
      suppress: false,
      wi: referencedWi,
      resumed_wi: referencedWi,
      reason: referencedWi ? `explicit continue for ${referencedWi}` : "explicit WI continuation"
    };
  }

  if (hasAffirmativeStop(raw)) {
    return {
      classification: "stop",
      suppress: true,
      wi: referencedWi || "*",
      reason: referencedWi
        ? `stop suppresses ${referencedWi}`
        : "stop suppresses stale WI continuation pressure"
    };
  }

  const suppressionPatterns = [
    { classification: "scope-correction", pattern: /\bignore\s+(?:this|that|it|the\s+guard|the\s+hook|wi[-\s]?\d{2,5})\b/i },
    { classification: "scope-correction", pattern: /\bwhat\s+(?:are|r)\s+(?:you|u|oyu)\s+doing\b/i },
    { classification: "unrelated", pattern: /\bunrelated\b/i },
    { classification: "unrelated", pattern: /\bcross[-\s]?session\b/i },
    { classification: "unrelated", pattern: /\bwrong\s+(?:session|thread|work\s*item|wi|conversation)\b/i },
    { classification: "unrelated", pattern: /\bnot\s+(?:part\s+of\s+)?(?:this|the|current)\s+(?:conversation|request|topic|task)\b/i },
    { classification: "unrelated", pattern: /\bnot\s+the\s+current\s+(?:conversation|request|topic|task)\b/i },
    { classification: "unrelated", pattern: /\bcurrent\s+conversation\b.*\bnot\b|\bnot\b.*\bcurrent\s+conversation\b/i }
  ];

  for (const candidate of suppressionPatterns) {
    if (candidate.pattern.test(raw) || candidate.pattern.test(normalized)) {
      return {
        classification: candidate.classification,
        suppress: true,
        wi: referencedWi || "*",
        reason: referencedWi
          ? `${candidate.classification} suppresses ${referencedWi}`
          : `${candidate.classification} suppresses stale WI continuation pressure`
      };
    }
  }

  return {
    classification: "none",
    suppress: false,
    wi: referencedWi,
    reason: "no active-intent suppression signal"
  };
}

function laneSvcDirFromEnv(env = process.env) {
  const firstLaneFile = String(env.LANE_TASKS_LIST || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return firstLaneFile ? path.dirname(firstLaneFile) : null;
}

function stateNow(now = new Date()) {
  return now instanceof Date ? now : new Date(now);
}

function ttlMinutes(env = process.env) {
  const parsed = Number.parseInt(env.SVC_ACTIVE_INTENT_TTL_MINUTES || `${DEFAULT_TTL_MINUTES}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MINUTES;
}

function hashPrompt(text) {
  return `sha256:${createHash("sha256").update(String(text || ""), "utf8").digest("hex")}`;
}

export function readActiveIntentState(svcDir) {
  if (!svcDir) return null;
  const file = activeIntentStatePath(svcDir);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeStateAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, file);
}

function readExistingSuppressedWis(svcDir, nowMs) {
  const existing = readActiveIntentState(svcDir);
  if (!existing || !Array.isArray(existing.suppressed_wis)) return [];
  return existing.suppressed_wis.filter((entry) => {
    const expires = Date.parse(entry.expires_at || "");
    return Number.isFinite(expires) && expires > nowMs;
  });
}

export function writeActiveIntentState({ rawInput = "", cwd = process.cwd(), env = process.env, now = new Date() } = {}) {
  const payload = parseJsonMaybe(rawInput);
  const text = contentToText(payload);
  const classification = classifyActiveIntent(text);
  if (classification.classification === "none" && !text.trim()) {
    return { status: "none", classification: "none" };
  }

  const effectiveCwd = firstString(payload.cwd, payload.project_dir, payload.projectDir, cwd, process.cwd());
  const svcDir = findSvcDir(effectiveCwd);
  if (!svcDir) return { status: "no-svc", classification: classification.classification };

  const tsDate = stateNow(now);
  const nowMs = tsDate.getTime();
  const expiresAt = new Date(nowMs + ttlMinutes(env) * 60_000).toISOString();
  const sessionId = sessionIdFromPayload(payload, env);
  const turnId = turnIdFromPayload(payload, env);
  const promptHash = hashPrompt(text);
  const existingState = readActiveIntentState(svcDir);
  const suppressedWis = readExistingSuppressedWis(svcDir, nowMs);
  const resumes = Array.isArray(existingState?.resumed_wis) ? existingState.resumed_wis : [];

  if (classification.suppress) {
    suppressedWis.push({
      wi: classification.wi || "*",
      reason: classification.reason,
      classification: classification.classification,
      ts: tsDate.toISOString(),
      expires_at: expiresAt,
      session_id: sessionId,
      turn_id: turnId,
      cwd: path.resolve(effectiveCwd),
      prompt_hash: promptHash
    });
  }

  const nextResumes = classification.resumed_wi
    ? [
        ...resumes.filter((entry) => entry?.wi !== classification.resumed_wi),
        {
          wi: classification.resumed_wi,
          ts: tsDate.toISOString(),
          session_id: sessionId,
          turn_id: turnId,
          cwd: path.resolve(effectiveCwd),
          prompt_hash: promptHash
        }
      ]
    : resumes;

  const state = {
    version: 1,
    ts: tsDate.toISOString(),
    cwd: path.resolve(effectiveCwd),
    session_id: sessionId,
    turn_id: turnId,
    latest_prompt_hash: promptHash,
    classification: classification.classification,
    active_request: text.slice(0, 240),
    suppressed_wis: suppressedWis,
    resumed_wi: classification.resumed_wi || "",
    resumed_wis: nextResumes
  };
  writeStateAtomic(activeIntentStatePath(svcDir), state);
  return {
    status: classification.suppress ? "suppressed" : classification.resumed_wi ? "continued" : "recorded",
    classification: classification.classification,
    wi: classification.wi || classification.resumed_wi || "",
    svcDir,
    state
  };
}

function sameSession(entry, currentSessionId) {
  if (!entry?.session_id || !currentSessionId) return true;
  return entry.session_id === currentSessionId;
}

function sameCwdScope(entryCwd, currentCwd, svcDir) {
  if (!entryCwd || !currentCwd) return true;
  const entry = path.resolve(entryCwd);
  const current = path.resolve(currentCwd);
  if (entry === current) return true;
  const repoRoot = svcDir ? path.resolve(path.dirname(svcDir)) : "";
  if (!repoRoot) return false;
  return entry.startsWith(`${repoRoot}${path.sep}`) && current.startsWith(`${repoRoot}${path.sep}`);
}

function wiMatches(entryWi, resolvedWi) {
  if (!entryWi || entryWi === "*") return true;
  return String(entryWi).toUpperCase() === String(resolvedWi || "").toUpperCase();
}

function latestResumeForWi(state, resolvedWi, currentSessionId, currentCwd, svcDir) {
  const resumes = Array.isArray(state?.resumed_wis) ? state.resumed_wis : [];
  let latest = null;
  for (const entry of resumes) {
    if (!wiMatches(entry?.wi, resolvedWi)) continue;
    if (!sameSession(entry, currentSessionId)) continue;
    if (!sameCwdScope(entry?.cwd, currentCwd, svcDir)) continue;
    const ts = Date.parse(entry.ts || "");
    if (!Number.isFinite(ts)) continue;
    if (!latest || ts > latest.ts) latest = { ...entry, ts };
  }
  return latest;
}

function isConcreteWiBinding(boundTo, boundWi, resolvedWi) {
  const normalizedBoundTo = String(boundTo || "");
  const normalizedBoundWi = String(boundWi || "");
  const normalizedResolvedWi = String(resolvedWi || "");
  if (!normalizedResolvedWi) return false;
  if (normalizedBoundTo.toUpperCase() === normalizedResolvedWi.toUpperCase()) return true;
  if (normalizedBoundWi.toUpperCase() === normalizedResolvedWi.toUpperCase()) {
    return !new Set(["user-request", "framework", "framework-evolution", "wi-backlog"]).has(normalizedBoundTo);
  }
  return false;
}

function latestPromptPostdatesContract(state, env = process.env) {
  const stateTs = Date.parse(state?.ts || "");
  const contractTs = Date.parse(env.CONTRACT_TS || env.SVC_CONTRACT_TS || "");
  return Number.isFinite(stateTs) && Number.isFinite(contractTs) && stateTs > contractTs;
}

function latestPromptExplicitlyTargetsWi(state, resolvedWi) {
  if (state?.classification === "continue-wi" &&
      String(state?.resumed_wi || "").toUpperCase() === String(resolvedWi || "").toUpperCase()) {
    return true;
  }
  const text = state?.active_request || "";
  if (!text.trim()) return false;
  if (!isExplicitContinueForWI(text)) return false;
  const continuedWi = detectReferencedWI(text);
  return continuedWi.toUpperCase() === String(resolvedWi || "").toUpperCase();
}

export function evaluateSuppression({
  svcDir,
  resolvedWi,
  rawInput = "",
  cwd = process.cwd(),
  env = process.env,
  now = new Date()
} = {}) {
  const state = readActiveIntentState(svcDir);
  if (!state) return { suppressed: false, reason: "no active-intent state" };

  const payload = parseJsonMaybe(rawInput);
  const currentCwd = firstString(payload.cwd, payload.project_dir, payload.projectDir, cwd, process.cwd());
  const currentSessionId = sessionIdFromPayload(payload, env);
  const nowMs = stateNow(now).getTime();
  const targetWis = String(resolvedWi || "")
    .split(",")
    .map((wi) => wi.trim())
    .filter(Boolean);
  const wis = targetWis.length > 0 ? targetWis : [detectReferencedWI(contentToText(payload))].filter(Boolean);
  if (wis.length === 0) return { suppressed: false, reason: "no resolved WI" };

  for (const wi of wis) {
    const resume = latestResumeForWi(state, wi, currentSessionId, currentCwd, svcDir);
    const entries = Array.isArray(state.suppressed_wis) ? state.suppressed_wis : [];
    for (const entry of entries) {
      const expires = Date.parse(entry.expires_at || "");
      const ts = Date.parse(entry.ts || "");
      if (!Number.isFinite(expires) || expires <= nowMs) continue;
      if (!Number.isFinite(ts)) continue;
      if (!wiMatches(entry.wi, wi)) continue;
      if (!sameSession(entry, currentSessionId)) continue;
      if (!sameCwdScope(entry.cwd, currentCwd, svcDir)) continue;
      if (resume && resume.ts > ts) continue;
      return {
        suppressed: true,
        wi,
        classification: entry.classification || state.classification,
        reason: entry.reason || "latest user intent suppresses stale WI continuation pressure",
        ts: entry.ts,
        expires_at: entry.expires_at
      };
    }

    if (
      latestPromptPostdatesContract(state, env) &&
      (
        isConcreteWiBinding(env.CONTRACT_BOUND_TO, env.CONTRACT_WI, wi) ||
        String(env.CONTRACT_BOUND_TO || "") === "wi-backlog"
      ) &&
      sameSession(state, currentSessionId) &&
      sameCwdScope(state.cwd, currentCwd, svcDir) &&
      !latestPromptExplicitlyTargetsWi(state, wi)
    ) {
      return {
        suppressed: true,
        wi,
        classification: "stale-contract-latest-prompt",
        reason: "latest user prompt postdates stale WI backlog authority and does not explicitly resume that WI",
        ts: state.ts,
        expires_at: ""
      };
    }
  }

  return { suppressed: false, reason: "no matching active-intent suppression" };
}

function b64(text) {
  return Buffer.from(String(text || ""), "utf8").toString("base64");
}

function firstExistingSvcDirFromEnv(env = process.env) {
  return laneSvcDirFromEnv(env) || findSvcDir(env.PWD || process.cwd());
}

async function main() {
  const mode = process.argv[2] || "";
  if (mode === "record") {
    const rawInput = !process.stdin.isTTY ? readFileSync(0, "utf8") : process.env.INPUT || "";
    const result = writeActiveIntentState({ rawInput, env: process.env, cwd: process.cwd() });
    process.stdout.write(`${result.status}\t${result.classification || ""}\t${result.wi || ""}\n`);
    return;
  }

  if (mode === "check") {
    const svcDir = firstExistingSvcDirFromEnv(process.env);
    if (!svcDir) {
      process.stdout.write("allow\t\n");
      return;
    }
    // WI-379: read the payload from stdin first (the hook pipes $INPUT via
    // stdin to avoid ARG_MAX/E2BIG; env INPUT is the bounded test/back-compat
    // fallback when stdin is a TTY). Mirrors `record` mode above.
    const rawInput = !process.stdin.isTTY ? readFileSync(0, "utf8") : process.env.INPUT || "";
    const resolvedWi = process.env.RESOLVED_WI || process.env.WI || "";
    const result = evaluateSuppression({
      svcDir,
      resolvedWi,
      rawInput,
      cwd: process.cwd(),
      env: process.env
    });
    if (!result.suppressed) {
      process.stdout.write("allow\t\n");
      return;
    }
    const message = [
      `latest user intent recorded ${result.classification || "suppression"} for ${result.wi || resolvedWi}`,
      result.reason,
      `recorded_at=${result.ts || "unknown"}`,
      `expires_at=${result.expires_at || "unknown"}`
    ].join("\n");
    process.stdout.write(`suppress\t${b64(message)}\n`);
    return;
  }

  if (mode === "debug-state") {
    const svcDir = firstExistingSvcDirFromEnv(process.env);
    process.stdout.write(JSON.stringify(readActiveIntentState(svcDir), null, 2));
    return;
  }

  process.stderr.write("usage: active-intent.mjs record|check|debug-state\n");
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`active-intent: ${error.message}\n`);
    process.exit(1);
  });
}
