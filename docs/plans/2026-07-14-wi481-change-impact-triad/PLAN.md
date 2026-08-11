# Program Changeset: Isolation, Concurrency, Assurance, and Codex Execution Integrity

- **Program home:** WI-481
- **Pillars:** WI-481, WI-482, WI-483, WI-484, WI-485
- **Source work items:** `docs/specs/work-items/WI-481.md`, `docs/specs/work-items/WI-482.md`, `docs/specs/work-items/WI-483.md`, `docs/specs/work-items/WI-484.md`, `docs/specs/work-items/WI-485.md`
- **Source proposals:** `proposals/2026-07-14-change-impact-triad-universal-gate.md`, `proposals/2026-07-14-codex-execution-integrity.md`
- **Reviewed leaf manifests:** `docs/plans/2026-07-14-wi485-codex-execution-integrity/manifest.md`, `docs/plans/2026-07-14-wi484-session-worktree-binding/manifest.md`, `docs/plans/2026-07-14-wi482-default-checkout-isolation/manifest.md`, `docs/plans/2026-07-14-wi483-mobile-worktree-builds/manifest.md`, `docs/plans/2026-07-14-wi481-change-impact-triad-leaf/manifest.md`
- **Session evidence:** `proposals/2026-07-14-session-audit-codex-foreign-stop-and-ghost-skill.md`
- **Lane:** framework
- **Archetype:** architectural, cross-cutting host-control change
- **Mode:** inline program controller; each pillar produces a reviewed leaf manifest before implementation
- **Planning branch/worktree:** `wi-481-change-impact-triad` at `/home/svc-user/app-workspaces/svc-wi481-impact-triad`
- **Base:** `origin/main` at `22df12efdfc4d48dacf2acea8588d585ce0094a8`
- **Plan head before this revision:** `77ac0c83dd9548b6368f2feccbcc30079a8cf018`
- **Created:** 2026-07-14
- **Status:** REVIEWED_AND_FROZEN — planning package only; no implementation authorized by this artifact

> This is the complete program-level plan changeset. It locks scope, dependencies, file sets, acceptance criteria, test contracts, external state, rollout, and command sequence. Because five independently landable WIs are involved, implementation code blueprints belong in five leaf manifests. A pillar cannot enter `execute-changeset` until its leaf manifest passes `review-plan`.

## Problem archetype and invariant

The program changes framework control planes, not one product feature. Scope-source every entry point that can create mutation authority, worktree identity, release identity, or completion pressure.

**Invariant:** A framework action may affect only the worktree, WI, task, host, and user intent that explicitly authorized it. Codex may continue work only from the latest session/turn authority and may mutate a skill-governed task only after loading that exact skill. Non-Codex behavior remains unchanged by WI-485.

## Implementation summary

| Pillar | WI | Outcome | Host scope | Dependency |
|---|---|---|---|---|
| P1 | WI-481 | Every mutating lane answers breaks-what, intended-behavior, and product-surface with risk-proportional proof | universal | P5, P4, P2, and P3 verified before execution |
| P2 | WI-482 | All mutations occur in `.worktrees/<branch>`; default checkout remains clean and current | universal | P4 identity model |
| P3 | WI-483 | Mobile worktrees receive collision-free dev identities; canonical release version changes only at land | universal contract, opt-in consumer adapter | P2 |
| P4 | WI-484 | Active mutation sessions bind one session to one WI and one worktree; foreign claims never create pressure | universal | P5 regression fixture informs design |
| P5 | WI-485 | Codex Stop and skill loading use exact session/turn/task authority; other hosts are byte-identical | Codex only | first, urgent |

### Explicit sequencing

1. **P5 first:** stops the live Codex failure without changing other hosts.
2. **P4 second:** generalizes ownership and state isolation without weakening P5's stricter Codex rule.
3. **P2 third:** enforces the physical worktree boundary using P4 identity.
4. **P3 fourth:** builds mobile identity on isolated worktrees.
5. **P1 planning may occur in parallel, but execution waits for WI-485, WI-484, WI-482, and WI-483 verification so its bootstrap and shared-file integrations use the final preceding contracts.**

## Baseline and supersession decisions

