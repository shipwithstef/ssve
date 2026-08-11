#!/usr/bin/env node
// Stop-hook enforcement for WI-197/WI-199 verification anti-patterns.
// Reads host Stop JSON from stdin, extracts the latest assistant text, and
// blocks if closeout language delegates verification or substitutes bundle grep
// for runtime evidence without a nearby V1+ evidence anchor.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, scanText } from "./scan-verification-delegation.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function truthy(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        if (part && typeof part.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content.text === "string") return content.text;
  if (content && typeof content.content === "string") return content.content;
  return "";
}

function assistantTextFromTranscript(file) {
  if (!file || !existsSync(file)) return "";
  const stat = readFileSync(file);
  const text = stat.slice(Math.max(0, stat.length - 512 * 1024)).toString("utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      const role = obj.role || obj?.message?.role || obj.type;
      if (role !== "assistant" && role !== "assistant_message") continue;
      const body = contentToText(obj.content || obj?.message?.content || obj.text);
      if (body.trim()) return body;
    } catch {
      // Ignore malformed transcript lines.
    }
  }
  return "";
}

function latestAssistantText(input) {
  const direct =
    input.last_assistant_message ||
    input.lastAssistantMessage ||
    input.assistant_message ||
    input.assistantMessage ||
    input.response ||
    input.output ||
    contentToText(input.message?.content);
  if (typeof direct === "string" && direct.trim()) return direct;

  return assistantTextFromTranscript(input.transcript_path || input.transcriptPath);
}

function hardFindings(result, config) {
  const hard = new Set(config.config?.hard_block_severities_phase_d ?? ["HIGH"]);
  return (result.findings ?? []).filter((finding) => finding.actionable && hard.has(finding.severity));
}

function snippet(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 140);
}

function scanClass(text, configPath, concern) {
  const config = loadConfig(configPath);
  const result = scanText(text, { config, inputPath: "stop-hook:last-assistant-message" });
  return {
    concern,
    config,
    result,
    hard: hardFindings(result, config),
  };
}

// ---- WI-399 A9: artifact-grounded gating -----------------------------------
// The prose regex is a heuristic over natural language — false-positive prone
// (a closeout DESCRIBING past delegation or quoting AP-31 trips it). The HARD
// gate is therefore keyed to deterministic state: it blocks only when
// (a) an ACTIVE lane-task graph carries a browser-visible risk flag, AND
// (b) no recent runtime-evidence artifact exists under the canonical evidence
//     roots. Otherwise the scan downgrades to an ADVISORY on stderr.
const EVIDENCE_ROOTS = [
  ".svc/visuals",
  "docs/logs/verify-promotion",
  "docs/specs/features/test-evidence",
  "docs/specs/landing",
];

function claimSessionOf(cwd, wi) {
  // tolerate both observed claim schemas (c8 learning)
  try {
    const c = JSON.parse(readFileSync(resolve(cwd, ".svc", "claims", `${wi}.claim.json`), "utf8"));
    return String(c.session || c.session_id || c.claimed_by || "");
  } catch {
    return "";
  }
}

function hasBrowserVisibleActiveWI(cwd, sessionId) {
  // G6 R2-F5: with parallel sessions in one checkout, another session's
  // browser-visible graph must not hard-gate THIS session's closeout. When
  // the payload carries a session id and a graph's WI claim is attributable
  // to a DIFFERENT session, skip that graph; unattributable graphs count
  // (fail-safe toward gating).
  try {
    const svcDir = resolve(cwd, ".svc");
    for (const name of readdirSync(svcDir)) {
      if (!/^lane-tasks-.*\.json$/.test(name) || name.includes(".completed")) continue;
      if (sessionId) {
        const wi = name.replace(/^lane-tasks-/, "").replace(/\.json$/, "");
        const cs = claimSessionOf(cwd, wi);
        if (cs && /^[0-9a-f][0-9a-f-]{30,40}$/i.test(cs) && !cs.includes(String(sessionId))) continue;
      }
      try {
        const g = JSON.parse(readFileSync(resolve(svcDir, name), "utf8"));
        const flags = g?.delivery_graph?.risk_flags || g?.risk_flags || [];
        const lane = String(g?.lane || g?.delivery_graph?.lane || "");
        if (
          flags.includes("browser-visible") ||
          flags.includes("user-facing") ||
          flags.includes("admin-facing") ||
          lane === "brownfield-iter-visual"
        ) {
          return true;
        }
      } catch { /* unparsable graph — skip */ }
    }
  } catch { /* no .svc dir */ }
  return false;
}

