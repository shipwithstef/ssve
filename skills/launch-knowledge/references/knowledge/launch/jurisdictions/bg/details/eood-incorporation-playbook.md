# Bulgaria — EOOD Incorporation Playbook for Software Portfolio

**Updated:** 2026-05-07
**Purpose:** Field-by-field guidance for the Advokatami online incorporation form (and equivalent platforms) when registering a software-product EOOD intended to host multiple products under one umbrella.
**Companion file:** `bg-kid-codes.md` (KID-2025 codes specifically)

## Form-field strategy

### Activity classifier choice

The Advokatami form (and similar BG incorporation flows) offers two paths for declaring предмет на дейност:

| Path | When to pick |
|---|---|
| `готов класификатор с дейности` (ready classifier checkboxes) | Single-product company, simple use case — pick relevant checkboxes |
| **`собствен предмет на дейност` (custom paragraph)** | **Portfolio EOOD shipping multiple product types — REQUIRED for software studios planning more than one product** |

For a software studio EOOD, **always pick собствен предмет на дейност**. The checkbox classifier is too narrow for a multi-product portfolio. Custom paragraph is also the standard professional convention for software EOODs in Bulgaria.

### Recommended predmet na deynost paragraph (verbatim, paste-ready)

Use this for software-product portfolio EOODs that may ship SaaS, mobile apps, AI products, e-commerce, web tools, consulting, or any combination:

```
Разработка, разпространение и поддръжка на софтуерни продукти; разработка и експлоатация на мобилни приложения, уеб приложения и SaaS услуги; разработване и предоставяне на услуги в областта на изкуствения интелект, машинното обучение и автоматизация на процеси; уеб дизайн, разработка и поддръжка на уебсайтове; консултантски услуги в областта на информационните технологии; управление и обслужване на компютърни средства и системи; обработка на данни и хостинг услуги; електронна търговия и онлайн продажба на стоки и услуги; рекламни услуги, свързани с дигитални продукти; и всяка друга дейност, която не е забранена със закон.
```

This single paragraph covers:
- Software / SaaS / mobile / web app development
- AI / ML / automation services (explicit, important for AI Act + grant applications)
- Web design + website maintenance
- IT consulting + computer system management
- Data processing + hosting (as consumer or seller of these)
- E-commerce / online sales (any product type)
- Digital advertising
- Universal catch-all clause for unenumerated lawful activities

### Why the explicit AI phrase matters

Even though the catch-all covers it, listing AI/ML/automation explicitly produces three operational benefits with almost no cost in length:

1. **EU AI Act compliance** — entity activity record matches AI product reality
2. **Government / EU grant applications** — Bulgarian National Recovery Plan AI funds, EIC Accelerator, EDIH all check predmet for AI mention
3. **Future enterprise B2B procurement diligence** — corporate buyers grep founding act activity language; explicit AI removes friction
4. **EUIPO trademark filings** in Class 9 (AI software) and 42 (SaaS / AI services) — matching activity language in entity record reduces examiner queries

### КИД selection

Per `bg-kid-codes.md`, primary KID for software portfolio EOOD is **62.10 Компютърно програмиране**. Only ONE KID per company at registration. Form-field guidance:

- ☑ Check "Искам да посоча код на икономическа дейност"
- КИД код: `62.10`
- КИД описание: `Компютърно програмиране`

The breadth of allowed activities is captured by the predmet text + catch-all, NOT by listing multiple KIDs.

### "и всяка друга дейност, позволена от закона" checkbox

When using готов класификатор, the form usually offers this as a separate checkbox. **Always check it** — it's the universal safety net for unenumerated lawful activities. When using собствен предмет, the phrase is already embedded at the end of the recommended paragraph above.

## Brand-neutral name strategy

For a portfolio EOOD shipping multiple products, the entity name should NOT match the first product's brand. Common error: naming the EOOD "Example Marketplace EOOD" because Example Marketplace ships first, then having to rename when product #2 launches.

**Pick a brand-neutral parent name. Distinct from any product brand.**

Naming patterns that work for software studio EOODs:
- Distinctive coined compounds (Faroshade, Latentforge, Voxelwright)
- Real but uncommon Latin/Greek/English words (Verbera, Quine, Hespera)
- Plain dictionary words with no obvious overlap (Quaywest, Stochasta)

