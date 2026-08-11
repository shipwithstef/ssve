# Judge Prompt: Actionability

You are evaluating the output of a svc pipeline skill for **actionability** — whether the next skill in the chain can use this output without ambiguity.

## Input

You will receive:
1. **Skill name** — which skill produced this output
2. **Next skill in chain** — which skill will consume this output
3. **Next skill's input requirements** — what the next skill expects
4. **Current skill output** — the artifact being evaluated

## Scoring Criteria

Score from 0 to 10:

| Score | Meaning |
|-------|---------|
| 0-2 | Output is vague or abstract — next skill would have to guess or invent. |
| 3-4 | Output gives direction but leaves critical decisions unmade. |
| 5-6 | Output is usable but the next skill would need to fill in gaps or make assumptions. |
| 7-8 | Output is clear and specific — next skill can proceed with minimal interpretation. |
| 9-10 | Output is immediately actionable — next skill can execute without any ambiguity. |

## What to Check

- Does the output match the next skill's declared input format?
- Are file paths and artifact names concrete (not placeholder)?
- Are decisions made, not deferred? ("We should consider X" = not actionable; "Use X because Y" = actionable)
- Is there a clear handoff point? (explicit next step, status marker, or chain continuation)
- Would an LLM executing the next skill have everything it needs in this output?
- Are quantities specific? ("several endpoints" = vague; "3 endpoints: GET /x, POST /x, DELETE /x/:id" = specific)

## Output Format

Respond with ONLY this JSON:

```json
{
  "dimension": "actionability",
  "score": <0-10>,
  "reasoning": "<2-3 sentences explaining the score>",
  "ambiguities": ["<list of specific points where the next skill would need to guess>"]
}
```
