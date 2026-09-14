# Applied Knowledge — B-Trust.bg Distillation

This file captures the meaningful insights from B-Trust.bg's deep extraction pass (gemini-cli + Claude validation), applying them directly to the Example Marketplace project context.

## 1. Distilled positions per theme

### Theme: КЕП legal status (eIDAS / BG)

* "Облачният квалифициран електронен подпис (Облачен КЕП) B-Trust измества познатия квалифициран електронен подпис от смарт карта на отдалечена сървърна платформа, като запазва правната сила на квалифицирания електронен подпис, а именно еквивалентен на саморъчния."
  * **Interpretation:** Cloud КЕП has full legal equivalence to handwritten signature under Bulgarian + EU law. No legal disadvantage vs. hardware-based КЕП.
  * **Source:** `/electronic-signatures/products/qualified-certificates/cloud`

### Theme: Cloud КЕП cost structure

* "Издаването на Облачен КЕП е безплатно за потребителя, като се заплаща само използването му."
  * **Interpretation:** Cloud КЕП issuance is FREE; you pay per-signature volume tier. Low-frequency users (founders signing tax declarations a few times a year) effectively pay 0-3 € for the cert + 0-3 € usage subscription.
  * **Source:** `/electronic-signatures/products/qualified-certificates/cloud`

### Theme: Personal vs Professional КЕП

* "С този подпис представлявате себе си като физическо лице. банкирате онлайн; подавате данъчни декларации в НАП; подавате документи във всички държавни и общински структури."
  * **Interpretation:** Personal КЕП is sufficient for: personal banking, personal NAP filings, personal interactions with state. NOT sufficient for representing an EOOD or self-employed entity.
  * **Source:** `/electronic-signatures/products/qualified-certificates/personal`

* "С този вид електронен подпис представлявате юридическо лице, едноличен търговец или ако изпълнявате свободна професия. ... плащате ДДС, осигуровки, заплати и др.; ... издавате електронни фактури"
  * **Interpretation:** Professional КЕП is REQUIRED for: representing EOOD/ОOD/ET, чл. 97а ЗДДС VAT filings, payroll filings, electronic invoicing, business interactions with state.
  * **Source:** `/electronic-signatures/products/qualified-certificates/professional`

### Theme: Required documents for КЕП issuance

