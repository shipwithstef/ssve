> **L2 current-awareness bank — `counsel` agent — startup-legal-compliance domain.**
> Read via `expertise.mjs` preload at run-start. Currency window: 30 days.
> Authoritative benchmark numbers live HERE; do not embed them in the agent prompt.
> Volatile rows (market-rate medians, per-violation caps) are flagged — re-research when stale.

---

## Core frameworks

- **GDPR (EU 2016/679)** — primary EU personal-data law; controller/processor duties, DPO, breach notification, data subject rights, cross-border transfer controls (SCCs / BCRs / adequacy decisions)
- **CCPA / CPRA (California)** — US privacy anchor; opt-out / opt-in for sensitive data, CPPA enforcement since 2023, per-violation civil penalties, data minimization emphasis since 2025
- **EU AI Act (Reg 2024/1689)** — risk-tier framework (prohibited / high-risk / limited / minimal); phased enforcement 2025-2028; Article 50 transparency obligations Aug 2026; high-risk employment/biometrics Dec 2027
- **SOC 2 (AICPA TSC)** — US SaaS trust-service attestation; Type I (point-in-time) vs Type II (3-12 month operating period); Security TSC mandatory; Availability/Confidentiality common add-ons
- **ISO/IEC 27001:2022** — internationally recognised ISMS certification; 93-control Annex A; 3-year certification cycle with annual surveillance audits; preferred in EU/UK enterprise deals
- **NIST CSF 2.0 (2024)** — US voluntary risk framework; Govern/Identify/Protect/Detect/Respond/Recover; maps to SOC 2 + ISO 27001 controls; useful GRC anchor for pre-SOC2 startups

---

## Benchmark bands / thresholds

| Dimension | Band / Figure | Volatile? | Source |
|---|---|---|---|
| GDPR — cumulative fines total | > €7.1 B (through mid-2025) | VOLATILE | CMS.law Enforcement Tracker Report 2025/2026 |
| GDPR — 2025 annual fine total | ≈ €1.2 B | VOLATILE | enforcementtracker.com / Kiteworks 2026 |
| GDPR — average fine (all cases) | ≈ €2.4 M | VOLATILE | UniConsent 2026 analysis |
| GDPR — median fine (most cases cluster) | < €100 K | VOLATILE | UniConsent / Improvado 2026 |
| GDPR — upper-tier maximum | €20 M or 4 % global turnover, higher wins | STABLE | GDPR Art. 83(5) |
| GDPR — lower-tier maximum | €10 M or 2 % global turnover | STABLE | GDPR Art. 83(4) |
| GDPR — breach notification window | 72 hours to supervisory authority | STABLE | GDPR Art. 33 |
| GDPR — daily breach notifications EEA (2025 avg) | 443/day (+22 % YoY) | VOLATILE | Improvado / ComplianceStack 2026 |
| CCPA — unintentional violation cap | $2,663 per violation (2025 CPI-adjusted, effective Jan 1 2025; still current unless superseded) | VOLATILE | CPPA announcement Dec 2024 |
| CCPA — intentional / minor-related cap | $7,988 per violation (2025-adjusted; still current) | VOLATILE | CPPA announcement Dec 2024 |
| CCPA — cumulative fines enforced | ≥ $23.2 M total through May 2026 | VOLATILE | Termly / IAPP 2026 |
| EU AI Act — prohibited practices enforceable | 2 Feb 2025 (LIVE) | STABLE | Art. 5; EC Digital Strategy |
| EU AI Act — transparency obligations (Art. 50) | 2 Aug 2026 | STABLE | Reg 2024/1689 timeline |
| EU AI Act — high-risk (biometrics, employment, migration) | 2 Dec 2027 | STABLE (may slip) | Political agreement 7 May 2026 |
| EU AI Act — prohibited practice fine ceiling | €35 M or 7 % global turnover | STABLE | Art. 99(3) |
| EU AI Act — high-risk violation fine ceiling | €15 M or 3 % global turnover | STABLE | Art. 99(4) |
| SOC 2 Type II — startup audit fee | $10 K – $70 K (median ≈ $25 K for Security-only, <50 staff) | VOLATILE | soc2auditors.org 168-firm study 2026 |
| SOC 2 Type II — all-in year-1 (audit + prep + tooling) | $25 K – $80 K | VOLATILE | Thoropass / Sprinto / ComplyJet 2026 |
| SOC 2 — observation period | 3 – 12 months (6 months typical) | STABLE | AICPA TSC guidance |
| ISO 27001 — startup first-year total | $10 K – $50 K | VOLATILE | Sprinto / StrongDM / Axipro 2026 |
| ISO 27001 — audit day rate (US, accredited CB) | $1,500 – $2,200 / day (+20 % YoY, auditor shortage) | VOLATILE | Rhymetec / ElevateConsult 2026 |
| ISO 27001 — small company audit days | 3 – 6 days (<50 staff) | STABLE | ISO/IEC 27006 sampling norms |
| ISO 27001 — 3-year TCO (10-150 person SaaS) | $35 K – $120 K | VOLATILE | ISMS Copilot / SecureLeap 2026 |
| GRC automation platform (annual SaaS) | $7 K – $25 K (mid-market; Drata, Thoropass, Sprinto) | VOLATILE | Isora GRC / soc2auditors.org 2026 |

