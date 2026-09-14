# superpowers — Skill Authoring & Meta Details

## writing-skills Methodology

### TDD for Skills
| TDD concept | Skill equivalent |
|---|---|
| Test case | Pressure scenario |
| Production code | SKILL.md |
| Red (failing test) | Agent fails without skill |
| Green (passing test) | Agent complies with skill |
| Refactor | Find new rationalizations, add counters |

### Process
1. RED: Run pressure scenarios WITHOUT skill, document exact rationalizations verbatim
2. GREEN: Write minimal skill addressing specific failures, verify compliance
3. REFACTOR: For each new rationalization found:
   - Add explicit negation in rules
   - Add entry in rationalization table
   - Add red flag entry
   - Update description

### Pressure Scenario Design
- Combine 3+ pressure types: Time, Sunk cost, Authority, Economic, Exhaustion, Social, Pragmatic
- Force A/B/C choice — no open-ended responses, no deferring
- Bulletproof signals: agent cites skill sections, acknowledges temptation
- Meta-test: "How could skill have been clearer?" — reveals doc vs. clarity vs. org problems
- Real example: 6 RED-GREEN-REFACTOR iterations to bulletproof TDD skill, 10+ rationalizations

## CSO (Claude Search Optimization) Finding

**Critical discovery:** When a skill description summarizes the workflow, Claude
follows the description instead of reading the full SKILL.md. Tested and verified.

**Fix:** Description must contain ONLY triggering conditions:
- "Use when [triggering conditions]" — third person, never first person
- Never summarize what the skill does or its steps
- Max 1024 characters

**Why this matters for svc:** Every skill frontmatter description is a potential
shortcut bypass if it describes the workflow instead of just when to trigger.

## Token Efficiency Targets

| Skill type | Target |
|---|---|
| Getting-started workflows | <150 words |
| Frequently-loaded skills | <200 words |
| Others | <500 words |

## Structural Bulletproofing Elements

### Rationalization Tables
Format: excuse → reality/rebuttal. Preemptively name the specific thought that
would lead to skipping the rule. Must be specific to the skill domain.

### Red Flags Lists
Specific observable behaviors that indicate the rule was broken. Each item
should trigger a reset action (e.g., "Delete code, start over").

### ALWAYS/NEVER Language
Strong directive language eliminates decision fatigue. "NO exceptions" shuts
down edge-case reasoning that could compromise the rule.

### "Even if I seem in a hurry" Clauses
Addresses the time-pressure loophole explicitly. Prevents the most common
real-world failure mode.

### "Violating the letter is violating the spirit"
Foundation principle that shuts down all letter-vs-spirit arguments.

## Anthropic Best Practices (Official Guidance)

### Progressive Disclosure Architecture
- Metadata: loaded at startup (frontmatter only)
- SKILL.md: loaded when skill becomes relevant
- Supporting files: loaded on demand during execution
- Context window is a "public good" — don't waste it

### Degrees of Freedom Framework
| Degree | Approach | Example |
|---|---|---|
| High | Text instructions | Multiple valid approaches, agent picks |
| Medium | Pseudocode | Preferred pattern, some variation allowed |
| Low | Exact scripts | Fragile, must-sequence operations |

### Reference File Rules
- One level deep from SKILL.md max (prevent partial reads)
- Table of contents required for files >100 lines
- Domain-specific: separate per domain, load only relevant one
- Test with all models (Haiku needs more guidance, Opus less explanation)

### YAML Constraints
- Name: max 64 characters
- Description: max 1024 characters
- Both required

## Persuasion Principles for LLMs

Based on Cialdini's 7 principles, grounded in Meincke et al. (2025):
- Persuasion doubled compliance: 33% → 72% (N=28,000)
- LLMs as "parahuman": trained on human text, respond to same triggers

### Most Applicable to Skills
| Principle | Application | Example |
|---|---|---|
| Authority | "YOU MUST", "No exceptions" | Eliminates decision fatigue |
| Commitment | Require announcements + TodoWrite | Forces public declaration |
| Scarcity | "before proceeding", "immediately after" | Creates urgency |

### Avoid
- **Liking** — creates sycophancy
- **Reciprocity** — rarely useful in skill context

### Pattern Combinations by Skill Type
| Type | Recipe |
|---|---|
| Discipline-enforcing | Authority + Commitment + Social Proof |
| Guidance | Moderate Authority + Unity |
| Reference | Clarity only |

### Implementation Intentions
"When X, do Y" > "generally do Y" — specific triggers beat general rules.

### Ethical Test
"Would this technique serve the user's genuine interests if fully understood?"

## Graphviz Conventions for Process Diagrams

| Shape | Meaning |
|---|---|
| diamond | Question/decision |
| box | Action (default) |
| plaintext | Command |
| ellipse | State |
| octagon+red | Warning/stop |
| doublecircle | Entry/exit |

Edge labels: "yes"/"no" for binary; descriptive for multi-choice; dotted for triggers.
Naming: questions end with "?", actions start with verb, commands are literal.

## Skill Testing with Subagents

### Methodology
1. Write pressure scenario prompt (combine 3+ pressures)
2. Run via `claude -p` or Task tool
3. Check if agent:
   - Invokes Skill tool (stream-json inspection)
   - Follows the skill's rules (output content inspection)
   - Resists pressure (chooses process over shortcut)
4. If fails: identify rationalization, add counter, re-test

### CLAUDE.md Variant Testing
4 variants tested for skill discovery effectiveness:
- NULL: baseline (no instruction)
- Variant A: soft suggestion
- Variant B: directive
- Variant C: emphatic XML with `EXTREMELY IMPORTANT` (strongest compliance)
- Variant D: process-oriented

**Result:** Variant C (XML emphatic) adopted for production use.

## Analysis — What's valuable for svc

The CSO finding is immediately applicable: audit all svc skill descriptions
for workflow summaries that could be shortcutted. The pressure testing
methodology with combined stressors could strengthen test-framework evals.
The persuasion principles (particularly implementation intentions) could
improve skill compliance rates. The Anthropic best practices on progressive
disclosure validate svc's existing layered loading approach.

## L4 Pointers

- Writing skills: `skills/writing-skills/SKILL.md`
- Best practices: `skills/writing-skills/anthropic-best-practices.md`
- Persuasion: `skills/writing-skills/persuasion-principles.md`
- Testing methodology: `skills/writing-skills/testing-skills-with-subagents.md`
- CLAUDE.md variants: `skills/writing-skills/examples/CLAUDE_MD_TESTING.md`
- Graphviz: `skills/writing-skills/graphviz-conventions.dot`
- Render script: `skills/writing-skills/render-graphs.js`
