#!/usr/bin/env node
/**
 * svc Scenario Runner — deterministic framework enforcement test
 *
 * Usage:
 *   node scripts/scenario-runner.mjs [scenario-name] [iterations=10]
 *
 * Creates a temp workspace, runs a tiny multi-skill workflow,
 * and verifies that framework enforcement is deterministic.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { appendJsonlLine, readJsonAtomic, writeJsonAtomic } from "./state-io.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = path.resolve(__dirname, "..");

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function log(label, msg, ok = true) {
  const icon = ok ? "✓" : "✗";
  console.log(`  [${label}] ${msg} ${icon}`);
}

function run(cmd, cwd, env = {}) {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return {
      code: e.status || 1,
      stdout: e.stdout?.toString() || "",
      stderr: e.stderr?.toString() || e.message,
    };
  }
}

function hashFile(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 16);
}

function hashWorkspace(ws) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  }
  walk(ws);
  files.sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(path.relative(ws, f));
    h.update(fs.readFileSync(f));
  }
  return h.digest("hex").slice(0, 16);
}

function copyFrameworkFiles(ws) {
  const scriptsDir = path.join(ws, "scripts");
  const hooksDir = path.join(ws, "hooks");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.mkdirSync(path.join(ws, ".svc"), { recursive: true });

  fs.copyFileSync(
    path.join(FRAMEWORK_ROOT, "scripts", "task-graph.mjs"),
    path.join(scriptsDir, "task-graph.mjs")
  );
  fs.copyFileSync(
    path.join(FRAMEWORK_ROOT, "scripts", "state-io.mjs"),
    path.join(scriptsDir, "state-io.mjs")
  );
  fs.copyFileSync(
    path.join(FRAMEWORK_ROOT, "hooks", "svc-lane-tasks-validator.mjs"),
    path.join(hooksDir, "svc-lane-tasks-validator.mjs")
  );
  fs.copyFileSync(
    path.join(FRAMEWORK_ROOT, "hooks", "svc-task-completion-guard.sh"),
    path.join(hooksDir, "svc-task-completion-guard.sh")
  );
}

function initLaneTasks(ws, scenario) {
  const ltPath = path.join(ws, ".svc", "lane-tasks-test.json");
  const graph = {
    wi: "TEST-SCENARIO",
    lane: scenario.lane,
    created: new Date().toISOString(),
    status: "pending",
    tasks: JSON.parse(JSON.stringify(scenario.tasks)),
  };
  writeJsonAtomic(ltPath, graph);
  return ltPath;
}

function readLaneTasks(ws) {
  return readJsonAtomic(path.join(ws, ".svc", "lane-tasks-test.json"));
}

function writeLaneTasks(ws, graph) {
  writeJsonAtomic(path.join(ws, ".svc", "lane-tasks-test.json"), graph);
}

function runLaneTasksValidator(ws, fileName = ".svc/lane-tasks-test.json") {
  const payload = JSON.stringify({ file_path: path.join(ws, fileName) });
  const validator = path.join(ws, "hooks", "svc-lane-tasks-validator.mjs");
  return run(`node ${validator} '${payload}'`, ws);
}

function runStopHook(ws, sessionId = "test-session") {
  const hook = path.join(ws, "hooks", "svc-task-completion-guard.sh");
  const stdin = JSON.stringify({ session_id: sessionId });
  return run(`echo '${stdin}' | bash ${hook}`, ws);
}

function runTaskGraph(ws, ...args) {
  return run(`node scripts/task-graph.mjs ${args.join(" ")}`, ws);
}

function addDecisionLog(ws, wi) {
  const logPath = path.join(ws, ".svc", "pipeline-decisions.jsonl");
  const entry = {
    timestamp: new Date().toISOString(),
    run_id: wi,
    skill: "route-workflow",
    decision: "proceed",
    reasoning: "test scenario",
  };
  appendJsonlLine(logPath, entry);
}

// -------------------------------------------------------------------
// Phase A — Compliant Agent
// -------------------------------------------------------------------

function runCompliant(ws, scenario) {
  const ltPath = path.join(ws, ".svc", "lane-tasks-test.json");
  const results = [];

  for (const task of scenario.tasks) {
    // 1. Load skill
    const loadRes = runTaskGraph(ws, "load-skill", ltPath, String(task.id), task.skill);
    results.push({ step: `load-skill ${task.skill}`, ...loadRes });

    // 2. Do work
    try {
      scenario.workBySkill[task.skill](ws);
      results.push({ step: `work ${task.skill}`, code: 0, stdout: "", stderr: "" });
    } catch (e) {
      results.push({ step: `work ${task.skill}`, code: 1, stdout: "", stderr: e.message });
    }

    // 3. Mark complete
    const statusRes = runTaskGraph(ws, "set-status", ltPath, String(task.id), "completed");
    results.push({ step: `set-status ${task.id} completed`, ...statusRes });
  }

  // Decision log so stop hook doesn't block on missing_decision
  addDecisionLog(ws, "TEST-SCENARIO");

  // 4. Stop hook should allow
  const stopRes = runStopHook(ws, `compliant-${Date.now()}`);
  results.push({ step: "stop-hook", ...stopRes });

  return results;
}

// -------------------------------------------------------------------
// Phase B — Non-Compliant Agent (each bypass caught)
// -------------------------------------------------------------------

function runNonCompliant(ws, scenario) {
  const ltPath = path.join(ws, ".svc", "lane-tasks-test.json");
  const results = [];

  // Reset to fresh state
  const fresh = JSON.parse(JSON.stringify(scenario.tasks));
  writeLaneTasks(ws, { wi: "TEST-SCENARIO", lane: scenario.lane, created: new Date().toISOString(), status: "pending", tasks: fresh });

  // 1. Bypass load-skill: try set-status without receipt
  const bypassLoad = runTaskGraph(ws, "set-status", ltPath, "1", "completed");
  results.push({
    step: "bypass-load-skill",
    blocked: bypassLoad.code !== 0,
    enforcer: "set-status",
    ...bypassLoad,
  });

  // 2. Bypass set-status: direct JSON edit → lane-tasks validator catches it
  const graph = readLaneTasks(ws);
  graph.tasks[0].status = "completed";
  writeLaneTasks(ws, graph);
  const bypassSetStatus = runLaneTasksValidator(ws);
  results.push({
    step: "bypass-set-status",
    blocked: bypassSetStatus.code !== 0,
    enforcer: "lane-tasks-validator",
    ...bypassSetStatus,
  });

  // Reset for next test
  const fresh2 = JSON.parse(JSON.stringify(scenario.tasks));
  writeLaneTasks(ws, { wi: "TEST-SCENARIO", lane: scenario.lane, created: new Date().toISOString(), status: "pending", tasks: fresh2 });

  // 3. Stop with incomplete work: leave tasks pending
  const stopIncomplete = runStopHook(ws, `incomplete-${Date.now()}`);
  results.push({
    step: "stop-incomplete",
    blocked: stopIncomplete.stdout.includes('"decision":"block"'),
    enforcer: "stop-hook",
    ...stopIncomplete,
  });

  // 4. Stop with missing receipt: all completed but no receipts
  const allCompleted = readLaneTasks(ws);
  for (const t of allCompleted.tasks) {
    t.status = "completed";
    t.completed_at = new Date().toISOString();
  }
  writeLaneTasks(ws, allCompleted);
  addDecisionLog(ws, "TEST-SCENARIO");
  const stopMissingReceipt = runStopHook(ws, `missing-receipt-${Date.now()}`);
  results.push({
    step: "stop-missing-receipt",
    blocked: stopMissingReceipt.stdout.includes('"decision":"block"') && stopMissingReceipt.stdout.includes("skill_receipt"),
    enforcer: "stop-hook",
    ...stopMissingReceipt,
  });

  return results;
}

// -------------------------------------------------------------------
// Assertions
// -------------------------------------------------------------------

function assertCompliant(ws, scenario, results) {
  const errors = [];

  for (const r of results) {
    if (r.code !== 0) {
      errors.push(`Step "${r.step}" failed: ${r.stderr || r.stdout}`);
    }
  }

  const graph = readLaneTasks(ws);
  for (const task of graph.tasks) {
    if (!task.skill_receipt) {
      errors.push(`Task ${task.id} missing skill_receipt`);
    } else if (task.skill_receipt.skill !== task.metadata?.skill && task.skill_receipt.skill !== task.skill) {
      errors.push(`Task ${task.id} skill_receipt mismatch`);
    }
  }

  const configPath = path.join(ws, "src", "config.js");
  if (!fs.existsSync(configPath) || fs.readFileSync(configPath, "utf8").includes("appNmae")) {
    errors.push("config.js typo not fixed");
  }

  const planPath = path.join(ws, "docs", "plans", "typo-fix.md");
  if (!fs.existsSync(planPath)) {
    errors.push("plan file missing");
  }

  return errors;
}

function assertNonCompliant(results) {
  const errors = [];
  const requiredBlocks = ["bypass-load-skill", "bypass-set-status", "stop-incomplete", "stop-missing-receipt"];

  for (const key of requiredBlocks) {
    const r = results.find((x) => x.step === key);
    if (!r) {
      errors.push(`Missing non-compliant test: ${key}`);
    } else if (!r.blocked) {
      errors.push(`Non-compliant step "${key}" was NOT blocked by ${r.enforcer}`);
    }
  }

  return errors;
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  const scenarioName = process.argv[2] || "typo-fix";
  const iterations = parseInt(process.argv[3] || "10", 10);

  const scenarioPath = path.join(__dirname, "scenarios", `${scenarioName}.mjs`);
  if (!fs.existsSync(scenarioPath)) {
    die(`Scenario not found: ${scenarioPath}`);
  }

  const scenario = await import(scenarioPath);

  console.log(`=== Scenario Runner: ${scenarioName} ===`);
  console.log(`Iterations: ${iterations}`);
  console.log("");

  const compliantHashes = [];
  const noncompliantHashes = [];
  const enforcementTraces = [];
  let compliantPass = 0;
  let noncompliantPass = 0;

  for (let i = 1; i <= iterations; i++) {
    const ws = fs.mkdtempSync("/tmp/svc-scenario-");
    copyFrameworkFiles(ws);
    scenario.setup(ws);
    initLaneTasks(ws, scenario);

    // Phase A
    const compliantResults = runCompliant(ws, scenario);
    const compliantErrors = assertCompliant(ws, scenario, compliantResults);
    if (compliantErrors.length === 0) {
      compliantPass++;
    }

    // Phase B
    const noncompliantResults = runNonCompliant(ws, scenario);
    const noncompliantErrors = assertNonCompliant(noncompliantResults);
    if (noncompliantErrors.length === 0) {
      noncompliantPass++;
    }

    // Record hashes
    compliantHashes.push(hashWorkspace(ws));
    // For non-compliant, hash just the lane-tasks file since workspace is messy
    noncompliantHashes.push(hashFile(path.join(ws, ".svc", "lane-tasks-test.json")));

    // Record enforcement trace
    const trace = noncompliantResults
      .filter((r) => r.blocked)
      .map((r) => `${r.step}=${r.enforcer}`)
      .join(";");
    enforcementTraces.push(trace);

    // Log
    console.log(`Iteration ${i}/${iterations}...`);
    if (compliantErrors.length > 0) {
      for (const e of compliantErrors) console.log(`  ✗ compliant: ${e}`);
    } else {
      console.log("  compliant: all assertions pass ✓");
    }
    if (noncompliantErrors.length > 0) {
      for (const e of noncompliantErrors) console.log(`  ✗ non-compliant: ${e}`);
    } else {
      console.log("  non-compliant: all bypasses caught ✓");
    }

    // Cleanup
    fs.rmSync(ws, { recursive: true, force: true });
  }

  // Variance analysis
  const uniqueCompliant = new Set(compliantHashes).size;
  const uniqueNoncompliant = new Set(noncompliantHashes).size;
  const uniqueTraces = new Set(enforcementTraces).size;

  console.log("");
  console.log("=== RESULT ===");
  console.log(`Compliant runs:     ${compliantPass}/${iterations}`);
  console.log(`Non-compliant runs: ${noncompliantPass}/${iterations}`);
  console.log(`Compliant hash variance:     ${uniqueCompliant} unique / ${iterations}`);
  console.log(`Non-compliant hash variance: ${uniqueNoncompliant} unique / ${iterations}`);
  console.log(`Enforcement trace variance:  ${uniqueTraces} unique / ${iterations}`);

  // Hash variance is expected due to timestamps (created, completed_at, loaded_at).
  // The enforcement trace being identical across all runs is the true determinism signal.
  const deterministic =
    compliantPass === iterations &&
    noncompliantPass === iterations &&
    uniqueTraces === 1;

  if (deterministic) {
    console.log("DETERMINISTIC ✓ (enforcement traces identical across all runs)");
    console.log(`Note: workspace hash variance (${uniqueCompliant}) is expected — timestamps differ per run.`);
    process.exit(0);
  } else {
    console.log("NON-DETERMINISTIC ✗");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
