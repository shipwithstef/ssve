# Framework Improvement: End-of-turn summary must LEAD with shipped artifacts, not pending items

**Status:** DRAFT
**Date:** 2026-05-08
**Severity:** medium (compounding — every session, every host, every user)
**Source:** EzBob `new-devops-platform` session 2026-05-08 — user pushback "so did you just say nothing was accomplished?"

---

## Evidence

In a session where WI-046 was completed end-to-end (feature spec + journey + plan manifest + 280-line regression script written, fresh `feat-wi-046` cluster bootstrapped via GH workflow, regression run live, smoking-gun evidence captured for a 12-day production telemetry outage, WI-082 filed CRITICAL with canonical fix cited, 11/11 tasks closed, scoped 12-file commit landed locally on main), the model's final response was framed as:

> "**Genuinely unfinished work (action needed):**
> - **WI-082 NOT IMPLEMENTED** — fix is filed + canonical solution documented..., but no gitops-ezbob PR yet..."

User reaction: "so did you just say nothing was accomplished or what?"

The reaction is correct. The summary led with what's NOT done. The actual accomplishments (real code shipped, real production outage diagnosed, real artifact trail created) were buried below stale-graph housekeeping notes.

This is not a one-off. The same shape recurs across sessions:
- session ships WI-X end-to-end
- model's end-of-turn summary leads with "next priorities from queue"
- user reads it as "nothing happened"
- frustration → re-asking → token waste

## Root cause

The Output Protocol requires a `**Next:**` trailer (correct). It does NOT require an explicit **shipped-this-turn** preamble. So the model's natural end-of-turn shape becomes:

```
[brief lane-tasks update]
[priority queue]
[risks]
**Next:** ...
```

The shipped work gets dispersed inline through the session's chat. By the time the trailer fires, the user has 30+ tool calls of intermediate detail and no consolidated "here's what we delivered this turn" line.

## Diagnosis

This is a **summary-shape bug**, not a content bug. The information IS there, but the structure makes it invisible. End-of-turn summaries that lead with pending items frame the session as backlog management instead of delivery.

The fix is structural: add an explicit `**Shipped:**` block above the `**Next:**` trailer, with the same paste-ready discipline. Just as `**Next:**` answers "what do I type next?", `**Shipped:**` answers "what did this turn deliver?"

## Proposal — Output Protocol amendment

**Add to `route-workflow/SKILL.md` §"Output Protocol — Next Command Suggestion":**

### `**Shipped:**` block (MANDATORY when the turn delivered concrete artifacts)

Every skill response — including `route-workflow` and any chained skill output — that wrote, committed, ran, or filed something MUST include a `**Shipped:**` block IMMEDIATELY ABOVE the `**Next:**` trailer.

**Mandatory format:**

```
**Shipped this turn:**
- <artifact path or commit SHA> — <one-line what + scope>
- <artifact path> — <what>
- <commit SHA on branch X> — <files changed count + headline>
- <WI ID filed/closed> — <severity if filed; status if closed>

**Next:** <exact next command or skill invocation>
```

**Rules:**

- **Lead with what shipped, not what's pending.** Pending items belong in `**Next:**`, not above it.
- **Paste-ready paths.** Every artifact entry must be a real file path the user can open or a real commit SHA they can `git show`.
- **One line per artifact.** Don't editorialize. Don't justify. Just enumerate.
- **Skip the block ONLY when the turn was conversational** (status check, clarifying question, nothing was actually delivered). In that case, go straight to `**Next:**`.
- **Order by impact, not chronology.** A CRITICAL WI filing or a production fix outranks a doc edit.
- **If the turn surfaced a finding without shipping a fix:** still ship the finding. "Filed WI-082 CRITICAL" IS shipped work, even if the fix isn't merged.

**Three acceptable shapes:**

1. **Heavy-delivery turn (multiple artifacts):**
   ```
   **Shipped this turn:**
   - docs/specs/features/obs-inner-loop-verification.md — 5-AC feature spec with evidence shapes
   - docs/specs/journeys/J-obs-inner-loop.feature.md — 4 scenarios
   - scripts/regression/obs-inner-loop.sh — 280-line bash regression, executable, ran end-to-end
   - .obs-evidence/feat-wi-046/scenario-{1..4}-*/{ts}.json — structured evidence captured
   - WI-082 filed CRITICAL — OTel cross-cluster gRPC ALPN broken, 12-day production outage
   - 375c82b on main — 12 files, 1488/-29

   **Next:** Lane 4 entry for WI-082...
   ```

