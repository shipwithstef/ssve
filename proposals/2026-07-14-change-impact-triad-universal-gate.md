# Framework Improvement — 2026-07-14 — Universal "Change Impact Triad" preflight (every mutating lane, incl. quick-fix)

**Status:** DRAFT
**ID:** FP-025
**Source:** Example Marketplace `example-marketplace` — WI-ADMIN-ACCESS-01 (admin "Access Denied" regression), session 2026-07-14

## Problem

There is **no lane-independent gate** that guarantees, for *every* change (quick or long, bug or feature), that the agent has answered the three questions a user expects before touching code:

1. **Does this break something that already works?** (regression / blast radius)
2. **How is this supposed to work?** (intended behavior, grounded in a spec/journey)
3. **Is the product affected?** (which persona / page / flow a user would notice)

Today this triad is **lane-dependent**, and the fast lane opts out of it.

### Evidence (verified this session by reading the skills)

- **`quick-fix/SKILL.md`** — Process is: "Understand the change" (read the file), "Verify" (run tests *if they already exist*), self-verify "Tests still pass (if they existed before)". No affected-artifacts audit, no intended-behavior grounding, no product-impact step, no proactive regression proof. `proposals/2026-05-12-shift-left-concern-routing.md` confirms the intent: quick-fix *explicitly overrides the delivery graph* to drop regression/UX artifacts for speed.
- **`diagnose-bug/SKILL.md`** — DOES force the triad: an **affected-artifacts list** (specs, journeys, ACs, e2e tests, rules — the "Pillar Revisit Audit"), an explicit **expected-behavior** section, smallest-safe-fix surface, a **proof-of-fix** plan, and **`verify-promotion` smoke on affected surfaces**.
- **`plan-blast-radius/SKILL.md`** — answers "what could break" but is **infra-only** (reads `terraform plan` JSON). Does not apply to app/product code.

Heavy lanes have the triad; the fast lane trades it away; there is no universal floor.

### Case study

WI-ADMIN-ACCESS-01 was a 1-line RBAC guard fix routed close to `quick-fix`. Complete assurance *was* achieved — dual cross-model review (Codex + Fable), a role-gating regression matrix, staging deploy + 23/23 staging E2E, made persistent in the journey suite — but **every layer was user-driven** across ~10 follow-up turns. The first framework-produced response was a 1-line fix + a plan, with none of the assurance. Misses: (a) under-routing — a regression belongs in `diagnose-bug`, so the affected-artifacts/expected-behavior audit never auto-fired; (b) no mandated runtime regression proof — even `diagnose-bug` audits which artifacts to *update*, not a forced "prove nothing else broke" runtime gate.

## Proposed fix

### F-001 — Universal `change-impact-triad` preflight [P0]

Mandatory preflight every mutating lane must answer before completion, quick-fix included. Three fields, each with evidence:

1. **Breaks-what?** — grep the changed identifiers → call sites / tests / journeys; run the mapped tests. Output the list + result, or an explicit "no references + why safe".
2. **Intended-behavior?** — one line "how this is supposed to work", grounded in a named spec/journey/AC; if none exists, note the gap.
3. **Product-surface?** — which persona + page/flow a user would notice, and the proof that exercises it, or "no user-visible surface + why".

Wire points: `route-workflow` Self-Verify gets one row; `quick-fix/SKILL.md` gets a required `P-ImpactTriad` phase + receipt (stays fast — three one-line answers for a genuine trivial change); `diagnose-bug`/feature lanes already subsume it (tag existing steps).

### F-002 — Auto-escalation on non-trivial answers [P0]

If any triad answer is non-trivial (real call sites/tests, ungrounded intended behavior, or a user-visible surface lacking proof), bump the change out of `quick-fix` into `diagnose-bug`/full lane. Core principle: *quick vs long must not change whether we understand the blast radius* — only how much ceremony follows.

### F-003 — Generalize blast-radius beyond infra [P1]

`plan-blast-radius` is infra-only. Broaden it (app mode: changed symbols → call sites → mapped tests/journeys) or fold that into F-001's "breaks-what?" step.

## Comparison delta

- **Before:** assurance depth ∝ lane; quick-fix skips the triad; runtime regression proof never mandated; a mis-route silently drops the audit.
- **After:** every mutating change answers the triad with evidence; non-trivial answers self-escalate; app changes get a real blast-radius step; trivial changes stay fast.

## Open questions

- "Non-trivial" thresholds for auto-escalation (call-site count? mapped tests present? user-visible route?) — short `explore-solutions` pass.
- Triad receipt as a new `.svc/` artifact vs folded into per-lane self-verify logs.

---

## Addendum (2026-07-14) — the triad is necessary but NOT sufficient

Adversarial self-review of FP-025 against what actually produced assurance on WI-ADMIN-ACCESS-01. The triad is the "ask the questions" layer; it does not guarantee the answers are true, proven, or enforced. Missing layers:

### F-004 — Independent verification, not self-attestation [P0]
The triad is answered by the same agent making the change (success-theater risk). On this WI the load-bearing catches came from a DIFFERENT model: Fable found a HIGH contradicting nightly test asserting the opposite of the fix; Codex found that the ErrorBoundary swallows render crashes (making the "no runtime error" check blind) and raised the RLS/escalation questions. Self-review missed all of them. → For any change classified non-trivial (F-006), require an independent verifier artifact (`review-cross-model` or a fresh-context adversary) before completion — not a self-checked box.

### F-005 — Behavioral/runtime proof, not just structural analysis [P0]
"Grep call sites + run mapped tests" is structural. The assurance actually trusted was deploy-to-staging + exercise the real journey for all roles. Structural analysis cannot answer "does an owner page even render for an admin with no location?" — that needed the app running. → Risky/user-visible changes need behavioral proof on the deployed surface (staging E2E on the affected journey), not only a diff analysis. Ties to the existing `verify-promotion`/green-E2E doctrine but must be mandated by the triad's product-surface field.

### F-006 — Mechanical risk-classification (triviality is not self-judged) [P0]
Line-count is a bad risk proxy: this was a 1-line change to an auth/RBAC guard with app-wide reach, and it was (mis)judged near-trivial. → A mechanical change-class list that is NEVER fast-lane regardless of size: auth/authz guards, RLS/row-security, payments/money paths, shared layout/components, DB migrations, feature flags. Fast-lane eligibility is decided by the touched surface, not the agent's confidence.

### F-007 — Coverage-creation mandate, not "note the gap" [P1]
The triad currently allows "no test exists — noted" as an exit. The real fix here was CREATING the coverage (regression matrix + journey doc). → When an affected surface has no test/journey, the mandate is to fill it (persistent, in the regular suite), not annotate its absence.

### F-008 — Hook-level enforcement, not a checklist row [P1]
Self-verify rows get skipped under pressure (see framework learnings); the completion-guard hook is what changes behavior. → Enforce the triad + (for non-trivial) the independent-verification and runtime-proof receipts via a completion-blocking hook, not an advisory self-verify line.

### F-009 — Risk-proportional tiering (affordability) [P1]
Uniform rigor (cross-model + staging deploy for every typo) causes circumvention. → Mechanical risk score → assurance tier: cosmetic = triad-lite; logic/data = triad + mapped-test run; auth/money/shared/migration = triad + independent verify + runtime proof. Proportionality is what makes the gate survivable.

### Revised through-line
"Done" should mean **independently verified and runtime-proven on the affected surface, proportional to risk** — not "the edit was made and it compiles." FP-025 without F-004..F-009 is a checklist; with them it is an assurance standard.
