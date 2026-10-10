## Phase 2.5 — Should we build this at all? (escape hatch)

Before eliminating, ask the higher-order question:

- Is there a viable outcome where we simply DON'T solve this problem?
- Does the user value require this specific capability, or can we deliver value another way?
- Are we building a feature competitors all have but nobody's customers actually use?
- What does the product look like if we remove this feature?
- Is there an innovative reframe (e.g., "we don't need a POI provider if we ship QR-code stickers to businesses") that eliminates the decision?

Append "Escape Hatch Analysis" section to DIMENSIONS.md:

```markdown
## Escape Hatch Analysis

| Option | Feasibility | Impact on core journey | Verdict |
|---|---|---|---|
| Don't build | high | core journey still works | **Pursue** → Route to validate-feature with reframe |
| Innovative reframe: QR-stickers | medium | changes product shape | Drop — premature |
```

If escape hatch is VIABLE, SHORT-CIRCUIT to Phase 7 with decision "don't build in original
form — adopt <reframe> instead" + route to `validate-feature` for the reframe. Stop.

If not viable, proceed to Phase 3.
