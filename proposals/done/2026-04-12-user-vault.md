# Framework Improvement: User Vault — Private Data Routing

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** User-reported gap
- **Finding:** find-opportunity, research (private repos), mine-builder write to `docs/specs/` in the active project repo. When the active repo IS the public framework repo (vibomatic), personal financial strategy, builder profile, and private repo analysis (e.g., sentinel-vibe layering) land in public git history.
- **Severity:** HIGH (privacy)

## Diagnosis
- **Root cause:** Skills have no concept of "user-private output." All outputs go to the current project's `docs/specs/` by convention, which is correct for product work but wrong when private user data is involved.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No (new)

## Implementation
- **Route:** Direct (new reference doc + repo creation + vault config)
- **Files changed:**
  - `references/user-vault.md` (new) — full vault pattern definition
  - `FRAMEWORK-STATE.md` — analysis history entry, known gaps row, ref count 13→14
- **External state:**
  - `github.com/s7an-it/svc-vault` (private repo created)
  - `~/.svc/vault` (local clone)
  - `~/.svc/vault-config.json` (vault config)
  - Vault seeded: opportunities/top-3-opportunities.md, research/research-log-private.md, builder/builder-profile.md

## What the vault contract says

| Goes to vault | Stays in project/framework repo |
|---|---|
| find-opportunity output | Framework skill edits |
| Private repo research | Public tool research (knowledge/) |
| Builder profile snapshot | Product specs |
| Revenue/pricing decisions | FRAMEWORK-STATE.md |

## Replay Verification
- **Replay target:** structural — vault exists, config exists, content seeded
- **Result:** PASS
- **Evidence:** `gh repo view s7an-it/svc-vault` returns private repo; `ls ~/.svc/vault/` shows opportunities/, research/, builder/

## Remaining Gap (logged in Known Gaps)
Skill-level vault routing not yet wired into find-opportunity/research/mine-builder SKILL.md files. The reference doc defines the contract; the skill edits are a 0.5-day follow-up.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added user-vault entry
- **Known Gaps:** Added vault routing row
- **Current State:** Reference docs 13 → 14
