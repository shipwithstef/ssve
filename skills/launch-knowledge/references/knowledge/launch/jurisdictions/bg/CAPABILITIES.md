# Bulgaria — Launch Jurisdiction Knowledge

**Layer:** 2 (capability summary)
**Domain:** `launch/jurisdictions/bg`
**Last updated:** 2026-05-08
**Coverage scope:** EOOD incorporation, KID codes, ZDDS (VAT) under 2026 amendments, place-of-supply rules, NAP research tools.

---

## What this domain covers

This domain captures the operational and legal layer for incorporating and operating a Bulgarian limited liability company (ЕООД), with a focus on software / SaaS / AI-product companies that:
- Sell internationally via Merchant-of-Record providers (Dodo, Paddle, Lemon Squeezy)
- Use foreign cloud/AI vendors (OpenAI, Vercel, AWS, Base44, Cloudflare)
- May ship multiple products under one umbrella entity
- Need both Bulgarian compliance and EU/non-EU sales handling

## Key capabilities surfaced

### Incorporation

- **Form-field strategy** for Advokatami (and equivalent platforms) — see `details/eood-incorporation-playbook.md`
- **Custom предмет на дейност paragraph** including AI/ML/automation explicit phrasing
- **Brand-neutral name strategy** for portfolio EOODs
- **Cyrillic transliteration conventions** for international software companies
- **Cost expectations** — ~€165 all-in for registration package (€119 service + €28.38 state + ~€18 notary/bank)

### KID-2025 economic activity codes

- **Primary code for software EOODs:** 62.10 Компютърно програмиране — see `details/kid-codes.md`
- **Old KID-2008 codes superseded:** 6201 → 62.10, 6202 → 62.20, 6209 → 62.90, 6311 → 63.10, 6312 → 63.91 / 63.92
- **One KID per company** at registration (BG TR rule)
- Real precedent: BG SaaS companies (adesso, Inplay, Pwrteams) all registered under 6201/62.10

### VAT — ZDDS 2026 SME regime

Effective **2026-01-01** — see `details/vat-2026-sme-regime.md`

- **Domestic SME (чл. 168д):** 51,130 EUR threshold, automatic application
- **EU SME (чл. 168е):** 100,000 EUR aggregate threshold, "-EX" number, quarterly reports
- **CRITICAL:** New чл. 97а ал. 6 exempts ал. 2 (outbound) but NOT ал. 1 (inbound services from foreign vendors)
- Implication: any BG software EOOD using OpenAI/Vercel/etc. needs чл. 97а ал. 1 from day 1 regardless of SME status
- Incompatibilities: SME ↔ IOSS forbidden; SME ↔ OSS in same country forbidden

### VAT — Place of supply rules (чл. 21 ЗДДС)

See `details/place-of-supply-services.md`

- **B2B (чл. 21 ал. 2):** Place = recipient's establishment → reverse charge for EU recipients, no EU VAT for non-EU recipients
- **B2C (чл. 21 ал. 6):** Place = consumer's location for electronic services with €10K threshold
- **2026 NEW (чл. 21 ал. 12 & 13):** Virtual events split — live/real-time vs pre-recorded automated
- **MoR scenario (e.g., Dodo Payments outside EU):** Treated as B2B export to non-EU → zero-rated under чл. 21 ал. 2; cleanest VAT setup; no OSS/SME needed for outbound

### Email architecture for portfolio EOODs

See `details/email-architecture.md`

Three-layer model:
1. **Personal mailbox** (Gmail/etc.) — where mail actually lives + 2FA anchor
2. **EOOD-level domain** (e.g., `contact-38b761d817@example.invalid`) — for bank, NRA, lawyer, accountant, subscription billing, B2B contracts
3. **Per-product domain** (e.g., `contact-b77c948115@example.invalid`) — for customer support, product-specific work, app stores

All Layer 2 + Layer 3 addresses forward to Layer 1 mailbox via Cloudflare Email Routing (free). Outbound via Gmail "Send mail as" (free).

Cost: ~€12/yr per domain registration. No mailbox hosting needed unless scaling beyond solo founder.

Critical: don't use product domain (Layer 3) for legal entity correspondence (Layer 2). If product gets sold, EOOD's bank/NRA correspondence breaks.

