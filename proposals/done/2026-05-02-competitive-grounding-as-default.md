# Framework Gap: Competitive Grounding Should Be Default, Not Keyword-Triggered

> **Status:** DONE — promoted to **[WI-142](../../docs/specs/work-items/WI-142.md)** (gate read path + Industry Grounding default) and **[WI-143](../../docs/specs/work-items/WI-143.md)** (refresh-competitors skill + 30-competitor floor, blocked on WI-142). Split per `rules/plan-changeset-trigger.md` to keep each WI single-axis. Moved to `proposals/done/` 2026-05-02.

---


**Discovered:** 2026-05-02
**Severity:** CRITICAL — leads to selective blindness
**Reporter:** User feedback after WI-140 verification ("competition is our compass; needs to be like that for everything")
**Affected skills:** `analyze-competitors`, `validate-feature`, `write-spec`, `design-tech`, `onboard-repo`, `research`, `svc-advisor`
**Supersedes-scope-of:** WI-140 (which fixed the narrow case but kept the keyword trigger)

---

## What WI-140 fixed (and what it missed)

**Fixed:** SDKG primitive layer (zero-dep, reusable engine + schema + validators + hook router with dedupe). Competitive analysis now mandates live web research and emits structured JSON. Gate branches on `landscape_state` (populated / nascent / none-found / inapplicable) with compensating-control framing.

**Missed:** the gate only FIRES on features whose ACs contain `earn|redeem|verify|enroll|loyalty|points|reward`. Every other feature ships without competitive grounding. This recreates exactly the failure mode WI-140 set out to fix — selective blindness. The cardiology-only X-ray solves chest pain, leaves orthopedics blind.

**The user's correction:** competitive grounding is the COMPASS for every feature decision. You can swim beyond the industry, but you must know where the industry is before you choose to. This applies to *all* feature work, not a keyword-matched subset.

---

## The principle (precise)

For any feature spec moving toward BASELINED, the framework MUST answer four questions before the spec passes the gate:

1. **What does the industry do?** Standard practice across ~30 competitors (not 4-6 direct).
2. **What are we doing?** Our chosen approach, named.
3. **Why do we differ (or align)?** Specific reason: cost / moat / capability / regulatory / first-mover bet / personal preference.
4. **Reversibility?** One-way door (slow down) or two-way (move on).

These four questions become a required `## Industry Grounding` section in every spec. The current `## Competitive Risk Assessment` (WI-140) is the populated-landscape branch of this; it should be widened.

