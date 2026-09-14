# Feature Ship Brief: Real-Time Collaboration

**Skill:** validate-feature
**Mode:** VALIDATE against existing specs (convert mode)
**Date:** 2026-04-03

---

## Summary

Add real-time collaboration to the existing todo-api so that multiple users can see each other's changes live. This feature **extends** the existing `feature-todo-management` -- it does not replace it. All existing CRUD operations remain unchanged; the new capability layers WebSocket-based event broadcasting and presence tracking on top of the current REST API.

---

## Cross-References to Existing Specs

### Existing Feature: feature-todo-management (VERIFIED)

| Existing AC | Relevance to Real-Time Collab | Impact |
|-------------|------------------------------|--------|
| AC-1.1 (POST /todos creates todo) | Must broadcast `todo:created` event to all connected clients after successful creation | Extends -- adds side-effect, does not change REST contract |
| AC-1.2 (GET /todos returns all todos) | Initial state hydration for newly connected WS clients; no change to endpoint | No impact -- used as-is |
| AC-1.3 (Todo schema: id, title, status, createdAt, dueDate) | WS event payload mirrors this schema | No impact -- reuses existing model |
| AC-2.1 (PATCH completes todo) | Must broadcast `todo:updated` event after status change | Extends -- adds side-effect |
| AC-2.2 (DELETE removes todo) | Must broadcast `todo:deleted` event after removal | Extends -- adds side-effect |
| AC-2.3 (completedAt timestamp) | Included in `todo:updated` event payload | No impact -- reuses existing field |

### Existing Enabler: enabler-overdue-checker (VERIFIED)

| Existing AC | Relevance | Impact |
|-------------|-----------|--------|
| AC-1.1 (Cron scans pending todos) | No change to scan logic | No impact |
| AC-1.2 (Status updated to "overdue") | Must broadcast `todo:updated` event when overdue status is set | Extends -- overdue checker becomes a WS event producer |
| AC-1.3 (Done todos never changed) | No impact | No impact |

---

## New Enablers Required

### Enabler: websocket-service

**Purpose:** Manage WebSocket connections, maintain a registry of connected clients, and broadcast events when todo mutations occur.

**Capabilities:**
- Accept WS upgrade requests at `ws://host/ws`
- Assign ephemeral session ID to each connection
- Maintain connection registry (session ID, connected-at timestamp)
- Broadcast JSON events: `todo:created`, `todo:updated`, `todo:deleted`
- Handle connection lifecycle: connect, disconnect, heartbeat/ping-pong
- Clean up stale connections after heartbeat timeout

**Consumers:** feature-todo-management (mutation hooks), enabler-overdue-checker (status change hook), feature-realtime-collab (UI event handling)

### Enabler: presence-tracking

**Purpose:** Track which users are currently connected to the shared todo list and broadcast presence changes.

**Capabilities:**
- Maintain presence set (session ID, display name or "Anonymous", connected-at)
- Broadcast `presence:joined` and `presence:left` events
- Respond to `presence:list` request with current connected users
- Handle stale presence cleanup when heartbeat fails
- Debounce rapid connect/disconnect cycles (e.g., page refresh)

**Consumers:** feature-realtime-collab (presence UI), websocket-service (connection lifecycle hooks)

---

## Extension Architecture (Not Replacement)

```
Existing (unchanged)                    New (added by S3)
========================               ========================
feature-todo-management  ----------->  feature-realtime-collab
  |                        extends       |
  v                                      v
enabler-overdue-checker  ----------->  enabler-websocket-service
                           extends       |
                                         v
                                       enabler-presence-tracking
```

Key principle: Every existing AC retains its current behavior. The new feature adds **side-effects** (event broadcasting) to existing mutation paths, but the REST API contract is unchanged. A client that never opens a WebSocket connection experiences zero behavioral difference.

---

## Cascade: Feature to Enabler Dependencies

```
feature-realtime-collab
  |-- depends on --> feature-todo-management (existing, VERIFIED)
  |-- depends on --> enabler-websocket-service (new, PLANNED)
  |       |-- depends on --> enabler-presence-tracking (new, PLANNED)
  |-- depends on --> enabler-overdue-checker (existing, VERIFIED -- extended)
```

---

## Validation Against Existing State

| Check | Result | Detail |
|-------|--------|--------|
| Does new feature conflict with existing ACs? | NO | All existing ACs retain current behavior; new feature adds side-effects only |
| Does new feature require changes to existing API contracts? | NO | REST endpoints unchanged; WS is additive |
| Does new feature require changes to existing data model? | NO | Todo schema unchanged; presence is a separate data structure |
| Does new feature require changes to enabler-overdue-checker? | MINOR | Overdue checker must emit events via websocket-service; internal logic unchanged |
| Are there orphaned specs after this change? | NO | All existing specs remain relevant and referenced |

---

## Convert Mode Notes

In **bootstrap (S1)**, validate-feature has no existing specs to validate against -- it creates the initial feature inventory from the vision document. In **convert (S3)**, the skill:

1. Reads all existing feature and enabler specs
2. Cross-references each existing AC against the new requirement
3. Identifies which existing ACs are impacted (extended vs unchanged)
4. Discovers new enablers needed to support the feature
5. Validates that the new feature does not conflict with or orphan existing specs

This is the core convert-mode difference: the skill is **additive and validated**, not greenfield and speculative.
