# WI-559 Implementation Manifest — review and execution dispatch adapter convergence

## Header

| Field | Value |
|---|---|
| Spec | `docs/specs/work-items/WI-559.md` (AC-559-1..8) |
| Technical design | `docs/specs/tech/WI-559.md` (BASELINED, G4 PASS) |
| Work item | `WI-559` |
| Branch | `bugfix-WI-559-review-dispatch-adapter` |
| Lane | bugfix / framework |
| Status | LOCAL CANDIDATE (review state is authoritative in the adjacent review log; not landed, installed, or consumer-replayed) |
| Base branch / SHA | `origin/main` / `fbafdf6ce084edf6b07b4d1cfcdf7bbc852b2644` |
| Created | `2026-08-22T23:20:31Z` |
| Execution mode | `dispatch` — owner-selected Grok Build CLI 4.6 High receives this complete contract in a zero-history process |
| Risk Flags | `cross_runtime_integration` |
| Contract map | `docs/specs/contract-maps/review-to-execute-dispatch.md` |

### Upstream lane compliance

| Required upstream boundary | Status | Evidence |
|---|---|---|
| Bugfix definition / write-spec-equivalent | completed | `docs/specs/bugfix/wi-559-review-dispatch-adapter-brief.md`; `docs/specs/work-items/WI-559.md`; task 1 `diagnose-bug` receipt in `.svc/lane-tasks-WI-559.json` |
| G1-G3 behavior, contract, and risk inputs | completed | `docs/specs/work-items/WI-559.md`; `docs/specs/contract-maps/review-to-execute-dispatch.md`; `docs/specs/test-evidence/WI-559/design-capability-probes.json` |
| G4 technical design | completed | `docs/specs/tech/WI-559.md`; `docs/specs/decisions/WI-559.md`; `.svc/wi559-g4-decision.log`; task 2 `design-tech` receipt |
| Changeset planning | completed | this manifest; adjacent `plan-contract.json`; `.svc/plan-changeset-review.log`; task 3 `plan-changeset` receipt |
| Plan review | active | adjacent `review-log.yaml`; canonical retro-plan review remains fail-closed until every accepted finding is remediated and rechecked |

No mandatory upstream boundary is silently skipped. The bugfix brief is the
lane's behavior-spec artifact; there is no separate feature `write-spec` output
to impersonate. The durable task graph and named evidence files, rather than an
uncited prose assertion, are the authority for completed boundaries.

### Architectural invariants

1. `scripts/resolve-dispatch.mjs` and protected owner policy remain the sole
   authority for mode, reviewer station, and EXEC host/family/model/effort. The
   policy is opened once with `O_NOFOLLOW`, owner/mode checked from that file
   descriptor, and the same bytes/hash snapshot drives format and tuple selection.
2. Explicit owner mode/station overrides remain explicit; adapters never invent
   defaults or filter policy topology by their own cardinality rule.
3. Named and numeric WIs use `hooks/lib/wi-id.mjs` canonical grammar. Missing,
   ambiguous, and branch/manifest-mismatched identities deny before provider use.
4. Only an exact active review log for the requested WI in `PROMOTED`,
   `PROMOTED_WITH_DISPUTES`, or `REVISED_AND_REVIEWED` authorizes execution.
5. Dispatch evidence is append-only and durably binds WI, exact manifest path
   and hash, policy hash, review-log hash, mode, phase, station, orchestrator,
   exact tuple, skill, decision, duration, timestamp, and exit code.
6. Every active same-WI manifest participates in exact-one selection before a
   review log can authorize execution; review authority is one YAML document.
7. Review packages bind the exact one-read plan bytes, and cache identity binds
   policy/mode/phase/station/workspace provenance. Cursor workspace reviews are
   intentionally never cache-replayed.
8. Mutating Grok child execution retains delegation, containment, one-time token,
   task lifecycle, and completion receipt checks already enforced by
   `dispatch-worker.sh`.
9. Grok runs with `--permission-mode auto`, `--no-subagents`,
   `--disable-web-search`, and a private fsynced `--prompt-file`; it never uses
   a permission bypass or a payload-sized argv argument.
10. Existing external-review receipt, phase guard, owner-policy security,
   fallback, numeric WI, and delegated execution fixtures remain green.
11. Implemented/local, landed, installed, and original HoursHub replay proof are
   reported as distinct states.

## Implementation Summary

Convert the remaining WI-551 compatibility surfaces from independent policy
engines into strict adapters. One new executable Node helper owns canonical WI
binding, exact active-plan/review binding, owner-policy EXEC resolution, compact
preflight JSON, and receipt verification. Shell launchers call that helper and
transport the returned tuple without remapping. Grok becomes a supported
delegated worker harness with the installed bounded CLI flags. The commit guard
re-resolves current authority and compares exact successful evidence rather than
brand substrings.

