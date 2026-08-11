# Research Sources

## Research Sources

### Official Pricing Pages
- **Hetzner**: https://www.hetzner.com/cloud
- **AWS**: https://aws.amazon.com/pricing/
- **Google Cloud**: https://cloud.google.com/pricing
- **Expo EAS**: https://docs.expo.dev/billing/plans/
- **Railway**: https://railway.app/pricing
- **Render**: https://render.com/pricing
- **Vercel**: https://vercel.com/pricing
- **Netlify**: https://www.netlify.com/pricing/

### Cost Calculators
- **AWS Calculator**: https://calculator.aws/
- **Google Cloud Calculator**: https://cloud.google.com/products/calculator
- **Azure Calculator**: https://azure.microsoft.com/pricing/calculator/


## Best Practices

### Foundational Practices
1. **Start Small** - Begin with free tiers and minimal resources
2. **Monitor Costs** - Set up billing alerts and cost tracking
3. **Optimize Regularly** - Review and optimize monthly
4. **Plan for Growth** - Understand scaling costs before scaling
5. **Use Cost Calculators** - Estimate costs before committing
6. **Leverage Free Tiers** - Maximize free tier usage
7. **Automate Management** - Use scripts and automation tools
8. **Document Decisions** - Keep track of cost decisions and rationale

### Advanced `manage-finops` Practices (See `advanced-finops-framework.md`)
1. **Implement `manage-finops` Framework** - Follow Inform, Optimize, Operate phases
2. **Comprehensive Tagging** - Implement mandatory tags for cost allocation
3. **Right-Size Resources** - Match resources to actual usage patterns
4. **Use Reserved Instances** - Purchase RIs for steady-state workloads
5. **Optimize Serverless** - Right-size memory, optimize duration, reduce cold starts
6. **Kubernetes Cost Management** - Use Kubecost/OpenCost for container cost allocation
7. **Cost Allocation** - Implement showback/chargeback for accountability
8. **Anomaly Detection** - Set up ML-based cost anomaly detection
9. **Multi-Cloud Strategy** - Standardize tagging and reporting across clouds
10. **`manage-finops` Maturity** - Progress through maturity levels systematically


## Integration with Development Workflow

### Pre-Launch Planning
- Use cost calculators to estimate launch costs
- Review free tier options
- Plan phased launch strategy
- Set up cost monitoring

### Launch Phase
- Start with free tiers
- Monitor actual usage
- Set billing alerts
- Track cost vs. budget

### Growth Phase
- Review costs monthly
- Optimize based on usage patterns
- Consider reserved instances for predictable workloads
- Scale resources as needed

### Optimization Phase
- Identify cost-saving opportunities
- Implement optimization strategies
- Right-size resources
- Automate cost management


## Cross-Skill Collaboration & MMR Optimization

### Overview

`manage-finops` expert collaborates with Product Management, architecture Expert, and `research` skills to optimize Monthly Recurring Revenue (MMR) through deep technical understanding, feature-driven proposals, architectural analysis, and evidence-based decision-making.

### Multi-Skill Collaboration Workflow: `manage-finops` ↔ `write-spec` ↔ `design-tech` ↔ Research

**Purpose**: Systematically identify, research, architect, and propose MMR improvement opportunities through cross-functional collaboration with deep technical understanding.

**Enhanced Workflow Pattern**:
```
`manage-finops` analysis → `write-spec` Product Analysis → Research API Understanding → `design-tech` Scaling Analysis → Multi-Skill Brainstorm → `manage-finops` proposal → `write-spec` Prioritization → `design-tech` Implementation Plan → Implementation
```

### Deep API Understanding Requirement

**Critical**: Before proposing MMR improvements involving third-party APIs (e.g., Spoonacular), `manage-finops` and `write-spec` must have deep understanding of:
- API pricing models (free tier vs paid tiers)
- Point costs per operation
- Rate limits and quotas
- Caching strategies and ToS compliance
- Scalability implications
- Cost optimization opportunities

**If API Understanding Missing**:
1. **FinOps/`write-spec` Request Research**: "`research` skill, please analyze [API] pricing, quotas, and usage patterns from repository documentation"
2. **research**: Uses `research` to analyze API docs, code, and configuration
3. **`design-tech` Involvement**: `design-tech` analyzes scalability, caching, and optimization strategies
4. **Multi-Skill Synthesis**: All skills collaborate to understand full picture

### 1. FinOps-Driven MMR Improvement Proposals

**When `manage-finops` Should Initiate Collaboration**:

1. **Revenue Metrics Analysis**
   - Current MMR below target
   - Conversion rate declining
   - Churn rate increasing
   - ARPU (Average Revenue Per User) stagnant
   - LTV:CAC ratio below 3:1

2. **Cost Efficiency Issues**
   - Infrastructure costs > 20% of revenue
   - Cost per free user too high
   - Cost per paid user increasing
   - Unit economics deteriorating

3. **Pricing Optimization Opportunities**
   - Competitor pricing changes
   - Market pricing shifts
   - Feature value misalignment
   - Upsell/cross-sell opportunities

**`manage-finops` proposal Template**:

```markdown
## MMR Improvement Proposal

**Proposed By**: `manage-finops` expert
**Date**: [Current Date]
**Priority**: High/Medium/Low
**Estimated MMR Impact**: $X-X/month
**Estimated Implementation Effort**: X weeks

### Current State Analysis
- **Current MMR**: $X/month
- **Target MMR**: $X/month
- **Gap**: $X/month
- **Key Metrics**:
  - Conversion rate: X%
  - ARPU: $X
  - Churn rate: X%
  - LTV:CAC: X:1

### Proposed Improvement
**Title**: [Clear, specific improvement]
**Description**: [What and why]
**Expected Impact**:
- MMR increase: $X/month
- Conversion rate improvement: +X%
- ARPU increase: +$X
- Other metrics: [specify]

### Research Needed
**Request to write-spec**: 
"Please use the `research` skill to research:
1. [Specific `research` question 1]
2. [Specific `research` question 2]
3. [Competitive analysis needed]

Focus areas:
- Market best practices
- Competitor implementations
- User `research` insights
- Technical feasibility"

### Implementation Plan
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Success Metrics
- [Metric 1]: Target value
- [Metric 2]: Target value
- [Metric 3]: Target value

### Risks & Mitigation
- **Risk 1**: [Description] → Mitigation: [Action]
- **Risk 2**: [Description] → Mitigation: [Action]
```

### 2. Deep API Understanding & Research-Driven Analysis

**Critical Requirement**: Before proposing MMR improvements, `manage-finops` and `write-spec` must deeply understand third-party APIs (e.g., Spoonacular).

**`manage-finops` → Research → `write-spec` → `design-tech` Collaboration Pattern**:

