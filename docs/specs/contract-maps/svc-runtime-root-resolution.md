# System Contract Map: SVC Runtime-Root Resolution and Skill Activation

**WI:** WI-506
**Status:** BASELINED
**Scope:** Host environment → shared resolver → runtime consumers → task graph and
Codex session receipt, plus pre-execution artifact classification at the plan-review
boundary. This map does not alter product authentication or Example Marketplace.

## Flow Diagram

```text
[AI host process environment]
          |
          | env + uid + home
          v
[shared SVC runtime resolver]
   | valid explicit/XDG       | XDG absent or ENOENT
   |                          v
   |                    [private home-cache fallback]
   |                          |
   +------------+-------------+
                | resolved secure leaf (snapshotted)
                v
       [isolation / completion / Codex session consumers]
                |
                v
 [authority preflight: graph + task + skill + claim/binding/lease + receipt path]
                |
                v
 [atomic graph activate] --> [atomic session receipt publish] --> [skill content]
                                  ^
                                  |
                         exact retry repairs crash gap

[canonical Git common directory]
                |
                v
 [refs/svc/authority-locks/<hash> holder blob]
                |
       exact-old-object update-ref CAS
                |
                v
 [claim / binding / ensure bootstrap / task migration critical sections]
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| Host process | Shared resolver | Process environment and OS metadata | `SVC_RUNTIME_DIR`, legacy Codex override, `XDG_RUNTIME_DIR`, `HOME`, uid | Environment | Operation-local snapshot | Runtime consumer | Missing path misclassified or hostile root trusted |
| Shared resolver | Consumer | Node function return or shell CLI stdout | Canonical absolute directory plus source/classification | Memory | Memory | Ephemeral lock/receipt path builder | Resolver drift between consumers |
| Repository authority lock | Claim/binding/bootstrap/migration mutator | Canonical Git repository | One `refs/svc/authority-locks/<sha256>` ref pointing to a holder blob | Shared Git common directory | Git ref transaction | Exact-old-object compare-and-swap followed by generation CAS | Blind stale unlink or per-process runtime roots split correctness serialization |
| Codex loader preflight | Task graph activator | Child Node process argv | Absolute graph, task id, skill, load source | Worktree graph bytes | Locked graph write | Codex enforcer | Graph mutates before storage or authority is known good |
| Codex loader | Session receipt | Atomic `0600` JSON write | Session, graph realpath, task, skill hash, authority generation/lease | Preflight snapshot | Secure runtime session directory | Codex mutation enforcer | Crash after activation leaves receipt absent |
| Shell completion guard | Shared resolver CLI | Node stdout/exit code | One canonical absolute directory | None | Shell variable | Completion counter/compat state | Shell forks policy or silently downgrades unsafe state |
| Upstream lane skills | Plan-review phase guard | No-rename Git diff plus durable receipt lookup | Exact pre-execution path allowlist, both sides of moves, and matching WI exec-record | Worktree | Operation-local classification | External reviewer launcher | Mandatory blend output falsely classified as implementation, or implementation hidden by an exempt rename destination |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| Valid XDG runtime parent | Login/session manager and current uid | Host session manager | Current user processes | Login session | Advertised path absent on WSL/container; unsafe existing root |
| SVC-owned runtime leaf | Current uid, mode `0700` | Shared resolver | SVC processes for current user | XDG session or fallback cache lifetime | Symlink/mode/owner substitution |
| Home-cache fallback | Current user's canonical home; SVC leaf mode `0700` | Shared resolver | SVC processes for current user | Persists across sessions; stale state governed by existing TTL/generation rules | Longer lifetime than XDG exposes stale evidence |
| Task graph | Repository/worktree | `task-graph.mjs` under graph lock | Framework tasks and guards | WI lifetime | Partial activation if next receipt cannot publish |
| Session skill receipt | Current Codex session, mode `0600` | `codex-load-skill.mjs` | Codex mutation enforcer | Session/task progression | Missing, stale, or mismatched receipt denies mutation |
| Correctness-lock refs | Repository Git common state | Shared authority-lock helper | Claim/binding/bootstrap/migration mutators | One critical section; one stable holder blob per process until Git GC | Proven-dead takeover and release require exact-old-object `update-ref` CAS; malformed/cross-host/uncertain identity fails closed; failed release returns `lock_release_error`, operation result, and exact ref/OID instead of ordinary success |
| Claims/bindings/leases | Repository shared `.svc` state | Authority helpers | All host guards | WI/lease lifetime | Foreign/stale/ambiguous ownership must deny or generation-transfer exactly |

`refs/svc/authority-locks/**` is machine-local coordination state even though it
lives in the Git common directory. Ordinary push/fetch refspecs do not include
it. Mirror-style `+refs/*:refs/*` push/fetch configurations must explicitly
exclude `refs/svc/**`; importing a foreign holder correctly fails closed and
requires the diagnostic's independently verified exact-OID operator recovery.

## External Platform Invariants

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| A conforming XDG runtime directory is user-owned and mode `0700` | freedesktop XDG Base Directory Specification | `lstat` selected XDG root; compare uid/type/mode | verified-source |
| `/run/user/<uid>` is session-manager state and may not exist when systemd is not init | `pam_systemd(8)` | `test -d /run/user/$(id -u)` on target host | verified-runtime: absent |
| A user-cache fallback is established precedent when runtime state is unavailable | GLib `g_get_user_runtime_dir()` documentation | Run resolver with XDG unset/missing and private HOME | verified-source; SVC policy is stricter |
| Current host exports an invalid-but-set XDG path | WI-506 reproduction | `printf '%s\n' "$XDG_RUNTIME_DIR"; lstat /run/user/1000` | verified-runtime |
| External framework temp fail-open behavior is advisory, not authorization | Open GSD pinned source | Inspect context monitor consumers and denial effects | verified-source |
| Existing SVC graph activation is atomic but precedes session storage and authority resolution | `scripts/codex-load-skill.mjs` | Trace call order and inject invalid runtime path | verified-code/runtime |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| Missing XDG is the only host defect | Missing `/run/user/1000` reproduces failure | Valid XDG still fails in same call | confirmed only for invalid host case | WI-506 bootstrap stderr and valid-XDG fixtures |
| Every non-working XDG path should fall back | ENOENT succeeds through home fallback | Existing symlink/world-readable/foreign root also falls back | rejected; unsafe existing roots must deny | RP-02/RP-03 design matrix |
| Root selection alone fixes loader integrity | No-override loader succeeds | Authority failure after graph activation still changes graph | rejected; ordering also required | current loader source trace |
| Cross-file atomicity can be guaranteed | One transaction commits graph and session receipt | Filesystems/roots admit one atomic primitive across both files | rejected | two-storage-boundary analysis |
| Exact retry can repair the unavoidable crash gap | Failpoint after activation then same load publishes receipt | Retry creates a second activation or changes a complete receipt | verified locally | `validate-codex-first-task-activation.sh` graph-first crash, recovery, and byte-stability cases |
| Shell can safely retain its own fallback | Shell and Node always resolve identical path/classes | Matrix finds any source/classification divergence | rejected; shell must consume resolver CLI | planned pattern gate |
| All `references/**` are planning-only | Mandatory blend files can precede review | Executable or framework-operational references can be hidden by a broad exemption | rejected; allow only exact blend outputs | `validate-external-review-launcher.sh` blend-only PASS and executable-knowledge DENY cases |

## Old Path / New Path Proof

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| `XDG_RUNTIME_DIR=/run/user/1000/`, directory absent, canonical ensure | `EACCES` creating `/run/user/1000/svc-ensure-worktree-1000` | Repository Git-ref CAS lock is independent of XDG and canonical ensure completes | Corrects availability without creating host runtime parent or a persistent runtime correctness lock | `.svc/wi506-cross-system-probe.json`; post-land ensure replay still required |
| Same invalid XDG, Example Marketplace WI-496 canonical loader | Graph may activate, then `lstat('/run/user/1000')` fails before session receipt | Local framework loader now preflights fallback and authority, then publishes both receipts | Removes partial predictable failure | loader transaction fixture; promoted Example Marketplace replay still required |
| Existing XDG root mode `0755` | Consumer behavior varies | Ephemeral authority-receipt consumers deny before mutation; Git correctness locks remain independent of XDG | Central policy preserves security without coupling correctness locks to runtime state | `validate-runtime-root-portability.sh` unsafe-root matrix |
| Valid XDG root mode `0700` | Existing tests succeed in consumer-specific paths | Ephemeral consumers succeed through the shared resolver; correctness locks use Git CAS | Valid installations remain compatible | `validate-runtime-root-portability.sh` valid-XDG and cross-consumer cases |

## Iteration Escalation

If WI-506 reaches a third diagnosis/fix invocation within 14 days for this same
runtime-handoff contract, halt implementation, mark the WI cross-system
suspected, and require `review-cross-model` of the diagnosis and this map before
resuming. Do not weaken guards or manually repair graph/receipt state.