2. **Single-artifact turn:**
   ```
   **Shipped this turn:**
   - 7cce4741 on gitops-ezbob/main — OTel agent filelog receiver wired

   **Next:** ...
   ```

3. **Diagnostic turn (no code, but real findings):**
   ```
   **Shipped this turn:**
   - WI-082 filed CRITICAL with smoking-gun evidence (agent logs grep'd, ALPN handshake failure pattern documented)
   - References/knowledge/domains/opentelemetry-collector/CAPABILITIES.md §7 cited as canonical fix source

   **Next:** ...
   ```

**Anti-pattern (this rule must catch):**

Burying delivered work below pending-queue housekeeping. The user should NEVER have to ask "did anything happen?" after a session that actually shipped artifacts. If the `**Shipped:**` block doesn't make the answer obvious in 5 seconds of skim, the rule is being violated.

## Implementation

### Files to change in seriousvibecoding

| File | Change |
|---|---|
| `route-workflow/SKILL.md` | Add `**Shipped:**` block spec to §"Output Protocol — Next Command Suggestion"; add self-verify check |
| Every skill that emits end-of-turn output (validate-feature, write-spec, design-tech, plan-changeset, execute-changeset, review-gate, land-changeset, verify-promotion, diagnose-bug, etc.) | Add a one-line reference to the new section in their pipeline-continuation block: "MUST include `**Shipped:**` block per Output Protocol when the turn delivered concrete artifacts" |
| `scripts/lint-skills-manifest.mjs` | Optional: extend linter to flag skill outputs that are missing the `**Shipped:**` preamble when their work-product is artifact-producing |

### Files to change in product repos

None. This is a pure framework spec change — every skill inherits the rule on next session.

## Replay verification

After landing:

1. Re-replay the WI-046 session shape: ask the model to summarize a fictional Lane 3 run that shipped 5 artifacts.
2. Verify the summary leads with `**Shipped:**` enumerating the 5 artifacts before any pending-queue mention.
3. Verify the `**Next:**` trailer is below `**Shipped:**`, not above.
4. Cross-check on a conversational-only turn: ensure `**Shipped:**` is correctly OMITTED (not fabricated).

## FRAMEWORK-STATE.md mutations

- **Analysis History:** add 2026-05-08 entry "Output Protocol amended: `**Shipped:**` block leads end-of-turn summaries when artifacts shipped. Surfaced by user pushback on EzBob WI-046 session — heavy-delivery turn was framed as 'pending queue' instead of 'delivered artifacts'."
- **Decisions Made:** add `**Shipped:**`-before-`**Next:**` ordering as a locked invariant.
- **Capabilities:** anti-pattern count goes from 32 → 33 if classified as anti-pattern (AP-33: "Pending-Queue-First End-of-Turn Summary"). Decision deferred until implementation: it's more of an output-shape rule than an anti-pattern, so likely a positive Output Protocol amendment instead of an AP entry.

## Self-verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Spec covers heavy-delivery, single-artifact, diagnostic-turn shapes | All 3 shapes documented with examples | |
| 2 | Skip rule for conversational turns is explicit | Yes — "Skip the block ONLY when conversational" | |
| 3 | Anti-pattern is named | "Burying delivered work below pending-queue housekeeping" | |
| 4 | Implementation files enumerated | route-workflow/SKILL.md + per-skill references + optional linter | |
| 5 | Replay verification target is concrete | Re-summarize a fictional Lane 3 5-artifact session | |
| 6 | Origin session evidence cited | EzBob WI-046 + user pushback verbatim | |

## Why BLOCKED

Not blocked. Ready for implementation in next `improve-framework` session.

## Notes

- Related to `feedback_execute_dont_reconfirm.md` (memory): both issues are about how the agent communicates progress to the user. That memory says "stop asking mid-flow"; this proposal says "lead with shipped, not pending" at end-of-turn. They compose: don't ask mid-flow, do report shipped at end.
- This proposal does NOT change the `**Next:**` trailer rules — those stay exactly as-is. It only adds a new mandatory block above `**Next:**` for delivery-turn summaries.
