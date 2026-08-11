# WI-489 Execution Progress

| Task | Status | Iterations | Last result | AC verified? |
|---|---|---:|---|---|
| task-1 | done | 1 | Expected RED: 9 failed, 97 passed | yes — fixtures fail on the old runtime for the intended missing contracts |
| task-2 | done | 1 | JSON/schema/policy semantic checks passed | yes |
| task-3a | done | 8 | Full reviewer fixture replay: 137 passed, 0 failed (incl. 8 phase-to-review-kind guard fixtures) | yes |
| task-3b | done | 1 | Canonical AGY replay: 12 passed, 0 failed | yes |
| task-4 | done | 1 | Markdown 2157/0; frontmatter 2679/0; skill structure 1035/0 | yes |
| task-5 | in progress | 8 | Fable plan convergence passed 9/10; full Tier 1 passed 245/245; freezing implementation diff | deterministic ACs and plan review |

## Baseline and RED evidence

- Planning HEAD: `6e7047381b21379c6531b35de45c9c42472633ec`
- Pre-change command: `bash test-framework/evals/tier-1/validate-external-review-launcher.sh`
- Pre-change result: `97 passed, 0 failed`.
- Fixture-first command: `bash -n test-framework/evals/tier-1/validate-external-review-launcher.sh && bash test-framework/evals/tier-1/validate-external-review-launcher.sh`
- Fixture-first result: shell syntax passed; runtime replay produced the expected `9 failed, 97 passed`.
- Intended failing surfaces: registry policy, four-turn Claude envelope, safeguard routing controls, receipt v2, two-turn protocol accounting, structured turn exhaustion, same-process Fable-to-Opus route, exact cutover status, and owner select/clear lifecycle.
- Paid-provider calls: zero; both provider CLIs were fixture binaries under the test temporary directory.

## Dispatch deviation

The active resolver selected the Codex-native execution profile. The legacy dispatch helper suggested Sonnet, but the owner required medium-effort execution and the repository/developer constraints require single-agent skill editing. Execution therefore remains inline under the current Codex orchestrator, as recorded in `.svc/execute-changeset-preflight.log`.

## Checkpoints

- task-1: `59daf8858f88610c76ba723843b5a5849d0181b5`
- task-2: `50961d2c75d4f605f0b7b49230a4d3504e0fc503`
- task-3a (historical combined runtime checkpoint): `23cef987abf99186186b1e1eff1cf976802c678f`
- task-3b: included in the final frozen candidate because the owner-authorized correction preceded the plan split
- task-4: `4bbacd307b2274199d97db728f60e29714e3f933`

## Scope deviation required by landing policy

The first post-implementation full Tier-1 run improved the recorded 242/2
baseline to 243/1. Its sole failure was the already recorded proposal-triage
debt, not a launcher regression. To satisfy the reviewed manifest's explicit
zero-failure freeze gate, task 5 normalized only triage metadata in the three
already accepted WI-486/WI-487/WI-488 proposals and deferred the unrelated
extraction-generalization proposal to 2026-07-30 with its existing separate-WI
reason. No WI-486 or WI-487 implementation scope was changed.

The second post-implementation full Tier-1 run, after that lifecycle-only
metadata normalization, historically passed `244 scripts passed, 0 failed
(0 timed out)`. After the reviewer/AGY correction and session-binding refresh,
the current frozen-candidate run passed `245 scripts passed, 0 failed (0
timed out)`. Both runs were fixture-controlled and made no paid model calls.

## Reviewed-plan literal correction

The provider-fidelity command intentionally selects the `fable-high` profile.
Therefore an exact Fable completion is receipted as
`explicit_profile_primary`, not the schedule-only `exact_primary`. The command's
accepted route set was corrected to
`["explicit_profile_primary", "provider_safety_route"]`; this changes no
architecture, model, effort, fallback, or paid-call behavior.

## Runtime implementation evidence

