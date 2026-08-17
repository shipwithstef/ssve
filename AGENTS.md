# AGENTS.md — Serious Serious Vibe Engineering (SSVE)

> AI-agent guidance for working in this repository. Read this first before making any changes.

Bootstrap rule for onboarded projects: respect the project's local AGENTS.md/CLAUDE.md and svc route-workflow contract from its actual worktree; post-deploy/production validation asks require live post-deploy evidence, never local substitutes.

---

## 1. Project Overview

**Serious Serious Vibe Engineering (SSVE)** is a **production-grade governed skill and runtime framework** for progressive deterministic development with LLMs. It is **not a single application**. Its 103 first-party reusable skills are packaged beneath `skills/` and installed consistently across nine supported agent hosts. The lowercase `svc` name remains the compatibility namespace for commands, paths, state, and hooks.

Skills form a deterministic pipeline from product vision to verified code merge:

```
vision → domain → competitors → personas → validate → spec → UX → UI → tech → plan → execute → review → land → verify
```

Core principles:
- **Progressive narrowing** — each phase constrains the solution space until code generation is essentially deterministic.
- **Worktree isolation** — feature implementation runs in git worktrees under `.worktrees/`.
- **Seven review gates (G1–G7)** — adversarial review protocol at fixed checkpoints.
- **Local-first, mock-by-default** — external dependencies are mocked unless explicitly enabled.
- **Four-layer token cache** — 50–60% cost reduction through structured caching.
- **Zero-block operator UX** — safe reads work without a WI, the first task binds atomically, and same-owner recovery self-heals while foreign or ambiguous mutation remains fail-closed.
- **Configurable review topology** — owner policy selects phase-, mode-, and host-specific reviewers without changing framework code.

---

## 2. Technology Stack

This repository is **documentation and script-driven**. There is no compiled application, no root `package.json`, `pyproject.toml`, or `Cargo.toml`.

| Layer | Technology |
|-------|------------|
| **Skills** | Markdown with YAML frontmatter (`SKILL.md`) |
| **Scripts** | Bash (portable, `set -euo pipefail`), Node.js (`.mjs` with inline `#!/usr/bin/env node`), Python 3 (auxiliary) |
| **Registry** | JSON (`skills-manifest.json`) |
| **State** | Markdown (`FRAMEWORK-STATE.md`, `docs/specs/project-state.md`) + JSON (`.svc/lane-tasks-*.json`) |
| **Policies** | TOML (`provision/policies/svc-safety.toml`) |
| **Host integration** | Claude Code, Kimi Code CLI, OpenAI Codex CLI, Gemini CLI, OpenCode CLI |
| **Runtime deps** | `bash`, `git`, `node`, `python3`, `flock` (util-linux), `claude` (for tier 2/3 tests), optional `jq`, `gh` |

There is **no Docker, no CI/CD platform, no traditional deploy target**. The "build" is `./setup`, a content-addressed installer that materializes skills and infrastructure into host-specific locations.

---

## 3. Project Structure

```
seriousvibecoding/
├── skills/                    # First-party source package
│   └── <skill-name>/          # One directory per skill (kebab-case)
│       ├── SKILL.md           # Authoritative contract (YAML frontmatter + markdown body)
│       ├── scripts/           # Skill-local helpers (optional)
│       ├── references/        # Skill-local docs (optional)
│       └── assets/            # Templates, viewers, icons (optional)
├── scripts/                   # Framework-wide utilities (bash + .mjs)
├── test-framework/            # Multi-tier eval harness (its skill contract is skills/test-framework/SKILL.md)
│   └── evals/
│       ├── run-all-evals.sh
│       ├── tier-1/            # Static validation (free, <10s)
│       ├── tier-1.5/          # Skill comprehension (~5K tokens/test)
│       ├── tier-2/            # Integration scenarios (~50K tokens/scenario)
│       └── tier-3/            # LLM-as-judge (~20K tokens/judgment)
├── references/                # Shared doctrine and reusable references
│   ├── anti-patterns.md
│   ├── blend-registry.json
│   ├── context-budget.md
│   ├── knowledge/             # Layered expertise (INDEX → CAPABILITIES → detail)
│   ├── landing-bank/          # Sector reference bank for benchmark-landing
│   └── bootstraps/            # Bootstrap templates
├── hooks/                     # Claude Code PreToolUse / PostToolUse hooks
├── rules/                     # Correction and steering rules for CLAUDE.md / AGENTS.md injection
├── agents/                    # First-class agent definitions (YAML frontmatter + system prompt)
├── provision/
│   ├── hosts/                 # Host manifests (claude.json, kimi.json, codex.json, gemini.json, opencode.json)
│   └── policies/              # Global safety policies
├── docs/
│   ├── specs/                 # Feature specs, journeys, work items, decisions
│   ├── learnings/             # Project learnings
│   ├── logs/                  # Session logs
│   └── plans/                 # Changeset plans
├── .svc/                      # Pipeline state (lane tasks, decision logs)
├── .worktrees/                # Git worktrees for feature isolation
├── skills-manifest.json       # Central registry: skills, lanes, gates, rules, artifacts
├── DOCTRINE.md                # Complete methodology documentation
├── FRAMEWORK-STATE.md         # Living framework self-knowledge
├── WORKTREES.md               # Worktree model documentation
├── setup                      # Framework installer (bash)
└── AGENTS.md                  # This file
```

