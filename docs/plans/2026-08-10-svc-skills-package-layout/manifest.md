# WI-530 implementation manifest

**Status:** APPROVED
**Branch:** `framework-WI-530-skills-package-layout`
**Base SHA:** `4d7543f6a8008a90cb3c841961125214c4aea2cb`
**Archetype:** repository source-layout migration plus bounded consumer bootstrap recovery

## Immutable constraints

- Source skills move beneath the repository `skills/` directory; installed host paths remain flat.
- Preserve all 103 skill names, frontmatter, chain ordering, routing, triggers, and behavior.
- Do not add root aliases or a redundant `skills/svc/` directory.
- Do not rewrite immutable historical evidence merely to replace old path strings.
- Do not claim convergence until canonical-main all-host setup and drift checks pass.
- Never auto-take over a live foreign owner or adopt a worktree outside the repository `.worktrees/` containment root.

## Tasks

| Task | Files | AC | Method | Validation |
|---|---|---|---|---|
| T1 source contract | `scripts/lib/skill-source-layout.mjs`, `skills-manifest.json` | AC-530-1, AC-530-4, AC-530-10 | Define a dependency-free, no-follow contained source-root resolver and manifest bijection | resolver/layout escape mutations |
| T2 package move | `skills/` and the 103 current skill contracts | AC-530-1, AC-530-2, AC-530-5 | Git-aware move; keep root `test-framework/` infrastructure and move only its skill contract | tree/digest comparison, dual-role harness, and layout validator |
| T2a local executable rebase | skill-local `scripts/` directories | AC-530-9 | Rebase repo-root imports, helper commands, knowledge roots, and self-paths by one source level | capture, ingest, batch, research, and knowledge-path focused execution |
| T3 operational consumers | `setup`, framework-wide `scripts/`, `hooks/`, root `test-framework/` | AC-530-3, AC-530-4, AC-530-10, AC-530-11, AC-530-16, AC-530-17 | Keep source, flat installed, and consumer-local namespaces separate; resolve central helper executables from SVC while anchoring Git/state to an explicit consumer worktree; validate all hosts read-only before worktree commits and reserve live install repair for canonical main; reject source escapes, duplicate manifest names, and exact-set mismatches before install | setup, balanced-count mismatch, drift, worktree pre-commit no-write boundary, routing, reconcile help/consumer shadowing, consumer authority, receipt, and Tier-1 checks |
| T3b preserved worktree recovery | `scripts/svc-ensure-worktree.mjs`, `hooks/lib/claim-owner.mjs`, `hooks/lib/wi-claim.mjs`, `hooks/lib/authority-store.mjs`, `hooks/lib/resolve-wi.mjs`, Codex dispatcher, focused Tier-1 fixtures | AC-530-12, AC-530-13, AC-530-14, AC-530-15 | Adopt one registered requested branch under `.worktrees/`; fully validate and CAS-repair every same-WI v1 lineage binding after branch drift on every resume; deterministically promote/resume v2 with durable intent, pre-intent compatibility, repair/migration forward-completion, and two-surface rollback | renamed-branch positive, partial generation-transfer retry plus rollback, pre-intent v2 resume, repeated bootstrap, post-lease failpoint, dirty-byte preservation, duplicate/foreign/outside/symlink/ambiguous negatives |
| T4 maintained contracts | `AGENTS.md`, `README.md`, `DOCTRINE.md`, `WORKTREES.md`, `REPO_MODES.md`, `EXTERNAL_ADDONS.md`, current `docs/` | AC-530-6 | Update only maintained source-layout guidance and active path examples | link/path scan and manifest lint |
| T5 evidence and landing | WI/spec/plan/proposal, task graph, receipts | AC-530-7, AC-530-8 | Baseline comparison, self-review, Sol plus configured external review, governed land, all-host live install | exact-candidate receipts and canonical-main drift |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style/pattern | Persona/competitor |
|---|---|---|---|---|
| T1-T3b | N/A | Existing manifest, setup, host manifests, drift, resolver, claim-v1, controller-v2, and bootstrap contracts | Dependency-free Node ESM and portable Bash; packaged source, flat install, non-executable consumer-local boundaries, and locked exact-tuple recovery | N/A - internal framework packaging |
| T4 | N/A | Existing maintained documentation hierarchy | Current contracts change; immutable evidence does not | N/A |
| T5 | N/A | Mandatory plan-exec-review receipt chain and worktree authority | Exact digest review and post-merge live proof | N/A |

