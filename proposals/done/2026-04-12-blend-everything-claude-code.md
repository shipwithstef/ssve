# Blend Plan: everything-claude-code (ECC)

**Status:** IMPLEMENTED (2026-04-12, commits 295be69 + f6e279e)
All 8 blend items IMPLEMENTED. 3 additional items from skill analysis IMPLEMENTED.
Council strategic deliberation mode DEFERRED — needs create-skill pipeline.

**Source:** https://github.com/affaan-m/everything-claude-code
**SHA:** 125d5e619905d97b519a887d5bc7332dcc448a52
**Date:** 2026-04-12
**Previous blend:** first blend

---

## Summary

8 patterns to blend, 1 external addon candidate, 23 dimensions evaluated.

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | Hook strictness tiering + selective disable | `hooks/hooks.json` + `hooks/svc-workflow-guard.js` | Hooks are all-or-nothing; no way to lighten overhead during exploration without removing hooks entirely | `SVC_HOOK_PROFILE=minimal\|full` env var; hooks document their tier; users can tune without surgery |
| 2 | Config-protection hook | `hooks/svc-workflow-guard.js` | Agent silently disables linting rules to resolve type errors instead of fixing the code — never caught | svc-workflow-guard exits non-zero when Write/Edit targets linter/formatter/tsconfig files |
| 3 | Block-no-verify hook | `hooks/svc-workflow-guard.js` | Agent bypasses pre-commit hooks with `--no-verify` when they fail; CLAUDE.md instruction alone is not enforcement | svc-workflow-guard blocks Bash commands containing `--no-verify` or `--no-gpg-sign` |
| 4 | Commit-quality hook | `hooks/svc-workflow-guard.js` | Commits land without required Co-Authored-By trailer; secrets/debug code staged without detection | svc-workflow-guard validates commit message format + trailer + detects staged debug code |
| 5 | Batch Stop format+typecheck | `hooks/hooks.json` + new `hooks/svc-stop-quality.js` | format+typecheck run per-Edit (12 edits = 12 runs); accumulated type errors invisible until later | Post-edit accumulator collects changed files; Stop hook batch-runs format+typecheck once |
| 6 | Model routing table | new `references/model-routing.md` | Skills delegate to subagents without specifying model; Opus used for trivial tasks, Haiku for complex analysis | Formal table: Haiku/Sonnet/Opus mapped to svc skill categories with rationale |
| 7 | CLI-over-MCP reference pattern | `references/context-budget.md` | plan-capabilities recommends MCPs without guidance on when CLI is cheaper; context degrades silently | DEGRADING/POOR tiers gain explicit CLI-over-MCP preference rule |
| 8 | pass@k vs pass^k vocabulary | `test-framework/SKILL.md` | No formal vocabulary for evaluation strategy; retry-until-pass and must-always-pass mixed without distinction | Formal terms added to test-framework; G5/G6 gates labeled pass^k; non-deterministic scenarios use pass@k |

**External addon:** AgentShield — scans CLAUDE.md, hooks, MCP configs, agent defs for security issues. Complements `review-security` (app code) with agent-infra scanning. ADDON viability: YES.

---

## Full Dimensional Comparison

