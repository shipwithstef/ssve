#!/usr/bin/env node
/**
 * svc Kimi Health Check — Lightweight CLI scenario runner
 *
 * Runs focused Kimi CLI scenarios N times each to measure:
 *   - Pass/fail rate
 *   - Output variance (structural consistency)
 *   - Time per run
 *   - Routing accuracy
 *
 * Usage:
 *   node scripts/kimi-health-check.mjs [iterations=3] [scenarios=all]
 *
 *   iterations: how many times to run each scenario (default 3, use 10 for full health)
 *   scenarios:  comma-separated list of scenario names, or "all"
 *
 * Examples:
 *   node scripts/kimi-health-check.mjs                    # 3 runs × all scenarios
 *   node scripts/kimi-health-check.mjs 10                 # 10 runs × all scenarios
 *   node scripts/kimi-health-check.mjs 5 routing,validate-feature
 *
 * Output:
 *   test-framework/results/health-check/YYYYMMDD-HHMMSS/report.md
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SCENARIOS_DIR = path.join(__dirname, "health-scenarios");
const RESULTS_DIR = path.join(REPO_ROOT, "test-framework", "results", "health-check");

const ITERATIONS = parseInt(process.argv[2] || "3", 10);
const SCENARIO_FILTER = process.argv[3] || "all";

// ─── Helpers ───────────────────────────────────────────────────────────

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function log(label, msg, ok = true) {
  const icon = ok ? "✓" : "✗";
  console.log(`  [${label}] ${msg} ${icon}`);
}

function now() {
  return Date.now();
}

function fmtMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function hashText(txt) {
  let h = 0;
  for (let i = 0; i < txt.length; i++) {
    h = ((h << 5) - h + txt.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 8);
}

function runKimi(cwd, prompt, timeoutSec = 60) {
  const start = now();
  try {
    const stdout = execSync(
      `kimi --print --yolo --final-message-only -p ${JSON.stringify(prompt)}`,
      { cwd, encoding: "utf8", stdio: "pipe", timeout: timeoutSec * 1000 }
    );
    return { code: 0, stdout: stdout.trim(), stderr: "", time: now() - start };
  } catch (e) {
    return {
      code: e.status || 1,
      stdout: e.stdout?.toString().trim() || "",
      stderr: e.stderr?.toString().trim() || e.message,
      time: now() - start,
    };
  }
}

async function loadScenarios() {
  const files = fs.readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith(".mjs"));
  const scenarios = [];
  for (const f of files) {
    const mod = await import(path.join(SCENARIOS_DIR, f));
    scenarios.push({ name: mod.name, file: f, ...mod });
  }

  if (SCENARIO_FILTER === "all") return scenarios;

  const wanted = new Set(SCENARIO_FILTER.split(",").map((s) => s.trim()));
  return scenarios.filter((s) => wanted.has(s.name));
}

// ─── Run a single iteration ────────────────────────────────────────────

async function runIteration(scenario, iter, resultDir) {
  const ws = path.join(resultDir, `${scenario.name}-run${iter}`);
  ensureDir(ws);

  // Setup workspace
  fs.mkdirSync(path.join(ws, ".svc"), { recursive: true });
  fs.mkdirSync(path.join(ws, "src"), { recursive: true });
  if (scenario.setup) scenario.setup(ws);

  // Run kimi
  const prompt = scenario.prompt(ws);
  const res = runKimi(ws, prompt, scenario.timeoutSec || 60);

  // Save raw output
  fs.writeFileSync(path.join(ws, "output.txt"), res.stdout, "utf8");
  if (res.stderr) {
    fs.writeFileSync(path.join(ws, "stderr.txt"), res.stderr, "utf8");
  }

  // Evaluate
  const checks = scenario.checks || [];
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      const ok = check.fn(res.stdout, ws, res);
      results.push({ name: check.name, pass: ok });
      if (ok) passed++; else failed++;
    } catch (e) {
      results.push({ name: check.name, pass: false, error: e.message });
      failed++;
    }
  }

  return {
    iter,
    code: res.code,
    time: res.time,
    stdoutLen: res.stdout.length,
    stdoutHash: hashText(res.stdout),
    passed,
    failed,
    checks: results,
    stderr: res.stderr,
  };
}

// ─── Report generation ────────────────────────────────────────────────

function generateReport(resultDir, allResults) {
  let md = `# svc Health Check Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Iterations per scenario:** ${ITERATIONS}\n`;
  md += `**CLI:** kimi\n\n`;

  // Summary table
  md += `## Summary\n\n`;
  md += `| Scenario | Pass Rate | Avg Time | Avg Output | Variance | Status |\n`;
  md += `|----------|-----------|----------|------------|----------|--------|\n`;

  for (const [name, runs] of Object.entries(allResults)) {
    const passCount = runs.filter((r) => r.failed === 0 && r.code === 0).length;
    const passRate = `${passCount}/${ITERATIONS}`;
    const avgTime = fmtMs(runs.reduce((a, r) => a + r.time, 0) / runs.length);
    const avgLen = Math.round(runs.reduce((a, r) => a + r.stdoutLen, 0) / runs.length);

    // Variance = unique hash count / total runs (lower = more consistent)
    const hashes = new Set(runs.map((r) => r.stdoutHash));
    const variance = hashes.size === 1 ? "None" : hashes.size <= ITERATIONS / 2 ? "Low" : "High";

    let status = "❌ Failing";
    if (passCount === ITERATIONS) status = "✅ Healthy";
    else if (passCount >= ITERATIONS * 0.7) status = "⚠️ Degraded";

    md += `| ${name} | ${passRate} | ${avgTime} | ${avgLen} chars | ${variance} | ${status} |\n`;
  }

  md += `\n`;

  // Failure analysis
  md += `## Failure Analysis\n\n`;
  let hasFailures = false;
  for (const [name, runs] of Object.entries(allResults)) {
    const failures = runs.filter((r) => r.failed > 0 || r.code !== 0);
    if (failures.length === 0) continue;
    hasFailures = true;

    md += `### ${name} (${failures.length} failure${failures.length > 1 ? "s" : ""})\n\n`;

    // Group by failure type
    const byType = {};
    for (const f of failures) {
      let key;
      if (f.code !== 0) key = "kimi exited non-zero";
      else if (f.stderr) key = `stderr: ${f.stderr.slice(0, 80)}`;
      else {
        const failedChecks = f.checks.filter((c) => !c.pass).map((c) => c.name).join(", ");
        key = `checks failed: ${failedChecks}`;
      }
      byType[key] = (byType[key] || 0) + 1;
    }

    for (const [key, count] of Object.entries(byType)) {
      md += `- ${count}×: ${key}\n`;
    }
    md += `\n`;
  }

  if (!hasFailures) {
    md += `No failures detected. All scenarios passed all checks.\n\n`;
  }

  // Per-scenario detail
  md += `## Per-Scenario Detail\n\n`;
  for (const [name, runs] of Object.entries(allResults)) {
    md += `### ${name}\n\n`;
    md += `| Run | Time | Output | Exit | Checks |\n`;
    md += `|-----|------|--------|------|--------|\n`;
    for (const r of runs) {
      const checkSummary = r.checks.map((c) => (c.pass ? "✓" : "✗") + c.name.slice(0, 12)).join(" ");
      md += `| ${r.iter} | ${fmtMs(r.time)} | ${r.stdoutLen} chars | ${r.code} | ${checkSummary} |\n`;
    }
    md += `\n`;
  }

  // Recommendations
  md += `## Recommendations\n\n`;
  const recs = [];
  for (const [name, runs] of Object.entries(allResults)) {
    const passCount = runs.filter((r) => r.failed === 0 && r.code === 0).length;
    const hashes = new Set(runs.map((r) => r.stdoutHash));
    if (passCount < ITERATIONS * 0.5) {
      recs.push(`**${name}** — Critical: <50% pass rate. Skill behavior is unstable. Review skill contract and prompt stability.`);
    } else if (passCount < ITERATIONS) {
      recs.push(`**${name}** — Warning: ${passCount}/${ITERATIONS} pass rate. Investigate intermittent failures.`);
    }
    if (ITERATIONS > 1 && hashes.size > ITERATIONS / 2) {
      recs.push(`**${name}** — High output variance (${hashes.size} unique hashes). Skill outputs are inconsistent across runs.`);
    }
  }

  if (recs.length === 0) {
    md += `All scenarios are healthy. No action required.\n`;
  } else {
    for (const r of recs) md += `- ${r}\n`;
  }

  md += `\n---\nGenerated by scripts/kimi-health-check.mjs\n`;

  const reportPath = path.join(resultDir, "report.md");
  fs.writeFileSync(reportPath, md, "utf8");
  return reportPath;
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    die(`Scenarios directory not found: ${SCENARIOS_DIR}`);
  }

  // Check kimi is available
  try {
    execSync("command -v kimi", { stdio: "pipe" });
  } catch {
    die("kimi CLI not found. Install it or add to PATH.");
  }

  const scenarios = await loadScenarios();
  if (scenarios.length === 0) {
    die("No scenarios found.");
  }

  const resultDir = path.join(RESULTS_DIR, new Date().toISOString().replace(/[:T]/g, "-").slice(0, 17));
  ensureDir(resultDir);

  console.log(`=== svc Kimi Health Check ===`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Scenarios:  ${scenarios.map((s) => s.name).join(", ")}`);
  console.log(`Results:    ${resultDir}\n`);

  const allResults = {};

  for (const scenario of scenarios) {
    console.log(`--- Scenario: ${scenario.name} ---`);
    const runs = [];

    for (let i = 1; i <= ITERATIONS; i++) {
      process.stdout.write(`  Run ${i}/${ITERATIONS}... `);
      const r = await runIteration(scenario, i, resultDir);
      runs.push(r);
      const status = r.failed === 0 && r.code === 0 ? "PASS" : "FAIL";
      console.log(`${status} (${fmtMs(r.time)}, ${r.stdoutLen} chars)`);
    }

    allResults[scenario.name] = runs;
    console.log("");
  }

  const reportPath = generateReport(resultDir, allResults);
  console.log(`Report written to: ${reportPath}`);
}

main().catch(die);