**Step 1: `manage-finops` Identifies Opportunity with API Dependency**
```
FinOps: "I've identified a potential MMR improvement opportunity. 
Current Spoonacular usage: 50 pts/day free tier = only ~10 searches.
Users hit quota quickly, limiting value. I need deep understanding of:
1. Spoonacular API pricing tiers (free vs paid)
2. Point costs per operation (search, details, by-ingredients)
3. Current implementation patterns in our codebase
4. Scalability implications
5. Cost optimization opportunities"
```

**Step 2: `manage-finops` Requests Research for API Understanding**
```
FinOps: "`research` skill, please use `research` to analyze:

**API Understanding Needed**:
1. Spoonacular API pricing structure
   - Free tier: 50 pts/day (what does this mean?)
   - Paid tiers: 150, 500, 2000 pts/day (costs?)
   - Point costs: search (5 pts?), details (2 pts?), by-ingredients (3 pts?)

2. Current Implementation Analysis
   - How is Spoonacular currently used in our codebase?
   - What endpoints are called?
   - What's the current usage pattern?
   - What caching strategies exist?

3. Scalability Analysis
   - How does Spoonacular usage scale with users?
   - What are the bottlenecks?
   - How can we optimize costs?

**Research Sources**:
- Repository code: backend/app/services/spoonacular_client.py
- Repository docs: docs/reference/spoonacular.md
- Repository config: backend/app/core/config.py (SpoonacularConfig)
- Official API docs: spoonacular.com/food-api/docs
- Pricing pages: spoonacular.com/food-api/pricing

**Expected Deliverables**:
- Complete API pricing breakdown (free tier vs paid tiers)
- Point cost analysis per operation
- Current usage pattern analysis
- Scalability implications
- Cost optimization opportunities
- Implementation recommendations"
```

**Step 3: `research` Conducts Deep Analysis**
```
Research: "I'll analyze the repository code and documentation to understand 
Spoonacular API usage. I'll use:
1. Code analysis: Read spoonacular_client.py, quota_tracker.py
2. Documentation analysis: Read spoonacular.md, integration plan
3. Configuration analysis: Read config.py for pricing settings
4. External research: Check official Spoonacular API docs for latest pricing

I'll provide:
- Complete API pricing breakdown
- Point cost analysis
- Current implementation patterns
- Scalability analysis
- Optimization opportunities"
```

**Step 4: `write-spec` Analyzes Product Impact**
```
write-spec: "Based on `research` findings, I'll analyze:
1. How current Spoonacular usage affects user experience
2. What features are limited by quota constraints
3. What features could be built to reduce API dependency
4. What features justify paid tiers (more quota)

I'll propose:
- Feature changes that reduce Spoonacular usage
- Feature additions that justify pricing tiers
- User experience improvements
- Conversion optimization strategies"
```

**Step 5: `design-tech` Analyzes Scaling & Implementation**
```
design-tech: "Based on `research` and `write-spec` analysis, I'll assess:
1. How current architecture handles Spoonacular API calls
2. Scalability implications (what happens at 100, 1000, 10000 users?)
3. Caching strategies and optimization opportunities
4. architecture changes needed for proposed features
5. Cost implications of architectural decisions

I'll propose:
- architecture improvements for cost optimization
- Scaling strategies
- Implementation plans for proposed features
- Technical feasibility assessment"
```

**Step 6: Multi-Skill Brainstorming Session**
```
FinOps: "Let's brainstorm MMR improvements based on our analysis:

**Current State**:
- Spoonacular: 50 pts/day free tier = ~10 searches
- Users hit quota quickly
- No premium features to justify paid tiers

**`write-spec` Proposals**:
- Waste reduction dashboard (reduces Spoonacular dependency)
- Meal planning (uses local recipes, minimal Spoonacular)
- Recipe collections (no Spoonacular needed)

**`design-tech` Analysis**:
- Current caching: 50-min TTL (good)
- Can optimize: by-ingredients default (3 pts vs 5 pts search)
- Can reduce usage: 40-60% with optimization

**`manage-finops` Synthesis**:
- Optimize Spoonacular usage: 40-60% reduction
- Build features that reduce API dependency
- Gate premium features behind paid tiers
- Expected MMR: $760-4,560/month (with features)"
```

**Step 7: `manage-finops` Final Proposal**
```
FinOps: "Based on multi-skill analysis, I propose:

**Phase 1: Optimization (Week 1-2)**
- Optimize Spoonacular usage (by-ingredients default, copy prompts)
- Expected cost reduction: 40-60%
- Expected impact: Better free tier experience

**Phase 2: Feature Development (Week 3-6)**
- Waste reduction dashboard (justifies Starter $9/month)
- Meal plan generator (justifies Pro $29/month)
- Expected MMR impact: $760-4,560/month

**Phase 3: Scaling (Week 7-10)**
- Recipe collections (growth + retention)
- Smart shopping list (high value)
- Expected MMR impact: $3,800-28,500/month"
```

### 3. Deep API Understanding Framework

**When Analyzing Third-Party APIs (e.g., Spoonacular)**:

**Step 1: Research API Pricing & Quotas** (CRITICAL: Check Pricing Model Alignment)
```
Research Request: "Analyze [API] pricing structure from repository and official docs:

1. Free Tier Analysis:
   - What's included? (e.g., 50 pts/day)
   - What operations are available?
   - What are the limitations?
   - How does this scale?

2. Paid Tier Analysis:
   - What are the paid tiers? (e.g., 150, 500, 2000 pts/day)
   - What are the costs? (e.g., $60, $150, $300/month)
   - What's the cost per point?
   - What's the break-even point?

3. **CRITICAL: Pricing Model Alignment Check**:
   - **How does the API charge?** (per-user quota vs total usage pool)
   - **If per-user quota**: Each user gets their own quota (e.g., 50 pts/day per user)
   - **If total usage pool**: All users share a single quota (e.g., 50 pts/day total for all users)
   - **Our pricing model**: Do we allocate per-user or shared pool?
   - **Alignment check**: Does our pricing model match API's charging model?
   - **Cost projection**: Calculate total API cost based on user count and usage patterns
   - **Example misalignment**: We allocate 50 pts/day per user, but API charges for total usage → 100 users × 50 pts = 5,000 pts/day total → requires Mega tier ($149/month) even if only 1 paid user

4. Point Cost Analysis:
   - Cost per operation (search, details, etc.)
   - Which operations are most expensive?
   - Which operations are cheapest?
   - Optimization opportunities?

5. Current Implementation:
   - How is the API currently used?
   - What endpoints are called?
   - What's the usage pattern?
   - What caching exists?
   - What optimizations are in place?

6. **Usage Pattern Analysis** (CRITICAL):
   - Average points per user per day (by tier: free, starter, pro)
   - Total points per day at scale (100, 500, 1000 users)
   - Cost per user at scale (free tier, paid tiers)
   - Revenue per user vs API cost per user
   - Break-even analysis: When does API cost exceed revenue?
```

