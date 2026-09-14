# LegalConsult.bg — Identity & Cross-Checks

Source: gemini-cli extraction 2026-05-03 + Claude validation pass.

## Mechanism

The site's legal identity lives on `/за-нас/` and `/общи-условия/` pages, NOT on the homepage or `/контакти/` — a common pattern that broke earlier shallow research. Always probe multiple pages for imprint info.

## Analysis

### Verbatim identity statements

From `/за-нас/`:
> "LegalConsult.bg е модерна онлайн платформа за предоставяне на правни услуги в България. Администратор на платформата е адвокат Адриян Митков Мурлиев, с БУЛСТАТ 180550822."

> "Да, издаваме фактури по ДДС на посочено от вас лице или фирма."

From `/общи-условия/`:
> "Администратор на платформата е адвокат Адриян Митков Мурлиев, с БУЛСТАТ 180550822."

### Identity facts table

| Field | Value | Verified |
|---|---|---|
| Administrator (legal entity, свободна професия) | Адриян Митков Мурлиев | ✅ /за-нас/, /общи-условия/ |
| BG identifier | БУЛСТАТ 180550822 | ✅ /за-нас/, /общи-условия/ |
| Legal status | Licensed advocate (адвокат) per § 1 т. 29 ЗДДФЛ + ЗАдв | ✅ self-declared in T&C |
| Bar association | Most likely Софийска адвокатска колегия (Sofia office) | ⚠️ NOT explicitly declared; needs cross-check at sak-sas.bg |
| Bar registration number | Not on site | ⚠️ obtain via sak-sas.bg lookup |
| VAT registration | Issues VAT invoices; ДДС number not displayed | ⚠️ for full VAT verification: TR public lookup |
| Phone | [redacted-phone]| ✅ sitewide footer |
| Email | contact-bd54cfdabb@example.invalid | ✅ sitewide footer |
| Office address | гр. София, ул. Акад. Б. Стефанов № 35 | ✅ /контакти/ |
| Website | https://legalconsult.bg | n/a |
| Tech provider | BEKYAROV.NET | ✅ homepage footer |
| Site age | Active since at least 2022 (image asset URLs reference `/2022/04/` directory) | ✅ inferred |

### Recommended cross-checks

1. **Sofia Bar Association registry:**
   ```
   https://sak-sas.bg/
   Search: "Адриян Митков Мурлиев" or "Мурлиев"
   Expected: registration confirmed + Bar number
   ```

2. **Commercial Registry / БУЛСТАТ:**
   ```
   https://portal.registryagency.bg/CR/Reports/ActiveCondition.aspx?EIK=180550822
   Expected: registered as физическо лице — субект на БУЛСТАТ; profession; registration date
   ```

3. **VIES VAT lookup (if VAT number obtained):**
   ```
   https://ec.europa.eu/taxation_customs/vies/vatResponse.html
   Member State: Bulgaria; VAT: BG180550822 (likely same as БУЛСТАТ if VAT-registered)
   Expected: active or inactive VAT registration status
   ```

These cross-checks confirm the platform's identity claims are real and not asserted-only-on-website.

## Validation notes (Claude pass)

Earlier shallow extraction (this session, prior turn) incorrectly concluded "no advocate name, no Bar registration, no EIK" — based on examining only `/контакти/` page. Imprint actually present on `/за-нас/` and `/общи-условия/`. Bug in the website-prescope.mjs script (homepage-only imprint grep) was patched in same session to probe likely-imprint pages including those.

Lesson encoded into research skill (this session):
- `research/scripts/website-prescope.mjs` now probes `/общи-условия/`, `/за-нас/`, `/политика-за-поверителност/`, `/контакти/`, `/about/`, `/terms/`, `/privacy/`, `/imprint/` and any sitemap URL with legal/terms/about/policy in slug
- Validator added to enforce coverage check before declaring extraction complete

## L4 pointers

- BG advocate practice law: https://lex.bg/laws/ldoc/2135486731 (ЗАдв)
- Sofia Bar Association: https://sak-sas.bg/
- Commercial Registry portal: https://portal.registryagency.bg/
- VIES (EU VAT lookup): https://ec.europa.eu/taxation_customs/vies/
