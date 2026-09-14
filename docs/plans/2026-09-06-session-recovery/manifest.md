# Changeset: WI-FW-SESSION-RECOVERY-01

Status: SIMULATED
Spec: docs/specs/bugfix/session-recovery-brief.md
Branch: bugfix-WI-FW-SESSION-RECOVERY-01
Base SHA: f9ec209e14347aad800ba3039b2b12ca90ab9049
Execution mode: inline
Archetype: incremental extension of existing recovery and review paths.

## Implementation Summary
Reuse exact complete session authority for registered worktree resume; generate valid task reviewer policy; classify provider terminal failures; avoid repeated unavailable account-pool launches. Preserve public CLI compatibility and existing Cursor transport. The current policy forbids every Cursor independent station: add explicit owner station identity_requirement=requested_accepted for exact cursor-grok-4.6-high/family=xai only; default and Auto remain ineligible. Receipt validation must check the chosen requirement and reject observed model mismatches. Pre-change plan review uses the current advisory Cursor path; after implementation the explicit owner contract and final review prove release eligibility, never relabel the pre-change receipt.

## Files Planned
| Task | Change | File |
|---|---|---|
| T1 | MODIFY | scripts/svc-ensure-worktree.mjs |
| T1 | MODIFY | test-framework/evals/tier-1/validate-literal-branch-worktree.sh |
| T2 | MODIFY | scripts/review-topology-v2.mjs |
| T2 | CREATE | scripts/lib/reviewer-resources.mjs |
| T2 | MODIFY | schemas/reviewer-policy-v2.schema.json |
| T3 | MODIFY | scripts/run-external-review.mjs |
| T3 | CREATE | test-framework/tests/session-recovery.test.mjs |
| T4 | MODIFY | FRAMEWORK-STATE.md |
| T4 | MODIFY | references/advisor/framework-knowledge-index.md |
| T4 | MODIFY | docs/specs/bugfix/session-recovery-brief.md |
| T4 | MODIFY | docs/plans/2026-09-06-session-recovery/manifest.md |
| T4 | CREATE | docs/plans/2026-09-06-session-recovery/plan-contract.json |
| T2 | MODIFY | scripts/resolve-dispatch.mjs |
| T2 | MODIFY | schemas/dispatch-policy.schema.json |
| T3 | MODIFY | test-framework/evals/tier-1/validate-review-topology-v2.mjs |
| T3 | MODIFY | test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs |

| T3 | MODIFY | test-framework/evals/tier-1/validate-external-review-launcher.sh |
| T4 | MODIFY | references/skill-routing-index.json |

| T4 | CREATE | docs/specs/audit/session-recovery-analysis.md |

| T3 | MODIFY | test-framework/evals/tier-1/validate-reviewer-run-evidence.sh |
| T3 | MODIFY | test-framework/evals/tier-1/validate-retroactive-attestation.sh |
| T3 | MODIFY | test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh |

| T4 | MODIFY | docs/specs/relations/wi-541-full-transition.branches.md |
| T4 | MODIFY | docs/specs/relations/wi-548-host-parity.branches.md |

| T4 | MODIFY | docs/specs/relations/wi-541-full-transition.branches.md.imports.json |
| T4 | MODIFY | docs/specs/relations/wi-548-host-parity.branches.md.imports.json |

## Task Graph
| Task | Work | Dependencies | AC | Validation |
|---|---|---|---|---|
| T1 | Exact bound-worktree approval fallback | none | AC-1, AC-2 | existing literal-worktree validator with resume/foreign cases |
| T2 | Valid policy constructor and pool observations | none | AC-3, AC-5 | node offline tests |
| T3 | Launcher terminal classification and resource guard/update | T2 | AC-4, AC-5, AC-6 | fake provider invocation fixtures, actual Cursor review |
| T4 | Review/audit, state docs, release/install proof | T1,T3 | AC-7 | focused then required full Tier 1, install drift |

## AC-to-Test Mapping
AC-1/2: registered linked worktree resume, different WI/session, released binding, corrupt graph and preserved residue. AC-3: builder validation and exact station tuple. AC-4: failed terminal JSON vs successful quoted diagnostics. AC-5: pools, newer owner observation, expiry, unknown balance, restart and zero second provider calls. AC-6: canonical Cursor output schema and requested-accepted receipt. AC-7: normal promotion checks.

## Prerequisite Alignment Matrix
| Input | Disposition |
|---|---|
| Product/owner | Explicit founder outcome and resource policy in brief |
| UX/UI | Operator recovery behavior only; no visual artifacts required |
| Tech/style | Existing ES modules, atomic state helpers, authoritative tuple resolver |
| Questions | Founder supplied choices; no unresolved product alternatives requiring new questions |

