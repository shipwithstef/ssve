# WI-GROK-SHELL-ALIAS-01 Changeset Manifest

| Field | Value |
|---|---|
| Spec | `docs/specs/bugfix/grok-shell-alias-brief.md` |
| Technical design | `docs/specs/tech/grok-shell-alias.md` |
| Branch | `bugfix-WI-GROK-SHELL-ALIAS-01` |
| Base | `origin/main` at `35c9a07bfa0b4a8cc70bdd672e5690b241d751a5` |
| Status | SIMULATED |
| Execution mode | inline |
| Archetype | Cross-cutting concern — one host protocol alias must behave consistently at every Bash-shaped enforcement entry point |
| Risk Flags | external_state_writer, cross_runtime_integration |

## Implementation Summary

Centralize shell tool aliases and apply the classifier to the owner-named consumers and every fail-closed child on Grok's live consolidated dispatcher path. Preserve raw tool names for diagnostics. Retain zero-state exact bootstrap authorization, isolation, operation-scope validation, and owned-task resolution. Bypass only the Codex skill-load receipt for Grok non-loader shell commands after ownership is proven. Update Grok hook matchers and install with the existing transactional setup path. HoursHub video files are outside scope.

## Entry-point universe

Pattern scan plus G5 live-dispatch review found twelve runtime consumers plus one Grok wirer: the original owner-named hooks, worktree isolation, skill-artifact authenticity, session-contract freshness, phase-receipt autoemit, impact-triad, the shared helper, and Grok TOML wiring. The task graph covers 100% of this corrected live universe.

## Read-only review dependencies

The adversarial plan reviewer may read `AGENTS.md`, `CLAUDE.md`, `skills-manifest.json`, `skills/review-plan/SKILL.md`, `skills/review-cross-model/SKILL.md`, `references/plan-review-protocol.md`, and `rules/plan-changeset-trigger.md`. These govern review behavior and are not implementation write targets.

## Locked implementation decisions

- Treat a call as Grok for receipt bypass only when `tool_name === "run_terminal_command"` or `SVC_HOST.toLowerCase() === "grok"`; require `isShellTool(tool_name)` and an owned in-progress task first.
- A command is loader-shaped conservatively when its shell command contains `codex-load-skill.mjs`; such commands never take the Grok receipt bypass even if strict parsing fails.
- The live replay payload contains `session_id`, `turn_id`, `cwd`, `tool_name: "run_terminal_command"`, and `tool_input.command` with the exact installed bootstrap argv. Expected enforcer stdout is exactly `{}`.
- The Codex validator asserts the five-name classifier, read-only parity, zero-state bootstrap allow, owned ffmpeg receipt bypass, separate isolation denial, host-identity `Shell` allow, non-Grok `Shell` denial, and exact/compound loader denial. The Grok TOML validator asserts exactly two new `Shell|Bash|run_terminal_command` matcher rows.

## Files Planned

