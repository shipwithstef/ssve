# Phase 3.5: Three-Layer Journey Analysis — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Layer 3: What's MISSING + What's WRONG (journey reasoning)

This is the most valuable layer and where the skill earns its existence.
Dimensions 1 and 2 are translation work. Dimension 3 is independent reasoning
about the journey as a complete system.

**Why this matters:** Individual feature specs can each be perfect and the
journey can still be broken. Problems only visible when you look at the
end-to-end flow: contradictions between specs, missing transitions, persona
mismatches, wrong sequencing. No single spec reveals these.

The skill looks at the whole journey and finds:

**Logical contradictions:**
"The journey assumes GitHub auth but this persona is an expert who uses
Google auth. The journey breaks at step 1."

**Sequencing problems:**
"Step 4 depends on data from step 2 but no spec describes how that data
persists across the transition between features."

**Persona mismatches:**
"This step was designed for power users but appears in the new user journey.
A newcomer wouldn't understand '7D compatibility score' without context."

**Missing transitions:**
"The user goes from matching to the collab workspace but nothing in any spec
describes what that transition looks like. Is it a redirect? A modal? Nobody
defined this seam between features."

**Wrong placement:**
"The spec puts the credit explanation modal before first match. For a new
user at this moment in the journey, that's friction at the worst time.
They're excited about matching, not ready to think about billing."

**Redundancies:**
"The onboarding tour explains matching on step 3. Then the matching screen
explains matching again. The user sees the same concept explained twice."

**Concept fragmentation (duplicate features under different names):**
When the codebase has two components, two names, or two flows that operate
on the same underlying entity or serve the same user goal, that's concept
fragmentation — and it's a sign the product doesn't understand its own
feature. The skill must catch this by checking:

1. **Entity-level dedup**: If two different UI components both create/read
   the same entity type, they're the same feature split across two names.
   Flag it: "Component A creates EntityX. Component B also creates EntityX.
   These are the same product concept with two names — consolidate."

2. **Industry pattern recognition**: When a journey involves a common
   product pattern, name the pattern and check completeness against
   industry standard. Common multi-role patterns:

   | Pattern | Producer side | Consumer side | System side |
   |---------|-------------|--------------|-------------|
   | Flash deals / time-limited offers | Seller creates deal (UI + validation + plan gating) | Buyer browses, claims (limit checks, confirmation) | Notifications to nearby/subscribed users, expiry cleanup |
   | Referral programs | Referrer shares link (tracking, custom message) | Referee signs up (attribution, reward trigger) | Double-sided reward disbursement, fraud detection |
   | Booking / reservations | Provider sets availability (calendar, capacity) | Customer books slot (confirmation, reminders) | No-show handling, waitlist promotion |
   | Reviews / ratings | Customer writes review (after purchase gate) | Business owner responds (moderation) | Aggregate score computation, display |
   | Loyalty / points | System awards on purchase (earning rules) | Customer redeems (balance check, reward catalog) | Tier progression, expiry, rollover |
   | Content publishing | Creator publishes (draft → review → live) | Audience discovers (feed, search, recommendations) | Moderation, analytics, notifications |
   | Marketplace listings | Seller lists item (pricing, photos, description) | Buyer searches, purchases (cart, checkout) | Search indexing, commission, fulfillment |

   For each pattern, check: does the product have ALL three sides covered
   by journeys? If the consumer journey exists but the producer journey
   doesn't, that's an ungrounded precondition. If both exist but the system
   side (notifications, cleanup, fraud) isn't covered, that's a gap.

3. **Naming alignment**: If the codebase uses one name ("FlashSlot")
   but a component uses a different user-facing name ("Last Hour Offer")
   for the same entity, flag the mismatch. The product should have ONE
   name per concept. Different names create confusion in specs, journeys,
   UI copy, and analytics. Recommend: pick the name that matches the
   industry pattern (e.g., "flash deal") or the entity name, and rename
   the outlier.

4. **Full persona lifecycle mapping**: For every entity the journey
   touches, list EVERY persona that interacts with it and HOW:

   ```
   Entity: FlashDeal
   ├── Seller: creates (dashboard shortcut + full form)
   ├── Customer: browses, claims (discovery page)
   ├── System: validates limits, sends notifications, expires
   └── Admin: monitors abuse, overrides limits
   ```

   If any persona's interaction is missing a journey, flag it. If any
   persona's interaction exists in code but has no journey, flag that too.
   The goal is complete lifecycle coverage — inception to consumption to
   cleanup, across all roles.

**Dead ends:**
"If no match is found and the 24-hour queue expires, what happens? No spec
describes the queue-expired state. The user sees... nothing?"

**Missing user expectations:**
"After completing the wizard, there's no confirmation. The user selected
preferences across 7 dimensions and gets no summary of what they chose."

**Ungrounded preconditions (supply-side gaps):**
This is the check most likely to catch critical product gaps that no other
analysis finds. Many features are two-sided: one role produces data, another
role consumes it. A journey that only covers the consumer side looks complete
in isolation but hides a product gap — there's no way for the supply side
to actually create what the journey assumes exists.

For every Background precondition and every "Given" that assumes data exists,
ask: **"Who creates this data, and does a journey cover that creation flow?"**

Examples of what this catches:

"The customer claim journey assumes flash deals exist, but no seller journey
covers creating them. The claim page works perfectly — but there's no
validated path for sellers to actually post deals. The only UI that creates
them bypasses validation and plan limits."

