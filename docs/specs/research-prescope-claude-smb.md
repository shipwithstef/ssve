# Research Pre-Scope — claude-smb

**Generated:** 2026-05-14T00:00:00.000Z
**Source:** https://www.anthropic.com/news/claude-for-small-business
**Proposed domain:** claude-smb

## Sub-agent selection

- **Primary:** gemini-cli (per rules/research-must-use-gemini-cli.md)
- **Selected for this run:** gemini-cli — targeted single-article extraction
- **Fallback if gemini-cli fails:** Claude in-session via WebFetch loop

## Volume estimate

- Sitemap URLs found: 1

## File checklist (URLs to extract)

Every URL below MUST be fetched, read in full, and have an extraction entry in the corresponding details/ file or CAPABILITIES.md.

- [ ] https://www.anthropic.com/news/claude-for-small-business

## Extraction plan

- Output domain: `references/knowledge/claude-smb/`
- CAPABILITIES.md: main overview, capabilities, and announcements from the article.

## Expected output artifacts

- `references/knowledge/claude-smb/CAPABILITIES.md`
- `references/knowledge/claude-smb/.version`
- `references/knowledge/claude-smb/.sources.jsonl`
- `docs/specs/research-log.md` (append entry)

## Coverage gate

After extraction, run:
```
node research/scripts/coverage-check.mjs --prescope docs/specs/research-prescope-claude-smb.md --domain references/knowledge/claude-smb/
```
Coverage must be 100% (every checklist URL appears in .sources.jsonl).