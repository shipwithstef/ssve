#!/usr/bin/env node
/**
 * partition-task-graph — the HARD pre-dispatch fence for intra-changeset parallel
 * execution (WI-388 core). execute-changeset's manifest task graph has independent
 * nodes that could run as parallel worktree-isolated agents (in-session, on
 * subscription) instead of serially. This partitions the graph into dependency-
 * ordered waves and — the load-bearing safety (AC1) — REFUSES to parallelize any
 * wave whose task file-sets intersect, ESCALATING THAT WAVE TO SEQUENTIAL. The
 * single disjoint-file validator "is the difference between fenced and vibes".
 *
 * AC2: cross-task dependencies map onto pipeline() STAGE ORDER (the wave levels),
 * never parallel() — a task runs only after every dependency's wave. AC4: parallel
 * task results are schema-forced (schemas/task-node-result.schema.json), replacing
 * the fragile grep-for-SVC_WORKER_SUMMARY.
 *
 * Reuses the closed-loop fail-safe disjoint primitive (scripts/lib/disjoint-scopes.mjs).
 *
 * Usage:
 *   node scripts/partition-task-graph.mjs --graph <task-graph.json>   # prints waves; exit 1 on a cycle/unresolvable dep
 * Input: { tasks: [{ id, files:[...], deps:[...] }] }  (files = touched paths; deps = task ids)
 */

import { readFileSync } from "node:fs";
import { disjointScopes } from "./lib/disjoint-scopes.mjs";

// Pure: partition tasks into dependency-ordered waves; each wave is parallel ONLY
// if its task file-sets are pairwise disjoint, else escalate-to-sequential.
export function partitionTaskGraph(tasks) {
  const list = (Array.isArray(tasks) ? tasks : []).map((t) => ({
    id: String(t && t.id || ""),
    files: Array.isArray(t && (t.files || t.touched_files)) ? (t.files || t.touched_files).map(String) : [],
    deps: Array.isArray(t && (t.deps || t.dependencies)) ? (t.deps || t.dependencies).map(String) : [],
  }));
  if (list.length === 0) return { ok: false, reason: "empty task graph", waves: [] };
  const ids = new Set(list.map((t) => t.id));
  if (ids.size !== list.length) return { ok: false, reason: "duplicate or empty task id", waves: [] };
  // an unknown dependency is a config error → fail-closed
  for (const t of list) for (const d of t.deps) if (!ids.has(d)) return { ok: false, reason: `task ${t.id} depends on unknown task ${d}`, waves: [] };

  const placed = new Set();
  const waves = [];
  let guard = list.length + 1;
  while (placed.size < list.length && guard-- > 0) {
    // a task is ready when every dep is already placed in an EARLIER wave
    const ready = list.filter((t) => !placed.has(t.id) && t.deps.every((d) => placed.has(d)));
    if (ready.length === 0) return { ok: false, reason: "dependency cycle (no runnable task) — fail-closed to sequential", waves };
    // AC1: this candidate parallel wave is safe ONLY if file-sets are disjoint.
    const scopes = {};
    for (const t of ready) scopes[t.id] = t.files;
    const { disjoint, overlaps } = disjointScopes(scopes);
    waves.push({
      tasks: ready.map((t) => t.id),
      parallel: ready.length > 1 ? disjoint : false,           // 1 task = trivially sequential
      escalated_to_sequential: ready.length > 1 && !disjoint,  // AC1: overlap → sequential
      overlaps: disjoint ? [] : overlaps,
    });
    for (const t of ready) placed.add(t.id);
  }
  if (placed.size < list.length) return { ok: false, reason: "could not place all tasks (cycle)", waves };
  return { ok: true, waves };
}

function argVal(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1] || null; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const gp = argVal("--graph");
  if (!gp) { console.error("usage: partition-task-graph --graph <task-graph.json>"); process.exit(2); }
  let graph;
  try { graph = JSON.parse(readFileSync(gp, "utf8")); } catch (e) { console.error(`partition-task-graph: bad graph json — ${e.message}`); process.exit(1); }
  const r = partitionTaskGraph(graph.tasks || graph.task_graph || graph);
  process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  if (!r.ok) { console.error(`partition-task-graph: REFUSE — ${r.reason}`); process.exit(1); }
  const escalated = r.waves.filter((w) => w.escalated_to_sequential);
  if (escalated.length) console.error(`partition-task-graph: ${escalated.length} wave(s) escalated to sequential on file overlap (safe).`);
}
