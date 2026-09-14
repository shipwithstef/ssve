# Launch Operations — Vendor Ownership & Migration

Knowledge files in this directory cover **operational migrations** between accounts at the same vendor: moving a Cloudflare zone, transferring a Vercel project, handing off GitHub org ownership, etc.

Distinct from `jurisdictions/` (legal vehicles) and `platforms/` (tech stack choices). These are the "now that the EOOD/LLC exists, how do I move my vendor accounts to it" steps.

## Files

| File | Topic |
|---|---|
| [cloudflare-zone-transfer.md](cloudflare-zone-transfer.md) | Move a Cloudflare zone (DNS/CDN/SSL/Email Routing) between Cloudflare accounts; registrar-vs-zone separation; what does NOT move |

## When to read

- Founder is structuring an EOOD/LLC owned by a different identity (spouse, relative, business entity) and needs to move existing personal-account vendor resources
- Vendor account is being handed off to a new owner (acquisition, dissolution, co-founder exit)
- Auditing what vendor resources are account-scoped vs zone/project-scoped before a structural change

## Pattern across all entries

Each file in this directory should answer:
1. **What moves with the resource** (settings, configs, history)
2. **What does NOT move** (account-scoped resources that need recreation)
3. **Sequence to avoid downtime**
4. **Gotchas** (plan-tier resets, API token invalidation, billing-history loss, etc.)
