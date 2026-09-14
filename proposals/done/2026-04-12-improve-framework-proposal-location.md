# Framework Improvement: improve-framework skill had wrong mental model for proposal location

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** User-reported — multiple rounds of confusion
- **Finding:** `improve-framework/SKILL.md` Output Artifact section described proposals as going to `~/.claude/skills/proposals/` (the install target). This is wrong — the framework lives in the source repo (seriousvibecoding). The install target (~/.claude/skills/) is a hard-linked copy, not the source of truth.
- **Severity:** high — wrong mental model causes agents to conceptually work in the wrong place

## Diagnosis

- **Root cause:** The skill text described the install path (`~/.claude/skills/`) rather than the source repo. An agent following this description would not understand it needs to commit changes to the git-tracked seriousvibecoding repo.
- **Category:** fragility / wrong mental model

## Implementation

- **Route:** direct SKILL.md edit
- **Files changed:** `improve-framework/SKILL.md` — Output Artifact section now says "write to `proposals/` in the svc framework source repo (seriousvibecoding/)". Step 1.5 and Step 6b updated to use bare `proposals/` path with git commit step. Self-verify check #8 updated.

## Replay Verification

- **Replay target:** Next improve-framework run operates on seriousvibecoding/, writes proposal to seriousvibecoding/proposals/, commits it
- **Result:** MANUAL

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** added
- **Decisions:** Agent always operates on seriousvibecoding/ source repo; proposals/ is in that repo