## External State
| State | Coupling | Lifecycle wiring |
|---|---|---|
| Session binding/claim | Existing read-only authority lookup, existing mutation transaction retained | ensure-worktree and authorityJson |
| Task reviewer configuration | Explicit task-only file, not global policy | create-policy validates; delete task policy to revert configuration |
| Resource failure observations | Atomic sibling state tied to task policy; freshness and reset checks | existing state-io; no secrets or guessed balances |
| Installed host skills/hooks | Normal transactional setup after landing | setup plus all-host drift check |
| Paid review | Only configured Cursor Grok; Sol native advisory | canonical launcher receipt; bounded attempts |
Untouched environments: product databases, application deployments, auth credentials, billing subscriptions, DNS, queues, app stores, Slack, native devices.

## Simulation and Recovery
Same authority yields same exact worktree; mismatches retain denial and files. Unavailable account yields truthful classified failure before spawn. New owner availability observation permits retry; no unknown reset fabricated. Malformed policy fails before file replacement. Rollback reverts this slice and its task-local policy/observation file; existing v2 policies without resource_policy still work. No repair changes another session.

## Execution Command Sequence
Slice checks (expected exit 0):
```bash
node --test test-framework/tests/session-recovery.test.mjs
bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh
node scripts/lint-skills-manifest.mjs
```
Release-boundary corpus: `bash test-framework/evals/run-all-evals.sh` was run once and exited nonzero (339/364 passed). Compare failures to the named clean-base census in `.svc/session-recovery-review/baseline/results.json`: 20 inherited failures reproduce on f9ec209. The five other failures have focused corrections and successful reruns recorded below. This comparison is evidence for the release decision, not a fabricated all-green suite or permission to bypass an enforced gate. Required commit/push checks still apply; repair any slice regression.
Post-landing installation: `./setup --all-hosts` then `bash scripts/check-install-drift.sh --all-hosts`, both expected exit 0; do not invoke paid providers for compatibility.
Failure recovery: inspect named failing assertion, repair this slice, rerun invalidated checks. Existing unrelated failures remain separately attributed; no receipt is fabricated.

## Checkpoints and promotion
Plan mechanical + Sol/Cursor review before implementation. Focused execution tests, self/Sol/Cursor final review, audit-implementation, full required checks, normal commit/land, final-source verification and all-host convergence. Preserve all unrelated root checkout changes. Record active time at milestones.

## Review corrections (SR-01 through SR-05)
Resume fallback is a pure preflight inside the existing locked transaction, only for one registered branch target. Before graph creation, marker processing, repair, reclaim or rebind, require existing graph and complete owned tuple: canonical repository/worktree/branch/WI/session/generation/claim-or-lease/graph. It authorizes only this exact resume call, never a parent root, adoption, missing graph or forward completion. Failure preserves the original root denial. Existing prompt self-heal may call this only when a complete same-session binding already exists; initial adoption still requires approved-root authorization.

Resource state is exactly `<owner-policy-path>.resources.json`, schema v1 observations keyed by policy digest and explicit pool_id. Each record retains route host/model and observed_at; owner observation strictly newer than a failure supersedes it; equal timestamps retain the failure. Expired explicit retry_after permits an unknown-status attempt, never fabricates available status or balance. Unknown status has no suppression effect. Authentication/quota/entitlement failures persist until newer observation or explicit expiry; overload/network without a known reset remain failure observations requiring updated owner status rather than fabricated delays. Existing state-io updateJsonAtomic serializes observation writes and preserves other pool entries. Check after policy validation and before any capability or provider process spawn. No model-name-derived account pools and no automatic fallback. Task config excludes unavailable providers entirely, with Cursor and standalone Grok separate explicit pools when both are described.

Cursor independent eligibility requires explicit station identity_requirement=requested_accepted and exactly cursor/xai/cursor-grok-4.6-high/high. All other Cursor tuples, Auto, absent identity requirement, default-derived selection and observed mismatch are rejected. Receipt requested tuple, effective tuple, evidence level and policy digest are checked again by station validation and cache replay. This is owner acceptance of exact requested CLI routing, not a claim of server-attested model identity.

Classify parsed per-host terminal error envelopes before findings schema validation, including code-zero errors. Successful review content quoting provider errors remains review content. Reviewers' failed invocations remain failures, never approval.

Owner observations originate ONLY in digest-bound resource_policy.observations in the owner policy. The launcher sibling state accepts failure-only rows; source=owner/available rows are invalid and cannot re-enable a pool. Add that negative test. The owner policy maps routes to pools using resource_policy.routes [{host,model,pool_id}]; observations map pool_id to {status,observed_at,classification,retry_after,remaining:null}. Automatic records retain policy digest, pool_id, host/model and failure timestamp. New policy digest does not erase a prior pool failure; only a strictly newer owner observation clears it. Pool IDs are owner-defined account/access scopes, stable across model selection.

Cursor F001 accepted: extend the identical exact predicate in both policy formats through resolve-dispatch exported helper, documented optional schema fields, and their existing validators. F002 ancestry anchor is the exact canonical worktree itself, with no-symlink/same-owner parent ancestry independently checked; no ancestor is granted. F003/F004 align with SR corrections. F005 content-complete code in plans is rejected for inline execution (write once rule); concrete predicates above replace ambiguity. The slice checks and installation checks expect exit 0; the already-run corpus has the explicit inherited-failure census above; no paid repeated review without changed inputs/failure/gate. Forbidden: unrelated files/product session edits, global policy rewrite, broad parent approval, provider fallback, fabricated reset/balance/evidence. Rollback after commit is git revert <this-slice-commit-sha> through the normal worktree workflow; task-only policy and sibling observation may be removed once no review is using them. No global state rollback.

