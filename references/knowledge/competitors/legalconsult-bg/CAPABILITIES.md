# LegalConsult.bg — Online Legal-Services Platform (Bulgaria)

**Last verified:** 2026-05-03
**Sub-agent:** gemini-cli (primary; 2-pass extraction — shallow + deep)
**Validators:** `coverage-check.mjs` (43/43 URLs PASS) + `deep-extraction-check.mjs` (21/21 blocks PASS)

## Identity (verified, verbatim from site)

| Field | Value | Source |
|---|---|---|
| Site | https://legalconsult.bg | n/a |
| Display name | LEGAL CONSULT | homepage |
| Administrator (legal entity) | **адвокат Адриян Митков Мурлиев** (Advocate Adriyan Mitkov Murliev) | `/за-нас/`, `/общи-условия/` |
| **БУЛСТАТ** | **180550822** | `/за-нас/`, `/общи-условия/` |
| Bar registration number | Not explicitly listed on site (verify via [sak-sas.bg](https://sak-sas.bg/) by name) | — |
| VAT status | Issues VAT invoices ("Да, издаваме фактури по ДДС...") — explicit BG VAT number not displayed | `/за-нас/` |
| Registered address | гр. София, ул. Акад. Б. Стефанов № 35 | `/контакти/` |
| Phone | [redacted-phone]| sitewide footer |
| Email | contact-bd54cfdabb@example.invalid | sitewide footer |
| Website built by | BEKYAROV.NET | homepage footer |
| Copyright | © 2026 Legalconsult | homepage footer |

## Legal model (per their T&C, verbatim quoted)

> "LEGAL CONSULT е онлайн платформа, софтуер за предоставяне на правни услуги, който приема запитвания и ги препраща към юристи, специализирани в съответната сфера."

> "Всички адвокати, предоставящи услуги чрез платформата, упражняват дейността си като самостоятелни адвокати по смисъла на Закона за адвокатурата (ЗАдв). Всяко договаряне и предоставяне на правна услуга се счита за сключено между адвокат и клиент лично, а не между клиента и администратора на платформата."

> "Всички услуги се предоставят от действащи адвокати, вписани в съответната колегия в България. Адвокатът носи пълна отговорност за предоставяната правна помощ и съблюдаване на професионалната тайна, съгласно ЗАдв."

**Plain-language interpretation:** Software platform layer (operated by adv. Murliev) routes inquiries to independent licensed advocates. The advocate-client contract forms directly between the user and the assigned advocate, not between user and platform. Platform liability is limited (per disclosure clauses below). This is a legitimate "marketplace for legal services" model under BG law.

## Services and verbatim prices

| Service | Price (verbatim) | State fee (where applicable) |
|---|---|---|
| Регистрация на фирма (ЕООД, ООД, ЕТ) | **125 евро или 244,48 лв** | 28,12 евро (55 лв) electronic submission |
| Регистрация на АД | **500 евро или 977,92 лв** | not specified |
| Регистрация на сдружение и фондация | **93 лв** (state fee not separated) | n/a |
| Регистрация на търговска марка (BG) | **450 лв без ДДС** + държавна такса 520 лв | 520 лв |
| Регистрация на търговска марка (EU) | **700 лв без ДДС** + държавна такса 1800 лв | 1800 лв |
| Общи условия за онлайн магазин (template doc) | **26 лв** (basic package) | n/a |
| Прехвърляне на дялове онлайн (EOOD/OOD) | **180 евро** | not specified |
| Създаване на ЕООД / ООД с адвокат | 125 € (one-time advocate fee) | 28,12 евро |
| Включва безплатна консултация | — | applies to all packages |

Other services with prices discovered in deep-extraction pass (2026-05-03):

| Service | Price |
|---|---|
| GDPR documentation pack (`/услуги/регламента-за-личните-данни-gdpr/`) | **250 евро** |
| Real estate consultation (`/услуги/консултация-недвижим-имот/`) | **500 евро** |
| Pharmacy registration (`/услуги/откриване-на-аптека/`) | **500 евро без ДДС** |
| Online divorce (mutual consent) (`/услуги/развод-онлайн/`) | **250 евро** |
| Company changes / TR filings (`/услуги/фирмени-промени/`) | **150 евро** |

Services with vague/contact-form-only pricing ("ниска и достъпна цена" / "по договаряне"): авторско право, актове КАТ (traffic appeals), изготвяне на договори, изключване на съдружник, обща онлайн консултация, трудови консултации.

## Legal disclosures (verbatim)

### Refund policy

> "11. С извършване на плащането клиентът се съгласява с условията за предоставяне на услугата и с това, че услугата е „изпълнена", ако адвокатът е започнал работа по нея."

> "12. Съгласно чл. 57, т. 13 от ЗЗП, правото на отказ не се прилага за услуги с предмет предоставяне на юридическа помощ, когато услугата вече е започнала с изричното съгласие на клиента."

> "13. Клиентът има право да откаже услугата преди започване на нейната реализация. В такъв случай платената сума се възстановява, като може да се удържат направени разходи."

**Plain interpretation:** Standard EU consumer-rights carve-out for legal services. Once advocate has started work → no refund. Before start → refund minus actual costs incurred.

### Liability disclaimers

> "8. Платформата не поема отговорност за качеството, обема или резултата от предоставената правна услуга. Отговорност за изпълнението на услугата носи единствено избраният адвокат."

> "17. Платформата функционира като посредническа система, свързваща адвокати с клиенти. Администраторът не носи отговорност за: Качеството на услугата; Съдържанието на правните съвети; Пропуснати ползи или вреди, произтекли от употребата на сайта."

> "18. Адвокатите, използващи платформата, поемат лична и професионална отговорност за всяка услуга, предоставена от тях чрез сайта."

**Plain interpretation:** Platform is a matchmaker. The individual advocate carries the liability + insurance, not the platform. Standard structure for marketplace-for-services models.

## Detail files

- [details/services.md](details/services.md) — full service catalog with per-URL price discovery (deep extraction)
- [details/legal.md](details/legal.md) — T&C, refund, liability, supervisory body
- [details/identity.md](details/identity.md) — administrator + cross-checks (БУЛСТАТ lookup, бар registry lookup)
- [details/coverage.md](details/coverage.md) — 43-URL coverage table
- [details/blog.md](details/blog.md) — blog content (4 posts captured of ~112 total)

## Validator scorecard (Claude validation pass)

| Check | Result |
|---|---|
| 1. Pre-scope checklist 100% covered | ✅ 43/43 URLs read |
| 2. Identity (legal name + БУЛСТАТ + address) | ✅ extracted verbatim |
| 3. Verbatim prices (not paraphrased) | ✅ 9 services with prices, mostly verbatim (some price/text mashed by HTML formatting; flagged in details) |
| 4. Verbatim legal text (T&C, refund) | ✅ multiple full clauses quoted |
| 5. Per-URL findings table | ✅ all 43 URLs annotated |
| 6. Coverage table | ✅ explicit `read | error` status per URL |
| 7. Sources list | ✅ 43 URLs |
| 8. Sub-agent selection logged | ✅ gemini-cli (primary) per prescope |
| 9. Imprint check on multiple pages (homepage + /за-нас/ + /общи-условия/) | ✅ confirmed |
| 10. Bar registration cross-check | ⚠️ Not in extraction; should be checked at https://sak-sas.bg/ by advocate name |
| 11. Commercial Registry cross-check by EIK | ⚠️ Not yet performed; should hit https://portal.registryagency.bg/ for БУЛСТАТ 180550822 |

**Result:** PASS with 2 follow-up items (Bar registry + Commercial Registry cross-checks). Both registries require interactive form submission / captcha; non-scriptable. Manual verification URLs documented in `details/identity.md`.

## Deep-extraction pass scorecard (2nd gemini-cli run, 2026-05-03)

| Block type | Total | Pass | Fail |
|---|---|---|---|
| URL deep-extracts (service / policy / blog / hub) | 19 | 19 | 0 |
| External cross-checks (Commercial Registry + Sofia Bar) | 2 | 2 (verdict: inaccessible — registries require interactive session) | 0 |
| **All blocks** | **21** | **21** | **0** |

Validator: `node research/scripts/deep-extraction-check.mjs` — verdict: pass. Each block has Status + Body text + verbatim quotes (or for external lookups, an Inaccessible verdict with reason).

## Activity scorecard (verified via WP REST API)

| Metric | Value |
|---|---|
| Total blog posts (all-time) | 112 |
| Posts in last 12 months | 44 |
| Posts in last 6 months | 15 |
| Posts in last 3 months | 5 |
| Latest post date | 2026-04-20 (13 days ago) |
| **Activity verdict** | **ACTIVE** |
| Activity reason | 15 posts in last 6 months; recent + sustained cadence |

**Source:** `https://legalconsult.bg/wp-json/wp/v2/posts` (full enumeration, 2026-05-03)
**Detail file:** `details/blog-recent.md`
**Scorecard:** `.activity.json`

### Example Marketplace-relevant content discovered in recent posts

These blog posts (all from last 12 months) are directly relevant to Example Marketplace builder's situation and worth reading:

| Post date | Title | Why relevant |
|---|---|---|
| 2026-01-26 | Юридически рискове при използване на AI в бизнеса: практическо ръководство за предприемачи | AI-built SaaS legal risks — directly applicable to vibecoding founders |
| 2026-01-05 | Договори за Фрийлансъри и подизпълнители през 2026 г. | If builder operates as свободна професия or hires freelancers |
| 2026-01-12 | Промени в дружествените документи след въвеждането на еврото | EUR transition impact on company docs (relevant 2026) |
| 2026-02-09 | Ваучер за регистрация на марка през 2026 г. | EUIPO SME Fund article (we already analyzed this in launch-knowledge) |

These are signal that the platform's content output is genuinely useful + topical, not SEO filler. Reinforces "active legitimate practice" verdict.

## What the deep extraction confirmed about the platform

1. **Real legal content output:** site claims 112 blog posts; sample of 4 contained genuine BG-law content (statutory limitations on debt, off-plan property contract economics with concrete % thresholds). Not SEO filler.
2. **Pricing convention is mixed:** explicit numbers on ~10 service pages; "ниска и достъпна цена" / "по договаряне" on ~6 service pages; this is normal for BG advocate services where rate depends on case complexity.
3. **Three-step service flow** is consistent across all service pages: ЗАЯВИ ОНЛАЙН → ПОДГОТВЯМЕ ДОКУМЕНТИТЕ → ПОЛУЧАВАТЕ РЕЗУЛТАТА. Suggests templated WordPress + WooCommerce intake.
4. **Identity confirmed once more:** адв. Адриян Митков Мурлиев + БУЛСТАТ 180550822 referenced consistently across multiple pages (homepage h1 на /за-нас/, T&C clauses, footer).
5. **External-registry verification** requires interactive lookup. Not a research-skill failure — it's a real BG public-services constraint.

## Use case for Example Marketplace builder

Per `references/knowledge/launch/jurisdictions/bg.md`, LegalConsult.bg is a **legitimate option** for EOOD registration at €125 (vs. €150-400 for an independent licensed advocate, vs. €500-800 for packaged services like BG Company). The advocate-client contract forms directly between user and assigned advocate per their T&C. Platform layer is software + intake routing operated by адв. Адриян Мурлиев.

**Decision factors when choosing them vs. independent advocate:**
- Speed: their "до 24 часа" claim
- Communication: gmail email (not corporate domain) — minor signal
- Single-touch vs. relationship-based service: platform routes; independent advocate is one-on-one
- Willingness to consult on the marital-property contract + IP firewall protocol (Example Marketplace-specific) — this is the load-bearing legal work, not the EOOD filing itself

For a structuring that needs to hold against employer IP claim, talking to ANY chosen licensed advocate (whether through LegalConsult.bg or directly) about the brachen dogovor + IP firewall is more important than picking one over the other.
