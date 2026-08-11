# Blend Plan: coreyhaines marketing skills

**Source:** https://github.com/coreyhaines31/marketingskills
**SHA:** v1.9.0 (1bcff9fc79c64fd7886c3c7aa583f4bd63916ff2)
**Date:** 2026-04-28
**Previous blend:** first blend

## Summary

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | "Before Starting" context gate | All svc skills | Skills load context inconsistently, miss product context | Unified context loading pattern |
| 2 | Behavioral evals (conversation → assertion) | test-framework | Only structural tests, no behavioral verification | Tier-2 gets conversation-input eval format |
| 3 | Progressive disclosure (references on demand) | All svc skills | Full skill loaded every time, wasting tokens | Core instructions + on-demand references |
| 4 | Foundation context pattern | analyze-marketing | No shared canonical context file | `.agents/product-marketing-context.md` as canonical |

**External addon:** YES — coreyhaines stays as external addon for runtime marketing execution. The 40 skills and 61 CLIs are NOT worth rebuilding in svc.

## Assessment A: Blend Opportunities

### Pattern 1: "Before Starting" Context Gate → All svc skills

**From:** Every coreyhaines SKILL.md (first section after frontmatter)
**Into:** svc skill convention (CONTRIBUTING.md + individual skills)

**The problem in svc today:**
svc skills check for context in inconsistent locations. Some check `.agents/`, some check `docs/specs/`, some check both, some don't check at all. There's no standard "read this first" pattern. Result: skills ask questions already answered, waste tokens re-gathering known information.

**How the source solves it:**
Every coreyhaines skill starts with:
```
## Before Starting
**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists, read it before asking questions. Use that context and only ask for information not already covered.
```
This is a single, consistent pattern across all 40 skills. Every skill reads the same foundation file first.

**What this changes in svc:**
Add to CONTRIBUTING.md a new convention:
```
## Before Starting
**Check for project context first:**
Read `docs/specs/project-state.md` + `~/.svc/builder-profile.md` before asking questions. Use existing context to skip questions already answered.
```
Each skill's SKILL.md gets a "Before Starting" section pointing to the relevant context sources.

**What NOT to take:**
- Don't force all skills to read the SAME file (svc has multiple context sources by design)
- Don't make it a hard gate — some skills legitimately need fresh input

**Why this matters:**
Reduces token waste. Currently svc skills may re-ask builder profile questions, re-analyze domain, etc. A standard "check existing context first" pattern prevents this.

**Hybrid opportunity:** svc can be BETTER than coreyhaines here. Instead of one context file, svc can have a "context loading chain" — project-state → builder-profile → domain-profile → feature-spec — where each skill reads only the context it needs from the chain. coreyhaines has one file; svc can have a layered context system.

---

### Pattern 2: Behavioral Evals → test-framework

**From:** `skills/*/evals/evals.json` (197 evals across 33 skills)
**Into:** `test-framework/evals/tier-2/`

**The problem in svc today:**
svc's tier-1 tests are structural (YAML validation, frontmatter AST, markdown AST). Tier-2 tests are integration scenarios but don't verify behavioral correctness — "given this input, does the skill produce the right output?" There's no conversation-input → expected-assertion pattern.

**How the source solves it:**
Each eval has:
```json
{
  "conversation": [{"role": "user", "content": "..."}],
  "assertions": [{"type": "contains", "value": "..."}],
  "boundary": [{"input": "...", "expected": "..."}]
}
```
This enables automated verification: send the conversation, check assertions pass.

**What this changes in svc:**
Add a new eval format to tier-2:
```
test-framework/evals/tier-2/evals/
  <skill-name>/
    scenario-1.json  # conversation + assertions
    scenario-2.json
```
This supplements (not replaces) existing tier-2 integration scenarios.

**What NOT to take:**
- Don't replace tier-2 integration scenarios — they test different things (file existence, content patterns)
- Don't require evals for all skills immediately — start with critical pipeline skills

**Why this matters:**
svc can pass all tier-1 tests and still produce wrong output. Behavioral evals catch this. Example: a skill that always returns "proceed" regardless of input would pass structural tests but fail behavioral evals.

**Hybrid opportunity:** svc's tier-3 (LLM-as-judge) already does behavioral scoring but is expensive. The eval format from coreyhaines is deterministic and cheap — run the conversation, check assertions, no LLM needed. Combine: tier-2 gets deterministic evals, tier-3 stays for complex judgment calls.

---

### Pattern 3: Progressive Disclosure → All svc skills

**From:** coreyhaines skill architecture (core instructions + references on demand)
**Into:** svc skill convention

