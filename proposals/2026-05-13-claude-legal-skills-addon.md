# Framework Evolution — 2026-05-13 — Add Claude Legal Skills as External Addon

**Status:** DRAFT

## Method
Knowledge extraction on `anthropics/knowledge-work-plugins/legal` performed on 2026-05-13. The skills use Methodology-as-Code (YAML playbooks) and 20+ MCP connectors.

## Findings (by priority)

### P1 — Integrate partial legal capabilities into launch skills
**Evidence:** The repo features robust `/triage-nda` and `/compliance-check` skills.
**Impact:** `launch-strategy` and `launch-knowledge` lack automated legal verification for startups handling initial vendor NDAs or basic compliance.
**Proposed fix:** Add `anthropics/knowledge-work-plugins/legal` as an External Addon. Wire `launch-strategy` and `launch-knowledge` to invoke NDA triage and compliance check skills when evaluating partner agreements. Focus on the startup-relevant subset.
**Confidence:** HIGH

### P2 — Provide legal MCP recommendations
**Evidence:** Legal skills depend on MCPs to services like DocuSign, Slack, and Free Law Project.
**Impact:** `plan-capabilities` lacks legal MCP recommendations.
**Proposed fix:** Enhance `plan-capabilities` to recommend basic file-reading MCPs mapped to legal skills.
**Confidence:** MEDIUM
