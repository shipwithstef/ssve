# Cloud Platform Pricing Guide (2025)

## Overview

Comprehensive pricing comparison for major cloud providers, updated for 2025. All prices in USD unless noted.

## Hetzner Cloud

### VPS Instances (CPX Series)
- **CPX11**: €4.15/month (~$4.50)
  - 2 vCPU, 4 GB RAM, 80 GB SSD
  - 20 TB traffic
  - Best for: Small apps, development

- **CPX21**: €8.30/month (~$9.00)
  - 3 vCPU, 8 GB RAM, 160 GB SSD
  - 20 TB traffic
  - Best for: Medium apps, staging

- **CPX31**: €16.60/month (~$18.00)
  - 4 vCPU, 16 GB RAM, 240 GB SSD
  - 20 TB traffic
  - Best for: Production apps

- **CPX41**: €33.20/month (~$36.00)
  - 8 vCPU, 32 GB RAM, 360 GB SSD
  - 20 TB traffic
  - Best for: High-traffic apps

### Dedicated Servers
- **AX41**: €39.00/month (~$42.00)
  - AMD Ryzen 5 3600, 64 GB RAM, 2x512 GB NVMe
  - Best for: High-performance needs

### Storage
- **Storage Box**: €2.96/month (~$3.20)
  - 1 TB storage, 1 TB traffic
  - Best for: Backups, file storage

### Key Advantages
- ✅ Excellent price/performance ratio
- ✅ Predictable monthly pricing
- ✅ Generous traffic included
- ✅ No hidden fees
- ❌ Limited global regions (Europe, US)

**Best For**: Solo developers, startups, cost-conscious projects

## AWS (Amazon Web Services)

### EC2 Instances (On-Demand)
- **t4g.micro**: $0.0084/hour (~$6/month)
  - 2 vCPU, 1 GB RAM
  - ARM-based, free tier eligible

- **t3.micro**: $0.0104/hour (~$7.50/month)
  - 2 vCPU, 1 GB RAM
  - Free tier: 750 hours/month for 12 months

- **t3.small**: $0.0208/hour (~$15/month)
  - 2 vCPU, 2 GB RAM

- **t3.medium**: $0.0416/hour (~$30/month)
  - 2 vCPU, 4 GB RAM

### Lambda (Serverless)
- **Free Tier**: 1M requests/month, 400K GB-seconds
- **Pricing**: $0.20 per 1M requests, $0.0000166667 per GB-second
- **Best for**: Event-driven, low-traffic apps

### RDS (Managed Database)
- **db.t3.micro**: ~$15/month
  - 2 vCPU, 1 GB RAM, 20 GB storage
  - Free tier: 750 hours/month for 12 months

- **db.t3.small**: ~$30/month
  - 2 vCPU, 2 GB RAM, 20 GB storage

### S3 (Object Storage)
- **Standard Storage**: $0.023/GB/month
- **First 50 TB**: $0.023/GB/month
- **Free Tier**: 5 GB for 12 months

### CloudFront (CDN)
- **Free Tier**: 1 TB data transfer, 10M requests
- **Pricing**: $0.085/GB (first 10 TB)

### Key Advantages
- ✅ Extensive global infrastructure
- ✅ Comprehensive service catalog
- ✅ Free tier for 12 months
- ✅ Reserved instances for savings
- ❌ Complex pricing structure
- ❌ Can get expensive quickly

**Best For**: Enterprise, global scale, complex architectures

## Google Cloud Platform (GCP)

### Compute Engine (VMs)
- **e2-micro**: $0.0067/hour (~$4.80/month)
  - 2 vCPU, 1 GB RAM
  - Free tier: 1 instance/month

- **e2-small**: $0.0134/hour (~$9.60/month)
  - 2 vCPU, 2 GB RAM

- **e2-medium**: $0.0267/hour (~$19.20/month)
  - 2 vCPU, 4 GB RAM

### Cloud Run (Serverless Containers)
- **Free Tier**: 2M requests/month, 360K GB-seconds
- **Pricing**: $0.40 per million requests, $0.0000025 per GB-second
- **Best for**: Containerized apps, auto-scaling

### Firebase (Backend-as-a-Service)
- **Spark Plan**: Free
  - 1 GB storage, 10 GB bandwidth
  - 50K reads/day, 20K writes/day

- **Blaze Plan**: Pay-as-you-go
  - $0.06/GB storage, $0.12/GB bandwidth
  - $0.36/million reads, $1.08/million writes

### Cloud SQL (Managed Database)
- **db-f1-micro**: ~$7/month
  - Shared CPU, 0.6 GB RAM, 10 GB storage

- **db-g1-small**: ~$25/month
  - 1 vCPU, 1.7 GB RAM, 10 GB storage

### Key Advantages
- ✅ Generous free tier
- ✅ Competitive pricing
- ✅ Excellent for ML/AI
- ✅ Firebase integration
- ❌ Less mature than AWS
- ❌ Smaller ecosystem

**Best For**: ML/AI projects, Firebase users, cost-conscious developers

## DeepBlue AI Cloud

### GPU Instances
- **GPU Standard**: ~$0.50/hour (~$360/month)
  - NVIDIA GPU, suitable for ML training
  - Best for: AI/ML workloads

- **GPU High-Memory**: ~$1.00/hour (~$720/month)
  - High-memory GPU instance
  - Best for: Large model training

### Key Advantages
- ✅ Competitive GPU pricing
- ✅ ML/AI optimized
- ✅ Simple pricing
- ❌ Limited to GPU workloads
- ❌ Smaller provider

**Best For**: Machine learning, AI model training, GPU workloads

## DigitalOcean

### Droplets (VPS)
- **Basic**: $4/month
  - 1 vCPU, 512 MB RAM, 10 GB SSD
  - 0.5 TB transfer

- **Basic**: $6/month
  - 1 vCPU, 1 GB RAM, 25 GB SSD
  - 1 TB transfer

- **Basic**: $12/month
  - 2 vCPU, 2 GB RAM, 50 GB SSD
  - 2 TB transfer

- **Basic**: $24/month
  - 4 vCPU, 8 GB RAM, 160 GB SSD
  - 4 TB transfer

### Managed Databases
- **Basic**: $15/month
  - 1 GB RAM, 10 GB storage, 1 vCPU

