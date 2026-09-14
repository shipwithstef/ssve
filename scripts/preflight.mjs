#!/usr/bin/env node
/**
 * preflight.mjs — Shared pre-flight check helper for svc skills (WI-096).
 *
 * Skills call this BEFORE doing any work to validate:
 *   1. Required input files exist + readable
 *   2. Output paths are writable (parent dir exists OR can be created + no
 *      conflicting read-only file at the target)
 *
 * On missing inputs or blocked outputs, exits 1 with a JSON report on stderr.
 * On pass, exits 0 with a confirmation line on stdout.
 *
 * Usage:
 *   node scripts/preflight.mjs '{
 *     "skill": "capture-idea",
 *     "inputs":  ["docs/specs/vision.md", "proposals/foo.md"],
 *     "outputs": ["docs/specs/work-items/WI-100.md"]
 *   }'
 *
 * Or with a config file:
 *   node scripts/preflight.mjs --config .svc/preflight-<skill>.json
 *
 * Hook mode:
 *   node scripts/preflight.mjs --hook              # warn-only
 *   node scripts/preflight.mjs --hook --fail-closed # block declared failures
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — missing inputs or blocked outputs (diagnostic on stderr)
 *   2 — bad arguments / malformed config
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// WI-487 (F-003/AC-487-7): ADDITIVE denial. The fail-closed hook block keeps its
// EXACT prior host-visible JSON report ({skill,status,malformed_config,error,remedy}
// / {status:FAIL,hook_blocking:true,...}) + exit code — validators assert on those
// — and LAYERS the canonical 5-field actionable-denial envelope + a durable receipt
// on top via emitDenial. emitDenial's dedup suppresses only the extra envelope.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "..", "hooks", "lib", "hook-denial.mjs"))); } catch { /* older install */ }
function preflightEnvelope(reasonCode, cause, recovery, target) {
  if (!emitDenial) return;
  emitDenial({
    hook_id: "svc-preflight-skill",
    reason_code: reasonCode,
    cause: String(cause || "").slice(0, 1200),
    operation: target ? `Skill invocation preflight (${target})` : "Skill invocation preflight",
    recovery,
    resolved_command_path: target || reasonCode,
    session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
  });
}

function die(msg, code = 2) {
  process.stderr.write(`preflight: ${msg}\n`);
  process.exit(code);
}

// --------------------------------------------------------------------------
// Parse args
// --------------------------------------------------------------------------
let cfg = null;
let hookMode = false;
let hookFailClosed = false;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--hook") {
    hookMode = true;
  } else if (a === "--fail-closed") {
    hookFailClosed = true;
  } else if (a === "--config") {
    const p = process.argv[++i];
    if (!p) die("--config needs a path");
    try {
      cfg = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      die(`cannot read config ${p}: ${e.message}`);
    }
  } else if (!cfg) {
    try {
      cfg = JSON.parse(a);
    } catch (e) {
      die(`argv[${i}] is not valid JSON: ${e.message}`);
    }
  }
}

