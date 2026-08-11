# Vision Sync Output

**Skill:** write-vision  
**Run Date:** 2026-04-03  
**Intent:** create  
**Mode:** scratch  
**Repo Mode:** bootstrap  
**Target:** `docs/specs/vision.md`  
**Apply:** false (proposal only)

---

## 1) Proposed Changes

### Section 1: North Star

| Field | Value |
|---|---|
| **Section** | 1) North Star |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | "Help every AI practitioner instantly discover what the industry is learning right now and get a personalized path to learn it themselves, across any deployment context they choose." |
| **Reason** | Establishes the core outcome: the intersection of trend discovery and personalized learning, scoped to AI/ML. Includes "any deployment context" to anchor the three-mode requirement at the highest level. |

### Section 2: Problem Statement

| Field | Value |
|---|---|
| **Section** | 2) Problem Statement |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Two-part problem definition: (1) discovery overload across fragmented social platforms, (2) learning path paralysis once a trend is identified. Includes three root causes explaining persistence. |
| **Reason** | The user's prompt implies both problems but does not separate them. Making them explicit prevents the product from solving only one half (e.g., building just a trend tracker without learning paths, or a learning recommender without trend awareness). |

### Section 3: Who We Serve

| Field | Value |
|---|---|
| **Section** | 3) Who We Serve |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Three primary user types: independent practitioners, team leads/managers, and operators (hosted-for-profit). Two secondary types: career transitioners, enterprise L&D teams. Defers detailed personas to build-personas (Phase 2). |
| **Reason** | The three deployment modes imply three distinct user types with different needs. The operator persona is particularly important -- they are not end-users but a business-model stakeholder who must be explicitly served. |

### Section 4: Value Proposition

| Field | Value |
|---|---|
| **Section** | 4) Value Proposition |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Five differentiators: (1) real-time multi-platform trend aggregation, (2) trend-to-learning-path bridge as core value, (3) three deployment modes for three business models, (4) personalized skill tracking, (5) no platform lock-in via self-hosted free mode. |
| **Reason** | Differentiator #2 (trend-to-learning bridge) is the unique insight. Existing tools do trend tracking OR learning recommendation, not both in a connected flow. Differentiator #3 is architecturally unusual and must be called out as a value prop, not just an implementation detail. |

### Section 5: In-Scope Product Reality (Current)

| Field | Value |
|---|---|
| **Section** | 5) In-Scope Product Reality (Current) |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Explicit statement that nothing is shipped. No code, no APIs, no infrastructure, no users. |
| **Reason** | Greenfield bootstrap requires honest current-state documentation. This section will be populated as the pipeline produces artifacts and code. |

### Section 6: Boundaries and Non-Goals

| Field | Value |
|---|---|
| **Section** | 6) Boundaries and Non-Goals |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Six non-goals (not a social client, not a course platform, not general-purpose, not a paper search engine, not a job board, not a real-time alerting system). Four scope boundaries (English only, five platforms, BYOK for free mode, hosted-for-profit is architecture not first-party SaaS). |
| **Reason** | Each non-goal addresses a plausible adjacent product that stakeholders might assume is in scope. The "not a course platform" boundary is critical -- it prevents the team from building content hosting when the value is in aggregation and recommendation. |

### Section 7: Product Principles

| Field | Value |
|---|---|
| **Section** | 7) Product Principles |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Seven principles: signal over noise, learning paths as the product, deployment flexibility as a feature, BYOK as trust anchor, transparent recommendations, composable over monolithic, minimal data retention. |
| **Reason** | Principles are designed to resolve the most likely tradeoff tensions: (a) showing more trends vs. better trends, (b) optimizing one deployment mode at the expense of others, (c) collecting data for recommendations vs. respecting user privacy in self-hosted modes. |

### Section 8: Success Definition

| Field | Value |
|---|---|
| **Section** | 8) Success Definition |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | North-star metric: Weekly Active Learners (WAL). Six supporting metrics including trend-to-learn conversion, learning path completion, trend freshness, platform coverage, deployment mode distribution, operator activation rate. Three anti-metrics: time in app, trend volume, notification engagement. |
| **Reason** | WAL was chosen over "daily active users" because the product's purpose is learning, not daily engagement. Anti-metrics are essential for this product because the obvious engagement metrics (time in app, notification opens) actively conflict with the mission of getting users to leave and learn. |

### Section 9: Evidence Anchors

| Field | Value |
|---|---|
| **Section** | 9) Evidence Anchors |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Source precedence order (runtime > status docs > specs). Two initial anchors: this vision document and the user prompt. |
| **Reason** | Establishes the evidence framework for future grounded-mode runs. Currently minimal because no implementation artifacts exist. |

