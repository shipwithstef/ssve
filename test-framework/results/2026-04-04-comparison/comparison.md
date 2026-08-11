# Four-Way Methodology Comparison Report

**Date:** 2026-04-04
**Scenario:** S1 — AI Trend Learning Recommender
**Prompt:** "I want to make an app that suggests what to learn for AI based on what is trendy in social platforms today. Three deployment modes: (1) self-hosted free, (2) hosted for profit, (3) self-hosted private."

---

## Executive Summary

Four approaches built the same app from the same one-sentence prompt. The most methodical approach (svc, 19-skill pipeline) scored **lowest** on user expectations. The least methodical (raw, single prompt) scored **highest**. This does not mean methodology is useless — it means methodology overhead must be calibrated to project maturity.

| Approach | Universal Score | Files | LOC | Tests | Spec Docs | Deploy Modes |
|----------|----------------|-------|-----|-------|-----------|-------------|
| **Raw** | **19/19** | 9 | 589 | 0 | 0 | 3/3 ✓ |
| **obra** | **18/19** | 21 | ~800 | 0 | 2 | 3/3 ✓ |
| **gstack** | **17/19** | 7 | 718 | 0 | 0 | 1/3 partial |
| **Serious Vibe Coding** | **15/19** | 20 | 832 | 16 | 15 | 0/3 ✗ |

---

## What Each Approach Produced

### Serious Vibe Coding (port 3000) — 19-skill pipeline
- **15 spec documents** (vision, 3 personas, feature spec with 30 ACs, UX design, UI design, design system, tech design, 3 journeys, journey index, persona index, ship brief)
- **20 source files** across services, routes, views, mock data, public JS
- **16 unit tests** (all passing) — only approach with tests
- **Dark mode toggle**, profile page, settings page, trend cards with expandable sources
- **MISSED:** Deployment modes entirely (0 code references). Recommendations empty on first visit.

### gstack (port 3002) — Office-hours + direct coding
- **0 formal spec docs** (brainstormed inline, decided on simpler options)
- **7 source files** (3 TypeScript, 4 EJS views)
- **Strongest visual design:** gradient header, velocity indicators (hot/warm/rising), platform emoji tabs for 6 platforms, inline learning resources with reasons
- **18 trends, 18 resources, 28 recommendation links** in seed data
- About page describes deployment modes but no in-app switching

### obra (port 3001) — Brainstorm → Plan → Execute
- **2 methodology docs** (design spec + implementation plan with file map)
- **21 source files** (13 TypeScript across engine/, middleware/, routes/, seed/ + 8 EJS views)
- **Best code architecture:** dedicated middleware for auth and mode, separate route files per concern, login/register pages
- **Mode middleware** reads DEPLOY_MODE env var and gates features per mode
- Recommendations visible immediately with difficulty badges and trend connections

### Raw (port 3003) — Single prompt, no methodology
- **0 planning artifacts** — went straight to code
- **9 source files** (2 TypeScript, 6 EJS views, 1 package.json)
- **Best first-time UX:** dashboard shows trends, stats, and recommendations on first load
- **Full deployment mode switcher** in settings with feature matrix per mode
- **Mode badge** in header, three clickable mode cards (free/SaaS/private)
- Compiled cleanly on first try, zero errors

---

## Universal Expectations (Phase 0) — Detailed Scores

### E1. App runs and serves web UI (max 3)
All four scored **3/3**. Every approach produced a running server with HTML pages.

### E2. Shows trending AI topics from social platforms (max 4)
| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Trends concept | ✓ | ✓ | ✓ | ✓ |
| 2+ platforms | ✓ (HN, Reddit) | ✓ (6 platforms) | ✓ (Twitter, Reddit, YouTube) | ✓ (Twitter, Reddit, HN) |
| Trends displayed | ✓ | ✓ | ✓ | ✓ |
| AI-specific | ✓ | ✓ | ✓ | ✓ |

### E3. Suggests what to learn (max 3)
| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Recommends topics | ✓ | ✓ | ✓ | ✓ |
| Connected to trends | ✓ | ✓ | ✓ | ✓ |
| Visible on first visit | **✗** | ✓ | ✓ | ✓ |

**Key finding:** svc's spec required user profile for personalization, creating an empty first-visit experience. All others showed recommendations immediately.

### E4. Three deployment modes (max 4)
| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Code references 3 modes | **✗** | ✓ | ✓ | ✓ |
| Self-hosted free | ✓ (implicit BYOK) | ✓ | ✓ | ✓ |
| Hosted for profit | **✗** | **✗** | ✓ | ✓ |
| Self-hosted private | **✗** | **✗** | **✗** | ✓ |

**Key finding:** The user's most novel requirement — three deployment modes — was BEST captured by the approach with ZERO planning. svc's 15 spec docs discussed modes in the vision doc but never translated them to code.

### E5. Data feels current (max 2) — All scored 2/2
### E6. Quality (max 3) — All scored 3/3

---

## What Practices Actually Matter

### 1. Spec-before-code catches architectural dependencies (VALUABLE)
Serious Vibe Coding identified 5 cascade dependencies that no other approach named. In a growing product, these unnamed dependencies become technical debt. Cascade discovery is a production-scale tool, not an MVP tool.

