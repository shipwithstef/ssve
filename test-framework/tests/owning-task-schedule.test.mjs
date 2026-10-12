// @organism-suite
// Ownership follows svc-next's schedule: a runnable stage beats a completed
// predecessor, several runnable stages are ambiguous, closeout is terminal-only,
// and a skipped chain stage with no receipt is repair rather than a satisfied blocker.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { selectOwningTask } from "../../hooks/svc-impact-triad-guard.mjs";
import { selectSchedule } from "../../scripts/svc-next.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function task(id, status, skill, blockedBy = []) {
  return { id, status, skill, metadata: { skill }, blocked_by: blockedBy };
}

function emptyRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "owning-schedule-"));
}

test("completed predecessor does not own a single runnable stage", () => {
  const root = emptyRoot();
  try {
    const graph = {
      wi: "WI-OWN-1",
      tasks: [
        task(1, "completed", "analyze-domain"),
        task(2, "pending", "write-spec", [1]),
      ],
    };
    const schedule = selectSchedule(root, graph);
    const selected = selectOwningTask(graph, root);
    assert.equal(schedule.runnable.length, 1);
    assert.equal(schedule.runnable[0].id, 2);
    assert.equal(selected.task.id, 2);
    assert.equal(selected.scheduled, true);
    assert.equal(selected.closeout, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("completed predecessor plus two runnable stages is ambiguous", () => {
  const root = emptyRoot();
  try {
    const graph = {
      wi: "WI-OWN-2",
      tasks: [
        task(1, "completed", "analyze-domain"),
        task(2, "pending", "write-spec", [1]),
        task(3, "pending", "design-ux", [1]),
      ],
    };
    const schedule = selectSchedule(root, graph);
    const selected = selectOwningTask(graph, root);
    assert.deepEqual(schedule.runnable.map((item) => item.id), [2, 3]);
    assert.match(selected.error, /multiple runnable tasks make impact ownership ambiguous/);
    assert.equal(selected.task, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("closeout is the last completed task only when the graph is terminal", () => {
  const root = emptyRoot();
  try {
    const open = {
      wi: "WI-OWN-3",
      tasks: [
        task(1, "completed", "analyze-domain"),
        task(2, "blocked", "write-spec", [1]),
      ],
    };
    assert.match(selectOwningTask(open, root).error, /no in-progress or completed task owns the staged mutation/);
    const done = {
      wi: "WI-OWN-3b",
      tasks: [
        task(1, "completed", "analyze-domain"),
        task(2, "completed", "write-spec", [1]),
      ],
    };
    const selected = selectOwningTask(done, root);
    assert.equal(selectSchedule(root, done).terminal, true);
    assert.equal(selected.task.id, 2);
    assert.equal(selected.closeout, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("skipped plan-changeset with a missing receipt is repair, not a blocker for review-plan", () => {
  const root = emptyRoot();
  try {
    const graph = {
      wi: "WI-OWN-4",
      tasks: [
        task(1, "skipped", "plan-changeset"),
        task(2, "pending", "review-plan", [1]),
      ],
    };
    const schedule = selectSchedule(root, graph);
    const selected = selectOwningTask(graph, root);
    assert.equal(schedule.runnable.length, 0);
    assert.equal(schedule.repair.id, 1);
    assert.equal(selected.task.id, 1);
    assert.equal(selected.repair, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function git(repo, args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

function receiptRepo(graph) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "owning-receipt-"));
  const real = fs.realpathSync(repo);
  git(real, ["init", "-q"]);
  git(real, ["config", "user.name", "test"]);
  git(real, ["config", "user.email", "test@example.com"]);
  const hooks = path.join(real, ".empty-hooks");
  fs.mkdirSync(hooks);
  git(real, ["config", "core.hooksPath", hooks]);
  fs.mkdirSync(path.join(real, "scripts"));
  fs.copyFileSync(path.join(ROOT, "scripts/classify-change-risk.mjs"), path.join(real, "scripts/classify-change-risk.mjs"));
  fs.writeFileSync(path.join(real, "README.md"), "before\n");
  git(real, ["add", "README.md"]);
  git(real, ["commit", "-qm", "baseline"]);
  fs.writeFileSync(path.join(real, "README.md"), "after\n");
  git(real, ["add", "README.md"]);
  fs.mkdirSync(path.join(real, ".svc"), { recursive: true });
  fs.writeFileSync(path.join(real, ".svc", `lane-tasks-${graph.wi}.json`), JSON.stringify(graph));
  return real;
}

function runAuto(repo, wi) {
  return execFileSync(process.execPath, [path.join(ROOT, "scripts/auto-receipt.mjs"), "--wi", wi], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, SVC_SESSION_ID: "owning-task-test" },
  });
}

test("auto-receipt writes the runnable stage, refuses two, and repairs a skipped chain stage", () => {
  const runnable = {
    wi: "WI-OWN-AR1",
    tasks: [
      task(1, "completed", "analyze-domain"),
      task(2, "pending", "write-spec", [1]),
    ],
  };
  const ambiguous = {
    wi: "WI-OWN-AR2",
    tasks: [
      task(1, "completed", "analyze-domain"),
      task(2, "pending", "write-spec", [1]),
      task(3, "pending", "design-ux", [1]),
    ],
  };
  const repair = {
    wi: "WI-OWN-AR3",
    tasks: [
      task(1, "skipped", "plan-changeset"),
      task(2, "pending", "review-plan", [1]),
    ],
  };
  const repos = [receiptRepo(runnable), receiptRepo(ambiguous), receiptRepo(repair)];
  try {
    const wrote = runAuto(repos[0], runnable.wi);
    assert.match(wrote, /task=2/);
    const body = JSON.parse(fs.readFileSync(path.join(repos[0], ".svc/impact-triad", runnable.wi, "task-2.json"), "utf8"));
    assert.equal(body.task_id, "2");
    assert.equal(fs.existsSync(path.join(repos[0], ".svc/impact-triad", runnable.wi, "task-1.json")), false);

    assert.throws(() => runAuto(repos[1], ambiguous.wi), (error) => {
      assert.match(String(error.stderr), /multiple runnable tasks make impact ownership ambiguous/);
      return true;
    });

    const repaired = runAuto(repos[2], repair.wi);
    assert.match(repaired, /task=1/);
    const repairBody = JSON.parse(fs.readFileSync(path.join(repos[2], ".svc/impact-triad", repair.wi, "task-1.json"), "utf8"));
    assert.equal(repairBody.task_id, "1");
  } finally {
    for (const repo of repos) fs.rmSync(repo, { recursive: true, force: true });
  }
});
