#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compileConcernObligations } from "../../../scripts/svc-concern-compiler-v2.mjs";

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    process.stderr.write(`not ok ${name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

function registry() {
  return {
    schema_version: 1,
    concerns: [
      {
        name: "auth-surface",
        severity: "CRITICAL",
        status: "active",
        handled_by: { required_rules: ["auth-boundary"], required_skills: ["review-security"], optional_skills: [] },
        source_file: "concerns/auth-surface.md"
      },
      {
        name: "queue-backpressure",
        severity: "HIGH",
        status: "active",
        handled_by: { required_rules: [], required_skills: [], optional_skills: ["infra-sre"] },
        source_file: "concerns/queue-backpressure.md"
      },
      {
        name: "copy-quality",
        severity: "MEDIUM",
        status: "active",
        handled_by: { required_rules: [], required_skills: [], optional_skills: ["humanizer"] },
        source_file: "concerns/copy-quality.md"
      }
    ]
  };
}

check("critical concern compiles exact required actions", () => {
  const result = compileConcernObligations(registry(), ["auth-surface"], { mode: "enforce" });
  assert.equal(result.valid, true, JSON.stringify(result.gaps));
  assert.equal(result.cutover_ready, true);
  assert.deepEqual(result.obligations[0].actions, [
    { type: "RULE", id: "auth-boundary" },
    { type: "SKILL", id: "review-security" }
  ]);
});

check("high concern without required handler is visible in shadow", () => {
  const result = compileConcernObligations(registry(), ["queue-backpressure"], { mode: "shadow" });
  assert.equal(result.valid, true);
  assert.equal(result.cutover_ready, false);
  assert.equal(result.gaps[0].code, "MISSING_REQUIRED_HANDLER");
});

check("high concern without required handler blocks enforce", () => {
  const result = compileConcernObligations(registry(), ["queue-backpressure"], { mode: "enforce" });
  assert.equal(result.valid, false);
  assert.equal(result.summary.blocking_gaps, 1);
});

check("hash-bound waiver is explicit and deterministic", () => {
  const waiver = { reason: "temporary owner-approved compensating control", authority_digest: "a".repeat(64) };
  const first = compileConcernObligations(registry(), ["queue-backpressure"], {
    mode: "enforce",
    waivers: { "queue-backpressure": waiver }
  });
  const second = compileConcernObligations(registry(), ["queue-backpressure"], {
    mode: "enforce",
    waivers: { "queue-backpressure": waiver }
  });
  assert.equal(first.valid, true);
  assert.equal(first.obligations[0].disposition, "WAIVED");
  assert.equal(first.compilation_digest, second.compilation_digest);
});

check("unknown concern fails enforce", () => {
  const result = compileConcernObligations(registry(), ["invented-concern"], { mode: "enforce" });
  assert.equal(result.valid, false);
  assert.equal(result.gaps[0].code, "UNKNOWN_CONCERN");
});

check("one removed critical handler-set mutation produces no strict false green", () => {
  const input = registry();
  input.concerns[0].handled_by.required_rules = [];
  input.concerns[0].handled_by.required_skills = [];
  const result = compileConcernObligations(input, [input.concerns[0].name], { mode: "enforce" });
  assert.equal(result.valid, false);
  assert(result.gaps.some((gap) => gap.code === "MISSING_REQUIRED_HANDLER"));
});

check("live registry shadow inventory exposes unwired high-risk lenses", () => {
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const live = JSON.parse(fs.readFileSync(path.join(repoRoot, "concerns/REGISTRY.json"), "utf8"));
  const hits = live.concerns.map((concern) => concern.name);
  const result = compileConcernObligations(live, hits, { mode: "shadow" });
  assert.equal(result.valid, true);
  assert.equal(result.summary.hits, 116);
  assert.equal(result.gaps.filter((gap) => gap.code === "MISSING_REQUIRED_HANDLER").length, 40);
});

if (process.exitCode) {
  process.stderr.write(`concern compiler v2: ${passed} passed, failures present\n`);
} else {
  process.stdout.write(`concern compiler v2: ${passed} passed, 0 failed\n`);
}
