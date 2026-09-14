# Solution Confidence: WI-541 Full Framework Transition

**Mode:** design_auto
**Decision:** proceed with shared pure enforcement primitives wired into existing consumers
**Confidence:** high, subject to final-SHA focused, full Tier 1, security, independent review, and installed-host proof

## 1. User Ask And Confidence Bar

The owner wants every unique evidence-backed Example Marketplace-derived framework improvement implemented locally, with redundant or unconsumed machinery removed, full product-plan and security quality preserved, continuous learning made operational, and no GitHub dependency. Good enough to plan means: the complete source denominator has a disposition; every AC maps to a concrete consumer and proof; risky recovery and outward-action paths are exact and fail-closed; no proposed executable is inert; and the result can be assembled, reviewed, committed, installed, and replayed locally.

Out of scope: unrelated backlog, Example Marketplace product code, global source-tag backfill, a central task store outside worktrees, GitHub publication, and token-budget logic without a reliable host measurement.

## 2. Current Picture

- SSVE is a local-first Markdown/Node/Bash framework installed to eight hosts, not a web/mobile product.
- The current graph compiler includes `review-plan` only on some lanes and omits `review-exec`; the lane validator accepts a structurally incomplete graph and conflates `review-gate` with `review-exec`.
- Authority, delegation, containment, reviews, receipts, learning capture, and proposal policy already exist. The gaps are mainly unconsumed declarations, missing transitions, duplicated contracts, and false-green validators.
- Codex 0.147.0 exposes native subagents and top-level sandbox/workdir controls, but this session's native spawn transport does not carry the complete SSVE mutation tuple. Contained delegation is the mutating path; native fan-out is read-only.
- There is no browser, mobile, native visual, media, paid provider, cache, or database surface in this change. User perception is operator perception: fewer doomed launches, one-hop actionable denials, faster routes with the same proof, and no repeated stale proposals.
- Cold path: local Node processes read graph/state/ledger files. Warm path: current hooks may memoize installed configuration or learning matches. The change must not hide cost behind cache; it removes unused context and bounds new checks.

## 3. Why The Current Design May Exist

The current parts were built incrementally to close real incidents: worktree isolation, generation-bound claims, contained children, receipt chains, review caps, host wiring, and learning injection. Their strictness is a safety asset. The drift appeared because later work added declarations or helpers under bounded WIs without a global consumer pass: a compiler and validator each encoded lane topology; `agents: true` was read as a broad host capability; learning capture/elevation predicates had no lifecycle executor; and policies such as proposal SLA or authorization envelopes were documented before a reliable boundary was identified.

Chesterton's Fence conclusion: preserve current authority stores, dispatcher denial, receipt history, eligibility detectors, append-only ledgers, and controller. Repair their missing seams; do not rewrite the framework or delete history.

## 4. Constraint Profile

| Constraint | Consequence |
|---|---|
| Local-only delivery, no GitHub | Land and verification must be local and explicitly recorded |
| Existing dirty main residue | All mutation stays in WI-541 worktree; unrelated files remain untouched |
| Framework scripts and docs | Prefer pure ESM and portable Bash; no new runtime dependency |
| Eight installed hosts | Source success is insufficient; setup/drift and installed Codex replay required |
| Security-sensitive authority | Exact tuples, generation locks, expiry, deny-by-default, negative fixtures, security review |
| Full denominator, no quality loss | Scope cannot be reduced by dropping ACs; speed comes from preflight and shared primitives |
| Append-only audit/learning history | Normalize on read and append outcomes; never rewrite source rows |
| Reversibility | One local commit can be reverted and all hosts reconverged; capabilities expire/revoke |

## 5. Freshness And Cache Classes

