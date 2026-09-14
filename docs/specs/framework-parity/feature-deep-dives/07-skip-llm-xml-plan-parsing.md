# Deep-dive #7: LLM XML Tag Parsing (GSD row #50/#83) — SKIP

**Source:** GSD `sdk/src/plan-parser.ts` — parses `<task>` XML blocks from the planner's output to construct execution DAGs.
**Decision required:** adopt OR skip.

## What the feature is

GSD's planner emits XML-tagged task blocks (`<task id="..." depends_on="..." parallel="...">...</task>`). A custom XML parser at SDK level converts these into a DAG that the executor walks. The XML shape is an internal contract between the planner agent's prompt and the executor.

## svc current state

svc's plan-changeset emits markdown plans + `docs/plans/<date>-<name>/manifest.md` (a structured markdown manifest) + `.svc/lane-tasks-<WI>.json` (the JSON task graph the executor reads). No XML anywhere. JSON is the structured contract; markdown is the human-readable narrative.

## 10 scenarios — analyzing whether to adopt

### Scenario 1: Planner emits well-formed XML; parser consumes deterministically

**Today (svc):** planner emits markdown + JSON manifest. Parsing JSON is single-line `JSON.parse`. Zero ambiguity.
**With XML:** custom parser, regex-fragility, attribute-quoting edge cases, CDATA escaping.
**Improvement:** NEGATIVE — JSON is strictly less ambiguous than XML at this contract surface.
**Verdict: NEGATIVE.**

### Scenario 2: LLMs are KNOWN to emit malformed XML

**Today (svc):** LLM emits malformed JSON sometimes (also a problem), but JSON.parse fails LOUDLY with a one-line error.
**With XML:** malformed XML fails in MANY ways — attribute missing close-quote / nested elements skipped / unbalanced angle brackets matched against unrelated text. The custom parser must handle all of them.
**Improvement:** NEGATIVE — JSON's failure mode is BETTER (loud + obvious).
**Verdict: NEGATIVE.**

### Scenario 3: Tooling support

**Today (svc):** JSON has universal tooling (jq, schema validators, IDE support). svc already uses JSON Schema for receipts.
**With XML:** XML tooling exists but is heavier (xpath, xslt) and not in svc's stack.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 4: Human-readability of plans

**Today (svc):** markdown plans are directly readable. JSON manifest is a separate machine layer.
**With XML:** verbose, awkward to read inline. Mixes markup with content.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 5: Anthropic guidance on prompts

**Today (svc):** Anthropic explicitly recommends XML tags for Claude prompts for SECTIONING (e.g. `<context>...</context>`). That's STYLISTIC, not structural. svc skill files already use markdown headers for that role.
**With XML for plan DAG:** that's structural — Claude consuming and emitting it. Anthropic's guidance is about input shaping, not output.
**Improvement:** NEGATIVE for the structural case.
**Verdict: NEGATIVE.**

### Scenario 6: Already established (sunk cost / rewrite avoidance)

**Today (svc):** the JSON task graph at `.svc/lane-tasks-<WI>.json` is the source of truth. Every dispatch script reads it. Every validator checks it. `scripts/task-graph.mjs` is the canonical CLI.
**With XML:** would require dual-parsing OR a full migration. User said "I don't want a rewrite."
**Improvement:** NEGATIVE — directly conflicts with user directive.
**Verdict: NEGATIVE.**

### Scenario 7: Migration effort

**Today (svc):** N/A.
**With XML:** every place that reads/writes the task graph (~10+ scripts + ~5 hooks) would need XML support. Migration script. Per-WI conversion. Tier-1 validator update.
**Improvement:** NEGATIVE — large refactor for zero gain.
**Verdict: NEGATIVE.**

### Scenario 8: Mental model match — does the user think in tasks or in XML?

**Today (svc):** users (developers) read JSON task graphs naturally. JSON is the data interchange format of the tech stack svc targets.
**With XML:** users would need to learn the XML shape. Foreign to the stack.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 9: GSD chose XML — is there a hidden advantage?

**Today (svc):** GSD's choice may be historical (project started before tighter LLM JSON-output discipline) or stylistic (Anthropic's input-tagging guidance generalized inadvertently to output structuring). Looking at GSD-2 (newer, Pi SDK harness), they use SQLite + JSON for state — they appear to have moved AWAY from XML-only.
**Improvement:** even GSD's own evolution has been away from XML for structural state.
**Verdict: NEGATIVE (anti-pattern in their own evolution).**

### Scenario 10: Are there ANY cases where XML would be better than JSON for svc?

**Today (svc):** none identified. JSON satisfies every requirement svc has.
**Improvement:** NEUTRAL at best.
**Verdict: NEUTRAL.**

### Scenario count: **0 POSITIVE / 9 NEGATIVE / 1 NEUTRAL.**

## Blast radius (if adopted)

| Touched | Type | Regression risk | Notes |
|---|---|---|---|
| `.svc/lane-tasks-<WI>.json` | state format | HIGH: migration | rewrite, forbidden by user |
| `scripts/task-graph.mjs` | task-graph CLI | HIGH: XML parser added | unjustified complexity |
| All dispatch scripts | dispatch | HIGH: format change | refactor |
| Tier-1 validators | tests | HIGH: schema swap | all fixtures need rewrite |
| Skill frontmatter format | skills | LOW (it's already YAML, separate decision) | — |

**Net regression risk:** HIGH for zero measurable gain.

## Decision

**SKIP.** 0 of 10 scenarios positive. The svc framework already chose JSON for structural state contracts AND markdown for human narrative; both are the right choices for the stack. GSD's XML choice is an artifact of its own history (and GSD-2 evolved away from it for state). Adopting it would be pure rewrite cost with negative ergonomic value.

## Implementation handoff

None. Scorecard row #50 verdict: **✋ SKIPPED — intentional. JSON+markdown is the right shape for svc.** Row #83 (parallel phase XML schema) same.
