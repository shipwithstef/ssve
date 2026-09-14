# Detailed Cost Scenarios (2025)

## Overview

Detailed cost scenarios for various solo developer use cases with complete breakdowns.

## Scenario 1: Static Blog/Portfolio

### Stack
- **Frontend**: GitHub Pages (free)
- **Domain**: Cloudflare Registrar ($10/year)
- **SSL**: Let's Encrypt (free)
- **Analytics**: Google Analytics (free)
- **CDN**: Cloudflare (free)

### Monthly Costs
- **Hosting**: $0
- **Domain**: $0.83/month ($10/year)
- **SSL**: $0
- **Analytics**: $0
- **CDN**: $0
- **Total**: $0.83/month

### Annual Cost
- **Total**: $10/year

## Scenario 2: Full-Stack Web App (MVP)

### Stack
- **Frontend**: Vercel Free
- **Backend**: Railway Hobby ($5/month)
- **Database**: Supabase Free
- **Auth**: Supabase Auth (included)
- **Storage**: Supabase Storage (1 GB free)
- **Email**: Resend Free (3K emails/month)
- **Analytics**: Google Analytics Free
- **Monitoring**: Sentry Free (5K errors/month)
- **Domain**: Cloudflare Registrar ($10/year)

### Monthly Costs
- **Hosting**: $5
- **Database**: $0
- **Email**: $0
- **Analytics**: $0
- **Monitoring**: $0
- **Domain**: $0.83
- **Total**: $5.83/month

### Annual Cost
- **Total**: $70/year

## Scenario 3: Mobile App Backend

### Stack
- **Backend**: Render Starter ($7/month)
- **Database**: Supabase Pro ($25/month)
- **Storage**: Supabase Storage (100 GB included)
- **Auth**: Supabase Auth (included)
- **Email**: Resend Free
- **Monitoring**: Sentry Free
- **CI/CD**: GitHub Actions Free

### Monthly Costs
- **Hosting**: $7
- **Database**: $25
- **Email**: $0
- **Monitoring**: $0
- **CI/CD**: $0
- **Total**: $32/month

### Annual Cost
- **Total**: $384/year

## Scenario 4: SaaS Application (Growing)

### Stack
- **Frontend**: Vercel Pro ($20/month)
- **Backend**: Railway Pro ($20/month)
- **Database**: Supabase Pro ($25/month)
- **Auth**: Clerk Pro ($25/month)
- **Storage**: Cloudflare R2 Free (10 GB)
- **Email**: Resend Pro ($20/month)
- **Analytics**: Plausible ($9/month)
- **Monitoring**: Sentry Team ($26/month)
- **Payments**: Stripe (2.9% + $0.30 per transaction)
- **Domain**: Cloudflare Registrar ($10/year)

### Monthly Costs (Base)
- **Hosting**: $40
- **Database**: $25
- **Auth**: $25
- **Email**: $20
- **Analytics**: $9
- **Monitoring**: $26
- **Domain**: $0.83
- **Total**: $145.83/month

### With Transactions
- **Base**: $145.83/month
- **Stripe Fees**: 2.9% + $0.30 per transaction
- **Example**: 100 transactions × $10 = $1,000 revenue
- **Stripe Fees**: $29 + $30 = $59
- **Total**: $204.83/month

### Annual Cost (Base)
- **Total**: $1,750/year

## Scenario 5: High-Traffic Application

### Stack
- **Frontend**: Vercel Pro ($20/month)
- **Backend**: Hetzner CPX31 ($18/month)
- **Database**: Supabase Team ($599/month)
- **CDN**: Cloudflare Pro ($20/month)
- **Storage**: Cloudflare R2 ($0.015/GB)
- **Email**: Resend Pro ($20/month)
- **Analytics**: PostHog ($0-50/month)
- **Monitoring**: Sentry Team ($26/month)
- **Domain**: Cloudflare Registrar ($10/year)

### Monthly Costs
- **Hosting**: $18
- **Database**: $599
- **CDN**: $20
- **Storage**: ~$5 (assuming 300 GB)
- **Email**: $20
- **Analytics**: $25 (mid-range)
- **Monitoring**: $26
- **Domain**: $0.83
- **Total**: $713.83/month

### Annual Cost
- **Total**: $8,566/year

## Scenario 6: E-Commerce Site

### Stack
- **Frontend**: Shopify ($29/month) or Custom + Vercel ($20/month)
- **Backend**: Railway Pro ($20/month)
- **Database**: Supabase Pro ($25/month)
- **Payments**: Stripe (2.9% + $0.30)
- **Email**: Resend Pro ($20/month)
- **Analytics**: Google Analytics Free
- **Monitoring**: Sentry Free
- **Domain**: Cloudflare Registrar ($10/year)

### Monthly Costs (Base)
- **Hosting**: $20-29
- **Database**: $25
- **Email**: $20
- **Analytics**: $0
- **Monitoring**: $0
- **Domain**: $0.83
- **Total**: $65.83-74.83/month

### With Transactions
- **Base**: $65.83/month
- **Stripe Fees**: 2.9% + $0.30 per transaction
- **Example**: 500 transactions × $50 = $25,000 revenue
- **Stripe Fees**: $725 + $150 = $875
- **Total**: $940.83/month

## Scenario 7: API Service

### Stack
- **API**: Google Cloud Run Free (2M requests)
- **Database**: Supabase Free or PlanetScale Free
- **CDN**: Cloudflare Free
- **Monitoring**: Sentry Free
- **Domain**: Cloudflare Registrar ($10/year)

### Monthly Costs
- **API**: $0 (within free tier)
- **Database**: $0
- **CDN**: $0
- **Monitoring**: $0
- **Domain**: $0.83
- **Total**: $0.83/month

### If Exceeding Free Tier
- **API**: ~$5-10/month (pay-as-you-go)
- **Database**: $25/month (Supabase Pro)
- **Total**: $30-35/month

## Scenario 8: AI/ML Application

### Stack
- **Backend**: Hetzner CPX21 ($9/month)
- **Database**: Supabase Pro ($25/month)
- **AI API**: OpenAI (pay-as-you-go)
- **Storage**: Supabase Storage (100 GB included)
- **Monitoring**: Sentry Free
- **Domain**: Cloudflare Registrar ($10/year)

### Monthly Costs (Base)
- **Hosting**: $9
- **Database**: $25
- **AI API**: Varies ($10-100/month typical)
- **Monitoring**: $0
- **Domain**: $0.83
- **Total**: $34.83-124.83/month

## Cost Breakdown by Phase

### Phase 1: MVP ($0-10/month)
- Free tiers everywhere
- Minimal paid services
- Focus on validation

### Phase 2: Early Launch ($10-50/month)
- Upgrade hosting for reliability
- Add paid database if needed
- Basic monitoring

### Phase 3: Growth ($50-200/month)
- Scale infrastructure
- Add paid services
- Professional tools

### Phase 4: Scale ($200-1000/month)
- Optimize for performance
- Enterprise features
- Advanced monitoring

## Cost Optimization by Scenario

### Static Site
- Use all free tiers
- GitHub Pages + Cloudflare
- Total: $0-1/month

### Full-Stack App
- Combine free tiers
- Railway + Supabase Free
- Total: $5-30/month

### SaaS App
- Optimize database usage
- Use caching
- Monitor closely
- Total: $50-200/month

## Next Steps

1. **Identify Scenario**: Match your use case
2. **Estimate Costs**: Use scenario as baseline
3. **Optimize**: Reduce costs where possible
4. **Monitor**: Track actual spending
5. **Adjust**: Optimize based on usage