### Key Advantages
- ✅ Simple pricing
- ✅ Good documentation
- ✅ Developer-friendly
- ✅ Predictable costs
- ❌ More expensive than Hetzner
- ❌ Limited regions

**Best For**: Developers who want simplicity, good documentation

## Azure (Microsoft)

### App Service (Free Tier)
- **10 Apps**: Web, mobile, or API apps
- **1 GB Storage**: Per app
- **1 Hour Compute**: Per day per app
- **Cost**: $0/month (always free)
- **Best For**: Development, testing, demos

### App Service (Paid)
- **Basic**: $13/month (1.75 GB RAM, 1 CPU)
- **Standard**: $50/month (3.5 GB RAM, 2 CPU)
- **Premium**: $146/month (7 GB RAM, 4 CPU)

### Azure Functions (Free Tier)
- **1 Million Requests**: Per month
- **400,000 GB-seconds**: Resource consumption
- **Cost**: $0/month (always free)
- **Best For**: Serverless APIs, event-driven apps

### Azure SQL Database (Free Tier)
- **100,000 vCore seconds**: Per month
- **32 GB Storage**: Included
- **Cost**: $0/month (always free)
- **Best For**: Small databases, development

### Azure Blob Storage (Free Tier)
- **5 GB**: Locally redundant storage
- **20,000 Read Operations**: Per month
- **10,000 Write Operations**: Per month
- **Cost**: $0/month (12 months free)
- **Best For**: Object storage, backups

### Azure Free Account
- **$200 Credit**: First 30 days
- **12 Months Free**: Popular services
- **Always Free**: 55+ services
- **Best For**: New Azure users, exploration

**See Also**: `azure-pricing-guide.md` for comprehensive Azure information

## Comparison Summary

| Provider | Entry Level | Best For | Free Tier |
|----------|------------|----------|-----------|
| Hetzner | $4.50/month | Cost-conscious | No |
| AWS | $6/month | Enterprise, scale | 12 months |
| Azure | $0/month | Microsoft ecosystem | Very generous |
| GCP | $4.80/month | ML/AI, Firebase | Generous |
| Oracle Cloud | $0/month | Databases | Very generous |
| IBM Cloud | $0/month | AI/ML | 40+ services |
| DeepBlue | $360/month | GPU/ML workloads | No |
| DigitalOcean | $4/month | Simplicity | $100 credit |

## Cost Optimization Tips

1. **Use Free Tiers**: AWS and GCP offer generous free tiers
2. **Reserved Instances**: Save 30-70% with AWS/GCP reserved instances
3. **Spot Instances**: Save up to 90% for fault-tolerant workloads
4. **Right-Size**: Match instance size to actual needs
5. **Monitor Usage**: Set up billing alerts and cost monitoring
6. **Use Serverless**: Lambda/Cloud Run for sporadic workloads
7. **Choose Region**: Some regions are cheaper than others

## Solo Developer Recommendations

**MVP Phase**: 
- Start with AWS/GCP free tier
- Use t3.micro/e2-micro instances
- Estimated: $0-10/month

**Growth Phase**:
- Move to Hetzner CPX11 or DigitalOcean $6/month
- Use managed databases (Supabase free tier)
- Estimated: $10-30/month

**Scale Phase**:
- Use reserved instances for predictable workloads
- Consider CDN (Cloudflare free tier)
- Estimated: $50-200/month



---

# Hosting Platform Comparison


# Hosting Platform Comparison (2025)

## Overview

Comparison of modern PaaS and serverless hosting platforms for solo developers and startups. All prices in USD.

## Railway

### Pricing Model
- **Hobby Plan**: $5/month
  - $5 credit included
  - Pay-as-you-go after credit
  - $0.000463 per GB-hour
  - $0.20 per GB storage/month

- **Pro Plan**: $20/month
  - $20 credit included
  - Same pay-as-you-go rates
  - Team features

### Key Features
- ✅ Automatic deployments from Git
- ✅ Built-in databases
- ✅ Simple pricing
- ✅ Generous free trial
- ✅ Great developer experience
- ❌ Can get expensive with scale
- ❌ Less control than VPS

**Best For**: Solo developers, rapid prototyping, simple deployments

**Estimated Costs**:
- Small app: $5-10/month
- Medium app: $10-20/month
- Large app: $20-50/month

## Render

### Pricing Model
- **Free Tier**: Available
  - 750 hours/month
  - 100 GB bandwidth
  - Sleeps after 15 min inactivity

- **Starter Plan**: $7/month per service
  - Always-on
  - 100 GB bandwidth
  - Custom domains

- **Professional Plan**: $25/month per service
  - Auto-scaling
  - 400 GB bandwidth
  - Priority support

### Key Features
- ✅ Free tier available
- ✅ Auto-scaling
- ✅ Built-in SSL
- ✅ Database hosting
- ✅ Good documentation
- ❌ Free tier sleeps (wakes slowly)
- ❌ Can be expensive for multiple services

**Best For**: Full-stack apps, databases, always-on services

**Estimated Costs**:
- Free tier: $0/month (with limitations)
- Small app: $7-14/month
- Medium app: $25-50/month
- Large app: $50-150/month

## Vercel

### Pricing Model
- **Hobby Plan**: Free
  - Unlimited deployments
  - 100 GB bandwidth/month
  - Serverless functions (100 GB-hours)
  - Good for: Personal projects, demos

- **Pro Plan**: $20/month per user
  - 1 TB bandwidth/month
  - 1000 GB-hours serverless
  - Team collaboration
  - Analytics

- **Enterprise Plan**: Custom
  - Dedicated support
  - SLA guarantees
  - Advanced features

### Key Features
- ✅ Excellent for frontend/Next.js
- ✅ Global CDN
- ✅ Serverless functions
- ✅ Great performance
- ✅ Free tier is generous
- ❌ Limited backend capabilities
- ❌ Can get expensive with traffic

**Best For**: Frontend apps, Next.js, JAMstack, static sites

**Estimated Costs**:
- Free tier: $0/month
- Small app: $0-20/month
- Medium app: $20-60/month
- Large app: $60-200/month

## Netlify

### Pricing Model
- **Starter Plan**: Free
  - 100 GB bandwidth/month
  - 300 build minutes/month
  - Serverless functions (125K requests)
  - Good for: Personal projects

- **Pro Plan**: $19/month per user
  - 1 TB bandwidth/month
  - 1000 build minutes/month
  - 500K serverless requests
  - Form handling