// --------------------------------------------------------------------------
// --hook mode (WI-122/WI-185): PreToolUse preflight on Skill tool invocations.
// Reads stdin payload; if tool_name is "Skill" and a co-located preflight
// config exists (.svc/preflight-<skill>.json), runs checks.
// Default is warn-only. With --fail-closed or config.fail_closed=true, a
// declared failing contract blocks the hook while missing contracts still fail
// open so unknown hosts and unmigrated skills are not bricked.
// --------------------------------------------------------------------------
if (hookMode) {
  let payload = "";
  try {
    payload = fs.readFileSync(0, "utf8");
  } catch {}
  let parsed = null;
  try {
    parsed = JSON.parse(payload);
  } catch {
    // No payload or unparsable — fail open
    process.exit(0);
  }
  const toolName = parsed.tool_name || parsed.toolName || "";
  if (toolName !== "Skill") process.exit(0);
  const skillName =
    (parsed.tool_input && (parsed.tool_input.skill || parsed.tool_input.name)) || "";
  if (!skillName) process.exit(0);
  const cfgPath = path.resolve(process.cwd(), `.svc/preflight-${skillName}.json`);
  if (!fs.existsSync(cfgPath)) process.exit(0);
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e) {
    if (hookFailClosed) {
      // Original host-visible report (validators assert on "malformed_config").
      process.stderr.write(
        JSON.stringify(
          {
            skill: skillName,
            status: "FAIL",
            malformed_config: cfgPath,
            error: e.message,
            remedy: "Fix the declared preflight contract before invoking the skill.",
          },
          null,
          2,
        ) + "\n",
      );
      // WI-487: layer the 5-field envelope + durable receipt on top.
      preflightEnvelope(
        "SVC-PREFLIGHT-CONTRACT",
        `preflight contract for skill "${skillName}" is malformed (${cfgPath}): ${e.message}`,
        "Fix the declared preflight contract JSON before invoking the skill.",
        skillName,
      );
      process.exit(2);
    }
    process.exit(0);
  }
  hookFailClosed = hookFailClosed || cfg.fail_closed === true;
  // Fall through to checks. Warn-only hook mode exits 0; fail-closed mode exits
  // 2 on declared missing inputs or blocked outputs.
}

if (!cfg) {
  if (hookMode) process.exit(0);
  die("usage: preflight.mjs '<json>' | --config <path> | --hook (stdin)");
}

const skill = cfg.skill || "(unknown)";
const inputs = Array.isArray(cfg.inputs) ? cfg.inputs : [];
const outputs = Array.isArray(cfg.outputs) ? cfg.outputs : [];

// --------------------------------------------------------------------------
// Check inputs — must exist + be readable
// --------------------------------------------------------------------------
const missingInputs = [];
for (const p of inputs) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
  } catch {
    missingInputs.push(p);
  }
}

// --------------------------------------------------------------------------
// Check outputs — parent dir writable (create if missing), target not a
// read-only conflicting file
// --------------------------------------------------------------------------
const blockedOutputs = [];
for (const p of outputs) {
  const dir = path.dirname(p);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (e) {
    blockedOutputs.push({ path: p, reason: `parent dir not writable: ${e.message}` });
    continue;
  }
  // If target exists, check it's not read-only (W_OK).
  if (fs.existsSync(p)) {
    try {
      fs.accessSync(p, fs.constants.W_OK);
    } catch {
      blockedOutputs.push({ path: p, reason: "target file is read-only" });
    }
  }
}

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------
if (missingInputs.length === 0 && blockedOutputs.length === 0) {
  process.stdout.write(
    `preflight: ${skill} — all ${inputs.length} input(s) + ${outputs.length} output(s) OK\n`,
  );
  process.exit(0);
}

// Original host-visible report — validators assert on "status": "FAIL" /
// "hook_blocking": true / "status": "WARN". Kept EXACTLY as before.
process.stderr.write(
  JSON.stringify(
    {
      skill,
      status: hookMode && !hookFailClosed ? "WARN" : "FAIL",
      hook_blocking: hookMode && hookFailClosed,
      missing_inputs: missingInputs,
      blocked_outputs: blockedOutputs,
      remedy: "Resolve every missing input and blocked output, then re-run the skill. Do NOT proceed with partial state.",
    },
    null,
    2,
  ) + "\n",
);
// WI-487: on a fail-closed hook block, layer the 5-field envelope + receipt on top.
if (hookMode && hookFailClosed) {
  preflightEnvelope(
    "SVC-PREFLIGHT-INPUTS",
    `preflight for skill "${skill}" failed: missing_inputs=${JSON.stringify(missingInputs)}, blocked_outputs=${JSON.stringify(blockedOutputs.map((b) => b.path))}`,
    "Resolve every missing input and blocked output, then re-run the skill. Do NOT proceed with partial state.",
    skill,
  );
}
if (hookMode) process.exit(hookFailClosed ? 2 : 0);
process.exit(1);
