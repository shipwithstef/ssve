# Replit Pricing & Plans

## Mechanism
Subscription + usage-based credits. Monthly credits cover AI usage, compute, storage, and deployments. Unused Core credits expire monthly; Pro credits roll over for one month.

## Plans
| Plan | Monthly | Annual | Credits | Collaborators | Background Tasks |
|------|---------|--------|---------|---------------|-----------------|
| Starter | $0 | $0 | Limited daily | 1 | 0 |
| Core | $25 | $20 | $25/mo | 5 | 1 |
| Pro | $100 | $95 | Tiered + rollover | 15 | 10 |
| Enterprise | Custom | Custom | Custom | Custom | Custom |

## Key Cost Drivers
- Agent mode (Turbo burns ~2.5x faster)
- Deployment type (Reserved VM = always-on cost)
- Database storage and queries
- Outbound data transfer
- AI provider API calls (if using built-in integrations)

## Analysis
- Core is the sweet spot for solo builders
- Pro is cost-effective for teams of 3+ ($6.67/builder)
- Credit burn can surprise — monitor usage weekly
- Free tier is genuinely for exploration only

## L4 Pointers
- `docs.replit.com/billing/ai-billing`
- `docs.replit.com/billing/plans/replit-core`
- `docs.replit.com/billing/plans/replit-pro`
