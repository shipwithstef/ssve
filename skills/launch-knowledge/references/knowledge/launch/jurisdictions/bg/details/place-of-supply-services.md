# BG VAT — Place of Supply of Services (чл. 21 ЗДДС)

**Layer:** 3 (detail)
**Topic:** Place-of-supply rules for services under ZDDS, including digital and electronic services
**Source:** `sources/2026-05-08-place-of-supply-services-kik-info.md`

---

## Mechanism

Bulgarian VAT (ZDDS) determines where a service is "deemed supplied" via чл. 21. The place-of-supply rule controls which jurisdiction's VAT applies (or none).

### Two foundational rules

| Rule | Article | Logic |
|---|---|---|
| B2B (recipient is taxable person) | чл. 21 ал. 2 | Place = where recipient is established |
| B2C (recipient is non-taxable consumer) | чл. 21 ал. 1 (general) / ал. 6 (electronic services) | Place = where supplier is established (general) OR where consumer resides (electronic services + 10K threshold) |

The pivot is recipient status. VAT-number validation per Регламент (ЕС) № 282/2011 чл. 18 establishes whether recipient is taxable (B2B) or not (B2C).

### €10,000 threshold (чл. 20б, since 2021-01-01)

For certain B2C cross-border supplies within the EU, the €10,000 annual threshold determines whether:
- Supplier's home country VAT applies (below threshold)
- Destination country VAT applies via OSS (above threshold)

### Electronic services special rule (чл. 21 ал. 6)

Defined as: digital content delivery, software licenses, automated online access. SaaS subscriptions clearly fall under this. For supplies to unregistered EU consumers, the supplier's place of establishment determines tax point — but with the €10K threshold + OSS / SME regime overlay.

### NEW 2026-01-01: Virtual events (чл. 21 ал. 12 & 13)

Splits virtual events into:
- **Live/real-time virtual access** — place determined by recipient location (B2C) or recipient establishment (B2B)
- **Pre-recorded automated content** — remains classified as electronic services per ал. 6

This new distinction matters for things like webinar platforms or live online courses. Pre-recorded course content stays under standard electronic-services rules.

---

## Analysis

### Application to Example Marketplace-style SaaS supplier in Bulgaria

| Customer scenario | Article | VAT outcome |
|---|---|---|
| EU business with VAT number (B2B) | чл. 21 ал. 2 | Reverse charge — supplier issues invoice with no VAT, recipient self-accounts in their country |
| EU consumer without VAT (B2C, low volume) | чл. 21 ал. 6 + €10K threshold | Below 10K aggregate → BG VAT (or none if SME); above → OSS at destination rates OR SME "-EX" |
| Non-EU business | чл. 21 ал. 2 | Place outside EU → no EU VAT applicable; zero-rated supply |
| Non-EU consumer | чл. 21 ал. 6 modified by non-EU rules | Place outside EU → no EU VAT applicable |
| MoR entity outside EU (e.g., Dodo Payments Singapore) | чл. 21 ал. 2 (B2B) | No BG VAT — Dodo is the legal seller-of-record to end-customers, handles their VAT in respective jurisdictions |

### What this confirms about the Dodo MoR setup

Diana's Example Marketplace EOOD invoices Dodo Payments' legal entity (non-EU). That's a B2B export of services to a non-EU recipient under чл. 21 ал. 2. Result:

- **Zero Bulgarian VAT charged** on the invoice
- **No OSS or SME registration needed** for outbound side IF Dodo is the only sales channel
- **Reverse charge** isn't even relevant since recipient is non-EU
- All end-customer VAT is Dodo's responsibility under MoR contract

This is the cleanest possible VAT setup. Confirms the gemini-cli stored research and validates the Dodo MoR strategy in `launch-vehicle-decision.md`.

### Caveats to verify with accountant

1. **Is Dodo's entity actually outside the EU?** Dodo Payments uses multiple legal entities. Verify which one issues your seller agreement. If it's a Dutch or Irish entity, the analysis changes (B2B intra-EU with reverse charge, but VIES reporting required).

2. **Are end-user data flows separate from invoice flows?** Even if Diana invoices a non-EU Dodo entity for VAT purposes, GDPR data flows might still touch EU end-customers, requiring Privacy Policy updates regardless.

3. **What about platform fees / subscription fees Dodo charges Diana?** Those flow IN as foreign-vendor invoices — triggers чл. 97а ал. 1 registration for Diana regardless of outbound zero-rating.

### Strategic implication for the consultation

The place-of-supply analysis is well-documented in BG accounting practice. Most accountants will confirm the Dodo MoR = zero-rate setup readily. But for the engagement-specific record, the €100 consultation should include explicit confirmation of:
- Which Dodo legal entity issues the seller agreement (governing place-of-supply)
- That zero-rating under чл. 21 ал. 2 applies to the EOOD's supply to that entity
- That no OSS / SME registration is required for outbound side under current channel mix

### When this analysis breaks

If Diana ever:
- Adds direct B2C EU sales (Stripe direct, Paddle direct without MoR) → SME or OSS becomes relevant
- Adds direct B2B EU sales above 10K → OSS / VIES reporting required
- Adds live virtual events / live online courses → new чл. 21 ал. 12 & 13 rules apply
- Switches MoR to an EU-domiciled entity → reverse charge B2B intra-EU, VIES reporting required

Each of those triggers a separate VAT analysis. The current Dodo-MoR-only setup is the simplest.

---

## L4 Pointers

- **NAP official place-of-supply guidance:** https://nra.bg/wps/portal/nra/taxes/dds-v-balgariya
- **EU VAT Directive 2006/112/EC** (place-of-supply rules in Articles 44-59c): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006L0112-20240101
- **Регламент (ЕС) № 282/2011 чл. 18** (recipient status validation): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02011R0282-20200101
- **VIES VAT number validator:** https://ec.europa.eu/taxation_customs/vies/
- **Dodo Payments MoR docs:** https://docs.dodopayments.com/developer-resources/merchant-of-record

For project-specific application:
- Diana's Example Marketplace case: see project-side `docs/specs/launch-vehicle-decision.md` Layer 2
- Sibling: SME regime details — `details/vat-2026-sme-regime.md`
