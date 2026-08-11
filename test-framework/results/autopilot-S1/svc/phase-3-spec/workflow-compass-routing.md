# Workflow Compass Routing Report -- S1 TrendLearner

**Repo mode:** bootstrap (greenfield)
**Date:** 2026-04-03

---

## 1. State Detection

| Artifact           | Exists? | Notes                              |
|--------------------|---------|------------------------------------|
| Vision             | Yes     | `docs/specs/vision.md` produced by write-vision |
| Personas           | Yes     | 4 personas + PERSONA_INDEX.md via build-personas |
| Journeys           | No      | No `J*.feature.md` files           |
| Feature specs      | No      | No `docs/specs/features/*.md`      |
| Code               | No      | Greenfield -- no source yet        |
| E2E tests          | No      | No `e2e/**/*.spec.ts`              |
| Marketing context  | No      | No `docs/marketing/` artifacts     |

---

## 2. Recommended Next Skill

**`validate-feature`** -- confirmed.

The route-workflow "I'm starting a new product / major feature area" pattern prescribes:
write-vision (done) -> build-personas (done) -> **validate-feature** -> downstream pipeline.

Feature-discovery validates feature ideas against the existing personas and vision before any spec work begins. It produces the Ship Brief that feeds write-spec and write-journeys.

---

## 3. Full Pipeline Order (Skills 4-19)

| #  | Skill                      | Phase     | Rationale |
|----|----------------------------|-----------|-----------|
| 4  | validate-feature          | Phase 3   | Validate feature ideas against personas/vision; produce Ship Brief |
| 5  | write-spec               | Phase 3   | Convert Ship Brief into formal feature specs with AC tables |
| 6  | audit-ac               | Phase 3   | Audit AC tables for completeness and testability |
| 7  | write-journeys               | Phase 3   | Produce journey docs from specs + personas (needs specs to exist) |
| 8  | design-ux          | Phase 4   | Screen flows, interaction states, error handling |
| 9  | design-ui          | Phase 5   | Visual design system, component specs |
| 10 | design-tech   | Phase 6   | Architecture, data model, API contracts |
| 11 | review-gate            | Phase 6   | G4 gate: design review before code |
| 12 | plan-changeset         | Phase 7   | Produce code in worktree from approved design |
| 13 | land-changeset       | Phase 8   | Squash-merge worktree into main |
| 14 | verify-promotion        | Phase 9   | Post-merge verification (tests, QA, spec sync) |
| 15 | sync-spec-code             | Phase 9   | Annotate specs with RESOLVED/PLANNED/DRIFT status |
| 16 | test-journeys      | Phase 9   | QA journey flows against live server |
| 17 | write-e2e     | Phase 9   | Automated E2E tests from journey scenarios |
| 18 | analyze-marketing | Parallel  | Mine specs for marketing claims + audience segments |
| 19 | test-framework             | Meta      | Self-analysis of the full pipeline run |

---

## 4. External Add-On Status

- **coreyhaines-marketing-pack:** NOT installed. Not available for routing.
- **planning add-on (writing-plans):** NOT installed. Core `plan-changeset` used instead.
- **Fallback:** `analyze-marketing` (core pack) handles all marketing extraction.

---

## 5. Risks / Notes

1. **Hosted-for-profit deployment mode** (one of S1's 3 modes) may surface operator-specific features (billing, multi-tenant isolation, admin dashboards) during validate-feature. These will cascade additional specs and journeys beyond the initial set.
2. **Three deployment modes** (self-hosted, hosted-free, hosted-for-profit) mean validate-feature should explicitly validate each feature against all three modes to avoid mode-specific gaps later in the pipeline.
3. **No journeys before specs:** In the standard compass pattern, write-journeys appears after audit-ac. This is correct for greenfield -- journeys need feature specs to reference. The persona lifecycle progressions serve as proto-journeys until formal J* docs exist.
4. **Marketing is parallel-track:** analyze-marketing (Skill 18) reads specs but does not block the product pipeline. It can run any time after write-spec produces specs.