- **Business Plan**: $99/month per user
  - 1.5 TB bandwidth/month
  - 5000 build minutes/month
  - 2M serverless requests
  - Advanced features

### Key Features
- ✅ Great for static sites
- ✅ Serverless functions
- ✅ Form handling
- ✅ Good free tier
- ✅ Easy deployments
- ❌ Limited backend capabilities
- ❌ Can be expensive for teams

**Best For**: Static sites, JAMstack, frontend apps

**Estimated Costs**:
- Free tier: $0/month
- Small app: $0-19/month
- Medium app: $19-99/month
- Large app: $99-300/month

## Fly.io

### Pricing Model
- **Free Tier**: Available
  - 3 shared-cpu VMs
  - 3 GB persistent storage
  - 160 GB outbound data transfer

- **Pay-as-you-go**: After free tier
  - $0.00000194 per second per VM
  - $0.15 per GB storage/month
  - $0.02 per GB outbound data

### Key Features
- ✅ Global edge deployment
- ✅ Docker-based
- ✅ Great for low-latency apps
- ✅ Generous free tier
- ✅ Good for databases
- ❌ Can get complex
- ❌ Pricing can be unpredictable

**Best For**: Global apps, low-latency requirements, Docker apps

**Estimated Costs**:
- Free tier: $0/month (with limitations)
- Small app: $5-15/month
- Medium app: $15-50/month
- Large app: $50-200/month

## Comparison Summary

| Platform | Free Tier | Entry Paid | Best For | Complexity |
|----------|-----------|------------|----------|------------|
| Railway | Trial | $5/month | Full-stack, simplicity | Low |
| Render | Yes | $7/month | Full-stack, databases | Low |
| Vercel | Yes | $20/month | Frontend, Next.js | Low |
| Netlify | Yes | $19/month | Static, JAMstack | Low |
| Fly.io | Yes | Pay-as-go | Global, Docker | Medium |

## Solo Developer Recommendations

### MVP Phase
**Best Choice**: Render Free Tier or Railway Hobby
- Render: Free with sleep (good for testing)
- Railway: $5/month for always-on
- Estimated: $0-5/month

### Growth Phase
**Best Choice**: Railway Pro or Render Starter
- Railway: $20/month, simple pricing
- Render: $7/month per service
- Estimated: $7-25/month

### Scale Phase
**Best Choice**: VPS (Hetzner) or Platform with auto-scaling
- Hetzner: $4.50-18/month
- Render Professional: $25/month
- Estimated: $25-100/month

## Cost Optimization Tips

1. **Use Free Tiers**: All platforms offer free tiers
2. **Monitor Usage**: Set up billing alerts
3. **Right-Size**: Choose appropriate plan for needs
4. **Combine Services**: Use free tier for frontend, paid for backend
5. **Consider VPS**: For predictable workloads, VPS can be cheaper
6. **Use CDN**: Cloudflare free tier for static assets
7. **Optimize Builds**: Reduce build minutes usage

## Platform-Specific Tips

### Railway
- Start with Hobby plan
- Monitor credit usage
- Use environment variables for config
- Consider moving to VPS at scale

### Render
- Use free tier for development
- Upgrade to Starter for production
- Use sleep feature to save costs
- Monitor bandwidth usage

### Vercel
- Perfect for Next.js apps
- Use serverless functions sparingly
- Leverage CDN for static assets
- Monitor bandwidth usage

### Netlify
- Great for static sites
- Use serverless functions for API
- Leverage form handling
- Monitor build minutes

### Fly.io
- Use for global apps
- Monitor data transfer costs
- Use regions strategically
- Consider for databases

## Supabase

### Pricing Model
- **Free Plan**: $0/month
  - 2 active projects
  - 500 MB database storage
  - 1 GB file storage
  - 50,000 MAUs
  - 5 GB bandwidth/month
  - Community support

- **Pro Plan**: $25/month per project
  - 8 GB database storage (included)
  - 100 GB file storage
  - 100,000 MAUs
  - 250 GB bandwidth/month
  - $10 compute credits included
  - Email support
  - Spend cap available

- **Team Plan**: $599/month per organization
  - 100 GB database storage
  - 1 TB file storage
  - 500,000 MAUs
  - 1 TB bandwidth/month
  - PITR, SSO, SOC 2 compliance
  - Priority support

### Key Features
- ✅ PostgreSQL database
- ✅ Real-time subscriptions
- ✅ Authentication built-in
- ✅ Storage included
- ✅ Edge Functions
- ✅ Great free tier
- ✅ Open source
- ❌ Can get expensive at scale
- ❌ Compute costs add up

**Best For**: Full-stack apps, Firebase alternative, PostgreSQL apps

**Estimated Costs**:
- Free tier: $0/month (with limitations)
- Small app: $25-35/month (Pro + compute)
- Medium app: $35-100/month
- Large app: $100-600/month (Team plan)

**Referral Program**: Check website for current program

**See Also**: `supabase-pricing-guide.md` for detailed information

## Go-Specific Hosting

### Platforms Supporting Go
- **Railway**: Excellent Go support, $5/month
- **Render**: Good Go support, free tier available
- **Fly.io**: Great for Go apps, free tier available
- **Google Cloud Run**: Serverless Go, generous free tier
- **AWS Lambda**: Go runtime, free tier available
- **Heroku**: Go support, $7/month (discontinued free tier)

### Go Hosting Recommendations
- **MVP**: Render Free Tier or Railway Hobby
- **Production**: Railway Pro or Render Starter
- **Serverless**: Google Cloud Run or AWS Lambda
- **Global**: Fly.io for edge deployment

**Estimated Costs**:
- Free tier: $0/month
- Small app: $5-20/month
- Medium app: $20-50/month
- Large app: $50-200/month

## Additional Platforms

### Manus Platform
**Status**: Check current pricing (2025)

**Typical Features**:
- AI-powered development platform
- Similar to Lovable/BoltV2
- Hosting included
- Pricing: Check website for current plans

**Best For**: AI-assisted development, rapid prototyping

**Note**: Verify current pricing and features on official website

### VibeCode Platform
**Status**: Check current pricing (2025)

**Typical Features**:
- Development platform
- Hosting included
- Pricing: Check website for current plans

**Best For**: Development workflows, team collaboration

**Note**: Verify current pricing and features on official website

