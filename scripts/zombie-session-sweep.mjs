#!/usr/bin/env node
// SessionStart sweeper — zombie-session detector (WI-393 AC(c)).
//
// Lives under scripts/ (not hooks/) and is wired as a SessionStart command by
// scripts/wire-hooks.mjs. Placed here rather than hooks/svc-* because the
// config-protection guard treats the hooks/svc-* glob as a protected hot path;
// the behavior is identical — it runs as a SessionStart hook command.
//
// Problem (Claude Code Insights 2026-05-08..06-07): whole sessions were lost to
// repeated 500-output-token-maximum / API-context / rate-limit errors —
// "several full sessions contained only repeated errors with zero actual
// interaction, producing no work at all." Those zombie sessions are invisible
// after the fact; nothing surfaces them as a learning signal.
//
// This sweeper scans PRIOR session transcripts at session start, flags any
// whose assistant turns are ALL output-limit/API/rate-limit errors with zero
// tool-use (i.e. zero work product), and emits a structured learning-candidate
// row to .svc/zombie-session-candidates.jsonl. It NEVER blocks and NEVER writes
// to the learnings store directly — it only surfaces a candidate for human /
// manage-learnings review (AC: "emits a structured learning-candidate row,
// never blocks").
//
// Honest scope: a hook cannot hard-cap model output length; it only detects the
// failure pattern after it has happened and makes it visible so the operator
// stops re-dispatching into the same death spiral.
//
// Transcript discovery (in priority order):
//   1. SVC_TRANSCRIPT_DIR            — explicit dir (hermetic validator fixtures)
//   2. payload.transcript_path       — sibling .jsonl files in its directory
//      (Claude SessionStart payload carries the current transcript path)
// Memo: .svc/zombie-session-candidates.jsonl is append-only and self-dedupes by
// transcript basename so re-runs across sessions never double-emit.
// Fail-open: ANY error → exit 0 with no output (never blocks session start).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendJsonlLine } from "./state-io.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Output-limit / API / rate-limit error signatures. Deterministic substring +
// anchored regex set — no wall-clock, no randomness. Matched case-insensitively
// against assistant-turn text and against host error records.
const ERROR_SIGNATURES = [
  /output (?:token )?(?:limit|maximum)/i,
  /max(?:imum)?[ _-]?output[ _-]?tokens?/i,
  /500[ _-]?output[ _-]?token/i,
  /prompt is too long/i,
  /context (?:window )?(?:length )?exceeded/i,
  /rate[ _-]?limit/i,
  /\b429\b/,
  /overloaded_error/i,
  /api error/i,
];

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

function readStdin() {
  try {
    if (process.stdin.isTTY) return "";
    return readFileSync(0, "utf8");
  } catch { return ""; }
}

// Pull plain text out of one transcript record across the shapes Claude /
// Kimi / Codex emit (string content, content-block arrays, message wrappers).
function textFromRecord(rec) {
  if (!rec || typeof rec !== "object") return "";
  const parts = [];
  const msg = rec.message || rec;
  const content = msg.content ?? msg.text ?? "";
  if (typeof content === "string") parts.push(content);
  else if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block === "string") parts.push(block);
      else if (block && typeof block === "object") {
        if (typeof block.text === "string") parts.push(block.text);
        if (typeof block.content === "string") parts.push(block.content);
      }
    }
  }
  // Host-level error envelopes ride alongside the message on some hosts.
  if (typeof rec.error === "string") parts.push(rec.error);
  else if (rec.error && typeof rec.error === "object") {
    if (typeof rec.error.message === "string") parts.push(rec.error.message);
    if (typeof rec.error.type === "string") parts.push(rec.error.type);
  }
  return parts.join("\n");
}

function roleOf(rec) {
  const msg = (rec && (rec.message || rec)) || {};
  return rec.type || rec.role || msg.role || msg.type || "";
}

function isAssistant(rec) {
  return /assistant/i.test(roleOf(rec));
}

// Does this record represent a real tool use (= work product)? Any tool_use
// content block, or a tool_result, or a host tool-call record disqualifies the
// transcript from being a zombie.
function hasToolUse(rec) {
  if (!rec || typeof rec !== "object") return false;
  const t = `${rec.type || ""} ${roleOf(rec)}`.toLowerCase();
  if (t.includes("tool_use") || t.includes("tool_result") || t.includes("tool-call")) return true;
  const msg = rec.message || rec;
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      const bt = block && typeof block === "object" ? String(block.type || "").toLowerCase() : "";
      if (bt === "tool_use" || bt === "tool_result") return true;
    }
  }
  return false;
}

function looksLikeErrorText(text) {
  if (!text) return false;
  return ERROR_SIGNATURES.some((re) => re.test(text));
}

