# Namecheap — CAPABILITIES (Layer 2)

**Version:** 2026-04-25 https://www.namecheap.com/
**Source type:** Closed-source vendor (domain registrar + hosting + adjacent SaaS)
**Sub-agent used for extraction:** gemini-cli (primary, per WI-090 + rules/research-must-use-gemini-cli.md)

## Why this domain exists

Captured 2026-04-25 to drive a Example Marketplace-specific extend-vs-cancel decision before the builder's Namecheap trial expires **2026-04-27** (~2 days). Extension cost: **$9.88/mo**.

## Surfaces

| Surface | What it is | Cheapest tier | Relevance to Example Marketplace |
|---|---|---|---|
| **Domain registration** | Core registrar for example-marketplace-related TLDs | $15.88-$18.48/yr `.com` (incl. free WhoisGuard) | **HIGH** — required to launch |
| **Site Builder / Site Maker** | AI + drag-and-drop website tool | Free trial (subdomain only) → Stellar Shared Hosting ~$22-$60/yr (3 sites, 20GB) | **LOW** — Example Marketplace is on Base44, not a static site |
| **EasyWP** | Managed WordPress | $9.88/mo Starter (10GB NVMe, 50K visits/mo, no staging) | **LOW** — Example Marketplace isn't WordPress |
| **Private Email** | Custom-domain mailboxes | $14.88/yr Starter (1 mailbox, 5GB) | **MEDIUM** — trust signal, not a blocker |
| **Logo Maker** | Free AI logo generator | $0, unlimited, vector export | **LOW** — non-trademarkable |
| **RelateSuite** (3 tiers — marketing/SEO/reviews/ads) | Essential 15.88 / Pro 28.88 / Advanced 33.88 — see [details/relatesuite-tiers.md](details/relatesuite-tiers.md) | 4-week free trial each | **LOW** for vendor purchase; Pro Reviews module is HIGH as product-inspiration for Example Marketplace itself |
| **VPN / SSL / Privacy** | FastVPN, SSL certs, WhoisGuard | Domain privacy is FREE everywhere now | **LOW** — duplicative |

Detail files:
- [details/domain-and-dns.md](details/domain-and-dns.md)
- [details/site-builder-vs-easywp.md](details/site-builder-vs-easywp.md)
- [details/email-hosting.md](details/email-hosting.md)
- [details/marketing-tools.md](details/marketing-tools.md)
- [details/relatesuite-tiers.md](details/relatesuite-tiers.md)

## Decision: CANCEL the $9.88 trial extension

**Rule applied:** "EXTEND if and only if ≥2 surfaces score High relevance."
**Result:** only Domain Registration is High → CANCEL.

**Action plan (recorded in registry too):**
1. Let the $9.88 trial expire 2026-04-27
2. Keep the domain registered at Namecheap (or transfer to **Cloudflare/Porkbun** for ~$5/yr saving on .com renewal)
3. Route DNS → Base44 instance
4. Use **Cloudflare Email Routing** (free) for `contact-d159caf06f@example.invalid` → personal Gmail forwarding
5. Build landing pages with the svc-stack (Vercel/Netlify free tier) — not Site Builder
6. Use **Meta Business Suite** (free) for FB/IG scheduling — not RelateSocial

## Cheapest-alternative summary

| Need | Namecheap cost | Free/cheaper alternative |
|---|---|---|
| Domain | $15.88+/yr | Cloudflare/Porkbun ~$10/yr |
| SSL | bundled in EasyWP | Let's Encrypt free, auto-renew |
| Email | $14.88/yr | Cloudflare Email Routing free; Zoho 5-user free tier |
| Landing page | Site Builder $22-60/yr | Vercel/Netlify/GitHub Pages free |
| Logo | free Logo Maker | Canva/Figma free; svc-stack-generated SVG |
| Social scheduling | RelateSocial Pro | Meta Business Suite free; Buffer free 3-channel |
| VPN | FastVPN | Cloudflare WARP free |

**Total cost of replacing every paid Namecheap surface with free alternatives:** ~$10/yr (just the domain at Cloudflare) vs ~$118/yr if extending the $9.88/mo trial.

## Volatility

- Pricing changes frequently (sales, promo cycles).
- Re-verify every 30 days OR before any renewal decision.
- Source URLs in detail files include verification dates.