**The problem in svc today:**
svc skills load everything — the full SKILL.md is always in context. Some skills are 500+ lines. If the skill's workflow has 7 steps but the user only needs step 2, the other 6 steps still consume tokens.

**How the source solves it:**
Skills have:
- Core instructions in SKILL.md (always loaded)
- Detailed references in `references/` (loaded on demand)
Agents load core first, only pull references when they need depth.

**What this changes in svc:**
Convention update: SKILL.md contains workflow + decision points. Detailed guides move to `references/`. Skills instruct agents to "read references/X.md for detailed guidance on Y" only when Y is needed.

**What NOT to take:**
- Don't refactor all existing skills immediately — this is a convention for new skills
- Don't make references mandatory — some skills are simple enough to stay in one file

**Why this matters:**
Token savings. A 400-line skill that's used for a 2-line question wastes 398 lines of context. Progressive disclosure keeps the core lean.

---

### Pattern 4: Foundation Context Pattern → analyze-marketing

**From:** `product-marketing-context` skill (creates `.agents/product-marketing-context.md`)
**Into:** `analyze-marketing` skill

**The problem in svc today:**
`analyze-marketing` outputs to `docs/marketing/feature-mining-tracker.json` but there's no canonical "product marketing context" file that other skills can reference. Each skill re-gathers or re-reads scattered context.

**How the source solves it:**
`product-marketing-context` creates a single `.agents/product-marketing-context.md` that ALL other skills read first. It captures: product description, target audience, positioning, key messages, competitive landscape.

**What this changes in svc:**
`analyze-marketing` gets a new output artifact: `.agents/product-marketing-context.md`. This becomes the canonical marketing context that downstream skills (validate-feature, find-opportunity, write-spec) can reference.

**What NOT to take:**
- Don't make it a separate skill — integrate into `analyze-marketing`
- Don't duplicate what's already in `docs/specs/domain-profile.md` — reference it

**Why this matters:**
Prevents context fragmentation. Currently marketing context lives in domain-profile, feature-mining-tracker, personas, and specs. A single canonical file gives downstream skills one source of truth.

---

## Assessment B: External Addon Viability

**Runtime addon?** YES
**License:** MIT
**Install:** `git clone https://github.com/coreyhaines31/marketingskills.git ~/.svc/external-skills/marketingskills`

**Integration point:**
- `analyze-marketing` → outputs to `.agents/product-marketing-context.md`
- `validate-feature` → reads customer-research, competitor-profiling for market validation
- `find-opportunity` → reads marketing-ideas, directory-submissions for opportunity discovery
- `write-spec` → reads CRO patterns (page-cro, form-cro, popup-cro) for conversion frameworks

**Interop contract:**
- Shared canonical file: `.agents/product-marketing-context.md`
- svc skills make decisions; coreyhaines skills provide data
- coreyhaines output is INPUT to svc pipeline, not a replacement

