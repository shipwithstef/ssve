# Scenario: write-spec greenfield

## Setup

Copy fixtures from `examples/todo-api/` into a temporary workspace:
- `docs/specs/vision.md` — use the todo-api vision as a template
- `docs/specs/personas/P1.md` — use the todo-api P1 persona

Replace vision content with:

```markdown
# Vision: Bookmark Manager

> A personal bookmark manager with tagging and search.

## Purpose

A web app for saving, organizing, and searching bookmarks with tags.

## Boundaries

- **In scope:** CRUD for bookmarks, tagging, full-text search, import from browser.
- **Out of scope:** Social features, sharing, browser extension (v2).

## Principles

1. Fast — search results appear as the user types.
2. Organized — tags are first-class, not an afterthought.
3. Portable — import/export in standard formats.

## Success Criteria

- User can save a bookmark with tags in under 3 seconds.
- Search returns results within 200ms for collections up to 10,000 bookmarks.

## Product Type

Full-stack web application with REST API backend.
```

Replace P1 content with:

```markdown
# P1: Casual Bookmarker

## Role

A knowledge worker who saves links throughout the day but rarely organizes them.

## Goals

- Save bookmarks quickly without friction.
- Find a saved link by vague recollection ("that article about X").
- Bulk-organize when motivation strikes.

## Needs

- One-click save from any page.
- Fuzzy search across titles and tags.
- Batch tagging for cleanup sessions.

## Pain Points

- Browser bookmarks get messy and unsearchable.
- Existing tools require too many clicks to save.
```

## Prompt

```
Use the write-spec skill to write a feature spec for a bookmark manager's core "save and tag bookmarks" feature. The vision is at docs/specs/vision.md and persona at docs/specs/personas/P1.md.
```

## Expected Outputs

### File Exists

- `docs/specs/features/*.md` — at least one feature spec file created

### Content Checks

- [ ] Contains `**Status:** DRAFT` (or `Status: DRAFT`)
- [ ] Contains an `## Acceptance Criteria` or `#### Acceptance Criteria` section
- [ ] Has at least 5 acceptance criteria rows (lines matching `| AC-`)
- [ ] Contains a `## System Dependencies` or `## Dependencies` section
- [ ] Contains at least one AC addressing zero-state / empty-state behavior (grep for "empty" or "zero" or "no bookmarks" or "first time")
- [ ] `.svc/lane-tasks-<WI>.json` contains a `write-spec` `phases_executed` receipt for `P3-StoryAcceptanceCriteriaDraft`

## Assertions

1. Phase receipt structure:
   `jq -e '.tasks[] | select(.metadata.skill == "write-spec" or .skill_receipt.skill == "write-spec") | .skill_receipt.phases_executed[]? | select(.id == "P3-StoryAcceptanceCriteriaDraft")' .svc/lane-tasks-<WI>.json`

## Chain Continuation

If `--progressive` were set, the next skill would be `audit-ac` (greenfield lane position 5).
