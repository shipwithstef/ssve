# Framework Evolution — 2026-04-26 — `audit-entity-rls` skill for Base44 user_app projects

## The triggering example (concrete)

In example-marketplace session 2026-04-26 (WI-113 → WI-115), audit found that **75 of 76 declared entities had no RLS rules deployed**. Only `Location` had any rules — and even that one was malformed (Apply-Recommended-Rules dashboard button generated an unsatisfiable AND-rule between owner-match and admin-role).

The systemic gap was hidden because:
1. All customer/owner UI flows go through `secureOperation` (custom backend function) which enforces code-level ownership checks
2. The **direct entity API** (the SDK's `base44.entities.X.update()`, REST PUT, etc.) bypasses `secureOperation` entirely and goes straight to the entity gateway — which has no rules
3. The dashboard's "Permissions issue detected" banner appears on each entity individually; the user never realized it was a SYSTEMIC gap until we audited all 76 at once

This is a P0 security vulnerability class that no current svc skill catches. `review-security` covers OWASP/STRIDE app-level threats. `audit-implementation` covers spec-vs-code drift but not entity-level permission audits.

## Proposed skill: `audit-entity-rls`

A skill that audits every entity in a Base44 user_app project's `entities/*.json` for proper RLS configuration, identifies critical gaps by data sensitivity, and generates a per-entity fix plan.

**Frontmatter:**

```yaml
---
name: audit-entity-rls
description: |
  Audit every entity in a Base44 user_app project for Row-Level Security (RLS)
  rules. Identifies entities without RLS, malformed rules, and rules that
  don't match the feature spec's declared access pattern. Triggers on
  "audit RLS", "check entity permissions", "review base44 security",
  "permissions issue detected", or after a Base44 platform reports a
  security banner on entity pages.
inputs:
  required:
    - { artifact: "base44-app-id", note: "App ID for runtime schema fetch" }
    - { path: "entities/*.json", artifact: "entity-schemas" }
  optional:
    - { path: "docs/specs/features/*.md", artifact: "feature-specs" }
    - { path: "docs/specs/personas/*.md", artifact: "personas" }
outputs:
  produces:
    - { path: "docs/specs/audit/entity-rls-audit.md", artifact: "rls-audit-report" }
    - { path: "docs/specs/audit/entity-rls-audit.json", artifact: "rls-audit-data" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---
```

## Process

### Phase 0 — Fetch deployed schemas

Use the `coding/write` round-trip to fetch the live entity schemas including RLS:

```bash
jq -n --rawfile content src/pages/<any-real-page>.jsx '{file_path: "pages/<any-real-page>", content: $content}' | \
  curl -s -X POST "https://app.base44.com/api/apps/$APP_ID/coding/write" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d @-
```

Parse `.entities.<Name>` (string-encoded JSON) for each entity, extract `rls` block.

### Phase 1 — Static audit

For each entity:
1. **Has RLS?** Boolean — is `rls` field present and non-empty?
2. **Malformed AND-rule?** If `rls.update` has both `owner_id` and `$or` at the same object level → flag (per WI-113 lesson)
3. **Missing operations?** Is any of `create / read / update / delete` not specified?
4. **Default-permissive read?** Is `read: {}` (open to all)? Flag for review based on feature spec.
5. **Mismatched delete policy?** Is delete more permissive than update? (Usually shouldn't be.)

### Phase 2 — Sensitivity classification

Categorize each entity by data sensitivity using a configurable rubric:

| Tier | Examples (Example Marketplace-style) | Default required RLS |
|---|---|---|
| **T1 — Financial / Auth** | User, PaymentMethod, BankAccount, Subscription, Transaction | owner-only OR admin; create only authenticated |
| **T2 — Privacy** | Message, Conversation, AuditLog, CheckIn, NotificationLog | owner-only OR admin |
| **T3 — Economic credit** | Loyalty, Points, Promos, Referrals, AIWallet | system-only writes (asServiceRole), user reads own |
| **T4 — User-controlled content** | Owner's hours, deals, items | owner OR admin update; public read |
| **T5 — Public engagement** | Reviews, Votes, Followers | author update; public read; admin moderate |
| **T6 — Internal aggregates** | AnalyticsEvent, Usage records | service-role-only |

The skill ships a default rubric + lets project tune it.

### Phase 3 — Cross-reference feature spec

For each entity with declared access patterns in `docs/specs/features/*.md` (e.g., "owner edits their own Location", "customer reads public business info"), compare against the deployed RLS rule. Flag mismatches.

### Phase 4 — Per-entity fix recommendation

For each flagged entity, generate the canonical RLS block to add to its schema:

```json
"rls": {
  "create": { "user_condition": { "role": "user" } },
  "read": {},
  "update": {
    "$or": [
      { "owner_id": "{{user.id}}" },
      { "user_condition": { "role": "admin" } }
    ]
  },
  "delete": {
    "$or": [
      { "owner_id": "{{user.id}}" },
      { "user_condition": { "role": "admin" } }
    ]
  }
}
```

…with per-entity adjustments for the sensitivity tier.

### Phase 5 — Output report

`docs/specs/audit/entity-rls-audit.md` with:

| Entity | Tier | Has RLS | Issues | Recommended action | Priority |
|---|---|---|---|---|---|
| User | T1 | ❌ | none declared; financial PII | Add RLS: read=own/admin; update=own/admin; delete=admin | P0 |
| ... | | | | | |

Plus a **batch plan** suggesting fix order by tier (so devs ship the most-critical entities first).

### Phase 6 — Verification stub

For each fixed entity, generate a Playwright probe spec (extension of `wi113-frontend-sdk-write-probe.critical.spec.ts` pattern):
- Login as a user matching the rule → attempt update → expect 200 + value persists
- Login as a non-matching user → attempt update → expect 403
- Test asServiceRole context → expect admin behavior

## Self-verify

| # | Check | How |
|---|---|---|
| 1 | Audit report produced | `test -f docs/specs/audit/entity-rls-audit.md` |
| 2 | Every declared entity has an audit row | `[entity-count] == [audit-row-count]` |
| 3 | Malformed AND-rules detected | grep audit JSON for malformed_and_rule == true |
| 4 | Tier classification covers every entity | no row has `tier: "?"` |
| 5 | Per-entity fix recommendation present for every gap | grep audit MD for "Recommended action" rows |

## Effort estimate

| # | Item | Hours |
|---|---|---|
| Initial skill SKILL.md + phase logic | 3 |
| Default sensitivity rubric file (`references/rls-tier-rubric.json`) | 1 |
| Schema fetcher script | 1 |
| Static audit checks (all 5 from Phase 1) | 1 |
| Feature-spec cross-reference parser | 1.5 |
| Probe-spec generator | 1.5 |
| **Total** | **~9 hours** |

## Comparison delta

- gstack and superpowers don't have an equivalent.
- Existing `review-security` skill is OWASP/STRIDE-focused; doesn't know about Base44 entity RLS.
- Existing `audit-implementation` audits spec-vs-code drift; doesn't check platform-level permission rules.
- Existing `rules/base44/schema.md` covers field-level schema queries; no RLS coverage.
- New `rules/base44/rls-policy.md` (sibling commit to this proposal) defines the policy; this skill mechanizes the audit.

## Replay test

After implementation, replay the Example Marketplace session through `audit-entity-rls`:

1. Skill fetches all 76 entities' deployed schemas
2. Reports: 75 of 76 lack RLS; 1 (Location) has malformed AND-rule
3. Generates batch plan B1-B8 (matches WI-115's manual prioritization)
4. Per-entity Playwright probe specs scaffolded

If output matches WI-115's hand-authored content within structural tolerance, the skill is correctly mechanizing what we just did manually.

## User actions required

1. Review proposal
2. Approve / modify / reject
3. After approval: implement skill as standalone PR; add a Tier-2 eval that runs against Example Marketplace's audit dump to verify regression-free output

## Note on related framework changes

Companion drop-in landed alongside this proposal:
- `rules/base44/rls-policy.md` — the policy this skill mechanizes (every entity must have `rls`; how to deploy; the AND-rule pitfall)

The rule + skill split is intentional: the rule documents the policy for human-driven review; the skill automates the audit.
