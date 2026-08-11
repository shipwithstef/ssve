# craft-prompt authoring rubric

The model already knows how to write a great prompt. This rubric *unlocks* that — it names the five elements every acclaimed prompt has, the order to build them, the family-specific idiom, and the 2026 anti-patterns that quietly weaken modern prompts. Apply it to author candidate **F**; the best-of-2 floor proves F never worse than the baseline.

## The five craftable elements (every viral/"sheep" prompt has these)
A great prompt is a **structured contract**, not a wish:
1. **Persona / role** — a sharp, specific expert identity ("a Senior Direct-Response Copywriter who has written 500+ cold emails that booked meetings"), not "you are a helpful assistant".
2. **Context + motivation** — the situation AND *why* it matters (models follow instructions better when they understand the goal behind them).
3. **A literal copy-paste OUTPUT FORMAT block** — the single highest-leverage element and the one svc's old Prompt Composer omitted. Show the exact shape, not an abstract section list.
4. **1-2 diverse few-shot examples** — ideally a *good* example and a *bad* one (with why), the biggest quality lever and the axis the sheep most often win on.
5. **Explicit constraints + forbidden-words** — word count, must-include tokens (a CTA), tone, and a short "never do X" list.

## Build order (Anthropic prompt-improver, 4 steps)
1. **Example identification** — extract or write 1-2 input→output examples for the task.
2. **Structured draft** — role + instructions/context/input + a literal `output_format`; on Claude, use semantic XML tags (`<role>`, `<instructions>`, `<input>`, `<output_format>`, `<examples>`) to separate sections.
3. **Reasoning scaffold** — when the task needs analysis, add a brief "think through X, then Y" step (or rely on adaptive thinking — see anti-patterns); skip it for pure-format tasks.
4. **Example enhancement** — make the few-shot examples Relevant + Diverse + Structured (wrap in `<example>`/`<examples>`).

## Ordered technique stack (apply in this priority)
be clear and direct → give context/motivation behind instructions → multishot examples → XML/semantic structure → role via the system prompt → put long-form data at the TOP (instructions after the data). Harvested in-house from `scripts/review-plan-codex.sh` (OUTPUT-FIRST + format-lock), `scripts/blind-floor-judge.sh` (default-REJECT, "longer is not better"), `agents/ad-strategist.md` (persona-lock + format-locked return contract), `skills/ad-video-script/SKILL.md` (named-expert persona + grounded data).

## 2026 anti-pattern guards (these quietly weaken modern prompts — AC2 fails if present)
| Anti-pattern | Why it's wrong now | Do instead |
|---|---|---|
| Last-turn **assistant prefill** | Deprecated on Claude 4.6+ — returns a 400; invalidates the old "prefill the opening" viral trick | Put the constraint in the instructions/output_format; don't prefill the assistant turn |
| `budget_tokens` for thinking | Superseded | Use **adaptive thinking + `effort`** (or "consider/evaluate/reason through" wording when thinking is off) |
| `CRITICAL:` / `you MUST` / `ALWAYS` caps-lock | Newer Opus **over-triggers** on heavy imperatives — it distorts behavior | "Use this when…", "Prefer…", explain the *why*; reserve hard imperatives for genuine safety/correctness gates |
| Abstract "include a summary section" | Weakest form of formatting | A **literal** output_format block the model can pattern-match |
| One generic "good assistant" persona | Leaves quality on the table | A specific named-expert persona with a track record |

## Model-family idiom (target-aware; v1 Claude-only, others deferred)
Read the cross-family judge tuple via the probe-free `scripts/resolve-adversarial-reviewer.sh`, then invoke only `scripts/run-external-review.mjs` (the launcher receipt proves that the judge family differs from the orchestrator). Compile candidate STRUCTURE to the **target** family's idiom:
| Target family | Idiom |
|---|---|
| **anthropic** (v1) | XML/semantic tags, system-vs-turn role separation, reasoning in thinking (adaptive + `effort`), no prefill. Load the `claude-api` skill for current model IDs + the 2026 corrections. |
| openai / codex (v2) | markdown headers, developer/system message, JSON-mode/structured-outputs, few-shot in the message array |
| google (v2) | its own conventions |

## Worked example (the shape, not a script)
**Task:** "a cold email that books a demo, under 100 words, one CTA, P.S. with social proof."

**Bad F (the trap):**
```
CRITICAL: You MUST write the BEST cold email EVER. Be persuasive!!!
```
Why bad: no persona, no format, no examples, caps-lock over-prompting (Opus over-triggers), no constraints the floor can check.

**Good F (rubric-applied, Claude-target):**
```
<role>You are a Senior Direct-Response Copywriter who has booked 500+ B2B demos via cold email.</role>
<context>We sell <PRODUCT> to <ICP>. Goal: book a 15-min demo. Cold, first touch.</context>
<instructions>Write one cold email. Under 100 words. Exactly one CTA (book a demo). End with a "P.S." line containing one concrete social-proof fact. No jargon, no "I hope this finds you well".</instructions>
<output_format>
Subject: <6-words-max>
<body, under 100 words, one CTA>
P.S. <one social-proof fact>
</output_format>
<examples>
<example label="good">Subject: cut onboarding from 3 weeks to 3 days …  P.S. Acme did it in 11 days.</example>
<example label="bad">Subject: Quick question … (vague, no CTA, no P.S.) — avoid this.</example>
</examples>
```
Why good: persona + context + literal output_format + good/bad examples + checkable constraints (under-100-words, one-CTA-present, P.S.-present, forbidden "I hope this finds you well"). The floor extracts those as objective requirement keys and applies them symmetrically to B-output and F-output.

## What the floor checks (so author F to survive it)
The objective-first requirement keys (`req:under-100-words`, `req:cta-present`, `out:format-block-present`, `req:forbidden-words-absent`) are derived once from the task brief and applied to **both** outputs. F ships only if its output covers every requirement the baseline's output covered (mechanical) and any subjective edge is cross-family certified. So: author F to *cover every requirement the baseline covers, plus genuine improvements* — never trade a covered requirement for verbosity.
