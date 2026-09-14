# Framework Evolution — 2026-04-13 — Rules as a First-Class Primitive

## Method

Read:
- `FRAMEWORK-STATE.md` (Analysis History: `everything-claude-code` blend 2026-04-12; `subagent-context-rules.md` already treated as internal reference; no manifest entry for rules)
- `skills-manifest.json` — grepped `rules` → zero matches; rules are not a manifest primitive
- `rules/` directory — contains exactly one file: `rules/tool-selection.md` (project-local, loaded through root `CLAUDE.md`)
- `references/knowledge/everything-claude-code/CAPABILITIES.md:90` and `details/install-system.md:92-93` — confirms upstream ships 15 language/topic rule directories (`common, typescript, python, golang, java, kotlin, rust, cpp, csharp, swift, perl, php, dart, web, zh`) that install to `~/.claude/rules/*`
- `proposals/done/2026-04-12-blend-everything-claude-code.md` — prior blend took 8 *patterns* (hooks, model routing, CLI-over-MCP) but explicitly **did not** adopt the rules primitive itself
- `audit-coverage/SKILL.md:98` — the coverage auditor already recognises `~/.claude/rules/*` as a valid source location for code-style contracts, but no skill **produces, blends, or evaluates** rules
- `define-code-style/SKILL.md` — closest existing skill; authors a single `docs/specs/code-style.md` per project. Does not emit a rules/ pack, does not consume external rule packs.
- `references/subagent-context-rules.md`, `references/anti-patterns.md` — rule-shaped content lives inside the `references/` namespace with no manifest lifecycle

Evidence summary: svc has accumulated rule-shaped artifacts organically (one local rule, ~6 reference docs, 3 rule-adjacent skills) but treats none of them as a **primitive**. Meanwhile the Claude Code ecosystem (`everything-claude-code`, cursor.directory-style community packs, aider conventions, Cline rules) has converged on rules as the fourth primitive alongside skills/agents/commands.

---

## Findings (by priority)

### P0 — Fix now (blocks quality)

**F0-1. svc has no primitive for "rules" even though it already ships one.**

Evidence: `rules/tool-selection.md` exists and is wired through root `CLAUDE.md`, but there is no `skills-manifest.json` entry, no linter check, no lane that creates/updates rules, and no review gate that validates them. The artifact is effectively *shadow infrastructure*. `audit-coverage/SKILL.md:98` already treats `~/.claude/rules/*` as first-class when auditing a foreign repo — so svc audits other projects for rules it hasn't formalised in its own methodology.

Fix (proposal, not implementation):
1. Add `rules/` as a manifest-tracked primitive with two tiers:
   - **Project rules** (`./rules/*.md`) — committed to repo, loaded via root `CLAUDE.md`
   - **Global rules** (`~/.claude/rules/<lang>/*.md`) — host-profile installed via `setup`
2. Add a linter check to `scripts/lint-skills-manifest.mjs`: every file in `rules/` must appear in a new `rulesRegistry` manifest section with `scope` (project|global), `stack` (language/framework tag or `universal`), `source` (`local` | `blended:<registry-key>`), and `last_evaluated` date.
3. Existing rule-shaped reference docs (`subagent-context-rules.md`, portions of `anti-patterns.md`, `tool-selection.md`) get classified — stay in `references/` if they're internal doctrine, migrate to `rules/` if they're directly injectable into `CLAUDE.md` context.

**F0-2. No skill adopts language-specific rule packs, even though they're battle-tested community IP.**

Evidence: `references/knowledge/everything-claude-code/CAPABILITIES.md:90` documents 15 rule directories upstream. The 2026-04-12 blend took patterns but not the rules themselves, citing (implicitly) no primitive to blend them into. Without adoption, every svc project either: (a) writes language rules from scratch, (b) copies them ad-hoc into `CLAUDE.md` (which bloats context), or (c) doesn't write them at all and relies on Claude's internal priors — which vary by task and are not auditable.

Fix: New skill **`blend-rules`** (or a mode of `blend-external`) whose job is to pull curated rule packs by `<stack>` from registered sources (everything-claude-code, cursor.directory, etc.), run them through the evaluator from F0-3, and emit a `rules/<stack>/` directory plus a diff-worthy accept/reject report.

### P1 — Fix soon (degrades quality)

**F1-1. No evaluator for "does this rule beat Claude's default behaviour?"**

This is the user's core ask. A community rule like "always use `Result<T, E>` instead of throwing in Rust" might be:
- *Redundant* — Claude already does this for idiomatic Rust
- *Net-positive* — Claude is inconsistent; pinning the rule makes output deterministic
- *Net-negative* — the rule encodes a house style that conflicts with what the project actually wants
- *Context-dependent* — right for services, wrong for scripts

Current svc has nothing that makes this judgment. `define-code-style` writes style contracts but does not cross-examine external rules against Claude's defaults.

Fix: New skill **`evaluate-rule`** with this contract:

| Input | Output |
|---|---|
| One rule file (or pack) + target stack + project context (from `project-state.md` + `domain-profile.md`) | `rules-evaluation.md` per rule with verdict: `adopt-as-is` \| `adopt-with-edits` \| `reject` \| `defer-to-default`, plus a **2-pass probe**: (1) ask Claude to describe its default behaviour for the scenario the rule covers, (2) diff default vs rule, (3) score on 4 axes: determinism gain, correctness delta, friction cost, conflict with project conventions |

Explicit anti-pattern this skill prevents: **rule inflation** — copying in 200 lines of rules that mostly restate defaults, burning tokens every turn for zero behaviour change.

**F1-2. No lifecycle for rules (when do they get re-evaluated?)**

Rules decay: Claude's defaults improve, project conventions shift, community packs get updated. Without `last_evaluated` metadata and a cadence, rule packs become stale CLAUDE.md bloat. Skills like `blend-external` already have a re-blend cadence; rules need the same treatment.

Fix: `rulesRegistry` entries carry `last_evaluated` + `source_sha`. Add a `rules-refresh` mode to `evolve-framework` or a standalone `refresh-rules` skill that re-runs `evaluate-rule` against the latest upstream SHA when stale.

### P2 — Improve when possible (nice to have)

**F2-1. Rule authoring skill for project-discovered rules.**

When `diagnose-bug` or `code-reviewer` find a recurring failure pattern, it should be promotable to a rule. Today it goes into `anti-patterns.md` or `learnings/`, neither of which gets injected via `CLAUDE.md` at skill-loading time. Candidate skill: **`promote-to-rule`** — converts a learning or anti-pattern entry into a minimal rule file, runs it through `evaluate-rule`, and registers it.

**F2-2. Host-profile integration.**

`provision/hosts/<host>.json` should declare which rule scopes the host supports. Codex CLI has a different convention file (`AGENTS.md`) than Claude Code (`CLAUDE.md`); Gemini uses `GEMINI.md`. `setup` already handles this asymmetry for skills — extend it to rules so the same `rules/<stack>/` pack targets the right file per host.

### P3 — Track (not actionable yet)

**F3-1. Rule conflict resolution across primitives.**

If a skill says X and a rule says not-X (e.g. `test-driven-development` requires failing-test-first, but a project rule says "hot-fix lane skips TDD"), who wins? Today this never surfaces because rules aren't enumerated. Once the primitive lands, resolution policy needs writing — probably: rules override skills only when scoped to the lane that matches. Defer until F0-1 ships and we have real conflicts to reason about.

**F3-2. Rules-as-prompts vs rules-as-code.**

Some "rules" are lintable (eslint, ruff). Others are prompt-only ("prefer pure functions"). Long-term, svc should decide whether to emit tool configs alongside prompt rules. Defer — this is a scope question for after the primitive is defined.

---

## Comparison delta

| Ecosystem | Rules primitive | svc today | Gap |
|---|---|---|---|
| Cursor | `.cursorrules` per repo + `.cursor/rules/*.mdc` per-scope | CLAUDE.md + one `rules/` file | No scope granularity, no rule-pack authoring |
| Claude Code (upstream) | `~/.claude/rules/<lang>/` installed globally | setup doesn't install rules | No install path, no host awareness |
| everything-claude-code | 15 curated language/stack packs | Blended patterns only, not rules | Explicitly skipped during 2026-04-12 blend |
| aider | `CONVENTIONS.md` | Equivalent lives in `CLAUDE.md` | Monolithic; no modularity by stack |

Verdict: The gap is real and the blueprint is widely established. svc is *behind* the ecosystem on a primitive that's cheap to adopt and high-leverage (rules load every turn; they shape every skill output).

---

## Stale proposal audit

- `proposals/done/2026-04-12-blend-everything-claude-code.md` — implemented for the 8 patterns; rules portion was deferred silently. This proposal supersedes that deferral with an explicit plan.
- No other pending proposal touches rules. All prior rule-shaped work (`subagent-context-rules.md`, AP-21 anti-sycophancy rules, deviation rules in `execute-changeset`) is implemented but lives in `references/` or inside skill bodies — F0-1 reclassification work will sort which of those migrate vs stay.

---

## Recommended next route

If the user wants to act on this:

1. **`write-spec`** with this proposal as input → produces a feature spec for the `rules` primitive (manifest schema, linter checks, setup install path)
2. **`plan-changeset`** → task graph covering: manifest schema, linter patch, `evaluate-rule` skill, `blend-rules` skill (or mode), host-profile update, docs
3. **`execute-changeset`** in a worktree
4. First real blend target: `everything-claude-code` language packs for the stacks svc projects actually use (ts, python, go are likely the top 3 — verify from recent `project-state.md` across projects before choosing)

Explicitly **not** recommended: mass-importing all 15 language packs before the evaluator exists. That would reproduce the "rule inflation" anti-pattern F1-1 is designed to prevent.