### Section 10: Vision Editing Protocol

| Field | Value |
|---|---|
| **Section** | 10) Vision Editing Protocol |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Proposal-first workflow with five steps, evidence requirements for three claim types, conflict handling policy, and semantic versioning scheme for the vision document. |
| **Reason** | Prevents ad-hoc vision edits that introduce drift. The versioning scheme ensures major directional changes (North Star) are tracked differently from incremental refinements. |

### Section 11: Decision Log

| Field | Value |
|---|---|
| **Section** | 11) Decision Log |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Seven initial decisions: product name, three deployment modes, AI/ML scope restriction, five source platforms, English-only V1, BYOK for free mode, opt-in telemetry. Each with rationale and active status. |
| **Reason** | These are the foundational decisions that shape every downstream artifact. Capturing them now, with rationale, prevents future debates about "why did we decide this" and enables informed revisitation. |

### Section 12: Forward-Looking Areas

| Field | Value |
|---|---|
| **Section** | 12) Forward-Looking Areas (Exploration, Not Commitment) |
| **Action** | Add |
| **What Was** | (empty -- greenfield) |
| **What Will Be** | Ten exploration themes: multi-language, additional platforms, collaborative learning, trend prediction, content quality scoring, plugin architecture, general-purpose expansion, mobile app, LLM summaries, operator marketplace. |
| **Reason** | Captures ideas that emerged during vision creation but are explicitly NOT committed. Prevents these from being forgotten while also preventing them from being treated as roadmap items. Each theme traces to a boundary or decision that deferred it. |

---

## 2) Evidence Table

| Claim | Evidence (path:line) | Evidence Type | Confidence | Conflict/Gap |
|---|---|---|---|---|
| AI/ML practitioners face discovery overload across social platforms | User prompt (S1 scenario) | inferred | low | No direct user research or market data to validate severity |
| Learning path paralysis follows trend discovery | User prompt (S1 scenario) | inferred | low | Assumes users want curated paths rather than self-directed exploration |
| Twitter/X, Reddit, HN, LinkedIn, YouTube are the key signal sources | User prompt (S1 scenario) | inferred | low | Platform relevance may shift; no data on which platform produces highest-quality AI trend signals |
| Three deployment modes are required: self-hosted free, hosted-for-profit, self-hosted private | User prompt (S1 scenario): explicit requirement | inferred | medium | Explicit in prompt, but no validation that all three modes are commercially viable or technically feasible from a single codebase |
| Self-hosted free mode uses BYOK (bring your own keys) | User prompt (S1 scenario): "user provides their own API keys" | inferred | medium | Directly stated in prompt, but API key management UX and multi-provider support are unvalidated |
| Hosted-for-profit uses subscription model | User prompt (S1 scenario): "charges their users a subscription" | inferred | medium | Directly stated in prompt, but pricing model, margins, and operator economics are unvalidated |
| Self-hosted private supports enterprise/air-gapped use | User prompt (S1 scenario): "a company hosts it internally" | inferred | low | Air-gapped requirement is inferred from enterprise context, not explicitly stated |
| Personalized learning paths are a core feature | User prompt (S1 scenario) | inferred | low | No evidence on what personalization signals matter most (skill level, role, time budget, learning style) |
| Content aggregation spans courses, tutorials, papers, repos | User prompt (S1 scenario) | inferred | low | No evidence on which resource types users value most or how to assess resource quality at scale |
| User profiles with skill tracking are needed | User prompt (S1 scenario) | inferred | low | No validation that users will invest in maintaining skill profiles; cold-start problem is unaddressed |
| Product name "TrendLearner" is appropriate | Not evidenced; selected during vision creation | inferred | low | No brand research, domain availability check, or user perception testing |
| Weekly Active Learners is the right north-star metric | Not evidenced; derived from product principles | inferred | low | Measurement depends on learning platforms providing completion signals, which may not be available |
| English-only is sufficient for V1 | Not evidenced; assumed for complexity reduction | inferred | low | May exclude large AI communities (Chinese, Japanese, Korean AI practitioners) |

---

## 3) Open Questions

### Q1: What is the operator business model for hosted-for-profit?

**Why it matters:** The hosted-for-profit mode implies a B2B2C model where operators resell the platform. The vision must eventually define: What does TrendLearner provide to operators? Is it a white-label platform, a franchised brand, or an API they build on top of? What are the licensing terms?

**Missing source:** No business model documentation, no operator interviews, no competitive analysis of similar multi-tenant platforms.

### Q2: How will social platform API access be sustained?

