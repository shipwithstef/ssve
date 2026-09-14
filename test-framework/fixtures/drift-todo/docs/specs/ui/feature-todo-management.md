# UI Design: Todo Management

**Feature:** feature-todo-management
**Phase:** 5 (UI Design)
**Design System:** [design-system.md](../design-system.md)

## Components

### TodoCard

- Displays: title, status badge, dueDate (if set), createdAt
- Status badge uses semantic color tokens: `color.status.pending`, `color.status.done`, `color.status.overdue`
- Actions: complete button, delete button

### TodoList

- Vertical stack of TodoCard components
- Spacing: `spacing.md` between cards
- Empty state component when list is empty

### CreateModal

- Fields: title (required, text input), dueDate (optional, date picker)
- Buttons: Cancel (`color.neutral`), Create (`color.primary`)
- Typography: heading uses `type.heading.sm`, body uses `type.body.md`

## Responsive Behavior

- Single column on mobile (< 640px)
- Max-width 640px centered on desktop

## Component States

| Component | States |
|-----------|--------|
| TodoCard | default, hover, completing, deleting |
| CreateModal | idle, submitting, error |
| TodoList | loading, empty, populated |
