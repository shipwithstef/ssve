# System Contract Map: Grok Shell Alias Enforcement

**WI:** WI-GROK-SHELL-ALIAS-01

**Status:** EXECUTED

**Scope:** Grok native shell tool envelope → shared shell classification → bootstrap/ownership checks → Codex-only receipt boundary. Example Marketplace media files are never an input or output of this flow.

## Flow Diagram

```text
[Grok run_terminal_command envelope]
              |
              v
[Grok PreToolUse hook chain]
              |
              +--> [worktree isolation + operation scope]
              |
              v
[Codex skill-load enforcer reused by Grok]
       | zero-state bootstrap       | owned non-loader
       v                            v
[exact bootstrap hatch]       [skip Codex receipt only]
       |                            |
       +------------+---------------+
                    v
             [Grok command runner]
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Grok tool runner | PreToolUse chain | stdin JSON | session/turn/cwd/tool name/tool input | Grok session | Hook process memory | Worktree isolation | Native alias is not recognized as Bash-shaped |
| Worktree isolation | Skill-load enforcer | sequential hook decision | canonical operation scope and original payload | Process memory | Enforcer memory | Bootstrap/active-task resolver | Default-checkout mutation or foreign WI escapes containment |
| Skill-load enforcer | Grok runner | JSON hook decision | allow `{}` or structured deny | Process stdout | Grok hook runtime | Native tool executor | Grok is incorrectly required to produce a Codex receipt |
| Grok wirer | Grok config | transactional TOML rewrite | matcher plus command and timeout | Landed framework source | `~/.grok/config.toml` | Grok hook dispatcher | Native alias misses bash guard or phase receipt matcher |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Failure Mode |
|---|---|---|---|---|
| Hook payload | Grok runtime | Grok tool dispatcher | SVC PreToolUse hooks | Tool name differs from the Bash-only predicate |
| Shared alias module | Landed SSVE repository | This WI | Installed hook modules | Local alias sets drift independently |
| Task graph / ownership state | Governed product worktree | SVC task/authority tools | Isolation and skill-load enforcer | No active owned task denies ordinary mutation |
| Grok hook installation | Current user | Post-land `./setup --host grok` | Grok runtime | Installed module or matcher remains stale |
| Example Marketplace checkout | Example Marketplace repository owner | Existing user work only; this WI writes nothing | Live hook replay | A proof command mutates product/video state |

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Grok names its native shell tool `run_terminal_command` | Owner live reproduction | Exact PreToolUse payload replay | verified-runtime |
| Grok matcher rows accept pipe-separated tool names | Existing Grok config and wirer contract | TOML round-trip validator | verified-runtime |
| The Codex receipt protocol is not a Grok execution prerequisite | Owner host contract | Owned ffmpeg receipt-bypass fixture | verified-design |
| Worktree isolation and WI ownership remain prerequisites | SSVE authority contract | Separate isolation denial fixture | verified-test |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Grok native alias reaches the bootstrap hatch | Exact `run_terminal_command` bootstrap envelope returns allow | Same zero-state envelope with `touch must-not-run` returns owned-task deny | hypothesis-holds | `docs/specs/test-evidence/WI-GROK-SHELL-ALIAS-01/cross-system-probe.json` |
| Receipt bypass does not remove isolation | Owned Grok ffmpeg passes the receipt boundary | Isolation classifier still denies the unbound/default-checkout command | hypothesis-holds | `validate-codex-execution-integrity.sh` focused fixtures |
| Loader commands never take the bypass | Non-loader ffmpeg is allowed after ownership | Exact and compound commands mentioning `codex-load-skill.mjs` deny | hypothesis-holds | `validate-codex-execution-integrity.sh` focused fixtures |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| Zero-state Grok envelope carrying the canonical installed `svc-ensure-worktree.mjs` command | Installed pre-change enforcer denies `no active task` | Patched enforcer fixture returns `{}` through the exact bootstrap predicate | Shared shell classification restores the bootstrap hatch | Cross-system probe plus 188-pass execution-integrity run |
| Owned Grok ffmpeg envelope without a Codex receipt | Pre-change enforcer denies missing receipt | Patched enforcer returns `{}` after operation scope and active-task checks | Only the host-inapplicable receipt requirement is removed | Focused positive and isolation-negative fixtures |

## Iteration Escalation

A third diagnosis of this Grok shell-alias/receipt boundary within 14 days must halt implementation and invoke `review-cross-model` on this map and the live payload evidence before work resumes.
