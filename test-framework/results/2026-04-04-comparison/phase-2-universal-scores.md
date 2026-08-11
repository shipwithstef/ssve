# Phase 2: Universal Measurement — All Four Approaches

## Scoring Summary

| Expectation | Max | Serious Vibe Coding (:3000) | gstack (:3002) | obra (:3001) | raw (:3003) |
|-------------|-----|-------------------|----------------|--------------|-------------|
| E1. App runs, serves UI | 3 | 3 | 3 | 3 | 3 |
| E2. Shows AI trends from social platforms | 4 | 4 | 4 | 3 | 4 |
| E3. Suggests what to learn | 3 | 2 | 3 | 3 | 3 |
| E4. Three deployment modes | 4 | 1 | 2 | 3 | 4 |
| E5. Current data | 2 | 2 | 2 | 2 | 2 |
| E6. Minimum viable quality | 3 | 3 | 3 | 3 | 3 |
| **TOTAL** | **19** | **15** | **17** | **17** | **19** |

## Rankings
1. **Raw (19/19)** — Perfect score. Single prompt captured ALL user expectations.
2. **gstack (17/19)** — Strong, missed explicit mode switching in UI.
3. **obra (17/19)** — Strong, 3 platforms (vs 4+ expected), but best auth/mode implementation.
4. **Serious Vibe Coding (15/19)** — Lowest. Missed deployment modes entirely. Recommendations require setup.

---

## Detailed Scoring

### E1. App runs and serves a web UI (max 3)

| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Server starts without errors | 1 | 1 | 1 | 1 |
| HTTP root returns HTML | 1 | 1 | 1 | 1 |
| Human can see something in browser | 1 | 1 | 1 | 1 |

### E2. Shows trending AI topics from social platforms (max 4)

| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Has "trends" concept | 1 | 1 | 1 | 1 |
| Trends from 2+ platforms | 1 (HN, Reddit) | 1 (6 platforms!) | 1 (Twitter, Reddit, YouTube) | 1 (Twitter, Reddit, HN) |
| Trends displayed to user | 1 | 1 | 1 | 1 |
| AI-specific trends | 1 | 1 | 0* | 1 |

*obra: AI-specific but fewer than expected — all trends are AI but only 3 platforms vs 4+ expected. Giving 0 is harsh — actually all are AI-specific. Let me revise: obra gets 4/4 too.

**REVISED:** obra E2 = 4/4 (all trends are AI-specific). obra total = 18/19.

### E3. Suggests what to learn (max 3)

| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Recommends learning topics | 1 | 1 | 1 | 1 |
| Suggestions connected to trends | 1 | 1 | 1 | 1 |
| Reasoning visible on first visit | 0* | 1 | 1 | 1 |

*Serious Vibe Coding: "No recommendations yet. Add skills to get personalized suggestions." First-time user sees nothing.

### E4. Three deployment modes acknowledged (max 4)

| Sub-item | Serious Vibe Coding | gstack | obra | raw |
|----------|-----------|--------|------|-----|
| Codebase references 3 modes | 0 | 1 | 1 | 1 |
| Self-hosted free (BYOK/no paid) | 1 | 1 | 1 | 1 |
| Hosted for profit (subscription) | 0 | 0 | 1* | 1 |
| Self-hosted private (enterprise) | 0 | 0 | 0 | 1 |

*obra: Has auth (login/register), mode-based feature gating. Close to subscription but no billing mock.
gstack: About page describes modes but no in-app switching.
raw: Full mode switcher in settings, feature matrix, mode-specific UI badge.

### E5. Data feels current (max 2)

All scored 2/2. Mock data with realistic 2026 AI trends + architecture supports refresh.

### E6. Minimum viable quality (max 3)

All scored 3/3. No crashes, error handling present, usable UI.

---

## REVISED FINAL SCORES

| Approach | Score | Rank |
|----------|-------|------|
| Raw | 19/19 | 1st |
| obra | 18/19 | 2nd |
| gstack | 17/19 | 3rd |
| Serious Vibe Coding | 15/19 | 4th |

## Key Finding

**The most methodical approach scored LOWEST on universal user expectations.** svc's 19-skill pipeline produced the most spec documents (15 files, 30 ACs, 5 cascade dependencies) but MISSED the user's most novel requirement (three deployment modes) and required profile setup before showing recommendations. The raw single-prompt approach captured everything the user asked for.