No owner policy schema, delegation schema, provider fallback policy,
application data, UI, database, package dependency, or deployment target
changes. The external-review findings/receipt schemas and launcher transport
expand only enough to represent and invoke the existing owner-policy `cursor`
stations; their authority and model choices do not change.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh | CREATE | T1 | Hermetic original-failure and negative authorization matrix |
| `test-framework/evals/tier-1/validate-external-review-launcher.sh` | MODIFY | T1 | Named-WI, owner-default, multi-station, explicit override, zero-provider-call adapter coverage |
| `test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs` | MODIFY | T1 | Replace brittle old adapter-source assertions with resolver-delegation invariants |
| `schemas/external-review-receipt.schema.json` | MODIFY | T2 | Admit the existing owner-policy Cursor host in exact receipt tuples |
| `schemas/external-review-findings.schema.json` | MODIFY | T2 | Admit exact Cursor and direct Grok/xAI reviewer tuples while retaining family validation |
| `scripts/run-external-review.mjs` | MODIFY | T2 | Preserve canonical schema/receipt authority while transporting selected Cursor stations read-only |
| `scripts/resolve-adversarial-reviewer.sh` | MODIFY | T2 | Route schema-1 owner dispatch policy status through the canonical review launcher instead of the legacy scheduled-policy resolver |
| `scripts/lib/protected-file.mjs` | CREATE | T2 | Pin authority-file parents and leaf reads through owner-checked directory/file descriptors |
| `scripts/lib/reviewer-evidence.mjs` | MODIFY | T2 | Bind v3 chain receipts to the Git tree while independently requiring canonical plan-launcher receipts to bind the phase-guarded manifest digest |
| `scripts/resolve-dispatch.mjs` | MODIFY | T2 | Read owner policy once through an owner-checked O_NOFOLLOW descriptor and reuse that exact snapshot for selection |
| scripts/resolve-execute-dispatch.mjs | CREATE | T2 | Shared bind-plan, preflight, and verify-receipt authority helper |
| `scripts/review-topology-v2.mjs` | MODIFY | T2 | Reuse the single protected owner-policy snapshot across topology and station resolution |
| `scripts/review-plan-codex.sh` | MODIFY | T2 | Canonical named/numeric WI binding and resolver-owned default/station selection |
| `test-framework/evals/tier-1/validate-reviewer-run-evidence.sh` | MODIFY | T2 | Prove plan manifest and execution tree identities are independently bound and mismatch-fail closed |
| `scripts/execute-dispatch-preflight.sh` | MODIFY | T3 | Exact reviewed-WI authorization plus compact current EXEC tuple output |
| `scripts/dispatch-worker.sh` | MODIFY | T3 | Safe delegated Grok CLI transport without weakening containment |
| `scripts/dispatch-log.sh` | MODIFY | T3 | Schema-2 exact tuple/review/policy dispatch evidence |
| `scripts/state-io.mjs` | MODIFY | T3 | Fsync append-only dispatch authority before success |
| `scripts/auto-receipt.mjs` | MODIFY | T3 | Route adjacent impact receipts through the atomic state primitive required by the newly selected state-I/O validator |
| `hooks/svc-execute-dispatch-guard.sh` | MODIFY | T3 | Current-policy exact-WI receipt enforcement |
| `skills/execute-changeset/references/dispatch-preflight.md` | MODIFY | T3 | Current JSON preflight and owner-policy dispatch instructions |
| `skills/execute-changeset/references/subagent-dispatch.md` | MODIFY | T3 | Grok delegated-worker invocation and required lifecycle fields |
| `scripts/select-tier1-validators-v2.mjs` | MODIFY | T4 | Map all repaired adapter inputs to focused validators |
| `test-framework/evals/tier-1/validate-tier1-selector-v2.mjs` | MODIFY | T4 | Assert exact focused WI-559 validation closure |
| `test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh` | MODIFY | T4 | Keep the established worker-artifact fixture read-only without invoking the forbidden mutation downgrade |
| `FRAMEWORK-STATE.md` | MODIFY | T5 | Record local, promoted, installed, and replay states honestly |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | T5 | Record converged owner-policy adapter capability and limits |
| `docs/specs/work-items/WI-559.md` | MODIFY | T5 | AC evidence/lifecycle closeout |
| `docs/specs/work-items/INDEX.md` | MODIFY | T5 | WI status transition |
| `proposals/2026-08-23-framework-improvement-review-dispatch-adapter-convergence.md` | MOVE after replay | T5/verify-promotion | Preserve pending proposal until installed consumer replay, then move byte-identically to `proposals/done/` |
| `.svc/lane-tasks-WI-559.json` | MODIFY | all | Durable task, skill, review, and evidence state |
| `.svc/authorization-events.jsonl` | PRESERVE | T5 | Append-only local authorization audit generated by governed hooks |
| `.svc/learning-fires.jsonl`;`.svc/learning-lifecycle.jsonl` | PRESERVE | T5 | Protected local learning audit residue; not silently deleted |
| `.svc/dispatch/WI-559.edits.json`;`.svc/dispatch/WI-559.log`;`.svc/dispatch/WI-559.result.json`;`.svc/dispatch/wave-progress.jsonl` | PRESERVE | T5 | Protected local failed-fixture dispatch evidence; not promotion evidence |
| `.svc/review-cross-model-package-r6.md` | PRESERVE | T5 | Frozen failed-review request retained as local evidence; excluded from the committed candidate |
| `docs/plans/2026-08-23-wi559-review-dispatch-adapter/manifest.md` | CREATE | planning | This execution contract |
| `docs/plans/2026-08-23-wi559-review-dispatch-adapter/plan-contract.json` | CREATE | planning | Ownership, executable-consumer, resource, and risk contract |
| `docs/plans/2026-08-23-wi559-review-dispatch-adapter/review-log.yaml` | CREATE | review-plan | Canonical plan-review history and terminal decision |
| `docs/plans/2026-08-23-wi559-review-dispatch-adapter/grok-build-prompt.md` | CREATE | planning | Zero-history Grok Build execution package |
| docs/specs/reviews/wi-559-cross-system-review.md | CREATE | review-cross-model | Required diagnosis and contract-map challenge before execution |
| docs/specs/reviews/wi-559-exec-review.md | CREATE | review-exec | Independent final-diff review |

