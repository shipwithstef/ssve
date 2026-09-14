# BG VAT — 2026 SME Regime

**Layer:** 3 (detail)
**Topic:** New small/medium enterprise regime under ZDDS effective 2026-01-01
**Source:** `sources/2026-05-08-zdds-sme-regime-kik-info.md`

---

## Mechanism

The 2026-01-01 amendments to ZDDS introduced two parallel SME regimes alongside existing чл. 96 (general 100K turnover threshold) and чл. 97а (foreign-services special).

### Domestic SME (чл. 168д)

- Threshold: **51,130 EUR** annual turnover
- Application: automatic for persons NOT registered under чл. 96 ал. 1 or чл. 100 ал. 1
- Reporting: none special — relies on existing filings
- No special number issued (you remain "non-VAT-registered" for domestic supplies below threshold)

### EU SME (чл. 168е)

- Aggregate EU threshold: **100,000 EUR** annual turnover across all member states combined
- Per-country thresholds: each member state has its own "национален праг" — exceeding one country's threshold loses the regime ONLY for that country (чл. 168з ал. 8), not EU-wide
- Process: submit application per чл. 168ж, NAP reviews within 35 working days, receive **"-EX" number** suffix
- Reporting: **quarterly reports** (тримесечен отчет) per чл. 168л — replaces monthly OSS cadence
- Effective from date of act delivery (чл. 168ж ал. 14)
- Daily monitoring of per-country thresholds required

### Interaction with чл. 97а

The most operationally critical change. The new чл. 97а ал. 6 reads:

> "Освобождава от задължителната регистрация по ал. 2... но не и от задължението по ал. 1"

Translation: exempts from mandatory registration under subsection 2 (provider of services to foreign), BUT NOT from obligations under subsection 1 (recipient of services from foreign).

Operational implication:
- **Inbound (ал. 1):** Receiving services from foreign vendors (OpenAI, Vercel, AWS, Base44, Cloudflare invoices) → registration STILL MANDATORY regardless of SME status. No exemption.
- **Outbound (ал. 2):** Providing services to foreign customers → can be exempted if SME-registered with "-EX" number.

A BG software EOOD using foreign cloud/AI vendors (essentially all of them) will end up dual-registered: чл. 97а ал. 1 (monthly) + SME EU "-EX" (quarterly) if it sells direct to EU consumers above per-country thresholds.

### Incompatibilities (hard prohibitions)

- SME ↔ IOSS: cannot combine, full prohibition ("пълна забрана")
- SME ↔ OSS in the same member state: cannot run both for the same country

---

## Analysis

### What changed for new BG software EOODs after 2026-01-01

| Previous (pre-2026) | Current (2026+) |
|---|---|
| B2C EU sales above 10K EUR/yr → mandatory OSS registration with VAT at destination rates | B2C EU sales below 100K EUR aggregate + below per-country thresholds → optional SME with "-EX" + quarterly reports + no VAT charged to consumers |
| Monthly VAT declarations (OSS) | Quarterly reports under SME for outbound EU |
| чл. 97а ал. 1 mandatory at first foreign vendor invoice | Same — no change |
| чл. 97а ал. 2 mandatory for outbound services to foreign (some scenarios) | Now exempted under SME ал. 6 |

### What this means for Diana's Example Marketplace setup specifically

**Inbound side (no change):** Example Marketplace uses OpenAI, Vercel, Base44, possibly AWS, Cloudflare. All are foreign vendors with invoices into the EOOD. чл. 97а ал. 1 registration mandatory at first invoice — likely day 1 of operations since dev work uses these services.

**Outbound side via Dodo MoR:**
- Diana invoices Dodo's legal entity (Singapore/Delaware, non-EU)
- That's B2B export of services to non-EU = zero-rated under чл. 21 ЗДДС
- The new SME regime is mainly relevant for direct B2C to EU consumers, NOT for MoR-routed sales
- If Dodo MoR is the only sales channel, SME regime adds limited value vs simply relying on чл. 21 zero-rate

**Outbound side if direct (Stripe/Paddle direct without MoR) ever added:**
- B2C EU customers below 100K aggregate + per-country thresholds → SME "-EX" beneficial (no VAT to charge)
- B2C EU above thresholds → must move to OSS or full ZDDS чл. 96 registration
- B2B EU customers → reverse charge, no SME relevance

### Quarterly vs monthly cadence

Dual-registered EOODs (чл. 97а ал. 1 + SME "-EX") face dual cadence:
- Monthly: чл. 97а ал. 1 declarations for inbound services
- Quarterly: SME EU reports for outbound

An accountant must align these workflows — not technically complex but requires discipline.

### Pre-revenue dormancy implications

If the EOOD goes dormant immediately after registration (before first foreign vendor invoice received):
- No чл. 97а ал. 1 trigger yet
- No SME registration needed
- File annual zero-activity ГДД
- All accounting cost: minimal

The чл. 97а ал. 1 trigger fires at the moment ANY foreign vendor invoice arrives, regardless of revenue side.

### Backdating exposure

Late чл. 97а ал. 1 registration penalties: **500-10,000 BGN per offense** (per ZDDS чл. 178). Material risk if foreign vendor usage starts before formal registration.

### Strategic implication

For any post-2026-01-01 BG software EOOD:
1. Plan inbound side first — when does foreign vendor usage actually start?
2. Register чл. 97а ал. 1 BEFORE first foreign invoice if possible
3. Outbound side analysis depends on sales channel mix (MoR, direct B2C EU, direct B2B EU, direct non-EU)
4. SME regime is one of several options on the outbound side, not always optimal

---

## L4 Pointers

For deeper analysis:

- **NAP official VAT page:** https://nra.bg/wps/portal/nra/taxes/dds-v-balgariya
- **ZDDS full text (Юрист.bg):** https://www.lex.bg/laws/ldoc/2135533201
- **kik-info VAT discussions forum:** https://kik-info.com/forum/index.php?board=4.0
- **2026 amendments accountancy commentary:** the source article in `sources/`
- **SME regime application form (when published):** NAP — образец per чл. 168ж pending publication

For project-specific application:
- Diana's Example Marketplace case: see project-side `docs/specs/launch-vehicle-decision.md` Layer 2
- Substantive consultation Q-list: project-side `docs/specs/advokatami-consultation-brief.md` §4

For framework-level cross-references:
- BG KID-2025 codes: `details/kid-codes.md` (sibling)
- BG EOOD incorporation playbook: `details/eood-incorporation-playbook.md` (sibling)
