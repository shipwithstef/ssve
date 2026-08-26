# WI-FW-SKILLS-ROUTING-01 — Implementation Correctness Audit

**Auditor:** review chain, post-exec-review round 3 (commit 4577895+)
**Scope:** Waves 1-2 core of docs/specs/plans/wi-framework-skills-routing-plan.md
**Verdict:** PASS — no CRITICAL or HIGH findings open; one HIGH dispositioned with justification (see exec review log F-EXEC-012)

## AC Evidence Matrix (plan §7 subset owned by this changeset)

| AC | Claim | Live evidence |
|---|---|---|
| AC-R1 explicit selection 100% | corpus cases explicit-canonical-name + explicit-alias pin correctly | validate-skill-router.sh PASS (13 cases) |
| AC-R2 lane/task-graph pins 100% | active skill + prerequisites pinned; next-transition pinned | corpus task-graph-active-skill-pin, lane-next-transition-pin |
| AC-R3 critical concern recall 100% | auth-surface CRITICAL surfaces review-security + rule id on `src/pages/login.tsx` | live probe: required=[review-cross-model, review-security], rules=[post-fix-evidence-before-next-fix] |
| AC-F1 zero forbidden auto-invocations | all 103 skills compile suggest-only; active mode cannot select; destructive-vocabulary case selects null | corpus zero-forbidden-* cases |
| AC-A1 ambiguity fallback | vague intent → route-workflow head with ambiguity-fallback code | corpus ambiguity-vague-intent-falls-back |
| AC-N1 negative triggers | "implement the approved design" suppresses design-tech head | corpus negative-trigger-suppresses-target |
| AC-O1 Recall@5 ≥97% provisional | 2/2 labeled discovery cases hit top-5 (100% of reviewed corpus) | validate-skill-router.sh |
| AC-B1 budgets | ≤8 cards; d1_tokens recomputed from final card list (cannot drift); D0 kernel 204 ≤1500 | budget-cut case + schema parity check |
| AC-D1 byte-stability | two compiles identical; committed artifact == recompile | validator step 1 (git diff bound) |
| AC-D2 malformed inputs fail loudly | duplicate names, unknown override target/rule ids, alias collisions, path-unsafe names, bad types, dangling concern bindings — all named failures | validator step 2 + compiler guards |
| AC-OFF1 offline + degraded | no network vocabulary (validator step 5); stale index → degraded suggestions=0 while live concern pins survive; mode off keeps pins, kills discovery | live stale-index probe + corpus mode-off case |
| AC-P1 receipt privacy | fingerprint-only; raw intent grep fails the run; evidence carries committed patterns, never caller paths | validator step 6 + F-EXEC-007 fix |
| AC-H1 normalized shape | strict key-set validation + JSON-Schema parity cross-check in tier-1 | runner first-case parity block |

## Degradation & Failure Semantics Verified

- Stale overrides registry → semantic.status=degraded, reason stale-routing-index:<drift>, optional discovery withheld, pins intact. Probe reproduced and restored.
- Malformed/unreadable REGISTRY.json → read-only diagnosis continues (loadConcernsSafe), reason recorded.
- SVC_SKILL_ROUTER_MODE unknown value → fail-closed to off with stderr diagnostic.
- Enforcement value is honest: advisory-no-mutation-gate only; validator rejects any mutation-authority claim.

## Incidental Repairs (declared T06 scope)

14 concerns referenced required_rules id paid-api-integration-checklist — a rule that was never created ("would-be rule" per rules/concern-routing.md origin). Every such critical/high pin silently could not fire. Repaired at source (concern .md frontmatter) and regenerated concerns/REGISTRY.json via scripts/build-concern-registry.mjs; concern-compiler shadow baseline recalibrated 40→48 with provenance comment.

## Residual Risks / Follow-ups

- Wave 0 baseline capture, Wave 3 semantic shadow, Wave 4 auto-invocation canary, Wave 5 mutation-gate receipts, Wave 6 host adapters remain open per plan §5.
- Recall@5 corpus is bootstrapped from reviewed labels (bounded circularity, documented in manifest Scope-Boundary Notes); Wave 0 replaces it.
