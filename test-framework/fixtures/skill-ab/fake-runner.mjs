#!/usr/bin/env node
// Hermetic stand-in for `claude -p --output-format json` used by the skill-ab-eval tests.
// The with-skill arm "follows" the contract; the bare arm answers loosely. Usage scales with prompt size.
import fs from "node:fs";
const prompt = fs.readFileSync(0, "utf8");
const withSkill = prompt.startsWith("Follow this skill");
const task = process.env.SVC_AB_TASK || "";
if (process.env.FAKE_RUNNER_FAIL === task) process.exit(3);
const answers = {
  "write-spec-csv-export": withSkill
    ? "# Invoice CSV export\nStatus: DRAFT\n## Summary\nUsers export their invoices as a CSV file from the invoices page so they can reconcile them in a spreadsheet.\n## Acceptance Criteria\n- AC-1: Given I am on the invoices page with invoices, When I press Export CSV, Then a file with one row per invoice downloads.\n- AC-2: Given a filtered invoice list, When I export, Then only the filtered invoices appear in the CSV.\n- AC-3: Given no invoices exist, When I export, Then I see a message that there is nothing to export."
    : "Users click export and get a CSV.",
  "diagnose-off-by-one": withSkill ? "## Symptom\nlast page missing\n## Reproduction\npages(11,5)\n## Evidence\nMath.floor drops the partial page" : "## Symptom\nlast page missing\n## Reproduction\npages(11,5)\n## Evidence\nMath.floor drops the partial page",
  "decide-db-choice": "I recommend SQLite (confidence 8/10). A single-user desktop app needs no server and one file backs up trivially. Postgres only pays off with concurrent multi-user writes; if cloud sync arrives next year you can add a sync layer or migrate later, so the choice is reversible.",
};
const result = answers[task] ?? "unknown task";
process.stdout.write(JSON.stringify({ result, modelUsage: { "fake-model-1": {} }, usage: { input_tokens: Math.ceil(prompt.length / 4), output_tokens: Math.ceil(result.length / 4) }, total_cost_usd: 0 }));
