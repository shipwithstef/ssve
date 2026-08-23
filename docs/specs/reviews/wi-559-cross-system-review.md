# WI-559 cross-system review

**Date:** 2026-08-23
**Scope:** canonical plan-review and execute-dispatch adapter convergence
**Independent reviewer:** Grok 4.6 Build, xAI family, high effort
**Cursor stations:** attempted and unavailable because the account usage limit was reached

## Decision

The implementation candidate at `1be9a1add31a9863dfe985c232d466167af80ce3`
passed the final Grok High review with zero findings. Its tree was
`42e2f83edd1035d073ac709f43676cc25589126e` and its candidate digest was
`6082fe842d66e9d7d47b2bd4c0b287cea5d391d171c0a5f5a253f27a5dd188c6`.

This is a local implementation-review decision. It is not evidence that the
branch is landed, centrally installed, or replayed in HoursHub.

## Adversarial round history

| Round | Candidate | Verdict | Resolution |
|---|---|---|---|
| r7 | `82ed6bc2` | fail, 6 findings | Pinned exact policy snapshots and overrides, anchored append parents, bound phase/station evidence, closed selector inputs, and admitted the exact Grok/xAI schema tuple. |
| r8 | `6fb350c8` | fail, 4 findings | Added directory-FD-pinned authority reads, removed compatibility schema sniffing and policy reopen, pinned phase/override parents, and executed child containment validators in convergence. |
| r9 | `e47d2ffe` | pass-with-findings, 1 medium | Bound the policy-status shell to the launcher fixture that behaviorally proves canonical delegation. |
| r10 | `1be9a1ad` | pass, 0 findings | Certified the r9 selector repair and re-certified all r8 authority boundaries on the exact tree. |

## Certified boundaries

- Owner policy, manifest, review log, phase binding, and override bytes are read
  through owner-checked pinned parent and no-follow leaf descriptors.
- The shell compatibility adapter and plan adapter do not pre-read or
  schema-sniff policy bytes; the canonical launcher owns policy selection.
- Execute evidence and verification bind phase and station in addition to the
  exact WI, plan, review log, policy, host, family, model, and effort.
- The convergence proof actually runs host-authority, child-transport, and
  contained-exec validators.
- Changing the policy-status shell selects the exact launcher fixture that
  invokes it against schema-v1 owner policy and proves zero provider calls.

## Independent-station availability

The requested Cursor Sol High and Cursor Fable High attempts were both refused
by the provider because the account usage limit had been reached. The launcher
hard-failed and produced explicit receipts at
`/tmp/wi559-final-sol-r7/receipt.json` and
`/tmp/wi559-final-fable-r7/receipt.json`. Neither attempt was substituted or
reported as a pass. Direct Grok 4.6 Build High supplied the independent
execution reviews requested by the owner.

## Final-tree rule

This document records the reviewed implementation candidate. The evidence-only
closeout commit that contains this document must itself receive a read-only
exact-tree review receipt before landing; that receipt remains external so
recording it cannot recursively change the reviewed tree.
