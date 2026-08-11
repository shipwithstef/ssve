# WI-483 Changeset: Mobile worktree build identity

- **Spec:** docs/specs/work-items/WI-483.md
- **Branch:** framework-WI-483-mobile-worktree-builds
- **Lane:** framework
- **Archetype:** bounded framework capability + cross-cutting release contract
- **Planning mode:** define pure identity engine, adapter boundary, then lane consumers
- **Execution mode:** dispatch
- **Planning base:** 22df12efdfc4d48dacf2acea8588d585ce0094a8
- **Dependency/execution base:** WI-482 VERIFIED; create from current verified origin/main
- **Status:** REVIEWED_AND_FROZEN; planning only
- **Created:** 2026-07-14T10:48:02Z

## Implementation Summary

Add a platform-neutral identity engine and JSON adapter contract that gives each mobile worktree a stable co-installable development identity and strictly increasing build code while keeping canonical release identity separate. Framework tests use fake adapters; no consumer Gradle, Xcode, signing, or store state changes in this WI.

## Files Planned

| File | Action | Responsibility |
|---|---|---|
| scripts/mobile-build-identity.mjs | CREATE | derive/allocate/verify dev and release identities |
| schemas/mobile-build-contract.schema.json | CREATE | consumer adapter and release-ledger contract |
| references/mobile-worktree-builds.md | CREATE | algorithms, platform limits, lifecycle, security |
| test-framework/evals/tier-1/validate-mobile-build-identity.sh | CREATE | fake-adapter identity/release matrix |
| rules/build-and-ship-alignment.md | MODIFY | dev/release separation and canonical floor |
| concerns/build-ship-alignment.md | MODIFY | align concern wording while preserving store authority |
| test-framework/evals/tier-1/validate-build-ship-android-version-gate.sh | MODIFY | preserve/update content-coupled assertions with the rule |
| execute-changeset/SKILL.md | MODIFY | conditional worktree dev build phase |
| land-changeset/SKILL.md | MODIFY | canonical version allocation exactly once |
| verify-promotion/SKILL.md | MODIFY | artifact manifest/filename/receipt verification |

## Changeset Blueprint

### schemas/mobile-build-contract.schema.json — complete schema

Draft 2020-12, additionalProperties false. Required fields: schema_version=1, project, platforms (non-empty subset android/ios), canonical_identity, development, release, commands. canonical_identity requires application_id and display_name; iOS requires bundle_id. development requires id_suffix_template `.wt_{branch_slug}_{branch_hash}`, label_template, artifact_template, state_file under gitignored worktree-local runtime, max_code (Android <=2100000000), and signing_profile enum debug/adhoc. release requires ledger path, monotonic floor source enum remote/ledger/max, and canonical artifact template. commands requires JSON argv arrays for prepare_dev, build_dev, inspect_artifact, allocate_release, build_release; shell strings are forbidden. Adapter output schemas bind application id/bundle id, version code/build number, version name, label, artifact path, source SHA, branch hash, and mode dev/release.

### scripts/mobile-build-identity.mjs — complete CLI and algorithm

```text
Commands:
  derive --contract FILE --branch NAME --sha SHA [--now EPOCH]
  allocate-dev --contract FILE --branch NAME --sha SHA [--now EPOCH]
  allocate-release --contract FILE --remote-floor N --ledger-floor N
  verify --contract FILE --receipt FILE --artifact-metadata FILE
Output: canonical JSON to stdout; diagnostics stderr; exit 2 contract/input/range, exit 1 state/verification.
```

Normalize branch to lowercase `[a-z0-9_]`, collapse separators, trim to 18 characters, and append first 8 hex of SHA-256 of the original full branch. Development application identity is canonical id + `.wt_` + slug + `_` + hash; reject platform length/character violations. Label is canonical display name + ` [slug-hash]`. Development code candidate is integer UTC Unix seconds; acquire exclusive lock on worktree-local state; allocate `max(candidate,last+1)`; reject above contract max; atomically persist last code. Artifact filename includes project, branch slug/hash, UTC compact timestamp, code, source short SHA and platform. Release allocation uses `max(remote_floor, ledger_floor, last_canonical, highest_reserved)+1`, never reads dev state, and writes a durable `reserved` ledger row before invoking the build. Successful inspection transitions that exact row to `built`; land transitions it once to `committed`. A failed build marks it `failed` but the number remains consumed, so retries allocate a new higher code. Verify requires exact equality among receipt, inspected built metadata, filename tokens, source SHA, mode and identity.

