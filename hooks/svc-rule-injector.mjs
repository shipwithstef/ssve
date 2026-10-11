#!/usr/bin/env node
/**
 * svc-rule-injector — WI-361 context diet ph.1; the one context injector process.
 *
 * Injects subject-matter rules ON DEMAND instead of always-on. Triggers
 * (wired by wire-hooks.mjs):
 *   PreToolUse  Edit|Write|Bash   — rules arrive BEFORE the first edit; command-
 *                                   keyword rules (git/gh/docker classes) on Bash
 *   PostToolUse Read|Grep|Glob    — earlier arrival while exploring
 *
 * On PreToolUse the same process also runs the action-time learning injector
 * (svc-learning-inject.mjs, WI-384) and the intended-owner injector
 * (svc-owner-inject.mjs, WI-392) in-process: one spawn per Edit/Write/Bash
 * instead of three.
 *
 * Output: { hookSpecificOutput: { hookEventName, additionalContext } }, 10K-char
 * cap. Never a permissionDecision: this hook only adds context, and an "allow"
 * would skip the host's own permission prompt for the call.
 *
 * Cost model: matched rules use atomic session markers before loading rule text.
 * Memo: private runtime session-findings; atomic once per session and rule.
 * Fail-open: ANY error → exit 0 with no output (never blocks tooling).
 */

// Optional: a bundle without the counter simply does not count.
const { failOpen, failOpenAt } = await import("./lib/fail-open.mjs").catch(() => ({ failOpen() {}, failOpenAt() {} }));
import { firstSessionFinding, findingSession } from "./lib/session-findings.mjs";
import { isShellTool } from "./lib/shell-tools.mjs";
import { evaluatePreToolObservation } from "./lib/pretool-decision-engine.mjs";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// G2 PLAN-002: the established payload normalizer (conf-10 stdin-first learning)
// handles tool_name/toolName, tool_input/toolInput/arguments, payload cwd,
// file_path/path variants across hosts.
import { readHookPayload, extractFilePath, extractCommand, resolveHookOperation } from "./lib/hook-payload.mjs";
import { resolveSvcStateDir } from "./lib/svc-state-dir.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVC_ROOT = path.join(__dirname, "..");
const CAP = 10000;          // documented additionalContext cap
const BUDGET = 8500;        // full-text packing budget; remainder listed as pointers

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
// Every swallowed registry/rule error below is a fail-open: the injector stays quiet and the
// action proceeds, so it is counted where it is swallowed.
const swallowed = (error) => failOpen("svc-rule-injector", error);
// Parse JSON that must be well formed; a corrupt document is counted and treated as absent.
function parseRegistry(text) { try { return JSON.parse(text); } catch (error) { swallowed(error); return null; } }

function loadRegistry() {
  // SVC_RULES_MANIFEST override exists for hermetic validator fixtures (PLAN-004)
  const mp = process.env.SVC_RULES_MANIFEST || path.join(SVC_ROOT, "skills-manifest.json");
  const m = parseRegistry(readFileSync(mp, "utf8"));
  return (m && m.rulesRegistry && m.rulesRegistry.entries) || [];
}

function globToRe(g) {
  // glob→regex for concern file_path_patterns — ANCHORED, with zero-dir `**/`
  // support (tier-3 WI-361-T3-002: unanchored version over-excluded via
  // fires_off substring hits and missed top-level `**/x/**` matches).
  // placeholder tokens keep injected regex text immune to later passes
  const esc = g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0001")
    .replace(/\*\*/g, "\u0002")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0001/g, "(?:.*/)?")
    .replace(/\u0002/g, ".*");
  return new RegExp("^" + esc + "$");
}

