# Enabler: Overdue Todo Checker

**Type:** Enabler
**Status:** VERIFIED
**Consumer:** todo-management-service
**Created:** 2026-04-03

## Problem Statement

Todos with a dueDate in the past must be automatically marked as "overdue."
This enabler runs on a cron schedule and updates todo statuses without
human intervention.

## System Stories

### SS-1: Mark overdue todos

> As todo-management-service, I need todos past their dueDate to be marked
> "overdue," so the user sees accurate status without manual checks.

#### Acceptance Criteria

| # | Criterion | QA | E2E |
|---|-----------|-----|-----|
| AC-1.1 | Cron scans all todos with status "pending" and dueDate < now | ✅ | ✅ |
| AC-1.2 | Matching todos have status updated to "overdue" | ✅ | ✅ |
| AC-1.3 | Todos with status "done" are never changed to "overdue" | ✅ | ✅ |

## Journey References

- [J01: Todo Lifecycle](../journeys/J01-todo-lifecycle.feature.md) — overdue system step

## Implementation Notes

- RESOLVED 2026-04-03 — Runs as a scheduled function, not a separate service
- RESOLVED 2026-04-03 — Operates on the same in-memory store as the API