| Class | Freshness | Cache/store | Invalidation owner |
|---|---|---|---|
| Lane topology | exact-current | imported source module | code change plus focused fixtures |
| Task graph | immediate | canonical worktree JSON | locked atomic mutation |
| Authority/delegation | immediate and generation-bound | repository-shared lease plus worktree evidence | owner handoff/release/expiry |
| Promotion capability | seconds/minutes, explicit expiry | append-only authority state | consume/revoke/expiry/restore |
| Host capability | volatile | host manifest plus live transport evidence | setup/probe/research refresh |
| Learning index | session/action tolerant | normalized in-memory view of two ledgers | ledger append; no silent stale trust |
| Proposal disposition | daily policy | triage JSON and archive paths | triage validator |
| Install state | content-addressed | per-host receipt | setup source hash change |
| Browser/native/media cache | N/A | none | N/A |

## 6. Cost Model

Current recurring provider cost is zero. The relevant costs are local process time, model turns, context, and operator interruption.

- Current waste: unsupported mutating child launch can consume a full turn before the dispatcher denies it; retired quick-fix guidance is loaded into core context; stale proposals and duplicated source families are repeatedly re-audited.
- Target: one pure pre-dispatch resolution, one shared chain contract, one plan parser, bounded learning triage, and no unused core skill guidance.
- Hot-path guard/envelope changes must carry native p95 before/after evidence and fail if above their explicit budget.
- Storage grows linearly in small JSONL receipts; no new background service or metered API is introduced.
- First month/year one provider spend: $0. Higher cost is not authorized by this design.

## 7. World Grounding

| Example | Source | Design lesson |
|---|---|---|
| Git linked worktrees | https://git-scm.com/docs/git-worktree | Worktrees share repository state but carry distinct per-worktree metadata; repair and lifecycle transitions should be explicit rather than inferred from paths |
| SQLite locking/atomic commit | https://www.sqlite.org/lockingv3.html | Serialize writers and make commit atomic; do not perform stale read-then-write updates outside the lock |
| SLSA provenance | https://slsa.dev/spec/v1.2/provenance | Provenance is verifiable production history, not submitter narrative; receipts must bind artifact, source, process, and result |
| SLSA artifact verification | https://slsa.dev/spec/v1.2/verifying-artifacts | Evidence provides value only when a consumer checks it against expectations; every new receipt/mechanism needs a verifier |
| OWASP authorization guidance | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html | Deny by default, validate at the real action boundary, log decisions, and test authorization logic |
| Codex subagents | https://learn.chatgpt.com/docs/agent-configuration/subagents | Start with read-heavy delegation and be careful with concurrent writes; availability is not proof of isolated mutation authority |
| Codex hooks | https://developers.openai.com/codex/hooks | Matching hooks can run concurrently and subagent lifecycle hooks are observation seams; ordering or lifecycle presence is not containment |

## 8. Options Considered

1. **Chosen — shared pure primitives with existing consumers.** Repair topology, transport, recovery, plan truth, learning, and cleanup at their current seams.
2. **Keep current architecture and tune documentation only.** Lowest diff, but every reproduced false-green/inert path remains.
3. **Independent patch per residual WI.** Reviewable in isolation, but repeats parsers/contracts and cannot prove cumulative interactions.
4. **Unified controller rewrite.** Potential long-term simplification, but unnecessary, high-risk, and unsupported by the failure evidence.
5. **External orchestration service.** Adds network, deployment, secrets, and cost while violating local-first/offline operation.

## 9. Tradeoff Matrix

| Option | Quality | Cost | Latency | Mobile memory | Size | Reversibility | Operational risk | Operator perception |
|---|---|---|---|---|---|---|---|---|
| Shared primitives | High | $0 provider | Better after preflight; bounded hook cost | N/A | Broad but modular | High | Medium until tested | Faster with stronger proof |
| Docs only | Low | $0 | Unchanged waste | N/A | Small | High | High false-green | Still confusing |
| Separate WIs | Medium | More repeated model/operator time | Slow overall | N/A | Fragmented | Medium | Cross-WI drift | Many partial completions |
| Controller rewrite | Unknown | High engineering cost | Unknown | N/A | Very large | Low | Critical | Disruptive |
| External service | Medium | New recurring cost | Network-dependent | N/A | Large | Low | High | Less local/control |

