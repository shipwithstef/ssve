#!/usr/bin/env node
// Tier-2 behavioral eval runner.
// Loads <skill>.json + <skill>.fixture.txt pairs from a directory, evaluates
// assertions against the fixture (treated as the assistant's response), and
// returns deterministic exit codes.
//
// Recorded-fixture playback only — no live LLM calls.
// Source rationale: WI-135 (coreyhaines blend v1.9.0).

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
const DIR = args[0] || "test-framework/evals/tier-2/behavioral";
const DRY_RUN = process.argv.includes("--dry-run");
const SUMMARY = process.env.SVC_TIER2_SUMMARY || "/tmp/svc-tier2-summary.txt";

if (!fs.existsSync(DIR)) {
  console.error(`directory not found: ${DIR}`);
  process.exit(2);
}

const evalFiles = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(DIR, f));

if (evalFiles.length === 0) {
  console.error(`no *.json evals found in: ${DIR}`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const failures = [];

function evaluateAssertion(assertion, text) {
  const { type, value } = assertion;
  switch (type) {
    case "contains":
      return text.includes(value);
    case "not_contains":
      return !text.includes(value);
    case "regex":
      return new RegExp(value).test(text);
    case "equals":
      return text.trim() === value;
    default:
      throw new Error(`unknown assertion type: ${type}`);
  }
}

for (const evalPath of evalFiles) {
  const fixturePath = evalPath.replace(/\.json$/, ".fixture.txt");
  if (DRY_RUN) {
    if (!fs.existsSync(fixturePath)) {
      console.error(`[behavioral] DRY-RUN MISSING FIXTURE: ${fixturePath}`);
      fail++;
      continue;
    }
    console.log(`[behavioral] DRY-RUN OK: ${path.basename(evalPath)} (fixture: ${path.basename(fixturePath)})`);
    pass++;
    continue;
  }

  if (!fs.existsSync(fixturePath)) {
    fail++;
    failures.push(`${evalPath}: missing fixture ${fixturePath}`);
    continue;
  }

  const evalDef = JSON.parse(fs.readFileSync(evalPath, "utf8"));
  const fixture = fs.readFileSync(fixturePath, "utf8");

  const skillName = evalDef.skill || path.basename(evalPath, ".json");
  let scenarioPass = true;
  for (const assertion of evalDef.assertions || []) {
    if (!evaluateAssertion(assertion, fixture)) {
      scenarioPass = false;
      failures.push(
        `${skillName} (${evalDef.scenario || "unnamed"}): assertion failed — ${JSON.stringify(assertion)}`
      );
    }
  }
  if (scenarioPass) {
    pass++;
    console.log(`[behavioral] PASS: ${skillName} — ${evalDef.scenario || ""}`);
  } else {
    fail++;
    console.log(`[behavioral] FAIL: ${skillName} — ${evalDef.scenario || ""}`);
  }
}

const summaryLine = `[behavioral] ${pass} passed, ${fail} failed (${evalFiles.length} eval(s) in ${DIR})`;
console.log(summaryLine);

try {
  fs.appendFileSync(SUMMARY, summaryLine + "\n" + (fail === 0 ? "[behavioral] PASS\n" : "[behavioral] FAIL\n"));
} catch {
  // summary file write is best-effort
}

if (fail > 0) {
  console.error("");
  console.error("Failures:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
