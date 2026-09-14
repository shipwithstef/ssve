# Harness Skill Writing Guide — Detail

## Mechanism

Detailed patterns for writing high-quality SKILL.md files. Covers description
triggers, body style, output formats, examples, progressive disclosure,
script bundling, data schemas, and what NOT to include.

### Description as Trigger Mechanism

Claude only sees `name + description` in `available_skills`. Description IS
the trigger. Claude tends to undertrigger — prefers its own tools for simple
tasks. Complex, multi-step, specialized tasks trigger skills more reliably.

**Pushy description formula:** what the skill does + specific trigger situations + boundary with similar skills.

Good: "Read, extract, merge, split, rotate, watermark, encrypt, OCR PDFs. Use whenever .pdf files are mentioned or PDF output is requested. Especially when transformation/editing/analysis is needed beyond simple reading."

Bad: "A skill for data processing" — too vague, no trigger cues.

**Follow-up keywords are critical.** Without "re-run", "update", "modify", "improve previous result" in the description, the harness dies after first use. Second invocation won't trigger.

### Body Writing: Why-First Principle

LLMs adapt better to reasoning than to rigid rules:
- Bad: `ALWAYS use pdfplumber. NEVER use PyPDF2.`
- Good: "Use pdfplumber for tables because PyPDF2 doesn't preserve row/column structure. pdfplumber recognizes cell boundaries and returns structured data."

**Generalize, don't overfit:** When fixing based on feedback, change the principle, not the specific example. "Convert columns with revenue/amount/quantity keywords to numbers" beats "Convert the Q4 Revenue column to numbers."

### Output Format Definition

For skills with structured output, define templates explicitly:
```markdown
## Report Structure
Use this exact template:
# [Title]
## Summary
## Key Findings
## Recommendations
```

### Progressive Disclosure Patterns

1. **Domain separation:** `references/aws.md`, `references/gcp.md` — load only the relevant one
2. **Conditional detail:** simple case in body, complex case behind a reference pointer ("If tracked changes needed → see REDLINING.md")
3. **Large reference TOC:** files >300 lines get a table of contents at top

### Script Bundling Triggers

| Signal | Action |
|---|---|
| 3/3 test runs generate the same helper script | Bundle in `scripts/` |
| Same pip/npm install every run | Document dependency installation in skill |
| Same multi-step approach repeated | Standardize as procedure in skill body |
| Same error workaround applied repeatedly | Document as known issue + fix |

### Data Schemas (Standard)

Three standard JSON files for skill testing:

**eval_metadata.json:** `{ eval_id, eval_name, prompt, assertions }` — descriptive names, not numbers.

**grading.json:** `{ expectations: [{ text, passed, evidence }], summary: { passed, failed, total, pass_rate } }` — exact field names matter (viewers depend on them).

**timing.json:** `{ total_tokens, duration_ms, total_duration_seconds }` — captured from task notification IMMEDIATELY, not recoverable later.

### What NOT to Include in Skills

- README/changelog/installation guides (human docs, not agent instructions)
- Meta information about skill creation process
- User-facing documentation (skills are for AI agents)
- General knowledge Claude already has

## Analysis

- **Useful for:** Anyone writing SKILL.md files — for svc skills, for project-specific skills, for harness-generated skills.
- **Trade-offs:** The "pushy description" advice increases trigger rate but may cause false triggers if not bounded. The "follow-up keywords" insight is non-obvious and high-value.
- **Similar to:** Anthropic's skill-creator has similar guidance. svc's `create-skill` (our fork) includes svc-specific frontmatter but doesn't have the "why-first" or "follow-up keywords" guidance explicitly.
- **Could improve svc by:** Three actionable items: (1) Add follow-up keywords to all svc skill descriptions. (2) Add "why-first principle" to our anti-patterns (AP-19 area). (3) Add the script bundling trigger table to `execute-changeset` — when subagents repeatedly write the same helper, bundle it.
- **Assumptions:** Skills are for LLM agents, not humans. Writing style matters because LLMs interpret instructions differently than humans.
- **Watch out for:** The "lean" advice (remove everything Claude already knows) can go too far — some context that seems obvious to the skill writer is actually needed by the executing agent, especially across model versions.

## Key Source Files (L4)
- `skills/harness/references/skill-writing-guide.md:1-268` — full writing guide
- `skills/harness/SKILL.md:95-165` — Phase 4 skill generation overview