Policy constructor: review-topology-v2.mjs create-policy --input <task-local-builder-input.json> --out <task-local-policy.json>. Input contains orchestrator, self tuple, advisory stations, reviewer station, resource_policy. Always prepend inline self, validate both generated phases before atomic output. For this task invoke --out .svc/session-recovery-review/release-policy.json in its protected task directory. The general owner-operated CLI supports any protected owner-authorized output; it does not introduce a new global path prohibition. Plan risk-section validation PASS; full mechanical check records implementation-dependent parity deferred (nine future paths at this point), and MUST pass after implementation before review-exec.

## Execution review corrections and evidence
Sol EX01: cache key binds policy digest and station id/authority/identity requirement; fixture proves advisory-to-independent miss and unchanged-policy hit. EX02: second policy snapshot must match resolved digest before cache or provider work. EX03: existing launcher process-owned lock serializes one policy-directory/pool across candidate keys; heartbeat, dead-owner cleanup and final release reuse existing helpers. EX04: exact worktree lstat checks same UID/directory/non-symlink. EX05: subtype-only terminal is_error is recognized; successful quoted content still parses as findings. No new runtime layer.

Existing dispatch fixture defects found: environment SVC_DISPATCH_UNAVAILABLE_STATIONS contaminated offline selection; fixture used undefined policy/root identifiers. Fix fixture isolation and identifiers, preserve actual resolver preference behavior. New exact Cursor positive test also found normalization dropping identity_requirement; retain it across normalization. Launcher runtime-copy fixture copies new helper + state-io/process-liveness/schema dependencies; normal installer already includes complete scripts/hooks trees. Router validation found a pre-existing stale generated index; regenerate from authoritative sources, no routing algorithm change.

Time evidence: Cursor plan review 09:14:01–09:18:55 UTC (4m53s); local unit/resources fixture about 1.2s; recovery validator 29 cases; legacy launcher runtime suite 161 cases passed before later review corrections. Full validation is a release boundary, not each edit.

## Final plan review dispositions
F006 rejected: general constructor stays model-agnostic and preserves owner-supplied advisories. AC3 now explicitly scopes required Sol to this task, and focused test plus generated release-policy prove self/Sol/Cursor in both phases. Hardcoding a subscription/model into every owner's constructor would contradict the founder's configurable cross-harness objective. Sol independently rechecked and withdrew that suggestion.
F007 accepted/fixed: isolated exact bound external worktree with symlinked .svc ancestry denies with WORKTREE_ROOT_UNAPPROVED and preserves the symlink. Existing session-authority-isolation covers missing/symlink graph, repository and lease bindings.
F008 rejected: task authorization controls this invocation's target (the exact local release-policy path above); a general owner configuration tool must not add a blanket global-path ban. No global policy has been changed. Protected output and schema validation still apply.

Full offline suite ran once: 339 pass / 25 fail / zero timeout. Targeted clean-base reruns reproduced 20 of those failures on f9ec209. Five task/working-state failures have focused corrections: generated router index staged, task runtime artifacts locally excluded, dynamic launcher version fixture, retroactive fixture helper packaging, and stop-accumulator test isolated from the active governed worktree. Keep inherited failures explicit; do not claim an all-green repository or rewrite unrelated historical receipts to silence them. Independent execution review must assess this residual baseline risk before landing.

F009 accepted and corrected after final plan round: separate passing slice/installation commands from the observed nonzero corpus result and preserve enforced landing gates. No fourth plan review; bound this correction and its verification through the existing bounded-exit contract, then review the final executed candidate normally.

Execution review EXEC-001/002 accepted and fixed: select the last process-terminal envelope so recovered intermediate stream errors do not override a successful Codex/Claude terminal result; classify only the failing terminal object. The existing launcher fake Codex now emits a recovered error before turn.completed and the full launcher fixture passes. Exact resume calls secureAncestorChain on only the immediate parent-to-target segment (no parent approval); a mocked foreign-UID parent regression rejects and preserves the graph. These changes invalidate the prior execution candidate and receive a new final execution review.

Landing preflight found two inherited stale branch indexes. Re-walk their cited paths and entry-point/authority roles, preserve historical scope/status claims as historical, and re-stamp to f24a7ad. This small dependent documentation correction restores the existing branch-index gate; it does not waive validation or rewrite historical receipts. The final cumulative execution review includes these documentation-only changes.

DOC-01 correction: branch-index import-shape sidecars are regenerated using branch-index-freshness --stamp-imports along with Markdown stamps. check-branch-index --all now exits 0. The review dispatched before this sidecar correction was canceled as an invalidated candidate; its evidence is preserved and cannot approve the final tree. No runtime code changed.
