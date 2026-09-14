# Output Schema

Defines the structure for the mining tracker JSON and the format for marketing context updates.

---

## Feature Mining Tracker

**File:** `docs/marketing/feature-mining-tracker.json`

```json
{
  "version": "1.1.0",
  "last_full_scan": "2026-02-17T00:00:00Z",
  "summary": {
    "total_features": 16,
    "features_mined": 1,
    "total_insights": 1,
    "avg_weight": 95,
    "high_value_insights": 1,
    "content_gaps": []
  },
  "features": {
    "feature-matching": {
      "spec_file": "docs/specs/features/feature-matching.md",
      "spec_status": "current",
      "last_mined": "2026-02-17T00:00:00Z",
      "insights": [
        {
          "id": "feature-matching-001",
          "insight": "Credits consumed only on mutual accept — you never pay for a match that ghosts you",
          "weight": 95,
          "evidence": "No competitor uses mutual-accept credit model. YC Matching, CoFoundersLab charge on send.",
          "audience_segment": "all_users",
          "use_in": ["social", "homepage", "pitch", "blog"],
          "competitor_validated": true,
          "status": "active",
          "deployed_in": [],
          "created": "2026-02-17T00:00:00Z",
          "updated": "2026-02-17T00:00:00Z"
        }
      ]
    }
  },
  "narratives": []
}
```

### Schema Details

#### Root Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version. Currently `"1.1.0"` |
| `last_full_scan` | ISO 8601 | Last time a Full Scan mode was run |
| `summary` | object | Aggregate stats (recomputed after each mining session) |
| `features` | object | Keyed by spec filename (without `.md` extension) |
| `narratives` | array | Cross-feature synthesized narratives (Layer 2) |

#### Summary Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_features` | number | Total feature specs tracked (16) |
| `features_mined` | number | Features with at least 1 insight |
| `total_insights` | number | Sum of all active insights across features |
| `avg_weight` | number | Mean weight of all active insights (rounded to 1 decimal) |
| `high_value_insights` | number | Count of insights with weight >= 70 |
| `content_gaps` | string[] | Feature keys with weight >= 70 insights but no social/blog coverage |

#### Feature Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `spec_file` | string | Relative path to the spec file |
| `spec_status` | string | One of: `"current"`, `"draft"`, `"missing"`, `"needs_update"` |
| `last_mined` | ISO 8601 | When this feature was last analyzed |
| `insights` | array | 0-5 insight objects |

#### Insight Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Format: `{feature-key}-{3-digit-number}` (e.g., `feature-matching-001`) |
| `insight` | string | The user-centric marketing insight text |
| `weight` | number | 1-100 score from weight calibration |
| `evidence` | string | Supporting data, competitor research, or stat citations |
| `audience_segment` | string | One of: `"all_users"`, `"new_builders"`, `"experienced_devs"`, `"teams"`, `"investors"` |
| `use_in` | string[] | Content channels: `"social"`, `"blog"`, `"homepage"`, `"pitch"`, `"email"`, `"comparison"`, `"docs"` |
| `competitor_validated` | boolean | Whether web research confirmed the differentiation claim |
| `status` | string | One of: `"active"`, `"deprecated"`, `"pending_validation"`, `"superseded"`, `"elevated_to_narrative"` |
| `deployed_in` | string[] | Content where this insight was used (e.g., `"tweet-2026-02-17"`, `"blog-matching-deep-dive"`). Empty array if unused. Downstream skills append here when they consume an insight. |
| `weight_note` | string? | Optional. Explanation when weight was overridden from framework calculation (e.g., `"Framework says 72, gut says 55 — gamification bias?"`) |
| `superseded_by` | string? | Optional. ID of the insight that replaced this one. Only present when `status` is `"superseded"`. |
| `elevated_to` | string? | Optional. ID of the narrative that absorbed this insight. Only present when `status` is `"elevated_to_narrative"`. |
| `created` | ISO 8601 | When the insight was first created |
| `updated` | ISO 8601 | When the insight was last modified |

#### Narrative Fields (Layer 2)

