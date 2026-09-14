---
source: coreyhaines31/marketingskills
from_version: v1.1.0
to_version: v1.9.0
date: 2026-04-28
mode: analysis
---

# Pre-Scope: Corey Haines Marketing Skills v1.1.0 → v1.9.0

## Volume Estimate

- **Total changed files:** 275
- **Insertions:** 42,214 lines
- **Deletions:** 237 lines
- **New skills:** 18 (from 22 to 40 total)
- **New tools:** 51+ CLI tools, Composio MCP, 52+ integration guides

## Top-Level Areas

1. **New Skills** — 18 skills added across versions
2. **Skill Improvements** — Existing skills enhanced with new sections
3. **Tools & Integrations** — CLI tools, MCP servers, integration guides
4. **Infrastructure** — Plugin support, evals, validation scripts
5. **Documentation** — README, AGENTS.md, VERSIONS.md updates

## File Checklist (Manifest)

### New Skills (18)
- [ ] skills/aso-audit/SKILL.md + references/
- [ ] skills/churn-prevention/SKILL.md + references/
- [ ] skills/cold-email/SKILL.md + references/
- [ ] skills/community-marketing/SKILL.md
- [ ] skills/competitor-profiling/SKILL.md + references/
- [ ] skills/customer-research/SKILL.md + references/
- [ ] skills/directory-submissions/SKILL.md + references/
- [ ] skills/image/SKILL.md + references/
- [ ] skills/lead-magnets/SKILL.md + references/
- [ ] skills/revops/SKILL.md + references/
- [ ] skills/sales-enablement/SKILL.md + references/
- [ ] skills/site-architecture/SKILL.md + references/
- [ ] skills/video/SKILL.md + references/

### Major Skill Improvements
- [ ] skills/ai-seo/SKILL.md (pricing.md recommendation)
- [ ] skills/ab-test-setup/SKILL.md (Growth Experimentation Program)
- [ ] skills/social-content/SKILL.md (short-form video, platform limits)
- [ ] skills/copy-editing/SKILL.md (expert panel, content refresh)
- [ ] skills/seo-audit/SKILL.md (international SEO)
- [ ] skills/paid-ads/SKILL.md (conversion tracking)

### Tools Directory
- [ ] tools/clis/ (51 CLI tools)
- [ ] tools/composio/ (MCP integration layer)
- [ ] tools/integrations/ (52+ integration guides)

### Infrastructure
- [ ] .claude-plugin/marketplace.json
- [ ] .claude-plugin/plugin.json
- [ ] validate-skills-official.sh
- [ ] validate-skills.sh
- [ ] VERSIONS.md

## Extraction Plan

| Detail File | Content |
|-------------|---------|
| `details/new-skills-v1.2-v1.9.md` | All 18 new skills: descriptions, key capabilities, use cases |
| `details/skill-improvements.md` | Enhancements to existing skills |
| `details/tools-registry.md` | CLI tools, Composio, integration guides |
| `details/infrastructure.md` | Plugin support, evals, validation |
| `details/version-changelog.md` | Per-version release notes |

## Sub-Agent Selection

**Selected:** Claude (in-session)
**Reason:** Repo is already cloned locally at `~/.svc/external-skills/marketingskills`. Files are accessible via direct read. No need for gemini-cli long-context extraction — we can do targeted reads of SKILL.md files and key references.

## Expected Output Artifacts

1. `references/knowledge/competitors/coreyhaines-martech/CAPABILITIES.md`
2. `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v1.2-v1.9.md`
3. `references/knowledge/competitors/coreyhaines-martech/details/skill-improvements.md`
4. `references/knowledge/competitors/coreyhaines-martech/details/tools-registry.md`
5. `references/knowledge/competitors/coreyhaines-martech/details/infrastructure.md`
6. `references/knowledge/competitors/coreyhaines-martech/details/version-changelog.md`
7. `references/knowledge/competitors/coreyhaines-martech/.version`
8. `references/knowledge/INDEX.md` (updated)
9. `docs/specs/research-log.md` (entry added)
