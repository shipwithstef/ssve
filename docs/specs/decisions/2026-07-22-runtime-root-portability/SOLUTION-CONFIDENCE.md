# Solution Confidence: Permanent SVC Runtime-Root Portability

**WI:** WI-506
**Mode:** design_auto
**Decision:** SELECTED — shared secure resolver plus loader preflight and exact retry
**Confidence:** High (9/10 design confidence; runtime proof pending implementation)

## 1. User Ask And Confidence Bar

The user wants a permanent, host-agnostic framework solution—not environment
commands they must remember. Planning is justified only if the design works
under the original invalid WSL XDG environment, preserves fail-closed authority,
and can prove the original Example Marketplace WI-496 loader succeeds with no override.
Example Marketplace splash product code and diagnosis remain out of scope.

## 2. Current Picture

The host exports `XDG_RUNTIME_DIR=/run/user/1000/`, but the directory is absent.
`svc-ensure-worktree` attempts to create a child there and fails. The Codex
loader activates a graph before resolving its session directory and authority,
so the same host defect can leave a graph ahead of the session receipt. Six
runtime consumers encode related but different policies. This affects CLI and
AI-host bootstrap/guards on Linux, WSL, and container-like environments; web,
mobile, native app, UI, and user perception are N/A except that framework delay
blocks the separate Example Marketplace native diagnosis.

## 3. Why The Current Design May Exist

WI-486 introduced session-isolated private runtime evidence. WI-498 made graph
activation atomic and install-anchored. WI-502 and WI-505 strengthened authority
generations and stale transfer. Each solved its immediate boundary, and valid
Linux XDG plus unset-XDG tests passed. The untested state was a host advertising
a runtime directory that does not exist. The current comments are therefore
locally reasonable but incomplete; the correct change is to centralize their
shared assumption, not weaken the later authority work.

## 4. Constraint Profile

- Dependency-free Node/shell framework across multiple AI hosts.
- No root privileges and no authority to create session-manager directories.
- Existing claims, bindings, leases, graphs, and residue must be preserved.
- Security failures must deny; availability failures may choose a private user fallback.
- Install refresh and exact real-host replay are mandatory before completion.
- Reversible by code revert; no durable authority schema migration.

## 5. Freshness And Cache Classes

| Class | State | Freshness | Invalidation owner |
|---|---|---|---|
| Operation-local | Resolved canonical root | Recomputed per command/hook | Caller operation |
| Session ephemeral | Valid XDG SVC leaf | Login session | Host session manager |
| User-device cache | Home fallback SVC leaf | Cross-session | Existing lock TTL/PID and authority generation logic |
| Durable repository | Graph, claims, bindings, leases | WI/lease lifecycle | Framework CAS/task graph |
| Session evidence | Skill receipt | Current exact task/skill/authority | Authorized next load |
| Web/mobile/provider/media | N/A | N/A | N/A |

The design does not use a process-global cache because host state can change
between commands. The persistent fallback caches location only; it does not
make old lock/authority content valid.

## 6. Cost Model

Current and target paths use only local filesystem operations. The target adds
a handful of `lstat`/realpath checks per operation and one short Node resolver
process in the shell Stop guard. Provider/API cost, bandwidth, mobile memory,
and recurring cloud cost remain zero. Storage remains KB-scale. The target
reduces support cost by replacing manual per-session overrides with a tested
contract. A material Stop-hook latency increase is the only performance revisit
trigger.

## 7. World Grounding

