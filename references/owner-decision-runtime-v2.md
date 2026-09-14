# Owner Decision Runtime v2

Use this contract for every decision inside a product-outcome run.

1. Preserve the session's declared `mode` and `language`. Never infer a consequential default.
2. Resolve evidence and explicit uncertainties before ranking options. Nested `research` produces
   evidence only; it may not dispatch work, write product state, or ask the owner directly.
3. Apply the fixed order: hard constraints, evidence trust/freshness/relevance, expected product
   value, value of information, minimax regret, reversibility, then complete critical-path fit.
4. Route every owner-visible question through `decide`. Deduplicate it by unresolved-decision
   digest; an unchanged question may not be asked twice.
5. Autonomous mode may sign only choices inside the exact delegation digest. Strategic mode batches
   irreducible choices and requires an explicit owner signature in the configured language.
6. Retain the selected option, every rejected option and its evidence. A decision is an input to the
   product proof graph, not a terminal product state.

Canonical executable contract: `scripts/lib/runtime-owner-decision-v2.mjs` and
`schemas/owner-decision-v2.schema.json`.
