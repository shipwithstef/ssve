# WI-140: Environment-aware competitive cross-reference gates with deep-research mandate

**Type:** framework
**Status:** VERIFIED
**Severity:** critical
**Filed:** 2026-05-01
**Source:** `proposals/done/2026-05-01-competitive-awareness-gap.md` — Example Marketplace built receipt scanning for 2 months; zero competitors do this; framework never flagged it
**Lane:** framework

## Goal

Convert competitive analysis from **read-only consolidation** to **deterministic, environment-aware enforcement** so that no feature touching core mechanics can be BASELINED without an evidence-graded competitive cross-reference. Generalizes the same fix pattern (live verification, structured output, freshness gate) to the stored-knowledge-decay class of failures.

## ACs (8 phases, dependency-ordered)

- **AC-01 (Phase 0):** Diagnosis-lock artifact at `docs/specs/features/competitive-awareness-deep-research-diagnosis.md` confirms the gap with file:line citations; references prior learning `stored-knowledge-decay-requires-live-verification` (confidence 10).
- **AC-02 (Phase 1):** Competitor-analysis schema at `references/schemas/competitor-analysis.schema.yaml` with required fields: `landscape_state` (enum), `earn_mechanism`, `enrollment_path`, `merchant_cost`, `pos_integrations`, `fraud_prevention`, `customer_complaints`, `last_verified` (ISO date). Tier-1 validator `validate-competitor-analysis-schema.sh` PASS.
- **AC-03 (Phase 2):** `analyze-competitors/SKILL.md` rewritten — web research is MANDATORY (not "recommended"); output conforms to Phase 1 schema; "consolidation only / no new web research" is a HARD-FAIL terminal state per `validate-competitor-analysis-freshness.sh`.
- **AC-04 (Phase 3):** `validate-feature` and `write-spec` auto-emit `## Competitive Risk Assessment` section; gate behavior branches on `landscape_state`:
  - `populated` → BLOCK BASELINED if zero competitors do this AND no compensating-control rationale present
  - `nascent` → WARN + require explicit thin-evidence acknowledgement
  - `none-found` → flip to first-mover risk checklist (4 items)
  - `inapplicable` → skip + log justification to `pipeline-decisions.jsonl`
  Tier-1 validator `validate-feature-competitive-cross-reference.sh` PASS.
- **AC-05 (Phase 4):** Compensating-control checklist (4 items: missing capability / why-not-now / risk / replacement-path) wired into `write-spec` and `design-tech`. Required when AC-04 fires "zero competitors do this." Tier-1 validator `validate-spec-compensating-control.sh`.
- **AC-06 (Phase 5):** `.svc/competitive-monitor-triggers.jsonl` append schema + `route-workflow` post-skill hook fires on WIs touching core-mechanic patterns (earn / redeem / verify / enroll). Quarterly staleness in `validate-competitor-analysis-freshness.sh`.
- **AC-07 (Phase 6):** `onboard-repo` runs Phase 2's deep-research path on day 1 for any discovered core-mechanic feature; outputs `docs/specs/brownfield-competitive-flags.md` with day-1 risk flags. Closes the "would-have-caught-Example Marketplace-on-day-1" gap.
- **AC-08 (Phase 7):** Knowledge surfacing — when `research` or `svc-advisor` queries domains in `references/knowledge/domains/{loyalty,verification,enrollment,payment}/`, auto-append `## Competitive Context` block from Phase 1 schema data.
- **AC-09 (Phase 8, separate WI in example-marketplace repo):** Retroactive audit of Example Marketplace WIs touching receipt scanning, enrollment, verification using the new gates. Filed as `example-marketplace#WI-XXX`, NOT included in this svc changeset.

## Approach

- One svc-internal worktree (`framework-competitive-awareness`) for phases 1-7
- Per `plan-changeset-trigger.md`: triggered (contract change to skill output schema, behavior change on `validate-feature` hot path)
- Schema-first ordering: Phase 1 schema must land before Phases 2/3/7 can consume it
- Each phase = one PR (or merged set if blocked_by chain runs cleanly)
- Phase 8 is project-level work, dispatched to example-marketplace repo after svc changes promote

## Spec

`docs/specs/features/competitive-awareness-deep-research.md` (DRAFT)

## Dependencies

- Prior art: WI-131 `landing-page` Market-Gap Analysis Step 0.5 — extend the frequency-table + severity pattern to competitor cross-reference
- Prior learning: `references/framework-learnings.jsonl` → `stored-knowledge-decay-requires-live-verification` (confidence 10)
- Touches: `analyze-competitors`, `validate-feature`, `write-spec`, `design-tech`, `onboard-repo`, `research`, `svc-advisor`, `route-workflow`, `references/knowledge/`

## Non-Goals

- This WI does NOT rewrite competitor analyses for existing svc-using projects (that's per-project work after the framework changes land)
- This WI does NOT add a UI / dashboard for competitor monitoring (CLI artifacts only)
- This WI does NOT replace the existing 9-dimension analysis in `analyze-competitors` — it ADDS structured customer-mechanic dimensions on top

## Dependency Spec Queue

After this svc changeset promotes to main, queue the following in dependent repos:

1. **example-marketplace repo — new WI:** Retroactive audit of WIs touching receipt scanning (WI-167 fraud fixes), enrollment (signup flow), and verification (`processReceipt`, `secureCheckIn`) using the new gates. Apply Phase 6 brownfield-competitive sweep day-1 logic. Likely outcome: backlog item for "Toast POS integration spike" if competitive evidence holds.
   - Trigger: svc framework changes promote to main (this WI's PR merges)
   - Owner: Stefan (Example Marketplace project)
   - Estimated: 1 day for audit, separate effort for any pivot decision

2. **All projects using svc — refresh sweep:** projects with existing `analyze-competitors.md` files SHOULD invoke `analyze-competitors --refresh` once after schema lands so their files conform to Phase 1 schema. Not blocking — gate emits warn-only on schema-noncompliant legacy files for 30 days post-promotion.