Narratives live in the root `narratives` array, separate from per-feature insights.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Format: `narrative-{3-digit-number}` (e.g., `narrative-001`) |
| `narrative` | string | The synthesized marketing story combining multiple feature traits |
| `sources` | string[] | Atomic insight IDs this narrative draws from (e.g., `["feature-matching-001", "feature-trust-002"]`) |
| `weight` | number | 1-100 score (inherits from strongest source, adjusted for narrative power) |
| `use_in` | string[] | Content channels where this narrative fits |
| `deployed_in` | string[] | Content where this narrative was used. Empty array if unused. |
| `created` | ISO 8601 | When the narrative was created |

**Key rule:** Narratives reference atomic insights by ID. If a source insight is deprecated, the narrative should be reviewed but not auto-deleted.

---

## Marketing Context Update Format

When adding insights to `docs/marketing/product-marketing-context.md`, use this format:

### Inline Weight Metadata

```markdown
- "Insight text here." <!-- weight:85 source:feature-matching validated:true -->
```

The HTML comment is invisible in rendered markdown but machine-readable for downstream tools.

#### Comment Fields

| Field | Format | Description |
|-------|--------|-------------|
| `weight` | number | The calibrated weight (1-100) |
| `source` | string | Feature key the insight came from |
| `validated` | boolean | Whether web research was performed |

### Placement Rules

1. **Find the best existing section** — Match the insight to the closest `##` section in the marketing context
2. **Append at end of section** — Add the new bullet after existing bullets, before the next `##`
3. **Create new section if needed** — If no section fits, add a `##` section before any appendix or end-of-file markers
4. **Preserve order** — Never reorder existing bullets. New content goes at the bottom of its section.

### Section Mapping Guide

| Feature Key | Likely Section in Marketing Context |
|-------------|-------------------------------------|
| feature-matching | Core Problem, Key Differentiators, or dedicated Matching section |
| feature-conversation | Product Features or Collaboration section |
| feature-trust | Trust & Safety or Key Differentiators |
| profiles | Product Features or Personalization section |
| feature-onboarding | Onboarding or Getting Started section |
| feature-collab | Collaboration or Product Features |
| teams | Teams or Group Features section |
| feature-workspace | Collaboration or Workspace section |
| gamification | Engagement or Growth section |
| referrals | Growth or Viral Mechanics section |
| monetization | Pricing or Business Model section |
| discovery | Discovery or Browse section |
| feature-learning | Education or Learning section |
| feature-experts | Expert/Investor or Marketplace section |
| feature-privacy | Privacy or Trust & Safety section |
| feature-beta-program | Launch or Beta section |

---

## ID Generation

Insight IDs are deterministic and sequential per feature:

1. Take the feature key (e.g., `feature-matching`)
2. Find the highest existing ID number for that feature
3. Increment by 1
4. Pad to 3 digits

**Examples:**
- First insight for feature-matching: `feature-matching-001`
- Third insight for teams: `teams-003`
- After deleting teams-002, next new insight is still `teams-004` (IDs never reuse)

---

## Tracker Operations

### Adding Insights (merge behavior)

```
IF feature key exists in tracker:
  APPEND new insights to existing insights array
  UPDATE last_mined timestamp
  RECOMPUTE summary stats
ELSE:
  CREATE new feature entry
  ADD insights
  SET last_mined
  RECOMPUTE summary stats
```

### Deprecating / Superseding / Elevating Insights

Never delete. Change status and set `"updated"` to current timestamp:
- `"deprecated"` — outdated, no longer accurate
- `"superseded"` — replaced by a sharper insight. Set `"superseded_by"` to the new insight's ID.
- `"elevated_to_narrative"` — fully absorbed into a Layer 2 narrative. Set `"elevated_to"` to the narrative ID.

All non-active statuses are excluded from summary stats (`total_insights`, `avg_weight`, `high_value_insights`).

### Recomputing Summary

After any change:

```
summary.features_mined = count of features with >= 1 active insight
summary.total_insights = count of all insights where status = "active"
summary.avg_weight = mean of all active insight weights (1 decimal)
summary.high_value_insights = count of active insights where weight >= 70
summary.content_gaps = features with active insights weight >= 70
                       AND use_in includes "social" or "blog"
                       AND no corresponding published content exists
```

Note: `content_gaps` detection is best-effort. Check against known published content if available.
