# Comprehensive Free Tiers and Pricing Guide

## Overview

This guide provides comprehensive information about free tiers, pricing, and cost-effective options across all major cloud providers, SaaS platforms, development tools, and services. Updated for 2025 with current pricing and free tier limits.

## Cloud Providers - Free Tiers

### AWS (Amazon Web Services)

**Free Tier Duration**: 12 months (new accounts) + Always Free

**12-Month Free Tier**:
- **EC2**: 750 hours/month t2.micro or t3.micro (Linux/Windows)
- **S3**: 5 GB standard storage, 20,000 GET requests, 2,000 PUT requests
- **Lambda**: 1M free requests/month, 400,000 GB-seconds compute
- **RDS**: 750 hours/month db.t2.micro, 20 GB storage, 20 GB backup
- **CloudFront**: 50 GB data transfer out, 2M HTTP/HTTPS requests
- **API Gateway**: 1M API calls/month
- **DynamoDB**: 25 GB storage, 25 read units, 25 write units
- **SNS**: 1M publishes, 100K mobile push notifications
- **SES**: 62,000 emails/month (from EC2)
- **Elastic Beanstalk**: Free (pay for underlying resources)

**Always Free Tier**:
- **Lambda**: 1M requests/month, 400K GB-seconds
- **DynamoDB**: 25 GB storage, 25 read/write units
- **S3**: 5 GB standard storage (after 12 months)
- **CloudWatch**: 10 custom metrics, 5 GB log ingestion
- **CodeCommit**: 5 active users, 50 GB storage, 10,000 requests/month
- **CodeBuild**: 100 build minutes/month
- **CodePipeline**: 1 active pipeline/month

**Regular Pricing** (Post-Free Tier):
- **EC2**: $0.0084/hour (t3.micro) - $0.10/hour (t3.medium)
- **S3**: $0.023/GB/month (standard), $0.004/GB/month (Glacier)
- **Lambda**: $0.20 per 1M requests, $0.0000166667/GB-second
- **RDS**: $0.017/hour (db.t3.micro) - $0.272/hour (db.t3.medium)
- **DynamoDB**: $0.25/GB/month storage, $0.00025/read unit, $0.00125/write unit

**Cost Calculator**: https://calculator.aws/

### Google Cloud Platform (GCP)

**Free Tier Duration**: 90 days ($300 credit) + Always Free

**$300 Free Credit** (90 days):
- $300 credit to use on any GCP service
- No restrictions on services
- Expires after 90 days

**Always Free Tier**:
- **Compute Engine**: 1 f1-micro instance/month (US regions)
- **Cloud Storage**: 5 GB standard storage, 5 GB class A operations, 1 GB class B operations
- **Cloud Functions**: 2M invocations/month, 400K GB-seconds, 200K GHz-seconds
- **Cloud Run**: 2M requests/month, 360K GB-seconds, 360K vCPU-seconds
- **Firebase**: 1 GB storage, 10 GB/month transfer, 50K reads/day, 20K writes/day
- **Cloud SQL**: No free tier (pay-as-you-go)
- **Cloud Datastore**: 1 GB storage, 50K reads/day, 20K writes/day
- **BigQuery**: 10 GB storage, 1 TB queries/month
- **Cloud Pub/Sub**: 10 GB/month messages
- **Cloud Build**: 120 build-minutes/day
- **Cloud Source Repositories**: 5 users, 50 GB storage

**Regular Pricing** (Post-Free Tier):
- **Compute Engine**: $0.0100/hour (f1-micro) - $0.0338/hour (n1-standard-1)
- **Cloud Storage**: $0.020/GB/month (standard), $0.004/GB/month (nearline)
- **Cloud Functions**: $0.40 per 1M invocations, $0.0000025/GB-second
- **Cloud Run**: $0.40 per 1M requests, $0.0000025/GB-second, $0.0000025/vCPU-second
- **Firebase**: $0.026/GB storage, $0.12/GB transfer

**Cost Calculator**: https://cloud.google.com/products/calculator

### Microsoft Azure

