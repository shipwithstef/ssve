# Infrastructure — Detail

## Mechanism (factual)

**Plugin system:** `.claude-plugin/marketplace.json` + `plugin.json` for Claude Code plugin marketplace. Install via `/plugin marketplace add coreyhaines31/marketingskills`. Fixed in v1.9.0 (source field schema validation).

**Validation scripts:**
- `validate-skills-official.sh` (85 lines) — Agent Skills spec validation
- `validate-skills.sh` (169 lines) — YAML frontmatter, description length, required fields, cross-references

**Evals system (v1.4.0):** 197 evals across 33 skills. Each eval has conversation inputs, expected assertions, boundary tests. Stored as `skills/<name>/evals/evals.json`.

**Version tracking:** `VERSIONS.md` — central registry listing every skill with version + last updated date. Agents compare local versions against this.

**Multi-agent architecture:** Since v1.3.0, uses `.agents/` directory (not `.claude/`). Fallback to `.claude/` for older setups. Works with Claude Code, Codex, Cursor, Windsurf.

**Skill structure:**
```
skills/<name>/
├── SKILL.md           # Contract (YAML frontmatter + workflow)
├── references/        # Detailed guides (loaded on demand)
└── evals/             # Test cases (v1.4.0+)
```

**Progressive disclosure:** Skills load core instructions first, pull references on demand. Reduces token usage.

## Analysis (expert commentary)

- **Useful for:** The evals system is the most interesting infrastructure piece — 197 automated tests across skills is more than most skill frameworks have. The VERSIONS.md pattern enables agent-driven update detection.
- **Trade-offs:** Plugin support is Claude Code specific. Multi-agent support via `.agents/` is good but not all skills have been tested across all agents. The validation scripts are bash-only (no CI integration visible).
- **Similar to:** svc's tier-1 validation (structure, contracts, frontmatter AST) is more sophisticated. But coreyhaines' evals are behavioral (conversation inputs → expected outputs) while svc's are structural. Different strengths.
- **Could improve svc by:** The evals pattern (conversation inputs + expected assertions) could be adopted for svc's tier-2 integration tests. Currently svc tests structure but not behavioral correctness.
- **Assumptions:** Skills are content-only (no build step). CLI tools require Node 18+. No dependency management (zero-dep by design).
- **Watch out for:** 7 skills lack evals (aso-audit, community-marketing, competitor-profiling, directory-submissions, image, lead-magnets, video). These are all v1.7+ community contributions — quality not verified.

## Key Source Files (L4 pointers)

- `validate-skills-official.sh` — Agent Skills spec validation logic
- `validate-skills.sh` — YAML frontmatter + cross-reference validation
- `VERSIONS.md` — Central version registry
- `.claude-plugin/marketplace.json` — Plugin marketplace manifest
- `AGENTS.md` — Repository structure, build/lint/test commands, Agent Skills spec details