| Existing mechanism | Decision |
|---|---|
| `hooks/lib/resolve-wi.mjs` and `hooks/lib/wi-claim.mjs` | Modify; do not create duplicates. WI-351/WI-352 established these abstractions but left foreign/shared fallbacks |
| `hooks/lib/active-intent.mjs` | Preserve as advisory/debug state; it cannot create execution authority |
| `hooks/svc-task-completion-guard.sh` | Preserve shared behavior for non-Codex callers; P4 tightens ownership, P5 wraps Codex before continuation output |
| `hooks/kimi/svc-kimi-skill-load-enforcer.sh` | Leave Kimi behavior unchanged; remove it only from Codex wiring |
| `hooks/svc-skill-artifact-authenticity.mjs` | Leave shared semantics unchanged. For Codex, the new exact-scope skill gate subsumes artifact authenticity and the Codex wirer removes this shared entry |
| `WORKTREES.md` direct-main exception | Supersede. Repository AGENTS requires `.worktrees/`; no sibling `/home/.../repo-wi` scheme |
| Android release mutation guard named in the earlier draft | No mutation guard exists; the content-coupled validator `test-framework/evals/tier-1/validate-build-ship-android-version-gate.sh` does exist and P3 must preserve or update it with the rule |
| Existing active-intent validator | Extend fixtures; do not claim it alone fixes foreign Stop authority |

## Files planned

Paths marked CREATE are intentionally plain text so mechanical path validation does not mistake planned files for missing MODIFY targets.

### P1 — WI-481 Change Impact Triad

| File | Action | Contract |
|---|---|---|
| references/change-impact-triad.md | CREATE | Canonical three-field receipt, evidence rules, risk tiers, escalation |
| schemas/change-impact-triad.schema.json | CREATE | Versioned owned receipt schema |
| scripts/classify-change-risk.mjs | CREATE | Deterministic staged-diff classifier with explain output |
| hooks/svc-impact-triad-guard.mjs | CREATE | Receipt gate; fail-open outside governed mutations |
| test-framework/evals/tier-1/validate-impact-triad.sh | CREATE | Missing/valid receipt, never-fast-lane classes, escalation fixtures |
| hooks/git/pre-commit.d/25-impact-triad | CREATE | Host-independent staged-diff enforcement |
| `quick-fix/SKILL.md` | MODIFY | Required impact preflight and forced escalation |
| `diagnose-bug/SKILL.md` | MODIFY | Declare existing affected-artifact/expected-behavior phases as satisfying the triad |
| `route-workflow/SKILL.md` | MODIFY | Route risk class and require receipt before continuation |
| `execute-changeset/SKILL.md` | MODIFY | Emit/cross-check triad evidence |
| `DOCTRINE.md` | MODIFY | Risk-to-assurance mapping and skip prohibitions |
| `scripts/quick-fix-eligibility.mjs` | MODIFY | Make classifier/receipt authoritative for fast-lane eligibility |
| `scripts/install-git-hooks.mjs` | MODIFY | Install the universal dispatcher slot |
| `scripts/wire-hooks.mjs` | MODIFY | Add early Claude feedback |
| `scripts/wire-codex-hooks.mjs` | MODIFY | Compose early Codex feedback after exact authority |
| `skills-manifest.json` | N/A | No new registered skill or rulesRegistry entry; reference is consumed directly |

### P2 — WI-482 Mandatory worktree isolation

| File | Action | Contract |
|---|---|---|
| hooks/svc-worktree-isolation-guard.mjs | CREATE | Deny repo mutation from the default checkout; read-only and job-temp allowlist |
| scripts/svc-ensure-worktree.mjs | CREATE | Idempotent `.worktrees/<branch>` create/locate/preflight helper |
| references/worktree-isolation.md | CREATE | Single isolation doctrine, override and cleanup lifecycle |
| test-framework/evals/tier-1/validate-default-checkout-isolation.sh | CREATE | Mutating/read-only/default/worktree/job-temp fixtures |
| `scripts/worktree.sh` | MODIFY | Delegate create/preflight and bind absolute worktree path |
| `WORKTREES.md` | MODIFY | Remove direct-main framework-doc exception |
| `route-workflow/SKILL.md` | MODIFY | Ensure worktree before any mutating lane |
| `list-work-items/SKILL.md` | MODIFY | Show WI, branch, worktree, session owner |
| `scripts/wire-codex-hooks.mjs` and other hook-capable host wirers | MODIFY only in P2 leaf scope | Register equivalent isolation policy where host APIs support it |

### P3 — WI-483 Mobile worktree build identity

| File | Action | Contract |
|---|---|---|
| scripts/mobile-build-identity.mjs | CREATE | Stable branch slug/hash, application/bundle suffix, label, epoch-second dev code with persisted monotonic bump |
| schemas/mobile-build-contract.schema.json | CREATE | Project adapter contract for Android/iOS commands and canonical release ledger |
| references/mobile-worktree-builds.md | CREATE | Dev-vs-release identity, side-by-side install, signing/data behavior |
| test-framework/evals/tier-1/validate-mobile-build-identity.sh | CREATE | Same-second, branch collision, cap, release-contamination fixtures |
| `rules/build-and-ship-alignment.md` | MODIFY | Canonical release floor and artifact naming; dev identity cannot satisfy release proof |
| `execute-changeset/SKILL.md` | MODIFY | Conditional mobile worktree build phase when project contract exists |
| `land-changeset/SKILL.md` | MODIFY | Canonical version bump exactly once at land, using project adapter |
| `verify-promotion/SKILL.md` | MODIFY | Verify manifest identity and release floor from built artifact |