### 2. Progressive narrowing can LOSE information at phase boundaries (DANGEROUS)
The three deployment modes were captured in svc's vision doc (Section 3: "Who We Serve") but never appeared in the feature spec's ACs, and therefore never in code. Each phase boundary is a lossy translation — exactly what the doctrine warns about.

**Fix applied:** write-spec now explicitly extracts deployment modes from the vision doc and requires ACs for each mode.

### 3. First-time UX must be a pipeline test (MISSING FROM ALL METHODOLOGIES)
None of the four approaches had a formal "first visit" test. Raw accidentally got it right because the agent thought about the user experience end-to-end. svc's spec-driven approach was too focused on personalization mechanics.

**Fix applied:** test-framework now includes a first-time user experience test.

### 4. Planning overhead is inversely correlated with MVP quality (SURPRISING)
| Planning time | User-visible quality |
|--------------|---------------------|
| ~0 (raw) | 19/19 |
| Low (gstack) | 17/19 |
| Medium (obra) | 18/19 |
| High (svc) | 15/19 |

This is NOT because planning is bad. It's because the agent's context window is finite. Time spent on specs is time NOT spent on code. For an MVP, the agent's training data already has strong patterns for "build a web app that does X." The spec adds value only when it tells the agent something it wouldn't have figured out from the prompt — and at MVP scale, the prompt IS the spec.

### 5. Plan-to-code fidelity matters more than plan quality (OBRA'S STRENGTH)
Obra produced a plan with a file map (every file + responsibility) and then executed it faithfully (21/20+ files implemented). Serious Vibe Coding produced a better SPEC but worse CODE. The bottleneck is translation, not specification.

**Fix applied:** plan-changeset now requires a config section for deployment modes when the vision mentions them.

### 6. Design quality correlates with design ATTENTION, not design PROCESS (GSTACK'S STRENGTH)
gstack's "forcing questions" approach (3-5 targeted questions before coding) produced the best visual design. svc's formal UX design + UI design + design system pipeline produced a generic Tailwind layout. The difference: gstack asked "what does the output look like?" before coding. Serious Vibe Coding answered that question in a spec doc that was too far from the code.

### 7. Testing happened only in the most methodical approach (SVC'S STRENGTH)
Only svc produced tests (16 unit tests, all passing). This is the one area where pipeline overhead pays dividends. Raw, gstack, and obra all shipped zero tests. For production code, this is unacceptable.

---

## Recommendations for Serious Vibe Coding

### ADOPT
1. **Immediate value on first visit** — default recommendations without profile (from raw)
2. **DEPLOY_MODE as first-class AC** — deployment modes must become ACs, not just vision-level concepts (from raw/obra)
3. **Forcing questions before spec** — gstack-style scoping questions bridge vision→spec faster (from gstack)
4. **Plan file map with responsibilities** — obra's file→responsibility mapping improves agent context (from obra)

### DROP (for MVPs)
1. **Separate UX and UI design phases** — merge into single "UI/UX brief" for greenfield MVPs
2. **Profile-required recommendations** — show generic recommendations first, personalize after profile setup
3. **Post-hoc sync-spec-code** — annotate ACs as RESOLVED during code generation, not after

### KEEP
1. **Cascade discovery** — the only approach that named architectural dependencies
2. **Unit tests in the pipeline** — the only approach with automated tests
3. **Vision doc** — captured product direction, boundaries, non-goals better than all others
4. **Review gates** — not exercised in this run, but structurally sound for production

---

## SKILL.md Fixes Committed

| Skill | Fix | Why |
|-------|-----|-----|
| write-spec | Added deployment mode extraction from vision doc | Modes were in vision but never became ACs |
| plan-changeset | Added mandatory config section for deployment modes | Code never implemented the modes the spec discussed |
| test-framework | Added first-time user experience test | Empty first visit wasn't caught by any existing test |

---

## Numbers

| Metric | Serious Vibe Coding | gstack | obra | raw |
|--------|-----------|--------|------|-----|
| Universal score | 15/19 | 17/19 | 18/19 | 19/19 |
| Source files | 20 | 7 | 21 | 9 |
| Lines of code | 832 | 718 | ~800 | 589 |
| Unit tests | 16 | 0 | 0 | 0 |
| Spec/plan docs | 15 | 0 | 2 | 0 |
| Platforms tracked | 2 | 6 | 3 | 3 |
| Deployment modes in code | 0 | 1 | 3 | 3 |
| Auth/login | No | No | Yes | No |
| First-visit recommendations | No | Yes | Yes | Yes |
| Time to running server | Pre-existing | ~3 min | ~8 min | ~2 min |
| Code architecture quality | Good | Minimal | Excellent | Minimal |
| Visual design quality | Generic | Distinctive | Clean | Polished |

---

## The Bottom Line

**For MVPs:** Skip the full pipeline. Use gstack-style forcing questions + direct coding. Or just write code (raw).

**For growing products:** Use obra-style plan→execute with file maps. Add svc's cascade discovery and tests.

**For mature products at scale:** Use svc's full pipeline — but fix the phase boundary translations. The spec must CONSTRAIN the code, not just DESCRIBE the intent.

The methodology that produces the best DOCUMENTATION is not the methodology that produces the best CODE. The methodology that produces the best code is the one that keeps user requirements in the agent's active context during code generation. Right now, svc's specs are thorough but distant from the code. Closing that gap — specs as active constraints, not filed artifacts — is the key improvement.
