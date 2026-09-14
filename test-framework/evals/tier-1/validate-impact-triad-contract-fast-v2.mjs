#!/usr/bin/env node

import assert from "node:assert/strict";
import { validateImpactReceiptContract } from "../../../hooks/svc-impact-triad-guard.mjs";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`not ok ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

const graph = {
  tasks: [
    { id: 1, skill: "execute-changeset", status: "in_progress" },
    { id: 2, skill: "review-exec", status: "pending", blocked_by: [1] }
  ]
};

function receipt(tier = "high") {
  const proofKind = tier === "high" ? "behavioral" : tier === "logic" ? "mapped-test" : "static";
  return {
    schema_version: tier === "high" ? 2 : 1,
    wi: "WI-481",
    session_id: "session-impact-fast-v2",
    worktree_root: "/tmp/worktree",
    task_graph: "/tmp/worktree/.svc/lane-tasks-WI-481.json",
    task_id: 1,
    diff_sha256: "a".repeat(64),
    risk_tier: tier,
    risk_reasons: ["fixture"],
    breaks_what: { answer: "nothing outside the declared contract", sources: ["spec"], evidence: ["test"] },
    intended_behavior: { answer: "preserve exact behavior", sources: ["spec"], evidence: ["test"] },
    product_surface: { answer: "headless framework", sources: ["plan"], evidence: ["test"] },
    coverage_tasks: [{ id: "coverage", status: "completed", owner: "task 1", validation: "fast-v2" }],
    independent_review: tier === "high"
      ? { status: "deferred-to-final", executor_family: "openai", reviewer_family: "n/a", artifacts: [], final_review_task_id: 2, plan_digest: "b".repeat(64) }
      : { status: "n/a", executor_family: "n/a", reviewer_family: "n/a", artifacts: [] },
    runtime_proof: { status: "pass", kind: proofKind, artifacts: ["test"] },
    created_at: "2026-08-10T00:00:00.000Z"
  };
}

check("schema v2 high receipt binds exactly one final review", () => {
  assert.equal(validateImpactReceiptContract(receipt(), graph).valid, true);
});

check("schema v2 cannot regress to per-task review", () => {
  const input = receipt();
  input.independent_review = { status: "pass", executor_family: "openai", reviewer_family: "anthropic", artifacts: ["review"] };
  const result = validateImpactReceiptContract(input, graph);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("must defer")));
});

check("missing or duplicate final review task fails", () => {
  assert.equal(validateImpactReceiptContract(receipt(), { tasks: [] }).valid, false);
  assert.equal(validateImpactReceiptContract(receipt(), { tasks: [...graph.tasks, { id: 3, skill: "review-exec" }] }).valid, false);
});

check("high requires behavioral proof while logic and cosmetic keep mapped floors", () => {
  const high = receipt(); high.runtime_proof.kind = "static";
  assert.equal(validateImpactReceiptContract(high, graph).valid, false);
  assert.equal(validateImpactReceiptContract(receipt("logic"), graph).valid, true);
  assert.equal(validateImpactReceiptContract(receipt("cosmetic"), graph).valid, true);
});

check("N-1 legacy different-family receipt remains readable", () => {
  const legacy = receipt();
  legacy.schema_version = 1;
  legacy.independent_review = { status: "pass", executor_family: "openai", reviewer_family: "anthropic", artifacts: ["review"] };
  assert.equal(validateImpactReceiptContract(legacy, graph).valid, true);
});

check("10 distinct receipt mutations produce zero false PASS", () => {
  let falsePasses = 0;
  for (let index = 0; index < 10; index += 1) {
    const input = receipt();
    switch (index) {
      case 0: delete input.diff_sha256; break;
      case 1: input.diff_sha256 = "bad"; break;
      case 2: input.coverage_tasks = []; break;
      case 3: input.runtime_proof.status = "fail"; break;
      case 4: input.runtime_proof.kind = "static"; break;
      case 5: input.independent_review.final_review_task_id = 999; break;
      case 6: input.independent_review.plan_digest = "bad"; break;
      case 7: input.independent_review.reviewer_family = "anthropic"; break;
      case 8: input.schema_version = 99; break;
      case 9: input.unexpected = true; break;
    }
    if (validateImpactReceiptContract(input, graph).valid) falsePasses += 1;
  }
  assert.equal(falsePasses, 0);
});

if (process.exitCode) console.error(`impact triad fast contract v2: ${passed} passed, failures present`);
else console.log(`impact triad fast contract v2: ${passed} passed, 0 failed`);
