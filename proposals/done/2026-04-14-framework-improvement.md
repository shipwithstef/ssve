# Framework Improvement: Visual verification + pattern-family validation + Lane 6 browser-visible enforcement

**Status:** IMPLEMENTED (2026-04-14)

## Evidence

- **Source:** User-reported during WI-048 close-out (Example Marketplace). User pasted a post-deploy screenshot showing visual issues that shipped despite WI-048 being marked VERIFIED.
- **Finding triad (from `proposals/done/2026-04-14-evolution.md`):**
  - P0-1: Lane 6 (chore/refactor) bypasses `track-visuals` even when the chore touches browser-visible CSS. WI-048 was reclassified to chore and skipped visual verification. Route: `route-workflow/SKILL.md:1776-1790`, `:2042-2047`
  - P0-2: AC validation commands are agent-authored with no pattern-family coverage check. The WI-048 narrow `from-{color}-50/100` grep missed `via-*`, `to-*`, and `from-white` variants. Live grep on Example Marketplace main @ HEAD post-VERIFIED found 2 unguarded light gradients still on prod.
  - P0-3: S0 code-inspection tier (committed earlier today at `FRAMEWORK-STATE.md:237-245`) overclaims sufficiency. CSS class presence ≠ correct rendering. Tailwind JIT, specificity, theme-variable definition, and opacity math can all make a correctly-named class render wrong.
- **Severity:** high — the current framework state (pre-fix) would let another CSS-only WI ship the same way

## Diagnosis

- **Root cause:** Three compounding gaps (a) `chore` classifier conflates "mechanical" with "not browser-visible" so Lane 6 skips track-visuals; (b) pattern-based ACs rely on agent-written greps with no adjacent-pattern sweep, allowing narrow passes to hide leaked variants; (c) the new S0/S1/S2 tier model bless class-presence grep as sufficient for rendering ACs.
- **Category:** drift (Lane 6) + fragility (narrow grep) + drift (S0 overclaim) — all three together enable false-confidence VERIFIED
- **Already in FRAMEWORK-STATE.md?** P0-1 partially (visual evidence enforcement was added for WI-032 at line 348-354, but never wired into Lane 6). P0-2 and P0-3 are new.

## Implementation

- **Route:** Direct SKILL.md edits across 4 files + 1 new reference
- **Files changed:**
  1. `test-journeys/SKILL.md` — Step 2.5 rewritten. Added AC tier classifier lookup table, S0 grep discipline (narrow + adjacent sweep), explicit rule that visual-rendering ACs REQUIRE S1 even when S0 passes
  2. `route-workflow/SKILL.md:1776-1790` — Lane 6 now has a mandatory browser-visible check at the top; route updated to include `track-visuals` baseline (step 3) + diff (step 5)
  3. `route-workflow/SKILL.md:2042-2057` — Mandatory-step validation extended to ALL lanes (was feature-only). File-extension scan triggers the check. Chore lane bypass called out as anti-pattern.
  4. `route-workflow/SKILL.md:1803` — Change-type table: new `style-refactor` row forces Lane 6 with `track-visuals` when CSS/className-only change
  5. `plan-changeset/SKILL.md:314-330` — Adversarial Review expanded from 5 to 7 checks. New check #6 (pattern-family completeness for grep-based ACs) + #7 (visual-rendering AC tier requires screenshot/track-visuals evidence)
  6. `review-gate/SKILL.md:349-361` — G5 table expanded from 8 to 10 checks. New check #9 (pattern-family sweep) + #10 (visual-rendering ACs backed by screenshots)
  7. `references/validation-patterns.md` — NEW. Reference library of pattern families (gradients, color tokens, design-system tokens, routes, endpoints, flags, HTML elements) with narrow + adjacent-sweep commands for each
- **Commits:** TBD (will be filled by the commit at end of this skill)

## Replay Verification

- **Replay target:** Run the new adjacent-sweep command from `references/validation-patterns.md` Gradient section against Example Marketplace main @ post-WI-048 HEAD. The broader sweep MUST find what WI-048's narrow grep missed.
- **Result:** PASS
  - Before fix (narrow grep `from-{color}-50|100`): 0 findings → WI-048 marked VERIFIED
  - After fix (broader adjacent sweep): 2 findings
    - `src/components/UserNotRegisteredError.jsx:5` — `from-white to-slate-50` (real bug, fixed in commit `b3beca9`)
    - `src/pages/Landing.jsx:394` — `from-white/10 to-white/5` (intentional glass overlay, documented as exclusion)
  - Both outcomes are expected per the validation-patterns.md spec: sweep catches all variants, reviewer annotates intentional exclusions.
- **Evidence:** The commit `b3beca9` (Example Marketplace main) contains the fix that the OLD DM-21 validation would not have forced. The NEW check #9 in G5 would have blocked WI-048 from reaching VERIFIED without this fix.

**Forward replay (conceptual):** If a hypothetical WI-049 attempts to route a CSS-only change through Lane 6 as `chore`:
- `route-workflow/SKILL.md` Lane 6 browser-visible check triggers on `.jsx` file match
- Task graph MUST include `track-visuals` baseline + diff OR log explicit skip reason
- `review-gate/SKILL.md` G5 check #10 blocks PASS without screenshot evidence for any visual-rendering AC
- `plan-changeset/SKILL.md` Adversarial check #7 blocks manifest handoff without screenshot evidence step

All three layers now enforce what was previously prose-only guidance.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add 2026-04-14 entry for this triple-fix
- **Known Gaps:** None to move (all three findings were new)
- **Decisions (locked):**
  - Lane 6 (and all lanes) must trigger track-visuals for ANY change touching `.jsx/.tsx/.vue/.svelte/.html/.css` files. No exceptions.
  - Pattern-based ACs require narrow match + adjacent sweep BOTH. Missing either is a manifest defect.
  - Visual-rendering ACs (wording: "renders / displays / does not show / appears as") require at least one screenshot or track-visuals diff as evidence. Grep alone is insufficient.
- **Corrects earlier 2026-04-14 entry (line 237-245):** The S0/S1/S2 model had an overclaim — S0 is necessary but not always sufficient. This proposal's changes to test-journeys Step 2.5 add the qualifier.
- **Capabilities:** no new capabilities added (tightening existing ones)
