# Phase 0: Universal Expectations

> Derived ONLY from the user's sentence. No methodology influenced these.
> "I want to make an app that suggests what to learn for AI based on what is trendy in social platforms today. Three deployment modes: (1) self-hosted free, (2) hosted for profit, (3) self-hosted private."

## What a user who typed that sentence would expect to see

### E1. App runs and serves a web UI
- [ ] Server starts without errors
- [ ] HTTP request to root returns HTML (not just JSON)
- [ ] A human can open a browser and see something

### E2. Shows trending AI topics from social platforms
- [ ] There is a concept of "trends" in the app
- [ ] Trends are associated with social platforms (Twitter/X, Reddit, HN, LinkedIn, YouTube — at least 2)
- [ ] Trends are displayed to the user in some form
- [ ] Trends relate to AI specifically, not general social media trends

### E3. Suggests what to learn
- [ ] The app recommends learning topics/skills/resources — not just raw trend data
- [ ] Suggestions are connected to the trends (not random)
- [ ] A user can understand WHY something is suggested (some reasoning or trend evidence)

### E4. Three deployment modes are acknowledged
- [ ] The codebase or UI references the three modes
- [ ] Self-hosted free: no hard-coded paid services, or uses BYOK (bring your own key) pattern
- [ ] Hosted for profit: some concept of subscription/payment/multi-tenant
- [ ] Self-hosted private: can be run behind a firewall for a team/company

### E5. Data feels current (or could be current)
- [ ] Either scrapes/fetches real data, or has a mock/seed that represents realistic current trends
- [ ] The architecture supports refreshing data (not just static content)

### E6. Minimum viable quality
- [ ] No crash on basic navigation
- [ ] Error states are handled (not raw stack traces)
- [ ] The UI is usable (not just a JSON dump)

## Scoring

Each expectation (E1-E6) has sub-items. Score per sub-item: 1 (met) or 0 (not met).

| Expectation | Sub-items | Max Score |
|-------------|-----------|-----------|
| E1. App runs | 3 | 3 |
| E2. Shows trends | 4 | 4 |
| E3. Suggests learning | 3 | 3 |
| E4. Three modes | 4 | 4 |
| E5. Current data | 2 | 2 |
| E6. Quality | 3 | 3 |
| **Total** | **19** | **19** |

## How to test

For each running server:
1. `curl -s http://localhost:{port}/` — check HTML response
2. `curl -s http://localhost:{port}/api/trends` (or equivalent) — check trend data
3. `curl -s http://localhost:{port}/api/recommendations` (or equivalent) — check suggestions
4. Browse the UI visually (screenshot or Playwright)
5. Grep the codebase for deployment mode references
6. Navigate to 3-4 pages, check for crashes
