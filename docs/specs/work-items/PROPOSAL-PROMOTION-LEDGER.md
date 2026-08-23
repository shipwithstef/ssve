# Proposal Promotion Ledger

Date: 2026-05-11

This ledger maps every direct `proposals/*.md` artifact to canonical WI ownership. It prevents proposal files from acting as a hidden backlog. Existing WIs are reused when they already cover the proposal; new WIs are deduplicated by failure class.

As of 2026-05-12, every promoted source listed below is archived under
`proposals/done/`. Live implementation/backlog ownership is the accepted WI and
its residual map, not the proposal file.

| Proposal | Accepted WI | Notes |
|---|---:|---|
| `2026-04-14-blocking-discovery-halt-protocol.md` | WI-318 | New blocked-discovery halt WI |
| `2026-04-14-parallel-wi-dispatch.md` | WI-310 | New parallel dispatch WI; residual map filed at `WI-310-residual-map.json` |
| `2026-04-19-evolution.md` | WI-311 | Historical residual sweep |
| `2026-04-20-session-audit-capture-idea-wrong-repo.md` | WI-311 | Historical residual sweep |
| `2026-04-21-evolution.md` | WI-311 | Remaining residuals after prior implemented pieces |
| `2026-04-22-strategic-decision-research-discipline.md` | WI-313 | Strategic/local-evidence discipline |
| `2026-04-24-framework-cohesion-evolution.md` | WI-311 | Residual sweep; WI-073 already covers one leaf |
| `2026-04-25-capability-blocker-auto-diagnosis.md` | WI-314 | Capability blocker and legacy-inertia group |
| `2026-04-25-comprehensive-session-audit.md` | WI-311 | Historical residual sweep |
| `2026-04-25-deterministic-quality-hooks.md` | WI-312 | Hook/guard residuals |
| `2026-04-25-dynamic-deterministic-reliability-review.md` | WI-312 | Residuals after WI-116..WI-122 and related work |
| `2026-04-25-inertia-detection-deprecated-api-check.md` | WI-314 | Capability blocker and legacy-inertia group |
| `2026-04-25-prevent-deployed-unverified-shipping.md` | WI-305 | Feature closeout ledger covers AC traceability; existing WI-197..WI-199 cover related verification pieces |
| `2026-04-26-audit-entity-rls-skill.md` | WI-308 | Base44 data/security verification pack |
| `2026-04-27-debug-e2e-skill-meta-gap.md` | WI-307 | Journey/E2E hardening |
| `2026-04-27-diagnose-bug-persistence-bisect-phase-0.md` | WI-308 | Base44/data persistence verification pack |
| `2026-04-27-global-improvements-from-opencode-review.md` | WI-319 | OpenCode residual audit |
| `2026-04-27-no-positional-role-selectors.md` | WI-307 | Journey/E2E hardening |
| `2026-04-27-prove-old-path-fails-before-migrating.md` | WI-309 | Cross-system falsification proof |
| `2026-04-28-blend-coreyhaines-marketing.md` | WI-315 | Reuses WI-135/WI-136 where covered |
| `2026-04-28-launch-knowledge-update.md` | WI-313 | Strategic/launch knowledge discipline |
| `2026-04-28-prove-gap-exploitable-before-deploying-security-rule.md` | WI-308 | Base44/security verification pack |
| `2026-04-28-rls-deployment-order-by-caller-surface.md` | WI-308 | Base44/security verification pack |
| `2026-04-28-rls-derived-ownership-pattern.md` | WI-308 | Base44/security verification pack |
| `2026-04-29-blend-capacitor-skills.md` | WI-315 | External addon blend backlog |
| `2026-04-29-completion-guard-historical-skip.md` | WI-312 | Hook/guard residuals |
| `2026-04-29-cross-system-flow-paradigm.md` | WI-309 | Cross-system falsification proof |
| `2026-04-30-blend-gsd-2.md` | WI-315 | External addon/pattern blend backlog |
| `2026-04-30-infra-project-support.md` | WI-316 | Infra lane and Knowledge Spine activation |
| `2026-04-30-journey-execution-trace-validation.md` | WI-307 | Journey/E2E hardening; related WI-191/WI-211 already exist |
| `2026-04-30-journey-proposals-self-review.md` | WI-307 | Journey/E2E hardening |
| `2026-04-30-journey-skills-contract-hardening.md` | WI-307 | Journey/E2E hardening |
| `2026-05-01-competitive-awareness-gap.md` | WI-142 | Existing WI-140/WI-142 cover the proposal; triage points to exact WI-142.md |
| `2026-05-04-session-audit-opencode-go-research.md` | WI-311 | Historical residual sweep |
| `2026-05-05-evolution.md` | WI-305 | Feature/visual closeout ledger group |
| `2026-05-06-session-audit-catalog-skill.md` | WI-311 | Historical residual sweep |
| `2026-05-06-session-audit-fix-phase.md` | WI-311 | Historical residual sweep |
| `2026-05-08-end-to-end-execution-without-permission-checkpoints.md` | WI-198 | Existing WI covers end-to-end session mode |
| `2026-05-08-runtime-verification-must-not-delegate-to-user.md` | WI-197 | Existing WI covers no user-delegated runtime verification |
| `2026-05-08-svc-doctor-consolidated-healthcheck.md` | WI-317 | New svc doctor WI |
| `2026-05-09-bundle-grep-is-not-validation.md` | WI-199 | Existing WI covers V0 bundle-grep substitution |
| `2026-05-09-intelligent-intent-parsing.md` | WI-201 | Existing WI covers method correction and typo normalization |
| `2026-05-09-journey-generator-must-detect-i18n-and-chrome-controls.md` | WI-307 | New journey/E2E hardening WI cross-links existing WI-168..WI-170 |
| `2026-05-11-framework-improvement-feature-validation-closeout-ledger.md` | WI-305 | New feature ledger WI |
| `2026-05-11-framework-improvement-provider-fidelity-for-ai-visuals.md` | WI-306 | New provider fidelity WI |
| `2026-05-12-auto-learning-capture-hook.md` | WI-343 | Auto-learning capture hook; first non-bootstrap WI to dogfood the WI-341 T1 author-time linter (7 PASS, 0 WARN after 2 fixes); T2 receipt deferred until WI-341 tranche 2 lands |
| `2026-05-12-pre-wi-promotion-compression-gate.md` | WI-341 | New pre-WI promotion compression gate; **proposal status: DRAFT** until WI-341 lands the gate that promotes it (bootstrap exception per WI-073 precedent) |
| `2026-05-12-autonomous-discuss-phase-with-adversarial-review.md` | WI-342 | New autonomous discuss-phase + adversarial reviewer; proposal status: DRAFT, promotion gated on WI-341 landing |
| `2026-05-16-framework-improvement-closeout-leftover-hygiene.md` | WI-345 | New closeout leftover artifact hygiene WI |
| `2026-05-17-framework-improvement-wave-closeout-validator.md` | WI-348 | Wave closeout validator for multi-WI follow-up batches |
| `2026-05-13-concurrent-session-collision-on-main.md` | WI-349 | Receipt-emission --sha pinning for multi-session collision prevention |
| `2026-06-04-framework-improvement-interactive-control-contract-gate.md` | WI-332 | Interactive Control Contract Gate |


