## End-of-Session Output

After processing the batch, do FOUR things:

### 1. Batch Summary Table

```markdown
## Mining Batch — [date]

| Feature | Insights | Top Insight (weight) | Validated |
|---------|----------|----------------------|-----------|
| feature-a | 3 | "Insight text" (85) | Yes |
| feature-b | 2 | "Insight text" (62) | No |

**Narratives generated:** N (list IDs if any)
**Progress:** X/16 features mined
**High-value insights this batch:** N (weight >= 70)
```

### 2. Suggested Foundation Updates

If mining revealed new evidence for foundational sections, list them. If nothing new was found, output "No foundation updates needed."

### 3. Sync Consumer Context File

Update `.agents/product-marketing-context.md` — this is analyze-marketing' own consumer file that downstream internal skills read automatically. It must stay in sync with the full context doc.

**Format:** The 12-section structure that downstream skills expect (Product Overview, Target Audience, Problems & Pain Points, Switching Dynamics, Competitive Landscape, Differentiation, Objections, Customer Language, Brand Voice, Proof Points, Goals). Plus a "Top Marketing Insights" appendix with weight >= 70 insights and top narratives.

**How to sync:** Read `.agents/product-marketing-context.md` and extract/condense into the 12-section format. Include a header noting "Auto-synced by analyze-marketing skill" and the source path. The downstream skills don't need the full 352-line doc — they need the foundational positioning sections + the strongest insights as ammunition.

**If external transform runs after this skill:** External passes may adapt wording/structure, but they must start from this file and preserve/refresh svc "Top Marketing Insights" from tracker-backed mining.

**When to sync:** After every mining session (Modes 1-3) and after Mode 4 (Foundation updates). Skip sync for Modes 5-7 (compaction, combinations, eval don't change the foundation).

**Compatibility bridge (optional, external add-ons only):**
- Canonical consumer file remains `.agents/product-marketing-context.md`.
- If an external skill explicitly requires `.claude/product-marketing-context.md`,
  mirror the canonical file after sync:
  `mkdir -p .claude && cp .agents/product-marketing-context.md .claude/product-marketing-context.md`
- Never treat `.claude/product-marketing-context.md` as canonical in svc.

### 4. Follow-Up Prompt

Generate a compact prompt the user can paste to continue:

```
[Mode X] analyze-marketing — continue batch N.
Mode: [Full Scan | Refresh | Single Feature]
Remaining: [list of unmined/stale feature keys, or "none"].
Last processed: [feature-key] on [date].
Tracker: docs/marketing/feature-mining-tracker.json.
[Any special context]
```

If all features are mined:
```
All features mined and current. Run Mode 6 to check for new combination narratives, or Mode 7 to eval quality. Tracker: docs/marketing/feature-mining-tracker.json.
```

---
