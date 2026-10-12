// A docs-typo lane graph owns its staged README edit when the current stage is
// in progress, or still pending because svc-next scheduled it without flipping
// status. Staged edits with no such task stay refused.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compileDeliveryGraph } from "../../scripts/compile-delivery-graph.mjs";
import { classifyFromGit } from "../../scripts/classify-change-risk.mjs";
import { evaluateImpactTriad } from "../../hooks/svc-impact-triad-guard.mjs";

const WI = "WI-DOC-1";
const SESSION = "019f6001-5463-7dc0-a1f5-73104831606a";

function git(repo, args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

function skillOf(task) {
  return task.metadata?.skill || task.skill;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "cosmetic-owner-"));
  const real = fs.realpathSync(repo);
  git(real, ["init", "-q"]);
  git(real, ["config", "user.name", "test"]);
  git(real, ["config", "user.email", "test@example.com"]);
  const hooks = path.join(real, ".empty-hooks");
  fs.mkdirSync(hooks);
  git(real, ["config", "core.hooksPath", hooks]);
  fs.writeFileSync(path.join(real, "README.md"), "This is a tpyo.\n");
  git(real, ["add", "README.md"]);
  git(real, ["commit", "-qm", "baseline"]);
  const graph = compileDeliveryGraph({
    wi: WI,
    lane: "brownfield-feature",
    user_intent: "fix typo in README",
    repo_mode: "convert",
    change_type: "docs",
    delivery_profile: "prototype",
    delivery_tier: { mode: "end_to_end" },
    risk_flags: ["docs-only"],
    planned_files: ["README.md"],
  });
  const plan = graph.tasks.find((task) => skillOf(task) === "plan-changeset");
  assert.ok(plan, "docs graph includes plan-changeset");
  for (const task of graph.tasks) {
    if (task.id === plan.id) break;
    task.status = "skipped";
  }
  const graphPath = path.join(real, ".svc", `lane-tasks-${WI}.json`);
  writeJson(graphPath, graph);
  const branch = git(real, ["branch", "--show-current"]).trim();
  const now = new Date().toISOString();
  const claimPath = path.join(real, ".svc", "claims", `${WI}.claim.json`);
  writeJson(claimPath, {
    schema_version: 1, wi: WI, generation: 1, repo_root: real, worktree_root: real,
    branch, session_id: SESSION, role: "mutating", started_at: now, renewed_at: now, ttl_hours: 24,
  });
  writeJson(path.join(real, ".svc", "bindings", "session.json"), {
    schema_version: 1, session_id: SESSION, role: "mutating", wi: WI,
    repo_root: real, worktree_root: real, branch, claim_path: claimPath,
    created_at: now, updated_at: now, generation: 1,
  });
  return { repo: real, graphPath, planId: plan.id };
}

function stageTypo(repo) {
  fs.writeFileSync(path.join(repo, "README.md"), "This is a typo.\n");
  git(repo, ["add", "README.md"]);
}

function writeReceipt(repo, graphPath, taskId) {
  const classification = classifyFromGit({ cwd: repo, staged: true });
  const receipt = {
    schema_version: 1,
    wi: WI,
    session_id: SESSION,
    worktree_root: repo,
    task_graph: graphPath,
    task_id: taskId,
    diff_sha256: classification.sha256,
    risk_tier: classification.tier,
    risk_reasons: classification.reasons,
    breaks_what: { answer: "README wording was wrong", sources: ["README.md"], evidence: ["git diff --cached"] },
    intended_behavior: { answer: "README spells typo correctly", sources: ["README.md"], evidence: ["staged README line"] },
    product_surface: { answer: "repository README", sources: ["README.md"], evidence: ["docs-only planned file"] },
    coverage_tasks: [{ id: "coverage-1", status: "completed", owner: `${WI} task ${taskId}`, validation: "node --test cosmetic-impact-owner" }],
    independent_review: { status: "n/a", executor_family: "n/a", reviewer_family: "n/a", artifacts: [] },
    runtime_proof: { status: "pass", kind: "static", artifacts: ["README.md"] },
    created_at: new Date().toISOString(),
  };
  writeJson(path.join(repo, ".svc", "impact-triad", WI, `task-${taskId}.json`), receipt);
  return classification;
}

function loadGraph(graphPath) {
  return JSON.parse(fs.readFileSync(graphPath, "utf8"));
}

function saveGraph(graphPath, graph) {
  writeJson(graphPath, graph);
}

function evaluate(repo) {
  return evaluateImpactTriad({ cwd: repo, env: { ...process.env, SVC_SESSION_ID: SESSION } });
}

test("in-progress plan-changeset on a docs graph owns a staged README typo", () => {
  const { repo, graphPath, planId } = makeRepo();
  try {
    const graph = loadGraph(graphPath);
    const plan = graph.tasks.find((task) => task.id === planId);
    plan.status = "in_progress";
    saveGraph(graphPath, graph);
    stageTypo(repo);
    const classification = writeReceipt(repo, graphPath, planId);
    assert.equal(classification.tier, "cosmetic");
    const result = evaluate(repo);
    assert.equal(result.ok, true, result.reason);
    assert.equal(Number(result.task_id), planId);
    assert.match(result.receipt_path, /task-/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("svc-next current stage owns the mutation while it is still pending", () => {
  const { repo, graphPath, planId } = makeRepo();
  try {
    const graph = loadGraph(graphPath);
    const plan = graph.tasks.find((task) => task.id === planId);
    assert.equal(plan.status, "pending");
    assert.equal(graph.tasks.some((task) => task.status === "in_progress" || task.status === "completed"), false);
    stageTypo(repo);
    writeReceipt(repo, graphPath, planId);
    const result = evaluate(repo);
    assert.equal(result.ok, true, result.reason);
    assert.equal(Number(result.task_id), planId);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("staged changes with no owning task are still refused", () => {
  const { repo, graphPath, planId } = makeRepo();
  try {
    const graph = loadGraph(graphPath);
    for (const task of graph.tasks) {
      if (task.status !== "skipped") task.status = "blocked";
    }
    saveGraph(graphPath, graph);
    stageTypo(repo);
    writeReceipt(repo, graphPath, planId);
    const result = evaluate(repo);
    assert.equal(result.ok, false);
    assert.match(result.reason, /no in-progress or completed task owns the staged mutation/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
