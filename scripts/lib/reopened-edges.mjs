// Dependency edges of reopened stages.
//
// A completed task keeps its old blocked_by when a graph is recompiled (completed work is preserved).
// When the task is later reopened because its obligation changed (risk raised, bounded plan promoted to a
// contract plan), those old edges are stale: the reopened stage must wait for what the CURRENT obligations
// require, not for what the lighter plan required. The compiler passes the edges it computed from the
// current obligations (already mapped to the merged graph's task ids) and this module rebuilds the edges of
// every reopened task from them.

const isResearch = (task) => (task?.metadata?.skill || task?.skill) === 'research';

/**
 * @param {object[]} tasks merged graph tasks (mutated in place).
 * @param {Map<number, number[]>} requiredEdges task id -> ids it must wait for under the current obligations.
 * @returns {{id:number, removed:number[], added:number[]}[]} the edge changes, for mutation_history.
 */
export function rebuildReopenedEdges(tasks, requiredEdges) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const changes = [];
  for (const task of tasks) {
    if (task.status !== 'pending' || !task.metadata?.reopened || !requiredEdges.has(task.id)) continue;
    const before = task.blocked_by || [];
    // Research requestor edges are owned by the research wiring, not by the obligations.
    const research = before.filter((id) => isResearch(byId.get(id)));
    const required = requiredEdges.get(task.id).filter((id) => byId.has(id) && id !== task.id);
    const after = [...new Set([...required, ...research])];
    const removed = before.filter((id) => !after.includes(id));
    const added = after.filter((id) => !before.includes(id));
    task.blocked_by = after;
    if (removed.length || added.length) changes.push({ id: task.id, removed, added });
  }
  return changes;
}