**Free Tier Duration**: 12 months + Always Free + $200 credit

**$200 Free Credit** (30 days):
- $200 credit for 30 days
- Can use on any Azure service
- Expires after 30 days

**12-Month Free Tier**:
- **Virtual Machines**: 750 hours/month B1S (Linux/Windows)
- **App Service**: 10 web, mobile, or API apps (F1 tier)
- **Functions**: 1M requests/month, 400K GB-seconds
- **Cosmos DB**: 400 RU/s, 5 GB storage
- **SQL Database**: 250 GB S0 database
- **Storage**: 5 GB LRS blob storage, 5 GB file storage
- **Bandwidth**: 5 GB outbound data transfer

**Always Free Tier**:
- **Functions**: 1M requests/month, 400K GB-seconds
- **Cosmos DB**: 400 RU/s, 5 GB storage
- **App Service**: 10 apps (F1 tier)
- **DevTest Labs**: Free (pay for resources)
- **Active Directory**: 50K objects
- **Service Bus**: 750 hours, 13M operations
- **Notification Hubs**: 1M pushes

**Regular Pricing** (Post-Free Tier):
- **Virtual Machines**: $0.0052/hour (B1S) - $0.096/hour (D2s_v3)
- **App Service**: $0.013/hour (F1) - $0.20/hour (S1)
- **Functions**: $0.20 per 1M requests, $0.000016/GB-second
- **Cosmos DB**: $0.008/hour (400 RU/s), $0.25/GB/month storage
- **SQL Database**: $0.015/hour (S0) - $0.465/hour (S3)

**Cost Calculator**: https://azure.microsoft.com/pricing/calculator/

### Oracle Cloud Infrastructure (OCI)

**Free Tier Duration**: Always Free (no expiration)

**Always Free Tier**:
- **Compute**: 2 AMD-based VMs (1/8 OCPU, 1 GB RAM each)
- **Block Storage**: 200 GB total
- **Object Storage**: 10 GB
- **Autonomous Database**: 2 databases (20 GB each)
- **Load Balancer**: 10 Mbps, 10 TB egress
- **Monitoring**: 500M ingestion datapoints, 1B retrieval datapoints
- **Notifications**: 1M notifications/month
- **Resource Manager**: Unlimited stacks
- **Vault**: Unlimited vaults, 10K secrets

**Regular Pricing** (Post-Free Tier):
- **Compute**: $0.0015/hour (VM.Standard.E2.1.Micro)
- **Block Storage**: $0.0255/GB/month
- **Object Storage**: $0.0255/GB/month
- **Autonomous Database**: $0.3441/hour (Always Free tier equivalent)

**Cost Calculator**: https://www.oracle.com/cloud/cost-estimator/

### DigitalOcean

**Free Tier Duration**: $200 credit (60 days)

**$200 Free Credit**:
- $200 credit for 60 days
- Can use on any DigitalOcean service
- Expires after 60 days

**Regular Pricing** (No Always Free Tier):
- **Droplets**: $4/month (512 MB RAM) - $12/month (2 GB RAM)
- **Managed Databases**: $15/month (1 GB RAM) - $60/month (4 GB RAM)
- **Spaces (Object Storage)**: $5/month (250 GB) + $0.02/GB overage
- **Load Balancers**: $12/month
- **Kubernetes**: $12/month per node

**Cost Calculator**: https://www.digitalocean.com/pricing/

### Hetzner Cloud

**Free Tier Duration**: €20 credit (30 days)

**€20 Free Credit**:
- €20 credit for 30 days
- Can use on any Hetzner service
- Expires after 30 days

**Regular Pricing** (No Always Free Tier):
- **Cloud Servers**: €4.15/month (CX11: 1 vCPU, 2 GB RAM) - €8.90/month (CX21: 2 vCPU, 4 GB RAM)
- **Dedicated Servers**: €34.90/month (AX41: 4 CPU, 64 GB RAM)
- **Storage Boxes**: €2.96/month (1 TB)
- **Load Balancers**: €5.83/month

**Cost Calculator**: https://www.hetzner.com/cloud

