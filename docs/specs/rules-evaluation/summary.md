# ECC Rule Pack Evaluation — Batch Summary

**Date:** 2026-04-13  
**Source:** affaan-m/everything-claude-code @ SHA 125d5e619905d97b519a887d5bc7332dcc448a52  
**Pack:** rules/typescript/ (5) + rules/common/ (10) + rules/golang/patterns.md + rules/web/design-quality.md + rules/rust/patterns.md + rules/python/patterns.md + rules/web/performance.md  
**Total evaluated:** 20 rules  
**Tier 2:** ran on original 3 adopt-with-edits verdicts (mandatory for global scope); golang + web are project scope (Tier 2 not mandatory)

> **Contamination caveat:** Rule content was fetched into session context before the skill was
> invoked. Default transcripts were elicited from first-principles TypeScript knowledge rather
> than a clean pre-read session. Treat high-confidence scores (DG=0/CD=0 rules) as reliable;
> borderline DG=1/CD=1 scores may be slightly generous.

---

## Adopt (adopt-with-edits)

| Rule | Verdict | DG/CD/FC/CC | Tier 2 | Adopt core | Edits required |
|---|---|---|---|---|---|
| `common/code-review.md` | adopt-with-edits | 2/2/1/1 | confirmed | Severity taxonomy (CRITICAL/HIGH/MEDIUM/LOW → BLOCK/WARN/INFO/NOTE), mandatory triggers, 80% hard minimum, Approve/Warning/Block outcome framework | Strip ECC agent table; replace with svc skill refs (review-security, audit-implementation, review-gate). **Consider project scope, not global.** |
| `common/development-workflow.md` | adopt-with-edits | 2/1/1/1 | confirmed | Step 0 only: `gh search repos/code` before implementing → vendor docs → broader web → package registries | Strip Steps 1-5 (ECC pipeline). Result is ~10 lines. Make Context7/Exa conditional. **Consider project scope.** |
| `common/performance.md` | adopt-with-edits | 2/2/1/0 | confirmed | Model selection table: Haiku→lightweight workers (3× cheaper), Sonnet→main dev+orchestration, Opus→deep reasoning/research | Update Opus 4.5 → 4.6 (current: claude-opus-4-6). Strip build-error-resolver section. Pin model IDs. |
| `golang/patterns.md` | adopt-with-edits | 2/0/0/0 | not run (project scope) | Functional Options pattern only — collapses 3-way constructor ambiguity (config struct vs functional opts vs builder) to one project convention | Strip Small Interfaces section (inflation), strip DI section (inflation), remove ECC skill ref |
| `web/design-quality.md` | adopt-with-edits | 2/2/1/0 | not run (project scope) | Anti-Template Policy (banned patterns), Required Qualities checklist (4 of 10), Before Writing Code sequence | Strip "Worthwhile Style Directions" list (inflation), remove ECC skill ref, add paths frontmatter to scope to frontend files |
| `rust/patterns.md` | adopt-with-edits | 2/0/1/0 | not run (project scope) | Newtype IDs, Builder for optional config, no-wildcard on business-critical enums | Strip Repository, Service Layer, Sealed Traits, API Envelope (all inflation). Trim Enum section to no-wildcard constraint only. |
| `python/patterns.md` | adopt-with-edits | 2/0/0/0 | not run (project scope) | Protocol for structural interfaces (collapses ABC vs Protocol vs duck-typing) | Strip Context Managers prose (inflation). Scope @dataclass to "internal DTOs, not API boundaries." |
| `web/performance.md` | adopt-with-edits | 2/2/1/0 | not run (project scope) | CWV targets table, bundle budgets (150/300/80kb), hero image eager+fetchpriority (corrects lazy default) | Strip "Prefer CSS for simple transitions" (inflation). Add paths frontmatter. Reclassify: correction not steering. |

**Adopt action:** create distilled rule files at `rules/code-review.md`, `rules/research-before-build.md`, `rules/model-selection.md`. Register in `rulesRegistry`. Source SHA: `125d5e619905d97b519a887d5bc7332dcc448a52`.

---

## Reject

