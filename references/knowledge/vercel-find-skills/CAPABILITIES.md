# vercel-labs/skills `find-skills` — Layer 2 Capabilities

**Source:** https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md
**Version:** df0579f8
**Extracted:** 2026-04-10
**What it is:** A single-file meta-skill that teaches an agent how to discover, vet, recommend, and optionally install third-party skills from the open skills ecosystem.

## Core Role

- Detects capability-gap prompts such as "find a skill for X", "is there a skill for X", or "can you help with X" when the likely answer is an installable skill rather than custom work.
- Treats `npx skills` plus `skills.sh` as the discovery and installation surface for the ecosystem.
- Provides a decision workflow, not executable automation. The skill is guidance for the agent's behavior.

## Discovery Workflow

1. Understand the user's need by identifying the domain, the concrete task, and whether the task is common enough that an existing skill likely exists.
2. Check the `skills.sh` leaderboard first to look for an obvious well-known skill before running a keyword search.
3. Run `npx skills find [query]` if the leaderboard does not already reveal a strong match.
4. Verify quality before recommending a result.
5. Present the best options with description, source, install count, install command, and `skills.sh` link.
6. Offer to install the chosen skill with `npx skills add <owner/repo@skill> -g -y`.

## Quality Heuristics

- Prefer skills with 1K+ installs.
- Treat skills under 100 installs cautiously.
- Prefer publishers with established reputation such as `vercel-labs`, `anthropics`, or `microsoft`.
- Check the GitHub repository behind the skill and be skeptical if the repo has fewer than 100 stars.

## CLI Assumptions

- Relies on `npx skills find [query]` for search.
- Relies on `npx skills add <package>` for installation.
- Mentions `npx skills check` and `npx skills update` as maintenance commands.
- Recommends `npx skills init` as the fallback path when no existing skill fits.
- Verified on 2026-04-10: the current CLI help still exposes `find`, `add`, `check`, `update`, and `init`.

## Search Seeds

- Web development: `react`, `nextjs`, `typescript`, `css`, `tailwind`
- Testing: `testing`, `jest`, `playwright`, `e2e`
- DevOps: `deploy`, `docker`, `kubernetes`, `ci-cd`
- Documentation: `docs`, `readme`, `changelog`, `api-docs`
- Code quality: `review`, `lint`, `refactor`, `best-practices`
- Design: `ui`, `ux`, `design-system`, `accessibility`
- Productivity: `workflow`, `automation`, `git`

## Fallback Behavior

- If no relevant skills are found, acknowledge that clearly.
- Continue by helping directly with the task instead of blocking on skill discovery.
- Suggest creating a custom skill with `npx skills init` if the need is recurring.

## Files Manifest (all read for this scoped analysis)

| File | Read? | Notes |
|---|---|---|
| `skills/find-skills/SKILL.md` | yes | Entire scoped source; only substantive file in the target directory |
