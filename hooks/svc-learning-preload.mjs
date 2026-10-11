#!/usr/bin/env node

/**
 * svc Learning Preload — SessionStart hook
 *
 * Reads framework-level learnings from references/framework-learnings.jsonl
 * AND in-flight auto-learning candidates from .svc/auto-learnings.jsonl
 * (per WI-343 tranche 2b — so candidates captured this session preload next
 * session even before they're explicitly promoted).
 *
 * Prints the highest-confidence recent entries into the session context.
 * This turns passive logs into active guardrails at session start.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// Same rule as hooks/lib/svc-state-dir.mjs (inlined so the hook stays a single
// self-contained file): the nearest ancestor with an existing .svc/ directory,
// never the system temp root itself.
function hasSvcAncestor(start) {
  const temp = new Set([os.tmpdir(), "/tmp", process.env.TMPDIR].filter(Boolean).map((t) => path.resolve(t)));
  let dir = path.resolve(start);
  for (;;) {
    if (!temp.has(dir)) { try { if (fs.statSync(path.join(dir, ".svc")).isDirectory()) return true; } catch {} }
    const up = path.dirname(dir);
    if (up === dir) return false;
    dir = up;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const FRAMEWORK_LEARNINGS = path.join(REPO_ROOT, "references", "framework-learnings.jsonl");
const AUTO_LEARNINGS = path.join(REPO_ROOT, ".svc", "auto-learnings.jsonl");

// Tracked learnings have been human-reviewed; bar stays at 8.
// Auto-captured candidates are pre-review and bottom out at confidence 6
// (the lowest the 6 detectors emit). Filtering them at >=8 would silence
// every detector-produced candidate before promotion, which defeats the
// "preload before promotion" purpose of this hook.
const TRACKED_MIN_CONFIDENCE = 8;
const AUTO_MIN_CONFIDENCE = 6;
const MAX_TRACKED = 5;
const MAX_AUTO = 3;

function readJsonl(filePath) {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeAutoCandidate(c) {
  return {
    key: c.key || "(unkeyed)",
    type: c.signal || "auto-captured",
    confidence: Number(c.confidence || 0),
    insight: c.insight || "",
    files: Array.isArray(c.files) ? c.files : [],
    _origin: "auto-captured (unpromoted)",
  };
}

function normalizeTrackedLearning(e) {
  return {
    key: e.key || "(unkeyed)",
    type: e.type || "(untyped)",
    confidence: Number(e.confidence || 0),
    insight: e.insight || "",
    files: Array.isArray(e.files) ? e.files : [],
    _origin: null,
  };
}

function loadAllLearnings() {
  const tracked = readJsonl(FRAMEWORK_LEARNINGS)
    .filter((e) => Number(e.confidence || 0) >= TRACKED_MIN_CONFIDENCE)
    .map(normalizeTrackedLearning)
    .slice(-MAX_TRACKED);

  const autoCandidates = readJsonl(AUTO_LEARNINGS)
    .filter((c) => Number(c.confidence || 0) >= AUTO_MIN_CONFIDENCE)
    .map(normalizeAutoCandidate)
    .slice(-MAX_AUTO);

  const trackedKeys = new Set(tracked.map((t) => t.key));
  const autoNoDup = autoCandidates.filter((a) => !trackedKeys.has(a.key));

  return [...autoNoDup, ...tracked];
}

// WI-499 (host-contract): the literal invocation path (argv[1]) retains the host
// farm dir even though node realpaths import.meta.url through the symlink.
// ~/.codex/... => Codex, which REQUIRES valid JSON from SessionStart hooks.
function isCodexHost() {
  return typeof process.argv[1] === "string" && process.argv[1].replace(/\\/g,"/").includes("/.codex/");
}

function sessionCwd() {
  try {
    const raw = process.stdin.isTTY ? "" : fs.readFileSync(0, "utf8");
    const payload = raw.trim() ? JSON.parse(raw) : {};
    return path.resolve(payload.cwd || payload.working_directory || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  } catch {
    return path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  }
}

// Framework lore belongs in sessions that work on the framework or in a project
// that opted into it (an existing .svc/). A plain user project gets nothing.
function frameworkSession(cwd) {
  let fw = REPO_ROOT;
  try { fw = fs.realpathSync(REPO_ROOT); } catch {}
  let dir = cwd;
  try { dir = fs.realpathSync(cwd); } catch {}
  if (dir === fw || dir.startsWith(fw + path.sep)) return true;
  return hasSvcAncestor(cwd);
}

function formatLearnings(learnings) {
  const lines = ["[FRAMEWORK LEARNINGS — read these before starting]", ""];
  for (const l of learnings) {
    const originSuffix = l._origin ? ` [${l._origin}]` : "";
    lines.push(`[${l.key}] (${l.type}, confidence: ${l.confidence})${originSuffix}`);
    lines.push(`  ${l.insight}`);
    if (l.files && l.files.length > 0) lines.push(`  Files: ${l.files.join(", ")}`);
    lines.push("");
  }
  lines.push("If any learning applies to your current task, follow it. If it prevents a mistake, its confidence can be bumped.");
  return lines.join("\n");
}

// Project standing rules live in the session cwd, not in framework lore.
// A copied hook whose sibling script is absent (fixture isolation) stays quiet.
async function standingRulesText(cwd) {
  const modPath = path.join(REPO_ROOT, "scripts", "standing-rules.mjs");
  try {
    const stat = fs.statSync(modPath);
    if (!stat.isFile()) return "";
    const mod = await import(pathToFileURL(modPath).href);
    const text = mod.printForSession(cwd);
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

async function main() {
  const cwd = sessionCwd();
  const rules = await standingRulesText(cwd);
  const learnings = frameworkSession(cwd) ? loadAllLearnings() : [];
  if (!rules && learnings.length === 0) {
    // Codex rejects empty stdout as invalid JSON; emit an empty object instead.
    if (isCodexHost()) process.stdout.write("{}\n");
    return;
  }

  const learningsText = learnings.length ? formatLearnings(learnings) : "";
  const text = rules && learningsText ? `${rules}\n\n${learningsText}` : (rules || learningsText);

  // Claude accepts plain-text SessionStart stdout as added context; Codex rejects
  // non-JSON. On Codex, wrap in the JSON SessionStart envelope; Claude output stays
  // byte-identical (plain text) when no standing rules are recorded.
  if (isCodexHost()) {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } })}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

main();