## OPEN-PROPOSALS.md Mapping

| Proposal ID | Accepted WI | Notes |
|---|---:|---|
| FP-001 | WI-308 | Backend/schema ground-truth verification group |
| FP-002 | WI-308 | Brownfield backend schema re-verification group |
| FP-003 | WI-308 | Backend-query gotchas fit Base44 verification pack |
| FP-004 | WI-305 | Feature validation ledger covers management UI evidence per AC |
| FP-005 | WI-305 | Feature validation ledger covers pricing/business claims vs real routes |
| FP-006 | WI-307 | Producer journey completeness belongs to journey/E2E hardening |
| FP-008 | WI-308 | Review-gate schema round-trip enforcement belongs to backend verification pack |
| FP-009 | WI-320 | New explicit delivery-tier WI |
| FP-018 | WI-321 | New builder-profile prioritization WI |
| FP-019 | WI-322 | New archival hygiene WI |
| FP-020 | WI-321 | Same builder-profile prioritization failure class as FP-018 |
| FP-021 | WI-306 | New provider fidelity WI |
| FP-022 | WI-305 | New feature validation ledger WI |
| `2026-06-04-session-audit-active-intent-guard.md` | WI-354 | Implemented + VERIFIED; formal closeout 2026-06-29, residual map `WI-354-residual-map.json` |
| `2026-08-10-framework-improvement-agy-chain-receipts.md` | WI-529 | Truthful AGY receipt identity; residual map `WI-529-residual-map.json` |
| `2026-08-10-framework-improvement-codex-launcher-wiring.md` | WI-529 | Launcher-routed governed Codex dispatcher; residual map `WI-529-residual-map.json` |
| `2026-08-10-framework-improvement-skills-package-layout.md` | WI-530 | Packaged source layout and preserved-worktree recovery; residual map `WI-530-residual-map.json` |
| `2026-08-15-evolution-hoursHub-transition.md` | WI-541 | Content-deduplicated transition program; residual map `WI-541-residual-map.json` |
| `2026-08-15-framework-improvement-mandatory-chain-graph-parity.md` | WI-541 | Exact mandatory chain compiler/validator repair; residual map `WI-541-residual-map.json` |
| `2026-08-02-one-lane-framework.md` | WI-512 | One-lane batches B1-B4 landed; product-repo skill promotion deferred; residual map `WI-512-residual-map.json` |
| `2026-07-24-session-019f8cd3-audit-and-svc-framework-fixes.md` | WI-512 | OPT items executed via WI-512 batch B3; stale/false-premise OPTs documented; residual map `WI-512-residual-map.json` |
| `2026-08-17-framework-improvement-native-host-dispatch-policy.md` | WI-551 | Native dispatch policy resolver; residual map `WI-551-residual-map.json` |
| `2026-08-17-framework-improvement-autonomous-restart-boundary-continuation.md` | WI-552 | Restart-boundary hardening in 50a3440; live fixtures follow-up WI-546; residual map `WI-552-residual-map.json` |
| `2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md` | WI-553 | Risk-triggered contracts b0e2e9b; residual map `WI-553-residual-map.json` |
| `2026-08-21-framework-improvement-consumer-retroactive-attestation.md` | WI-555 | Consumer-local retroactive attestation 9a6480f; residual map `WI-555-residual-map.json` |
| `2026-08-21-framework-improvement-final-sha-mandatory-skill-coverage.md` | WI-556 | Final-SHA skill coverage e0cf025; residual map `WI-556-residual-map.json` |