## Hosting Platforms - Free Tiers

### Vercel

**Free Tier**:
- **Bandwidth**: 100 GB/month
- **Serverless Functions**: 100 GB-hours/month
- **Builds**: Unlimited
- **Deployments**: Unlimited
- **Domains**: Custom domains (unlimited)
- **Team Members**: Unlimited
- **Analytics**: Basic (limited)

**Pro Plan**: $20/month
- **Bandwidth**: 1 TB/month
- **Serverless Functions**: 1,000 GB-hours/month
- **Analytics**: Advanced
- **Password Protection**: Yes
- **Preview Deployments**: Unlimited

**Enterprise**: Custom pricing

### Netlify

**Free Tier**:
- **Bandwidth**: 100 GB/month
- **Build Minutes**: 300 minutes/month
- **Serverless Functions**: 125K invocations/month
- **Deployments**: Unlimited
- **Domains**: Custom domains (unlimited)
- **Team Members**: 1

**Pro Plan**: $19/month
- **Bandwidth**: 1 TB/month
- **Build Minutes**: 1,000 minutes/month
- **Serverless Functions**: 500K invocations/month
- **Team Members**: 5
- **Analytics**: Advanced

**Business**: $99/month

### Railway

**Free Tier**: $5 credit/month (expires monthly)

**$5 Monthly Credit**:
- $5 credit per month
- Expires at end of month
- Can use on any Railway service
- Usage-based pricing after credit

**Regular Pricing** (Pay-as-you-go):
- **Compute**: $0.000463/GB-RAM-hour
- **Bandwidth**: $0.01/GB
- **Database**: $0.20/GB-month storage

**Pro Plan**: $20/month
- Includes $20 credit/month
- Priority support
- Team features

### Render

**Free Tier**:
- **Static Sites**: Unlimited
- **Web Services**: 750 hours/month (sleeps after 15 min inactivity)
- **PostgreSQL**: 90 days free, then $7/month
- **Redis**: 25 MB free
- **Bandwidth**: 100 GB/month

**Starter Plan**: $7/month
- **Web Services**: Always-on (no sleep)
- **Bandwidth**: 100 GB/month
- **SSL**: Included

**Pro Plan**: $25/month
- **Bandwidth**: 400 GB/month
- **Auto-scaling**: Yes
- **Priority support**: Yes

### Fly.io

**Free Tier**: $5 credit/month (expires monthly)

**$5 Monthly Credit**:
- $5 credit per month
- Expires at end of month
- Can use on any Fly.io service

**Regular Pricing** (Pay-as-you-go):
- **Compute**: $0.00000194/GB-second
- **Bandwidth**: $0.02/GB
- **PostgreSQL**: $0.15/GB-month storage

**Speedrun Plan**: $1.94/month
- Includes $2 credit/month
- Basic features

## Database Services - Free Tiers

### Supabase

**Free Tier**:
- **Database**: 500 MB storage, 2 GB bandwidth
- **Auth**: 50K MAUs (Monthly Active Users)
- **Storage**: 1 GB storage, 2 GB bandwidth
- **Edge Functions**: 500K invocations/month, 2M GB-seconds
- **Realtime**: 200 concurrent connections, 2 GB/month messages
- **API**: Unlimited requests

**Pro Plan**: $25/month
- **Database**: 8 GB storage, 50 GB bandwidth
- **Auth**: 100K MAUs
- **Storage**: 100 GB storage, 200 GB bandwidth
- **Edge Functions**: 2M invocations/month, 5M GB-seconds

**Team Plan**: $599/month

### PlanetScale

**Free Tier**:
- **Database**: 1 database, 1 branch, 1 GB storage
- **Reads**: 1B row reads/month
- **Writes**: 10M row writes/month
- **Bandwidth**: 5 GB/month

**Scaler Plan**: $29/month
- **Database**: Unlimited databases, 5 branches, 10 GB storage
- **Reads**: 5B row reads/month
- **Writes**: 50M row writes/month

### Neon

