# Harness Skill Generation — Detail

## Mechanism

Phase 4 of the harness workflow. Generates `.claude/skills/{name}/SKILL.md`
for each agent in the team.

### Progressive Disclosure (3-tier loading)

| Tier | When loaded | Size target |
|---|---|---|
| Metadata (name + description) | Always in context | ~100 words |
| SKILL.md body | When skill triggers | <500 lines |
| references/ | On demand | Unlimited |

**Rules:**
- SKILL.md approaching 500 lines → move detail to `references/`
- Reference files >300 lines → add table of contents
- Domain variants → separate reference files per variant (e.g., `references/aws.md`, `references/gcp.md`)

### Description Writing ("pushy" triggers)

Claude undertriggers skills. Descriptions must be aggressive:
- Bad: "PDF processing skill"
- Good: "Read, extract, merge, split, rotate, watermark, encrypt, OCR PDFs. Use whenever .pdf files are mentioned or PDF output is requested."

Include both: what the skill DOES + specific trigger situations.
Also include follow-up keywords: "re-run", "update", "modify", "improve previous result"

### Skill-Agent Relationship

- 1 agent → 1-N skills (1:1 or 1:many)
- Shared skills across agents are allowed
- Skill = HOW (instructions). Agent = WHO (role + principles).

### Body Writing Principles

| Principle | Detail |
|---|---|
| Explain WHY | Not "ALWAYS do X" but "do X because Y, so the model adapts at edge cases" |
| Keep lean | <500 lines, context window is shared |
| Generalize | Principles over narrow rules. No overfitting to examples. |
| Bundle repeated code | If agents keep writing the same helper → put it in `scripts/` |
| Imperative voice | "Do X", "Write Y", not "You might want to..." |

## Analysis

- **Useful for:** Any team that needs to create project-specific skills dynamically. Our `create-skill` does something similar but doesn't scope skills to specific agents.
- **Trade-offs:** Generating skills per-agent means more files but better separation. The "pushy description" advice is directly applicable to svc skill descriptions.
- **Similar to:** svc's `create-skill` + anthropic's `skill-creator`. Harness adds the agent-skill mapping that neither has.
- **Could improve svc by:** Our skill descriptions could be more aggressive about triggering. The "always include follow-up keywords" advice is actionable. The 3-tier progressive disclosure model matches our own knowledge system layers — L1/L2/L3 map naturally to metadata/body/references.
- **Assumptions:** Each agent needs its own skills. Shared skills are possible but the default is 1:1 or 1:N per agent.
- **Watch out for:** Skills generated for a harness are project-specific, not reusable across projects (unlike svc's global skills). A harness team for "novel writing" generates writing-specific skills that don't help with "API development."

## Key Source Files (L4)
- `skills/harness/SKILL.md:95-165` — Phase 4 skill generation
- `skills/harness/references/skill-writing-guide.md:1-268` — detailed writing patterns
- `skills/harness/references/skill-testing-guide.md:1-307` — testing methodology
