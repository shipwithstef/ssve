# Research Pre-Scope — www.b-trust.bg

**Generated:** 2026-05-03T05:12:12.474Z
**Source:** https://www.b-trust.bg
**Generator:** research/scripts/website-prescope.mjs
**Proposed domain:** competitors/b-trust-bg

## Sub-agent selection

- **Primary:** gemini-cli (per rules/research-must-use-gemini-cli.md)
- **Selected for this run:** gemini-cli — long-context site extraction
- **Fallback if gemini-cli fails:** Claude in-session via WebFetch loop

## Volume estimate

- Sitemap URLs found: 42
- Imprint pattern matches on homepage: 0
- robots.txt fetched: yes
- Homepage fetched: yes

## Imprint patterns detected (across homepage + likely-imprint pages)

Pages probed: 11
- https://www.b-trust.bg/
- https://www.b-trust.bg/общи-условия/
- https://www.b-trust.bg/контакти/
- https://www.b-trust.bg/за-нас/
- https://www.b-trust.bg/about/
- https://www.b-trust.bg/contact/
- https://www.b-trust.bg/terms/
- https://www.b-trust.bg/политика-за-поверителност/
- https://www.b-trust.bg/privacy/
- https://www.b-trust.bg/imprint/
- https://www.b-trust.bg/contacts

Matches (deduped, with source):
_None matched. Either site has no public imprint OR patterns need extension. Verify manually before declaring "no EIK"._

## File checklist (URLs to extract)

Every URL below MUST be fetched, read in full, and have an extraction entry in the corresponding details/ file or CAPABILITIES.md.

- [ ] https://www.b-trust.bg/
- [ ] https://www.b-trust.bg/client-center/signature-installation
- [ ] https://www.b-trust.bg/client-center/system-requirements
- [ ] https://www.b-trust.bg/client-center/temporary-suspension
- [ ] https://www.b-trust.bg/contacts
- [ ] https://www.b-trust.bg/documents
- [ ] https://www.b-trust.bg/electronic-signatures
- [ ] https://www.b-trust.bg/electronic-signatures/advanced-certificates
- [ ] https://www.b-trust.bg/electronic-signatures/cards-and-readers
- [ ] https://www.b-trust.bg/electronic-signatures/cloud-certificates
- [ ] https://www.b-trust.bg/electronic-signatures/electronic-signature-usage
- [ ] https://www.b-trust.bg/electronic-signatures/pricing
- [ ] https://www.b-trust.bg/electronic-signatures/products/qualified-certificates/cloud
- [ ] https://www.b-trust.bg/electronic-signatures/products/qualified-certificates/personal
- [ ] https://www.b-trust.bg/electronic-signatures/products/qualified-certificates/professional
- [ ] https://www.b-trust.bg/electronic-signatures/psd2-certificates
- [ ] https://www.b-trust.bg/electronic-signatures/qualified-certificates
- [ ] https://www.b-trust.bg/electronic-signatures/required-documents
- [ ] https://www.b-trust.bg/electronic-signatures/specialized-certificates
- [ ] https://www.b-trust.bg/electronic-signatures/what-is-electronic-signature
- [ ] https://www.b-trust.bg/en
- [ ] https://www.b-trust.bg/mobile
- [ ] https://www.b-trust.bg/queries
- [ ] https://www.b-trust.bg/queries/canceled-signatures
- [ ] https://www.b-trust.bg/queries/certificate-search
- [ ] https://www.b-trust.bg/queries/certificate-status
- [ ] https://www.b-trust.bg/queries/certification-chains-installation
- [ ] https://www.b-trust.bg/queries/ocsp-status-check
- [ ] https://www.b-trust.bg/search
- [ ] https://www.b-trust.bg/services
- [ ] https://www.b-trust.bg/services/b-token
- [ ] https://www.b-trust.bg/services/developers
- [ ] https://www.b-trust.bg/services/dss-verify
- [ ] https://www.b-trust.bg/services/e-archive
- [ ] https://www.b-trust.bg/services/electronic-identification
- [ ] https://www.b-trust.bg/services/my-b-trust
- [ ] https://www.b-trust.bg/services/preporachana-poshta
- [ ] https://www.b-trust.bg/services/remote-signing-platform
- [ ] https://www.b-trust.bg/services/software
- [ ] https://www.b-trust.bg/services/time-stamp-issue
- [ ] https://www.b-trust.bg/services/uslugi-za-biznesa
- [ ] https://www.b-trust.bg/services/web-identification

## Extraction plan

- Output domain: `references/knowledge/competitors/b-trust-bg/`
- CAPABILITIES.md: site identity, services, pricing, legal status
- details/about.md: ownership, advocate names, Bar registration, EIK/BULSTAT, VAT
- details/services.md: each service with verbatim pricing
- details/legal.md: T&C, refund policy, disclaimers, supervisory authority
- details/contact.md: contact methods, address, sub-pages list

## Expected output artifacts

- `references/knowledge/<domain>/CAPABILITIES.md`
- `references/knowledge/<domain>/details/*.md` (one per area)
- `references/knowledge/<domain>/.version`
- `references/knowledge/<domain>/.sources.jsonl` (one entry per URL above)
- `docs/specs/research-log.md` (append entry)
- INDEX.md updated

## Coverage gate

After extraction, run:
```
node research/scripts/coverage-check.mjs --prescope /workspace/seriousvibecoding/docs/specs/research-prescope-www-b-trust-bg.md --domain references/knowledge/<domain>/
```
Coverage must be 100% (every checklist URL appears in .sources.jsonl).
