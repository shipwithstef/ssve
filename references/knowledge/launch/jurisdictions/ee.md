# Estonia — e-Residency + OÜ for Software Founders

Last verified: 2026-04-26. Sources: e-Residency.gov.ee + Estonian Tax & Customs Board (https://www.emta.ee/en).

## Overview

Estonia's e-Residency program lets non-resident founders form and run an Estonian OÜ (private limited company) entirely online. The OÜ is the standard Estonian SME vehicle. Combined with Estonia's distinctive **0% corporate tax on retained earnings** (tax only on distributions), it is a popular vehicle for digital-first solo and small-team founders who want EU presence without physical relocation.

## Key facts

| Item | Value | Notes |
|---|---|---|
| Setup cost | €265 (e-Residency state fee) + €190 (OÜ state fee) + ~€100/year (registered office + contact person) | Total first year: ~€700 |
| Annual admin | ~€500–1,500 (accounting service contracts, depending on volume) | Most providers bundle accounting + virtual office |
| Min share capital | €1 (since 2023 reform) | No minimum capital lockup |
| Corporate tax | **0% on retained earnings**; 22% on distributed profits (2026 rate) | Reinvest = no tax |
| VAT registration threshold | €40,000/year | EU OSS regime applies for B2C cross-border |
| Bank account | LHV Pank, Wise Business, Paysera, Revolut Business | Estonia local banks may decline non-EU founders; Wise/Paysera near-certain approval |

## e-Residency application

1. Apply online: https://www.e-resident.gov.ee/become-an-e-resident/
2. State fee: €100–120 + courier; collect digital-ID card at chosen pickup location (embassy abroad or PPA office in Estonia).
3. Lead time: 4–8 weeks.
4. The card is a digital-signature credential — it does NOT grant residency, citizenship, EU work rights, or visa-free travel. It is purely a digital-signature/auth credential.

## OÜ formation

1. Use a service provider (Xolo, Companio, 1Office, e-Residency Hub) — €150–500 setup + monthly subscription. Or DIY via the Estonian Business Registry portal (`https://ariregister.rik.ee/`) if you have e-Residency.
2. Choose a registered office (provided by service or rent virtual office) — €100–300/year.
3. Appoint a contact person (mandatory if board has no Estonian resident) — €50–200/year.
4. Submit articles of association + name + capital — €190 state fee + ~€50 notary if required.
5. Receive registry code + can start invoicing within 1–3 working days.

## Taxation summary (the 0% retained-earnings angle)

Estonia's tax model is **distribution-based**:

- Corporate income earned and **kept in the company**: **0% tax**. Reinvest in equipment, software, salaries, marketing — no corporate tax due.
- Corporate income **distributed as dividends**: **22% tax** (2026 rate; was 20% pre-2025).
- Salary paid to founder/employees: **taxed as personal income** — Estonia's 22% flat income tax + social tax (33% on gross). Estonian residents only — non-resident founders take dividends, not salary.
- VAT on services to EU B2B: reverse-charge, no Estonian VAT; B2C cross-border via OSS.

Source: Estonian Tax & Customs Board — https://www.emta.ee/en/business-client/income-expenses-supply-profits/corporate-income-tax

## Cross-border tax-residence implication (the key trap)

Forming an Estonian OÜ does **NOT change your personal tax residence**. If you are a BG / DE / NL / etc. tax resident:

- **Personal taxes** are still owed where you physically reside — Estonia does not become your tax home.
- The OÜ may be deemed to have a **permanent establishment** in your country of residence if management decisions are made there, triggering double tax.
- **CFC rules** in your home country may attribute the OÜ's undistributed profits to you personally, defeating the 0% corporate tax angle.
- Best fit: founders genuinely Estonia-resident, OR structuring with proper international tax counsel, OR using OÜ purely for EU-customer invoicing while keeping personal taxes onshore.

For a BG-resident founder: the Estonian OÜ is **NOT a clean Stripe Atlas alternative**. Same CFC trap as Delaware LLC. See `bg.md` (CFC subsection) and `us-de.md`.

## Stripe Atlas alternative angle

Estonian OÜ offers EU-domiciled equivalent of Stripe Atlas Delaware LLC:

| Dimension | Stripe Atlas (US Delaware LLC) | Estonian OÜ |
|---|---|---|
| Setup cost | $500 first year | ~€700 first year |
| Bank account | Mercury / Brex (US) | LHV / Wise / Paysera (EU) |
| Time to active | 5–10 business days | 4–8 weeks (e-Residency lead time dominates) |
| Stripe support | ✅ direct (US merchant) | ✅ Stripe Estonia |
| EU VAT ID | ❌ no (US entity) | ✅ |
| Best for non-US founders | If selling primarily to US customers | If selling primarily to EU customers |
| CFC trap for BG/DE/NL residents | YES | YES (same trap) |

**Decision rule:** Estonian OÜ wins on EU customers + EU bank account. Stripe Atlas wins on US customer base + faster timeline + better banking ecosystem.

## Common pitfalls

- **Believing e-Residency = residency.** It is not. No work visa, no tax residence change, no Schengen rights.
- **Believing 0% corporate tax = 0% total tax.** Personal-residence country still taxes you on dividends or attributed CFC income.
- **Underestimating service-provider fees.** Bundled offerings (Xolo, Companio) charge €60–200/month for accounting + compliance. Bare-bones DIY is possible but adds 4–8 hours/month of admin.
- **Bank account rejection.** Estonian banks (LHV, SEB, Swedbank) require physical visit + economic-link justification. Most non-resident founders end up on Wise or Paysera.

## Sources

- e-Residency: https://www.e-resident.gov.ee/
- Estonian Business Registry: https://ariregister.rik.ee/
- Estonian Tax & Customs Board (corporate tax): https://www.emta.ee/en/business-client/income-expenses-supply-profits/corporate-income-tax
- Service provider comparison (independent): https://www.e-resident.gov.ee/marketplace/
