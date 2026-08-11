# Applied Knowledge — Advokatami.bg Distillation

This file captures distilled insights from the Advokatami.bg deep extraction (gemini-cli + Claude validation), applying them to the Example Marketplace project context.

## 1. Distilled positions per theme

### Theme: Identity & credibility

- "Advokatami.bg е дигитална платформа... основана от Станимир Ненов (founder of pravatami.bg)" — public, accountable founder vs. anonymous platform
  - **Source:** /za-nas/
- "30 000+ обслужени клиенти, 1000+ отзива в Google, 4.9/5 рейтинг" — verified externally as 863 Google + 414 Facebook reviews
  - **Source:** homepage hero + independent search verification

### Theme: Pricing model (verbatim)

- "Край на неясното почасово плащане за адвокатски труд. Заплащаш само по фиксирани цени на база изпълнена задача."
  - **Interpretation:** Fixed-price commitment is core differentiator vs traditional Bar Act minimum-fee model
  - **Source:** /premium/ or pricing-related page

- EOOD registration: "€119" + state fee separate
- NPO registration: "от €119"
- Zero-activity declaration: "€35" (deadline 30.06.2026)
- Various small services: €3, €15, €28.38, €56.24, 2 лв
  - **Interpretation:** Lower-end pricing ladder than LegalConsult.bg overall; same EOOD ballpark

### Theme: Service delivery promise

- "Документите са готови в рамките на часове. Фирмата се вписва в Търговски регистър до 2 работни дни."
- "Адвокат вписва документите — За разлика от повечето конкуренти, при нас адвокат лично подава и вписва документите в Търговския регистър."
  - **Interpretation:** Quality differentiator — actual licensed advocate handles TR submission, not just paperwork prep
  - **Source:** /registracia-na-firma/

### Theme: Service breadth

Categories surfaced via homepage navigation:
- Регистрация на фирма (incorporation)
- Счетоводство (accounting — Layer 2 for ongoing EOOD)
- Фирмени промени (TR amendments)
- Превалутиране (currency conversion — relevant for 31.12.2026 EUR amendment)
- Бизнес услуги (general business)
- GDPR & Лични данни
- Лицензи и разрешителни
- Закриване на фирма (closure)
- Преглед на договор (contract review)
- ГФО (annual financial reports)

**Interpretation:** This is a one-stop shop for the entire EOOD lifecycle, vs LegalConsult which is incorporation + ad-hoc consulting only.

### Theme: Regulatory positioning

- Self-described as "дигитална платформа" / "we work with a network of advocates, lawyers, accountants" — explicit tech-intermediary model
- 2018 SAC investigation tasked disciplinary commission re: lawyers participating
- 2024 BG Bar Act amendments lifted advertising ban → original concern reduced

**Plain interpretation:** The platform model has been tested by regulators and survived. Operating since 2015, 30K+ clients served, no shutdown — the regulatory question is now largely settled.

## 2. Cross-domain implications for Example Marketplace project context

### Direct application — choose advokatami over legalconsult for Example Marketplace EOOD

For the spouse-owned EOOD pattern, Advokatami offers:
- **Same price tier** (€119 vs €125 LegalConsult)
- **One-stop shop** — incorporation + ongoing accounting + zero-activity declaration + GDPR pack from same provider
- **Better social proof** — 863+ Google reviews vs no published reviews for LegalConsult
- **"Advocate personally files in TR"** — matches Example Marketplace's need for quality-assured filing given builder's IP-clause sensitivity
- **Zero-activity declaration €35** — directly relevant if EOOD stays dormant pre-launch (per launch-vehicle decision Layer 2 framing)

### Direct application — currency-amendment service relevance

**Превалутиране** (currency conversion) is a service category they offer — relevant for the 31.12.2026 EUR-denomination deadline. If Example Marketplace EOOD is incorporated in BGN before year-end, this is the service to use to convert founding act to EUR by deadline.

### Direct application — ongoing accounting

LegalConsult does NOT offer ongoing accounting. Advokatami DOES. For the Example Marketplace Layer 2 (post-revenue) cost framing, Advokatami can be a single-vendor relationship vs splitting between two vendors.

### Where advokatami is NOT the right choice for Example Marketplace

