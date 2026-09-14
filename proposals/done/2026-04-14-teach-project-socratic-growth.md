# Framework Evolution — 2026-04-14: teach-project Socratic Mode + Profile Growth Loop

## Method

Evidence gathered from:
- Live user session (2026-04-14) — direct user proposal for two-mode teaching
- `teach-project/SKILL.md` (191 lines) — current capability audit
- `mine-builder/SKILL.md` — builder profile structure, Skills / Gaps sections
- `references/knowledge/svc/CAPABILITIES.md:166` — stated capability: "Owner guide calibrated to builder's knowledge gap"

## Findings

### P1 — teach-project is one-shot document-generation, not a teaching loop

**File:** `teach-project/SKILL.md:82-139`

**Evidence:** Current skill flow is: read builder profile → read what was built → write `docs/OWNER-GUIDE.md`. The skill has zero mentions of assessment, Socratic questioning, self-check, quiz, progression, or profile-feedback (grep verified: 0 hits on `Socratic|quiz|self-check|ask.*question|knowledge.*gap.*check|progression|level.up|assessment`). It calibrates depth from the static profile once, produces a document, and ends. The builder reads the doc — or doesn't — and no signal returns to the profile about what the builder actually absorbed.

**Why this is a gap:**
- The builder profile (`~/.svc/builder-profile.md § Skills`) is declared once and never refined by teaching sessions. If the user reads the guide and internalizes React patterns, the profile still says "no React experience" — so the next pipeline run keeps building for a novice.
- The guide covers only one dimension (technical stack). Users who "own" a repo need product understanding (why these personas, why this pricing, why not that competitor) and operational understanding (how to monitor churn, when to raise prices, what breaks at 10K users). These aren't in the guide contract.
- The skill has one mode. Users who want to be quizzed ("I learn by failing questions") vs users who want a reference ("I'll skim the doc") get the same artifact.
- No growth vector. The skill's implicit endpoint is "user reads guide." The user's stated goal is steeper: "eventually do what Claude does in best practice latest trends" — there's no path from guide-reader to steerer-who-doesn't-need-the-guide.

**Category:** Gap (missing capability) + Opportunity (profile feedback loop)

**Severity:** P1 — doesn't block any lane, but blocks the builder's independence from the pipeline. The framework implicitly assumes the builder stays dependent; this proposal makes the framework actively reduce that dependency.

### Proposed Fix

**Add two modes to `teach-project`, user chooses at entry:**

| Mode | Trigger | Behavior |
|---|---|---|
| `auto` (default) | Builder profile has clear skill signal | Read profile, generate OWNER-GUIDE.md calibrated to known gaps, note what wasn't assessed |
| `socratic` (opt-in) | User says "teach me", "quiz me", "test me", "I want to learn", "check what I know" | Interactive session: ask diagnostic questions per dimension, identify actual gaps (not profile-claimed), teach those gaps, update builder profile |

**Mode selection** happens with one prompt: *"Auto-detect from your profile, or walk through a self-check together? Self-check takes 10 minutes but updates your profile and teaches what you actually don't know, not what the profile guesses."*

**Socratic mode covers three dimensions** (not just tech):

| Dimension | Example diagnostic questions |
|---|---|
| **Technical** | "What does the frontend framework here do? If the page `/dashboard` breaks, where do you look first? What's the difference between a server component and a client component in this codebase?" |
| **Product** | "Who's the primary persona, and what do they do 5 minutes after signup? Which competitor is closest, and what's the moat? If you had to raise prices 20%, which feature justifies it?" |
| **Operational** | "What monitoring do we have and where do you see it? At what user count does the free tier of our DB break? What's the first thing that goes wrong when a deploy fails?" |

**Question generation** is grounded in:
- `docs/specs/features/*.md` for product questions
- `docs/specs/analyze-competitors.md` for moat/positioning questions
- Source code + `OWNER-GUIDE.md` for technical questions
- `docs/specs/project-state.md` + cost-model entries for operational

**Profile growth loop:** at session end, update `~/.svc/builder-profile.md`:

```markdown
## Skills

- Backend: Node, Python, Docker (original)
- Frontend: React — basics confirmed 2026-04-14 via teach-project socratic
  (knows: JSX, props, useState; doesn't know: server components, Suspense)
- Product: understands persona model, knows primary competitor moat
- Ops: knows Vercel deploys, doesn't know how to read Supabase metrics yet

## Changelog
- 2026-04-14: teach-project socratic session — confirmed React basics,
  identified gaps in server components and Supabase observability
```

**Why this matters for downstream skills:** once the profile reflects actual knowledge (not profile-claimed), `P0 virtual founder`, `write-spec`, `design-tech`, and every skill that reads the builder profile makes better calibration decisions. The profile becomes a living truth, not a declared-once snapshot.

### Implementation Outline

- **`teach-project/SKILL.md`:** add mode selection at Step 0, add `Socratic Mode` section after Step 4, add `Profile Update Loop` as new Step 5 (runs only in socratic mode).
- **`mine-builder/SKILL.md`:** already writes the profile — add a note that teach-project socratic mode can also write to it (currently implicit single-writer assumption).
- **Self-verify additions:**
  - Auto mode: OWNER-GUIDE.md produced, calibration evidence in header
  - Socratic mode: profile `Changelog` has new entry dated today, dimensions covered logged

### Scope boundaries

- This does NOT replace `mine-builder`. mine-builder does initial mining; teach-project socratic does recalibration after a project has been built.
- This does NOT create a separate teaching skill. One skill, two modes, user picks.
- This does NOT try to teach "latest trends" in general — it teaches what's in THIS repo at best-practice depth. The user's aspiration to "one day do what Claude does" is a journey of many project cycles, not a single session. Each socratic session closes one layer of the gap.

## Comparison Delta

gstack, superpowers, GSD — none have a Socratic teaching flow that updates a builder profile. This would be svc-novel capability. Adjacent: Anthropic's `skill-creator` has evals but those are for the skill being created, not for the user being taught.

## Stale Proposal Audit

No prior proposals touch teach-project or builder-profile growth. This is net-new territory.
