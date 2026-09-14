# WI-GROK-SHELL-ALIAS-01: Grok shell alias enforcement gap

## Reproduce

Trigger: From the Example Marketplace default checkout, Grok invokes `run_terminal_command` with the canonical `svc-ensure-worktree.mjs` bootstrap command.

Expected behavior: The command is classified as a shell operation, accepted by the zero-state bootstrap predicate, and creates/binds the requested WI worktree.

Actual behavior: `svc-codex-skill-load-enforcer.mjs` treats only `Bash` as shell-shaped, misses the bootstrap hatch, and denies with `governed mutation denied without an owned in_progress task (no active task)`.

Domain: code. This reproduces from the host payload/tool-name boundary and is independent of Example Marketplace data or video files.

## Root cause

Immediate cause: three bootstrap/loader predicates and several downstream guards compare the raw tool name directly with `Bash`.

Enabling condition: shell aliases are duplicated across modules; isolation already includes `run_terminal_command`, while the other consumers drifted.

Systemic cause: no shared shell-tool classifier or cross-host regression fixture proves equivalent behavior for every supported shell alias.

## Expected behavior

The owner requirement is authoritative because no product journey covers host hook internals: all of `Bash`, `Shell`, `run_shell_command`, `shell`, and `run_terminal_command` must receive existing Bash-shaped parsing and safety behavior. Grok non-loader shell commands must not require a Codex skill-load receipt after an owned active task is established. Isolation and WI binding remain mandatory.

## Smallest safe fix

- Add one shared `SHELL_TOOLS` set and `isShellTool(name)` helper.
- Replace direct Bash-only classifications in the named guards with the helper, including the already-patched isolation guard.
- In the skill-load enforcer, preserve bootstrap/loader validation for every shell alias; after `activeTask` succeeds, allow Grok/non-loader `run_terminal_command` without entering the Codex receipt validator.
- Extend Grok hook matchers for the bash guard and bash phase-receipt path.
- Add targeted Tier-1 fixtures for all aliases, Grok bootstrap, receipt bypass, and matcher wiring.

**Risk Flags:** external_state_writer, cross_runtime_integration

## Verification plan

1. Run syntax checks for every changed module.
2. Run focused shell-alias fixtures in the existing Codex execution-integrity validator.
3. Run the Grok TOML round-trip validator.
4. Run the Codex execution-integrity and operation-scope validators to prove Codex semantics remain unchanged.
5. Run `./setup --host grok`, parse the resulting TOML, and verify the installed hook copy.
6. From the Example Marketplace default checkout, feed a real Grok-shaped `run_terminal_command` payload for the exact WI bootstrap command to the installed enforcer and require allow output.
7. With an owned in-progress task, prove an ffmpeg-shaped Grok command passes the receipt gate but remains subject to isolation/WI ownership.

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | unaffected | Framework host parity is restored; no product capability changes. |
| 2 | Journey | affected | Grok bootstrap and post-bootstrap shell execution gain explicit regression coverage in this WI. |
| 3 | Acceptance criteria | affected | Owner-supplied requirements become focused Tier-1 assertions. |
| 4 | UX | unaffected | No user interface or prompt flow changes. |
| 5 | UI | unaffected | No visual assets, layout, or tokens change. |
| 6 | Tech architecture | affected | Shell-name classification is centralized across enforcement modules. |
| 7 | Cost model | unaffected | No external calls or recurring compute are added. |
| 8 | Operations & ownership | affected | Grok installation rewires two matchers and is validated after setup. |

## Pillars Coverage Matrix

| Pillar | Status | Evidence |
|---|---|---|
| Product fit | UNCHANGED — VERIFIED | Owner scope is host enforcement only. |
| Journey | UPDATED | Focused Grok bootstrap/ffmpeg fixtures. |
| Acceptance criteria | UPDATED | Requirements 1–6 map to validator assertions. |
| UX | UNCHANGED — VERIFIED | No UI surface. |
| UI | UNCHANGED — VERIFIED | No visual surface. |
| Tech architecture | UPDATED | Shared shell classifier. |
| Cost model | UNCHANGED — VERIFIED | Local constant-set lookup only. |
| Operations & ownership | UPDATED | Grok config/install validation. |

## Pattern Scan

Scope: direct comparisons and local sets involving `Bash`, `Shell`, `run_shell_command`, `shell`, and `run_terminal_command` under `hooks/` and Grok wiring under `scripts/`.

Findings: the requested consumers contain the same duplicated-classifier defect; `svc-worktree-isolation-guard.mjs` contains the complete local set and will be migrated to the shared helper to prevent a second source of truth.

Followups: none; the instances form one cross-cutting correction and are safe to land together.

## Register Discoveries

Single correction — no decomposition needed.

## Affected artifacts

- Hook runtime modules named in the owner request.
- Grok hook wiring and its TOML round-trip fixture.
- Focused shell-alias regression fixtures in the existing Codex execution-integrity and Grok TOML round-trip validators.
- No product spec, Example Marketplace journey, video asset, or video output file changes.

## Learnings

Host tool aliases are protocol values, not incidental strings. Any Bash-shaped predicate must consume the shared shell classifier, and every newly supported alias needs a bootstrap plus post-bootstrap regression fixture.

## Causal chain

```yaml
symptom: "Grok bootstrap is denied as no active task"
proximate_cause: "run_terminal_command fails Bash-only predicates"
root_cause: "shell aliases are duplicated inconsistently across guards"
systemic_cause: "no shared classifier and no cross-host alias parity test"
prevention: "centralize shell aliases and require bootstrap/receipt-path fixtures for every alias"
```

**Next:** `plan-changeset` for WI-GROK-SHELL-ALIAS-01.