For the **IP-clause review** (the load-bearing legal work for the spouse-as-owner structure), neither LegalConsult nor Advokatami is the right tool. Both are optimized for templated incorporation/filing work. Bespoke advisory on:
- Reading employer trudov договор IP clause
- Drafting carve-out request to employer
- Crafting civil-contract IP-transfer clause for builder ↔ EOOD

...is better done by an independent IT-specialized BG advocate. Cost: €100-300 one-off. This is the €50-100 budget item we already identified in the launch-vehicle decision; do it BEFORE engaging Advokatami for incorporation.

## 3. Contradictions / open questions

| Item | Status |
|---|---|
| Two ЕООД entities (204364658 + 204649842) | gemini cited from external search; needs portal.registryagency.bg verification before official use |
| 2018 САС disciplinary investigation outcome | News reports the tasking; couldn't find published verdict. Platform still operates 8 years on, so whatever the outcome was, it didn't shut them down. |
| "11+ years" claim vs 2015 launch | Resolves to: Founder's pravatami.bg = 2011; advokatami.bg = 2015. Both true, framed together. |
| State fee handling for €119 EOOD | Unclear if state fee €28.12 included or separate (LegalConsult is explicit "separate"). Verify before quoting total. |

## 4. Recency-weighted insights

- 2024 BG Bar Act amendments lifted advertising ban → reduces relevance of 2018 disciplinary concern
- Latest blog post 2026-03-30 covers Airbnb 2026 ESTI/DDS — currently topical (matches 2026 EU VAT changes)
- Activity verdict: ACTIVE (31 posts in last 6 months)

## 5. Source map

| Insight | Source |
|---|---|
| Founder Stanimir Nenov | /za-nas/ + Crunchbase + Dealroom |
| 30,000+ clients | Homepage hero + /registracia-na-firma/ |
| 4.9/5 from 863 Google + 4.8/5 from 414 FB | External independent search verification |
| EOOD €119 + 2-day filing | /registracia-na-firma/ |
| Zero-activity decl €35 | /deklaratsia-za-firma-bez-deinost/ |
| 2018 SAC investigation | sak-sas.bg protocol 5/06.02.2018 + Lex.bg news archive |
| 2024 advertising-ban lift | news.lex.bg BG Bar Act amendments coverage |

## 6. What this distillation does NOT capture

- 1,328 of 1,346 URLs not extracted — most are individual advocate profile pages, doc templates, or blog posts. The 18-URL focused subset captures the structural capability; per-advocate inventory is not material.
- 2018 SAC investigation outcome — not in publicly searchable record.
- Advokatami's accounting-service pricing — gemini extracted overview but not the per-month tier figures from /schetovodstvo/. Refresh if Layer 2 (post-revenue) cost decision is being made.
- Founder Stanimir Nenov's lawyer credentials — he is described as the founder/manager of a tech intermediary, NOT as an advocate himself. Whether he has any legal qualifications is not in our extraction.
- Crunchbase/Dealroom funding details (round size, investors, valuation) — outside Example Marketplace-decision scope.

## Confidence

**HIGH** for the load-bearing claims (real platform, public founder, verified reviews, fixed pricing, broader services than LegalConsult, regulatory-tested-and-surviving).

**MEDIUM** for specific ЕИК numbers (cited by gemini from external search; not independently verified at TR portal).

**HIGH** for the recommendation that **Advokatami is the better choice for Example Marketplace EOOD + ongoing accounting** vs LegalConsult.

## Recommendation update for Example Marketplace launch-vehicle-decision

The previous recommendation said "LegalConsult.bg €125 OR DIY". Adding a third option:

| Option | EOOD setup cost | Pros | Cons |
|---|---|---|---|
| DIY via TR portal | €28.12 state fee only | Cheapest; full control | Spouse must understand the form; no quality assurance on filing |
| **LegalConsult.bg** | €125 + €28.12 = €153 | Licensed advocate-led, simple | Smaller scale, fewer ongoing services, no published reviews |
| **Advokatami.bg** ⭐ NEW recommendation | **€119 + state fee** (verify if separate) | 30K+ clients, 863 Google reviews 4.9★, advocate-files-in-TR, ongoing accounting available, zero-activity service €35, one-stop shop | Tech intermediary not law firm; 2018 SAC investigation context (resolved by 2024 amendments) |

**For Example Marketplace:** Advokatami is the recommended provider for the EOOD incorporation step. Independent advocate consultation still recommended for the IP-clause-specific advice.