---

## 4. Build, Install, and Development Commands

### Install / Refresh Framework
```bash
./setup                          # Install for default host (Claude Code)
./setup --host kimi              # Install for Kimi Code CLI
./setup --host codex             # Install for Codex CLI
./setup --host gemini            # Install for Gemini CLI
./setup --host opencode          # Install for OpenCode CLI
./setup --host antigravity       # Install for Antigravity
./setup --host cursor            # Install for Cursor
./setup --host grok              # Install for Grok Build CLI
./setup --all-hosts              # Converge all nine provisioned hosts
./setup --all-hosts --full       # Force a complete rebuild on every host
```
Normal setup is content-addressed: unchanged hosts are a byte-stable no-op, while per-host locks and bounded concurrency make all-host refreshes safe and fast. Use `--full` only for an explicit rebuild. Post-install, run `bash scripts/check-install-drift.sh --all-hosts` to aggregate stale/missing state across every provisioned host.

### Validation & Linting
```bash
# Validate skills-manifest.json against skill metadata and cross-reference files
node scripts/lint-skills-manifest.mjs

# Check pipeline integrity for this repo
bash test-framework/scripts/validate-pipeline-integrity.sh .

# Detect install drift (missing/stale symlinks)
bash scripts/check-install-drift.sh [--host claude|kimi|codex|gemini|opencode|mimo-code|antigravity|cursor|grok] [--quiet]
bash scripts/check-install-drift.sh --all-hosts [--quiet]
```

### Multi-Host Install Protection

Framework-wide skills must be installed on **all provisioned hosts** (Claude, Kimi, Codex, Gemini, OpenCode, MiMo-Code, Antigravity, Cursor, Grok), not just the active session host.

**Pre-commit hook** (`hooks/svc-pre-commit-multi-host-check.sh`):
- Auto-detects when framework files are staged
- Runs `check-install-drift.sh` for all hosts
- Auto-runs `./setup --host <host>` if drift detected
- Blocks commit if any host setup fails

```bash
# Install the hook
ln -s ../../hooks/svc-pre-commit-multi-host-check.sh .git/hooks/pre-commit
```

### Durable Mutation Authority

- Resolve mutation authority from the canonical operation worktree, never from
  the session checkout alone. Explicit `tool_input.workdir` and every file-tool
  target must canonicalize to the same exact Git worktree.
- Controller authority is a repository-shared v2 lease bound to a stable
  principal and generation. Same-session resume reattaches; a different session
  requires atomic handover or evidence-backed recovery.
- Safe read-only operations do not require a WI or controller lease. The
  canonical first-task loader is the sole allowed atomic pre-task activation;
  same-owner branch and binding drift converges idempotently without an owner
  shell ritual, while foreign, ambiguous, or escaping state is denied before
  mutation.
- Mutating children require a persisted, task-specific delegation, an isolated
  inner worktree, disjoint allowed paths, and a host capability whose containment
  probe passes. Child results merge sequentially after receipt recomputation.
- PreTool hooks are an authority guardrail, not a complete shell security
  boundary. Use the host sandbox or `scripts/svc-contained-exec.mjs` for actual
  filesystem containment.
- Proven read-only Codex operations run without a WI/controller lease. The
  consolidated PreToolUse dispatcher keeps mutation authority fail-closed and
  uses an argv-aware fast path with an executable native p95 budget.
- SessionStart self-heal executes setup only from the durable install receipt's
  canonical Git source; a pathname or lookalike file set is never authority.
