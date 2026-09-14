# Test Fixture — Nested US-XX headings under Acceptance Criteria

**Status:** v1.0 — DRAFT
**Intent:** Regression fixture for WI-100. Verifies that (a) `## Goal` content is preserved through to the emitted WI's `## Goal` section, and (b) `### US-XX` subheadings under `## Acceptance Criteria` do not truncate the AC block.

## Goal

Prove that a monolithic proposal with a substantive `## Goal` section renders as a fully populated WI instead of collapsing to `_TBD_`.

## Non-Goals

1. Phased extraction (covered by `fixture-proposal-phased.md`).

## Acceptance Criteria

### US-01 — First user story

- **AC-01.1** This line must survive through to the parser's `acs` block.
- **AC-01.2** The `### US-01` subheading must not flush the block to empty.

### US-02 — Second user story

- **AC-02.1** Content after a second subheading is also preserved.
- **AC-02.2** The `### US-02` heading appears in the block's content verbatim.

### US-03 — Third user story

- **AC-03.1** Any number of subheadings is supported.

## File Impact

- `skills/capture-idea/scripts/parse-proposal.mjs` — updated extractBlocks.
- `skills/capture-idea/scripts/emit-wis.mjs` — updated renderWi Goal section.

## Rollback

Revert the feature commit.

## Size

Low.