**Free Tier**:
- **Database**: 0.5 GB storage, 1 project
- **Compute**: 0.5 vCPU, shared
- **Branches**: 1 branch
- **Backups**: 7 days retention

**Launch Plan**: $19/month
- **Database**: 10 GB storage, unlimited projects
- **Compute**: 1 vCPU, dedicated
- **Branches**: 10 branches
- **Backups**: 30 days retention

### MongoDB Atlas

**Free Tier** (M0):
- **Database**: 512 MB storage
- **RAM**: Shared
- **Bandwidth**: Unlimited
- **Backups**: None

**M2 Plan**: $9/month
- **Database**: 2 GB storage
- **RAM**: Shared
- **Backups**: Yes

**M5 Plan**: $25/month
- **Database**: 5 GB storage
- **RAM**: 2 GB dedicated

### CockroachDB

**Free Tier**:
- **Database**: 50M Request Units/month
- **Storage**: 5 GB
- **Regions**: 1 region

**Serverless Plan**: Pay-as-you-go
- **Database**: $0.50 per 1M Request Units
- **Storage**: $0.25/GB/month

### Fauna

**Free Tier**:
- **Database**: 100K reads/day, 50K writes/day
- **Storage**: 1 GB
- **Data Transfer**: 50 GB/month

**Pro Plan**: $25/month
- **Database**: 5M reads/day, 2.5M writes/day
- **Storage**: 10 GB
- **Data Transfer**: 500 GB/month

## Authentication Services - Free Tiers

### Clerk

**Free Tier**:
- **MAUs**: 10K Monthly Active Users
- **Organizations**: 1 organization
- **Sessions**: Unlimited
- **Social Logins**: Unlimited

**Pro Plan**: $25/month
- **MAUs**: 10K included, then $0.02/MAU
- **Organizations**: Unlimited
- **Support**: Priority

### Auth0

**Free Tier**:
- **MAUs**: 7K Monthly Active Users
- **Social Connections**: 2
- **Database Connections**: 1
- **Rules**: 2

**Essentials Plan**: $35/month
- **MAUs**: 7K included, then $0.05/MAU
- **Social Connections**: Unlimited
- **Database Connections**: Unlimited

### Supabase Auth

**Free Tier** (Included with Supabase):
- **MAUs**: 50K Monthly Active Users
- **Social Providers**: Unlimited
- **Email Auth**: Unlimited
- **MFA**: Yes

**Pro Plan**: $25/month (includes Supabase)
- **MAUs**: 100K included
- **Advanced Features**: Yes

### Firebase Auth

**Free Tier**:
- **Users**: Unlimited
- **Social Providers**: Unlimited
- **Phone Auth**: 10K verifications/month
- **Email/Password**: Unlimited

**Blaze Plan**: Pay-as-you-go
- **Phone Auth**: $0.06/verification after 10K
- **Other features**: Free

## Development Tools - Free Tiers

### GitHub

**Free Tier**:
- **Repositories**: Unlimited public, unlimited private
- **Collaborators**: Unlimited
- **Actions**: 2,000 minutes/month
- **Storage**: 500 MB packages
- **Issues/PRs**: Unlimited

**Team Plan**: $4/user/month
- **Actions**: 3,000 minutes/month
- **Advanced security**: Yes

**Enterprise**: $21/user/month

### GitLab

**Free Tier**:
- **Repositories**: Unlimited
- **CI/CD Minutes**: 400 minutes/month
- **Storage**: 5 GB
- **Users**: Unlimited

**Premium Plan**: $29/user/month
- **CI/CD Minutes**: 10,000 minutes/month
- **Advanced features**: Yes

### GitHub Codespaces

**Free Tier**:
- **Hours**: 60 hours/month (2-core machine)
- **Storage**: 15 GB

**Pro Plan**: $4/user/month
- **Hours**: 60 hours/month included
- **Additional**: $0.18/hour

### Replit

**Free Tier**:
- **Repls**: Unlimited public
- **Compute**: 0.5 GB RAM, 0.2 vCPU
- **Deployments**: 5 deployments
- **Storage**: 500 MB

