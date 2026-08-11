# WI-507 Technical Design — Company Operating Fleet and Promotion Memory

**Status:** BASELINED
**Gate:** G4 PASS (2026-07-22)
**Spec:** `docs/specs/work-items/WI-507.md`
**Surface:** background framework enabler; no human-visible UI, UX journey, browser route, or provider integration

## Architecture

WI-507 extends the existing dependency-free Node ESM company-state engine and host wiring. Repository-local JSON points to company state; framework scripts validate and operate on it without knowing the company identity. Promotion memory and topology use user-scoped, versioned files because they span repositories on one operator machine. Diagnostics are read-only and hooks are fail-open consumers of the same public CLIs.

The design deliberately uses JSON/JSONL plus existing Git/lock/atomic helpers. No native database driver, package manager, daemon, network service, or schema migration is introduced.

### Dependency graph

```text
repository cwd
    |
    v
.svc/company-link.json -----> company-state/apps.json
    |                                |
    v                                v
company-state.mjs             cross-app-contract-guard.mjs
    |                                |
    +----> open-items.jsonl          +----> contained contract files
    +----> decisions-pending.jsonl
    |
    +----> cos-briefing.mjs --30s cache--> SessionStart output

land-changeset evidence --> verify-promotion receipt --> promotion indexer
                                                        |
                                                        v
                                      ~/.svc/wi-promotion-index.jsonl
                                                        |
                                                        v
                                           svc-delta-preload.mjs

company-state/apps.json --> worktree-topology.mjs --> ~/.svc/worktree-topology.db
trace/DOM evidence -----> auto-healer.mjs ---------> diagnosis only
```

No arrow points from a diagnostic or hook back to source/spec/test input. Only the explicit company-state mutation commands and promotion/topology index commands write their named stores.

### Components

| Component | Type | Responsibility | Change |
|---|---|---|---|
| `scripts/company-state.mjs` | CLI engine | Resolve state, validate schemas, mutate SLA/decision records under lock, render bounded briefing/dashboard | Modify |
| 15 fleet `SKILL.md` files | Prompt contracts | Route specialist analysis to proposer-only decision cards | Create |
| `svc-wi-promotion-indexer.mjs` | CLI store | Accept only a G7-receipted promoted SHA and idempotently append/query summaries | Create |
| `worktree-topology.mjs` | CLI store | Snapshot registered repositories and worktrees into one user-scoped database | Create |
| `cross-app-contract-guard.mjs` | Diagnostic | Validate registry containment and report contract drift | Create |
| `auto-healer.mjs` | Diagnostic | Classify trace/DOM evidence and recommend a route without mutation | Create |
| two SessionStart hooks | Host adapters | Emit cached briefing and bounded promotion delta, fail open | Create |
| Claude/Gemini wire scripts | Host config adapters | Add or remove only the two owned hook entries idempotently | Modify |

## Normative schemas

Unknown top-level schema versions fail closed with a structured `unsupported_schema_version` result. Within a supported version, unknown fields are ignored on read and preserved by updates where the file is rewritten. Required identifiers never change in place. A breaking field or semantic change requires a major schema-version bump and dual-reader migration plan; additive optional fields require a minor bump.

### Company link v1.0.0

| Field | Type | Required | Rule |
|---|---|---|---|
| `schema_version` | string | yes | Exact `1.0.0`. |
| `company_repo` | string | yes | Absolute path; canonical target is an existing Git repository with a regular `company-state/` directory. |
| `app_id` | string | yes | `^[a-z0-9][a-z0-9-]{0,63}$`; stable registry id. |

Unknown fields are rejected because this file is an authority pointer. A self-link is valid for the parent repository. Resolution never follows a relative path or guesses a sibling.

### Apps registry v1.0.0

| Field | Type | Required | Rule |
|---|---|---|---|
| `schema_version` | string | yes | Exact `1.0.0`. |
| `apps` | array | yes | Stable sort by `id`; ids and canonical paths unique. |
| `apps[].id` | string | yes | Same id grammar as company link. |
| `apps[].repo_path` | string | yes | Absolute canonical path to an existing Git repository. |
| `apps[].owner` | string | yes | Non-empty repository-local label; framework never supplies a value. |
| `apps[].status` | enum | yes | `active`, `paused`, or `retired`. |
| `apps[].contracts` | array | yes | May be empty; unique `name` within the app. |
| `contracts[].name` | string | yes | Stable cross-app grouping key. |
| `contracts[].path` | string | yes | Relative regular-file path that remains contained after realpath. |

`register-app` locks the state directory, canonicalizes paths, validates the full next document, sorts by id, and atomically renames the write. Same id plus byte-equivalent normalized entry is a no-op; any conflicting id/path denies.

