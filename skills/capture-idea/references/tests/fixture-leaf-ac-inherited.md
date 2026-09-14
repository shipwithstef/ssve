# Test Fixture — Phased Proposal with Inherited ACs

**Status:** v1.0 — DRAFT  
**Intent:** Verify AC inheritance when a leaf has no `Acceptance Criteria` block of its own.

---

## Goals

1. Test phase-level → leaf-level AC inheritance.
2. Confirm the `_TBD — defer to plan-changeset_` sentinel when neither phase nor leaf has ACs.

## Non-Goals

1. Testing leaf-level AC overrides (covered by `fixture-proposal-phased.md`).

---

## Phased Plan

### Phase 0 — Core

**Acceptance:**
- All parsers handle empty AC blocks gracefully.
- Inheritance is deterministic: nearest enclosing phase wins.

##### P0.1 — Leaf with no AC block

**Fix:** Parser walks up the heading stack to find the phase AC block.

**Scope boundary:**
- `touches:` `skills/capture-idea/scripts/parse-proposal.mjs`

**Size:** Low.

##### P0.2 — Leaf with empty AC block

**Acceptance Criteria:**

_(empty — whitespace only)_

**Fix:** Empty leaf AC block triggers inheritance, same as absent block.

**Scope boundary:**
- `touches:` `skills/capture-idea/scripts/parse-proposal.mjs`

### Phase 1 — Edge cases

**No phase-level AC block either.**

##### P1.1 — Leaf with no AC and no phase AC

**Fix:** Emit the `_TBD — defer to plan-changeset_` sentinel.

**Scope boundary:**
- `touches:` `skills/capture-idea/scripts/emit-wis.mjs`

---

## Self-verify

| # | Check | PASS/FAIL |
|---|---|---|
| 1 | P0.1 inherits the Phase 0 AC block verbatim | PASS |
| 2 | P0.2 inherits because its own AC block is empty | PASS |
| 3 | P1.1 gets the TBD sentinel | PASS |
