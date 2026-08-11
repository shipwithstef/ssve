# B-Trust.bg — Bulgarian Qualified Trust Service Provider (QTSP)

**Last verified:** 2026-05-03
**Sub-agent:** gemini-cli (first pass complete + deep pass partial: 5 URLs fully extracted before timeout)
**Validators:** coverage-check (42/42 URLs read in first pass) + manually verified key product pages in deep pass

## Identity (from extraction)

| Field | Value | Confidence |
|---|---|---|
| Operator | **БОРИКА АД (BORICA AD)** | HIGH — sitewide footer |
| Brand | B-Trust | HIGH |
| EIK/BULSTAT | NOT on contact/about/homepage; per gemini extraction. Lookup at https://portal.registryagency.bg/ | MEDIUM — site claim insufficient; manual TR lookup needed |
| VAT | BG201230426 | ⚠️ FLAGGED — gemini noted "Assumed from typical BORICA details, need to verify". Treat as candidate, verify via VIES https://ec.europa.eu/taxation_customs/vies/ before official use |
| Address | гр. София 1612, бул. "Цар Борис III" №41 | HIGH — sitewide footer + /contacts |
| Phone | 0700 199 10, *9910 | HIGH — sitewide footer |
| Email | contact-2e5c9b5043@example.invalid, contact-4215f22481@example.invalid | HIGH |
| Footer | "Всички права запазени. БОРИКА АД" sitewide | HIGH |
| Regulator | Комисия за регулиране на съобщенията (КРС) | HIGH — per /electronic-signatures and T&C |
| EU compliance | Regulation (EU) No 910/2014 (eIDAS) — Qualified Trust Service Provider | HIGH — declared compliance |
| Site | https://www.b-trust.bg | HIGH |

## What B-Trust IS

**Certification authority brand of Borica AD** — major BG financial-infrastructure company. They issue **Qualified Electronic Signatures (КЕП / QES)** under eIDAS, plus related qualified trust services.

**КЕП is the load-bearing identity primitive for BG digital life:**
- Required for online filing at НАП (taxes), TR portal (Commercial Registry), БУЛСТАТ registration
- Required for EOOD incorporation online
- Required for чл. 97а ЗДДС filings
- Required for almost any online interaction with BG state services
- Equivalent to handwritten signature under BG + EU law (per eIDAS)

## КЕП product matrix — verbatim prices (deep extraction confirmed 2026-05-03)

### Personal КЕП (физическо лице) — for individuals

| Variant | 1 year | 3 years | Hardware? | Source |
|---|---|---|---|---|
| **Personal Cloud КЕП** (no smart card) | **6.00 лв / 3.07 €** | **15.00 лв / 7.67 €** | ❌ no hardware | `/electronic-signatures/products/qualified-certificates/personal` |
| **Personal Hardware КЕП** | 27.00 лв / 13.81 € | 36.00 лв / 18.41 € | ✅ smart card + reader | same URL |

**Personal КЕП use cases (verbatim):**
> "С този подпис представлявате себе си като физическо лице. банкирате онлайн; подавате данъчни декларации в НАП; подавате документи във всички държавни и общински структури; подписвате електронна поща и файлове"

### Professional КЕП (юридическо лице / едноличен търговец / **свободна професия**) — for business

| Variant | 1 year | 3 years | Source |
|---|---|---|---|
| **Professional Cloud КЕП** | **50.40 лв / 25.77 €** | **132.30 лв / 67.64 €** | `/electronic-signatures/products/qualified-certificates/professional` |
| **Professional Hardware КЕП** | 71.40 лв / 36.50 € | 153.30 лв / 78.37 € | same URL |

**Professional КЕП use cases (verbatim):**
> "С този вид електронен подпис представлявате юридическо лице, едноличен търговец или ако изпълнявате свободна професия. банкирате онлайн: плащате ДДС, осигуровки, заплати и др.; подавате данъчни декларации в НАП; издавате електронни фактури; подавате документи: декларации, месечни справки, Интрастат и др.; преминавате към безхартиен документооборот и архив; комуникирате с всички държавни и общински структури; подписвате електронна поща и файлове."

### Cloud КЕП usage subscriptions (issuance is FREE)

> Verbatim from `/electronic-signatures/products/qualified-certificates/cloud`:
> "Издаването на Облачен КЕП е безплатно за потребителя, като се заплаща само използването му."

| Tier | Price | Includes |
|---|---|---|
| **Безплатен** | 0 лв | 3 signs/year, 3-year validity |
| **Икономичен** | 6.30 лв / 3.22 € | 7 signs per month |
| **Практичен** | 62.41 лв / 31.91 € | 100 signs per year |
| **Неограничен** | 10.80 лв / 5.52 € | unlimited per month |
| **Неограничен плюс** | 115.20 лв / 58.90 € | unlimited per year |

### Other certificates

