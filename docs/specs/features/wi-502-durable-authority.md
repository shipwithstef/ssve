---
status: BASELINED
type: Enabler
mode: contract-change
wi: WI-502
landscape_state: inapplicable
landscape_inapplicable_reason: internal framework authority and filesystem-containment contract with no customer-facing market flow
created: 2026-07-20
---

# Feature: Canonical operation scope and durable authority

**Status:** VERIFIED

**Verification confidence:** VERIFIED-L3 — headless framework behavior is covered by promoted-commit structural and behavioral fixtures; no browser, native, or deploy surface applies.
**Consumers:** Codex mutation hooks, shared worktree guard, controller/bootstrap tooling, execute-changeset, dispatch-waves, mutating child workers, merge-back validators
**Source of truth:** `docs/specs/work-items/WI-502.md`

## Delta contract

**Preserved:** unbound governed mutation denies; exact worktree/WI/task/skill authority remains mandatory; foreign state never grants authority; read-only inspection stays available; parent lane ordering remains sequential; default-checkout residue remains untouched.

**Changed:** authority uses canonical operation workdir and canonical targets instead of session cwd alone; claims evolve into versioned controller leases; control can move atomically; mutating children use explicit scoped capabilities and inner worktrees; merge-back is receipt-bound and sequential; containment support is explicit per host.

**Non-goals:** a complete shell parser, policy inference from agent names, concurrent writes to one worktree, overlapping child scopes, implicit v1 state migration, child self-merge, or cross-repository capability inheritance.

## System architecture

```text
Host event
  session context: session_id + session_cwd + optional agent_id
  tool input: verified adapter fields only
           |
           v
  Canonical Operation Scope
  - preserve session repo
  - resolve explicit workdir
  - parse every structured target
  - realpath target / nearest parent
  - exact worktree + repo_id
  - contradiction/mixed-scope result
           |
           +--> read-only: allow under existing read contract
           |
           v
  Authority Resolver
  controller? -> active v2 lease + exact generation + task/skill receipt
  child?      -> accepted delegation + parent generation + exact inner worktree + path fence
           |
           v
  Host containment adapter
  sandbox/wrapper available -> execute inside allowlisted worktree
  unavailable -> controller shell limited to documented guardrail; mutating child unsupported
```

```text
one WI lane graph
  execute-changeset [in_progress]
      |
      v
  execution graph v1
    wave-1: task-A + task-B (disjoint, separate inner worktrees)
    wave-2: task-C (blocked by A/B or shared/unknown scope)
      |
      v
  parent validates receipts and merges A then B, revalidating after each
```

## Canonical operation-scope contract

The normalized object is pure data and is produced before any mutation authority decision:

```json
{
  "schema_version": 1,
  "host": "codex",
  "tool_name": "Bash|apply_patch|Edit|Write|mcp__...",
  "session_cwd": "/canonical/session/cwd",
  "session_repository": { "repo_id": "sha256", "worktree_root": "/canonical/root" },
  "explicit_workdir": { "present": true, "source": "tool_input.workdir", "canonical": "/canonical/op/cwd" },
  "effective_workdir": "/canonical/op/cwd",
  "targets": [
    { "role": "update|add|delete|move_source|move_destination|path", "requested": "x", "canonical_anchor": "/real/anchor", "repo_id": "sha256", "worktree_root": "/real/root" }
  ],
  "operation_repository": { "repo_id": "sha256", "worktree_root": "/canonical/op/root" },
  "contradictions": []
}
```

Rules:

1. `session_cwd` is canonicalized once and never overwritten by tool input.
2. A host adapter declares which explicit workdir keys are trusted for each tool. Unknown lookalike fields are ignored, not promoted to authority.
3. Relative explicit workdir resolves against `session_cwd`; explicit mutation workdir must exist, be a directory, survive `realpath`, and map consistently.
4. Existing targets use their own `realpath`; new targets walk to the nearest existing parent, realpath that parent, then append the lexical remainder while rejecting symlink/`..` escape.
5. Git identity comes from canonical `git rev-parse --show-toplevel` and canonical `--git-common-dir`; `repo_id=sha256(canonical-common-git-dir)`.
6. Every patch directive is parsed. Rename/move source and destination are both mutation targets.
7. Zero structured file targets is valid for Bash but not proof of containment. One target worktree is valid only when it agrees with explicit workdir. More than one worktree/repo denies.
8. Nested independent repositories and submodules naturally produce a distinct `repo_id`; parent authority does not cover them.
9. A structured sanctioned command validates the resolved executable and its explicit graph/script/worktree operands against the same operation scope.