Product Gradle/Xcode files are not modified by this framework WI. Each onboarded mobile repo implements the schema in its own separately reviewed changeset.

### P4 — WI-484 Session, worktree, and WI binding

| File | Action | Contract |
|---|---|---|
| schemas/session-worktree-binding.schema.json | CREATE | Versioned binding shape and claim normalization |
| references/session-worktree-wi-binding.md | CREATE | Authority, transfer, TTL, reviewer/research zero-binding rules |
| test-framework/evals/tier-1/validate-session-worktree-binding.sh | CREATE | Two-session/two-worktree/foreign-claim/TTL/counter fixtures |
| `hooks/lib/resolve-wi.mjs` | MODIFY | Ownership-first resolution; shared fallbacks are evidence, never authority |
| `hooks/lib/wi-claim.mjs` | MODIFY | Normalize `session`, `session_id`, and session-shaped `claimed_by` |
| `hooks/lib/active-intent.mjs` | MODIFY | New prompt always suppresses stale `wi-backlog` unless exact explicit resume |
| `hooks/svc-task-completion-guard.sh` | MODIFY | Check binding/claim before status; absolute paths; hard cap; advisory on ambiguity |
| `scripts/worktree.sh` | MODIFY | Initialize worktree-local binding state atomically |
| `test-framework/evals/tier-1/validate-active-intent-guard.sh` | MODIFY | Regress the current foreign Stop incident |

### P5 — WI-485 Codex execution integrity

| File | Action | Contract |
|---|---|---|
| hooks/codex/lib/codex-hook-context.mjs | CREATE | Normalize session, turn, cwd, tool, patch/command, repo/worktree, WI/claim |
| hooks/codex/svc-codex-prompt-authority.mjs | CREATE | Atomic UserPromptSubmit authority record in host runtime state keyed by repo/session |
| hooks/codex/svc-codex-stop-firewall.mjs | CREATE | Single composite Codex Stop command: authorize first, then delegate to shared guard |
| hooks/codex/svc-codex-skill-load-enforcer.mjs | CREATE | Deny governed mutation without exact load receipt |
| scripts/codex-load-skill.mjs | CREATE | Print full SKILL.md, verify task/skill/hash, call existing load-skill, write exact Codex runtime receipt |
| references/codex-hook-execution-integrity.md | CREATE | State machine, limitations, `/hooks` trust and recovery |
| test-framework/evals/tier-1/validate-codex-execution-integrity.sh | CREATE | Payload replay and non-Codex invariance fixtures |
| test-framework/evals/tier-2/codex-execution-integrity/ | CREATE | Controlled `codex exec --json` trace fixture when environment supports it |
| `scripts/wire-codex-hooks.mjs` | MODIFY | Managed replacement: remove stale shared Stop, Kimi enforcer, and shared authenticity entries; add keyed Codex prompt/composite-Stop/exact-skill entries; assert exactly one effective svc Stop entry |
| `references/knowledge/domains/codex-hooks/CAPABILITIES.md` | MODIFY | Correct current enablement/coverage/trust facts |
| `references/knowledge/domains/codex-hooks/details/configuration.md` | MODIFY | Lock current fact: hooks are enabled by default and may be disabled with `[features] hooks=false`; document concurrent/no-order and trust semantics |
| `.gitignore` | N/A | Repo-side claims/counters already match existing ignore rules; Codex authority/load records are extra-repo host runtime state by design |

## Blueprint contracts

This program controller intentionally omits code payloads. Each leaf manifest must supply dispatch-grade before/after or complete CREATE payloads. The following decisions are locked and may not be re-litigated by leaf planners without a `strategic-decision` receipt.

### P1 decision table

| Condition | Minimum assurance |
|---|---|
| Cosmetic, no call sites, no user flow | Three one-line fields plus static proof |
| Logic or one caller/test | Mapped test plus affected-surface list |
| Auth, policy, billing, schema, migration, shared layout, release config | Never quick-fix; independent review plus runtime/behavior proof |
| Intended behavior lacks a named source | Escalate and create/repair the source artifact |

### P2 decision table