### references/mobile-worktree-builds.md — complete contract

Define co-installable dev identity, separate app data, debug/adhoc signing only, no production entitlement/keychain sharing unless consumer explicitly maps it, collision and cap behavior, ten-build burst, cleanup, fake adapter, remote store floor, rollback, and consumer onboarding. State that framework support is capability-only until a separate consumer WI adds and validates its adapter with real SDK/device proof.

### Rule and skill modifications — exact behavior

`rules/build-and-ship-alignment.md` and `concerns/build-ship-alignment.md`: split Development worktree artifacts from Canonical release artifacts while preserving the existing validator assertions. Dev epoch codes are non-release. The remote store is authority; `ledger_floor` is conservative evidence used only through `max(remote_floor, ledger_floor, ...)`, never proof that a code is reusable. Release proof includes remote floor, exactly-one canonical allocation at land, inspected metadata, filename and receipt equality. Update validate-build-ship-android-version-gate.sh in the same commit when any asserted string moves.

`execute-changeset/SKILL.md`: after implementation validation, if schemas/mobile-build-contract.json exists in the consumer, validate it, call allocate-dev, invoke JSON argv prepare/build commands, inspect artifact, and emit development receipt. Never edit canonical version fields. If no contract exists, mark mobile-build phase N/A with repository evidence.

`land-changeset/SKILL.md`: after diff/review gates and before release build, query adapter floor sources, call allocate-release once under a lock, invoke adapter allocation/build, inspect output, and commit canonical version/ledger/artifact metadata in the release checkpoint. Retry re-reads floor and cannot reuse an allocated code. Non-mobile repos are N/A.

`verify-promotion/SKILL.md`: verify release receipt mode, source commit, canonical application/bundle id, version above floor, inspected metadata and artifact filename. A development receipt is rejected as promotion evidence.

### Tier-1 test — complete matrix

Use temp contract and fake argv adapter; no SDK discovery. Assert same branch stability, 100 distinct branches without collision, two named branches co-installable, ten allocations with same epoch strictly increase, concurrent allocators unique, invalid branch sanitized, identity/platform caps, code overflow failure, dev state never changes release ledger, release allocation clears both floors once, failed release build leaves/reconciles reservation without reuse, verify catches identity/code/name/SHA/mode mismatch, and no Gradle/Xcode files appear in git diff.

## MODIFY Anchor Ledger

| File | Exact existing anchor | Disposition |
|---|---|---|
| rules/build-and-ship-alignment.md | `# Rule: Build And Ship Alignment` and Android numbered list | INSERT dev/release split; preserve eleven asserted sentences |
| concerns/build-ship-alignment.md | `## Android / Google Play hard gate` | INSERT dev identity caveat and store/ledger authority rule |
| test-framework/evals/tier-1/validate-build-ship-android-version-gate.sh | consecutive `require_contains "$RULE"` / `require_contains "$CONCERN"` blocks | PRESERVE or update assertions atomically with content |
| execute-changeset/SKILL.md | `### Step 1: Read the manifest and confirm branch state` before `### Step 2: Execute tasks` | INSERT conditional dev-build phase; no canonical edit |
| land-changeset/SKILL.md | `### Step 2: Ship Preparation` | INSERT reserve/build/inspect/commit state machine |
| verify-promotion/SKILL.md | `### VERSION Guard` | REPLACE mobile portion with equality/floor checks and dev-receipt rejection |

## Task Graph

```json
{"tasks":[
 {"id":"task-1","title":"Write schema, doctrine, and failing fake-adapter fixtures","blocked_by":[]},
 {"id":"task-2","title":"Implement deterministic identity and atomic allocation engine","blocked_by":["task-1"]},
 {"id":"task-3","title":"Wire conditional development build into execute","blocked_by":["task-2"]},
 {"id":"task-4","title":"Wire canonical allocation and promotion verification","blocked_by":["task-3"]},
 {"id":"task-5","title":"Run burst, concurrency, contamination, and full validation","blocked_by":["task-4"]}
]}
```

