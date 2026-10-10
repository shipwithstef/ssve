## Product-runtime v2 adapter

When nested inside a `product-improvement-protocol-v2` run, research is strictly side-effect-free:
resolve only the named uncertainty, bind claims/contradictions/trust/freshness to its declared
consumer, and return typed evidence to the blocked decision. Do not mutate product state, dispatch
implementation, or ask the owner. The caller resumes only if the new evidence changes the
unresolved-decision digest; otherwise the anti-loop gate stops the research cycle. Follow
`references/owner-decision-runtime-v2.md`.

> **Cognitive routing:** 🔎 [DISC] — GitHub code/repo search and package-registry
> APIs FIRST (per `rules/common/research-before-build.md`); native web_search ONLY
> after Tiers 0–3 return insufficient signal. See `references/model-routing.md`.