- Setup is content-addressed and transactional across its managed host surface:
  manifest infrastructure participates in drift, target ancestry is no-follow,
  and late verification/wiring failure restores the prior bytes.

### Testing
```bash
# Tier 1 only — no paid LLM. Focused checks are normally <10s; the complete
# corpus can take several minutes. Run it before every commit.
bash test-framework/evals/run-all-evals.sh

# Full suite — tiers 1.5, 2, and 3. Requires `claude` or `kimi` CLI + LLM tokens.
EVALS=1 bash test-framework/evals/run-all-evals.sh
```

### Worktree Management
```bash
bash scripts/worktree.sh create <branch>      # Create worktree for feature branch
bash scripts/worktree.sh enter <branch>       # Enter worktree directory
bash scripts/worktree.sh status <branch>      # Show worktree status
bash scripts/worktree.sh promote <branch>     # Push, open PR, squash-merge
bash scripts/worktree.sh remove <branch>      # Remove worktree and branch
bash scripts/worktree.sh list                 # List all worktrees
bash scripts/worktree.sh guard <skill-name>   # Check if skill should run on main vs worktree
```

### Individual Tier-1 Checks
```bash
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-chain-references.sh
bash test-framework/evals/tier-1/validate-self-verify-sections.sh
bash test-framework/evals/tier-1/validate-worktree-safety.sh
```

---

## 5. Skill Anatomy & Coding Conventions

### Directory Naming
- Skill directories use **lowercase kebab-case**: `write-spec`, `route-workflow`, `benchmark-landing`.
- The authoritative contract is always `SKILL.md` inside the skill directory.

### SKILL.md Format
Every `SKILL.md` has two parts:

1. **YAML frontmatter** with these fields:
   - `name` — kebab-case identifier (max 64 chars)
   - `description` — **WHEN to trigger**, not what steps it takes. Includes trigger phrases. Max 1024 chars. No angle brackets.
   - `inputs` / `outputs` — Required and optional artifacts with paths and artifact names
   - `chain.lanes` — Lane position mapping (`greenfield`, `brownfield-feature`, `bugfix`, `framework`, etc.) with `position`, `prev`, `next`
   - `progressive` — Whether the skill auto-invokes the next skill in the lane
   - `self_verify` — Whether the skill runs a PASS/FAIL checklist before declaring done
   - `human_checkpoint` — Whether it stops for user confirmation in interactive mode

2. **Markdown body** conventions:
   - Start with an "Announce at start" line.
   - Use **imperative, operational** language.
   - Use tables heavily for decision matrices, checklists, and anti-patterns.
   - Include a **Self-Verify** table with columns `# | Check | How | PASS/FAIL` and at least 3 data rows.
   - Include a **Pipeline Continuation** section describing how to update `.svc/lane-tasks-<WI>.json`.
   - Include **Rationalization Tables** and **Red Flags** in discipline-enforcing skills.
   - Keep `SKILL.md` under **500 lines** where possible. Larger content goes in `references/` or `scripts/`.

### Shell Scripts
- Portable Bash with `set -euo pipefail` where appropriate.
- Node.js scripts use `.mjs` extension with inline `#!/usr/bin/env node` shebang.

### Markdown Style
- Concise, imperative, operational.
- Preserve YAML frontmatter fields and path conventions such as `docs/specs/...` and `references/...`.

---

## 6. Testing Strategy

The test framework uses a **tiered cost model**:

| Tier | Cost | Duration | What it tests |
|------|------|----------|---------------|
| **Tier 1** | $0 | focused <10s; full corpus may take minutes | Static and local integration validation — structure, contracts, routing, authority, host installation, receipts, and worktree safety. **Always runs.** |
| **Tier 1.5** | ~5K tokens/test | ~30–60s | Skill comprehension & triggering — asks the host LLM factual questions and verifies correct skill routing. |
| **Tier 2** | ~50K tokens/scenario | ~2min | Integration scenarios — runs `claude -p` against scaffolded workspaces, asserts file existence and content. |
| **Tier 3** | ~20K tokens/judgment | ~1min | LLM-as-judge — scores tier-2 outputs on completeness, consistency, and actionability. |