**Core Plan**: $7/month
- **Repls**: Unlimited private
- **Compute**: 2 GB RAM, 1 vCPU
- **Deployments**: Unlimited

## AI/ML Services - Free Tiers

### OpenAI

**Free Tier**: None (pay-as-you-go)

**Regular Pricing**:
- **GPT-4o**: $2.50/1M input tokens, $10/1M output tokens
- **GPT-4o-mini**: $0.15/1M input tokens, $0.60/1M output tokens
- **GPT-3.5 Turbo**: $0.30/1M input tokens, $0.60/1M output tokens
- **o3**: $2.00/1M input tokens, $8.00/1M output tokens
- **o3-pro**: $20.00/1M input tokens, $80.00/1M output tokens

### Anthropic (Claude)

**Free Tier**: None (pay-as-you-go)

**Regular Pricing**:
- **Claude 4 Opus**: $15.00/1M input tokens, $75.00/1M output tokens
- **Claude 4 Sonnet**: $3.00/1M input tokens, $15.00/1M output tokens
- **Claude 4 Haiku**: $1.00/1M input tokens, $5.00/1M output tokens

### Google AI (Gemini)

**Free Tier**: None (pay-as-you-go)

**Regular Pricing**:
- **Gemini 2.5 Pro**: $1.25-2.50/1M input tokens, $5-10/1M output tokens
- **Gemini 2.5 Flash**: $0.075/1M input tokens, $0.30/1M output tokens
- **Gemini 1.5 Pro**: $0.0781/1M input tokens, $0.3125/1M output tokens

### DeepSeek

**Free Tier**: None (pay-as-you-go)

**Regular Pricing**:
- **DeepSeek-R1**: $0.55/1M input tokens, $2.20/1M output tokens
- **Discount**: Up to 75% off-peak (16:30 GMT - 00:30 GMT)

## Email Services - Free Tiers

### SendGrid

**Free Tier**:
- **Emails**: 100 emails/day
- **Contacts**: 2,000 contacts
- **API**: Full API access

**Essentials Plan**: $19.95/month
- **Emails**: 50K emails/month
- **Contacts**: Unlimited
- **Support**: Email support

### Mailgun

**Free Tier**:
- **Emails**: 5,000 emails/month (first 3 months)
- **API**: Full API access
- **Domain**: 1 domain

**Foundation Plan**: $35/month
- **Emails**: 50K emails/month
- **Domains**: 5 domains

### Resend

**Free Tier**:
- **Emails**: 3,000 emails/month
- **API**: Full API access
- **Domains**: 1 domain

**Pro Plan**: $20/month
- **Emails**: 50K emails/month
- **Domains**: 5 domains

### Postmark

**Free Tier**: None

**Regular Pricing**:
- **Starter**: $15/month (10K emails)
- **Plus**: $25/month (25K emails)

## Storage Services - Free Tiers

### Cloudflare R2

**Free Tier**:
- **Storage**: 10 GB
- **Egress**: Unlimited (no egress fees)
- **Operations**: 1M Class A, 10M Class B/month

**Regular Pricing**:
- **Storage**: $0.015/GB/month
- **Operations**: $4.50/1M Class A, $0.36/1M Class B

### Backblaze B2

**Free Tier**:
- **Storage**: 10 GB
- **Egress**: 1 GB/day free

**Regular Pricing**:
- **Storage**: $0.005/GB/month
- **Egress**: $0.01/GB

### Cloudinary

**Free Tier**:
- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25K/month

**Plus Plan**: $89/month
- **Storage**: 100 GB
- **Bandwidth**: 100 GB/month
- **Transformations**: 1M/month

## Monitoring & Analytics - Free Tiers

### Sentry

**Free Tier**:
- **Events**: 5K events/month
- **Projects**: 1 project
- **Team Members**: 1

**Team Plan**: $26/month
- **Events**: 50K events/month
- **Projects**: Unlimited
- **Team Members**: 5

### Datadog

**Free Tier**: 14-day trial

**Regular Pricing**:
- **Infrastructure**: $15/host/month
- **APM**: $31/host/month
- **Logs**: $0.10/GB ingested

