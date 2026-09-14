# Research Pre-Scope — www.geminixprize.com

**Generated:** 2026-05-20T23:13:24.744Z
**Source:** https://www.geminixprize.com
**Generator:** research/scripts/website-prescope.mjs
**Proposed domain:** hackathons

## Sub-agent selection

- **Primary:** gemini-cli (per rules/research-must-use-gemini-cli.md)
- **Selected for this run:** gemini-cli — long-context site extraction
- **Fallback if gemini-cli fails:** Claude in-session via WebFetch loop

## Volume estimate

- Sitemap URLs found: 3
- Imprint pattern matches on homepage: 0
- robots.txt fetched: yes
- Homepage fetched: yes

## Imprint patterns detected (across homepage + likely-imprint pages)

Pages probed: 10
- https://www.geminixprize.com/
- https://www.geminixprize.com/общи-условия/
- https://www.geminixprize.com/контакти/
- https://www.geminixprize.com/за-нас/
- https://www.geminixprize.com/about/
- https://www.geminixprize.com/contact/
- https://www.geminixprize.com/terms/
- https://www.geminixprize.com/политика-за-поверителност/
- https://www.geminixprize.com/privacy/
- https://www.geminixprize.com/imprint/

Matches (deduped, with source):
_None matched. Either site has no public imprint OR patterns need extension. Verify manually before declaring "no EIK"._

## File checklist (URLs to extract)

Every URL below MUST be fetched, read in full, and have an extraction entry in the corresponding details/ file or CAPABILITIES.md.

- [ ] https://www.geminixprize.com
- [ ] https://www.geminixprize.com/
- [ ] https://www.geminixprize.com/rules

## Extraction plan

- Output domain: `/workspace/seriousvibecoding/references/knowledge/hackathons/`
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
node research/scripts/coverage-check.mjs --prescope /workspace/seriousvibecoding/docs/specs/research-prescope-www-geminixprize-com.md --domain references/knowledge/<domain>/
```
Coverage must be 100% (every checklist URL appears in .sources.jsonl).
