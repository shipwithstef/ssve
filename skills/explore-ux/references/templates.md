# explore-ux — templates

Loaded from `SKILL.md` Steps 0, 2, 4, 5 and 6.

## Step 0 — scope table (`.svc/ux-exploration/<WI>/scope.md`)

```markdown
| Parameter | Value |
|-----------|-------|
| Mode | competitive-benchmark / friction-audit / innovation-proposal |
| Target URL | <live app URL> |
| Sector | <sector slug from landing-bank> |
| Flow(s) | <journey IDs or "full app"> |
| Competitors to reference | <specific slugs or "all tracked"> |
| Viewports | desktop (1280) / mobile (375) / both |
```

## Step 2 — browser pre-flight

```bash
BROWSE="$HOME/gstack/browse/dist/browse"
if $BROWSE status 2>&1 | grep -q "Status: healthy"; then
  echo "✅ browse daemon ready"
  USE_BROWSE=true
else
  echo "⚠️  browse daemon unavailable — falling back to Playwright MCP"
  USE_BROWSE=false
fi
```

Auth bootstrap (same pattern as test-journeys): read `e2e/helpers/browse-auth.md` if it exists.

Baseline capture per flow:

```bash
browse goto <target_url>
browse snapshot -i
browse screenshot .svc/ux-exploration/<WI>/<flow>-start.png
```

## Step 4 — competitive scorecard

```markdown
| Dimension | Ours | Best Competitor | Gap | Severity |
|-----------|------|-----------------|-----|----------|
| Steps to complete | 7 | 3 (Toast) | +4 steps | High |
| Time to first value | 45s | 12s (Square) | +33s | High |
| Clarity of primary action | 2/4 | 4/4 (Fivestars) | -2 | Medium |
| Empty state quality | 2/4 | 4/4 (TapMango) | -2 | Medium |
| Error recovery | 1/4 | 3/4 (Toast) | -2 | Critical |
| Mobile optimization | 2/4 | 4/4 (all) | -2 | High |
```

## Step 5 — proposal

```markdown
### Proposal: <title>

**Flow:** <flow name>
**Severity:** <Critical / High / Medium>
**Competitor reference:** <competitor slug> — <specific pattern or screenshot>
**Current state:** <what we do now>
**Proposed change:** <specific, implementable change>
**Expected impact:** <step reduction, time reduction, or qualitative improvement>
**Implementation effort:** <small / medium / large>
**Reversibility:** <two-way / one-way>
**Files likely touched:** <guess at affected components>
```

JSONL line in `.svc/ux-exploration/<WI>/proposals.jsonl`:

```json
{"ts":"ISO-8601","flow":"<flow>","severity":"high","title":"...","competitor_ref":"...","proposal":"...","effort":"medium","reversibility":"two-way"}
```

## Step 6 — exploration report (`docs/specs/ux-exploration/<run-id>.md`)

```markdown
# UX Exploration Report: <project> — <date>

**Mode:** <mode>
**Target:** <URL>
**Sector:** <sector>
**Competitors referenced:** <list>
**Viewports tested:** <list>

## Flow Scorecards

<scorecards from Step 4>

## Proposals

<proposals from Step 5>

## Quick Wins (effort: small, impact: high)

<subset of proposals fitting quick-fix criteria>

## Strategic Changes (effort: large or one-way)

<subset requiring spec/plan/execute pipeline>

## Competitor Patterns Not Yet Adopted

<patterns from innovation-proposal mode>

## Evidence Paths

- Screenshots: `.svc/ux-exploration/<WI>/`
- Structured proposals: `.svc/ux-exploration/<WI>/proposals.jsonl`
- Competitive context: `references/knowledge/competitors/`
```