### Planning-state ownership census

This adjacent plan contract is validated before runtime mutation. T5 must expand
this census and `plan-contract.json` to the complete executed diff before G5.

| Task | Title | Files | State |
|---|---|---|---|
| T0 | Planning and G4 artifacts | .svc/skill-outcome-design-tech-WI-559.json;docs/plans/2026-08-23-wi559-review-dispatch-adapter/grok-build-prompt.md;docs/plans/2026-08-23-wi559-review-dispatch-adapter/manifest.md;docs/plans/2026-08-23-wi559-review-dispatch-adapter/plan-contract.json;docs/plans/2026-08-23-wi559-review-dispatch-adapter/review-log.yaml;docs/specs/bugfix/wi-559-review-dispatch-adapter-brief.md;docs/specs/contract-maps/review-to-execute-dispatch.md;docs/specs/decisions/WI-559.md;docs/specs/tech/WI-559.md;docs/specs/test-evidence/WI-559/design-capability-probes.json | changed |
| T1 | Fail-first contract evidence | docs/specs/test-evidence/WI-559/t1-red-bind-review-cursor-helper.log;test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh | changed |
| T2 | Review adapter convergence | schemas/external-review-findings.schema.json;schemas/external-review-receipt.schema.json;scripts/lib/protected-file.mjs;scripts/lib/reviewer-evidence.mjs;scripts/resolve-adversarial-reviewer.sh;scripts/resolve-dispatch.mjs;scripts/resolve-execute-dispatch.mjs;scripts/review-plan-codex.sh;scripts/review-topology-v2.mjs;scripts/run-external-review.mjs;test-framework/evals/tier-1/validate-external-review-launcher.sh;test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs;test-framework/evals/tier-1/validate-reviewer-run-evidence.sh | changed |
| T3 | Exact execution adapter convergence | hooks/svc-execute-dispatch-guard.sh;scripts/auto-receipt.mjs;scripts/dispatch-log.sh;scripts/dispatch-worker.sh;scripts/execute-dispatch-preflight.sh;scripts/state-io.mjs;skills/execute-changeset/references/dispatch-preflight.md;skills/execute-changeset/references/subagent-dispatch.md | changed |
| T4 | Focused validator closure | scripts/select-tier1-validators-v2.mjs;test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh;test-framework/evals/tier-1/validate-tier1-selector-v2.mjs | changed |
| T5 | WI, knowledge, and preserved local audit state | .svc/authorization-events.jsonl;.svc/dispatch/WI-559.edits.json;.svc/dispatch/WI-559.log;.svc/dispatch/WI-559.result.json;.svc/dispatch/wave-progress.jsonl;.svc/lane-tasks-WI-559.json;.svc/learning-fires.jsonl;.svc/learning-lifecycle.jsonl;.svc/review-cross-model-package-r6.md;FRAMEWORK-STATE.md;docs/specs/research-log.md;docs/specs/reviews/wi-559-cross-system-review.md;docs/specs/reviews/wi-559-exec-review.md;docs/specs/work-items/INDEX.md;docs/specs/work-items/WI-559.md;proposals/2026-08-23-framework-improvement-review-dispatch-adapter-convergence.md;references/knowledge/svc/CAPABILITIES.md | changed |

## Changeset Blueprint

The executor must implement these contracts exactly. It may choose local helper
names only when the public CLI, receipt fields, failure behavior, and tests below
remain byte-compatible.

### B1 — fail-first Tier-1 contract

`validate-review-dispatch-adapter-convergence.sh` is a hermetic Bash fixture that:

- creates disposable Git repositories and protected `0600` dispatch policies;
- installs fake `grok` and, where needed, fake external reviewer binaries in a
  fixture-only `PATH`; no real provider call is possible;
- exercises `scripts/resolve-execute-dispatch.mjs` through public CLI subcommands,
  the preflight shell, worker/log shell, and commit guard;
- records fake Grok argv as NUL-safe JSON and asserts exact ordered presence of
  `--cwd`, `--model grok-4.6`, `--reasoning-effort high`,
  `--permission-mode auto`, `--no-subagents`, `--disable-web-search`, and
  `--prompt-file` while proving the task body is absent from argv;
- rejects any argv containing `bypassPermissions`, force-approval switches, or a
  permission-bypass synonym;
- covers: numeric WI; named WI; structured-header + branch agreement; missing WI;
  two distinct WIs; stale branch mismatch; zero active logs; two matching active
  logs; unrelated promoted log preceding exact WI log; non-authorized terminal
  states; owner-default mode; unknown explicit mode; multiple configured external
  stations; explicit eligible station; wrong station; exact Grok resolution;
  policy/review/manifest digest drift; wrong mode/orchestrator/host/family/model/
  effort; stale and future time; nonzero exit; malformed JSONL; successful exact
  row; accepted exact owner override; mutation downgrade, dirty-tree false
  success, and zero-log commit activation; legacy-only MiMo/Sonnet/Opus rows;
  and zero provider calls for every bind denial;
