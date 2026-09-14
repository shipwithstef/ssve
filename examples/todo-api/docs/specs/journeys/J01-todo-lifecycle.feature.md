# J01: Todo Lifecycle

> Covers the full lifecycle of a todo: create, overdue check, complete, delete.

## Actors

- **P1** — Developer Testing SVC
- **System** — Overdue checker cron

## Preconditions

- API is running with an empty todo store.

## Scenario: Full todo lifecycle

```gherkin
Feature: Todo Lifecycle

  Scenario: Create, check overdue, complete, and delete a todo
    # Create
    Given P1 sends POST /todos with title "Buy milk" and dueDate "2026-04-02"
    Then the response status is 201
    And the todo has status "pending"

    # List
    When P1 sends GET /todos
    Then the response contains 1 todo with title "Buy milk"

    # Overdue check (system step)
    When the overdue-checker cron runs at "2026-04-03T00:00:00Z"
    Then the todo "Buy milk" has status "overdue"

    # Complete
    When P1 sends PATCH /todos/:id with status "done"
    Then the todo has status "done"
    And completedAt is set

    # Delete
    When P1 sends DELETE /todos/:id
    Then the response status is 204
    And GET /todos returns 0 todos
```

## Layer 3 Analysis

| Step | Producer | Grounded? |
|------|----------|-----------|
| POST /todos | feature-todo-management (US-1) | Yes |
| GET /todos | feature-todo-management (US-1) | Yes |
| overdue-checker cron | enabler-overdue-checker (SS-1) | Yes |
| PATCH /todos/:id | feature-todo-management (US-2) | Yes |
| DELETE /todos/:id | feature-todo-management (US-2) | Yes |