### Promotion index entry schema v1

The store is `~/.svc/wi-promotion-index.jsonl`, or `$SVC_STATE_HOME/wi-promotion-index.jsonl` in fixtures. Each line is a full immutable entry; corrections append a new entry with `supersedes_id` rather than deleting history.

| Field | Type | Required | Rule |
|---|---|---|---|
| `schema_version` | integer | yes | `1`. |
| `id` | 64-hex string | yes | SHA-256 of canonical repo path + WI + promoted SHA. |
| `repo_path` | string | yes | Canonical absolute Git root. |
| `wi` | string | yes | `^WI-[0-9]+$`. |
| `promoted_sha` | 40-hex string | yes | Commit is an ancestor of promoted `origin/main`. |
| `summary` | string | yes | One line, 1–500 UTF-8 characters. |
| `receipt_ref` | string | yes | `refs/notes/svc-receipts`. |
| `verified_at` | RFC3339 string | yes | Timestamp from passing verify-promotion receipt. |
| `indexed_at` | RFC3339 string | yes | Local append time. |
| `supersedes_id` | 64-hex string | no | Prior entry corrected by this record. |

Indexing strictly follows verify-promotion receipt emission. The indexer reads the consolidated note envelope, verifies `receipt_type=verify-promotion`, matching WI/SHA, and pass verdict, then locks and appends only when `id` is absent. A duplicate exact id is a no-op. Missing/failing/stale receipts, branch-only SHAs, dirty target checkout, or unknown versions deny.

### Worktree topology database schema v1

The store is atomic JSON at `~/.svc/worktree-topology.db`, or `$SVC_STATE_HOME/worktree-topology.db` in fixtures.

| Field | Type | Required | Rule |
|---|---|---|---|
| `schema_version` | integer | yes | `1`. |
| `generated_at` | RFC3339 string | yes | Snapshot time. |
| `apps_registry_path` | string | yes | Canonical source apps registry. |
| `repositories` | array | yes | Unique and stable-sorted by `app_id`. |
| `repositories[].app_id` | string | yes | Must exist in apps registry. |
| `repo_path` | string | yes | Canonical Git root. |
| `default_branch` | string | yes | Resolved symbolic remote HEAD or explicit fallback evidence. |
| `head` | 40-hex string | yes | Repository checkout HEAD. |
| `dirty` | boolean | yes | Derived from `git status --porcelain`. |
| `worktrees` | array | yes | Unique canonical paths from `git worktree list --porcelain`. |
| `worktrees[].path` | string | yes | Canonical worktree root. |
| `worktrees[].head` | 40-hex string | yes | Worktree HEAD. |
| `worktrees[].branch` | string/null | yes | Full ref or null when detached. |
| `worktrees[].locked` | boolean | yes | Git porcelain flag. |
| `worktrees[].prunable` | boolean | yes | Git porcelain flag. |
| `worktrees[].merged_to_default` | boolean | yes | `merge-base --is-ancestor` result. |
| `worktrees[].spec_refs` | string array | yes | Bounded WI/spec refs discovered from branch and `.svc/lane-tasks-*.json`. |

Refresh builds a complete next snapshot in memory, validates it, and atomically renames. Partial Git probe failure aborts the refresh and leaves the old database intact. `show` never refreshes implicitly.

### Open-item and Immune Mesh additions

The open-item event schema and mesh mapping in `docs/specs/work-items/WI-507.md` are normative. Existing event/card fields remain compatible. A risk-free legacy card has no new fields; a declared risk domain requires an independent mapped reviewer and cited evidence. No prose heuristic adds a risk domain.

### Briefing cache schema v1

Cache files live at `${XDG_CACHE_HOME:-<user-home>/.cache}/svc/cos-briefing/<sha256-of-canonical-state-dir>.json`.

| Field | Type | Rule |
|---|---|---|
| `schema_version` | integer | Exact `1`. |
| `state_dir` | string | Canonical state directory. |
| `input_fingerprint` | 64-hex string | Hash of relevant source mtimes/sizes plus resolved path. |
| `created_at_ms` | integer | Controllable clock milliseconds. |
| `output` | string | Bounded briefing, maximum 16 KiB. |

A hit requires matching path, fingerprint, schema, and `0 <= now-created_at_ms < 30000`. Corrupt, future, or stale cache is ignored and atomically replaced. Hook errors exit zero without output.

## Data flows

### Product repository to parent briefing

```text
SessionStart JSON
  -> defensive cwd extraction
  -> git-root discovery
  -> strict company-link validation
  -> canonical parent/company-state path
  -> fingerprint + cache lookup
  -> company-state briefing subprocess (argv array)
  -> 16 KiB bounded stdout
  -> atomic cache write
  -> host stdout

Any failure --------------------------------------> exit 0, no output
```

