# WI-GROK-HOST-IDENTITY-02 Changeset: Stable Grok controller identity

- **Spec:** `docs/specs/work-items/WI-GROK-HOST-IDENTITY-02.md`
- **Technical design:** `docs/specs/tech/wi-grok-host-identity-02.md`
- **Branch:** `bugfix-WI-GROK-HOST-IDENTITY-02`
- **Lane:** bugfix
- **Execution mode:** inline
- **Planning base:** `86da7be87447e56f7e9af32ed1e39b70e307f4f5`
- **Status:** SIMULATED
- **Created:** 2026-08-30
- **Risk Flags:** external_state_writer, lossless_rmw, idempotent_rewriter, cross_runtime_integration

## Implementation Summary

Establish Grok as the sole authority host for its native hook boundary. Disable
only imported Claude/Cursor hooks, prefix every Grok-owned hook with
`SVC_HOST=grok`, wire the consolidated dispatcher natively, propagate its
validated host through the rewritten bootstrap command, and recognize Grok's
reserved session environment in shared resolution.

Invariant: controller lease v2, WI binding, worktree isolation, skill receipts,
and foreign-owner denial remain unchanged and fail-closed.

## Files Planned

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | MODIFY | `hooks/lib/resolve-wi.mjs`; `hooks/lib/wi-claim.mjs`; `hooks/codex/lib/bootstrap-command.mjs`; `hooks/codex/lib/session-handoff.mjs`; `hooks/codex/svc-codex-pretool-dispatcher.mjs`; `hooks/codex/svc-codex-skill-load-enforcer.mjs`; `scripts/svc-authority.mjs`; `scripts/svc-ensure-worktree.mjs`; `test-framework/evals/tier-1/validate-codex-execution-integrity.sh`; `test-framework/evals/tier-1/validate-codex-session-rebinding.sh`; `test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh` | Resolve Grok host/session in every bootstrap and recovery boundary, shell-encode rewritten argv, bind host/repo/base in the one-use private handoff, and preserve fail-closed direct Grok-session fallback |
| T02 | MODIFY | `scripts/wire-grok-hooks.mjs`; `test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh` | Native dispatcher, Grok host prefix, and foreign-hook compatibility isolation |
| T03 | CREATE/MODIFY | `docs/specs/work-items/WI-GROK-HOST-IDENTITY-02.md`; `docs/specs/tech/wi-grok-host-identity-02.md`; `docs/specs/contract-maps/grok-host-identity.md`; `docs/specs/security/wi-grok-host-identity-02-review.md`; `docs/specs/audit/wi-grok-host-identity-02-analysis.md`; `docs/specs/test-evidence/WI-GROK-HOST-IDENTITY-02/cross-system-probe.json`; `docs/specs/test-evidence/WI-GROK-HOST-IDENTITY-02/pre-post-evidence.json`; `docs/specs/reviews/wi-grok-host-identity-g5.md`; `docs/specs/reviews/wi-grok-host-identity-exec-cross-model.md`; `docs/specs/reviews/wi-grok-host-identity-exec-review-log.yaml`; `docs/plans/2026-08-30-wi-grok-host-identity-02/manifest.md`; `docs/plans/2026-08-30-wi-grok-host-identity-02/plan-contract.json`; `docs/plans/2026-08-30-wi-grok-host-identity-02/review-log.yaml`; `.svc/plan-manifest.json`; `.svc/lane-tasks-WI-GROK-HOST-IDENTITY-02.json`; `.svc/session-contract.jsonl` | Root cause, design, plan, cross-system/red-green proof, security/audit findings, review decision, risk contract, and durable lane/session evidence |

## Changeset Blueprint

Skipped because execution mode is `inline`; the executing orchestrator has the
loaded live evidence, work item, technical design, and affected source context.

## Task Graph

| Task | Title | Files | Dependencies | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| T01 | Principal propagation | resolver, dispatcher, ensure-worktree, authority CLI, execution-integrity fixture | none | AC-1, AC-2 | `validate-codex-execution-integrity.sh` | `host-propagation-green` |
| T02 | Grok-native hook convergence | Grok wirer and TOML fixture | T01 | AC-3, AC-4 | `validate-grok-hook-toml-roundtrip.sh` | `grok-wiring-green` |
| T03 | Evidence and chain closeout | WI, tech, plan, graph | T01,T02 | none | plan/lane validators | `evidence-green` |
| verify-promotion | Installed Grok and Example Marketplace authority proof | Grok config/install and exact lease | land | AC-4, AC-5, AC-6 | inspect, CAS takeover, harmless two-call probe | `installed-proof-green` |

