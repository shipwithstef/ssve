<!-- Extracted from skills/diagnose-bug/SKILL.md (WI-CLN-14 / plan §4.13 progressive disclosure). -->

## E2E Test Diagnosis Mode

Use `mode: e2e-test` when the report is a failing Playwright/Cypress/browser test,
flaky journey automation, selector failure, trace mismatch, or "test says this is
broken" claim. This is not a shortcut to editing test code. It is a root-cause mode
that proves whether the product, fixture, selector, helper app, or assertion is wrong.

Run these phases in order:

1. Read the newest runtime artifact first: trace, screenshot, video, console log,
   network log, failing assertion, or CI output. Ignore older hypotheses once a newer
   artifact supersedes them.
2. Bisect persistence: rerun the same test once, then the smallest failing test or
   scenario. Classify as persistent, flaky, environment-only, or no longer repros.
3. Check helper-app parity: if the repo has a helper/fixture app, confirm it exposes
   the same visible labels, auth state, seeded data, tenant, and viewport as the real
   app path the test claims to cover.
4. Check tenant/default scope: verify account, role, locale, feature flags, seeded
   records, and base URL before blaming selectors.
5. Check transient assertions: identify assertions that race loading, navigation,
   animation, debounce, toast lifetime, or server state propagation.
6. Check selector disambiguation: run or apply the `write-e2e` selector hierarchy
   before accepting `getByRole(...).first()`, `.last()`, or `.nth()` as a fix.
7. Rank hypotheses with evidence: product bug, test bug, fixture gap, environment
   gap, selector ambiguity, or spec drift.
8. Before handing off a fix, prove old-path-fails/new-path-passes or document why
   the failure is blocked with the exact missing artifact and follow-up WI.

Route a confirmed test implementation gap to `write-e2e`; route a confirmed product
bug through normal bugfix implementation; route vague or missing ACs to `audit-ac`.

## Cross-System Falsification Mode

Use this mode when the symptom crosses runtimes, origins, protocols, SDKs, or
storage layers: OAuth, hosted login, SSO, payments, webhooks, native-app or
WebView handoffs, deep links, push notifications, sync, streaming tool calls,
provider callbacks, or similar multi-system flows.

Before reading code or proposing a fix:

1. Create or update `docs/specs/contract-maps/<flow-name>.md` using
   `_shared/system-contract-map.md`.
2. Validate it:
   ```bash
   node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/<flow-name>.md
   ```
3. Write every load-bearing runtime probe as JSON with `hypothesis`,
   `confirmation_check`, `falsification_check`, and `verdict`, then validate it:
   ```bash
   node scripts/validate-cross-system-probe-evidence.mjs --evidence <probe-evidence.json>
   ```
4. If the proposed fix migrates, swaps, bypasses, or routes through a different
   path, prove the old path fails and the new path passes against the same input.
   If both paths produce the same end state, the migration is not a fix.
5. On the third `diagnose-bug` invocation for the same WI within 14 days, stop
   single-component diagnosis. Mark `cross-system-suspected`, require a System
   Contract Map, and route through `review-cross-model` before `execute-changeset`.

## Retroactive Mode — code already committed

Sometimes a bugfix lands in `main` before `diagnose-bug` runs — a developer fixed it in an earlier session, an agent fixed it without routing through the lane, or an out-of-band hotfix went in. **Do NOT treat this as "done" just because the code is committed.** The lane still applies, run retroactively. See `route-workflow` Lane 4 → Retroactive Lane 4 Execution for the full sequence.

In retroactive mode, `diagnose-bug` reads the committed diff instead of reproducing the bug from a broken state. Its outputs are the same:

- **Reproduction steps:** derive from what the diff proves was broken. Example: "Before commit X, `PhotoUpload` exported `{currentPhotoUrl, onPhotoUpdate}` but all 6 callers passed `{value, onChange}` — photo upload was silently broken on every page that used the component, because `onPhotoUpdate` was always `undefined`."
- **Expected vs actual:** same contract — what should have happened vs what did
- **Root cause:** read the diff + callers to explain what class of defect this was
- **Pattern scan:** MANDATORY — grep for the same class of defect elsewhere. Retroactive mode does NOT waive this step; if anything it's more important, because the original fix was not reviewed
- **Smallest safe fix:** compare committed fix vs what the brief would have prescribed. If the committed fix is narrower than the brief (e.g., fixed the one component but not the other 3 with the same pattern), the delta is new work
- **Proof of fix:** what `write-e2e` needs to cover. The committed fix does NOT count as proof — runtime verification against a real fixture is still mandatory
- **Affected artifacts:** specs/journeys/ACs that should have been updated when the fix landed
- **Learnings:** what rule or feedback memory would have caught the original landing before it merged

The iron law still applies: **no close-out without root cause, pattern scan, runtime verification, and learnings.** Retroactive mode is the same lane on a different timeline, not a shortcut.