| Task | Action | Files | Purpose |
|---|---|---|---|
| T01 | CREATE/MODIFY | hooks/lib/shell-tools.mjs;hooks/codex/svc-codex-skill-load-enforcer.mjs;hooks/lib/operation-scope.mjs;hooks/codex/lib/codex-hook-context.mjs;hooks/lib/pretool-decision-engine.mjs;hooks/svc-workflow-guard.mjs;hooks/svc-loop-guard.mjs;hooks/svc-worktree-isolation-guard.mjs;hooks/svc-skill-artifact-authenticity.mjs;hooks/svc-session-contract-freshness.mjs;hooks/svc-phase-receipt-autoemit.mjs;hooks/svc-impact-triad-guard.mjs | Shared alias classification across the live Grok dispatcher path |
| T02 | MODIFY | scripts/wire-grok-hooks.mjs | Grok matcher wiring |
| T03 | CREATE/MODIFY | test-framework/evals/tier-1/validate-codex-execution-integrity.sh;test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh;test-framework/evals/tier-1/validate-g4-skill-artifact-authenticity.sh;test-framework/evals/tier-1/validate-session-contract-freshness.sh;test-framework/evals/tier-1/validate-phase-receipt-autoemit.sh;test-framework/evals/tier-1/validate-impact-triad.sh;docs/specs/contract-maps/grok-shell-alias.md;docs/specs/test-evidence/WI-GROK-SHELL-ALIAS-01/cross-system-probe.json;docs/specs/reviews/wi-grok-shell-alias-g5.md;docs/specs/reviews/grok-shell-alias-exec-cross-model.md;docs/specs/reviews/grok-shell-alias-exec-review-log.yaml | Alias, bootstrap, receipt, isolation, matcher, dispatcher-child, cross-system proof, and G5 decision |
| T04 | CREATE/MODIFY | docs/specs/bugfix/grok-shell-alias-brief.md;docs/specs/tech/grok-shell-alias.md;docs/plans/2026-08-30-grok-shell-alias/manifest.md;docs/plans/2026-08-30-grok-shell-alias/plan-contract.json;docs/plans/2026-08-30-grok-shell-alias/review-log.yaml;.svc/plan-manifest.json;.svc/lane-tasks-WI-GROK-SHELL-ALIAS-01.json;.svc/phase-override-WI-GROK-SHELL-ALIAS-01.json;.svc/authorization-events.jsonl;.svc/manifest-digest.json;.svc/pipeline-decisions.jsonl | Diagnosis, design, plan/review, graph, chain baton, review digest, and authority decision receipts |

Changeset Blueprint is intentionally omitted because execution mode is `inline` and the same orchestrator holds the diagnosis and technical design context.

## Task Graph

| Task | Files | Depends on | Requirements | Validation | Checkpoint |
|---|---|---|---|---|---|
| task-1-runtime | shared helper + eight hook consumers | none | R1, R2, R3 | `node --check` on every changed module; existing execution-integrity validator | `runtime-aliases` |
| task-2-wiring | `scripts/wire-grok-hooks.mjs` | task-1-runtime | R4 | Grok TOML round-trip validator | `grok-wiring` |
| task-3-proof | two existing Tier-1 validators | task-1-runtime, task-2-wiring | R1–R4 | Grok round-trip + Codex execution-integrity + operation-scope validators | `alias-proof` |
| task-4-closeout | docs/plan/contract | task-3-proof | R1–R4 | mechanical plan, task-graph, persistence, diff-manifest checks | `closeout` |
| land/verify host proof | landed canonical source + installed/live evidence | mandatory review/audit/land chain | R5, R6 | setup, installed-byte/config checks, exact HoursHub hook replay, whole-checkout status equality | `post-land-grok-proof` |

## Requirement-to-Task Mapping

| Requirement | Task |
|---|---|
| R1 five aliases use Bash-shaped predicates | task-1-runtime, task-3-proof |
| R2 Grok bootstrap hatch fires in repo-local fixtures | task-1-runtime, task-3-proof |
| R3 Grok non-loader ffmpeg skips Codex receipt only after owned task | task-1-runtime, task-3-proof |
| R4 Grok config matchers include alias | task-2-wiring, task-3-proof |
| R5 landed Grok copy is refreshed and validated | land/verify host proof |
| R6 installed HoursHub bootstrap replay passes without any HoursHub write | land/verify host proof |

## Requirement-to-Test Mapping