- runs at least twice against the same fixture to prove deterministic/idempotent
  read behavior and append-only evidence preservation.

The review-launcher fixture adds one plan repo on branch
`bugfix-WI-SCOUT-CAPTURE-DURABILITY-01` whose manifest has
`**Work item:** WI-SCOUT-CAPTURE-DURABILITY-01`; policy default mode contains
two independent external stations. With no mode/station environment override,
the adapter must reach exactly one resolver-selected fake reviewer call. Existing
no-WI, multi-WI, mismatch, numeric, phase, and receipt cases remain unchanged.
It also freezes the observed bootstrap failure: owner-selected
`cursor`/`anthropic`/`claude-fable-5` and
`cursor`/`openai`/`gpt-5.6-sol` stations must each pass end-to-end findings
validation, produce a schema-valid exact tuple receipt, and make exactly one
fake Cursor CLI call. A findings envelope whose `reviewer.host` is `cursor`
must match the invoked tuple. Invalid host/family/model attestation, a Cursor
success with attestation level `none`, and mismatched findings all remain
fail-closed with no review authorization.

`validate-persistent-review-contract-v2.mjs` must assert outcomes rather than
the removed `(!requested || station.id === requested)` source fragment: config is
passed automatically; mode/station flags appear only when explicitly supplied;
the adapter names `resolve-execute-dispatch.mjs bind-plan`; and the launcher
still owns candidate digest, schema, receipt, and read-only transport.

The receipt tuple and findings reviewer schemas admit `cursor` as a host while
retaining the existing orchestrator/family enums and exact host/family match.
`run-external-review.mjs` treats Cursor as a first-class transport: capability
probing uses `cursor-agent --help`; review invocation is non-interactive,
`--print`, `--output-format json`, `--mode plan`, `--sandbox enabled`, exact
selected `--model`, and the package as the prompt without auto-approval flags.
It parses the Cursor JSON envelope's `result` as raw or fenced JSON and then
applies the canonical findings schema. Successful Cursor review accepts only
the existing policy's `cursor`+`anthropic` and `cursor`+`openai` family pairs
and requires `model_attestation.level` of `requested_accepted` or stronger;
`requested_accepted` means exact model argv plus successful authenticated JSON
exit, not a fabricated server echo. Requested, invocation, and effective
tuples remain equal on success, the receipt records the exact argv/output
artifact, and malformed or contradicted output fails before review
authorization. Existing Codex, Claude, AGY, cache, fallback, phase, and receipt
semantics remain unchanged.

### B2 — shared authorization helper

Create executable ESM scripts/resolve-execute-dispatch.mjs using Node built-ins,
the shared `scripts/lib/protected-file.mjs` directory-descriptor-pinned reader,
and imports of `WI_ID_BODY`/`WI_ID_RE` from `hooks/lib/wi-id.mjs`. Authority
files are opened through an owner-checked, non-writable parent directory
descriptor plus an `O_NOFOLLOW` leaf descriptor; a symlinked or replaced parent
therefore cannot redirect policy, manifest, review-log, binding, or override
bytes. Export pure functions for direct fixture use and implement three CLI
subcommands:

1. `bind-plan --repo <root> --manifest <path> [--snapshot-out <path>]` rejects
   symlink components and returns compact JSON with
   `schema_version: 1`, exact `wi`, normalized repo-relative `manifest`,
   `manifest_sha256`, and branch. It extracts delimiter-bounded canonical tokens
   from branch and structured Markdown `WI`/`Work item` header/table rows first.
   If no structured field exists it scans the manifest as compatibility fallback.
   More than one branch candidate, more than one authoritative manifest candidate,
   no candidate, or branch/manifest disagreement exits 4. Error text names the
   distinct candidates and always precedes provider invocation. When snapshot
   output is requested it writes and fsyncs the exact bytes behind the returned
   digest; the plan adapter packages only that immutable snapshot.
2. `preflight --repo <root> --wi <WI> [--policy <path>] [--mode <mode>]
   [--orchestrator <host>] [--allow-override-file <path>]` validates canonical WI,
   finds active docs/plans manifests structured-bound to that exact WI,
   excludes `docs/plans/done/**`, requires exactly one matching `review-log.yaml`,
   parses exactly one root-level terminal-state/WI/manifest/manifest-sha field,
   accepts only the three authorized states, requires the current manifest bytes
   to equal that reviewed digest, hashes the review log, and calls the existing dispatch resolver for
   `EXEC` with WI/orchestrator/policy/optional explicit mode. It prints one compact
   JSON object with `schema_version: 2`, `decision: dispatch`, WI, repo-relative
   manifest path/hash, review log, `review_log_sha256`, policy path/hash, mode,
   `phase: exec`, implementor station, orchestrator, and exact tuple fields.
   A valid accepted override prints `decision: owner-override`, exact WI,
   `override_sha256`, reason, and review-log hash; it never invents a tuple.
3. `record-override --repo <root> --wi <WI> --allow-override-file <path>` is the
   only production writer for a successful schema-2 owner-override evidence row.
4. `verify-receipt --repo <root> --wi <WI> [--max-age-seconds 21600]` performs a
   fresh preflight without override, reads `.svc/dispatch-log.jsonl` defensively,
   ignores malformed/other-WI/other-skill rows, and succeeds only when a recent
   `exit_code: 0` row is neither stale nor future-dated and matches current
   manifest, policy hash, review-log hash, mode, phase, station, orchestrator,
   decision, host, family, model, and effort. It separately accepts a schema-2 exact-WI
   owner-override row with bound override hash/reason. Output is compact JSON;
   denial is nonzero and actionable.