No product UI, application feature, database, network API, provider, or deployment behavior changes. The consumer journey change is limited to framework bootstrap/recovery UX.

## External State

| Environment | Planned write | Rollback |
|---|---|---|
| Git worktree | WI-530 package move and resolver changes | Revert WI-530 commit |
| Git remote | Branch, PR, squash merge | Revert squash commit |
| Provisioned host skill roots | Post-merge setup refreshes symlinks to canonical `skills/<name>` sources | Re-run setup from the reverted canonical checkout |
| `~/.svc/enforcement` | Existing setup may refresh governed installation metadata | Re-run prior canonical setup |
| Repository-shared controller authority | Canonical bootstrap may promote a recovered exact v1 tuple to generation-bound v2 | Use the emitted migration rollback receipt, which restores v1 bytes and the exact prior/absent v2 controller state under the authority lock |
| Consumer repository `.svc` reconcile state | Post-merge live replay may update the normal checkpoint/watcher state for the explicitly selected Example Marketplace worktree | Restore the pre-run checkpoint bytes if replay fails; never synthesize missing historical receipts |

Untouched external systems: product repositories, application environments, databases, schedulers, DNS, authentication, secrets, and package registries.

## Execution Command Sequence

```bash
git status --short --branch
node scripts/task-graph.mjs graph-status .svc/lane-tasks-WI-530.json
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-10-svc-skills-package-layout/manifest.md
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/tier-1/validate-skills-source-layout.sh
bash test-framework/evals/tier-1/validate-skill-structure.sh
bash test-framework/evals/tier-1/validate-chain-references.sh
bash test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-consumer-routing.sh
bash test-framework/evals/tier-1/validate-precommit-worktree-host-install-boundary.sh
bash test-framework/evals/run-all-evals.sh
node scripts/run-external-review.mjs --orchestrator codex --review-kind exec --candidate-digest <sha256> --artifacts-dir <dir> --context-root <worktree> --reviewer-config /home/svc-user/.svc/reviewer-policy-v2.json --reviewer-mode production --reviewer-phase exec --reviewer-station agy
git push -u origin framework-WI-530-skills-package-layout
node scripts/merge-pr-with-review-receipt.mjs --pr <number> --squash --delete-branch
./setup --host codex
bash scripts/check-install-drift.sh --host codex
for host_manifest in provision/hosts/*.json; do host="$(basename "$host_manifest" .json)"; ./setup --host "$host"; bash scripts/check-install-drift.sh --host "$host"; done
```

Expected outcome: source layout is packaged, every installed host surface remains flat, consumer-local skills remain non-authoritative for enforcement, preserved renamed worktrees resume without manual owner override or duplicate creation, no new Tier-1 regression appears, exact-candidate review is clean, and canonical-main all-host install/drift proves convergence.

## Closure gates

- Baseline and post-change comparison for manifest lint, structure, chains, setup, and drift.
- Exact proof that 103 skill bodies moved without accidental content loss.
- Focused execution proof for every rebased skill-local helper family and the root `test-framework/` split.
- Symlinked source directory/file and realpath-escape mutations fail before installation.
- No operational old-root lookup remains outside explicit negative/historical fixtures.
- Preserved-path branch-rename self-heal proves exact same-session recovery, all-generation lineage convergence, pre-intent and deterministic v2 resume, post-lease receipt forward-completion, two-surface rollback, and pre-mutation rejection of duplicate, foreign, outside-root, symlinked-state, and ambiguous-owner inputs.
- Central `svc-reconcile --help` is read-only, `--repo` selects the consumer worktree from any caller directory, and a consumer-local receipt checker cannot shadow the packaged helper.
- Feature-worktree pre-commit validates every host without live writes; canonical-main pre-commit/setup retains drift repair authority.
- Independent Sol and configured external reviewer report zero Critical/High.
- Governed squash merge followed by canonical-main setup/drift for every provisioned host manifest.