| Requirement | Test type | Evidence |
|---|---|---|
| R1 | Unit/integration | `validate-codex-execution-integrity.sh` alias matrix |
| R2 | Integration | repo-local zero-state enforcer fixture with exact Grok tool alias and bootstrap shape |
| R3 | Integration | owned-task ffmpeg receipt allow; separate `classifyMutation` isolation denial; loader negative fixture |
| R4 | Integration | `validate-grok-hook-toml-roundtrip.sh` and parsed live TOML |
| R5 | Post-land integration | `./setup --host grok` from landed canonical source; `cmp` all changed installed modules; installed helper import; drift check |
| R6 | Post-land integration | exact installed enforcer payload replay from HoursHub default checkout; byte-identical whole-checkout Git status before/after |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style/persona |
|---|---|---|---|
| task-1-runtime | N/A — system-only | `docs/specs/tech/grok-shell-alias.md` authority diagram/invariants | Existing ESM/Node stdlib style; persona N/A — host runtime |
| task-2-wiring | N/A — system-only | External-state and rollback sections | Existing Grok TOML wirer conventions |
| task-3-proof | N/A — system-only | Feasibility and risk matrix | Existing Tier-1 shell fixture conventions |
| task-4-closeout | N/A — system-only | Whole technical design | SSVE artifact conventions |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | `~/.grok/skills/hooks/` installed framework copy | coupled | `./setup --host grok` installs from the durable canonical source; `check-install-drift.sh --host grok` validates receipt/source ancestry |
| 2 | Host config files | `~/.grok/config.toml` matcher rows | coupled | `scripts/wire-grok-hooks.mjs` performs lossless transactional rewrite with immutable `.pre-migration.bak` and rolling `.svc-wire.rollback` |
| 3 | Out-of-tree version-controlled | `/home/dianast/app-workspaces/hourshub-port` default checkout is read-only hook-proof input; no command in this plan writes its product files | coupled | The installed enforcer receives `node ~/.grok/skills/scripts/svc-ensure-worktree.mjs --wi WI-VIDEO-AUDIO-REMEDIATION-02 --branch framework-WI-VIDEO-AUDIO-REMEDIATION-02-audio-remux --from origin/main --print-cd`; proof snapshots Git status for video/media paths before and after |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15.

## Validation Plan

Run focused syntax/fixture proof first, then existing Codex integrity/operation-scope regressions. Do not install during execute-changeset. After review, audit, and landing, run setup from the durable landed source, validate installed bytes/TOML, and launch the installed hook against the HoursHub bootstrap payload. Compare the entire HoursHub Git status before and after; this is stronger than a video-path-only filter.

## Execution Command Sequence

```bash
for file in hooks/lib/shell-tools.mjs hooks/codex/svc-codex-skill-load-enforcer.mjs hooks/lib/operation-scope.mjs hooks/codex/lib/codex-hook-context.mjs hooks/lib/pretool-decision-engine.mjs hooks/svc-workflow-guard.mjs hooks/svc-loop-guard.mjs hooks/svc-worktree-isolation-guard.mjs scripts/wire-grok-hooks.mjs; do node --check "$file"; done  # expected 0
bash test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh  # expected 0
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh  # expected 0
bash test-framework/evals/tier-1/validate-operation-scope-authority.sh  # expected 0
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-30-grok-shell-alias/manifest.md  # expected 0
```

## Verify-promotion Host Command Sequence

Run only from the durable canonical checkout after verifying `git rev-parse HEAD` is the landed merge SHA.