| Rule | Verdict | DG/CD/FC/CC | Reason |
|---|---|---|---|
| `common/git-workflow.md` | **reject** | 1/0/1/**3** | HARD: "Attribution disabled globally" directly contradicts CLAUDE.md's locked Co-Authored-By requirement. Automatic reject (CC=3). |
| `common/agents.md` | **reject** | 1/1/2/2 | ECC-specific agent ecosystem (planner, tdd-guide, code-reviewer...) doesn't exist outside ECC. Conflicts with svc's route-workflow routing. FC=2, CC=2. |
| `typescript/hooks.md` | **reject** | 2/1/2/0 | Wrong primitive — setup documentation injected per-turn. FC=2. Hook config belongs in a setup skill or onboarding doc, not a per-turn rule. |

---

## Defer to Default (rule inflation)

| Rule | Verdict | DG/CD/FC/CC | Why inflation |
|---|---|---|---|
| `typescript/coding-style.md` | defer-to-default | 1/1/0/0 | TS type annotations, interface/type, no-any, no-`React.FC`, Zod — all deeply embedded defaults |
| `typescript/patterns.md` | defer-to-default | 1/1/0/0 | Repository pattern and useDebounce are defaults. API envelope shape is minor narrowing. |
| `typescript/security.md` | defer-to-default | 0/0/0/0 | "Never hardcode secrets, use env vars" is the single most embedded security default. Pure inflation. |
| `typescript/testing.md` | defer-to-default | 0/0/0/0 | Playwright is already Claude's default E2E recommendation for TS. |
| `common/coding-style.md` | defer-to-default | 1/1/0/0 | KISS/DRY/YAGNI, naming conventions, file/function size limits — universal principles already in defaults. |
| `common/hooks.md` | defer-to-default | 1/1/0/0 | Hook types and auto-accept guidance are known behavior. TodoWrite tips are mildly useful but not worth per-turn cost. |
| `common/patterns.md` | defer-to-default | 1/1/1/1 | Skeleton search pipeline is ECC-specific. Repository/API patterns are defaults. |
| `common/security.md` | defer-to-default | 1/0/0/0 | Security defaults (no secrets, validate, parameterized queries, XSS prevention) already deeply embedded. |
| `common/testing.md` | defer-to-default | 1/1/0/0 | TDD, 80% coverage, AAA, descriptive names — all already recommended. MANDATORY framing doesn't change outcomes. |

---

## Signal Summary

**Inflation rate:** 9/20 rules (45%) deferred to default. This confirms the pre-evaluation hypothesis about ECC's rule pack: the rules are excellent documentation for human developers, but they largely restate behavior Claude already exhibits. The value is in the 5 adopt candidates, not the other 12.

**Reject rate:** 3/20 (15%). Two ECC-ecosystem-specific rules that require ECC infrastructure (agents.md, hooks.md). One hard conflict with project architecture (git-workflow.md). The git-workflow conflict is the most important find — this rule would have silently removed commit attribution had it been adopted without evaluation.

**Stack-specific finding (golang/patterns.md):** ECC's golang pack has genuine steering value but only in one section (Functional Options). The other two sections (Small Interfaces, DI) are inflation — they restate Go doctrine Claude already applies. This is the expected pattern: language packs have a thin vein of real steering surrounded by human-documentation prose.

**Stack-specific finding (web/design-quality.md):** Strongest correction in the ECC web pack. Addresses real behavioral gap: unconstrained frontend → generic template UI. The Anti-Template Policy names exactly what Claude would produce by default. CD=2 justified.

**Stack-specific finding (rust/patterns.md):** Newtype pattern is the load-bearing section — genuine ~50/50 type-alias-vs-newtype variance collapsed to one convention. Four sections stripped as inflation (Repository, Service Layer, Sealed Traits, API Envelope). Pattern: ECC language packs have a thin vein of real steering surrounded by standard practices every Rust developer knows.

**Stack-specific finding (python/patterns.md):** Protocol vs ABC is the load-bearing section — genuine 3-way variance (Protocol vs ABC vs duck typing). Thinnest rule of all evaluated (12 lines after edit) with clear DG=2 signal. Context Managers section was the most obvious inflation of the entire 20-rule evaluation.

**Stack-specific finding (web/performance.md):** Strongest CD signal of the three stack evals. Hero image `loading="eager"` + `fetchpriority="high"` is a real correction — `loading="lazy"` is the default habit that hurts LCP. Bundle budgets convert vague directional advice ("aim smaller") to specific KB thresholds. Reclassified correction not steering: it fixes wrong defaults, not just collapses valid variance.

**Cross-stack pattern:** In every stack pack evaluated, real steering/correction value was found in exactly one section per file. The rest is human-documentation prose that read as directives but changes no behavior. Inflation rate for individual sections within adopted rules: ~60-70% even in the "adopt" pool.

**Top finding:** `common/git-workflow.md`'s attribution-disabled line is a silent convention bomb. Without evaluate-rule, this would have been easy to adopt as "just a git rule." The CC=3 catch is exactly what the skill was designed to surface.

**Strongest adopt candidate:** `common/performance.md` → `rules/model-selection.md`. The model selection decision table fills a genuine gap — Claude's multi-agent model recommendations are vague without it.

---

## Next Steps

1. **Create distilled rules** (3 files to write):
   - `rules/code-review.md` — severity taxonomy + checklist, stripped of ECC agents, scope=project
   - `rules/research-before-build.md` — Step 0 only (~10 lines), scope=project or global
   - `rules/model-selection.md` — Haiku/Sonnet/Opus table, Opus version updated, scope=global

2. **Register in rulesRegistry** — add each entry to `skills-manifest.json` with `source: "blended:ecc"`, SHA pinned, `last_evaluated: "2026-04-13"`

3. **Run linter** — `node scripts/lint-skills-manifest.mjs` to verify registry ↔ filesystem

4. **Delete or archive rejected/deferred files** — do not add them to `rules/`; the evaluation record in `docs/specs/rules-evaluation/` is sufficient audit trail

5. **Add evaluate-rule to blend-external re-blend cadence** — when a new ECC version is released, re-run this batch against new/modified rules
