# Skill Marketplaces — Layer 2 Capabilities

**Source:** Web research across multiple platforms
**Extracted:** 2026-04-10
**What it is:** Landscape of SKILL.md-compatible skill discovery and installation platforms for Claude Code, Codex CLI, and AI coding agents.

## Platform Inventory

### 1. skills.sh (Vercel Labs)

- **URL:** https://skills.sh
- **CLI:** `npx skills find [query]` / `npx skills add <owner/repo@skill>`
- **Index size:** ~90K+ skills (growing)
- **Quality signals:** install count only
- **Search:** API-backed (`skills.sh/api/search`), keyword matching
- **Install sources:** GitHub shorthand, full GitHub URL, GitLab URL, local paths, arbitrary git URLs
- **Who runs it:** Vercel Labs (official, well-maintained)
- **Safety:** skills sourced from public GitHub repos; user vets quality via install count + repo stars
- **Strengths:** official CLI, broad install support, most established ecosystem
- **Weaknesses:** install count is the only quality signal; no ratings, no AI evaluation

### 2. SkillsMP

- **URL:** https://skillsmp.com
- **CLI:** none (web-only aggregator)
- **Index size:** claims 700K+ (likely GitHub scraping; real unique quality skills much lower)
- **Quality signals:** minimum 2 GitHub stars to be listed; basic quality scanning
- **Search:** web UI search; no public API discovered
- **Install:** manual — copy SKILL.md to `~/.claude/skills/` or `.claude/skills/`
- **Who runs it:** independent community project (not affiliated with Anthropic)
- **Safety:** scrapes public GitHub; minimum 2-star filter; user must review code
- **Strengths:** largest raw count; broad crawl surface
- **Weaknesses:** no CLI, no API, inflated count (GitHub scraping), no quality evaluation, 403 on web fetch (may block bots)

### 3. SkillHub

- **URL:** https://www.skillhub.club
- **CLI:** `npx @skill-hub/cli search [query]` / `npx @skill-hub/cli install [skill]`
- **Index size:** 80.3K skills claimed
- **Quality signals:** AI-evaluated 5-dimension rating (Practicality, Clarity, Automation, Quality, Impact); S-rank (9.0+), A-rank (8.0+)
- **Search:** semantic search + hybrid/embedding/fulltext modes; public API (`POST /api/v1/skills/search`) requires API key; rate limit 60 req/min
- **Install:** CLI, one-click desktop app, or manual copy
- **Who runs it:** independent project (github.com/keyuyuan/skillhub-awesome-skills)
- **Safety:** AI quality evaluation adds a layer; still user-vets code
- **Strengths:** AI quality ratings, semantic search, public API, multiple search methods
- **Weaknesses:** paid tiers for heavy use ($9.99/mo Pro); API key required; unknown trustworthiness of AI ratings

### 4. LobeHub

- **URL:** https://lobehub.com/skills
- **CLI:** unknown (web fetch blocked)
- **Index size:** unknown (web fetch blocked)
- **Quality signals:** unknown
- **Search:** web UI
- **Install:** SKILL.md format compatible
- **Who runs it:** LobeHub (open-source chat framework)
- **Safety:** established project (lobehub/lobe-chat on GitHub)
- **Strengths:** backed by established open-source project
- **Weaknesses:** couldn't access for detailed analysis; likely smaller than skills.sh/SkillHub

### 5. Claude Code Marketplaces (claudemarketplaces.com)

- **URL:** https://claudemarketplaces.com
- **CLI:** none (pure aggregator/directory)
- **Index size:** meta-directory of other marketplaces, not skills directly
- **Quality signals:** community votes, install count, GitHub stars
- **Search:** browsable by 18+ skill categories and 23+ marketplace categories
- **Install:** copy install command from detail page
- **Who runs it:** independent developer
- **Safety:** pure aggregator; no own skills
- **Strengths:** meta-view across ecosystem; useful for discovering OTHER marketplaces
- **Weaknesses:** no own index; no API; thin layer over GitHub links

## Practical Assessment for svc

### Which sources are worth integrating?

| Source | Searchable? | API? | Quality signal? | Worth integrating? |
|---|---|---|---|---|
| skills.sh | yes (CLI) | yes (internal) | install count | **YES — primary** (already used) |
| SkillHub | yes (CLI + API) | yes (public, key required) | AI ratings (5-dim) | **YES — secondary** (adds quality signal skills.sh lacks) |
| SkillsMP | web only | no | 2-star minimum | **NO for automation** (no API, inflated counts, 403 blocks) |
| LobeHub | web only | unknown | unknown | **NO for now** (blocked, unclear value-add) |
| claudemarketplaces.com | web only | no | community votes | **REFERENCE ONLY** (meta-directory, useful for discovery not search) |

