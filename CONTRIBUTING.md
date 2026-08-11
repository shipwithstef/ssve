# Contributing to Serious Vibe Coding

This is an opinionated blend of the best patterns from the Claude Code
ecosystem. Contributions that make the pipeline faster, the specs tighter,
or the output more reliable are welcome.

## How to Contribute

### 1. Fix something broken

Found a skill that gives bad advice, a cross-reference that's wrong, or a
gate that doesn't catch what it should? Open a PR with the fix. No issue
required for obvious fixes.

### 2. Improve a skill

Read the skill, run it on a real project, and find where it falls short.
The best improvements come from real usage — not theoretical "what if"
scenarios. Include what you tested and what went wrong before the fix.

### 3. Blend from a new source

Found a skill pack, agent framework, or methodology with patterns svc
should take? Use `blend-external` (mode 1: new source) to produce a blend
plan, then implement it. The PR should include:
- The blend plan in `proposals/`
- The SKILL.md changes
- Updated `references/blend-registry.json` with the source SHA
- Updated `NOTICES` with attribution

### 4. Propose an evolution

Use `evolve-framework` to audit the pipeline and find improvement
opportunities. The skill produces a prioritized proposal with evidence
citations. Submit the proposal as a PR — discussion happens in the review.

### 5. Add a companion integration

svc works best with companion skills (gstack browse, last30days, etc.).
If you know a tool that fills a gap, add it as an optional integration:
- Reference it in the relevant SKILL.md files (with fallback when not available)
- Add setup instructions to README.md
- Add attribution to NOTICES

### 6. Create a new skill

Copy an existing skill as a starting point — pick one closest to what you're
building. Follow the same structure (frontmatter, process, self-verify,
pipeline continuation). Run `node scripts/lint-skills-manifest.mjs` when done.

**Mandatory: Before Starting section.** Every new SKILL.md authored on or
after 2026-04-28 MUST include a `## Before Starting` section that builds a
bounded context plan from the session contract, `.svc/spec-index.json`,
work-item indexes, manifest metadata, and the relevant specs or validators.
The rule is **complete relevant context**: follow dependency and index links
until the affected surface is understood, without bulk-reading unrelated
artifacts. See `_shared/before-starting.md` for the canonical contract and
section template.

The tier-1 validator
`test-framework/evals/tier-1/validate-skill-before-starting.sh` is advisory
for legacy skills and blocking for skills authored on or after 2026-04-28.
Rationale: WI-135.

Optionally install Anthropic's [skill-creator](https://github.com/anthropics/skills)
for eval infrastructure and description optimization — see `EXTERNAL_ADDONS.md`.

## Skill Conventions

All skills follow the `verb-noun` naming convention:

| Verb | Means | Example |
|------|-------|---------|
| `write` | Create a text artifact | `write-spec` |
| `design` | Create a design artifact | `design-ux` |
| `plan` | Create an execution plan | `plan-changeset` |
| `execute` | Carry out a plan | `execute-changeset` |
| `audit` | Check consistency/correctness | `audit-ac` |
| `review` | Evaluate quality at a gate | `review-gate` |
| `sync` | Push state externally | `sync-work-items` |
| `test` | Run tests/QA | `test-journeys` |
| `analyze` | Research/intelligence | `analyze-domain` |
| `blend` | Integrate from external | `blend-external` |
| `evolve` | Improve the framework | `evolve-framework` |

Every SKILL.md has YAML frontmatter with:
- `name` — matches the directory name
- `description` — when to trigger (be specific, include phrases users say)
- `inputs` — required and optional artifacts
- `outputs` — what the skill produces
- `chain` — lane positions, prev/next skills

## Feature Toggle Requirement

Every feature that touches an external service must ship with:
1. A mock implementation (ON by default)
2. A real implementation (behind a feature toggle, OFF by default)
3. An entry in `docs/specs/toggle-registry.md`

See [`references/feature-toggles.md`](references/feature-toggles.md).

## Pipeline Integrity

After any change, verify:

```bash
# Skill count matches manifest
node scripts/lint-skills-manifest.mjs

# All skills have SKILL.md
find . -maxdepth 2 -name SKILL.md -not -path "./.git/*" | wc -l
```

The skill count in `skills-manifest.json`, README.md, and EXTERNAL_ADDONS.md
must all match.

## Commit Messages

Use this format:

```
<scope>: <what changed>

<why, in 1-3 lines>

Co-Authored-By: <your name> <your email>
```

Scope examples: `write-spec`, `doctrine`, `readme`, `blend-external`.

## Code of Conduct

Be kind. Review constructively. Assume good intent. If someone's approach
is different from yours, explain why you'd do it differently — don't dismiss it.

## License

By contributing, you agree that your contributions are licensed under the
MIT License.