### Key Test Scripts
- `test-framework/evals/run-all-evals.sh` — Orchestrates tiers. Set `EVALS=1` to run tiers 1.5–3.
- `scripts/lint-skills-manifest.mjs` — Cross-checks `skills-manifest.json` against `README.md`, `REPO_MODES.md`, `EXTERNAL_ADDONS.md`, and `skills/route-workflow/references/routing-rules.md`.
- `scripts/verify-plan-mechanical.sh <manifest.md>` — Checks file paths, npm scripts, bash syntax, forbidden patterns, and task-graph `blocked_by` references.
- `scripts/check-install-drift.sh` — Detects skills present in source but not installed at target.

### Adding Tests
- Add new eval fixtures under `test-framework/evals/tier-*`.
- Keep scenario names descriptive.
- When changing skill contracts, run at least the relevant tier plus the manifest linter.
- Store generated evidence under `test-framework/results/` when the workflow expects it.

---

## 7. Worktree Model & Branching

All feature work that produces code runs in a **git worktree** under `.worktrees/`.

| Phase | Runs on main | Runs in worktree |
|-------|-------------|------------------|
| Planning | write-vision, validate-feature, write-spec, design-ux, design-ui, design-tech, plan-changeset | — |
| Build + Validate | — | execute-changeset, review-gate, audit-implementation, E2E tests |
| Merge + Verify | land-changeset (squash-merge), verify-promotion | — |

### Branch Naming
| Lane | Pattern | Example |
|------|---------|---------|
| Greenfield / Brownfield Feature | `feature-<name>` | `feature-notifications` |
| Bugfix | `bugfix-<name>` | `bugfix-auth-500` |
| Refactor | `refactor-<name>` | `refactor-api-layer` |
| Framework Test | `test-<name>` | `test-autopilot-s1` |

### Rules
1. All worktrees live under `.worktrees/` — never `/tmp/`, never a sibling directory.
2. `.worktrees/` must be in `.gitignore` (enforced by `scripts/worktree.sh preflight` and tier-1 validation).
3. One worktree per branch — the branch name is the worktree directory name.
4. `worktree.sh create` is idempotent — safe to re-run after interruption.

---

## 8. Review Gates & Lanes

### Seven Review Gates (G1–G7)
Fixed checkpoints between pipeline phases:

| Gate | After Skill | Purpose |
|------|-------------|---------|
| G1 | `write-spec` | Spec completeness, AC coverage, scope review |
| G2 | `design-ux` | UX flow correctness, state coverage |
| G3 | `design-ui` | Visual design completeness, component specs |
| G4 | `design-tech` | Architecture soundness, security, data model |
| G5 | `execute-changeset` | Implementation vs spec, test coverage, code quality |
| G6 | `land-changeset` | Merge cleanliness, commit history |
| G7 | `verify-promotion` | Post-merge verification, promotion completeness |

### Seven Lanes
Skills declare their lane position in `chain.lanes` within `skills-manifest.json`:

1. `greenfield` — New product from scratch
2. `brownfield-conversion` — Convert existing repo to svc
3. `brownfield-feature` — Add feature to existing svc repo
4. `bugfix` — Fix broken behavior
5. `drift` — Fix spec/code drift
6. `refactor` — Restructure without behavior change
7. `framework` — Improve the svc framework itself

### Feature States
Artifacts progress through: `DRAFT` → `UX-REVIEWED` → `DESIGNED` → `BASELINED` → `CHANGE-SET-APPROVED` → `PROMOTED` → `VERIFIED` (plus `REJECTED`, `PIVOTED`).

---

## 9. State Management & Source-of-Truth Files

### Two State Systems (never use both simultaneously)
- **`docs/specs/project-state.md`** — Per-project pipeline state (product work).
- **`FRAMEWORK-STATE.md`** — Framework self-knowledge (framework work).

### Five Files That Must Stay in Sync
The manifest linter enforces agreement across these files. Edit one, update the others:

1. `skills-manifest.json` — `includedSkills`, `corePackForRouting`, `laneDefinitions`, `bootstrapStartSequence`
2. `README.md` — Skill list (order must match `includedSkills`)
3. `EXTERNAL_ADDONS.md` — Core pack list (order must match manifest)
4. `REPO_MODES.md` — Bootstrap sequence (numbered list must match manifest)
5. `skills/route-workflow/SKILL.md` — Core Pack section (list must match `corePackForRouting`)

### Manifest Array Roles
The manifest arrays are intentionally not one canonical order:

| Array | Role |
|-------|------|
| `includedSkills` | Complete first-party skill registry and install surface. |
| `corePackForRouting` | Router-suggestable baseline; excludes skills that are normally auto-invoked by gates or lane logic. |
| `bootstrapStartSequence` | Minimal greenfield bootstrap order, not the full greenfield lane. |
| `pipeline` | Product-build spine for gate placement and documentation. |
| `laneDefinitions.<lane>.skills` | Lane-specific execution order with conditional and skip-eligible steps. |

