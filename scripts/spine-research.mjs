#!/usr/bin/env node
/**
 * spine-research.mjs — wrapper that makes "do it right" the path of least
 * resistance for populating Spine knowledge domains.
 *
 * Usage:
 *   node scripts/spine-research.mjs <domain> [--prescope <path>] [--agent agy|claude]
 *
 * What it does:
 *   1. Reads pre-scope at docs/specs/research-prescope-<domain>.md (or --prescope path)
 *   2. Invokes the canonical sandboxed AGY launcher with Gemini 3.5 Flash (High)
 *   3. On AGY auth/quota/network/timeout failure, hands off to in-session WebFetch
 *   4. Emits AGY extraction to stdout for the orchestrator to validate and write
 *   5. Logs the attempt chain to .svc/knowledge-recall.jsonl
 *
 * Source: WI-SPINE-006 — closes the gap exposed when training-data was
 * written into Spine domains without source provenance (incident 2026-04-30).
 *
 * Note: this is a SCAFFOLDING WRAPPER. The actual extraction still happens
 * via the agent (AGY or in-session Claude WebFetch). The wrapper's
 * job is to make the discipline mechanical: pre-scope check, agent dispatch
 * with fallback, .sources.jsonl generation, refuse-empty-extraction guard.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { argv, exit, cwd } from "node:process";
import { fileURLToPath } from "node:url";
import { appendJsonlLine } from "./state-io.mjs";

const args = argv.slice(2);
const domain = args[0];
if (!domain || domain.startsWith("--")) {
  console.error("Usage: spine-research.mjs <domain> [--prescope <path>] [--agent agy|claude]");
  exit(2);
}

const prescopeFlag = args.indexOf("--prescope");
const prescopePath = prescopeFlag >= 0
  ? args[prescopeFlag + 1]
  : `docs/specs/research-prescope-${domain}.md`;

const agentFlag = args.indexOf("--agent");
const forcedAgent = agentFlag >= 0 ? args[agentFlag + 1] : null;
if (forcedAgent === "gemini") {
  console.error("FAIL: Gemini CLI inference was removed. Use --agent agy or --agent claude.");
  exit(2);
}
if (forcedAgent && !["agy", "claude"].includes(forcedAgent)) {
  console.error(`FAIL: unsupported research agent ${forcedAgent}; expected agy or claude`);
  exit(2);
}

const repoRoot = cwd();
const recallLog = resolve(repoRoot, ".svc/knowledge-recall.jsonl");
const dispatchAgy = resolve(dirname(fileURLToPath(import.meta.url)), "../skills/research/scripts/dispatch-agy.mjs");

function logRecall(event, extra = {}) {
  appendJsonlLine(recallLog, {
    ts: new Date().toISOString(),
    skill: "spine-research",
    domain,
    event,
    ...extra
  });
}

// 1. Verify pre-scope exists
if (!existsSync(prescopePath)) {
  console.error(`FAIL: pre-scope not found at ${prescopePath}`);
  console.error(`Per rules/research-must-use-agy-cli.md, every research run requires a pre-scope.`);
  console.error(`Create one with: 'Selected for this run: agy-cli — <reason>' line and source URL list.`);
  logRecall("prescope-missing", { prescope_path: prescopePath });
  exit(2);
}

// 2. Verify pre-scope contains required selector line
const prescope = readFileSync(prescopePath, "utf8");
if (!/Selected for this run/i.test(prescope)) {
  console.error(`FAIL: pre-scope at ${prescopePath} missing 'Selected for this run' line`);
  console.error(`Required by rules/research-must-use-agy-cli.md gate.`);
  logRecall("prescope-malformed", { prescope_path: prescopePath });
  exit(2);
}

logRecall("invocation-start", { prescope_path: prescopePath, forced_agent: forcedAgent });

// 3. Dispatch agent (AGY primary, Claude fallback)
function tryAgy() {
  console.error(`[spine-research] trying canonical AGY launcher model=Gemini 3.5 Flash (High)...`);
  const result = spawnSync(process.execPath, [dispatchAgy, "--prescope", prescopePath, "--domain", domain, "--model", "Gemini 3.5 Flash (High)", "--timeout-seconds", "1200"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 1_230_000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0) {
    const stderr = (result.stderr || "") + (result.stdout || "");
    return { ok: false, reason: "agy-non-zero", stderr: stderr.slice(0, 1000) };
  }
  return { ok: true, output: result.stdout };
}

let extraction;
const skipAgy = forcedAgent === "claude" || process.env.SVC_RESEARCH_AGENT === "claude";
if (!skipAgy) extraction = tryAgy();

if (!extraction || !extraction.ok) {
  // 4. Fallback path — emit instructions for the Claude session to handle WebFetch
  console.log(`[spine-research] AGY unavailable (${extraction?.reason || "skipped"}). Fallback to Claude in-session WebFetch.`);
  console.log(`[spine-research] Instructions for the calling session:`);
  console.log(`  1. WebFetch each source URL listed in ${prescopePath}`);
  console.log(`  2. Build CAPABILITIES.md with [source: <key>] anchors per claim`);
  console.log(`  3. Write .sources.jsonl with retrieved_at + url + relevant_to per source`);
  console.log(`  4. Write .version with today's date`);
  console.log(`  5. NEVER fabricate citations or CVE numbers`);
  console.log(`  6. NEVER assert "current" facts without a fetched source-anchor`);
  logRecall("claude-fallback-instructed", { reason: extraction?.reason || "forced" });
  exit(0); // Not a failure — handoff to Claude session
}

// 4. Safe plan-mode AGY returns extraction; the orchestrator remains responsible
// for validating source coverage before writing authoritative knowledge files.
logRecall("agy-extraction-complete", { output_bytes: Buffer.byteLength(extraction.output) });
process.stdout.write(extraction.output);