### Lovable/BoltV2
**Status**: Check current pricing (2025)

**Typical Features**:
- AI-powered development
- Hosting included
- Rapid prototyping
- Pricing: Check website for current plans

**Best For**: AI-assisted development, rapid prototyping

**Note**: Verify current pricing and features on official website

## Updated Comparison Summary

| Platform | Free Tier | Entry Paid | Best For | Complexity | Referral |
|----------|-----------|------------|----------|------------|----------|
| Railway | Trial | $5/month | Full-stack, simplicity | Low | Yes |
| Render | Yes | $7/month | Full-stack, databases | Low | Yes |
| Vercel | Yes | $20/month | Frontend, Next.js | Low | Partner |
| Netlify | Yes | $19/month | Static, JAMstack | Low | Yes |
| Fly.io | Yes | Pay-as-go | Global, Docker | Medium | Check |
| Supabase | Yes | $25/month | Backend, PostgreSQL | Low | Check |
| Go Platforms | Varies | $5-20/month | Go applications | Low-Medium | Varies |

## Referral Programs Summary

### Available Referral Programs
- **Railway**: $5 credits (referrer and referee)
- **Render**: $25 credits (referrer and referee)
- **DigitalOcean**: $200 credits (referee), $25 (referrer)
- **AWS**: $25-100 credits (varies)
- **GCP**: $300 credits (new accounts)
- **Supabase**: Check website for current program

**See Also**: `referral-programs-guide.md` for comprehensive referral information

## Database Platform Integration

### Supabase Integration
- **With Railway**: Use Supabase for database, Railway for hosting
- **With Render**: Use Supabase for database, Render for hosting
- **With Vercel**: Use Supabase for backend, Vercel for frontend
- **Cost**: $0-25/month (Supabase) + hosting costs

### Combined Costs Examples
- **Railway + Supabase Free**: $5/month (Railway only)
- **Render Free + Supabase Pro**: $25/month (Supabase only)
- **Vercel Free + Supabase Pro**: $25/month (Supabase only)
- **Railway Pro + Supabase Pro**: $45/month ($20 + $25)



---

# Additional Platforms Guide


# Additional Platforms Guide (2025)

## Overview

Comprehensive guide to additional cloud platforms, tools, and services useful for solo developers.

## Oracle Cloud Infrastructure (OCI)

### Free Tier
- **Duration**: Always free
- **Compute**: 2 AMD-based VMs (1/8 OCPU, 1 GB RAM each)
- **Autonomous Databases**: 2 databases (20 GB each)
- **Block Storage**: 10 GB
- **Load Balancer**: 10 Mbps bandwidth
- **Object Storage**: 10 GB
- **Outbound Data**: 10 TB/month

### Paid Pricing
- **Compute**: ~$0.01/hour for standard instances
- **Database**: ~$0.10/hour for autonomous databases
- **Storage**: ~$0.0255/GB/month

### Key Advantages
- ✅ Very generous free tier
- ✅ Good for databases
- ✅ Competitive pricing
- ❌ Smaller ecosystem
- ❌ Less documentation

**Best For**: Database-intensive apps, cost-conscious developers

## IBM Cloud

### Free Tier
- **Services**: 40+ free services
- **AI Services**: Free tier available
- **Kubernetes**: Free cluster available
- **Blockchain**: Free tier available

### Paid Pricing
- **Compute**: Varies by service
- **Storage**: Competitive pricing
- **AI Services**: Pay-as-you-go

### Key Advantages
- ✅ Many free services
- ✅ Good for AI/ML
- ✅ Enterprise features
- ❌ Complex pricing
- ❌ Smaller community

**Best For**: AI/ML projects, enterprise features

## Cloudflare

### Cloudflare Pages (Free Tier)
- **Unlimited**: Sites and builds
- **Unlimited**: Bandwidth
- **Unlimited**: Requests
- **Build Time**: 500 builds/month
- **Best For**: Static sites, JAMstack

### Cloudflare Workers (Free Tier)
- **100,000 Requests**: Per day
- **CPU Time**: 10ms per request
- **Best For**: Edge computing, APIs

### Cloudflare DNS (Free Tier)
- **Unlimited**: DNS records
- **Unlimited**: Queries
- **Best For**: DNS management

### Paid Plans
- **Pages Pro**: $20/month
- **Workers Paid**: $5/month (10M requests)
- **DNS Pro**: $20/month

**Best For**: CDN, DNS, edge computing, static sites

## GitHub

### GitHub Pages (Free Tier)
- **Unlimited**: Public repositories
- **Unlimited**: Bandwidth
- **Custom Domain**: Supported
- **SSL**: Included
- **Best For**: Static sites, documentation

### GitHub Actions (Free Tier)
- **Public Repos**: Unlimited minutes
- **Private Repos**: 2,000 minutes/month
- **Storage**: 500 MB
- **Best For**: CI/CD, automation

### GitHub Packages (Free Tier)
- **Public Repos**: Unlimited
- **Private Repos**: 500 MB
- **Best For**: Package hosting

**Best For**: Version control, CI/CD, static hosting

## GitLab

### GitLab Free Tier
- **CI/CD**: 400 minutes/month
- **Storage**: 5 GB
- **Bandwidth**: 10 GB/month
- **Best For**: CI/CD, version control

### GitLab Paid Plans
- **Premium**: $29/user/month
- **Ultimate**: $99/user/month

**Best For**: Self-hosted option, comprehensive DevOps

## Backblaze B2

### Free Tier
- **10 GB**: Free storage
- **No Egress Fees**: First 1 GB/day free
- **Best For**: Backups, storage

### Paid Pricing
- **Storage**: $0.005/GB/month
- **Download**: $0.01/GB (after free tier)
- **Best For**: Cheap cloud storage

**Best For**: Backups, file storage, cost-effective storage

## CockroachDB

### Free Tier
- **1 Cluster**: Free
- **50M Request Units**: Per month
- **5 GB Storage**: Free
- **Best For**: Distributed databases

### Paid Plans
- **Serverless**: Pay-as-you-go
- **Dedicated**: $25/month+

**Best For**: Distributed SQL, global apps

## Fauna

### Free Tier
- **100K Reads**: Per day
- **50K Writes**: Per day
- **5 GB Storage**: Free
- **Best For**: Serverless databases

