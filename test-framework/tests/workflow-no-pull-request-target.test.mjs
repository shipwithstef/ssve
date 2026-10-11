// @organism-suite
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guard: PR code must never run with the base repo's secrets and write token. A workflow triggered by
// pull_request_target runs in the base context, so it may not be used unless it is on the allowlist below
// AND never checks out or runs the PR head. The allowlist is empty today; adding an entry is a deliberate,
// reviewed change to this file.
const ALLOWLIST = new Set([]); // workflow file basenames, e.g. "label-pr.yml"

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const workflowDir = path.join(root, ".github", "workflows");

const stripComments = (text) => text.split("\n").map((line) => line.replace(/(^|\s)#.*$/, "")).join("\n");

export function usesPullRequestTarget(text) {
  return /(^|[\s\[,{"'-])pull_request_target(?=[\s\]},:"']|$)/m.test(stripComments(text));
}

// References that put PR-controlled code or refs into a base-context job.
const PR_HEAD_PATTERNS = [
  /github\.event\.pull_request\.head\.(sha|ref|repo)/,
  /github\.head_ref/,
  /refs\/pull\/.*\/(head|merge)/,
  /github\.event\.workflow_run\.head_(sha|branch|repository)/,
  /gh\s+pr\s+checkout/,
  /hub\s+pr\s+checkout/,
];

export function checksOutPullRequestHead(text) {
  const body = stripComments(text);
  return PR_HEAD_PATTERNS.some((re) => re.test(body));
}

function listWorkflows() {
  if (!fs.existsSync(workflowDir)) return [];
  return fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name)).sort();
}

test("no workflow uses pull_request_target unless allowlisted", () => {
  const offenders = [];
  for (const name of listWorkflows()) {
    const text = fs.readFileSync(path.join(workflowDir, name), "utf8");
    if (usesPullRequestTarget(text) && !ALLOWLIST.has(name)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `pull_request_target is not allowed (add to ALLOWLIST only after review): ${offenders.join(", ")}`);
});

test("allowlisted pull_request_target workflows never check out or run the PR head", () => {
  for (const name of ALLOWLIST) {
    const file = path.join(workflowDir, name);
    assert.ok(fs.existsSync(file), `allowlisted workflow is missing: ${name}`);
    const text = fs.readFileSync(file, "utf8");
    assert.ok(usesPullRequestTarget(text), `allowlist entry no longer uses pull_request_target: ${name}`);
    assert.ok(!checksOutPullRequestHead(text), `${name} checks out or runs the PR head under pull_request_target`);
  }
});

test("workflow_run triggered by a PR does not check out the PR head either", () => {
  for (const name of listWorkflows()) {
    const text = stripComments(fs.readFileSync(path.join(workflowDir, name), "utf8"));
    if (/(^|\s)workflow_run\s*:/m.test(text)) {
      assert.ok(!/github\.event\.workflow_run\.head_(sha|branch|repository)/.test(text), `${name} checks out the workflow_run head`);
    }
  }
});

test("detector recognises the trigger in map, list and scalar forms", () => {
  assert.ok(usesPullRequestTarget("on:\n  pull_request_target:\n    types: [opened]\n"));
  assert.ok(usesPullRequestTarget("on: [push, pull_request_target]\n"));
  assert.ok(usesPullRequestTarget("on: pull_request_target\n"));
  assert.ok(usesPullRequestTarget("on:\n  - pull_request_target\n"));
  assert.ok(usesPullRequestTarget("on: { pull_request_target: {} }\n"));
  assert.ok(!usesPullRequestTarget("on:\n  pull_request: {}\n"));
  assert.ok(!usesPullRequestTarget("# pull_request_target is forbidden\non:\n  pull_request: {}\n"));
});

test("detector flags PR-head checkouts", () => {
  assert.ok(checksOutPullRequestHead("with:\n  ref: ${{ github.event.pull_request.head.sha }}\n"));
  assert.ok(checksOutPullRequestHead("run: gh pr checkout ${{ github.event.number }}\n"));
  assert.ok(checksOutPullRequestHead("with:\n  ref: refs/pull/${{ github.event.number }}/merge\n"));
  assert.ok(!checksOutPullRequestHead("uses: actions/checkout@v4\n"));
});