### Promotion memory state machine

```text
BRANCH/WIP --land--> PROMOTED_NO_G7 --verify checks--> G7_RECEIPTED
    |                       |                              |
    | index deny            | index deny                   v
    +-----------------------+--------------------------> INDEXED
                                                           |
                                              same id ----> NO-OP
                                              correction -> APPEND superseding record
```

### External Task 5 state machine

```text
target absent --------O_EXCL create--------> created-by-WI
target exact --------------------------------> already-current (no write)
target divergent ----------------------------> HALT

rollback created-by-WI + hash unchanged ----> remove exact created target
rollback exact/divergent/user-modified ------> preserve and report
```

## Technology decisions

| Decision | Alternatives | Choice | Rationale |
|---|---|---|---|
| Cross-repo discovery | hardcoded paths; directory search; explicit link | strict explicit link | Deterministic and company-neutral. |
| Shared persistence | SQLite/native dependency; JSON/JSONL | atomic JSON/JSONL | Matches repo stack and avoids new runtime dependencies. |
| Promotion timing | continuous WIP; land-only; post-G7 | post-G7 receipt | Prevents unverified memory pollution. |
| Diagnostic repair | auto-edit; recommendation only | recommendation only | Evidence cannot authorize source/spec mutation. |
| Hook failure | fail session; fail open | fail open, bounded | Optional context must not block work. |
| Zip handling | package dependency; system `unzip`; extracted input | optional system `unzip` plus extracted input | No package added; missing tool returns structured `insufficient_evidence` nonzero. |

All choices are [Layer 1] boring extensions of existing Node/Git/JSON patterns. No innovation token or external capability is required.

## Security and path containment

- Canonicalize every repository/state/contract path and prove containment after resolving symlinks.
- Use argument arrays for Git, Node, and optional `unzip`; never interpolate file paths into a shell command.
- Reject unknown authority-link fields and versions; preserve unknown additive fields in non-authority stores.
- Cap file sizes, item counts, stdout, and error text. Never echo ledger bodies or secrets in hook diagnostics.
- Use existing user-scoped lock and atomic rename helpers; test crash recovery and concurrent id allocation.
- Host wire scripts own two recognizable command entries and support explicit removal/pruning for rollback.

## Test design

| Component | Unit/static | Integration | Failure cases |
|---|---|---|---|
| Company resolver/SLA/apps/mesh | focused Tier-1 fixture | temp parent/product Git repos | invalid version/path, symlink escape, malformed JSONL, races, duplicate close, missing peer |
| Skills | structure/frontmatter/trigger uniqueness | 15 scoped Tier-2 scenarios | adjacent-role collision, attempted outward action |
| Promotion index | receipt fixtures | temp Git notes/main ancestry | WIP SHA, missing/fail receipt, duplicate, correction, dirty checkout |
| Topology/contract | schema fixtures | temp repos/worktrees/contracts | probe failure, missing/escaping/divergent contract |
| Auto-healer | trace/DOM fixtures | extracted and zipped trace | missing unzip, corrupt zip, insufficient/conflicting evidence, mutation hash oracle |
| Hooks/wiring | AST/settings fixtures | temp cwd/cache/clock | corrupt/future/stale cache, oversized output, malformed stdin, explicit unwire |

Tier-2 fleet proof is scoped by adding exact scenario selection to `test-framework/evals/tier-2/run-tier2.sh`. Each scenario includes one exact invocation, expected skill name, adjacent-skill negative, and proposer-only refusal assertion. The batch budget is 75 minutes and USD 15 estimated maximum; one failed scenario may be retried once, then it blocks and is escalated. Results remain under `test-framework/evals/results/tier-2/` and a WI summary is stored at `test-framework/results/WI-507/tier2-fleet-routing.log`.

## Cost model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling | Paid by |
|---|---|---|---|---|---|
| Local compute | Node/Git process milliseconds | SessionStart plus explicit CLI use | $0 direct | Linear with repos/items | Operator hardware |
| Storage | Small JSON/JSONL records | <1 MiB initially | $0 direct | Linear with promotions/apps | Operator disk |
| Bandwidth | None | 0 | $0 | None | N/A |
| External APIs | None at runtime | 0 | $0 | None | N/A |
| Evaluation | ~15 Tier-2 scenarios | one promotion run | budget ceiling USD 15 | One-time per change | Framework evaluation budget |

Red line: no runtime network/provider dependency may be added under WI-507. If topology or memory exceeds 10,000 entries or SessionStart exceeds 500 ms p95, create a follow-up for compaction/indexing rather than adding a native database here.

## Operations and ownership

