# Layer 1 — Raw Source Cache

**URL:** https://kik-info.com/novini/novini-i-akcenti/Myasto-na-izpalnenie-na-uslugi-po-ZDDS-Printsipi.206420.php
**Title (translated):** "Place of supply of services under ZDDS — Principles"
**Site:** kik-info.com
**Retrieved:** 2026-05-08T11:15:00Z
**Retrieval method:** WebFetch

## Verbatim extraction

### Foundational rules — чл. 21 ал. 1 & 2 ЗДДС

> "B2B (Business-to-Business): Place of supply is 'where the recipient is established'"
> "B2C (Business-to-Consumer): Place of supply is 'where the supplier is established'"

Recipient status (VAT-registered or not) determines which rule applies.

### Threshold — чл. 20б ЗДДС

Effective from 2021-01-01: **€10,000 annual threshold** for certain cross-border EU transactions.

### Electronic services — чл. 21 ал. 6 ЗДДС

Defines electronic services: digital content delivery, software licenses, automated online access. For supplies to unregistered EU consumers: supplier's place of establishment determines tax point (NOT consumer's location).

### Telecommunications + digital — special rules

References Регламент (ЕС) № 282/2011 чл. 18 for identifying recipient status — primarily through VAT number validation.

### NEW rules effective 2026-01-01 — чл. 21 ал. 12 & 13 ЗДДС

Distinguish virtual events:
- For VAT-registered recipients: place is recipient's establishment
- For unregistered recipients: place is recipient's location or habitual residence
- Applies ONLY to live/real-time virtual access; pre-recorded automated content remains classified as electronic services per ал. 6

### Scenario matrix for BG SaaS supplier

| Scenario | Rule | VAT treatment |
|---|---|---|
| EU business (B2B) | Art. 21 ал. 2 | Reverse charge — no Bulgarian VAT |
| EU consumer (B2C) | Art. 21 ал. 6 | VAT in consumer's member state |
| Non-EU business | Art. 21 ал. 2 | No EU VAT applicable |
| Non-EU consumer | Art. 21 ал. 6 | No EU VAT applicable |
| MoR entity (outside EU) | Art. 21 ал. 2 (B2B) | No Bulgarian VAT — reverse charge applies; MoR handles end-customer VAT in their jurisdiction |

### Reporting touchpoints

Place-of-supply determination affects:
- Invoice content (VAT line treatment)
- Daily sales journal entries
- VAT return declarations (VIES for intra-EU B2B)
- OSS / SME regime eligibility for supplies to unregistered EU consumers

## Provenance entry

```json
{"url":"https://kik-info.com/novini/novini-i-akcenti/Myasto-na-izpalnenie-na-uslugi-po-ZDDS-Printsipi.206420.php","retrieved_at":"2026-05-08T11:15:00Z","retrieval_method":"webfetch","extracted_into":["details/place-of-supply-services.md","CAPABILITIES.md"]}
```