### Paid Plans
- **Pro**: $25/month
- **Team**: $150/month

**Best For**: Serverless databases, GraphQL

## Stripe

### Payment Processing
- **Setup**: Free
- **Transaction Fee**: 2.9% + $0.30 per transaction
- **International**: 3.9% + $0.30
- **No Monthly Fee**: Pay only for transactions

### Additional Services
- **Stripe Connect**: 0.25% + standard fees
- **Stripe Terminal**: Hardware + fees
- **Stripe Billing**: 0.5% on recurring revenue

**Best For**: Payment processing, subscriptions

## PayPal

### Payment Processing
- **Setup**: Free
- **Domestic**: 2.9% + $0.30
- **International**: 4.4% + fixed fee
- **No Monthly Fee**: Pay only for transactions

**Best For**: Payment processing, international

## Domain Registrars

### Namecheap
- **.com**: ~$10-15/year
- **Free Privacy**: Included
- **Free DNS**: Included
- **Best For**: Domain registration

### Cloudflare Registrar
- **.com**: At-cost pricing (~$8-10/year)
- **Free Privacy**: Included
- **No Markup**: Cost price
- **Best For**: Cost-effective domains

### Google Domains
- **.com**: ~$12/year
- **Free Privacy**: Included
- **Best For**: Google ecosystem

## SSL Certificates

### Let's Encrypt (Free)
- **Free**: Forever
- **Auto-Renewal**: Supported
- **Wildcard**: Supported
- **Best For**: All use cases

### Cloudflare SSL (Free)
- **Free**: With Cloudflare
- **Auto-Renewal**: Automatic
- **Best For**: Cloudflare users

## Analytics Platforms

### Google Analytics (Free)
- **Free**: Forever
- **Unlimited**: Properties
- **Best For**: Web analytics

### Plausible Analytics
- **Free Trial**: 30 days
- **Paid**: $9/month (10K pageviews)
- **Privacy-Focused**: GDPR compliant
- **Best For**: Privacy-focused analytics

### PostHog (Free Tier)
- **1M Events**: Per month free
- **Feature Flags**: Included
- **Session Replay**: Included
- **Best For**: Product analytics

## Monitoring Services

### UptimeRobot (Free Tier)
- **50 Monitors**: Free
- **5-Minute Checks**: Free
- **Best For**: Uptime monitoring

### Better Uptime
- **Free Tier**: 10 monitors
- **Paid**: $10/month (50 monitors)
- **Best For**: Status pages, monitoring

### Sentry (Free Tier)
- **5K Errors**: Per month
- **10K Performance Units**: Per month
- **Best For**: Error tracking

## Email Services

### Resend (Free Tier)
- **3,000 Emails**: Per month
- **100 Emails**: Per day limit
- **Best For**: Transactional emails

### SendGrid (Free Tier)
- **100 Emails**: Per day
- **Best For**: Marketing emails

### Mailgun (Free Tier)
- **5,000 Emails**: Per month (first 3 months)
- **Then**: Paid plans
- **Best For**: Developer-friendly

### AWS SES
- **Free Tier**: 62,000 emails/month (from EC2)
- **Paid**: $0.10 per 1,000 emails
- **Best For**: High-volume emails

## Infrastructure as Code

### Terraform Cloud (Free Tier)
- **State Management**: 500 resources
- **Version Control**: Integration
- **Best For**: Infrastructure management

### Pulumi (Free Tier)
- **Unlimited**: Individual use
- **Team Features**: Paid
- **Best For**: Code-based infrastructure

## Comparison Summary

| Platform | Free Tier | Entry Paid | Best For |
|----------|-----------|------------|----------|
| Oracle Cloud | Very Generous | Pay-as-go | Databases |
| IBM Cloud | 40+ Services | Varies | AI/ML |
| Cloudflare | Unlimited | $5-20/month | CDN, DNS |
| GitHub | Unlimited Public | $0-4/month | Version Control |
| GitLab | 400 min/month | $29/month | CI/CD |
| Backblaze B2 | 10 GB | $0.005/GB | Storage |
| CockroachDB | 50M RU/month | $25/month | Distributed DB |
| Fauna | 100K reads/day | $25/month | Serverless DB |
| Stripe | Free setup | 2.9% + $0.30 | Payments |
| Namecheap | N/A | $10/year | Domains |
| Let's Encrypt | Free forever | N/A | SSL |
| Google Analytics | Free forever | N/A | Analytics |
| Sentry | 5K errors/month | $26/month | Monitoring |

## Solo Developer Recommendations

### Complete Free Stack
- **Hosting**: GitHub Pages (free)
- **Database**: Supabase Free or Fauna Free
- **CDN**: Cloudflare Free
- **DNS**: Cloudflare Free
- **SSL**: Let's Encrypt Free
- **Analytics**: Google Analytics Free
- **Monitoring**: UptimeRobot Free
- **Email**: Resend Free
- **Total**: $0/month

### Low-Cost Stack
- **Hosting**: Railway Hobby ($5/month)
- **Database**: Supabase Pro ($25/month)
- **CDN**: Cloudflare Free
- **Domain**: Namecheap ($10/year)
- **SSL**: Let's Encrypt Free
- **Analytics**: Plausible ($9/month)
- **Monitoring**: Sentry Free
- **Email**: Resend Free
- **Total**: ~$39/month

## Next Steps

1. **Explore Free Tiers**: Try multiple platforms
2. **Compare Features**: Find best fit
3. **Combine Services**: Use multiple free tiers
4. **Monitor Costs**: Track spending
5. **Optimize**: Reduce costs where possible








---

# Azure Pricing Guide


# Azure Pricing Guide (2025)

## Overview

Comprehensive pricing guide for Microsoft Azure, including free tier, paid plans, and cost optimization strategies.

## Azure Free Account

### New Account Benefits
- **$200 Credit**: Valid for first 30 days
- **12 Months Free**: Popular services free for 12 months
- **Always Free**: 55+ services free forever
- **No Credit Card**: Required for some services

### 12 Months Free Services

#### Virtual Machines
- **B1s**: 750 hours/month
  - 1 vCPU, 1 GB RAM
  - Burstable performance
  - Best for: Development, testing

- **B2pts v2 (Arm-based)**: 750 hours/month
  - 2 vCPU, 4 GB RAM
  - ARM architecture
  - Best for: ARM workloads

