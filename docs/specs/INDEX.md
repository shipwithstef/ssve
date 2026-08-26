# Documentation Index — Authority Registry

Registry of framework documentation authorities: which file owns which truth,
and what each must stay in sync with. Created by WI-FW-DOCS-AUDIT-01
(2026-08-26) after a docs-drift audit showed agents repeating stale facts
from unsynced authority docs.

Mechanical drift detection: `node scripts/audit-framework-docs.mjs`
(wired as tier-1 `validate-framework-docs-audit.sh`). Run it after editing any
file in the table below.

## Authority table

| File | Authority over | Must stay in sync with |
|------|----------------|------------------------|
| `skills-manifest.json` | Skill registry, lanes, gates, rules registry, bootstrap sequence | Source of truth — others sync TO it |
| `README.md` | Skill list/order, host setup commands | `skills-manifest.json` (`includedSkills`) |
| `FRAMEWORK-STATE.md` | Framework self-knowledge: counts, capability matrix, known gaps, analysis history | Disk+manifest reality (agents/rules/skills/refdoc counts); its own 50KB ceiling; `FRAMEWORK-STATE-ARCHIVE/*` existence |
| `AGENTS.md` / `CLAUDE.md` | Repo agent guidance: stack, structure, hooks/rules/agents summaries | Same counts as FRAMEWORK-STATE; `provision/hosts/*.json`; `agents/README.md` roster |
| `DOCTRINE.md` | Methodology, review gates G1–G7, progressive narrowing | Gate/lane definitions in `skills-manifest.json` |
| `HOSTS.md` | Per-host context file + install command table | `provision/hosts/*.json` (one row per host file) |
| `REPO_MODES.md` | Bootstrap sequence | `bootstrapStartSequence` in manifest |
| `EXTERNAL_ADDONS.md` | Core pack list | `corePackForRouting` in manifest |
| `WORKTREES.md` | Worktree model | `scripts/worktree.sh` behavior |
| `OPEN-PROPOSALS.md` | Improvement backlog | Landed WIs marked LANDED; residue marked historical |
| `docs/specs/work-items/INDEX.md` | Work-item registry | `docs/specs/work-items/WI-*.md` files |
| `references/knowledge/INDEX.md` | Knowledge-domain catalog | `references/knowledge/domains/*/CAPABILITIES.md` (+ freshness dates) |
| `provision/hosts/*.json` | Host manifests (paths, hook events, wiring) | Source of truth per host — docs sync TO these |

## Sync rules

1. Countable claims (skills/agents/rules/reference-docs) belong in exactly one
   place per doc, stated as "current count + where the live list lives", never
   as frozen enumerations (enumerations rotted twice before this registry).
2. Any doc referencing an archive/history path must point at an existing file;
   conventions with placeholders (`<date>`, `<period>`) are exempt.
3. Historical records (`proposals/done/`, `docs/plans/*/manifest.md`,
   superseded sections) are never rewritten — mark them superseded/residue
   in place instead.
4. After editing any authority doc, run:
   `node scripts/audit-framework-docs.mjs && node scripts/lint-skills-manifest.mjs`

## Audit history

- 2026-08-26 — WI-FW-DOCS-AUDIT-01 initial audit:
  `proposals/2026-08-26-framework-docs-audit-findings.md` (13 findings,
  F1–F8 fixed same session).
