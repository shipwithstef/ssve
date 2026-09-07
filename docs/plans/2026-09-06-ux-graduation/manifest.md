# Graduate evidence-grounded UX improvement proposals
WI: WI-FW-UX-GRADUATION-01
Status: DRAFTED
Base SHA: c790b42c29821bc0ba106e5a851aa42e495fc7d4
Branch: feature-WI-FW-UX-GRADUATION-01
Lane: framework; inline execution by the current Codex session.

## Problem and intended behavior
The preserved draft supplies a useful bridge from a founder's complaint about an existing UI region to a concrete improvement proposal, but is unregistered, uses retired routing, and can force a redesign without sufficient evidence. Graduate that capability as one terminal, on-demand skill. Preserve current specs, actual behavior, persona fit, alternatives, uncertainty and meaningful innovation without adding a mandatory step to every feature task.

This is Stage B of the approved clean-main roadmap. Stage A source is merged as PR38 at the base above. Stage C retains live installation, original checkout convergence and cleanup. The additional exact cleanup target is /home/dianast/app-workspaces/seriousvibecoding/.worktrees/feature-WI-FW-UX-GRADUATION-01, subject to the same ownership, archival, unmerged-content and installation-reference checks as the four existing targets. No other worktree is added to cleanup scope.

## Design and applicability
Use the existing skill package, registry, compiler, terminal-skill contract, runtime artifact mapping and focused selector. No new framework layer, hook, provider, generic UX scoring service or automatic paid evaluation loop. This is a source content/registry extension, with no production runtime concurrency or external-state writer. Installer implementation and host policy remain unchanged.

The skill starts from a concrete region and desired outcome. Load only relevant current spec/AC, persona/job, actual code and rendered evidence; follow dependencies that can change the recommendation. Separate observed fact from inferred friction. A screenshot alone cannot prove redundant behavior. Expose spec/code conflicts and ask only unresolved consequential decisions. Use relevant heuristics as explanations, not compulsory rubric recitation. Nielsen recognition is heuristic6 and minimalist design8; verified source: https://www.nngroup.com/articles/ten-usability-heuristics/ (2026-09-06).

Output has three legitimate outcomes: propose-change, retain-current, or evidence-needed. Preserve a retain-current alternative when considering change; add another credible approach only when it changes a consequential tradeoff. No fixed question count, minimum finding count, mandatory three alternatives, or mandatory mock when the recommendation is retain-current/evidence-needed. For a visual change, provide before-state evidence and a clearly labelled illustrative after artifact; never call a mock deployed or tested. Current product authorization controls whether accepted proposals continue through route-workflow. Proposal completion itself does not deploy anything.

Keep the operational body concise (target under200 lines). Description is trigger-focused; existing compiler derives cards/summaries from source. Register one skill in includedSkills and README; keep corePackForRouting and bootstrap unchanged because this is on-demand. Assign the skill to exactly one appropriate family in references/context-loading-registry.json and retain an explicit Before Starting section. Update current104 count references to105 in AGENTS.md, CLAUDE.md and FRAMEWORK-STATE.md, not historical documents. Regenerate README.md and EXTERNAL_ADDONS.md through node scripts/generate-manifest-mirrors.mjs --write; the latter generated block follows includedSkills even though corePackForRouting remains unchanged. Add an intent-routing entry and a conditional artifact mapping to route-workflow for accepted proposals. The existing runtime integration must retain terminal behavior and user-authorized continuation.

## Acceptance criteria
- AC1: The source/registry/installer census has exactly105 unique first-party skills; no duplicate or unregistered draft; compiled routing is fresh and terminal applicability is explicit across shared hosts.
- AC2: The skill requires relevant current spec and actual implementation evidence, distinguishes inference, follows meaningful dependencies and exposes conflicts. No generic recommendation substitutes for the project's actual UX.
- AC3: Three fixtures exercise positive improvement, justified retention and insufficient evidence. A useful status card must not be removed merely because a launcher icon looks repetitive. Missing live evidence is disclosed, not invented; a hypothesis is not a verified outcome.
- AC4: Only consequential unanswered decisions prompt questions. Keep persona/job, impact, alternatives, risk, reversibility, success signal and falsification in proportion to the task. No compulsory numerical ceremony.
- AC5: Existing focused test mapping includes the new fixture/skill; unknown/global full fallback and unmapped-surface semantics remain unchanged. Full offline release validation and actual Sol/Cursor review remain required.
- AC6: Preserve the original UX proposal/draft/graph bytes and branch history. Update proposal status truthfully; the old graph describes draft-only completion and remains archived, not imported as fabricated full execution. No HoursHub or other product files change. Stage C performs all-host installation before original draft removal.

