# WI-GROK-SHELL-ALIAS-01 Technical Design

**Status:** BASELINED

## Technical Design

### Architecture

Use a dependency-free shared classifier at `hooks/lib/shell-tools.mjs`. Consumers keep raw host tool names for diagnostics but call `isShellTool(name)` wherever existing behavior is explicitly Bash-shaped. The Codex-derived skill-load enforcer retains the same order of authority checks and adds a narrow Grok exit only after `activeTask()` has proven an owned in-progress task.

```text
Grok run_terminal_command payload
             |
             v
    shared shell classifier
             |
     +-------+------------------+
     |                          |
     v                          v
isolation + operation scope   bootstrap/loader shape
     |                          |
     +-----------+--------------+
                 v
        owned active task?
          | no       | yes
          v          v
         DENY   loader command?
                    | yes        | no + Grok
                    v            v
             Codex receipt     ALLOW
             validation
```

### Components

| Component | Responsibility | Change |
|---|---|---|
| `hooks/lib/shell-tools.mjs` | Canonical supported shell alias set and predicate | New |
| Hook consumers | Apply existing Bash parsing/mutation/read-only semantics to every alias | Modify |
| Skill-load enforcer | Preserve bootstrap and owned-task gates; skip only the Codex receipt for Grok non-loader shell work | Modify |
| Grok wirer | Match `run_terminal_command` for bash guard and bash phase receipt | Modify |
| Tier-1 fixtures | Prove alias parity, receipt boundary, and TOML wiring | New/modify |

### Alternatives

| Option | Decision | Rationale |
|---|---|---|
| Repeat `|| name === ...` in every hook | Reject | Continues the drift mechanism that caused the bug. |
| Normalize the raw payload tool name globally | Reject | Could change host-facing diagnostics and non-Bash policy dispatch. |
| Shared predicate used only at Bash-shaped decisions | Choose | Centralizes protocol membership without changing raw evidence. |
| Remove the skill-load enforcer from Grok | Reject | Would also remove bootstrap/owned-task protection. |

### Security and authority invariants

- `run_terminal_command` receives the same lexer, workdir, target, and read-only classification as `Bash`.
- Zero-state authorization remains limited to exact canonical bootstrap syntax.
- Skill-loader commands never take the Grok receipt-bypass exit.
- The Grok non-loader exit is unreachable until `activeTask()` proves one owned in-progress task.
- Isolation, operation-scope contradictions, and WI/controller ownership execute before the receipt decision.
- Codex `Bash` behavior remains byte-for-byte equivalent except for importing the shared classifier.

### Feasibility matrix

| Requirement | Feasible? | Design evidence |
|---|---|---|
| Five shell aliases share Bash-shaped predicates | yes | One constant set + predicate imported by each named consumer. |
| Grok bootstrap is allowed | yes | `isBootstrapShape` accepts shared shell aliases. |
| Grok ffmpeg needs no Codex receipt | yes | Post-ownership, non-loader Grok exit. |
| Isolation and WI binding remain | yes | Exit placement is after operation scope and active task resolution. |
| Grok config matchers include alias | yes | Wirer source plus round-trip/config assertions. |
| HoursHub video files remain untouched | yes | All planned files are in SSVE plus machine-local Grok installation. |

### Cost Model

| Dimension | Cost |
|---|---|
| Compute | One constant-set membership lookup per relevant hook; effectively zero. |
| Storage | One small source module and focused fixture; no runtime state growth. |
| Bandwidth | None. |
| External APIs | None. |
| Background jobs | None. |

Scaling trigger: none; work remains O(1) per hook call. First month/year-1 incremental infrastructure cost: $0.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| Owner | SSVE framework maintainer |
| On-call / SLA | Best effort; no paging or formal SLA |
| Monitoring | Tier-1 hook fixtures and install-drift checks |
| Alerting / dashboard | None |
| Runbook | Re-run `./setup --host grok`, validate TOML, then replay the hook payload |
| Failure modes | Alias omitted; bypass placed before authority; matcher drift; stale installed copy |
| Recovery | Revert branch or reinstall the prior canonical main source |
| Backup / restore | Grok wirer preserves its immutable pre-migration backup and transactional rollback |
| Dependency impact | Node or Git unavailable prevents hook execution; no new dependency is introduced |

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Receipt bypass accidentally applies to loader commands | Unvalidated skill activation | Explicit loader-command detector plus negative fixture. |
| Bypass occurs before ownership | Ungoverned mutation | Place exit after `active.ok` only and test zero-state denial for non-bootstrap commands. |
| Shared import breaks installed relative paths | Hooks fail at runtime | Module resides under installed `hooks/lib/`; run installed-copy syntax and live payload proof. |
| TOML rewrite loses user config | Machine-local regression | Existing lossless round-trip fixture, backup, parse, and live setup validation. |

### Review

[Layer 1] [Confidence: 10/10] A shared constant-set predicate is the existing local pattern already used inside isolation; extracting it removes drift without introducing a dependency.

[Layer 3] [Confidence: 9/10] The safest Grok receipt exception is not host-wide removal: it is a post-ownership, non-loader decision that preserves every earlier enforcement boundary.

No hard-to-reverse architecture, new persistence model, or new external dependency is introduced; `explore-solutions` is not required.

**Next:** `plan-changeset` for WI-GROK-SHELL-ALIAS-01.
