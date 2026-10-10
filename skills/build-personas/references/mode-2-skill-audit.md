## Mode 2: Skill Audit

Triggered when the user says "audit skills against personas", "do our skills serve
the user", "persona audit", or similar.

### What it does

Reads all persona files in `docs/specs/personas/`, then reads the skill files for
each consuming skill, and evaluates: **does this skill account for the different
personas, or does it treat all users as identical?**

### Skills to audit

Check for these skills and audit them if they exist:

| Skill | What to check | Common failure |
|-------|--------------|----------------|
| write-journeys | Does it use persona files? Does each journey specify which persona it serves? | Generates generic journeys that don't differentiate user types |
| copywriting | Does it consider different personas' language, skepticism, motivations? | One-size-fits-all copy that resonates with nobody specifically |
| cro | Does it evaluate the page for each persona separately? | Optimizes for one persona type and loses others |
| onboarding | Does it account for different patience budgets and value expectations? | Assumes all users have the same tolerance for friction |
| signup | Does it consider what each persona needs to see before committing? | Generic signup that doesn't address persona-specific fears |
| popups | Does it match messaging to persona context? | Same popup for everyone |
| content-strategy | Does it target content to specific personas? | Generic content that doesn't speak to anyone specifically |

### Audit output

For each skill, produce:

```markdown
## [Skill Name] Audit

**Current persona awareness:** [None / Partial / Good]

### Findings

| # | Finding | Affected personas | Severity | Recommendation |
|---|---------|------------------|----------|----------------|
| 1 | [what's missing or wrong] | P1, P3 | [High/Med/Low] | [specific change] |

### Recommended Skill Changes

[Specific, actionable changes to the skill file. Not vague "consider personas" —
exact sections to add, exact checks to perform.]
```

Save the full audit to `docs/specs/personas/SKILL_AUDIT.md` with a datestamp.

### Audit principles

- **Specificity over generality.** "This skill should consider personas" is useless.
  "The write-journeys skill's Phase 2 builds personas from scratch instead of reading
  docs/specs/personas/ — it should consume the pre-built persona files and skip its
  own persona generation" is actionable.

- **Every finding needs a persona.** Don't say "users might bounce here." Say
  "P2 (The Cautious First-Timer) bounces here because their patience budget is
  2 minutes and this flow takes 4."

- **Suggest, don't demand.** The skill audit produces recommendations. The user
  decides what to implement. Present findings ranked by impact.

---