"The customer journey assumes a loyalty balance > 0. The admin setup journey
covers configuring the program, but no journey covers the actual earning
transaction — how points get credited after a purchase. Points appear from
nowhere in the consumer journey."

"The discovery journey filters by an accessibility flag on listings. But no
seller journey covers setting that flag — and the flag doesn't even appear
in the listing edit form. The filter will always return zero results."

"The reporting dashboard assumes managers have assigned tasks to team members.
But the task assignment UI requires a permission that only admins have. The
manager journey silently assumes data that managers can't actually produce."

**How to check — the full producer-to-consumer pipeline:**

For each precondition in the Background section, trace the COMPLETE path
from inception to consumption:

1. **Entity/state assumed** — what data must exist? (e.g., "a flash deal")
2. **Producing role** — which user role creates it? (e.g., "sellers")
3. **UI to produce it** — does a page/form/button exist for that role to
   create the data? Is the field actually exposed in the form? Is the
   button wired to the right backend call?
4. **Validation/security** — does the creation path go through the same
   validation pipeline that the consumer side expects? (e.g., plan limits,
   permissions, required fields) A shortcut that bypasses validation is a
   gap even if the UI exists.
5. **Side effects** — does creating the data trigger expected downstream
   effects? (e.g., notifications to consumers, cache invalidation, status
   updates) If the consumer journey assumes "sellers are notified when a
   buyer claims," check that the notification actually fires on that path.
6. **Journey coverage** — does any journey for the producing role include
   a scenario covering this creation flow end-to-end?
7. **Discoverability** — can the producing role actually FIND the UI?
   A button buried in a submenu that no journey mentions is functionally
   invisible.

Report the gap at whichever step the chain breaks: missing UI, missing
validation, missing side effects, missing journey, or missing discoverability.

This is especially important for multi-role products (seller/buyer,
admin/employee/customer, creator/viewer, host/guest) where every
consumer-side feature has an implicit dependency on a producer-side flow
that may never have been specced or tested. The gap is invisible when you
look at each role's journeys in isolation — it only appears when you trace
data flow across roles.

Present ALL findings in a `## Journey Analysis` section:

```markdown
## Journey Analysis

### Logical Issues

| ID | Type | Where | Finding | Impact |
|----|------|-------|---------|--------|
| F1 | Contradiction | Step 1 → Step 2 | Expert persona can't use GitHub auth but journey assumes it | Journey breaks for P2 |
| F2 | Dead end | After queue expires | No spec for what user sees when 24h expires with no match | User sees nothing, churns |
| F3 | Wrong placement | Before first match | Credit explanation interrupts excitement momentum | Increases bounce at key moment |

### Ungrounded Preconditions

| Precondition | Producer role | Producer journey | UI exists? | Validation intact? | Impact |
|-------------|--------------|------------------|:---:|:---:|--------|
| "a seller has posted a flash deal" | Seller | NONE | Partial — button exists but bypasses plan limits | NO — skips security middleware | Consumer page works but producer path is unvalidated and ungated |
| "3 listings flagged as accessible" | Seller | NONE — daily ops journey doesn't mention this field | Unknown — check if edit form exposes the flag | N/A | Filter may always return zero results |
| "buyer has a loyalty balance > 0" | System (on purchase) | PARTIAL — setup journey exists but no earning scenario | Yes — purchase recording exists | Yes | Consumer can't redeem because no journey tests the earning path |

### Missing Transitions

| From | To | What's undefined |
|------|----|-----------------|
| Matching screen | Collab workspace | No spec describes this transition |
| Tour completion | Profile wizard | Spec says "prompted" but no UI defined |

### Product Gaps

| Gap | Where | What user expects | Why it matters |
|-----|-------|-------------------|----------------|
| G1 | After wizard | Summary of selections | Confirmation reduces anxiety |
| G2 | After matching | WHY we matched | Trust in the algorithm |
```

**Rules for Layer 3:**
- Reason about the journey as a system, not individual specs
- Flag problems that only appear when you look end-to-end
- Each finding must be specific: where in the journey, what's wrong, why it matters
- Connect findings to the persona's context at THAT moment
- Don't flag technical debt or architecture issues — only user-facing problems
- Don't flag deliberate design choices (dark mode only = intentional, not a gap)
- Separate "definitely wrong" (contradictions, dead ends) from "worth considering"
  (sequencing suggestions, gap opportunities)
- These are findings for the PM to evaluate, not demands to implement

### Routing Layer 3 findings to other skills

Layer 3 findings are not just documentation — they're actionable inputs for
other skills. After presenting findings, recommend the right next step based
on what was found:

| Finding type | Route to | Why |
|-------------|----------|-----|
| Ungrounded precondition (no producer journey, no UI) | `/validate-feature` | The missing producer side is a product gap that needs business validation before building. Feature-discovery determines if it's a real need, a pipeline fix, or concept fragmentation. |
| Ungrounded precondition (UI exists, bypasses validation) | `plan-changeset` (or `/writing-plans` if external add-on) | The feature exists but the pipeline is broken. This is a fix, not a new feature — go straight to planning. |
| Concept fragmentation (two names, one entity) | `/validate-feature` | Feature-discovery resolves naming, identifies the industry pattern, and produces a consolidated brief. |
| Missing persona (journey needs a user type with no persona file) | `/build-personas` | Can't write a proper journey without understanding who the user is. |
| Missing transition (gap between two features) | `/audit-ac` | The transition needs ACs before it can be journeyed. |

Don't just list findings and move on. The whole point of Layer 3 is to
surface problems that need action — route them to the skill that acts on them.
