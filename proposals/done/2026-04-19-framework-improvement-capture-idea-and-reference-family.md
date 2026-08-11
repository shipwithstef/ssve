# Framework Improvement: capture-idea directive detection + reverse-engineer family-fit + route-workflow reference grounding

**Status:** IMPLEMENTED (2026-04-19)
**Source proposal:** `proposals/done/2026-04-19-evolution-capture-idea-and-reference-family-gaps.md`

## Evidence

- **Source:** user-reported session (example-marketplace WI-086 capture → reverse-engineer flow, 2026-04-19)
- **Finding:** three related gaps exposed in one session:
  - F1: `capture-idea/SKILL.md` Sections 2 + Rationalization Table treat ALL intake as pure (zero-assessment), ignoring directive phrases embedded in the input
  - F2: `reverse-engineer/SKILL.md` Phase 1 accepts any named targets without validating product-family fit against caller context
  - F3: `route-workflow` Output Protocol requires "paste-ready" trailers but doesn't require named references/targets in those trailers to be grounded against caller product family
- **Severity:** F1=high (user pushed back twice in one session), F2=high (same session), F3=medium (upstream cause of F2's trigger)

## Diagnosis

- **Root cause:** the three skills each behave correctly per their contracts; the contracts have missing checks. User had to manually correct the pipeline twice in one session to get product-grounded output. This is framework-level, not execution-level.
- **Category:** all three are **missing capability** (not drift, fragility, or inefficiency). The checks don't exist; adding them is additive.
- **Already in FRAMEWORK-STATE.md?** No. Fresh findings from 2026-04-19 session.

## Implementation

- **Route:** direct SKILL.md edits (isolated skill surgery — quickest path, no new skills, no lane changes)

### Files changed

| File | Change | Lines |
|---|---|---|
| `capture-idea/SKILL.md` | Added Section 1.6 "Directive Signal Detection" with trigger phrase table + assessment ≤200 words rule; added Product-Grounded Assessment to WI template (conditional); amended Rationalization Table with 2 new rows; added 2 new Red Flags | ~45 |
| `reverse-engineer/SKILL.md` | Added Phase 0.5 "Reference-Family Fit Check" before Phase 1 (caller family classification + target family classification + compare + report alternatives on mismatch); added Self-Verify row #0 | ~60 |
| `route-workflow/references/task-graph-protocol.md` | Added "Output Protocol — Next Trailer Rules" subsection with reference-grounding rule (also restored paste-ready/exactly-one/never-omit rules that were lost during 2026-04-19 Gemini CLI slim refactor) | ~20 |
| `route-workflow/SKILL.md` | Extended Output Protocol one-liner to reference the new trailer rules + family grounding | 1 |

- **Commits:** pending (see Step 6c push)

## Replay Verification

- **Replay target:** qualitative — no `test-framework` scenario exists for these skills
- **Method:** manual replay against the original session transcript
- **Result:** PASS
  - **F1 replay:** the example-marketplace user's original input contained *"figure out best way"*, *"if you think that will help"*, *"check capabilities"*. Under the new Section 1.6, those directive signals fire, requiring a Product-Grounded Assessment section in the WI. The exact user frustration ("did you take it literal? did you assess based on product?") would not occur — the assessment would be in the WI on first turn. ✓
  - **F2 replay:** the example-marketplace user ran `reverse-engineer linear.app, stripe.com, vercel.com, raycast.com` for a local-business SaaS landing page. Under the new Phase 0.5, caller family = "local-marketplace / hospitality" (from vision.md + P1 café owner), target family = "dev tools." Mismatch STOPS Phase 1 and reports alternatives (Airbnb, OpenTable, Strava) with reasoning. The exact user correction ("this is not technical SaaS, related to live customer visits") would not be needed — the skill catches it before Phase 1 runs. ✓
  - **F3 replay:** the upstream route-workflow Next-line that suggested Linear/Stripe/Vercel/Raycast for a local-business product would now be required to ground those named targets against caller product family first, OR emit without specific targets and describe the required family. The mismatch never propagates downstream. ✓
- **Evidence:** the session transcript is the scenario; the three pushback moments are the failure modes; each new rule specifically blocks its failure mode. Manual verification sufficient for qualitative contract changes.

## FRAMEWORK-STATE.md Mutations

### Analysis History — add:

```
### 2026-04-19: capture-idea directive detection + reverse-engineer family-fit + route-workflow reference grounding

**Source:** User session on example-marketplace (WI-086 landing-page idea → reverse-engineer → two user pushbacks).

**Findings:**
- **F1 (capture-idea too literal):** Skill stripped directive phrases (*"figure out"*, *"if you think"*, *"check capabilities"*) from input and stored ideas with no product-grounded judgment. User pushed back.
- **F2 (reverse-engineer no family check):** Skill accepted dev-tool targets (Linear/Stripe/Vercel/Raycast) for a local-business SaaS without validating product-family fit against caller context. User pushed back after receiving wrong-register teardown.
- **F3 (route-workflow reference grounding):** Upstream Next-line suggested the wrong-family targets that triggered F2. Output Protocol had no rule requiring named references to be grounded.

**Fixes applied:**
- `capture-idea/SKILL.md`: added Section 1.6 "Directive Signal Detection" + conditional Product-Grounded Assessment (≤200 words) in WI template. Skill stays frictionless for pure intake, adds light assessment for directive intake.
- `reverse-engineer/SKILL.md`: added Phase 0.5 "Reference-Family Fit Check" before Phase 1. Classifies caller + target product families across 9 taxa, stops on mismatch and offers family-matched alternatives.
- `route-workflow/references/task-graph-protocol.md`: added "Output Protocol — Next Trailer Rules" (also restored paste-ready/exactly-one/never-omit rules lost during Gemini CLI slim refactor) with reference-grounding requirement for named targets.

**Impact:** The three-rule set closes the full causal chain from upstream suggestion (F3) → downstream target processing (F2) → initial intake assessment (F1). A replay of the original session no longer requires user correction at any of those three points.
```

### Known Gaps — no entries to move (these were new, not deferred)

### Decisions — add:

```
- **2026-04-19:** Product-family taxonomy for svc: 9 families (dev tools / enterprise B2B / consumer social / local-marketplace / hospitality / creator / prosumer / fintech / health-regulated). Used by `reverse-engineer` Phase 0.5 and `route-workflow` reference grounding. Extend the taxonomy rather than replacing it if new product families appear.
- **2026-04-19:** capture-idea stays frictionless (no user interrogation) even for directive intake. Product judgment appears as a ≤200-word section in the WI, never as a question to the user.
```

### Current State — no counters change (no new skills, no new lanes, no new gates)

## svc CAPABILITIES.md

No additions — these are contract refinements to existing skills, not new capabilities. Skipping CAPABILITIES.md update.

## Blend registry

No external blend. Internal framework improvement from session evidence.

## Self-Verify

| # | Check | Result |
|---|-------|--------|
| 1 | Evidence gathered | PASS — pending proposal in `proposals/` from evolve-framework |
| 2 | Diagnosis produced | PASS — source proposal contains ranked P0/P1/P2 findings |
| 3 | Implementation route chosen | PASS — direct SKILL.md edits, 3 files |
| 4 | Replay verification passed | PASS — qualitative manual replay against session transcript, all 3 failure modes blocked |
| 5 | FRAMEWORK-STATE.md updated | PENDING — next step |
| 6 | svc CAPABILITIES.md updated | N/A — no new capabilities |
| 7 | Blend registry updated | N/A — no blend |
| 8 | Proposal moved to done | PENDING — Step 6b |
| 9 | NOTICES updated | N/A — no external source |
| 10 | Commits pushed to remote | PENDING — Step 6c |