Every repo/file path is resolved/contained under the supplied real root except
the protected owner policy/override. Policy security remains owned by
`resolve-dispatch.mjs`; no JSON from stdout is evaluated as shell.

### B3 — review adapter

In `review-plan-codex.sh`:

- replace numeric grep binding with one call to `resolve-execute-dispatch.mjs
  bind-plan`; extract JSON fields with Node, not `eval`/`source`;
- validate any explicitly selected protected policy before resolver/provider use
  and deny a missing or ineligible path; construct reviewer arguments with
  `--reviewer-config` when the protected file exists; append `--reviewer-mode`
  only when `SVC_REVIEWER_MODE` is non-empty;
  append `--reviewer-station` only when `SVC_REVIEWER_STATION` is non-empty;
- remove the hardcoded `production` default, topology subprocess, station
  filtering, and exact-one cardinality check; `run-external-review.mjs` remains
  the single station selector/transport/receipt authority;
- retain phase binding, plan hash, pre-execution base, candidate digest,
  output-first protocol, schema checks, receipt checks, and existing exit codes;
- pass `SVC_WI=<bound WI>` to the launcher so scoped policy overlays resolve for
  the exact work item.

`resolve-adversarial-reviewer.sh` delegates every supported orchestrator's
policy status directly to `run-external-review.mjs --policy-status
--reviewer-config ...`; it does not schema-sniff or reopen policy bytes before
the canonical launcher. `review-plan-codex.sh` identifies its orchestrator from
the explicit host/session context and likewise performs no preliminary policy
read. This keeps one protected launcher snapshot as the policy authority.

### B4 — execution preflight, transport, evidence, and guard

`execute-dispatch-preflight.sh` keeps its public positional repo/WI signature and
optional override flag, but delegates all decisions to
resolve-execute-dispatch.mjs preflight. It emits only the compact JSON stdout
and actionable stderr. Missing/unauthorized review proof exits nonzero; it never
returns a permissive `not-required` outcome and never calls `check-mimo-quota.sh`.

`dispatch-worker.sh`:

- makes `execute-changeset` and `dispatch-waves` non-downgradably mutating and
  requires the complete delegation preflight and containment argv;
- when `SVC_HARNESS=grok`, requires freshly resolved `SVC_WORKER_MODEL` and
  `SVC_WORKER_EFFORT`, family, policy digest, mode, orchestrator, and authorized
  repo root to match current EXEC, requires installed `grok`, and sets the argv
  exactly to the safe B1 flag set with that real worktree as `--cwd` and the
  same canonical root as the containment boundary;
- never supplies force/bypass flags; large payloads remain file-backed from
  `dispatch-log.sh` through a private mode-0600, fsynced Grok `--prompt-file`;
- keeps dispatcher-owned progress/result/log/prompt artifacts under the Git
  runtime directory by default so evidence does not dirty the child worktree;
- header prints host, family, model, effort, WI, and policy/review digests in
  parseable ASCII key/value lines while retaining the worker summary protocol;
- existing Claude/OpenCode/OpenClaw behavior and delegation completion semantics
  remain byte-compatible.

`dispatch-log.sh` resolves EXEC before launch, rejects a requested harness/model/
effort mismatch, passes exact tuple context to the worker, captures every exit
without losing `set -u` behavior, and appends through the repository state-I/O
helper rather than interpolated Python. Its schema-2 row contains `ts`, `wi`,
`decision`, `skill`, `mode`, `phase`, `station`, `host`, `family`, `model`, `effort`,
`orchestrator`, `policy_sha256`, `review_log_sha256`, `manifest`,
`manifest_sha256`, `duration_ms`, `exit_code`, and `log_path`. The append pins
the already-open parent directory while locking/writing, fsyncs file and that
directory, and append failure overrides a successful worker exit.
Duration and log path are informational; all other fields are authority inputs.

`svc-execute-dispatch-guard.sh` retains its staged `src/` activation boundary.
When activated it derives the exact WI via the shared helper/current plan, calls
`verify-receipt`, and allows only its successful result. It removes first-log
selection and MiMo/Sonnet/Opus substring allowlists. Errors name current WI,
review log, expected tuple, and mismatch class without printing policy contents.

The execute-changeset references replace profile-era tables with the compact
JSON contract, show safe extraction of fields through Node, show the full
delegation lifecycle required before `dispatch-worker.sh`, and give Grok as the
current owner-policy example rather than a fixed universal default.

### B5 — focused validation closure and knowledge

Add selector contracts mapping the new helper, its transitive WI/resolver
imports, five adapter/guard scripts, shared state I/O, two execute references,
and the new fixture to `validate-review-dispatch-adapter-convergence.sh`.
Changes to shared worker/state primitives must additionally select the existing
parallel-dispatch, child-transport, state-I/O-discipline, and atomic-write
validators. The convergence suite must execute the host-authority and child
transport/contained-exec validators rather than only name their source paths.
Update their fixtures for the non-downgradable mutation and atomic receipt
contracts.

