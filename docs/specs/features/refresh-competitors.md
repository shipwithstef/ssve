# Feature: refresh-competitors Skill + Raise Competitor Floor to 30 + analyze-competitors Split

**Status:** BASELINED
**Type:** Enabler
**Consumers:** `analyze-competitors`, `validate-feature`, `write-spec`, `route-workflow`, `schedule`
**Priority:** Medium
**Created:** 2026-05-04
**WI:** WI-143
**Source:** `docs/specs/work-items/WI-143.md`
**Builds-on:** WI-142 (knowledge-base read path)
**Companion:** WI-142 (prerequisite)

---

## Problem Statement

WI-142 gave the framework a knowledge-base read path. Three maintenance problems remain:

1. **Knowledge base goes stale** — no async refresh mechanism.
2. **Competitor floor too low** — ~20 competitors miss 90th-percentile patterns.
3. **`analyze-competitors` conflates** one-shot deep-dive vs scheduled diff.

## User Stories & ACs

See `docs/specs/work-items/WI-143.md` for full ACs (REF-01 through REF-15).

## Technical Design

See spec § Technical Design for architecture, data model, and cost model.

## Out of Scope

- Cross-project shared knowledge base
- Real-time monitoring
- Competitive intelligence dashboard

## Industry Grounding

**Source:** `docs/specs/analyze-competitors.data.json` (framework-internal enabler; no product competitor dataset applies)
**Landscape state:** inapplicable
**Gate verdict:** SKIP
**Branch taken:** inapplicable

### What the industry does (baseline from training + live data)

Framework-internal competitor-refresh workflows are closer to product-intelligence operations than to a customer-facing feature. Comparable systems keep tracked competitors fresh with scheduled scans, source timestamps, and diff-oriented summaries rather than one-time static reports.

| Competitor | Mechanism | Path | Cost / Constraint |
|-----------|-----------|------|-------------------|
| Product-intelligence tooling | Scheduled competitor refresh and change summaries | Recurring watchlists plus source snapshots | Requires maintained source quality and freshness checks |
| Agentic development frameworks | Ad hoc research refresh before planning | Manual research step when stale | Cheaper but easy to skip without a gate |

### What we're doing

The framework splits one-shot `analyze-competitors` work from recurring `refresh-competitors`, raises the expected competitor floor, and keeps freshness visible through framework validators and state.

### Why we differ (or align)

This aligns with product-intelligence practice by treating competitor knowledge as a maintained dataset instead of static launch research. The implementation differs from commercial dashboards because svc stores the refresh contract in skill docs and local artifacts rather than a hosted monitoring UI.

### Reversibility

Two-way door. The refresh cadence, competitor floor, and artifact shape can be changed without affecting shipped product behavior.

---

*Feature implemented in PR #60 (2881fa7).*
