---
status: BASELINED
type: Enabler
mode: contract-change
wi: WI-FW-CROSS-REPO-ORCH-02
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework origin-orchestration contract with no customer-facing market flow
created: 2026-09-18
depends_on: WI-FW-CROSS-REPO-ORCH-01
---

# Feature: Origin orchestrator auto-bind (no user CLI)

**Status:** BASELINED
**Work item:** WI-FW-CROSS-REPO-ORCH-02
**Lane:** framework
**Parent:** WI-FW-CROSS-REPO-ORCH-01 (merged #66, `483e26b`)

## Problem Statement

#66 shipped a CLI. The owner UX is: open Cursor or Grok in any folder, name a
WI or an onboarded project (`hourshub`, `ssve`, any other svc-onboarded
repo, or `WI-X`), and the session binds then schedules PLAN (grok-4.6
effort xhigh) → Fable → EXEC (grok-4.6 effort high) in that project's
linked worktree. The user never runs a command. Isolation still denies
mixed-repo Writes. Default checkout stays refused. Local `./setup` from an
unreviewed tree is not promotion.

Today the origin agent is still told to run `svc-orchestrate` itself. Sitting
in project A and naming a WI or project B does not auto-bind. HoursHub is
the 2026-09-18 regression example, not the exclusive target.

## Delta contract

**Preserved from #66:** same-owner migrate identity; foreign/ambiguous owners
fail closed; default checkout refused; mixed-repo Write denied; Fable REVIEW
uses the existing launcher; paste is not the success path; agy is not required;
`validate-cross-repo-orch-01.mjs` still passes.

**Changed:** prompt-time / session-start origin bind extracts a WI or a
discovered onboarded project id, resolves a linked worktree under
`~/worktrees/<id>/` and `~/app-workspaces/<id>-worktrees/` (plus optional
`~/.svc/project-aliases.json`), injects orchestrator context, migrates
same-owner when identity exists, and the origin dispatches children with
`--cwd` that worktree and locked efforts. User-facing text never includes a
CLI to run. Project ids are discovered from those roots, not a hardcoded
HoursHub/SSVE pair.

**Non-goals:** spawning PLAN/EXEC from the hook itself; enabling Cursor
`fresh_session_launch`; weakening isolation; treating local `./setup` as land;
scanning every directory under `~/app-workspaces` on every prompt; a
hardcoded two-project alias table.

### Onboarded project

A linked worktree is onboarded when it has at least one of: `docs/specs/work-items/WI-*.md`,
`.svc/lane-tasks-*.json`, `docs/specs/project-state.md`, or `AGENTS.md` plus
(`.svc/` or `skills-manifest.json`). Project ids are the first-level names
under `~/worktrees/<id>/` and `~/app-workspaces/<id>-worktrees/`, plus optional
`~/.svc/project-aliases.json`. Tests override those roots with
`SVC_WORKTREES_ROOT` and `SVC_APP_WORKSPACES_ROOT`.

## Consumer Stories

| ID | Consumer | Story |
|---|---|---|
| S1 | Owner | I open Cursor or Grok in any folder, name a WI or any onboarded svc project, and work starts in that project's linked worktree. I am never told to run a command. |
| S2 | Origin session (Cursor / Grok) | SessionStart / UserPromptSubmit / beforeSubmitPrompt injects the bind. I stay origin. I dispatch children; I do not paste. |
| S3 | Grok PLAN child | I launch in the target worktree as grok-4.6 `--effort xhigh`. |
| S4 | Grok EXEC child | I launch in the target worktree as grok-4.6 `--effort high`. |
| S5 | Fable REVIEW | I still receive plan/exec through the existing external-review launcher. |
| S6 | Isolation guard | Installed skills-path `svc-orchestrate` from a foreign cwd is allowed. A Write to the other repo is still denied. A lookalike script in the foreign repo is still denied. |

## Acceptance Criteria

| ID | Criterion | Type |
|---|---|---|
| AC-BIND-1 | A prompt that names a valid WI binds to a linked worktree that contains `.svc/lane-tasks-<WI>.json` or `docs/specs/work-items/<WI>.md`. If cwd is already that linked worktree, cwd wins. | happy |
| AC-BIND-2 | A prompt whose subject is a discovered onboarded project id resolves the newest onboarded linked worktree under `~/worktrees/<id>/` or `~/app-workspaces/<id>-worktrees/` (optional extra roots from `~/.svc/project-aliases.json`). Discovery is those directory names, not a hardcoded HoursHub/SSVE list. Default checkouts are never selected. Project-only prompts do not pick a WI by lane-tasks mtime and do not call migrateSession. They inject candidate WIs from that worktree's `.svc/lane-tasks-*.json` files and `docs/specs/work-items/WI-*.md`. migrateSession runs only when the prompt names a WI (AC-BIND-1) or exactly one `.svc/lane-tasks-*.json` in that worktree has top-level `status: "in_progress"`. | happy |
| AC-BIND-3 | User-visible hook/skill output does not match USER_CLI_HOMEWORK_RE (please-run-node, run-this-command, copy-paste-migrate, or a shell-prompt line). Agent-internal additional_context may name the migrate/dispatch argv the origin executes, including dispatch PLAN grok-4.6 --effort xhigh. | happy |
| AC-BIND-4 | The bind hook never blocks the prompt (exit 0, fail-open). Cursor uses `additional_context` on beforeSubmitPrompt. Claude/Grok/Kimi use UserPromptSubmit additionalContext. | happy |
| AC-BIND-5 | Re-submitting the same session + WI + worktree does not append another session-contract row. After `resolveNamedWork`, `migrateSession` takes a `mkdir_exclusive` lock at `<target>/.svc/orchestration/.migrate-<session_id>.lock`. If `bindingFile(worktree, sessionId)` has `binding.wi === target.wi`, `path.resolve(binding.worktree_root) === target.worktree`, and `!binding.released_at`, it loads `.svc/orchestration/<wi>.migrate.json` and returns that baton with `skipped_contract_append: true` without `retireSameSessionBinding`, `writeTargetBinding`, or `appendSessionContract`. If the binding matches and the receipt is missing, it reconstructs the baton from the binding, writes the receipt, and still does not append a contract row. Two concurrent `migrateSession` calls for the same tuple produce exactly one contract line. | happy |
| AC-BIND-6 | After a successful bind, origin context says next is dispatch PLAN grok-4.6 xhigh, then Fable, then EXEC grok-4.6 high, all `--cwd` the bound worktree. The hook does not spawn those children. | happy |
| AC-BIND-1E | Foreign or ambiguous session identity is denied. No binding or contract bytes are rewritten. Context says stay put. | error |
| AC-BIND-2E | Named target that canonicalizes to a repository default checkout (`.git` is a directory) is refused. Context says stay put. | error |
| AC-BIND-3E | No linked worktree for the named WI/project: no migrate, inject no-target, never tell the user to cd or run CLI. | error |
| AC-DISPATCH-1 | `dispatch --role PLAN` argv is `grok --cwd <target> --model grok-4.6 --effort xhigh` plus existing `--prompt-file` flags. | happy |
| AC-DISPATCH-2 | `dispatch --role EXEC` argv is `grok --cwd <target> --model grok-4.6 --effort high` plus existing `--prompt-file` flags. | happy |
| AC-DISPATCH-3 | `dispatch --role REVIEW` remains the Fable/cursor external-review launcher with no `--model` / `--profile`. | happy |
| AC-ISO-1 | Isolation allows `node <skillsHome>/.cursor/skills/scripts/svc-orchestrate.mjs` and the `.grok` / `.claude` siblings from a foreign linked worktree when `realpath(script)` equals the installed SSVE orchestrate script. `skillsHome` is `SVC_SKILLS_HOME` or `HOME` or `os.homedir()` so tests override without the live home. A lookalike `cwd/scripts/svc-orchestrate.mjs` is not classified `origin-orchestrate`. | happy |
| AC-ISO-2 | A Write/Edit to a path in another repository from the origin cwd is still denied. | edge |
| AC-ISO-3 | `node scripts/svc-orchestrate.mjs` whose realpath is a lookalike inside the foreign repo is not classified `origin-orchestrate`. | edge |
| AC-HOT-1 | Resolve is regex-first. extractWiId runs before any directory walk. subjectProject applies PROJECT_SUBJECT_RE to the first line (a single token, or work-on/open/go-to/take/continue plus a token) and returns null before discoverProjects. Full directory scan runs only after a WI or project-subject match. Scan is limited to the declared project roots (not all of ~/app-workspaces; a directory under ~/app-workspaces without the -worktrees suffix is not a project root). discoverProjects is cached per process. Walks abort after 150ms (performance.now, overridable via SVC_DISCOVER_BUDGET_MS) and return null/empty (fail-open). Throw is fail-open in the hook. | edge |
| AC-CAT-1 | `hooks/svc-origin-orchestrator-prompt.mjs` is registered in `references/host-hook-catalog.json`. Claude/Grok/Kimi wirers emit it. Kimi honors `SVC_DISABLED_HOOKS`. Cursor does not double-wire a second copy of the same hook beside the adapter. | happy |
| AC-ZERO | First prompt in an unbound foreign folder that is only a discovered project id or only a WI id binds or injects no-target. There is no empty-state "configure first" / "run setup" dead end. | zero-state |
| AC-SETUP | Closeout and FRAMEWORK-STATE state that land is the PR merge of this WI. `./setup --all-hosts` from this working tree is install-preview, not promotion. | happy |
| AC-REG | `validate-cross-repo-orch-01.mjs` still PASSes the 2026-09-18 HoursHub→SSVE incident fixture. | happy |

USER_CLI_HOMEWORK_RE and PROJECT_SUBJECT_RE byte contracts live in `scripts/lib/resolve-named-worktree.mjs`. The AC table must not contain unescaped `|` characters.

## System Dependencies

- Depends-on: WI-FW-CROSS-REPO-ORCH-01 CLI (`scripts/svc-orchestrate.mjs`, `scripts/lib/cross-repo-orch.mjs`), isolation guard, Cursor adapter, host wirers, Grok `fresh_session_launch`, Fable external-review launcher, WI-497 WI-id extractor
- Depended-on-by: Cursor/Grok origin sessions over any onboarded svc project (HoursHub is one regression example)

## Industry Grounding

**Source:** `docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md`; parent WI-FW-CROSS-REPO-ORCH-01 and its existing orchestration contract.
**Landscape state:** inapplicable — internal framework origin-orchestration contract, with no customer-facing market flow.

### What the industry does
An external market comparison is not applicable to this internal enabler. This section makes no external adoption, provider-availability, or performance claim; no new industry research is asserted.

### What we're doing
Extend the parent orchestration contract with prompt-time named-worktree discovery and same-owner binding. The origin session dispatches the existing PLAN/REVIEW/EXEC chain; the hook itself never launches paid children.

### Why we differ
The no-user-CLI requirement comes from the recorded owner incident, not a claim of superiority over another product. Preserve the parent's foreign-owner, default-checkout, and mixed-repository mutation denials.

### Reversibility
Revert the auto-bind hook and its managed wiring through the existing transactional installer to return to the parent's explicit orchestration entrypoint. Preserve owner-authored configuration and prior binding/receipt evidence; do not delete history or weaken isolation during rollback.

## Pillars Coverage Matrix

| Pillar | State |
|---|---|
| Product fit | [N/A — justified] framework origin auto-bind, not a product feature |
| Journey | [N/A — justified] no end-user journey; operator session + hooks |
| Acceptance criteria | [NEW] |
| UX | [N/A — justified] no product UI; owner UX is "never run a CLI" |
| UI | [N/A — justified] no UI |
| Tech architecture | [NEW] hook hot path + resolver + effort pins + isolation skills-path |
| Cost model | [UPDATED] PLAN xhigh is a paid Grok child; hook must stay cheap |
| Operations & ownership | [NEW] public git artifacts only; host hook config is existing wirer lifecycle |

## Scout diagnosis (candidates in this worktree, not landed)

Uncommitted files in this HoursHub-incident worktree are **candidates**. EXEC
must satisfy the ACs; it may keep, rewrite, or replace scout bytes. Scout
defects that the plan forbids shipping:

1. `migrateSession` on every matching prompt appends `session-contract.jsonl` (not idempotent).
2. Project alias is a hardcoded HoursHub/SSVE pair plus a path substring over
   all of `~/app-workspaces`, so any other onboarded project is invisible,
   `wt-lane-*` trees with no alias in the leaf name are missed unless
   cwd-if-linked, and unrelated dirs can match.
3. Injected context still reads as CLI homework (`Your first mutating action: node …`).
4. Cursor adapter and the generic hook both migrate — Cursor must stay adapter-only.
5. `references/host-hook-catalog.json` is not updated; `validate-catalog-generation.sh` would fail.
6. Kimi wirer does not honor `SVC_DISABLED_HOOKS`.
7. Hook can swallow `orch_foreign` / `orch_default_checkout` and still inject a bind.
8. Project-only bind must not select a WI by lane-tasks mtime. Inject candidate WIs; migrate only on a named WI or a single `in_progress` lane-tasks file.
9. Treating local `./setup` as the land path.

## Technical Design

### Architecture

[Layer 1] Extend #66. Do not add a second orchestrate CLI. Auto-bind is a
fail-open prompt hook plus a resolver that only returns linked worktrees.
The origin agent remains the dispatcher. The hook never spawns Grok.

```
  User prompt ("<onboarded-project>" | "WI-X")
           |
           v
  +------------------+     no match      +------------------+
  | extract WI /     | ----------------> | {}  exit 0       |
  | project subject  |                   | (no bind)        |
  +------------------+                   +------------------+
           | match
           v
  +------------------+     default /     +------------------+
  | resolve linked   | --> foreign -->   | inject stay-put  |
  | worktree         |     missing       | never CLI to user|
  +------------------+                   +------------------+
           | linked + same-owner identity
           v
  +------------------+
  | bindIfNeeded     |  atomic_rename binding; skip contract append if tuple matches
  | migrateSession   |
  +------------------+
           |
           v
  additional_context: bound worktree, WI, next=PLAN xhigh → Fable → EXEC high
           |
           v
  Origin agent dispatches svc-orchestrate (installed skills path)
           |
           +--> isolation allows exact installed script, denies Write to other repo
```

### Components

| Component | Type | Responsibility | New/Modify |
|-----------|------|----------------|------------|
| `resolve-named-worktree.mjs` | Service | WI/project → linked worktree; bindIfNeeded; context text | New (rewrite scout) |
| `svc-origin-orchestrator-prompt.mjs` | Hook | Claude/Grok/Kimi UserPromptSubmit (+ SessionStart if prompt present) | New (rewrite scout) |
| Cursor adapter `beforeSubmitPrompt` | Hook | Cursor additional_context + bindIfNeeded | Modify |
| `migrateSession` | Service | Idempotent same-tuple skip | Modify |
| `dispatchRole` PLAN/EXEC argv | Service | `--model grok-4.6` `--effort xhigh\|high` | Modify |
| Isolation `origin-orchestrate` | Guard | Allow installed skills-path realpath set | Modify |
| Host wirers + catalog | Install | Register hook; Cursor not double-wired | Modify |
| `validate-cross-repo-orch-02.mjs` | Test | Auto-bind ACs hermetic | New |

### Data Model

No product schema. Session binding JSON and session-contract JSONL in the
**target** linked worktree only. Host hook config remains wirer-owned.

### Data Flow

1. Prompt text enters beforeSubmitPrompt / UserPromptSubmit / SessionStart.
2. `extractWiId` (WI-497) or project-subject match.
3. Resolver returns a linked worktree or a typed miss (`no_target`, `default_checkout`, `ambiguous`, `foreign`).
4. `bindIfNeeded` calls `migrateSession` only when WI is known (named in the prompt, or exactly one in_progress lane-tasks file), session is shaped, host is in `ORIGIN_HOSTS` (never collapsed to cursor), and the tuple is new. Same-tuple retry takes the exclusive lock and skip path.
5. Hook writes additional_context and exits 0.
6. Origin dispatches PLAN/REVIEW/EXEC via the #66 CLI using the installed skills path.

### External Dependencies

None new. Grok CLI and Fable launcher already required by #66.

### Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who spawns PLAN | Origin agent, not the hook | Hook spawn on every project-id mention would fork paid Grok children. [Layer 1] |
| Cursor wiring | Adapter only | Cursor has no Claude UserPromptSubmit; double-wire wastes p95 and double-migrates. [Layer 1] |
| Project roots | Discover `~/worktrees/<id>/` and `~/app-workspaces/<id>-worktrees/` plus cwd-if-linked and optional aliases file | Any onboarded svc project, not a hardcoded HoursHub/SSVE pair; does not scan all of `~/app-workspaces`. [Layer 1] |
| Default checkout | Refuse (`.git` directory) | Locked by #66 AC-1E. |
| Effort | PLAN xhigh, EXEC high, hardcoded in dispatch argv | Owner lock. launch_command template keeps `${SVC_GROK_EFFORT:-high}` and dispatch sets the env. |
| Isolation allowlist | realpath set of ROOT + `$SVC_SKILLS_HOME`/`HOME` `{.cursor,.grok,.claude}/skills/scripts/svc-orchestrate.mjs` | Foreign cwd has no in-repo script; #66 compared only isolation-guard ROOT; env override makes AC-ISO-1 hermetic. |
| Project-only WI | no mtime pick; unique in_progress or wait for a named WI | Silent newest-mtime migrate would bind a WI the user did not name. |
| Origin host | pass through `ORIGIN_HOSTS` from wirer `SVC_HOST`; never collapse non-grok to cursor | Claude/Kimi origin would otherwise write `origin_host: cursor`. |
| Catalog | Register the new `svc-*.mjs` | `validate-catalog-generation.sh` requires every hooks/svc-*.mjs id. |
| Local setup | Not land | Owner lock. |

### Competitive Tech Alternatives

N/A — internal framework enabler, no customer mechanic.

### Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute (hook) | regex + bounded dirent scan | 1 per user prompt | ~0 | linear with prompts | owner machine |
| Storage | binding JSON + contract line | 1 per new tuple | ~0 | per bind | owner disk |
| Bandwidth | none | 0 | $0 | n/a | n/a |
| External API | Grok PLAN xhigh + EXEC high | 1 pair per WI | existing Grok seat | per WI | owner |
| Background jobs | none from hook | 0 | $0 | n/a | n/a |

**Scaling trigger points:** hook scan over unbounded `~/app-workspaces` would
burn SessionStart p95 — that scan is forbidden. PLAN xhigh is the paid line;
the hook must not spawn it.

**Zero-cost justification:** hook path is local. Child Grok cost is the #66
station, now effort-pinned.

### Operations & Ownership

| Dimension | Answer |
|---|---|
| Owner | framework maintainer (solo) |
| On-call | best-effort, no paging |
| SLA / SLO | hook fail-open; bind p95 aimed under 200ms after regex miss |
| Error budget | N/A for best-effort |
| Monitoring | orchestration receipts under target `.svc/orchestration/` |
| Alerting | none |
| Dashboard | none |
| Runbook | stay put on miss; do not tell the user to run CLI; land via PR not local setup |
| Failure modes | no linked worktree; foreign session; default checkout; hook throw |
| Recovery | fail-open prompt; retry bind on next prompt once identity exists |
| Backup / restore | wirers keep distinct immutable baseline vs rolling rollback (WI-542) |
| Dependencies' failure impact | if Grok CLI missing, dispatch fails closed with JSON; origin still does not paste |

### Feasibility Matrix

| AC | Persona pressure | Description | Feasible? | Notes |
|----|------------------|-------------|-----------|-------|
| AC-BIND-1 | N/A - system-only | WI → linked worktree | yes | WI files already exist in target trees |
| AC-BIND-2 | N/A - system-only | project alias → linked tree | yes | explicit roots, not global scan |
| AC-BIND-3 | owner | no CLI homework | yes | context copy contract + validator |
| AC-BIND-4 | N/A - system-only | fail-open inject | yes | existing UserPromptSubmit posture |
| AC-BIND-5 | N/A - system-only | idempotent migrate | yes | skip append on same tuple |
| AC-BIND-6 | N/A - system-only | schedule via origin, not hook spawn | yes | |
| AC-BIND-1E | N/A - system-only | foreign deny | yes | reuse #66 identity |
| AC-BIND-2E | N/A - system-only | default checkout refuse | yes | reuse #66 |
| AC-BIND-3E | owner | no-target stay put | yes | |
| AC-DISPATCH-1 | N/A - system-only | PLAN xhigh | yes | argv pin |
| AC-DISPATCH-2 | N/A - system-only | EXEC high | yes | argv pin |
| AC-DISPATCH-3 | N/A - system-only | Fable unchanged | yes | |
| AC-ISO-1 | N/A - system-only | skills-path allow | yes | realpath set |
| AC-ISO-2 | N/A - system-only | mixed-repo Write deny | yes | existing |
| AC-ISO-3 | N/A - system-only | lookalike deny | yes | existing |
| AC-HOT-1 | N/A - system-only | regex-first bounded scan | yes | |
| AC-CAT-1 | N/A - system-only | catalog + wirers | yes | |
| AC-ZERO | owner | first prompt binds | yes | |
| AC-SETUP | owner | setup ≠ land | yes | docs + closeout |
| AC-REG | N/A - system-only | orch-01 still green | yes | do not regress #66 |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hook writes bindings (isolation bypass vs PreToolUse) | bind in another repo without classifyMutation | only `.svc/bindings`, session-contract, orchestration receipts; same identity predicates as CLI |
| Prompt mentioning a project id in passing steals session | wrong worktree | project match is subject-form, not substring in a long prompt; WI wins over project |
| Parallel SessionStart + UserPromptSubmit | double contract append | `mkdir_exclusive` lock on `.svc/orchestration/.migrate-<session_id>.lock` then same-tuple skip; `atomic_rename` for binding JSON |
| Wirer RMW of host config | lose user hooks | existing WI-542 immutable vs rolling paths; lossless fixtures |
| Local setup mistaken for land | dirty hooks on hosts | AC-SETUP; EXEC must not claim promotion from `./setup` |

### Trade-offs

| Trade-off | Chose | Over | Rationale |
|-----------|-------|------|-----------|
| Auto-dispatch from hook | origin dispatches | hook `spawn(grok)` | avoids paid fork on every project-id mention |
| Project discovery | directory-name roots for every onboarded id + cwd-if-linked | hardcoded HoursHub/SSVE list, or scan all app-workspaces | any onboarded project must bind; p95 stays bounded |
| Cursor event | adapter beforeSubmitPrompt | extra Cursor SessionStart command | one bind site |

### Implementation Notes

- `PLANNED` — `scripts/lib/resolve-named-worktree.mjs` (CREATE, rewrite scout)
- `PLANNED` — `hooks/svc-origin-orchestrator-prompt.mjs` (CREATE, rewrite scout)
- `PLANNED` — idempotent `migrateSession` + PLAN/EXEC effort argv
- `PLANNED` — Cursor adapter additional_context
- `PLANNED` — isolation installed-script realpath set
- `PLANNED` — catalog + Claude/Grok/Kimi wirers
- `PLANNED` — `validate-cross-repo-orch-02.mjs` + fixture
- `PLANNED` — route-workflow origin section: user never runs a command

**Risk Flags:** `runtime_concurrency`, `external_state_writer`, `lossless_rmw`, `idempotent_rewriter`, `cross_runtime_integration`