After focused and full Tier-1 pass, update framework state, capability registry,
WI, and index with local evidence only. After PR land + central install + exact
HoursHub replay, append promoted/installed/replay evidence and move the proposal
to `proposals/done/`. Never claim the downstream product fix is implemented by
the framework replay; it only proves the gate can now authorize Grok execution.

## Task Graph

| Task | Title | Files | Depends on | AC coverage | Validation | Checkpoint | Parallel group |
|---|---|---|---|---|---|---|---|
| T1 | Freeze fail-first public contract | three Tier-1 validators | reviewed plan | AC-559-1..7 | syntax checks; new fixture must fail on current adapter behavior with the four reproduced reasons | `wi559-red-contract` (state marker, no failing commit) | sequential foundation |
| T2 | Converge WI binding and plan reviewer selection | shared helper, review adapter, receipt schema, canonical Cursor transport, review fixtures | T1 | AC-559-1..3,7 | new fixture review/bind/Cursor groups; external-review launcher; persistent contract; resolver; WI-ID | `wi559-review-adapter-green` | sequential implementation A |
| T3 | Converge execution preflight, Grok transport, evidence, and guard | helper, preflight, worker, log, guard, two references, fixture | T2 | AC-559-4..7 | new fixture execute/transport/guard groups twice; delegated transport; shell syntax | `wi559-execute-adapter-green` | sequential implementation B |
| T4 | Bind focused selector closure | selector + selector fixture | T3 | AC-559-7 | selector fixture; focused Tier-1 selects and passes exact closure | `wi559-focused-closure` | sequential verification A |
| T5 | Synchronize knowledge and freeze branch | state, capabilities, WI/index, proposal pending, all manifest files | T4 | AC-559-1..7 | plan mechanical, contract/probe/map validators, focused and full Tier-1, diff-manifest parity | `wi559-framework-green` | sequential verification B |
| T6 | Land, install, and replay original consumer | no new runtime source; proposal move/state evidence after proof | T5 + G5/review-exec/audit | AC-559-8 | sanctioned PR finalization, `setup --all-hosts`, install drift, exact HoursHub review + EXEC preflight | `wi559-promoted-replayed` | verify-promotion |

## AC-to-Task Mapping

| AC | Tasks | Coverage |
|---|---|---|
| AC-559-1 | T1,T2,T4 | full |
| AC-559-2 | T1,T2,T4 | full |
| AC-559-3 | T1,T2,T4 | full |
| AC-559-4 | T1,T3,T4 | full |
| AC-559-5 | T1,T3,T4 | full |
| AC-559-6 | T1,T3,T4 | full |
| AC-559-7 | T1,T2,T3,T4,T5 | full |
| AC-559-8 | T6 | full; post-land installed replay gate |

## AC-to-Test Mapping

| AC | Type | Evidence |
|---|---|---|
| AC-559-1 | Unit/integration | default/explicit/unknown mode cases in review adapter fixture |
| AC-559-2 | Integration | multi-station and explicit station fake-reviewer call counts plus schema-valid exact Cursor tuple receipt |
| AC-559-3 | Unit/integration | canonical WI corpus plus structured/named/missing/ambiguous/mismatch zero-call cases |
| AC-559-4 | Integration | exact/unrelated/duplicate/unauthorized review-log and compact preflight cases |
| AC-559-5 | Integration | fake Grok NUL-safe argv capture under real delegation/containment setup |
| AC-559-6 | Unit/integration | schema-2 exact/stale/failed/wrong tuple/digest/legacy evidence guard matrix |
| AC-559-7 | Regression | named focused suite plus existing resolver/topology/external/delegation/WI fixtures and full Tier-1 |
| AC-559-8 | Manual/integration | exact post-install HoursHub worktree commands with receipts and zero product mutation before authorization |

## Prerequisite Alignment Matrix

| Task | UX/UI/style/persona | Technical source | Alignment |
|---|---|---|---|
| T1 | N/A - system-only | WI-559 ACs + contract map falsification table | Every denial has a zero-call or commit-block assertion |
| T2 | N/A - system-only | design Architecture, D-1, D-2 | One resolver, one canonical WI binder |
| T3 | N/A - system-only | design State Machine/Data Model, D-3, D-4 | Exact current tuple and bounded Grok permissions |
| T4 | N/A - system-only | Test Matrix | Every changed executable selects focused proof |
| T5 | N/A - system-only | Operations/Rollback | Evidence states remain honest and recoverable |
| T6 | N/A - system-only | AC-559-8 + Old/New Path Proof | Same original consumer input proves installed behavior |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1/2 | Central host skill/script installs and host config links | Installed framework bundle used by Codex/Cursor/Grok | coupled | Post-land `./setup --all-hosts` plus `scripts/check-install-drift.sh`; setup runs only from canonical checkout |
| 3 | HoursHub consumer worktree | Original named-WI review/preflight replay and its `.svc` evidence | coupled | T6 runs only after merged central SHA is installed; replay records paths/SHA and makes no product source mutation |
| 7 | Configured external review/build provider | Reviewer and Grok availability | decoupled-justified | Owner policy controls selection; launcher/worker nonzero exits block without fallback remap |
| 12 | Execute skill references, framework state, capability registry | Downstream contract consumers | coupled | Same changeset + Tier-1 string/behavior contract validators |
| 14 | Existing provider authentication | Cursor/Grok local account state is read, never written | decoupled-justified | Recorded `cursor-agent --version`, `cursor-agent --help`, and `cursor-agent status` probes plus Grok invocation errors are actionable; recovery is owner re-authentication |
| 15 | `.svc/dispatch-log.jsonl`, external review artifacts, receipts | Append-only audit/runtime evidence | coupled | State-I/O append, schema checks, hash binding, guard reader, receipt closeout; rollback never deletes audit rows |