Patterns that DON'T work:
- Generic tech-sound names (Pixel Forge, Pulse Software, Nexus Digital — feel AI-generated, may collide with existing brands)
- Names tied to one product domain (locks the EOOD to one product line)
- Surnames or family names (creates confusion with the owner's identity)

Verification path before submitting any candidate:
1. Google `"<name>"` exact-match — drop if page 1 has competing tech company
2. Check `<name>.com` and `<name>.app` at namecheap.com — drop if owned by active tech business
3. EUIPO eSearch in Class 9 + 42 — drop if active EU trademark in software/SaaS classes
4. Bulgarian Commercial Registry — advocate handles this last when the form is submitted

### Cyrillic transliteration

BG TR registers names primarily in Cyrillic. The EOOD CAN have a Latin parallel form on the founding act for international use. Get the Cyrillic transliteration right — common errors:

- "qu" → "куе" or "ку" (e.g., Quine → Куайн, Quaywest → Кийуест since "quay" rhymes with "key")
- "dge" /dʒ/ → "дж" not "ж" (e.g., Latentforge → Лейтентфордж not Лейтентфорж)
- Schwa /ə/ in English-derived words → "е" not "ъ" by convention (e.g., Voxelwright → Вокселрайт not Воксълрайт)

The advocate normalizes these per Търговски закон convention — your job is to pick the Latin name; the advocate writes the official Cyrillic.

## "Consultation included in registration" gotcha (Advokatami)

Advokatami.bg's published service text says the EOOD registration package "includes consultation." This statement is ambiguous and producers a real risk of double-paying:

| Possibility | Implication |
|---|---|
| (A) Included consultation = incorporation specifics ONLY (founding act, NACE, capital, name, спесимен) | Their separate 100 EUR written consultation is genuinely additional, for substantive legal questions (tax, IP, GDPR, family law) |
| (B) Included consultation = covers substantive questions too | The 100 EUR add-on is duplicate spend |

**Always ask explicitly before paying for the separate consultation.** The pre-payment email template lives at `~/.claude/skills/launch-knowledge/references/templates/advokatami-prepay-email-bg.md` (when needed).

Most likely answer: (A). The included consultation is for incorporation-specific advice; the 100 EUR engages a colleague accountant for substantive tax + GDPR + IP questions. But verify in writing before transferring funds.

## What CANNOT be answered before booking the paid consultation

These questions require substantive legal/tax analysis specific to the customer's facts. They should NOT appear in a pre-engagement scoping email — they go INSIDE the paid consultation Q-list:

- ВКС Тълкувателно решение № 2/2001 г. application to spouse-EOOD ownership
- чл. 97а ЗДДС exact registration timing for foreign-vendor invoices
- AI/IP authorship under ЗАПСП for AI-assisted code
- Specific GDPR document set required for the project's data flows
- Брачен договор necessity given specific marital regime
- Cross-border VAT regime for non-EU sales
- Long-horizon ownership transfer planning (e.g., to pensioner-relative for СОЛ optimization)
- Approach validation across phased GTM plan
- Monthly accounting tariff for the specific business profile (the lawyer alone CANNOT quote this — it requires the colleague accountant)

## What CAN be asked pre-engagement (free scoping)

- Total registration price all-in (advocate fee + state + notary + bank)
- Scope of included consultation (incorporation-only vs substantive)
- Founding act in EUR from day 1 (standard practice post-2026-01-01)
- Multiple NACE codes at incorporation without surcharge (BG TR allows only one primary KID, but the question itself is fine)
- Timeline from contract to ЕИК (Advokatami's published SLA: 2 working days from documents-ready)
- Name availability check on candidate names (TR portal lookup, takes 30 seconds)
- 100 EUR consultation format + follow-up rate + accountant inclusion in price
- GDPR pack scope (portfolio reusability, AI clause inclusion, mobile compliance coverage, non-EU sales handling — all about the pack contents, not legal opinion)

## Operational sequence (typical timeline)

| Day | Action | Cost |
|---|---|---|
| 0 | Pre-engagement email to advocate with scoping questions | €0 |
| 1-3 | Advocate replies | €0 |
| 3-4 | Sign engagement, pay registration fee | ~€165 (Advokatami) or ~€170 (LegalConsult) |
| 4 | Personal Cloud КЕП via B-Trust Mobile (parallel; manager only needs Personal at this stage) | €7.67 / 3yr |
| 4-5 | Bank capital deposit (manager visits in person) | ~€15 bank fee + 2 BGN capital |
| 5-6 | Notary specimen signature (manager visits in person) | ~€3 |
| 5-7 | Advocate drafts founding act, manager signs digitally with КЕП | included in fee |
| 7-9 | Advocate files at TR with their professional КЕП | included in fee |
| 9-10 | ЕИК issued, registration documents delivered as PDFs | included in fee |
| Day ЕИК arrives | Spouse upgrades to Professional Cloud КЕП for ongoing operations | €67.64 / 3yr |
| Day ЕИК arrives | Apply for D-U-N-S Number for Apple Developer Org enrollment | €0 (free, 5-10 days) |
| Day D-U-N-S arrives | Enroll Apple Developer Program as Organization | $99/year |

Total time from email to operational EOOD: 1.5-2.5 weeks. Total cash through Apple enrollment: ~€273 + $99.

## What stays deferred (don't pay these now even if offered)

- GDPR pack (€200 Advokatami pack) — defer to before public signup goes live (or first paying customer); DIY templates suffice for pre-launch
- Trademark filing (€250 lawyer fee + €850 EUIPO state fee per class) — defer to EUIPO SME Fund 2027 voucher window opening 2027-02-01 (75% reimbursement on state fees = ~€637.50 saved on EU 1-class)
- Брачен договор (€200-400 notary) — optional per ВКС Тълкувателно решение № 2/2001 г., load-bearing only for divorce-monetary-residual edge case
- IP-clause review for builder's трудов договор (€50-100) — only relevant if builder is the EOOD owner; if spouse is owner via greenfield repos, this is moot

## Where the project state lives

For each builder going through this playbook, project-side files capture the specific decisions:

- `docs/specs/launch-vehicle-decision.md` — the settled plan (jurisdiction, ownership, sequencing, costs)
- `docs/specs/advokatami-consultation-brief.md` — the pre-call brief and post-payment substantive Q-list
- `docs/specs/launch/email-to-send-nenov.md` (or equivalent advocate email) — the live correspondence
- `docs/specs/launch/lawyer-thread-<date>.md` — the email thread + svc cross-check + status

Update those files as the registration progresses; this playbook is the framework-level reference.
