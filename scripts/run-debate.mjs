#!/usr/bin/env node
// run-debate.mjs — Multi-Agent Debate (cutting-edge technique #1)
// Runs N lens agents over an artifact, then a moderator synthesizes the debate.
// AP-2 compliant: passes file PATHS to agents (never inline content). Host-aware:
// falls back to sequential review-gate on hosts without subagents.
// Usage: node scripts/run-debate.mjs --artifact <path> [--lens correctness,security,perf]

import { execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "./state-io.mjs";

// Lens names build agent identifiers + file paths — restrict to a safe charset
// so they can never inject shell/path metacharacters (review finding F2).
const LENS_RE = /^[a-z0-9][a-z0-9-]*$/;

const projectDir = process.env.SVC_PROJECT_DIR || ".";

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    if (process.argv[i] === "--lens") args.lenses = (process.argv[i + 1] || "").split(",").filter(Boolean);
    else if (process.argv[i] && process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  return args;
}

function detectHost() {
  try {
    return execSync("bash scripts/detect-host.sh", { encoding: "utf8", cwd: projectDir }).trim();
  } catch {
    return "claude";
  }
}

function runDebate(artifactPath, lenses) {
  const debateId = `debate-${Date.now()}`;
  const debateDir = path.join(projectDir, ".svc", "debates", debateId);
  fs.mkdirSync(debateDir, { recursive: true });

  const host = detectHost();
  const hasSubagents = ["claude", "kimi", "opencode", "mimo-code"].includes(host);
  if (!hasSubagents) {
    // Sequential fallback. CRITICAL (review finding F3): do NOT fabricate `pass`
    // grades — the debate did NOT run, so recording a pass would be a fail-open
    // that signals "reviewed & clean" when nothing was reviewed. Record an honest
    // `not-run` marker and return a non-pass verdict so the caller routes the
    // review elsewhere (real sequential review-gate by a human/orchestrator).
    // No grade is recorded: write-auto-grade only accepts pass|fail, and neither
    // is truthful for "did not run". Recording nothing keeps the audit honest.
    console.error(`Host ${host} lacks subagents — debate NOT run; no grade recorded (no fabricated pass/fail).`);
    return { verdict: "NOT_RUN_NO_SUBAGENTS", reviewed: false, lenses, host,
      note: "Debate did not run on this host. A real review must be performed separately; no grade was recorded." };
  }

  const results = [];
  for (const lens of lenses) {
    if (!LENS_RE.test(lens)) { console.error(`skip invalid lens name: ${lens}`); continue; }
    const agentFile = path.join(projectDir, "agents", `svc-lens-${lens}.md`);
    if (!fs.existsSync(agentFile)) continue;
    // Pass the artifact PATH; the agent reads it via tools:[Read] (AP-2 compliant).
    // execFileSync with an arg array — no shell, so artifactPath/lens cannot inject (F2).
    let out;
    try {
      out = execFileSync("claude", [
        "-p", "--agent", `svc-lens-${lens}`,
        `Read and evaluate the artifact at ${artifactPath}. Output structured findings.`,
        "--output-format", "json",
      ], { encoding: "utf8", timeout: 120000, cwd: projectDir });
    } catch (e) { out = (e.stdout || "").toString(); }
    let parsed;
    try { parsed = JSON.parse(out); } catch { parsed = { raw: out }; }
    results.push({ lens, result: parsed });
    writeJsonAtomic(path.join(debateDir, `agent-${lens}.json`), results[results.length - 1]);
  }

  // Structured transcript (JSON, written via state-io) — moderator reads this path (AP-2).
  const transcriptPath = path.join(debateDir, "transcript.json");
  writeJsonAtomic(transcriptPath, { lenses: results });

  // Moderator reads the transcript PATH, not inline content. execFileSync arg
  // array — no shell interpolation of transcriptPath (F2).
  let modOut;
  try {
    modOut = execFileSync("claude", [
      "-p", "--agent", "debate-moderator",
      `Read and synthesize the debate transcript at ${transcriptPath}`,
      "--output-format", "json",
    ], { encoding: "utf8", timeout: 120000, cwd: projectDir });
  } catch (e) { modOut = (e.stdout || "").toString(); }
  let verdict;
  try { verdict = JSON.parse(modOut); } catch { verdict = { raw: modOut }; }
  writeJsonAtomic(path.join(debateDir, "verdict.json"), verdict);
  return verdict;
}

const args = parseArgs();
if (!args.artifact) {
  console.error("Usage: run-debate.mjs --artifact <path> [--lens correctness,security,perf]");
  process.exit(1);
}
if (!fs.existsSync(path.join(projectDir, args.artifact)) && !fs.existsSync(args.artifact)) {
  console.error(`Artifact not found: ${args.artifact}`);
  process.exit(1);
}
const v = runDebate(args.artifact, args.lenses || ["correctness", "security", "perf"]);
console.log(JSON.stringify(v, null, 2));