**Step 2: `write-spec` Product Impact Analysis**
```
`write-spec` Analysis Request: "Based on API research, analyze:

1. User Experience Impact:
   - How do quota limits affect users?
   - What features are limited by quota?
   - What's the user journey when quota exhausted?
   - What's the conversion trigger?

2. Feature Opportunities:
   - What features reduce API dependency?
   - What features justify paid tiers (more quota)?
   - What features can be built without API?
   - What features require API but add high value?

3. Product Strategy:
   - How to optimize free tier experience?
   - How to create upgrade motivation?
   - How to reduce API costs?
   - How to scale efficiently?"
```

**Step 3: `design-tech` Scaling & Cost Analysis**
```
`design-tech` Analysis Request: "Based on API `research` and `write-spec` analysis, assess:

1. Scalability Analysis:
   - How does API usage scale with users?
   - What happens at 100, 1000, 10000 users?
   - What are the bottlenecks?
   - What's the cost per user at scale?
   - **CRITICAL**: If API charges for total usage (not per-user), calculate total cost at scale

2. architecture Optimization:
   - How can caching reduce API calls? (target: 40-60% reduction)
   - How can local-first reduce dependency? (prioritize local recipes)
   - How can batching optimize usage? (batch requests when possible)
   - What architectural changes needed?
   - **Usage optimization strategies**: Local-first default, smart caching, copy-to-local prompts, cheaper endpoints

3. Cost Optimization:
   - What's the current cost per user? (before optimization)
   - What's the optimized cost per user? (after 40-60% reduction)
   - What's the break-even point? (when revenue covers API costs)
   - What's the profit margin at scale?
   - **Cost per user target**: <$0.50/user/month (after optimization)

4. **Pricing Model Alignment** (CRITICAL):
   - If API charges for total usage, adjust pricing tiers to shared pool model
   - Free tier: Reduce per-user quota (e.g., 10 pts/day per user, shared pool: 50 pts/day total)
   - Paid tiers: Shared pool with priority allocation
   - Update cost projections based on actual pricing model

5. Implementation Feasibility:
   - What's the effort to optimize?
   - What's the effort to build features?
   - What's the risk?
   - What's the ROI?"
```

**Step 4: Multi-Skill Brainstorming**
```
Brainstorming Session: "Let's discuss:

1. Current State:
   - API usage: [current pattern]
   - Costs: [current costs]
   - Limitations: [current limitations]
   - User impact: [current impact]

2. Optimization Opportunities:
   - Caching: [opportunities]
   - Local-first: [opportunities]
   - Batching: [opportunities]
   - Feature changes: [opportunities]

3. Feature Proposals:
   - write-spec: [feature proposals]
   - design-tech: [technical feasibility]
   - FinOps: [cost/benefit analysis]

4. Scaling Strategy:
   - How does this scale?
   - What are the costs at scale?
   - What are the revenue opportunities?
   - What's the break-even point?

5. Implementation Plan:
   - Phase 1: [quick wins]
   - Phase 2: [high-value features]
   - Phase 3: [scaling optimizations]"
```

### 4. MMR Optimization Opportunity Categories

**Category 1: API Cost Optimization**
- **Research Needed**: Deep API understanding (pricing, quotas, point costs)
- **`write-spec` Analysis**: How API usage affects user experience, feature opportunities
- **`design-tech` Analysis**: Scalability, caching, optimization strategies
- **Expected Impact**: 40-60% cost reduction, better free tier experience

**Category 2: Feature-Driven Pricing**
- **Research Needed**: Market analysis, competitor features, user needs
- **`write-spec` Analysis**: Feature proposals that justify pricing tiers
- **`design-tech` Analysis**: Technical feasibility, implementation effort
- **Expected Impact**: +15-25% conversion rate, $500-2,000/month MMR

**Category 3: Local-First Features**
- **Research Needed**: Features that don't require external APIs
- **`write-spec` Analysis**: High-value features using local data
- **`design-tech` Analysis**: Implementation complexity, scalability
- **Expected Impact**: Reduced API dependency, better margins

**Category 4: Conversion Funnel Optimization**
- **Research Needed**: Conversion best practices, funnel analysis
- **`write-spec` Analysis**: Drop-off points, optimization opportunities
- **`design-tech` Analysis**: Technical implementation, A/B testing
- **Expected Impact**: +5-15% conversion rate

**Category 5: Churn Reduction**
- **Research Needed**: Churn analysis, retention strategies
- **`write-spec` Analysis**: Feature gaps, user needs
- **`design-tech` Analysis**: Implementation feasibility
- **Expected Impact**: -20-40% churn rate

**Category 6: Expansion Revenue**
- **Research Needed**: Upsell opportunities, add-on products
- **`write-spec` Analysis**: Feature value, upgrade triggers
- **`design-tech` Analysis**: Implementation effort, scalability
- **Expected Impact**: +15-25% expansion revenue

### 4. Efficient Research Collaboration in Cursor/Claude

**Best Practices for Cross-Skill Research**:

**1. Use Cursor's @Web Feature**
```
write-spec: "I'll use @Web in Cursor to `research` pricing optimization best practices.
This provides real-time web search with citations."
```

**2. Leverage Deep Research Methodology Skill**
```
write-spec: "I'll follow the `research` skill workflow:
1. Planning Phase: Define `research` objectives
2. Information Gathering: Multi-source research
3. Analysis Phase: Evaluate source quality
4. Synthesis Phase: Combine findings
5. Validation Phase: Cross-reference information"
```

**3. Use Composer for Multi-Step Research**
```
write-spec: "I'll use Cursor Composer to:
1. Break down `research` into steps
2. Search multiple sources (@Web, @Docs)
3. Synthesize findings
4. Generate `research` report with citations"
```

**4. Document Research Findings**
```
write-spec: "Research findings documented in:
- Research report with citations
- Confidence levels for each finding
- Source hierarchy (Official > Authoritative > Community)
- Recommended actions"
```

**5. Iterative Refinement**
```
FinOps: "Based on initial research, I need deeper analysis on:
- [Specific area 1]
- [Specific area 2]

write-spec, please deepen `research` in these areas."
```

### 5. MMR Improvement Proposal Framework

**Template for `manage-finops` proposals**:

```markdown
# MMR Improvement Proposal: [Title]

## Executive Summary
- **Current MMR**: $X/month
- **Proposed Improvement**: [Description]
- **Expected MMR Impact**: $X-X/month (+X%)
- **Implementation Timeline**: X weeks
- **Priority**: High/Medium/Low

## Problem Statement
- **Current State**: [Describe current situation]
- **Gap Analysis**: [What's missing or suboptimal]
- **Impact**: [Why this matters]

## Research Foundation
**Research Conducted By**: `write-spec` (using research)
**Research Date**: [Date]
**Key Findings**:
1. [Finding 1] (Confidence: High/Medium/Low)
2. [Finding 2] (Confidence: High/Medium/Low)
3. [Finding 3] (Confidence: High/Medium/Low)

**Sources**:
- [Source 1]: [URL]
- [Source 2]: [URL]
- [Source 3]: [URL]

## Proposed Solution
**Solution Description**: [What we'll do]
**Implementation Steps**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Technical Requirements**: [If applicable]
**Product Requirements**: [If applicable]

## Expected Impact
**MMR Impact**:
- **Conservative Estimate**: $X/month (+X%)
- **Realistic Estimate**: $X/month (+X%)
- **Optimistic Estimate**: $X/month (+X%)

**Other Metrics**:
- Conversion rate: +X%
- ARPU: +$X
- Churn rate: -X%
- LTV:CAC: Improve to X:1

## Implementation Plan
**Phase 1**: [Week 1-2] - [Tasks]
**Phase 2**: [Week 3-4] - [Tasks]
**Phase 3**: [Week 5-6] - [Tasks]

**Dependencies**: [List dependencies]
**Resources Needed**: [List resources]

## Success Metrics
**Primary Metrics**:
- MMR increase: Target $X/month
- Conversion rate: Target X%
- ARPU: Target $X

**Secondary Metrics**:
- [Metric 1]: Target value
- [Metric 2]: Target value

**Measurement Plan**: [How we'll measure]

## Risks & Mitigation
**Risk 1**: [Description]
- **Probability**: High/Medium/Low
- **Impact**: High/Medium/Low
- **Mitigation**: [Action plan]

**Risk 2**: [Description]
- **Probability**: High/Medium/Low
- **Impact**: High/Medium/Low
- **Mitigation**: [Action plan]

## Recommendation
**Recommendation**: [Proceed/Defer/Reject]
**Rationale**: [Why]
**Next Steps**: [What happens next]
```

### 6. Enhanced Multi-Skill Debate Framework

**`manage-finops` ↔ `write-spec` ↔ `design-tech` Debate Pattern**:

**Scenario**: `manage-finops` proposes feature-driven pricing, `write-spec` proposes features, `design-tech` analyzes scalability

**Step 1: `manage-finops` Initial Analysis**
```
FinOps: "Current MMR: $0/month. Spoonacular API: 50 pts/day free tier.
Analysis shows:
- 50 pts/day = only ~10 searches OR ~25 details
- Users hit quota quickly
- No premium features to justify paid tiers
- Current cost: $0 (free tier)

I need deep understanding of Spoonacular API before proposing improvements.
`research` skill, please analyze Spoonacular API from repository and docs."
```

**Step 2: `research` API Analysis**
```
Research: "Analyzing Spoonacular API from repository:

**Repository Analysis**:
- Code: backend/app/services/spoonacular_client.py
- Quota: backend/app/services/spoonacular/quota_tracker.py
- Config: backend/app/core/config.py (SpoonacularConfig)
- Docs: docs/reference/spoonacular.md

**Findings**:
1. Free Tier: 50 pts/day (RapidAPI shared tier)
2. Point Costs:
   - Search (search_complex): 5 pts per call (default 3 results = 5 pts)
   - Recipe Details: 2 pts per recipe
   - By-Ingredients: 3 pts per call (up to 10 ingredients)
   - Substitutions: 3 pts per call

3. Current Implementation:
   - Caching: 50-min TTL (ToS compliant)
   - Quota tracking: Redis-backed, resets midnight UTC
   - Headroom: 15% reserved (7.5 pts)
   - Usable quota: 42.5 pts/day (50 - 7.5)

4. Paid Tiers (from docs):
   - Beginner: 150 pts/day = $60/month
   - Standard: 500 pts/day = $150/month
   - Premium: 2000 pts/day = $300/month

**Scalability Analysis**:
- 50 pts/day = ~10 searches = supports ~5-10 active users
- 150 pts/day = ~30 searches = supports ~15-30 users
- 500 pts/day = ~100 searches = supports ~50-100 users
- 2000 pts/day = ~400 searches = supports ~200-400 users

**Cost Per User** (assuming 10 searches/user/day):
- Free tier: $0/user (but limited to 5-10 users total)
- Beginner: $60/month ÷ 30 users = $2/user/month
- Standard: $150/month ÷ 100 users = $1.50/user/month
- Premium: $300/month ÷ 400 users = $0.75/user/month

**Optimization Opportunities**:
- By-ingredients (3 pts) vs search (5 pts) = 40% savings
- Copy-to-local (0 pts) vs repeat searches = 30-40% savings
- Browser caching = 30-40% reduction
- Total potential: 40-60% reduction in API usage"
```

**Step 3: `write-spec` Product Impact Analysis**
```
write-spec: "Based on API research, analyzing product impact:

**Current User Experience**:
- Free tier: 50 pts/day = ~10 searches
- Users hit quota quickly (within 1-2 hours of active use)
- Quota exhaustion = poor experience = low conversion

**Feature Opportunities** (reduce API dependency):
1. Waste Reduction Dashboard (0 pts - local tracking)
2. Meal Plan Generator (minimal pts - uses local recipes)
3. Recipe Collections (0 pts - local feature)
4. Smart Shopping List (0 pts - local feature)

**Feature Opportunities** (justify paid tiers):
1. More Spoonacular quota (150, 500, 2000 pts/day)
2. Advanced features (nutrition, meal planning via API)
3. Priority support

**Proposed Features**:
- Waste dashboard: Justifies Starter ($9/month)
- Meal planning: Justifies Pro ($29/month)
- More quota: Justifies Pro ($29/month) - 150 pts/day

**Expected Impact**:
- Conversion: +15-20% (with features)
- Retention: +30% (meal planning users cook more)
- MMR: $760-4,560/month (Month 4-6)"
```