**Internal training + live competitive data combined.** Neither alone is enough:
- LLM training knowledge is broad but stale (decay-prone, exactly what WI-140's primitive layer was built to fix at the *implementation* level)
- Live competitive data is current but narrow (4-6 direct competitors miss the 90th-percentile patterns)
- Together: LLM proposes a baseline from training knowledge; live data corrects, contradicts, or extends it. That's grounding.

---

## CRITICAL refinement (added after first user feedback round): knowledge-first architecture

Live web research at gate-time is the WRONG default. The right architecture:

```
COMPREHENSIVE COMPETITOR KNOWLEDGE BASE
  references/knowledge/competitors/<slug>/
    ├── CAPABILITIES.md          ← exhaustive per-competitor coverage, NOT a 9-dim snapshot
    ├── earn-mechanism.md         ← deep details
    ├── enrollment-flow.md        ← deep details
    ├── pricing-history.md        ← longitudinal
    ├── fraud-controls.md         ← deep details
    ├── customer-complaints.md    ← live-mined from G2/Reddit/App Store, dated
    ├── changelog.jsonl           ← what changed week-over-week
    └── .last_full_refresh         ← ISO date of last comprehensive deep-dive
```

**Three principles:**

### 1. Deep-dive per competitor is ONE-SHOT EXHAUSTIVE

When a competitor enters the tracked set, do ONE comprehensive research pass that covers *everything* they do (not just 9 dimensions): full feature surface, every pricing tier, every integration, every public claim, every customer-reported issue from G2/Reddit/App Store/HN, public engineering posts, leadership interviews. Knowledge layer becomes the durable artifact.

### 2. Gate-time = knowledge-base READ ONLY

When `validate-feature` / `write-spec` / `design-tech` invokes the Industry Grounding gate:
- Engine READS the knowledge base
- If full knowledge exists for the relevant competitors + topic → grounding is complete, gate passes/branches per the data
- **NEVER triggers web research from gate path.** Web fetch from a gate is slow, expensive per-gate, inconsistent, and re-fetches what we should already know

If knowledge is missing or thin for the topic:
- Gate emits a "knowledge-gap-detected" finding
- Gate **queues a deep-dive WI** (per-competitor or per-topic) for out-of-band execution
- Gate does NOT block the spec on this — proceeds with available data + records the gap explicitly in the spec's Industry Grounding section ("Note: insufficient knowledge for X; deep-dive queued as WI-XXX")
- The user / future agent runs the deep-dive WI when ready, knowledge fills, future gates use the new data

### 3. Refresh is ASYNC (scheduled, decoupled)

A scheduled background activity (`/schedule` agent on weekly cadence, or cron, or per-project routine) does:
- For each tracked competitor: WebSearch their homepage + pricing page + recent press, diff against `references/knowledge/competitors/<slug>/.last_known_state.json`
- If diff detected: append to `changelog.jsonl` with what changed (price change, new feature shipped, integration added, executive change, etc.)
- If diff is significant (price change, capability added/removed): bump confidence flag, optionally queue a focused refresh of the affected file (`pricing-history.md`, `earn-mechanism.md`, etc.)
- Never blocks anything. Pure background curation.

The user's stack already supports this via the existing `schedule` skill (cron-on-Anthropic-routine). One scheduled "competitor-watch" routine per project + weekly cadence.

### Implication: split analyze-competitors into two skills

The current `analyze-competitors` conflates two operations:
- **`analyze-competitors`** — comprehensive one-shot per competitor, populates knowledge base. NOT something the gate triggers. Run when adding a competitor to tracked set.
- **`refresh-competitors`** (NEW) — scheduled diff-based update. Runs weekly. Appends to changelog. Out-of-band.

Gate-side reader is just `scripts/lib/structured-gate-engine.mjs` (already exists from WI-140) reading from the knowledge base instead of from `analyze-competitors.data.json`. Schema changes from "snapshot of N competitors" to "knowledge-base index pointing to per-competitor files."

---

## Concrete proposed changes (delta on top of WI-140)

### Change 1: Remove the keyword trigger

**Before (WI-140):**
```bash
# tier-1 validate-feature-competitive-cross-reference.sh
if ! grep -qiE "^[-|].*($CORE_MECHANIC_RE)" "$spec"; then
  continue  # skip — feature doesn't touch core mechanics
fi
```

**After:**
```bash
# Every feature spec moving to BASELINED requires Industry Grounding section.
# Exemption only via explicit landscape_inapplicable_reason in spec frontmatter.
```

Type:Enabler / Type:Integration are NO LONGER blanket-exempt. They get the grounding section too — "what do other framework projects do for this enabler / integration."

### Change 2: Raise competitor floor

**Before (analyze-competitors):** min 3 direct + 1 other; max 20 total across 4 tiers.

**After:** target floor of ~30 competitors. Adjust the 4-tier table:
- Direct: target 8-10 (was up to 6)
- Adjacent: target 8-10 (was up to 5)
- Emerging/insurgent: target 6-8 (was up to 5)
- Macro disruptors: target 4-6 (was up to 4)

Deep analysis (9 dimensions) on direct + adjacent (~16-20). Core dimensions only on emerging/macro (~10-14).

If the domain genuinely has fewer competitors (niche / new category), `landscape_state: nascent` or `none-found` covers it — but the search must be exhaustive enough to *prove* the count, not stop at 6 because that was the cap.

### Change 3: Rename the section + restructure

`## Competitive Risk Assessment` (WI-140) → `## Industry Grounding`

New structure (4 required parts, none optional):

```markdown
## Industry Grounding

**Source:** docs/specs/analyze-competitors.data.json (last_verified: <date>, N=30 competitors)
**Landscape state:** populated | nascent | none-found | inapplicable

### What the industry does (baseline from training + live data)

<2-3 sentences combining LLM domain knowledge with live competitor patterns.
Example: "The standard practice for X across 30 surveyed competitors is Y (60%
adoption) or Z (30% adoption). LLM training corroborates: industry literature
since 2022 has converged on Y for [reason].">

### What we're doing

<our chosen approach, named clearly>

### Why we differ (or align)

<one of: cost / moat / capability / regulatory / first-mover-bet / personal-preference / other-justified>
<specific evidence — not "we think it's better">

### Reversibility

<two-way door (reversible, low blast radius) | one-way door (irreversible, high blast radius)>
<if one-way: explicit risk acknowledgement>
```

### Change 4: Knowledge auto-surface — ALWAYS

`research` and `svc-advisor` ALWAYS append the competitive context block when `analyze-competitors.data.json` exists for the project, regardless of whether the query topic matches a domain in `competitive-domains.json`. The domain list becomes a *priority hint* (auto-surface even when stale), not a gate.

### Change 5: NEW skill `refresh-competitors` + scheduled routine

Create:
- `refresh-competitors/SKILL.md` — diff-based, runs against the tracked competitor set, appends to per-competitor `changelog.jsonl`, never triggers full re-analysis (that's `analyze-competitors` for new entrants only)
- Default schedule: weekly via `/schedule` agent (per-project routine in `~/.claude/routines/<project>-competitor-watch`)
- Output: per-week summary of what changed across the tracked set, surfaced to user as a "competitive landscape changed this week" digest

This is the **decoupled refresh** that keeps the knowledge base fresh without ever touching gate-time latency.

### Change 6: Brownfield sweep — every feature, not just core-mechanic

`onboard-repo` Step 2.4 (added in WI-140) currently greps for core-mechanic patterns. Replace with: enumerate all major feature areas in the codebase (per directory + entry-point analysis), invoke `analyze-competitors` per area in scoped mode. Output `docs/specs/brownfield-competitive-flags.md` covers ALL detected feature areas with severity rating.

---

## What this means for Example Marketplace (and the broader "what should I do for receipt vs POS" question)

This is the change that produces actionable answers. Once landed:
- ANY Example Marketplace feature spec touching ANYTHING (matching, signup, dashboard, admin, settings, billing) gets an Industry Grounding section before BASELINE
- The 30-competitor analysis becomes the always-available compass
- "We chose receipt OCR because [reason]; industry uses POS attestation (8/10 direct competitors); reversibility: one-way door (6-10 weeks to swap)" becomes the recorded decision
- Future contributors see WHY, not just WHAT

The Example Marketplace strategic-decision (separate skill, separate session) becomes much easier to run because it inherits the 30-competitor data the framework now demands.

---

## Cost / risk

**Cost:** the SDKG primitive layer from WI-140 is reusable as-is. This proposal mostly removes restrictions (keyword trigger, type exemption, domain-list gate) and raises a target (competitor floor). New work: ~3 SKILL.md edits + 2 validator updates + 1 template rewrite. Likely 3-4 PRs, 1-2 sessions.

**Risk of doing nothing:** WI-140's narrow scope continues; framework keeps treating "core mechanic" as the only place competitive blindness matters. Same root cause that produced the receipt-scanning failure remains for every non-mechanic feature.

**Risk of doing this:** every feature spec costs ~1 analyze-competitors invocation worth of time + tokens. For greenfield: large but one-time per project. For brownfield: large but per-project per-feature. Framework gets slower / more thorough.

---

## Recommendation

1. Accept this proposal
2. File as new WI (WI-141) with clear delta-on-WI-140 framing
3. Do NOT revert WI-140 — the primitive layer is correct
4. Run write-spec → design-tech → plan-changeset for the deltas
5. After landing, the Industry Grounding section becomes the new default for every feature spec

---

## Acknowledgment

WI-140 was the narrow version of this principle. I scoped it to keywords because the original proposal scoped it to keywords. The broader pattern was visible in user feedback ("more robust validation + general feature feed process") and I should have pushed scope wider. This proposal captures what should have been shipped.
