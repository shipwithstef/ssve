# Blend Plan: Lucas Patiri UGC Viral Growth & Framework Proposals

**Source:** http://x.com/lucaspatiri_/status/2062627926022238586
**License:** Public Domain / Social Content Heuristics
**Date:** 2026-06-05
**Previous blend:** none (first blend of this source)

---

## Summary
*   **3 patterns to blend** (structured subagent briefing, raw platform-native aesthetics, down-funnel visual proof gating).
*   **4 other framework proposals re-evaluated and triaged** (legal skills addon, route-workflow research trigger, feature-like bugfix product question escalation, session/design/visual proof guard).

| # | Pattern / Proposal Opportunity | Target | What breaks without it | What changes after |
|---|---|---|---|---|
| **1** | **Structured Creator/Subagent Briefing** | `plan-changeset/SKILL.md` | Subagent task graphs lack standard formatting, hooks, and style references, leading to drift. | Every generated subagent prompt / task brief must contain objective, audience constraints, explicit format, and 3-5 style examples. |
| **2** | **Raw/Native Aesthetics Standard** | `references/anti-patterns.md` | LLM outputs contain over-polished "AI slop" or verbose boilerplate templates that violate stack code conventions. | Strengthens AP-22 (AI Slop blacklist) to explicitly reject generic or over-engineered boilerplate in favor of raw, stack-native implementations. |
| **3** | **Down-Funnel Verification (G7 Visual Inventory)** | `review-gate/SKILL.md` + `verify-promotion/SKILL.md` | Verification relies on local compiler pass (vanity metrics) while user-visible degraded UI fallback card states ship broken. | Visual validation must invenotry multiple UI states (populated, empty, degraded source, mobile viewports) before promotion closeout. |
| **4** | **Feature-like Bugfix Escalation** | `diagnose-bug/SKILL.md` + `route-workflow/SKILL.md` | Defects that change data model or UI semantics proceed like a narrow repair until late review, causing spec drift. | Bugfixes that mutate the data contract, journeys, or acceptance criteria automatically trigger feature-class questions. |
| **5** | **Session Binding & Design Visual Guard** | `route-workflow/SKILL.md` + `track-visuals/SKILL.md` | Active session contract remains bound to unrelated WIs, and design gates are bypassed during execution. | Binds active sessions to targeted WIs, enforces post-design gates, and rejects generic placeholder copy like `Business details unavailable`. |
| **6** | **Route-Workflow Research Trigger** | `route-workflow/SKILL.md` | Router misses natural provider/API uncertainty, leading to plans written on stale documentation assumptions. | Proactively inserts a blocking `research` node into the task graph before normal lane steps when external API uncertainty is detected. |
| **7** | **Legal & Compliance Plugin Addon** | `plan-capabilities/SKILL.md` + `launch-strategy/SKILL.md` | Early launch/partnership strategy lacks automated compliance check and basic NDA triage. | Recommends file-reading MCPs and wires `anthropics/knowledge-work-plugins/legal` as an optional compliance/NDA audit addon. |

---

## Assessment A: Blend Opportunities (Techniques to Absorb)

### 1. Structured Creator/Subagent Briefing
*   **From:** UGC Mistake #1 (vague or missing briefs)
*   **Into:** `plan-changeset/SKILL.md` (task prompt generation format)
*   **The problem in svc today:** When compiling subagent task briefs in the plan changeset, the generated prompts are often unstructured, missing explicit output parameters, or lacking code-style exemplars. This causes subagents to write code that drifts from the baseline.
*   **How the source solves it:** Outlines a 5-part brief containing: campaign objective (1 sentence), 2-4 key messaging points, audience description, format requirements, and 3-5 visual reference videos.
*   **What this changes in svc:** We will update `plan-changeset` prompt templates. Any subagent dispatch task must generate a structured prompt container including: (a) objective (1 sentence), (b) 2-4 implementation constraints, (c) stack naming conventions, and (d) 3-5 code-style lines or links to exemplar files.
*   **What NOT to take:** Do not take creator marketing copy or campaign-length requirements; focus only on the structural briefing container.
*   **Why this matters:** Prevents subagents from cargo-culting or writing boilerplate that conflicts with existing project conventions, saving developer cycles and tokens.

### 2. Down-Funnel Verification (G7 Visual Inventory)
*   **From:** UGC Mistake #9 (ignoring mid-funnel metrics / cost-per-install vs day-7 retention)
*   **Into:** `review-gate/SKILL.md` (G7 verification) + `verify-promotion/SKILL.md`
*   **The problem in svc today:** Feature promotion depends on local test success (a vanity metric), but the deployed UI may render generic fallback text (such as `Business details unavailable`) in primary user-visible layout positions.
*   **How the source solves it:** Prioritizes down-funnel retention (Day 3/7 engagement by format) over initial acquisition volume (CPI).
*   **What this changes in svc:** The G7 gate must check a visual/E2E state inventory: (a) clean populated, (b) empty/no data, (c) degraded metadata/source, and (d) mobile viewports.
*   **Why this matters:** Catches user-visible rendering issues and broken fallback states before code lands in production.

---

## Assessment B: External Addon Viability

*   **Runtime addon?** NO (for UGC principles); YES (for `anthropics/knowledge-work-plugins/legal`)
*   **License:** MIT (for legal plugins)
*   **Install:** `npx skills add anthropics/knowledge-work-plugins/legal`
*   **Integration point:** Wire to `launch-strategy` and `plan-capabilities` to recommend basic file-reading MCPs and invoke NDAs/compliance checks.

---

## Rethink: Past Blend Reassessment (Other Framework Proposals)

We evaluated the current active draft proposals in `proposals/`:

### 1. Route-Workflow Research Trigger (`2026-05-16-route-workflow-research-trigger-gate.md`)
*   **Verdict:** **IMPROVE**
*   **Action:** Implement immediately. The router must catch natural provider/API uncertainty language (e.g. `vendor api`, `provider docs`, `webhook behavior is unclear`) and insert a blocking `research` task.
*   **Hybrid Opportunity:** Link the research domain gate directly to the task-graph compiling step so the compiled task is automatically cataloged in `references/knowledge/` under the correct taxonomy.

### 2. Feature-like Bugfix Product Question Escalation (`2026-06-01-framework-improvement-feature-like-bugfix-product-questions.md`)
*   **Verdict:** **IMPROVE**
*   **Action:** Implement. Bugfixes that mutate user journeys, UI layout semantics, or database schemas must escalate to full feature-class product questions.
*   **Hybrid Opportunity:** Auto-fill the companion answers using the codebase and spec context in the worktree.

### 3. Session/Design/Visual Proof Guard (`2026-06-01-framework-improvement-session-design-visual-proof-guard.md`)
*   **Verdict:** **IMPROVE**
*   **Action:** Implement. Compose session binding, post-design human checkpoints, and state inventories (empty/degraded) into a single pre-flight validation gate.
*   **Hybrid Opportunity:** Bind these to git notes (`refs/notes/svc-receipts`) to ensure compliance is audit-grade.

---

## Attribution Update
Add to `NOTICES`:
```text
Portions of this framework's outbound B2B marketing heuristics, micro-briefing standard, and down-funnel visual inventory gates are derived from Lucas Patiri's UGC Viral Growth Playbook.
```
