# FinOps Quick Reference Guide (2025)

## Quick Platform Comparison

### Cloud Hosting (VPS)
| Platform | Entry | Free Tier | Best For |
|----------|-------|-----------|----------|
| Hetzner | $4.50/month | No | Cost-conscious |
| AWS | $6/month | 12 months | Enterprise |
| Azure | $0/month | Very generous | Microsoft stack |
| GCP | $4.80/month | Generous | ML/AI |
| Oracle Cloud | $0/month | Very generous | Databases |
| DigitalOcean | $4/month | $100 credit | Simplicity |

### PaaS Hosting
| Platform | Entry | Free Tier | Best For |
|----------|-------|-----------|----------|
| Railway | $5/month | Trial | Full-stack |
| Render | $7/month | Yes | Full-stack |
| Vercel | $0/month | Yes | Frontend |
| Netlify | $0/month | Yes | Static sites |
| Fly.io | Pay-as-go | Yes | Global apps |

### Databases
| Database | Entry | Free Tier | Best For |
|----------|-------|-----------|----------|
| Supabase | $0/month | 500 MB | Full-stack |
| PlanetScale | $0/month | 5 GB | Serverless MySQL |
| Neon | $0/month | 0.5 GB | Serverless Postgres |
| MongoDB Atlas | $0/month | 512 MB | NoSQL |
| Fauna | $0/month | 5 GB | Serverless |
| Turso | $0/month | 500 MB | Edge SQLite |

### Authentication
| Service | Entry | Free Tier | Best For |
|---------|-------|-----------|----------|
| Supabase Auth | $0/month | 50K MAUs | Supabase users |
| Clerk | $0/month | 10K MAUs | Quick setup |
| Auth0 | $0/month | 7K MAUs | Enterprise |
| Firebase Auth | $0/month | Unlimited | Firebase users |
| NextAuth.js | $0/month | Unlimited | Self-hosted |

### Mobile Builds
| Service | Entry | Free Tier | Best For |
|---------|-------|-----------|----------|
| Expo EAS | $0/month | 30 builds | Expo apps |
| GitHub Actions | $0/month | 2K min/month | Free CI/CD |
| Bitrise | $0/month | 200 builds | Mobile CI/CD |

## Free Stack Examples

### Absolute Free ($0/month)
- **Frontend**: GitHub Pages
- **Backend**: Google Cloud Run Free
- **Database**: Supabase Free
- **CDN**: Cloudflare Free
- **Email**: Resend Free
- **Analytics**: Google Analytics Free
- **Total**: $0/month

### Low-Cost ($25/month)
- **Frontend**: Vercel Free
- **Backend**: Railway Hobby ($5)
- **Database**: Supabase Pro ($25)
- **CDN**: Cloudflare Free
- **Email**: Resend Free
- **Total**: $30/month

### Production ($50/month)
- **Frontend**: Vercel Pro ($20)
- **Backend**: Railway Pro ($20)
- **Database**: Supabase Pro ($25)
- **Email**: Resend Pro ($20)
- **Analytics**: Plausible ($9)
- **Total**: $94/month

## Cost by Use Case

### Static Site
- **Cost**: $0-1/month
- **Stack**: GitHub Pages + Cloudflare

### Full-Stack App
- **Cost**: $5-50/month
- **Stack**: Railway + Supabase

### Mobile App Backend
- **Cost**: $25-50/month
- **Stack**: Render + Supabase Pro

### SaaS Application
- **Cost**: $50-200/month
- **Stack**: Vercel + Railway + Supabase + Clerk

### High-Traffic App
- **Cost**: $200-1000/month
- **Stack**: VPS + Supabase Team + CDN

## Free Tier Limits Quick Reference

### AWS Free Tier (12 months)
- EC2: 750 hours/month
- S3: 5 GB
- Lambda: 1M requests/month
- RDS: 750 hours/month

### Azure Free Tier
- $200 credit (30 days)
- App Service: 10 apps (always free)
- Functions: 1M requests/month (always free)
- SQL Database: 100K vCore seconds (always free)

### GCP Free Tier
- $300 credit (90 days)
- Compute Engine: 1 e2-micro (always free)
- Cloud Run: 2M requests/month (always free)
- Cloud Functions: 2M invocations/month (always free)

### Supabase Free Tier
- 2 projects
- 500 MB database
- 1 GB files
- 50K MAUs

### Railway Free Tier
- $5 credit trial
- Then pay-as-you-go

### Render Free Tier
- 750 hours/month
- Sleeps after 15 min

## Referral Credits Quick Reference

- **AWS**: $25-100 credits (varies)
- **GCP**: $300 credits (new accounts)
- **Azure**: $200 credits (30 days)
- **DigitalOcean**: $200 credits (referee), $25 (referrer)
- **Railway**: $5 credits (both)
- **Render**: $25 credits (both)

## Common Monthly Budgets

### Budget 1: Free ($0/month)
- All free tiers
- Domain: $10/year
- **Total**: ~$1/month

### Budget 2: Starter ($25/month)
- Railway Hobby: $5
- Supabase Pro: $25
- **Total**: $30/month

### Budget 3: Production ($50/month)
- Railway Pro: $20
- Supabase Pro: $25
- Plausible: $9
- **Total**: $54/month