## 10. Action-by-Action Approval Packet

| Proposed action | Why this action exists | How achieved | Positive outcome | Negative / risk | Impact if skipped | Required proof before closeout |
|---|---|---|---|---|---|---|
| Single-source the mandatory chain | Compiler/validator currently disagree | Shared pure chain module and exact sequence checks | No structural false-green | Incorrect lane inclusion could over-route | Missing reviews remain possible | All mutable lane fixtures plus omission/duplicate/reorder/substitution negatives |
| Cover Bash concrete-path mutation | Edit/Write-only guard was bypassed live | Reuse decoded argv and extend matcher/exemptions | Same policy across tools | False deny on reads | Guard remains tool-selectable | python/sed/heredoc/jq negatives and read positives through dispatcher |
| Resolve child transport before launch | Example Marketplace workers were guaranteed to fail on first write | Pure tuple resolver consumed by execution skills | Avoids wasted turns; keeps safe parallel reads | Misclassification could serialize valid work | Repeated doomed child turns | Full resolver matrix and billing topology replay |
| Add detached promotion capability | Sanctioned release detach invalidates branch tuple | Expiring exact purpose tuple and recovery parser | Release can resume without hook removal | Authority widening is critical risk | Production flow can deadlock | Exact incident state machine, foreign/widened/expired negatives, security review |
| Converge same-owner legacy worktree state | WI-538 cannot bootstrap its existing registered worktree | Locked exact path/branch/repo/owner/generation checks then missing-state creation | Zero-block same-owner recovery | Could overwrite ambiguous residue | Existing valid worktrees remain stranded | Disposable legacy replay plus residue/foreign/symlink negatives |
| Enforce stream ownership | Label-only parallel plans overlap files | Typed ownership matrix and diff reconciliation | Safe parallelism and sequential assembly | Stricter plan authoring | Merge fragility persists | Shared-file and undeclared-diff fixtures |
| Require reversal/property proof for writers | Money/entitlement changes can omit compensating behavior | Plan classification, both operation orders, property sweep | Product plans fail before unsafe execution | False positives for non-monetary counters | Financial correctness depends on reviewer intuition | Positive/negative money writer fixtures |
| Verify absence/blocker/caller claims | Zero without a denominator was accepted | Canonical namespace-aware search and evidence schema | Claims become reproducible | Search denominator may need maintenance | False blockers and unsafe deletion remain | slug/invoke/alias fixtures and zero-denominator rejection |
| Bind reviewer-run evidence | Submitter PASS prose is not independent proof | Receipt schema and launcher require commands/outputs; deletion parse/collect proof | Review becomes behavioral | Reviewer cost increases slightly | Self-grading can land | Receipt negatives and executable deletion fixtures |
| Normalize and consume learnings | Capture exists but malformed rows/elevation/outcomes are disconnected | Strict normalization, lifecycle events, evaluate-rule, validated federation | Knowledge compounds measurably | Ledger/schema complexity | Learning remains residue | Two-ledger/malformed/used/ignored/outcome/elevation replay |
| Enforce explicit authorization envelopes | Declarative envelope neither blocks outside nor measures inside stops | Observable outward wrapper plus Stop telemetry and timing gate | Safer autonomy with fewer needless asks | Wrapper coverage could be overstated | Policy remains prose | outside deny, inside record, absent behavior, p95 fixture |
| Retire unused quick-fix context | Deprecated skill still loads/routes | Remove from core/curated guidance; retain detectors unchanged | Less context and no fast-lane confusion | Docs/mirrors can drift | Deprecated path keeps resurfacing | manifest lint, route replay, byte equality of detectors |
| Make task graph updates atomic | Concurrent phase writes can lose state | Move validation/mutation into locked closures; throw outside | Durable cross-host graph | Lock misuse can deadlock | Evidence silently disappears | Real concurrency plus error-lock-release fixture |
| Close residual schema/mechanical drift | Red WI-518/522/523 items remain | Bounded schema/docs/arg-array/genesis/registry corrections | Removes known false assumptions and portability bugs | Cross-file synchronization | Known red items remain | Focused WI fixtures and command budget |
| Drain and enforce proposal triage | SLA exists but stale/open denominator accumulated | Evidence dispositions, archive moves, explicit counts | Backlog cannot silently recur | Bad disposition could hide work | Repeated census cost | Zero untriaged/expired plus numerator/denominator output |
| Install and replay all hosts locally | Source tests do not prove installed behavior | Setup all hosts, drift check, installed Codex scenarios | Runtime-consumed result | Host-specific install failure | Local tree is not delivered capability | All-host convergence and installed replay receipts |

