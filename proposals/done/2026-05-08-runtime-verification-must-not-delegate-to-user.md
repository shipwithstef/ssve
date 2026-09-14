# Framework Improvement: Runtime verification MUST NOT delegate to user (recurring)

## Evidence

- **Source:** Repeated user feedback during 2026-05-08 example-marketplace session — twice, escalating in tone. The user's existing memory entry `feedback_verify_promotion_use_browse.md` already states: "Behavioral runtime verification (button flips, state changes) runs via browse daemon + E2E accounts — do NOT delegate to user. User-ask is reserved for visual aesthetic review."
- **Finding:** Despite that memory, the agent (Claude Opus) defaulted to "open example-marketplace.app on your phone, sign in, tap..." TWICE in this session: once after WI-184 (mobile Select drawer fix) and once after the mobile-header ROOT_PAGES fix. Both should have run via Playwright + production-deployed account, not via user-eyeball.
- **Severity:** medium-high (recurring pattern across sessions; user has corrected this multiple times in past memory entries — still happens)

## Diagnosis

- **Root cause:** Skill outputs in `verify-promotion`, `land-changeset`, `review-gate` (and orchestrator-emitted summaries from `route-workflow`) include "manual smoke" fallback wording that frames the user as the runtime verifier of last resort. Agent reads this as "punt to user is acceptable when E2E feels heavy" rather than "runtime verification is non-negotiable; only the channel choice (Playwright headless vs user device) is the variable, and Playwright is the default."
- The cost economics also push the wrong way: Opus running a quick Playwright probe via Bash takes 30-60s of orchestrator time, but punting to user takes 0s of orchestrator time. Without an enforcement gate, the lazy default wins.
- **Category:** drift (framework allows the wrong default), fragility (user has to repeatedly correct), missing capability (no mechanical enforcement that runtime verification ran via automation before claiming "verified")
- **Already in FRAMEWORK-STATE.md?** Memory entry `feedback_verify_promotion_use_browse.md` exists since earlier session. Memory alone hasn't worked.

## Implementation

- **Route:** normal pipeline on framework repo (touches multiple skills + a hook)
- **Files to change:**
  - `verify-promotion/SKILL.md` — strike "manual smoke at production URL" default; replace with "Playwright probe at production URL via existing e2e/specs/journeys/*.smoke.spec.ts pattern" as default; user-eyeball only allowed when (a) the AC is explicitly visual-aesthetic per `_shared/visual-rendering-ac.md`, OR (b) a mechanical Playwright run is impossible (no headless browser available, paid-only API gate, etc.) AND that impossibility is documented in the skill_receipt.
  - `land-changeset/SKILL.md` — Step 5 verification mention should chain to verify-promotion's automated probe, not "the user verifies"
  - `review-gate/SKILL.md` G7 — add Self-Verify check: "If feature is browser-visible AND no track-visuals diff AND no Playwright run in skill_receipt → FAIL. User-eyeball alone is not a G7 PASS for behavioral ACs."
  - `hooks/svc-no-user-eyeball-runtime-verification.sh` — PostToolUse hook on Stop event. Scans the assistant's last response for patterns like "open <prodURL> on your phone", "sign in as <user> and check", "manually verify", "the final eyeball is yours" — and if the active task is verify-promotion / land-changeset / review-gate, BLOCKS with: "Runtime verification cannot be delegated to user. Run a Playwright probe or document why mechanical verification is impossible."
  - Update `references/anti-patterns.md` with new entry AP-31: "user-eyeball-as-runtime-verification on behavioral ACs"

- **Cost:** Opus running a Playwright headless probe via Bash on the orchestrator side. ~60s wall-clock per verification. Effectively-free in $$ (no extra model call, just shell time). Compare to current: 0s wall-clock + lost-trust + user does the work + delayed verification cycles.

## Replay Verification

- **Replay target:** Re-run today's WI-184 verify-promotion and the mobile-header-root-pages PR #42 verify-promotion. Expected: each produces a Playwright probe output as evidence; user-eyeball is NOT in the recommended next step. If user-eyeball language appears, the new hook BLOCKS the response.
- **Result:** PENDING — waiting for the framework change to land

## FRAMEWORK-STATE.md Mutations (when implemented)

- **Analysis History:** add 2026-05-XX entry "runtime-verification user-delegation gate"
- **Known Gaps:** move `feedback_verify_promotion_use_browse` from soft-memory to enforced-via-hook
- **Decisions:** Locked decision: behavioral runtime verification ALWAYS goes through Playwright (or equivalent automation) first; user-eyeball is REVIEWED-AND-DOCUMENTED fallback only, never default

## Why this is happening despite the existing memory

Memory entries are advisory. They don't gate tool calls. Agents (especially under context pressure or response-time pressure) drift back to the lazy default. A pre-response or post-response hook that mechanically refuses agent-emitted "ask user to verify" patterns is what makes the rule actually stick. This is the same pattern as `svc-question-fatigue-guard.sh` (a PreToolUse hook on AskUserQuestion when imperative was just received) — proven enforcement model.

**Status:** DRAFT (filed 2026-05-08 by example-marketplace session; awaiting next improve-framework loop pickup)
