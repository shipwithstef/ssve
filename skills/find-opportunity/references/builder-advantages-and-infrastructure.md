## Step 1: Extract Builder Advantages

From the builder profile, extract what this specific person can do BETTER or
CHEAPER than the average builder.

```markdown
## Builder Advantages

### Can Build (Technical Edge)
- <languages, frameworks, infra>

### Can Reach (Distribution Edge)
- <social platforms, communities, email list, marketplace presence>

### Has (Infrastructure Edge)
- <subscriptions, free tiers, domains, codebases, entity status>

### Time Budget
- <hours/week available, realistic ship timeline>

### Unique Angle
- <domain expertise from job, hobby, past projects>

### Hard Constraints
- <skills failed before, budget ceiling, entity status, employment limits>

### History Signal
- <patterns from past projects: what worked, what killed them>
```

**Critical:** If the builder profile shows a repeated failure mode (2+ projects
died the same way), that failure mode becomes a hard veto.

---

## Step 4: Self-Sustaining Infrastructure

**Mandatory:** every recommendation uses infrastructure that costs $0 until
revenue exceeds the cost.

| Layer | Free Tier Pick | Scales To |
|---|---|---|
| Database | Supabase (500MB, 50K rows) | Supabase Pro ($25/mo) |
| Hosting | Vercel (100GB bandwidth) | Vercel Pro ($20/mo) |
| Auth | Supabase Auth (50K MAU) or Clerk (10K MAU) | Pro tier |
| Storage | Supabase Storage (1GB) or Cloudflare R2 (10GB) | Pay as you grow |
| Email | Resend (3K/mo) or Loops (1K contacts) | Resend $20/mo |
| Payments | Dodo / LemonSqueezy / Gumroad — no entity needed | Stripe when entity exists |
| Analytics | Plausible (free trial) or Umami (self-hosted free) | Plausible $9/mo |
| AI (wrapper) | OpenAI / Anthropic API (user-funded) | Scales with users |
| Mobile | Expo + EAS (30 builds/mo free) | EAS $99/mo |

**Rule:** $0 out of pocket until revenue exceeds infra cost. If an opportunity
requires paid infra from day 1 and the builder has $0 budget, disqualify it.

---