## AC-to-Task Mapping

| AC | Requirement | Task |
|---|---|---|
| AC-1 | Grok host/session resolves consistently without Codex fallback | T01 |
| AC-2 | Rewritten bootstrap carries validated host and stable session | T01 |
| AC-3 | Grok config converges foreign-hook disablement and native identity | T02 |
| AC-4 | Effective Grok inventory has no foreign hooks and one native dispatcher | T02 + verify-promotion |
| AC-5 | Exact synthetic lease is moved by generation-bound CAS | verify-promotion |
| AC-6 | Installed two-call Example Marketplace proof passes without media mutation | verify-promotion |

## AC-to-Test Mapping

| AC | Test type | Proof |
|---|---|---|
| AC-1 | Unit/local integration | execution-integrity resolver assertions |
| AC-2 | Local integration | dispatcher bootstrap `updatedInput.command` assertion |
| AC-3 | Local + manual runtime | TOML fixture and `grok inspect --json` |
| AC-4 | Local integration | exact command/matcher count assertions |
| AC-5 | Controlled runtime | exact repo/WI/principal/generation takeover receipt |
| AC-6 | Manual runtime | exact bootstrap plus harmless `pwd`/branch observation |

T01 pins identity precedence in both shared and dispatcher-local resolution:
allowlisted explicit `SVC_HOST` wins; next `GROK_SESSION_ID` selects
`grok` and supplies the session even though the dispatcher lives under
`hooks/codex`; only then may existing Codex signals/path fallback run. Unknown
explicit `SVC_HOST` remains a denial. Payload host is considered only after the
Grok marker. The canonical rewrite is shell-safe
`SVC_HOST=<allowlisted-host> node <ensure> ...`; the stable session crosses the
process boundary only in the private one-use handoff.
The exact call sites are: (1) `resolveAuthorityHost()` returns `grok` for
`env.GROK_SESSION_ID` after explicit host; (2) dispatcher `hostIdentity()` does
the same after allowlisted `SVC_HOST` but before Codex signals/path fallback;
(3) dispatcher `sidOf()` includes `process.env.GROK_SESSION_ID`; and (4)
authority CLI `identity()` includes `env.GROK_SESSION_ID` in `trustedSession`.

T02 installs one native `PreToolUse` dispatcher with matcher
`Shell|Write|Edit|Bash|run_terminal_command`. It keeps the existing narrower
native guards as defense in depth, while the dispatcher is the sole native
bootstrap rewriter. Every Grok-owned command is prefixed `SVC_HOST=grok`. For
`compat.claude` and `compat.cursor`, update an existing table's single `hooks`
key in place or insert that key/table when absent; never append a duplicate
table. Fixtures cover true→false with comments/unrelated keys, absent-table
insertion, already-false input, unique tables, and three-rewrite byte identity.

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | N/A | headless host integration; no rendered surface |
| Technical design | satisfied | `docs/specs/tech/wi-grok-host-identity-02.md` |
| Style | satisfied | existing ESM/TOML transformer and shell-hook conventions |
| Persona | N/A | operator safety regression, no product persona behavior |
| Security | required | no principal equivalence; fixed known-host allowlist and CAS recovery |

## Validation Plan

```bash
node --check scripts/wire-grok-hooks.mjs                         # expected exit 0
node --check hooks/codex/svc-codex-pretool-dispatcher.mjs       # expected exit 0
node --check hooks/codex/svc-codex-skill-load-enforcer.mjs     # expected exit 0
node --check hooks/lib/resolve-wi.mjs                            # expected exit 0
node --check hooks/codex/lib/bootstrap-command.mjs              # expected exit 0
node --check scripts/svc-authority.mjs                           # expected exit 0
bash test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh # expected exit 0
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh # expected exit 0
node scripts/validate-plan-contract.mjs docs/plans/2026-08-30-wi-grok-host-identity-02/plan-contract.json # expected exit 0
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-30-wi-grok-host-identity-02/manifest.md # expected exit 0
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-GROK-HOST-IDENTITY-02.json # expected exit 0
```

Post-merge only:

