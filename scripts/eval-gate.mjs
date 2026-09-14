#!/usr/bin/env node

/**
 * eval-gate.mjs — Two-mode eval matrix gate for svc hooks
 *
 * Fires on TaskUpdate via PreToolUse (gate) and PostToolUse (reminder).
 *
 * Usage:
 *   node scripts/eval-gate.mjs pre  "$TOOL_INPUT"   # PreToolUse  — blocks completion when matrix has nulls
 *   node scripts/eval-gate.mjs post "$TOOL_INPUT"   # PostToolUse — injects matrix reminder at task start
 *
 * Quality modes (SVC_EVAL_MODE env var):
 *   structural (default) — checks presence + prefix format + evidence ref
 *   ai                   — structural first, then claude -p quality check
 *   none                 — null-check only (presence gate, no structure)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readJsonAtomic, writeJsonAtomic } from "./state-io.mjs";
import { WI_ID_BODY } from "../hooks/lib/wi-id.mjs";

// WI-487 (F-003/AC-487-7): the Stop/TaskUpdate block emits {decision:"block"} on
// stdout (the host contract) AND the canonical 5-field actionable-denial envelope
// + a durable receipt on stderr via emitDenial. Assigned in the entry section
// (below) before any handler runs; null on an older install.
let emitDenial = null;

const GRAPH_PATH = ".svc/lane-tasks.json";
const EVAL_MODE = process.env.SVC_EVAL_MODE ?? "structural";

// 8-pillar default matrix template for diagnose-bug tasks
const DIAGNOSE_BUG_MATRIX = [
  { id: "p1-product-fit", label: "Product fit — does bug reveal feature should work differently?",    value: null },
  { id: "p2-journey",     label: "Journey — does fix break or change a documented user flow?",        value: null },
  { id: "p3-ac",          label: "Acceptance criteria — which AC would have caught this?",            value: null },
  { id: "p4-ux",          label: "UX — does fix change what user sees, clicks, or reads?",           value: null },
  { id: "p5-ui",          label: "UI — visual layout, components, tokens, any change?",              value: null },
  { id: "p6-tech",        label: "Tech architecture — does fix change code structure or data flow?", value: null },
  { id: "p7-cost",        label: "Cost model — does fix change compute/storage/API usage?",          value: null },
  { id: "p8-ops",         label: "Operations — monitoring, alerts, runbook, SLA impact?",            value: null },
];

const VALID_PREFIXES = ["UPDATED", "UNCHANGED \u2014 VERIFIED", "N/A \u2014"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readGraph() {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try {
    return readJsonAtomic(GRAPH_PATH);
  } catch {
    return null;
  }
}

function writeGraph(graph) {
  writeJsonAtomic(GRAPH_PATH, graph);
}

function findTask(graph, taskId) {
  if (!graph?.tasks) return null;
  // Accept both integer and string IDs defensively
  return graph.tasks.find((t) => t.id === taskId || String(t.id) === String(taskId)) ?? null;
}

function structuralCheck(item) {
  const val = item.value;
  if (!val || val.trim() === "") return `${item.id}: value is null or empty`;

  const prefix = VALID_PREFIXES.find((p) => val.startsWith(p));
  if (!prefix) {
    return `${item.id}: must start with one of: UPDATED | UNCHANGED \u2014 VERIFIED | N/A \u2014`;
  }

  if (prefix === "UNCHANGED \u2014 VERIFIED") {
    // Must contain a file path reference (e.g. docs/specs/foo.md, src/foo.ts:42)
    const hasRef = /[\w/-]+\.\w+/.test(val.slice(prefix.length)) || /:\d+/.test(val);
    if (!hasRef) {
      return `${item.id}: UNCHANGED \u2014 VERIFIED must include a file path or line reference (e.g. docs/specs/auth.md:45)`;
    }
  }

  if (prefix === "UPDATED") {
    // Must reference a follow-up WI
    if (!new RegExp(WI_ID_BODY).test(val)) {
      return `${item.id}: UPDATED must reference a follow-up work item (e.g. UPDATED \u2014 WI-014)`;
    }
  }

  if (prefix === "N/A \u2014") {
    const reason = val.slice("N/A \u2014".length).trim();
    if (reason.length < 15) {
      return `${item.id}: N/A reason must be specific (>15 chars, not just "not applicable")`;
    }
  }

  return null;
}

function block(reason) {
  // 5-field actionable-denial envelope + durable receipt (stderr), then the
  // {decision:"block"} the Stop/PreToolUse host consumes (stdout), then exit 0
  // (the {decision:"block"} contract; exit 2 would discard the stdout decision).
  if (emitDenial) {
    emitDenial({
      hook_id: "svc-eval-gate",
      reason_code: "SVC-EVAL-GATE-BLOCK",
      cause: String(reason || "").slice(0, 1200),
      operation: "TaskUpdate(status=completed) with an incomplete/invalid eval matrix",
      recovery: "Fill every eval_matrix pillar with a valid UPDATED / UNCHANGED — VERIFIED — <file:line> / N/A — <reason> value, then retry the completion.",
      resolved_command_path: "svc-eval-gate:eval-matrix",
      session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
    });
  }
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pre mode — gate TaskUpdate(completed)
// ---------------------------------------------------------------------------

function handlePre(payload) {
  const input = payload.tool_input ?? {};

  // Only gate on completed transitions
  if (input.status !== "completed") process.exit(0);

  const graph = readGraph();
  if (!graph) process.exit(0);

  const taskId = input.id ?? input.taskId;
  const task = findTask(graph, taskId);
  if (!task?.eval_matrix?.length) process.exit(0);

  // 1. Null check
  if (EVAL_MODE === "none") {
    const nullItems = task.eval_matrix.filter((i) => i.value === null || i.value === undefined || i.value === "");
    if (nullItems.length > 0) {
      block(
        `Eval matrix incomplete: ${nullItems.length} of ${task.eval_matrix.length} pillars not assessed.\n\n` +
          nullItems.map((i) => `  \u2b1c ${i.id}: ${i.label}`).join("\n") +
          `\n\nFor each unfilled pillar set one of:\n` +
          `  UPDATED \u2014 WI-NNN\n` +
          `  UNCHANGED \u2014 VERIFIED \u2014 <file:line>\n` +
          `  N/A \u2014 <specific reason (>15 chars)>`
      );
    }
    process.exit(0);
  }

  // 2. Structural check
  const nullItems = task.eval_matrix.filter((i) => !i.value);
  if (nullItems.length > 0) {
    block(
      `Eval matrix incomplete: ${nullItems.length} of ${task.eval_matrix.length} pillars not assessed.\n\n` +
        nullItems.map((i) => `  \u2b1c ${i.id}: ${i.label}`).join("\n") +
        `\n\nFor each unfilled pillar set one of:\n` +
        `  UPDATED \u2014 WI-NNN\n` +
        `  UNCHANGED \u2014 VERIFIED \u2014 <file:line>\n` +
        `  N/A \u2014 <specific reason (>15 chars)>`
    );
  }

  const issues = task.eval_matrix.map(structuralCheck).filter(Boolean);
  if (issues.length > 0) {
    block(
      `Eval matrix structural issues (${issues.length}):\n\n` +
        issues.map((i) => `  \u26a0 ${i}`).join("\n") +
        `\n\nFix each entry and retry.`
    );
  }

  // 3. AI quality check via claude -p (opt-in, SVC_EVAL_MODE=ai)
  if (EVAL_MODE === "ai") {
    const matrixText = task.eval_matrix
      .map((i) => `${i.id}: ${i.value}`)
      .join("\n");

    const prompt =
      `You are an svc eval gate. A diagnose-bug task is being completed.\n` +
      `Here is its 8-pillar eval matrix:\n\n${matrixText}\n\n` +
      `For each UNCHANGED \u2014 VERIFIED entry: is there a real file path or line number (not a generic claim)?\n` +
      `For each UPDATED entry: is there a WI-NNN reference?\n` +
      `For each N/A entry: is the reason specific (not just "not applicable")?\n\n` +
      `Reply with exactly: PASS or FAIL, then one sentence listing any specific issues.`;

    try {
      const result = execSync(
        `echo ${JSON.stringify(prompt)} | claude -p -`,
        { encoding: "utf8", timeout: 20000 }
      ).trim();

      if (result.startsWith("FAIL")) {
        block(
          `Eval matrix quality check failed (claude -p):\n${result}\n\n` +
            `Revise the flagged pillars to include concrete evidence, then retry.`
        );
      }
    } catch {
      // claude -p unavailable or timed out — structural check passed, allow through
    }
  }

  process.exit(0);
}

// ---------------------------------------------------------------------------
// Post mode — inject matrix reminder on TaskUpdate(in_progress)
// ---------------------------------------------------------------------------

function handlePost(payload) {
  const input = payload.tool_input ?? {};

  // Only inject for in_progress transitions
  if (input.status !== "in_progress") process.exit(0);

  const graph = readGraph();
  if (!graph) process.exit(0);

  const taskId = input.id ?? input.taskId;
  let task = findTask(graph, taskId);
  if (!task) process.exit(0);

  // Auto-initialize eval_matrix for diagnose-bug tasks that don't have one yet
  if (!task.eval_matrix && task.metadata?.skill === "diagnose-bug") {
    task.eval_matrix = DIAGNOSE_BUG_MATRIX.map((p) => ({ ...p }));
    const idx = graph.tasks.findIndex((t) => t.id === task.id);
    graph.tasks[idx] = task;
    try {
      writeGraph(graph);
    } catch {
      // Write failed — continue with reminder anyway
    }
  }

  if (!task.eval_matrix?.length) process.exit(0);

  const filled = task.eval_matrix.filter((i) => i.value !== null && i.value !== undefined && i.value !== "").length;
  const total = task.eval_matrix.length;

  const statusIcon = (item) => (item.value ? "\u2705" : "\u2b1c");
  const valuePreview = (item) =>
    item.value ? ` \u2192 ${item.value.substring(0, 55)}${item.value.length > 55 ? "\u2026" : ""}` : "";

  const reminder = [
    `\u{1f9fe} Eval matrix for task ${task.id} (${task.metadata?.skill ?? "unknown"}) — ${filled}/${total} filled`,
    `Update .svc/lane-tasks.json as you assess each pillar during Step 4.4:`,
    ``,
    ...task.eval_matrix.map((i) => `  ${statusIcon(i)} ${i.id}: ${i.label}${valuePreview(i)}`),
    ``,
    `Valid values:`,
    `  UPDATED \u2014 WI-NNN                         (pillar affected, follow-up WI filed)`,
    `  UNCHANGED \u2014 VERIFIED \u2014 <file:line>   (opened artifact, confirmed no change)`,
    `  N/A \u2014 <specific reason>                  (genuinely not applicable, reason >15 chars)`,
    ``,
    `PreToolUse gate will block TaskUpdate(completed) until all ${total} pillars have values.`,
    EVAL_MODE === "ai" ? `AI quality check active (SVC_EVAL_MODE=ai) — claude -p will verify evidence is substantive.` : `Structural mode active (SVC_EVAL_MODE=${EVAL_MODE}) — prefix + evidence ref enforced.`,
  ].join("\n");

  process.stdout.write(reminder + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const mode = process.argv[2];
if (mode !== "pre" && mode !== "post") {
  process.stderr.write(`Usage: node scripts/eval-gate.mjs <pre|post>\n`);
  process.exit(1);
}

// Unified host-agnostic payload extraction via the shared lib.
const __scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const { readHookPayload } = await import(
  path.resolve(__scriptsDir, "..", "hooks", "lib", "hook-payload.mjs")
);
// WI-487: resolve the actionable-denial emitter (before any handler runs).
try {
  ({ emitDenial } = await import(path.resolve(__scriptsDir, "..", "hooks", "lib", "hook-denial.mjs")));
} catch { /* older install — block() falls back to the {decision:block} stdout only */ }
const call = readHookPayload();
// Fail open on ambiguous input — blocking would be a regression.
if (!call) process.exit(0);
const payload = call.raw;

// Only handle TaskUpdate
if (payload.tool_name !== "TaskUpdate") process.exit(0);

if (mode === "pre") {
  handlePre(payload);
} else {
  handlePost(payload);
}
