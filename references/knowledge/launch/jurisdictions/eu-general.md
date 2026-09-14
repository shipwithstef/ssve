# EU-Level Mechanisms for Software Founders

Last verified: 2026-05-03. Sources: EU Commission, Tax Foundation CFC analysis, Innovation Norway, EIC.

## Purpose

Cross-cutting EU mechanisms that operate ABOVE national jurisdictions. A BG-resident founder uses these regardless of incorporation location. Document covers VAT One-Stop-Shop (OSS), Freedom of Establishment + CFC interaction, EU grant programs, and EU mobility tools.

## VAT One-Stop-Shop (OSS) — single VAT registration for all EU B2C

The OSS is the EU's mechanism to avoid registering for VAT in all 27 member states when selling cross-border B2C digital services.

| Parameter | Value |
|---|---|
| Threshold (cross-border B2C only) | €10,000/year |
| Below threshold | Charge home-country VAT rate (BG = 20%) |
| Above threshold | Register OSS in home country (BG), charge each customer their country's rate, file ONE quarterly return |
| Filing frequency | Quarterly |
| Routing | Home country tax authority forwards collected VAT to other EU member states |

### How it relates to MoR (Dodo Payments, Paddle, etc.)

When using a Merchant of Record (Dodo, Paddle, Lemon Squeezy, FastSpring), the **MoR** is the legal seller and handles all EU VAT — OSS is irrelevant for those sales. OSS becomes relevant only if you also sell direct (without MoR), e.g., via your own Stripe integration to EU consumers.

For BG founders fully on a MoR: skip OSS, focus only on Article 97a (foreign-supplier VAT, see `bg.md`).

For BG founders running direct B2C billing: register OSS in BG once cross-border sales exceed €10K/year.

