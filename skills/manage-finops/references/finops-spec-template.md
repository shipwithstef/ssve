# FinOps Spec Template

**Project**: [Project Name]
**Feature/System**: [e.g., Square POS Integration / Global Launch]
**Author**: `manage-finops`
**Status**: [DRAFT / BASELINED]
**Revision**: 1.1

---

## 1. Executive Summary (The ROI Pitch)
A 3-sentence summary of the financial impact. What are we spending, what are we saving/earning, and what is the payback period?

---

## 2. Infrastructure Cost Breakdown (Multi-Scale)
Detailed component-level costs at various growth stages.

| Component | Provider/Service | Monthly (MVP: 100 users) | Monthly (Scale: 10k users) | Monthly (Massive: 100k users) |
|-----------|------------------|--------------------------|---------------------------|------------------------------|
| **Web/API Servers**| [e.g., Vercel Pro] | $20 | $150 | $800 |
| **Database** | [e.g., Supabase Pro] | $25 | $100 | $500 |
| **Storage/CDN** | [e.g., AWS S3/CF] | $0 (Free tier) | $50 | $350 |
| **API Costs (AI)** | [e.g., OpenAI / Groq]| $5 | $200 | $1,500 |
| **Comm (Email/SMS)**| [e.g., SendGrid] | $0 | $90 | $300 |
| **TOTAL** | | **$[Sum]** | **$[Sum]** | **$[Sum]** |
| **Per User Cost** | | **$[Avg]** | **$[Avg]** | **$[Avg]** |

---

## 3. Unit Economics & Marginal Costs
- **Marginal Webhook Cost**: Cost to process 1,000 inbound webhooks (e.g., from POS).
- **Marginal AI Cost**: Cost of one "High-Cognition" user interaction.
- **CAC:LTV Ratio**: Target > 3:1.
- **The "Cliff"**: Identify exactly when the free tier exhausts (e.g., "At 1,001 users, costs jump from $0 to $25/mo").

---

## 4. Profitability Plan (P&L Projection)
Based on expected user tier distribution.

| Tier | Price/mo | Expected % | Revenue (1,000 users) | Cost (1,000 users) | Net Margin |
|------|----------|------------|-----------------------|--------------------|------------|
| **Free** | $0 | 70% | $0 | $[Cost] | -100% |
| **Pro** | $19.99 | 20% | $3,998 | $[Cost] | [Margin] |
| **Business**| $99.99 | 10% | $9,999 | $[Cost] | [Margin] |
| **TOTAL** | | 100% | **$[Total]** | **$[Total]** | **$[Total]** |

---

## 5. Budget Allocation & Reserve Strategy
Which tools are we paying for NOW vs. LATER?

| Tool | Monthly | Milestone Accel | Decision | Rationale |
|------|---------|-----------------|----------|-----------|
| [Tool A] | $[Cost] | 1-10 Score | **ALLOCATE** | [Why now?] |
| [Tool B] | $[Cost] | 1-10 Score | **DEFER** | [Why later?] |
| **RESERVE** | | | **$[Unspent]** | Held for scaling winning channels. |

---

## 6. Financial Decision Synthesis (The 12-Section Format)
For major decisions (e.g., "Vercel vs. Hetzner"), use the **mandatory 12-section format** from `_shared/product-question-format.md`.

---

## 7. Provenance & Verification
- `[FROM-CODE]` — [Observed config/file]
- `[FROM-SPEC]` — [Referenced requirement]
- `[FROM-RESEARCH]` — [External pricing data]
- `[ASSUMED]` — [Inference]

---

## 8. Next Financial Checkpoint
Condition for review (e.g., "Review when MAU hits 500 or budget reserve drops below 20%").
