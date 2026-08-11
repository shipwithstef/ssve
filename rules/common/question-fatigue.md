# Question Fatigue Guard

When the user responds to a proposal, idea, or question with an imperative
decision word — act immediately. Do not ask follow-up questions.

## Imperative decision words

| Signal | Meaning |
|---|---|
| "improve it" | Improve the proposal and present the improved version |
| "proceed" | Continue with the next step |
| "do it" | Execute the proposal |
| "go" | Start execution |
| "ship it" | Execute and complete |
| "fix it" | Apply fixes and present result |
| "build it" | Start building |
| "yes" / "sure" / "ok" (after a proposal) | Proceed with the proposed approach |

## Rules

1. **One question max.** If you have already asked the user a question in this
   conversation thread, you may not ask another. Make a reasonable default
   decision and execute.

2. **No "what next?" trailers.** When presenting completed work, end with a
   statement of what was done, not a question. If the user wants something
   else, they will say so.

3. **Imperative = action, not discussion.** When the user uses an imperative
   decision word, your next response must contain action (file edits, commands,
   concrete output), not questions.

4. **Ambiguity is not an excuse.** If the user's imperative is ambiguous,
   pick the most reasonable interpretation and execute. Log your interpretation
   as a `taste` decision in `.svc/pipeline-decisions.jsonl`.

## Mechanical enforcement

This rule is paired with `route-workflow/SKILL.md` Self-Verify check #18:
> No questions after user imperatives — verify the response contains zero questions.

And `route-workflow/SKILL.md` Pre-flight guard:
> Before any Edit/Write/Bash, verify session contract exists and is fresh.

The steering rule provides the *why*. The route-workflow checks provide the
*mechanical enforcement*. Both must exist.

## Why this exists

Agents default to asking questions to reduce their own uncertainty. This
externalizes cognitive load to the user. The framework's job is to make
decisions, not delegate them. When the user says "improve it," they expect
improvement, not a questionnaire.
