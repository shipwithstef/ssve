# J02: Real-Time Collaboration

> Covers multi-user real-time interaction: live updates, presence awareness, connection resilience.

## Actors

- **P1** -- Developer Testing Serious Vibe Coding (creates todos)
- **P2** -- Team Collaborator (observes and interacts in real time)
- **System** -- Overdue checker cron
- **System** -- WebSocket service (event broadcaster)

## Preconditions

- API is running with an empty todo store.
- WebSocket endpoint is available at `ws://host/ws`.
- **J01 (Todo Lifecycle) is a prerequisite** -- all single-user CRUD behavior tested there is assumed working.

## Scenario 1: Live todo creation and presence

```gherkin
Feature: Real-Time Collaboration

  Background:
    Given the API is running with an empty todo store
    And the WebSocket endpoint is available at "ws://host/ws"

  Scenario: P1 creates a todo, P2 sees it live
    # Presence -- P1 connects
    Given P1 connects to the WebSocket endpoint
    Then P1 receives a session ID via the connection handshake
    And P1 requests "presence:list"
    Then P1 receives a presence list containing 1 user (themselves)

    # Presence -- P2 connects
    When P2 connects to the WebSocket endpoint
    Then P2 receives a session ID via the connection handshake
    And P1 receives a "presence:joined" event for P2
    And P2 requests "presence:list"
    Then P2 receives a presence list containing 2 users (P1 and P2)

    # Live creation
    When P1 sends POST /todos with title "Buy milk" and dueDate "2026-04-05"
    Then the response status is 201
    And P2 receives a "todo:created" event within 500ms
    And the event payload contains title "Buy milk" and status "pending"
    And the event payload matches the schema from feature-todo-management AC-1.3

    # Live completion
    When P2 sends PATCH /todos/:id with status "done"
    Then the response status is 200
    And P1 receives a "todo:updated" event within 500ms
    And the event payload contains status "done" and completedAt is set

    # Live deletion
    When P1 sends DELETE /todos/:id
    Then the response status is 204
    And P2 receives a "todo:deleted" event within 500ms
    And the event payload contains the deleted todo's id
```

## Scenario 2: System-initiated overdue broadcast

```gherkin
  Scenario: Overdue checker broadcasts to all connected clients
    Given P1 is connected via WebSocket
    And P2 is connected via WebSocket
    And P1 has created a todo "File taxes" with dueDate "2026-04-02"

    When the overdue-checker cron runs at "2026-04-03T00:00:00Z"
    Then P1 receives a "todo:updated" event with status "overdue" and source "system"
    And P2 receives a "todo:updated" event with status "overdue" and source "system"
```

## Scenario 3: Connection resilience

```gherkin
  Scenario: P2 loses connection and reconnects
    Given P1 is connected via WebSocket
    And P2 is connected via WebSocket
    And there are 3 todos in the store

    # Disconnect
    When P2's WebSocket connection drops
    Then P2's UI shows a "Reconnecting..." indicator within 2 seconds
    And P1 receives a "presence:left" event for P2 (after heartbeat timeout)

    # Mutation while disconnected
    When P1 creates a new todo "Buy groceries" while P2 is disconnected
    Then P2 does NOT receive the "todo:created" event

    # Reconnect
    When P2's client reconnects after exponential backoff
    Then P2 fetches GET /todos and receives 4 todos (hydration via AC-1.2)
    And P2 requests "presence:list" and sees both P1 and P2
    And P1 receives a "presence:joined" event for P2
    And P2's UI hides the "Reconnecting..." indicator
```

## Scenario 4: Presence debouncing

```gherkin
  Scenario: Rapid disconnect/reconnect does not spam presence events
    Given P1 is connected via WebSocket
    And P2 is connected via WebSocket

    When P2 disconnects and reconnects within 2 seconds (e.g., page refresh)
    Then P1 does NOT receive a "presence:left" event for P2
    And P1 does NOT receive a "presence:joined" event for P2
    And the presence list still shows both P1 and P2
```

## Layer 3 Analysis

### Grounding Check: Every step traces to an AC

