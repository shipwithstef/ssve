// Where a task lives, for the graders. One helper so no grader builds `tasks/<task>` itself.
//
// In-repo tasks live in test-framework/outcome-evals/tasks/<task>/ with their specs in
// northstar/specs/<task>/ and grader-side reference overlays in northstar/ref-ep/<task>/.
// Tasks kept OUTSIDE the repo (the reserve R1/R2) sit under extra roots named by the
// environment variable NORTHSTAR_TASK_ROOTS (absolute directories, path.delimiter separated).
// An external task directory has the same layout as an in-repo one and also carries its own
// grader material:
//
//   <root>/<task>/spec.md task.json repo/ ref/ hidden.test.mjs   the task, as in-repo
//   <root>/<task>/specs/{E,S,P,K}.json                            the component specs
//   <root>/<task>/specs/probes/...                                probe scripts a K/S spec references
//   <root>/<task>/specs/ref-s, ref-k                              reference builds used by tests
//   <root>/<task>/ref-ep/                                         grader-side overlay for graders/check.mjs
//
// Precedence is the same as the runner's taskDir: the in-repo tasks directory first, then the
// extra roots in order. Nothing outside the repo is ever read unless the variable names it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NORTHSTAR_DIR = path.resolve(HERE, "..");
export const IN_REPO_TASKS = path.resolve(NORTHSTAR_DIR, "..", "tasks");
export const IN_REPO_SPECS = path.join(NORTHSTAR_DIR, "specs");
export const GRADERS_DIR = HERE;
export const TASK_ROOTS_ENV = "NORTHSTAR_TASK_ROOTS";
export const GRADERS_URL = import.meta.url; // a file in the graders directory

// The extra roots from the environment (or from `value`): absolute entries only, de-duplicated.
export function extraTaskRoots(value = process.env[TASK_ROOTS_ENV]) {
  const out = [];
  for (const r of String(value || "").split(path.delimiter)) {
    if (r && path.isAbsolute(r) && !out.includes(path.resolve(r))) out.push(path.resolve(r));
  }
  return out;
}

export function taskDirFor(task, { roots = extraTaskRoots(), inRepo = IN_REPO_TASKS } = {}) {
  if (fs.existsSync(path.join(inRepo, task))) return path.join(inRepo, task);
  for (const r of roots) if (fs.existsSync(path.join(r, task))) return path.join(r, task);
  return path.join(inRepo, task);
}

export function isExternalTask(task, opts) {
  const rel = path.relative(opts?.inRepo ?? IN_REPO_TASKS, taskDirFor(task, opts));
  return rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel);
}

// Directory holding <C>.json (and the probes and reference builds the specs refer to).
export function specDirFor(task, opts) {
  return isExternalTask(task, opts) ? path.join(taskDirFor(task, opts), "specs") : path.join(opts?.specs ?? IN_REPO_SPECS, task);
}

// Grader-side reference overlay used by check.mjs (never shown to an arm).
export function refEpDirFor(task, opts) {
  return isExternalTask(task, opts) ? path.join(taskDirFor(task, opts), "ref-ep") : path.join(NORTHSTAR_DIR, "ref-ep", task);
}

// Every directory that must be hidden from code under test: the in-repo tasks and each extra root.
export function taskMaskDirs({ roots = extraTaskRoots(), inRepo = IN_REPO_TASKS } = {}) {
  return [inRepo, ...roots].filter((d) => fs.existsSync(d));
}