## Files Planned
| Task | Action | Path |
|---|---|---|
| T1 | CREATE | skills/propose-ux-improvements/SKILL.md |
| T1 | MODIFY | skills-manifest.json |
| T1 | MODIFY | README.md |
| T1 | MODIFY | EXTERNAL_ADDONS.md |
| T1 | MODIFY | CLAUDE.md |
| T1 | MODIFY | AGENTS.md |
| T1 | MODIFY | FRAMEWORK-STATE.md |
| T1 | MODIFY | references/skill-routing-index.json |
| T1 | MODIFY | references/context-loading-registry.json |
| T2 | MODIFY | skills/route-workflow/references/intent-routing.md |
| T2 | MODIFY | references/skill-runtime-contracts-v2.json |
| T2 | MODIFY | scripts/select-tier1-validators-v2.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-skill-judgment.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-tier1-selector-v2.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-skill-coverage.sh |
| T2 | CREATE | test-framework/evals/tier-1/validate-ux-graduation.mjs |
| T2 | CREATE | test-framework/evals/fixtures/ux-graduation.json |
| T3 | CREATE | proposals/2026-08-26-framework-improvement-ux-improve-mode-skills.md |
| T3 | CREATE | docs/specs/work-items/WI-FW-UX-GRADUATION-01.md |
| T3 | MODIFY | docs/specs/work-items/INDEX.md |
| T3 | CREATE | docs/specs/audit/ux-graduation.md |
| T3 | MODIFY | docs/plans/2026-09-06-clean-main-followup/roadmap.md |
| T3 | CREATE | docs/plans/2026-09-06-ux-graduation/manifest.md |
| T3 | CREATE | docs/plans/2026-09-06-ux-graduation/plan-contract.json |
| T3 | CREATE | docs/plans/2026-09-06-ux-graduation/review-log.json |

## Task Graph
| Task | Work | Dependencies |
|---|---|---|
| T1 | Skill source and canonical registration | plan review |
| T2 | Routing and three evidence scenarios | T1 |
| T3 | Preserved draft disposition, audit, freeze and source landing | T2 |

## Execution and proof
T1: Author the graduated skill from the preserved draft; register it and regenerate the source-derived index. Use existing frontmatter/terminal/applicability conventions. Before edits, verify original commit bdbe4b7b3ce08dec81bcfd8832ce02b96a5dfa47 and the actual original checkout bytes: skill SHA256 db61244d40d2cfa272f1ba3a345a15dcc8c4099803a4e9653a83fce6dcc85bb5; proposal SHA256 2bc3e1ee29b4f691fb1e59bbed62b1c4e86e799f8da8d6584fa0a205b67cbe77; historical graph SHA256 9d55d77a333de4f86db06504cda54ff8979d02cd2e96f55e6c809ba67465d4bf. Use existing putObject/getObject helpers to archive and read back all three; record original paths, modes, hashes, commit/ref and object identities in .svc/clean-main-review/stage-b/original-ux-inventory.json. Archive that inventory itself outside cleanup targets before StageC removes any original path or ref. If bytes differ, preserve both and reconcile the owner change rather than silently accepting a different original. Do not modify originals.
T2: Replace validate-skill-judgment.mjs hardcoded 104 assertion with an independent source-directory versus manifest census and uniqueness check, preserving all existing unmapped-surface and unknown/global fallback assertions unchanged. Do not replace it with a tautology comparing a manifest-derived value to itself. Connect intent and accepted-proposal consumers. Add three isolated feature/UX scenario fixtures with concrete spec, code and observation inputs. Tests validate registration, terminal routing, fixture completeness and focused selection; they must not claim to prove LLM judgment merely by grepping the skill. Fixture oracles: proven equivalent controls with redundant action and no distinct information -> propose-change (forbid claiming fewer controls alone proves better UX); distinct launcher/status roles required by spec and task -> retain-current (forbid deleting the status information as duplication); absent rendered evidence -> evidence-needed (forbid a fabricated screenshot, mock-as-observation, or verified improvement claim). Sol's actual review also walks the three fixtures and records decisions with evidence before independent final review.
T3: Reconcile proposal and WI status, document StageB audit and update BOTH the opening roadmap allowlist and section 4 step 6 to the same five exact paths, replacing stale four-worktree counts with a reference to that exact allowlist. The paths are bugfix-WI-FW-SESSION-RECOVERY-01, refactor-WI-FW-SKILL-JUDGMENT-01, refactor-WI-FW-CLEAN-MAIN-FOLLOWUP-01, wi-fw-ux-improve-mode-01 and feature-WI-FW-UX-GRADUATION-01 beneath this repository .worktrees/. Preserve all refuse-if-unresolved deletion checks, preserve original objects, and freeze source before release evaluation. Record phase evidence with correct kinds and actual timestamps before completion. Keep tree-bound canonical receipts outside the tracked graph; historical phase pointers are not current release authority.

