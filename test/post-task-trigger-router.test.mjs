#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { route } from "../scripts/lib/post-task-trigger-router.mjs";

let pass = 0, fail = 0;
function ok(name, condition, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdkg-router-"));
const registryPath = path.join(tmp, "sdkg-registry.json");
fs.writeFileSync(registryPath, JSON.stringify({
  version: 1,
  instances: {
    "competitor-analysis": {
      schema: "x.json",
      trigger_keywords: ["earn", "redeem", "verify", "enroll", "loyalty", "points"],
      monitor_triggers_path: ".svc/competitive-monitor-triggers.jsonl",
    },
    "other-instance": {
      schema: "y.json",
      trigger_keywords: ["security", "vuln"],
      monitor_triggers_path: ".svc/other-monitor-triggers.jsonl",
    },
  },
}));

// Test 1: keyword match → dispatch
{
  const result = route({ taskId: "T1", subject: "implement loyalty earning flow", repoRoot: tmp, registryPath });
  ok("keyword match → dispatched", result.dispatched.length === 1 && result.dispatched[0].instance === "competitor-analysis");
  ok("matched keywords surfaced in event", result.dispatched[0].event.matched_keywords.includes("loyalty"));
}

// Test 2: no keyword → skipped
{
  const result = route({ taskId: "T2", subject: "update css colors", repoRoot: tmp, registryPath });
  ok("no keyword → skipped", result.dispatched.length === 0 && result.skipped.length === 2);
}

// Test 3: multi-instance dispatch
{
  const result = route({ taskId: "T3", subject: "fix loyalty security vuln", repoRoot: tmp, registryPath });
  ok("multi-instance match → both dispatched", result.dispatched.length === 2);
}

// Test 4: DEDUPE per RP-006 — same Stop event twice → exactly ONE entry
{
  const subject = "add redeem points endpoint";
  const taskId = "T4-dedupe";
  // first call
  const r1 = route({ taskId, subject, repoRoot: tmp, registryPath });
  // second call — identical
  const r2 = route({ taskId, subject, repoRoot: tmp, registryPath });
  ok("first call dispatched", r1.dispatched.length === 1);
  ok("second call dedupe-skipped", r2.dispatched.length === 0 && r2.skipped.some((s) => s.reason === "duplicate"),
     `r2.skipped=${JSON.stringify(r2.skipped)}`);

  const jsonl = fs.readFileSync(path.join(tmp, ".svc/competitive-monitor-triggers.jsonl"), "utf8");
  const lines = jsonl.split("\n").filter(Boolean);
  const t4Lines = lines.filter((l) => JSON.parse(l).task_id === taskId);
  ok("idempotency: jsonl has exactly ONE entry for repeated event", t4Lines.length === 1, `got ${t4Lines.length}`);
}

// Test 5: different task_id → NOT deduped
{
  const subject = "add new earn flow";
  const r1 = route({ taskId: "T5a", subject, repoRoot: tmp, registryPath });
  const r2 = route({ taskId: "T5b", subject, repoRoot: tmp, registryPath });
  ok("different task_id → both dispatched", r1.dispatched.length === 1 && r2.dispatched.length === 1);
}

// Test 6: missing registry → graceful (no-op, no throw)
{
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "sdkg-no-reg-"));
  const result = route({ taskId: "T6", subject: "loyalty thing", repoRoot: tmp2, registryPath: path.join(tmp2, "missing.json") });
  ok("missing registry → no-op", result.dispatched.length === 0 && result.reason === "no-registry");
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
