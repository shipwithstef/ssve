# Phase 1: Deep Project Analysis — detail

Moved verbatim from SKILL.md (progressive disclosure).

### 1a. Read ALL feature specs — FULLY, not just headers

```bash
ls docs/specs/features/*.md 2>/dev/null
```

For EACH spec relevant to the journey being generated, READ THE ENTIRE SPEC. Not
just the headings — the full AC tables, the UI descriptions, the user stories, the
error states, the edge cases. You need to know:

- **What the user sees on each screen** — UI components, labels, states
- **What choices the user has** — buttons, options, flows, branches
- **What happens when they choose** — success states, error states, edge cases
- **What the AC says should happen** — the exact behavior, not a summary
- **How features connect** — when one feature hands off to another, what's the
  transition? What does the user see during the handoff?

The journey will be WRONG if you summarize ACs instead of reading them. A scenario
like "Then my profile shows as complete" is useless. The spec says exactly what
"complete" means — which fields, which validation, which visual indicator. Use that.
