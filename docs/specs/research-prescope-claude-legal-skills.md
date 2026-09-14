# Pre-Scope: claude-legal-skills

**Source:** https://github.com/anthropics/knowledge-work-plugins/tree/main/legal
**Invoked by:** standalone
**Date:** 2026-05-13

## Volume Estimate

- Total files (substantive, excluding images/licenses/generated): 11
- Approx total tokens / lines: ~1500 lines
- Top-level areas/sections:
  - CONNECTORS
  - review-contract
  - brief
  - compliance-check
  - meeting-briefing
  - signature-request
  - vendor-check
  - triage-nda
  - legal-response
  - legal-risk-assessment

## File Checklist (manifest)

Every substantive file that MUST be read in the single pass:

- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/README.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/CONNECTORS.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/review-contract/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/brief/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/compliance-check/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/meeting-briefing/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/signature-request/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/vendor-check/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/triage-nda/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/legal-response/SKILL.md
- [ ] /home/svc-user/.gemini/tmp/seriousvibecoding/knowledge-work-plugins/legal/skills/legal-risk-assessment/SKILL.md

## Extraction Plan

- Pass strategy: single-pass across all checklist files
- Target detail files: `references/knowledge/claude-legal-skills/details/connectors.md`, `references/knowledge/claude-legal-skills/details/skills.md`
- Domain classification: claude-legal-skills (justification: these are official anthropic legal skills plugins and MCPs for knowledge workers)

## Sub-Agent Selection

- Primary: gemini-cli (default — REQUIRED unless gemini-cli has actually failed)
- Fallback: Claude (in-session) if gemini errors, runs out of credits, or stalls mid-pass
- Selected for this run: gemini-cli — primary agent available

## Expected Output Artifacts

- `references/knowledge/claude-legal-skills/CAPABILITIES.md` (Layer 2)
- `references/knowledge/claude-legal-skills/details/connectors.md` (Layer 3)
- `references/knowledge/claude-legal-skills/details/skills.md` (Layer 3)
- `references/knowledge/claude-legal-skills/.version`
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended