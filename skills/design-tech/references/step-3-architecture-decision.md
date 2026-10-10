### Step 3: Architecture Decision

Define the high-level approach. This is where you answer:

1. **Where does this feature live?** New module, extension of existing, new service?
2. **What components are needed?** UI components, services, models, API endpoints
3. **What data model changes?** New tables, columns, relationships, migrations
4. **What external dependencies?** Third-party APIs, libraries, services
5. **What's the data flow?** User action → frontend → API → backend → database → response

**Template:**
```markdown
## Technical Design

### Architecture

[2-3 sentences: high-level approach, where it fits in the codebase]

### Components

| Component | Type | Responsibility | New/Modify |
|-----------|------|---------------|------------|
| [Name] | [UI/Service/Model/API/Migration] | [What it does] | [New/Modify existing] |

### Data Model

[Schema changes, new tables/columns, relationships]
[If no data changes: "No data model changes required."]

### Data Flow

[Step-by-step: user action through system and back]

### External Dependencies

[New libraries, APIs, services — or "None"]

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| [What needs deciding] | [What we chose] | [Why — reference existing patterns or constraints] |

### Competitive Tech Alternatives (per WI-140 TECH-01..03)

When the feature touches core mechanics (earn / redeem / verify / enroll / loyalty / points / reward), this subsection is REQUIRED. Lists what each direct competitor uses for the same mechanic, what we're choosing, why ours differs.

```markdown
| Competitor | Their tech for this mechanic | What we use | Why we differ |
|-----------|------------------------------|-------------|---------------|
| Toast Loyalty | Native POS hook | OCR receipt scan | No POS partnership yet (WI-XXX); receipt OCR is compensating control |
| Square Loyalty | Square POS API | OCR receipt scan | Same reason |
```

If `landscape_state: populated` (per `docs/specs/analyze-competitors.data.json`) AND chosen tech matches NO competitor pattern, ALSO add an explicit ADR under Technical Design explaining the divergence (TECH-03). The ADR should cite the Compensating Control section in the spec (per CC-01).

### Cost Model

**Mandatory.** Every feature has a cost, even if it's "zero today on free tier." State it explicitly so future-you can spot when the cost curve bends.

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute (per-request CPU/memory) | [e.g., ~5ms Vercel function = $0.0000001] | [e.g., 10k req/mo baseline] | [e.g., ~$0.001] | [e.g., linear with requests] | [user business / customer / free tier] |
| Storage (persistent data) | [e.g., Supabase $0 up to 500MB] | [e.g., 1KB per row × 50k rows] | [e.g., $0 (free tier)] | [e.g., linear with rows] | [who] |
| Bandwidth (egress) | [e.g., Vercel $0 up to 100GB] | [e.g., 50MB/mo] | [e.g., $0] | [linear] | [who] |
| External API calls | [e.g., OpenAI $0.002/call] | [e.g., 500 calls/mo] | [e.g., $1] | [linear] | [user / business] |
| Background jobs | [e.g., cron, $0 on Vercel free tier] | [e.g., 1 run/hour] | [e.g., $0] | [constant] | [who] |

**Scaling trigger points:** when does this become expensive?
- At [X users / Y requests / Z GB] the free tier caps out
- At [X users] we move from [current tier] to [next tier] at [$Y/mo]
- **Red line:** [when does cost exceed revenue for a user segment?]

**First-month and year-1 projections:** [e.g., "$0 at 100 users, $12 at 1000 users, $85 at 10k users"]

**Zero-cost justification (if claiming $0):** [specific free-tier quotas being consumed + headroom]

### Operations & Ownership

**Mandatory.** Features don't run themselves. State who owns this in production and what happens when it breaks.

| Dimension | Answer |
|---|---|
| **Owner** | [Who maintains this code post-ship — name/role or "solo founder" for indie projects] |
| **On-call** | [Who gets paged when it breaks — or "no paging, best-effort response" for indie projects] |
| **SLA / SLO** | [e.g., "99.5% availability, <500ms p95 latency" or "best effort, no guarantee" — must be explicit] |
| **Error budget** | [e.g., "20 min downtime/month" or "N/A for best-effort" — must be explicit] |
| **Monitoring** | [What's being measured — uptime, latency, error rate, custom metric — and where (Plausible, Sentry, Grafana, none)] |
| **Alerting** | [What triggers a notification — specific thresholds — and where it goes (email, Slack, PagerDuty, none)] |
| **Dashboard** | [Link to the single-pane view or "none — no dashboard yet"] |
| **Runbook** | [Link to the "when X breaks, do Y" doc or "none — troubleshoot from code"] |
| **Failure modes** | [What are the known ways this fails? What happens to the user when it does?] |
| **Recovery procedure** | [How do we get it back up? Restart? Rollback? Manual intervention? Data restore?] |
| **Backup / restore** | [What data is backed up, how often, how do we restore it — or "N/A, stateless"] |
| **Dependencies' failure impact** | [If Supabase/Stripe/OpenAI goes down, what happens to this feature?] |

**"Best effort" is a valid answer for indie / pre-PMF projects** — but it must be explicitly stated, not implied. "No SLA" is acceptable. "Didn't think about SLA" is not.
```