**Step 4: `design-tech` Scaling & Implementation Analysis**
```
design-tech: "Based on API `research` and `write-spec` analysis, assessing scalability:

**Current architecture**:
- SpoonacularClient: Async HTTP client with retry logic
- QuotaTracker: Redis-backed quota tracking
- Caching: 50-min TTL (Redis + browser cache)
- Current pattern: Search-heavy (5 pts per search)

**Scalability Analysis**:
- 100 users: 50 pts/day free tier = NOT SUFFICIENT
- Need paid tier: 150 pts/day = $60/month
- Cost per user: $60 ÷ 30 users = $2/user/month
- At 1000 users: Need 500 pts/day = $150/month
- Cost per user: $150 ÷ 100 users = $1.50/user/month

**architecture Optimization**:
1. Make by-ingredients default (3 pts vs 5 pts)
   - Implementation: Change default search method
   - Impact: 40% cost reduction
   - Effort: 1 week

2. Increase copy-to-local rate (0 pts vs repeat searches)
   - Implementation: Add copy prompts, one-click copy
   - Impact: 30-40% reduction in repeat searches
   - Effort: 3-5 days

3. Browser caching (50-min TTL)
   - Implementation: Set Cache-Control headers
   - Impact: 30-40% reduction in API calls
   - Effort: 1 day

4. Local-first features (reduce API dependency)
   - Implementation: Build features using local data
   - Impact: 50% reduction in API dependency
   - Effort: 2-6 weeks per feature

**Total Optimization Potential**: 40-60% reduction in API usage

**Scaling Strategy**:
- Free tier: Optimize usage (support 10-20 users efficiently)
- Starter: 50 pts/day (same as free, but with premium features)
- Pro: 150 pts/day ($60/month Spoonacular cost)
- Enterprise: 500 pts/day ($150/month Spoonacular cost)

**Cost Analysis**:
- Free tier: $0 (but limited users)
- Starter: $0 Spoonacular + $9 revenue = $9/user profit
- Pro: $2 Spoonacular + $29 revenue = $27/user profit (90% margin)
- Enterprise: $1.50 Spoonacular + $99 revenue = $97.50/user profit (98% margin)

**Implementation Feasibility**:
- Optimization: Low effort, high impact (1-2 weeks)
- Features: Medium effort, high impact (2-6 weeks)
- ROI: High (features justify pricing, optimization reduces costs)"
```

**Step 5: Multi-Skill Brainstorming**
```
FinOps: "Let's synthesize our analysis:

**Current State**:
- Spoonacular: 50 pts/day free tier = ~10 searches
- Users: Hit quota quickly, poor experience
- Revenue: $0/month (no pricing implemented)
- Cost: $0/month (free tier)

**`write-spec` Feature Proposals**:
1. Waste dashboard (0 pts) → Justifies Starter ($9/month)
2. Meal planning (minimal pts) → Justifies Pro ($29/month)
3. Recipe collections (0 pts) → Growth + retention

**`design-tech` Optimization**:
1. By-ingredients default → 40% cost reduction
2. Copy-to-local prompts → 30-40% reduction
3. Browser caching → 30-40% reduction
4. Total: 40-60% reduction in API usage

**`manage-finops` Synthesis**:
- Optimize Spoonacular: 40-60% reduction (better free tier)
- Build features: Justify pricing tiers (waste, meal planning)
- Expected MMR: $760-4,560/month (Month 4-6)

**Implementation Plan**:
- Week 1-2: Optimization (quick wins)
- Week 3-6: Features (high-value)
- Week 7-10: Scaling (premium features)

**Expected Outcomes**:
- Month 1-3: $90-760/month MMR
- Month 4-6: $760-4,560/month MMR
- Month 7-12: $3,800-28,500/month MMR"
```

**Step 6: Debate Resolution**
```
write-spec: "I agree with optimization, but features are critical.
Without features, users won't upgrade. Need features first."

FinOps: "Agreed. Features justify pricing. But can start optimization 
immediately (Week 1) while building features (Week 3-6)."

design-tech: "Optimization is low effort (1-2 weeks), high impact.
Features are medium effort (2-6 weeks), high impact.
Can do both in parallel: Optimization (Week 1-2) + Features (Week 3-6)."

Resolution: "Phased approach:
- Week 1-2: Optimization (quick wins, reduces costs)
- Week 3-6: Features (justifies pricing, drives MMR)
- Week 7-10: Scaling (premium features, higher MMR)"
```

### 7. Enhanced Continuous MMR Optimization Workflow

**Monthly MMR Review Process with Multi-Skill Collaboration**:

**Week 1: `manage-finops` analysis + Research**
1. Analyze current MMR metrics
2. Identify improvement opportunities (including API dependencies)
3. **If API understanding missing**: Request `research` skill to analyze API from repository
4. Create initial proposals with API cost analysis
5. Request `write-spec` product analysis for high-priority items
6. Request `design-tech` scaling analysis for technical feasibility

**Week 2: Multi-Skill Research & Analysis**
1. **research**: 
   - Analyze APIs from repository (code, docs, config)
   - Research external API docs for latest pricing
   - Provide complete API understanding (pricing, quotas, costs)
2. **write-spec**:
   - Analyze product impact of API limitations
   - Propose features that reduce API dependency
   - Propose features that justify pricing tiers
3. **design-tech**:
   - Analyze scalability implications
   - Assess caching and optimization opportunities
   - Evaluate implementation feasibility

**Week 3: Multi-Skill Brainstorming & Proposal Refinement**
1. **Brainstorming Session**:
   - FinOps: Cost/benefit analysis
   - write-spec: Feature proposals and user impact
   - design-tech: Technical feasibility and scaling
   - Research: API understanding and optimization opportunities
2. **Synthesis**:
   - Combine all perspectives
   - Identify synergies (features that optimize costs AND drive revenue)
   - Prioritize proposals (quick wins vs high-value features)
3. **Debate & Resolution**:
   - Structured debate on priorities
   - Data-driven decisions
   - Consensus on implementation plan

**Week 4: Implementation Planning**
1. **design-tech**: Create detailed implementation plans
2. **write-spec**: Define feature specifications
3. **FinOps**: Set up cost tracking and success metrics
4. **Research**: Document API understanding for future reference

**Week 5-8: Implementation & Monitoring**
1. Implement highest-priority proposals
2. Set up measurement and tracking
3. Monitor results (MMR, costs, conversion)
4. Iterate based on data
- **Continuous**: Multi-skill reviews and adjustments

### 8. Vibe Coding Cost Optimization (The "S7an" Protocol)

In a "Vibe Coding" environment, the primary cost is often the **agentic workflow itself** (token usage, high-cognition model invocations). `manage-finops` must optimize the ROI of the pipeline.

**Optimization Strategies:**
- **Model Tiering**: Use `scripts/resolve-model.sh` to ensure `PASS` or `EXEC` tasks use cheaper models (Flash/Haiku) while reserving `STRAT` for expensive models (Pro/Opus).
- **Context Hygiene**: Enforce `references/context-budget.md` to prevent "token bloat" during long sessions.
- **Subagent Efficiency**: Use `codebase_investigator` for broad searches instead of multiple `read_file` calls to reduce orchestrator overhead.
- **Verification ROI**: Start with the "minimum-path" verification defined in `references/lane-model.md`. Do not run full E2E suites for local fixes.

### 9. Research Request Templates


**Template 1: Pricing Research**
```
write-spec, please use `research` skill to research:

**Research Objective**: Pricing optimization strategies for [product type]

**Research Questions**:
1. What are current pricing best practices for [product type] in 2025?
2. How do top 5 competitors price their [product type]?
3. What pricing psychology techniques are most effective?
4. What are proven A/B testing frameworks for pricing experiments?

**Sources to Prioritize**:
- Official sources (Stripe pricing guides, `research` papers)
- Industry best practices (SaaS pricing blogs, expert opinions)
- Competitive analysis (competitor pricing pages)
- Academic `research` (pricing psychology studies)

**Expected Deliverables**:
- Research report with citations
- Confidence levels for each finding
- Recommended pricing strategy
- Implementation considerations
```

