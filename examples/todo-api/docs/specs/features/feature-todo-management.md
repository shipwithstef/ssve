# Feature: Todo Management

**Type:** Feature
**Status:** VERIFIED
**Consumer:** P1 (Developer Testing SVC)
**Created:** 2026-04-03

## Problem Statement

Users need to create, view, complete, and delete todo items through a simple API
with a minimal UI. This feature exercises the full svc pipeline on the
smallest possible surface.

## User Stories

### US-1: Create and view todos

> As P1, I want to create a todo and see it in a list, so I can track tasks.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| AC-1.1 | POST /todos with title creates a todo with status "pending" | ✅ | ✅ |
| AC-1.2 | GET /todos returns all todos ordered by creation date | ✅ | ✅ |
| AC-1.3 | Todo has: id, title, status, createdAt, dueDate (optional) | ✅ | ✅ |

### US-2: Complete and delete todos

> As P1, I want to mark a todo as done or delete it, so I can manage my list.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| AC-2.1 | PATCH /todos/:id with status "done" marks the todo complete | ✅ | ✅ |
| AC-2.2 | DELETE /todos/:id removes the todo from the list | ✅ | ✅ |
| AC-2.3 | Completing a todo records completedAt timestamp | ✅ | ✅ |

## Journey References

- [J01: Todo Lifecycle](../journeys/J01-todo-lifecycle.feature.md) — create, complete, delete flow with overdue system step

## Implementation Notes

- RESOLVED 2026-04-03 — In-memory store, no database required
- RESOLVED 2026-04-03 — REST API with JSON payloads
- RESOLVED 2026-04-03 — Overdue checking delegated to enabler-overdue-checker

## Dependencies

- **enabler-overdue-checker** — marks overdue todos (system consumer)

## UX Design

See [docs/specs/ux/feature-todo-management.md](../ux/feature-todo-management.md)

## UI Design

See [docs/specs/ui/feature-todo-management.md](../ui/feature-todo-management.md)
