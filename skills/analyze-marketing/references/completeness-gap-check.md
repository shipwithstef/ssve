# Mode 9 — Completeness Gap-Check (missed-opportunity audit)

**Origin (2026-07-15, example-marketplace WI-MKT-GTM-01):** a full analyze-marketing refresh passed its no-loss gate and self-verify, yet the OWNER's challenge exposed ~12 live, sellable capabilities missing from the context (voice→offer creation with AI-generated branded images, regular-arrival owner push, standby queues, events, two-way inbox + segmented broadcasts, cross-shop perks, receipt manual loop mislabeled as gated, a flag-flip the context still called "off"), plus overclaims ("GPS-targeted", wrong price, phantom "bookings"). Two independent reviews (a blind two-phase agent read + a cross-model adversarial pass) found in ~20 minutes what the mining protocol structurally could not. This mode makes that audit a standing part of the skill.

## Why the base protocol misses things (failure modes this mode closes)

1. **Spec-only vision.** Mining reads `docs/specs/features/*` — but shipped capability truth often lives in code surfaces (`src/pages/*`, function slugs, deploy scripts, feature flags) with stale, missing, or never-written specs. Spec status headers LAG deploys in both directions (live things marked blocked; gated things marked done).
2. **Depth-first batching.** 3–4 features/session × first-100-lines reads is correct for insight QUALITY but never produces a breadth-complete inventory, and nothing forces a "which surfaces have NO insight?" reckoning.
3. **Self-verify verifies presence, not absence.** Every existing check asks "is what's written correct/weighted/sourced?" — nothing asks "what sellable thing exists that is written NOWHERE?" Absence needs an independent reader, not the author re-reading their own output.

## The protocol

Run Mode 9 whenever: (a) a refresh/foundation pass is being called "complete"; (b) the context will feed a plan/campaign/major copy wave; (c) the owner questions coverage; (d) ≥30 days since the last gap-check.

### Step 1 — Surface inventory (mechanical, ~free)
Build the coverage denominator from the PRODUCT, not the specs:
```bash
ls src/pages/*.jsx | wc -l && ls src/pages/          # every page is a candidate capability surface
ls -d supabase/functions/*/ | grep -v _shared        # every slug is a candidate capability (adapt paths per stack)
grep -rn "FLAG\|_ENABLED" deploy/ src/lib/*flags* 2>/dev/null   # flag truth beats spec headers
```
Cross-check against any code-grounded capability inventory the project keeps (e.g. a CAPABILITY-SELLABILITY doc) — treat it as a checklist, never as stale corpus.

### Step 2 — Blind independent read (the core mechanism)
Dispatch ONE reviewer (subagent, or cross-model CLI when available) with the two-phase contract:
- **Phase A (blind):** read specs + pages + slugs + flags and produce "every marketable capability, one line, with evidence path + live/gated/dead status" — WITHOUT opening the marketing context.
- **Phase B (diff):** only then open the context and classify each capability: CAPTURED-WELL / UNDERSOLD / MISSING / MISREPRESENTED — and separately list OVERCLAIMS (context asserts more than code truth: inputs, targeting, prices, tiers, statuses).
The blind ordering is load-bearing: a reviewer who reads the context first inherits its blind spots. When stakes are high (owner escalation, pre-campaign), run TWO independent reviewers (different model/family if available) and reconcile.

### Step 3 — Owner surface-check
Present the verdict table and explicitly invite the owner's own capability list ("name what you'd sell") — the owner's list is a first-class input; every named item gets a code-verified verdict, never a from-memory answer.

### Step 4 — Remediate under the no-loss discipline
MISSING/UNDERSOLD → mine as a normal batch (weights, tracker, atomic insights). MISREPRESENTED/OVERCLAIM → correct IN PLACE with an annotation (never silent deletion), and re-run the no-loss inventory against the pre-refresh snapshot. Product-truth gaps discovered along the way (unwired notifications, config not read, UI copy without backend) are logged as product WI candidates in Known Gaps — marketing holds those claims until shipped.

### Step 5 — Coverage ledger
Record in the tracker: `gap_check: {date, surfaces_total, surfaces_with_insight_or_skip, missing_found, overclaims_found, reviewer(s)}`. A surface with no insight AND no recorded skip-reason is an open item, not a pass. The next Mode 9 diffs against this ledger.

## Exit criteria
Mode 9 passes when: every page/slug surface maps to an insight, a tracker entry, or an explicit skip-reason; the blind reviewer's MISSING list is empty or fully remediated; overclaims are zero; and the ledger is written. "The author re-checked their own doc" never satisfies Mode 9.