| Task | ACs | Validation | Checkpoint |
|---|---|---|---|
| 1 | 1–6 | schema + fake adapter red tests | yes |
| 2 | 1,2,3,5 | identity/allocator unit matrix | yes |
| 3 | 1–3,6 | execute contract fixtures | yes |
| 4 | 3–5 | land/verify release fixtures | yes |
| 5 | 1–6 | concurrent burst + full tier-1 | yes |

## AC-to-Task and AC-to-Test Mapping

| AC | Task | Test type | Proof |
|---|---|---|---|
| AC-483-1 | 1–3 | fake integration | distinct stable ids and coexistence metadata |
| AC-483-2 | 2,5 | concurrency | ten same-minute codes and unique names |
| AC-483-3 | 2–4 | negative | dev receipt rejected for release |
| AC-483-4 | 4,5 | release transaction | exactly-once allocation above floors |
| AC-483-5 | 2,4 | verification | inspected metadata=filename=receipt |
| AC-483-6 | 1,5 | environment/diff | no SDK and no consumer files |

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | N/A | build/release contract only |
| Technical design | satisfied | identity algorithm and adapter schema above |
| Style | satisfied | ESM CLI, JSON Schema, portable shell tests |
| Persona | N/A | framework/mobile release operator |
| Isolation | gated | WI-482 verified worktree and runtime state boundary |
| Consumer proof | deferred by explicit boundary | separate consumer WI, not an AC omission |

## Validation Plan

### Tier-1 promotion note

| Field | Decision |
|---|---|
| validator_path | test-framework/evals/tier-1/validate-mobile-build-identity.sh |
| failure_class | dev/release identity collision and canonical version contamination |
| promotion_signal | build-and-ship-alignment is an active correction rule and release hot path |
| expected_runtime_budget | under 5 seconds with fake adapter and bounded allocation vectors |
| why_tier_2_or_targeted_is_insufficient | deterministic identity/release invariants must block skill-contract drift; SDK/device proof remains downstream |

Validate JSON Schema, Node/Bash syntax, bounded tier-1 identity vectors, a targeted 100-branch collision set and parallel allocator stress, release failure/retry, three skill contract fixtures, no-SDK environment, git diff consumer-file denial, pipeline integrity, and full tier-1.

## Execution Command Sequence

```bash
git fetch origin main
test -z "$(git status --short)"
node scripts/svc-ensure-worktree.mjs --wi WI-483 --branch framework-WI-483-mobile-worktree-builds --from origin/main --print-cd
cd .worktrees/framework-WI-483-mobile-worktree-builds
bash test-framework/evals/tier-1/validate-mobile-build-identity.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh
```

RECOVERY_IF_FAIL: preserve allocation state and fake-adapter transcript, do not lower platform caps or merge dev/release ledgers, repair the smallest failing transaction, rerun concurrent stress, then full tier-1.

## Checkpoint Plan

Commit schema/tests, identity engine, execute integration, and land/verify integration separately. The release checkpoint cannot be created until failure/retry and floor proofs pass.

## Promotion Readiness Checklist

- [ ] WI-482 is VERIFIED.
- [ ] Six ACs map to deterministic tests.
- [ ] Dev and release state are physically and logically separate.
- [ ] Exactly-once release allocation has failure recovery.
- [ ] No SDK or consumer project mutation occurred.
- [ ] No ORM migration applies; JSON contract version is fixture-validated.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 3 | Consumer repositories | future adapter implementation | decoupled-justified | separate reviewed consumer WI and schema validation |
| 7 | App stores | remote release floor, read by consumer adapter | decoupled-justified | max(remote, ledger) allocation and promotion verification |
| 12 | Downstream skill contracts | execute/land/verify mobile phases | coupled | schema + tier-1 contract fixtures |
| 15 | Runtime filesystem | worktree dev code state and allocation locks | coupled | atomic allocator, cleanup, stress tests |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14.

Consumer/store state is intentionally outside this framework changeset. Safety comes from a strict adapter schema, fake proof here, and a separately reviewed consumer changeset that supplies real SDK/device/store evidence; verification refuses to call framework capability live until that evidence exists.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| CREATE targets absent | PASS | engine/schema/reference/test paths absent |
| MODIFY targets exist | PASS | rule and three skill contracts present |
| Dependency | PASS | WI-482 supplies isolated worktree state |
| Environment | PASS | fake adapter avoids Android/iOS SDK |
| Scenario walk | PASS | two branches, burst, release, mismatch map to tasks 1–5 |

No unresolved simulation failure remains. Handoff stops before execute-changeset.
