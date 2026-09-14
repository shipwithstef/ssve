# Review: Codex Work Items Filed 2026-05-10 → 2026-05-12

**Reviewer:** Claude (route-workflow, opus-4-7)
**Scope:** 11 WIs filed by Codex (`archived-contributor` + author `david`) over the past 2 days — WI-305, WI-306, WI-307, WI-308, WI-309, WI-310, WI-311, WI-312, WI-313, WI-314, WI-318. Plus the SIP landed today (`feat(research): mandate Deep-Dive Research Protocol`).
**Method:** Read all 11 WI files; verified claimed scripts and validators exist; grepped for wiring into delivery graph, route-workflow, review-gate, verify-promotion, plan-changeset; checked tier-1 auto-discovery; cross-referenced against active rules in `rules/`; checked for Example Marketplace leakage and stale capability assumptions.

---

## TL;DR

Three of the eleven (WI-305, WI-306, WI-307) actually shipped concrete validators and skill edits. Seven (WI-308, WI-309, WI-310, WI-311, WI-312, WI-314, WI-318) are **proposal text dressed as WI acceptance criteria** — their ACs read as intent statements ("Add X", "Define Y") with no file paths, no validator names, no concrete schemas. Any planner that picks them up will redo the proposal→spec work that should have happened before WI promotion.

The three that shipped did so **without write-spec or plan-changeset**, despite touching hot-path skills (route-workflow, review-gate, verify-promotion) and adding +5 tier-1 validators (≈+3.7% surface). Per `rules/plan-changeset-trigger.md` this is a procedural violation; the rule names exactly this class of change.

The framework absorbed Example Marketplace-specific signal (`groq_svg_uploaded` is hardcoded into `scripts/validate-provider-fidelity-evidence.mjs:20` as a fallback-pattern regex). That is a product-specific token sitting in framework validator code.

Severity is inflated: 9 of 11 are CRITICAL or HIGH. Two days of WI promotion at this taxonomy makes "critical" mean nothing.

---

## What worked

**WI-307 (Journey/E2E contract hardening)** is the model. Picked the cheaper option (extend `diagnose-bug` with `--mode=e2e-test` instead of creating a new `debug-e2e` skill — per WI-307:46-51), shipped 3 named validators with concrete paths (`scripts/verify-journey-e2e-bridge.mjs`, `scripts/validate-e2e-selector-discipline.mjs`, `scripts/validate-journey-execution-trace.mjs`), cross-linked existing WIs (168/169/170/190/191/211/234/267/305) instead of reopening covered work, ran `node --check` to prove the scripts parse. Closeout (WI-307:43-77) names every file touched. This is the discipline the others lack.

`feature_validation_closeout` and `provider_fidelity` are properly wired into the delivery graph compiler at `scripts/compile-delivery-graph.mjs` and the closeout classifier at `scripts/classify-delivery-graph-closeout.mjs`. The plumbing is real.

The SIP landed today (research/SKILL.md:213-220 — Deep-Dive Research Protocol) is genuinely sharp: directory-sweep, tiered extraction, hash ledger, logic-signature audit. The diff is 8 lines and gives research a hard contract. Cheap and load-bearing.

---

## Findings — ranked by severity

### F-1 (CRITICAL) — Hot-path contract changes shipped without plan-changeset

**Evidence:** WI-305, WI-306, WI-307 shipped edits to `route-workflow/SKILL.md`, `review-gate/SKILL.md`, `verify-promotion/SKILL.md`, `validate-feature/SKILL.md`, `write-spec/SKILL.md`, `plan-changeset/SKILL.md`, `test-journeys/SKILL.md`, `track-visuals/SKILL.md` — 8 hot-path skills — plus 5 new tier-1 validators (`tier-1/*.sh` and `*.mjs` are auto-discovered by `run-all-evals.sh:45,66`, so they run on every commit).