| Context | Mutation result |
|---|---|
| Default checkout of default branch | DENY and print exact `.worktrees/` create command |
| Linked worktree | ALLOW if binding and branch agree |
| Read-only command/tool | ALLOW |
| `$CLAUDE_JOB_DIR/tmp`, system temp outside repo | ALLOW |
| Ambiguous write-capable shell command in default checkout | DENY; no command-string optimism |
| Logged emergency override | Time-bounded, reasoned receipt; never used by automated normal lane |

### P3 identity algorithm

- Dev application identity = canonical id + `.wt_` + sanitized branch prefix + short SHA-256 suffix.
- Dev label and artifact name include branch plus UTC compact timestamp.
- Dev version code = current Unix epoch seconds; if not greater than the worktree-local last code, use last + 1.
- Reject values above platform maximum before build.
- Dev variants are debug/adhoc install only and use separate app data.
- Canonical release code comes from the project release ledger/remote track floor, not any dev epoch code.
- Land increments canonical version exactly once and verifies the built manifest; execute never edits canonical version.

### P4 authority order

1. Current host `session_id` plus worktree-local binding.
2. Matching fresh normalized claim.
3. Exact WI/worktree/branch agreement.
4. Explicit current user resume when continuation is requested.
5. Branch, single active graph, and last contract are diagnostics only.

Reviewer/research/read-only sessions may have zero active mutation binding. A mutating session has at most one. Ownership transfer is atomic compare-and-swap after stale proof or explicit owner release.

### P5 Codex rules

- UserPromptSubmit records `session_id`, `turn_id`, prompt hash, absolute repo/worktree, explicit WI, and continuation classification in host runtime state; never raw prompt text or the protected default checkout.
- Stop with missing, stale, ambiguous, mismatched, or foreign authority returns allow. It may print advisory context but may not create a continuation prompt.
- Codex has one composite svc Stop command. It delegates to the shared guard only after authority succeeds, so no ordering between concurrent Stop hooks is assumed.
- The Codex wirer assigns stable managed keys, prunes any installed svc-keyed entry no longer declared, and specifically removes the prior shared Stop, Kimi skill, and shared authenticity entries. Installation fails unless the effective user plus repository config layers contain exactly one svc Stop entry and it is the composite firewall.
- Plain `continue WI-N` does not steal a fresh foreign claim.
- A route binding authorizes only when created by the same session/turn after the prompt record.
- The Codex-only load command prints the complete SKILL.md, validates the declared task skill, preserves the existing task-graph receipt, and writes a runtime receipt binding session, audit turn, absolute task graph, task id, skill name, SKILL.md path, SHA-256, and timestamp.
- Skill authorization persists into later turns of the same session while task graph, task id, worktree, skill name, and SHA remain identical. Re-load is mandatory on task switch, worktree change, session change, or skill hash change; turn id is audit evidence and may not come from a different session.
- Read-only actions remain allowed before skill loading. In-scope mutation fails closed. Non-svc repos fail open.
- Matching hooks may run concurrently; every decision reads one atomic record and never depends on another hook completing first.
- Shared non-Codex hooks and registries must be byte-identical before/after WI-485.

## Task graph

```json
{
  "program": "WI-481",
  "tasks": [
    {"id":"T0","title":"Freeze source, config, wirer, and planning-branch baselines","blocked_by":[],"covers":["PROGRAM-1"],"checkpoint":true},
    {"id":"TPLAN","title":"Land the reviewed docs-only planning bundle and record all five leaf hashes before execution","blocked_by":["T0"],"covers":["PROGRAM-1"],"checkpoint":true},
    {"id":"T5A","title":"Create WI-485 from current origin/main and verify its pinned reviewed leaf","blocked_by":["TPLAN"],"covers":["AC-485-1","AC-485-10"],"checkpoint":true},
    {"id":"T5B","title":"Execute, replay, review, audit, and land WI-485","blocked_by":["T5A"],"covers":["AC-485-1","AC-485-10"],"checkpoint":true},
    {"id":"T4A","title":"After WI-485 verification, create WI-484 from current origin/main and verify its pinned reviewed leaf","blocked_by":["T5B"],"covers":["AC-484-1","AC-484-5"],"checkpoint":true},
    {"id":"T4B","title":"Execute, concurrency-test, review, audit, and land WI-484","blocked_by":["T4A"],"covers":["AC-484-1","AC-484-5"],"checkpoint":true},
    {"id":"T2A","title":"After WI-484 verification, create WI-482 from current origin/main and verify its pinned reviewed leaf","blocked_by":["T4B"],"covers":["AC-482-1","AC-482-5"],"checkpoint":true},
    {"id":"T2B","title":"Execute, cross-host-test, review, audit, and land WI-482","blocked_by":["T2A"],"covers":["AC-482-1","AC-482-5"],"checkpoint":true},
    {"id":"T3A","title":"After WI-482 verification, create WI-483 from current origin/main and verify its pinned reviewed leaf","blocked_by":["T2B"],"covers":["AC-483-1","AC-483-6"],"checkpoint":true},
    {"id":"T3B","title":"Execute identity engine, review, audit, and land WI-483","blocked_by":["T3A"],"covers":["AC-483-1","AC-483-6"],"checkpoint":true},
    {"id":"T1A","title":"Verify the pinned reviewed WI-481 leaf from the landed planning bundle","blocked_by":["TPLAN"],"covers":["AC-481-1","AC-481-6"],"checkpoint":true},
    {"id":"T1B","title":"After WI-485/WI-484/WI-482/WI-483 verification, create WI-481 worktree and execute","blocked_by":["T1A","T5B","T4B","T2B","T3B"],"covers":["AC-481-1","AC-481-6"],"checkpoint":true},
    {"id":"TINT","title":"Run frozen five-pillar integration and non-regression matrix","blocked_by":["T1B","T2B","T3B","T4B","T5B"],"covers":["PROGRAM-2","PROGRAM-3"],"checkpoint":true},
    {"id":"TLAND","title":"Verify all five promotions and close program receipts","blocked_by":["TINT"],"covers":["PROGRAM-4"],"checkpoint":true}
  ]
}
```

