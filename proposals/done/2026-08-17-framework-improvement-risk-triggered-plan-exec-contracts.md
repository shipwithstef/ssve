# Framework improvement: risk-triggered plan/exec mechanical contracts

**Status:** ACCEPTED → WI-553 (planning umbrella WI-548)
**Date:** 2026-08-17
**Source:** WI-542 / WI-543 G5 review on `bugfix-wi-542-grok-sessionstart-healthcheck`
**Severity:** high
**Category:** missing capability
**Plan-changeset class:** hot-path (validators + skill skip/completion contracts)

## Gap

The framework already has generic guards for planning, external state, concurrency, receipts, and review. They do not fire from the **change class**. A bugfix can skip `design-tech` because it has no product UI, then pass mechanical `review-plan` while the plan itself specifies a racy check-then-write, a backup that the second rewire overwrites, and a “keep user hooks” contract with only a simple command fixture. `execute-changeset` can also be marked complete without the required chain receipts.

This is one gap: **risk signals must dynamically require extra plan/exec contracts, and those contracts must be mechanically checked**. Do not add always-on prose to every plan.

Do not expand WI-542 to implement this. WI-542 remediates the Grok healthcheck/wirer defects. This proposal is the framework follow-up.

## Evidence

- **Source:** G5 review of WI-542/WI-543 executed changeset, 2026-08-17.
- **Finding:** Existing guards exist and still failed to block the plan/exec defects below.

| Existing guard | What it already covers | Why it did not catch WI-542 |
|---|---|---|
| Lane compiler risk flag `concurrency` inserts `design-tech` (`skills/route-workflow/references/lane-model.md:126`) | Feature/framework graphs that declare the flag | Bugfix lane default skills omit `design-tech` (`skills-manifest.json` bugfix lane). WI-542 skipped it with “no product UI / data model” and never set `concurrency` / `external-integration`. Skip is not mechanically validated against those flags. |
| `plan-changeset` External State + rollback section | Coupled host configs must name backup/restore wiring | Section existed (`config.toml.wi543.bak`) but did not require an **immutable baseline** distinct from a **per-attempt rollback** copy. |
| `plan-contract.json` + `scripts/validate-plan-contract.mjs` | Money/ledger/identity/notification writers, overlapping ownership, unbounded absence claims | Triggered for product-sensitive / parallel **ownership**, not host-runtime parallel **execution**, config-schema migration, or lossless RMW. `RISKY_RESOURCES` has no `runtime_lock`, `config_migration`, or `external_file` class. |
| `review-plan` mechanical + failure/release lenses | External-state section populated; deploy-class dependency; one adversarial review | Mechanical pass does not reject check-then-write under declared parallel execution, or “preserve user entries” without fixtures for every documented entry type. |
| `execute-changeset` chain receipts (`exec-record`) and old/new-path evidence | Required by skill contract | Task graph completion only requires `skill_receipt` (`scripts/task-graph.mjs`). WI-542 execute was marked complete with no `plan-manifest` / `review-plan` / `exec-record` notes. `check-chain-receipts --range origin/main..HEAD` failed after execute. |

Concrete WI-542 manifestations (proof the missing trigger is costly, not the scope of this WI):

1. Plan prescribed exists-then-write session stamp; Grok `hook_quirks.parallel_execution` is true. Both SessionStart copies can run the full path.
2. Plan required a fixed backup name **and** a second live rewire. Live `~/.grok/config.toml` and `config.toml.wi543.bak` hashed identical after the second write.
3. “Keep user hooks” filtered on `command` and a simple `echo` fixture. Grok documents HTTP hooks (`type = "http"`) and command `env` metadata.
4. Receipts and structured old/new-path evidence were already required in skill prose and were still omitted.

## Diagnosis

- **Root cause:** Risk detection and extra contracts are documented in several places but not compiled into a fail-closed trigger. Skip reasons, plan-contract resource classes, mechanical plan checks, and execute completion are independent. A change can be concurrent, mutating live host state, and lossless-RMW without matching any of those gates.
- **Category:** missing capability (conditional mechanical contracts), not a new always-on review stage.
- **Already in FRAMEWORK-STATE.md?** no.

## Design constraint