- **B2ats v2 (AMD-based)**: 750 hours/month
  - 2 vCPU, 4 GB RAM
  - AMD architecture
  - Best for: General workloads

#### Azure SQL Database
- **Serverless Tier**: 100,000 vCore seconds/month
- **Storage**: 32 GB included
- **Best For**: Small databases, development

#### Azure Blob Storage
- **5 GB**: Locally redundant storage (LRS)
- **20,000 Read Operations**: Per month
- **10,000 Write Operations**: Per month
- **Duration**: 12 months

### Always Free Services

#### Azure App Service
- **10 Apps**: Web, mobile, or API apps
- **1 GB Storage**: Per app
- **1 Hour Compute**: Per day per app
- **No Custom Domain**: In free tier
- **Best For**: Development, testing, demos

#### Azure Functions
- **1 Million Requests**: Per month
- **400,000 GB-seconds**: Resource consumption
- **Best For**: Serverless APIs, event-driven apps

#### Azure Cosmos DB
- **400 RU/s**: Provisioned throughput
- **5 GB Storage**: Included
- **Best For**: NoSQL databases, global apps

#### Azure DevOps
- **5 Users**: Free forever
- **Unlimited Private Repos**: Git repositories
- **CI/CD Pipelines**: Build and release automation
- **Best For**: Development teams, CI/CD

#### Azure Event Grid
- **100,000 Operations**: Per month
- **Best For**: Event-driven architectures

#### Azure Active Directory
- **Basic Features**: Free forever
- **Up to 50,000 Objects**: Free
- **Best For**: Identity management

## Paid Services Pricing

### Azure App Service (Paid)
- **Basic Tier**: $13/month
  - 1.75 GB RAM, 1 CPU
  - Custom domains
  - SSL support

- **Standard Tier**: $50/month
  - 3.5 GB RAM, 2 CPU
  - Auto-scaling
  - Staging slots

- **Premium Tier**: $146/month
  - 7 GB RAM, 4 CPU
  - Advanced features
  - Better performance

### Azure Functions (Paid)
- **Consumption Plan**: Pay-per-execution
  - $0.000016 per GB-second
  - $0.20 per million requests
  - Best for: Sporadic workloads

- **Premium Plan**: $0.173 per vCore-second
  - Always-on instances
  - Better performance
  - Best for: Consistent workloads

### Azure SQL Database (Paid)
- **Basic Tier**: $5/month
  - 2 GB storage, 5 DTU
  - Best for: Small apps

- **Standard Tier**: $15/month
  - 250 GB storage, 10 DTU
  - Best for: Production apps

- **Premium Tier**: $465/month
  - 1 TB storage, 125 DTU
  - Best for: High-performance apps

### Azure Blob Storage (Paid)
- **Hot Tier**: $0.0184/GB/month
  - Frequently accessed data
  - Best for: Active data

- **Cool Tier**: $0.01/GB/month
  - Infrequently accessed data
  - Best for: Archives

- **Archive Tier**: $0.00099/GB/month
  - Rarely accessed data
  - Best for: Long-term storage

## Cost Scenarios

### Scenario 1: MVP Development
- **Services**: App Service Free, Functions Free, Cosmos DB Free
- **Cost**: $0/month
- **Best For**: Learning, testing, MVP

### Scenario 2: Solo Developer Launch
- **Services**: App Service Basic ($13), Functions Consumption, SQL Database Basic ($5)
- **Cost**: ~$18-25/month
- **Best For**: Launching to production

### Scenario 3: Growing App
- **Services**: App Service Standard ($50), Functions Premium, SQL Database Standard ($15)
- **Cost**: ~$65-100/month
- **Best For**: Growing user base

### Scenario 4: High-Traffic App
- **Services**: App Service Premium ($146), Functions Premium, SQL Database Premium ($465)
- **Cost**: ~$600-1000/month
- **Best For**: High-traffic applications

## Cost Optimization Strategies

### 1. Maximize Free Tier
- Use free tier for development
- Stay within free tier limits
- Use multiple free services
- Plan upgrades carefully

### 2. Use Reserved Instances
- **Savings**: Up to 72% discount
- **Commitment**: 1-3 years
- **Best For**: Predictable workloads
- **Example**: Reserved VM instances

### 3. Right-Size Resources
- Match resources to actual needs
- Monitor usage regularly
- Downsize when possible
- Use auto-scaling

### 4. Optimize Storage
- Use appropriate storage tiers
- Archive old data
- Delete unused data
- Compress data

### 5. Use Spot Instances
- **Savings**: Up to 90% discount
- **Best For**: Fault-tolerant workloads
- **Limitation**: Can be interrupted
- **Example**: Spot VMs for batch processing

### 6. Monitor Costs
- Set up cost alerts
- Use Cost Management tools
- Review costs regularly
- Tag resources for tracking

## Azure vs. Competitors

### Azure vs. AWS
- **Free Tier**: Azure $200 vs. AWS 12 months
- **Pricing**: Similar, Azure slightly cheaper for some services
- **Ecosystem**: AWS larger, Azure better for Microsoft stack
- **Best For**: Azure for Microsoft ecosystem, AWS for broader ecosystem

### Azure vs. GCP
- **Free Tier**: Azure $200 vs. GCP $300
- **Pricing**: GCP often cheaper
- **Ecosystem**: GCP better for ML/AI, Azure better for enterprise
- **Best For**: Azure for enterprise, GCP for ML/AI

## Referral Program

### Azure Referral
- **Status**: Check Azure website for current program
- **Typical Benefits**: Credits for referrer and referee
- **How to Use**: Share referral link, get credits
- **Best Practice**: Use referrals to reduce costs

## Best Practices

1. **Start with Free Tier**: Use free tier for development
2. **Monitor Usage**: Track usage from day one
3. **Set Budget Alerts**: Get notified of spending
4. **Use Reserved Instances**: For predictable workloads
5. **Right-Size Resources**: Match resources to needs
6. **Optimize Storage**: Use appropriate tiers
7. **Review Costs Monthly**: Regular cost reviews

## Next Steps

1. **Sign Up**: Create Azure free account
2. **Explore Free Tier**: Try free services
3. **Monitor Usage**: Track usage carefully
4. **Plan Upgrades**: Know when to upgrade
5. **Optimize Costs**: Implement optimization strategies








---

# Hostinger Pricing Guide


# Hostinger 2026 FinOps & Technical Guide