Every `T*A` must run `plan-changeset` then `review-plan`. Every `T*B` follows `execute-changeset → review-exec → audit-implementation → land-changeset → verify-promotion`. No program task permits one shared execution worktree.

## Acceptance criteria

The five source work-item files are canonical. The tables below are non-authoritative attention summaries; execution and review read the canonical WI AC text and verify that every canonical AC id is mapped.

### WI-481

| ID | Criterion |
|---|---|
| AC-481-1 | Every mutating lane produces the three impact fields or an explicit subsumption receipt |
| AC-481-2 | Mechanical risk classes cannot use quick-fix |
| AC-481-3 | Non-trivial answers escalate deterministically |
| AC-481-4 | Missing mapped coverage creates a coverage task, not a note |
| AC-481-5 | High-risk changes require independent and runtime/behavior proof |
| AC-481-6 | Receipt enforcement composes with P4/P5 ownership and never accepts a foreign receipt |

### WI-482

| ID | Criterion |
|---|---|
| AC-482-1 | Default checkout mutation is denied for docs, code, tests, generated files, and `.svc` runtime writes |
| AC-482-2 | Worktrees are created only under `.worktrees/` and from a clean current default base |
| AC-482-3 | Read-only and external job-temp actions remain allowed |
| AC-482-4 | Status lists WI, worktree, branch, and owning session |
| AC-482-5 | Create/re-run/cleanup are idempotent and do not repoint installed host symlinks |

### WI-483

| ID | Criterion |
|---|---|
| AC-483-1 | Two branches produce distinct stable app identities and coexist on-device when a project adapter supports it |
| AC-483-2 | Ten builds in one minute receive strictly increasing valid dev codes and unique artifact names |
| AC-483-3 | Dev identities cannot be used as canonical release proof |
| AC-483-4 | Canonical version changes once at land and clears the remote/ledger floor |
| AC-483-5 | Built manifest identity matches artifact filename and receipt |
| AC-483-6 | Framework tests require no Android/iOS SDK and consumer mutation stays in a separate WI |

### WI-484

| ID | Criterion |
|---|---|
| AC-484-1 | A mutating session has at most one WI/worktree binding; read-only roles may have zero |
| AC-484-2 | Foreign fresh claims always downgrade to allow/advisory before status calculation |
| AC-484-3 | Claim schema variants normalize without accepting agent-name-only ownership |
| AC-484-4 | Completion pressure caps at three and uses absolute worktree paths |
| AC-484-5 | Two-session/two-worktree fixtures have zero state or continuation cross-talk |

### WI-485

WI-485 adopts AC-485-1 through AC-485-10 verbatim from `docs/specs/work-items/WI-485.md`. That canonical WI supersedes any wording drift in FP-026's earlier proposal table.

### Program

| ID | Criterion |
|---|---|
| PROGRAM-1 | Each pillar has a unique WI, claim, branch, `.worktrees/` path, leaf manifest, and review log |
| PROGRAM-2 | The five-pillar integration run proves hook composition and receipt ownership |
| PROGRAM-3 | Non-Codex WI-485 registry snapshots and fixture outputs are byte-identical |
| PROGRAM-4 | Final report distinguishes planned, implemented, locally verified, merged, installed/trusted, and runtime-observed states |

