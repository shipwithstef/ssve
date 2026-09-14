# Framework Evolution — 2026-04-22 — strategic-decision research discipline

## Method

Post-mortem of first live `strategic-decision` dry-run on Example Marketplace POI-provider question (`docs/specs/decisions/2026-04-22-poi-provider-strategy/` in example-marketplace repo). User observation: "we did more work pre-skill than within the skill" — the skill re-ran research that already existed in `docs/specs/research/*.md` and produced lower-quality artifacts than the manual research doc it should have grounded on.

## Findings (by priority)

### P0 — Phase 1b must scan local research first, not WebSearch first

**Evidence:**
- `strategic-decision/SKILL.md:Phase 1b` — current text says "use WebSearch directly inline + append to DIMENSIONS.md"
- Phase 1b priority order lists `docs/specs/research/` as step 1 but describes it vaguely ("check if we already have data") with no quality-gate protocol
- Dry-run on example-marketplace: skill's Phase 1b produced surface-level WebSearch citations for Google Places pricing while `docs/specs/research/2026-04-22-poi-strategy-40-options-deduced.md` (457 lines, cited sources, dimension-complete) already existed in the repo
- Dry-run skill output got Phase-5-current-SKU wrong (said Essentials; research said Pro), propagated $0.008 pricing through the whole cost model, and missed the 30-day cache architecture that research §10 Phase D already named as WI-102

**Proposed fix:** rewrite Phase 1b into 4 discrete sub-phases with explicit quality gates:

```
Phase 1b.1 — LOCAL INDEX SCAN (new, mandatory first)
  Glob: docs/specs/research/*.md, references/knowledge/**/*.md, docs/specs/*.md
  For each match:
    - Read date stamp (filename YYYY-MM-DD or frontmatter `Date:`)
    - Measure depth: line count, source-citation count, dimension coverage vs Phase 1a list
    - Record in DIMENSIONS.md scratchpad as:
      "source: <file> | date: <YYYY-MM-DD> | depth: <lines>/<cited-sources> | covers: <dim-list>"

Phase 1b.2 — FRESHNESS + QUALITY GATE (new)
  For each dimension in Phase 1a:
    IF local source exists AND age ≤ 90 days AND covers ≥80% of sub-questions:
      → QUOTE AND CITE with file:line anchor; no research call
    ELSE IF local source exists but stale/partial:
      → quote what's covered, enumerate gaps for 1b.3
    ELSE (no local source):
      → mark dimension as "research-needed" for 1b.3

Phase 1b.3 — GAP-TARGETED RESEARCH (only for missed dimensions)
  For each "research-needed" dimension:
    - Dispatch `research` skill with a scoped, gap-specific prompt
    - OR use WebSearch inline if gap is narrow AND single-source-answerable
    - Research skill will commit/tag/push per its contract — accept the side effect
  Back-fill DIMENSIONS.md with new citations tagged [FROM-RESEARCH-2026-XX-XX]

Phase 1b.4 — FRAMEWORK-KNOWLEDGE SCAN (new)
  - Glob references/knowledge/**/*.md for prior blended patterns relevant to topic
  - Read ~/.svc/builder-profile.md for constraint context
  - Read .svc/pipeline-decisions.jsonl for prior related decisions (type=taste on same topic)
```

### P0 — strategic-reviewer must audit local-evidence discipline

**Evidence:**
- `agents/strategic-reviewer.md` adversarial prompt focuses on constraint-profile fidelity + output plausibility; no check for whether Phase 1b cited existing research docs
- Dry-run: reviewer missed the P-001 equivalent "DIMENSIONS.md cites 'Gemini research' as source without URL" — marked it MEDIUM, should have been process-critical

**Proposed fix:** add new process-finding rubric **P-000 local-evidence-discipline**:

```yaml
process_findings:
  - id: P-000
    phase: "Phase 1b"
    severity: CRITICAL | HIGH | MEDIUM   # escalate to CRITICAL if topic-matching research doc existed and was ignored
    claim: "Did Phase 1b scan docs/specs/research/ and references/knowledge/ before dispatching research skill or WebSearch? Did it cite existing artifacts where topic overlap exists?"
    evidence: "<list of existing files the skill should have cited + what it cited instead>"
    proposed_fix: "Re-run Phase 1b.1–1b.2 with local-index scan; quote existing research; dispatch research skill only for gaps."
```

Add corresponding line to strategic-reviewer.md adversarial prompt:

> "Before scoring output, verify process: glob `docs/specs/research/*.md` + `references/knowledge/**/*.md` for topic-matching artifacts. If any exist and were NOT cited in DIMENSIONS.md, raise P-000 as CRITICAL. Skill must not re-do research that already exists in the repo."

### P1 — strategic-decision self-verify checklist must include local-evidence check

**Evidence:** self-verify §6 in `strategic-decision/SKILL.md` counts dimensions, cites, tests — but doesn't check that local research was scanned before external research was dispatched.

**Proposed fix:** add row:

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 13 | Phase 1b local-index scan performed before any WebSearch/research dispatch | grep DIMENSIONS.md for `source: docs/specs/research/*` citations; if research-topic-match exists in repo and no citation, FAIL | |

### P2 — decision-metadata should record research-discipline signal

Add to DECISION.md template:

```
## Research grounding
- Local research docs consulted: <list with dates>
- Dimensions grounded from local: <count>/<total>
- Dimensions requiring fresh research: <count>
- External research skill invocations: <count>
```

This makes the Phase 1b discipline auditable after-the-fact without re-running the skill.

## Comparison delta

`write-spec` and `plan-changeset` both have explicit "read existing specs first" gates. `strategic-decision`'s Phase 1b did not — it's the outlier.

`research` skill's own contract (`research/SKILL.md`) handles deep-dive persistent research correctly; the issue is strategic-decision failing to check for already-persisted output from prior research-skill invocations.

## Stale proposal audit

- `proposals/done/2026-04-21-evolution.md` — not yet moved to done/; unrelated scope
- `proposals/done/2026-04-19-evolution.md` — same
- No stale proposals blocking this one.

## Suggested implementation path

1. Draft PR against `strategic-decision/SKILL.md` rewriting Phase 1b (4 sub-phases as above).
2. Draft PR against `agents/strategic-reviewer.md` adding P-000 rubric + local-evidence check in adversarial prompt.
3. Add self-verify row 13.
4. Replay the example-marketplace POI decision through the updated skill. Expected delta: DIMENSIONS.md cites `docs/specs/research/2026-04-22-poi-strategy-40-options-deduced.md` with file:line anchors for ≥8 of 10 dimensions; ≤2 dimensions require fresh WebSearch; P-000 PASS.
5. If replay still misses the 30-day cache architecture and Phase-5-current-SKU facts, the fix isn't sufficient — go deeper.

## Effort estimate

- Phase 1b rewrite: 1h (already prototyped in this proposal)
- strategic-reviewer P-000 addition: 30min
- Self-verify update: 15min
- Replay + validation: 1-2h
- **Total: ~3-4 focused hours.**

## User actions required

1. Review this proposal.
2. Approve to implement (or modify scope).
3. After implementation, one-line confirmation after replaying example-marketplace POI decision.
