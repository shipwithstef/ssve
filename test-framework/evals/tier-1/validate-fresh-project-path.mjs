#!/usr/bin/env node
/** Tier 1: the framework's own path works in a user's project, not only in this repository.
 * Runs, from a brand-new project directory and through a symlinked install (as ./setup lays
 * it out), the scripts route-workflow tells a session to run: initialise state, reconcile,
 * isolate a worktree, compile the delivery graph, walk the task graph. Each step found
 * broken on 2026-10-11 has a case: scripts that silently did nothing through the symlink,
 * reconcile failing on a repo with no remote or no commits, adoption blocked by history
 * that predates the framework, worktrees requiring origin/main. Hermetic, no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const install = fs.mkdtempSync(path.join(os.tmpdir(), "svc-install-"));
for (const d of ["scripts", "references", "schemas", "templates", "_shared", "hooks"]) fs.symlinkSync(path.join(ROOT, d), path.join(install, d));
const env = { ...process.env, SVC_SESSION_ID: crypto.randomUUID(), HOME: fs.mkdtempSync(path.join(os.tmpdir(), "svc-home-")), SVC_CHAIN_POLICY: "", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const svc = (cwd, script, ...args) => spawnSync(process.execPath, [path.join(install, "scripts", script), ...args], { cwd, env, encoding: "utf8" });
const git = (cwd, ...args) => spawnSync("git", args, { cwd, env, encoding: "utf8" });
const project = (commits) => { const p = fs.mkdtempSync(path.join(os.tmpdir(), "svc-proj-")); git(p, "init", "-q", "-b", "main"); for (let i = 0; i < commits; i++) git(p, "commit", "-q", "--allow-empty", "-m", `c${i}`); return p; };

test("a new empty project: init, reconcile, compile and walk the graph", () => {
  const p = project(0);
  assert.equal(svc(p, "init-project-state.mjs").status, 0);
  assert.ok(fs.existsSync(path.join(p, ".svc", "orchestrator-state.json")));
  assert.equal(svc(p, "svc-reconcile.mjs").status, 0, "no commits: nothing to reconcile");
  const w = svc(p, "svc-ensure-worktree.mjs", "--wi", "WI-001", "--branch", "wi-001", "--from", "origin/main", "--json");
  assert.match(w.stderr, /NO_COMMITS: .*Work in place/, "an empty repo says what to do instead of failing obscurely");
  const c = svc(p, "compile-delivery-graph.mjs", "--wi", "WI-001", "--intent", "make a game", "--repo-mode", "greenfield", "--change-type", "feature", "--lane", "greenfield", "--delivery-profile", "prototype", "--delivery-tier", "end_to_end", "--out", ".svc/lane-tasks-WI-001.json");
  assert.equal(c.status, 0, c.stderr);
  const graph = JSON.parse(fs.readFileSync(path.join(p, ".svc", "lane-tasks-WI-001.json"), "utf8"));
  assert.equal(graph.delivery_graph.planning.mode, "bounded", "prototype on a product lane plans bounded");
  const next = svc(p, "task-graph.mjs", "next", ".svc/lane-tasks-WI-001.json");
  assert.equal(next.status, 0, next.stderr);
  assert.ok(JSON.parse(next.stdout).metadata.skill, "the next task names its skill");
  // One graph per work item: a story-type template must not replace the compiled graph.
  const gen = svc(p, "task-graph.mjs", "generate", ".svc/lane-tasks-WI-001.json", "--wi", "WI-001", "--story-type", "feature", "--lane", "greenfield");
  assert.notEqual(gen.status, 0);
  assert.match(gen.stderr, /delivery graph is already compiled for WI-001/);
});

test("an existing project adopts the framework without being blocked by its history, and new work is still checked", () => {
  const p = project(2);
  assert.equal(svc(p, "init-project-state.mjs").status, 0);
  const r = svc(p, "svc-reconcile.mjs");
  assert.equal(r.status, 0, `history before adoption is not unaccounted work: ${r.stderr}`);
  fs.writeFileSync(path.join(p, "a.txt"), "x"); git(p, "add", "a.txt"); git(p, "commit", "-q", "-m", "after adoption, no receipts");
  const after = svc(p, "svc-reconcile.mjs");
  assert.equal(after.status, 1, "a commit after adoption without receipts is still unaccounted");
  assert.match(after.stderr, /1 unaccounted commits/);
});

test("a local project with no remote gets an isolated worktree from its own branch", () => {
  const p = project(1);
  const w = svc(p, "svc-ensure-worktree.mjs", "--wi", "WI-002", "--branch", "wi-002", "--from", "origin/main", "--json");
  assert.equal(w.status, 0, w.stderr);
  const out = JSON.parse(w.stdout.trim().split("\n").pop());
  assert.equal(out.created, true);
  assert.ok(fs.existsSync(out.absolute_worktree));
});

test("a fresh install with no owner dispatch policy resolves models and reviewers from the framework default", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "svc-home-"));
  const base = { ...process.env, HOME: home, SVC_HOST: "claude", SVC_DISPATCH_POLICY: "", SVC_REVIEWER_POLICY: "" };
  delete base.SVC_DISPATCH_POLICY; delete base.SVC_REVIEWER_POLICY;
  const model = spawnSync("bash", [path.join(install, "scripts", "resolve-model.sh"), "EXEC", "--json"], { env: base, encoding: "utf8" });
  assert.equal(model.status, 0, model.stderr);
  const m = JSON.parse(model.stdout);
  assert.equal(m.source, "framework-default-policy", "labelled as the framework default, not an owner choice");
  const review = spawnSync(process.execPath, [path.join(install, "scripts", "run-external-review.mjs"), "--policy-status", "--orchestrator", "claude"], { env: base, encoding: "utf8" });
  assert.equal(review.status, 0, review.stderr);
  assert.equal(JSON.parse(review.stdout).ok, true);
  // Fail closed where it matters: a present but invalid owner file, or a named path that is missing.
  fs.mkdirSync(path.join(home, ".svc")); fs.writeFileSync(path.join(home, ".svc", "dispatch-policy.json"), "{bad"); fs.chmodSync(path.join(home, ".svc", "dispatch-policy.json"), 0o600);
  assert.notEqual(spawnSync("bash", [path.join(install, "scripts", "resolve-model.sh"), "EXEC"], { env: base, encoding: "utf8" }).status, 0, "malformed owner policy fails closed");
  const named = spawnSync("bash", [path.join(install, "scripts", "resolve-model.sh"), "EXEC"], { env: { ...base, HOME: fs.mkdtempSync(path.join(os.tmpdir(), "svc-home-")), SVC_DISPATCH_POLICY: "/nonexistent/policy.json" }, encoding: "utf8" });
  assert.notEqual(named.status, 0, "a named policy path that is missing fails");
});
