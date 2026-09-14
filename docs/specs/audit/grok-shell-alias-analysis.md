# WI-GROK-SHELL-ALIAS-01 — Implementation Audit

**Mode:** FULL (`external_state_writer`, `cross_runtime_integration`)
**Verdict:** READY TO LAND WITH POST-LAND GROK VERIFICATION
**Audited implementation:** `35c9a07bfa0b4a8cc70bdd672e5690b241d751a5...49a2d8dd32ae94da1e7847c71711641955d59ffc`

## Scope and evidence ledger

| Surface | Evidence | Result |
|---|---|---|
| Shared alias contract | `hooks/lib/shell-tools.mjs`; classifier fixture in `validate-codex-execution-integrity.sh` | PASS — exactly five required names; unknown name rejected |
| Bootstrap and loader predicates | `hooks/codex/svc-codex-skill-load-enforcer.mjs`; execution-integrity 188/0 | PASS — zero-state alias hatch, exact/compound loader deny, owned non-loader bypass |
| Authority and isolation | operation-scope validator; explicit ffmpeg isolation denial fixture | PASS — bypass occurs only after operation scope and owned active task; isolation remains independent |
| Live consolidated-dispatch children | authenticity 10/0; phase autoemit 12/0; impact-triad 58/0; stale-session Grok exit-2 probe | PASS — all Bash-shaped child predicates consume the shared helper |
| Grok hook wiring | Grok TOML round-trip 27/0; cross-host hook conformance 67/0 | PASS — only the two requested matcher rows gain the native name; existing isolation row remains present |
| Install topology | `readlink -f` of Grok and Claude-compat enforcer paths | PASS — both resolve to the same canonical installed tree; Grok-only setup converges the effective child |
| Example Marketplace exclusion | pre-fix hook-only replay and complete checkout status capture | PASS — no command executed and no Example Marketplace file changed |

Concern scan reported no registered concern matches. The earlier broad scan's `pricing-tier-touch` hit came only from plan/review prose and was a false positive: the diff contains no pricing, entitlement, billing, or product-tier behavior.

## Hypotheses tested

| Hypothesis | Falsifier | Evidence | Decision |
|---|---|---|---|
| An alias can still bypass a Bash-shaped predicate | Any named or live-dispatch consumer retains literal-Bash routing | Source scan plus round-one Grok findings/fixes | REJECTED |
| The Grok receipt bypass weakens WI ownership | A non-bootstrap mutation without an owned task returns allow | Negative-control and isolation fixtures | REJECTED |
| A loader mention can enter the Grok bypass | Exact or compound loader-shaped command returns allow | Both variants return structured deny | REJECTED |
| Grok-only setup misses the inherited Claude-compatible path | Grok and Claude paths resolve to different installed files | Both resolve to `/home/user/app-workspaces/seriousvibecoding-installed/...` | REJECTED |
| Test coverage can silently skip Grok stale-session enforcement | Hermetic Grok probe does not run when live state is stale | Validator now runs all probes before returning the live freshness failure | REJECTED |

## Requirement coverage

| Requirement | Implementation | Behavioral proof | Status |
|---|---|---|---|
| R1 one five-name helper | `hooks/lib/shell-tools.mjs` | exact-set assertion | PASS |
| R2 use helper in owner-named consumers | imports in all requested modules | syntax plus focused execution suite | PASS |
| R3 Grok non-loader skips only Codex receipt after ownership | ordered branch in skill-load enforcer | owned ffmpeg allow; no-task mutation deny; loader deny | PASS |
| R4 update two Grok matcher rows | `scripts/wire-grok-hooks.mjs` | exact count and round-trip idempotence | PASS |
| R5 run Grok-only setup | deferred until landed canonical source | deterministic command and rollback sequence in manifest | READY POST-LAND |
| R6 prove Example Marketplace bootstrap hatch and next gate | installed hook replay with full status before/after | pre-fix denial captured; post-fix replay specified | READY POST-LAND |

## Code-path coverage

- ★★★ Alias classification: all five positives plus one negative.
- ★★★ Bootstrap/loader routing: zero-state allow, owned mutation, unowned mutation, exact loader, compound loader.
- ★★★ Dispatcher children: protected artifact deny, stale-contract deny, phase command classification, commit-boundary deny.
- ★★★ Wiring: first install, repeat idempotence, failure rollback, matcher cardinality, other-host non-regression.
- ★★ External install: transactional behavior is already covered; this WI still requires the landed-source Grok convergence and live path replay.

## Findings

No unresolved Critical or High correctness finding remains.

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| A-001 | Info | The repository's live session contract is older than four hours, so the complete session-contract validator returns failure after its hermetic probes. | Pre-existing repository state, not an implementation defect. All five hermetic probes run and pass, including Grok `run_terminal_command` exit 2. |
| A-002 | Info | Installed-host and Example Marketplace acceptance proof cannot be final before the branch lands. | Required G7 action; setup remains post-land only to avoid installing unlanded source. |

## Convergence judgment

The implementation matches the owner requirements and preserves the safety boundaries around operation scope, isolation, WI ownership, authenticity, session freshness, and impact review. G5's valid findings were patched. Its residual high was rejected with direct filesystem topology evidence and without expanding mutation to the Claude host. Land is safe provided verify-promotion runs the exact Grok-only setup and installed-hook replay from the landed canonical source.

## Self-verify

| # | Check | Result |
|---|---|---|
| 1 | Every changed executable surface has an owner and validation path | PASS |
| 2 | All owner requirements map to implementation and evidence | PASS |
| 3 | No unresolved Critical/High finding | PASS |
| 4 | External mutation is deferred to post-land and rollback-aware | PASS |
| 5 | Example Marketplace media/video files remain outside the mutation scope | PASS |
