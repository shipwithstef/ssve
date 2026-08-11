# Decay report — 2026-06-07 (window 90d)

> **MEASUREMENT ONLY — not a gate.** Demotion/retirement decisions go through evaluate-rule / concern calibration knobs; tier-1 validators are excluded from zero-hit logic by design (rules/tier-1-promotion.md §Demotion only).

## Rule demotion candidates (zero injection hits across a COMPLETE 90d window): 0/43
*(observed telemetry: 0d; 43 rules excluded — observation window not yet complete)*

*(Telemetry caveat: injection memos are per-session machine-local since WI-361 — a short observation window under-counts; treat as candidates for evaluate-rule, never auto-retire.)*

## Concern severity-demotion candidates: none emitted — hit-ledger observation window not yet complete (observed 0d, need 90d).

## Tier-1 validators: zero-hit demotion N/A by design — review only against §Demotion criteria (timeouts, duplication, one-off-incident guards).

## Learning → rule elevation candidates (confidence ≥8 AND fires ≥3): 0

*Confidence-qualified but fire-count unverified (no fires field recorded yet — elevation needs 3+ applications per rules/learning-preload.md): 47 — full list:*
- host-capability-training-data-staleness (c10, fires unrecorded)
- stored-knowledge-decay-requires-live-verification (c10, fires unrecorded)
- hook-scripts-must-read-stdin-not-argv (c10, fires unrecorded)
- hook-hard-block-use-exit-2-not-exit-1 (c9, fires unrecorded)
- framework-changes-need-plan-changeset (c9, fires unrecorded)
- counter-file-flakiness-in-tests (c9, fires unrecorded)
- bash-xtrace-fd-inheritance-breaks-script (c9, fires unrecorded)
- g5-review-must-run-all-tier1 (c9, fires unrecorded)
- lane-skill-skip-needs-explicit-justification (c10, fires unrecorded)
- reviewer-off-script-explore-instead-of-findings (c10, fires unrecorded)
- reviewer-scope-lock-misses-process-shape (c10, fires unrecorded)
- reviewer-model-must-be-pinned-for-reproducibility (c9, fires unrecorded)
- parser-drops-nested-heading-content (c9, fires unrecorded)
- wire-hooks-must-dedup-before-append (c10, fires unrecorded)
- wire-hooks-rename-registry-over-hardcoded-map (c9, fires unrecorded)
- evolve-improve-must-have-separate-artifacts (c9, fires unrecorded)
- new-rule-must-be-registered-in-manifest (c9, fires unrecorded)
- worktree-delete-breaks-claude-skills-symlinks (c10, fires unrecorded)
- opencode-model-list-is-user-configured-not-vendor-registry (c9, fires unrecorded)
- parser-drops-nested-heading-content (c9, fires unrecorded)
- atomic-wi-allocation-via-wx-flag (c9, fires unrecorded)
- self-exclusion-needs-basename-match-for-monolithic (c9, fires unrecorded)
- closeout-consistency-as-tier1-gate (c9, fires unrecorded)
- skills-need-preflight-to-fail-fast (c9, fires unrecorded)
- never-return-raw-playwright-to-parent (c9, fires unrecorded)
- sdkg-primitive-layer-generalizes-stored-knowledge-decay (c9, fires unrecorded)
- competitive-grounding-must-be-default-not-keyword-gated (c9, fires unrecorded)
- gate-must-read-not-fetch (c9, fires unrecorded)
- knowledge-gap-records-not-blocks (c8, fires unrecorded)
- git-rm-cached-on-tracked-file-deletes-from-pr (c9, fires unrecorded)
- svc-pre-commit-auto-stages-session-contract (c8, fires unrecorded)
- author-code-reproduces-the-pattern-it-was-meant-to-prevent (c9, fires unrecorded)
- success-flag-asserts-are-not-provider-fidelity-tests (c9, fires unrecorded)
- provider-chain-inner-side-effects-need-inner-try-catch (c9, fires unrecorded)
- wi-closure-must-re-read-the-why (c8, fires unrecorded)
- tests-must-declare-tier-or-credit-state-explicitly (c9, fires unrecorded)
- e2e-reporter-env-parity (c9, fires unrecorded)
- base44-e2e-otp-connector-first (c9, fires unrecorded)
- pre-post-validation-loop (c9, fires unrecorded)
- cross-ref-workflow-dispatch-coherence (c10, fires unrecorded)
- completion-guard-foreign-claim-resolution (c8, fires unrecorded)
- cli-prompt-packages-stdin-not-argv (c8, fires unrecorded)
- review-package-merge-base-lens (c8, fires unrecorded)
- marker-codegen-byte-identity-first (c9, fires unrecorded)
- rebase-orphans-tree-bound-notes (c8, fires unrecorded)
- host-settings-schema-live-verify-before-write (c9, fires unrecorded)
- diet-summaries-must-quote-not-recall (c9, fires unrecorded)
