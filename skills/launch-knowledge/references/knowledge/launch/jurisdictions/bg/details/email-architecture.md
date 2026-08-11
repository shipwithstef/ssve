# BG EOOD — Email Architecture for Portfolio Studios

**Layer:** 3 (detail)
**Topic:** How to structure email addresses across personal mailbox, EOOD legal entity, and per-product brands for a Bulgarian software portfolio EOOD
**Sources:** Cloudflare Email Routing docs, solo-founder LLC formation guides, BG-specific bank/NRA correspondence patterns

---

## Mechanism

A portfolio EOOD shipping multiple software products has THREE distinct identity layers, each warranting its own email address:

### Layer 1 — Personal mailbox (the actual inbox)

Where mail lives, where 2FA codes arrive, where account recovery is anchored. Almost always Gmail / Fastmail / iCloud / Proton on a personal account predating the EOOD.

This layer is invisible to external parties. It's the mailbox the founder reads, regardless of which branded address received the mail.

### Layer 2 — EOOD legal entity domain

Branded address tied to the EOOD's official identity (e.g., `contact-38b761d817@example.invalid`). Survives independently of any specific product. Used for:
- Bank account in EOOD's name
- NAP / NRA tax filings
- KZLD data-protection correspondence
- Lawyer / accountant ongoing correspondence
- Subscription billing (when invoiced to EOOD)
- Apple Developer Program / Google Play Developer enrollment
- Payment processor (Dodo, Paddle, Stripe) seller account
- B2B contract counterparties

Domain ownership = signal of legitimacy in B2B contexts. Survives product sales/spinoffs.

### Layer 3 — Per-product domain

Branded address tied to a specific product brand (e.g., `contact-b77c948115@example.invalid`, `contact-50052317c7@example.invalid`). Used for:
- Customer support for that product
- Product-specific marketing / outbound
- App Store / Google Play developer correspondence about that product
- GitHub / GitLab repo notifications for that product
- Product-specific analytics tools

Multiple products = multiple Layer 3 domains. Each product has its own brand surface.

### How the layers connect — Cloudflare Email Routing pattern

All Layer 2 and Layer 3 addresses are **receive-only forwarders** that pipe to the Layer 1 personal mailbox. Implementation:

1. Domain registered at any registrar (Namecheap, Cloudflare Registrar, BG hosting provider)
2. Domain added to Cloudflare (free); nameservers updated
3. Email Routing enabled in Cloudflare dashboard
4. Forwarding rules created: `<address>@<domain>` → `contact-a7c1e4a26f@example.invalid`
5. Gmail's "Send mail as" feature used for outbound from any branded address

Cost: domain registration only (~€10-15/yr per domain). Forwarding is free. No mailbox hosting needed.

For SENDING from a custom domain:
- Gmail "Send mail as" — free, works for low-volume (1-50 outbound/week)
- Google Workspace — $6/user/mo, full hosting + storage + admin
- Fastmail / Proton / Tutanota — €5-10/mo, privacy-focused alternative

## Analysis

### Why three layers, not one

| Failure mode | Cause |
|---|---|
| Sell product, lose EOOD bank/NRA correspondence | Used product domain (`example-marketplace.app`) for EOOD legal email; new buyer of product gets the domain |
| Customer brand confusion | Used EOOD domain (`pixelforge.bg`) for customer support; customer sees `From: contact-44f1419e46@example.invalid` instead of product brand |
| Lose all account recovery if domain expires | Used Workspace as primary mailbox; billing failure on the domain breaks 2FA recovery for every connected account |
| Tax deductibility unclear | Personal email on invoices; tax authority can dispute whether business expense |
| No professional separation | Mix personal + business on same Gmail; subscription invoices for personal Netflix and EOOD-deductible Cursor land in same folder |

The three-layer model addresses all five.

### Specific BG considerations

- **NAP / NRA filings** — Bulgarian tax authority correspondence often arrives by post + email. Use EOOD-domain email for all НАП registrations so correspondence has a clean trail.
- **KZLD GDPR notifications** — KZLD prefers business email for breach notifications.
- **Bank account opening** — Wise Business / Revolut Business / DSK / UBB / etc. accept any email but professional EOOD-domain looks better at compliance review.
- **Domain TLD choice** — `.bg` for legal/local presence; `.com` for international; `.ai` / `.io` / `.app` etc. for product brands. EOOD domain typically uses `.bg` or `.com`.

### Migration when ЕИК lands

The EOOD email infrastructure can be set up before or after the ЕИК issues:
- **Before ЕИК:** buy domain, set up forwarding (free), prepare addresses for use
- **After ЕИК:** start using the EOOD-domain addresses on bank account, NRA filings, subscription billing