**Why it matters:** Twitter/X, Reddit, and other platforms have increasingly restricted API access and raised prices. The trend scraping capability -- which is foundational -- depends on affordable, reliable API access. If APIs become prohibitively expensive or unavailable, the entire product premise is at risk.

**Missing source:** No API cost analysis, no fallback strategy (e.g., RSS, web scraping, community-contributed data), no assessment of terms-of-service compliance.

### Q3: How does the recommendation engine avoid becoming a black box?

**Why it matters:** Product Principle #5 requires transparent recommendations, but the prompt specifies "AI/ML topic extraction and categorization" and "personalized learning path recommendations" -- both of which likely involve ML models. Transparency and ML-driven ranking are in tension.

**Missing source:** No technical design for the recommendation engine, no definition of what "transparent" means in practice (explainable scores? source attribution? user-controllable weights?).

### Q4: What is the cold-start experience?

**Why it matters:** A new user has no skill profile, no history, and no preferences. The product must deliver value immediately (trend browsing) while progressively building personalization. If the cold-start experience is poor, users will not invest in building a profile.

**Missing source:** No UX research, no onboarding flow design, no analysis of what minimal information enables useful personalization.

### Q5: Is the self-hosted private mode truly air-gapped?

**Why it matters:** Air-gapped deployment fundamentally changes architecture decisions: no external API calls for trend data (must be imported), no LLM API calls (must use local models), no telemetry. If air-gapped is required, it may need a substantially different data pipeline.

**Missing source:** User prompt says "a company hosts it internally for their own team's use" but does not specify air-gapped. This is an assumption that needs validation.

### Q6: How will learning resource quality be assessed?

**Why it matters:** The product recommends external resources (courses, tutorials, papers, repos). If recommendations include low-quality or outdated resources, trust erodes quickly. But quality assessment at scale is a hard problem.

**Missing source:** No quality scoring methodology, no curator workflow, no community feedback mechanism designed.

### Q7: What is the trend detection cadence and methodology?

**Why it matters:** The vision states "not a real-time alerting system" and targets "< 48 hours from first social signal." But the methodology for determining what constitutes a "trend" vs. noise is undefined. This is the core algorithmic challenge.

**Missing source:** No signal processing design, no definition of trend thresholds, no evaluation of false-positive vs. false-negative tradeoffs.

---

## 4) Approval Gate

### Ready to apply

All 12 sections of the vision document are ready for application as an initial baseline. This is a `mode=scratch` bootstrap run, so all content is inference-based and clearly labeled as such.

Specifically ready:
- **Section 1 (North Star):** Captures the core outcome from the user prompt.
- **Section 2 (Problem Statement):** Articulates the two-sided problem implied by the prompt.
- **Section 3 (Who We Serve):** Identifies user types implied by the three deployment modes.
- **Section 4 (Value Proposition):** Extracts differentiators from the prompt requirements.
- **Section 5 (In-Scope Product Reality):** Accurately reflects greenfield state.
- **Section 6 (Boundaries and Non-Goals):** Prevents the most likely scope-creep vectors.
- **Section 7 (Product Principles):** Provides tradeoff resolution framework.
- **Section 8 (Success Definition):** Defines metrics aligned with the mission, not vanity.
- **Section 9 (Evidence Anchors):** Establishes framework for future grounded-mode runs.
- **Section 10 (Vision Editing Protocol):** Prevents ad-hoc vision drift.
- **Section 11 (Decision Log):** Captures all foundational decisions with rationale.
- **Section 12 (Forward-Looking Areas):** Parks deferred ideas without committing to them.

### Blocked until clarified

No sections are blocked. However, the following items should be prioritized for clarification before downstream skills (build-personas, spec authoring) consume this vision:

1. **Q1 (Operator business model):** Persona-builder cannot create an accurate operator persona without understanding the business relationship. **Recommended action:** Clarify with stakeholder before Phase 2.

2. **Q2 (API access sustainability):** Tech design (Phase 6) cannot make architecture decisions without understanding API constraints and costs. **Recommended action:** Conduct API availability and cost analysis before Phase 6.

3. **Q5 (Air-gapped requirement):** Architecture for self-hosted private mode diverges significantly if air-gapped is required. **Recommended action:** Confirm with stakeholder before Phase 3 spec work.

### Mode notes (scratch)

- All claims in the Evidence Table are typed as `inferred` because no implementation artifacts, user research, or market data exist.
- Confidence is `low` for most claims (derived from a single user prompt) and `medium` for claims directly stated in the prompt.
- No synthetic citations have been presented as facts.
- This vision should be re-validated with `mode=grounded` as soon as implementation artifacts exist.
