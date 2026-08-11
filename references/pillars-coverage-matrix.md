# Pillars Coverage Matrix

**Status:** canonical reference (2026-04-09)
**Owned by:** `route-workflow`, consumed by `write-spec`, `validate-feature`, `diagnose-bug`, Lane 1, Lane 3, Lane 4
**Why:** Every feature (new or modified) and every bugfix close-out must leave all product pillars in a known state. Without a forcing matrix, pillars silently drop — a bugfix fixes the symptom while leaving the journey, AC, UX, UI, architecture, cost, or operations stale. This reference defines the contract.

---

## The 8 Pillars

A shippable feature — whether built from scratch or extended — must have coherent answers for each of these 8 pillars. A bugfix must audit the same 8 pillars to confirm the fix does not leave any of them stale.

| # | Pillar | What it answers | Canonical artifact |
|---|---|---|---|
| 1 | **Product fit** | Does this capability belong in the product? Is it solving a real user problem? Would killing it hurt the product? | `validate-feature` kill-signal output, `docs/specs/vision.md` alignment |
| 2 | **Journey** | What end-to-end user flow does this sit in? What triggers it? What happens next? Is there an end state? | `docs/specs/journeys/J*.feature.md` |
| 3 | **Acceptance criteria** | What observable behavior proves this works? Are the ACs concrete enough to test? | `docs/specs/features/*.md` AC tables, `docs/specs/features/*-ac-checklist.md` |
| 4 | **UX** | What does the user see/feel at each step? Accessibility? Responsive behavior? Empty states? Error states? | inline `## Design-UX` in feature spec OR `docs/specs/design-ux/` |
| 5 | **UI** | Visual layout, components used, tokens, breakpoints, motion | inline `## Design-UI` in feature spec OR `docs/specs/design-ui/` |
| 6 | **Tech architecture** | Where does the code live? What components/services talk to it? Data model? External dependencies? | `## Technical Design` section in feature spec, produced by `design-tech` |
| 7 | **Cost model** | What does it cost to run per user / per action / per month? Does it scale sublinearly, linearly, or worse? Who pays — user, business, or free-tier-covered? | `## Cost Model` sub-section under Technical Design, produced by `design-tech` |
| 8 | **Operations & ownership** | Who owns it in production? Who gets paged? What's the SLA/SLO? Monitoring? Runbook? Backup/restore? Failure modes and recovery? | `## Operations` sub-section under Technical Design, produced by `design-tech` |

---

## Pillar States

Each pillar, at the end of any lane that touches it, must be in exactly one of these states. No other states are allowed.

| State | Meaning | When to use |
|---|---|---|
| `[NEW]` | This pillar's artifact was created from scratch in this lane | Lane 1 (greenfield feature) — every pillar starts as NEW |
| `[UPDATED]` | An existing pillar artifact was modified to reflect this change | Lane 3 (brownfield feature extension), Lane 4 (bugfix) when the fix genuinely changes the pillar |
| `[UNCHANGED — VERIFIED]` | The pillar artifact was reviewed and confirmed still correct despite this change | Lane 3 pillars untouched by a narrow extension, Lane 4 pillars where the fix does not ripple |
| `[N/A — justified]` | The pillar does not apply to this work item, with a one-line reason | Pure background Enabler/Integration work may mark UX/UI as `[N/A — justified: no user surface]`. Internal-only data-layer fixes may mark UX/UI/Cost as N/A if truly unchanged. |

**Forbidden silent states:** a missing cell, a blank cell, a TODO, "skipped", "later", "probably fine." Any of these is a self-verify failure. If you genuinely don't know, the correct answer is to stop and escalate — not to leave the cell empty.

**`[N/A — justified]` is not a free pass.** The justification must be specific and verifiable. "No user surface" is acceptable for a cron job; "not important for this fix" is not.

---

## The Matrix Format

Every feature spec (Lane 1 + Lane 3) and every bugfix brief (Lane 4) MUST emit a Pillars Coverage Matrix section with exactly this shape:

```markdown
## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [NEW \| UPDATED \| UNCHANGED — VERIFIED \| N/A — justified] | <path to artifact or one-line justification> |
| 2 | Journey | [state] | <path> |
| 3 | Acceptance criteria | [state] | <path> |
| 4 | UX | [state] | <path> |
| 5 | UI | [state] | <path> |
| 6 | Tech architecture | [state] | <path> |
| 7 | Cost model | [state] | <path or value> |
| 8 | Operations & ownership | [state] | <path or value> |
```

All 8 rows required. No substitutions. No abbreviations. Exactly these pillar names.

---

## Lane Mapping

How each lane interacts with the matrix:

### Lane 1 — Greenfield Feature

- Every pillar starts `[NEW]`
- `write-spec` must emit the matrix with all 8 pillars populated as `[NEW]` + artifact path
- `design-ux` fills pillar 4, `design-ui` fills pillar 5, `design-tech` fills pillars 6/7/8
- `validate-feature` self-verify check: matrix is complete, every pillar has a non-empty artifact path
- A pillar that truly does not apply uses `[N/A — justified]` with a specific reason — but at least 6 of 8 pillars must be NEW (product-fit + journey + AC are always required; exceptions to UX/UI/cost/ops require explicit justification)

### Lane 3 — Brownfield Feature Extension

