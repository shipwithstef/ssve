# Test Fixture — Phased Proposal with Heading Leaves

**Status:** v1.0 — DRAFT  
**Intent:** Verify that the parser extracts one WI per leaf when phases use `##### P<N>.<M>` headings.

---

## Goals

1. Demonstrate heading-based leaf extraction.
2. Ensure every leaf carries its own AC block.

## Non-Goals

1. Table-based leaves (covered by a separate fixture).
2. Cross-repo promotion.

---

## Phased Plan

### Phase 0 — Foundation

#### P0A — Parser core

##### P0.1 — Define ATX grammar

**Finding:** F1 — no canonical parser exists.

**Decision:** Write a line-based state machine.

**Fix:**
- Split on ATX headings.
- Match phase level `### Phase N`.
- Match leaf level `##### P<N>.<M>`.

**Scope boundary:**
- `touches:` `skills/capture-idea/references/from-proposal.md`
- `must-not-touch:` any skill SKILL.md

**Size:** Low.

**Acceptance:**
- Parser emits deterministic JSON on three consecutive runs.
- Unknown headings are skipped, not fatal.

##### P0.2 — Build test fixtures

**Finding:** F2 — no test data exists for phased proposals.

**Decision:** Create three fixtures covering happy-path, monolithic, and inheritance.

**Fix:**
- `fixture-proposal-phased.md` (this file).
- `fixture-monolithic.md`.
- `fixture-leaf-ac-inherited.md`.

**Scope boundary:**
- `touches:` `skills/capture-idea/references/tests/`
- `must-not-touch:` production code.

**Size:** Low.

**Acceptance:**
- All fixtures parse as valid markdown.
- Each fixture produces the expected leaf count in a dry-run.

### Phase 1 — Integration

##### P1.1 — Wire parser into skill

**Fix:** Update `skills/capture-idea/SKILL.md` Section 7 to invoke `parse-proposal.mjs`.

**Scope boundary:**
- `touches:` `skills/capture-idea/SKILL.md`

**Acceptance:**
- `bash scripts/lint-skills-manifest.mjs` passes.
- Existing intake mode is unchanged.

---

## Self-verify

| # | Check | PASS/FAIL |
|---|---|---|
| 1 | Phase 0 has two leaves (P0.1, P0.2) | PASS |
| 2 | Phase 1 has one leaf (P1.1) | PASS |
| 3 | Every leaf has its own Acceptance block | PASS |
