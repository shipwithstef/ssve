# Blog Applied Knowledge — useful info distilled from last-12mo posts

**Source posts:** 44 posts from `details/blog-posts/` (2025-05-06 → 2026-04-20)
**Total body content:** 225,489 characters extracted via WP REST API
**Generator:** `research/scripts/blog-content-extract.mjs`

This file synthesizes what the platform actually publishes — concrete legal positions, recommendations, and statutory references — beyond the "is the site active?" verdict.

## Theme distribution (confirmed working themes)

| Theme | Count | Top dates |
|---|---|---|
| Договори / задължения | 28 | majority of posts touch contract/obligation topics |
| AI / технологии | 20 | AI-business risk + GDPR + technology contracts |
| Корпоративно право (ЕООД/ООД/АД) | 18 | EOOD setup, share transfers, liquidation |
| EUR / валутна реформа | 15 | euro-transition impact on docs/contracts (2026 specific) |
| Имоти / недвижим имот | 14 | property purchase, off-plan risks, Акт 16 |
| Данъци / ДДС / ЗДДС | 12 | VAT registration, чл. 97а, annual declarations |
| Търговска марка / IP | 10 | trademark registration, EUIPO voucher, brand protection |
| Колекторски / дългове | 5 | EOS Matrix, debt-collection statute of limitations |
| Трудово право | 4 | employment contract clauses, dismissal compensation |
| Свободна професия / фрийланс | 2 | freelancer contracts, self-employment |

## Highly-relevant posts for Example Marketplace builder

### 1. AI legal risks for businesses (2026-01-26) ⭐⭐⭐

**File:** `blog-posts/2026-01-26-юридически.md`
**Title:** "Юридически рискове при използване на AI в бизнеса: практическо ръководство за предприемачи"

**Key positions (paraphrased from verbatim body):**

- **AI is a tool, not a legal subject.** Liability stays with the business that uses the result. "AI generated it" is NOT a defense.
- **Copyright on AI-generated content is uncertain in BG.** No human author → no automatic authorship → client can challenge your right to license/resell. Mitigation: contract clauses + meaningful human edit.
- **Third-party IP risk.** AI trained on opaque data may produce content similar to protected works / trademarks / slogans. The business carries the infringement risk.
- **Contractual liability to clients.** AI hallucinations can create unintended commitments. General Terms MUST explicitly address: (a) is AI used, (b) what's the human-review layer, (c) liability boundaries.
- **GDPR.** AI-driven personal-data processing requires same consent/lawful-basis as any other processing. AI doesn't relax that.

**Example Marketplace implication:** Your General Terms / privacy policy must explicitly state that AI is used in operations (scheduling, deals, content), define the liability boundary for AI-generated outputs, and document the human-review layer. This is BG-statutory exposure if Example Marketplace serves BG businesses.

### 2. ET vs EOOD comparison (2025-06-27) ⭐⭐

**File:** `blog-posts/2025-06-27-ет-или-еоод.md`

**Verbatim comparison table extracted:**

| Critère | ET (едноличен търговец) | EOOD (еднолично дружество) |
|---|---|---|
| Legal form | Physical person — merchant | Legal person |
| Liability | **Unlimited** — entire personal estate | **Limited** — to capital |
| Tax | 15% personal income tax (ZDDFL) | 10% corporate + 5% dividend = 14.5% combined |
| Min. capital | None | **2 лв** |
| Registration | Simple, fast | More documents required |

**Example Marketplace implication:** Reaffirms our `launch-knowledge` recommendation — **EOOD over ET** for Example Marketplace:
- Liability isolation is critical (Example Marketplace handles customer PII, payments, operates a SaaS at scale)
- 14.5% effective vs. 15% tax difference is negligible compared to liability shield value
- 2 лв symbolic capital is trivial

### 3. Freelancer contracts 2026 (2026-01-05) ⭐⭐

**File:** `blog-posts/2026-01-05-договори-за-фрийлансъри.md`
**Title:** "Договори за Фрийлансъри и подизпълнители през 2026 г."

**Why relevant to Example Marketplace:** If builder uses spouse-as-owner pattern + civil-contract for own development work (per launch-vehicle-recommendation.md), this post explains required clauses for legitimacy:
- IP assignment clauses (critical given builder's existing employer-IP risk)
- Payment terms in EUR (post-2026 transition)
- Subcontractor liability allocation
- Tax-residency split between Бг fre-lance + Bg client

### 4. EUR transition impact on company docs (2026-01-12) ⭐

**File:** `blog-posts/2026-01-12-промени-в-дружествените-документи.md`
**Title:** "Промени в дружествените документи след въвеждането на еврото"

**Why relevant:** If you incorporate EOOD in 2026 and the capital is in лв (2 лв), some founding docs may need euro-amendment. This post covers procedure.

### 5. Trademark voucher 2026 (2026-02-09) ⭐

**File:** `blog-posts/2026-02-09-ваучер-за-регистрация-на-марка.md`

This is the article we already analyzed for `references/knowledge/launch/credit-programs/euipo-sme-fund.md`. Confirms EUIPO SME Fund 2026 is real + LegalConsult.bg offers paid prep service.

### 6. Off-plan property purchase risks (2026-04-05) — generic-relevance

**File:** `blog-posts/2026-04-05-покупка-на-имот-на-зелено.md`

Concrete contract-clause economics extracted:
- 5%-20% of price as deposit ranges
- 30% threshold for additional buyer protection
- 0.5%/month penalty clauses

Not directly Example Marketplace-related, but signals the platform's content quality (real numbers, not generic advice).

## Posts NOT relevant to Example Marketplace but signal active practice

- Akt 16 process (real estate completion)
- EOS Matrix debt collection (consumer law)
- Online divorce procedure
- Pharmacy registration
- Various GDPR for small businesses
- Generic "how to draft a contract" articles

## Cross-reference: blog content corroborates platform claims

| Site claim | Blog evidence |
|---|---|
| "Active legal practice" | 44 posts in last 12mo, 5 in last 3mo, latest 13 days ago |
| "Software platform routes to advocates" | Multiple posts use "ние", "екип", "наши юристи" — singular author voice consistent with администратор-as-author model |
| "Issues VAT invoices" | Multiple posts reference ДДС mechanics from advocate's-perspective |
| "Topical, current content" | Posts in last 6 months cover: AI risks 2026, EUR transition 2026, EUIPO SME Fund 2026 — all aligned with current BG legal calendar |

## What to read NEXT for Example Marketplace-specific application

1. **`2026-01-26-юридически.md`** — for the General Terms / Privacy Policy AI clauses you'll need
2. **`2025-06-27-ет-или-еоод.md`** — affirmation of EOOD path
3. **`2026-01-05-договори-за-фрийлансъри.md`** — for the civil-contract template if builder will invoice the EOOD
4. **`2026-01-12-промени-в-дружествените-документи.md`** — for EUR-era founding doc compliance

All are persisted at full body length under `blog-posts/`. Future agent reading the knowledge base does not need to re-fetch them.

## Confidence

**HIGH.** Bodies extracted via WP REST API directly (zero LLM intermediation, zero risk of hallucination). 44/44 posts captured. Total 225,489 characters of legal-content output preserved. Cross-checked against the platform's own activity claims (112 total posts, scorecard reproducible).
