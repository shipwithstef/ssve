# UX Design: Todo Management

**Feature:** feature-todo-management
**Phase:** 4 (UX Design)

## Screen Inventory

| Screen | Purpose |
|--------|---------|
| Todo List View | Shows all todos with status indicators |
| Create Modal | Simple form: title + optional dueDate |
| Edit View | Inline status toggle (pending/done), delete action |

## State Machine: Todo Item

```
[pending] --complete--> [done]
[pending] --overdue-->  [overdue]
[overdue] --complete--> [done]
[any]     --delete-->   (removed)
```

## Flow

1. User opens list view (GET /todos)
2. User clicks "Add" -> create modal opens
3. User submits -> todo appears in list as "pending"
4. User clicks todo -> edit view with complete/delete actions
5. System cron may transition pending -> overdue (no UI trigger)

## Error States

- Empty list: "No todos yet. Create one!"
- Network error: "Could not reach server. Retry?"

## Accessibility

- All actions reachable by keyboard
- Status conveyed with both color and text label