Untouched environments (taxonomy walked): 4 package registries; 5 schedulers;
6 persistent services; 8 databases/migrations; 9 caches; 10 DNS/SSL; 11 search
indexes; 13 CI/CD configuration. No new environment class surfaced.

The provider and authentication states are intentionally owner-controlled and
outlive this repository changeset. Decoupling is safe because code never mutates
them and every dependency failure is a nonzero, non-authorizing result. Recovery
is provider re-authentication or an explicit owner-policy change followed by a
new reviewed dispatch; silent model substitution is forbidden.

## Validation Plan

### Task-level

```bash
bash -n test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
bash -n scripts/review-plan-codex.sh scripts/execute-dispatch-preflight.sh scripts/dispatch-worker.sh scripts/dispatch-log.sh hooks/svc-execute-dispatch-guard.sh
node --check scripts/resolve-execute-dispatch.mjs
bash test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
node test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs
node test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs
node test-framework/evals/tier-1/validate-review-topology-v2.mjs
bash test-framework/evals/tier-1/validate-wi-id.sh
bash test-framework/evals/tier-1/validate-review-plan-readonly.sh
node test-framework/evals/tier-1/validate-child-transport-resolver.mjs
bash test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh
bash test-framework/evals/tier-1/validate-state-io-discipline.sh
bash test-framework/evals/tier-1/validate-atomic-state-writes.sh
bash test-framework/evals/tier-1/validate-reviewer-run-evidence.sh
node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs
git check-ignore .svc/owner-overrides/WI-559-retro-plan.json .svc/review-plan-snapshots/*.manifest.md
```

### Branch-level

```bash
node scripts/validate-system-contract-map.mjs --map docs/specs/contract-maps/review-to-execute-dispatch.md
node scripts/validate-cross-system-probe-evidence.mjs --evidence docs/specs/test-evidence/WI-559/design-capability-probes.json
node scripts/check-cross-system-iteration-cap.mjs --lane-tasks .svc/lane-tasks-WI-559.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-559.json
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-23-wi559-review-dispatch-adapter/manifest.md
SVC_TIER1_MODE=focused bash test-framework/evals/run-all-evals.sh
bash test-framework/evals/run-all-evals.sh
git diff --check
git diff --name-only fbafdf6ce084edf6b07b4d1cfcdf7bbc852b2644...HEAD
```

## Execution Command Sequence

```bash
cd /home/dianast/app-workspaces/seriousvibecoding/.worktrees/bugfix-WI-559-review-dispatch-adapter
test "$(git branch --show-current)" = bugfix-WI-559-review-dispatch-adapter
test "$(git merge-base HEAD origin/main)" = fbafdf6ce084edf6b07b4d1cfcdf7bbc852b2644

# T1: add/update only the declared Tier-1 contracts, run syntax, then prove the
# current implementation fails the new public fixture for the reproduced reasons.
bash -n test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
bash test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
# Expected here only: nonzero red proof before T2/T3; save exact output as evidence.

# T2: implement shared binding/review selection; run T2 validators until green.
node --check scripts/resolve-execute-dispatch.mjs
bash test-framework/evals/tier-1/validate-external-review-launcher.sh
node test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs
node test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs
bash test-framework/evals/tier-1/validate-wi-id.sh
git add schemas/external-review-findings.schema.json schemas/external-review-receipt.schema.json scripts/lib/protected-file.mjs scripts/lib/reviewer-evidence.mjs scripts/resolve-adversarial-reviewer.sh scripts/resolve-dispatch.mjs scripts/resolve-execute-dispatch.mjs scripts/review-plan-codex.sh scripts/review-topology-v2.mjs scripts/run-external-review.mjs test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh test-framework/evals/tier-1/validate-external-review-launcher.sh test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs test-framework/evals/tier-1/validate-reviewer-run-evidence.sh
git diff --cached --check
git commit -m "fix(dispatch): converge plan review adapters" -m "WI: WI-559" -m "Checkpoint: wi559-review-adapter-green"

# T3: implement preflight/Grok/evidence/guard and references; require full focused groups twice.
bash test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
bash test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
node test-framework/evals/tier-1/validate-child-transport-resolver.mjs
bash test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh
git add hooks/svc-execute-dispatch-guard.sh scripts/auto-receipt.mjs scripts/dispatch-log.sh scripts/dispatch-worker.sh scripts/execute-dispatch-preflight.sh scripts/resolve-execute-dispatch.mjs scripts/state-io.mjs skills/execute-changeset/references/dispatch-preflight.md skills/execute-changeset/references/subagent-dispatch.md test-framework/evals/tier-1/validate-review-dispatch-adapter-convergence.sh
git diff --cached --check
git commit -m "fix(dispatch): enforce exact Grok execution evidence" -m "WI: WI-559" -m "Checkpoint: wi559-execute-adapter-green"

# T4/T5: bind selector closure, docs, and final proof.
node test-framework/evals/tier-1/validate-tier1-selector-v2.mjs
SVC_TIER1_MODE=focused bash test-framework/evals/run-all-evals.sh
bash test-framework/evals/run-all-evals.sh
git diff --check
git add scripts/select-tier1-validators-v2.mjs test-framework/evals/tier-1/validate-parallel-wi-dispatch.sh test-framework/evals/tier-1/validate-tier1-selector-v2.mjs FRAMEWORK-STATE.md references/knowledge/svc/CAPABILITIES.md docs/specs/work-items/WI-559.md docs/specs/work-items/INDEX.md proposals/2026-08-23-framework-improvement-review-dispatch-adapter-convergence.md docs/plans/2026-08-23-wi559-review-dispatch-adapter docs/specs/bugfix/wi-559-review-dispatch-adapter-brief.md docs/specs/contract-maps/review-to-execute-dispatch.md docs/specs/decisions/WI-559.md docs/specs/tech/WI-559.md docs/specs/test-evidence/WI-559 docs/specs/research-log.md docs/specs/reviews/wi-559-cross-system-review.md docs/specs/reviews/wi-559-exec-review.md
git diff --cached --check
git commit -m "docs(dispatch): record WI-559 governed proof" -m "WI: WI-559" -m "Checkpoint: wi559-framework-green"

# Final branch checks and chain receipts run through the loaded execute/review skills.
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-559.json
git status --short
```

