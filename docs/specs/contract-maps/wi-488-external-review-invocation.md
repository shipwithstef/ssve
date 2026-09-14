# System Contract Map: WI-488 external review invocation

## Flow Diagram

```text
[review consumer]
      |
      | package bytes on stdin + explicit orchestrator/review-kind
      v
[run-external-review.mjs]
      |-- resolve tuple + validate override
      |-- lock content-addressed key
      |-- validate reusable no-fallback receipt
      |
      +--> [Codex CLI process] -- JSONL events --> [events artifact]
      |          |              -- stderr -----> [diagnostic artifact]
      |          +-------------- final JSON ---> [findings validator]
      |
      +--> [Claude CLI process] -- JSON result -> [modelUsage + findings validator]
                 |              -- stderr -----> [diagnostic artifact]
                 +-- qualifying Fable failure -> [new Opus process]
      |
      v
[atomic receipt + findings cache]
      |
      v
[review consumer / mandatory-chain receipt]
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Review consumer | Launcher | stdin pipe | Canonical review package bytes | Consumer artifact/worktree | Launcher memory only | Input validation/hash policy stage | Empty stdin produces `input-invalid` before cache/provider use |
| Launcher | Codex CLI | spawned process argv + stdin | Exact tuple flags plus package bytes | Locked staging directory | Codex process memory | Codex provider | Missing capability, auth, model unavailable, network, timeout |
| Launcher | Claude CLI | spawned process argv + stdin | Exact tuple flags plus package bytes | Locked staging directory | Claude process memory | Claude provider | Missing capability, auth, model/entitlement, quota, overload, network, timeout |
| Codex CLI | Launcher | JSONL stdout + separate stderr + final-message file | Events, diagnostics, schema-constrained findings | Process streams/artifact file | Locked staging directory | Findings/receipt validator | Stream merge, malformed final JSON, tuple mismatch |
| Claude CLI | Launcher | JSON stdout + separate stderr | Result, structured output, modelUsage | Process streams | Locked staging directory | Findings/receipt validator or fallback classifier | Missing modelUsage, malformed structured output, ambiguous failure |
| Launcher | Opus fallback process | new spawned process after eligible Fable failure | Same package, explicit Opus xhigh tuple | Primary attempt receipt state | New process memory | Findings/receipt validator | Hidden fallback or non-eligible trigger |
| Launcher | Cache/consumer | atomic JSON files + launcher stdout summary | Findings and invocation receipt | Locked staging directory | `.svc/external-review-cache/v1/<key>/` | Review consumer/chain skill | Partial write, stale schema, fallback receipt reused as primary |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| Review package bytes | Review consumer | Consumer | Launcher and selected reviewer stdin | Invocation only unless consumer stores source | Credentials or unrelated context accidentally packaged |
| Process staging directory | Launcher | Launcher and CLI final-output flag | Launcher only | Invocation; promoted atomically on validation | Crash leaves unpromoted staging residue |
| Content-addressed cache | Bound worktree `.svc` | Launcher under per-key lock | Later launcher calls in same repository state | Until explicit cleanup | Invalid/fallback receipt treated as primary cache hit |
| Findings artifact | Content-addressed cache or requested artifact directory | Launcher after schema validation | Review consumer and auditors | Durable local evidence; committed adapter outputs when required | Schema/version drift |
| Invocation receipt | Content-addressed cache or requested artifact directory | Launcher after semantic validation | Review consumer, review-exec, audit, replay fixtures | Durable local evidence | Requested/actual/effective tuple mismatch or missing provenance |
| `CODEX_HOME` auth | Operator-owned Codex home | Codex auth flow | Codex CLI only | Operator credential lifetime | `--ignore-user-config` accidentally suppresses auth lookup |
| Claude OAuth/keychain | Operator-owned auth store | Claude auth flow | Claude CLI only | Operator credential lifetime | `--bare` disables OAuth/keychain access |

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Codex stdin is used when prompt is omitted or `-` is supplied | Installed Codex CLI 0.144.4 help | `codex exec --help` | verified |
| Codex supports read-only, ephemeral, ignore-user-config, ignore-rules, strict-config, output-schema, JSONL, and final-message separation | Installed Codex CLI 0.144.4 help | `codex exec --help` | verified |
| Codex `--ignore-user-config` preserves auth lookup in `CODEX_HOME` | Installed Codex CLI 0.144.4 help text | `codex exec --help` | verified |
| Claude safe mode preserves auth/model/tool/permission behavior while disabling customizations | Installed Claude Code 2.1.210 help | `claude --help` | verified |
| Claude bare mode disables OAuth and keychain reads | Installed Claude Code 2.1.210 help | `claude --help` | verified |
| Claude supports explicit effort, model, tools, strict MCP, plan permission, no persistence, schema, budget, and JSON output | Installed Claude Code 2.1.210 help | `claude --help` | verified |
| Claude JSON output exposes enough modelUsage metadata to verify the effective model | Fixture plus first real WI-486 review receipt | targeted launcher replay and promoted review | planned |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Codex isolation preserves auth | Fake CLI sees preserved `CODEX_HOME` and all isolation flags | Fixture unsets/rewrites `CODEX_HOME` or omits a flag | planned | `test-framework/evals/tier-1/validate-external-review-launcher.sh` |
| Claude safe mode preserves OAuth-compatible path | Fake CLI sees safe mode and no bare flag | Fixture sees `--bare` or inherited MCP/tools | planned | same targeted fixture |
| Only three Fable failure classes can fall back | Each eligible fixture records exactly two attempts | Auth/quota/network/timeout/schema fixture launches Opus | planned | same targeted fixture |
| Cache cannot launder fallback evidence | Exact primary receipt hits; fallback receipt misses | Fallback receipt returns as primary cache hit | planned | same targeted fixture |
| Requested tuple equals invocation tuple | Captured argv matches policy and receipt | Captured argv or runtime effective model differs | planned | same targeted fixture |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| Plan review package | Consumer builds `gpt-5.5` argv prompt and merges streams | Launcher consumes stdin, enforces Codex 5.6 sol/high, schemas, streams, and receipt | Migration closes tuple and evidence drift | diagnosis plus targeted fixture |
| Floor-judge package | Resolver probe then direct consumer-local Codex/agy command | Adapter submits package to launcher and reads shared findings | Direct paid-review execution is eliminated | source inventory validator |
| Codex-orchestrated package with Fable auth failure | Unspecified fallback behavior | Classified hard failure, one attempt, no Opus | Fallback boundary is fail-closed | targeted failure fixture |
| Identical package after an Opus fallback | Prior output could be reused without tuple provenance | Fallback receipt misses primary cache and Fable is retried | Recovered primary availability receives a fresh review | cache replay fixture |

## Iteration Escalation

A third `diagnose-bug` invocation for WI-488 within 14 days halts component-level changes. The diagnosis and this contract map must be sent through `review-cross-model` before `execute-changeset` resumes.
