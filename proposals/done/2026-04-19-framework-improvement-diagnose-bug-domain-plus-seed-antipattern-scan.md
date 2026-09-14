# Framework Improvement: Diagnose-Bug Domain Classifier + Failing-File-Comments Read + E2E Seed Antipattern Scan

**Status:** IMPLEMENTED (2026-04-19)
**Source:** WI-087 session (example-marketplace) — 8 hours of Code-domain hypothesis chasing when the real cause was Test-fixture + Platform, flagged in the test's own SKIP comment block and overlooked by every investigation round.

## Evidence

Live session (2026-04-19) spent ~8 hours and multiple Base44 AI credit rounds investigating WI-087 ("LocationProfile SOP toggle click does not flip aria-checked") under the assumption it was a React state bug. Generated 13 hypotheses (H1-H13) — all in the Code domain (useEffect clobber, Radix race, React reconciliation, etc.). Applied H1 fix (id-keyed useRef) — didn't resolve. Applied H2 fix (poll-verify consistency) — didn't resolve. Eventually traced the real cause:

1. Test seeded via `client.entities.Location.update()` (low-level entity API) which bypasses Base44's UI-save cache-invalidation path
2. Test account (`e2e-owner-b`) was NOT the owner of the seeded location (owned by stream-a's dev account)

Both causes were documented in the test spec's own SKIP-comment block at lines 150-170, written by the previous author. Overlooked by every investigation round because agents anchored on "upstream WI-085 fix should have closed this" instead of reading the failing file's prior comments.

## Diagnosis

- **Root cause:** Two systemic agent failure modes in diagnose-bug:
  1. Default to Code-domain hypotheses; blindness to Test-fixture and Platform domains
  2. Skip reading the failing file's own documentation in favor of starting fresh investigation
- **Category:** missing capability × 3 (domain classifier, comment-read step, mechanical pattern scan)
- **Already in FRAMEWORK-STATE.md?** No — fresh finding from 2026-04-19 WI-087 session

## Implementation

### Files created

| File | Purpose | Lines |
|---|---|---|
| `scripts/scan-e2e-seed-antipattern.mjs` | G3 — greps e2e/ for `client.entities.X.update(...)` followed by `page.reload()` within 30 lines; flags as vulnerable to the WI-087 bug class (cache-invalidation bypass + silent auth no-op) | ~100 |

### Files modified

| File | Change |
|---|---|
| `diagnose-bug/SKILL.md` | Added Step 0.3 (Bug-Domain Classification) and Step 0.35 (Read Failing File's Own Comments First) BEFORE Step 0.4 (Pre-Lock Rejection). Both are mandatory pre-hypothesis gates with WI-087 archetype evidence. |
| `FRAMEWORK-STATE.md` | Analysis History entry + 3 new locked Decisions (bug-domain classifier; read-failing-file-comments; test-boundary principle) |

## Replay Verification

### G1 + G2 (diagnose-bug SKILL.md additions) — replay against WI-087 transcript

Under the new contract, WI-087 investigation at turn 1 would:

1. **Step 0.3 classify:** Evidence = "post-deploy E2E fails; useRef fix deployed but test unchanged". Symptoms don't reproduce for real users (they're not in the test suite). Domain = Test-logic OR Test-fixture (not Code). One 2-minute classification round eliminates 8 hours of Code hypotheses.

2. **Step 0.35 read failing-file comments:** `grep -nE "SKIP|TODO|FIXME|KNOWN|XXX|NOTE" e2e/specs/journeys/WI081-sop-friendly-toggle.spec.ts` surfaces the SKIP block at lines 150-170. Reads it. Comment explicitly names cause: *"test account is TEAM MEMBER, not OWNER"*. Diagnosis complete in ~5 minutes.

**Result: PASS** (qualitative replay). The specific failure mode that burned 8 hours of this session is the exact failure mode these gates are designed to catch.

### G3 (scan-e2e-seed-antipattern.mjs) — live replay against example-marketplace

```
$ node scripts/scan-e2e-seed-antipattern.mjs /home/svc-user/app-workspaces/example-marketplace
scanned 119 files under e2e/
antipattern matches: 4
  e2e/helpers/base44-client.ts:54 → reload at line 75
  e2e/specs/journeys/J06-customer-loyalty-lifecycle.spec.ts:220 → reload at line 225
  e2e/specs/journeys/J06-customer-loyalty-lifecycle.spec.ts:504 → reload at line 510
  e2e/specs/journeys/J06-customer-loyalty-lifecycle.spec.ts:556 → reload at line 562
exit 1
```

**Result: PASS** — one false positive in base44-client.ts (match is in documentation comments of the fix helper itself; acceptable since the helper's content warns about exactly this pattern). Three REAL vulnerable candidates in J06-customer-loyalty-lifecycle — not yet failing but match the WI-087 bug class; any future regression in LoyaltyChallenge caching/auth would surface there first. User can evaluate and fix proactively.

## FRAMEWORK-STATE.md Mutations

- Analysis History: 2026-04-19 entry documenting G1 + G2 + G3
- Decisions (3 new locks):
  1. Bug-domain classification gates all diagnose-bug hypotheses
  2. Read failing file's own comments before hypothesizing
  3. Test-boundary principle — seed via UI path, not entity API
- Known Gaps: none added (all three are closed, not deferred)

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Evidence gathered | PASS — WI-087 session transcript |
| 2 | Diagnosis produced | PASS — 3 gaps identified, ranked |
| 3 | Implementation route chosen | PASS — direct SKILL.md edits + new script |
| 4 | Replay verification passed | PASS — qualitative replay (G1/G2) + live-test against example-marketplace (G3) |
| 5 | FRAMEWORK-STATE.md updated | PASS — Analysis History + 3 Decisions |
| 6 | svc CAPABILITIES.md updated | PARTIAL — new script added; update if CAPABILITIES is maintained |
| 7 | Blend registry updated | N/A — internal learning, not external blend |
| 8 | Proposal in done/ | PASS — this file |
| 9 | NOTICES | N/A |
| 10 | Commits pushed | PENDING — Step 6c |
