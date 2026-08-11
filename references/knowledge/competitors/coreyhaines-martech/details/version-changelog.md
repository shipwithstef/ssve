# Version Changelog — Detail

## Mechanism (factual)

22 releases from v1.0.0 (Feb 4, 2026) to v2.6.0 (Jul 1, 2026). Release cadence: ~2-3 weeks (12 releases in the 10 weeks v1.9.0→v2.6.0). Maintained by Corey Haines + community PRs.

**Release timeline:**

| Version | Date | Skills | Key Change |
|---------|------|--------|------------|
| v1.0.0 | Feb 4 | 22 | Initial release |
| v1.1.0 | Feb 4 | 26 | Tools registry (29 guides), progressive disclosure |
| v1.2.0 | Feb 19 | 29 | ai-seo, churn-prevention, ad-creative, cold-email, 51 CLIs |
| v1.3.0 | Mar 2 | 32 | revops, sales-enablement, site-architecture, multi-agent |
| v1.4.0 | Mar 14 | 33 | lead-magnets, Composio, 197 evals, 10 new CLIs |
| v1.5.0 | Mar 28 | 34 | customer-research, Nitrosend, Firehose, Introw |
| v1.6.0 | Apr 6 | 35 | community-marketing, SparkToro, RB2B, Gong |
| v1.7.0 | Apr 13 | 36 | aso-audit, Zapier SDK |
| v1.8.0 | Apr 21 | 38 | directory-submissions, competitor-profiling, security hardening |
| v1.9.0 | Apr 24 | 40 | image, video, plugin fix ← previous svc blend baseline |
| v1.10.0 | May 4 | 41 | co-marketing |
| v2.0.0 | May 5 | 40 | **BREAKING**: 17 renames + page-cro/form-cro→cro; reinstall required |
| v2.0.1 | May 18 | 40 | ai-seo Google alignment; image/video May-2026 model refresh |
| v2.1.0 | May 21 | 41 | sms, 5 platform integrations |
| v2.2.0 | May 26 | 42 | prospecting, github-prospects CLI, ads RSA spec, plugin version-sync fix |
| v2.3.0 | May 27 | 43 | marketing-plan (fCMO AARRR generator) |
| v2.4.0/.1 | Jun 10 | 44 | public-relations (pr→renamed), social listening workflow |
| v2.4.2 | Jun 15 | 44 | ai-seo OKF (Open Knowledge Format) |
| v2.5.0/.1 | Jun 16 | 45 | offers, cross-ref version bumps (codex-review caught) |
| v2.6.0 | Jul 1 | 46 | marketing-loops (43-loop catalog), ads Andromeda playbook ← current svc analysis baseline |

**Notable PRs:**
- @basseko: aso-audit skill (#205), seo-audit international SEO (#215)
- @pangerlkr: community-marketing (#78)
- @njcameron: competitor-profiling (#225)
- @GonsalvesMedia: directory-submissions (#232)
- @Jiliac: cold-email (#51)
- @bensabic: GitHub workflows, repo essentials

## Analysis (expert commentary)

- **Useful for:** Understanding the evolution trajectory. v1.0-v1.2 built the "marketing core" (SEO, CRO, copy, ads). v1.3-v1.4 added "operations" (revops, sales, lead magnets). v1.5-v1.9 added "intelligence" (research, profiling, directories) and "content production" (image, video).
- **Trade-offs:** Fast release cadence (10 releases in 3 months) means some skills are shallow. Community contributions vary in quality — some lack evals.
- **Similar to:** svc's release pattern but faster. svc has fewer, more deliberate releases. coreyhaines prioritizes breadth over depth.
- **Could improve svc by:** The community PR model (external contributors add skills) is something svc could adopt for domain-specific skills.
- **Assumptions (REVISED 2026-07-13):** Releases were additive until v2.0.0, which broke compatibility (17 renames + consolidation, "users must reinstall"). Treat future major versions as potentially breaking; pin to tags, not main.
- **Watch out for:** v1.1.0 → v1.2.0 was a big jump (22 → 29 skills, 51 CLIs added). Quality may vary across rapid expansion. Post-v2.6.0 main carries unreleased skills (marketing-council) — pin to release tags.
- **v2.x trajectory:** v2.0 cleaned naming; v2.1–v2.5 filled channel gaps (sms, prospecting, pr, offers); v2.6 added the meta-layer (marketing-loops = recurring ops orchestrating the one-shot skills). The pack is evolving from a skill library into a marketing operating system — the same direction svc's company-operating-fleet took, but with lighter-weight guardrail machinery (caps/allowlists/kill-switch vs svc's receipt chain).

## Key Source Files (L4 pointers)

- `VERSIONS.md` — Central version registry with per-skill versions + recent changes section
- `CHANGELOG` (in VERSIONS.md "Recent Changes" section) — Per-version release notes
- `.github/FUNDING.yml` — Sponsorship configuration (buymeacoffee.com/coreyhaines)