Run node scripts/lint-skills-manifest.mjs; node scripts/skill-router.mjs compile then validate; node --test test-framework/evals/tier-1/validate-ux-graduation.mjs; existing runtime-contract, validate-skill-before-starting.sh and terminal/skill-structure validators; mapped focused selector tests; full EVALS=0 corpus before source commit. Run meaningful post-commit checks and verify remote squash-tree equality. All-host materialization/drift is StageC, not a product deploy claim.

Plan review is self + native Sol High advisory + exact Cursor CLI cursor-grok-4.6-high independent. Use the existing task-local valid policy copied from StageA, excluding Claude/standalone Grok; unknown quota remains unknown. Review actual frozen changes normally. Changed metadata needs truthful evidence binding, not repeated holistic code reviews.

## Risks and rollback
A new skill can add catalog overhead or overlap explore-ux. Mitigate with narrow trigger, concise source, terminal routing and no default lane insertion. A fixture can overfit a recommendation; distinguish deterministic contract checks from actual reviewer judgment and include retention/missing-evidence cases. Revert only this reviewed source commit if needed; original draft bytes and refs remain retained. No live installation or original-checkout cleanup occurs in StageB.

## Self-review
The design completes the useful unfinished UX work while keeping StageA recovery behavior. The alternatives were extending explore-ux versus graduating the existing terminal bridge. Graduation preserves the scoped founder-steer entry point without imposing a competitor-knowledge prerequisite or new mandatory stage. No new security program, hooks or dashboards are introduced. Final goal completion still requires StageC and all original clean-main acceptance checks.

## Prerequisite Alignment Matrix
| Requirement | Evidence and applicability |
|---|---|
| Founder intent | Existing approved StageB UX graduation, dedicated Codex first and shared harness behavior. |
| Product/spec/UX | Existing preserved draft plus proposed three scenario spec/code/evidence fixtures; no live product mutation. |
| Technical architecture | Existing source registry/compiler and terminal runtime artifact contracts; no new host layer. |
| Style and evidence | Existing skill frontmatter, concise operational Markdown, Node test runner and actual phase records. |

## Execution Command Sequence
```bash
node scripts/validate-plan-contract.mjs docs/plans/2026-09-06-ux-graduation/plan-contract.json --phase plan
bash scripts/verify-plan-mechanical.sh docs/plans/2026-09-06-ux-graduation/manifest.md --phase plan
```
After plan review, execute the manifest, then:
```bash
node scripts/generate-manifest-mirrors.mjs --write
node scripts/skill-router.mjs compile
node scripts/skill-router.mjs validate
node scripts/lint-skills-manifest.mjs
node --test test-framework/evals/tier-1/validate-ux-graduation.mjs
node test-framework/evals/tier-1/validate-skill-judgment.mjs
node scripts/validate-plan-contract.mjs docs/plans/2026-09-06-ux-graduation/plan-contract.json --phase execution
EVALS=0 bash test-framework/evals/run-all-evals.sh
```
Each command expects exit0. No implementation command is run to satisfy plan-phase existence checks.

## External State
| Surface | Stage B action | Coupling and evidence |
|---|---|---|
| GitHub branch, PR and receipt notes | Reviewed source promotion after execution gates | Existing land-changeset, merge-pr-with-review-receipt.mjs and exact remote SHA/tree/receipt verification; failed promotion remains incomplete. |
| Cursor subscription | One governed plan review and later frozen changeset review, bounded correction rounds | run-external-review.mjs task policy, classification and raw route receipts; no unavailable fallback. |
| Original dirty UX files and refs | Read and preserve only | Existing putObject/getObject archive/readback and original-ux-inventory.json; original mutation deferred to Stage C. |
| Nine installed hosts | No live mutation in Stage B | Stage C roadmap requires durable source cutover, setup --all-hosts and check-install-drift.sh --all-hosts before cleanup. |

Untouched environments (walked the taxonomy, found nothing): product databases, migrations, object storage, queues, caches, DNS, certificates, production services, staging services, package registries, schedulers, webhooks, feature flags, credentials, billing configuration and host configuration. This statement is scoped to planned Stage B writes, not an assertion about existing external state.

## Execution-discovered corrections

The first full offline run reported 361 pass / 6 fail / 0 timeout. Four failures
were closed within owned source/docs or by staging the durable task graph. Two
additional test consumers are now explicitly owned by T2: the selector closure
expectation must include the new validator, and the skill-coverage absence probe
must use an isolated commit without notes instead of assuming real HEAD has no
coverage. Main now legitimately has coverage after Stage A promotion. Preserve
production receipt logic and all negative coverage assertions; change only the
fixture setup. Sol and the final independent execution review must inspect these
small corrections. The original pre-execution reviewed manifest SHA256 remains
947c786ddb9d672883cd7dcd0e55f5daebbca559de94eb865cc9a5e56d53cb0c
in immutable storage and the original launcher package. This amendment is not
backdated or presented as a fresh pre-execution review. No feature scope is added.
