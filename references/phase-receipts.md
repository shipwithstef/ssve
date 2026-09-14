# Phase Receipts — Canonical Schema

**Status:** Phase D is active. Phase B landed for the canonical five skills,
Phase C migrated the first-party skill corpus under WI-212, and WI-213 flipped
missing required phase receipts from advisory to enforced for current completed
task graphs. Historical pre-enforcement receipts remain compatible.

**Why this document exists:** Skills declare processes in prose ("Step 1", "Step 2"). The framework had no machine-readable contract for "this skill promised to do these phases" or "this run actually executed these phases with this evidence." This document is the **single source of truth** for the schema that closes that gap. No other doc in the repo redefines this schema; they all link here.

**Companion WIs:** WI-197 (V-ladder delegation enforcement) and WI-199 (V0 bundle-grep enforcement) extend the same schema with the `evidence_level` and `target_class` fields documented below.

---

## 1. Two artifacts, one schema

The schema covers two coordinated artifacts:

| Artifact | Location | Phase D behavior |
|----------|----------|------------------|
| **Phase declaration** | `*/SKILL.md` frontmatter `phases:` block | Required for first-party migrated skills |
| **Phase receipt** | `.svc/lane-tasks-<WI>.json` task entry's `skill_receipt` | Required for current completed tasks when a phase has `required_for_completion: true`; historical pre-enforcement receipts remain compatible |

The contract: when a skill declares phases with `required_for_completion: true`,
current completed task receipts MUST carry matching `phases_executed[]` entries.

---

## 2. Phase declaration in skill frontmatter

```yaml
---
name: diagnose-bug
description: ...
phases:
  - id: P1-PreFlight
    trigger: always
    reads: [".svc/lane-tasks-<WI>.json", "FRAMEWORK-STATE.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-BugDomainClassification
    trigger: always
    reads: ["spec", "WI text"]
    writes: ["docs/specs/work-items/WI-<n>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-RootCause
    trigger: mode:diagnose
    reads: ["code", "logs", "spec"]
    writes: ["docs/specs/work-items/WI-<n>-root-cause.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-PillarRevisit
    trigger: after:P3-RootCause
    reads: ["pillar audit checklist"]
    writes: ["pillar revisit notes section in WI"]
    evidence_kind: file
    required_for_completion: false
---
```

### Field reference

| Field | Type | Allowed values |
|-------|------|----------------|
| `id` | string | Must match `/^P[0-9]+(\.[0-9]+)?-[A-Za-z][A-Za-z0-9-]*$/`. The `Px-Name` form encodes ordering and intent. |
| `trigger` | string | `always` \| `mode:<X>` \| `flag:<Y>` \| `after:<phase-id>` |
| `reads` | array of string | Files, glob patterns, or symbolic source names ("code", "logs"). Documentation only — the runtime does not enforce reads. |
| `writes` | array of string | Output paths or path patterns. Documentation only — used by reviewers and tier-2 fixtures. |
| `evidence_kind` | string | `file` \| `command_output` \| `screenshot` \| `live_dom` \| `none` |
| `required_for_completion` | boolean | If `true`, the Stop hook blocks `completed` transitions on missing matching receipts. Default `false`. |

### Trigger semantics

- `always` — phase runs on every invocation.
- `mode:<X>` — phase runs only when the skill is invoked in mode `<X>` (e.g., `mode:diagnose` for diagnose-bug, `mode:retroactive`).
- `flag:<Y>` — phase runs only when flag `<Y>` is set (e.g., `flag:--progressive`).
- `after:<phase-id>` — phase runs only if the named earlier phase completed successfully. Used for downstream phases like pillar audits.

A phase can carry multiple triggers AND-joined by listing them in an array, but Phase A keeps the schema simple and accepts only single triggers.

---

## 3. Phase receipt in `.svc/lane-tasks-<WI>.json`

Existing required `skill_receipt` fields (per `scripts/task-graph.mjs:106-138`):

```json
{
  "skill_receipt": {
    "skill": "diagnose-bug",
    "loaded_at": "2026-05-10T09:00:00Z",
    "loaded_via": "skill_tool"
  }
}
```