## AC-to-task and AC-to-test mapping

| AC range | Task(s) | Automated proof | Runtime/manual proof |
|---|---|---|---|
| AC-481-1..6 | T1A, T1B, TINT | validate-impact-triad + full tier 1 | one low-risk and one forced-escalation replay |
| AC-482-1..5 | T2A, T2B, TINT | validate-default-checkout-isolation + worktree validators | create/re-run/remove one disposable worktree |
| AC-483-1..6 | T3A, T3B, TINT | validate-mobile-build-identity with fake adapters | optional downstream device proof; N/A in framework repo is explicit |
| AC-484-1..5 | T4A, T4B, TINT | validate-session-worktree-binding + active-intent regression | two concurrent controlled host sessions |
| AC-485-1..10 | T5A, T5B, TINT | validate-codex-execution-integrity + registry snapshot diff | controlled Codex allow/deny trace and `/hooks` trust inspection |
| PROGRAM-1..4 | T0, TINT, TLAND | task graphs, receipts, manifest lint, full tier 1 | promotion receipt audit |

## Prerequisite Alignment Matrix

| Prerequisite | Applicability | Trace/decision |
|---|---|---|
| Product spec/persona | N/A | Framework host-control program; affected actor is the builder/orchestrator, not a product persona |
| UX/UI | N/A | No visual UI. Hook messages are operational copy tested by fixtures |
| Technical design | Required | This plan's authority orders, identity algorithms, and external-state lifecycle are the baseline |
| Code/style | Required | Repository AGENTS, portable Bash/Node conventions, atomic `.svc` state, absolute paths |
| Prior WIs | Required | WI-351/WI-352/WI-379/WI-399 mechanisms are modified/superseded, never duplicated |
| Host docs | Required for WI-485 | Official Codex hooks docs re-verified 2026-07-14; re-check before execution |
| Mobile project contract | Conditional | P3 uses fake adapters here; real Gradle/Xcode changes require a downstream project WI |

## Validation plan

1. Run manifest linter and full Tier 1 for every leaf.
2. Run each new focused validator in isolation and from the aggregate runner.
3. Snapshot non-Codex behavior before WI-485 and compare after: `--list-all` for Claude/Kimi; source hash plus dry-run generated-config hash for Gemini/OpenCode; hashes only for installed host configs so no secrets are copied. T5A's leaf manifest must pin literal commands with fixed `--skills-path`/settings arguments, store the before hashes, and replay the identical commands post-land.
4. Replay exact Codex payload fixtures including the foreign WI-479 incident.
5. Run 100 deterministic two-session interleavings for P4/P5 state writes, including same-session later-turn skill reuse.
6. Run shell syntax checks on new Bash and Node syntax checks on new `.mjs` files.
7. Run install drift for Codex after P5; other hosts after universal P1/P2 changes only.
8. Treat configured, trusted, and runtime-observed hooks as separate gates.
9. After every commit, rerun relevant focused Tier 1 plus aggregate Tier 1.

## Execution Command Sequence

The sequence below creates each isolated leaf lazily from the then-current verified `origin/main`. Skill invocation/editing occurs inside each leaf according to its reviewed manifest. Every command is run from the default checkout path shown below.

```bash
cd /workspace/seriousvibecoding
git status --short                                      # expect: exit 0 and empty output
git fetch origin main                                  # expect: exit 0

test -f docs/plans/2026-07-14-wi485-codex-execution-integrity/manifest.md
# PRECONDITION: TPLAN landed the reviewed planning bundle and recorded all leaf hashes.
bash scripts/worktree.sh create framework-WI-485-codex-execution-integrity --from origin/main  # expect: exit 0
# Run WI-485 leaf chain through verify-promotion before continuing.
git fetch origin main                                  # expect: exit 0
bash scripts/worktree.sh create framework-WI-484-session-worktree-binding --from origin/main    # expect: exit 0
# Run WI-484 leaf chain through verify-promotion before continuing.
git fetch origin main                                  # expect: exit 0
bash scripts/worktree.sh create framework-WI-482-default-checkout-isolation --from origin/main  # expect: exit 0
# Run WI-482 leaf chain through verify-promotion before continuing.
git fetch origin main                                  # expect: exit 0
bash scripts/worktree.sh create framework-WI-483-mobile-worktree-builds --from origin/main      # expect: exit 0
# Run WI-483 leaf chain through verify-promotion before continuing.
git fetch origin main                                  # expect: exit 0
bash scripts/worktree.sh create framework-WI-481-change-impact-triad --from origin/main    # expect: exit 0
# Run WI-481 leaf chain through verify-promotion before continuing.

node scripts/lint-skills-manifest.mjs                   # expect: exit 0
bash test-framework/evals/run-all-evals.sh              # expect: exit 0
bash scripts/check-install-drift.sh --host codex --quiet # expect: exit 0, no drift

bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh  # expect: exit 0
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh   # expect: exit 0
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh # expect: exit 0
bash test-framework/evals/tier-1/validate-mobile-build-identity.sh      # expect: exit 0
bash test-framework/evals/tier-1/validate-impact-triad.sh               # expect: exit 0

node scripts/wire-codex-hooks.mjs --skills-path "$HOME/.codex/skills" --dry-run # expect: exit 0 and exactly one effective svc Stop entry
command -v codex >/dev/null && test -f "$HOME/.codex/hooks.json"                  # expect: exit 0 or record explicit runtime-probe N/A receipt
codex exec --json "Run the committed Codex execution-integrity fixture."          # expect golden trace: deny before load, allow after load, Stop allow, zero continuation prompt; skip only when the prior probe recorded environment-N/A
```

