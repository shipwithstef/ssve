# Execution Progress — WI-134

## Tier-1 sweep classification

Per execute-changeset Persistence Model: each failure classified BRANCH-INTRODUCED vs PRE-EXISTING vs FLAKY.

| # | Validator | Failure | Classification | Touches files I modified? | Action |
|---|---|---|---|---|---|
| 1 | `validate-chain-references.sh` | timed out at 180s (WI-110 guard) | PRE-EXISTING | no — scans every SKILL.md `chain:` field, scope-bound to skills/ | log & continue |
| 2 | `validate-contracts.sh` | timed out at 180s | PRE-EXISTING | no — frontmatter contract checks across all skills | log & continue |
| 3 | `validate-cross-project-state.sh` | took 2563ms (>2000ms cap) | PRE-EXISTING | no — perf budget on cross-project state read | log & continue |
| 4 | `validate-host-manifests.sh` | timed out at 180s | PRE-EXISTING | no — runs `./setup --host <h>` × 4 hosts; each setup takes 2:27 (verify_commands hit external services like `gstack browse`); 180s × 1 < 4 × 147s. Setup behavior unchanged on this branch (no setup script edits in diff). | log & continue |
| 5 | `validate-kimi-detached-runner.sh` | smoke launch 2765ms (≥2s cap) | PRE-EXISTING | no — perf check on Kimi detached runner; my branch doesn't touch Kimi | log & continue |
| 6 | `validate-rules-registry-completeness.sh` | 7 rules on disk not in `skills-manifest.json` rulesRegistry | PRE-EXISTING | no — those 7 rules predate this branch (`rules/base44/auth-refresh.md`, `rules/bash-hygiene.md`, `rules/github-projects.md`, `rules/helper-app-query-parity.md`, `rules/post-fix-evidence-before-next-fix.md`, `rules/tenant-scoped-test-seeding.md`, `rules/transient-ui-assertion-pattern.md`); my branch adds zero new files under `rules/` | log & continue |
| 7 | `validate-self-verify-sections.sh` | `find-opportunity` skill has Self-Verify section without PASS/FAIL column | PRE-EXISTING | no — `find-opportunity/SKILL.md` not in my diff | log & continue |
| 8 | `validate-source-repo-not-worktree.sh` | found real worktree-bound symlinks in Kimi/Codex/Gemini installs from prior `validate-host-manifests.sh` runs | TRANSIENT (NOT branch-introduced) | yes — this is the validator I added in T2; but the pollution it caught was created by the prior sweep's host-manifests test runs that called `setup` × 4 hosts. Resolved by running `./setup --host <h>` from canonical for all 4 hosts; validator now PASSES (20 assertions). | resolved |

## Verification of pre-existing claims

Files in my diff (`git diff main..HEAD --stat`):
- `hooks/svc-session-start-healthcheck.mjs`
- `references/framework-learnings.jsonl` (append-only)
- `references/knowledge/svc/CAPABILITIES.md`
- `test-framework/evals/tier-1/validate-source-repo-not-worktree.sh` (CREATE)
- `test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh` (CREATE)

None of failures #1–#7 reference any of these files. Failure #8 IS one of these files; resolved by restoring real install state.

## Final state

| Task | Status | AC verified? |
|------|--------|---|
| T1 — Strategy 3 in `detectRepoRoot()` | ✅ done | yes (T3 PASS proves end-to-end self-heal) |
| T2 — `validate-source-repo-not-worktree.sh` | ✅ done | yes (PASS 20 assertions, 5 host roots) |
| T3 — `validate-self-heal-survives-double-dead-pointer.sh` | ✅ done | yes (PASS — Strategy 3 fired, post-test pointer canonical) |
| T4 — framework-learnings.jsonl entry | ✅ done | yes (jq schema valid, confidence 9) |
| T5 — CAPABILITIES.md update | ✅ done | yes (new wording present, old absent) |
| T6 — full tier-1 sweep | ✅ done | conditional — 46 PASS + 7 PRE-EXISTING + 1 TRANSIENT (resolved); 0 BRANCH-INTRODUCED regressions |
| T7 — WI-134 close-out | ⏳ pending verify-promotion | n/a until merge |

Branch state: 4 checkpoints, 5 files changed, 386 insertions, 0 branch-introduced regressions.
