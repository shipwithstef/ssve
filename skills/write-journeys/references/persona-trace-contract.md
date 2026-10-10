# Persona Trace Contract — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Persona Trace Contract

For user-facing or admin-facing feature work, every generated or refreshed
journey must preserve concrete persona traceability:

- the journey header names the persona ID/path (`P2`, `docs/specs/personas/P2.md`);
- each scenario is assigned to a persona path or explicitly marked
  `N/A - system-only`;
- Layer 3 findings say which persona is harmed by a missing transition,
  confusing state, or uncovered AC;
- `JOURNEY_INDEX.md` keeps the persona-to-journey table current.

Do not use `customer`, `admin`, `all users`, `PASS`, or `satisfied` as a
standalone persona reference. Those labels are too generic for downstream E2E
and feature validation ledgers.

**What IS a journey:** A multi-step, multi-feature flow a real user takes to accomplish
a goal. "New user signs up, sets up profile, enters matching queue, gets a match, starts
chatting" — that crosses 4+ features.

**What is NOT a journey:** A single-feature interaction like "toggle dark mode" or
"change email address." Those stay as acceptance criteria in their feature spec.

---
