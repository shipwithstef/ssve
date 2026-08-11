# Framework Evolution — 2026-05-08 — Stop pausing for permission on natural continuations

**Status:** PROPOSED — needs `improve-framework` review

## User intent (verbatim)

> "file proposal hat maek you not ask me this thing hook whtaver I don't know you are suppsoe to handle thisng end to end..."

Translation: when the user has explicitly committed to "fully completed and validated end-to-end," stop pausing at the natural seams (verification finds new gaps → asks user → waits). Either continue, or have a contract that says you can't.

## Method

Grounded in observed behavior across Example Marketplace i18n campaign sessions 2026-05-08:
- Session 1: campaign produced 4 PRs (#47/48/49/+44), declared complete with E2E test.
- Mid-validation discovered 67% overlap (looked like a regression). Paused. User pushed back ("did you run E2E?"). Re-ran with corrected method, found it was a test-methodology bug.
- Session 2: shipped 4 more PRs (#50/51/52/53), bundle-grep validation, partial E2E. Paused again at "1/3 E2E passes — selector limitation on the other 2."
- User pushed back: "you have browser, track-visuals, and more things." Used Playwright MCP. Got real visual proof.
- Visual proof revealed 3 new real gaps (Layout customer-nav missing keys, CustomerPricing hero hardcoded, BG-leaks-into-FR Proxy bug).
- I paused AGAIN. User: "file proposal that maek you not ask me this thing... you are supposed to handle this thing end to end."

The pattern: at every verification layer, when new evidence reveals further work, default behavior is "summarize + stop + offer continuation as user choice." User experience: feels like permission-asking on a committed lane.

## Current state (what works today, what doesn't)

**Works:**
- `rules/common/question-fatigue.md` — "imperative = action, not discussion." Rule exists and was applied at the lane level.
- `route-workflow` Self-Verify check #18 — verifies zero questions after imperatives.
- Lane task graphs and session contract binding.

**Doesn't work:**
- The rule fires on per-turn imperatives ("proceed", "do it") but does NOT cover the **multi-turn end-to-end commitment pattern**. When the user says "continue until this is fully completed and validated," that is a long-form imperative that should keep firing across many turns of natural follow-up work — not just the immediate next action.
- Verification-found-more-work is currently treated as "lane complete + new work item" rather than "lane continuation." This artificially fragments execution.
- The "advisory mode" tag on terminal skills + the Self-Verify checks both bias toward stopping at natural seams. Natural seams are exactly where end-to-end execution must NOT stop.

## Findings (by priority)

### P0 — Fix now

#### F-01 — Add explicit `end-to-end` lane contract that suppresses per-seam stops

**Evidence:** Multi-turn commitment phrases that should set the contract:
- "fully completed and validated"
- "end to end"
- "until done"
- "until this works"
- "you are supposed to handle this thing"

When detected, route-workflow should write a session contract entry with a new field: `execution_mode: "end_to_end"`. This is distinct from `bound_to: user-request|wi-backlog|framework-evolution` — it's a *policy* dimension, not a *target* dimension.

**Behavior under `execution_mode: end_to_end`:**

1. After any verification step (E2E, visual proof, bundle-grep, audit) finds new gaps that fall within the same problem domain, **automatically file a follow-up WI AND start it** rather than presenting the gap as "for the user to decide."
2. Skip per-stage user checkpoints unless they cross a *destructive blast radius* threshold (force-push, schema drop, paid API spend > $X).
3. Continue dispatching parallel subagent waves until either (a) the original problem domain is exhausted, (b) a hard blocker is hit (auth failure, billing cap, real bug requiring user input), or (c) the user actively interjects with new direction.

The end-to-end mode terminates only on:
- All verification layers green for the original committed scope
- Hard blocker
- User interjection

#### F-02 — Define "natural continuation" vs. "scope expansion"

**Evidence:** Not every gap discovered during verification belongs in the same lane. The framework needs a heuristic.

**Heuristic:** if the gap was discoverable at verification time AND fixing it requires the same skill chain as the original lane, it's a **natural continuation** — auto-continue. If the gap requires a different skill chain (e.g., visual evidence reveals a security concern, or a bug requires design work), it's **scope expansion** — file the WI and pause for user decision.

**Concrete decision table:**

| Verification finding | Same lane? | Action under end_to_end |
|---|---|---|
| More files of the same refactor type | YES | Auto-dispatch next wave |
| A regression in adjacent feature | YES | File + auto-fix in same lane |
| A pre-existing bug in the touched file | YES | File + auto-fix |
| A pre-existing bug NOT in the touched file | NO | File WI + pause |
| A design/UX gap | NO | File WI + pause |
| A security finding | NO | File WI + pause + escalate |
| A new feature need | NO | File WI + pause |

#### F-03 — Default verification depth must include browser/visual when tools are available

**Evidence:** Multiple Example Marketplace sessions declared "validated" after bundle-grep + 1 working E2E test, then user demanded actual visual proof and revealed real gaps (PR #186 v2 session, this session). The framework HAS Playwright MCP, track-visuals, repo-quality visual scanner — none were auto-triggered as part of "fully validated."

**Fix:** `verify-promotion` (and any "validate" close-out) under `execution_mode: end_to_end` must run the full V0→V1→V2 ladder per `references/verification-patterns.md`, not stop at V0+partial-V1. If a tool exists in the host capability registry (Playwright MCP, track-visuals, repo-quality-visual), it must be used unless the gap from skipping it is documented as accepted by the user.

#### F-04 — Hook for "stop suggesting backlog continuation as a question"

**Evidence:** Even when `execution_mode: end_to_end` is set, the model has training-baked tendency to end turns with "Next: do you want me to do X?" or "Standing by — these last 3 items are the natural continuation."

**Fix:** A `Stop` hook that, when execution_mode is `end_to_end`, scans the assistant's final message for question-marks-targeting-the-user and patterns like `if you want`, `let me know if`, `standing by`, `awaiting your direction`. If present, the hook injects a system reminder: "execution_mode is end_to_end — continue with the next action automatically; do not solicit confirmation."

This is the mechanical analogue of question-fatigue rule #2 ("no 'what next?' trailers") but for multi-turn commitments.

### P1 — Important but doesn't block

#### F-05 — `verify-promotion` confidence tiers should require V2 by default for browser-visible features

Today: VERIFIED-L3 (structural only) is acceptable when V2 is "blocked." But what counts as blocked is loose. A selector that returns `strict mode violation` is NOT a V2 block — it's a 60-second selector fix. Tighten the L3 acceptance to require a documented platform-level reason (not a test-infra reason).

#### F-06 — Parallel agent dispatch should be the default when ≥3 same-shape WIs exist

Today: dispatching parallel agents requires a manual decision. Under `execution_mode: end_to_end`, when ≥3 WIs of identical shape exist (same skill chain, file-disjoint), the framework should auto-fan-out without asking.

### P2 — Polish

#### F-07 — Decision-log entries for "auto-continue under end_to_end" need a distinct decision_type

So audits can later distinguish "I made an auto-decision because user pre-authorized" from "I made a taste decision unilaterally." Add `decision_type: end_to_end_continuation` with required fields: `original_commitment_phrase`, `seam_crossed`, `gap_classification`.

## Open Questions (for user before improve-framework runs this)

1. **Blast-radius threshold under end_to_end** — what's the dollar/scope cap? Suggested: any single action under $5 of paid API auto-runs; cumulative spend > $20 in a single session pauses; any destructive git op (force push, reset --hard) always pauses.
2. **Should end_to_end persist across sessions?** When a session ends mid-end-to-end, the next session inherits the policy or restarts neutral? Suggested: persist for 24h or until user changes contract.
3. **Recursion limit on auto-filed WIs** — if every verification round finds more WIs, end_to_end could spawn indefinitely. Suggested cap: 3 generations of auto-filed children before forced pause.

## Files this would touch

- `route-workflow/SKILL.md` — add `execution_mode` detection + Self-Verify checks
- `references/decision-log.md` — add `end_to_end_continuation` decision type
- `_shared/session-contract.md` (new) — formalize the contract schema with execution_mode
- `verify-promotion/SKILL.md` — V2 ladder mandatory under end_to_end
- `hooks/svc-stop-end-to-end.sh` (new) — Stop hook scanning for question-mark trailers
- `references/verification-patterns.md` — clarify V2 "blocked" vs V2 "selector trouble"
- `references/anti-patterns.md` — new AP: "Premature Pause on Natural Continuation"

## Why this matters

The framework's current bias toward asking-permission-at-seams works for ambiguous-intent sessions but actively damages explicit-commitment sessions. The user is paying real Max-tier tokens to NOT have to manage step-by-step. Asking-at-seams transfers cognitive load BACK to the user — which is the exact failure mode `rules/common/question-fatigue.md` was created to prevent at the per-turn level. This proposal extends that doctrine to the multi-turn level.

The signal that this is a pattern, not a one-off: the same user has had to push back on the same behavior across multiple sessions ("did you run E2E?" / "you have browser tools" / "you are supposed to handle this end to end"). That's not a turn-level miss — that's a missing framework primitive.
