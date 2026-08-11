---
name: paid-external-api
domain: integration
severity: CRITICAL
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/functions/*Lookup*/**"
    - "**/functions/places*/**"
    - "**/functions/openai*/**"
    - "**/functions/stripe*/**"
    - "**/functions/dodo*/**"
    - "**/functions/twilio*/**"
    - "**/functions/sendgrid*/**"
    - "**/functions/*payment*/**"
    - "**/functions/*checkout*/**"
    - "**/functions/*webhook*/**"
    - "**/functions/*billing*/**"
    - "**/integrations/**"
    - "**/services/billing/**"
    - "**/services/payments/**"
    - "**/services/email/**"
    - "**/services/sms/**"
    - "**/services/maps/**"
    - "**/services/llm/**"
  diff_keywords:
    - "googleapis\\.com"
    - "openai\\.com"
    - "stripe\\.com"
    - "twilio\\.com"
    - "sendgrid\\.com"
    - "places\\.googleapis"
    - "api\\.openai"
    - "api\\.anthropic"
    - "api\\.dodopayments"
    - "X-Goog-Api-Key"
    - "Authorization:.*Bearer.*sk-"
  packages_imported:
    - "openai"
    - "stripe"
    - "@stripe/*"
    - "twilio"
    - "sendgrid"
    - "@sendgrid/*"
    - "googleapis"
    - "@google-cloud/*"
    - "@anthropic-ai/sdk"
    - "dodopayments"
  env_vars_referenced:
    - "*_API_KEY"
    - "STRIPE_*"
    - "OPENAI_*"
    - "ANTHROPIC_*"
    - "GOOGLE_*_KEY"
    - "TWILIO_*"
    - "SENDGRID_*"
    - "DODO_*"

handled_by:
  required_rules: [paid-api-integration-checklist]
  required_skills: [manage-finops]
  optional_skills: [design-tech, explore-solutions]

waiver_format: |
  PR body line: "concern-waived: paid-external-api — <reason>"
  Logged as taste decision in .svc/pipeline-decisions.jsonl.
  Acceptable reasons: documentation-only change, test fixture update,
  comment-only edit verified by line-level diff.

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/test/**"
  - "**/__tests__/**"
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/docs/**"

related_concerns:
  - paid-llm-api
  - cache-strategy-symmetry
  - kill-switch-presence
---

# What this concern is

A change is touching a third-party API call that the org pays for per call (or per token, per byte, per result). Decisions made here directly impact the bill and the user-visible reliability of the feature.

# How an agent should think about it

1. **Cost model** — is the bill per-call, per-result, per-token, per-byte? Does the change preserve or alter that unit? `manage-finops` covers this.
2. **Maximum value per call** — is the call extracting the most useful payload allowed by the API per-call cap? Common pattern: `maxResultCount: 5` when the API allows 20 → leaving 15 free results on the table per call.
3. **Cache symmetry** — read-side AND write-side. Reading from cache before calling is half the picture; writing the upstream response back to cache after calling is the other half. An asymmetric cache that never gets populated by the calling code is dead weight.
4. **Refresh policy** — distinguish authoritative entities (refresh on view) from cache rows (TTL-only, lazy refresh on miss). Don't refresh cache-only rows on every hit; that defeats the cache.
5. **Rate limit + kill switch** — per-user code-side rate limit is normal hygiene; an env-var-driven kill switch lets ops turn off the integration when the bill alarm fires without a redeploy.
6. **Free-tier accounting** — what's the free monthly allowance, at what call rate do we cross into paid?

# Why it exists

Originated 2026-05-07 from Example Marketplace `placesNearbyLookup` incident (compound failure):

- 200m radius clamp silently truncated frontend's 5km request → 1-result bug
- Default Google v1 ranking was POPULARITY (not distance) → relevant local spots dropped at limit=5
- Cache existed read-side (`fetchDbCandidates`) but was never written to by the function → cache only warmed by humans sampleing, not by Google calls themselves
- Each fix shipped, then revealed the next; agent never zoomed out to ask "is the design optimal" until user explicitly forced the question

The function had been touched multiple times without any of these surfacing. With this concern wired, every PR touching that file path would have routed to `manage-finops` + `paid-api-integration-checklist`, surfacing all three before merge.

# Examples

**Matches:**
- Editing `base44/functions/placesNearbyLookup/entry.ts`
- Adding a `import OpenAI from 'openai'` in `src/services/llm/`
- Changing `STRIPE_*` env var references in any code file
- Adding a new caller of `client.functions.invoke('dodoCreateCheckout')`

**Does NOT match:**
- `e2e/specs/journeys/sample.spec.ts` — test file, exempt
- `docs/integrations/google-places.md` — docs, exempt
- A README change in the function directory
- Edits that only modify imports without touching call sites (covered by linter, not this concern)
