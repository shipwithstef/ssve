# Expo EAS Build Pricing Guide (2025)

## Overview

Complete pricing guide for Expo Application Services (EAS) Build, including alternatives and cost optimization strategies.

## Expo EAS Build Plans

### Free Plan
- **Builds**: 30 low-priority builds/month
  - Up to 15 iOS builds
  - Low priority (may take longer)
  - Resets monthly

- **EAS Update**: 
  - Up to 1,000 monthly active users (MAUs)
  - 100 GiB global edge bandwidth
  - Unlimited updates

- **Cost**: $0/month
- **Best For**: Personal projects, testing, learning

### Starter Plan
- **Price**: $19/month
- **Build Credits**: $45 included
  - Priority builds
  - ~9-15 builds depending on complexity
  - Additional builds: $5-10 each

- **EAS Update**:
  - Up to 3,000 MAUs
  - 100 GiB global edge bandwidth
  - Unlimited updates

- **Best For**: Solo developers, small apps, launching to stores

### Production Plan
- **Price**: $99/month
- **Build Credits**: $100 included
  - Priority builds
  - ~20-30 builds depending on complexity
  - Additional builds: $5-10 each

- **EAS Update**:
  - Up to 200,000 MAUs
  - 100 GiB global edge bandwidth
  - 2 build concurrencies
  - Unlimited updates

- **Best For**: Growing apps, professional developers, small teams

### Enterprise Plan
- **Price**: $1,999/month
- **Build Credits**: $1,000 included
  - Priority builds
  - ~200+ builds depending on complexity
  - Additional builds: $5-10 each

- **EAS Update**:
  - Up to 1,000,000 MAUs
  - 100 GiB global edge bandwidth
  - 5 build concurrencies
  - Unlimited updates
  - Dedicated support

- **Best For**: Large apps, enterprise, high-volume builds

## Build Cost Breakdown

### Build Complexity Factors
- **Simple Build**: ~$5
  - Basic React Native app
  - Minimal dependencies
  - Standard configuration

- **Medium Build**: ~$7
  - Multiple native modules
  - Custom native code
  - Moderate dependencies

- **Complex Build**: ~$10
  - Heavy native dependencies
  - Custom native modules
  - Large codebase

### Build Frequency Estimates
- **Development**: 5-10 builds/month
- **Staging**: 2-5 builds/month
- **Production**: 1-3 builds/month
- **Total**: 8-18 builds/month typical

## Cost Scenarios

### Scenario 1: Solo Developer (MVP)
- **Plan**: Free Plan
- **Builds**: 10 builds/month (within free tier)
- **Cost**: $0/month
- **Limitation**: Low priority builds

### Scenario 2: Solo Developer (Launching)
- **Plan**: Starter Plan ($19/month)
- **Builds**: 12 builds/month
  - 10 builds covered by credits
  - 2 additional builds: ~$14
- **Total Cost**: ~$33/month
- **Benefit**: Priority builds, faster turnaround

### Scenario 3: Growing App
- **Plan**: Production Plan ($99/month)
- **Builds**: 25 builds/month
  - All covered by included credits
- **Total Cost**: $99/month
- **Benefit**: Higher MAU limit, concurrency

### Scenario 4: High-Volume App
- **Plan**: Enterprise Plan ($1,999/month)
- **Builds**: 150 builds/month
  - All covered by included credits
- **Total Cost**: $1,999/month
- **Benefit**: Maximum limits, support

## Free Alternatives

### GitHub Actions (Free CI/CD)
- **Cost**: Free for public repos, 2000 minutes/month for private
- **Setup**: Requires configuration
- **Limitations**: 
  - Need macOS runners for iOS (paid)
  - More complex setup
  - Self-maintained

**Best For**: Developers comfortable with CI/CD setup

### Local Builds
- **Cost**: $0 (time investment)
- **Setup**: Requires macOS for iOS builds
- **Limitations**:
  - Need physical Mac or MacStadium
  - Time-consuming
  - Manual process

**Best For**: Occasional builds, learning

### EAS Build Free Tier Optimization
- **Strategy**: Maximize free tier usage
- **Tips**:
  - Use low-priority builds for development
  - Batch builds when possible
  - Use EAS Update for OTA updates
  - Minimize build frequency

## Cost Optimization Strategies

### 1. Minimize Build Frequency
- Use EAS Update for code changes (not native)
- Batch multiple changes into single build
- Only build when necessary (native changes)

### 2. Use Appropriate Plan
- Start with Free Plan
- Upgrade only when needed
- Monitor build usage

### 3. Optimize Build Configuration
- Reduce dependencies
- Use prebuild for faster builds
- Cache dependencies
- Optimize native modules

### 4. Leverage EAS Update
- Use OTA updates for JS changes
- Only build for native changes
- Reduces build frequency significantly

### 5. Consider Alternatives
- GitHub Actions for free CI/CD
- Local builds for occasional needs
- MacStadium for dedicated Mac

## Migration Strategy

### From Free to Paid
1. **Monitor Usage**: Track build frequency
2. **Assess Needs**: Determine if priority needed
3. **Calculate Costs**: Compare plan vs. pay-as-you-go
4. **Upgrade Gradually**: Start with Starter, upgrade as needed

### From Paid to Free Alternative
1. **Evaluate Build Frequency**: Can you reduce builds?
2. **Set Up GitHub Actions**: Free alternative
3. **Use EAS Update**: Minimize native builds
4. **Consider Local Builds**: For occasional needs

## Recommendations by Use Case

### Personal Project
- **Plan**: Free Plan
- **Cost**: $0/month
- **Builds**: Up to 30/month

### Solo Developer Launching
- **Plan**: Starter Plan
- **Cost**: $19-35/month
- **Builds**: 10-15/month

### Small Team
- **Plan**: Production Plan
- **Cost**: $99/month
- **Builds**: 20-30/month

### Enterprise
- **Plan**: Enterprise Plan
- **Cost**: $1,999/month
- **Builds**: 200+/month

## Additional Costs to Consider

### App Store Fees
- **Apple App Store**: $99/year (developer account)
- **Google Play**: $25 one-time (developer account)

### Code Signing
- **iOS**: Included with EAS Build
- **Android**: Included with EAS Build

### Storage
- **EAS Update**: 100 GiB included in all plans
- **Additional**: Pay-as-you-go pricing

## Total Cost of Ownership

### Solo Developer (First Year)
- **EAS Build**: $0-228/year (Free or Starter)
- **App Store Fees**: $124/year (iOS + Android)
- **Total**: $124-352/year

### Growing App (First Year)
- **EAS Build**: $1,188/year (Production)
- **App Store Fees**: $124/year
- **Total**: $1,312/year

### Enterprise App (First Year)
- **EAS Build**: $23,988/year (Enterprise)
- **App Store Fees**: $124/year
- **Total**: $24,112/year

## Next Steps

1. **Assess Your Needs**: Determine build frequency and priority
2. **Start with Free**: Use free tier to test
3. **Monitor Usage**: Track builds and costs
4. **Optimize**: Reduce builds with EAS Update
5. **Upgrade When Needed**: Move to paid plan when necessary






