# Feature: Real-Time Collaboration

**Type:** Feature
**Status:** DRAFT
**Consumer:** P2 (Team Collaborator), P1 (Developer Testing SVC)
**Created:** 2026-04-03

## Problem Statement

When multiple users interact with the shared todo list, changes made by one user are invisible to others until they manually refresh. Users need to see each other's changes in real time and know who else is currently viewing the list, so they can collaborate effectively without stale reads or conflicting edits.

## User Stories

### US-1: Live todo updates

> As P2, I want to see todos created, completed, or deleted by other users appear in my view instantly, so I always have an accurate picture of the shared list.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| COL-1.1 | When any client creates a todo via POST /todos, all other connected WS clients receive a `todo:created` event within 500ms | | |
| COL-1.2 | When any client completes a todo via PATCH /todos/:id, all other connected WS clients receive a `todo:updated` event within 500ms | | |
| COL-1.3 | When any client deletes a todo via DELETE /todos/:id, all other connected WS clients receive a `todo:deleted` event within 500ms | | |
| COL-1.4 | WS event payloads include the full todo object (id, title, status, createdAt, dueDate, completedAt) matching the schema from feature-todo-management AC-1.3 | | |

### US-2: Presence awareness

> As P2, I want to see who else is currently connected to the shared todo list, so I know my teammates are active.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| COL-2.1 | When a new client connects via WebSocket, all existing clients receive a `presence:joined` event with the new client's session ID and display name | | |
| COL-2.2 | When a client disconnects (or heartbeat times out), all remaining clients receive a `presence:left` event | | |
| COL-2.3 | A newly connected client can request `presence:list` and receive the current set of connected users | | |
| COL-2.4 | Presence events are debounced: rapid disconnect/reconnect within 3 seconds does not emit joined/left events | | |

### US-3: System-initiated live updates

> As P2, I want to see status changes made by the overdue-checker system (not a human) appear live, so my view stays accurate even for automated transitions.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| COL-3.1 | When enabler-overdue-checker marks a todo as "overdue," all connected WS clients receive a `todo:updated` event | | |
| COL-3.2 | The `todo:updated` event from system-initiated changes includes a `source: "system"` field to distinguish from human-initiated changes | | |

### US-4: Connection resilience

> As P2, I want the UI to handle WebSocket disconnections gracefully, so I am never silently looking at stale data.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| COL-4.1 | When the WS connection drops, the UI displays a "Reconnecting..." indicator within 2 seconds | | |
| COL-4.2 | The client automatically attempts reconnection with exponential backoff (1s, 2s, 4s, max 30s) | | |
| COL-4.3 | On successful reconnection, the client fetches full state via GET /todos (feature-todo-management AC-1.2) and reconciles its view | | |
| COL-4.4 | On successful reconnection, the client re-subscribes to presence and receives a fresh `presence:list` | | |
| COL-4.5 | If reconnection fails after 5 attempts, the UI shows a persistent error with a manual "Retry" button | | |

## Journey References

- [J01: Todo Lifecycle](../../journeys/J01-todo-lifecycle.feature.md) -- single-user baseline; this feature extends its mutation steps with WS broadcasting
- [J02: Real-Time Collaboration](../../journeys/J02-realtime-collab.feature.md) -- multi-user scenario exercising COL-* ACs

## Implementation Notes

- PLANNED 2026-04-03 -- WebSocket endpoint at `ws://host/ws`; upgrade from HTTP
- PLANNED 2026-04-03 -- Event format: `{ "type": "todo:created|updated|deleted", "payload": {todo}, "source": "user|system", "timestamp": "ISO8601" }`
- PLANNED 2026-04-03 -- Presence format: `{ "type": "presence:joined|left|list", "payload": { "sessionId": "...", "displayName": "...", "users": [...] } }`
- PLANNED 2026-04-03 -- No authentication; session ID assigned on WS connect via UUID v4
- PLANNED 2026-04-03 -- In-memory connection registry; no persistent presence storage

## System Dependencies

### Existing (unchanged)

| Dependency | Type | Status | Relationship |
|-----------|------|--------|-------------|
| feature-todo-management | Feature | VERIFIED | COL-1.4 reuses its todo schema; COL-4.3 uses GET /todos for reconnection hydration |
| enabler-overdue-checker | Enabler | VERIFIED | COL-3.1 requires it to emit events via websocket-service |

### New (required by this feature)

| Dependency | Type | Status | Relationship |
|-----------|------|--------|-------------|
| enabler-websocket-service | Enabler | PLANNED | Provides WS connection management and event broadcasting for COL-1.*, COL-3.* |
| enabler-presence-tracking | Enabler | PLANNED | Provides presence lifecycle for COL-2.* |

### Dependency Cascade

```
feature-realtime-collab (this spec)
  |
  +-- feature-todo-management (existing, VERIFIED)
  |     Reason: Todo CRUD is the source of mutation events; schema reuse
  |
  +-- enabler-overdue-checker (existing, VERIFIED, extended)
  |     Reason: System-initiated mutations must also broadcast
  |
  +-- enabler-websocket-service (new, PLANNED)
  |     Reason: Connection registry, event fan-out
  |     |
  |     +-- enabler-presence-tracking (new, PLANNED)
  |           Reason: Presence is built on top of WS connection lifecycle
  ```

## AC Summary

| Prefix | Count | Coverage |
|--------|-------|----------|
| COL-1.* | 4 | Live todo updates |
| COL-2.* | 4 | Presence awareness |
| COL-3.* | 2 | System-initiated updates |
| COL-4.* | 5 | Connection resilience |
| **Total** | **15** | **4 user stories** |
