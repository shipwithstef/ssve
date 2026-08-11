#!/usr/bin/env node
// check-plan-deploy-dependency.mjs — WI-512 §3g rule 5: catch a task graph
// whose first feature task transitively depends on a deploy-class task.
// Deploying is not an executor task; it happens after merge, deliberately,
// by a human. If a non-deploy task's dependency chain reaches a deploy-class
// task, the graph is wrong and no feature code can start until prod is live.
//
// I/O: reads a `.svc/lane-tasks-<WI>.json`-shaped file (argv --lane-tasks
// <path>). Inspects its `tasks[]` array (`id`, `subject`, `name`,
// `description`, `skill`, `metadata.skill`, `blocked_by`). No deps, no git
// calls.
//
// Exit 0: { violations: [] }
// Exit 1: { violations: [{ task, path_to_deploy_task }] }
// Exit 2: usage error (missing arg, unreadable/unparsable file, or a file
//         with no 'tasks' array — fail-closed, never silently "no violations")

import fs from "node:fs";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const lanePath = arg("--lane-tasks");
if (!lanePath) {
  process.stderr.write("check-plan-deploy-dependency: usage: --lane-tasks <path>\n");
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(lanePath, "utf8"));
} catch (e) {
  process.stderr.write(`check-plan-deploy-dependency: cannot read/parse ${lanePath}: ${e.message}\n`);
  process.exit(2);
}

// Fail closed: a malformed/missing tasks array must never read as "no violations".
if (!Array.isArray(data.tasks)) {
  process.stderr.write(`check-plan-deploy-dependency: '${lanePath}' has no 'tasks' array — cannot classify (fail-closed)\n`);
  process.exit(2);
}
const tasks = data.tasks;

// Anchored so free-text "release" (e.g. "release notes", "release separation")
// never matches — only deploy/promote-to-prod/go-live, word-bounded.
const DEPLOY_RE = /(^|[^a-z])(deploy(ment)?|promote-to-prod|go-live)([^a-z]|$)/i;

function isDeployClass(t) {
  const label = `${t.id ?? ""} ${t.subject ?? ""} ${t.name ?? ""} ${t.description ?? ""} ${t.skill ?? ""} ${t.metadata?.skill ?? ""}`;
  return DEPLOY_RE.test(label);
}

function taskLabel(t) {
  return (t && (t.subject || t.skill)) || String(t && t.id);
}

const byId = new Map(tasks.map((t) => [t.id, t]));

// BFS from startId along blocked_by edges; returns the id-path (start..target)
// to the NEAREST deploy-class task reachable, or null if none is reachable.
function pathToDeployTask(startId) {
  const queue = [[startId]];
  const seen = new Set([startId]);
  while (queue.length) {
    const path = queue.shift();
    const current = byId.get(path[path.length - 1]);
    if (!current) continue;
    for (const depId of current.blocked_by || []) {
      if (seen.has(depId)) continue;
      seen.add(depId);
      const nextPath = [...path, depId];
      const dep = byId.get(depId);
      if (dep && isDeployClass(dep)) return nextPath;
      queue.push(nextPath);
    }
  }
  return null;
}

const violations = [];
for (const t of tasks) {
  if (isDeployClass(t)) continue; // deploy-class tasks may depend on anything
  const path = pathToDeployTask(t.id);
  if (path) {
    violations.push({
      task: taskLabel(t),
      path_to_deploy_task: path.map((id) => taskLabel(byId.get(id))),
    });
  }
}

process.stdout.write(JSON.stringify({ violations }, null, 2) + "\n");
process.exit(violations.length ? 1 : 0);