**Last Updated**: 2026-04-22
**Focus**: Deep Technical Analysis & Agentic Infrastructure Management

---

## 1. 2026 Pricing Structure (Intro vs. Renewal)
Hostinger's model relies on 48-month commitment for intro rates. Be aware of the "Renewal Cliff."

| Plan Type | Entry Tier | Intro Price* | Renewal Price | RAM | Storage | Bandwidth Cap |
|-----------|------------|--------------|---------------|-----|---------|---------------|
| **Managed**| Business | $3.99/mo | ~$8.99/mo | 1.5GB | 200GB NVMe| FUP (Unlimited) |
| **Cloud** | Startup | $7.99/mo | ~$19.99/mo | 4GB | 200GB NVMe| 20TB (Soft) |
| **VPS** | KVM 1 | $4.99/mo | ~$11.99/mo | 4GB | 50GB NVMe | 4TB |
| **VPS** | KVM 2 | $8.99/mo | ~$19.99/mo | 8GB | 100GB NVMe| 8TB |

*\* Introductory prices based on 48-month terms.*

---

## 2. Technical Architecture & Constraints

### Managed Node.js (hPanel)
- **Process Management**: Uses a proprietary internal manager. **PM2 is NOT supported** in hPanel; it is reserved for VPS.
- **Environment Variables**: Managed via hPanel UI. **Redeployment is required** for changes to take effect.
- **Port Binding**: Application must listen on `process.env.PORT`. Custom ports are blocked by the internal reverse proxy.
- **Concurrency**: Capped by "Entry Processes" (20 on Premium, 30 on Business). Exceeding this triggers **508 Resource Limit Reached** errors.

### Network & Egress
- **Throttling Policy**: Once a VPS hits its TB bandwidth cap, the port speed is throttled to **10 Mbps**. There are **no overage fees**.
- **Streaming Restriction**: Commercial streaming is prohibited on shared/cloud plans.
- **Inode Limits**: Standard cap is **600,000 inodes**. High-volume AI training data or massive media libraries will hit this before disk space is exhausted.

---

## 3. Agentic & AI Capabilities (2026)

### Public API
- **Endpoint**: `https://api.hostinger.com/v1`
- **Capabilities**: Programmatic VPS management (Start/Stop/Reboot), resource scaling, snapshots, and DNS management.
- **Auth**: Bearer tokens generated via **Account Settings > API**.

### AI Tooling
- **Kodee AI Assistant**: Integrated dashboard agent for server-side tasks.
- **Hostinger Horizons**: A "Vibe Coding" platform for generating full-stack apps from natural language.
- **MCP Server**: Official support for Model Context Protocol via `@hostinger/api-mcp-server`. This enables external AI agents (Claude Code, Cursor) to:
    - `vps_restart`: Restart instances
    - `dns_add_record`: Update records for SSL/verification
    - `metrics_get`: Audit resource usage

---

## 4. Hardware for AI Workloads
- **CPU**: AMD EPYC (Standard across KVM VPS).
- **GPU**: **None available**.
- **AI Serving (Ollama)**: Recommended for small models (Llama 3 8B) for bot orchestration. **Avoid** for high-throughput inference or training.

---

## 5. FinOps Strategy for SVC Projects
- **The "Agentic SRE" Pattern**: Install the Hostinger MCP server in your local host (`claude config add-mcp hostinger`) to allow the framework to autonomously manage infrastructure.
- **Cost Avoidance**: Set an automated task to monitor "Renewal Dates." Migrate to Hetzner Cloud 3 months before Hostinger's 48-month intro price expires to avoid the 100%+ price hike.
- **Scaling Guardrails**: Monitor **Entry Processes** and **Inode counts** programmatically via the API to prevent 508 errors before they occur.


---

# Supabase Pricing Guide


# Supabase Pricing Guide (2025)

## Overview

Comprehensive pricing guide for Supabase, the open-source Firebase alternative with PostgreSQL backend.

## Supabase Plans

### Free Plan
**Cost**: $0/month

**Included**:
- **Projects**: 2 active projects
- **Database Storage**: 500 MB
- **File Storage**: 1 GB
- **Bandwidth**: 5 GB/month
- **Monthly Active Users (MAUs)**: 50,000
- **Database Egress**: 50 MB/day
- **Edge Functions**: 1,000 invocations/day
- **Realtime**: Unlimited connections
- **API Requests**: Unlimited
- **Auth Users**: 50,000
- **Support**: Community support

**Best For**: 
- MVP development
- Small projects
- Testing and learning
- Personal projects

**Limitations**:
- Projects pause after 1 week of inactivity
- Limited storage and bandwidth
- No email support

### Pro Plan
**Cost**: $25/month per project

**Included**:
- **Projects**: Unlimited
- **Database Storage**: 8 GB (included)
- **File Storage**: 100 GB
- **Bandwidth**: 250 GB/month
- **Monthly Active Users (MAUs)**: 100,000
- **Database Egress**: 5 GB/day
- **Edge Functions**: 2M invocations/month
- **Realtime**: Unlimited connections
- **API Requests**: Unlimited
- **Auth Users**: 100,000
- **Compute Credits**: $10 included
- **Support**: Email support
- **Spend Cap**: Available

**Overage Pricing**:
- **Database Storage**: $0.125/GB/month
- **File Storage**: $0.021/GB/month
- **Bandwidth**: $0.09/GB
- **MAUs**: $0.00325 per user over 100K
- **Edge Functions**: $2 per 1M invocations
- **Compute**: Pay-as-you-go (micro: ~$10/month)

**Best For**:
- Production applications
- Growing startups
- Apps with moderate traffic
- Solo developers launching

### Team Plan
**Cost**: $599/month per organization

**Included**:
- Everything in Pro Plan
- **Database Storage**: 100 GB (included)
- **File Storage**: 1 TB
- **Bandwidth**: 1 TB/month
- **Monthly Active Users (MAUs)**: 500,000
- **Point-in-Time Recovery (PITR)**: Included
- **Daily Backups**: 7-day retention
- **SSO**: Included
- **SOC 2 Compliance**: Included
- **Support**: Priority support
- **SLA**: 99.95% uptime

**Best For**:
- Teams and companies
- High-traffic applications
- Enterprise features needed
- Compliance requirements

### Enterprise Plan
**Cost**: Custom pricing

