# AppSec / SecOps 2026 — L3 Detail Reference

> Companion to CAPABILITIES.md. Explains the "why" behind each benchmark band.
> Each row is flagged VOLATILE (market median that drifts — re-research every 30 days)
> or STABLE (framework/spec that rarely moves).

---

## 1. OWASP Top 10:2025

**Stability: STABLE** (list moves ~every 3–4 years; this edition released Jan 2026)

### Why it changed from 2021

The 2025 edition was built on 175,000 CVE records — the largest dataset OWASP has ever used — plus input from bug bounty programs and security vendors. Two new categories reflect where real breaches actually occur:

- **A03:2025 — Software Supply Chain Failures** (NEW): Reflects the SolarWinds/XZ Utils era. Covers dependency confusion, typosquatting, compromised build pipelines, and unsigned artifacts. Direct response to the CISA/NSA emphasis on supply-chain risk since 2023.
- **A10:2025 — Mishandling of Exceptional Conditions** (NEW): Covers error handling that leaks stack traces, unhandled exceptions that skip auth checks, and race conditions. Previously scattered across other categories.
- **SSRF absorbed into A01**: Server-side request forgery attacks almost universally exploit broken access control (no SSRF-specific allow-list), so it was consolidated.

### Ranking shifts worth noting

| Category | 2021 Rank | 2025 Rank | Direction | Why |
|---|---|---|---|---|
| Broken Access Control | #1 | #1 | Held | Still the most prevalent CWE in real breaches |
| Security Misconfiguration | #5 | #2 | Up 3 | Cloud sprawl; misconfigured S3, IAM, secrets in env vars |
| Cryptographic Failures | #2 | #4 | Down 2 | Detection improved; still present but less #1 risk |
| Supply Chain Failures | — | #3 | New | Data-driven: 34% of breaches now have supply-chain component |
| SSRF | #10 | (merged A01) | Removed | Subsumed |

### STRIDE mapping to OWASP Top 10:2025

| STRIDE Threat | Primary OWASP 2025 Category |
|---|---|
| Spoofing | A07 Authentication Failures |
| Tampering | A08 Software or Data Integrity Failures |
| Repudiation | A09 Security Logging and Alerting Failures |
| Information Disclosure | A04 Cryptographic Failures |
| Denial of Service | A10 Mishandling of Exceptional Conditions |
| Elevation of Privilege | A01 Broken Access Control |

---

## 2. STRIDE Threat Modeling

