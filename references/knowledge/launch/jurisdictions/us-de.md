# US Delaware — LLC vs C-Corp for Software Founders

Last verified: 2026-04-26. Sources: Delaware Division of Corporations (https://corp.delaware.gov/) + Stripe Atlas docs (https://stripe.com/atlas) + IRS publications.

## Overview

Delaware is the default US incorporation state for SaaS startups because of (1) well-developed corporate case law, (2) no state corporate income tax for non-Delaware-source income (most SaaS revenue qualifies), (3) preference of US institutional investors. Two practical entity forms:

- **LLC (Limited Liability Company)** — pass-through taxation by default; flexible governance; preferred for solo and bootstrapped founders.
- **C-Corp (Corporation, Subchapter C)** — separate taxable entity; required by US institutional VCs (preferred share class); standard for fundraising-track startups.

## Key facts

| Item | Delaware LLC | Delaware C-Corp |
|---|---|---|
| Setup cost | ~$200–400 (state fee + registered agent year 1) | ~$200–400 (state fee + registered agent year 1) |
| Annual franchise tax | $300 minimum (Alternative Entity Tax) | $400 minimum (assumed-par-value method); can balloon to $200K if uncapped |
| Federal income tax | Pass-through to members (taxed personally) | 21% federal corporate rate; second layer at distribution |
| Investor-friendly | NO for institutional VCs (LLC K-1 is messy) | YES (preferred shares, ISOs, 83(b) elections) |
| Best for | Solo / bootstrap / digital products | Raising priced equity, granting employee options |
| Conversion cost (LLC → C-Corp) | $5K–$15K legal + tax election | N/A |

## Stripe Atlas

Stripe Atlas (https://stripe.com/atlas) is a turnkey incorporation service:

- **Cost:** $500 one-time fee.
- **Includes:** Delaware C-Corp or LLC formation, EIN application, registered agent year 1, Stripe account setup, Mercury or Brex bank intro.
- **Timeline:** 5–10 business days to bank account active.
- **Best for:** non-US founders who want a US merchant identity to sell to US customers via Stripe.

### CFC trap for non-US founders

> **CRITICAL — read before recommending Stripe Atlas to a BG / EE / DE / NL / etc. resident.**

If you are tax-resident in a country with **CFC (Controlled Foreign Company) rules** (which includes Bulgaria, Germany, Netherlands, France, UK, and most OECD members), forming a US LLC or C-Corp does NOT escape your home-country tax. CFC rules **attribute the foreign company's undistributed income to you personally** for home-country tax purposes.

Specific traps:

- **Bulgaria:** CFC rules attribute undistributed income to BG-resident shareholders. Combined with US obligations (Form 5471 for shareholders of foreign corporations, FBAR for >$10K bank accounts) this turns a $500 Stripe Atlas fee into ~$3K–$5K/year of cross-border accounting, with no corporate-tax savings.
- **Germany:** ATAD 2 + national CFC rules. Same attribution problem; high-tax-resident pays full German rate on attributed US income.
- **Netherlands / France / UK:** Same CFC frameworks under EU Anti-Tax Avoidance Directive (ATAD) or national equivalents.

**Decision rule for non-US founders:** Stripe Atlas is only net-positive if (a) you have qualified international tax counsel, OR (b) you actually relocate to the US, OR (c) the cross-border admin cost (~$5K/year) is dwarfed by the Stripe-payment-acceptance value (which it is for US-customer-heavy enterprise SaaS, NOT for early bootstrapped solo founders).

Reference: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part D explicitly flags this trap for the Stefan/wife BG profile: *"If you use Stripe Atlas to form a US C-Corp/LLC to get access [to Mercury/Brex], you will trigger complex tax implications in Bulgaria (CFC rules, double taxation without careful structuring)."*

## When to incorporate (US-domiciled founders)

Use these triggers to decide LLC vs C-Corp vs sole prop:

| Situation | Recommendation |
|---|---|
| US resident, solo, <$30K/year SaaS revenue | Sole prop on Schedule C; no incorporation |
| US resident, solo, $30K–$200K/year revenue | Delaware LLC (pass-through); ~$300/yr franchise tax |
| US resident, solo or small team, planning to raise priced round in <12 months | Delaware C-Corp from day one (avoid $5–15K conversion later) |
| US resident, ≥2 founders, no fundraising plan | Multi-member LLC (taxed as partnership) |
| US resident, taking outside investment (priced round, SAFE convertible) | Delaware C-Corp (LLCs cannot grant preferred stock) |
| Non-US resident, US-customer-heavy | Stripe Atlas C-Corp + tax counsel (see CFC trap above) |
| Non-US resident, EU-customer-heavy | Estonian OÜ (see `ee.md`), NOT Stripe Atlas |

## Annual obligations

### LLC
- Delaware Annual Franchise Tax: $300 minimum, due June 1.
- Federal: Form 1065 (multi-member) or Schedule C (single-member); K-1 to each member.
- State: depends on operating state (CA $800/year + LLC tax, NY $25–$4,500, TX $0).
- Registered agent renewal: ~$50–150/year.

### C-Corp
- Delaware Annual Franchise Tax: $400 minimum (use assumed-par-value method; default authorized-shares method can shock-bill $50K+ on standard 10M-shares filings).
- Federal: Form 1120 corporate return.
- State: where operating.
- Registered agent renewal: ~$50–150/year.

## Common pitfalls

- **Default Delaware franchise-tax method shock.** New C-Corps default to the authorized-shares-method calculation. A 10M-share authorized cap can produce a $50K+ tax bill before any revenue. **Always file using the assumed-par-value-capital method** (Delaware allows it); reduces minimum to $400. Stripe Atlas defaults to the right method; DIY incorporators forget.
- **Skipping 83(b) election.** Founders who get restricted stock in a C-Corp have **30 days** from grant to file 83(b) with IRS. Missing it means tax on the value at vest, not at grant — potentially $100K+ tax bill on $0 income. Non-negotiable for any C-Corp founder.
- **Not opening a separate bank account.** Co-mingling personal and business funds pierces the corporate veil — destroys liability protection. Open Mercury / Brex / SVB / Wells Fargo Business immediately.
- **Foreign founders applying for SSN-required accounts.** Some US banks require founder SSN; non-US founders without SSN need Mercury or Brex which accept ITIN or no-SSN paths. Stripe Atlas guides this.
- **Believing C-Corp is "the right call" because Y Combinator / Stripe / VCs say so.** Y Combinator companies are raising priced rounds; for solo bootstrapped founders, C-Corp adds annual federal corporate filing + double taxation on profits without the offsetting benefit.

## Sources

- Delaware Division of Corporations: https://corp.delaware.gov/
- Stripe Atlas: https://stripe.com/atlas (and https://stripe.com/atlas/guides for the founder handbook)
- IRS Form 1120 (C-Corp): https://www.irs.gov/forms-pubs/about-form-1120
- IRS Form 1065 (LLC partnership): https://www.irs.gov/forms-pubs/about-form-1065
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part D (CFC trap for BG residents)