## Bash boundary

The shell analyzer is deliberately a rejection layer, not the containment proof. It recognizes and rejects obvious escaping forms such as `git -C`, `cd`/`pushd` command segments, absolute mutation operands, and absolute output redirections. Unknown syntax remains governed.

Filesystem containment is supplied by a host sandbox or a wrapper that starts the command with write access restricted to the authorized worktree plus explicitly declared runtime paths. Host capability discovery is versioned and tested. A host without enforceable containment may run controller commands under the documented guardrail but cannot launch a mutating delegated child.

## Principal and repository identity

```json
{
  "host": "codex",
  "session_id": "stable-host-session-id",
  "agent_id": null,
  "principal_id": "sha256(host + NUL + session_id + NUL + optional-agent-id)"
}
```

- Mutation requires a stable host session/thread id.
- Use `agent_id` only when present on the mutation event or bound through a trusted dispatch adapter.
- Codex subagent hooks reuse the parent session id, so `agent_id` must be persisted at dispatch and presented through the trusted worker channel; otherwise child mutation is unsupported.
- Agent names, roles, branches, graph paths, and environment flags are never identity proof.

## Controller lease v2

The authoritative store is repository-shared state keyed by `repo_id` and WI, updated under the existing secure repository lock with atomic write + compare-and-swap revision. Worktree-local bindings remain caches/compatibility evidence, never the v2 source of truth.

```json
{
  "schema_version": 2,
  "lease_id": "uuid",
  "repo_id": "digest",
  "wi": "WI-502",
  "worktree_root": "/canonical/worktree",
  "controller_principal": "principal-id",
  "generation": 7,
  "state": "active",
  "issued_at": "ISO",
  "renewed_at": "ISO",
  "expires_at": "ISO",
  "backend_revision": 12
}
```

### Lease state machine

```text
absent --bootstrap--> active(g=1)
active --same principal resume/renew--> active(same generation)
active --handover prepare--> active + pending one-time handover
active --handover accept CAS--> active(new principal, g+1)
active --positive dead-owner recovery/expiry CAS--> active(recoverer, g+1)
active --release--> released
corrupt/ambiguous -------------------------------> deny, manual recovery only
```

Generation changes invalidate prior mutation receipts, delegation capabilities, and merge receipts. Prepare never creates a second controller. Accept consumes the token atomically and freezes old-generation delegations. Recovery records the liveness/expiry evidence and never displaces a provably live owner.

## Delegation capability

Delegations are stored before worker launch and accepted once through a token/dispatch channel. Allowed path patterns are normalized repo-relative globs; denied paths win. Each mutating task has an independent inner worktree rooted at `base_sha`.

```json
{
  "schema_version": 1,
  "delegation_id": "uuid",
  "parent_lease_id": "uuid",
  "authority_generation": 7,
  "child_principal": "principal-id",
  "wi": "WI-502",
  "task_id": "exec-task-3",
  "wave_id": "wave-2",
  "inner_worktree": "/canonical/child-worktree",
  "allowed_paths": ["hooks/lib/**", "test-framework/evals/tier-1/x.sh"],
  "denied_paths": [".svc/**", ".git/**"],
  "base_sha": "40-char-sha",
  "expires_at": "ISO",
  "max_depth": 0,
  "status": "issued"
}
```

### Delegation state machine

```text
issued -> accepted -> running -> completed
   |         |          |
   +-------> revoked <---+
   +-------> expired
running ----> failed
old generation -> frozen -> adopted(new delegation) | revoked | restarted
```

The child cannot change the controller lease, parent graph, sibling results, or shared receipts. Only the parent controller updates the nested execution graph after validating child output.

## Partition fence

Before a wave is runnable:

1. Resolve expected write scope for every leaf task.
2. Expand known one-hop generated/caller/test dependencies.
3. Classify lockfiles, migrations, root config, `.svc`, schemas, and other shared resources.
4. Require pairwise-disjoint normalized scopes within the wave.
5. Serialize unknown, generated-unknown, shared, or overlapping scopes.
6. Freeze each task's base SHA and capability digest before dispatch.

## Completion and merge-back

Child completion receipts use a JSON schema and contain delegation/principal/generation/task/base/head/commits/files/diff digest/validation digests/cleanliness/time. The parent recomputes every value from the inner worktree, requires `head_sha` to descend from `base_sha`, and rejects undeclared or denied files.

