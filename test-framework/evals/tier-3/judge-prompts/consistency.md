# Judge Prompt: Consistency

You are evaluating the output of a svc pipeline skill for **consistency** with prior pipeline phases.

## Input

You will receive:
1. **Skill name** — which skill produced this output
2. **Prior phase outputs** — artifacts from earlier pipeline stages (vision, spec, designs, etc.)
3. **Current skill output** — the artifact being evaluated

## Scoring Criteria

Score from 0 to 10:

| Score | Meaning |
|-------|---------|
| 0-2 | Output directly contradicts prior phases. Names, concepts, or scope diverge. |
| 3-4 | Output has notable inconsistencies — different terminology, added/removed scope. |
| 5-6 | Output is mostly consistent but uses slightly different framing or misses alignment on details. |
| 7-8 | Output is well-aligned with prior phases, minor terminology drift only. |
| 9-10 | Output is perfectly consistent — same terminology, same scope, no contradictions. |

## What to Check

- Do names match across phases? (feature names, persona references, AC identifiers)
- Does scope align? (nothing added or removed without justification)
- Are status transitions valid? (DRAFT can't reference BASELINED artifacts that don't exist yet)
- Do cross-references resolve? (journey references in specs, AC references in designs)
- Is terminology stable? (same concept shouldn't have different names across phases)
- Are quantities consistent? (if spec says 5 ACs, design should address 5 ACs)

## Output Format

Respond with ONLY this JSON:

```json
{
  "dimension": "consistency",
  "score": <0-10>,
  "reasoning": "<2-3 sentences explaining the score>",
  "contradictions": ["<list of specific contradictions found between current output and prior phases>"]
}
```
