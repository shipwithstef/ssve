# Framework Improvement: explore-ux Skill

## Evidence

- **Source:** `evolve-framework` survey + user direct request (route-workflow invocation)
- **Finding:** No svc skill performs interactive competitive UX exploration on live app surfaces. `track-visuals` review mode is self-referential (rubric-only). `benchmark-landing` is landing-page-only. `analyze-competitors` covers product mechanics, not UX patterns. `test-journeys` exploratory mode is unguided by competitive knowledge.
- **Severity:** high
- **Proposal:** `proposals/2026-05-07-evolution-competitive-ux-explorer.md` (Option B: new skill)

## Diagnosis

- **Root cause:** The framework's visual/UX verification stack was built bottom-up: screenshot capture (`track-visuals`), AC-bound QA (`test-journeys`), landing-page benchmarking (`benchmark-landing`), and competitive product analysis (`analyze-competitors`) all exist as separate skills. No skill occupies the intersection of **live app exploration + competitive UX knowledge + proactive improvement proposals**.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** no (new gap, logged as `competitive-ux-explorer` in `.svc/framework-gaps.jsonl`)

## Implementation

- **Route:** `create-skill`
- **Skill name:** `explore-ux`
- **Expected files:**
  - `explore-ux/SKILL.md` (frontmatter + contract body)
  - `explore-ux/references/` (competitive pattern examples, if needed)
  - `skills-manifest.json` update (register skill)
  - `README.md` update (skill list)
  - `EXTERNAL_ADDONS.md` update (if applicable)
  - `REPO_MODES.md` update (if bootstrap sequence affected)
  - `route-workflow/references/routing-rules.md` update (if intent table affected)
- **Commits:** (to be filled by create-skill execution)

### Skill contract (draft)

**Modes:**
- `competitive-benchmark` — browse app flows, compare step count / clarity / delight against competitor knowledge base
- `friction-audit` — identify unnecessary steps, dead ends, cognitive load vs. competitor best-in-class
- `innovation-proposal` — propose UX improvements grounded in competitor patterns + domain knowledge

**Inputs:**
- `references/knowledge/competitors/<slug>/` (competitor knowledge base)
- `references/landing-bank/<sector>/` (visual reference bank)
- Live app URL

**Outputs:**
- `docs/specs/ux-exploration/<run-id>.md` — findings + competitive citations + proposals
- `.svc/ux-exploration/<WI>/proposals.jsonl` — structured improvement proposals

**Prerequisites:** `analyze-competitors` or `benchmark-landing` must have populated competitive knowledge before this skill runs.

## Replay Verification

- **Replay target:** After skill creation, run `test-framework/evals/tier-1/validate-skill-structure.sh` against `explore-ux/SKILL.md`; run tier-1.5 comprehension prompt for trigger accuracy.
- **Result:** (to be filled after implementation)
- **Evidence:** (to be filled after implementation)

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry for 2026-05-07: `explore-ux` skill created to close competitive-ux-explorer gap
- **Known Gaps:** Move `competitive-ux-explorer` from open to closed
- **Decisions:** New skill counts toward total skill count
- **Capabilities:** Update `references/knowledge/svc/CAPABILITIES.md` to list competitive UX exploration