There are **no plan-changeset artifacts** in `.svc/` for WI-305/306/307. The only related branches are `proposal-wi-305` and `proposal-wi-307` (proposal sources, not specs/plans). There is no `docs/specs/features/feature-validation-closeout*.md` spec, no `docs/specs/features/provider-fidelity*.md` spec.

**Rule violated:** `rules/plan-changeset-trigger.md` — risk signals 1 (contract change to hook wire protocol / skill frontmatter schema), 2 (behavior change on a hot path; `route-workflow` and `review-gate` are explicitly hot paths in the rule's spirit), 3 (cross-skill refactor).

**Why this matters:** The PR set added a single mandatory choke point (`FEATURE_VALIDATION_LEDGER.md`) that gates review-gate AND verify-promotion. If the template format drifts, every user-facing feature blocks. There was no review-plan, no review-cross-model, no audit-implementation. The work might be right; the absence of ceremony is the issue.

**Fix:** Retro write-spec for the closeout-ledger and provider-fidelity contracts under `docs/specs/features/`, and run `review-gate` G3 + `audit-implementation` on the merged code before the next dependent WI builds on it. Going forward, framework changes that edit 4+ hot-path SKILL.md files MUST route through plan-changeset.

---

### F-2 (CRITICAL) — Example Marketplace-specific signal leaked into framework validator code

**Evidence:** `scripts/validate-provider-fidelity-evidence.mjs:20`

```js
const FALLBACK_SOURCE_RE = /\b(fallback|mock|placeholder|stub|fixture|sample|dummy|unknown|draft-only|included_provider|groq_svg_uploaded|svg_uploaded|manual_upload)\b/i;
```

`groq_svg_uploaded` is a Example Marketplace WI-233 specific evidence token. It does not belong in a framework-level regex that runs on every project's commit. A different svc consumer with a Groq integration and a legitimate `groq_svg_uploaded` field will hit this regex and fail closeout for no reason.

**Why this matters:** This is the second instance in 2 days of the framework absorbing product-specific tokens (WI-308 is also Base44/Example Marketplace-coloured — see F-9). The framework is meant to be host-agnostic per `CLAUDE.md` ("This repo IS the framework, not a project built with it").

**Fix:** Move the Example Marketplace-specific tokens into Example Marketplace's project-local `.svc/concerns/` or `docs/specs/forbidden-fallback-signals.json` and have the framework validator read project-local config. The framework regex should only catch generic terms (`fallback|mock|placeholder|stub|fixture|sample|dummy|unknown|draft-only`).

---

### F-3 (HIGH) — "WIs as Proposal-Lite" anti-pattern across 7 of 11 items

**Evidence:** WI-308, WI-309, WI-310, WI-311, WI-312, WI-314, WI-318 all share the same shape:

- ACs read as "Add X" / "Define Y" / "Require Z" with no file paths.
- No named validator the planner can grep for.
- No concrete schema for new artifacts (System Contract Map, deprecated-foundations registry, BLOCKING_DISCOVERY semantics).
- Source is `proposals/2026-04-XX-*.md` with `Status: backlog` — i.e., the proposal text was copy-pasted into AC bullets.

WI-318:21-27 is the worst case — 5 ACs, all "Decide…", "Define…", "Replace the proposal's blocked status with accepted WI ownership." That last AC literally describes the act of filing the WI as its own acceptance criterion.

**Why this matters:** This delegates the proposal→spec compression to whichever planner picks up the WI next. The compression cost is paid twice: once by Codex when filing the WI (zero leverage), once by the planner (with stale context). Compare WI-307's closeout (lines 43-77) which names every script and validator vs. WI-310's 6 ACs that produce no implementation contract.

**Fix:** Before promoting a proposal to WI, `write-spec` (or at minimum `validate-feature` for framework-class enabler work) should produce a thin spec naming the files to touch and the validators to add. A WI without a concrete artifact contract is a parking lot, not a WI.

---

### F-4 (HIGH) — Severity inflation devalues the taxonomy

**Evidence:** Of 11 WIs filed in 2 days: 3 CRITICAL, 7 HIGH, 1 MEDIUM. The framework's own `rules/github-projects.md` defines CRITICAL = "blocking issue, requires immediate attention." None of these 11 are blocking shipped behavior. WI-311 is filed as chore-class with severity HIGH (lines 4-5) — a contradiction the file does not resolve.

**Why this matters:** `concerns/REGISTRY.json` severity routing depends on the taxonomy meaning something. If every WI is critical/high, route-workflow and review-gate can't prioritize. Compare to `rules/distribution-vs-launch-blocker.md` which has hard taxonomy carve-outs.

**Fix:** Re-rate. WI-305/306 are HIGH (architectural debt, not blocking). WI-307 is HIGH (closes a known gap). WI-308 is MEDIUM (Example Marketplace-specific). WI-311/312 are MEDIUM (housekeeping). WI-313/318 are MEDIUM. WI-309/314 are HIGH (real cross-cutting gaps but no implementation contract yet — see F-3). Only WI-310 could legitimately be HIGH if it actually shipped.

---

### F-5 (HIGH) — Single mandatory ledger as central choke point with no severity grading

**Evidence:** WI-305 mandates `FEATURE_VALIDATION_LEDGER.md` AC-by-AC for every user-facing feature with persona, journey/scenario, runtime, E2E/manual, evidence path, final result. Enforcement at review-gate AND verify-promotion (WI-305:31-32). The only escape hatch is "explicit non-user-facing rationale."

**Why this matters:** Cross-checked against `rules/distribution-vs-launch-blocker.md` and `rules/concern-routing.md`: this is exactly the pattern that breeds rationale-string waivers. Brownfield-feature lane, bugfix lane, and trivial UX fixes all hit the same gate. The launch-blocker carve-out from `rules/distribution-vs-launch-blocker.md` (class 🟩) has no equivalent here. The result will be 5-line "non-user-facing rationale" strings on every PR.

**Fix:** Severity-grade the ledger. Hard-required for: new feature surfaces with new data models, new auth flows, payment flows, AI-generation flows. Auto-derived (from existing audit-ac / write-journeys / track-visuals outputs) for: bugfix lane, brownfield-feature on existing surfaces, UI polish on shipped behavior. Explicit per-WI opt-in flag (`ledger_required: true|false|auto`).

---

### F-6 (HIGH) — No `concerns/` wiring for the new evidence families

**Evidence:** `feature_validation_closeout` and `provider_fidelity` are new subject-matter lenses. Per `rules/concern-routing.md` (the user's own private global rule), every cross-cutting subject-matter should have a `concerns/<name>.md` declaring signals + required_skills so route-workflow can fire it at intent-time. There are 100+ concerns in `concerns/` — but no `concerns/feature_validation.md`, no `concerns/provider_fidelity.md`.

**Why this matters:** The gates fire only at G3 (review-gate) and G7 (verify-promotion) — post-implementation. That's the worst time to discover an evidence family is missing. `rules/concern-routing.md` § "When concerns gate the workflow" lists 4 trigger points, of which session-start + pre-WI-dispatch are the cheap ones. Codex skipped both.

**Fix:** Add `concerns/feature-validation-closeout.md` and `concerns/provider-fidelity.md` with signal patterns (file path globs for feature spec files, diff keywords for AI image / Groq / fal.ai / replicate, risk flags from delivery-graph compiler) and `required_skills: [validate-feature, write-spec, ...]`. Surface in route-workflow at the front, not just review-gate at the back.

---

### F-7 (MEDIUM) — WI-310 references obsolete Kimi transport

**Evidence:** WI-310:21 lists "detached Kimi execution" as related infrastructure (WI-125). Per `CLAUDE.md` § "svc-default Profile," `[EXEC]` is MiMo + MiMo-V2.5 since the profile shift. Kimi is one of the available profiles, not the default. WI-310:25 says "Document transport selection across subagents, detached Kimi, and local execution" — omits MiMo entirely.

**Why this matters:** Anyone implementing WI-310 will design for Kimi transport when the production default is MiMo. Stale capability assumption per `rules/host-capability-research.md`.

**Fix:** Rewrite WI-310 ACs to name MiMo (EXEC), Claude (PLAN/STRAT/REVIEW/PASS), and detached background tasks as the three transport classes. Reference `scripts/resolve-model.sh` as the routing oracle, not Kimi.

---

### F-8 (MEDIUM) — WI-309 duplicates an active rule

**Evidence:** WI-309:26 — "Add iteration caps that escalate a WI after repeated failed attempts on the same hypothesis." The user's active `rules/post-fix-evidence-before-next-fix.md` already escalates at PR≥2 on the same symptom and mandates `diagnose-bug` Phase 0 at PR≥3.

**Why this matters:** WI-309 will either re-implement the same mechanism with a different name (drift), or wrap the existing rule (no net change). The "System Contract Map artifact" IS new and useful — but it gets buried under duplicated escalation logic.

**Fix:** Rewrite WI-309 with two ACs: (a) System Contract Map artifact + schema + storage location, (b) cross-system falsification probes called by `diagnose-bug --mode=cross-system`. Drop the iteration-cap AC — it's already a rule.

---

### F-9 (MEDIUM) — WI-308 belongs in Example Marketplace, not framework

**Evidence:** WI-308 "Base44 data, persistence, and RLS verification pack" — every AC is Base44-specific (entity RLS, derived ownership patterns like denormalized owner / secureOperation / function gateway). The source proposals (lines 19-23) are all Example Marketplace-driven. Base44 is one customer product; the framework has `base44-environment` and `base44-sdk` skills but those are explicitly platform integration skills, not framework-level concerns.

**Why this matters:** Adding Base44 RLS validators to `test-framework/evals/tier-1/` runs them against every svc project — most don't use Base44. The framework drifts toward Base44-isms.

**Fix:** Move WI-308 to Example Marketplace's `.svc/concerns/` as project-local. The framework-level lift is `audit-entity-rls` as a generic skill with provider plugins (Base44, Supabase RLS, Firestore rules, Postgres RLS). Different RLS models, different probes; the framework should not assume Base44 semantics.

---

### F-10 (MEDIUM) — WI-306 demands LLM-only criteria but ships only a regex validator

**Evidence:** WI-306:28 — "Track-visuals review mode checks generated image source, semantic relevance, saved-state visibility, and product quality." The shipped `scripts/validate-provider-fidelity-evidence.mjs` is a regex check over evidence files — it cannot validate semantic relevance or product quality.

**Why this matters:** The gate is half-shipped. Reviewers will see "provider_fidelity: required" in the delivery graph and tick the box because the mjs validator passes — but the semantic check the WI claims never runs. False-confidence pattern.

**Fix:** Either downgrade the AC text to what the validator actually checks (provider/source token presence, fallback policy match, saved-state file existence) — or wire `track-visuals` review mode through an LLM judge in tier 1.5+ and budget the cost. Pick one.

---

### F-11 (MEDIUM) — Tier-1 surface grew +3.7% in 2 days with no budget discipline

**Evidence:** Tier-1 was 139 validators on 2026-05-10 morning. After the Codex burst, it's **144** (`ls test-framework/evals/tier-1/ | wc -l`). 5 new validators added in 2 days. Auto-discovery (run-all-evals.sh:45,66) means they all run on every commit. There is no per-validator runtime budget published; `VALIDATOR_TIMEOUT_SEC=180` is the only ceiling.

**Why this matters:** Tier-1 is the framework's hot path — every developer pays its cost on every commit. The framework has no rule for "before adding a tier-1 validator, prove the failure mode it catches happens ≥3 times in real sessions." `rules/learning-preload.md` has the 3-strike rule for elevating learnings → rules; the same discipline is missing for tier-1.

**Fix:** Propose a `rules/tier-1-promotion.md` rule: validator earns its tier-1 slot when (a) the failure it catches has been observed ≥2 times in the past 60 days OR (b) the failure class is documented in `references/anti-patterns.md`. Otherwise the validator lives in tier-2 (LLM-judged, EVALS=1) until it earns promotion.

---

### F-12 (MEDIUM) — WI-314 conflates two distinct concerns

**Evidence:** WI-314 ACs cover capability-blocker auto-diagnosis (ACs 1-2) AND deprecated-foundations registry (ACs 3-4). These are orthogonal failure modes. Capability blocker = "the tool I need doesn't exist yet." Deprecated foundation = "the code I'm extending is the wrong base." Different diagnoses, different fixes.

**Fix:** Split into WI-314a (capability-blocker auto-diagnosis, hooks into `capability-registry` + `capability-concierge`) and WI-314b (deprecated-foundations registry + `inertia-detection` for plan-changeset).

---

### F-13 (LOW) — WI-318 should remain a proposal until scope is defined

**Evidence:** WI-318 ACs are all "Define…" / "Decide…" / "Replace the proposal's blocked status with accepted WI ownership." The proposal itself (2026-04-14-blocking-discovery-halt-protocol.md) is explicitly noted as blocked for scope decisions (WI-318:31).

**Why this matters:** Filing a WI before scope is locked just moves the scope conversation from `proposals/` to `docs/specs/work-items/` — no net progress, and now the WI shows up in route-workflow's actionable backlog (per `list-work-items`) when it's not actionable.

**Fix:** Revert WI-318 to proposal status. File the WI after a `discuss-phase` artifact locks the scope.

---

### F-14 (LOW) — Replay-fixture claims partially unverified

**Evidence:** WI-305:33 and WI-306:31 both claim "Add a WI-233-style replay fixture." The only WI-233 artifact in the repo is `.svc/archive/lane-tasks/lane-tasks-WI-233.completed-pending.json` (a Example Marketplace lane-tasks stub). The compiler validators reference internal fixtures (`scripts/compile-delivery-graph.mjs` test count = 55 — implies fixtures exist embedded in the validator's test mode), but a standalone reusable fixture per WI is not visible.

**Fix:** If the fixtures live inline in validator scripts, name them in the WI closeout section so future audits don't have to grep. If standalone fixtures were intended but not landed, add them as a child WI.

---

## What I'd do this week

If the goal is to land the next 5 WIs cleanly:

1. **Retro write-spec + plan-changeset for WI-305/306/307 contracts** so the new evidence families have a baselined spec the next WIs can build on. ~2 hours.
2. **Strip `groq_svg_uploaded` out of `scripts/validate-provider-fidelity-evidence.mjs`** and move it to a project-local config file (Example Marketplace's `.svc/concerns/forbidden-fallback-signals.json`). ~30 min.
3. **Re-grade severities** on the 11 WIs against `rules/github-projects.md` definitions. ~30 min.
4. **Add `concerns/feature-validation-closeout.md` and `concerns/provider-fidelity.md`** so the new families fire at intent-time, not just at G3. ~1 hour.
5. **Rewrite WI-309 / WI-310 / WI-314 / WI-318** with concrete artifact contracts (file paths, schemas, named validators), OR revert WI-318 to proposal. ~2 hours.
6. **Add `rules/tier-1-promotion.md`** to gate new tier-1 validators by failure-frequency before they get auto-discovered. ~30 min.

The single highest-leverage move is #1 — without a baselined spec for the closeout-ledger and provider-fidelity contracts, every WI that depends on them (and several of the 11 already do) will redo the work.

---

## What was unambiguously good

- WI-307 closeout discipline — name every file, run `node --check`, cross-link existing WIs. This is the model.
- Delivery-graph compiler integration of new evidence families — clean plumbing in `scripts/compile-delivery-graph.mjs` and `scripts/classify-delivery-graph-closeout.mjs`.
- Today's SIP for Deep-Dive Research Protocol — 8-line diff in `research/SKILL.md:213-220` that adds a hard contract (sweep + tiered extraction + hash ledger). Cheap, load-bearing.
- The framework now actively distinguishes "success theater" from real validation. That is a real upgrade even if the rollout was procedurally sloppy.