function loadConcernBridge(paths) {
  // In-process mini-match against concerns REGISTRY (real shape verified
  // 2026-06-07: signals.file_path_patterns are GLOBS; rules live at
  // handled_by.required_rules; fires_off globs exclude). No nested node
  // spawn (latency budget per WI-359).
  try {
    const rp = process.env.SVC_CONCERNS_REGISTRY || path.join(SVC_ROOT, "concerns", "REGISTRY.json");
    const reg = parseRegistry(readFileSync(rp, "utf8"));
    const out = new Set();
    for (const c of (reg && reg.concerns) || []) {
      const rules = (c.handled_by && c.handled_by.required_rules) || [];
      if (!rules.length) continue;
      const offs = (c.fires_off || []).map(globToRe);
      const ons = ((c.signals && c.signals.file_path_patterns) || []).map(globToRe);
      const hit = paths.some((p) => ons.some((re) => re.test(p)) && !offs.some((re) => re.test(p)));
      if (hit) for (const r of rules) out.add(r);
    }
    return out;
  } catch (error) { swallowed(error); return new Set(); }
}

// Stack-specific rules may declare signals.repo_markers: the rule fires only
// when the governed repo carries at least one marker. "<path>" = exists under
// the repo root; "<file>:<substring>" = that file contains the substring.
// Without markers a base44 rule fired on any public/, dist/ or functions/ path.
function repoHasMarker(root, markers) {
  if (!Array.isArray(markers) || markers.length === 0) return true;
  for (const m of markers) {
    const s = String(m || "");
    const i = s.indexOf(":");
    try {
      if (i > 0) { if (readFileSync(path.join(root, s.slice(0, i)), "utf8").includes(s.slice(i + 1))) return true; }
      else if (s && existsSync(path.join(root, s))) return true;
    } catch (error) { if (error?.code !== "ENOENT") swallowed(error); /* unreadable marker file = no marker; an absent one is normal */ }
  }
  return false;
}

// Subject-matter rules for this call, or "" when none apply.
function ruleContext(call) {
  if (evaluatePreToolObservation(call.raw) && isShellTool(call.toolName)) return "";
  const tool = call.toolName;
  const input = call.toolInput || {};
  if (!findingSession(call.raw)) return "";

  // Extract match subjects per trigger (helper-first per host-variant contract)
  let paths = [];
  let bashCmd = "";
  let content = "";
  if (tool === "Edit" || tool === "Write") {
    paths = [extractFilePath(input)].filter(Boolean);
    // G2 PLAN-005: content keywords — new content is a live signal source
    content = String(input.new_string || input.content || "");
  } else if (tool === "Read") paths = [extractFilePath(input)].filter(Boolean);
  else if (tool === "Grep" || tool === "Glob") paths = [input.path || input.pattern || ""].filter(Boolean);
  else if (isShellTool(tool)) bashCmd = extractCommand(input);
  if (paths.length === 0 && !bashCmd && !content) return "";

  // Repo-relative-ize vs payload cwd first (PLAN-002)
  const operation = resolveHookOperation(call);
  if (operation.host === "codex" && !operation.scope?.ok) return "";
  const cwd = operation.root || call.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  // WI-452: only inject/persist within an svc-governed repo; never seed .svc in /tmp or a foreign cwd.
  const svcDir = resolveSvcStateDir(cwd);
  if (!svcDir) return "";
  paths = paths
    .map((p) => path.normalize(path.isAbsolute(p) ? path.relative(cwd, p) : p))
    .filter((p) => p && !p.startsWith(".."));   // G6 EXEC-002 r2: normalize FIRST so embedded a/../../b traversal is resolved before the escape check

  const entries = loadRegistry().filter((e) => e.auto_inject === "signal");
  const bridgeRules = paths.length ? loadConcernBridge(paths) : new Set();

  const matched = [];
  const markerMemo = new Map();
  for (const e of entries) {
    const sig = e.signals || {};
    if (sig.repo_markers) {
      const key = JSON.stringify(sig.repo_markers);
      // Markers live at the governed repo root (the dir holding .svc), not the
      // session cwd: a session started in src/ must still see package.json.
      if (!markerMemo.has(key)) markerMemo.set(key, repoHasMarker(path.dirname(svcDir), sig.repo_markers));
      if (!markerMemo.get(key)) continue;
    }
    let hit = false;
    for (const rx of sig.paths || []) {
      let re; try { re = new RegExp(rx); } catch (error) { swallowed(error); continue; }
      if (paths.some((p) => re.test(p))) { hit = true; break; }
    }
    if (!hit && bashCmd) {
      for (const rx of sig.bash || []) {
        let re; try { re = new RegExp(rx); } catch (error) { swallowed(error); continue; }
        if (re.test(bashCmd)) { hit = true; break; }
      }
    }
    if (!hit && content) {
      // PLAN-005: subject-in-content rules (e.g. IGNORECASE regexes being written)
      for (const rx of sig.keywords || []) {
        let re; try { re = new RegExp(rx); } catch (error) { swallowed(error); continue; }
        if (re.test(content)) { hit = true; break; }
      }
    }
    if (!hit && bridgeRules.size) {
      const base = path.basename(e.path, ".md");
      if (bridgeRules.has(base) || bridgeRules.has(e.path)) hit = true;
    }
    if (hit) matched.push(e);
  }
  if (matched.length === 0) return "";

  // The memo follows the stable session across worktrees. A pointer also
  // counts as delivery: repeating it spends context without new information.
  const fresh = matched.filter(e => firstSessionFinding(call.raw, "rules", "rule-injector", e.path));
  if (fresh.length === 0) return "";

  // Cap-aware packing: corrections first (full text), then steering; overflow → pointer lines
  fresh.sort((a, b) => (a.type === "correction" ? 0 : 1) - (b.type === "correction" ? 0 : 1));
  let ctx = "[svc rule-injector] Subject-matter rules for this change:\n";
  const pointers = [];
  for (const e of fresh) {
    let text = "";
    const rulesRoot = process.env.SVC_RULES_ROOT || SVC_ROOT;
    try { text = readFileSync(path.join(rulesRoot, e.path), "utf8"); } catch (error) { swallowed(error); continue; }
    // Registry metadata (scope/stack/source_sha/paths) is for tooling, not the model.
    text = text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n+/, "");
    if (ctx.length + text.length + 64 <= BUDGET) {
      ctx += `\n--- ${e.path} ---\n${text}\n`;
    } else {
      pointers.push(e.path);
    }
  }
  if (pointers.length) {
    ctx += `\nAlso applicable (Read before relying): ${pointers.join(", ")}\n`;
  }
  return ctx.slice(0, CAP);
}