All smaller arrays must remain subsets of `includedSkills`. `scripts/lint-skills-manifest.mjs` enforces the subset invariant and the role metadata in `skills-manifest.json`.

### Cross-Host Task Graph
- `.svc/lane-tasks-<WI>.json` is the **cross-host source of truth** for active task graphs.
- Two-level structure: **Lane Tasks** (top-level skill invocations) + **Process Tasks** (embedded steps).
- Skills mark themselves `completed` in the JSON before leaving.
- Host UI mirroring (`TaskList`/`TaskUpdate` in Claude, `update_plan` in Codex) is secondary.

### Reviewer Policy

- The owner-controlled external policy is `~/.svc/reviewer-policy-v2.json` (or
  `SVC_REVIEWER_POLICY`). Reviewer topology is selected by orchestrator, phase,
  and mode; changing the policy does not require a framework commit.
- For Codex production review, self-review is required, Sol is a required
  same-family advisory reviewer, AGY Gemini 3.7 Flash High is the required
  different-family independent reviewer, and Opus is optional when available.
- `scripts/review-plan-codex.sh` auto-discovers that policy. Legacy
  `resolve-adversarial-reviewer.sh` / `--select-profile` behavior is
  compatibility-only and must not override an explicit owner policy.

---

## 10. Hooks, Rules, and Agents

### Hooks (`hooks/`)
Installed into host settings (e.g., `~/.claude/settings.json`) by `./setup`. Key hooks:

Codex intentionally exposes one consolidated `PreToolUse` dispatcher in its UI.
That count represents the command-bound dispatcher, not the number of internal
SVC checks and not deleted lifecycle protection. Validate effective wiring with
`./setup --host codex` and `bash scripts/check-install-drift.sh --host codex`.

| Hook | Type | Purpose |
|------|------|---------|
| `svc-workflow-guard.js` | PreToolUse (Edit/Write) | Blocks config/lockfile edits; warns on out-of-scope file writes |
| `svc-phase-boundary-detector` | PreToolUse | Catches spec drift during execution |
| `svc-bash-guard` | PreToolUse (Bash) | Blocks `--no-verify` git bypass; enforces commit trailers |
| `svc-eval-gate-pre` | PreToolUse (TaskUpdate) | Blocks completed tasks with unfilled pillar entries |
| `svc-eval-gate-post` | PostToolUse (TaskUpdate) | Injects eval matrix reminder |
| `svc-lane-tasks-validator.mjs` | PostToolUse (Edit/Write) | **Hard block** on malformed `.svc/lane-tasks-*.json` |
| `svc-stop-quality.js` | Stop | Batch format + typecheck all edited files |
| `svc-task-completion-guard.sh` | Stop | Blocks stop when actionable work remains in task graph |

### Rules (`rules/`)
13 registered rules across stacks (universal, web, golang, rust, python, react, react-native). Each rule has:
- `type`: `correction` (prevents mistakes) or `steering` (guides style)
- `scope`: `universal` or stack-specific
- `source`: `local` or `blended:ecc`

Rules are injected into `CLAUDE.md` / `AGENTS.md` based on the active stack.

### Agents (`agents/`)
First-class primitives distinct from skills. Three agents defined:
- `summary-extractor` — Haiku 4.5, locked pass-through for extracting `SVC_WORKER_SUMMARY` blocks
- `plan-reviewer` — Sonnet 4.6, adversarial reviewer for plan-changeset manifests

Agent format: YAML frontmatter (`name`, `description`, `model`, `tools`, `harness`) + system prompt body.

---

## 11. Security Considerations

- **`provision/policies/svc-safety.toml`** — Global tool safety policy protecting `.git/`, `.env`, and `FRAMEWORK-STATE.md`.
- **`svc-bash-guard` hook** — Blocks `--no-verify` git bypasses and enforces commit trailers.
- **`svc-workflow-guard` hook** — Blocks dangerous config/lockfile edits and warns on out-of-scope file writes.
- **`scripts/verify-plan-mechanical.sh`** — Scans plans for forbidden patterns (`--force`, `rm -rf /`, etc.).
- **No secrets in the repo** — `.env` is protected by policy. Builder profile lives at `~/.svc/builder-profile.md` outside the repo.
- **Worktree isolation** — Feature code never lands directly on `main`; squash-merge via `land-changeset` ensures clean history.

