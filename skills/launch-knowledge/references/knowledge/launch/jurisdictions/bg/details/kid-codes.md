# Bulgaria — KID-2025 Economic Activity Codes (current)

**Updated:** 2026-05-07
**Authoritative source:** https://kik-info.com/spravochnik/kid/

## What changed: KID-2008 → KID-2025

Bulgaria moved from KID-2008 to KID-2025 classification. Format change: 4-digit numeric codes (6201) → dotted notation (62.10). The mapping is 1:1 conceptually — just add the dot.

**Do not use KID-2008 codes (6201, 6202, etc.) in current TR filings.** They are superseded.

## Primary codes for software / SaaS EOODs

| KID-2025 | Activity (BG) | Activity (EN) | Use case |
|---|---|---|---|
| **62.10** | Компютърно програмиране | Computer programming | Default primary for software development EOODs |
| 62.20 | Консултантска дейност по ИТ и обслужване на компютърни средства и системи | IT consulting | Use as primary if consulting is the main revenue source |
| 62.90 | Други дейности в областта на информационните технологии | Other IT activities | Catchall for ambiguous IT work |
| 63.10 | Инфраструктура за ИТ, обработка на данни, хостинг и подобни дейности | IT infrastructure / data processing / hosting | If running own hosting / managed services |
| 63.91 | Дейности на портали за търсене в мрежата | Web portals | Search/aggregator products |
| 63.92 | Други информационни услуги | Other information services | Catchall information products |

## Critical rule

**Bulgarian Trade Registry accepts only ONE primary KID per company at registration.** The Advokatami online registration form enforces this explicitly: "КИД може да бъде само един на фирма."

You cannot list multiple KID codes at incorporation. The breadth of allowed activities is captured by:

1. **Predmet na deynost (subject of activity):** broad text describing all software activities the EOOD may perform
2. **The clause "и всяка друга дейност, позволена от закона"** — universal safety net for unenumerated lawful activities

Together these give the EOOD the same scope flexibility you'd get from listing 5 KIDs in a multi-NACE jurisdiction (e.g., Estonia OÜ, US LLC).

## Form field guidance (Advokatami online registration)

For a software studio EOOD shipping multiple products:

- **Activity classifier:** `готов класификатор с дейности` (ready classifier)
- **Activity:** "Разработване на софтуер/уебсайтове"
- **"и всяка друга дейност, позволена от закона" checkbox:** ☑ checked
- **КИД checkbox:** ☑ checked
- **КИД код:** `62.10`
- **КИД описание:** `Компютърно програмиране`

## Why this matters for the launch-knowledge skill

Stored knowledge in earlier versions of `launch-vehicle-decision.md` and `advokatami-consultation-brief.md` listed KID-2008 codes (6201, 6202, 6209, 6311, 6312) as if multiple could be filed at incorporation. Both assumptions were wrong:

1. Format (4-digit numeric) is superseded by KID-2025 (dotted)
2. Multi-KID listing at incorporation is NOT possible in Bulgarian TR — only ONE primary

When advising any future BG EOOD registration, route to KID-2025 (this file) and explain the one-KID-per-company rule.

## Cross-references

- Bulgarian TR portal: https://portal.registryagency.bg/
- KID-2025 lookup: https://kik-info.com/spravochnik/kid/
- Sofia Bar Association (verify advocate identity): https://sak-sas.bg/
- Example Marketplace project archive (real registration scenario, May 2026): see project-side `docs/specs/launch-vehicle-decision.md` and `docs/specs/launch/email-to-send-nenov.md`
