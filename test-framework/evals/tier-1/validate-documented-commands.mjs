#!/usr/bin/env node
/** Tier 1: commands the skills tell sessions to run do what the skills say. Each case was
 * broken on 2026-10-11: `task-graph.mjs checkpoint` (called by 55 skills) did not exist;
 * `resolve-model.sh <label> --json` printed plain text because the format flag was eaten
 * by the argument parser; `prompt-floor-route.mjs --task` (craft-prompt's spelling) left
 * the class unset so the floor never armed; the shipped example dispatch policy failed the
 * resolver's own validation. Hermetic, no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const node = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: "utf8", ...opts });

test("task-graph checkpoint writes the recovery file the skills read", () => {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), "cp-"));
  assert.equal(node([path.join(ROOT, "scripts/compile-delivery-graph.mjs"), "--wi", "WI-9", "--intent", "x", "--repo-mode", "greenfield", "--change-type", "feature", "--lane", "greenfield", "--delivery-profile", "prototype", "--delivery-tier", "end_to_end", "--out", ".svc/lane-tasks-WI-9.json"], { cwd: p }).status, 0);
  const r = node([path.join(ROOT, "scripts/task-graph.mjs"), "checkpoint", ".svc/lane-tasks-WI-9.json"], { cwd: p });
  assert.equal(r.status, 0, r.stderr);
  const cp = JSON.parse(fs.readFileSync(path.join(p, ".svc/.checkpoint-WI-9.checkpoint.json"), "utf8"));
  assert.equal(cp.wi, "WI-9");
  assert.ok(cp.next_task?.id && cp.next_task.skill, "names the next runnable task and its skill");
});

test("the example dispatch policy is valid, and resolve-model honours its format flags", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "rm-"));
  fs.mkdirSync(path.join(home, ".svc"));
  const policy = path.join(home, ".svc", "dispatch-policy.json");
  fs.copyFileSync(path.join(ROOT, "examples/dispatch-policy.example.json"), policy); fs.chmodSync(policy, 0o600);
  const env = { ...process.env, HOME: home, SVC_HOST: "claude", SVC_DISPATCH_POLICY: "", SVC_REVIEWER_POLICY: "" };
  const run = (...a) => spawnSync("bash", [path.join(ROOT, "scripts/resolve-model.sh"), "EXEC", ...a], { env, encoding: "utf8" });
  const json = run("--json");
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).label, "EXEC", "--json prints JSON");
  assert.match(run("--effort").stdout.trim(), /^(low|medium|high|xhigh|max)$/, "--effort prints only the effort");
  assert.match(run().stdout.trim(), /^[\w.-]+:[\w.-]+$/, "no flag prints provider:model");
});

test("prompt-floor-route reads the class from --task as craft-prompt documents", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pf-"));
  fs.mkdirSync(path.join(root, ".svc")); fs.writeFileSync(path.join(root, ".svc/chain-policy.json"), '{"prompt_craft":"measured"}');
  const viaTask = JSON.parse(node([path.join(ROOT, "scripts/prompt-floor-route.mjs"), "--task", "infra", "--size", "M", "--root", root, "--orchestrator-family", "claude"]).stdout);
  const viaClass = JSON.parse(node([path.join(ROOT, "scripts/prompt-floor-route.mjs"), "--class", "infra", "--size", "M", "--root", root, "--orchestrator-family", "claude"]).stdout);
  assert.deepEqual(viaTask, viaClass);
  assert.equal(viaTask.run, true);
});
