# Product Category Matrix

**The pipeline builds the code, not the builder.** Don't limit opportunities
to what the builder can hand-code. The pipeline writes React, mobile apps,
Chrome extensions — anything. Limit them to what the builder can:
- **Distribute** (reach paying users through their channels)
- **Deploy** (get it running and keep it running)
- **Maintain** (understand enough to debug, iterate, and respond to users)
- **Evaluate** (tell if the product actually works)

The pipeline + `teach-project` skill closes the coding knowledge gap.

## Domain Matching Rules

Domain is a strong signal, not a hard filter.

1. **If the user explicitly requests a domain** ("I want a devops solution"):
   focus on that domain. Don't suggest outside it unless nothing viable exists.
2. **If the user is open** ("what should I build?"): score ALL opportunities
   across all domains. Use domain match as a tiebreaker, not a veto.
3. **If the builder's domain is local business** (scheduling, salons,
   restaurants): reduce domain bonus by half (+4 instead of +8). Actively seek
   online product angles that serve a global market.
4. **Present the top 3 sorted by total score**, regardless of domain. Annotate
   domain fit.
5. **For first projects with no capital**: bias harder toward domain. Exception:
   local business domain + no capital → bias toward online products that reuse
   their skills, because local business tools require local sales/distribution.

**Domain edge scoring:**
- Core domain (builder does this daily): +8 points
- Adjacent domain (builder understands it): +4 points
- New domain (builder has no experience): +0 points
- Builder explicitly requested this domain: +10 points (overrides)
- Local business domain with online mandate: +4 points (halved)

## Distribution Models

Prefer solutions with built-in distribution. The product should live WHERE
the users already are.

| Distribution model | How it works | Examples |
|---|---|---|
| **Marketplace/platform** | Users browse the store, your product appears | Shopify apps, VS Code extensions, Raycast, Figma plugins, Chrome Web Store, npm packages |
| **Integration/plugin** | Your product plugs into something users already use | Slack bots, Discord bots, GitHub Actions, Terraform providers, Grafana plugins |
| **Embedded in workflow** | Users hit your product as part of their existing tool | API services called by other products, webhook receivers, MCP servers |
| **Community-native** | Product is shared/discussed where users already gather | GitHub repos (stars = distribution), Reddit-discoverable tools, HN-launchable |
| **SEO/search-native** | Users Google the problem and find your solution | Tools for specific searches ("convert X to Y", "monitor Z") |
| **Standalone** | Users must find your website and sign up | SaaS dashboards, web apps (weakest distribution — needs marketing) |

**Scoring boost for built-in distribution:**
- Marketplace/platform apps: +3
- Integration/plugin: +2
- Community-native: +1 (if builder has presence)
- Standalone web app: +0

## Product Categories

| Category | Examples | Revenue Model | Build Time | Distribution |
|---|---|---|---|---|
| **Marketplace apps** | Shopify apps, VS Code extensions, Raycast, Figma plugins | Marketplace cut or subscription | 1-3 weeks | Built-in marketplace discovery |
| **Platform integrations** | Slack/Discord bots, GitHub Actions, MCP servers | Subscription or pay-per-use | 1-2 weeks | Platform's own ecosystem |
| **Chrome extensions** | Productivity, AI wrappers, page enhancers | Freemium ($5-15/mo) or one-time | 3-7 days | Chrome Web Store SEO |
| **API services** | Data APIs, AI wrappers, conversion tools | Pay-per-use or subscription | 3-10 days | Dev docs + marketplaces |
| **CLI tools / npm packages** | Dev tools, automation, scripts | One-time ($20-50) or subscription | 1-2 weeks | GitHub + npm + dev communities |
| **AI wrappers** | Purpose-built AI for specific niches | Pay-per-use (user-funded) | 3-7 days | SEO + niche communities |
| **Notification/alert services** | Monitoring, price alerts, keyword alerts | Subscription ($5-20/mo) | 1-2 weeks | Communities + integrations |
| **Templates/boilerplates** | Starter kits, themes, component packs | One-time ($29-99) | 1-2 weeks | Twitter/X + ProductHunt + Gumroad |
| **Web apps (SaaS)** | Dashboards, tools, calculators | Subscription ($9-49/mo) | 1-4 weeks | SEO + content (cold start) |
| **Mobile apps** | Utilities, lifestyle, productivity | In-app purchase or subscription | 2-6 weeks | App Store SEO (competitive) |
| **Info products** | Guides, courses, cheat sheets | One-time ($20-100) | 3-5 days | Existing audience required |

## Category Fit Quick-Score

For each category, score:

| Fit Dimension | Question |
|---|---|
| **Domain** | Does the builder understand this problem space from experience? |
| **Distribution** | Does the solution have built-in distribution OR can the builder reach buyers? |
| **Maintenance** | Can the builder deploy, debug, and iterate (with teach-project help)? |
| **Entity** | Does this category require a business entity the builder doesn't have? |
| **Budget** | Does this require upfront capital the builder doesn't have? |
| **Platform** | Does this category's STACK overlap with the builder's platform/skills? |

Eliminate categories that fail on Domain + Distribution combined (no edge).
Eliminate categories that fail on Platform ONLY if the stack is completely
mismatched (e.g., Swift iOS app for a React web developer).
Flag categories that fail on Entity or Budget (solvable with LemonSqueezy).
Focus the market scan on the top 3-5 categories that pass.
