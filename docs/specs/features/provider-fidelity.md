# Feature: Provider Fidelity Evidence

**Status:** BASELINED
**Type:** Framework Evidence Contract
**Consumers:** route-workflow, validate-feature, write-spec, plan-changeset, test-journeys, track-visuals, review-gate, verify-promotion
**Priority:** High
**Created:** 2026-05-12
**WI:** WI-306
**Source:** `docs/specs/work-items/WI-306.md`

---

## Problem Statement

Generated or integration-backed outputs can appear successful while coming from
the wrong provider, an unapproved fallback, a placeholder, or a draft-only state.
When the user or spec names a primary provider, closeout must prove provider
identity, source evidence, fallback policy, and saved outcome.

## Contract

The delivery graph evidence family is `provider_fidelity`.

The compiler marks that family `required` when risk flags include
provider-backed, generated-content, AI-generation, primary-provider, or
saved-outcome work. A completed graph cannot classify as framework-complete
until the family is `satisfied` or `n/a`.

The canonical artifact is:

`docs/specs/features/test-evidence/<run>/PROVIDER_FIDELITY_EVIDENCE.md`

The canonical template is:

`docs/specs/features/test-evidence/PROVIDER_FIDELITY_EVIDENCE.template.md`

## Acceptance Criteria

| AC | Description | Required Proof |
|---|---|---|
| PF-01 | Provider-backed/generated work compiles with `provider_fidelity: required`. | `validate-delivery-graph-compiler.sh` |
| PF-02 | Evidence records requested provider, primary provider, provider used, capability, fallback policy, source evidence requirement, fallback state, saved-state result, and final result. | `scripts/validate-provider-fidelity-evidence.mjs` |
| PF-03 | Wrong-provider, fallback, mock, placeholder, uploaded substitute, and draft-only evidence fails unless fallback is explicitly approved. | `validate-provider-fidelity-evidence.sh` |
| PF-04 | Visual/generated evidence includes semantic relevance and visual quality results. | `scripts/validate-provider-fidelity-evidence.mjs` |
| PF-05 | Project-specific fallback tokens are configured outside the universal validator. | `.svc/provider-fidelity-fallback-signals.json` or `--fallback-signals <json>` |
| PF-06 | Review and promotion gates require valid provider-fidelity evidence when the delivery graph marks it required. | `review-gate/SKILL.md`, `verify-promotion/SKILL.md`, closeout classification validator |

## Project-Local Fallback Signals

Universal detection is limited to generic fallback language. Product-specific
tokens belong in the target project's config:

```json
{
  "fallback_source_patterns": ["\\bexample_provider_upload\\b"]
}
```

The validator discovers `.svc/provider-fidelity-fallback-signals.json` while
walking upward from the evidence file, or accepts an explicit
`--fallback-signals <json>` argument.

## Required Files

| File | Role |
|---|---|
| `references/provider-fidelity.md` | Human-facing provider evidence protocol. |
| `scripts/validate-provider-fidelity-evidence.mjs` | Deterministic provider/source/saved-outcome validator. |
| `test-framework/evals/tier-1/validate-provider-fidelity-evidence.sh` | Replay coverage for primary provider, wrong provider, draft-only, approved fallback, and project-local fallback config. |
| `concerns/provider-fidelity.md` | Intent-time concern routing for provider-backed/generated work. |

## Out Of Scope

- Hardcoding project-specific fallback tokens in universal framework code.
- Replacing human/LLM review of generated output quality when the evidence row
  explicitly requires semantic or visual judgment.
- Treating an unsaved draft as a persisted saved outcome.

## Industry Grounding

**Source:** Framework-internal evidence-contract improvement; no external
product market applies.

**Landscape state:** inapplicable

**Gate verdict:** SKIP

**Branch taken:** inapplicable

### What the industry does

Provider-backed generation systems usually track source/provider metadata,
fallback policy, persisted output, and human or automated quality review. The
exact evidence artifact varies by stack.

### What we're doing

The framework stores local provider-fidelity evidence and validates provider
identity, source fields, fallback approval, saved state, and generated-output
quality result fields before closeout.

### Why we differ or align

This aligns with source traceability and fallback approval practice while
keeping provider-specific fallback tokens in project-local config instead of
the universal framework validator.

### Reversibility

Two-way door. Projects can add local fallback patterns, and the universal
validator can add generic fallback terms without encoding product-specific
tokens.

## Verification

Run:

```bash
bash test-framework/evals/tier-1/validate-provider-fidelity-evidence.sh
bash test-framework/evals/tier-1/validate-delivery-graph-compiler.sh
bash test-framework/evals/tier-1/validate-delivery-graph.sh
bash test-framework/evals/tier-1/validate-delivery-graph-closeout-classification.sh
```
