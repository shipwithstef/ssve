# Framework Improvement: Rules as First-Class Primitive (P0)

**Status:** IMPLEMENTED P0 (2026-04-13). P1/P2/P3 deferred per proposal scope.

## Evidence
- **Source:** User request (Stefan) + `proposals/done/2026-04-13-rules-as-primitive.md` (this session's evolve-framework output)
- **Finding:** svc shipped `rules/tool-selection.md` with no manifest/linter awareness. `audit-coverage/SKILL.md:98` scanned foreign repos for `~/.claude/rules/*`, but svc had not formalised rules as a primitive. Upstream `everything-claude-code` ships 15 language rule directories; prior 2026-04-12 blend took 8 patterns but silently skipped the rules primitive.
- **Severity:** medium (not blocking existing work; high leverage for future rule-pack blends)

## Diagnosis
- **Root cause:** Organic accumulation of rule-shaped artifacts (`rules/tool-selection.md`, `references/subagent-context-rules.md`, `references/anti-patterns.md`) with no explicit classification or manifest lifecycle.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No (new finding)

## Implementation
- **Route:** direct skill/manifest/script edits (mechanical P0), matches `improve-framework` Step 5 "isolated surgery" route
- **Files changed:**
  - `skills-manifest.json` — added `rulesRegistry.entries[]` with first entry for `rules/tool-selection.md`; fixed collateral `corePackForRouting` drift (`assess-market-readiness`)
  - `scripts/lint-skills-manifest.mjs` — added `assertRulesRegistry()` (lines 143-197): validates schema, enforces filesystem ↔ registry coverage
  - `references/rules-policy.md` — new 80-line policy document
  - `FRAMEWORK-STATE.md` — Current State bumped to 16 reference docs + new Primitives line; Analysis History entry for this change
- **Commits:** (pending — user to commit)

## Replay Verification
- **Replay target:** `node scripts/lint-skills-manifest.mjs` with the schema active
- **Result:** PASS (50 skills, 1 rule registered, rulesRegistry schema enforced)
- **Negative case:** created `rules/_lint_test.md` unregistered — linter failed with `rules/ file not registered in rulesRegistry: rules/_lint_test.md`. Removed. Linter now green.
- **No regression:** Tier-1 `validate-skill-structure.sh` — 565 passed, 0 failed.

## Deferred (explicit, with reasons)
- **F1-1 `evaluate-rule` skill:** requires `explore-solutions` per svc-on-svc hard-to-reverse architecture policy (new judgment persistence model). 4 candidate approaches documented in source proposal; decision not made in this pass.
- **F1-2 rules lifecycle refresh cadence:** gated on F1-1 (needs the evaluator to exist before a refresh loop makes sense).
- **F2-x `blend-rules` / `promote-to-rule`:** gated on F1-1.
- **Mass everything-claude-code language-pack import:** explicitly blocked until F1-1 ships, to prevent rule inflation anti-pattern per proposal.

## FRAMEWORK-STATE.md Mutations
- **Current State:** reference doc count 15→16; added `Primitives:` line naming skills + rules
- **Analysis History:** new 2026-04-13 entry "Rules as first-class primitive (P0 landed)" with files, deferrals, evidence
- **Known Gaps:** F1-1 / F1-2 / F2 items are now the next actionable framework work

## Next
`explore-solutions` on F1-1 `evaluate-rule` probe design before any SKILL.md is written. 4 candidate approaches pre-enumerated in the source proposal.
