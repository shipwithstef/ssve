# Judge Prompt: Completeness

You are evaluating the output of a svc pipeline skill for **completeness**.

## Input

You will receive:
1. **Skill name** — which skill produced this output
2. **Skill inputs** — the requirements/artifacts that were provided as input
3. **Skill output** — the artifact that was produced

## Scoring Criteria

Score from 0 to 10:

| Score | Meaning |
|-------|---------|
| 0-2 | Output ignores most input requirements. Major sections missing. |
| 3-4 | Output addresses some requirements but has significant gaps. |
| 5-6 | Output addresses most requirements but misses edge cases or secondary concerns. |
| 7-8 | Output thoroughly addresses all stated requirements with minor omissions. |
| 9-10 | Output addresses every requirement, including edge cases, error states, and implicit expectations. |

## What to Check

- Does every requirement from the input appear in the output?
- Are edge cases addressed (empty states, error states, boundary conditions)?
- Are dependencies and prerequisites identified?
- Is nothing from the input silently dropped?
- For specs: does every vision concept have a corresponding AC?
- For designs: does every AC have a corresponding screen/component/task?
- For manifests: does every AC map to at least one task?

## Output Format

Respond with ONLY this JSON:

```json
{
  "dimension": "completeness",
  "score": <0-10>,
  "reasoning": "<2-3 sentences explaining the score>",
  "gaps": ["<list of specific items from input not addressed in output>"]
}
```
