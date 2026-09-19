# Gap brief: WI-FW-CROSS-REPO-ORCH-02 origin auto-bind

**Type:** enabler gap (not a regression of a shipped auto-bind)
**WI:** WI-FW-CROSS-REPO-ORCH-02
**Depends on:** WI-FW-CROSS-REPO-ORCH-01 merged #66 (`483e26b`)
**Lane:** framework
**Risk Flags:** `runtime_concurrency`, `external_state_writer`, `lossless_rmw`, `idempotent_rewriter`, `cross_runtime_integration`

This is not diagnose-bug of a product defect. Auto-bind never shipped. #66
shipped the CLI. This brief records the gap, the scout faults, and the
smallest safe surface so plan-changeset can execute against a contract.

## Domain classification

**Code / hook-contract gap** on the origin hot path. Not test-fixture, not
platform-cache.

## Reproduce

```
Trigger:  Open Cursor or Grok in any folder. Name any onboarded svc project
          (HoursHub is one example) or a WI. Do not run a CLI.
Expected: Session binds to the linked worktree. Origin schedules PLAN xhigh →
          Fable → EXEC high in that worktree. User never sees a command to run.
          Isolation still denies mixed-repo Writes. Default checkout refused.
Actual:   #66 requires the origin agent to run svc-orchestrate with an explicit
          --worktree. No prompt-time resolver. Scout candidates in this tree
          attempt auto-bind but are unbound and incorrect (see Scout).
```

Causal class: **Action** — the bind step does not exist on the shipped path.

## Root cause

Immediate: prompt hooks do not resolve a named WI/project to a linked worktree
and do not inject a no-CLI origin baton.

Enabling: #66 stopped at the CLI + isolation allowlist for
`scripts/svc-orchestrate.mjs` relative to the isolation-guard ROOT. Foreign
cwd (HoursHub) has no in-repo copy of that script. Owner UX needs the
installed skills-path CLI plus prompt-time resolution.

Systemic: origin UX was specified as "user never runs a command" after the
CLI existed, so the missing layer is this WI, not a revert of #66.

```yaml
symptom: "naming a WI/project from any folder does not bind or dispatch without a user CLI"
proximate_cause: "no prompt-time resolver or origin inject on SessionStart/UserPromptSubmit/beforeSubmitPrompt"
root_cause: "WI-01 shipped migrate/dispatch CLI only"
systemic_cause: "owner UX (no-command auto-bind) was split from the CLI WI"
prevention: "prompt hooks resolve linked worktrees, bindIfNeeded, inject dispatch; isolation allows installed skills-path orchestrate; EXEC high after Fable"
```

## Scout (candidates — do not rubber-stamp)

Present uncommitted in this worktree:

- `scripts/lib/resolve-named-worktree.mjs`
- `hooks/svc-origin-orchestrator-prompt.mjs`
- `hooks/hooks.json` SessionStart + UserPromptSubmit
- `scripts/wire-grok-hooks.mjs`, `wire-hooks.mjs`, `wire-kimi-hooks.mjs`
- `hooks/cursor/svc-cursor-ssve-adapter.mjs` additional_context + migrate
- grok dispatch `--effort xhigh/high` (dirty `cross-repo-orch.mjs`)

Faults EXEC must not ship:

| Fault | Why it fails the owner UX |
|---|---|
| migrate on every matching prompt | appends session-contract every time |
| scan all `~/app-workspaces` | p95 + false positives |
| hardcoded HoursHub/SSVE aliases | any other onboarded project cannot bind |
| context is CLI homework | user can be told to run a command |
| adapter + generic hook both migrate | double bind on a host that wired both |
| catalog not updated | `validate-catalog-generation.sh` fail |
| Kimi ignores `SVC_DISABLED_HOOKS` | disable contract drift |
| swallow foreign/default-checkout then still inject bind | fail-open must not look like success |
| empty WI for project-only via mtime | silent newest-mtime migrate binds a WI the user did not name; inject candidates instead |
| isolation still ROOT-only | `~/.cursor/skills/scripts/svc-orchestrate.mjs` from HoursHub may deny |
| local `./setup` as land | owner lock |

## Smallest safe fix surface

- Resolver + bindIfNeeded (linked worktrees only)
- Fail-open prompt hook (Claude/Grok/Kimi) + Cursor adapter only
- Idempotent migrate
- PLAN xhigh / EXEC high argv
- Isolation installed-script realpath set
- Catalog + wirers
- Hermetic `validate-cross-repo-orch-02.mjs`
- route-workflow: user never runs a command

Do not spawn Grok from the hook. Do not land via local setup.

## Pattern scan

Same class: prompt hooks that mutate durable state without idempotency;
wirers that add hooks without catalog ids; isolation allowlists that compare
only the compiling ROOT.

Findings: #66 isolation allow is ROOT-only (this WI extends it). WI-542
wirer backup split stays the pattern for host-config RMW. No other origin
auto-bind exists.

Followups: none — single correction.

## Register Discoveries

Single correction — no decomposition needed. #66 remains the CLI. This WI is
the no-command layer.

## Affected artifacts

- `docs/specs/features/wi-fw-cross-repo-orch-02.md` (authoritative ACs)
- `skills/route-workflow/SKILL.md` origin section
- `FRAMEWORK-STATE.md` on land, not as local setup
- `references/host-hook-catalog.json`
- no product journeys (enabler)

## Learnings

A shipped CLI is not owner UX. Prompt-time bind must be fail-open, idempotent,
linked-worktree-only, and must never print a command for the user to run.
Host catalog registration is part of adding `hooks/svc-*.mjs`.

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | no | Framework enabler; no kill signal |
| 2 | Journey | no | No end-user journey |
| 3 | Acceptance criteria | yes | New AC table in orch-02 spec |
| 4 | UX | no | No product UI; owner constraint is AC-BIND-3 |
| 5 | UI | no | No UI |
| 6 | Tech architecture | yes | Hook hot path design in the spec |
| 7 | Cost model | yes | PLAN xhigh; hook must not spawn |
| 8 | Operations | yes | setup ≠ land; wirer backups reused |

## Pillars Coverage Matrix

See the feature spec. All eight pillars populated.

## Proof of fix

`node test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs` plus
`validate-cross-repo-orch-01.mjs` still PASS. Catalog generation PASS.
No user-facing CLI strings in hook context fixtures.