### Budget 4: Growing ($100/month)
- Vercel Pro: $20
- Railway Pro: $20
- Supabase Pro: $25
- Clerk Pro: $25
- Resend Pro: $20
- **Total**: $110/month

## Quick Decision Tree

### Need Hosting?
- **Static Site**: GitHub Pages (free)
- **Full-Stack**: Railway ($5) or Render Free
- **Frontend Only**: Vercel Free or Netlify Free
- **Global**: Fly.io Free

### Need Database?
- **PostgreSQL**: Supabase Free or Neon Free
- **MySQL**: PlanetScale Free
- **NoSQL**: MongoDB Atlas Free or Fauna Free
- **Edge**: Turso Free

### Need Auth?
- **Quick Setup**: Clerk Free (10K MAUs)
- **Full-Stack**: Supabase Auth Free (50K MAUs)
- **Self-Host**: NextAuth.js Free
- **Firebase**: Firebase Auth Free

### Need Email?
- **Transactional**: Resend Free (3K/month)
- **Marketing**: SendGrid Free (100/day)
- **High Volume**: AWS SES Free (62K/month from EC2)

### Need Monitoring?
- **Errors**: Sentry Free (5K/month)
- **Uptime**: UptimeRobot Free (50 monitors)
- **Analytics**: Google Analytics Free

## Cost Optimization Quick Tips

1. **Start Free**: Use all free tiers
2. **Combine Services**: Use multiple free tiers
3. **Monitor Usage**: Track against limits
4. **Right-Size**: Match resources to needs
5. **Use Referrals**: Get credits
6. **Optimize Early**: Start optimization from day one
7. **Review Monthly**: Check costs regularly

## Emergency Cost Reduction

If costs are too high:

1. **Downgrade Plans**: Move to lower tiers
2. **Use Free Alternatives**: Switch to free services
3. **Self-Host**: Move to VPS (Hetzner $4.50/month)
4. **Optimize Usage**: Reduce resource usage
5. **Combine Services**: Use fewer services
6. **Archive Data**: Move old data to cheaper storage

## AI Model Quick Reference

### Cost Comparison (per 1M input tokens)
| Provider | Model | Input Cost | Output Cost | Best For |
|----------|-------|------------|-------------|----------|
| Google AI Studio | Gemini 2.5 Flash | $0.075 | $0.30 | Cheapest (free tier available) |
| Google | Gemini 2.5 Flash-Lite | $0.10 | $0.40 | Ultra-low cost |
| Google | Gemini 2.5 Pro (≤200k) | $1.25 | $10.00 | High quality |
| Google | Gemini 2.5 Pro (>200k) | $2.50 | $15.00 | Long context |
| DeepSeek | DeepSeek-R1 | $0.55 | $2.19 | Budget reasoning |
| DeepSeek | DeepSeek-R1 (off-peak) | $0.14 | $0.55 | Off-peak discount |
| Mistral | Medium 3 | $0.40 | $2.00 | European data |
| OpenAI | GPT-3.5 Turbo | $0.30 | $0.60 | General purpose |
| OpenAI | GPT-4o | $2.50 | $5.00 | High quality |
| OpenAI | o3-pro | $20.00 | $80.00 | Advanced reasoning |
| Anthropic | Claude 4 Haiku | $1.00 | $5.00 | Low latency |
| Anthropic | Claude 4 Sonnet | $3.00 | $15.00 | Long context |
| Anthropic | Claude 4 Opus | $15.00 | $75.00 | Highest quality |

### Vibe Coding Platforms
| Platform | Free Tier | Entry Paid | Best For |
|----------|-----------|------------|----------|
| Codeium | Unlimited | $12/month | Free alternative |
| GitHub Copilot | Students | $10/month | Code completion |
| Cursor | Yes | $16/month | AI IDE |
| Lovable | Yes | $25/month | Full-stack apps |
| Manus | 1 task/day | $39/month | AI agents |
| v0 | Yes | Varies | UI components |

### AI Cost Scenarios
- **Low Volume (1M tokens/month)**: $0.19/month (Gemini 2.5 Flash)
- **Medium Volume (10M tokens/month)**: $4.50/month (GPT-3.5 Turbo)
- **High Volume (100M tokens/month)**: $18.75/month (Gemini 2.5 Flash)
- **High Quality (10M tokens/month)**: $37.50/month (GPT-4o)
- **Long Context (10M tokens, 500K context)**: $87.50/month (Gemini 2.5 Pro)

### Google AI Studio Quick Reference
- **Free Tier**: Yes, unlimited Gemini 2.5 Flash, limited Pro
- **Best For**: Prototyping, testing, learning
- **API Pricing**: Pay-as-you-go for production
- **Subscription**: Google AI Plus ~$4.30/month (select regions)
- **Enterprise**: Gemini Enterprise $30/user/month

## Next Steps

1. **Identify Needs**: Determine requirements
2. **Choose Stack**: Select from quick reference
3. **Estimate Costs**: Use budget examples
4. **Start Free**: Begin with free tiers
5. **Monitor**: Track spending
6. **Optimize**: Reduce costs continuously
7. **Consider AI**: Factor in AI costs if using


## Official Pricing URLs

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

