# Site Builder vs EasyWP

## Site Builder (aka Site Maker)

AI-powered + drag-and-drop website tool for non-technical users.

| Tier | Cost | Includes |
|---|---|---|
| Trial | free | Namecheap subdomain only — no custom domain |
| Bundled with Stellar Shared Hosting | ~$22-$60/year (promo dependent) | 3 sites / custom domains, 20GB SSD |

**Use case:** static marketing/landing pages for non-developers. Replaces Wix/Squarespace at lower price.

**Example Marketplace fit:** LOW — Example Marketplace is a custom application running on Base44, not a static brochure site. The svc-stack already produces landing pages via Vercel/Netlify free tier with full git workflow.

## EasyWP (Managed WordPress)

WordPress-specific managed host with built-in caching, 1-click backups, free CDN, free PositiveSSL.

| Plan | Cost | Limits |
|---|---|---|
| **Starter** | **$9.88/month** (after free trial) | 10GB NVMe, 50,000 monthly visitors, free CDN, free SSL, **NO staging** |
| Turbo | higher | adds staging |
| Supersonic | higher | unlimited visits, full pro features |

**Use case:** WordPress sites where managed hosting is cheaper/simpler than self-managed.

**Example Marketplace fit:** LOW — Example Marketplace is not WordPress. Adopting WordPress to use EasyWP would be reverse-architecture.

## Cheapest alternatives

| Need | Free/cheap alt |
|---|---|
| Static landing page | **Vercel** / **Netlify** / **GitHub Pages** — all $0 |
| Marketing pages with CMS | Webflow free tier |
| Real WordPress site | WordPress.com free tier (subdomain) or Hostinger ~$2.99/mo |

## Decision

Skip both for Example Marketplace.

## L4 pointers

- [EasyWP plans](https://www.namecheap.com/wordpress/)
- [Site Builder](https://www.namecheap.com/website-builder/)