`RECOVERY_IF_FAIL`: do not reset, clean, delete audit evidence, skip hooks, or
change ownership. Leave the failed task's diff in this worktree, record the exact
command/output, fix only manifest-owned files, rerun that task's validators, and
commit only after green. If an unrelated owner changes the base or authority
claim, stop and resolve through sanctioned worktree/claim tooling.

## Checkpoint Plan

| Checkpoint | Meaning | Rollback anchor |
|---|---|---|
| `wi559-red-contract` | New fixture reproduces current four failures | base SHA; no failing commit |
| `wi559-review-adapter-green` | Named WI + default/multi-station plan review green | first implementation commit |
| `wi559-execute-adapter-green` | Exact Grok preflight/transport/evidence/guard green | second implementation commit |
| `wi559-focused-closure` | Focused selector returns exact green closure | staged T4 state |
| `wi559-framework-green` | Full Tier-1 and branch audit green | final execution commit |
| `wi559-promoted-replayed` | Landed, installed, original consumer preflight green | merged final SHA + notes receipts |

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| T1 | new convergence validator absent | PASS (CREATE) | create tests first |
| T1 | external launcher and persistent contract validators exist | PASS (MODIFY) | preserve existing cases |
| T2 | shared helper absent | PASS (CREATE) | import canonical WI grammar |
| T2 | review adapter and resolver exports exist | PASS (MODIFY/import) | launcher keeps selection authority |
| T3 | five shell adapter/guard files and two references exist | PASS (MODIFY) | preserve delegation/containment |
| T3 | installed Grok 1.0.5 exposes every required safe flag | PASS | no new dependency |
| T4 | selector and selector fixture exist | PASS (MODIFY) | add exact contract entry/test |
| T5 | state, capability, WI/index, and pending proposal exist | PASS (MODIFY) | proposal moves only after replay |
| all | Base44/backend/ORM/UI/package dependency | PASS (N/A) | system-only framework paths |
| all | task imports and dependency order | PASS | T1 -> T2 -> T3 -> T4 -> T5 -> T6 |

### Scenario Coverage

No user-facing journey document applies. The system contract map's five
old/new-path rows map to T2 (three plan-review rows), T3 (preflight/guard rows),
and T6 (same-input installed replay): 5/5 covered.

## Adversarial Self-Review

1. Missing tasks: none; all eight ACs map to implementing/proof tasks.
2. Dependency correctness: sequential edges ensure tests precede helper, helper
   precedes shell consumers, runtime precedes selector/docs, and land precedes replay.
3. Scope reduction: no banned deferral language in task/action/done conditions;
   the full active adapter family and regression closure are counted.
4. Validation strength: behavior fixtures assert provider call counts, argv,
   hashes, exits, and guard decisions; syntax-only checks are never sole proof.
5. First-task viability: T1 receives base repo, spec, design, manifest, exact
   reproduction, fake-provider constraints, and required test paths.
6. Pattern completeness: WI extraction tests exact accepted corpus plus lowercase,
   delimiter, ambiguity, branch mismatch, and dependency-reference variants.
7. Visual rendering: N/A, no visual surface.
8. Production mock parity: N/A, no UI modification.
9. Provider fidelity: provider is execution transport, not generated product
   output; fake CLI verifies argv and original live replay verifies installed route.
10. Persona trace: N/A - system-only on every task.

## Promotion Readiness Checklist

- [ ] Canonical plan review terminal state authorizes execution.
- [ ] Required `review-cross-model` challenges diagnosis + contract map before T1.
- [ ] All manifest paths account for the final diff; no sibling WI files appear.
- [ ] T1 red proof and T2/T3 green proof are retained.
- [ ] Focused selector and full Tier-1 pass at final branch HEAD.
- [ ] No ORM schema modification; no migration task applies.
- [ ] G5, independent review-exec, audit-implementation, and final-SHA receipts pass.
- [ ] PR is landed through sanctioned finalizer and the exact merged SHA is installed.
- [ ] Original HoursHub named-WI review and Grok preflight replay green before any product mutation.
- [ ] Proposal moves to done only after installed replay; states distinguish local, landed, installed, replayed.
