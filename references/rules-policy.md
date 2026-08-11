# Rules Policy

Rules are a svc primitive alongside skills. This doc defines what qualifies as a rule, where rules live, and how they relate to the neighbouring primitives (`references/`, skill bodies, anti-patterns).

## Rule types

Two valid reasons to create a rule. A rule that doesn't fit either type is **inflation** and belongs in references/ or nowhere.

### Correction rules

Fix a behaviour that Claude gets wrong or inconsistently under a realistic default. The defining test: **"Without this rule, would Claude sometimes do the wrong or risky thing here?"**

Examples: severity taxonomy for code review (Claude uses inconsistent urgency language without it), research-before-build sequence (Claude doesn't consistently run `gh search` before implementing), tool-selection (Claude over-spawns agents when a Grep would do).

Correction rules are injected **globally** (universal stack) — they apply to all work, not just specific tech stacks.

### Steering rules

Collapse Claude's valid-but-inconsistent implementation choices to a project convention. Claude knows all the options; the rule pins which one this project uses. The defining test: **"In 10 different projects, would Claude reasonably reach for 2+ different approaches here? And does it matter which one this project uses?"**

Examples: use Zustand not Redux for global state, use Expo Router not React Navigation, use Pydantic not dataclass for API boundaries, use `%w` error wrapping not sentinel errors in Go.

Steering rules are injected **per-project** — only when the project declares the matching stack. A React Native project should not receive Go steering rules.

---

## What a rule is

A **rule** is a short, context-injectable directive that fires at every turn when loaded. Rules are loaded via:

- **Global (correction + universal steering):** `setup` symlinks to `~/.claude/rules/svc-*.md` — auto-injected for all sessions
- **Per-project (stack steering):** `onboard-repo` writes `@~/.claude/skills/rules/<stack>/<file>.md` imports into the project's `CLAUDE.md` — injected only for sessions in that project

Rules are not documentation. If a directive is never injected into model context, it is a reference doc, not a rule.

## What is not a rule

| Artifact | Why it stays out of `rules/` |
|---|---|
| Skill bodies (`<skill>/SKILL.md`) | Loaded on demand via the Skill tool, not per-turn |
| Reference docs (`references/*.md`) | Internal doctrine read by skills — not injected into every turn |
| Anti-patterns catalogue (`references/anti-patterns.md`) | Read by `review-gate`, `diagnose-bug`, etc. on demand; too long to inject per-turn |
| Subagent prompt rules (`references/subagent-context-rules.md`) | Consumed by orchestrators when constructing subagent prompts, not by the root agent per-turn |
| DOCTRINE.md | Methodology description, not a per-turn directive |

The test: **"If I delete this file from `CLAUDE.md`'s include list, does the model's behaviour change on the next turn?"** — if yes, it is a rule; if no, it is a reference.

## Current classification

As of 2026-04-13:

| File | Classification | Rationale |
|---|---|---|
| `rules/tool-selection.md` | **Rule** (project, universal) | Loaded via root `CLAUDE.md`; changes per-turn Agent/Explore spawn decisions. Registered in `rulesRegistry`. |
| `references/subagent-context-rules.md` | **Reference** (stays in `references/`) | Consumed by orchestrators when building subagent prompts. Per-turn injection would waste tokens because 80%+ of turns do not spawn subagents. |
| `references/anti-patterns.md` | **Reference** (stays in `references/`) | Too long (24 APs) for per-turn injection. Skills that need it read it on demand. |

**Policy:** keep `rules/` minimal. Promote a reference to a rule only when there is evidence the directive must fire per-turn and the reference is short enough (< ~30 lines) to pay the per-turn token cost.

## Registry

Every file under `rules/` MUST appear in `skills-manifest.json` → `rulesRegistry.entries`. The linter (`scripts/lint-skills-manifest.mjs`) enforces:

1. Every `.md` file under `rules/` is registered.
2. Every registered project-scoped entry points to an existing file.
3. Every entry has valid `scope` (`project|global`), `stack` (language or `universal`), and `source` (`local` or `blended:<key>`).

Entry schema:

```json
{
  "path": "rules/<name>.md",           // repo-relative; required for project scope
  "type": "correction" | "steering",   // determines global vs per-project injection
  "scope": "project" | "global",
  "stack": "universal" | "react" | "react-native" | "typescript" | "python" | "golang" | ...,
  "source": "local" | "blended:<registry-key>",
  "last_evaluated": "YYYY-MM-DD",      // when a human or evaluate-rule last confirmed the rule still earns its per-turn cost
  "source_sha": null | "<upstream-sha>", // for blended rules, the SHA of the upstream file at last blend
  "notes": "<free-form>"
}
```

### Injection rules

| type | stack | Injected where |
|---|---|---|
| `correction` | `universal` | `~/.claude/rules/` — globally, all sessions |
| `steering` | `universal` | `~/.claude/rules/` — globally (universal steering is cheap enough) |
| `steering` | `<specific>` | `~/.claude/skills/rules/<stack>/` — available for per-project @-import via `onboard-repo` |

**`setup` enforces this automatically.** Universal rules land in `~/.claude/rules/svc-*.md`. Stack-specific steering rules land in `~/.claude/skills/rules/<stack>/` and are NOT auto-injected.

**`onboard-repo` wires per-project includes.** When it detects a project's tech stack(s), it appends the matching steering rule @-imports to the project's `CLAUDE.md`. A Go project gets Go steering rules; it does not get React Native steering rules.

## Adoption gate (planned)

Rule adoption — especially from external packs — goes through **`evaluate-rule`** (deferred skill, see `proposals/2026-04-13-rules-as-primitive.md` F1-1). The gate decides whether a candidate rule:

- Beats Claude's default behaviour (adopt)
- Restates Claude's default (defer-to-default — reject to avoid rule inflation)
- Conflicts with project conventions (reject)
- Needs edits to fit (adopt-with-edits)

Until `evaluate-rule` ships, rules are adopted manually and must be justified in the `notes` field.

## Lifecycle

- **last_evaluated** is the freshness signal. Stale rules (> 90 days without re-evaluation) should be re-run through `evaluate-rule` (once it exists) or deleted.
- Blended rules carry `source_sha`. When the upstream SHA moves, the blend is re-evaluated via `blend-external`'s re-blend cadence.
- Deleting a rule: remove the file, remove the registry entry, run the linter.

## Anti-patterns

- **Rule inflation** — copying in large rule packs because "they're battle-tested" without evaluating whether each rule changes Claude's behaviour. Every rule burns tokens every turn.
- **Doctrine masquerading as rules** — long philosophical docs in `rules/` that never fire as per-turn directives. Those belong in `DOCTRINE.md` or `references/`.
- **Unregistered rules** — adding a file under `rules/` without an entry in `rulesRegistry`. The linter will fail.
- **Global injection of stack-specific steering rules** — a C++ rule in `~/.claude/rules/` fires on every React Native session. Use `type: steering` with a specific stack so `setup` routes it correctly.
- **Missing type field** — adding a registry entry without `type: correction|steering`. The linter will fail.