```bash
./setup --host grok
grok --cwd /home/user/app-workspaces/example-marketplace-port inspect --json > /tmp/wi-grok-host-identity-inspect.json
bash scripts/check-install-drift.sh --host grok
node - /tmp/wi-grok-host-identity-inspect.json <<'NODE'
const fs = require('fs');
const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const vendor of ['claude', 'cursor']) {
  const cell = doc.externalCompat.cells.find((x) => x.vendor === vendor && x.surface === 'hooks');
  if (!cell || cell.enabled !== false) throw new Error(`${vendor} hook compatibility remains enabled`);
}
if (doc.hooks.some((h) => ['claude', 'cursor'].includes(h.vendor) && h.compatibilityStatus === 'enabled')) throw new Error('foreign hook remains effective');
const native = doc.hooks.filter((h) => /(?:^|\/)\.grok\/config\.toml$/.test(h.source?.path || ''));
const dispatchers = native.filter((h) => h.event === 'pre_tool_use' && /svc-codex-pretool-dispatcher\.mjs/.test(h.target));
if (dispatchers.length !== 1) throw new Error(`native dispatcher count ${dispatchers.length}`);
if (!/run_terminal_command/.test(String(dispatchers[0].matcher))) throw new Error('dispatcher matcher misses run_terminal_command');
for (const hook of native.filter((h) => /\.grok\/skills/.test(h.target))) if (!/^SVC_HOST=grok\s/.test(h.target)) throw new Error(`unscoped Grok hook: ${h.target}`);
NODE
```

The inspect assertion above is expected to exit 0 and uses the recorded Grok
1.0.13 schema (`externalCompat.cells[]`, `hooks[]`, `event`, `target`, `matcher`,
`source.path`, `vendor`, and `compatibilityStatus`).

Then, after re-reading status and confirming the exact tuple below is unchanged,
perform the existing generation-bound takeover (expected exit 0):

```bash
GROK_SESSION_ID=01a05200-f1e6-74d0-9b90-7192c6174a2a SVC_HOST=grok \
node scripts/svc-authority.mjs takeover \
  --repo-id sha256:12567b291fa2e8f84d2f107d39eb309692674bae54d2b405be183031efe902e4 \
  --wi WI-VIDEO-AUDIO-REMEDIATION-02 \
  --worktree /home/user/app-workspaces/example-marketplace-port/.worktrees/framework-WI-VIDEO-AUDIO-REMEDIATION-02-audio-remux \
  --session-id 01a05200-f1e6-74d0-9b90-7192c6174a2a \
  --expected-principal sha256:0a1f5c9d2830eafc869eaae10d2ce280313a0dc865cf4b5a3e43c3f10f2b220a \
  --expected-generation 1 \
  --reason 'VC owner-directed repair of Grok bootstrap host-alias regression'
```

Immediately before takeover, re-run `status` and require the exact principal
and generation above. If either changed, abort without CAS and report the fresh
tuple; derive any reverse/repair command from that new generation rather than
reusing this command. T01's hermetic CLI fixture requires
`GROK_SESSION_ID`-only takeover plus the matching `--session-id` to produce
`principalId({host:'grok', session_id:'01a05200-f1e6-74d0-9b90-7192c6174a2a'})`.

Do not replay bootstrap against the already-bound WI: the existing second-
bootstrap guard must remain fail-closed. T01's dispatcher fixture supplies the
exact user command from the Example Marketplace default checkout and proves that a Grok
`run_terminal_command` is allowed and rewritten with Grok host while the private handoff carries the session before
execution. After takeover, use the original Grok session to issue exactly two
real `run_terminal_command` calls from the bound Example Marketplace worktree: first `pwd`,
then `git branch --show-current` (each expected exit 0 through ordinary
WI/isolation gates). Do not execute `ffmpeg`.

## Execution Command Sequence

```bash
# T01: add failing assertions for GROK_SESSION_ID-only resolution in the shared
# resolver, dispatcher, authority CLI, and rewritten environment; then implement
# those bounded changes.
node --check hooks/lib/resolve-wi.mjs                         # expected exit 0
node --check hooks/codex/lib/bootstrap-command.mjs           # expected exit 0
node --check hooks/codex/svc-codex-pretool-dispatcher.mjs   # expected exit 0
node --check hooks/codex/svc-codex-skill-load-enforcer.mjs # expected exit 0
node --check scripts/svc-authority.mjs                       # expected exit 0
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh # expected exit 0

# T02: add failing assertions for compat hooks=false, exactly one native
# dispatcher, and SVC_HOST=grok on every native command; then implement the
# lossless/idempotent transformer.
node --check scripts/wire-grok-hooks.mjs                     # expected exit 0
bash test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh # expected exit 0

# T03: refresh executable consumer/census fields from the actual diff, then:
node scripts/validate-plan-contract.mjs docs/plans/2026-08-30-wi-grok-host-identity-02/plan-contract.json
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-30-wi-grok-host-identity-02/manifest.md
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-GROK-HOST-IDENTITY-02.json # expected exit 0
```

