# WI-570 plan review dispositions

This is a historical finding ledger. The authoritative implementation contract is `manifest.md`, with acceptance criteria in `docs/specs/work-items/WI-570.md`. A finding disposition records a design correction; it is not a passing test, receipt, or v5 issuance.

The first Grok 4.6 xhigh and Opus 5.5 reviews both returned REVISE on the earlier prose candidate. The revised Opus review returned pass-with-findings and five localized corrections below. A further Grok review was stopped before a paid call by the existing three-round cap; that cap was not bypassed. The two-box LIVE attempt stopped before provider stages with `effective isolation inspect failed: developer wrapper not in native profile`; the prepared record has `control_plan_ref: null`. No complete `SVC_PLAN_BODY`, seal, or executable v5 plan receipt is claimed.

| Review finding | Disposition | Contract location and result |
|---|---|---|
| Grok F-001 mirror schema and parser | ACCEPT | Manifest § Identity/pull; WI-570 AC-05/10: WI-GH-N trusted metadata, quoted untrusted body, real parser test. |
| Grok F-002 close receipt and commit | ACCEPT, superseded by revised R-005 | Manifest § close: `--commit SHA`, durable note via existing validator, same WI and reachable commit; no supplied receipt file. |
| Grok F-003 remote mode distinction | ACCEPT | Manifest mode table: github-backed publishes adopted WI-GH-N only; hybrid also publishes local WIs; local files remain valid in all modes. |
| Grok F-004 state interface | ACCEPT, refined | Manifest § Identity: common-dir `svc-issue-tracker/map.json` and lock, exact marker/hash, invocation worktree mirrors. Earlier `.svc/github-issues-map.json` location is legacy read-only migration input, not new canonical state. |
| Grok F-005 G7 integration | ACCEPT | Manifest § close: manual default, optional post-receipt close, pending remote state without changing local VERIFIED; Related to wording. |
| Grok F-006 Tier 1 value/bound | ACCEPT | Manifest T1 and V1–V7: small hermetic critical wrapper under 5 seconds plus deeper explicit suite; no skipped failure. |
| Grok F-007 legacy identity | ACCEPT | Manifest § Identity: exact configured repository, issue URL/number and title evidence; no fuzzy title guessing. |
| Grok F-008 private terms and pull | ACCEPT | Manifest § mode/config and pull: no private vocabulary in repo config; optional repository-keyed owner file, inbound credential and term gate before tracked write. |
| Grok F-009 live check classification | ACCEPT | Manifest V8 optional reachability only; V1–V7 are required offline proof. |
| Grok F-010 bounded recovery | ACCEPT, refined by revised R-004 | Manifest § Identity: pending/legacy only 10×100 state=all list with exact-marker checks, explicit `--adopt-issue` for uncertain large repo, no blind second POST. |
| Opus F-001 formal v5/AC binding | PARTIAL | WI-570 has 14 parseable ACs and manifest exact tasks/proofs. LIVE two-box failed pre-stage, so CAS refs, selected source IDs and valid v5 body remain absent and are explicitly disclosed. |
| Opus F-002 private terms in repo | ACCEPT | Manifest § mode/config; owner-only repository-keyed file, repo config rejects terms. |
| Opus F-003 WI-GH-N compatibility | ACCEPT | Manifest caller/grammar inventory and T3 exact `merge-pr-with-review-receipt.mjs` change; AC-10. |
| Opus F-004 close evidence identity | ACCEPT, superseded by revised R-005 | Manifest § close validates real Git note at supplied commit, receipt fields and origin-default ancestry; arbitrary PASS file is not accepted. |
| Opus F-005 imported body injection | ACCEPT, strengthened by revised R-001 | Manifest § pull quotes every body line inside dynamic fence; V2 exercises all real parser metadata aliases. |
| Opus F-006 mode operation semantics | ACCEPT | Manifest mode table gives allowed/refused outcomes, including local WI publication refusal in github-backed. |
| Opus F-007 close_trigger ambiguity | ACCEPT | Manifest § config/close: manual default versus after-receipt verify-promotion attempt; shared map `close-pending` and exact retry. |
| Opus F-008 close payload privacy | ACCEPT | Manifest § close limits payload to generated sanitized commit/receipt facts and one PATCH; no arbitrary local evidence bytes. |
| Opus F-009 governing rule and callers | ACCEPT | T3 includes `rules/github-projects.md`; caller inventory shows no tracked operational script callers; legacy flags fail nonzero. |
| Opus F-010 sibling state and stale lock | ACCEPT | Manifest § Identity: shared map/lock in common Git directory, config/mirror in invocation worktree; explicit dead same-host lock recovery. |
| Opus F-011 fake API fidelity | PARTIAL | V3/V4 stub records exact argv/stdin and rejects unknown flags; V8 can capture sanitized live shapes when available, otherwise documented GitHub API examples supply narrower fixture provenance. V6 gets prompt wiring plus actual independent plan judgment, not self-review alone. |
| Opus F-012 unrelated plan-value concern | ACCEPT with bounded split | T2 has disjoint paths, focused test/wrapper, separate checkpoint, review, commit and receipt envelope within WI-570; it cannot silently ride tracker tests or review this plan through unreviewed launcher changes. |
| Opus F-013 host override and labels | ACCEPT | Manifest § CLI clears GH_HOST/GH_REPO/GH_ENTERPRISE_TOKEN, fixes github.com literal paths, and owns no labels in v1. |
| Revised Opus R-001 parser aliases | ACCEPT | Manifest § pull and V2; prefix every imported line with `> ` inside dynamic fence; assert trusted priority, empty dependencies, null close date and open status through actual list parser. |
| Revised Opus R-002 stale disposition document | ACCEPT | This document is history only; manifest is authoritative. All original and revised findings have explicit rows; stale map/main fallback/private-term text removed. |
| Revised Opus R-003 pulled map baseline and close | ACCEPT | Manifest § Identity/publish/close: empty owned-block baseline; pull-then-close appends one block and never sends a title field; title conflict applies to intentional publish title changes. |
| Revised Opus R-004 large repo and lock recovery | ACCEPT | Manifest § Identity/CLI and V4: scan only pending/legacy with capped state=all list excluding PRs and exact-marker checks, explicit adoption by exact marker and dead-host lock recovery. |
| Revised Opus R-005 redundant receipt file | ACCEPT | Manifest § CLI/close and WI-570 AC-09: `--close-wi ID --commit SHA`, durable note only, same predicates and exact manual retry. |

No further paid review round is represented here. Source review artifacts remain under the controller worktree `.svc/external-review-artifacts/wi570-plan/`; this file only records how the authored contract responded.
