#!/usr/bin/env node
// Hermetic stand-in for `claude -p --output-format json` used by the skill-ab-eval tests.
// The with-skill arm "follows" the contract; the bare arm answers loosely. Usage scales with prompt size.
import fs from "node:fs";
const prompt = fs.readFileSync(0, "utf8");
const withSkill = prompt.startsWith("Follow this skill");
const task = process.env.SVC_AB_TASK || "";
if (process.env.FAKE_RUNNER_FAIL === task) process.exit(3);
const answers = {
  "write-spec-csv-export": withSkill ? "# CSV export\nStatus: DRAFT\n## Acceptance Criteria\n- Given invoices When I export Then a CSV downloads" : "Users click export and get a CSV.",
  "diagnose-off-by-one": withSkill ? "## Symptom\nlast page missing\n## Reproduction\npages(11,5)\n## Evidence\nMath.floor drops the partial page" : "## Symptom\nlast page missing\n## Reproduction\npages(11,5)\n## Evidence\nMath.floor drops the partial page",
  "decide-db-choice": "I recommend SQLite (confidence 8/10).",
};
const result = answers[task] ?? "unknown task";
process.stdout.write(JSON.stringify({ result, usage: { input_tokens: Math.ceil(prompt.length / 4), output_tokens: Math.ceil(result.length / 4) }, total_cost_usd: 0 }));