On failure, stop at the first failed checkpoint, patch only the owning task's
paths, and resume there. Mid-execution rollback restores only T01/T02 paths from
`86da7be` (after preserving the failing diff as evidence); no squash revert or
external config action is part of execution rollback.

## Checkpoint Plan

1. `host-propagation-green` — resolver and rewritten bootstrap tests pass.
2. `grok-wiring-green` — TOML lossless/idempotent and native inventory tests pass.
3. `evidence-green` — plan, task graph, review, and audit receipts reconcile.

Rollback anchor is planning base `86da7be`. During execution, restore only the
failed task's owned paths to that anchor. After promotion, runtime config rollback
uses the wirer's rolling backup; source rollback reverts the squash and reruns
Grok setup.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | Grok installed framework copy | coupled | `./setup --host grok` plus install receipt and drift check |
| 2 | Host config files | `~/.grok/config.toml` compat and hook entries | coupled | transactional `wire-grok-hooks.mjs`, immutable baseline, rolling rollback, TOML fixture |
| 3 | Out-of-tree version-controlled | Example Marketplace WI worktree and shared Git controller store | coupled | canonical bootstrap, binding, authority-store recovery, exact repo/WI/worktree checks |
| 12 | Downstream framework artifacts | host manifest and hook consumers | coupled | setup/drift and cross-host conformance validators |
| 15 | Runtime filesystem | Example Marketplace controller lease generation and receipts | coupled | authority-store CAS recovery and live two-call proof |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 6, 7, 8,
9, 10, 11, 13, 14.

The live Example Marketplace lease repair is intentionally post-install and decoupled from
the source commit because it is one existing malformed runtime tuple. Safety is
provided by exact repo/WI/worktree/principal/generation evidence and the
authority-store recovery receipt; no lease file is edited or deleted directly.

## Simulation Report

| Check | Result | Evidence |
|---|---|---|
| All MODIFY targets exist | PASS | exact four source/test paths verified at base |
| CREATE targets absent | PASS | WI-specific docs/plan paths were absent before this run |
| Host interpolation is bounded | PASS | dispatcher `KNOWN_HOSTS` allowlist precedes rewrite |
| Foreign non-hook compatibility preserved | PASS | only `compat.<vendor>.hooks` changes |
| Rollback paths distinct | PASS | `.pre-migration.bak` vs `.svc-wire.rollback` |
| No deploy/media dependency | PASS | manifest contains framework hooks/tests/docs only |

Scenario walkthrough: Given a Grok session in the default Example Marketplace checkout,
when it invokes canonical bootstrap, then the native Grok dispatcher rewrites
the call with `SVC_HOST=grok`; when a second command targets the bound worktree,
then the same Grok principal matches. T01 implements identity propagation, T02
implements effective hook exclusivity, and verify-promotion proves the sequence.

Executor forbidden actions: no `ffmpeg`; no video/media or Example Marketplace application
edits; no lease-file edit, unlink, or principal equivalence; no Grok setup or
takeover before land. T03 writes only its owned evidence/state paths.

The live inspect schema was captured read-only from Grok 1.0.13 during planning:
top-level `externalCompat.cells[]` entries contain `vendor`, `surface`, and
`enabled`; top-level `hooks[]` entries contain `event`, `target`, `matcher`,
`source.path`, optional `vendor`, and optional `compatibilityStatus`. T02's
fixture records this redacted shape; verify-promotion matches the Grok config by
path suffix, not a user-specific absolute path. `--cwd` is used only to prove
the effective inventory seen from the target repository, not to change wiring.

## Promotion Readiness Checklist

- [x] Every planned source and evidence file is listed.
- [x] Every task has a focused validation command.
- [x] Every AC maps to a task and proof type.
- [x] External state and rollback paths are explicit.
- [x] No ORM schema or migration is involved.
- [x] Final review must inspect the effective Grok inventory, not config text alone.
- [x] Example Marketplace video/media mutation remains prohibited.

**Next:** `review-plan` — adversarially validate this manifest before implementation.