- Every pillar ends in `[UPDATED]`, `[UNCHANGED — VERIFIED]`, or `[N/A — justified]`
- `sync-spec-code` reads the existing feature spec's matrix (if present) or creates one as baseline
- Each subsequent lane step updates the relevant pillar's cell: design-ux → pillar 4, design-ui → pillar 5, design-tech → pillars 6/7/8
- Pillars not touched by the extension are explicitly marked `[UNCHANGED — VERIFIED]` — not left blank
- "Pure background Enabler/Integration" exception: UX (4), UI (5), and Cost (7) may be `[N/A — justified]` with a specific reason. Journey, AC, Tech architecture, and Operations are NEVER skippable in Lane 3.
- `validate-feature` (delta mode) self-verify check: no cell is blank or TODO

### Lane 4 — Bugfix / Regression

- `diagnose-bug` MUST run a **Pillar Revisit Audit** (new mandatory step) before closing the bug
- For each of the 8 pillars, ask: "does this bug or its fix change anything here?"
- For every pillar that comes back `affected`, the lane either bundles the update into the bugfix OR files a follow-up WI routed to the correct lane (UX/UI/tech changes → Lane 3, spec drift → Lane 5, product fit doubts → `validate-feature` re-run)
- The pillar-revisit output is a mini-matrix inside the bugfix brief, showing each pillar's post-fix state
- **Critical:** a bugfix does NOT get `[UNCHANGED — VERIFIED]` for free. "Verified" means actively checked — opened the artifact, read it, confirmed the fix does not contradict it. Not "I didn't think about it."

---

## Pillar Revisit Audit (Lane 4)

Run after root-cause analysis in `diagnose-bug`, before proposing the fix. This is what transforms a "symptom patch" into a "product-aware fix."

For each pillar, answer these questions:

### 1. Product fit
- Does this bug reveal that the feature should not exist, or should work differently at the product level?
- If the bug had never been noticed, would users have silently stopped using this capability?
- Does the bug expose a kill signal (users confused, users working around it, users asking "why does this exist")?
- **Affected?** If yes, route to `validate-feature` re-run before applying the fix.

### 2. Journey
- Which journey (or journeys) does this bug live inside?
- Does the journey spec accurately describe the step that broke?
- Does fixing the bug imply a new journey step, a removed step, or a changed trigger/outcome?
- **Affected?** If yes, `write-journeys` in expand mode must run; file as Lane 3 follow-up if scope is large.

### 3. Acceptance criteria
- Which ACs would have caught this bug? Do they exist?
- If no AC would have caught it, the AC set is incomplete — add the missing AC.
- If an AC existed but was wrong, the AC is broken — update it.
- **Affected?** If yes, update the feature's AC checklist and re-run `audit-ac`.

### 4. UX
- Does the fix change what the user sees, reads, or clicks at any step?
- Does the fix introduce a new error state, empty state, or loading state?
- Does accessibility change? (new focus order, new announcements, etc.)
- **Affected?** If yes, update `## Design-UX` in the feature spec; route to `design-ux` if scope is large.

### 5. UI
- Does the fix change visual layout, component choice, tokens, breakpoints, or motion?
- Does the fix imply a screenshot baseline update?
- **Affected?** If yes, update `## Design-UI`; run `track-visuals` in diff mode; route to `design-ui` if scope is large.

### 6. Tech architecture
- Does the fix change where the code lives (component, service, function)?
- Does the fix change data flow, dependencies, or external integrations?
- Does the fix imply a component should be split, merged, or replaced?
- **Affected?** If yes, update `## Technical Design`; route to `design-tech` if the change is non-trivial.

### 7. Cost model
- Does the fix increase per-request compute, storage, bandwidth, or external API calls?
- Does the fix change the scaling curve (linear → polynomial, etc.)?
- Does the fix move something from a free tier to a paid tier?
- **Affected?** If yes, update `## Cost Model`; if cost rises materially, escalate to the user before landing.

### 8. Operations & ownership
- Does the fix change who operates this in production?
- Does the fix change the SLA/SLO or the error budget?
- Does the fix imply new monitoring, alerts, dashboards, or runbook steps?
- Does the fix change failure modes or recovery procedures?
- **Affected?** If yes, update `## Operations`; if SLA changes, escalate to the user.

---

## Self-Verify Contract

Any skill emitting a feature spec or bugfix brief MUST include a self-verify check that validates the Pillars Coverage Matrix:

```
| N | Pillars Matrix present and complete | grep for "## Pillars Coverage Matrix" section + verify all 8 pillars populated with non-empty state + artifact | |
```

A missing matrix, a blank cell, or a TODO placeholder is a hard fail. The skill cannot chain forward until the matrix is complete.

---

## Enforcement

- **At authoring time:** `write-spec` (Lane 1 + Lane 3 delta mode), `diagnose-bug` (Lane 4) emit the matrix template in their output, user/agent fills it
- **At review time:** `review-gate` reads the matrix; any blank or TODO is a FAIL
- **At landing time:** `land-changeset` refuses to land a WI whose matrix has incomplete cells
- **At audit time:** `audit-coverage` can grep all feature specs for a missing or malformed matrix and report as a drift item

---

## Rationale

This matrix exists because shipping a feature (or fixing a bug) without walking all 8 pillars produces **coherent code with incoherent product state**. The PhotoUpload case (Example Marketplace WI-012, 2026-04-09) is the canonical example: a prop-shape mismatch broke photo upload on 6 pages, but the fix was evaluated only at the code level. No one asked: does a journey describe photo upload? Does an AC exist for photo-upload-succeeds-on-every-page? Does the UX account for upload failures? Does the cost model include storage for uploaded photos? Does operations know who pays when storage fills up? All 8 pillars had gaps. The matrix forces those questions to be asked, every time, for every change.

Without the matrix, svc's lanes produce "complete-looking" specs that silently drop pillars. With the matrix, every lane closes with an explicit accounting of every pillar's state. That is the difference between "code fixed" and "product fixed."
