# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Serious Serious Vibe Engineering (SSVE) — a 103-skill framework for progressive deterministic development (count = `skills-manifest.json includedSkills.length`, verified 2026-08-11; check the manifest, don't trust this prose). This repo IS the framework, not a project built with it. Skills are SKILL.md files that Claude Code loads as prompts. The lowercase `svc` name remains the compatibility namespace for commands, paths, state, and hooks.

Bootstrap rule for onboarded projects: respect the project's local AGENTS.md/CLAUDE.md and svc route-workflow contract from its actual worktree; post-deploy/production validation asks require live post-deploy evidence, never local substitutes.

## Commands

```bash
# Lint — validates skills-manifest.json against README, REPO_MODES, route-workflow, EXTERNAL_ADDONS
node scripts/lint-skills-manifest.mjs

# Tier 1 evals (static, no LLM, <30s)
bash test-framework/evals/run-all-evals.sh --tier1

# Individual tier 1 checks
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-contracts.sh
bash test-framework/evals/tier-1/validate-chain-references.sh
bash test-framework/evals/tier-1/validate-self-verify-sections.sh
bash test-framework/evals/tier-1/validate-worktree-safety.sh

# Install framework (symlinks skills + infra into ~/.claude/skills/)
./setup --all-hosts      # provision all nine supported hosts
./setup --host claude    # or any single host when intentionally scoped

# Worktree management
bash scripts/worktree.sh guard <skill-name>
bash scripts/worktree.sh create <branch>
bash scripts/worktree.sh promote <branch>
```

## Architecture

### Skill Structure

Every skill is a directory with `SKILL.md` containing YAML frontmatter + markdown instructions. The frontmatter declares: `name`, `description`, `inputs`, `outputs`, `chain` (lane positions), `progressive`, `self_verify`, `human_checkpoint`.

### Five Source-of-Truth Files That Must Agree

The linter checks these are in sync. Edit one, update the others:

1. `skills-manifest.json` — `includedSkills`, `corePackForRouting`, `laneDefinitions`, `bootstrapStartSequence`
2. `README.md` — skill list (order must match manifest `includedSkills`)
3. `EXTERNAL_ADDONS.md` — core pack list (order must match manifest)
4. `REPO_MODES.md` — bootstrap sequence (numbered list must match manifest)
5. `skills/route-workflow/SKILL.md` — Core Pack section (list must match manifest `corePackForRouting`)

### Shared-Content Registry (WI-137)

`references/shared-content-dirs.json` lists every top-level directory whose content is referenced from skills via `<dir>/<file>.md` patterns and that must therefore appear in `infra_dirs` of every host manifest under `provision/hosts/`. Currently: `["_shared"]`. Adding an entry here REQUIRES adding the same dir to all 5 host manifests' `infra_dirs` in the same change — the meta-rule in `scripts/lint-skills-manifest.mjs` enforces this, and the tier-1 validator `validate-shared-symlinks-meta-rule.sh` covers the negative path.

### Two State Systems

- **`docs/specs/project-state.md`** — per-project pipeline state (product work)
- **`FRAMEWORK-STATE.md`** — framework self-knowledge (framework work)

Never use both simultaneously. Product work reads project-state. Framework work reads FRAMEWORK-STATE.

### Knowledge System

`references/knowledge/` stores layered expertise. Layer 1 (INDEX.md) → Layer 2 (CAPABILITIES.md per source) → Layer 3 (detail files on demand). All research skills write here. `references/knowledge-protocol.md` defines the 4-pass extraction protocol.

`references/knowledge/svc/CAPABILITIES.md` is the framework's self-description in the same format used for external sources.

### Seven Lanes

Product: greenfield, brownfield-conversion, brownfield-feature, bugfix, drift, refactor. Framework: framework (self-improvement).

### Commit Rules

- Author: `s7an-it <angelovsan@gmail.com>` (configured in repo `.git/config`)
- Co-author trailer: use the ACTIVE orchestrator model — currently `Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>`
- Branch protection is on — direct push bypasses with warning

### Profile-Based Model Routing

This framework uses **profiles** to map cognitive labels to execution harnesses. The default profile for Claude Code is **`svc-default`** — the framework's proven multi-harness mixing.

```bash
# What harness + model should I use for execution right now?
bash scripts/resolve-model.sh EXEC --json
# → harness: claude, model: claude-sonnet-5, effort: high (svc-default per WI-470)
```

### svc-default Profile (Production)

<!-- svc:generated:begin claude-md-svc-default — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
| Label | Harness | Model |
|-------|---------|-------|
| **[STRAT]** | Claude | Opus 4.8 |
| **[PLAN]** | Claude | Opus 4.8 |
| **[EXEC]** | Claude | Sonnet 5 |
| **[REVIEW]** | Claude | Sonnet 5 |
| **[SENSE]** | **MiMo** | **MiMo-V2.5-Pro** |
| **[DISC]** | Native | web_search |
| **[PASS]** | Claude | Haiku 4.5 |
<!-- svc:generated:end claude-md-svc-default -->

> ⚠️ Model IDs single-sourced from `references/model-registry.json` — refreshed by **WI-357** (2026-06-06; EXEC→Sonnet 4.6) then **WI-470** (2026-06-30; EXEC+REVIEW→Sonnet 5, effort:high declared, claude-api-verified). Table generation pending WI-364 — until then edit the registry first, then sync mirrors.

