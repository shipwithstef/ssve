**Superseded-by:** WI-140 (manifest: docs/plans/2026-05-01-competitive-awareness-deep-research/manifest.md)

# Framework Gap: Competitive Awareness Is Shallow, Static, and Unquestioned

**Discovered:** 2026-05-01
**Severity:** CRITICAL — leads to strategic misdirection
**Reporter:** User (founder) discovered competitive liability after 2 months of framework-guided work
**Affected skill:** `analyze-competitors`
**Affected artifact:** `docs/specs/analyze-competitors.md` (dated 2026-04-08)

---

## What Happened

The user asked: *"how can we be competitive, what it will cost us, what can we use, and what it would mean"*

This question should NEVER have needed to be asked. The framework should have already known, already warned, and already recommended. Instead, the user discovered after **2 months** that:

1. **Receipt scanning is a workaround, not a feature.** Zero of Example Marketplace's 7 direct competitors offer it.
2. **All competitors use POS auto-accrue or card linking** — frictionless for customers.
3. **Example Marketplace's model is high-friction** (remember → photo → upload → wait for OCR) vs competitors' zero-friction.
4. **67% of customers won't download an app** for a business they visit occasionally — an enrollment death sentence.
5. **GPS proximity is NOT industry standard** for receipt verification — Fetch Rewards (12M users, $500M revenue) uses zero GPS checks.
6. **Card linking costs $1.50-6/card/year** — economically unviable for SMB loyalty at Example Marketplace's scale.
7. **Toast is the most viable POS integration target** — but requires 6-10 weeks engineering.

All of this was discoverable on day 1. The user found it on day ~60.

---

## Root Cause: The `analyze-competitors` Skill Is Broken

### Failure 1: Read-Only Consolidation, Not Deep Research

The `analyze-competitors.md` (520 lines, 2026-04-08) was generated with this header:

> **Source:** Consolidated from 9 existing market-research files in `docs/analysis/` (originally generated December 2025). **No new web research performed** — this is a read-only consolidation of prior analysis into the svc canonical form.

**The framework took OLD research, reshuffled it, and called it done.** No web searches. No API docs read. No pricing checked. No "how do they earn points" investigated. The December research didn't know about receipt scanning fraud, so the April consolidation didn't either.

### Failure 2: No "How Do They Earn Points" Analysis

The competitor analysis lists features ("points accumulation," "visit tracking") but **never asks the critical question**: How does the CUSTOMER earn points? Is it automatic at checkout? Do they scan something? Do they check in manually?

This is the #1 UX differentiator in loyalty. The analysis missed it entirely.

### Failure 3: The "POS Is Redundant" Conclusion Was Unchallenged

Line 458 of `analyze-competitors.md`:

> "`secureCheckIn` (GPS+QR) + `processReceipt` (OCR) give Example Marketplace verified visits and verified spend. That is the loyalty signal. POS data would be *redundant* for the core loop."

This conclusion:
- Was drawn from OLD internal docs, not competitive reality
- Was never tested against "what do competitors actually do?"
- Was never updated when `processReceipt` was built and its fraud vulnerabilities became visible
- Was treated as **ground truth** for 2 months, shaping engineering priorities

### Failure 4: No Continuous Competitive Monitoring

The `analyze-competitors` skill runs once at project start (or brownfield onboarding). It never:
- Re-runs when a new feature is spec'd ("should we build receipt scanning?")
- Re-runs when a new WI touches core mechanics ("receipt verification lacks safeguards")
- Cross-references competitor capabilities during `validate-feature` or `write-spec`
- Alerts when Example Marketplace's approach diverges from ALL competitors

### Failure 5: No "Receipt Scanning Is Unusual" Risk Flag

When `processReceipt` was originally built (before svc framework adoption), no one asked: "Wait — do ANY of our competitors do this?" When the feature was spec'd in svc, `validate-feature` didn't flag it. `write-spec` didn't question it. `design-tech` didn't research alternatives.

**An entire feature was built on a mechanism that zero competitors use, and the framework never questioned it.**

---

## What the Framework Should Have Done

### Day 1 (Brownfield Onboarding)
When `onboard-repo` discovered `processReceipt`, it should have:
1. Searched: "do Square Toast Fivestars TapMango offer receipt scanning"
2. Found: "no, they all use POS integration"
3. Flagged: **HIGH RISK — Example Marketplace uses receipt scanning as primary earn mechanism; zero competitors do this. Receipt scanning is a compensating control for lack of POS integration, not a feature.**
4. Recommended: Immediate competitive strategy workstream + Toast POS integration spike