### Personal vs business AI/dev subscriptions

See `details/personal-vs-business-subscriptions.md`

For single-person EOODs: personal-tier plans (Cursor Pro, GitHub Copilot Individual, ChatGPT Plus, Claude Pro) are acceptable for founder's own dev work. The line is "what the tool is doing":
- **Tool helps the founder** → personal tier OK
- **Tool powers multi-user product features** → API on commercial terms required (Claude Pro ToS explicitly forbids "powering multi-user services")

For tax deductibility: invoice must show EOOD legal name + ЕИК + VAT number; account email can stay personal. Migration when ЕИК lands is mostly billing-detail edits (5 min per subscription), not account migrations.

Critical for AI-using SaaS products: founder's Claude Pro / ChatGPT Plus stays for dev; production AI calls use separate Anthropic API / OpenAI API accounts under EOOD billing.

### Research tooling

See `details/nap-ai-opinions-module.md`

- **kik-info NAP opinions module:** AI-summarized search of NAP opinions since 2010; free during launch period, then €100/year subscription
- Useful intermediate research layer between framework knowledge and paid lawyer/accountant consultations

---

## Decision matrix for new BG software EOODs

| Decision | Default answer | Override conditions |
|---|---|---|
| Type of legal vehicle | ЕООД (single-owner Ltd.) | OOD if multiple founders from start; ET if true freelancer single-product |
| Primary KID code | 62.10 Компютърно програмиране | 62.20 if consulting hours majority revenue |
| Founding act capital currency | EUR from day 1 | None — mandatory post-2026-01-01 EUR adoption |
| Predmet text approach | Custom paragraph (собствен предмет) | Готов класификатор only for genuinely single-product EOODs |
| Owner identity | Founder OR spouse-as-owner | Spouse pattern when founder has trudov договор IP clause exposure |
| First чл. 97а registration | At first foreign vendor invoice (likely day 1 of dev) | Defer only if EOOD is truly dormant with zero foreign vendor invoices |
| SME regime | Skip if Dodo MoR is the only sales channel | Adopt SME if direct B2C EU sales channel is added |
| GDPR pack purchase | Defer to before public signup goes live | DIY templates suffice pre-launch; €200 BG-licensed pack post-customer |
| Trademark filing | Defer to 2027-02-01 EUIPO SME Fund 2027 voucher window | Skip if product hasn't validated by then; refile when validated |

## When to escalate to paid consultation (€100 substantive)

Per Ненов's framing (Advokatami): the registration fee includes consultation about formation specifics. The €100 paid track is for substantive questions outside formation. Specifically warrant paid track:

1. **Exact чл. 97а ал. 1 registration timing** under 2026 SME interaction
2. **Dodo MoR VAT classification** — confirm Dodo entity's tax residency and chl. 21 zero-rate application
3. **AI/IP authorship under ЗАПСП** — does the EOOD own AI-assisted code cleanly
4. **SME regime applicability** for the specific channel mix
5. **ВКС Тълкувателно решение № 2/2001 г.** application to spouse-as-owner pattern (only if relevant)
6. **Брачен договор necessity** before incorporation (only if relevant)

Don't pay €100 for:
- Formation-specific questions (covered by included consultation)
- Name availability check (TR portal lookup, free)
- Predmet text drafting (covered by included consultation)
- Generic tax orientation (covered by NAP / kik-info free resources)

## Domain dependencies

- `launch/jurisdictions/bg/details/eood-incorporation-playbook.md` — operational playbook
- `launch/jurisdictions/bg/details/kid-codes.md` — KID classifier
- `launch/jurisdictions/bg/details/vat-2026-sme-regime.md` — SME regime mechanics
- `launch/jurisdictions/bg/details/place-of-supply-services.md` — place-of-supply rules
- `launch/jurisdictions/bg/details/nap-ai-opinions-module.md` — research tool

## Cross-domain pointers

- `launch/jurisdictions/eu-general.md` — OSS, IOSS, CFC rules, EU grants (when written)
- `launch/credit-programs/euipo-sme-fund.md` — trademark voucher (Feb 2027)
- `competitors/legalconsult-bg/CAPABILITIES.md` — alternative incorporation provider
- `competitors/b-trust-bg/CAPABILITIES.md` — KEP product matrix
