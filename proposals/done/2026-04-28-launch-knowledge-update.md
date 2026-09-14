# Proposal: Launch Knowledge Update — Bulgaria + PostHog Startup Program

**Date:** 2026-04-28
**Source:** Research during Example Marketplace marketing campaign setup
**Target:** `launch-knowledge/SKILL.md` + `references/launch-knowledge/`

---

## Summary

During Example Marketplace marketing campaign setup, I researched:
1. PostHog startup program ($50K credits)
2. Bulgarian company registration (BULSTAT freelancer vs ET/EOOD/OOD)
3. EU Directive 2019/1151 (fast company formation)
4. Marketing tools stack (Apollo, Lemlist, PostHog, GA4, etc.)

This knowledge should be persisted in the framework for future builders.

---

## Knowledge to Add

### 1. PostHog Startup Program

**Location:** `references/launch-knowledge/startup-programs.md`

**Eligibility:**
- <2 years old
- <$5M raised
- Not acquired

**Benefits:**
- $50,000 in PostHog credits (12 months)
- Welcome pack (founder merch)
- Partner benefits: Incident.io ($1,500 off), Speakeasy (50% off 6 months), Chroma ($5K credit)
- Monthly founder newsletter

**What $50K covers:**
- ~1 billion product analytics events
- ~10M session recordings
- ~500M feature flag requests

**Post-credit cost:** $50-200/month depending on usage

**Application:** https://app.posthog.com/signup → startup page → auto-approved

**Key insight:** PostHog replaces Mixpanel + GA4 + Hotjar for free under this program.

---

### 2. Bulgarian Company Registration

**Location:** `references/launch-knowledge/jurisdictions/bulgaria.md`

**Options:**

| Type | BULSTAT Freelancer | EOOD (Single-member LLC) | OOD (LLC) |
|------|-------------------|--------------------------|-----------|
| Founders | 1 person | 1 person | 2+ people |
| Liability | Unlimited | Limited | Limited |
| Minimum capital | None | 2 BGN (~€1) | 2 BGN (~€1) |
| Setup cost | ~50-100 BGN (~€25-50) | ~200-400 BGN (~€100-200) | ~200-400 BGN (~€100-200) |
| Monthly costs | 0-50 BGN | 250-400 BGN (~€125-200) | 250-400 BGN (~€125-200) |

**EU Directive 2019/1151 benefits:**
- Online registration (no physical visits)
- Max 5 working days
- Single point of contact
- Digital templates

**Recommendation:** Start with BULSTAT, upgrade to EOOD when revenue >€500/month

---

### 3. Marketing Tools Stack

**Location:** `references/launch-knowledge/marketing-tools.md`

**Free-first strategy:**

| Tool | Purpose | Free Tier | Paid Tier |
|------|---------|-----------|-----------|
| PostHog | Analytics, session replay, feature flags | 1M events/month | $0.00005/event |
| Apollo | Lead sourcing | 50 contacts/month | $49/month |
| Lemlist | Cold email | 14-day trial | $63/month |
| HubSpot | CRM | Unlimited contacts | $20/month |
| GA4 | Web analytics | Unlimited | Free |
| Google Search Console | SEO monitoring | Unlimited | Free |
| NeverBounce | Email verification | Pay as you go | $0.008/email |

**PostHog startup program:** $50K credits = all analytics free for 12 months

---

### 4. Cold Outreach Best Practices

**Location:** `references/launch-knowledge/cold-outreach.md`

**Benchmarks:**
- Open rate: 27.7% average, 50%+ excellent
- Reply rate: 4-5.8% average, 15-25% excellent
- Meeting booking: 0.5-1% average, 2.3%+ excellent

**Key insights:**
- Timeline hooks outperform problem hooks by 3.4x
- Personalization drives 50-250% more replies
- 25-75 words optimal, 83% more replies under 75 words
- Thursday peaks at 6.87% reply rate
- First follow-up adds 49% more replies

**Frameworks:**
- PAS (Problem, Agitate, Solution)
- BAB (Before, After, Bridge)
- QVC (Question, Value, CTA)
- 3C's (Compliment, Case Study, CTA)

---

### 5. Directory Submission Strategy

**Location:** `references/launch-knowledge/directory-submissions.md`

**Priority directories:**

| Directory | DR | Traffic | Category |
|-----------|------|---------|----------|
| Product Hunt | 92 | 10M+ | Startup |
| G2 | 91 | 50M+ | B2B Review |
| Capterra | 88 | 30M+ | B2B Review |
| AlternativeTo | 85 | 15M+ | Software |
| SaaSHub | 75 | 2M+ | SaaS |

**Three hard rules:**
1. Foundation before submission (landing page live, pricing visible)
2. Destination pages before directories (alternative pages, use-case pages)
3. Positioning varies by directory type

---

## Files to Create/Update

### New Files

1. `references/launch-knowledge/startup-programs.md`
   - PostHog startup program details
   - Other SaaS startup programs (AWS, Google Cloud, etc.)

2. `references/launch-knowledge/jurisdictions/bulgaria.md`
   - Company registration options
   - EU Directive 2019/1151 benefits
   - Tax implications

3. `references/launch-knowledge/marketing-tools.md`
   - Free-first strategy
   - Tool comparisons
   - Setup guides

4. `references/launch-knowledge/cold-outreach.md`
   - Benchmarks
   - Frameworks
   - Best practices

5. `references/launch-knowledge/directory-submissions.md`
   - Priority directories
   - Submission strategy
   - Positioning variants

### Files to Update

1. `launch-knowledge/SKILL.md`
   - Add references to new knowledge files
   - Update startup programs section
   - Add jurisdiction-specific guidance

2. `references/knowledge/INDEX.md`
   - Add entries for new knowledge domains

---

## Implementation Plan

### Phase 1: Create Knowledge Files (1-2 hours)
- [ ] Create `references/launch-knowledge/startup-programs.md`
- [ ] Create `references/launch-knowledge/jurisdictions/bulgaria.md`
- [ ] Create `references/launch-knowledge/marketing-tools.md`
- [ ] Create `references/launch-knowledge/cold-outreach.md`
- [ ] Create `references/launch-knowledge/directory-submissions.md`

### Phase 2: Update Skill (30 min)
- [ ] Update `launch-knowledge/SKILL.md` with references
- [ ] Update `references/knowledge/INDEX.md`

### Phase 3: Validate (15 min)
- [ ] Run tier-1 validation
- [ ] Verify all paths exist
- [ ] Commit and push

---

## Benefits

1. **For future builders:** Instant access to startup programs, jurisdiction guides, and marketing playbooks
2. **For Example Marketplace:** Knowledge persists across sessions, prevents re-research
3. **For framework:** Launch-knowledge skill becomes comprehensive

---

## Risks

1. **Maintenance:** Startup programs change, jurisdictions update laws
2. **Scope creep:** Could expand to cover all EU countries, all startup programs
3. **Accuracy:** Need to verify details periodically

**Mitigation:** Add staleness checks (30 days for startup programs, 90 days for jurisdictions)

---

## Next Steps

1. Review this proposal
2. Approve or modify scope
3. Implement Phase 1
4. Commit and push