### New Relic

**Free Tier**:
- **Data**: 100 GB/month
- **Users**: Unlimited
- **Retention**: 8 days

**Standard Plan**: $0.25/GB/month
- **Data**: Pay-as-you-go
- **Retention**: 30 days

## Payment Processing - Free Tiers

### Stripe

**Free Tier**: None

**Regular Pricing**:
- **Transaction Fee**: 2.9% + $0.30 per transaction
- **International**: 3.9% + $0.30
- **No monthly fee**

### PayPal

**Free Tier**: None

**Regular Pricing**:
- **Transaction Fee**: 2.9% + $0.30 per transaction
- **International**: 4.4% + fixed fee
- **No monthly fee**

### Paddle

**Free Tier**: None

**Regular Pricing**:
- **Transaction Fee**: 5% + $0.50 per transaction
- **Includes**: Tax handling, compliance

## CDN Services - Free Tiers

### Cloudflare

**Free Tier**:
- **Bandwidth**: Unlimited
- **Requests**: Unlimited
- **SSL**: Free SSL
- **DDoS Protection**: Yes
- **CDN**: Yes

**Pro Plan**: $20/month
- **Advanced features**: Yes
- **Analytics**: Advanced

### Fastly

**Free Tier**: None

**Regular Pricing**:
- **Bandwidth**: $0.12/GB
- **Requests**: $0.0075/10K requests

## Quick Reference: Free Tier Comparison

### Best Free Tiers for Solo Developers

**Cloud Hosting**:
- **Oracle Cloud**: Best always-free tier (2 VMs, 200 GB storage)
- **AWS**: Good 12-month free tier + always-free services
- **GCP**: $300 credit + always-free services
- **Azure**: $200 credit + 12-month free tier

**Hosting Platforms**:
- **Vercel**: 100 GB bandwidth, unlimited deployments
- **Netlify**: 100 GB bandwidth, 300 build minutes
- **Railway**: $5/month credit
- **Render**: 750 hours/month (sleeps after inactivity)

**Databases**:
- **Supabase**: 500 MB storage, 50K MAUs
- **PlanetScale**: 1 GB storage, 1B reads/month
- **Neon**: 0.5 GB storage, 0.5 vCPU
- **MongoDB Atlas**: 512 MB storage

**Authentication**:
- **Supabase Auth**: 50K MAUs (best free tier)
- **Clerk**: 10K MAUs
- **Auth0**: 7K MAUs
- **Firebase Auth**: Unlimited users

**Development Tools**:
- **GitHub**: Unlimited repos, 2K Actions minutes
- **GitLab**: Unlimited repos, 400 CI/CD minutes
- **GitHub Codespaces**: 60 hours/month
- **Replit**: Unlimited public repls

## Cost Optimization Tips

1. **Maximize Free Tiers**: Use free tiers before paying
2. **Combine Free Tiers**: Use multiple free tiers together
3. **Monitor Usage**: Set up billing alerts
4. **Right-Size Resources**: Don't over-provision
5. **Use Reserved Instances**: For predictable workloads
6. **Schedule Resources**: Turn off non-production environments
7. **Optimize Storage**: Use lifecycle policies
8. **Cache Aggressively**: Reduce API calls and bandwidth

## Free Tier Limitations to Watch

- **Expiration**: Some free tiers expire (12 months, 30 days)
- **Credit Expiration**: Credits expire if not used
- **Sleep Mode**: Some services sleep after inactivity
- **Resource Limits**: Storage, bandwidth, compute limits
- **Feature Restrictions**: Some features require paid plans
- **Support**: Free tiers often have limited support

## Best Practices

1. **Start with Free Tiers**: Always start with free tiers
2. **Monitor Closely**: Track usage to avoid overages
3. **Plan Migration**: Plan for when free tier expires
4. **Combine Services**: Use multiple free tiers strategically
5. **Optimize Early**: Optimize before hitting limits
6. **Document Decisions**: Keep track of free tier usage
7. **Set Alerts**: Set up billing alerts early
8. **Review Regularly**: Review costs monthly