| Dimension | Answer |
|---|---|
| Owner | svc framework maintainers; repository-local app owners own registry values. |
| On-call | Best effort; no paging. |
| SLA/SLO | Session hooks target <500 ms warm and <2 s cold; failure is silent/fail-open. CLI mutations fail closed. |
| Error budget | N/A for best-effort local framework. |
| Monitoring | Command exit codes, structured JSON, Tier-1/Tier-2 logs, install drift checks. |
| Alerting | None; actionable stderr during explicit commands. |
| Dashboard | `company-state.mjs dashboard --json`. |
| Runbook | `references/company-operating-fleet.md` plus WI-507 manifest rollback table. |
| Failure modes | malformed link/registry/JSONL, stale cache, missing unzip, Git probe failure, host drift, receipt mismatch. |
| Recovery | Preserve last valid stores, patch forward, explicit hook unwire, reinstall promoted main. |
| Backup/restore | Git-tracked company state uses Git; user-scoped indexes are regenerable or append-only. |
| Dependency failure | Missing optional unzip yields structured insufficient evidence; Git/Node absence blocks explicit CLI but hooks fail open. |

## Feasibility matrix

| AC | Persona pressure | Feasible? | Design proof |
|---|---|---|---|
| AC-1 | N/A — system-only | yes | Existing lock/atomic/strict JSONL primitives extend without dependency. |
| AC-2 | N/A — internal operator roles | yes | Existing repo-root skill and scenario conventions support 15 terminal skills. |
| AC-3 | N/A — maintainer workflow | yes | Git notes and Node/Git probes provide receipt/topology evidence; diagnostics remain read-only. |
| AC-4 | N/A — session operator | yes | Existing Claude/Gemini wire scripts expose SessionStart integration. |
| AC-5 | N/A — owner-machine integration | yes | Explicit links and promoted-main setup support named live proof without framework identity. |
| AC-6 | N/A — governance | yes | Existing chain receipt, land, and verify tools supply the required gates. |

## Risks and trade-offs

| Risk | Impact | Mitigation |
|---|---|---|
| Global host symlinks point to worktree | Hosts break after cleanup | Worktree setup is validate-only; actual install is asserted in promoted primary main; inspect symlinks. |
| External target changes during Task 5 | User data overwrite | Persist precheck, exact/no-op/divergent state machine, exclusive create. |
| Shared stores corrupt on crash | Lost context | Lock, temp file, fsync/rename pattern, retain last valid snapshot. |
| Tier-2 cost/flake | Unbounded spend or false block | Exact 15-scenario selector, USD 15/75-minute budget, one per-scenario retry. |
| Hook rollback leaves dead settings | Session errors | Wire scripts add explicit remove/prune mode and rollback assertions. |
| Legacy role names drift | Existing history unreadable | Alias on read/write boundary; no migration. |

## G4 adversarial review

- [Layer 1] [Confidence: 10/10] Use existing atomic JSON/JSONL and Git-note primitives; adding SQLite or a service is unnecessary.
- [Layer 1] [Confidence: 9/10] Explicit links are safer than upward/sibling searches because repository boundaries are authoritative.
- [Layer 1] [Confidence: 9/10] Promotion indexing must follow receipt emission; any earlier point admits unverified knowledge.
- [Layer 1] [Confidence: 9/10] Hook unwiring is part of rollback because host settings live outside Git.
- [Layer 1] [Confidence: 8/10] Optional `unzip` is acceptable only with structured nonzero degradation and extracted-trace support.
- [Layer 3] [Confidence: 9/10] The apparent “auto-healer” must remain diagnostic because classification evidence is not mutation authority.

G4 result: **PASS**. All six ACs are feasible; persistent schemas, forward behavior, lifecycle, cost, operations, security, and rollback are explicit. The >8-file scope trigger was considered and retained because the owner explicitly requires 15 independent skill entrypoints, four diagnostic/memory programs, and two host hooks; the implementation still shares one engine and two focused fixtures rather than creating 21 services or dependencies.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Spec is BASELINED | `docs/specs/work-items/WI-507.md` status | PASS |
| 2 | Technical design exists | This artifact covers architecture, components, schemas, flows | PASS |
| 3 | Every AC is feasible | Six-row feasibility matrix | PASS |
| 4 | No unresolved questions | No TBD/TODO/open question remains | PASS |
| 5 | Cost model is complete | Runtime and evaluation costs/budgets stated | PASS |
| 6 | Operations are complete | Ownership, SLO, monitoring, recovery, backup stated | PASS |

## Pipeline continuation

Return to the owner-authorized `review-plan` loop. Execution remains blocked until the final canonical review round has no unresolved Critical/High finding and the plan manifest cites this G4 artifact.
