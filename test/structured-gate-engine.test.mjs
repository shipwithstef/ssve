#!/usr/bin/env node
// 6-fixture tests for SDKG engine + competitive gate config.
// Run: node test/structured-gate-engine.test.mjs ; exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import { evaluateGate, VERDICTS } from "../scripts/lib/structured-gate-engine.mjs";
import competitiveGate from "../scripts/gates/competitive.mjs";

const SCHEMA = "references/schemas/competitor-analysis.schema.json";
const FIXTURE_DIR = "test/fixtures/sdkg";
fs.mkdirSync(FIXTURE_DIR, { recursive: true });

let pass = 0, fail = 0;
function ok(name, condition, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

function writeFixture(name, content) {
  const p = path.join(FIXTURE_DIR, name);
  fs.writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  return p;
}

// Common competitor data shapes
const populatedData = {
  generated: "2026-05-02",
  landscape_state: "populated",
  category: "loyalty",
  competitors: [
    { name: "Toast", tier: "direct", last_verified: "2026-05-02",
      earn_mechanism: "POS auto-accrue at checkout", enrollment_path: "POS-auto",
      merchant_cost: "$25/mo", pos_integrations: ["Toast"], fraud_prevention: ["POS"],
      customer_complaints: ["Locked"] },
  ],
};
const nascentData = { ...populatedData, landscape_state: "nascent" };
const noneFoundData = { ...populatedData, landscape_state: "none-found", competitors: [] };
const inapplicableData = { ...populatedData, landscape_state: "inapplicable",
  landscape_state_justification: "Internal admin tool", competitors: [] };

// Fixture A: populated, spec aligns → PASS
{
  const dataPath = writeFixture("fix-a-populated-aligned.json", populatedData);
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "## Competitive Risk Assessment\n\nWe use POS auto-accrue at checkout, like Toast.\n",
  });
  ok("Fixture A — populated + aligned → PASS", result.verdict === VERDICTS.PASS, `got ${result.verdict}: ${result.reason}`);
}

// Fixture B: populated, spec diverges, NO compensating control → BLOCK
{
  const dataPath = writeFixture("fix-b-populated-diverge-no-cc.json", populatedData);
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "## Competitive Risk Assessment\n\nWe scan receipts via OCR.\n",
  });
  ok("Fixture B — populated + diverge + no CC → BLOCK", result.verdict === VERDICTS.BLOCK, `got ${result.verdict}`);
}

// Fixture C: populated, spec diverges, compensating control filled → PASS
{
  const dataPath = writeFixture("fix-c-populated-diverge-with-cc.json", populatedData);
  const cc = `
## Competitive Risk Assessment
We scan receipts via OCR. No competitor uses receipt OCR.

## Compensating Control
- missing_capability: POS integration (all 3 competitors use POS)
- why_not_now: 6-10 weeks engineering for Toast partner program
- risk_of_workaround: receipt fraud (no atomic POS attestation)
- path_to_replacement: WI-XXX Toast POS integration spike Q2
`;
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: cc,
  });
  ok("Fixture C — populated + diverge + CC complete → PASS", result.verdict === VERDICTS.PASS, `got ${result.verdict}: ${result.reason}`);
}

// Fixture D: nascent, no thin-evidence flag → WARN
{
  const dataPath = writeFixture("fix-d-nascent.json", nascentData);
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "## Competitive Risk Assessment\n\nNascent market.\n",
  });
  ok("Fixture D — nascent (no flag) → WARN", result.verdict === VERDICTS.WARN, `got ${result.verdict}`);
}

// Fixture E: none-found, no first-mover checklist → BLOCK
{
  const dataPath = writeFixture("fix-e-none-found.json", noneFoundData);
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "## Competitive Risk Assessment\n\nGreenfield, no competitors found.\n",
  });
  ok("Fixture E — none-found (no checklist) → BLOCK", result.verdict === VERDICTS.BLOCK, `got ${result.verdict}`);
}

// Fixture F: inapplicable + justification → SKIP
{
  const dataPath = writeFixture("fix-f-inapplicable.json", inapplicableData);
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "(no section needed for internal tool)",
  });
  ok("Fixture F — inapplicable + justification → SKIP", result.verdict === VERDICTS.SKIP, `got ${result.verdict}`);
  ok("Fixture F — justification surfaced in reason", result.reason?.includes("Internal admin tool"));
}

// GATE-FAIL-01: missing data file → HALT
{
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath: "test/fixtures/sdkg/does-not-exist.json", gateConfig: competitiveGate,
    currentArtifact: "",
  });
  ok("GATE-FAIL-01 — missing data → HALT (no silent pass)", result.verdict === VERDICTS.HALT);
}

// GATE-06 — env override → SKIP
{
  const dataPath = writeFixture("fix-b-populated-diverge-no-cc.json", populatedData);
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "(no section)",
    env: { SVC_COMPETITIVE_LANDSCAPE_OVERRIDE: "skip" },
  });
  ok("Env override → SKIP (escape hatch)", result.verdict === VERDICTS.SKIP);
}

// Schema violation → HALT (data has bad enum)
{
  const dataPath = writeFixture("fix-bad-enum.json", { ...populatedData, landscape_state: "wrong-state" });
  const result = evaluateGate({
    schemaPath: SCHEMA, dataPath, gateConfig: competitiveGate,
    currentArtifact: "",
  });
  ok("Schema violation → HALT", result.verdict === VERDICTS.HALT);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