| Dimension | ECC has | svc has | Verdict | Action |
|---|---|---|---|---|
| Identity / framing | Harness performance system — compositional, mix-and-match | Progressive deterministic framework — prescriptive narrowing with gates | different-valid | SKIP (architectural philosophy, not a pattern) |
| Surface counts | 47 agents, 181 skills, 79 commands, 14 language dirs | 49 skills, 6 framework skills, 7 gates, 7 lanes | different-valid | SKIP (breadth vs depth is intentional) |
| Hook runtime profiling | `ECC_HOOK_PROFILE=minimal\|standard\|strict`; `run-with-flags.js` gates each hook | All-or-nothing; users remove hooks from settings.json to lighten | theirs-better | BLEND (item 1) |
| Hook selective disable | `ECC_DISABLED_HOOKS=<comma-separated-ids>` | Not supported; disable = remove from settings.json | theirs-better | BLEND (part of item 1) |
| Config-protection hook | Blocks Write/Edit to `.eslintrc`, `biome.json`, `prettier.config.js`, `tsconfig.json` etc. | No equivalent — workflow-guard warns about out-of-scope writes but not tool config edits | gap | BLEND (item 2) |
| Block-no-verify hook | `npx block-no-verify@1.1.2` prevents `--no-verify` in Bash | CLAUDE.md instruction only — no enforcement | gap | BLEND (item 3) |
| Commit-quality hook | Lints staged files, validates commit message format, detects debug code/secrets | No pre-commit quality gate | gap | BLEND (item 4) |
| Batch Stop format+typecheck | `post:edit:accumulator` + `stop:format-typecheck` — once per Stop | Stop only checks task graph state (completion guard) | theirs-better | BLEND (item 5) |
| Session continuity hook | `session:start` loads previous context + detects package manager | route-workflow reads project-state.md + router-context.md | comparable | SKIP (svc's file-based approach is richer and host-independent) |
| Continuous learning system | Instinct-based (observe every tool call), project-scoped, confidence scoring, /evolve clusters instincts | `manage-learnings` — deliberate 3-question quality gate, high-signal | different-valid | SKIP (svc's deliberate approach is intentionally higher-signal for a deterministic framework; automatic instinct capture is philosophically misaligned) |
| Specialist agent catalog | 47 agents: language reviewers, build resolvers, analysis, automation | 6 specialist subagents in `audit-implementation`; subagent delegation in other skills | different-valid | SKIP (svc embeds specialists within skills rather than a standalone catalog; already has the key ones) |
| Model routing decision table | Haiku→search/quick, Sonnet→coding, Opus→complex/security | Adaptive context enrichment (1M models get richer prompts) but no routing table | gap | BLEND (item 6) |
| CLI-over-MCP pattern | Explicit design philosophy: wrap CLIs into skills instead of always-on MCPs | Not explicitly documented; plan-capabilities recommends MCPs without CLI preference rule | gap | BLEND (item 7) |
| pass@k vs pass^k | Formal vocabulary: pass@k=at-least-one, pass^k=all-must-pass; used in eval-harness | No equivalent vocabulary; retry loops and CI gates not formally distinguished | gap | BLEND (item 8) |
| Language-specific rule sets | 14 language dirs (TS, Python, Go, Java, Kotlin, Rust, C++, C#, Swift, Perl, PHP, Dart, web, zh) | No language-specific rules (framework, not a language guide) | different-valid | SKIP (out of svc scope by design) |
| AgentShield | Security auditor for agent config files (CLAUDE.md, hooks, MCP configs) — 1282 tests, 102 rules | `review-security` (app code: OWASP + STRIDE) — different domain | gap | ADDON (external — agent infra security vs app security are separate concerns) |
| ECC 2.0 Rust control plane | SQLite session store, dashboard, daemon, session start/stop, worktree-aware scaffolding | No equivalent control plane | gap | SKIP (alpha, not GA; svc has no control-plane architecture) |
| Multi-agent orchestration | PM2-based multi-service, `loop-operator`, `chief-of-staff` | `agent-patterns.md` reference (6 patterns) + subagent use within skills | different-valid | SKIP (svc uses point-in-time subagent delegation, not persistent multi-agent processes) |
| Business / operator skills | Brand-voice, content-engine, Google Workspace ops, billing ops, etc. | Focused on development workflow skills | different-valid | SKIP (different domain) |
| Domain-specific security | HIPAA compliance, DeFi AMM security, EVM token decimals, healthcare PHI | OWASP Top 10 + STRIDE in review-security | different-valid | SKIP (domain-specific, not general framework patterns) |
| MCP config templates | Pre-built `mcp-configs/mcp-servers.json` for jira, github, firecrawl, supabase, etc. | No MCP config templates | gap | SKIP (out of svc scope — infrastructure, not framework patterns) |
| Cross-harness install | 8+ harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini, Antigravity, Trae, Kiro) | Claude Code + Codex via provisioning system | different-valid | SKIP (svc already supports both primary harnesses; additional hosts add install complexity for marginal benefit) |
| Pipeline / lane structure | No deterministic pipeline; compositional | 21-step greenfield lane, 7 gates, 7 lanes, progressive narrowing | ours-better | SKIP (svc's architecture is fundamentally superior for deterministic outcomes) |
| Review / audit system | code-reviewer agent, security-reviewer agent, two-pass concept | G1-G7 gates, audit-implementation with 6 specialists, two-stage review (spec compliance → code quality) | ours-better | SKIP (svc's gated review system with specialists and AC cross-reference is significantly more rigorous) |
| Anti-patterns catalog | Embedded in SOUL.md and longform guide | 25 dedicated APs across 8 categories as a reference doc | ours-better | SKIP |
| Context budget tiers | Token awareness + model routing; context-budget skill | 4-tier degradation (PEAK/GOOD/DEGRADING/POOR) with per-tier actions as reference doc | comparable | SKIP (svc's formalized tier system is more actionable; ECC's model routing table is complementary — covered by item 6) |
| Decision log | Governance capture hook (Bash/Write/Edit) | `.svc/pipeline-decisions.jsonl` with schema validation | comparable | SKIP (svc's structured JSONL with enum validation is richer) |
| Skill discovery | skill-stocktake, configure-ecc, codebase-onboarding | `discover-skills` (skills.sh + SkillHub multi-source ranking) | comparable | SKIP (both solve discovery; svc's is more automated) |
| Install system | OSS profiles (core/developer/security/research/full), SQLite state store, doctor/repair | Symlink-based setup + per-host provisioning JSON | different-valid | SKIP (svc's symlink approach is simpler and correct for a framework; ECC's complexity is appropriate for 181 skills) |
| Design philosophy | Compositional, agent-first, skill-first, no prescriptive pipeline | Progressive narrowing, builder-aware, deterministic, kill-signal reject | different-valid | SKIP (foundational architectural choices) |

---

## Blend Items

### 1. Hook Strictness Tiering + Selective Disable → `hooks/hooks.json` + `hooks/svc-workflow-guard.js`

**From:** `hooks/hooks.json` (ECC) — `ECC_HOOK_PROFILE` gate in `run-with-flags.js`; `ECC_DISABLED_HOOKS` env var
**Into:** `hooks/hooks.json` (svc) — hook descriptions; `hooks/svc-workflow-guard.js` — guard logic

**The problem in svc today:**
svc hooks are all-or-nothing. A developer doing exploratory work (read-heavy, few edits) gets the same hook overhead as intensive execution-phase work. The only way to lighten the hook profile is to manually remove entries from settings.json — a surgical operation that users rarely do, and even if they do, they lose the hooks permanently until they add them back. There is no documented concept of "minimal" vs "full" hook coverage. Result: some users turn off hooks entirely during exploration, losing coverage exactly when they need the workflow guard most (out-of-scope writes are most tempting when exploring).

**How the source solves it:**
ECC's `run-with-flags.js` reads `ECC_HOOK_PROFILE` (minimal|standard|strict) before executing any hook. Each hook carries its profile membership in `hooks.json`. Setting `ECC_HOOK_PROFILE=minimal` at shell level disables all but essential hooks for the session. `ECC_DISABLED_HOOKS=<id1,id2>` provides surgical per-hook suppression without touching any files. This means: exploration session = `export ECC_HOOK_PROFILE=minimal`, production session = default full profile. No file surgery required.

**What this changes in svc:**

*hooks/hooks.json:*
- Add a `"profile"` field to each hook entry: `"profile": "minimal"` (workflow guard, eval gate) or `"profile": "full"` (commit-quality, config-protection, format+typecheck)
- Add a `"profiles"` section to the installation documentation explaining `SVC_HOOK_PROFILE=minimal|full`

*hooks/svc-workflow-guard.js:*
- At the top, read `process.env.SVC_HOOK_PROFILE`. If `minimal`, only run the workflow guard check. If not set or `full`, run all extended checks (config-protection, block-no-verify, commit-quality — from items 2-4).
- This means items 1-4 can share one Node.js process entry — `svc-workflow-guard.js` becomes the unified PreToolUse guard that dispatches sub-checks based on profile.

*Before:* "To disable a hook, remove its entry from settings.json and restart Claude Code."
*After:* "Set `SVC_HOOK_PROFILE=minimal` for exploration sessions, `full` (default) for execution sessions. To suppress a specific hook: `SVC_DISABLED_HOOKS=svc-commit-quality,svc-config-protection`."

**What NOT to take:**
ECC's three-level tiering (minimal/standard/strict) is more granularity than svc needs. svc has fewer hooks and clearer intent — two levels (minimal: task tracking + workflow guard; full: all guards) maps cleanly to svc's exploration vs execution phases. Don't adopt three levels.

**Why this matters:**
Hooks that can't be tuned get turned off. Once a user turns off svc's hooks (because the overhead is too high during a 2-hour exploration session), they forget to re-enable them before the execution phase. The workflow guard and eval gate then silently fail to catch out-of-scope writes and incomplete task closures — exactly the scenarios they were designed for. A profile system costs 5 lines of code and eliminates the "all or nothing" problem.

**Hybrid opportunity:**
svc's two-level profile (minimal/full) aligns naturally with svc's two principal phases (exploration = PEAK context, execution = later tiers). Rather than a standalone profile concept, the profile can be tied to context-budget tiers: DEGRADING/POOR → consider `minimal` to reduce hook overhead on a context-limited session. This is a hybrid ECC doesn't have — profile as a degradation action.

---

### 2. Config-Protection Hook → `hooks/svc-workflow-guard.js`

**From:** `hooks/hooks.json` (ECC) — `pre:config-protection` hook, `scripts/hooks/config-protection.js`
**Into:** `hooks/svc-workflow-guard.js` — new guard check, integrated with item 1's profile dispatch

**The problem in svc today:**
When a linting or type error appears during execution, an agent can "fix" it by modifying the config file that enforces the rule — silently disabling `.eslintrc` rules, loosening `tsconfig.json` strictness, or commenting out `biome.json` checks — rather than fixing the actual code. svc's workflow guard currently warns about out-of-scope writes but has no special protection for linter/formatter/tsconfig files. These files look like normal project files to the guard. The user discovers the sabotage in code review, if ever.

**How the source solves it:**
ECC's `config-protection` PreToolUse hook intercepts Write/Edit/MultiEdit tools and checks whether the target file matches a list of protected patterns (`.eslintrc*`, `biome.json`, `prettier.config.*`, `tsconfig*.json`, `.prettierrc*`). If matched, it exits non-zero with an explanation, preventing the edit. ECC does allow an override via explicit user confirmation, but the default is block.

**What this changes in svc:**

*hooks/svc-workflow-guard.js:*
Add a `checkConfigProtection(filePath)` function called when tool is Write/Edit and profile is `full`:
```javascript
const PROTECTED_CONFIG_PATTERNS = [
  /\.eslintrc(\.(js|json|yaml|yml|cjs))?$/,
  /biome\.json$/,
  /prettier\.config\.(js|cjs|mjs|ts)$/,
  /\.prettierrc(\.(js|json|yaml|yml|cjs))?$/,
  /tsconfig.*\.json$/,
  /jest\.config\.(js|ts|mjs|cjs)$/,
  /vitest\.config\.(js|ts|mjs|cjs)$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/
];
```
If the file matches: `process.exit(1)` with message explaining that linter/formatter configs and lock files must not be modified to resolve code issues — fix the code instead.

*Before:* Agent modifies `tsconfig.json` to add `"noImplicitAny": false` to silence type errors. Silently merged.
*After:* Write to `tsconfig.json` intercepted. Hook exits 1: "Config protection: tsconfig.json is a type-check authority file. Fix the code, not the config."

**What NOT to take:**
ECC's config-protection only covers JS/TS ecosystem config files. svc projects span more stacks. The lock file protection (package-lock.json, yarn.lock, pnpm-lock.yaml) is svc-specific — ECC doesn't protect those but they're equally important to protect.

**Why this matters:**
This is the difference between a test suite that enforces quality and a test suite that records what the agent did. If the agent can modify the type checker's config to silence errors, every TypeScript quality signal in svc's execute-changeset TDD loop becomes worthless. This hook is a first-order correctness guarantee for any JS/TS project.

**Hybrid opportunity:**
svc's config-protection should also protect `.github/workflows/*.yml` (CI pipeline definitions) and the svc own hook files (`hooks/*.js`, `hooks/hooks.json`). ECC's version doesn't protect hook files from modification by the agent (a subtle self-modification risk). svc can close this gap.

---

### 3. Block-No-Verify Hook → `hooks/svc-workflow-guard.js`

**From:** `hooks/hooks.json` (ECC) — `pre:bash:block-no-verify` hook using `npx block-no-verify@1.1.2`
**Into:** `hooks/svc-workflow-guard.js` — native implementation (no external npm dependency)

**The problem in svc today:**
CLAUDE.md says "Never skip hooks (--no-verify, --no-gpg-sign, etc) unless the user explicitly requests these actions." This is an instruction, not enforcement. When a pre-commit hook fails (for legitimate reasons — linting, type errors the agent didn't fix), an agent under pressure to complete will use `--no-verify` to bypass the failure and move on. The commit lands on main. No pre-commit hook ever ran. svc's commit discipline is silently violated.

**How the source solves it:**
ECC hooks a PreToolUse on Bash and runs `npx block-no-verify@1.1.2`, which pattern-matches the command string for `--no-verify`. If found, it exits non-zero and blocks the commit. This converts a written rule into enforced behavior.

**What this changes in svc:**

*hooks/svc-workflow-guard.js:*
Add `checkNoVerifyBypass(command)` called when tool is Bash and profile is `full`:
```javascript
function checkNoVerifyBypass(command) {
  const patterns = [/--no-verify\b/, /--no-gpg-sign\b/, /-n\b.*git commit/];
  if (patterns.some(p => p.test(command))) {
    console.error('Hook bypass blocked: --no-verify / --no-gpg-sign are not permitted.');
    console.error('Pre-commit hooks exist for a reason. Fix the underlying issue instead.');
    process.exit(1);
  }
}
```

*Before:* Pre-commit hook fails. Agent retries, adds `--no-verify`. Commit lands. Hook never ran.
*After:* `--no-verify` attempt blocked by svc-workflow-guard. Agent must fix the pre-commit failure.

**What NOT to take:**
ECC uses an external npm package (`npx block-no-verify@1.1.2`). This introduces a network dependency and an external package to trust. svc implements this natively in its existing guard — no external dependency, no `npx` call.

**Why this matters:**
Pre-commit hooks are the last automated quality gate before code reaches the branch. If `--no-verify` can bypass them, every CI check the pre-commit hook enforces is optional. For svc's execute-changeset phase, this means an agent that can't pass its own quality checks can still produce a "green" commit by bypassing them. The failure mode is especially subtle: the developer reviews the commit diff and sees correct-looking code, unaware that linting/type errors were present but bypassed.

**Hybrid opportunity:**
No pure hybrid available — native implementation IS the improvement over ECC's external package approach. The hybrid is: same concept, better implementation.

---

### 4. Commit-Quality Hook → `hooks/svc-workflow-guard.js`

**From:** `hooks/hooks.json` (ECC) — `pre:bash:commit-quality` hook; detects staged debug code, validates message format
**Into:** `hooks/svc-workflow-guard.js` — new check with svc-specific commit discipline rules

**The problem in svc today:**
svc has a documented commit discipline: author `s7an-it <angelovsan@gmail.com>`, Co-Authored-By trailer, conventional commit format. These are CLAUDE.md rules — no enforcement. Common failures: commits without the Co-Authored-By trailer, commits with `console.log` or debug code still staged, commits with vague messages ("fix stuff", "update"). These all pass through silently.

**How the source solves it:**
ECC's `commit-quality` hook runs pre-commit (PreToolUse on Bash matching `git commit` commands): validates commit message format, lints staged files, detects `console.log`/`debugger`/`TODO`/secret patterns in staged changes. Exits non-zero if violations found.

**What this changes in svc:**

*hooks/svc-workflow-guard.js:*
Add `checkCommitQuality(command, input)` for Bash commands matching `git commit` (not `--amend` unless explicitly allowed):
1. Check staged diff for `console.log`, `debugger`, `TODO:` in code paths (warn, not block — these can be intentional)
2. Check commit message contains Co-Authored-By trailer (block if absent)
3. Check commit message is not obviously vague (< 10 chars, matches "fix stuff", "update", "wip")
4. Check no `--no-verify` in the command (covered by item 3, so this is a belt+suspenders check)

*Before:* Commit `"fix"` lands with no Co-Authored-By trailer. 3 `console.log` statements staged.
*After:* Hook blocks: "Commit requires Co-Authored-By trailer. Commit message too vague (< 10 chars)."

**What NOT to take:**
ECC's commit-quality includes secret detection in staged files. This is valuable but requires regex patterns for API keys, passwords, etc. For the initial blend, keep this as a future improvement — the Co-Authored-By + message format + debug code checks are the immediate wins. Don't add secret scanning until the patterns are well-vetted (false positives on keys/tokens in test fixtures are common).

**Why this matters:**
The Co-Authored-By trailer is svc's attribution contract — it tracks which commits were AI-assisted. If an agent skips it (under token pressure or due to a simplified commit path), the project's commit history loses its AI attribution metadata. This matters for audits, for the project history, and for the integrity of the framework's own dogfooding record.

**Hybrid opportunity:**
svc's commit-quality check can cross-reference the active task graph: if `.svc/lane-tasks.json` exists and has tasks, ensure the commit message references the active task ID (WI-###). This is a svc-native enhancement ECC has no concept of — task-aware commit message validation.

---

### 5. Batch Stop Format+Typecheck → `hooks/hooks.json` + new `hooks/svc-stop-quality.js`

**From:** `hooks/hooks.json` (ECC) — `post:edit:accumulator` (PostToolUse) + `stop:format-typecheck` (Stop hook)
**Into:** `hooks/hooks.json` — two new entries; new `hooks/svc-stop-quality.js`

**The problem in svc today:**
svc's execute-changeset phase may involve 10-20 file edits. If a user wants format+typecheck enforcement, they either run it manually (fragile) or accept per-edit overhead (expensive). There is no batch mechanism. The Stop hook currently only checks task graph completeness. A session can end with accumulated formatting debt or type errors that weren't caught because no formatter/typechecker ever ran on the edited files as a group.

**How the source solves it:**
ECC's `post:edit:accumulator` hook (PostToolUse on Edit/Write/MultiEdit) appends each edited file path to a session-local file (`.claude/edit-accumulator.json`). The `stop:format-typecheck` Stop hook reads this file and batch-runs Biome/Prettier + TypeScript compiler once across all accumulated files. This approach: (a) eliminates per-edit overhead, (b) catches type errors that only manifest once multiple files are changed together, (c) runs exactly once per response instead of per file.

**What this changes in svc:**

*New file: `hooks/svc-stop-quality.js`*
Reads `.claude/svc-edited-files.json` (accumulated file paths from the session). Detects project stack (Node.js/TypeScript if tsconfig.json exists; Python if pyproject.toml/setup.py; Go if go.mod). Runs the appropriate formatter and type checker on the accumulated paths. Outputs a clear summary of findings. Does NOT block on format-only issues (warnings). DOES exit non-zero on type errors (hard gate).

*hooks/hooks.json:*
Add PostToolUse entry:
```json
{
  "id": "svc-edit-accumulator",
  "description": "Records edited file paths for batch quality check at Stop time.",
  "matcher": "Edit|Write|MultiEdit",
  "command": "node hooks/svc-stop-quality.js --accumulate \"$TOOL_INPUT\""
}
```
Add Stop entry:
```json
{
  "id": "svc-stop-quality",
  "description": "Batch format+typecheck all files edited this session — once per Stop instead of per Edit. Exits non-zero on type errors.",
  "matcher": "*",
  "command": "node hooks/svc-stop-quality.js --check"
}
```

*Before:* 15-file refactor completes. No format/typecheck. Developer runs `tsc` manually next day. 7 type errors.
*After:* Stop hook runs tsc + formatter across all 15 files once. 7 type errors surfaced before session ends.

**What NOT to take:**
ECC's accumulator is TypeScript-specific (Biome/Prettier + tsc). svc's version should be stack-aware (detect tsconfig.json → run tsc, detect pyproject.toml → run pyright or mypy, detect go.mod → run go vet). Don't hardcode the TypeScript toolchain.

**Why this matters:**
Type errors introduced in the middle of execute-changeset can only be caught once the full changeset is present — a type error in file B may only appear after file A's interface changed. Per-edit typecheck misses this. The batch Stop pattern is architecturally correct: quality check once the response (logical unit of work) is complete, not after each individual edit.

**Hybrid opportunity:**
svc's Stop hook can also run the eval-gate check (from `svc-eval-gate-pre`) before the format+typecheck — ensuring task completion is verified BEFORE quality validation. The ordering matters: (1) task complete?, (2) no type errors?, (3) no format debt?. ECC's Stop doesn't know about task graphs. svc's Stop hook can be the most comprehensive in any framework.

---

### 6. Model Routing Decision Table → new `references/model-routing.md`

**From:** ECC `the-longform-guide.md` Token Economics section; `skills/agent-harness-construction/SKILL.md`
**Into:** New `references/model-routing.md`; cross-referenced in `execute-changeset/SKILL.md`, `audit-implementation/SKILL.md`, `blend-external/SKILL.md`

**The problem in svc today:**
svc's skills delegate to subagents but provide no guidance on which model to use. The only existing model-awareness is "adaptive context enrichment: 1M models get richer subagent prompts." When `audit-implementation` spins up 6 specialist subagents, they all default to whatever the caller uses. When `execute-changeset` delegates a bounded task, it may use Opus for a 3-line change or Haiku for a complex architectural decision. There's no routing table.

**How the source solves it:**
ECC's SOUL.md and longform guide codify: Haiku for quick lookups / search / simple responses; Sonnet for coding tasks / standard analysis; Opus for complex reasoning / security / architectural decisions. The `/model-route` command exposes this. ECC's token economics section also ties model choice to cost — Haiku is 20x cheaper than Opus.

**What this changes in svc:**

*New file: `references/model-routing.md`*
```
## svc Model Routing Table

| Task type | Model | Rationale |
|---|---|---|
| Quick lookup, grep, file reads | Haiku | Low complexity, low cost |
| mine-builder, find-opportunity, stage-revenue | Haiku for data collection, Sonnet for synthesis |
| write-spec, design-tech, plan-changeset | Sonnet | Complex reasoning, moderate context |
| execute-changeset subagents (bounded tasks) | Sonnet | Standard coding; switch to Haiku for read-only analysis tasks |
| audit-implementation specialists | Sonnet (spec audit), Opus (security specialist) |
| review-security | Opus | Security reasoning requires maximum capability |
| blend-external, evolve-framework | Opus | Architectural judgment, comparative analysis |
| diagnose-bug (initial hypothesis) | Sonnet | Pattern matching + reasoning |
| diagnose-bug (root cause confirmation) | Opus | Only if Sonnet fails 2 attempts |
| review-cross-model | Opus | Adversarial review; must be capable of catching Sonnet's errors |
```

Skills that delegate to subagents should reference this table in their subagent prompt construction.

*Before:* All subagents inherit the caller's model. Expensive models used for trivial tasks.
*After:* Each skill picks the right model for its subagent's work. Cost optimized without sacrificing quality.

**What NOT to take:**
ECC's model routing is generic. Don't take it verbatim — adapt to svc's specific skills and the reasoning required at each phase.

**Why this matters:**
Token cost is real. An `audit-implementation` run with 6 Opus subagents costs ~10x more than 6 Sonnet subagents with targeted Opus only where it matters (security specialist). For users running svc on real projects with multiple features, the routing table translates directly to cost discipline.

**Hybrid opportunity:**
svc's routing table can integrate with the context-budget tiers: when context is DEGRADING, downgrade one level (Opus→Sonnet, Sonnet→Haiku) to conserve tokens. This is a svc-native extension of ECC's concept — context-aware model routing, not just task-type routing.

---

### 7. CLI-over-MCP Reference Pattern → `references/context-budget.md`

**From:** ECC SOUL.md / `the-longform-guide.md` — "CLI-over-MCP" design philosophy
**Into:** `references/context-budget.md` — DEGRADING and POOR tier actions

**The problem in svc today:**
`plan-capabilities` recommends MCPs for various tools (database, search, file systems) but gives no guidance on when to prefer a CLI instead. When context is DEGRADING, an always-on MCP server injects its system prompt overhead into every request — even when the tool isn't used that session. For CLI tools that can be invoked on-demand (gh, stripe, supabase CLI), wrapping them as skill Bash calls is cheaper than an always-on MCP. svc doesn't document this tradeoff.

**How the source solves it:**
ECC's SOUL.md explicitly states: "CLI-over-MCP: Replace always-on MCPs with CLI-wrapped skills to save context vs always-on MCPs." The practical impact: a Supabase CLI call via Bash has zero idle overhead; a Supabase MCP server injects its tools schema into every request whether used or not.

**What this changes in svc:**

*`references/context-budget.md`* — add to DEGRADING tier actions:
> **CLI-over-MCP preference**: If an MCP server is active but used sparingly this session, consider disabling it and using the equivalent CLI tool via Bash instead. MCP tool schemas inject overhead into every request. CLI tools have zero idle cost.

Add a new section "MCP vs CLI Decision":
```
When to use MCP vs CLI:
- Frequent tool calls in this session AND rich structured output needed → MCP
- Occasional tool calls OR session is DEGRADING/POOR → CLI via Bash
- Setup cost matters (auth flows) → MCP (amortizes setup)
- Minimal session, one-shot task → CLI
```

*Before:* plan-capabilities recommends Supabase MCP. User installs it. Every session injects schema overhead even when DB not touched.
*After:* context-budget.md teaches the CLI-over-MCP tradeoff. Users make informed choices.

**What NOT to take:**
ECC's CLI-over-MCP is a philosophy statement, not a mechanism. svc doesn't need to implement anything — just document the principle in the right place (context-budget.md, where cost-awareness decisions live).

**Why this matters:**
For users who reach DEGRADING context in a long execute-changeset session, an always-on MCP can account for 5-15% of total context overhead from tool schema injection. The fix is free (disable the MCP, use CLI) but only if the user knows the tradeoff exists.

**Hybrid opportunity:**
svc can make this actionable by adding "MCP audit" as a DEGRADING-tier recommendation in context-budget.md — when context degrades, pause and check which MCPs are active but unused. ECC states the principle; svc integrates it into the degradation response protocol.

---

### 8. pass@k vs pass^k Evaluation Vocabulary → `test-framework/SKILL.md`

**From:** ECC `skills/eval-harness/SKILL.md`, `skills/continuous-agent-loop/SKILL.md`, `the-longform-guide.md`
**Into:** `test-framework/SKILL.md` — evaluation strategy section; `references/benchmark-findings.md`

**The problem in svc today:**
svc's test-framework runs scenario-based tests and framework evals, but has no formal vocabulary for evaluation strategy. The distinction between "run until one passes" and "must always pass" is made implicitly per test, not documented as a design choice. When building new benchmark scenarios for doctrine claims, there's no framework for deciding: should this claim be validated by a single successful run (pass@k) or by consistent success across multiple runs (pass^k)?

**How the source solves it:**
ECC formalizes two strategies:
- **pass@k**: At least 1 of k samples succeeds. Used when you want to know: "can this system do this task at all?" Good for one-shot correctness, exploratory benchmarking.
- **pass^k**: All k samples succeed. Used when you want consistency guarantees. Required for CI gates, regression detection, production reliability.

The distinction prevents misclassification: running a flaky test once and getting GREEN (pass@k) doesn't mean the system is reliable (pass^k would catch it).

**What this changes in svc:**

*`test-framework/SKILL.md`* — add to Evaluation Design section:
```
## Evaluation Strategy: pass@k vs pass^k

**pass@k** (at-least-one): run k samples, succeed if ≥1 passes.
Use when: validating that a capability exists (can svc do X at all?), 
benchmarking new skills during development, exploratory testing.

**pass^k** (all-must-pass): run k samples, succeed only if all k pass.
Use when: CI regression gates (must always work), doctrine claim validation,
G5/G6 gate checks, any test where one failure means the behavior is unreliable.

svc gates G5 and G6 are implicitly pass^k — a pre-flight that passes 80% of
the time is not a reliable gate. When building new scenario-based framework
tests, explicitly state the strategy: pass@k for capability proof, pass^k for
regression detection.
```

*`references/benchmark-findings.md`* — add headers to existing and future findings to mark which strategy was used.

*Before:* Framework tests run once. A test that passes 7/10 times looks "green" on the run that passed. No formal vocabulary to describe the problem.
*After:* Framework tests label their strategy. pass^k tests require consistent success. Flaky tests are identified as pass@k candidates requiring stabilization before becoming pass^k gates.

**What NOT to take:**
ECC uses pass@k/pass^k in the context of AI output evaluation (LLM responses are non-deterministic). svc's framework tests are mostly deterministic (static eval scripts). Don't import the non-determinism framing — import only the vocabulary and apply it to svc's context.

**Why this matters:**
Doctrine evidence debt is listed in svc's Known Gaps: "Needs repeat-run variance fixtures." That debt is precisely about the pass^k problem — claims that need k-run consistency proof, not just one successful demo. The formal vocabulary makes this debt speakable and actionable.

**Hybrid opportunity:**
svc can extend the vocabulary: **pass@k (strict)** for scenarios that must reach the same terminal state every time (deterministic skill chains), vs **pass@k (relaxed)** for scenarios that must produce equivalent-quality output but through different paths (non-deterministic routes through explore-solutions). ECC doesn't distinguish these because it's working with LLM outputs generally; svc can be more precise.

---

## Assessment A: Blend Opportunities

See items 1-8 above. Summary:
- **Items 1-4**: Hook system hardening — tiering, config protection, no-verify blocking, commit quality. All implementable by extending the existing `svc-workflow-guard.js` rather than adding new files.
- **Item 5**: Batch Stop quality — new `svc-stop-quality.js` + two new hook entries.
- **Item 6**: Model routing reference — new `references/model-routing.md`.
- **Item 7**: CLI-over-MCP — additive to `references/context-budget.md`.
- **Item 8**: Evaluation vocabulary — additive to `test-framework/SKILL.md` and `references/benchmark-findings.md`.

---

## Assessment B: External Addon Viability

**Runtime addon?** YES — AgentShield only
**License:** MIT (confirmed in ECC repo)
**Install:** `npx ecc-agentshield scan` (no full ECC install required; runs as standalone CLI)

**Integration point:**
AgentShield scans the agent infrastructure itself (CLAUDE.md, hooks.json, MCP configs, agent defs, skills). svc's `review-security` skill audits application code (OWASP Top 10, STRIDE). These are complementary, non-overlapping domains.

In the svc pipeline, AgentShield fits as a post-onboard check:
- After `onboard-repo` completes → run `npx ecc-agentshield scan` on the project's `.claude/` configuration
- After any change to `.claude/settings.json`, `hooks.json`, or CLAUDE.md → re-run AgentShield

**Interop contract:**
- **Invocation**: `npx ecc-agentshield scan --output json > docs/specs/agentshield-report.json`
- **Output**: JSON with grades A-F per category, findings array, severity levels
- **CI gate**: Exit code 2 on critical findings — can be added to pre-merge check
- **svc skills that use it**: `onboard-repo` (run after repo conversion), `review-security` (surface AgentShield results alongside app security findings)

**What svc should NOT rebuild:**
- The 102 static analysis rules for CLAUDE.md injection risks, hook script injection patterns, MCP server trust levels, secret exposure in agent configs
- The red-team/blue-team/auditor Opus pipeline (`--opus` flag)

**What svc should still own:**
- Application-level OWASP/STRIDE review (`review-security` — different domain)
- svc's AP-25 (untrusted content fencing) — runtime defense vs AgentShield's static config audit

**EXTERNAL_ADDONS.md draft:**
```markdown
## Add-On: AgentShield (optional)

**What it is:** Static security auditor for Claude Code agent infrastructure. Scans
CLAUDE.md, hooks, MCP configs, agent definitions, and skills for injection risks,
secret exposure, permission misconfigurations, and hook script vulnerabilities.
Complements `review-security` (application code security) — does NOT overlap.

**Install:** `npx ecc-agentshield@latest` (standalone CLI, no full ECC install required)
**License:** MIT

**When to use:**
- After `onboard-repo` completes on a brownfield project
- After any change to `.claude/settings.json`, `hooks.json`, or CLAUDE.md
- As a CI gate: `npx ecc-agentshield scan --fail-on critical`

**Integration in svc pipeline:**
- `onboard-repo` → run AgentShield scan → surface findings in onboarding summary
- `review-security` → optionally include AgentShield JSON output in security report

**Does not replace:**
- `review-security` (OWASP/STRIDE for app code)
- AP-25 untrusted content fencing (runtime defense)
```

---

## Skipped Items

| External | Reason for skip |
|----------|----------------|
| Language rule sets (14 dirs) | Intentional scope: svc is a development framework, not a language guide. Adding language rules would create maintenance burden without serving svc's progressive narrowing goal. |
| Instinct-based continuous learning v2.1 | Philosophical mismatch: ECC's observe-every-tool-call approach captures everything, including noise. svc's `manage-learnings` uses a deliberate 3-question gate that produces higher-signal entries. For a deterministic framework, deliberate learning is preferable to automatic instinct accumulation. |
| ECC 2.0 Rust control plane | Not GA; alpha only. svc has no control-plane architecture; adding one is a major architectural commitment not warranted by current scale. |
| PM2 / loop-operator orchestration | svc uses point-in-time subagent delegation within skills, not persistent multi-process orchestration. Different use case. |
| Business / operator workflow skills | Domain mismatch: brand-voice, content-engine, Google Workspace ops are for product/marketing work, not development framework work. |
| Domain-specific security (HIPAA, DeFi, EVM) | Domain-specific. svc's review-security is general-purpose; domain specializations are project-specific addons, not framework patterns. |
| MCP config templates | Infrastructure concern, not a framework pattern. svc's install is framework-centric; shipping MCP configs would conflate framework and project infrastructure. |
| Cross-harness support beyond Claude Code + Codex | svc already supports both primary harnesses. Additional harness support (Cursor, OpenCode, Gemini, Antigravity) adds install/maintenance complexity with diminishing returns. |
| Session-start-bootstrap hook | svc's file-based continuity (project-state.md + router-context.md read at skill start) is richer than a hook-based session start. The hook can't reliably access all the context that route-workflow reads from files. |
| Governance-capture hook | svc has `.svc/pipeline-decisions.jsonl` with enum-validated schema. ECC's hook captures loosely structured governance events. svc's is more formal and already adequate. |
| Legacy command shims (79 commands) | svc deliberately uses skills directly. The shim layer is a backward-compatibility concern ECC has because it predates the skills-first approach. |
| Suggest-compact hook | svc's context-budget.md already covers compaction triggers as documented behavior. A hook that suggests compaction at arbitrary intervals is less precise than the tier-based degradation model. |
| Surface-count breadth | svc's 49 focused skills with depth and gates outperform 181 skills with no pipeline. Breadth is not a goal. |
| Design-quality-check hook | ECC warns about generic template UI. svc has AP-22 (AI slop blacklist) as a reference doc. A hook that fires on every UI edit is too noisy for svc's phase-gated workflow. |

---

## Attribution Update

Add to `NOTICES`:
```
everything-claude-code
  https://github.com/affaan-m/everything-claude-code
  Copyright (c) 2026 Affaan M. and contributors
  License: MIT

  Patterns derived:
  - Hook runtime profiling (ECC_HOOK_PROFILE=minimal|standard|strict) →
    hooks/hooks.json (SVC_HOOK_PROFILE tiering)
  - Config-protection hook pattern →
    hooks/svc-workflow-guard.js (config file protection check)
  - Block-no-verify hook concept →
    hooks/svc-workflow-guard.js (--no-verify / --no-gpg-sign blocking)
  - Commit-quality hook concept →
    hooks/svc-workflow-guard.js (commit message + trailer validation)
  - Post-edit accumulator + batch Stop format+typecheck →
    hooks/svc-stop-quality.js
  - Model routing decision table (Haiku/Sonnet/Opus by task type) →
    references/model-routing.md
  - CLI-over-MCP preference pattern →
    references/context-budget.md
  - pass@k vs pass^k evaluation vocabulary →
    test-framework/SKILL.md, references/benchmark-findings.md
```
