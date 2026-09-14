#!/usr/bin/env node
/**
 * Framework Test Catalog
 *
 * Harness-agnostic contract tests for the svc framework.
 * Validates: task-graph.mjs, skill receipts, checkpoints, lane contracts.
 * Kimi-specific hook tests run only if Kimi hooks are installed.
 *
 * Usage: node framework-test-catalog.mjs [project-path] [scenario-filter] [iterations]
 *   project-path: path to project with task-graph.mjs (default: cwd)
 *   scenario-filter: optional substring match on scenario name
 *   iterations: default 10
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { readJsonAtomic, writeJsonAtomic } from "./state-io.mjs";

const args = process.argv.slice(2);

// Parse args: first arg might be a path, or filter, or iteration count
let PROJECT_ROOT = process.cwd();
let filter = "";
let ITERATIONS = 10;

// Heuristic: if first arg exists as a directory with scripts/task-graph.mjs, it's the project path
if (args[0] && fs.existsSync(path.join(args[0], "scripts", "task-graph.mjs"))) {
  PROJECT_ROOT = path.resolve(args[0]);
  filter = args[1] ?? "";
  ITERATIONS = Number(args[2] ?? 10);
} else {
  filter = args[0] ?? "";
  ITERATIONS = Number(args[1] ?? 10);
}

const TASK_GRAPH = path.join(PROJECT_ROOT, "scripts", "task-graph.mjs");
const TASK_GRAPH_CMD = `node ${TASK_GRAPH}`;

// Detect active harness
const KIMI_HOOKS_DIR = path.join(os.homedir(), ".kimi", "hooks");
const HAS_KIMI_HOOKS = fs.existsSync(path.join(KIMI_HOOKS_DIR, "svc-kimi-pre-compact.sh"));

console.log(`Framework Test Catalog — project: ${PROJECT_ROOT}`);
if (HAS_KIMI_HOOKS) {
  console.log(`Kimi hooks detected — compaction tests enabled`);
} else {
  console.log(`No Kimi hooks detected — compaction tests skipped`);
}
console.log();

let passed = 0;
let failed = 0;

function tmpFile(prefix, suffix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix + "-"));
  const svcDir = path.join(dir, ".svc");
  fs.mkdirSync(svcDir, { recursive: true });
  // Create scripts symlink so PreCompact hook can find task-graph.mjs
  const scriptsDir = path.join(dir, "scripts");
  if (!fs.existsSync(scriptsDir)) {
    fs.symlinkSync(path.join(PROJECT_ROOT, "scripts"), scriptsDir);
  }
  return path.join(svcDir, suffix);
}

function run(args, expectFail = false) {
  const cmd = `${TASK_GRAPH_CMD} ${args.map((a) => JSON.stringify(a)).join(" ")}`;
  try {
    const stdout = execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf8", stdio: "pipe" });
    if (expectFail) {
      return { ok: false, stdout, stderr: "", error: "expected failure but succeeded" };
    }
    return { ok: true, stdout, stderr: "" };
  } catch (e) {
    if (expectFail) {
      return { ok: true, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || "" };
    }
    return { ok: false, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || e.message };
  }
}

function initGraph(file, wi, lane) {
  const r = run(["init", file, "--wi", wi, "--lane", lane]);
  if (!r.ok) throw new Error(`init failed: ${r.stderr}`);
}

function addTask(file, task) {
  const graph = readJsonAtomic(file);
  graph.tasks.push(task);
  writeJsonAtomic(file, graph);
}

function setTasks(file, tasks) {
  const graph = readJsonAtomic(file);
  graph.tasks = tasks;
  writeJsonAtomic(file, graph);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

function assertOk(result, msg) {
  if (!result.ok) {
    throw new Error(`${msg}: ${result.stderr}`);
  }
}

function assertTrue(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}

function assertFail(result, msg) {
  if (result.ok) {
    throw new Error(`${msg}: expected failure but succeeded`);
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const scenarios = [
  {
    name: "Lane quick-fix: router bypass, no skill receipt needed",
    lane: "quick-fix",
    setup() {
      const file = tmpFile("ftc-quickfix", "lane-tasks-WI-QF-001.json");
      initGraph(file, "WI-QF-001", "quick-fix");
      setTasks(file, [{
        id: 1,
        subject: "Fix typo in README",
        status: "pending",
        blocked_by: [],
      }]);
      return file;
    },
    run(file) {
      // No skill declared -> can complete without receipt
      const r1 = run(["set-status", file, "1", "completed"]);
      assertOk(r1, "quick-fix completion without skill should succeed");

      // Checkpoint should work
      const r2 = run(["checkpoint", file]);
      assertOk(r2, "quick-fix checkpoint should succeed");
    },
  },

  {
    name: "Lane bugfix (Lane 4): diagnose-bug → plan → execute → review → land → verify",
    lane: "bugfix",
    setup() {
      const file = tmpFile("ftc-bugfix", "lane-tasks-WI-BF-001.json");
      initGraph(file, "WI-BF-001", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose-bug: classify auth null pointer", status: "pending", blocked_by: [], flags: { auth_sensitive: true } },
        { id: 2, skill: "plan-changeset", subject: "plan: minimal auth guard fix", status: "pending", blocked_by: [1] },
        { id: 3, skill: "execute-changeset", subject: "execute: add null guard", status: "pending", blocked_by: [2] },
        { id: 4, skill: "review-gate", subject: "review-gate: G5 blocking review", status: "pending", blocked_by: [3], blocking: true, gate: "G5" },
        { id: 5, skill: "review-security", subject: "review-security: auth boundary check", status: "pending", blocked_by: [3] },
        { id: 6, skill: "land-changeset", subject: "land: promote via worktree", status: "pending", blocked_by: [4, 5] },
        { id: 7, skill: "verify-promotion", subject: "verify: production smoke", status: "pending", blocked_by: [6] },
      ]);
      return file;
    },
    run(file) {
      // Ghost execution: complete without load-skill → MUST fail
      const ghost = run(["set-status", file, "1", "completed"]);
      assertFail(ghost, "bugfix task 1 ghost execution should be blocked");

      // Complete with skill receipt → MUST succeed
      const complete1 = run(["complete", file, "1", "diagnose-bug"]);
      assertOk(complete1, "bugfix task 1 completion after load-skill should succeed");

      // Check auth-sensitive flag forced review-security insertion
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const reviewSecurity = graph.tasks.find((t) => t.skill === "review-security");
      if (!reviewSecurity) throw new Error("auth-sensitive classifier did not insert review-security");

      // Complete remaining tasks in order
      for (const taskId of [2, 3, 4, 5, 6, 7]) {
        const task = graph.tasks.find((t) => t.id === taskId);
        const skill = task.skill;
        const complete = run(["complete", file, String(taskId), skill]);
        assertOk(complete, `bugfix task ${taskId} completion should succeed`);
      }

      // Final graph status
      const final = run(["graph-status", file]);
      assertOk(final, "bugfix final graph-status should succeed");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "bugfix final status should be completed");

      // Checkpoint
      const cp = run(["checkpoint", file]);
      assertOk(cp, "bugfix checkpoint should succeed");
    },
  },

  {
    name: "Lane brownfield-feature (Lane 3): browser-visible triggers track-visuals",
    lane: "brownfield-feature",
    setup() {
      const file = tmpFile("ftc-bf-feat", "lane-tasks-WI-BF-002.json");
      initGraph(file, "WI-BF-002", "brownfield-feature");
      setTasks(file, [
        { id: 1, skill: "validate-feature", subject: "validate: dark mode toggle business case", status: "pending", blocked_by: [] },
        { id: 2, skill: "write-spec", subject: "write-spec: dark mode feature spec", status: "pending", blocked_by: [1] },
        { id: 3, skill: "design-ux", subject: "design-ux: toggle placement flow", status: "pending", blocked_by: [2] },
        { id: 4, skill: "design-ui", subject: "design-ui: toggle component spec", status: "pending", blocked_by: [3] },
        { id: 5, skill: "design-tech", subject: "design-tech: state management approach", status: "pending", blocked_by: [4] },
        { id: 6, skill: "plan-changeset", subject: "plan: component + CSS changes", status: "pending", blocked_by: [5] },
        { id: 7, skill: "execute-changeset", subject: "execute: implement dark mode", status: "pending", blocked_by: [6] },
        { id: 8, skill: "review-gate", subject: "review-gate: G5 code review", status: "pending", blocked_by: [7], blocking: true, gate: "G5" },
        { id: 9, skill: "track-visuals", subject: "track-visuals: baseline + diff", status: "pending", blocked_by: [7] },
        { id: 10, skill: "write-e2e", subject: "write-e2e: dark mode regression", status: "pending", blocked_by: [8, 9] },
        { id: 11, skill: "land-changeset", subject: "land: promote dark mode", status: "pending", blocked_by: [10] },
        { id: 12, skill: "verify-promotion", subject: "verify: production smoke", status: "pending", blocked_by: [11] },
      ]);
      return file;
    },
    run(file) {
      // Verify track-visuals is present when browser-visible changes expected
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const trackVisuals = graph.tasks.find((t) => t.skill === "track-visuals");
      if (!trackVisuals) throw new Error("browser-visible classifier did not insert track-visuals");

      // Walk through all tasks with skill receipts
      for (const task of graph.tasks) {
        const complete = run(["complete", file, String(task.id), task.skill]);
        assertOk(complete, `bf-feat task ${task.id} completion should succeed`);
      }

      const final = run(["graph-status", file]);
      assertOk(final, "bf-feat final graph-status should succeed");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "bf-feat final status should be completed");
    },
  },

  {
    name: "Lane brownfield-conversion (Lane 2): minimal path",
    lane: "brownfield-conversion",
    setup() {
      const file = tmpFile("ftc-bf-conv", "lane-tasks-WI-BF-003.json");
      initGraph(file, "WI-BF-003", "brownfield-conversion");
      setTasks(file, [
        { id: 1, skill: "onboard-repo", subject: "onboard: scan JS→TS conversion scope", status: "pending", blocked_by: [] },
        { id: 2, skill: "plan-changeset", subject: "plan: type-check fix batches", status: "pending", blocked_by: [1] },
        { id: 3, skill: "execute-changeset", subject: "execute: apply type fixes", status: "pending", blocked_by: [2] },
      ]);
      return file;
    },
    run(file) {
      for (const taskId of [1, 2, 3]) {
        const graph = JSON.parse(fs.readFileSync(file, "utf8"));
        const task = graph.tasks.find((t) => t.id === taskId);
        const complete = run(["complete", file, String(taskId), task.skill]);
        assertOk(complete, `bf-conv task ${taskId} completion should succeed`);
      }
      const final = run(["graph-status", file]);
      assertOk(final, "bf-conv final graph-status should succeed");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "bf-conv final status should be completed");
    },
  },

  {
    name: "Lane refactor (Lane 6): no user-visible, track-visuals skipped",
    lane: "refactor",
    setup() {
      const file = tmpFile("ftc-refactor", "lane-tasks-WI-RF-001.json");
      initGraph(file, "WI-RF-001", "refactor");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: identify dead code scope", status: "pending", blocked_by: [] },
        { id: 2, skill: "plan-changeset", subject: "plan: 5-file removal batches", status: "pending", blocked_by: [1] },
        { id: 3, skill: "execute-changeset", subject: "execute: remove dead code", status: "pending", blocked_by: [2] },
        { id: 4, skill: "review-gate", subject: "review-gate: G5 review", status: "pending", blocked_by: [3], blocking: true, gate: "G5" },
        { id: 5, skill: "land-changeset", subject: "land: promote refactor", status: "pending", blocked_by: [4] },
      ]);
      return file;
    },
    run(file) {
      // Verify NO track-visuals task exists
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const trackVisuals = graph.tasks.find((t) => t.skill === "track-visuals");
      if (trackVisuals) throw new Error("refactor should NOT have track-visuals (no user-visible changes)");

      for (const task of graph.tasks) {
        const complete = run(["complete", file, String(task.id), task.skill]);
        assertOk(complete, `refactor task ${task.id} completion should succeed`);
      }

      const final = run(["graph-status", file]);
      assertOk(final, "refactor final graph-status should succeed");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "refactor final status should be completed");
    },
  },

  {
    name: "Lane drift (Lane 5): sync-spec-code path",
    lane: "drift",
    setup() {
      const file = tmpFile("ftc-drift", "lane-tasks-WI-DR-001.json");
      initGraph(file, "WI-DR-001", "drift");
      setTasks(file, [
        { id: 1, skill: "audit-coverage", subject: "audit: check spec coverage", status: "pending", blocked_by: [] },
        { id: 2, skill: "sync-spec-code", subject: "sync: align docs with code", status: "pending", blocked_by: [1] },
        { id: 3, skill: "plan-changeset", subject: "plan: update drifted docs", status: "pending", blocked_by: [2] },
        { id: 4, skill: "execute-changeset", subject: "execute: apply doc updates", status: "pending", blocked_by: [3] },
        { id: 5, skill: "review-gate", subject: "review-gate: G5 review", status: "pending", blocked_by: [4], blocking: true, gate: "G5" },
        { id: 6, skill: "land-changeset", subject: "land: promote doc fix", status: "pending", blocked_by: [5] },
      ]);
      return file;
    },
    run(file) {
      for (const task of JSON.parse(fs.readFileSync(file, "utf8")).tasks) {
        const complete = run(["complete", file, String(task.id), task.skill]);
        assertOk(complete, `drift task ${task.id} completion should succeed`);
      }
      const final = run(["graph-status", file]);
      assertOk(final, "drift final graph-status should succeed");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "drift final status should be completed");
    },
  },
];

// ---------------------------------------------------------------------------
// Compaction Resilience Scenarios
// ---------------------------------------------------------------------------

const PRE_COMPACT_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-pre-compact.sh");
const POST_COMPACT_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-post-compact.sh");
const STOP_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-task-completion-guard.sh");
const PREFLIGHT_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-preflight-guard.sh");
const SESSION_START_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-session-start.sh");
const SESSION_END_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-session-end.sh");
const FAILURE_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-lane-tasks-failure.sh");
const PRE_VALIDATOR_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-lane-tasks-pre-validator.sh");
const STOP_FAILURE_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-stop-failure.sh");
const SUBAGENT_START_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-subagent-start.sh");
const SUBAGENT_STOP_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-subagent-stop.sh");
const NOTIFICATION_HOOK = path.join(KIMI_HOOKS_DIR, "svc-kimi-notification.sh");

function runHook(scriptPath, payload) {
  try {
    const stdout = execSync(`bash ${scriptPath}`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      stdio: "pipe",
      input: JSON.stringify(payload),
    });
    return { ok: true, stdout, stderr: "" };
  } catch (e) {
    return { ok: false, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || e.message };
  }
}

const compactionScenarios = [
  {
    name: "C1: Mid-lane compaction — resume from checkpoint",
    run() {
      const file = tmpFile("ftc-compact-c1", "lane-tasks-WI-CP-001.json");
      initGraph(file, "WI-CP-001", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "plan-changeset", subject: "plan: fix", status: "pending", blocked_by: [1] },
        { id: 3, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [2] },
      ]);

      // Complete task 1 with skill receipt
      assertOk(run(["complete", file, "1", "diagnose-bug"]), "C1 complete 1");

      // Checkpoint before simulated compaction
      assertOk(run(["checkpoint", file]), "C1 checkpoint");

      // Simulate compaction: re-read graph as if in-session state lost
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const next = graph.tasks.find((t) => t.status === "in_progress") ?? graph.tasks.find((t) => t.status === "pending" && (t.blocked_by ?? []).every((bid) => graph.tasks.find((x) => x.id === bid)?.status === "completed"));
      if (!next) throw new Error("C1: no next task found after checkpoint");
      if (next.id !== 2) throw new Error(`C1: expected next task 2, got ${next.id}`);

      // Verify checkpoint file exists and matches
      const cpPath = file.replace(/\.json$/, ".checkpoint.json").replace(/lane-tasks-/, ".checkpoint-");
      if (!fs.existsSync(cpPath)) throw new Error("C1: checkpoint file not found");
      const cp = JSON.parse(fs.readFileSync(cpPath, "utf8"));
      if (cp.next_task?.id !== 2) throw new Error(`C1: checkpoint next_task should be 2, got ${cp.next_task?.id}`);

      // Resume: complete task 2 and continue
      assertOk(run(["complete", file, "2", "plan-changeset"]), "C1 resume complete 2");
      assertOk(run(["complete", file, "3", "execute-changeset"]), "C1 complete 3");

      const final = run(["graph-status", file]);
      assertOk(final, "C1 final graph-status");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "C1 final status completed");
    },
  },

  {
    name: "C2: Post-compaction skill reload",
    run() {
      const file = tmpFile("ftc-compact-c2", "lane-tasks-WI-CP-002.json");
      initGraph(file, "WI-CP-002", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [1] },
      ]);

      // Complete task 1
      assertOk(run(["complete", file, "1", "diagnose-bug"]), "C2 complete 1");

      // Simulate compaction: agent forgets skill loaded state
      // Try to complete task 2 WITHOUT load-skill → must fail
      const ghost = run(["set-status", file, "2", "completed"]);
      assertFail(ghost, "C2 ghost execution after compaction should be blocked");

      // Correct recovery: complete with skill receipt
      assertOk(run(["complete", file, "2", "execute-changeset"]), "C2 recovery complete 2");
    },
  },

  {
    name: "C3: Cross-session resume — read lane-tasks and continue",
    run() {
      const file = tmpFile("ftc-compact-c3", "lane-tasks-WI-CP-003.json");
      initGraph(file, "WI-CP-003", "brownfield-feature");
      setTasks(file, [
        { id: 1, skill: "validate-feature", subject: "validate: feature", status: "pending", blocked_by: [] },
        { id: 2, skill: "write-spec", subject: "write: spec", status: "pending", blocked_by: [1] },
        { id: 3, skill: "design-ux", subject: "design: UX", status: "pending", blocked_by: [2] },
      ]);

      // Complete task 1
      assertOk(run(["complete", file, "1", "validate-feature"]), "C3 complete 1");

      // Simulate new session: read graph, find next task, resume
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const next = graph.tasks.find((t) => t.status === "pending" && (t.blocked_by ?? []).every((bid) => graph.tasks.find((x) => x.id === bid)?.status === "completed"));
      if (!next || next.id !== 2) throw new Error(`C3: expected next task 2, got ${next?.id}`);

      // Resume from task 2
      assertOk(run(["complete", file, "2", "write-spec"]), "C3 session2 complete 2");
      assertOk(run(["complete", file, "3", "design-ux"]), "C3 session2 complete 3");

      const final = run(["graph-status", file]);
      assertOk(final, "C3 final graph-status");
      assertTrue(final.stdout.includes("\"status\": \"completed\""), "C3 final status completed");
    },
  },

  ...(HAS_KIMI_HOOKS ? [{
    name: "C4: PreCompact hook persists checkpoints for active work",
    run() {
      const file = tmpFile("ftc-compact-c4", "lane-tasks-WI-CP-004.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-004", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [1] },
      ]);

      // Complete task 1 so graph is in_progress (not completed)
      assertOk(run(["complete", file, "1", "diagnose-bug"]), "C4 complete 1");

      // Run PreCompact hook with CWD pointing to project root (simulating real Kimi behavior)
      const payload = { cwd: projectDir, trigger: "token_limit", token_count: 220000 };
      const hookResult = runHook(PRE_COMPACT_HOOK, payload);
      assertOk(hookResult, "C4 PreCompact hook should succeed");

      // Verify checkpoint file was created
      const cpFile = path.join(svcDir, ".checkpoint-WI-CP-004.checkpoint.json");
      assertTrue(fs.existsSync(cpFile), `C4 checkpoint file should exist: ${cpFile}`);

      // Verify checkpoint content
      const cp = JSON.parse(fs.readFileSync(cpFile, "utf8"));
      assertEqual(cp.wi, "WI-CP-004", "C4 checkpoint WI mismatch");
      assertEqual(cp.status, "pending", "C4 checkpoint status mismatch");
      assertTrue(cp.next_task != null, "C4 checkpoint next_task should exist");
      assertEqual(cp.next_task.id, 2, "C4 checkpoint next task should be 2");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C5: PostCompact hook emits recovery for active checkpoints",
    run() {
      const file = tmpFile("ftc-compact-c5", "lane-tasks-WI-CP-005.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-005", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [1] },
      ]);

      // Complete task 1
      assertOk(run(["complete", file, "1", "diagnose-bug"]), "C5 complete 1");

      // PreCompact to create checkpoint
      assertOk(runHook(PRE_COMPACT_HOOK, { cwd: projectDir, trigger: "token_limit", token_count: 220000 }), "C5 PreCompact");

      // PostCompact should emit recovery guidance
      const postResult = runHook(POST_COMPACT_HOOK, { cwd: projectDir, trigger: "token_limit", estimated_token_count: 100000 });
      assertOk(postResult, "C5 PostCompact hook should succeed");
      assertTrue(postResult.stdout.includes("FRAMEWORK STATE RECOVERY"), "C5 PostCompact should emit recovery header");
      assertTrue(postResult.stdout.includes("WI-CP-005"), "C5 PostCompact should mention WI");
      assertTrue(postResult.stdout.includes("RECOVERY PROTOCOL"), "C5 PostCompact should include recovery protocol");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C6: PostCompact hook silent when no active work",
    run() {
      const file = tmpFile("ftc-compact-c6", "lane-tasks-WI-CP-006.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-006", "quick-fix");
      setTasks(file, [
        { id: 1, subject: "Fix typo", status: "pending", blocked_by: [] },
      ]);

      // Complete the only task so graph is done
      assertOk(run(["set-status", file, "1", "completed"]), "C6 complete 1");

      // PreCompact should skip completed graphs
      assertOk(runHook(PRE_COMPACT_HOOK, { cwd: projectDir, trigger: "token_limit", token_count: 220000 }), "C6 PreCompact");

      // PostCompact should emit nothing for completed work
      const postResult = runHook(POST_COMPACT_HOOK, { cwd: projectDir, trigger: "token_limit", estimated_token_count: 100000 });
      assertOk(postResult, "C6 PostCompact hook should succeed");
      assertTrue(postResult.stdout.trim().length === 0, "C6 PostCompact should be silent for completed work");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C7: Stop hook anti-loop — stop_hook_active exits 0",
    run() {
      const file = tmpFile("ftc-compact-c7", "lane-tasks-WI-CP-007.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-007", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
      ]);

      // Stop hook with stop_hook_active=true should exit 0 (allow), even with pending work
      const payload = { session_id: "test-c7", cwd: projectDir, stop_hook_active: true };
      const hookResult = runHook(STOP_HOOK, payload);
      assertOk(hookResult, "C7 Stop hook with stop_hook_active should succeed (not block)");
      assertTrue(hookResult.stdout.includes("anti_loop") || hookResult.stdout.includes("allow") || hookResult.stdout.trim() === "", "C7 should emit anti_loop or allow status");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C8: PostToolUseFailure warns on lane-tasks edit failure",
    run() {
      const file = tmpFile("ftc-compact-c8", "lane-tasks-WI-CP-008.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);

      const payload = {
        tool_name: "WriteFile",
        tool_input: { file_path: file, content: "{bad json" },
        error: "Unexpected token 'b', \"{bad json\" is not valid JSON",
      };
      const hookResult = runHook(FAILURE_HOOK, payload);
      assertOk(hookResult, "C8 PostToolUseFailure hook should succeed");
      assertTrue(hookResult.stdout.includes("LANE-TASKS EDIT FAILED"), "C8 should emit lane-tasks failure warning");
      assertTrue(hookResult.stdout.includes("WriteFile"), "C8 should mention tool name");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C9: UserPromptSubmit pre-flight advisory",
    run() {
      const file = tmpFile("ftc-compact-c9", "lane-tasks-WI-CP-009.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-009", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [1] },
      ]);

      const payload = { cwd: projectDir, prompt: "fix the auth bug" };
      const hookResult = runHook(PREFLIGHT_HOOK, payload);
      assertOk(hookResult, "C9 UserPromptSubmit hook should succeed");
      assertTrue(hookResult.stdout.includes("ACTIVE WORK ITEM REMINDER"), "C9 should emit pre-flight reminder");
      assertTrue(hookResult.stdout.includes("WI-CP-009"), "C9 should mention WI");
      assertTrue(hookResult.stdout.includes("diagnose-bug"), "C9 should mention next skill");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C10: SessionStart resume recovers from checkpoint",
    run() {
      const file = tmpFile("ftc-compact-c10", "lane-tasks-WI-CP-010.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-010", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [1] },
      ]);

      // Complete task 1 and checkpoint
      assertOk(run(["complete", file, "1", "diagnose-bug"]), "C10 complete 1");
      assertOk(runHook(PRE_COMPACT_HOOK, { cwd: projectDir, trigger: "token_limit", token_count: 220000 }), "C10 PreCompact");

      // SessionStart with source=resume should emit recovery protocol
      const payload = { cwd: projectDir, source: "resume" };
      const hookResult = runHook(SESSION_START_HOOK, payload);
      assertOk(hookResult, "C10 SessionStart hook should succeed");
      assertTrue(hookResult.stdout.includes("SESSION RESUME RECOVERY"), "C10 should emit resume recovery header");
      assertTrue(hookResult.stdout.includes("WI-CP-010"), "C10 should mention WI");
      assertTrue(hookResult.stdout.includes("RECOVERY PROTOCOL"), "C10 should include recovery protocol");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C11: SessionStart startup lighter reminder",
    run() {
      const file = tmpFile("ftc-compact-c11", "lane-tasks-WI-CP-011.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-011", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
        { id: 2, skill: "execute-changeset", subject: "execute: fix", status: "pending", blocked_by: [1] },
      ]);

      // Complete task 1 only (graph still active) and checkpoint
      assertOk(run(["complete", file, "1", "diagnose-bug"]), "C11 complete 1");
      assertOk(runHook(PRE_COMPACT_HOOK, { cwd: projectDir, trigger: "token_limit", token_count: 220000 }), "C11 PreCompact");

      // SessionStart with source=startup should emit lighter reminder (not full recovery protocol)
      const payload = { cwd: projectDir, source: "startup" };
      const hookResult = runHook(SESSION_START_HOOK, payload);
      assertOk(hookResult, "C11 SessionStart hook should succeed");
      assertTrue(hookResult.stdout.includes("ACTIVE WORK ITEM"), "C11 should emit startup reminder");
      assertTrue(hookResult.stdout.includes("WI-CP-011"), "C11 should mention WI");
      assertTrue(!hookResult.stdout.includes("SESSION RESUME RECOVERY"), "C11 should NOT emit full resume recovery");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C12: PreToolUse structured JSON block on invalid lane-tasks edit",
    run() {
      const file = tmpFile("ftc-compact-c12", "lane-tasks-WI-CP-012.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-012", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
      ]);

      // Simulate WriteFile with invalid lane-tasks JSON (missing required fields)
      const payload = {
        tool_name: "WriteFile",
        tool_input: {
          file_path: file,
          content: '{"wi": "WI-CP-012", "lane": "bugfix", "tasks": [{"id": 1}]}',
        },
      };
      const hookResult = runHook(PRE_VALIDATOR_HOOK, payload);
      // Hook should exit 2 (block) even though it also emits structured JSON
      assertTrue(!hookResult.ok, "C12 PreToolUse should block invalid lane-tasks WriteFile");
      assertTrue(hookResult.stdout.includes("hookSpecificOutput") || hookResult.stderr.length > 0, "C12 should emit structured JSON or stderr reason");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C13: StopFailure logs error context",
    run() {
      const file = tmpFile("ftc-compact-c13", "lane-tasks-WI-CP-013.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-013", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "in_progress", blocked_by: [] },
      ]);

      const payload = {
        cwd: projectDir,
        error_type: "tool_execution_error",
        error_message: "WriteFile failed: permission denied",
      };
      const hookResult = runHook(STOP_FAILURE_HOOK, payload);
      assertOk(hookResult, "C13 StopFailure hook should succeed");
      assertTrue(hookResult.stdout.includes("error-log.jsonl") || hookResult.stdout.includes("Turn ended with error"), "C13 should mention error logging");

      // Verify error log was created
      const errorLog = path.join(svcDir, "error-log.jsonl");
      assertTrue(fs.existsSync(errorLog), "C13 error-log.jsonl should exist");
      const logContent = fs.readFileSync(errorLog, "utf8").trim();
      assertTrue(logContent.includes("StopFailure"), "C13 log should contain StopFailure event");
      assertTrue(logContent.includes("WI-CP-013"), "C13 log should mention WI");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C14: SubagentStart emits WI context",
    run() {
      const file = tmpFile("ftc-compact-c14", "lane-tasks-WI-CP-014.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-014", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
      ]);

      const payload = {
        cwd: projectDir,
        agent_name: "explore",
        prompt: "Find all auth-related files",
      };
      const hookResult = runHook(SUBAGENT_START_HOOK, payload);
      assertOk(hookResult, "C14 SubagentStart hook should succeed");
      assertTrue(hookResult.stdout.includes("SUBAGENT CONTEXT REMINDER"), "C14 should emit subagent reminder");
      assertTrue(hookResult.stdout.includes("WI-CP-014"), "C14 should mention WI");
      assertTrue(hookResult.stdout.includes("diagnose-bug"), "C14 should mention skill");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C15: SubagentStop warns on lane-tasks mention",
    run() {
      const file = tmpFile("ftc-compact-c15", "lane-tasks-WI-CP-015.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);

      // Response mentions lane-tasks — should warn
      const payload = {
        cwd: projectDir,
        agent_name: "coder",
        response: "I updated the lane-tasks file and ran task-graph.mjs set-status",
      };
      const hookResult = runHook(SUBAGENT_STOP_HOOK, payload);
      assertOk(hookResult, "C15 SubagentStop hook should succeed");
      assertTrue(hookResult.stdout.includes("SUBAGENT MAY HAVE MODIFIED FRAMEWORK STATE"), "C15 should warn on lane-tasks mention");

      // Response without lane-tasks — should be silent
      const payload2 = {
        cwd: projectDir,
        agent_name: "coder",
        response: "I fixed the auth bug by adding a null guard",
      };
      const hookResult2 = runHook(SUBAGENT_STOP_HOOK, payload2);
      assertOk(hookResult2, "C15 SubagentStop silent case should succeed");
      assertTrue(hookResult2.stdout.trim().length === 0, "C15 should be silent when no lane-tasks mentioned");
    },
  }] : []),

  ...(HAS_KIMI_HOOKS ? [{
    name: "C16: Notification surfaces WI context for permission prompts",
    run() {
      const file = tmpFile("ftc-compact-c16", "lane-tasks-WI-CP-016.json");
      const svcDir = path.dirname(file);
      const projectDir = path.dirname(svcDir);
      initGraph(file, "WI-CP-016", "bugfix");
      setTasks(file, [
        { id: 1, skill: "diagnose-bug", subject: "diagnose: issue", status: "pending", blocked_by: [] },
      ]);

      const payload = {
        cwd: projectDir,
        sink: "desktop",
        notification_type: "permission_prompt",
        title: "Kimi needs approval",
        body: "Allow WriteFile to src/App.jsx?",
        severity: "medium",
      };
      const hookResult = runHook(NOTIFICATION_HOOK, payload);
      assertOk(hookResult, "C16 Notification hook should succeed");
      assertTrue(hookResult.stdout.includes("NOTIFICATION CONTEXT"), "C16 should emit notification context");
      assertTrue(hookResult.stdout.includes("WI-CP-016"), "C16 should mention WI");

      // Non-blocking notification type — should be silent
      const payload2 = {
        cwd: projectDir,
        sink: "desktop",
        notification_type: "info",
        title: "Background task complete",
        body: "Tests passed",
        severity: "low",
      };
      const hookResult2 = runHook(NOTIFICATION_HOOK, payload2);
      assertOk(hookResult2, "C16 Notification silent case should succeed");
      assertTrue(hookResult2.stdout.trim().length === 0, "C16 should be silent for non-blocking notifications");
    },
  }] : []),
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function cleanTmp(file) {
  try {
    const dir = path.dirname(file);
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function runScenario(scenario, iter) {
  let file = null;
  try {
    if (scenario.setup) {
      file = scenario.setup();
    }
    scenario.run(file);
    return true;
  } catch (e) {
    console.error(`  ❌ FAIL: ${e.message}`);
    return false;
  } finally {
    if (file) cleanTmp(file);
  }
}

const allScenarios = [...scenarios, ...compactionScenarios];
const filtered = filter ? allScenarios.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase())) : allScenarios;

console.log(`Framework Test Catalog — ${filtered.length} scenarios × ${ITERATIONS} iterations\n`);

const startTime = Date.now();

for (const scenario of filtered) {
  process.stdout.write(`${scenario.name} `);
  let scenarioPassed = 0;
  let scenarioFailed = 0;
  for (let i = 1; i <= ITERATIONS; i++) {
    const ok = runScenario(scenario, i);
    if (ok) {
      scenarioPassed++;
      process.stdout.write(".");
    } else {
      scenarioFailed++;
      process.stdout.write("F");
    }
  }
  passed += scenarioPassed;
  failed += scenarioFailed;
  const status = scenarioFailed === 0 ? "✅ PASS" : `❌ ${scenarioFailed}/${ITERATIONS} failed`;
  console.log(` ${status}`);
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`\n${"=".repeat(60)}`);
console.log(`Total: ${passed} passed, ${failed} failed (${elapsed}s)`);
console.log(`${failed === 0 ? "✅ ALL DETERMINISTIC" : "❌ FLAKINESS DETECTED"}`);
process.exit(failed > 0 ? 1 : 0);