---

## Decision triggers

| Signal from project | Action |
|---|---|
| EU/UK users OR personal data processed anywhere | GDPR applies — map controllers/processors, write DPA, appoint DPA contact |
| California users + revenue > $25 M OR > 100 K consumers | CCPA/CPRA obligations; add opt-out mechanism + privacy policy |
| Any AI feature shipped to EU users | Check EU AI Act risk tier NOW; prohibited tier = block; limited tier = disclosure label |
| Enterprise deal requires trust attestation | SOC 2 Type II if US buyer; ISO 27001 if EU/UK/APAC buyer; both if global |
| Processing health, biometric, financial, or children's data | Heightened GDPR Art. 9 special-category duties + DPIA required |
| Third-party data processor engaged | Art. 28 DPA mandatory before data flows; verify sub-processor chain |
| Data breach suspected | Start 72-hour clock to supervisory authority immediately on awareness |
| Fine risk calculation needed | Use 4 % of global annual turnover (upper) or 2 % (lower) — not flat €20 M |

---

## Sources

- **CMS.law GDPR Enforcement Tracker Report 2025/2026** — https://cms.law/en/int/publication/GDPR-Enforcement-Tracker-Report/numbers-and-figures
- **GDPR Enforcement Tracker (live fines DB)** — https://www.enforcementtracker.com/
- **UniConsent GDPR Enforcement & Fines 2026** — https://www.uniconsent.com/blog/gdpr-enforcement-fines-2026
- **Kiteworks GDPR Fines Data Privacy Enforcement 2026** — https://www.kiteworks.com/gdpr-compliance/gdpr-fines-data-privacy-enforcement-2026/
- **Improvado GDPR Fines 2026** — https://improvado.io/blog/gdpr-fines
- **CPPA Dec 2024 Penalty Announcement** — https://cppa.ca.gov/announcements/2024/20241217.html
- **IAPP CCPA Enforcement Coverage 2026** — https://iapp.org/news/a/california-authorities-announce-largest-ccpa-fine-to-date
- **Termly CCPA Fines Breakdown** — https://termly.io/resources/articles/biggest-ccpa-fines/
- **EU AI Act Official Text (Reg 2024/1689)** — https://artificialintelligenceact.eu/implementation-timeline/
- **EC Digital Strategy — AI Act** — https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- **Latham & Watkins AI Act Update (May 2026 Omnibus)** — https://www.lw.com/en/insights/ai-act-update-eu-resolves-to-change-rules-and-extend-deadlines
- **soc2auditors.org 168-firm cost study** — https://soc2auditors.org/soc-2-audit-cost/
- **Thoropass SOC 2 Audit Cost Guide** — https://www.thoropass.com/blog/soc-2-audit-cost-a-guide
- **Sprinto ISO 27001 Cost 2026** — https://sprinto.com/blog/iso-27001-certification-cost/
- **Rhymetec ISO 27001 Cost Breakdown 2025** — https://rhymetec.com/iso-27001-certification-cost-breakdown-2025/
- **Isora GRC Mid-Market Tools 2026** — https://www.saltycloud.com/blog/mid-market-grc-tools-and-solutions/
- **GDPR-Info.eu Art. 28** — https://gdpr-info.eu/art-28-gdpr/
- **ComplianceStack GDPR Data Breach Fines** — https://compliancestack.ai/penalties/gdpr/data-breach-fines

---

_As-of 2026-06-28; volatile rows re-research when stale (30-day window)._
