# vercel-labs/skills `find-skills` — Discovery And Install Flow

## Mechanism

This source is a single `SKILL.md` file. There is no code, script, or helper module behind it. Its mechanism is an instruction sequence for the agent:

1. Trigger when a user is likely asking for missing capability rather than direct task execution.
2. Translate the user's request into a domain plus a concrete task.
3. Check `skills.sh` for obvious high-signal options first.
4. Run `npx skills find [query]` when the need is not already covered by the leaderboard.
5. Filter results with three heuristics:
   - install count
   - publisher reputation
   - GitHub repository credibility
6. Present the shortlist in a user-actionable format:
   - skill name
   - what it does
   - source and install count
   - install command
   - `skills.sh` link
7. If the user agrees, install with `npx skills add <owner/repo@skill> -g -y`.
8. If no match exists, fall back to direct help and optionally recommend `npx skills init`.

Operationally, the skill assumes the `skills` CLI returns ranked search results with install counts and `skills.sh` URLs. That assumption still holds as of 2026-04-10:

- `npx skills --help` exposes `find`, `add`, `check`, `update`, and `init`
- `npx skills find pr review` returns install suggestions plus install counts and `skills.sh` links

One important nuance: the "check the leaderboard first" step is part of the written workflow, not a built-in behavior of the CLI. The skill is telling the agent to do that extra triage before searching.

## Analysis

- **Useful for:** capability discovery, agent extensibility, and routing a user toward an existing skill instead of re-solving a common problem from scratch.
- **Trade-offs:** it favors popularity and publisher reputation, which is pragmatic but can hide niche high-quality skills; it also depends on manual judgment rather than automated package auditing.
- **Similar to:** this repo's `discover-skills` skill in spirit, but much thinner. `find-skills` is a tactical assistant for one user request, not a broader framework knowledge-ingestion workflow.
- **Could improve svc by:** adding a compact recommendation rubric for external skills and making the "help directly if nothing exists" fallback explicit in more discovery-oriented skills.
- **Assumptions:** internet access works, `skills.sh` is the ecosystem index, install counts are meaningful quality signals, and the user is willing to consider third-party skills.
- **Watch out for:** the repository-star threshold is a rough trust heuristic, not a security review; the leaderboard-first advice can bias results toward incumbents; and the skill has no built-in verification of whether a found skill truly solves the user's exact workflow.

## Key Source Files (L4 pointers)

- `skills/find-skills/SKILL.md:2` — frontmatter names the capability-discovery trigger
- `skills/find-skills/SKILL.md:10` — user-intent patterns that should invoke the skill
- `skills/find-skills/SKILL.md:21` — `npx skills` command surface the skill assumes
- `skills/find-skills/SKILL.md:34` — six-step discovery, vetting, recommendation, and installation workflow
- `skills/find-skills/SKILL.md:106` — category-based query seeds for search expansion
- `skills/find-skills/SKILL.md:126` — explicit fallback when no matching skill exists
