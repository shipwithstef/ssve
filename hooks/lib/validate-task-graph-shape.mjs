// validate-task-graph-shape.mjs — WI-486 (EXEC-R2-003).
//
// ONE canonical task-graph SHAPE + INTEGRITY validator, shared by every path that
// decides mutation authority or task-state compatibility. Before this module the
// authority path (`activeTask`, resolve-wi `graphDecision`) and the compatibility
// path (`isWellFormedGraphShape`) each had their OWN, looser notion of "valid":
// they accepted arbitrary status strings, ignored duplicate ids, dangling/self
// blockers, and non-array blocked_by. A graph that was valid when a skill-load
// receipt was issued could later lose required fields (or gain garbage) while
// retaining id/status/skill and still satisfy the mutation gate. This validator
// closes that: it rejects UNKNOWN statuses and ALL shape/integrity violations.
//
// Deliberate scoping (proven against the tier-1 authority + compatibility fixtures
// AND the residue-safe bootstrap placeholder graph, which legitimately use string
// ids, omit `subject`, and set a graph-level `status` that is not the task-derived
// status): this validator does NOT require numeric-only ids, does NOT require a
// `subject`, and does NOT enforce graph-status DERIVATION consistency. Those are
// write-time concerns owned by scripts/task-graph.mjs (which is stricter still).
// This module is the AUTHORITY-time integrity floor: unknown statuses and
// structural corruption never confer authority.
//
// NEVER throws — invalid input returns { ok:false, reason }.

export const VALID_TASK_STATUSES = new Set(["pending", "in_progress", "completed", "blocked", "skipped"]);
export const VALID_GRAPH_STATUSES = new Set(["pending", "in_progress", "completed", "blocked", "skipped"]);

// The ONE canonical id-domain normalizer, shared by every path that compares a
// task id (authority resolver, Codex skill-load enforcer, the load CLI, and the
// receipt id check — WI-486 EXEC-R3-001). A number and its decimal string form
// collapse to the same key so a graph's numeric `1` and a command-line `"1"`
// compare equal, while a non-numeric string id ("task-1") is preserved verbatim.
// Returns null for anything that cannot confer a recoverable id.
export function recoverableId(id) {
  if (typeof id === "number") return Number.isFinite(id) ? String(id) : null;
  if (typeof id === "string") return id.length > 0 ? id : null;
  return null;
}

// validateTaskGraphShape(doc) -> { ok, reason }
// `doc` is the ALREADY-PARSED graph object (callers own JSON.parse + its failure).
export function validateTaskGraphShape(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, reason: "graph is not a JSON object" };
  }
  if (doc.status != null && !VALID_GRAPH_STATUSES.has(doc.status)) {
    return { ok: false, reason: `graph status "${doc.status}" is not a known status` };
  }
  if (!Array.isArray(doc.tasks)) {
    return { ok: false, reason: "graph.tasks is not an array" };
  }
  const ids = new Set();
  for (let i = 0; i < doc.tasks.length; i += 1) {
    const t = doc.tasks[i];
    if (!t || typeof t !== "object" || Array.isArray(t)) {
      return { ok: false, reason: `tasks[${i}] is not an object` };
    }
    const key = recoverableId(t.id);
    if (key == null) {
      return { ok: false, reason: `tasks[${i}].id is missing or not a recoverable string/number` };
    }
    // WI-498 (G6-F001): the SHAPE/authority layer intentionally accepts the
    // recoverableId string+number domain (migration, binding, and authority
    // fixtures exercise string-id shapes defensively). PRODUCTION graphs are
    // numeric by construction (scripts/svc-ensure-worktree.mjs creates id:1, and
    // scripts/task-graph.mjs validateTask + set-status/load-skill/activate-skill
    // are Number()-based), so activate-skill operates only on numeric graphs. A
    // hypothetical non-numeric graph is rejected by activate-skill's validateGraph
    // with a CLEAR error (no fail-open, no silent hang) — see the fixture. Full
    // enforcer<->operation id-domain unification is a broader pre-existing item
    // tracked as a WI-498 follow-up, not tightened here (it breaks the shape
    // contract that migration/authority fixtures depend on).
    if (ids.has(key)) {
      return { ok: false, reason: `duplicate task id: ${key}` };
    }
    ids.add(key);
    if (typeof t.status !== "string" || !VALID_TASK_STATUSES.has(t.status)) {
      return { ok: false, reason: `tasks[${i}].status "${t.status}" is not a known status` };
    }
    if (t.blocked_by != null && !Array.isArray(t.blocked_by)) {
      return { ok: false, reason: `tasks[${i}].blocked_by must be an array when present` };
    }
  }
  // Blocker integrity: every blocker must reference an existing id and no task may
  // block itself (dependency-graph corruption denies authority).
  for (let i = 0; i < doc.tasks.length; i += 1) {
    const t = doc.tasks[i];
    const selfKey = recoverableId(t.id);
    for (const blocker of t.blocked_by || []) {
      const bKey = recoverableId(blocker);
      if (bKey == null) {
        return { ok: false, reason: `tasks[${i}].blocked_by contains a non-recoverable id` };
      }
      if (bKey === selfKey) {
        return { ok: false, reason: `task ${selfKey} cannot block itself` };
      }
      if (!ids.has(bKey)) {
        return { ok: false, reason: `task ${selfKey} references missing blocker ${bKey}` };
      }
    }
  }
  return { ok: true, reason: "well-formed" };
}

// isValidTaskGraphShape(doc) -> boolean convenience wrapper.
export function isValidTaskGraphShape(doc) {
  return validateTaskGraphShape(doc).ok;
}

export default { validateTaskGraphShape, isValidTaskGraphShape, recoverableId, VALID_TASK_STATUSES, VALID_GRAPH_STATUSES };

// Same ordering as the canonical first-task loader: an existing active task,
// otherwise the first pending task whose blockers are all completed.
export function selectRecoveryTask(graph) {
  if (!validateTaskGraphShape(graph).ok) return null;
  const active = graph.tasks.filter(task => task.status === 'in_progress');
  if (active.length) return active.length === 1 ? active[0] : null;
  const byId = new Map(graph.tasks.map(task => [String(task.id), task]));
  return graph.tasks.find(task => task.status === 'pending' &&
    (task.blocked_by || []).every(id => byId.get(String(id))?.status === 'completed')) || null;
}