### Recommendation

Two-source strategy: skills.sh (primary, CLI) + SkillHub (secondary, API for quality ratings).
SkillsMP is noise — inflated count, no API, no quality signal beyond 2-star minimum.

## Monetization/FinOps Skill Landscape (2026-04-10)

### Already installed in this environment (14 skills)

| Skill | Source | Focus |
|---|---|---|
| `pricing` | coreyhaines marketing pack | SaaS pricing decisions, packaging, Van Westendorp, tiers |
| `churn-prevention` | coreyhaines marketing pack | Cancel flows, save offers, dunning, win-back |
| `paywalls` | coreyhaines marketing pack | In-app paywalls, upgrade screens, feature gates |
| `mor-vs-stripe` | installed (unknown source) | MoR vs processor comparison (Dodo, Paddle, LemonSqueezy vs Stripe) |
| `dodo-best-practices` | Dodo Payments | Dodo integration best practices |
| `checkout-integration` | Dodo Payments | Checkout sessions, payment flows |
| `subscription-integration` | Dodo Payments | Subscriptions, trials, upgrades |
| `usage-based-billing` | Dodo Payments | Meters, events, metered subscriptions |
| `credit-based-billing` | Dodo Payments | Credit entitlements, ledger, rollover |
| `billing-sdk` | Dodo Payments | React components for billing UI |
| `webhook-integration` | Dodo Payments | Payment event webhooks |
| `license-keys` | Dodo Payments | License key management |
| `revenuecat` | installed (MCP-based) | Mobile subscription analytics, MRR, churn |
| `stage-revenue` | svc core | Revenue staging (Stage 1 fast money → Stage 3 real thing) |

### Found externally but NOT installed

| Skill | Source | Installs | Focus | Worth it? |
|---|---|---|---|---|
| `eronred/aso-skills@monetization-strategy` | skills.sh | 618 | Mobile app monetization, paywalls, IAP, subscriptions | **MAYBE** — mobile-focused, overlaps pricing but adds app-store specifics |
| `claude-office-skills/skills@stripe-payments` | skills.sh | 451 | Stripe integration | **SKIP** — we have Dodo stack; Stripe is a different path |
| `scientiacapital/skills@business-model-canvas` | skills.sh | 262 | Business model canvas | **MAYBE** — complements stage-revenue for early-stage planning |
| `sickn33/antigravity-awesome-skills@startup-financial-modeling` | skills.sh | 184 | Startup financial modeling | **MAYBE** — fills gap between pricing and actual P&L/runway modeling |
| `manojbajaj95/claude-gtm-plugin@pricing-strategy` | skills.sh | 118 | Pricing strategy | **SKIP** — we have coreyhaines pricing (far more installs via pack) |
| `personamanagmentlayer/pcl@finops-expert` | skills.sh | 78 | FinOps / cloud cost optimization | **MAYBE** — different domain (infra costs vs product monetization) |
| `scientiacapital/skills@gtm-pricing` | skills.sh | 74 | GTM pricing | **SKIP** — likely overlaps pricing |
| `wojons/skills@cloud-cost-optimization` | skills.sh | 25 | Cloud cost optimization | **SKIP** — low installs, narrow |

### Gap Analysis

What's NOT covered by installed skills:
1. **Startup financial modeling** (P&L, runway, unit economics beyond churn) — gap
2. **Business model canvas / lean canvas** — gap (stage-revenue covers revenue staging, not business model design)
3. **FinOps / cloud cost optimization** — gap (if the project involves infra cost management)
4. **Mobile app monetization specifics** (App Store pricing, IAP mechanics) — partial gap (pricing is SaaS-focused)
5. **Stripe integration** — gap IF the project uses Stripe (we have Dodo stack only)

## Files Manifest

| File | What it covers |
|---|---|
| `CAPABILITIES.md` | This file — platform inventory + monetization skill landscape |
| `details/skills-sh.md` | (deferred — already covered in vercel-find-skills/) |
| `details/skillhub.md` | SkillHub API details, rating system, CLI |
| `details/skillsmp.md` | SkillsMP limitations and inflated-count analysis |
| `details/monetization-skills-evaluation.md` | Deep read of top external candidates |