**RECOVERY_IF_FAIL (pre-land):** Stop the affected pillar. Preserve its fixture output and review log. Do not continue to dependent pillars. Revert only that pillar's commit in its worktree, restore the pre-install Codex hooks backup if P5 changed host state, rerun the pre-change snapshot, and re-plan the failed leaf. Never repair a pillar from the default checkout.

**RECOVERY_IF_FAIL (TINT/post-land):** Identify the first faulting promotion from the frozen matrix. Revert squash promotion commits on `main` in reverse dependency order (P1, P3, P2, P4, P5, stopping after the faulting pillar) with ordinary `git revert <promotion-sha>` changesets and full receipts. If any hook command hash changes, rerun Codex setup, re-review trust in `/hooks`, and repeat runtime proof. Then rerun aggregate Tier 1 and all non-Codex snapshots. Never use merge-parent flags for squash commits.

## Checkpoint plan

| Checkpoint | Required evidence |
|---|---|
| CP0 | Clean default checkout; frozen source/config/wirer hashes; planning sibling-worktree exception receipt; no execution worktree pre-created |
| CP5 | WI-485 leaf review log, fixture pass, non-Codex snapshot equality, exactly one effective svc Stop across user/repo layers, Codex trust/runtime receipt |
| CP4 | WI-484 concurrency fixture and zero foreign pressure |
| CP2 | WI-482 default-checkout deny/read allow/idempotent cleanup |
| CP3 | WI-483 fake-adapter identity matrix and release-contamination denial |
| CP1 | WI-481 risk/escalation/coverage/receipt matrix |
| CPINT | Frozen full diff/receipt set, aggregate Tier 1, adversarial review, audit |
| CPLAND | Per-WI merge and verify-promotion receipts; no state conflation |

## External State

**Wrapper answer:** This program creates or relies on host hook configuration/trust, sibling git worktrees, worktree-local runtime identity files, installed skill symlinks, and optional downstream mobile project adapters. Their lifecycles are explicit below. No SaaS, database, DNS, auth secret, registry publication, or running service is changed.

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | Installed Codex skill/hook files under `~/.codex/skills` | coupled | `./setup --host codex`, install-drift check, prior-target backup, rollback setup |
| 2 | Host config files | ~/.codex/hooks.json, repository .codex/hooks.json layers, config enable/disable state, command trust hash | coupled | Codex wirer managed-entry prune, effective-layer scan, backup/dry-run/apply, `/hooks` human trust checkpoint, runtime trace |
| 3 | Out-of-tree version-controlled | Five `.worktrees/<branch>` checkouts and branches | coupled | `scripts/worktree.sh` create/status/promote/remove; one WI per worktree |
| 12 | Downstream framework artifacts | Skill contracts, host wirer registries, lane routing, mobile consumer schema | coupled | manifest lint, registry snapshots, downstream adapter schema validation |
| 15 | Runtime filesystem state | Host runtime `svc-codex/<repo-hash>/<session>/` authority/load receipts; worktree-local claims, counters, mobile dev-code ledger | coupled | atomic create/update, prompt-time TTL sweep for Codex state, owner/worktree cleanup for repo state, regenerable paths |
| 13 | CI/CD wires | No CI configuration change; local aggregate runner discovers new tier-1 files by existing mechanism | decoupled-justified | focused validators plus aggregate runner prove discovery; if discovery fails the leaf cannot land |
| ad-hoc | Downstream mobile repos/devices | Optional Gradle/Xcode adapter and installed dev variants | decoupled-justified | framework WI ships schema only; each consumer uses a separate WI with its own rollback/uninstall proof |