| Example | Source | Design lesson |
|---|---|---|
| XDG Base Directory Specification | https://specifications.freedesktop.org/basedir-spec/latest/ | A valid runtime root is user-owned, `0700`, and session-scoped; SVC must validate rather than assume. |
| `pam_systemd` | https://www.freedesktop.org/software/systemd/man/latest/pam_systemd.html | `/run/user/<uid>` is created by the session manager and may be absent when systemd is not init; SVC must not manufacture it. |
| GLib `g_get_user_runtime_dir` | https://docs.gtk.org/glib/func.get_user_runtime_dir.html | Mature cross-platform libraries use a user-cache fallback when a runtime directory is unavailable. |
| gstack 1.60.1.0 | https://github.com/garrytan/gstack/blob/a3259400a366593e0c909dd9ac3e59752efd2488/bin/gstack-paths | One explicit path resolver makes host fallbacks inspectable; SVC must add stricter trust validation. |
| Open GSD 1.8.0 | https://github.com/open-gsd/gsd-core/blob/936a3453810470182421051301f6a0a83552bf89/hooks/gsd-context-monitor.js | Temp fail-open is appropriate when state is advisory; it must not be copied to authorization state. |
| GSD 2 3.0.0 | https://github.com/gsd-build/gsd-2/blob/33c00aaffa56e5d394bccce1c8df59fb842e84c5/src/resources/extensions/gsd/session-lock.ts | Snapshot lock paths and recover exact partial ownership state by bounded retry. |
| Superpowers 6.1.1 | https://github.com/obra/superpowers/blob/d884ae04edebef577e82ff7c4e143debd0bbec99/docs/porting-to-a-new-harness.md | Keep invariants in a portable core and host mechanics in thin install-owned adapters. |

The standards do not explicitly prescribe invalid-but-set XDG behavior. The
unavailable-versus-hostile classification is an SVC inference grounded in both
the standard's trust requirements and the real WSL failure.

## 8. Options Considered

1. **Selected:** shared resolver, private home fallback for unset/ENOENT, deny
   unsafe existing roots, preflight loader, exact retry.
2. Keep current policies and only special-case `/run/user/1000` in bootstrap.
3. Use `os.tmpdir()` universally and treat all path failures as advisory.
4. Always use home cache and ignore XDG.
5. Add a runtime daemon or external lock library.

## 9. Tradeoff Matrix

| Option | Quality/security | Local cost/latency | Mobile memory | Size | Reversibility | Operational risk | User perception |
|---|---|---|---|---|---|---|---|
| Shared strict resolver + retry | Highest | Tiny metadata/one shell Node startup | N/A | Medium | High | Lowest after full install refresh | Permanent/self-healing |
| One bootstrap special case | Low; other consumers diverge | Lowest | N/A | Small | High | High recurring failures | Looks fixed until next guard |
| Universal temp/fail-open | Low for authority | Low | N/A | Small | High | Security downgrade | Convenient but unsafe |
| Always home | Good if secured, loses session semantics | Low | N/A | Medium | High | Stale-state support burden | Reliable but less native |
| Daemon/dependency | Potentially high | Highest | N/A | Large | Lower | New lifecycle/failure surface | Overbuilt |

## 10. Action-by-Action Approval Packet

| Proposed action | Why this action exists | How it would be achieved | Positive outcome | Negative / risk | Impact if skipped | Required proof before closeout |
|---|---|---|---|---|---|---|
| Add one secure runtime resolver | Six policies caused the host gap and drift | Dependency-free Node module classifying explicit, valid XDG, unavailable XDG, and unsafe state | One portable contract | Framework-wide blast radius | Next consumer can still fail differently | Full classification and direct-policy pattern matrix |
| Add private home fallback | Invalid-but-set missing XDG blocks supported WSL/container hosts | Use canonical user home cache with `0700` SVC leaf; never create advertised XDG parent | No remembered environment command | Persistent directory needs stale-state discipline | Original host remains blocked | No-override ensure and loader replay on absent `/run/user/1000` |
| Preserve fail-closed unsafe-root behavior | Blind fallback could hide attacker-controlled state | Reject symlink/non-dir/foreign/mode-unsafe roots and ambiguous access errors | Security boundary remains strict | Some misconfigured hosts still need permission repair | Portability fix becomes authority bypass | Unsafe, symlink, foreign-owner fixtures deny before mutation |
| Migrate all Node consumers | A shared module is useless if direct forks remain | Replace local selection code and pass operation-local snapshots | Cross-consumer parity | Broad edit set | Hidden old path can still wedge framework | Consumer matrix and pattern gate show no unauthorized direct policy |
| Bridge shell through resolver CLI | Completion guard currently owns another fallback | Path-only stdout Node CLI; unsafe-root rejection becomes explicit advisory-only completion pressure while authority consumers deny | Node/shell classification parity without session trapping | Small Stop-hook startup cost and deliberate non-authority degradation | Shell can write insecure state or repeatedly block | Shell/Node matrix, no-write assertion, and timing measurement |
| Reorder loader preflight | Predictable runtime/authority failure currently occurs after graph activation | Resolve receipt target and current authority before `activate-skill` | Predictable rejection is byte-identical | Authority can still race after preflight | Partial state persists on normal failures | Graph and receipt hashes unchanged for every preflight failure |
| Define exact crash retry | Two files cannot share one atomic filesystem transaction | Only graph-first partial state; enforcer denies; exact retry idempotently publishes receipt | Recoverable without deletion/manual repair | Brief denied state after process crash | Crash can wedge task activation | After-activation failpoint, exact retry, complete retry byte-stable |
| Refresh every install and replay WI-496 | Repo tests do not prove installed host behavior | Land, reinstall supported hosts, drift check, run original canonical command without override | Real permanent proof | Installation skew during rollout | Fix exists only in source checkout | Final-SHA receipts, zero install drift, original command twice, unchanged Example Marketplace tree |

