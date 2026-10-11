// Intended-journey specs for the seven dev tasks. No model is called.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec } from "../../scripts/lib/journey-conformance.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "../outcome-evals/northstar/journeys");
const TASKS = [
  "yoga-studio",
  "ai-quest",
  "waitlist-feature",
  "bugfix-rootcause",
  "security-payments",
  "typo-readme",
  "continuity-rules",
];

test("all seven intended journey specs match their filenames and validateSpec is empty", () => {
  const onDisk = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
  assert.deepEqual(onDisk, TASKS.map((t) => `${t}.json`).sort());
  for (const task of TASKS) {
    const spec = JSON.parse(fs.readFileSync(path.join(DIR, `${task}.json`), "utf8"));
    assert.equal(spec.task, task, task);
    assert.deepEqual(validateSpec(spec), [], task);
  }
});