- Canonical policy is parsed from `references/model-registry.json.externalReviewPolicy` version 3.
- Frozen fixtures prove pre-cutover Fable/high, exact-cutover Opus/high, explicit Fable selection, secure select/status/clear behavior, and resolver parity.
- One Claude process may report two protocol turns; structured `error_max_turns` is `schema_turn_budget` and never enters launcher fallback.
- A same-process Fable-to-Opus safeguard route is accepted only from the controlled Fable envelope plus exact runtime Opus usage, is marked provider-managed effort, and is never cache-reusable.
- Fable availability fallback remains a separate Opus/xhigh process only for the three accepted WI-488 availability classes.
- A paid `review_kind=plan` is refused before any provider spawn once execute-changeset has begun — proven by a durable exec-record OR by implementation files diverging from the bound pre-execution base. The lane graph/status is never trusted; only durable receipt evidence and the implementation diff are. A receipted repository-owner `retro-plan-review` override is the sole exception.
- Full targeted reviewer result after the phase-guard addition: `137 passed, 0 failed` (8 new phase-to-review-kind guard fixtures).
- Canonical AGY result: `12 passed, 0 failed`.
- Full Tier-1 candidate result: `245 scripts passed, 0 failed (0 timed out)`.

## Independent-review capability correction

The first canonical review attempt stopped before provider invocation with a
`capability` receipt because Claude Code 2.1.211 omits the supported
`--max-turns` flag from local `claude --help`. A zero-cost configured-parser
probe, `claude --max-turns 4 --version`, exited 0, and the current official CLI
reference documents the flag. The capability gate now treats help as the
inventory for advertised controls and the existing configured-argv parser as
the authority for this help-hidden flag. A fixture forces parser rejection and
proves one actionable pre-invocation hard failure. The failed attempt launched
no provider process and spent no model quota; it invalidates the first frozen
hash and requires a new freeze and independent review package.

The superseded capability-correction candidate was tree
`b22fd0f4b8433519ebf9df1c0d8f4760608b0d0c`, diff SHA-256
`32b6a4fcee065521c9f6b954de2d789db22689930c1199b46bd91067531224a0`.
Its canonical Fable/high review started exactly one process and reached the
300-second wall-clock bound with classification `timeout`, exit code 143,
no findings, no effective tuple, `fallback.used=false`, and no Opus process.
The receipt is preserved at
`.svc/external-review-artifacts/WI-489/provider-fidelity/provider-timeout-receipt.json`.
The temporary explicit profile was cleared and status returned to the schedule.
The owner explicitly rejected review-package scope reduction and authorized a
complete-package retry with a 20-minute production default. The lock-stale
default moves with it to 2,460 seconds, preserving the enforced
`2 * timeout + 60` invariant. Fixture timeout probes remain one second, and
stale-lock race fixtures use an explicit five-second test timeout with a
70-second reclaim bound so production timing cannot lengthen Tier-1.

The authorized complete-package retry ran one Fable/high process for 424.98
seconds and stopped at the separate `$5` Claude CLI dollar ceiling after two
turns. Runtime evidence records 33,325 output tokens, 192,584 cache-creation
input tokens, `$5.519469`, `terminal_reason=budget_exhausted`, and no Opus
process. The promoted candidate had labeled this structured terminal
`unknown_provider`; the execution loop now classifies it as
`budget_exhausted`, makes it ineligible for fallback, and tells the operator
that a higher dollar ceiling requires explicit authority. The preserved receipt
is `.svc/external-review-artifacts/WI-489/provider-fidelity-20m/receipt.json`.

The owner then set the production limit to `$50` per complete launcher review.
The implementation validates that value as a positive number, receipts the
configured ceiling, gives the primary the full allowance, and gives a separate
availability fallback only the trustworthy unspent remainder reported by the
primary; missing or malformed cost now fails closed before fallback. A
fixture spends `$7.25` in the primary and proves the fallback argv is capped at
`$42.75`; total review exposure therefore remains `$50`, not `$100`.

The first review under the corrected `$50` ceiling completed successfully on
frozen tree `e6394a0ca468b53723af79e8be036da3ce8f3f96`, diff
`14354250b8feb55e1ee1311192a32aa36d32a174e428913912752d0b46974655`.
It used one explicit Fable/high process, two turns, 497.18 seconds, no fallback,
and reported `$6.20431` against the `$50` ceiling. Its ten findings are preserved
under `.svc/external-review-artifacts/WI-489/provider-fidelity-50/` and
dispositioned in `docs/specs/reviews/wi-489-exec-review.md`. Fixes invalidate
that freeze; the next freeze is the active re-review candidate.
