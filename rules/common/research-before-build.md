---
description: Analyze locally before building; external research only when researchDecision() requires it
scope: project
stack: universal
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
---

# Analyze Before Building

Repository inspection is analysis, not research. Before new implementation, inspect the repo, installed packages and local docs, and reuse a proven in-repo or already-cited approach when it covers the requirement. There is no mandatory external research. Gate any external lookup with `researchDecision(question)` (`scripts/lib/research-decision.mjs`) and invoke `research` only on `external_research_required`, bound to its `requesting_decision_id`/`requesting_task_id`; re-evaluate before unblocking. Never fabricate a `research` receipt when only local analysis ran. When research runs: local analysis, package registries, GitHub code search, vendor docs, then WebSearch last.