```bash
./setup --host grok  # expected 0; setup transactionally restores its complete managed host surface on failure
bash scripts/check-install-drift.sh --host grok  # expected 0
for file in hooks/lib/shell-tools.mjs hooks/codex/svc-codex-skill-load-enforcer.mjs hooks/lib/operation-scope.mjs hooks/codex/lib/codex-hook-context.mjs hooks/lib/pretool-decision-engine.mjs hooks/svc-workflow-guard.mjs hooks/svc-loop-guard.mjs hooks/svc-worktree-isolation-guard.mjs hooks/svc-skill-artifact-authenticity.mjs hooks/svc-session-contract-freshness.mjs hooks/svc-phase-receipt-autoemit.mjs hooks/svc-impact-triad-guard.mjs; do cmp "$file" "/home/dianast/.grok/skills/$file" || exit 1; done  # expected 0
test "$(readlink -f /home/dianast/.grok/skills/hooks/codex/svc-codex-skill-load-enforcer.mjs)" = "$(readlink -f /home/dianast/.claude/skills/hooks/codex/svc-codex-skill-load-enforcer.mjs)"  # expected 0; Grok and Claude compatibility discovery resolve the same canonical installed tree, so Grok-only setup converges the inherited command without running Claude setup
cmp hooks/codex/svc-codex-skill-load-enforcer.mjs "$(readlink -f /home/dianast/.claude/skills/hooks/codex/svc-codex-skill-load-enforcer.mjs)"  # expected 0; proves Grok's inherited dispatcher child bytes
node --input-type=module -e 'import { isShellTool } from "/home/dianast/.grok/skills/hooks/lib/shell-tools.mjs"; if (!isShellTool("run_terminal_command")) process.exit(1)'  # expected 0
test "$(rg -c 'matcher = "Shell\|Bash\|run_terminal_command"' /home/dianast/.grok/config.toml)" = 2  # expected 0
HOURSHUB_ROOT=/home/dianast/app-workspaces/hourshub-port; HOURSHUB_BEFORE="$(mktemp)"; HOURSHUB_AFTER="$(mktemp)"; GROK_HOOK_OUT="$(mktemp)"; GROK_NEG_OUT="$(mktemp)"  # expected 0
test "$(git -C "$HOURSHUB_ROOT" rev-parse --show-toplevel)" = "$HOURSHUB_ROOT" && git -C "$HOURSHUB_ROOT" status --short > "$HOURSHUB_BEFORE"  # expected 0
node --input-type=module -e 'import { laneGraphs } from "/home/dianast/.grok/skills/hooks/codex/lib/codex-hook-context.mjs"; if (laneGraphs(process.argv[1]).length !== 0) process.exit(1)' "$HOURSHUB_ROOT"  # expected 0; proves bootstrap zero-state
node -e 'const [cwd,command]=process.argv.slice(1);process.stdout.write(JSON.stringify({session_id:"grok-WI-GROK-SHELL-ALIAS-01-live",turn_id:"post-land-proof",cwd,tool_name:"run_terminal_command",tool_input:{command}}))' "$HOURSHUB_ROOT" 'touch must-not-run' | SVC_HOST=grok node /home/dianast/.grok/skills/hooks/codex/svc-codex-skill-load-enforcer.mjs > "$GROK_NEG_OUT"  # expected 0 hook process
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if (j.hookSpecificOutput?.permissionDecision !== "deny" || !/owned in_progress task/.test(j.hookSpecificOutput?.permissionDecisionReason || "")) process.exit(1)' "$GROK_NEG_OUT"  # expected 0; proves no null-repo/owned-task bypass
node -e 'const [cwd,command]=process.argv.slice(1);process.stdout.write(JSON.stringify({session_id:"grok-WI-GROK-SHELL-ALIAS-01-live",turn_id:"post-land-proof",cwd,tool_name:"run_terminal_command",tool_input:{command}}))' "$HOURSHUB_ROOT" 'node /home/dianast/.grok/skills/scripts/svc-ensure-worktree.mjs --wi WI-VIDEO-AUDIO-REMEDIATION-02 --branch framework-WI-VIDEO-AUDIO-REMEDIATION-02-audio-remux --from origin/main --print-cd' | SVC_HOST=grok node /home/dianast/.grok/skills/hooks/codex/svc-codex-skill-load-enforcer.mjs > "$GROK_HOOK_OUT"  # expected 0
test "$(cat "$GROK_HOOK_OUT")" = '{}'  # expected 0; with zero-state + negative control this identifies the bootstrap hatch
git -C "$HOURSHUB_ROOT" status --short > "$HOURSHUB_AFTER" && cmp "$HOURSHUB_BEFORE" "$HOURSHUB_AFTER"  # expected 0
```