async function main() {
  const call = readHookPayload();              // {toolName, toolInput, sessionId, cwd, raw} (PLAN-002)
  if (!call) return;
  failOpenAt({ cwd: call.cwd });
  const event = call.raw.hook_event_name || call.raw.hookEventName || "";
  const disabled = new Set(String(process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim()).filter(Boolean));
  const tool = call.toolName;
  const action = event !== "PostToolUse" && (tool === "Edit" || tool === "Write" || tool === "Bash");
  const rulesOff = action && disabled.has(tool === "Bash" ? "svc-rule-injector-bash" : "svc-rule-injector-edit");
  const parts = [];
  // G6 EXEC-003: fail-open is the contract — a broken registry/manifest must
  // never block tooling, nor suppress the other injectors.
  if (!rulesOff) try { parts.push(ruleContext(call)); } catch (error) { failOpen("svc-rule-injector", error); /* fail open */ }
  // Learnings and owner routing are pre-action reminders on Edit/Write/Bash only.
  if (action) {
    if (!disabled.has("svc-learning-inject")) parts.push(await import("./svc-learning-inject.mjs").then((m) => m.learningContext(call), (error) => { failOpen("svc-rule-injector", error); return ""; }));
    if (!disabled.has("svc-owner-inject")) parts.push(await import("./svc-owner-inject.mjs").then((m) => m.ownerContext(call), (error) => { failOpen("svc-rule-injector", error); return ""; }));
  }
  const ctx = parts.filter(Boolean).join("\n").slice(0, CAP);
  if (!ctx) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event || "PreToolUse", additionalContext: ctx } }));
}

main().then(() => process.exit(0), (error) => { failOpen("svc-rule-injector", error); process.exit(0); });