### During `validate-feature` for Receipt Scanning
When receipt scanning was validated as a feature, `validate-feature` should have:
1. Cross-referenced `analyze-competitors.md` for "receipt scanning"
2. Found zero mentions
3. Asked: "Why does no competitor do this? Is it fraud? Friction? Cost?"
4. Searched for the answer
5. Either rejected the feature or accepted it with **explicit compensating-control framing**

### During WI-167 (Fraud Gap Discovery)
When the fraud gap was discovered, `route-workflow` should have:
1. Checked: "Is this gap specific to Example Marketplace's unusual mechanism, or industry-wide?"
2. Found: "Industry uses POS; receipt scanning IS the vulnerability"
3. Recommended: Strategic pivot (POS integration) rather than just hardening a workaround

---

## Proposed Fixes

### Fix 1: `analyze-competitors` Must Do Deep Research, Not Consolidation

**Current:** Reads old docs, reshuffles, declares done.
**Required:** For each competitor, answer:
- How does the CUSTOMER earn points? (auto / manual scan / check-in / card link)
- What is the merchant's monthly cost?
- What POS integrations exist?
- What is their enrollment mechanism? (app download / POS auto / SMS / wallet pass)
- What fraud prevention do they use?
- What do customers complain about? (Reddit, G2, App Store reviews)

**Mandate:** Web research is NOT optional. "No new web research performed" is a failure mode.

### Fix 2: Competitive Cross-Reference Gate in `validate-feature`

Before any feature is validated, check:
1. Does ANY competitor do this?
2. If NO: Why not? Research the reason. Flag as HIGH RISK.
3. If YES: How do they do it? What can we learn?

**Enforcement:** `validate-feature` must read `analyze-competitors.md` and append a "Competitive Risk Assessment" section. If zero competitors do the proposed feature, the default recommendation is NO-SHIP unless strong compensating rationale exists.

### Fix 3: Continuous Competitive Monitoring Trigger

Re-run competitive analysis (or targeted competitive check) when:
- A new feature touches core mechanics (earn, redeem, verify, enroll)
- A bugfix reveals a vulnerability that might be industry-standard or unique
- A user asks a competitive question (signal that knowledge gap exists)
- Quarterly, regardless (market evolves)

**Trigger file:** `.svc/competitive-monitor-triggers.jsonl` — append events, review monthly.

### Fix 4: "Receipt Scanning Is a Compensating Control" Framing

Add to `validate-feature` / `write-spec` / `design-tech`:

> **Compensating Control Checklist:** If the proposed feature exists because another capability is missing (e.g., receipt scanning because no POS integration), it MUST be framed as a compensating control, not a primary feature. The spec must include: (a) what capability is missing, (b) why it can't be built now, (c) the risk of the compensating control, (d) the path to replacing it with the real capability.

### Fix 5: Knowledge Base Must Surface Competitive Context Automatically

When `research` or any skill queries `references/knowledge/`, if the topic relates to a core mechanic (loyalty, verification, enrollment, payment), the knowledge system MUST append:

> **Competitive Context:** [Competitor A] does this via [method]. [Competitor B] does this via [method]. Example Marketplace does this via [method]. Risk/Reward: ...

This prevents the "we're the only ones who do it this way" blind spot.

---

## Evidence

- `docs/specs/analyze-competitors.md` line 458: "POS data would be redundant"
- `docs/specs/analyze-competitors.md` header: "No new web research performed"
- `references/knowledge/domains/loyalty-programs/COMPETITIVE-STRATEGY.md` (2026-05-01): Full competitive reality discovered 2 months late
- `docs/specs/work-items/WI-167.md`: Fraud gap exists because receipt scanning is the wrong mechanism
- User message 2026-05-01: "I discover this shit now after 2 months"

---

## Impact

- **2 months of engineering** built on a workaround (receipt scanning) instead of the real capability (POS integration)
- **WI-167 fraud fixes** are necessary but insufficient — they harden a broken model
- **Strategic positioning** was wrong: "verified spend via OCR" is not a competitive advantage, it's a liability
- **User had to manually ask** what the framework should have proactively surfaced

---

## Recommendation

1. **Accept this proposal** into `proposals/done/` after review
2. **Update `analyze-competitors` skill** to mandate web research + customer earn-path analysis
3. **Add competitive cross-reference gate** to `validate-feature` and `write-spec`
4. **Add compensating-control checklist** to spec pipeline
5. **Schedule quarterly competitive re-scan** for Example Marketplace (next: 2026-08-01)
6. **Retroactively audit** all WIs that touch receipt scanning, enrollment, or verification for competitive misalignment
