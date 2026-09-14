# WI-411 craft-prompt — Research Dossier

**Date:** 2026-06-22
**Source:** ultracode research workflow `wf_86817540` (8 agents: svc-prompting-overlap, prompt-eng-science, viral-X-anatomy, 10/10-optimization-loop; skeptic/architect/pragmatist lenses; synthesis)
**Owner directive:** make svc produce sheep-level prompts, but cheap — "the model already knows how to make X great; we don't want to spend billions of tokens; evaluating two options makes sense." → LEAN scope: rubric + best-of-2 floor.

## The diagnosis (confirmed by reading the files)
`route-workflow`'s Prompt Composer is a **router**, not a prompt-crafter — its package shape is 100% lane/sequence/eval/closeout; grep `persona|few-shot|exemplar|output-format` = 0 hits. The 84-skill manifest has **zero** prompt-craft skills. svc owns the elite craft techniques *internally* (`review-plan-codex.sh` OUTPUT-FIRST/format-lock; `agents/ad-strategist.md` persona-lock + format-locked return; `ad-video-script` named-expert persona + grounded data) but never exposed them as a skill that crafts prompts for the user. The gap is a missing capability, not a broken composer.

## Why the sheep win (and how svc matches + exceeds)
A viral "sheep" prompt wins on five **craftable** elements: sharp persona, extreme specificity, a **literal copy-paste OUTPUT FORMAT block**, 1-2 few-shot examples, explicit constraints. The composer ships ZERO few-shot examples and an abstract section list instead of an output exemplar — the exact axes the sheep beats it on. **A rubric closes the craft gap immediately.** The durable edge the sheep can't copy: an **optimization loop** — but the owner correctly cut the expensive form (the model already knows the craft).

## LEAN design (owner-locked): rubric + best-of-2 floor
- **Rubric** (`authoring-rubric.md`): Anthropic prompt-improver 4 steps (example-id → XML draft → CoT scaffold → example enhancement) + the in-house OUTPUT-FIRST/persona/format-lock patterns + the ordered technique stack + **2026 anti-pattern guards** (no prefill on Claude 4.6+; `effort` not `budget_tokens`; dial back CRITICAL/you-MUST over-prompting — Opus over-triggers). Near-free; it unlocks what the model already knows.
- **Best-of-2 floor**: candidate F (rubric-crafted) vs baseline B (sheep/bare), run each once on one representative input, objective requirement-coverage (free regex/count, symmetric) + cross-family judge on subjective rows, ship F only if it covers every B-covered requirement, else ship B verbatim. This is **WI-410's floor at best-of-2** (~2-3 calls), opt-in only.

## The three reuse seams (almost nothing net-new)
1. **WI-410 floor** — `blind-floor-check.mjs` REUSED VERBATIM (only the element key changes: plan-rows → prompt-output-requirements); `blind-floor-judge.sh`→fork; `blind-floor-route.mjs`→clone; `control-plan.schema.json`→clone; `validate-blind-floor.sh`→clone. NEW: `prompt-element-extract.mjs` adapter only.
2. **create-skill** eval harness (with-skill-vs-baseline same-turn subagents) — the structural template; v2 generalizes its train/test split. NOT its same-family comparator as the judge.
3. **ad-strategist** eval-gated ledger — DEFERRED (arbitrary prompts rarely have a real outcome signal; would promote on vibes or stay inert).

## Honest bound (copied from WI-410)
"Better" is mechanical+fail-closed only for dropped requirements; judge-conditional for quality; unconditional never-worse only via baseline retention. The receipt may never claim "svc beats the sheep" — only `blind-adopted` (negative-ROI) or `judge-certified-improvement` (content-bound). No objective scorer for prompt quality exists → keep requirement keys objective-first and apply symmetrically; verbosity bias is structural (crafted prompt is longer) → judge the OUTPUT not the prompt, "longer is NOT better", pessimistic tie-break to the baseline.

## Cut for v1 (the token monster — deferred)
generate-N (N>2), run-on-many-synthesized-inputs, train/test holdout, the leveling ledger, DSPy/OPRO/GEPA/EvoPrompt, multi-family target templating, WARN→BLOCK flip. All behind a ≥20-shadow-run bar with a DELETE-criterion (if F only ever ties, delete the loop, keep the rubric).

See `docs/specs/work-items/WI-411.md` for the spec, ACs, and resolved decisions.
