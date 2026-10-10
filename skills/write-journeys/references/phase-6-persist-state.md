# Phase 6: Persist State — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Phase 6: Persist State

After each iteration, save progress to a tracker file so the next session
can pick up where you left off:

```bash
mkdir -p docs/specs/journeys
```

Write `docs/specs/journeys/JOURNEY_INDEX.md`:

```markdown
# Journey Index

**Last synced:** [date]
**Personas:** [count]
**Journeys:** [count]
**AC coverage:** [X]% of total ACs referenced by at least one journey

## Personas

| ID | Name | Description | Journey count |
|----|------|-------------|---------------|
| P1 | [name] | [desc] | [N] |

## Journeys

| ID | Title | Persona | Priority | Features | AC refs | E2E tests |
|----|-------|---------|----------|----------|---------|-----------|
| J01 | [title] | P1 | Critical | 4 | 12 | 3 |

## Next Iteration

- [ ] [What to generate next, based on coverage gaps]
```

Also update `docs/specs/INDEX.md` if it exists — add a Journeys section.

---
