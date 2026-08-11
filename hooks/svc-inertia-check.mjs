#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const { readHookPayload, extractFilePath } = await import(path.join(__dirname, "lib", "hook-payload.mjs"));
const { blockViaExit } = await import(path.join(__dirname, "lib", "hook-decision.mjs"));
const { defaultRegistryPath, formatFindings, loadRegistry, scanText } = await import(
  path.join(repoRoot, "scripts", "lib", "deprecated-foundations.mjs")
);
// WI-487 (F-003/AC-487-7): route the block through the 5-field actionable-denial
// envelope + durable receipt (fall back to plain stderr+exit-2 on older installs).
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "lib", "hook-denial.mjs"))); } catch { /* older install */ }

function disabled() {
  return (process.env.SVC_DISABLED_HOOKS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes("svc-inertia-check");
}

function hasAck(findings) {
  const ack = process.env.SVC_INERTIA_ACK || "";
  if (ack === "1" || ack === "true") return true;
  const allowed = new Set(ack.split(",").map((entry) => entry.trim()).filter(Boolean));
  return findings.every((finding) => allowed.has(finding.id));
}

function extractNewContent(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return "";
  return [
    toolInput.content,
    toolInput.text,
    toolInput.new_string,
    toolInput.newString,
    toolInput.replacement,
    toolInput.patch
  ]
    .filter((value) => typeof value === "string")
    .join("\n");
}

if (disabled()) process.exit(0);

const call = readHookPayload();
if (!call) process.exit(0);

if (!/^(Edit|Write|WriteFile|StrReplaceFile|Update)$/.test(call.toolName)) {
  process.exit(0);
}

const filePath = extractFilePath(call.toolInput) || "<inline>";
const content = extractNewContent(call.toolInput);
if (!content) process.exit(0);

let registry;
try {
  registry = loadRegistry(defaultRegistryPath(repoRoot));
} catch {
  process.exit(0);
}

const findings = scanText({ text: content, filePath, registry });
if (findings.length === 0 || hasAck(findings)) {
  process.exit(0);
}

const inertiaReason = [
  "[svc-inertia-check] BLOCKED: new edit extends a deprecated foundation.",
  "",
  formatFindings(findings),
  "",
  "Before continuing, run design-tech/plan-changeset through references/deprecated-foundations.json, run the first-hit whole-codebase scan with --promote-findings .svc/deprecated-foundation-findings.jsonl, record a migrate-vs-extend decision, and file a follow-up WI if migration is deferred.",
  "Bypass only after that decision is recorded: SVC_INERTIA_ACK=<foundation-id> or SVC_DISABLED_HOOKS=svc-inertia-check."
].join("\n");

if (emitDenial) {
  emitDenial({
    hook_id: "svc-inertia-check",
    reason_code: "SVC-INERTIA-EXTEND",
    cause: `New edit to ${filePath} extends deprecated foundation(s): ${findings.map((f) => f.id).join(", ")}`.slice(0, 1200),
    operation: `Edit/Write of ${filePath}`,
    recovery: "Record a migrate-vs-extend decision against references/deprecated-foundations.json (run the first-hit whole-codebase scan), then bypass with SVC_INERTIA_ACK=<foundation-id> once decided.",
    resolved_command_path: filePath,
    session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
  });
  process.stderr.write(inertiaReason + "\n");
  process.exit(2);
} else {
  blockViaExit(inertiaReason);
}