// Classify one transcript file. Returns { zombie, assistantTurns, errorTurns }.
// Zombie ⇔ there is at least one assistant turn, NO tool use anywhere, and
// EVERY assistant turn is an output-limit/API/rate-limit error (zero work).
function classifyTranscript(file) {
  let raw = "";
  try { raw = readFileSync(file, "utf8"); } catch { return null; }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return null;

  let assistantTurns = 0;
  let errorTurns = 0;
  let toolUse = false;

  for (const line of lines) {
    const rec = safeJson(line);
    if (!rec) continue;
    if (hasToolUse(rec)) { toolUse = true; }
    if (isAssistant(rec)) {
      assistantTurns += 1;
      if (looksLikeErrorText(textFromRecord(rec))) errorTurns += 1;
    }
  }

  const zombie = assistantTurns > 0 && !toolUse && errorTurns === assistantTurns;
  return { zombie, assistantTurns, errorTurns, toolUse };
}

function discoverTranscriptDir(payload) {
  const explicit = process.env.SVC_TRANSCRIPT_DIR;
  if (explicit && existsSync(explicit)) return explicit;
  const tp = payload && (payload.transcript_path || payload.transcriptPath);
  if (typeof tp === "string" && tp) {
    const dir = path.dirname(tp);
    if (existsSync(dir)) return dir;
  }
  return null;
}

// Already-recorded transcript basenames, so re-runs never double-emit.
function alreadyRecorded(candPath) {
  const seen = new Set();
  try {
    if (!existsSync(candPath)) return seen;
    for (const line of readFileSync(candPath, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const rec = safeJson(line);
      if (rec && rec.transcript) seen.add(rec.transcript);
    }
  } catch { /* fail-open */ }
  return seen;
}

function main() {
  const stdin = readStdin();
  const payload = safeJson(stdin) || {};
  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const dir = discoverTranscriptDir(payload);
  if (!dir) return;

  // Do not classify the live transcript for the session that is just starting.
  const liveTp = payload.transcript_path || payload.transcriptPath || "";
  const liveBase = liveTp ? path.basename(liveTp) : "";

  let files = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .filter((f) => f !== liveBase)
      .map((f) => path.join(dir, f));
  } catch { return; }
  if (files.length === 0) return;

  const candPath = path.join(cwd, ".svc", "zombie-session-candidates.jsonl");
  const seen = alreadyRecorded(candPath);

  const flagged = [];
  for (const file of files) {
    const base = path.basename(file);
    if (seen.has(base)) continue;
    let info;
    try { info = classifyTranscript(file); } catch { continue; }
    if (!info || !info.zombie) continue;

    let sizeBytes = 0;
    try { sizeBytes = statSync(file).size; } catch { /* best-effort */ }

    // Structured learning-candidate row. Schema mirrors framework-learnings
    // fields (date/type/key/insight/confidence/source/files) plus the evidence
    // that makes it actionable. source pins the detector.
    const row = {
      date: new Date().toISOString().slice(0, 10),
      type: "learning-candidate",
      category: "session-survival",
      key: "zombie-session-output-limit-death-spiral",
      transcript: base,
      transcript_path: file,
      assistant_turns: info.assistantTurns,
      error_turns: info.errorTurns,
      size_bytes: sizeBytes,
      insight:
        "A prior session produced ZERO work product: every assistant turn was an " +
        "output-limit/API/rate-limit error with no tool use. Re-dispatching into " +
        "the same conditions repeats the death spiral. Apply file-first output " +
        "discipline (rules/long-output-to-file.md) and bounded retries before " +
        "re-running this workload.",
      confidence: 6,
      source: "svc-zombie-session-sweep",
      blocking: false,
    };
    try { appendJsonlLine(candPath, row); flagged.push(row); }
    catch { /* fail-open: surfacing is best-effort, never blocks */ }
  }

  if (flagged.length === 0) return;

  // Surface to the operator two ways: stderr (always visible in hook logs) and
  // SessionStart additionalContext (injected into the new session so the agent
  // knows the prior session died and why).
  process.stderr.write(
    `[svc-zombie-session-sweep] flagged ${flagged.length} zombie session(s) ` +
    `(all-error, zero work) → ${path.relative(cwd, candPath)}\n`
  );
  const ctx =
    `[svc-zombie-session-sweep] ${flagged.length} prior session(s) died in an ` +
    `output-limit/API-error loop with zero work product. Before re-running that ` +
    `workload, apply file-first output discipline (rules/long-output-to-file.md). ` +
    `Candidates: ${flagged.map((f) => f.transcript).join(", ")}`;
  const out = {
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx.slice(0, 10000) },
  };
  process.stdout.write(JSON.stringify(out));
}

try {
  main();
} catch {
  // Fail-open is the contract — a broken transcript or unreadable dir must
  // never block session start. Silent exit 0.
}
process.exit(0);