## 11. Outcome Coverage

| Category | Best credible outcome | Worst credible outcome | Mitigation |
|---|---|---|---|
| Product UX | Example Marketplace diagnosis proceeds normally | Framework still blocks it | Original WI-496 replay gate |
| Web/mobile/native | No product behavior changed | Accidental product mutation | Separate repos and tracked-tree hashes |
| Data correctness | Authority evidence remains exact | Fallback validates stale evidence | Existing generation/PID/TTL checks unchanged |
| Cost/credits/provider | No recurring cost | N/A | No external service/dependency |
| Cache/freshness | Fallback survives missing session manager safely | Persistent stale locks linger | Exact stale-owner and generation logic, no directory-validity shortcut |
| Scalability | O(1) metadata per operation | Stop hook latency grows | Timing check and single CLI call |
| Complexity | One policy removes six forks | Resolver becomes overgeneralized | Consumer-leaf interface only; no daemon/classes |
| Reversibility | One reviewed revert | Mixed installs after rollback | Drift checks and one-cycle install refresh |
| Support/ops | Actionable errors and no manual override | Unsafe host correctly remains denied | Error identifies classification/remediation |

## 12. Decision Or Remaining Unknowns

Select the shared strict resolver plus loader preflight/exact retry. Design
confidence is 9/10. Remaining unknowns are implementation evidence, not design
choices: exact Stop-hook timing and successful promoted WI-496 replay. Those are
hard proof gates and cannot be waived.

## 13. Base44/AI Suggestions Triage

| Suggestion | Classification | Reason |
|---|---|---|
| Set `XDG_RUNTIME_DIR` to a private cache path per command | reject as permanent solution | Useful only for self-bootstrap; requires remembered workaround and proves nothing after install |
| Centralize runtime paths like gstack | modify | Adopt the interface, add SVC ownership/mode/failure classifications |
| Use Open GSD-style `os.tmpdir()` and never block | reject | Its files are advisory; SVC files authorize mutation |
| Import GSD 2 `proper-lockfile` | reject | Lock backend does not solve root trust or loader ordering |
| Use Superpowers-style host adapters | adopt as existing direction | SVC already separates installed host mechanics; preserve it |
| Modify Example Marketplace splash/auth code now | unrelated | Product diagnosis remains a separate WI-496 task after framework replay |

## 14. User-Facing Summary

- The permanent fix is one secure framework path resolver, not two commands or
  a shell profile workaround.
- A missing advertised runtime directory falls back automatically to private
  user storage; an existing unsafe directory still blocks.
- The loader will prove storage and authority before changing the task graph.
- A crash in the final two-file handoff is repaired by repeating the exact same
  authorized load—never by deleting state.
- The change adds no service, package, provider cost, or product-code mutation.
- Completion requires installed no-override replay of the original Example Marketplace
  WI-496 command, twice, with both receipts aligned and product files unchanged.
