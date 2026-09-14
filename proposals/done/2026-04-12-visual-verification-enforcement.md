# Framework Improvement: Visual Verification Enforcement

## Evidence
- **Source:** Live WI-032 execution on Example Marketplace — dark mode finish pass declared VERIFIED-L3 without any visual evidence
- **Finding:** Task graph for Lane 3 browser-visible feature was abbreviated from 17 steps to 5, omitting both track-visuals invocations, canary monitoring, and review-gate viewport evidence. All three omissions are individually documented as MANDATORY in skill contracts but none are enforced via self-verify checks.
- **Severity:** high — non-technical stakeholders cannot trust VERIFIED status

## Diagnosis
- **Root cause:** Framework has prose-level mandatory rules for visual verification (route-workflow line 1720, review-gate G7 item 7, verify-promotion canary monitoring section) but no self-verify enforcement. Task graph creation has no validation for mandatory-step completeness.
- **Category:** fragility (enforcement gap)
- **Already in FRAMEWORK-STATE.md?** No — the track-visuals wiring was marked DONE (prose level) but this enforcement gap is new

## Implementation
- **Route:** direct SKILL.md edits (3 files)
- **Files changed:**
  - `verify-promotion/SKILL.md` — added self-verify checks #4 (canary health report), #5 (visual evidence), #6 (test failure base-state comparison). Added VERIFIED confidence tiers (L1/L2/L3).
  - `review-gate/SKILL.md` — added self-verify check #4 (visual evidence gate for browser-visible features)
  - `route-workflow/SKILL.md` — added mandatory-step validation (step 5) after task graph creation: browser-visible features require track-visuals baseline + diff, review-gate viewport gate, verify-promotion canary monitoring

## Replay Verification
- **Replay target:** Next browser-visible WI on Example Marketplace — task graph must include visual verification steps or explicit skip justification
- **Result:** PENDING — next live execution
- **Evidence:** PENDING

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add "2026-04-12: visual verification enforcement gap" entry
- **Known Gaps:** none to move (new finding)
- **Decisions:** add "VERIFIED confidence tiers (L1/L2/L3) — mandatory for browser-visible features"
- **Capabilities:** update svc/CAPABILITIES.md with visual verification enforcement
