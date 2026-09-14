# Test Fixture — Monolithic Proposal

**Status:** v1.0 — DRAFT  
**Intent:** Verify that a proposal with no phased plan emits exactly one WI.

---

## Goals

1. Test the monolithic fallback path.
2. Ensure block extraction works at the top level.

## Non-Goals

1. Phased leaf splitting.
2. AC inheritance.

---

## Context

Some proposals describe a single change that does not decompose into phases. The parser must still emit a valid WI.

## Acceptance Criteria

- Running the parser on this file produces exactly one leaf.
- The leaf `id` is `monolithic`.
- The emitted WI contains:
  - `Type: feature`
  - `Status: DRAFT`
  - `Source: fixture-monolithic.md`
  - `Goals` copied from the `## Goals` block above.
  - `Non-Goals` copied from the `## Non-Goals` block above.
  - `Acceptance Criteria` copied from the `## Acceptance Criteria` block above.

## File Impact

| File | Change |
|---|---|
| `skills/capture-idea/scripts/parse-proposal.mjs` | Add monolithic fallback path |
| `skills/capture-idea/references/from-proposal.md` | Document monolithic rule |

## Rollback

Revert the parser commit; no other files touched.