## 11. Outcome Coverage

| Category | Best credible outcome | Worst credible outcome | Mitigation |
|---|---|---|---|
| Product UX | Product plans catch money reversal, claims, and consumers before code | Strict parser rejects a legitimate plan | Typed exemptions require evidence; focused fixtures |
| Web/mobile/native | N/A; framework-only | N/A | No visual/runtime product claim |
| Data correctness | Atomic task/authority/learning state | Lock or migration bug loses progress | Temp/fsync/rename, crash-forward fixtures, append-only history |
| Cost/credits | Fewer failed agent turns and less core context | Hook checks add local latency | p95 budgets and single-process/shared parsing |
| Provider/API | No new provider cost or dependency | Optional reviewer unavailable | Existing fallback, deterministic local gates |
| Cache/freshness | Explicit state freshness/expiry | Stale host capability assumption | Live probes and expiry/version bounds |
| Scalability | Linear local validation with one parser per concern group | Proposal/learning ledgers grow | Bounded views and existing archive policies |
| Complexity | Shared primitives remove drift | Broad diff is hard to review | Exact ownership, sequential assembly, independent holistic review |
| Reversibility | One local commit revert plus reinstall | Partially consumed capability | Expiry/revoke/crash-forward recovery |
| Support/ops | Actionable one-hop denials | Misleading recovery hint | Copy-paste replay and installed-host proof |

## 12. Decision Or Remaining Unknowns

Proceed. The architecture is sufficiently grounded to plan. No product or one-way-door choice remains. The remaining unknowns are implementation facts to prove, not design blockers: exact p95 deltas, the final set of concrete-path guard exemptions, disposable legacy/promotion replay results, and installed-host behavior. Each is a mandatory closeout gate, so failure returns to implementation rather than being waived.

## 13. Base44/AI Suggestions Triage

| Suggestion/family | Classification | Reason |
|---|---|---|
| Candidate harness, story chain, conformance, intent recovery, round cap, learning capture | adopt as existing foundation | Present with consumers/tests; do not duplicate |
| Mutating child native fan-out | modify | Keep native for read-only; mutation uses contained wrapper or controller |
| Central task store outside worktrees | reject | Conflicts with canonical operation-worktree authority |
| Global scope-tag backfill | defer | No activated consumer or measured benefit |
| GitHub claim announcement/merge protocol | unrelated | Owner requires local-only delivery |
| Token-per-gate stop | defer | No reliable cross-host source; existing hard review cap is measurable |
| Markdown candidate ingestion | reject | Format does not exist and cited premise is false |
| Separate script for every plan rule | modify | One plan-contract parser avoids inert machinery and parser drift |

## 14. User-Facing Summary

- Keep the proven SSVE controller, receipts, worktrees, and security boundaries.
- Repair the places where rules exist only in prose or disagree across compiler and validator.
- Decide child mutation capability before launch; native Codex subagents stay useful for read-only work.
- Make recovery narrow and one-hop, never a hook bypass.
- Make product plans prove file ownership, money reversals, absence claims, consumers, and reviewer-run evidence.
- Turn learnings into a measured lifecycle with outcome credit, while preserving historical ledgers.
- Deliver as one local commit only after full tests, security/review audits, all-host install, and installed Codex replay.
