# Spec-Code Sync Report

**Skill:** sync-spec-code
**Mode:** Convert (checking existing specs against each other and against new additions)
**Date:** 2026-04-03
**Scope:** All feature and enabler specs in todo-api, including new feature-realtime-collab

---

## 1. Existing Spec Consistency Check

### feature-todo-management vs enabler-overdue-checker

| Check | Status | Detail |
|-------|--------|--------|
| AC-1.3 schema includes `status` field | RESOLVED | Both specs agree: status can be "pending", "done", or "overdue" |
| AC-2.1 allows PATCH to "done" | RESOLVED | enabler-overdue-checker AC-1.3 confirms "done" todos are never changed to "overdue" -- consistent |
| AC-2.3 `completedAt` timestamp | RESOLVED | overdue-checker does not set completedAt -- only PATCH to "done" does. No conflict |
| Journey J01 references both specs | RESOLVED | Layer 3 analysis in J01 confirms every step is grounded in an AC from one of these two specs |
| In-memory store assumption | RESOLVED | Both specs note in-memory store in Implementation Notes -- consistent |

**Verdict:** Existing specs are fully consistent. No drift detected.

---

## 2. New Feature Impact Analysis

### feature-realtime-collab vs feature-todo-management

| Check | Status | Detail |
|-------|--------|--------|
| REST API contract unchanged | RESOLVED | feature-realtime-collab adds WS side-effects but does not modify POST/GET/PATCH/DELETE behavior |
| Todo schema reuse (COL-1.4 references AC-1.3) | RESOLVED | COL-1.4 explicitly states payload matches AC-1.3 schema. No schema divergence |
| GET /todos for reconnection (COL-4.3 references AC-1.2) | RESOLVED | Reconnection hydration uses existing endpoint as-is |
| Status transitions | PLANNED | feature-todo-management defines: pending -> done, pending -> overdue. feature-realtime-collab does not add new status values. Consistent |
| Mutation side-effects | PLANNED | POST/PATCH/DELETE in feature-todo-management now have WS broadcast as a side-effect. This is additive only -- existing behavior unchanged. To be verified at implementation time |

### feature-realtime-collab vs enabler-overdue-checker

| Check | Status | Detail |
|-------|--------|--------|
| System-initiated broadcast (COL-3.1) | PLANNED | enabler-overdue-checker currently has no event emission. COL-3.1 requires it to emit `todo:updated` via websocket-service. This is a **new requirement on an existing enabler** |
| Source field (COL-3.2) | PLANNED | `source: "system"` field must be set by overdue-checker when broadcasting. This is a new contract between the enabler and the websocket-service |
| Overdue-checker independence | DRIFT (minor) | enabler-overdue-checker was designed as a standalone cron with no awareness of connected clients. COL-3.1 introduces a coupling. The overdue-checker's Implementation Notes should be updated to reflect this dependency |

### feature-realtime-collab internal consistency

| Check | Status | Detail |
|-------|--------|--------|
| COL-1.* references websocket-service | RESOLVED | Dependency declared in System Dependencies |
| COL-2.* references presence-tracking | RESOLVED | Dependency declared in System Dependencies |
| COL-3.* references overdue-checker | RESOLVED | Dependency declared; extension noted |
| COL-4.* references feature-todo-management | RESOLVED | Uses GET /todos (AC-1.2) and presence:list for reconnection |
| AC count matches summary table | RESOLVED | 15 ACs across 4 user stories -- verified |

---

## 3. Annotations Summary

| Annotation | Count | Details |
|-----------|-------|---------|
| RESOLVED | 14 | Existing consistency checks and new-spec internal checks all pass |
| PLANNED | 4 | New behaviors that will need verification at implementation time |
| DRIFT | 1 | enabler-overdue-checker gains an undocumented dependency on websocket-service |

---

## 4. Drift Detail

### DRIFT-001: enabler-overdue-checker gains WebSocket dependency

**Severity:** Minor
**Source:** COL-3.1 requires overdue-checker to broadcast events via websocket-service
**Current state:** enabler-overdue-checker has no mention of WebSocket, event broadcasting, or external consumers beyond todo-management-service
**Required action:** Update enabler-overdue-checker Implementation Notes to add:
```
- PLANNED 2026-04-03 -- After marking todos as "overdue," emit `todo:updated` events
  via websocket-service with `source: "system"`
```
**Impact if unresolved:** Overdue status changes will be invisible to connected WS clients until they manually refresh, breaking COL-3.1.

---

## 5. Conflict Check: New ACs vs Existing ACs

| New AC | Potentially Conflicting Existing AC | Conflict? | Resolution |
|--------|-------------------------------------|-----------|------------|
| COL-1.1 (broadcast on POST) | AC-1.1 (POST creates todo) | No | COL-1.1 is a post-mutation side-effect; AC-1.1's behavior is unchanged |
| COL-1.2 (broadcast on PATCH) | AC-2.1 (PATCH completes todo) | No | Same pattern -- side-effect only |
| COL-1.3 (broadcast on DELETE) | AC-2.2 (DELETE removes todo) | No | Same pattern -- side-effect only |
| COL-3.1 (broadcast on overdue) | overdue AC-1.2 (status set to "overdue") | No conflict, but **extension** | Overdue-checker must call websocket-service after mutation |
| COL-4.3 (reconnect hydration via GET) | AC-1.2 (GET /todos returns all) | No | Existing endpoint used as-is |

**Verdict:** No conflicts found. One extension (DRIFT-001) requires spec update.

---

## Convert Mode Notes

In **bootstrap (S1)**, sync-spec-code was simulated because there was no existing code or prior specs to check against. The skill produced placeholder sync reports.

In **convert (S3)**, the skill operates on real existing artifacts:

| Aspect | Bootstrap (S1) | Convert (S3) |
|--------|---------------|-------------|
| Input | Newly created specs only | Existing VERIFIED specs + new DRAFT specs |
| Consistency checks | Self-consistency within new specs | Cross-consistency between old and new |
| Drift detection | Not applicable (nothing to drift from) | Detects when new features impose undocumented requirements on existing specs |
| Annotations | Mostly PLANNED | Mix of RESOLVED (existing), PLANNED (new), and DRIFT (conflicts) |
| Actionable output | "Write tests for these ACs" | "Update enabler-overdue-checker to reflect new WS dependency" |

The key convert-mode insight: **sync-spec-code becomes a change-impact analysis tool**, not just a consistency checker. It answers "what breaks or changes when I add this feature?" rather than "are my new specs internally consistent?"
