# LegalConsult.bg — Service Catalog

Verbatim prices and service scope per URL on the prescope checklist. Source: gemini-cli extraction 2026-05-03.

## Mechanism

LegalConsult.bg routes paid service requests through their site to assigned licensed advocates. Each service has a fixed-price page or a contact form. Advocate-client contract forms directly between user and assigned advocate per `/общи-условия/` clauses 1-5.

## Analysis

### Services with verbatim on-page prices

| URL slug | Service | Price | State fee |
|---|---|---|---|
| /услуги/регистрация-на-фирми/ | EOOD/OOD/ET registration | 125 евро или 244,48 лв | 28,12 евро (55 лв) |
| /услуги/регистрация-на-фирми/ | AD registration | 500 евро или 977,92 лв | not specified |
| /услуги/регистрация-на-сдружения-и-фондации/ | NGO/Foundation reg | 93 лв | n/a |
| /услуги/регистрация-на-търговска-марка/ | Trademark BG | 450 лв без ДДС | 520 лв |
| /услуги/регистрация-на-търговска-марка/ | Trademark EU | 700 лв без ДДС | 1800 лв |
| /услуги/общи-условия/ (online store T&C template) | T&C documents pack | 26 лв (basic) | n/a |
| /услуги/прехвърляне-на-фирми-и-дружествени-дялове/ | Share transfer online | 180 евро | not specified |
| /услуги/създаване-на-еоод-оод-с-адвокат/ | EOOD/OOD with advocate | 125 € | 28,12 евро |

### Services without rigid pricing — verbatim price phrasing per page (deep extraction)

After deep-extraction pass (gemini-cli, 2026-05-03), all 11 service pages were extracted verbatim. Most use vague pricing ("ниска и достъпна цена" = "low and accessible price") with the actual quote provided after consultation. Several have concrete numbers:

| URL slug | Service | Verbatim price phrasing |
|---|---|---|
| /услуги/авторско-право/ | Copyright (publishing/IP contracts) | "ниска и достъпна цена" |
| /услуги/актове-кат/ | Traffic-act appeals | "ниска и достъпна цена", "Супер изгодни цени", "ИЗГОДНА ЦЕНА" |
| /услуги/изготвяне-на-договори-и-споразумения/ | Contract drafting | "ниска и достъпна цена", "СЪГЛАСНО ИНДИВИДУАЛНА ДОГОВОРКА С КЛИЕНТА", "ИЗГОДНА ЦЕНА" |
| /услуги/изключване-на-съдружник/ | Excluding a partner from company | "ниска и достъпна цена" |
| /услуги/регламента-за-личните-данни-gdpr/ | GDPR documentation pack | **"250 евро"** |
| /услуги/трудови-консултации/ | Labor law consultations | none on page |
| /услуги/консултация-недвижим-имот/ | Real estate consultation | **"500 евро"** |
| /услуги/обща-онлайн-консултация/ | General online consultation | "ниска и достъпна цена" |
| /услуги/откриване-на-аптека/ | Pharmacy registration | **"500 евро без ДДС"** |
| /услуги/развод-онлайн/ | Online mutual-consent divorce | **"250 евро"**, "пътните разходи за адвокат, чиято цена зависи от мястото на провеждане" |
| /услуги/фирмени-промени/ | Commercial registry changes | **"150 евро"**, "ниска и достъпна цена" |

**Key finding from deep extraction:** 5 services that prior shallow pass listed as "no price" actually DO have explicit prices (GDPR €250, real-estate consult €500, pharmacy €500 без ДДС, divorce €250, company changes €150).

### Service-page CTAs (consistent across all service pages)

- Primary: "ЗАЯВИ ОНЛАЙН" / "ЗАЯВИ ОНЛАЙН СЕГА"
- Phone: [redacted-phone]/ [redacted-phone]both formats appear)
- Email: contact-bd54cfdabb@example.invalid

### Three-step service flow (described on every service page, verbatim pattern)

1. **ЗАЯВИ ОНЛАЙН** — describe case + send documents + pay online at "ниска и достъпна цена"
2. **ПОДГОТВЯМЕ ДОКУМЕНТИТЕ** — competent expert reviews + contacts for clarifications + prepares deliverable
3. **ПОЛУЧАВАТЕ РЕЗУЛТАТА** — within promised timeframe

### Service delivery promise

- Timeline: "до 24 часа" (within 24 hours after document submission) per `/услуги/регистрация-на-фирми/`
- Free consultation: included with all paid packages
- VAT invoices: yes ("Да, издаваме фактури по ДДС на посочено от вас лице или фирма" per `/за-нас/`)

### What the €125 EOOD price actually covers (clarification, 2026-05-03)

The €125 / 244.48 BGN price for EOOD/OOD/ET registration is a **complete price for the legal entity to exist**. After payment + state fee €28.12, the company has:
- ЕИК (entity ID)
- Filed founding act
- Right to issue invoices and open bank accounts
- "Free consultation" call to discuss specifics

What €125 does **NOT** include (separate downstream services, not part of EOOD price):
- Ongoing accounting / monthly bookkeeping (LegalConsult does NOT offer this; hire standalone счетоводител)
- чл. 97а ЗДДС registration + monthly VAT filings (DIY through НАП portal, or separate paid service ~€30-50/mo)
- Annual ГДД (corporate tax declaration — €100-200/yr from any accountant)
- Marital property contracts / IP-clause reviews / structuring advice (these are "обща онлайн консултация" services billed separately ~€50-100)
- Migration of existing accounts (Dodo, banks, hosting, domains) to the new EOOD

This is standard for BG legal-services market — incorporation and ongoing accounting are separate purchases. Common confusion: assuming "€125 covers Year 1 admin." It doesn't; it covers the EOOD existing.

### Common downstream cost (informational)

For a Example Marketplace-style solo SaaS founder using LegalConsult.bg for EOOD:
- **Total to open EOOD:** €125 + €28.12 = **€153** (one-time)
- **If EOOD stays dormant:** ~€0 ongoing (annual zero-activity declaration only)
- **Once Example Marketplace generates activity:** ~€100-200/mo to a standalone accountant (NOT LegalConsult); ~€100-200/yr ГДД

### Pricing observations (Claude analysis pass)

1. **EOOD at €125** is below market for licensed advocate (typical €150-400). Likely high-volume / template-based work.
2. **Trademark prices show "без ДДС"** — implies the advocate handling that service charges VAT separately. Not all services explicitly say "без ДДС"; mixed pricing convention on site.
3. **Some prices arrived with HTML mashing** in extraction (e.g., `05 лв` should be `805 лв` or similar — the leading digit was truncated by gemini's content extraction). Flagging for re-fetch if precise number matters for Example Marketplace.
4. **No bundled package** for "EOOD + чл. 97а ЗДДС registration + first month accounting" — services priced individually.

## L4 pointers

- For Example Marketplace: see `references/knowledge/launch/jurisdictions/bg.md` § "Lower-cost online legal-services platforms"
- For trademark planning (year-2 calendar action): see `references/knowledge/launch/credit-programs/euipo-sme-fund.md` (EUIPO covers 75% of trademark fees if applied via SME Fund)
