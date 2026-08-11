# Infra Feature Spec Template

Source: `proposals/done/2026-04-30-infra-project-support.md` § 17.4

Use this template for any spec written for an `infra-*` lane (Lanes 8-12). All three dimensions (FinOps, Security, Scalability) are MANDATORY. Tier-1 validator `validate-infra-spec-dimensions.sh` (added in WI-SPINE-004) enforces presence and non-empty content.

---

## Goal

What infra capability is being added/changed/removed?

## Lane

`infra-greenfield` | `infra-feature` | `infra-migration` | `infra-incident` | `infra-cost-optimization`

## Personas

Operator (on-call) | Finance (FinOps) | Security (compliance) | Developer (consumer of the infra)

---

## FinOps

**Cost envelope:** $X/mo
**Per-unit target:** $Y per 1k requests (or per-tenant, per-feature, etc.)
**Expected delta from baseline:** ±$Z
**Justification:** ...

## Security

**Threat model:** STRIDE summary + top 3 risks
**IAM scope:** principal → resource → action matrix (minimum viable)
**Compliance impact:** SOC2/GDPR/HIPAA controls touched
**Supply chain:** signed images? SBOM? pinned versions?

## Scalability

**Peak load contract:** RPS + p95 latency + concurrency
**Capacity headroom:** % minimum at peak
**Failure modes:** AZ loss, region loss, dependency loss → expected behavior
**RTO / RPO:** declared values

---

## SLO Contract

What service-level objective does this protect / introduce / change?

## Blast Radius

What's the worst case if this change breaks? Which downstream services / users / SLOs are affected?

## Rollback Plan

How do we revert if SEV-1/2 is detected post-apply? Reference the cutover-runbook (for migrations) or runbook (for features).

## Acceptance Criteria

AC1, AC2, ... — testable, measurable, SLO-tied where applicable.