MiMo is an **execution harness**, not an orchestrator. Since WI-470, svc-default pins the EXEC + REVIEW subagents to **Sonnet 5** — `svc-stage-exec`/`svc-stage-land`, `svc-journey-qa`, and the review agents `svc-lens-correctness`/`-security`/`-spec-fidelity`, `plan-reviewer`, `strategic-reviewer` (the PASS-tier `svc-lens-perf` stays Haiku) — with **high reasoning effort declared in the registry** (`output_config.effort:high`, surfaced via `resolve-model.sh EXEC --effort`). The model pin is what runtime honors today; the effort value is the routing *declaration* — consumers apply it via the Agent dispatch effort param (WI-399). It delegates only video/visual QA (SENSE) to MiMo when `MIMO_API_KEY` is set; MiMo-everything execution remains available via the `opencode-mimo` profile.

### Switching Profiles

```bash
# Pure Claude — no MiMo delegation
export SVC_MODEL_PROFILE=claude-native

# Pure Kimi — if you want to test how Kimi handles everything
export SVC_MODEL_PROFILE=kimi-native
```

When running in parallel with Kimi, each orchestrator resolves labels through its own profile. See `references/model-routing.md` and `references/model-registry.json`.

### Key Reference Docs

| File | Purpose |
|---|---|
| `DOCTRINE.md` | Methodology: phases, gates, feedback loops, invocation modes |
| `references/knowledge-protocol.md` | 4-pass research protocol for all knowledge extraction |
| `references/context-budget.md` | Context degradation tiers and read-depth rules |
| `references/verification-patterns.md` | 4-level verification (exists/substantive/wired/functional) |
| `references/anti-patterns.md` | 24 universal anti-patterns |
| `references/thinking-models.md` | 5 structured reasoning models for decision points |

### Provisioning

`provision/hosts/<host>.json` defines per-host capabilities. `setup` reads the manifest and symlinks accordingly. Adding a new host = one JSON file.


## Mandatory Plan-Exec-Review Chain (added 2026-05-13)

This repo now ships a three-layer enforcement chain that makes
plan-changeset + review-plan + execute-changeset + review-exec +
audit-implementation + land-changeset + verify-promotion mandatory for
every non-quick-fix change.

Key entry points for this host:
- `scripts/run-external-review.mjs` — sole paid independent-review launcher;
  Claude → Codex 5.6 sol/high with no fallback; Codex resolves the versioned
  reviewer profile (`fable-high` before the UTC cutover, `opus-high` after it,
  or an explicit owner-selected Fable profile). A Fable provider safeguard
  route is receipted as same-process Opus, while the separate Opus xhigh
  launcher fallback remains limited to classified availability failures.
- `scripts/resolve-adversarial-reviewer.sh` — probe-free compatibility adapter
  over `run-external-review.mjs --policy-status`
- `scripts/svc-reconcile.mjs` — local L3 gate; route-workflow preflight runs this
- `scripts/emit-receipt.mjs` — one-call receipt emitter every chain skill must invoke
- `references/chain-receipt-contract.md` — schema and lifecycle contract
- Receipts are stored as git notes on `refs/notes/svc-receipts` (durable,
  pushable; mirror at `.svc/receipts/<sha>/` is a regenerable cache)

Chain mode is read from `.svc/chain-policy.json` (gitignored, machine-local) —
**read the file, never assume.** On this machine: **refuse mode since
2026-05-13**. Exempt-class commits (docs/specs, docs/analysis, proposals,
references/knowledge, append-only `.svc/*.jsonl` — WI-360) need only the
auto-emitted quick-fix receipt, which is tree-bound to its commit; every
other pushed non-quick-fix commit needs the 5-receipt envelope
(plan-manifest, review-plan, exec-record, review-exec, audit-implementation),
and the pre-push hook validates the ENTIRE `remote..local` range, not just
the tip.

Rules load on demand since WI-361: 5 always-on behavioral rules live in the
global rules dir (WI-393 demoted long-output-to-file to signal-injection on
output-heavy skill paths); the rest inject via `hooks/svc-rule-injector.mjs`
when their path/command/content signals match (registry:
`skills-manifest.json` rulesRegistry `auto_inject`/`signals`; Claude host
only — other hosts keep the full install until injector parity lands).

Out-of-scope as orchestrators for this plan: OpenCode, Gemini, Kimi, MiMo.
Out-of-scope as reviewers: Kimi, MiMo.
Reviewer allowlist: `{codex, claude, gemini}`.

See the full plan in this commit's history and the `mandatory-chain-v1.0` tag.

## Current Assessment (2026-06-06)

A deep 12-dimension evaluation of the framework lives at
`docs/analysis/framework-evaluation-2026-06-06.md` (companions:
`docs/analysis/plan-pressure-test-2026-06-06.md`,
`docs/analysis/skill-catalog-context-research-2026-06-06.md`,
`docs/specs/reviews/framework-eval-plan-cross-model.md`). Verdict: world-class
verification/learning layers; top liabilities are context economy and hook
latency. The fix backlog is **WI-357..WI-371** (see
`docs/specs/work-items/INDEX.md`) — executed SEQUENTIALLY, one WI per
pipeline run, through `/route-workflow`; WI-357 (model-registry refresh)
first. The cluster is COMPLETE (2026-06-09); WI-380..399 extend it.

Parallel/multi-agent transport policy (S5, recorded 2026-06-09 — supersedes
the older "read-only analysis only" line): mutating work MAY use isolated or
parallel transport (per-stage fresh subagents per WI-380; disjoint-file
worktree waves per WI-387/388) **under the structural fences** — claims
discipline, the disjoint-file pre-dispatch fence
(`scripts/lib/disjoint-scopes.mjs`), post-barrier receipts, and the `.svc`
3-way merge driver (WI-398). See `references/workflow-fanout-protocol.md` and
the `S5-policy` ledger entry. The sequential single-WI chain remains the
DEFAULT; subagent dispatch is bound by WI-399 §Subagent design constraints
(dispatch decision tree, model tiers, measure-then-promote). Never bulk-edit
the hot path.