---

## 12. Commit & Pull Request Guidelines

- **Author:** `s7an-it <angelovsan@gmail.com>` (configured in repo `.git/config`)
- **Co-author trailer:** derive the ACTIVE orchestrator/model at commit time;
  never hardcode a different host or model family into the receipt or trailer.
- **Branch protection is on** — direct push bypasses with warning.
- Use short, **imperative summaries** with clear scope.
  - Good: `Add plan-capabilities: project-type-aware capability planning`
  - Good: `Fix list-work-items parser drift for DEFER state`
- Keep commits focused on **one framework concern**.
- PRs should explain:
  - The problem
  - The affected skills or docs
  - What validation ran
  - Link proposals or state files when relevant
- Include screenshots **only** for visual or UI-documentation changes.

---

## 13. Agent Notes

- When framework behavior changes, keep `skills-manifest.json`, router logic, and any affected doctrine or state files in sync.
- Prefer updating the **smallest set of skills** needed, then prove the change with evals.
- Run `node scripts/lint-skills-manifest.mjs` after any manifest, README, or routing change.
- Run `bash test-framework/evals/run-all-evals.sh` before committing skill changes.
- **Post-commit verification:** After any commit, re-run at least the relevant tier-1 validators to confirm the committed state still passes. Do not assume pre-commit validation is sufficient — file state can shift between staging and commit.
- **File persistence verification:** After any batch of WriteFile/StrReplaceFile calls that creates or modifies 3+ files, run `bash scripts/verify-file-persistence.sh --from-git-status` before proceeding. If it reports MISSING files, re-create them using Shell-based writes (heredoc) instead of WriteFile/StrReplaceFile — this is the recovery pattern for post-compaction persistence failures.
- Keep edits small and local. Do not refactor multiple skills in one commit unless the change is a cross-cutting convention update.
- If you add a new skill, follow the `create-skill` SKILL.md process: validate frontmatter, add to manifest, update README, run `./setup --host <your-host>` (e.g., `claude` or `kimi`), run the manifest linter.

---

## 14. Key Reference Docs

| File | Purpose |
|------|---------|
| `DOCTRINE.md` | Complete methodology: progressive narrowing, review protocol, worktree model, token cost analysis |
| `FRAMEWORK-STATE.md` | Living framework self-knowledge (updated with every change) |
| `WORKTREES.md` | Full worktree model documentation |
| `REPO_MODES.md` | Bootstrap vs convert mode detection |
| `EXTERNAL_ADDONS.md` | Optional external skill ecosystems |
| `references/anti-patterns.md` | 24 universal anti-patterns (AP-1 through AP-24) |
| `references/context-budget.md` | Context degradation tiers and read-depth rules |
| `references/verification-patterns.md` | 4-level verification (exists / substantive / wired / functional) |
| `references/thinking-models.md` | 5 structured reasoning models for decision points |
| `references/knowledge-protocol.md` | 4-pass research extraction protocol |
| `references/blend-registry.json` | Tracks patterns blended from external repos |
| `references/pillars-coverage-matrix.md` | 8-pillar coverage matrix spec |


## Mandatory Plan-Exec-Review Chain (added by mandatory-chain rollout)

The `feat/mandatory-plan-exec-chain` branch introduces a three-layer
enforcement system that makes plan-changeset + review-plan +
execute-changeset + review-exec + audit-implementation + land-changeset
+ verify-promotion mandatory for every non-quick-fix change.

Key additions:
- `skills/review-exec/SKILL.md` — new G6 gate (self-review + adversarial via resolver)
- `scripts/quick-fix-eligibility.mjs` — mechanical quick-fix gate
- `scripts/svc-reconcile.mjs` — local L3 gate (responsibilities A + B)
- `scripts/run-external-review.mjs` — canonical schema/receipt/cache review launcher
- `scripts/resolve-adversarial-reviewer.sh` — probe-free exact tuple policy view
- `scripts/install-git-hooks.mjs` — installs hook dispatchers into .git/hooks/
- `hooks/git/{pre-commit,post-commit,pre-push}.d/` — slot directories
- `refs/notes/svc-receipts` — durable receipt store (per commit)
- Working-tree mirror at `.svc/receipts/<sha>/` (gitignored, regenerable)

For full context: see the plan-changeset producing this work and
`references/chain-receipt-contract.md`.
