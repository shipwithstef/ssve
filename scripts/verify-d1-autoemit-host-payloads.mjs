#!/usr/bin/env node
/**
 * D-1 payload compatibility + latency gate (plan decision point D-1).
 *
 * Proves, per host fixture (Claude PostToolUse / Cursor afterFileEdit /
 * Grok PostToolUse), that a REAL hook invocation — stdin → readHookPayload()
 * → evaluateAutoemitTarget() → main() receipt emission — observes the edited
 * target and emits the phase receipt into an active task graph. Also records
 * the timed no-graph latency measurement the plan's velocity obligation
 * requires. Evidence JSON is written next to this script's caller-declared
 * output path.
 *
 * Usage: node scripts/verify-d1-autoemit-host-payloads.mjs [--out <path>]
 * Exit 0 = all hosts compatible and within latency class; 1 = any failure.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { writeJsonAtomic } from "./state-io.mjs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = join(ROOT, "hooks", "svc-phase-receipt-autoemit.mjs");
const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? resolve(process.argv[outArg + 1]) : join(ROOT, "docs/specs/reviews/wi-ssve-evolution-d1-autoemit-gate.json");

const SKILL_MD = `---
name: d1-probe-skill
description: D-1 fixture skill.
phases:
  - { id: P1-D1Probe, trigger: always, writes: ["out/artifact.md"], evidence_kind: file, required_for_completion: true }
---

Fixture body.
`;

function makeWorkspace() {
  const ws = mkdtempSync(join(tmpdir(), "d1-gate-"));
  mkdirSync(join(ws, ".svc"), { recursive: true });
  mkdirSync(join(ws, "skills", "d1-probe-skill"), { recursive: true });
  mkdirSync(join(ws, "out"), { recursive: writeFileSyncSafe(join(ws, "out")) });
  writeFileSync(join(ws, "skills", "d1-probe-skill", "SKILL.md"), SKILL_MD);
  writeJsonAtomic(
    join(ws, ".svc", "lane-tasks-D1TEST.json"),
    {
      schema_version: 1,
      wi: "WI-D1TEST",
      status: "in_progress",
      tasks: [{
        id: 1,
        status: "in_progress",
        skill: "d1-probe-skill",
        subject: "D-1 probe",
        blocked_by: [],
        skill_receipt: { skill: "d1-probe-skill", loaded_at: new Date().toISOString(), loaded_via: "session", phases_executed: [] },
      }],
    }
  );
  return ws;
}

function writeFileSyncSafe() { /* directory created via recursive mkdir above */ }

// Host fixtures: recorded REAL stdin shapes (plan §E4 step 1). Cursor
// afterFileEdit sends a bare file-path envelope; Grok PostToolUse uses
// tool_name "Shell" for shell events; Claude uses tool_name/tool_input.
const FIXTURES = [
  {
    id: "claude-edit",
    host: "claude",
    event: "PostToolUse",
    expectKind: "file",
    stdin: JSON.stringify({ session_id: "s1", cwd: "<WS>", tool_name: "Edit", tool_input: { file_path: "<WS>/out/artifact.md" } }),
  },
  {
    id: "cursor-afterFileEdit",
    host: "cursor",
    event: "afterFileEdit",
    expectKind: "file",
    stdin: JSON.stringify({ file_path: "<WS>/out/artifact.md" }),
  },
  {
    id: "grok-shell-lowercase",
    host: "grok",
    event: "PostToolUse",
    expectKind: "command",
    stdin: JSON.stringify({ session_id: "s4", cwd: "<WS>", tool_name: "shell", tool_input: { command: "tee <WS>/out/artifact.md < /dev/null" } }),
  },
  {
    id: "grok-shell",
    host: "grok",
    event: "PostToolUse",
    expectKind: "command",
    stdin: JSON.stringify({ session_id: "s3", cwd: "<WS>", tool_name: "Shell", tool_input: { command: "cat docs/note.md > <WS>/out/artifact.md" } }),
  },
];

function runHook(ws, stdin, env) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: stdin.replaceAll("<WS>", ws),
    cwd: ws,
    env: { ...process.env, ...env, SVC_AUTOEMIT_SKILLS_ROOT: ws },
    timeout: 30_000,
    encoding: "utf8",
  });
  return { code: r.status, stderr: (r.stderr || "").slice(0, 400) };
}

function graphPhases(ws) {
  const g = JSON.parse(readFileSync(join(ws, ".svc", "lane-tasks-D1TEST.json"), "utf8"));
  return (g.tasks[0].skill_receipt.phases_executed || []).map((p) => p.id);
}

function latencyP95(ws, hostEnv, runs = 25) {
  const t = [];
  const noop = JSON.stringify({ cwd: ws }); // no tool envelope → fail-open exit 0
  for (let i = 0; i < runs; i += 1) {
    const started = process.hrtime.bigint();
    runHook(ws, noop, hostEnv);
    t.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  t.sort((a, b) => a - b);
  return { p50: Math.round(t[Math.floor(runs / 2)]), p95: Math.round(t[Math.min(runs - 1, Math.floor(runs * 0.95))]), unit: "ms" };
}

const results = [];
let failures = 0;
for (const fx of FIXTURES) {
  const ws = makeWorkspace();
  const before = graphPhases(ws);
  const run = runHook(ws, fx.stdin, {});
  const after = graphPhases(ws);
  const emitted = after.includes("P1-D1Probe") && !before.includes("P1-D1Probe");
  const neverBlocked = run.code === 0;
  const lat = latencyP95(ws);
  const ok = emitted && neverBlocked && lat.p95 < 500;
  if (!ok) failures += 1;
  results.push({
    fixture: fx.id, host: fx.host, event: fx.event, expect_kind: fx.expectKind,
    exit_code: run.code, receipt_emitted: emitted, never_blocked: neverBlocked,
    latency_ms: lat, pass: ok, stderr_excerpt: run.stderr,
  });
  rmSync(ws, { recursive: true, force: true });
}

const report = {
  schema_version: 1,
  gate: "D-1",
  wi: "WI-SSVE-ARCHITECTURE-EVOLUTION-02",
  generated_at: new Date().toISOString(),
  hook: "hooks/svc-phase-receipt-autoemit.mjs",
  verdict: failures === 0 ? "COMPATIBLE" : "INCOMPATIBLE",
  results,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(`D-1 gate verdict: ${report.verdict} — details ${OUT}`);
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.fixture}: emitted=${r.receipt_emitted} exit=${r.exit_code} p95=${r.latency_ms.p95}${r.latency_ms.unit}`);
process.exit(failures === 0 ? 0 : 1);
