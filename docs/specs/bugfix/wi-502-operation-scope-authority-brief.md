# WI-502 Bugfix Brief: operation scope is not session cwd

## Reproduce

**Trigger:** invoke the Codex PreToolUse enforcer with top-level `cwd` and explicit tool `workdir`/patch targets pointing at different repository scopes.
**Expected:** authority follows the canonical operation workdir and all canonical mutation targets while preserving session repository context separately.
**Actual:** authority follows only top-level session `cwd`, producing both false denials and false permits.

**Causal class:** boundary propagation bug. The host supplies operation-specific scope but the normalization layer drops it before Git/worktree and authority resolution.

## Targeted reading and classification

| Surface | Classification | Evidence |
|---|---|---|
| `hooks/codex/lib/codex-hook-context.mjs` | drift | `hookContext` resolves `payload.cwd` and ignores explicit tool workdir. |
| `hooks/codex/svc-codex-skill-load-enforcer.mjs` | drift | Exact receipt checks are sound only after the wrong repository is selected. |
| `hooks/svc-worktree-isolation-guard.mjs` | partial match | It realpaths existing parents and finds Git context, but parses incomplete targets and still starts from session cwd. |
| `hooks/lib/hook-payload.mjs` | gap | Normalizes top-level cwd and only the first patch path; no canonical operation-scope object. |
| `hooks/lib/resolve-wi.mjs` + `hooks/lib/wi-claim.mjs` | partial match | Strong exact tuple/generation checks, but no repository digest, lease lifecycle, handover, or delegation. |
| execute/dispatch references and scripts | gap | No pre-issued child capability; current worker result is post-hoc and can claim parent graph mutation. |

## Root cause

The framework conflates session context with operation scope, and its path parsing is fragmented across guards. This was enabled by an outdated Codex payload assumption and compounded by a claim model designed for immutable single-session ownership. The absence of one normalized scope object means later exact checks can be internally correct while authorizing the wrong repository.

## Smallest safe fix surface

The first reversible slice is a shared pure operation-scope resolver plus red/green fixtures, consumed by the existing enforcer and worktree isolation guard. It must preserve current claim/binding semantics while correcting only which exact worktree is presented to authority. Lease/handover and delegation then layer on the proven scope primitive; they must not be mixed into the first red/green patch.

## Pattern Scan

| Family | Current entries | Finding |
|---|---:|---|
| Codex `hookContext` consumers | 3 | prompt authority, skill enforcer, and stop firewall share session-cwd context. Mutation path must consume operation scope; read/prompt paths retain session context. |
| Shared `resolveWI`/target consumers | 6 | impact triad, stop quality, isolation guard, Codex context, and two session validators require explicit distinction between session and operation scope. |
| Mutation-target parsers | 2 | `hook-payload` and `svc-worktree-isolation-guard` are incomplete and divergent. |
| Claim/binding consumers | 10+ | migration requires compatibility adapter and exact inventory; no silent v1→v2 authority. |
| Dispatch/merge-back surfaces | 8 | current within/multi-WI contracts lack capability acceptance, generation, inner-worktree requirement, and receipt digests. |

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | unaffected | Deterministic worktree isolation remains the product intent in WI-484/WI-486. |
| 2 | Journey | affected | J-FW-05 ends at static binding; add explicit workdir, handover, child, and containment scenarios. |
| 3 | Acceptance criteria | affected | Existing SIB criteria do not cover tool workdir or delegated child rights; WI-502 adds exact negative matrices. |
| 4 | UX | unaffected | No user-facing interaction; CLI messages become more precise. |
| 5 | UI | unaffected | No visual artifact exists. |
| 6 | Tech architecture | affected | Introduce canonical operation scope, v2 lease store, delegation, and execution graph. |
| 7 | Cost model | affected | Preserve zero paid hot-path cost and bound Git subprocess/cache behavior. |
| 8 | Operations & ownership | affected | Add renew/resume/handover/recovery/revoke/adopt lifecycle and containment capability reporting. |

## Verification plan

- Controlled hook payload fixture proves all three current regressions red before code and green after scope resolver integration.
- Hermetic nested repo/submodule/symlink/new-file/mixed-worktree matrices.
- CAS handover/recovery race fixtures with old-generation denial.
- Two-child disjoint execution wave plus overlap serialization, scope-violation rejection, sequential merge-back, and handover freeze/adopt replay.
- Host capability matrix proves sandbox/wrapper presence or explicit unsupported mutation state; no syntax parser is credited as containment.
- Full Tier-1 suite and post-commit focused rerun.

## Affected artifacts

See WI-502 plus its feature spec, solution-confidence record, J-FW-05, plan manifest, focused validators, and host capability documentation.

## Learnings

Authority resolution must begin with a canonical operation-scope proof. Exact task receipts cannot repair a repository selected from the wrong input, and process relationships cannot substitute for persisted delegation authority.

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | WI-484/WI-486 invariant retained. |
| 2 | Journey | [UPDATED] | J-FW-05 planned scenarios FW05-S13..S16. |
| 3 | Acceptance criteria | [UPDATED] | WI-502 OS/SB/AU/DG criteria. |
| 4 | UX | [N/A — justified] | Headless framework mutation guard. |
| 5 | UI | [N/A — justified] | No visual surface. |
| 6 | Tech architecture | [UPDATED] | WI-502 technical design. |
| 7 | Cost model | [UPDATED] | Local-only bounded checks and cache invalidation. |
| 8 | Operations & ownership | [UPDATED] | Lease/delegation lifecycle contract. |