**Template 2: Conversion Optimization Research**
```
write-spec, please use `research` skill to research:

**Research Objective**: Conversion funnel optimization for freemium SaaS

**Research Questions**:
1. What are proven conversion optimization strategies for freemium SaaS?
2. What are common conversion funnel drop-off points?
3. What A/B testing frameworks work best for conversion optimization?
4. What are effective upgrade prompts and CTAs?

**Sources to Prioritize**:
- Conversion optimization case studies
- A/B testing platform documentation
- UX `research` on conversion optimization
- Industry benchmarks for conversion rates

**Expected Deliverables**:
- Research report with citations
- Conversion optimization recommendations
- A/B testing plan
- Implementation roadmap
```

**Template 3: Churn Reduction Research**
```
write-spec, please use `research` skill to research:

**Research Objective**: Churn reduction strategies for SaaS products

**Research Questions**:
1. What are proven churn reduction strategies?
2. What are common reasons for SaaS churn?
3. What retention strategies are most effective?
4. What are best practices for win-back campaigns?

**Sources to Prioritize**:
- Churn analysis `research` papers
- SaaS retention case studies
- Customer success best practices
- Industry churn benchmarks

**Expected Deliverables**:
- Research report with citations
- Churn reduction recommendations
- Retention strategy plan
- Win-back campaign templates
```

### 9. Deep API Understanding Best Practices

**1. Always Research APIs Before Proposing Changes**
- **Never assume**: Don't assume API pricing or quotas
- **Research first**: Use `research` skill to analyze repository code and docs
- **Verify externally**: Check official API docs for latest pricing
- **Understand deeply**: Know point costs, rate limits, quotas, ToS

**2. Multi-Source API Research**
- **Repository Analysis**: Read code (client, quota tracker, config)
- **Documentation Analysis**: Read internal docs (integration plans, FAQs)
- **External Research**: Check official API docs, pricing pages
- **Code Patterns**: Analyze how API is currently used

**3. Understand Free Tier vs Paid Tiers**
- **Free Tier**: What's included? What are limitations?
- **Paid Tiers**: What are the costs? What's the break-even?
- **Scaling**: How does usage scale? What are costs at scale?
- **Optimization**: How can we reduce API dependency?

**4. Involve All Relevant Skills**
- **Research**: Deep API understanding
- **write-spec**: Product impact and feature opportunities
- **design-tech**: Scalability and optimization strategies
- **FinOps**: Cost/benefit analysis and MMR projections

**5. Brainstorm Before Proposing**
- **Current State**: What's the current API usage?
- **Problems**: What are the limitations?
- **Opportunities**: What can we optimize?
- **Features**: What features reduce dependency?
- **Scaling**: How does this scale?

### 10. Best Practices for Efficient Collaboration

**1. Use Cursor's Composer for Multi-Step Research**
- Break down `research` into steps
- Use @Web for real-time research
- Use @Docs for official documentation
- Use codebase search for repository analysis
- Synthesize findings automatically

**2. Leverage Deep Research Methodology**
- Follow systematic `research` workflow
- Multi-source validation (repository + external)
- Source quality evaluation
- Confidence scoring

**3. Involve `design-tech` Early**
- Don't propose features without architectural analysis
- Understand scalability implications
- Assess implementation feasibility
- Evaluate cost implications

**4. Document Everything**
- Research findings with citations (repository + external)
- API understanding (pricing, quotas, costs)
- Proposals with expected impact
- design-techural analysis (scalability, feasibility)
- Decisions with rationale
- Results with metrics

**5. Iterate Based on Data**
- Measure impact of proposals
- Refine based on results
- Continuous improvement
- Data-driven decisions

**6. Maintain Clear Communication**
- Use structured templates
- Provide context and rationale
- Request specific `research` questions
- Return actionable findings
- Include API understanding in all proposals


## Expert Consultation

This skill provides expert-level consultation on:
- Platform selection for specific use cases
- Cost optimization strategies
- Budget planning and forecasting
- Revenue model design
- Launch strategy planning
- Pricing comparison across platforms
- Free tier maximization
- Scaling cost planning
- **MMR optimization through cross-skill collaboration**
- **Research-driven opportunity assessment**
- **Product-`manage-finops` alignment for revenue growth**
- **Deep API understanding and cost optimization**
- **Multi-skill brainstorming (`manage-finops` + `write-spec` + `design-tech` + Research)**
- **Feature-driven pricing strategies**
- **design-techural cost implications**


## Advanced: Deep API Understanding Requirements

### When Analyzing Third-Party APIs

**Critical Requirement**: Before proposing MMR improvements involving APIs, `manage-finops` must:

1. **Understand API Pricing Deeply**:
   - Free tier: What's included? What are limitations?
   - Paid tiers: What are costs? What's break-even?
   - Point costs: Cost per operation? Which are expensive?
   - Scaling: How does cost scale with users?

2. **Research from Repository**:
   - Read API client code (e.g., `spoonacular_client.py`)
   - Read quota tracking code (e.g., `quota_tracker.py`)
   - Read configuration (e.g., `SpoonacularConfig`)
   - Read documentation (e.g., `spoonacular.md`)
   - Understand current implementation patterns

3. **Research from External Sources**:
   - Official API documentation
   - Pricing pages
   - Rate limit documentation
   - ToS and compliance requirements

4. **Involve All Relevant Skills**:
   - **Research**: Deep API understanding
   - **write-spec**: Product impact and feature opportunities
   - **design-tech**: Scalability and optimization strategies
   - **FinOps**: Cost/benefit analysis

5. **Brainstorm Before Proposing**:
   - Current state analysis
   - Problem identification
   - Opportunity assessment
   - Feature proposals
   - Scaling analysis
   - Cost optimization
   - Implementation feasibility


## Multi-Persona Conversation Orchestration

### Overview

As a solo developer using multiple AI personas (FinOps, write-spec, design-tech, Research) to simulate startup team conversations, `manage-finops` often initiates and orchestrates multi-persona discussions. This section provides guidance on orchestrating natural, productive conversations that feel like a real team collaborating.

**Context**: You're simulating a startup team where FinOps, write-spec, design-tech, and Research collaborate to solve problems. Each persona has distinct voice, perspective, and expertise.

### Persona Roles & Voices

**`manage-finops` expert** (You):
- **Voice**: Data-driven, cost-focused, revenue-oriented
- **Perspective**: "What's the cost? What's the ROI? What's the MMR impact?"
- **Typical Phrases**: "From a `manage-finops` perspective...", "The unit economics show...", "We need to optimize costs..."

**write-spec**:
- **Voice**: User-focused, feature-oriented, strategic
- **Perspective**: "How does this affect users? What features justify pricing?"
- **Typical Phrases**: "As write-spec, I think...", "Users will experience...", "This feature justifies..."

