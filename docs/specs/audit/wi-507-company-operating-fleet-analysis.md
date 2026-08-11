# Systems Analysis: WI-507 Company Operating Fleet

**Date:** 2026-07-23

**Branch:** `WI-507-fleet-integration`

**Spec:** `docs/specs/work-items/WI-507.md`

**Mode:** full

## Headline

WI-507 is ready to land. The final implementation has no unresolved Critical, High, or Medium correctness finding. Its three-round independent execution review converged at 9/10 with zero Critical/High, all focused suites pass, and all 15 live routing scenarios pass.

The repository-wide Tier-1 aggregate is not all green: 267 validators pass and two fail. Both failures are pre-existing, outside this diff, and independently attributable to WI-472 proposal triage metadata and WI-498 skip-receipt evidence.

## Verification Contract

| AC | Required behavior | Evidence | Result |
|---|---|---|---|
| AC-1 | Resolve parent state, manage append-only SLA items/apps, enforce explicit Immune Mesh, preserve legacy roles | `validate-company-fleet-integration.sh` covers invalid links, concurrent IDs, date validation, idempotent close, registry validation, legacy cards, grounded peer evidence, and lazy role directories | Confirmed |
| AC-2 | Ship and register 15 generic proposer-only skills on every host surface | 65/65 skill checks, manifest lint at 100 included/59 routing, 15/15 live Tier-2 routes, validate-only Claude/Gemini setup | Confirmed locally; promoted installs deferred to G7 |
| AC-3 | Index only promoted G7 work, persist topology, compare sibling contracts, diagnose without mutation | Focused fixture proves unverified/dirty denial, canonical note/mirror receipt paths, lock release, named WI IDs, prunable topology, contract hashes, trace hashes | Confirmed |
| AC-4 | Claude/Gemini SessionStart hooks fail open with bounded, cached, host-valid output | Focused fixture proves 30-second miss/hit/expiry, malformed input, repository-scoped three-line delta, Gemini JSON, backup, idempotence, and targeted removal | Confirmed |
| AC-5 | Create exact external links/apps and resolve parent `/cos` briefing without touching unrelated changes | All three planned hashes match; all three protected dirty hashes match the precheck; direct hook from `example-marketplace` resolves the parent state; real host mutation remains deferred to promoted main | Confirmed pre-merge boundary |
| AC-6 | Complete chain, merge, refresh final-SHA receipts, verify G7, then index | G2 and capped G6 evidence exist; audit is complete. Land, final-SHA receipt refresh, G7, and index write are downstream tasks | Ready for downstream completion |

## Scope Drift

The 62-file staged scope matches the reviewed implementation plus mandatory chain outputs. Three execution-time dependencies were admitted explicitly:

- `references/context-loading-registry.json` was required by the repository context-budget/skill-family contract.
- `test-framework/evals/tier-1/validate-contracts.sh` was required to register the intentionally shared company-state decision queue.
- Review/audit reports, session freshness, and the append-only competitive trigger are mandatory or automatically generated workflow evidence.

No product-specific identity or path appears in framework runtime source. Concrete company topology remains only in the two external repositories and the ignored precheck artifact.

## Coverage Ledger

| Subsystem | Risk | Audit result | Findings |
|---|---|---|---|
| Company-state engine and Immune Mesh | High | Complete | None blocking |
| Promotion index and durable memory | High | Complete | None blocking |
| SessionStart host integration | High | Complete | None blocking |
| Fleet skill contracts and routing | Medium | Complete | None blocking |
| Topology, contract, and healer diagnostics | Medium | Complete | None blocking |
| External parent/product link lifecycle | High | Complete for pre-merge boundary | Promoted-host proof deferred by design |

## Hypotheses Tested

1. Concurrent open-item writers can issue duplicate IDs or lose history. Rejected: the lock and append-only fixture produces distinct IDs and preserves all events.
2. A failure inside the promotion-index lock can strand future indexing. Rejected: corrupted-index failure leaves no lock file, and stale locks are bounded.
3. A malformed promotion row can suppress all SessionStart delta context. Rejected: invalid rows are filtered and a named WI remains visible.
4. Gemini rejects plain-text SessionStart output. Rejected: Gemini wiring requests JSON format and both hooks emit parseable SessionStart envelopes.
5. Existing company-state installations cannot write canonical role ledgers. Rejected: role directories are created lazily and the legacy-state fixture proves the write.
6. A stale worktree can abort the entire topology snapshot. Rejected: the moved-worktree fixture records `exists:false` and `prunable:true` without aborting.

## Findings and Acknowledgements

No branch-introduced Critical, High, or Medium issue remains.

- Baseline B-1: `validate-proposal-triage-sla.sh` reports the pre-existing WI-472 proposal lacks accepted/rejected/deferred triage metadata. This diff does not touch that proposal.
- Baseline B-2: `validate-skip-conditions-registry.sh` reports pre-existing WI-498 completed review-plan/execute tasks lack skip or skill-receipt evidence. This diff does not touch WI-498.
- Review residuals: seven Low and two Info items are individually dispositioned in `docs/specs/reviews/wi-507-exec-review-log.yaml`; none violates an AC or weakens an authorization boundary.

## Security and Data Integrity

- No secret, credential, payment, deploy, publish, signing, or outbound-action path was added.
- External paths are canonicalized and contained; invalid links and contracts fail closed.
- State writes use append-only events or atomic temp-and-rename replacement under bounded locks.
- Session hooks catch failures and emit no blocking decision.
- Promotion indexing requires a clean checkout, promoted ancestry, and matching passing G7 evidence.

## Residue

No TODO/FIXME was introduced in the changed runtime files. Test results are isolated under ignored result directories. External repositories were not staged, committed, reset, cleaned, or stashed.

## Pre/Post Evidence

The precheck recorded exact protected external hashes before Task 5. Post-change hashes are byte-identical:

- `company-state/open-items.jsonl`: `188adba3a0b6cb883afa7d3f7474b93a0620232d190bd16c96e1e9f0baaf3592`
- `docs/checklists/apple-developer-organization.md`: `dd4a4a76cd3e20670e8ab0a3b951cbad2ff3dd9d4c9c8f4f8d3a1ab55d45a1d6`
- `docs/checklists/domain-email-identity.md`: `4839bfd1a6c8999766f5d127806835d665eb69deb9ca94bcf612927959173284`

Post-change behavioral evidence is 61/61 focused integration, 65/65 skill contracts, 15/15 live Tier-2 routing, and 267 passing aggregate Tier-1 validators. The two aggregate failures are classified baseline debt above.

## Unverified Surfaces

Real global host writes, installed-hook execution, final squash-SHA receipts, and the promotion-index append are intentionally unverified before merge. They belong to `land-changeset` and G7 `verify-promotion`; claiming them now would collapse locally validated and promoted states.

## Verdict

- [x] READY TO LAND — no Critical/High findings
- [ ] BLOCKED — Critical findings must be fixed first
- [ ] CONDITIONAL — High findings should be fixed

Proceed to `land-changeset`, then run G7 from promoted primary `main` before writing promotion memory.