**Included**:
- Everything in Team Plan
- **Custom Limits**: Tailored to needs
- **Dedicated Support**: 24/7
- **SLA**: 99.99% uptime
- **HIPAA Compliance**: Available
- **VPC Deployment**: Available
- **Custom Contracts**: Available

**Best For**:
- Large enterprises
- High-scale applications
- Compliance-critical apps
- Custom requirements

## Compute Pricing

### Compute Sizes
- **Micro**: ~$10/month
  - 0.5 GB RAM
  - Shared CPU
  - Best for: Development, low traffic

- **Small**: ~$20/month
  - 1 GB RAM
  - Shared CPU
  - Best for: Small production apps

- **Medium**: ~$40/month
  - 2 GB RAM
  - Shared CPU
  - Best for: Medium production apps

- **Large**: ~$80/month
  - 4 GB RAM
  - Dedicated CPU
  - Best for: High-traffic apps

- **XL**: ~$160/month
  - 8 GB RAM
  - Dedicated CPU
  - Best for: Very high-traffic apps

**Note**: Pro Plan includes $10 in compute credits, which covers Micro size.

## Cost Scenarios

### Scenario 1: MVP Development
- **Plan**: Free Plan
- **Usage**: 1 project, <500 MB database, <1 GB files
- **Cost**: $0/month
- **Best For**: Learning, testing, MVP

### Scenario 2: Solo Developer Launch
- **Plan**: Pro Plan
- **Usage**: 1 project, 2 GB database, 10 GB files, 10K MAUs
- **Compute**: Micro ($10/month, covered by credits)
- **Cost**: $25/month
- **Best For**: Launching to production

### Scenario 3: Growing App
- **Plan**: Pro Plan
- **Usage**: 1 project, 5 GB database, 50 GB files, 50K MAUs
- **Compute**: Small ($20/month, $10 credit = $10)
- **Cost**: $35/month ($25 + $10)
- **Best For**: Growing user base

### Scenario 4: High-Traffic App
- **Plan**: Pro Plan
- **Usage**: 1 project, 10 GB database, 150 GB files, 150K MAUs
- **Compute**: Medium ($40/month, $10 credit = $30)
- **Overage**: 50K MAUs × $0.00325 = $162.50
- **File Storage**: 50 GB × $0.021 = $1.05
- **Cost**: $218.55/month
- **Best For**: Scaling apps (consider Team plan)

## Cost Optimization Strategies

### 1. Use Spend Cap
- **Enable Spend Cap**: Prevents unexpected charges
- **Set Limits**: Configure in billing settings
- **Protection**: Services pause when limit reached
- **Best Practice**: Enable for Pro Plan

### 2. Optimize Database
- **Archive Old Data**: Move old data to cheaper storage
- **Delete Unused Data**: Remove unnecessary records
- **Optimize Queries**: Use indexes, efficient queries
- **Vacuum Regularly**: Reclaim space

### 3. Optimize Storage
- **Compress Images**: Use image transformations
- **Delete Unused Files**: Clean up old files
- **Use CDN**: Serve files from CDN
- **Monitor Usage**: Track storage growth

### 4. Optimize Bandwidth
- **Cache Responses**: Reduce API calls
- **Compress Data**: Use compression
- **Selective Queries**: Only fetch needed data
- **Monitor Usage**: Track bandwidth consumption

### 5. Right-Size Compute
- **Start Small**: Begin with Micro
- **Monitor Usage**: Track CPU/memory
- **Scale Up**: Only when needed
- **Use Credits**: Maximize $10 credit

### 6. Monitor Usage
- **Set Up Alerts**: Get notified of usage
- **Review Regularly**: Check usage dashboard
- **Track Trends**: Identify growth patterns
- **Plan Upgrades**: Know when to upgrade

## Free Tier Maximization

### Tips
- **Use 2 Projects**: Maximize free tier projects
- **Stay Within Limits**: Monitor usage carefully
- **Optimize Early**: Start optimization from day one
- **Plan Upgrades**: Know when to move to Pro

### Limitations to Watch
- **Database Size**: 500 MB limit
- **File Storage**: 1 GB limit
- **Bandwidth**: 5 GB/month
- **MAUs**: 50,000 limit
- **Project Pause**: After 1 week inactivity

## Migration Strategy

### From Free to Pro
1. **Monitor Usage**: Track when approaching limits
2. **Calculate Costs**: Estimate Pro Plan costs
3. **Enable Spend Cap**: Protect against overages
4. **Upgrade**: Move to Pro when needed

### From Pro to Team
1. **Evaluate Needs**: Check if Team features needed
2. **Calculate ROI**: Compare costs vs. benefits
3. **Consider Alternatives**: VPS + Supabase self-hosted
4. **Negotiate**: Contact sales for custom pricing

## Comparison with Alternatives

### Supabase vs. Firebase
- **Database**: PostgreSQL vs. NoSQL
- **Pricing**: More predictable vs. usage-based
- **Open Source**: Yes vs. No
- **Self-Host**: Possible vs. Not possible

### Supabase vs. PlanetScale
- **Database**: PostgreSQL vs. MySQL
- **Pricing**: $25/month vs. $29/month
- **Features**: More features vs. Serverless focus
- **Best For**: Full backend vs. Database only

### Supabase vs. Self-Hosted
- **Cost**: $25/month vs. $5-10/month (VPS)
- **Maintenance**: Managed vs. Self-managed
- **Features**: All features vs. Manual setup
- **Best For**: Production vs. Advanced users

## Referral Program

### Supabase Referral
- **Status**: Check Supabase website for current program
- **Typical Benefits**: Credits for referrer and referee
- **How to Use**: Share referral link, get credits
- **Best Practice**: Use referrals to reduce costs

## Best Practices

1. **Start with Free**: Use free tier for development
2. **Monitor Usage**: Track usage from day one
3. **Enable Spend Cap**: Protect against overages
4. **Optimize Early**: Start optimization immediately
5. **Right-Size Compute**: Match compute to needs
6. **Use Credits**: Maximize included credits
7. **Plan Upgrades**: Know when to upgrade

## Next Steps

1. **Assess Needs**: Determine your requirements
2. **Start Free**: Use free tier for development
3. **Monitor Usage**: Track usage carefully
4. **Optimize**: Implement optimization strategies
5. **Upgrade When Needed**: Move to Pro when limits reached