**architecture Expert**:
- **Voice**: Technical, pragmatic, feasibility-focused
- **Perspective**: "How does this scale? What's feasible? What's the effort?"
- **Typical Phrases**: "From an architecture standpoint...", "The scalability implications are...", "The implementation effort is..."

**research**:
- **Voice**: Methodical, thorough, evidence-based
- **Perspective**: "What does the data say? What are the facts?"
- **Typical Phrases**: "Research shows...", "Based on the repository analysis...", "The evidence indicates..."

### Initiating Multi-Persona Conversations

**When `manage-finops` Should Initiate**:

1. **Problem Identification**
   ```
   FinOps: "Current MMR: $X/month. Target: $Y/month. Gap: $Z/month.
   I see we're using [API]. I need deep understanding before proposing changes.
   `research` skill, please analyze [API] from repository and external sources."
   ```

2. **Requesting Product Analysis**
   ```
   FinOps: "write-spec, please analyze:
   - How does [API quota] affect user experience?
   - What features are limited by quota?
   - What features could reduce API dependency?
   - What features justify paid tiers?"
   ```

3. **Requesting Scalability Analysis**
   ```
   FinOps: "design-tech, please assess:
   - How does [API usage] scale with users?
   - What happens at 100, 1000, 10000 users?
   - What are optimization opportunities?
   - What's the implementation feasibility?"
   ```

**Key Principles**:
- **State the problem clearly**: What's the issue? What's the goal?
- **Request specific analysis**: What do you need from each persona?
- **Provide context**: Share relevant information upfront
- **Set expectations**: What deliverables do you need?

### Synthesizing Findings

**After All Personas Contribute**:

1. **Summarize Each Persona's Findings**
   ```
   FinOps: "Synthesizing all analysis:
   
   Research Findings:
   - [Key findings from Research]
   
   `write-spec` Analysis:
   - [Key findings from write-spec]
   
   `design-tech` Assessment:
   - [Key findings from design-tech]
   ```

2. **Identify Agreements and Disagreements**
   ```
   FinOps: "Agreements:
   - [What everyone agrees on]
   
   Disagreements:
   - [Where personas differ]
   ```

3. **Propose Synthesis**
   ```
   FinOps: "Proposal:
   - [Synthesis of all perspectives]
   - [Phased approach]
   - [Expected outcomes]"
   ```

**Synthesis Template**:
```markdown
## Multi-Persona Analysis Synthesis

**Current State**:
- [Synthesis of current state from all perspectives]

**Problems Identified**:
- [Problems from `write-spec` perspective]
- [Problems from `design-tech` perspective]
- [Problems from `manage-finops` perspective]

**Opportunities**:
- [Optimization opportunities from design-tech]
- [Feature opportunities from write-spec]
- [Cost optimization from FinOps]

**Proposal**:
- [Synthesized proposal combining all perspectives]
- [Phased implementation plan]
- [Expected MMR impact]
```

### Facilitating Debates

**When Personas Disagree**:

1. **Let Personas Make Their Case**
   ```
   write-spec: "Features are critical. Need features first."
   FinOps: "But optimization is quick win. Can do both?"
   design-tech: "Actually, we can parallelize. Optimization is low effort..."
   ```

2. **Guide Toward Consensus**
   ```
   FinOps: "Let's find common ground:
   - write-spec: Features justify pricing (agreed)
   - FinOps: Optimization reduces costs (agreed)
   - design-tech: Can do both in parallel (agreed)
   
   Resolution: Phased approach - Optimization (Week 1-2) + Features (Week 3-6)"
   ```

3. **Prevent Circular Debates**
   - If debate goes in circles, synthesize: "We've discussed X, Y, Z. Let's decide..."
   - If no consensus, propose compromise: "How about we do X first, then Y?"
   - If still stuck, document disagreement: "`write-spec` prefers X, `manage-finops` prefers Y. Decision: [compromise]"

**Debate Facilitation Principles**:
- **Let personas disagree**: Healthy debate leads to better decisions
- **Build on valid points**: Acknowledge when personas make good points
- **Seek common ground**: Find what everyone agrees on
- **Propose compromises**: When personas disagree, propose middle ground
- **Document decisions**: Capture what the "team" decided and why

### Documenting Decisions

**What to Capture**:

1. **Decision Summary**
   ```markdown
   ## Decision: [Title]
   
   **Date**: [Date]
   **Participants**: FinOps, write-spec, design-tech, Research
   **Status**: Approved/Deferred/Rejected
   
   **Decision**: [What was decided]
   **Rationale**: [Why this decision]
   **Expected Impact**: [What we expect]
   **Next Steps**: [What happens next]
   ```

2. **Key Findings**
   - What each persona found
   - What everyone agreed on
   - What was debated
   - What was resolved

3. **Implementation Plan**
   - Phased approach
   - Timeline
   - Success metrics
   - Risk mitigation

**Decision Documentation Template**:
```markdown
# [Decision Title]

**Date**: [Date]
**Context**: [Why this decision was needed]

## Analysis Summary

**Research Findings**:
- [Key findings]

**`write-spec` Analysis**:
- [Key findings]

**`design-tech` Assessment**:
- [Key findings]

**`manage-finops` analysis**:
- [Key findings]

## Debate Summary

**Agreements**:
- [What everyone agreed on]

**Disagreements**:
- [Where personas differed]

**Resolution**:
- [How disagreement was resolved]

## Decision

**Approved Approach**: [What was decided]
**Rationale**: [Why]
**Expected Impact**: [What we expect]
**Timeline**: [When]
**Success Metrics**: [How we'll measure]

## Next Steps

1. [Action item 1]
2. [Action item 2]
3. [Action item 3]
```

### Natural Conversation Patterns

**Pattern 1: Sequential Analysis**
```
FinOps: "Current MMR is $0. I see Spoonacular API. Need deep understanding."
→ Research: "Analyzing Spoonacular API from repository..."
→ write-spec: "Based on research, analyzing product impact..."
→ design-tech: "Assessing scalability and feasibility..."
→ FinOps: "Synthesizing all analysis..."
```

**Pattern 2: Debate & Challenge**
```
write-spec: "Features are critical. Need features first."
→ FinOps: "But optimization is quick win. Can do both?"
→ design-tech: "Actually, we can parallelize. Optimization is low effort..."
→ Consensus: "Phased approach: Optimization (Week 1-2) + Features (Week 3-6)"
```

**Pattern 3: Collaborative Brainstorming**
```
FinOps: "Let's brainstorm. Current state: [synthesis]"
→ write-spec: "Problems: [user impact issues]"
→ design-tech: "Opportunities: [technical optimizations]"
→ Research: "Evidence: [data points]"
→ FinOps: "Proposal: [synthesis of all perspectives]"
```

