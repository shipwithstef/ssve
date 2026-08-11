# Bulgaria — Legal Vehicles for Software Founders

Last verified: 2026-05-03. Sources: НАП (https://nra.bg) + НОИ (https://nssi.bg) + practitioner accounts (Dmitry Frank). Some 2026 figures (max insurable income cap, VAT threshold) require annual gemini-cli refresh — flagged inline.

## Overview

Bulgaria offers four practical vehicles for software founders:

1. **Personal name + invoices** — for one-off contracts under ~5,000 BGN/year
2. **Свободна професия (free profession) under БУЛСТАТ** — registered freelancer; no separate legal entity; preferred for solo software founders earning <100K BGN/year
3. **EOOD (single-owner Ltd)** — separate legal person, single owner; required for liability isolation, B2B contracts requesting EU VAT ID, hiring employees
4. **OOD (multi-owner Ltd)** — same as EOOD with multiple owners; standard for co-founder teams

## Key facts

| Vehicle | Annual admin cost | SS floor | VAT trigger | Liability shield |
|---|---|---|---|---|
| Personal name | €0 | personal income tax only | none until 100K BGN/year | No |
| Свободна професия (БУЛСТАТ) | ~€200 (accountant optional) | yes — see cap math below | 100K BGN/year (mandatory) | No (personal liability for activity) |
| EOOD | ~€500–800 (accountant required) | management contract or self-insurance | 100K BGN/year (mandatory) | Yes (limited to capital) |
| OOD | ~€500–800 + €100/yr filings | per founder | 100K BGN/year (mandatory) | Yes |

## Свободна професия registration steps (БУЛСТАТ + NRA flow)

1. **Pick the activity** — register a single CPV-style activity code at the Bulgarian Registry Agency (`https://www.registryagency.bg/`). Software development falls under typical IT codes.
2. **Register БУЛСТАТ (Unified Identification Code)** — at any Registry Agency office. ~3 working days. Free of charge for free-profession registration.
3. **Notify NRA (НАП)** — file a declaration of self-employment within 7 days of activity start (`https://nra.bg/`). Specifies expected annual income tier (chooses social-security base from the brackets).
4. **Notify NSSI (НОИ)** — declare insurable income tier; minimum is the national minimum wage; maximum is the cap (see below). Health + pension contributions auto-calculate from chosen tier.
5. **Open a separate bank account** (recommended, not required) — many BG banks offer free сметка за свободна професия.
6. **File quarterly income tax (10% flat)** + **monthly social-security declarations** — accountant typically handles this for ~€100–200/year.

Reference: НАП guidance for свободна професия — https://nra.bg/page?id=464 (Bulgarian only).

## Max insurable income cap (2026)

> **VERIFY** — value is approximate; refresh via gemini-cli or check НОИ annual bulletin (`https://nssi.bg/`) before quoting in a binding plan.

- **2026 expected cap: ~4,130 BGN/month → ~49,560 BGN/year**
  - This was the 2025 cap (4,130 BGN/month per the Public Social Insurance Budget Act; 2026 typically tracks +5–10% via the annual budget law).
  - The cap is the ceiling on **insurable income** — i.e., the income on which social-security contributions are calculated. Income above the cap is taxed (10% flat) but does NOT incur additional social-security contributions.
- Source URL (annual budget act): https://nssi.bg/aboutbg/st/budget/budget-pso (search for "Закон за бюджета на ДОО").

## Dual-employment rules — the cap-saturation lever

This is the load-bearing math for builders who already have a primary BG W-2 (трудов договор):

### Case A: primary employment income ≥ max insurable cap
- Primary employer already pays SS contributions on the cap.
- Registering свободна професия adds **€0 net new social-security cost** — the cap is already saturated; secondary self-employed income contributes only 10% income tax.
- Effective marginal tax rate on freelance income: **10%** (income tax only).

### Case B: primary employment income < max insurable cap
- Primary employer pays SS on actual salary (below cap).
- Registering свободна професия adds **fixed annual SS contribution at the minimum insurable income tier** (~€1,600/year combined health + pension at minimum-wage tier).
- Plus 10% income tax on freelance income.
- Effective marginal tax rate on freelance income: **~10% + €1,600/year fixed**.

### Case C: no primary employment
- Self-employment SS at chosen insurable income tier (must be ≥ minimum wage).
- Full SS + 10% income tax on freelance income.

## VAT trigger — 100,000 BGN/year mandatory registration

- Registration is **mandatory** when 12-month rolling revenue exceeds 100,000 BGN (~€51,000).
- Once registered: charge 20% VAT on B2B-domestic and B2C-domestic; reverse-charge on B2B-EU; export to non-EU is zero-rated.
- Voluntary registration possible below threshold (useful if customers are EU B2B and want VAT ID).
- Source: ЗДДС (VAT Act) + НАП VAT guidance.
- > **VERIFY** — the 100K BGN threshold has been the standard for years but is occasionally proposed for adjustment in budget cycles. Confirm via НАП annual bulletin.

## Multi-app aggregation under one БУЛСТАТ

A single БУЛСТАТ registration covers **all freelance activities of the registered person**. Practical implications:

- Stefan can run N software apps under one БУЛСТАТ — no need for separate registrations per app.
- All revenue aggregates against the **single 100K BGN VAT threshold** — running 3 apps at 40K BGN each pushes total to 120K, triggering mandatory VAT registration.
- All revenue aggregates against personal income tax — same 10% flat applies.
- **Personal liability is NOT segmented across apps** — a customer dispute with App #1 can attach to revenue from App #3. For liability isolation, use EOOD per-app (or per-business-line, not per-product, in practice).

## When to upgrade to EOOD

Upgrade triggers (any one):

- First B2B customer demands an EU VAT ID + invoice from a registered legal entity (свободна професия registrations *can* get a VAT ID but some enterprise procurement systems reject non-EOOD/-OOD).
- Personal liability exposure becomes high (handling customer PII, payments, regulated industries).
- First co-founder joins (now you need OOD, not EOOD).
- Annual revenue > €30K AND want to reinvest in business expenses without personal-tax pass-through.
- Raising priced equity round (investors require a separate legal entity).

**Cost to incorporate EOOD — corrected framing (verified 2026-05-03):**

The EOOD setup cost is frequently miscommunicated as a single bundle. In reality it splits into three independent layers, each triggered separately:

| Layer | When triggered | Cost | DIY-able? |
|---|---|---|---|
| **1. EOOD legally exists** | One-time, at incorporation | **€125-800** (LegalConsult.bg €125 / Bulgarian.llc €500-800 / DIY through TR portal €0) + **€28.12 state fee** + 2 BGN min capital | Yes via TR portal with KEP, but advocate-prepared docs reduce error risk |
| **2. EOOD operates with activity** | Triggered by: first foreign-supplier invoice (Vercel/OpenAI/Dodo) → чл. 97а ЗДДС monthly filings; first revenue → annual ГДД; first manager salary → monthly payroll | **€100-200/mo accountant** + ~€100-200/yr ГДД one-off | Partially: чл. 97а DIY through НАП portal is realistic for tech founders |
| **3. Optional risk insurance** | Specific to fact pattern (e.g., employer-IP-clause founder) | **€200-400 marital property contract** + €50-200 IP-clause legal review | One-off, not recurring |

**Minimum cost to have an EOOD that exists:** €153 (LegalConsult.bg €125 + state €28.12). Company has ЕИК, can issue invoices, can open bank. **No monthly recurring cost if dormant** (zero revenue + zero foreign-supplier transactions).

**Ongoing accountant cost (€100-200/mo) is activity-triggered, not membership-based** — it kicks in when there are actual transactions to record/declare. Pre-launch software founders can keep an EOOD dormant for €153 total + an annual zero-activity ГДД.

**The €500-800 packaged setup options** (Bulgarian.llc, BG Company, Sofia Offices) bundle layer 1 with first-period accounting + virtual office + English support — useful for non-BG-resident founders or those who want one-stop. For BG-resident IT founders, €125 LegalConsult.bg + standalone accountant when activity triggers is more economical.

Min capital: **€1 as of 1 January 2026** (formerly 2 BGN — changed with EUR adoption per LegalConsult.bg /услуги/регистрация-на-фирми/, verified 2026-05-03 via playwright extraction).

### КЕП (Qualified Electronic Signature) — required for all online filings, costs €3-25/year

> Verified 2026-05-03 via deep extraction of b-trust.bg (Borica AD QTSP). See `references/knowledge/competitors/b-trust-bg/CAPABILITIES.md` for full product matrix.

КЕП is the load-bearing identity primitive for BG digital life. Required for: online filings at НАП, TR portal, БУЛСТАТ registration, EOOD incorporation, чл. 97а ЗДДС filings, electronic invoicing, payroll declarations.

**Modern path: Cloud КЕП (post-2024) — eliminates hardware friction**

| Vehicle | КЕП type needed | Annual cost | 3-year total | Hardware? |
|---|---|---|---|---|
| Personal use (банкиране, лична данъчна декларация) | Personal Cloud КЕП | **6.00 лв / 3.07 €** | **15.00 лв / 7.67 €** | ❌ mobile app only |
| EOOD / ET / свободна професия (NAP filings, TR, e-invoices, чл. 97а) | Professional Cloud КЕП | **50.40 лв / 25.77 €** | **132.30 лв / 67.64 €** | ❌ mobile app only |

**Cloud КЕП issuance is FREE; you only pay for usage tier** (Безплатен tier covers 3 signs/year — sufficient for most founders). Issued via B-Trust Mobile app on smartphone — no smart-card procurement, no USB readers, no driver installation.

**Hardware КЕП variant** still available (~14 €/year personal, ~37 €/year professional) but generally inferior since Cloud КЕП has full eIDAS legal equivalence to handwritten signature. Only choose hardware if mobile signing is operationally unworkable for your case.

**Required documents for КЕП:**
- Personal: ID + Trust Services Contract + online application (PoA only if not in person)
- Professional: above + Удостоверение за вписване в Търговския регистър (TR cert, i.e., your EOOD's ЕИК)

**Sequencing for spouse-as-EOOD-owner pattern:**
1. Spouse first gets Personal Cloud КЕП (3.07 €/year) to identify herself for EOOD incorporation
2. After EOOD has ЕИК, spouse upgrades to Professional Cloud КЕП using the TR certificate
3. Builder gets Personal Cloud КЕП independently for own personal filings

**Total КЕП cost for founder + operating-spouse/relative over 3 years:** ~75 € (~147 лв) — founder Personal + owner Professional, both Cloud.

**Provider:** Borica AD (B-Trust brand) is the primary Bulgarian QTSP, eIDAS-certified. Alternatives: StampIT, InfoNotary (not researched in depth — see b-trust knowledge for the verified primary option).

### EUR transition — 31.12.2026 deadline for founding-act amendment

> Verified 2026-05-03 via `references/knowledge/competitors/legalconsult-bg/details/applied-knowledge.md` § Recency-weighted insights, citing legalconsult.bg blog post 2026-01-12. Hard statutory deadline.

All Bulgarian commercial companies (ЕООД / ООД / АД) must amend their founding acts (учредителен акт) by **31 December 2026** to convert capital denominations from BGN to EUR (12-month grace period from EUR adoption on 1 January 2026).

If you incorporate an EOOD in 2026:
- Either denominate the founding act in EUR from day 1 (recommended for new incorporations)
- Or denominate in BGN, then file an amendment before 31.12.2026 converting capital to EUR
- Late amendment → administrative fines + potential dispute over share-capital validity

This applies to ANY EOOD incorporation in 2026. If EOOD is opened post-31.12.2026 deadline, the founding act must already be in EUR.

## Common pitfalls

- **Health insurance lapse** — if you stop being employed (e.g., quit W-2 to go freelance) and don't immediately register свободна професия SS contributions, you can lose continuous health insurance coverage. Bridge with personal voluntary contributions (~€60/month).
- **VAT registration timing** — agencies miss the 14-day deadline after crossing the 100K BGN threshold. Penalty: 500–10,000 BGN. Set a quarterly revenue check at 80K BGN/year run-rate.
- **Believing СС is "lost money"** — pension contributions accrue toward retirement; health contributions buy continuous coverage. Treat as a deferred benefit, not pure tax.
- **Stripe Atlas + BG residency** — forming a US LLC via Stripe Atlas while remaining BG tax-resident triggers **CFC (Controlled Foreign Company) rules** under Bulgarian tax law, plus US filing obligations. Without expensive structuring, this is a net-negative trade. See `us-de.md` for the full trap.
- **Bulgarian credit card rejection** by Google Cloud and Oracle Cloud KYC — use a traditional bank card (not Revolut/Wise virtual), match name exactly, no VPN during signup.

## Sources

- НАП (National Revenue Agency): https://nra.bg/
- НОИ (National Social Security Institute): https://nssi.bg/
- Registry Agency (БУЛСТАТ): https://www.registryagency.bg/
- ЗДДС (VAT Act, official Bulgarian): https://lex.bg/laws/ldoc/2135533201
- ВКС (Supreme Court of Cassation): https://vks.bg/ — case law on commercial law and family-property regimes
- ЗАПСП (Copyright Act): https://lex.bg/laws/ldoc/2133094145 — chl. 14 software-in-employment default
- Codex of Social Insurance (КСО): https://lex.bg/laws/ldoc/1597824512 — chl. 6 al. 11 multi-ground insurance cap
- Family Code (СК): https://lex.bg/laws/ldoc/2135637484 — chl. 21-32 marital property regimes

> Items flagged **VERIFY** above need annual gemini-cli refresh against the official source URL. The freshness validator (`validate-launch-knowledge-freshness.sh`) catches stale files.

---

## Чл. 97а ЗДДС — special VAT registration triggered before the 100K BGN general threshold

> Added 2026-05-03. Critical for any BG founder using foreign SaaS dependencies (Vercel, OpenAI, AWS, Stripe, Dodo, GitHub, Cloudflare paid tiers, etc.) — triggers from the FIRST euro, not at 100K BGN.

Bulgaria has TWO VAT registration regimes that operate in parallel:

| Regime | Trigger | Threshold | Effect |
|---|---|---|---|
| **General (Article 96)** | 12-month rolling revenue exceeds 100,000 BGN (~€51,130) | 100K BGN | Full VAT — charge 20% domestic, can reclaim input VAT |
| **Article 97a** | First receipt OR first provision of services to/from a foreign taxable person (EU OR third-country) | **No threshold — from the first euro** | Light VAT — self-charge via protocol Art. 117, file monthly declaration; CANNOT reclaim input VAT on general expenses |

### Article 97a — two limbs

**Ал. 1 (receiving services from foreign DTL):** Triggered when receiving services from any foreign supplier where place-of-performance is Bulgaria. Includes Vercel/AWS/Stripe/OpenAI/Dodo commissions/GitHub/Cloudflare paid plans/etc. Self-charge VAT via protocol Art. 117, claim and offset same period (net zero) but cannot reclaim VAT on general overhead.

**Ал. 2 (providing services to EU B2B):** Triggered when invoicing taxable persons in another EU member state. Reverse charge — recipient owes VAT in their country. File VIES declaration alongside.

### Practical implication for software founders

If your stack includes ANY foreign paid service (Vercel Pro, AWS, Cloudflare Workers paid, OpenAI API, any payment processor that takes commission) — **Art. 97a registration is mandatory before the first such transaction**, regardless of whether you're earning anything yet.

Registration deadline: **7 days BEFORE** the date the tax becomes chargeable (whichever is earlier of payment or invoice).

Once registered:
- Monthly VAT declaration (even if zero activity)
- VIES declaration when EU B2B counterparty
- Self-charge protocol on every foreign-supplier invoice
- Cannot reclaim input VAT on overheads (this is the Art. 97a "light" tradeoff)

Sources: [НАП — Регистрация по ЗДДС](https://nra.bg/wps/portal/nra/taxes/dds-v-balgariya/registratsiya-po-zdds), [Чл. 97а и еврото 2026](https://schetovoditelibg.com/chlen-97a-zdds-evro-2026/), [Монес чл. 97а guide](https://mones.bg/%D1%80%D0%B5%D0%B3%D0%B8%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F-%D0%BF%D0%BE-%D1%87%D0%BB-97%D0%B0-%D0%BE%D1%82-%D0%B7%D0%B4%D0%B4%D1%81/).

### Failure mode

Most BG IT freelancers miss this. NAP audit catches it later → backdated registration + interest + 500-10,000 BGN fines. Set Art. 97a registration as a Day-1 task BEFORE first foreign-paid SaaS subscription.

## Diploma alternatives for свободна професия registration

> Added 2026-05-03. Resolves common misconception that "no degree → no свободна професия".

§ 1 т. 29 ЗДДФЛ requires "documents proving competence in the profession". The law uses open-ended language: *"диплома, **сертификат или други**"*. БУЛСТАТ administrative practice accepts:

| Document | Acceptance strength |
|---|---|
| BSc/MSc diploma in the field | Strongest |
| Cloud cert (AWS/GCP/Azure), SoftUni completion certs, Coursera verifiable certs | Strong |
| Trudova knizhka (employment record book) showing N years on relevant positions | Medium-strong (official document with stamps) |
| Reference letters from previous employers on letterhead with stamp | Medium |
| Civil/freelance contracts evidencing prior professional work | Medium |
| GitHub portfolio, LinkedIn, public talks | Weak — БУЛСТАТ wants stamped documents |

**Vibecoding-era reality:** founders without formal IT diploma but with 5-10 years of IT employment can register as софтуерен инженер / консултант via combined evidence: trudova knizhka + reference letters + sample work contracts. БУЛСТАТ rarely refuses if the package is reasonable.

If NO professional evidence at all (no employment, no certs, no contracts) → свободна професия path is closed. Use **EOOD** instead — no qualification document required for incorporation.

## NKPD profession codes for software founders

> Added 2026-05-03. The БУЛСТАТ profession code is selected from Националната класификация на професиите и длъжностите (NKPD), maintained by НСИ. Common codes:

| NKPD | Title | Best for |
|---|---|---|
| **2512** | Разработчици на софтуер | Pure software development |
| **2511** | Системни анализатори | Mixed analysis + dev |
| **2519** | Разработчици на софтуер и анализатори, н.д. | Catch-all software |
| **2421** | Бизнес и административни анализатори | SaaS founder positioning as analyst |
| **2422** | Специалисти в политики и admin | Consultant-style positioning |
| **2434** | Специалисти продажби IT | Sales-IT mix |
| **2356** | Преподаватели по IT извън формалното обр. | IT trainer / educator |

Code is selected once at БУЛСТАТ registration. Can be changed later via amendment.

## Real practitioner reference — software engineer running свободна професия

[Dmitry Frank's account](https://dmitryfrank.com/articles/bulgaria_freelance_taxes) is the canonical practitioner reference. Verified facts:

- Software engineering accepted by НАП under "consulting" enumeration in § 1 т. 29
- БУЛСТАТ registration: 10 BGN fee, same-day, only translated diploma needed (~30-40 BGN translation)
- VAT-registered (Art. 97a) but reports zero net VAT for foreign-client consulting
- Quarterly tax payments mandatory, not annual-only
- Accountant quality varies dramatically — switched after first one over-bureaucratized
- SS cap binds at ~3,750-4,130 BGN/month (2025 figure)

This is the proof-of-existence case for the "10 years IT, no formal CS degree" path.

## Spouse-as-owner / relative-as-owner structure when employer IP clause restricts founder

> Updated 2026-05-03 with primary-source legal grounding (gemini-cli research). Earlier version overstated брачен договор as load-bearing; ВКС case law settles this differently.

### The doctrinal foundation (load-bearing)

**Тълкувателно решение № 2 от 27.12.2001 г. по гр. д. № 2/2001 г., ОСГК на ВКС** (binding interpretive decision):

> EOOD/OOD shares (`дружествени дялове`) are **personal property** (`лична собственост`) of the registered owner-spouse and are **NOT** part of the marital community property regime (СИО — `съпружеска имуществена общност`).

Implications:

1. The pathway "employer IP claim → husband owns part of EOOD via СИО → claim attaches" is **closed by primary law**. It does not need to be defended against contractually.
2. The non-owner spouse, on divorce, has only a **monetary claim** for contribution to share value (СК чл. 30) — never a claim on the shares or the EOOD's underlying assets.
3. EOOD's bank balance, IP rights, and operational assets belong to the legal entity, fully insulated from both spouses' personal estates.

This means the firewall is **architectural, not contractual.** Picking the spouse (or any non-employee relative) as owner already cuts the marital-regime attack path.

### The actual risk surface (often misframed)

The risk is NOT the employer reaching into the spouse-EOOD via marital regime. The risk is the EOOD **failing to acquire** IP it intends to commercialize, because of the BG default copyright rule:

**ЗАПСП чл. 14:**
> Авторското право върху компютърни програми и бази данни, създадени в рамките на трудово правоотношение, принадлежи на работодателя, освен ако не е уговорено друго.
> *(Copyright on software created in the course of employment belongs to the employer, unless otherwise agreed.)*

The pivot phrase is **"в рамките на трудово правоотношение"** — defined by the founder's official `длъжностна характеристика` (job description), not just the fact of employment.

Two factual scenarios:

| Founder's official role | Who owns code written during employment? | Required firewall |
|---|---|---|
| Software Engineer / Developer / Architect / Programmer | Employer owns ALL code, on or off hours, regardless of who pushes the commit | Spouse-EOOD doesn't fix it. Either negotiate a written side-project carve-out, OR wait until employment ends |
| Project Manager / Sales / Director / Account / Architect-without-coding-duties | **Founder personally owns the code** (his copyright by default). Employer has no claim. | Founder must transfer IP to EOOD via written civil contract with explicit `прехвърляне на имуществени авторски права` clause; otherwise EOOD operates code it doesn't own |

**Highest-leverage pre-incorporation check:** read the exact wording of `длъжностна характеристика`. €50–100 advocate consultation. Everything else is conditional on this.

### When the IP problem disappears entirely (greenfield case)

If the project is greenfield and:
- All existing repos are private (not public-disclosed)
- Founder is willing to delete current personal-account repos
- The new project is created from line 1 by the spouse/relative under a fresh GitHub identity, with no founder commits ever

Then **ЗАПСП чл. 14 has no factual hook** — there is no founder-authored software for the employer to claim title to. The IP-firewall problem collapses to: founder simply does not author commits going forward. No advocate, no transfer contract, no notary needed for the IP layer.

This is a common failure mode of generic advice that assumes legacy authorship. Greenfield + private + AI-assisted (vibe-coded) is increasingly the default for pre-launch SaaS, and it makes the IP firewall trivial.

### Брачен договор — secondary, not primary

A notarized marital property contract (`брачен договор`, ~€200-400 at Sofia notary) declaring future EOOD shares as the wife's separate property is:

- **NOT load-bearing** for the IP-firewall (the 2001 ВКС ruling already does this work)
- **Useful** if the founder wants to preempt the residual СК чл. 30 monetary-contribution claim on divorce
- **Optional** for vehicles where the operating spouse and founder are separate people

Recommend ONLY when the founder is risk-averse on the divorce-monetary-residual edge case. Don't sell it as the primary firewall.

### Choosing the owner: spouse vs other relative

Once doctrinal isolation is established, the choice of which non-founder relative owns the EOOD is driven by **operational ergonomics + cost**, not legal protection. See § "Pensioner-relative-as-owner cost optimization" below for the cost lever.

| Owner type | Legal isolation | Operational ease | Cost (working-age) | Cost (pensioner) |
|---|---|---|---|---|
| Spouse | High (ВКС 2001 + optional брачен договор) | Highest — spouse on-site, easy КЕП setup | €1,837/yr active | n/a until pension-age |
| Parent / parent-in-law / sibling (working-age) | Highest (no marital entanglement) | Variable — depends on availability + tech-fluency | €1,837/yr active | n/a |
| Parent / parent-in-law / sibling (pensioner) | Highest | Variable | n/a | **€529/yr active** |

The doctrinal protection is identical across all three. The €1,300/yr advantage of pensioner-relative ONLY materializes if the relative is already pension-age or drawing pension.

## Pensioner-relative-as-owner cost optimization

> Added 2026-05-03. The single largest social-insurance lever in the BG founder toolkit.

### Why pensioners are the cheap path

A self-insured person (СОЛ — `самоосигуряващо се лице`) who is **already drawing or eligible for pension** is exempt from the `Pensions` (ДОО + УПФ) contribution. They owe ONLY the health insurance contribution (ЗЗО, 8%) on the minimum insurable income.

| Owner profile (2026) | Monthly social insurance | Annual |
|---|---|---|
| Working-age СОЛ (any role: spouse, parent, sibling) | **299.41 BGN / €153.08** | **€1,837** |
| Pensioner-СОЛ (age, service, OR disability pension) | **86.16 BGN / €44.05** | **€529** |
| Anyone with a formally-filed activity-interruption (`прекратяване на дейност`) | **0** | **€0** until first transaction |

**Saving: €1,300/yr** by routing ownership through a pensioner relative instead of a working-age relative. Source: `praktika.bg` "Осигуряване на собственик и управител на дружество - пенсионер".

### 2026 thresholds (extended from 2025 budget)

| Parameter | BGN | EUR | Notes |
|---|---|---|---|
| Минимална работна заплата (МРЗ) | 1,213.00 | 620.20 | Floor for labor contracts |
| Минимален осигурителен доход (СОЛ) | **1,077.00** | **550.66** | The base for self-insured calculations |
| Максимален осигурителен доход | 4,130.00 | 2,111.64 | Ceiling on combined insurable income from all sources |
| ЗЗО rate (health) | 8.0% | — | Pensioners' only mandatory contribution |
| ДОО + УПФ rate (pension, post-1959 born) | 19.8% | — | Waived for pensioners |

Sources: `nra.bg/wps/portal/nra/actualno/srocove/osiguritelni-vnocki`, `nssi.bg`, `plusminus.com`. Refresh annually each January when the new budget law passes.

### Pension age 2026 (load-bearing for "is the relative eligible?")

| Year | Female pension age | Male pension age |
|---|---|---|
| 2026 | 62 years 2 months | 64 years 9 months |
| 2027 | 62 years 4 months | 64 years 10 months |
| ... rising 2 mo/yr until 65 | ... | ... |

A relative who is younger than these thresholds and is NOT drawing disability pension does NOT qualify for the pensioner-СОЛ rate. They pay the full €1,837/yr. **Source: NSSI pension reform calendar.**

### The "future move" pattern

When a younger relative is operationally preferred (e.g., spouse) but a pensioner relative is available later, the founder can:

1. Incorporate now under the operationally-preferred owner, accept the €1,837/yr cost OR keep dormant.
2. Calendar a re-evaluation for the year the pensioner-relative crosses pension age.
3. Transfer EOOD ownership at that point — between family members in lineal descent the transfer is ~€100 notary + 0% tax.
4. Capture the €1,300/yr from that year forward.

This is the recommended pattern when the founder's spouse is operationally easiest right now but is 5–10 years from pension age and a pensioner-relative will become eligible in the meantime.

### What does NOT happen with a pensioner owner

- Pensioner ownership does NOT alter dividend tax (5% flat for all individuals, no exemption per `taxmonkey.bg`).
- Pensioner ownership does NOT alter VAT obligations (чл. 97а ЗДДС triggers the same way).
- Pensioner ownership does NOT alter corporate tax (10% flat).
- Pensioner-СОЛ status does NOT carry over if the same person takes a labor contract elsewhere — they become primarily insured on the labor contract.

### Disqualifications

There are **none** based on age or pension status. Per Търговски закон чл. 141, the only disqualifications for an EOOD manager are personal bankruptcy and certain criminal convictions. Age, pension status, disability pension status, and lack of business experience do NOT disqualify. Source: `lawfirm.bg`.

## "Управител без възнаграждение" — loophole closed in 2026

> Added 2026-05-03. Common outdated advice that is no longer viable.

For years, BG founder forums advised the "manager without remuneration" pattern: declare that the EOOD manager performs management duties WITHOUT compensation, therefore owes no КСО/ЗЗО.

**This path is closed in 2026.** НАП practice (per `clubtrznormativi.bg`) is consistent: any management activity (signing documents, representing the company, banking, supplier contracts) constitutes labor activity. If performed without a formal `договор за управление и контрол` (ДУК), the manager is treated as a self-insured person (СОЛ) and owes minimum insurance from day one.

The only paths to €0 monthly social insurance are:

1. **Formally declare activity interruption** (`прекратяване на дейност`) at НАП — EOOD must be genuinely dormant; any transaction reverses this.
2. **Annual zero-activity declaration** (`нулева декларация`) at the Commercial Register for the prior year — proves the EOOD did not operate.

Both work for pre-launch / pre-revenue EOODs. Once the first invoice or transaction lands, the manager-СОЛ obligation engages immediately.

**Generalizable rule:** any "no remuneration → no insurance" advice for BG EOOD managers post-2023 is outdated. Verify against current `nra.bg` guidance before relying on it.

## Greenfield + private repos — IP firewall reduction

> Added 2026-05-03. The "greenfield case" insight.

The standard advice for spouse/relative-EOOD assumes the founder has historical authored code that needs a clean transfer to the EOOD. When this assumption fails — i.e., the founder is pre-launch, all repos are private, no public commits exist, and they're willing to delete current personal-account repos — the IP firewall problem collapses.

**The minimum viable greenfield setup:**

1. Founder deletes all relevant private repos under their personal GitHub/GitLab account (or transfers ownership to the spouse/relative; deletion is cleaner because it removes the audit trail entirely).
2. The future EOOD owner (spouse/relative) creates a fresh GitHub/GitLab account under their name + email + their own SSH key.
3. They create the new repository as a fresh repo. They are the first author from line 1.
4. The founder authors **zero commits** under their identity. Vibe-coding workflows (Claude Code / Cursor / similar) running under the spouse/relative's account satisfy this naturally — the AI-assisted commits are recorded under the operator's identity.
5. After EOOD incorporation, the repository is transferred to the EOOD's organization account.

This eliminates the historical-authorship attack surface entirely. No IP-transfer civil contract needed (there's nothing to transfer). No advocate IP-clause review needed for code that hasn't been written yet under the founder's identity.

**Caveat:** this applies only to first-mover-private-greenfield. If the founder has any public commits, blog posts, demos, or repo metadata showing they authored the project before the relative's account took over, ЗАПСП чл. 14 still has a hook. The clean reset works only if there's nothing public for the employer to point at.

## Decision-flow summary (BG IT founder under restrictive trudov договор)

```
Q1: Are repos private + greenfield + willing to delete and recreate?
  └ YES → IP firewall reduces to "operator must not be the founder under their identity"
  └ NO  → Need either:
          (a) advocate-reviewed длъжностна характеристика → if NON-CODING role, sign IP-transfer civil contract; or
          (b) wait for employment to end before structuring

Q2: Will the EOOD be active (revenue) immediately or dormant pre-launch?
  └ DORMANT → File activity-interruption; €0/mo until first transaction
  └ ACTIVE  → Owe €1,837/yr (working-age СОЛ) or €529/yr (pensioner СОЛ)

Q3: Is a pensioner relative available, willing, trusted, and tech-capable?
  └ YES → Save €1,300/yr by routing ownership through them
  └ NO  → Use spouse or non-pensioner relative; calendar pension-age re-evaluation if applicable

Q4: Apart from the above, do you want the брачен договор as belt-and-braces?
  └ YES → ~€300 notary; preempts the divorce-monetary-residual edge case
  └ NO  → Doctrinal protection (ВКС 2001) is sufficient for the main firewall
```

## One EOOD as portfolio entity for multiple products

> Added 2026-05-04. Refutes the common founder mistake of incorporating a separate EOOD per product.

### The default is one entity, many products

The universal practice for solo founders, indie hackers, and small software studios — globally and in Bulgaria — is **one legal entity** holding **all products** the founder ships. A vibe-coder with 20 mobile apps does NOT run 20 EOODs. They run one EOOD that holds 20 product brands.

Examples of the pattern (multi-product portfolios under a single legal entity):

- **37signals** (Basecamp + HEY + Once + writebook)
- **Linear** (Linear + Linear Asks + Insights)
- **Buffer** (Buffer + Reply + Analyze)
- **Pieter Levels / Hoodmaps Inc.** (Nomad List + Remote OK + Photo AI + many more)
- **Marc Lou** (ShipFast + ZenVoice + ByeDispute + others, single OÜ)

The legal entity is invisible to customers; only the product brands matter to them.

### Why one entity beats N entities

| Driver | Cost of N entities |
|---|---|
| Annual accounting | ~€1,200-2,400/yr × N entities |
| КЕП (Cloud Professional) | ~€68/3yr × N managers/owners (entity-tied) |
| Bank account fees | Per-entity costs (some BG banks) |
| Annual ГДД filing | Per-entity, even when zero-activity |
| Founder mental overhead | Per-entity bookkeeping reconciliation, separate cash flows |
| Tax aggregation lost | Losses on Product A cannot offset profits on Product B (closed P&Ls) |
| Credit programs | Microsoft Founders Hub / AWS Activate / NVIDIA Inception are gated per-account-and-founder. 20 entities ≠ 20× credits. |
| VAT thresholds | Foreign-vendor чл. 97а ЗДДС triggers entity-by-entity instead of once |

For a solo founder pre-€500K revenue, the per-entity overhead of running 5-20 EOODs in parallel exceeds the entire revenue stream. **One EOOD captures the same legal protection at 1/N the cost.**

### Bulgaria-specific: how one EOOD legally accommodates many products

#### NACE / KID activity codes

- **Code 6201 — Computer programming** covers ALL software development (web, mobile, SaaS, dev tools, plugins, AI tools, embedded). There is no per-product code.
- Adjacent codes (6202 consulting, 6209 other IT, 6311 data processing, 6312 web portals) can be added at incorporation OR amended later.
- **Multiple codes coexist on one EOOD with zero extra cost.** Listing 4-5 IT codes at incorporation is standard.

#### Predmet na deynost (subject-of-activity clause)

Founding act `Предмет на дейност` should be deliberately broad. Standard BG IT umbrella clause:

> "Разработка, разпространение и поддръжка на софтуерни продукти; консултантски услуги в областта на информационните технологии; разработка и експлоатация на интернет-базирани приложения и услуги; и всяка друга дейност, която не е забранена със закон."

This covers ANY future software product. No founding-act amendments needed when launching product #2, #3, #20.

#### Фирмено наименование vs търговска марка (legal name vs brand)

Bulgarian law cleanly separates:

- **Фирмено наименование** — legal company name registered in Commercial Registry (TR), appears on invoices/contracts/bank statements. Set ONCE at incorporation; amendment is bureaucratic.
- **Търговска марка** — trademark / product brand. Independent registration at Patent Office (БГ scope, ~€100-200) or EUIPO (EU scope, SME Fund voucher subsidizes 75-90%). Multiple trademarks per legal entity is standard.

A hypothetical "Pixel Forge EOOD" can ship products branded "ProductOne", "FocusTimer", "PongoCRM" without any legal coupling between the company name and product brands. Customers see brands; the EOOD is the invisible billing entity.

**Naming the EOOD:** prefer brand-neutral names that don't collide with any single product (e.g., "Pixel Forge", "Surge Apps", "Spinwheel Studio"). Avoid naming the EOOD after your first product — it locks you in psychologically and confuses billing/branding when product #2 launches.

#### VAT, revenue, and accounting aggregation

- **One ЕИК = one VAT registration** = one VAT return regardless of product count
- **One ЕИК = one annual financial statement (ГФО)** = one corporate tax filing
- The 100,000 BGN/year general VAT threshold and the чл. 97а foreign-vendor trigger both apply at entity level, not per-product
- Accountant cost is largely volume-driven (transactions per month), not product-count-driven — adding product #2 to an existing EOOD adds <10% to monthly accounting fees

Internal product-level P&L is a management-accounting concern: track via cost centers in spreadsheet, separate Wise/Revolut sub-accounts (free), or separate Stripe/Dodo seller IDs under one merchant account.

#### Bank account

One ЕИК = one (or a small number of) business bank accounts. All product revenue lands together. Use sub-accounts or seller-IDs for clarity, not separate legal entities.

### When a SECOND entity IS warranted (rare for solos)

Only three triggers justify a second EOOD/LLC for a solo founder portfolio:

1. **External investor wants single-product equity.** A VC funding Product A specifically requires it isolated from Products B/C/D for clean cap-table. Solo bootstrappers rarely hit this.
2. **Hard liability product.** Regulated medical data, financial custody, weapons-adjacent IoT — entity-isolation prevents Product A's lawsuit from draining Product B's bank. Insurance often substitutes.
3. **Acquisition prep.** If Product A is being groomed for sale (LOI in hand or term sheet active), splitting it cleanly into its own entity simplifies M&A diligence. Premature splitting before LOI is wasted overhead.

Until any of the three triggers is real, **one EOOD is correct.** Restructuring later (carve-out into a new entity) is mechanically possible and cheap relative to running parallel entities for years.

### Carving out a product from a portfolio EOOD — when an investor/acquirer trigger fires

> Added 2026-05-04. Common follow-up to portfolio-EOOD pattern: how do you LATER extract one product into its own entity when an investor or acquisition demands it?

#### Four legal mechanisms (BG)

| Mechanism | Authority | Cost | Time | Best for |
|---|---|---|---|---|
| **Apport (непарична вноска)** | Чл. 73 ТЗ | €300-1,000 + €500-2,000 expert valuation if asset >5K BGN | 1-2 months | Founder-only carve-out into a new EOOD they fully own |
| **Transfer of commercial enterprise (прехвърляне на търговско предприятие)** | Чл. 15 ТЗ | €500-1,500 | 1-2 months (incl. 6mo creditor window for liability) | Moving a going-concern between entities both owned by founder |
| **Spin-off / Division (отделяне)** | Чл. 262а ТЗ | €1,500-4,000 | 4-6 months (creditor window dominates) | VC carve-out where investor wants clean target entity. Tax-neutral per ЗКПО чл. 130-141 if structured correctly. **The M&A gold standard for BG.** |
| **Asset Purchase Agreement (APA) at FMV** | Standard contract law | €500-1,500 + tax on gain | 1-2 months | Co-owned target (founder + investor) where NewCo uses investor cash to buy product from OldCo |

#### Decision matrix

| Trigger | Recommended mechanism |
|---|---|
| VC term sheet for one product (founder retains rest) | **Spin-off (чл. 262а)** — tax-neutral, clean cap-tables |
| Acquirer LOI for the product (asset deal) | **APA** if acquirer wants assets only, **spin-off** if they want the legal entity |
| Acquirer LOI for the product (share deal) | **Spin-off then share transfer** of the new entity |
| Liability isolation (regulated product) | **Чл. 15 transfer** — full going-concern move |
| Founder bringing on co-founder for one product | **Spin-off OR APA** — both create the cap table at the new entity |
| Founder wants new entity for own use | **Apport** — fastest, simplest |

#### Tax-neutrality conditions (spin-off path)

Per ЗКПО чл. 130-141, the spin-off is tax-neutral if:
- Common control: founder owns ≥75% of both pre- and post-split entities (or relevant continuity)
- Continuity of activity: spun-out part continues genuine business activity (not asset-stripping)
- No immediate cash extraction by founder beyond the asset basis

If conditions are NOT met, the spin-off triggers immediate corporate tax (10%) on FMV of transferred assets. Always run pre-clearance through an M&A advocate (€150-300 consultation) before initiating.

#### Cost-of-waiting vs cost-of-pre-splitting

| Approach | Annual cost | When it pays off |
|---|---|---|
| One portfolio EOOD until trigger | ~€1,500/yr accounting + carve-out cost when triggered (€500-4,000 one-off) | Pays off vs pre-split after ~1 year regardless of carve-out mechanism |
| Pre-split into N EOODs | ~€1,500/yr × N + ongoing per-entity overhead | Almost never pays off for solo founders. Splitting AFTER trigger is what investors expect anyway. |

#### What founders should do TODAY (pre-trigger)

Two investments matter:

1. **Per-product trademarks** — registering each significant product brand at BG Patent Office or EUIPO ensures the brand asset is cleanly transferable when a carve-out happens. EUIPO SME Fund voucher (75-90% reimbursement) makes this near-free.
2. **Per-product cost-center accounting** — ask the accountant to tag expenses and revenue by product code from day 1. At carve-out time, this means the new entity has an immediate clean P&L; without it, M&A diligence takes weeks reconstructing mixed records.

Everything else (legal structure, valuations, employee transfers) is post-trigger work and is performed by the M&A advocate hired when the trigger fires.

#### Things that genuinely require advocate review at carve-out time

- Customer contract anti-assignment clauses
- Tax-neutral structuring per ЗКПО чл. 130-141
- VAT treatment (going-concern exemption ЗДДС чл. 10)
- Employee transfer impact (КТ чл. 123 protections)
- IP chain-of-title if any pre-EOOD code authorship existed

Budget €1,500-4,000 for advocate-led carve-out at trigger time. This is week-3-of-a-12-week funding/M&A cycle — routine, not bottleneck.

### Practical sequencing for portfolio-bound founders

```
1. Incorporate ONE EOOD with brand-neutral name (e.g., "Pixel Forge EOOD")
2. Founding act lists: NACE 6201 + 6202 + 6209 + 6311 + 6312
3. Predmet na deynost = broad IT umbrella clause (above)
4. Founding act in EUR (per 31.12.2026 deadline)
5. First product ships under EOOD; trademark filed separately if defending the brand
6. Second product (e.g., FocusTimer) → ships under same EOOD; new trademark, no new entity
7. Continue for 5/10/20 products; entity overhead stays flat at ~€1,500/yr accounting + €1,837/yr SOL contributions (when revenue active)
8. Trigger a second entity ONLY when an investor demands it / liability isolation is concrete / acquisition LOI is signed
```

### Sources

- BG Commercial Act (Търговски закон) — defines `фирмено наименование` and `предмет на дейност` as separate concepts: https://lex.bg/laws/ldoc/-14917630
- BG Trademark Law (Закон за марките и географските означения) — trademark independent of company name
- НАП guidance on multi-NACE activity declaration: https://nra.bg/wps/portal/nra/taxes/danak-varhu-pechalbata
- Industry pattern verification: 37signals, Linear, Buffer, Hoodmaps Inc., Marc Lou portfolio (cross-checked against public reporting and founder interviews)

## Personal-to-EOOD asset & subscription transfer — VAT (ЗДДС) treatment

> Added 2026-05-04. Common founder confusion: what does ЗДДС do when transferring a personal domain or migrating personal SaaS subscriptions into a newly-formed EOOD?

### The core principle

**ЗДДС only applies to "taxable persons" (`данъчно задължени лица`) making "taxable supplies".** A private individual is NOT a taxable person under normal circumstances. So:

- **Private person → EOOD asset transfer = no VAT event.** The private person is not a VAT-registered seller, so no VAT is charged or self-assessed.
- **EOOD → foreign supplier service payment = чл. 97а ЗДДС trigger.** EOOD must self-assess 20% VAT on every foreign-supplier invoice.

The "is this a business expense?" question is **irrelevant for VAT mechanics.** What matters is who the parties are.

### Three ways to bring a personal asset into the EOOD

| Method | How | Tax effect |
|---|---|---|
| **Free contribution from owner** | Owner contributes asset to EOOD as goodwill addition; EOOD records at nominal value | None for either party |
| **Apport (`непарична вноска`, чл. 73 ТЗ)** | Asset added to EOOD share capital as in-kind contribution | Expert valuation required only if asset >5,000 BGN |
| **Sale at FMV from owner to EOOD** | Owner invoices EOOD; EOOD pays from company account | Owner declares income on personal ГДД at 10%; no VAT (owner not registered); EOOD records as deductible expense |

For typical product-launch assets:
- Domain registration (~€15-20 cost): free contribution path; nominal recording
- Pre-built code or design assets where the owner is also the founder: free contribution OR apport at symbolic value
- Hardware (laptop, phone) >€1,500: sale at FMV is cleanest; below that, leave in personal ownership and let EOOD fund new equipment

### Subscription migration: three patterns

| Pattern | Use when | VAT implication |
|---|---|---|
| **(a) Change billing entity** in provider's portal | Provider supports it (Vercel, Cloudflare, Stripe, AWS, GitHub, Apple Developer, Google Play) | Existing subscription continues; from billing-change date, invoices are issued to EOOD → чл. 97а applies |
| **(b) Cancel personal + re-subscribe under EOOD** | Provider doesn't support entity change | Personal subscription closed; EOOD opens fresh subscription → чл. 97а from first foreign invoice |
| **(c) Personal pays + EOOD reimburses** | Bridging only (max 1-2 months) | Messy — НАП may reclassify as hidden distribution; not for long-term use |

**Do NOT migrate any subscription to EOOD before EOOD is registered for чл. 97а.** First foreign-supplier invoice received pre-registration triggers a fine (500-10,000 BGN).

### Чл. 97а ЗДДС registration timing

Mandatory: within **7 days of EOOD's first foreign-supplier transaction**. Practical sequence for portfolio-EOOD founders:

```
Week 0: EOOD incorporated, ЕИК issued
Week 1: Wife's Cloud Professional КЕП issued
Week 1-2: File чл. 97а registration at НАП via portal (DIY with КЕП, free; OR pay €30-50 to advocate)
Week 2-3: NAP issues BG VAT number (BGxxxxxxxxxxx)
Week 3+: Begin migrating subscriptions; provide BG VAT number to each foreign supplier
```

Once registered, monthly Article 117 protocol filings are mandatory regardless of volume. Accountant typically handles for €30-50/month at low volumes.

### Foreign supplier handling matrix

When EOOD pays each of these, чл. 97а applies (EOOD self-assesses 20% VAT):

| Supplier | Place of supply | Notes |
|---|---|---|
| Vercel (US) | BG (B2B) | Vercel records VAT number, removes US sales tax |
| Cloudflare (US) | BG (B2B) | CF respects VAT numbers; supports billing-entity change |
| OpenAI (US) | BG (B2B) | Issues clean B2B invoices when VAT number is set |
| Anthropic (US) | BG (B2B) | Same as OpenAI |
| Google AI / Cloud (US/Ireland) | BG (B2B) | Supports VAT for EOOD; Ireland entity routes through reverse-charge |
| GitHub (US/Microsoft) | BG (B2B) | Supports VAT number on org accounts |
| Stripe (Ireland) | BG (B2B, intra-EU) | Reverse charge — no VAT on invoice; report VIES + 97а |
| Apple Developer / Google Play | BG (B2B) | Both support EOOD entity registration |
| Dodo Payments | Verify entity location at activation | Treat as 97а until proven otherwise |
| Base44 / similar smaller SaaS | Generally BG (B2B service to BG VAT-registered customer) | Confirm entity location for each |

### Common confusion: pre-EOOD personal expenses

Personal subscription costs paid BEFORE the EOOD existed are sunk personal expenses. They CANNOT be retroactively deducted as EOOD expenses, regardless of whether they were "for the future business". НАП treats this as personal consumption.

**Don't try to:**
- Deduct pre-EOOD subscription costs as EOOD expenses
- Have EOOD reimburse you for pre-incorporation expenses (НАП reclassifies as hidden distribution)
- Charge VAT on a personal-to-EOOD asset transfer (you're not VAT-registered, can't charge)

### What VAT-registered status does NOT do for the EOOD

Common misconception: "if I register for VAT, I can deduct input VAT on everything". Under чл. 97а specifically:
- EOOD self-assesses output VAT on foreign-supplier invoices (must pay to НАП)
- EOOD generally **cannot** deduct input VAT on general operating expenses (different rule than full VAT registration)
- The 20% self-assessment is a real cash cost, not a wash

To deduct input VAT broadly, the EOOD would need full ЗДДС registration (under chl 96 or chl 100), which is voluntary or kicks in at 100K BGN/yr revenue threshold.

For pre-revenue or low-revenue EOODs, чл. 97а alone is the typical regime.

### Sources

- ЗДДС (VAT Act, official Bulgarian): https://lex.bg/laws/ldoc/2135533201
- НАП — VAT registration overview: https://nra.bg/wps/portal/nra/taxes/dds-v-balgariya/registratsiya-po-zdds
- НАП — Чл. 97а special registration: https://nra.bg/wps/portal/nra/taxes/dds-v-balgariya/registratsiya-po-chl-97a
- БГ Търговски закон чл. 73 (apport / non-cash contribution): https://lex.bg/laws/ldoc/-14917630
- ЗКПО (corporate income tax) — relevant for asset basis on transfer: https://lex.bg/laws/ldoc/2135540562

## Online registration service providers (BG-based, packaged pricing)

> Added 2026-05-03. Alternative to hourly-billing local accountants — fixed-price packages, English-friendly, online intake.

| Provider | Setup price | Includes |
|---|---|---|
| [BG Company](https://www.bgcompany.net) | €680 (Silver) / €790 (Gold) / €890 (Diamond) | Registration + first-period accounting + virtual office |
| [Bulgarian.llc](https://www.bulgarian.llc/company-formation-bulgaria/) | €500-800 | EOOD in 3 days, English documentation |
| [Sofia Offices](https://sofiaoffices.com/open-company-in-bulgaria/) | €400-800 | Registration + virtual office (€10-30/mo) |
| [Aidos BG](https://aidosbg.com/set-up-llc-bulgaria/) | €600+ | Online LLC setup + initial bookkeeping |
| [Elan Consulting](https://www.elan-consulting-bg.com/en/product/registraciya-na-kompaniya) | Custom quote | English-language full support |

Continuing accounting from these providers: ~€100-200/mo (packaged, not hourly). Cheaper than traditional BG счетоводител billing for similar service quality.

### Lower-cost online legal-services platforms (verify identity before engaging)

| Provider | Setup price | Identity & track record |
|---|---|---|
| **[Advokatami.bg](https://www.advokatami.bg/registracia-na-firma/)** ⭐ recommended | **€119 EOOD/OOD** + state fee separate | Founded by **Станимир Ненов** (also founder of pravatami.bg, 2011). Site since 2015. **30,000+ clients, 10,500+ company registrations, 863 Google reviews 4.9★ + 414 Facebook reviews 4.8★** (independently verified). Listed on Crunchbase + Dealroom. Tech-intermediary ЕООД routing to network of partner advocates + accountants. **Differentiator: "advocate personally files in TR"** — actual licensed advocate handles Commercial Registry submission. Broader service catalog: incorporation + ongoing accounting (schetovodstvo) + GDPR pack + zero-activity declaration (€35) + closure. Note: 2018 SAC disciplinary investigation of participating lawyers (not platform); concern reduced post-2024 BG Bar Act amendments lifting advertising ban. See `references/knowledge/competitors/advokatami-bg/CAPABILITIES.md`. |
| [LegalConsult.bg](https://legalconsult.bg/услуги/регистрация-на-фирми/) | €125 EOOD/OOD/ET, €500 AD (state fee €28.12 not included) | Administrator: адвокат **Адриян Митков Мурлиев**, БУЛСТАТ **180550822** (per `/за-нас/` and `/общи-условия/`). Per their T&C: "Всички адвокати, предоставящи услуги чрез платформата, упражняват дейността си като самостоятелни адвокати по смисъла на Закона за адвокатурата (ЗАдв)." Issues VAT invoices. Single-advocate platform model. Newer site (2022), narrower catalog (incorporation + ad-hoc consulting). |

**Verification rule before engaging any BG legal-services provider:**

The imprint may NOT be on the homepage or `/контакти/` page. Always check:
1. `/общи-условия/` (T&C page) — usually has the load-bearing legal identity
2. `/за-нас/` (About page) — often has administrator name + БУЛСТАТ
3. `/политика-за-поверителност/` (Privacy) — sometimes only place the controller is named
4. Cross-check: https://sak-sas.bg/ (Sofia Bar Association registry) by advocate name
5. Cross-check: https://portal.registryagency.bg/ by EIK/BULSTAT for entity facts

A BG site that is missing imprint info from ALL of {homepage, /контакти/, /общи-условия/, /за-нас/} after a thorough check is genuinely concerning. Drawing the conclusion from one page only is the failure mode this rule prevents.

### DIY benchmark — the actually-free option

For founders comfortable with the BG Commercial Registry online portal:
- **State fee:** €28.12 (electronic submission with KEP)
- **Time:** 1-3 working days
- **What you do:** Fill out forms (А4 series), upload founding act, declarations, ID copies, trademark consent, capital deposit slip; sign with KEP; submit
- **What you skip:** Service provider markup (€100-700)

The DIY route is realistic for solo EOOD with standard activity codes (no special licensing). For OOD with co-founders, AD, or regulated activities — engage a licensed advocate.

## Effective tax rate — best in the EU

| Vehicle | Effective rate |
|---|---|
| Свободна професия (after 25% normative deduction) | **7.5%** (10% × 75% taxable base) |
| Свободна професия (40% deduction — lawyers, royalties post-2023) | **6%** (10% × 60%) |
| EOOD retained + distributed | **14.5%** (10% corp + 5% dividend) |
| EOOD retained only (reinvested) | **10%** corp tax only |

Bulgaria + Hungary share the lowest corporate tax rate in the EU (10% / 9% respectively). Combined with the 5% dividend tax, BG is the **lowest effective-tax EU jurisdiction for solo SaaS founders**. Moving to Estonia, Ireland, Netherlands, or any other EU country generally **increases** the tax burden unless real economic substance exists abroad (CFC rules apply otherwise — see `eu-general.md`).