function newestMtimeUnder(dir, depthLeft) {
  let newest = 0;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return 0; }
  for (const e of entries) {
    const full = resolve(dir, e.name);
    try {
      if (e.isDirectory()) {
        if (depthLeft > 0) newest = Math.max(newest, newestMtimeUnder(full, depthLeft - 1));
      } else {
        newest = Math.max(newest, statSync(full).mtimeMs);
      }
    } catch { /* races are fine */ }
  }
  return newest;
}

function recentEvidenceArtifact(cwd) {
  const maxAgeH = Number.parseFloat(process.env.SVC_VERIFICATION_EVIDENCE_MAX_AGE_H || "6");
  const cutoff = Date.now() - maxAgeH * 3600 * 1000;
  for (const root of EVIDENCE_ROOTS) {
    if (newestMtimeUnder(resolve(cwd, root), 3) > cutoff) return true;
  }
  // per-skill in-app-verification dirs (canonical visual-evidence path)
  try {
    const specsDir = resolve(cwd, "docs/specs");
    for (const e of readdirSync(specsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const cand = resolve(specsDir, e.name, "in-app-verification");
      if (newestMtimeUnder(cand, 2) > cutoff) return true;
    }
  } catch { /* no docs/specs */ }
  return false;
}

function emitAdvisory(matches, why) {
  const heads = matches.map((m) => m.concern).join(", ");
  process.stderr.write(
    `SVC VERIFICATION GUARD (advisory — ${why}): closeout language matched ${heads}. ` +
    `Confirm runtime evidence is cited for behavioral claims (AP-31 / V-ladder); the hard gate ` +
    `is artifact-keyed (WI-399 A9), so this is informational.\n`,
  );
}

function emitBlock(matches) {
  const lines = [
    "SVC VERIFICATION GUARD: closeout blocked by AP-31 / V-ladder enforcement.",
    "",
    "The latest assistant message contains verification closeout language that lacks nearby V1+ runtime evidence.",
    "Do not delegate behavioral verification to the user and do not substitute bundle grep for live DOM, screenshot, Playwright, or equivalent evidence.",
    "",
    "Matched concerns:",
  ];

  for (const match of matches) {
    const wi = match.concern === "bundle-grep-substitution" ? "WI-199" : "WI-197";
    for (const finding of match.hard.slice(0, 3)) {
      lines.push(`- ${wi}/${match.concern}/${finding.pattern}: "${snippet(finding.match)}"`);
    }
  }

  lines.push("");
  lines.push("Correction: capture and cite V1/V2/V3 evidence, or document a legitimate V2 exhaustion log before any V3 handoff.");
  console.log(JSON.stringify({ decision: "block", reason: lines.join("\n") }));
}

function main() {
  const raw = readStdin();
  let input = {};
  try {
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }

  if (truthy(input.stop_hook_active) || truthy(input.is_subagent) || truthy(input?.metadata?.is_subagent)) {
    process.exit(0);
  }

  const text = latestAssistantText(input);
  if (!text.trim()) process.exit(0);

  const scans = [
    scanClass(text, undefined, "verification-delegation"),
    scanClass(text, resolve(repoRoot, "references/bundle-grep-substitution-patterns.json"), "bundle-grep-substitution"),
  ];
  const blocking = scans.filter((scan) => scan.hard.length > 0);
  if (blocking.length === 0) process.exit(0);

  // WI-399 A9: artifact-grounded gating (see above).
  const cwd = process.cwd();
  const sessionId = input.session_id || input.sessionId || "";
  if (!hasBrowserVisibleActiveWI(cwd, sessionId)) {
    emitAdvisory(blocking, "no browser-visible WI active");
    process.exit(0);
  }
  if (recentEvidenceArtifact(cwd)) {
    emitAdvisory(blocking, "recent runtime-evidence artifact present");
    process.exit(0);
  }
  emitBlock(blocking);
}

try {
  main();
} catch (error) {
  console.error(`svc verification guard: ${error.message}`);
  process.exit(2);
}