**Stability: STABLE** (methodology; definitions haven't changed since Microsoft formalized it)

STRIDE is applied per-component (data store, process, external entity, data flow) during design review. The key operational discipline is:

1. Draw the data-flow diagram (DFD) first — trust boundaries must be explicit.
2. Apply all six STRIDE categories to each element crossing a trust boundary.
3. Rate each threat using DREAD or CVSS-adjacent scoring (Damage, Reproducibility, Exploitability, Affected Users, Discoverability).
4. Mitigations must map back to a threat ID — no orphan controls.

**2026 context**: AI-generated components (LLM APIs, embedding stores, prompt pipelines) require new STRIDE surfaces. Prompt injection = Tampering + Elevation of Privilege. Model output used in auth decisions = Spoofing risk. The OWASP LLM Top 10 (v1.1, 2024) is the companion taxonomy.

---

## 3. Supply Chain Security — SLSA + SBOM

### SLSA (Supply-chain Levels for Software Artifacts)

**Stability: STABLE** (framework; specific level counts don't drift)

| Level | What it guarantees | Adoption target |
|---|---|---|
| L0 | No provenance | Starting point only |
| L1 | Provenance exists (not verified) | Minimum for internal tooling |
| L2 | Hosted build platform; signed provenance | Recommended for all shipped artifacts |
| L3 | Hardened isolated build; authenticated, signed provenance; ephemeral environments | Required for critical/public packages |

**Current spec**: v1.1 stable (OpenSSF), v1.2 in active development (mid-2026). The Build Track is complete; Source Track (tracking source code integrity) is still being specified.

**Practical gate**: Any artifact published to a package registry or deployed to production SHOULD have SLSA ≥ L2. Critical infrastructure (auth libraries, cryptographic primitives, CI runners) SHOULD target L3.

### SBOM (Software Bill of Materials)

**Stability: STABLE** (framework) / **VOLATILE** (compliance mandates drift)

CISA updated the SBOM Minimum Elements in August 2025 (draft, comment period closed Oct 3, 2025). Key changes from the 2021 NTIA baseline:

- Expanded required fields to cover transitive dependencies (not just direct).
- Machine-readable format required: SPDX (ISO/IEC 5962:2021), CycloneDX v1.6+, or SWID.
- Signatures on the SBOM itself are now a minimum element.
- US federal software procurement (EO 14028) requires SBOM from vendors; still not a binding statute for commercial buyers, but FDA medical device guidance cross-references it.

**Operational minimum**: Every container image and package release should ship an SBOM in CycloneDX 1.6 format with direct + transitive deps, signed by the build pipeline identity.

---

## 4. Secret Scanning

**Stability: VOLATILE** (leak volumes and tool coverage change month-to-month)

### Why this is volatile

GitGuardian's 2026 State of Secrets Sprawl shows the problem is accelerating:

- **28.65M new hardcoded secrets** added to public GitHub in 2025 (source: GitGuardian 2026 report)
- **34% YoY increase** — driven primarily by AI coding tool adoption
- **AI-assisted commits leak at 3.2%** vs. ~1.6% baseline; Copilot-tagged repos at 6.4% (source: GitGuardian 2026 report)
- **AI service credentials grew 81% YoY** — OpenAI, Anthropic, Hugging Face keys are now the fastest-growing secret category

### The remediation gap — the number that actually matters

**64% of valid secrets exposed in 2022 are still not revoked in 2026** (GitGuardian 2026). The detection problem is largely solved; the governance problem (who owns revocation, what's the blast radius, how do you rotate a production credential safely) is not.

### Push protection effectiveness

GitHub Push Protection blocked 4.4M secrets before commit in 2025, but 34.6M reached public repos anyway. Push protection is necessary but not sufficient — pre-commit hooks, CI scanning (truffleHog, gitleaks, GitGuardian), and post-commit monitoring must all run.

### Triage SLA

| Signal | SLA | Rationale |
|---|---|---|
| Secret detected in public repo | Revoke within 1 hour | Bots scrape GitHub in < 1 min; any longer risks active exploitation |
| Secret detected in private repo (leaked to branch) | Revoke within 4 hours | Lower exposure window; still treat as compromised |
| Secret detected in container image | Revoke before image published; rebuild | Do not push the image |

---

## 5. CVE Triage — EPSS + KEV (not raw CVSS)

**Stability: VOLATILE** (KEV catalog grows weekly; EPSS scores update daily)

### Why raw CVSS fails

CVSS measures theoretical severity, not real-world exploit probability. A CVSS 9.8 vulnerability with no public exploit and no exposed asset is lower priority than a CVSS 6.5 with an active ransomware campaign. Raw CVSS-first prioritization creates alert fatigue and misallocates remediation effort.

### The three-tier signal stack

**Tier 1 — CISA KEV**: A CVE in the Known Exploited Vulnerabilities catalog has confirmed exploitation in the wild. For US federal agencies, the SLA is 24–72 hours. For commercial organizations, treat KEV entries as P0 regardless of CVSS.

**Tier 2 — EPSS > 0.50**: Exploit Probability Scoring System scores represent the probability of exploitation in the next 30 days, based on threat intelligence, PoC availability, and exploit-kit inclusion. An EPSS > 50% on an internet-exposed or privileged asset = out-of-cycle patch within 7 days.

**Tier 3 — EPSS 0.10–0.50**: Include in the current sprint's patch queue. Monitor for KEV addition.

**Below threshold — EPSS < 0.10, not in KEV**: Risk-accept with documented justification or defer. Continue monitoring.

### Critical EPSS limitation (2025 research finding)

**EPSS is a lagging, not leading, signal for high-profile CVEs.** TechRxiv / NucleusSec research on 2025 KEV additions found:

- Median EPSS movement is 121× larger AFTER KEV listing than before.
- The largest single-day EPSS spike occurs ~2 days after KEV listing.
- Implication: for the highest-risk CVEs, KEV is the leading indicator. Do NOT wait for EPSS to spike before acting on KEV entries.

### 2025 breach context

- Vulnerability exploitation = 20% of confirmed breach initial access vectors in 2025, up 34% YoY (Verizon DBIR 2025).
- Median patch time for edge device/VPN vulnerabilities: **32 days**, yet only 54% of such vulns are remediated annually (Verizon DBIR 2025).
- A majority of 2025 ransomware incidents exploited a CVE already in the KEV catalog at time of attack [unverified — the specific ~60% figure could not be tied to a named primary source; directionally consistent with CISA KEV guidance].

---

## 6. Cloud Posture — CIS Benchmarks

**Stability: STABLE** (framework) / **VOLATILE** (version numbers and specific control counts update)

### Current benchmark versions (2025)

| Platform | Benchmark | Version | Notes |
|---|---|---|---|
| AWS | CIS AWS Foundations | v5.0 | Supported in AWS Security Hub CSPM (Oct 2025) |
| Azure | CIS Microsoft Azure Foundations | v3.0.0 | Released Feb 2025 |
| GCP | CIS Google Cloud Platform Foundation | v3.0 | Current stable |
| Kubernetes | CIS Kubernetes | v1.9.0 | Check cisecurity.org for latest |

### Level interpretation

- **Level 1**: Baseline security recommendations applicable to all environments. First to implement. A cloud account that fails L1 checks MUST NOT be promoted to production.
- **Level 2**: Additional controls for regulated workloads (PCI DSS, HIPAA, SOC 2, financial services). Implement L1 fully before adding L2 controls.

### Highest-impact control families

1. **Identity (IAM)**: MFA enforcement on root/admin accounts, no long-lived access keys, least-privilege policies. Most breaches begin here.
2. **Logging**: CloudTrail/Audit Logs enabled in all regions, S3/GCS access logging on, log integrity validation enabled. Required for forensics and incident response.
3. **Network**: Security groups/firewall rules restricting 0.0.0.0/0 ingress, no public exposure of management ports (22, 3389, 5432).

---

## 7. Incident Response

**Stability: VOLATILE** (IBM/Verizon annual reports update the median numbers)

### 2025 lifecycle benchmarks (IBM Cost of Data Breach 2025)

| Metric | 2025 Value | Trend | Implication |
|---|---|---|---|
| Mean time to identify (global) | 181 days | down from 204 days | Improving; detection tooling maturing |
| Mean time to contain (global) | 60 days | stable | Containment is the hard part post-detection |
| Total breach lifecycle | 241 days | lowest in 9 years | Still > 6 months for median organization |
| Cost if contained < 200 days | $3.87M | — | $1.14M cheaper than slow containment |
| Cost if contained > 200 days | $5.01M | — | The "200-day rule" cost gap |
| Average global breach cost | $4.44M | down 9% from $4.88M | AI/automation driving cost reduction |
| AI/automation lifecycle reduction | −108 days | extensive vs. no AI | Biggest single lever available |
| AI/automation cost saving | −$1.9M per incident | $3.62M vs. $5.52M | Justify SOAR/AI investment on this figure |

### IR phase checklist

1. **Prepare**: IR plan + runbooks tested ≥ annually; RACI for each severity tier; out-of-band comms channel (not email/Slack on compromised infra)
2. **Detect**: SIEM correlation rules tuned; EDR on all endpoints; secret scanning + cloud posture alerts in SIEM pipeline
3. **Contain**: Network segmentation ready to isolate; credential revocation runbook pre-approved; cloud account suspension procedure documented
4. **Eradicate**: Root cause analysis required before restore; supply-chain artifacts re-verified against SLSA provenance
5. **Recover**: Restore from known-clean backups; validate SBOM integrity of deployed artifacts; re-scan for indicators of compromise post-restore
6. **Post-incident**: Blameless retro within 5 days; update threat model; file CVE/disclosure if applicable; re-audit affected CIS controls

---

## Staleness flags — what to re-research when window expires

| Topic | What drifts | Re-research signal |
|---|---|---|
| Breach cost / MTTD / MTTR | IBM annual report (Jul each year) | IBM publishes new report |
| EPSS scores | Daily | Query FIRST EPSS API; don't cache more than 24h |
| KEV catalog | Weekly additions | CISA RSS feed |
| Secret leak volumes | GitGuardian annual report (Mar each year) | New report or >30 days stale |
| CIS benchmark versions | Version releases; check quarterly | New cloud provider announcement |
| OWASP Top 10 | ~3–4 year cycle; next: ~2028 | Stable until then |
| SLSA spec | v1.2 in active development | slsa.dev/spec/v1.2 release |
| SBOM compliance mandates | EO/regulatory changes | CISA/FDA regulatory calendar |