Unaffected tasks must pay **zero extra model review**. Detection is cheap (declared risk flags, file/path class, manifest mutation of host config / lock / parser). Only matched signals load extra `plan-contract.json` fields and extra mechanical checks. Do not append long generic checklists to every SKILL.md.

## Acceptance criteria

- **AC-01 — Risk flags are generic and dynamic.** `diagnose-bug`, `route-workflow`, and `plan-changeset` share a small flag set, applied only when the change matches:
  - `runtime_concurrency` — shared-state / parallel invoke / stamp / lock
  - `external_state_writer` — mutates host config, install state, or other out-of-repo files
  - `config_schema_migration` — changes parse/emit shape of a live config
  - `lossless_rmw` — rewrite that must preserve unknown/user entries
  - `idempotent_rewriter` — tool may run more than once against the same file
  - `cross_runtime_integration` — already covered by old/new-path evidence; keep that trigger, do not duplicate the protocol
- **AC-02 — `design-tech` skip is fail-closed on those flags.** A skip_reason of “no product UI / no data model / framework chrome” is invalid when any flag in AC-01 is set (or is implied by the planned files: host wirer, hook that coordinates parallel events, config parser/serializer). `validate-task-graph-lane.mjs` or a sibling checker rejects the skip.
- **AC-03 — `plan-contract.json` grows only the matched sections.** New optional objects, required iff the corresponding flag is set:
  - concurrency: atomic primitive, owner/key, concurrent-invoke behavior, stale-lock cleanup, concurrency test
  - external writer: immutable baseline backup, per-attempt rollback copy, read-failure policy, file-mode preservation
  - lossless RMW: documented entry types that must round-trip, plus one fixture per type
  - idempotent rewriter: proof that attempt N cannot overwrite the immutable baseline
  Unmatched plans still skip `plan-contract.json` unless today’s money/ownership/deletion triggers apply.
- **AC-04 — Mechanical plan validation rejects the WI-542 shapes when those flags are set:**
  - check-then-write / exists-then-create under `runtime_concurrency`
  - one backup path serving as both immutable baseline and rolling rollback under `idempotent_rewriter` or `external_state_writer`
  - “preserve user/unknown entries” without named fixtures covering every documented entry type under `lossless_rmw`
- **AC-05 — Execute completion is gated on receipts.** `execute-changeset` cannot be `completed` unless `plan-manifest`, `review-plan`, and `exec-record` are present and schema-valid for the current tree (staging allowed pre-commit). This is process enforcement, not a new review.
- **AC-06 — Efficiency bound.** A docs-only or parser-only bugfix with none of the AC-01 flags does not require `design-tech`, does not require the new plan-contract sections, and does not run the new mechanical checks. Add a negative fixture that proves the extra path is skipped.
- **AC-07 — Replay.** A synthetic plan that copies the WI-542 stamp + single-backup + simple-user-hook pattern fails mechanical review. After the framework fix, the same plan with atomic claim, split backups, and lossless fixtures passes those mechanical checks.

## Likely files

- `skills/diagnose-bug/SKILL.md` — emit the flags from diagnosis
- `skills/route-workflow/references/lane-model.md` — map flags → `design-tech` insert / skip denial
- `skills/plan-changeset/SKILL.md` and `references` for plan-contract
- `scripts/validate-plan-contract.mjs`
- `scripts/verify-plan-mechanical.sh`
- `scripts/validate-task-graph-lane.mjs` and/or `scripts/task-graph.mjs` completion gate
- focused Tier-1 fixtures (positive WI-542-shaped fail; negative no-flag skip)

No host wirer and no SessionStart healthcheck changes in this WI.

## Route

**Lane:** framework
**Sequence:** `write-spec` → `design-tech` → `plan-changeset` → `review-plan` → `execute-changeset` → `review-gate` → `review-exec` → `audit-implementation` → `land-changeset` → `verify-promotion`

Not a quick-fix: it changes skip semantics, plan-contract schema, and completion gating.

## Rollback

Revert the flag table, skip checker, plan-contract extensions, mechanical checks, and completion gate together. Do not weaken today’s money/ownership plan-contract or chain-receipt pre-push gate as rollback.

## FRAMEWORK-STATE.md Mutations

Pending implementation. After land: add Analysis History entry; add Known Gaps → Fixed for “risk-triggered plan/exec contracts”; no capability count change unless a new validator script is advertised in CAPABILITIES.md.