| Certificate | 1 year | Use case |
|---|---|---|
| Quality Stamp (Електронен печат) | 71.37 лв / 36.49 € | Business official seals (chl 97a invoices etc.) |
| Personal Advanced Signature | 11.99 лв / 6.13 € | Lower legal force than QES |
| Professional Advanced Signature | 11.99 лв / 6.13 € | Same, business |
| Advanced Stamp | 36.01 лв / 18.41 € | Business advanced seal |
| PSD2 Certificates | (custom) | Open Banking compliance |

## Required documents (verbatim from extraction)

### For Personal КЕП
- Документ за самоличност на Титуляря (ID document of holder)
- Нотариално заверено пълномощно (notarized PoA — only if not picked up in person)
- Договор за удостоверителни услуги (Trust Services Contract — provided by B-Trust)
- Попълнена онлайн заявка (filled online application)

### For Professional КЕП (additional)
- Удостоверение за вписване в Търговския регистър (TR registration certificate — i.e., your EOOD's ЕИК)
- All Personal КЕП docs above

## Cloud КЕП — why it's the best choice for Example Marketplace builder

### Verbatim feature list (from `/electronic-signatures/cloud-certificates`)

> Удобство – изисква само двуфакторен механизъм за автентификация
> Лесен достъп и широка използваемост без ограничения
> Висока сигурност
> Ценова ефективност
> Ефективност на разходите
> Без инсталация на специфичен софтуер
> Централизирано съхранение и управление на ключове
> Възможност за управление, Незабавно спиране/прекратяване
> История и архив на използване

### Cloud vs Hardware comparison

| Friction | Hardware КЕП | Cloud КЕП |
|---|---|---|
| Smart card cost | ~25-50 лв | None |
| USB reader cost | ~30-50 лв | None |
| Driver installation | Required (Windows, sometimes Mac/Linux issues) | None — mobile app only |
| Loss / breakage | Card breaks → identity lost until reissue | Server-side, no card to lose |
| Portability | Forgot card → can't sign | Phone always with you |
| Personal annual price | ~14 € | **3 €** |
| Personal 3-year total | ~18 € | **8 €** |

### Modern signing flow

1. Free Cloud КЕП issuance via B-Trust Mobile app (instructions in app)
2. Web identification via My.B-Trust portal
3. Sign documents through B-Trust Remote Signing Platform OR DSS Verify

## Service catalog (from first-pass extraction)

| Category | Services |
|---|---|
| **Certificates** | Personal/Professional КЕП (cloud/hardware), Electronic Stamps, Advanced Signatures, PSD2, Specialized |
| **Cloud platform** | My B-Trust portal, Remote Signing Platform, B-Trust Mobile app |
| **Identity** | Electronic Identification, Web Identification |
| **Business** | Time Stamp Issue, DSS Verify (signature verification), e-Archive, Препоръчана поща (registered mail), B-Token, Software (developer SDK), Услуги за бизнеса |
| **Client services** | Signature Installation guides, System Requirements, Temporary Suspension |
| **Queries** | Cancelled signatures search, Certificate Search/Status, Certification Chains Installation, OCSP Status Check |

## Detail files

- [details/services.md](details/services.md) — full product catalog with verbatim prices
- [details/identity.md](details/identity.md) — Borica AD operator + eIDAS / КРС context
- [details/coverage.md](details/coverage.md) — 42-URL coverage table
- [details/required-docs.md](details/required-docs.md) — what you need to bring/upload
- [details/applied-knowledge.md](details/applied-knowledge.md) — distilled positions + Example Marketplace application

## Validator scorecard

| Check | Result |
|---|---|
| URL coverage 42/42 | ✅ first-pass extraction confirmed all read |
| Deep-extraction completeness | ⚠️ partial — 5/32 deep blocks before timeout (gemini stalled on external EU Trust List lookup). 5 critical product pages fully extracted. |
| Identity captured | ✅ Borica AD operator confirmed sitewide |
| Verbatim prices | ✅ 11 product variants quoted exactly (Cloud + Hardware split confirmed via deep pass) |
| Activity scorecard | ✅ `.activity-na` marker placed (CA service, no public blog — verdict appropriate) |
| Provenance | ✅ 42-URL .sources.jsonl |
| eIDAS / EU Trust List | ⚠️ Manual verification at https://eidas.ec.europa.eu/efda/tl-browser/ recommended. Borica AD QTSP status independently well-known via market position, not in dispute. |
| Hallucination flags | 1 — VAT BG201230426 marked "to verify" by gemini itself; needs VIES check |

## Key load-bearing facts (for Example Marketplace builder)

1. **Cloud КЕП exists and is dramatically cheaper than Hardware КЕП** (€3/year vs €14/year personal; €26/year vs €37/year professional)
2. **Cloud КЕП issuance is FREE** — you only pay for usage tier (Безплатен tier covers 3 signs/year)
3. **Builder needs Personal КЕП**, spouse (as EOOD owner) needs **Professional КЕП** for the EOOD's TR/НАП operations
4. **Combined cost**: Builder Personal Cloud 3yr (15 лв / 7.67 €) + Spouse Professional Cloud 3yr (132.30 лв / 67.64 €) = **~75 €** total for 3 years
5. **No hardware needed** — all done via B-Trust Mobile app on phones