Use `task-graph.mjs record-phase` after the skill is loaded and before the task
is completed:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PreFlight --evidence command_output:.svc/preflight-WI.log
```

Phase receipts support three extension fields. Shape-only legacy findings remain
advisory, but missing `required_for_completion: true` phases fail current
completed task graphs:

```json
{
  "skill_receipt": {
    "skill": "diagnose-bug",
    "loaded_at": "2026-05-10T09:00:00Z",
    "loaded_via": "skill_tool",

    "phases_executed": [
      {
        "id": "P1-PreFlight",
        "ts": "2026-05-10T09:01:00Z",
        "evidence_artifacts": [
          { "type": "command_output", "path": ".svc/preflight-WI-191.log" }
        ]
      },
      {
        "id": "P3-RootCause",
        "ts": "2026-05-10T09:15:00Z",
        "evidence_artifacts": [
          { "type": "file", "path": "docs/specs/work-items/WI-191-root-cause.md" }
        ]
      }
    ],

    "evidence_level": "V2",
    "target_class": "browser-visible"
  }
}
```

### Field reference

| Field | Type | Allowed values |
|-------|------|----------------|
| `phases_executed` | array of object | Each entry: `{ id, ts, evidence_artifacts }` |
| `phases_executed[].id` | string | Must match a declared required phase `id` in the skill's frontmatter for current completed task graphs. |
| `phases_executed[].ts` | string | ISO 8601 timestamp. |
| `phases_executed[].evidence_artifacts` | array of object | Each entry: `{ type, path }` |
| `phases_executed[].evidence_artifacts[].type` | string | `file` \| `command_output` \| `screenshot` \| `live_dom` |
| `phases_executed[].evidence_artifacts[].path` | string | A contained repo-relative path, or an absolute path below the operating-system temporary directory for `file` and `command_output` evidence. |
| `evidence_level` | string | `V0` \| `V1` \| `V2` \| `V3`. Shared with WI-197/WI-199. |
| `target_class` | string | `browser-visible` \| `api` \| `data-only` \| `infra`. Shared with WI-197/WI-199. |

### evidence_level ↔ target_class table (shared with WI-197/WI-199)

| target_class \ evidence_level | V0 (bundle-grep) | V1 (live DOM) | V2 (screenshot or playwright run) | V3 (multi-sample run) |
|---|---|---|---|---|
| `browser-visible` | INSUFFICIENT (Phase D will block) | OK | OK | OK |
| `api` | OK | OK | OK | OK |
| `data-only` | OK | OK | OK | OK |
| `infra` | OK | N/A | N/A | N/A |

The "INSUFFICIENT" cell is the WI-199 hard-block; WI-213 is specifically the
required-phase receipt gate.

---

## 4. Completed-task integrity classifications

`scripts/lib/completed-task-integrity.mjs` is the canonical interpreter used by
the skip registry, lane-task integrity, and focused phase-receipt validators.
Every current completed task must resolve to exactly one passing classification:

| Classification | Required authority and evidence |
|----------------|---------------------------------|
| `executed` | A skill-matched receipt with valid load metadata; `phases_executed` is non-empty; every row has a canonical phase ID, a valid timestamp, and at least one structurally resolvable evidence reference. Required-phase completeness and current declaration matching remain owned by the Phase-D receipt-shape validator. |
| `authorized-skip` | All `executed` receipt requirements, plus a non-empty string task skip reason, exactly one matching `delivery_graph.skipped_skills` entry, normalized task/delivery reason equality, and a skill-bound, applicable condition in `references/skip-conditions.json` with non-empty delivery evidence. |
| `legacy-compatible` | A phase-free but otherwise valid receipt whose introducing commit is an ancestor of the fixed pre-enforcement anchor `060e3278afb26117034c4ed529a0e03da3869c32`, and whose task ID, completed state, canonical skill, and receipt exactly match the graph snapshot at that anchor. |
| `invalid` | Any state that does not satisfy one of the three passing classifications. |

The classifier fails closed. A `phases_executed` key is not sufficient by
itself. Missing or malformed receipts, malformed phase IDs or timestamps, empty
evidence arrays, unsafe paths, missing delivery authorization, unregistered or
inapplicable skip conditions, and prose-only skip claims are invalid.

Evidence resolution at this layer proves that a reference is non-empty,
typed, and safely addressable. Repo-relative references must remain contained
after normalization; URI-like schemes, drive-prefixed forms, control
characters, and repository escapes are rejected. Absolute references are
accepted only below the current operating-system temporary directory or the
stable POSIX temporary roots `/tmp` and `/var/tmp`, and only for `file` or
`command_output` evidence. Stable POSIX roots remain recognizable when a later
replay uses a different `TMPDIR`. Temporary command output is intentionally
ephemeral: this validator proves receipt well-formedness, not retained-byte
integrity. Higher assurance levels remain responsible for proving the
referenced result.

A leading scheme-shaped or drive-shaped colon token is rejected intentionally,
including otherwise legal POSIX top-level names such as `note:1.log`. Evidence
references are a portable framework contract and must remain unambiguous on
Windows and POSIX; use a directory separator or hyphenated filename instead.

Legacy compatibility is narrow and immutable. It comes from reachability to the
fixed repository commit immediately before Phase-D enforcement
(`060e3278afb26117034c4ed529a0e03da3869c32`), never from editable `created`
fields, forgeable author/committer timestamps, prose markers, allowlists, or
untracked copies. A graph whose introducing commit is not an ancestor of that
anchor must satisfy the current structured contract even if its JSON or Git
timestamp claims an older date. Library callers cannot inject eligibility,
alter the anchor, or alter the cutoff; graph-level compatibility additionally
requires the classified graph value to match the exact graph file used for Git
history. A task added to an older graph, or a historical task whose receipt
changed after enforcement, does not inherit the path's age.

The corresponding Phase-D timestamp remains `2026-05-10T16:00:00Z` for parity
with receipt-shape validation; the fixed anchor, not a forgeable commit date,
is the legacy authorization boundary. Authority reads disable Git replacement
objects, discard repository/object/index/namespace overrides, discard injected
Git config variables, and suppress system/global Git config so local
replacement refs or configuration cannot redefine the anchor.

The two pre-existing shell consumers invoke the canonical classifier with
`--structured-or-skip-only`. This is a scope selector, never compatibility
authority: it selects completed registered-skill tasks that expose structured
phase or skip state, or malformed common receipt state. A valid phase-free
loaded receipt with no skip intent remains outside those consumers' historical
scope only when it also retains a non-empty legacy `output_artifact` or
`validation_output` summary. A phase-free receipt without that summary is
selected and must independently prove Git pre-enforcement authority. A direct
classifier request always rejects phase-free current history unless Git proves
that authority. Explicit requests that the selector excludes fail usage
validation rather than reporting a misleading zero-check pass.

Whole-graph scoped scans may legitimately report `checked: 0` when every
completed registered-skill task is a valid phase-free shape outside that
consumer's preserved historical scope. The CLI prints the checked count so this
is diagnosable. This does not authorize or classify a task; explicitly
requesting any excluded task remains a usage failure.

---

## 5. Validator behavior matrix (Phase A → Phase D)

| Mode | Validator finds | Validator exits | Phase A | Phase B-C | Phase D |
|------|-----------------|-----------------|---------|-----------|---------|
| Receipt has no extension fields | OK (legitimate today) | 0 | OK | OK for unmigrated skills | FAIL for migrated skills (declared phases but no receipt) |
| Receipt has `phases_executed` but malformed (e.g., string instead of array) | ADVISORY | 0 | ADVISORY | ADVISORY | FAIL |
| Receipt has `evidence_level` outside `V0-V3` | ADVISORY | 0 | ADVISORY | ADVISORY | FAIL |
| Receipt has `target_class` outside the 4 allowed | ADVISORY | 0 | ADVISORY | ADVISORY | FAIL |
| Receipt declares `evidence_level: V0` AND `target_class: browser-visible` | Stop-hook block for closeout text; receipt validator advisory until Phase D | 0 | Stop hook blocks V0 closeout claims | Stop hook blocks V0 closeout claims | FAIL (WI-199 receipt enforcement) |
| Skill declares `phases:` with `required_for_completion: true` and the matching `phases_executed` entry is absent | ADVISORY | 0 | ADVISORY | FAIL for that skill | FAIL globally |

---

## 6. Phase A → Phase D migration map

| Phase | Scope | Validator behavior | Stop hook | Skills migrated |
|-------|-------|--------------------|-----------|-----------------|
| **A** | Schema doc + advisory tier-1 validator + fixtures | Exit 0 always | Untouched | None |
| **B** | Canonical 5: `diagnose-bug`, `test-journeys`, `write-journeys`, `verify-promotion`, `execute-changeset` declare `phases:` + emit receipts | FAIL only on the migrated 5 for new Phase B-era task graphs if their receipts are absent | Untouched | 5 |
| **C** | Rolling backlog: one child WI per remaining skill | Per-skill | Untouched | Complete for `includedSkills`; `write-vision`, `analyze-domain`, `analyze-competitors`, `refresh-competitors`, `catalog-domain-capabilities`, `build-personas`, `validate-feature`, `capture-idea`, `audit-ac`, `sync-spec-code`, `define-code-style`, `write-e2e`, `analyze-marketing`, `route-workflow`, `onboard-repo`, `sync-work-items`, `list-work-items`, `discover-skills`, `svc-advisor`, `research`, `discuss-phase`, `ingest-guide`, `ingest-guide-batch`, `capability-registry`, `capability-concierge`, `honest-diagnosis`, `write-spec`, `design-ux`, `design-ui`, `design-logo`, `design-tech`, `explore-solutions`, `explore-ux`, `plan-changeset`, `review-gate`, `audit-implementation`, `land-changeset`, `extract-bootstrap`, `review-cross-model`, `review-plan`, `benchmark-landing`, `track-visuals`, `review-security`, `manage-learnings`, `test-framework`, `audit-session-execution`, `evolve-framework`, `blend-external`, `blend-private`, `wsl2-audio`, `mine-builder`, `find-opportunity`, `stage-revenue`, `create-skill`, `quick-fix`, `improve-framework`, `teach-project`, `plan-capabilities`, `reverse-engineer`, `audit-coverage`, `platform-operating-architect`, `base44-environment`, `roadmap-evaluation`, `monetization-architecture`, `assess-market-readiness`, `evaluate-rule`, `manage-finops`, `strategic-decision`, `launch-knowledge`, `generate-visuals`, `landing-page`, `recall-stack-knowledge`, `plan-blast-radius`, and `track-topology-diff` migrated |
| **D** (current) | Gate flip + Stop hook enforcement | FAIL globally on missing required-phase entries for current completed graphs | Reads receipts; blocks Stop on missing required entries | All first-party migrated skills |

Phase A → Phase B requires the decision "we're ready to migrate the canonical 5." Phase B → C is mechanical. Phase C → D is the gate flip.

---

## 7. Why the schema looks like this

A few questions that come up when reading the schema:

- **Why `evidence_level` and `target_class` here, not just on WI-197/WI-199?** They're used by both individual phases (each phase has its own evidence type) and the overall task receipt (the rolled-up evidence claim). Putting them at receipt-level lets WI-197/WI-199 enforce without needing per-phase evidence_level. Putting them in this doc keeps one schema.
- **Why allow a historical receipt with NO extension fields?** Because older
  task graphs were created before Phase D. Forcing retroactive receipt churn
  would corrupt audit history without improving current enforcement.
- **Why no per-phase `evidence_level`?** Because evidence_level is about the whole task's verification claim, not the cost of a specific phase. A pre-flight phase that emits a `command_output` artifact still contributes to a V2 task overall — the V2 claim is at the receipt level.
- **What changed in Phase D?** Missing required phase receipts now fail current
  completed task graphs and block Stop. Shape-only legacy warnings still remain
  advisory until a separate WI turns those into hard schema failures.

---

## 8. References

- WI-191 — phase contract spec + migration plan
- WI-197 — V-ladder delegation enforcement (shares `evidence_level` field)
- WI-199 — V0 bundle-grep enforcement (shares `evidence_level` + `target_class` fields)
- `proposals/done/2026-04-23-evolution-phase-contracts-and-execution-trace-validation.md` — original gap analysis (enforcement layer rejected, gap kept open)
- `proposals/done/2026-04-30-journey-execution-trace-validation.md` — journey-skill subset of the same primitive
- `route-workflow/references/task-graph-protocol.md` — base `skill_receipt` schema (this doc extends it)
- `scripts/task-graph.mjs:106-138` — current required-field validator (extension fields are accepted as additional properties)
- `scripts/lib/completed-task-integrity.mjs` — canonical completed-task and authorized-skip classifier
- `scripts/validate-completed-task-integrity.mjs` — CLI adapter consumed by Tier-1 validators
- `test-framework/evals/tier-1/validate-skill-receipt-shape.sh` — Phase D validator for required phase receipts
- `test-framework/evals/tier-1/validate-stop-hook-phase-enforcement.sh` — Stop-hook enforcement proof
