#!/usr/bin/env node
/** Tier 1: selecting checks by the files they were traced reading. Parsing keeps only real
 * repository files (and directories that were listed), drops failed lookups and stat-only
 * directory walks; selection picks a check when the diff touches what it read, when the check
 * itself changed, or when it has no trace yet. Hermetic: no strace run here. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoPathsFromTrace, select } from "../../../scripts/trace-check-deps.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("trace parsing keeps real files and listed directories only", () => {
  const log = [
    `123 openat(AT_FDCWD, "${ROOT}/scripts/task-graph.mjs", O_RDONLY|O_CLOEXEC) = 3`,
    `123 newfstatat(AT_FDCWD, "${ROOT}/scripts", {st_mode=S_IFDIR|0755}, 0) = 0`,
    `123 openat(AT_FDCWD, "${ROOT}/skills", O_RDONLY|O_NONBLOCK|O_CLOEXEC|O_DIRECTORY) = 4`,
    `123 openat(AT_FDCWD, "${ROOT}/scripts/does-not-exist.mjs", O_RDONLY) = -1 ENOENT (No such file or directory)`,
    `123 openat(AT_FDCWD, "/tmp/copy/scripts/task-graph.mjs", O_RDONLY) = 3`,
    `123 openat(AT_FDCWD, "${ROOT}/.git/HEAD", O_RDONLY) = 3`,
  ].join("\n");
  assert.deepEqual(repoPathsFromTrace(log, ROOT), ["scripts/task-graph.mjs", "skills"]);
});

test("selection follows the diff, the check's own changes, and missing traces", () => {
  const map = { checks: { "a.sh": { reads: ["scripts/x.mjs"] }, "b.mjs": { reads: ["skills"] }, "c.sh": { reads: ["docs/y.md"] } } };
  const checks = ["a.sh", "b.mjs", "c.sh", "d.mjs"];
  const pick = (changed) => select(changed, map, checks).map((p) => p.check);
  assert.deepEqual(pick(["scripts/x.mjs"]), ["a.sh", "d.mjs"], "a read it; d has no trace, so it runs");
  assert.deepEqual(pick(["skills/route-workflow/SKILL.md"]), ["b.mjs", "d.mjs"], "a listed directory covers what is inside");
  assert.deepEqual(pick(["test-framework/evals/tier-1/c.sh"]), ["c.sh", "d.mjs"], "a changed check runs");
  assert.deepEqual(pick(["README.md"]), ["d.mjs"]);
});
