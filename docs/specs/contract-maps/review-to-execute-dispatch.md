# System Contract Map — review to execute dispatch

## Flow Diagram

```text
Consumer worktree manifest/branch
              |
              v
framework review adapter ---> protected owner policy ---> external reviewer CLI
              |                         |
              v                         v
consumer review-log <--------- signed/validated review receipt
              |
              v
framework execute preflight --> owner-policy EXEC resolver
              |                         |
              +------------+------------+
                           v
                    Grok Build CLI
                           |
                           v
                consumer dispatch JSONL
                           |
                           v
                 framework commit guard
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Consumer manifest/branch | review adapter | file + Git metadata | exact WI, plan SHA | Git worktree | process memory | external launcher | missing/ambiguous/mismatch denies before provider |
| Owner policy | resolver | protected JSON file | mode, station/EXEC tuples, digest | `~/.svc` owner file | process memory | adapter/launcher | insecure/missing/invalid policy denies |
| Review launcher | consumer plan | provider result + receipt | findings, terminal decision evidence | artifact directory | review log | execute preflight | malformed/unapproved result cannot authorize |
| Execute preflight | Grok worker | compact JSON + argv | WI, host/family/model/effort, policy SHA | stdout/process memory | child argv/process | dispatch logger | tuple mismatch/missing CLI denies |
| Grok worker | dispatch logger | exit + resolved context | schema-v2 JSONL row | process memory | `.svc/dispatch-log.jsonl` | commit guard | failed/partial/stale row denies |
| Dispatch log + policy | commit guard | local file reads + fresh resolution | exact tuple comparison | consumer worktree + owner file | process memory | Git hook | wrong WI/tuple/policy/exit denies commit |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| Owner dispatch policy | user home / repository owner | owner only | framework resolver | until owner changes it | insecure permissions or schema invalidation denies |
| Plan manifest/review log | consumer Git worktree | planning/review pipeline | adapters, humans, guard | Git history | stale/unrelated first-match could misauthorize; exact binding prevents it |
| External-review artifacts | framework/consumer `.svc` | launcher | review pipeline | audit retention | missing/malformed receipt blocks promotion |
| Dispatch JSONL | consumer `.svc` | dispatch logger | guard/audit tools | audit retention | incomplete legacy row cannot authorize exact policy tuple |
| Child process memory | OS process | preflight/worker | invoked CLI | process lifetime | quoting/remap error; argv arrays and exact compare prevent it |

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Owner policy default selects `mixed-grok-cursor` | protected policy + resolver output | `resolve-dispatch.mjs model --label EXEC --format json` | verified pre-change |
| EXEC resolves Grok 4.6 High | resolver output | same command, assert host/model/effort | verified pre-change |
| Installed Grok supports bounded flags | installed CLI 1.0.5 help in research log | `grok --help` flag assertions | verified pre-change |
| Installed Cursor Agent supports bounded read-only review flags | installed CLI 2026.08.11 help/status in research log | `cursor-agent --help` asserts print, JSON output, plan mode, sandbox, workspace, and model; status proves current authenticated account | verified pre-change |
| Multiple plan stations have a deterministic eligible external | resolver source/fixture | `resolve-dispatch.mjs external --phase plan` | verified pre-change |
| Named WI can be an exact consumer identity | consumer branch/manifest | post-install original replay | planned |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Adapter honors owner default | no explicit mode resolves configured mode | inject unknown explicit mode and require nonzero/zero provider calls | planned | WI-559 Tier-1 fixture |
| Exact WI selects exact review | requested WI log is authorized | add older unrelated promoted log first and ensure it is ignored | planned | WI-559 Tier-1 fixture |
| Dispatch evidence proves current tuple | exact fresh Grok row allows | wrong model/effort/policy SHA, stale timestamp, or exit 1 denies | planned | WI-559 Tier-1 fixture |
| Grok transport is safe | argv includes auto/no-subagents/no-web | fake CLI records bypass flag or absent containment flag and fixture fails | planned | WI-559 Tier-1 fixture |
| Cursor review transport preserves authority | findings host/family and exact receipt tuple validate | invalid Cursor family, findings mismatch, or attestation `none` denies authorization | planned | WI-559 external-review fixture |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| HoursHub named-WI plan, no mode override | `production` policy error | owner default selected and review starts | adapter no longer overrides policy | post-install replay |
| Multi-station plan topology | exact-one error | canonical resolver selects eligible station | adapter no longer duplicates selection | focused fixture + replay |
| `WI-SCOUT-CAPTURE-DURABILITY-01` | numeric parser exit 4 | exact structured/branch binding | named consumer WI supported safely | focused fixture + replay |
| Authorized plan with Grok EXEC | legacy `DISPATCH=sonnet` | exact Grok 4.6 High JSON tuple | preflight follows owner policy | focused fixture + replay |
| Successful exact Grok dispatch | legacy allowlist blocks | current tuple receipt allows | guard verifies authority, not model brand | focused fixture |
| Owner-selected Cursor plan station | requested tuple rejected by legacy schema before provider invocation | one bounded Cursor call, schema-valid findings, exact receipt, requested-accepted or stronger attestation | launcher supports the owner policy without remapping it | focused fixture + post-install replay |

## Iteration Escalation

This is the first diagnose-bug invocation for WI-559. A third invocation within
14 days must halt implementation and require `review-cross-model` over this map
and diagnosis before resuming.