RECOVERY_IF_FAIL: stop before installation on repository-test failure. If setup validation fails, rely on the wirer's rolling rollback, inspect the failure, and do not report the host as patched. Never alter HoursHub video files.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| CREATE targets absent | PASS | Shared helper does not exist at base SHA; both validators are existing MODIFY targets. |
| MODIFY targets present | PASS | All named hooks and Grok wirer exist at base SHA. |
| Imports resolve | PASS | Every consumer can reach `hooks/lib/shell-tools.mjs` by relative ESM import. |
| External lifecycle explicit | PASS | Setup/wirer backup, rollback, drift, and live validation are named. |
| Scope complete | PASS | `rg -n '!==? "Bash"|===? "Bash"|SHELL_TOOLS' hooks scripts/wire-grok-hooks.mjs` was classified hit-by-hit: the eight owner-named Bash-shaped consumers are T01; Grok matcher literals are T02; Codex/Claude host wirers and test assertions are excluded because they declare host matcher configuration or fixtures rather than duplicate runtime shell classification. |
| Requirement walkthrough | PASS | R1–R6 each map to implementation and proof tasks. |

Scan remainder outside T01/T02:

| Hit | Exclusion |
|---|---|
| `hooks/svc-owner-inject.mjs`, `hooks/svc-learning-inject.mjs`, `hooks/svc-rule-injector.mjs` | Context-injection hooks wired to host-specific Bash events; not enforcement predicates named by the owner and not in the Grok PreToolUse chain. |
| `hooks/svc-session-contract-freshness.mjs`, `hooks/svc-skill-artifact-authenticity.mjs`, `hooks/svc-phase-receipt-autoemit.mjs`, `hooks/svc-impact-triad-guard.mjs` | INCLUDED after G5 proved the consolidated dispatcher invokes these children for Grok shell calls regardless of their standalone matcher rows. |
| `hooks/kimi/svc-kimi-skill-load-enforcer.sh` | Kimi-specific shell contract, intentionally independent of Grok/Codex ESM classification. |

## Checkpoint Plan

One focused commit after all four tasks pass. Rollback anchor is base SHA `35c9a07bfa0b4a8cc70bdd672e5690b241d751a5`. Post-land setup is transactional across the complete managed Grok surface: on any late wiring or verification failure it restores prior managed bytes, including installed hooks; `.grok/config.toml.svc-wire.rollback` is the rolling config recovery while the immutable baseline remains `.grok/config.toml.pre-migration.bak`.

## Lane Compliance

| Skill | Disposition | Evidence |
|---|---|---|
| `diagnose-bug` | completed | `docs/specs/bugfix/grok-shell-alias-brief.md`; task 1 completed |
| `define-code-style` | skipped by bugfix lane default | `skills-manifest.json` `laneDefinitions.bugfix.defaultSkips`; no style contract change |
| `design-tech` | completed due technical-risk signal | `docs/specs/tech/grok-shell-alias.md`; task 10 completed |
| `plan-changeset` | completed | this manifest and plan contract; task 2 completed |
| `review-plan` | in progress | `review-log.yaml`; task 3 |
| `execute-changeset`, `review-gate`, `review-exec`, `audit-implementation`, `land-changeset`, `verify-promotion` | pending in mandatory order | `.svc/lane-tasks-WI-GROK-SHELL-ALIAS-01.json` tasks 4–9 |

## Promotion Readiness Checklist

- [ ] All planned files accounted for and no HoursHub video files changed.
- [ ] R1–R6 mapped to passing proof.
- [ ] Existing Grok, Codex, and operation-scope regression validators pass.
- [ ] Plan contract validates.
- [ ] Grok setup, config parse, install drift, and installed hook replay pass.
- [ ] Review-plan, review-exec, and audit-implementation receipts are attached.

**Next:** `review-plan` for WI-GROK-SHELL-ALIAS-01.