* Personal КЕП: ID + (PoA if not in person) + Trust Services Contract + online application
* Professional КЕП: above + Удостоверение за вписване в Търговския регистър (TR registration cert — i.e., the EOOD's ЕИК)

### Theme: Cloud КЕП feature advantages

* "Удобство – изисква само двуфакторен механизъм за автентификация" → 2FA only, no card
* "Без инсталация на специфичен софтуер" → no driver installation required
* "Централизирано съхранение и управление на ключове" → keys stored centrally
* "Незабавно спиране/прекратяване" → instant suspension / revocation possible

## 2. Cross-domain implications for Example Marketplace project context

### Application to builder + spouse setup

**Optimal КЕП config:**
- Builder (Stefan): Personal Cloud КЕП — 3 years = **15 лв / 7.67 €**. Used for personal NAP filings, personal banking, identifying himself when needed.
- Spouse (Example Marketplace EOOD owner): Professional Cloud КЕП — 3 years = **132.30 лв / 67.64 €**. Used for ALL EOOD operations: incorporation, TR filings, NAP corporate declarations, чл. 97а ЗДДС monthly, payroll, e-invoicing.
- **Combined 3-year cost: ~147.30 лв / 75.31 €**

**Sequencing matters:**
1. Spouse must FIRST get Personal Cloud КЕП (3.07 €/year) to identify herself for the EOOD incorporation
2. Once EOOD has ЕИК, spouse upgrades to Professional Cloud КЕП using the EOOD's TR certificate
3. Builder gets Personal Cloud КЕП independently for own personal needs

**Hardware NOT needed:**
- No smart cards to buy (€25-50 saved)
- No USB readers (€30-50 saved)
- No driver headaches (especially for Mac/Linux users)
- All operated via B-Trust Mobile app on smartphone

### Application to launch-knowledge skill (BG launch path)

The KEP cost previously framed as "your wife will need a КЕП" should be:
- **Cheap** (3-25€/year depending on personal/professional)
- **Mobile-only** (B-Trust Mobile app — no hardware procurement)
- **Gated by ID + (Professional only) TR registration certificate**

This means the previously-implied "go to a B-Trust office to get КЕП" friction is largely gone — it's a phone-app onboarding now.

## 3. Contradictions / open questions

| Item | Status |
|---|---|
| Personal КЕП price discrepancy first-pass vs deep-pass | ⚠️ First pass: 26.99 лв/year (only Hardware variant captured). Deep pass: 6 лв/year cloud OR 27 лв/year hardware. **Resolution:** site offers BOTH; deep pass surfaces the cheaper Cloud option that first pass missed. |
| EIK/BULSTAT of Borica AD | NOT on site (per gemini); needs lookup at https://portal.registryagency.bg/ — Borica AD is a major BG financial-infra company so easy to verify externally |
| VAT BG201230426 | ⚠️ Gemini flagged "Assumed... need to verify" — should be checked at https://ec.europa.eu/taxation_customs/vies/ before official use |
| External EU Trust List verification | Gemini stalled on this lookup → killed. Manual check at https://eidas.ec.europa.eu/efda/tl-browser/ recommended; not in dispute (Borica AD is well-known QTSP since eIDAS introduction) |

## 4. Recency-weighted insights

The site's product structure (extracted 2026-05-03) shows:
- Cloud КЕП product line is fully featured — it's not a beta or new offering, all 5 subscription tiers + free tier are live
- Mobile app (B-Trust Mobile) is the primary onboarding flow — confirms 2026 architecture
- EUR pricing displayed alongside BGN — reflects 2026 EUR transition. Prices were consistent in EUR equivalents (1 EUR ≈ 1.96 BGN per fixed exchange rate)

## 5. Source map

| Insight | Source URL |
|---|---|
| Personal Cloud КЕП price 6 лв/year | `/electronic-signatures/products/qualified-certificates/personal` |
| Professional Cloud КЕП price 50.40 лв/year | `/electronic-signatures/products/qualified-certificates/professional` |
| Cloud issuance free, pay-per-use | `/electronic-signatures/products/qualified-certificates/cloud` |
| Cloud feature advantages list | `/electronic-signatures/cloud-certificates` |
| Required docs lists | `/electronic-signatures/required-documents` (referenced from product pages) |
| Operator Borica AD identity | sitewide footer + `/contacts` |
| eIDAS compliance + КРС regulator | `/electronic-signatures` + T&C |

## 6. What this distillation does NOT capture

- **27/32 deep-extraction URLs** (categories B/C/D/E/F from prescope) — gemini stalled before completing. First-pass summary covers them; specifics (e.g., exact Time Stamp pricing, e-Archive details, B-Token specifications) need refresh if needed.
- **External EU Trust List verification** — gemini timeout. Manual check needed for full certainty.
- **Borica AD EIK** — site doesn't show; needs TR lookup.
- **Borica AD VIES VAT verification** — gemini flagged the captured number as "assumed". Needs VIES check.
- **Customer reviews / market reputation signals** — outside our prescope.
- **Competitor comparison** (StampIT, InfoNotary as alternative QTSPs) — would require separate research.

These are not load-bearing for the Example Marketplace builder's КЕП decision — they affect peripheral facts, not the core "Cloud КЕП is the right choice at €3-25/year" answer.

## Confidence

**HIGH** for the load-bearing claims (Cloud КЕП exists, is cheaper, is mobile-only, has full legal force, is the right path for Example Marketplace builder + spouse).
**MEDIUM** for verification facts (Borica AD EIK, exact VAT) — clearly flagged as "manual lookup needed".

## Application timing

When Example Marketplace builder reads this knowledge in the future and asks "do we need КЕП now?":

| Stage | КЕП needed? | Type | Cost |
|---|---|---|---|
| Pre-EOOD (now, exploring) | No (or Personal Cloud for Stefan only if signing personal docs) | Personal Cloud (optional) | 6 лв/yr |
| EOOD incorporation day | Spouse needs Personal Cloud КЕП for TR portal | Personal Cloud | 6 лв/yr |
| Post-incorporation | Spouse upgrades to Professional Cloud КЕП | Professional Cloud | 50.40 лв/yr |
| Active operations | Both keep their respective certs renewed | (already in place) | annual |

**3-year total cost projected: 75 €** (147.30 лв) for both spouses' КЕП needs.
