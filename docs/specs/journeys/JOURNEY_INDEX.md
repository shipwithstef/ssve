# Journey Index

**Last synced:** 2026-07-23
**Method:** Bootstrap generation plus targeted WI-508 framework Enabler sync
**Personas:** 4 (fallback system personas; no `docs/specs/personas/` files exist yet in this repo)
**Journeys:** 9 (3 discussion-phase + 6 framework-chain J-FW)
**AC coverage:** 100% of total ACs referenced by at least one journey

## Personas

| ID | Name | Description | Journey count |
|----|------|-------------|---------------|
| S1 | Framework Orchestrator | System-level routing persona that detects ambiguity and selects the next phase | 1 |
| S2 | Framework Maintainer / Builder | Human operator or maintainer who needs the framework to stop, defer, or reroute safely | 1 |
| S3 | Direct Invoker | Operator who starts discussion from a prompt or framework gap without a pre-existing target spec | 1 |
| S4 | Framework Candidate Operator | Human operator who curates, ranks, and explicitly triages project-scoped pre-WI candidates | 1 |

## Journeys

| ID | Title | Persona | Priority | Features | AC refs | E2E tests |
|----|-------|---------|----------|----------|---------|-----------|
| J01 | Resolve Gray Areas And Proceed | S1 | Critical | feature-discussion-phase | DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-07, DISC-08, DISC-09, DISC-10, DISC-11, DISC-12, DISC-13, DISC-14, DISC-15, DISC-16, DISC-19, DISC-20, DISC-21, DISC-25, DISC-26 | None |
| J02 | Block Or Reroute When Discussion Cannot Safely Proceed | S2 | Critical | feature-discussion-phase | DISC-06, DISC-17, DISC-18, DISC-22, DISC-23, DISC-24 | None |
| J03 | Start Discussion From A Zero-State Prompt | S3 | High | feature-discussion-phase | DISC-01, DISC-ZERO, DISC-07, DISC-11, DISC-14, DISC-15, DISC-25, DISC-26 | None |
| J-FW-01 | Plan Segment Produces A Reviewed, Receipt-Bound Manifest | S1 | Critical | mandatory-chain seg-1-plan | WI-399 AC-B4; chain-receipt-contract; baton recompute | tier-1: validate-baton-ac-binding.sh |
| J-FW-02 | Exec Segment Survives The Adversarial Station | S1 | Critical | mandatory-chain seg-2-exec | WI-399 AC-B3; review-exec P2-P4 | tier-1: validate-locked-agents.sh |
| J-FW-03 | Land Segment Merges, Re-Binds Receipts, Deploys Live | S1 | Critical | mandatory-chain seg-3-land | WI-399 AC-A1 (measured deploy); receipt re-binding | tier-1: validate-review-receipt path |
| J-FW-04 | Exempt-Class Work Rides The Quick-Fix Carve-Out Honestly | S1 | High | quick-fix carve-out (WI-360/376/396) | eligibility + receipt-content binding | tier-1: WI-396 negative fixtures |
| J-FW-05 | Two Live Sessions Share One Machine Without Corruption | S1 ×2 | Critical | multi-session guards (WI-399 A3/A6/A7; WI-398) | WI-399 AC-A3/A6/A7 | tier-1: completion-guard contract + freshness F2/F3 repros |
| J-FW-06 | Rank and Triage a Project Candidate Reservoir (`J-FW-06-candidate-reservoir-triage.feature.md`) | S4 | Critical | candidate-reservoir | CAND-01..06, GROUND-01..06, SCORE-01..06, TRIAGE-01..06, ISOLATE-01..07 | local PASS: validate-candidate-harness.sh |

## Coverage Summary

| Feature | Total ACs | In journeys | Coverage |
|---------|-----------|-------------|----------|
| feature-discussion-phase | 26 | 26 | 100% |
| candidate-reservoir | 31 | 31 | 100% (spec trace; runtime proof pending) |

## Framework-Chain Coverage Note (WI-399 B5)

The J-FW journeys cover the mandatory chain itself — previously zero journey
coverage. Scenarios are derived from the 2026-06-08..10 live incident corpus;
each maps to a WI-399 AC, a tier-1 validator, or a chain-contract clause (no
unanchored scenarios).

## Cross-Journey Dependency Notes

- J01 assumes earlier pipeline artifacts can distinguish settled choices from open ones; this is only partially grounded today and needs design-tech to formalize the trigger contract.
- J02 assumes review can enforce settled discussion decisions; that downstream enforcement still needs implementation.
- J03 assumes zero-state prompts can be bounded reliably; bootstrap prompt shape still needs technical design.
- J-FW-06 assumes a curator supplies a schema-valid mirror and a normal framework process supplies the WI token; the harness deliberately does not create either product/customer records or WIs.

## Next Iteration

- [ ] Run `design-tech` on `feature-discussion-phase.md` to define placement rules, artifact schema, trigger scoring, and downstream consumption
- [ ] After implementation, add E2E or framework-eval coverage for proceed, block/reroute, and zero-state bootstrap flows
- [ ] WI-508: implement and pass the focused Candidate Harness journey validator, then update J-FW-06 E2E status from planned to live.
