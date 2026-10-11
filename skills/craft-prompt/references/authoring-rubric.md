# craft-prompt authoring rubric

Current Claude models follow instructions precisely: they do what the prompt says, not what the author vaguely hoped for. So the craft is less about tricks and more about saying clearly what you want, why, and what a good result looks like. This rubric names the elements that do that, the order to build them, the target-family idiom, and the anti-patterns that weaken modern prompts. Apply it to author candidate **F**; the best-of-2 floor proves F is never worse than the baseline.

## The five craftable elements
A strong prompt is a clear contract, not a wish. Elements 1-3 belong in almost every prompt; 4-5 earn their place case by case.

1. **Clear, direct task + context and motivation** — state exactly what to produce and for whom, and *why* it matters. Models generalize from the reason: "keep it under 100 words because it's read on a phone" beats "keep it short". Ask explicitly for ambition if you want it ("include as many relevant details as fit") — a precise model will not guess at unstated extras.
2. **A literal output format** — show the exact shape (a copy-paste `output_format` block), not an abstract section list. This is the highest-leverage element and the one svc's old Prompt Composer omitted. The prompt's own style also steers the output's style: prose instructions yield prose, heavy markdown yields markdown.
3. **Checkable constraints, framed positively** — word count, must-include tokens (a CTA), tone, audience. Say what to do ("write in plain, flowing prose") rather than only what to avoid; models act more reliably on a target than on a prohibition. Keep a short forbidden-phrases list only for concrete banned strings the floor can check.
4. **Role (optional)** — one line of specific expertise in the system prompt ("a direct-response copywriter who writes B2B cold email") focuses tone and domain. A long invented biography adds little.
5. **Examples (sparingly)** — 1-2 diverse examples when the format or style is hard to describe in words. Models imitate examples closely, including incidental details, so make every example match the behavior you want, vary them, and wrap them in `<example>` tags. A contrasting "avoid this" example is useful only when the failure is easy to fall into.

## Build order (Anthropic prompt-improver, 4 steps)
1. **Example identification** — decide whether the task needs examples; if it does, extract or write 1-2 input→output pairs.
2. **Structured draft** — task, context, input and a literal `output_format`. On Claude, semantic XML tags (`<instructions>`, `<context>`, `<input>`, `<output_format>`, `<examples>`) help when the prompt mixes distinct material (instructions vs documents vs examples); a short single-purpose prompt reads better as plain prose.
3. **Reasoning** — when the task needs analysis, let the model think: use adaptive thinking with `effort`, or ask it to consider the problem before answering. A general instruction to think carefully usually beats a hand-written step list; prescribe steps only where their order genuinely matters. Skip this for pure-format tasks. For agentic or high-stakes work, ask the model to check its result before finishing.
4. **Example enhancement** — if examples are used, make them Relevant + Diverse + Structured.

## Ordered technique stack (apply in this priority)
be clear and direct → give context/motivation behind instructions → literal output format → examples where needed → XML/semantic structure where it separates material → role via the system prompt → put long-form data at the TOP (instructions and the question after the data). Harvested in-house from `scripts/review-plan-codex.sh` (OUTPUT-FIRST + format-lock), `scripts/blind-floor-judge.sh` (default-REJECT, "longer is not better"), `agents/ad-strategist.md` (persona-lock + format-locked return contract), `skills/ad-video-script/SKILL.md` (named-expert persona + grounded data).

## 2026 anti-pattern guards (these quietly weaken modern prompts — AC2 fails if present)
| Anti-pattern | Why it's wrong now | Do instead |
|---|---|---|
| Last-turn **assistant prefill** | Unsupported on recent Claude models — returns a 400; retires the old "prefill the opening" viral trick | Put the constraint in the instructions/output_format |
| `budget_tokens` for thinking | Superseded | Use **adaptive thinking + `effort`** (or "consider/evaluate/reason through" wording when thinking is off) |
| Caps-lock "critical: you must / always / never" | Recent models already attend closely to the system prompt; shouted imperatives make them over-apply the rule in cases it was not meant for | State the rule plainly with its reason: "Use this when…", "Prefer…, because…". Keep firm wording for genuine safety/correctness boundaries, without the shouting |
| Piling on "don't" rules | Negative-only instructions leave the target undefined and can prime the unwanted behavior | Describe the desired behavior; keep a short, concrete banned-phrases list only where the floor checks it |
| Abstract "include a summary section" | Weakest form of formatting | A **literal** output_format block the model can pattern-match |
| Many near-identical examples | The model copies their surface features and loses range | 1-2 diverse examples, or none when words describe the format well |
| Scripted step-by-step reasoning for every task | Constrains a model that reasons well on its own; wastes tokens on simple tasks | Adaptive thinking + `effort`; steps only where order matters |

## Model-family idiom (target-aware; v1 Claude-only, others deferred)
Read the cross-family judge tuple via the probe-free `scripts/resolve-adversarial-reviewer.sh`, then invoke only `scripts/run-external-review.mjs` (the launcher receipt proves that the judge family differs from the orchestrator). Compile candidate STRUCTURE to the **target** family's idiom:
| Target family | Idiom |
|---|---|
| **anthropic** (v1) | Clear prose instructions, XML/semantic tags where material needs separating, system-vs-turn role separation, reasoning via adaptive thinking + `effort`, no prefill. Load the `claude-api` skill for current model IDs and parameters. |
| openai / codex (v2) | markdown headers, developer/system message, JSON-mode/structured-outputs, few-shot in the message array |
| google (v2) | its own conventions |

## Worked example (the shape, not a script)
**Task:** "a cold email that books a demo, under 100 words, one CTA, P.S. with social proof."

**Bad F (the trap):**
```
CRITICAL: You MUST write the BEST cold email EVER. Be persuasive!!!
```
Why bad: no task detail, no audience or reason, no format, caps-lock over-prompting, and no constraints the floor can check.

**Good F (rubric-applied, Claude-target):**
```
<role>You are a direct-response copywriter who writes B2B cold email.</role>
<context>We sell <PRODUCT> to <ICP>. Goal: book a 15-min demo from a cold, first-touch email. Recipients skim on a phone, so every line has to earn its place.</context>
<instructions>Write one cold email of under 100 words with exactly one call to action (book a demo). Open with the reader's problem in plain language. End with a "P.S." line containing one concrete social-proof fact. Avoid stock openers such as "I hope this finds you well".</instructions>
<output_format>
Subject: <6 words max>
<body, under 100 words, one CTA>
P.S. <one social-proof fact>
</output_format>
<example>Subject: cut onboarding from 3 weeks to 3 days …  P.S. Acme did it in 11 days.</example>
```
Why good: direct task + context with the reason behind brevity + literal output_format + one example of the target shape + checkable constraints (under-100-words, one-CTA-present, P.S.-present, the banned opener absent). The floor extracts those as objective requirement keys and applies them symmetrically to B-output and F-output.

## What the floor checks (so author F to survive it)
The objective-first requirement keys (`req:under-100-words`, `req:cta-present`, `out:format-block-present`, `req:forbidden-words-absent`) are derived once from the task brief and applied to **both** outputs. F ships only if its output covers every requirement the baseline's output covered (mechanical) and any subjective edge is cross-family certified. So author F to *cover every requirement the baseline covers, plus genuine improvements* — never trade a covered requirement for verbosity.
