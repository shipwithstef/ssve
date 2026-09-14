---
**Status:** IMPLEMENTED — 2026-04-14
---

# Framework Improvement: teach-project Socratic Mode + Profile Growth Loop

## Evidence
- **Source:** User proposal via `/evolve-framework` (2026-04-14) → proposal `2026-04-14-teach-project-socratic-growth.md`
- **Finding:** `teach-project/SKILL.md` was one-shot document generation. Zero assessment/quiz/self-check infrastructure (grep-verified: 0 hits on Socratic|quiz|self-check|assessment|progression|level.up). Only covered technical dimension. No profile feedback loop — user's actual knowledge never flowed back into `~/.svc/builder-profile.md`, so downstream skills (P0, write-spec, design-tech) kept calibrating from the original declared-once onboarding snapshot.
- **Severity:** P1 — doesn't block any lane but blocks builder independence from the pipeline.

## Diagnosis
- **Root cause:** The skill's design treated teaching as a documentation task, not a learning loop. The builder profile was a read-only input. No mechanism for socratic diagnosis → profile update → better future calibration.
- **Category:** Gap (missing capability) + Opportunity (profile feedback loop)
- **Already in FRAMEWORK-STATE.md?** No

## Implementation
- **Route:** direct SKILL.md edit (plus a one-paragraph note in mine-builder/SKILL.md documenting shared-writer policy)
- **Files changed:**
  - `teach-project/SKILL.md` — added mode selection (Step 0), renamed existing flow to Auto Mode (A1–A5), added Socratic Mode (S1–S5) with three-dimension diagnostic (technical/product/operational), profile update loop, mode-aware Self-Verify, expanded Key Principles. 191 → 386 lines, still well under the 500-line guideline.
  - `mine-builder/SKILL.md` — added "Shared writers" paragraph in Mode 4 documenting teach-project socratic as secondary authorized profile writer.

### Key Design Choices

- **One skill, two modes** (not a new skill). Mode chosen at entry via one prompt; autorun chain defaults to auto, explicit phrases ("quiz me", "test me", "check what I know", "I want to learn") default to socratic.
- **Three dimensions, not just tech.** Technical (framework concepts, routing, data flow), Product (persona, moat, pricing logic), Operational (monitoring, cost curves, deploy/rollback). Product and Ops were completely absent before.
- **Questions grounded in this repo.** Every diagnostic question references real routes, files, personas, competitors from project artifacts. "React hooks are for reusable logic" is generic; "in `src/hooks/useLocation.js` the hook owns the geolocation subscription" is grounded.
- **Profile becomes living truth.** Socratic Mode updates `~/.svc/builder-profile.md § Skills` with confirmed-vs-gap breakdown plus a Changelog entry dated today. Upgrades AND downgrades skill entries explicitly rather than silently.
- **No OWNER-GUIDE.md overwrite in socratic.** The two modes produce different artifacts — auto produces the guide; socratic produces an updated profile + the session itself as teaching.
- **Shared-writer policy in mine-builder.** Documented that teach-project socratic is a secondary authorized profile writer; other skills should still route through mine-builder's Proactive Update mode.

## Replay Verification
- **Replay target:** A builder with a declared profile runs `/teach-project` socratic mode. At session end, their profile shows at least one Skills entry with today's date and a Changelog entry dated today naming which dimensions were covered.
- **Result:** PASS (structural — manual verification pending first real socratic run)
- **Evidence:** Self-Verify table has 6 socratic-mode checks (S1–S6) that cover: all three dimensions asked, questions grounded in artifacts, one-at-a-time delivery, profile Skills updated, Changelog appended, no OWNER-GUIDE.md overwrite. These are contract-level checks — the first real socratic session will exercise them.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for this fix
- **Known Gaps:** none to move (gap wasn't previously tracked)
- **Capabilities:** update `references/knowledge/svc/CAPABILITIES.md` — upgrade teach-project line 166 from "Owner guide calibrated to builder's knowledge gap" to include socratic mode + profile growth loop. Deferred to next explicit CAPABILITIES refresh — this single-skill change doesn't warrant a full `research` re-run on svc.
