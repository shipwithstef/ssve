#!/usr/bin/env node
/** Tier 1: hook-bench applies `if` filters like Claude Code, budgets exist for every benched event, and cockpit gauges count the requirements ledger. Hermetic and fast (the benchmark itself is not run here). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ifMatches } from "../../../scripts/hook-bench.mjs";
import { ledgerCounts, gauges } from "../../../scripts/cockpit.mjs";
import { maxParallel, loadPlanLimits } from "../../../scripts/lib/parallelism.mjs";
import { defaultMaxParallel } from "../../../scripts/svc-execution-controller-v2.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("if filters: root-anchored file globs, Edit covers Write, other tools never match", () => {
  const lane = "Edit(//**/.svc/lane-tasks-*.json)";
  assert.equal(ifMatches(lane, "Edit", "/w/repo/.svc/lane-tasks-WI-1.json"), true);
  assert.equal(ifMatches(lane, "Write", "/elsewhere/wt/.svc/lane-tasks-WI-2.json"), true, "sibling worktrees outside cwd still match");
  assert.equal(ifMatches(lane, "Edit", "/w/repo/src/a.ts"), false);
  assert.equal(ifMatches(lane, "Read", "/w/repo/.svc/lane-tasks-WI-1.json"), false);
  assert.equal(ifMatches("Edit(//**/docs/specs/work-items/WI-*.md)", "Edit", "/r/docs/specs/work-items/WI-12.md"), true);
  assert.equal(ifMatches("Edit(//**/docs/specs/work-items/WI-*.md)", "Edit", "/r/docs/specs/work-items/sub/WI-12.md"), false, "* stays inside one segment");
  assert.equal(ifMatches(undefined, "Edit", "/x"), true, "no filter runs the hook");
});

test("wire-hooks emits the if filters that the bench and Claude Code rely on", () => {
  const src = fs.readFileSync(path.join(root, "scripts/wire-hooks.mjs"), "utf8");
  assert.match(src, /if: "Edit\(\/\/\*\*\/\.svc\/lane-tasks-\*\.json\)"/);
  assert.match(src, /if: "Edit\(\/\/\*\*\/docs\/specs\/work-items\/WI-\*\.md\)"/);
});

test("hook budgets cover each benched event and targets never exceed the gate", () => {
  const b = JSON.parse(fs.readFileSync(path.join(root, "references/hook-budgets.json"), "utf8"));
  for (const e of ["PreToolUse:Edit", "PostToolUse:Edit", "PreToolUse:Bash", "PostToolUse:Bash", "PostToolUse:Read", "UserPromptSubmit", "Stop"]) {
    assert.equal(typeof b.events[e], "number", e);
    assert.ok(b.target[e] <= b.events[e], `${e} target within gate`);
  }
});

test("cockpit gauges count ledger rows by status and never invent missing sources", () => {
  const text = "| # | R | Status | E |\n|---|---|---|---|\n| 1 | a | done | x |\n| 2 | b | partial | y |\n| 3 | c | done | z |\n| x | not a row | done | |\n";
  assert.deepEqual(ledgerCounts(text), { done: 2, partial: 1 });
  const g = gauges({ ledger: "/nonexistent.md" }).gauges.map((x) => x.label);
  assert.ok(!g.includes("Requirements"));
  assert.ok(g.includes("Hook mode"));
});

test("parallelism follows the plan, drops to one lane near the limit, and an override only lowers", () => {
  assert.equal(maxParallel({ plan: "pro" }).max_parallel, 1, "a small plan runs in sequence");
  assert.equal(maxParallel({ plan: "max20x" }).max_parallel, loadPlanLimits().plans.max20x.max_parallel);
  assert.equal(maxParallel({ plan: "max20x", used: 90, limit: 100 }).max_parallel, 1, "near the limit: one lane");
  assert.equal(maxParallel({ plan: "max20x", used: 50, limit: 100 }).max_parallel, 6);
  assert.equal(maxParallel({ plan: "max5x", override: "2" }).max_parallel, 2);
  assert.equal(maxParallel({ plan: "pro", override: "9" }).max_parallel, 1, "an override cannot raise the cap");
  assert.equal(maxParallel({ plan: "unknown" }).plan, loadPlanLimits().default_plan);
  assert.equal(maxParallel({ plan: "max5x", used: 10, limit: 0 }).max_parallel, 3, "a zero limit is ignored, not divided by");
  assert.ok(gauges({}).gauges.some((g) => g.label === "Parallel lanes"));
});

test("the execution controller's wave width follows SVC_PLAN and keeps 4 when no plan is set", () => {
  assert.equal(defaultMaxParallel({}), 4, "no plan: unchanged historical default");
  assert.equal(defaultMaxParallel({ SVC_PLAN: "pro" }), 1, "a $20-class plan runs one lane");
  assert.equal(defaultMaxParallel({ SVC_PLAN: "max20x" }), loadPlanLimits().plans.max20x.max_parallel);
  assert.equal(defaultMaxParallel({ SVC_PLAN: "max20x", SVC_MAX_PARALLEL: "2" }), 2);
});