### Tips for Natural Persona Switching

**Explicit Switching**:
- "As write-spec, I think..."
- "From an `design-tech` perspective..."
- "Research indicates..."

**Implicit Switching**:
- "Actually, let me think about this from a `write-spec` angle..."
- "From a technical standpoint..."
- "The user impact would be..."

**Building on Previous Findings**:
- "Building on what Research found..."
- "write-spec's point about user experience is valid, but..."
- "design-tech's feasibility assessment helps, and..."

**Challenging Assumptions**:
- "write-spec, I understand your concern, but from `manage-finops` perspective..."
- "design-tech, that's technically correct, but users need..."
- "Research shows different data. Let me check..."

### Best Practices

1. **Start with Problem**: Clearly state the problem before requesting analysis
2. **Request Specific**: Ask for specific analysis, not generic advice
3. **Provide Context**: Share relevant information upfront
4. **Let Personas Disagree**: Healthy debate leads to better decisions
5. **Build on Findings**: Reference what other personas found
6. **Synthesize**: Combine perspectives into coherent proposal
7. **Document Decisions**: Capture what the "team" decided and why
8. **Natural Flow**: Don't force persona switches, let conversation flow naturally

### Example: Full Conversation Flow

**Step 1: Problem Identification**
```
FinOps: "Current MMR: $0/month. Target: $500-2,000/month. 
I see we're using Spoonacular API. I need deep understanding before proposing changes.
`research` skill, please analyze Spoonacular API from repository and external sources."
```

**Step 2: Research Analysis**
```
Research: "Analyzing Spoonacular API:
- Free tier: 50 pts/day (RapidAPI shared tier)
- Point costs: Search 5 pts, Details 2 pts, By-ingredients 3 pts
- Paid tiers: 150 ($60), 500 ($150), 2000 ($300) pts/day
- Scalability: 50 pts = ~5-10 users, 150 pts = ~15-30 users
- Optimization: 40-60% reduction possible"
```

**Step 3: Product Impact**
```
write-spec: "Based on API research, analyzing product impact:
- Free tier: 50 pts/day = ~10 searches
- Users hit quota quickly = poor UX = low conversion
- Proposing: Waste dashboard (0 pts), meal planning (minimal pts)
- Expected: +15-20% conversion, $760-4,560/month MMR"
```

**Step 4: Scalability Analysis**
```
design-tech: "Assessing scalability:
- 50 pts/day = ~5-10 users (free tier)
- At 100 users: Need 150 pts/day = $60/month
- Can optimize 40-60% with by-ingredients default + caching
- Features feasible: Low-medium effort, high impact"
```

**Step 5: Synthesis & Proposal**
```
FinOps: "Synthesizing all analysis:
- Current state: [synthesis]
- Problems: [issues]
- Opportunities: [optimization + features]
- Proposal: Phased approach
  - Week 1-2: Optimization (quick wins)
  - Week 3-6: Features (high-value)
- Expected MMR: $760-4,560/month (Month 4-6)"
```

**Step 6: Debate & Resolution**
```
write-spec: "Features are critical. Need features first."
FinOps: "But optimization is quick win. Can do both?"
design-tech: "Can parallelize. Optimization is low effort (1-2 weeks), features are medium effort (2-6 weeks)."
FinOps: "Agreed. Resolution: Phased approach - Optimization (Week 1-2) + Features (Week 3-6)"
```

---


# AI Service Cost/Quality Analysis

## AI Service Cost/Quality Analysis

**CRITICAL**: When evaluating AI services, always consider cost, quality, and free tier availability.

**Core Principle**: 
- **Free Tier First**: Start with free tiers, scale with revenue
- **Cost-Effective**: Optimize for cost without sacrificing quality
- **High Quality**: Use best AI services when revenue justifies
- **ROI Positive**: AI features should have positive ROI

**AI Service Options** (2025):

**Option 1: Anthropic Claude** (Recommended for Quality)
- **Free Tier**: Claude 3 Haiku (free, limited)
- **Paid**: Claude 3.5 Sonnet ($3/1M input, $15/1M output)
- **Quality**: ⭐⭐⭐⭐⭐ (Excellent for recipe/culinary tasks)
- **Best For**: Recipe suggestions, meal planning, creative tasks
- **Free Tier**: Limited, but sufficient for MVP testing

**Option 2: OpenAI GPT** (Recommended for Cost)
- **Free Tier**: GPT-3.5 Turbo (free, limited)
- **Paid**: GPT-4o ($2.50/1M input, $10/1M output)
- **Quality**: ⭐⭐⭐⭐ (Very good, slightly less creative)
- **Best For**: General tasks, cost optimization
- **Free Tier**: Limited, but sufficient for MVP testing

**Option 3: Google Gemini** (Recommended for Scale)
- **Free Tier**: Gemini Pro (free, generous limits)
- **Paid**: Gemini Pro ($0.50/1M input, $1.50/1M output)
- **Quality**: ⭐⭐⭐⭐ (Good, cost-effective)
- **Best For**: High-volume tasks, cost-sensitive
- **Free Tier**: Most generous, best for MVP

**Cost Analysis** (Per User Per Month):

**Conservative Estimate** (10 AI requests/user/month):
- Claude 3.5 Sonnet: $0.05-0.15/user/month
- GPT-4o: $0.03-0.10/user/month
- Gemini Pro: $0.01-0.05/user/month

**Realistic Estimate** (50 AI requests/user/month):
- Claude 3.5 Sonnet: $0.25-0.75/user/month
- GPT-4o: $0.15-0.50/user/month
- Gemini Pro: $0.05-0.25/user/month

**Free Tier Strategy** (CRITICAL):
- **Month 1**: Use free tiers only (Claude Haiku, GPT-3.5, Gemini Pro)
- **Month 2**: Upgrade only if revenue > 3x AI costs
- **Month 3+**: Scale with revenue

**Recommendation**: 
- **Start**: Gemini Pro free tier (most generous)
- **Upgrade**: Claude 3.5 Sonnet (best quality) when revenue justifies
- **Fallback**: GPT-4o (cost-effective alternative)

**ROI Analysis**:
- **AI Cost**: $0.05-0.75/user/month
- **Conversion Impact**: +10-20% (AI features justify premium)
- **Revenue Impact**: +$1-6/user/month (Starter/Pro tiers)
- **Net Benefit**: +$0.25-5.25/user/month (positive ROI)

**When Evaluating AI Services**:
1. **Assess Free Tier**: What's available for free?
2. **Compare Quality**: Which service has best quality for use case?
3. **Calculate Cost**: What's the cost per user per month?
4. **Evaluate ROI**: Does AI feature have positive ROI?
5. **Plan Scaling**: When to upgrade from free tier?

**See**: `mobile-apps/cooking-cheff-buddy/docs/AI_FEATURES_STRATEGIC_DECISION.md` for detailed AI service analysis

---

