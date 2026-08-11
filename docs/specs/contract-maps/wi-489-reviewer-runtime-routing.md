# System Contract Map: WI-489 reviewer runtime routing

## Flow Diagram

```text
[registry policy] + [UTC clock] + [secure local selection]
                         |
                         v
[consumer stdin] -> [canonical launcher] -> [one exact primary CLI process]
                         |                         |
                         |                 [<=4 protocol turns]
                         |                         |
                         +<-- structured result ---+
                         |
                         +-> [route attestor] -> [findings normalizer]
                         |                         |
                         +-> [receipt-v2 validator]+-> [consumer]
                         |
                         +-> [exact-primary cache only]
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Model registry | Policy resolver | tracked JSON read | versioned profiles, UTC schedule, fallback classes | `references/model-registry.json` | launcher memory | status/cache/invocation stages | invalid policy stops before provider activity |
| Local owner selection | Policy resolver | secure regular-file read | schema, profile, reason, authority, timestamps | `.svc/external-review-policy/v1/selection.json` | launcher memory | resolution receipt | symlink, owner/mode, schema, profile, or expiry failure |
| Review consumer | Launcher | stdin + explicit flags | canonical package, orchestrator, review kind | consumer artifact | launcher memory | content hash and policy resolver | empty input or invalid operation |
| Launcher | Claude CLI | exact argv, scrubbed env, stdin | Fable/high or Opus/high package; safe settings; four-turn ceiling | invocation receipt state | one Claude process | Anthropic runtime | capability, schema turn, auth, quota, network, timeout |
| Claude CLI | Route attestor | separated JSON stdout/stderr | structured output, modelUsage, turns, stop/terminal fields | process artifacts | launcher memory | normalizer/receipt validator | malformed output, unexplained model, missing findings |
| Route attestor | Findings normalizer | in-process object | exact-primary or provider-route authority | launcher memory | normalized findings | receipt validator/consumer | model-authored tuple contradicts runtime authority |
| Receipt validator | Cache/consumer | atomic JSON | receipt v2 plus schema-valid findings | staging/artifact directory | exact-primary cache or consumer artifact | later launcher/gates | contradictory route/tuple or non-reusable evidence published |
| Launcher status | Shell resolver/operator | JSON stdout | selected profile, source, version, window, cutover | launcher memory | stdout only | review skills/operators | compatibility view diverges from launcher |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| Reviewer policy | Repository owner | reviewed source change | launcher, resolver, auditors | versioned repository history | duplicate runtime policy drifts |
| Explicit selection | Current local repository owner | canonical launcher selection operation | canonical launcher/status | until expiry or explicit clear | foreign, insecure, stale, or forgotten local state |
| Review package | Review consumer | consumer | selected reviewer via stdin | invocation unless consumer stores source | unrelated sensitive context included |
| Process artifacts | Launcher/CLI | launcher and CLI | operator/auditor | durable requested artifact directory | streams merged or structured errors lost |
| Receipt v2 | Launcher | canonical launcher after semantic validation | consumers, cache validator, gates | durable evidence | route or effort authority misrepresented |
| Reusable cache | Bound worktree `.svc` | launcher for exact-primary only | later launcher requests | TTL/GC bounded | provider route or fallback launders primary evidence |
| OAuth/keychain | Operator | provider auth tooling | Claude CLI only | credential lifetime | isolation accidentally removes authentication |

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Claude CLI supports four-turn structured safe invocation flags | Installed Claude Code 2.1.211 | configured argv parser probe; `--max-turns` is officially documented but omitted from local `--help` | verified |
| `--max-turns` bounds agentic turns inside one CLI invocation | Official Claude Code headless documentation | two-turn and max-turn replay | verified |
| Fable safeguard switching can rerun on Opus 4.8 and is configurable | Official Anthropic support article plus installed binary setting | settings/env fixture and one real review | verified with bounded runtime proof pending |
| Normal CLI JSON reports model usage but not proven private refusal headers | Installed CLI output and diagnosis review | result-shape capture | verified |
| Claude safe mode can preserve OAuth/keychain-compatible authentication while disabling customizations | WI-488 capability proof | fake env/argv capture and real review | verified |
| Codex review path remains read-only Codex 5.6 sol/high | WI-488 promoted contract | unchanged Codex fixture | verified |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Four protocol turns remain one primary invocation | Fake Claude returns turn two and call ledger has one process | call ledger has more than one primary spawn | passed | targeted launcher replay, 129/0 |
| Provider safety route is not launcher fallback | Same process reports Opus under controlled Fable envelope and fallback used=false | a second Opus process starts or fallback used=true | passed | route/call-count fixture |
| Opus observation alone is insufficient | Fixture suppresses the controlled setting envelope and yields model mismatch | bare modelUsage is accepted | passed | fixture-only missing-envelope negative replay |
| July 20 resolution is deterministic | frozen instants before/at/after select expected profiles | locale clock or host timezone changes result | passed | clock fixture |
| Explicit selection is secure and zero-cost | valid 0600 owner file resolves; foreign/insecure file stops with zero calls | invalid state reaches cache or provider | passed | selection matrix |
| Cache cannot launder provider routing | exact-primary hits; provider-route receipt misses | routed Opus satisfies later Fable request | passed | forged/cache replay |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| WI-486 plan package with valid two-turn schema handshake | `error_max_turns`, then `unknown_provider` | schema-valid findings within one four-turn process | Protocol turns are no longer confused with paid invocations | preserved WI-486 failures plus replay |
| Fable package blocked by safeguards then completed on Opus | effective tuple mismatch or ambiguous failure | provider-safety-route receipt, no second Opus, non-reusable cache | Automatic provider route is truthful and bounded | route fixture plus real review when encountered |
| Codex-orchestrated review after cutover | hardcoded Fable/high | scheduled Opus 4.8/high primary | Owner policy changes without consumer edits | at-boundary clock fixture |
| Owner wants Fable again | tracked patch or cumbersome one-shot override | secure `--select-profile fable-high --reason ...` then status | Operational switch is easy and auditable | selection/status fixture |
| Resolver asks for reviewer policy | independent shell constants | delegates to canonical launcher status | Policy cannot drift between views | parity validator |

## Iteration Escalation

A third `diagnose-bug` invocation for this reviewer-runtime component within 14 days halts component-level execution. The current evidence, receipt state machine, and this map must pass `review-cross-model` before `execute-changeset` resumes.