Untouched environments after walking the taxonomy: 4 package registries, 5 schedulers, 6 running services, 7 external SaaS, 8 databases, 9 caches, 10 DNS/SSL, 11 search/index, 14 authentication/secrets.

The CI row is intentionally decoupled because this repository has no CI platform; local validators are authoritative. The downstream mobile row is intentionally decoupled because a generic framework changeset cannot safely edit an unknown consumer's release files. Schema validation and a mandatory downstream WI prevent silent drift.

## Pre-implementation simulation report

| Check | Disk result | Planned result | Verdict |
|---|---|---|---|
| Current MODIFY targets | All named shared hooks, skills, worktree script, rule, and knowledge files exist | Leaf plans patch existing symbols | PASS |
| Current CREATE targets | Codex-specific hooks, impact gate, isolation guard, mobile engine, schemas, references, and focused validators do not exist | Created by owning leaf only | PASS |
| Prior isolation abstractions | `resolve-wi.mjs`, `wi-claim.mjs`, active-intent, and two older manifests exist | Modify/supersede; no parallel resolver | PASS |
| Worktree location | Repository guidance requires `.worktrees/`; earlier sibling path conflicted | P2 now locks `.worktrees/<branch>` | PASS |
| Mobile guard target | No Android mutation guard exists; the content-coupled build/ship validator does exist | P3 creates the generic engine and updates or preserves the validator with its rule | PASS |
| Codex skill enforcement | Codex wirer points to Kimi script; Kimi script self-disables outside Kimi | Replaced only in Codex registry | PASS |
| Codex Stop incident | Foreign claim/session and shared WI-479 contract reproduce the authority mismatch | Fixture must allow Stop without continuation | PASS |
| Hook ordering | Official host behavior allows concurrent matching hooks and additive config layers | Managed deregistration plus exactly one effective composite svc Stop; atomic independent PreToolUse records | PASS |
| External trust | Local setup can write config but cannot prove trust | `/hooks` plus runtime trace is a promotion checkpoint | PASS |
| Task dependencies | Every `blocked_by` id exists; P1 execution waits for all four preceding pillars | No circular dependency or shared-file race | PASS |

### Scenario walkthrough

**Given** current Codex session A asks only to find a proposal, WI-479 has actionable tasks, and a fresh claim belongs to Fable session B; **when** session A reaches Stop; **then** T5B's exact incident fixture requires allow/no continuation. T4B independently proves generalized foreign-claim advisory behavior. T2B proves A and B cannot share a mutation checkout. T1B proves a recent receipt from B cannot satisfy A's assurance gate. No step depends on a product UI or a mobile SDK.

## Promotion readiness checklist

| Check | Required state |
|---|---|
| Five leaf specs/manifests/review logs exist | pending execution |
| Mechanical plan verification passes | required before Fable review and after every revision |
| No Critical/High adversarial finding remains unresolved | required |
| Each pillar has its own worktree and claim | required |
| Focused plus aggregate Tier 1 pass after commit | required |
| WI-485 non-Codex snapshots byte-identical | required |
| Codex hooks configured, trusted, and runtime-observed | required on Codex-capable hosts; explicit environment-N/A receipt otherwise, and PROGRAM-4 must report runtime-observed=N/A rather than observed |
| P4 two-session concurrency proof | required |
| P3 real-device proof | N/A for framework repo; mandatory only in downstream mobile WI |
| Schema drift | N/A; no ORM/database schema |
| External-state rollback rehearsed | required for P5 host config and P2 worktree cleanup |
| Implemented/verified/merged/live claims remain distinct | required in final report |
| Legacy planning worktree | This pre-P2 sibling worktree is a one-time inherited exception; TPLAN lands its docs-only planning bundle before T5A, then removes the sibling worktree and never uses it as an execution precedent |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Codex change is isolated | P5 file set and PROGRAM-3 snapshot test | PASS |
| 2 | Conversation failure is an executable fixture | Audit evidence and AC-485-1 | PASS |
| 3 | Skill loading is exact-scope | P5 receipt schema and AC-485-4/5 | PASS |
| 4 | Existing isolation work is reused | Baseline/supersession table | PASS |
| 5 | Repository worktree rule is respected | P2 uses `.worktrees/` only | PASS |
| 6 | Full task/AC/test mapping exists | Task graph and mapping sections | PASS |
| 7 | External state walked all 15 environments | External State section | PASS |
| 8 | Simulation has no unresolved FAIL | Simulation report | PASS |
| 9 | Implementation is not falsely claimed | Header/status and promotion checklist | PASS |
| 10 | Mandatory chain is preserved per pillar | Task graph continuation rule | PASS |
