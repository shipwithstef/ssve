# Router Context

Last updated: 2026-05-04 by audit-session-execution

## Required Skills By Intent

| Intent | Skill | Notes |
|--------|-------|-------|
| research URL/question | `research` | Always check knowledge base first |
| new feature idea | `validate-feature` | Business validation before spec |
| spec writing | `write-spec` | DRAFT output, requires G1 review |
| UX design | `design-ux` | After spec, before UI |
| UI design | `design-ui` | After UX, before tech |
| tech design | `design-tech` | After UI, before plan |
| implementation | `execute-changeset` | Worktree required |
| code review | `review-gate` | G1-G7 protocol |
| bugfix | `diagnose-bug` | Root-cause first, no spec forced |
| framework gap | `evolve-framework` | Evidence before proposals |
| framework fix | `improve-framework` | Fix-ready file list |
| session audit | `audit-session-execution` | Evidence order: task graph > transcript |
| landing page | `landing-page` | Chains marketing + benchmark |
| competitor research | `analyze-competitors` | After domain, before personas |
| readiness check | `assess-market-readiness` | Terminal skill, no active WIs |

## Precedence

- repo override (`AGENTS.md`) > skill contract (`SKILL.md`) > framework doctrine (`DOCTRINE.md`) > global fallback
- Worktree rule: feature code NEVER lands on main directly
- Lane rule: framework work skips design-tech when surface is bounded

## Forbidden Tools Or Flows

- `git push --force` — branch protection is on, use squash-merge via `land-changeset`
- Direct `git commit` without Co-Authored-By trailer — commit hook blocks
- `rm -rf /` or `--force` in plans — `verify-plan-mechanical.sh` scans for these
- Editing `.env`, `.git/`, `FRAMEWORK-STATE.md` without guard override — workflow-guard blocks
- `--no-verify` git bypass — bash-guard blocks
- Config/lockfile edits outside plan-changeset — workflow-guard warns

## Code Style Authority

- Canonical source: `AGENTS.md` (root) + skill-local `SKILL.md` frontmatter
- Overrides generic/global rules: yes
- Shell: portable bash with `set -euo pipefail`
- Node.js: `.mjs` with inline `#!/usr/bin/env node` shebang
- Markdown: concise, imperative, operational; YAML frontmatter preserved

## Deployment / Runtime Contract

- Runtime/platform signals: `setup` (bash installer), `skills-manifest.json` (registry), `test-framework/` (evals)
- Deploy path: `./setup --host <host>` to install/refresh; no traditional deploy target
- Anti-patterns: No Docker, no CI/CD platform, no compiled artifact
- Test before commit: `bash test-framework/evals/run-all-evals.sh`
- Manifest lint after changes: `node scripts/lint-skills-manifest.mjs`

## Delegation Notes

- Single-agent only for: skill editing (SKILL.md frontmatter integrity), manifest linting (cross-file consistency), hook wiring (host-specific)
- Delegation allowed for: research extraction (gemini-cli primary, Claude fallback), website prescope (multi-URL), competitive analysis (multi-competitor)
- Ownership caveats: `skills-manifest.json`, `README.md`, `EXTERNAL_ADDONS.md`, `REPO_MODES.md` must stay in sync — edit one, update all