| Step | Producer | AC Reference | Grounded? |
|------|----------|-------------|-----------|
| P1 connects to WS | enabler-websocket-service | (new enabler, PLANNED) | Yes (new spec) |
| P2 connects to WS | enabler-websocket-service | (new enabler, PLANNED) | Yes (new spec) |
| presence:list | enabler-presence-tracking | COL-2.3 | Yes |
| presence:joined | enabler-presence-tracking | COL-2.1 | Yes |
| presence:left | enabler-presence-tracking | COL-2.2 | Yes |
| presence debounce | enabler-presence-tracking | COL-2.4 | Yes |
| POST /todos | feature-todo-management | AC-1.1 | Yes (existing) |
| todo:created event | feature-realtime-collab | COL-1.1 | Yes |
| PATCH /todos/:id | feature-todo-management | AC-2.1 | Yes (existing) |
| todo:updated event | feature-realtime-collab | COL-1.2 | Yes |
| DELETE /todos/:id | feature-todo-management | AC-2.2 | Yes (existing) |
| todo:deleted event | feature-realtime-collab | COL-1.3 | Yes |
| Event payload schema | feature-realtime-collab | COL-1.4 | Yes |
| Overdue broadcast | feature-realtime-collab | COL-3.1, COL-3.2 | Yes |
| Reconnecting indicator | feature-realtime-collab | COL-4.1 | Yes |
| Exponential backoff | feature-realtime-collab | COL-4.2 | Yes |
| Reconnect hydration | feature-realtime-collab + feature-todo-management | COL-4.3, AC-1.2 | Yes |
| Reconnect presence | feature-realtime-collab | COL-4.4 | Yes |
| Retry after 5 failures | feature-realtime-collab | COL-4.5 | Yes (not shown in Gherkin -- edge case) |

### Conflict Analysis: J02 vs J01 Single-User Assumptions

| J01 Assumption | J02 Reality | Conflict? | Resolution |
|---------------|-------------|-----------|------------|
| Single actor (P1) only | Multiple actors (P1 + P2) | No conflict | J02 is additive; J01 remains valid for single-user testing |
| No WebSocket connection | WS connection required for real-time | No conflict | J01 tests REST-only path; J02 tests WS-augmented path |
| Overdue checker has no consumers | Overdue checker now broadcasts events | Minor extension | J01's overdue step is unchanged; J02 adds observation of the broadcast |
| Empty store precondition | Both journeys start with empty store | No conflict | Independent test runs |
| Sequential steps (no concurrency) | Concurrent actors | Architectural difference | J01 tests sequential correctness; J02 tests concurrent correctness |

### AC Coverage for COL-* ACs

| AC | Covered in Scenario | Verification Method |
|----|-------------------|-------------------|
| COL-1.1 | Scenario 1 (live creation) | P2 receives todo:created event |
| COL-1.2 | Scenario 1 (live completion) | P1 receives todo:updated event |
| COL-1.3 | Scenario 1 (live deletion) | P2 receives todo:deleted event |
| COL-1.4 | Scenario 1 (schema check) | Event payload matches AC-1.3 schema |
| COL-2.1 | Scenario 1 (P2 joins) | P1 receives presence:joined |
| COL-2.2 | Scenario 3 (P2 disconnects) | P1 receives presence:left |
| COL-2.3 | Scenario 1 (presence:list) | Both P1 and P2 request and receive list |
| COL-2.4 | Scenario 4 (debounce) | Rapid reconnect does not emit events |
| COL-3.1 | Scenario 2 (overdue broadcast) | Both clients receive todo:updated |
| COL-3.2 | Scenario 2 (source field) | Event has source: "system" |
| COL-4.1 | Scenario 3 (reconnecting indicator) | UI shows indicator within 2s |
| COL-4.2 | Scenario 3 (exponential backoff) | Client reconnects after backoff |
| COL-4.3 | Scenario 3 (hydration) | GET /todos returns full state |
| COL-4.4 | Scenario 3 (presence re-subscribe) | presence:list after reconnect |
| COL-4.5 | Not directly exercised | Edge case -- would need a Scenario 5 with server-down simulation |

**Coverage:** 14/15 ACs directly exercised. COL-4.5 (5-attempt failure with manual retry button) is an edge case that would require a dedicated server-failure scenario.

---

## Expand Mode Notes

This journey was created using **Mode 2: Expand** in write-journeys (convert mode). Key differences from Mode 1 (Bootstrap):

| Aspect | Mode 1 (Bootstrap) | Mode 2 (Expand) |
|--------|-------------------|-----------------|
| Starting point | Vision + feature specs | Existing J01 journey + new feature spec |
| Prerequisite | None | J01 is explicitly listed as prerequisite |
| Actors | Derived from personas | Includes existing actors (P1) + new actors (P2) |
| Layer 3 | Only new ACs | Cross-references both existing and new ACs |
| Conflict analysis | Not applicable | Checks for conflicts with J01's single-user assumptions |
| Coverage scope | All ACs in the project | Only COL-* ACs (new feature) |

The key insight: expand mode produces a journey that is **aware of its predecessor** and explicitly validates that the new scenarios do not break assumptions made by existing journeys.