Existing subscriptions on personal email can KEEP the personal email login. What changes is the **billing recipient** on the invoice (add EOOD legal name + ЕИК + VAT number to the billing tab in each subscription's settings) and the **payment method** (EOOD card from EOOD bank account).

There is NO need to migrate accounts to a new email address. That would lose chat history, settings, saved data with no tax benefit. The EOOD-domain email is for NEW correspondence (lawyer, accountant, bank, NRA, contracts), not for re-rooting existing accounts.

### Email address inventory for Example Marketplace-style portfolio EOOD

Suggested concrete inventory at incorporation:

```
Layer 1 (personal mailbox — already exists):
  contact-8f7de46757@example.invalid  →  reads everything

Layer 2 (EOOD-level domain — set up at ЕИК):
  contact-38b761d817@example.invalid     →  forwards to contact-8f7de46757@example.invalid
  contact-0ef9497ce8@example.invalid   →  forwards to contact-8f7de46757@example.invalid
  contact-44f1419e46@example.invalid   →  forwards to contact-8f7de46757@example.invalid
  contact-a5f6abf1b1@example.invalid     →  forwards to contact-8f7de46757@example.invalid

Layer 3 (per-product domain — already exists for Example Marketplace):
  contact-b77c948115@example.invalid      →  forwards to contact-8f7de46757@example.invalid
  contact-50052317c7@example.invalid    →  forwards to contact-8f7de46757@example.invalid
  contact-6965637d4e@example.invalid    →  forwards to contact-8f7de46757@example.invalid
```

When product #2 launches under same EOOD, add Layer 3 for that product without affecting any other layer.

### Sending mechanics — choosing the from-address

| Recipient | Send-as address |
|---|---|
| Lawyer (Advokatami), accountant, bank, NRA, KZLD | `contact-38b761d817@example.invalid` |
| Subscription provider replying to billing query | `contact-0ef9497ce8@example.invalid` |
| Example Marketplace customer support reply | `contact-50052317c7@example.invalid` |
| Public marketing / press / community | `contact-a5f6abf1b1@example.invalid` (entity-level) or product-level depending on context |
| Personal correspondence | `contact-8f7de46757@example.invalid` |

In Gmail compose, dropdown selects which from-address. Recipients see the chosen address regardless of where it actually lands.

## Three viable hosting tiers

For Layer 2 (EOOD domain) and Layer 3 (per-product domain), three real options:

### Tier 0 — Free Gmail fallback (NOT recommended)

Just create a free Gmail like `contact-2fe21b039b@example.invalid` and use it as the EOOD's "official" email. No custom domain.

**Why this fails:**
1. Amateur signal on invoices, contracts, B2B correspondence
2. Bank KYB review treats free-email-on-application as weak compliance signal
3. If Google bans the account, no recourse — EOOD email is gone
4. Cannot have separate `billing@`, `support@`, `owner@` aliases — each needs its own Gmail account
5. No portability — locked into Google forever
6. Trademark application is weaker without matching domain ownership
7. Invoice convention expects `billing@<yourdomain>` — free Gmail breaks the pattern

Use only if absolute refusal to spend €12/yr. Most solo founders regret this within 6 months.

### Tier 1 — Custom domain + Cloudflare receive-only + Gmail "Send mail as" (RECOMMENDED for solo founder)

Custom domain (~€12/yr) + Cloudflare Email Routing (free) + Gmail "Send mail as" (free).

- Receive: Cloudflare forwards all `<address>@<domain>` to personal Gmail
- Send: Gmail compose dropdown selects branded from-address; recipient sees branded address
- Aliases: unlimited (200 routing rules in Cloudflare)
- Storage: personal Gmail's 15GB
- Deliverability: works for low-volume (1-50 outbound/week to known recipients)
- Cost: ~€12/yr per domain (just registration)

**Best fit for:** solo founders pre-revenue, 1-5 EOOD emails/week, mixed personal+business mailbox is OK.

### Tier 2 — Custom domain + Google Workspace (for when scaling)

Custom domain (~€12/yr) + Google Workspace Business Starter ($6/user/mo = ~€72/yr).

- Native send/receive on custom domain (no Gmail send-as workaround)
- Per-user accounts (admin controls, audit log, password reset)
- Separate Calendar/Drive workspace from personal
- Auto-configured SPF/DKIM/DMARC for deliverability
- Cost: ~€84/yr/user

**When Workspace earns the extra €72/yr:**
- First hire (employee/contractor needs branded email account)
- High-volume outbound (cold sales, marketing) where enterprise deliverability matters
- Shared inboxes (e.g., support@ shared between founder + assistant)
- Want clean separation of business calendar/Drive from personal life
- Want admin oversight (revoke access if employee leaves)

**Don't upgrade to Workspace until at least one of those triggers fires.** For solo founder, the €72/yr is dead weight.

### Tier comparison summary

| Setup | Annual cost | Receive on custom domain | Send from custom domain | Storage | Multi-user | Aliases |
|---|---|---|---|---|---|---|
| Free Gmail | €0 | ❌ | ❌ | 15GB personal | ❌ | 1 address |
| Cloudflare + Gmail send-as | €12 | ✅ | ✅ via Gmail SMTP | 15GB personal | ❌ | unlimited (200) |
| Google Workspace | €84 | ✅ native | ✅ native | 30GB+ branded | ✅ | per-account |

For Diana's stage: **Tier 1**. Upgrade to Tier 2 when hiring or going high-volume outbound.

## L4 Pointers

- **Cloudflare Email Routing docs:** https://developers.cloudflare.com/email-routing/
- **Gmail "Send mail as" setup:** https://support.google.com/mail/answer/22370
- **Google Workspace pricing:** https://workspace.google.com/pricing.html
- **Fastmail privacy-focused alternative:** https://www.fastmail.com/
- **BG domain registrars:** https://www.superhosting.bg/, https://www.namecheap.com/

For project-specific application:
- Diana's Example Marketplace case: see project-side `docs/specs/launch/STATE.md` §6.5 for migration sequence
- Cross-reference: `details/personal-vs-business-subscriptions.md` for billing-detail migration on existing subscriptions