Sources: [EU Commission OSS portal](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en), [Your Europe OSS guide](https://europa.eu/youreurope/business/taxation/vat/one-stop-shop/index_en.htm), [Norman.finance OSS 2026 guide](https://norman.finance/blog/one-stop-shop).

## Freedom of Establishment vs CFC — the cross-border incorporation trap

### The right (TFEU Article 49)

EU citizens may incorporate in any member state without restriction. A BG resident can legally form an Estonian OÜ, Irish Ltd, or Dutch BV.

### The trap (CFC rules)

EU member states (post-ATAD directive, 2019+) apply Controlled Foreign Company rules to attribute foreign-company profits back to the resident's home tax base when:

1. The resident controls >50% of the foreign company AND
2. The foreign company has insufficient "economic substance" in its incorporation country (no employees, no office, no local director, no real activity)

For solo SaaS founders without real local presence in the foreign jurisdiction, CFC rules typically **negate the tax advantage** of foreign incorporation.

### CFC rules by country (relevant to BG founders)

| Country | CFC scope | Applies to BG-resident founders? |
|---|---|---|
| Bulgaria | Catches passive income + low-substance setups | This is the home rule that prosecutes |
| Estonia | Taxes "non-genuine arrangements" — the OÜ shell test | Yes if BG founder controls + zero local substance |
| Ireland | Same — non-genuine arrangements | Yes |
| Netherlands | Only passive income from <9% jurisdictions | Less aggressive but still applies |

The ECJ Cadbury Schweppes doctrine (2006) protects "wholly artificial arrangements" defense — but the burden is on the founder to prove substance, and a single-person Estonia OÜ run from Sofia generally fails.

### Practical implication

Estonia OÜ via Xolo, Stripe Atlas Delaware LLC, Doola US LLC — all market themselves as tax-efficient. For a BG-resident solo founder, all three trigger CFC + double admin without delivering the headline tax savings. The math only works with genuine relocation or with real local hires.

Sources: [Tax Foundation CFC Rules in Europe](https://taxfoundation.org/data/all/eu/controlled-foreign-corporation-cfc-rules-europe-2021/), [Globalization Guide to CFC](https://globalisationguide.org/complete-guide-to-cfc-rules/), [Cadbury Schweppes case (Wikipedia)](https://en.wikipedia.org/wiki/Cadbury_Schweppes_plc_v_Commissioners_of_Inland_Revenue).

## Why Bulgaria stays optimal for solo SaaS founders

| Vehicle | Effective tax | Admin burden |
|---|---|---|
| BG свободна професия | 7.5% (after 25% deduction) | Low |
| BG EOOD retained-only | 10% corp | Medium |
| BG EOOD retained + distributed | 14.5% | Medium |
| Hungary KFT | ~22% combined | Medium |
| Estonia OÜ (with substance) | 0% retained / 22% distributed | Low (Xolo) but substance required |
| Estonia OÜ (without substance, BG resident) | BG-equivalent + admin overhead | Medium-high (CFC reporting) |
| Ireland Ltd | ~34% combined | High |

**Conclusion:** BG is already the lowest-tax EU jurisdiction. "Going Estonia" or "going US" delivers value only with real relocation or real foreign-presence justifying the substance test.

## EU grant programs accessible to BG entities

> The list below is the load-bearing reason to STAY incorporated in BG — these programs require an EU member-state legal entity, and BG entities are eligible across all of them.

### EIC Accelerator (European Innovation Council)

| Parameter | Value |
|---|---|
| Grant ceiling | €2.5M (grant-only) or up to €10M (grant + equity) |
| Equity dilution | 0% (grant-only option) |
| Cut-offs in 2026 | **6 per year** (changed from 3) |
| Success rate (overall) | ~5.9% |
| Success rate (jury stage) | ~50% |
| Best fit | Deep-tech, AI, digital innovation with EU-wide market potential |
| BG-resident eligible? | Yes (BG entity) |

Source: [EIC Accelerator 2026](https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en).

### EEA Grants / Norway Grants

Donor states (Norway, Iceland, Liechtenstein) fund Bulgaria + 14 other recipient countries in exchange for Single Market access.

| Parameter | Value |
|---|---|
| BG total allocation (2014-2021 cycle, implementing) | €210.1M |
| 2024-2029 cycle | Programmes contracted, calls opening gradually 2026-2027 |
| Typical grant for SME | €50K-200K (occasionally up to €1M) |
| Co-financing requirement | ~30% from applicant |
| **Required**: Donor partner | Norwegian / Icelandic / Liechtenstein company as project partner |
| Best entry point | Bilateral Fund travel grants (€5-15K) for matchmaking visits |

⚠️ **Realistic for solo SaaS:** NOT a year-1 fit. The donor-partner requirement is the real bar. Position EEA as year 2-3 after traction + a B2match event in Oslo.

Sources: [Norway Grants Bulgaria](https://www.eeagrants.bg/en/), [Innovation Norway BG SME page](https://eea.innovationnorway.com/article/bulgaria-business-development-innovation-and-smes), [Bilateral Fund news](https://www.eeagrants.bg/en/programs/bilateral-fund/news/bulgaria-norway-innovation-project).

### European Digital Innovation Hubs (EDIH)

Free / heavily subsidized "test-before-invest" services for SMEs implementing AI / digital transformation.

- Bulgaria has multiple operational EDIHs (Sofia, Plovdiv, Burgas, etc.)
- Service vouchers covering pilot integrations
- Direct application by BG SMEs
- No donor-partner requirement (unlike EEA)

Source: [European Startup and Scaleup Hubs pilot](https://eismea.ec.europa.eu/funding-opportunities/calls-proposals/european-startup-and-scaleup-hubs-pilot-horizon-eie-2026-02-connect-01_en).

### National Recovery & Resilience Plan (NRRP) — €6.6B for Bulgaria

EU-funded BG-administered. Digital transformation and SME digitalization tracks. Operated by the Bulgarian state but the money is EU-origin.

### OPIC / "Конкурентоспособност и иновации в предприятията" (PKIP)

EU Cohesion Fund driven, BG-operated. Innovation implementation in enterprises (procedure BG16RFPR001-1.003 etc.). More accessible than EEA — no foreign partner needed.

Source: [Програма BG16RFPR001-1.003](https://cibolabg.com/PKIP-proekti-inovazii-2023).

### Horizon Europe — Digital, Industry & Space cluster

~€15B cluster budget. Solo founders typically apply through consortia (other EU companies + research institutions). Hard for solo SaaS without coordinator support, but possible for thematically-aligned products.

## EU mobility tools for solo founders

| Tool | Purpose |
|---|---|
| SEPA | Single Euro Payments Area — instant EUR transfers across EU |
| Wise Business / Revolut Business / Paysera | Multi-currency EU business accounts, opened online, no national branch needed |
| Stripe (registered with BG entity) | Direct payment processing for EU + globally |
| EU Digital Identity Wallet (rolling out 2026-2027) | Single login for EU government services |
| eIDAS / KEP | BG qualified electronic signature accepted across all EU member states |

## When to incorporate outside Bulgaria

Genuine reasons (not tax arbitrage):

1. **Co-founders in another EU country** — incorporate where the operational center is
2. **Hiring local employees abroad** — payroll obligations follow the employee
3. **VC fundraising with Delaware preference** — Stripe Atlas / Clerky to flip into a US C-Corp
4. **Products requiring local regulatory licensing** (financial services, gambling, healthcare)
5. **Exit-targeting US acquirer** — late-stage flip via Stripe Atlas

If none of these apply: stay BG, save the money, run on the lowest-tax EU jurisdiction.

## Sources

- [EU Commission OSS](https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en)
- [Your Europe OSS guide](https://europa.eu/youreurope/business/taxation/vat/one-stop-shop/index_en.htm)
- [Norman.finance OSS 2026](https://norman.finance/blog/one-stop-shop)
- [Tax Foundation — CFC Rules in Europe](https://taxfoundation.org/data/all/eu/controlled-foreign-corporation-cfc-rules-europe-2021/)
- [EIC Accelerator 2026](https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en)
- [Norway Grants Bulgaria](https://www.eeagrants.bg/en/)
- [Innovation Norway BG SME page](https://eea.innovationnorway.com/article/bulgaria-business-development-innovation-and-smes)
- [European Startup Hubs pilot](https://eismea.ec.europa.eu/funding-opportunities/calls-proposals/european-startup-and-scaleup-hubs-pilot-horizon-eie-2026-02-connect-01_en)
- [Bulgaria Consultant Tax Guide — Innovires](https://innovires.com/tax-residency/blog/bulgaria-consultant-tax-guide.html)
- [Freedom of Establishment EU — Wikipedia](https://en.wikipedia.org/wiki/Freedom_of_Establishment_and_Freedom_to_Provide_Services_in_the_European_Union)
