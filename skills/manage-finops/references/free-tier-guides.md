# Free Tier Guides

## Overview

Comprehensive guide to free tiers across cloud platforms and services to maximize cost savings for solo developers.

## Cloud Platforms

### AWS Free Tier
**Duration**: 12 months for new accounts

**Services Included**:
- **EC2**: 750 hours/month of t2.micro or t3.micro
- **S3**: 5 GB storage, 20K GET requests, 2K PUT requests
- **RDS**: 750 hours/month of db.t2.micro or db.t3.micro
- **Lambda**: 1M requests/month, 400K GB-seconds
- **CloudFront**: 1 TB data transfer, 10M requests
- **API Gateway**: 1M API calls/month
- **DynamoDB**: 25 GB storage, 25 units read/write capacity

**Best For**: Learning, MVP development, testing

### Google Cloud Free Tier
**Duration**: Always free (with limits)

**Services Included**:
- **Compute Engine**: 1 e2-micro instance/month (always free)
- **Cloud Run**: 2M requests/month, 360K GB-seconds
- **Firebase**: Spark plan (free tier)
- **Cloud Storage**: 5 GB/month
- **Cloud Functions**: 2M invocations/month, 400K GB-seconds
- **Cloud SQL**: No free tier (but low-cost options)

**Best For**: Always-free resources, Firebase users

### Azure Free Tier
**Duration**: Always free + 12 months free + $200 credit (30 days)

**Services Included**:
- **$200 Credit**: First 30 days (explore any service)
- **Virtual Machines**: 750 hours/month each of B1s, B2pts v2, B2ats v2 (12 months)
- **App Service**: 10 web/mobile apps, 1 GB storage each (always free)
- **Functions**: 1M requests/month, 400K GB-seconds (always free)
- **SQL Database**: 100K vCore seconds, 32 GB storage (always free)
- **Blob Storage**: 5 GB LRS, 20K reads, 10K writes (12 months)
- **Cosmos DB**: 400 RU/s, 5 GB storage (always free)
- **DevOps**: 5 users, unlimited repos (always free)
- **Event Grid**: 100K operations/month (always free)
- **Active Directory**: 50K objects (always free)

**Best For**: Microsoft ecosystem, enterprise, comprehensive free tier

## Hosting Platforms

### Railway Free Tier
- **Trial**: $5 credit to start
- **Pay-as-you-go**: After credit
- **Best For**: Testing, short-term projects

### Render Free Tier
- **750 hours/month**: Per service
- **100 GB bandwidth**: Per month
- **Sleeps after**: 15 minutes inactivity
- **Best For**: Development, staging, low-traffic apps

### Vercel Free Tier
- **Unlimited**: Deployments
- **100 GB**: Bandwidth/month
- **100 GB-hours**: Serverless functions
- **Best For**: Frontend, Next.js, JAMstack

### Netlify Free Tier
- **100 GB**: Bandwidth/month
- **300 minutes**: Build time/month
- **125K requests**: Serverless functions
- **Best For**: Static sites, JAMstack

### Fly.io Free Tier
- **3 shared-cpu VMs**: Always free
- **3 GB**: Persistent storage
- **160 GB**: Outbound data transfer
- **Best For**: Global apps, Docker containers

## Databases

### Supabase Free Tier
- **500 MB**: Database storage
- **1 GB**: File storage
- **2 GB**: Bandwidth
- **50K**: Monthly active users
- **Best For**: Firebase alternative, Postgres

### PlanetScale Free Tier
- **1 database**: Free
- **1 branch**: Free
- **5 GB**: Storage
- **1B reads/month**: Free
- **10M writes/month**: Free
- **Best For**: Serverless MySQL, branching

### Neon Free Tier
- **0.5 GB**: Storage
- **512 MB**: Compute
- **Best For**: Serverless Postgres

### MongoDB Atlas Free Tier
- **512 MB**: Storage
- **Shared cluster**: Free
- **Best For**: NoSQL, document database

## CDN and Edge

### Cloudflare Free Tier
- **Unlimited**: Bandwidth
- **Unlimited**: Requests
- **DDoS Protection**: Included
- **SSL**: Included
- **Best For**: CDN, DNS, security

### CloudFront Free Tier (AWS)
- **1 TB**: Data transfer
- **10M**: Requests
- **Duration**: 12 months
- **Best For**: AWS users

## Email Services

### Resend Free Tier
- **3,000 emails/month**: Free
- **100 emails/day**: Limit
- **Best For**: Transactional emails