**What svc should NOT rebuild:**
- The 40 marketing skills (too specialized, not svc's domain)
- The 61 CLI tools (API access layer, not pipeline logic)
- The 53+ integration guides (reference material, not framework)

**What svc should still own:**
- Pipeline orchestration (which skill runs when)
- Review gates (G1-G7)
- Spec-first development
- Progressive narrowing

**EXTERNAL_ADDONS.md draft:**
Already present — no changes needed. Current draft is accurate.

---

## Full Dimensional Comparison

| Dimension | coreyhaines | svc | Verdict | Action |
|-----------|-------------|-----|---------|--------|
| **Skill count** | 40 specialized | 57 general-purpose | different-valid | N/A |
| **Focus** | Marketing execution | Development pipeline | different-valid | N/A |
| **Pipeline** | None (standalone skills) | 7-lane progressive narrowing | theirs-better (for their domain) | N/A — svc pipeline is core |
| **Review gates** | None | G1-G7 | ours-better | SKIP |
| **Context loading** | "Before Starting" pattern | Inconsistent | theirs-better | BLEND |
| **Testing** | 197 behavioral evals | Structural (tier-1) + integration (tier-2) | theirs-better (for behavioral) | BLEND |
| **Token efficiency** | Progressive disclosure | Full load every time | theirs-better | BLEND |
| **Foundation context** | product-marketing-context | Scattered across files | theirs-better | BLEND |
| **CLI tools** | 61 zero-dep scripts | Framework scripts | different-valid | ADDON |
| **Integration guides** | 53+ detailed guides | None (not svc's domain) | different-valid | ADDON |
| **Composio MCP** | 15+ OAuth integrations | None | different-valid | ADDON |
| **Agent support** | Multi-agent (Claude, Codex, Cursor) | Multi-host (Claude, Kimi, Codex, Gemini, OpenCode) | comparable | N/A |
| **Knowledge system** | None (skills are standalone) | Layer 1-4 extraction | ours-better | SKIP |
| **Builder awareness** | None | mine-builder, builder-profile | ours-better | SKIP |
| **Kill signals** | None | K1-K7 reject/pivot | ours-better | SKIP |
| **Spec-first** | None | write-spec → design → execute | ours-better | SKIP |
| **Worktree isolation** | None | .worktrees/ per feature | ours-better | SKIP |
| **Anti-patterns** | None | 24 documented | ours-better | SKIP |
| **Persona building** | None (uses product context) | build-personas (7 modes) | ours-better | SKIP |
| **Competitor analysis** | competitor-profiling (URL-based) | analyze-competitors (4-tier, moat scoring) | ours-better | SKIP |
| **Domain expertise** | None | analyze-domain + knowledge system | ours-better | SKIP |
| **Revenue staging** | None | stage-revenue (3 stages) | ours-better | SKIP |
| **Market readiness** | None | assess-market-readiness (4 modes, 8 dimensions) | ours-better | SKIP |
| **Launch strategy** | launch-strategy | launch-strategy (via skill) | comparable | ADDON (their skill is more detailed) |
| **Pricing strategy** | pricing-strategy | (none — gap) | theirs-better | ADDON |
| **Customer research** | customer-research (assets + online) | (none — gap) | theirs-better | ADDON |
| **Email sequences** | email-sequence | (none — gap) | theirs-better | ADDON |
| **Social content** | social-content | (none — gap) | theirs-better | ADDON |
| **SEO audit** | seo-audit | (none — gap) | theirs-better | ADDON |
| **CRO patterns** | page-cro, form-cro, popup-cro | (none — gap) | theirs-better | ADDON |
| **Churn prevention** | churn-prevention | (none — gap) | theirs-better | ADDON |
| **Referral programs** | referral-program | (none — gap) | theirs-better | ADDON |
| **Lead magnets** | lead-magnets | (none — gap) | theirs-better | ADDON |
| **Directory submissions** | directory-submissions | (none — gap) | theirs-better | ADDON |
| **Community marketing** | community-marketing | (none — gap) | theirs-better | ADDON |
| **Ad creative** | ad-creative | (none — gap) | theirs-better | ADDON |
| **Paid ads** | paid-ads | (none — gap) | theirs-better | ADDON |
| **Analytics tracking** | analytics-tracking | (none — gap) | theirs-better | ADDON |
| **AB testing** | ab-test-setup | (none — gap) | theirs-better | ADDON |
| **Content strategy** | content-strategy | (none — gap) | theirs-better | ADDON |
| **Sales enablement** | sales-enablement | (none — gap) | theirs-better | ADDON |
| **RevOps** | revops | (none — gap) | theirs-better | ADDON |
| **Marketing ideas** | marketing-ideas | (none — gap) | theirs-better | ADDON |
| **Marketing psychology** | marketing-psychology | (none — gap) | theirs-better | ADDON |
| **Free tool strategy** | free-tool-strategy | (none — gap) | theirs-better | ADDON |
| **Image generation** | image | (none — gap) | theirs-better | ADDON |
| **Video production** | video | (none — gap) | theirs-better | ADDON |
| **ASO audit** | aso-audit | (none — gap) | theirs-better | ADDON |

## Skipped items

| External | Reason for skip |
|----------|----------------|
| 40 specialized marketing skills | Not svc's domain — use as external addon |
| 61 CLI tools | API access layer — use via addon |
| 53+ integration guides | Reference material — use via addon |
| Multi-agent support | svc already has multi-host support |
| Plugin marketplace | Claude Code specific — svc uses hooks |

## Recommendation

**External addon:** YES — keep as external addon for runtime marketing execution.

**Blend (4 patterns):**
1. "Before Starting" context gate → all svc skills
2. Behavioral evals → test-framework tier-2
3. Progressive disclosure → new skill convention
4. Foundation context pattern → analyze-marketing

**Why blend these 4 but not the 40 skills?**
These 4 are ARCHITECTURAL patterns that improve how svc works. The 40 skills are DOMAIN content that svc shouldn't rebuild. The architectural patterns make svc better at its core job (progressive deterministic development). The domain skills give svc marketing capabilities it doesn't need to own.

**What svc gets from this blend:**
- Consistent context loading (less token waste)
- Behavioral testing (catches wrong output, not just wrong structure)
- Leaner skill loading (progressive disclosure)
- Canonical marketing context (one source of truth)

**What svc does NOT get (and shouldn't try to):**
- Marketing execution skills (use coreyhaines addon)
- API access tools (use coreyhaines addon)
- Marketing domain expertise (use coreyhaines addon)
