> **L2 current-awareness bank — `security-ops` agent.**
> Read at run-start via `expertise.mjs` preload. Currency: domain (30-day window).
> Authoritative benchmark numbers live HERE, not in the agent prompt.
> Re-research volatile rows when window expires.

## Core frameworks

- **OWASP Top 10:2025** — web/API app risk taxonomy; final release Jan 2026; 248 CWEs across 10 categories; dataset of 175,000 CVEs
- **STRIDE** — threat-modeling taxonomy (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation of Privilege); applied per-component during design review
- **SLSA v1.1/v1.2** — Supply-chain Levels for Software Artifacts; Build Track L0–L3; maintained by OpenSSF; v1.2 in active development as of mid-2026
- **CISA KEV + EPSS v3** — exploit-signal triage stack; KEV = known-exploited catalog (1,200+ entries); EPSS = daily 30-day exploit probability score; use both, not raw CVSS
- **CIS Benchmarks (2025 versions)** — cloud posture hardening; AWS v5.0, Azure v3.0.0, GCP v3.0; L1 baseline, L2 for regulated
- **NIST IR / CISA SBOM 2025** — incident response lifecycle and software supply-chain transparency; SBOM Minimum Elements updated Aug 2025 (SPDX/CycloneDX/SWID)

## Benchmark bands / thresholds

| Metric | Band / Threshold | Grade | Source |
|---|---|---|---|
| **Breach identification time (global median)** | 181 days | baseline; <100 days = strong | IBM Cost of Data Breach 2025 |
| **Breach containment time (global median)** | 60 days | baseline; <30 days = strong | IBM Cost of Data Breach 2025 |
| **Total breach lifecycle (identify + contain)** | 241 days | lowest in 9 years; <200 days = $1.14M savings | IBM Cost of Data Breach 2025 |
| **Average breach cost (global)** | $4.44M | down 9% from $4.88M (2024) | IBM Cost of Data Breach 2025 |
| **AI/automation savings on breach lifecycle** | −108 days, −$1.9M | extensively deployed vs. none | IBM Cost of Data Breach 2025 |
| **EPSS triage threshold — act out-of-cycle** | EPSS > 0.50 on exposed asset | patch within 7 days | FIRST/EPSS community guidance |
| **EPSS triage threshold — watch queue** | 0.10 ≤ EPSS < 0.50 | include in sprint cycle | FIRST/EPSS community guidance |
| **KEV response SLA (federal)** | 24–72 h for in-scope assets | mandatory for US federal | CISA KEV catalog |
| **Vulnerability exploitation as initial access** | 20% of confirmed breaches | 34% YoY increase | Verizon DBIR 2025 |
| **Edge device vuln median patch time** | 32 days | only 54% remediated annually | Verizon DBIR 2025 |
| **Secrets leaked on public GitHub (2025)** | 28.65M new hardcoded secrets | 34% YoY increase | GitGuardian State of Secrets Sprawl 2026 |
| **AI-assisted commit secret leak rate** | 3.2% (Copilot repos: 6.4%) | ~2× baseline | GitGuardian State of Secrets Sprawl 2026 |
| **AI-service credential leaks YoY growth** | +81% in 2025 | fastest-growing secret category | GitGuardian State of Secrets Sprawl 2026 |
| **Unremediated valid secrets (2022 cohort)** | 64% still not revoked in 2026 | critical governance gap | GitGuardian State of Secrets Sprawl 2026 |
| **KEV–ransomware overlap** | a majority of 2025 ransomware incidents exploited a KEV-listed CVE [unverified — exact 60% figure not source-tight; treat directionally] | signal for patch prioritization | CISA / industry 2025 reporting |
| **EPSS signal latency vs. KEV** | Largest EPSS spike occurs 2 days AFTER KEV listing | KEV leads; EPSS lags | TechRxiv / NucleusSec 2025 |
| **SLSA Build L3** | Hardened isolated build, authenticated signed provenance | highest assurance available | slsa.dev v1.1 spec |
| **CIS L1 controls** | Minimum hardening baseline for all cloud accounts | apply before L2 | CIS Benchmarks 2025 |
| **CIS L2 controls** | Regulated data environments (PCI, HIPAA, financial) | after L1 full compliance | CIS Benchmarks 2025 |

## Decision triggers

| Signal | Action |
|---|---|
| CVE in CISA KEV AND asset in scope | Escalate immediately; SLA = 24–72 h |
| EPSS > 0.50 on internet-exposed asset | Out-of-cycle patch within 7 days |
| EPSS 0.10–0.50 | Include in current sprint patch queue |
| EPSS < 0.10 AND not in KEV | Risk-accept or defer; monitor |
| Secret detected in repo scan | Revoke credential within 1 h; rotate, audit blast radius |
| AI-assisted commits in repo | Apply push protection; secrets leak at 2× rate |
| Cloud account fails CIS L1 check | Block promotion to production; L1 is minimum gate |
| Breach lifecycle > 200 days | Mandatory MTTD/MTTR review; estimated $1.14M cost premium |
| OWASP A03 (Supply Chain) risk present | Require SLSA ≥ L2 provenance + SBOM for affected components |
| OWASP A01 (Broken Access Control) finding | Severity = Critical; tie to STRIDE Elevation of Privilege threat |

## Sources (named, 2025–2026)

- **IBM Cost of a Data Breach Report 2025** — ibm.com/reports/data-breach (Jul 2025)
- **Verizon Data Breach Investigations Report 2025** — verizon.com/business/resources/reports/2025-dbir (May 2025)
- **GitGuardian State of Secrets Sprawl 2026** — gitguardian.com/state-of-secrets-sprawl-report (Mar 2026)
- **OWASP Top 10:2025** — owasp.org/Top10/2025 (final Jan 2026; announced Nov 2025)
- **CISA KEV Catalog** — cisa.gov/known-exploited-vulnerabilities-catalog (live, updated continuously)
- **FIRST EPSS** — first.org/epss (v3, updated daily)
- **CISA 2025 SBOM Minimum Elements** — cisa.gov/resources-tools/resources/2025-minimum-elements-software-bill-materials-sbom (Aug 2025 draft)
- **SLSA v1.1 spec** — slsa.dev/spec/v1.1 (OpenSSF, stable)
- **CIS Benchmarks 2025** — cisecurity.org/cis-benchmarks (AWS v5.0, Azure v3.0.0, GCP v3.0)
- **TechRxiv / NucleusSec EPSS latency research 2025** — techrxiv.org; nucleussec.com/blog/epss-score-is-predictive-but-late

_As-of 2026-06-28; volatile rows re-research when stale._