### SendGrid Free Tier
- **100 emails/day**: Free
- **Best For**: Marketing emails, transactional

### Mailgun Free Tier
- **5,000 emails/month**: Free (first 3 months)
- **Best For**: Developer-friendly

## Monitoring and Analytics

### Sentry Free Tier
- **5K errors/month**: Free
- **10K performance units**: Free
- **Best For**: Error tracking, performance monitoring

### Plausible Free Tier
- **Trial**: 30 days
- **Then**: $9/month (very affordable)
- **Best For**: Privacy-focused analytics

### PostHog Free Tier
- **1M events/month**: Free
- **Best For**: Product analytics, feature flags

## Storage

### AWS S3 Free Tier
- **5 GB**: Storage
- **20K GET requests**: Free
- **2K PUT requests**: Free
- **Duration**: 12 months
- **Best For**: Object storage, backups

### Google Cloud Storage Free Tier
- **5 GB**: Standard storage
- **5 GB**: Regional storage
- **Always free**: (with limits)
- **Best For**: GCP users

### Azure Blob Storage Free Tier
- **5 GB**: Locally redundant storage
- **20K Read Operations**: Per month
- **10K Write Operations**: Per month
- **Duration**: 12 months
- **Best For**: Azure users, object storage

### Backblaze B2 Free Tier
- **10 GB**: Free storage
- **1 GB Download**: Per day free
- **Always free**: (with limits)
- **Best For**: Backups, cost-effective storage

### Cloudflare R2 Free Tier
- **10 GB**: Free storage
- **No Egress Fees**: Free downloads
- **Always free**: (with limits)
- **Best For**: CDN-integrated storage

## Additional Free Services

### CI/CD Platforms
- **GitHub Actions**: 2,000 minutes/month (private repos)
- **GitLab CI**: 400 minutes/month
- **Cloudflare Pages**: Unlimited builds
- **Vercel**: Unlimited builds

### Domain & DNS
- **Cloudflare DNS**: Free forever
- **Cloudflare Registrar**: At-cost pricing
- **Let's Encrypt SSL**: Free forever

### Payment Processing
- **Stripe**: Free setup, 2.9% + $0.30 per transaction
- **PayPal**: Free setup, 2.9% + $0.30 per transaction

### Infrastructure as Code
- **Terraform Cloud**: 500 resources free
- **Pulumi**: Unlimited individual use

### Monitoring & Analytics
- **UptimeRobot**: 50 monitors free
- **Better Uptime**: 10 monitors free
- **Google Analytics**: Free forever
- **PostHog**: 1M events/month free

## Maximizing Free Tiers

### Strategy 1: Combine Free Tiers
- Use multiple free tiers together
- Example: Railway + Supabase + Cloudflare + GitHub Actions
- Total: $0/month

### Strategy 2: Use Free Tier Limits
- Stay within free tier limits
- Monitor usage carefully
- Set up alerts

### Strategy 3: Rotate Services
- Use different free tiers for different projects
- Maximize usage across services
- Example: Azure for one project, AWS for another

### Strategy 4: Plan Upgrades
- Know when you'll exceed free tiers
- Plan for paid upgrades
- Budget accordingly

### Strategy 5: Stack Referrals
- Use referral programs for credits
- Combine with free tiers
- Maximize initial credits

## Free Tier Limitations

### Common Limitations
- **Time Limits**: Some free tiers expire (12 months)
- **Usage Limits**: Bandwidth, storage, requests
- **Feature Limits**: Reduced features vs paid
- **Support**: Limited or no support

### Planning for Upgrades
- **Monitor Usage**: Track usage against limits
- **Set Alerts**: Get notified before limits
- **Budget**: Plan for paid upgrades
- **Optimize**: Maximize free tier usage

## Recommendations

### MVP Phase
- **Use All Free Tiers**: Maximize free usage
- **Combine Services**: Use multiple free tiers
- **Monitor Limits**: Stay within limits
- **Total Cost**: $0-5/month

### Growth Phase
- **Selective Upgrades**: Upgrade only when needed
- **Keep Free Where Possible**: Maintain free tiers
- **Monitor Costs**: Track spending
- **Total Cost**: $5-50/month

## Next Steps

1. **Identify Free Tiers**: List all available free tiers
2. **Plan Usage**: Determine how to use free tiers
3. **Set Up Monitoring**: Track usage against limits
4. **Plan Upgrades**: Know when to upgrade
5. **Optimize**: Maximize free tier value