Merge-back is always sequential. After each merge, the parent records source commit to integration commit, reruns mapped validation, checks whether the next receipt's assumptions remain valid, and updates the execution graph. Holistic review/test gates run after the complete wave.

## Failure behavior

| Failure | Required behavior |
|---|---|
| Child timeout | revoke; retain worktree and logs |
| Child crash | failed; never merge unreceipted work |
| Scope violation / unknown file | reject receipt and revoke |
| Controller generation changed | freeze; explicit adoption decision |
| Merge conflict / invalidated base assumption | `merge_rejected`; serialize remediation |
| Parent exits | children may finish; cannot merge themselves |
| Child delegates at depth 0 | deny |
| Two children accept one task | atomic accept yields one winner |
| Missing stable child identity | mutating delegation unsupported |
| Missing sandbox/wrapper containment | mutating delegation unsupported |

## Compatibility and rollout

1. Add red fixtures and canonical scope resolver; integrate existing v1 authority unchanged.
2. Add v2 store and explicit migration CLI. Dual-read may diagnose v1, but only an explicit migration creates v2 authority. Backup and rollback restore exact bytes.
3. Add nested execution graph/delegation in opt-in shadow validation, then enforce only when host identity and containment capabilities pass.
4. Migrate installed hosts through `./setup --host <host>`; capability check and installed-source drift check run before enabling.
5. No release may claim complete Bash security. Documentation and denial messages identify whether rejection came from authority scope or containment capability.

## Cost model

| Path | Current | Target | Bound |
|---|---|---|---|
| Hook mutation check | several Git/process reads with fragmented parsing | one scope resolution + cached Git identity + lease/capability lookup | local CPU/I/O only; zero provider calls |
| Lease renew/resume | claim file checks | one locked CAS only when renewal threshold reached | no write on every tool call |
| Child dispatch | prose + worker process | inner worktree + capability/receipt files | one worktree per active mutating child; bounded cleanup |
| Merge validation | changed-file list | Git ancestry/diff/digest + mapped tests | sequential and proportional to task diff |
| External review | plan/review gates | unchanged | paid/model calls never enter mutation hot path |

Cache invalidation owners: Git identity cache invalidates on canonical cwd/common-dir mismatch; lease cache on backend revision/generation; capability cache on status/expiry/generation; path classification is per tool call and is not reused across different targets.

## Operations

**Owner:** framework maintainers.
**SLO:** false permit is zero tolerance; false denials must return one exact recovery reason and command.
**Audit:** lease lifecycle, handover/recovery, delegation issue/accept/revoke/adopt, completion, and merge mapping receipts.
**Recovery:** same-session reattach; prepared handover; positive-liveness/expiry recovery; exact-byte v1 rollback; child revoke and retained worktree inspection.
**Cleanup:** released/expired child worktrees only after receipt/log retention policy and parent confirmation.
**Monitoring:** focused Tier-1 matrices plus installed-host capability/drift probe; no external telemetry requirement.

## Acceptance and test mapping

The normative AC text is in WI-502. Test ownership:

| AC family | Primary proof |
|---|---|
| OS-01..10 | `validate-operation-scope-authority.sh` hermetic host payload, patch, symlink, nested Git, and structured-command matrix |
| SB-01..04 | `validate-shell-containment-contract.sh` rejection matrix + host capability fixtures + documentation assertions |
| AU-01..07 | `validate-controller-lease-handover.sh` bootstrap/resume/CAS/handover/recovery/migration races |
| DG-01..10 | `validate-delegated-execution-authority.sh` wave partition, child hook, receipt, merge, failure, and adoption replays |

No browser/native E2E applies. Headless controlled payload and temporary Git repository fixtures are the behavioral proof.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | Framework isolation and deterministic pipeline goals remain unchanged. |
| 2 | Journey | [UPDATED] | J-FW-05 scenarios extended. |
| 3 | Acceptance criteria | [UPDATED] | WI-502 normative OS/SB/AU/DG families. |
| 4 | UX | [N/A — justified] | Headless framework enabler; CLI recovery text only. |
| 5 | UI | [N/A — justified] | No visual surface. |
| 6 | Tech architecture | [UPDATED] | Architecture, schemas, states, migration, and failure tables above. |
| 7 | Cost model | [UPDATED] | Bounded local-only hot path above. |
| 8 | Operations & ownership | [UPDATED] | Lease/delegation lifecycle, SLO, audit, recovery, and cleanup above. |
