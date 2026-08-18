# Solution confidence — WI-548 portable host-parity program

**Date:** 2026-08-17
**Mode:** `post_design_human_gate`
**Planning WI:** WI-548
**Selected design:** Portable Outcome Contract + Capability-Declared Adapters (POCCA)
**Implementation:** not authorized by this artifact; children stay inactive until the owner accepts the planning PR

## 1. User ask and confidence bar

The user asked for one authoritative, reviewed plan covering every improvement
found during WI-542/WI-543 and the Grok/Cursor/AGY parity investigation.
Planning only: no runtime implementation. WI-547 and PR #10 are already landed.
no default-checkout edits.

“Good enough to plan” means: every listed item has a disposition, architecture
questions have a selected option with rejected alternatives, children are
independently landable, and landed WI-547 / PR #10 are not re-opened.

Out of scope: implementing children, re-running WI-542 AGY reviews, repairing
`.wi543.bak`, adding a Grok key to the owner reviewer policy file.

## 2. Current picture

Product goal: a governed skill/runtime framework that can finish product
delivery on whichever host the owner actually has, without false “done.”

Affected surfaces: receipt notes, external-review artifacts, chain-policy,
Stop adapters, host wirers, dispatch/review launchers, worktree create/remove,
auto-drive / verify-promotion.

Current runtime: WI-542/WI-543 SessionStart behavior is proven on merged
`a4d0efa3`. WI-547 landed as PR #11 (`7bca62f3`) during this planning run;
`check-chain-receipts --sha f27a143a` now passes from canonical main. PR #10
is merged as `223436ab`. Local default checkout is dirty and must not be
mutated. This planning branch is based on `origin/main` `223436ab`.

## 3. Why the current design may exist

Chesterton’s fence:

- Git notes exist because receipts must be pushable and SHA-bound (mandatory
  chain, 2026-05-13).
- `.svc/chain-policy.json` is gitignored because refuse/warn is machine-local.
  That made linked worktrees silently warn — a side effect, not the intent.
- Claude-compat on Grok existed so Grok could run before native TOML hooks
  were proven. WI-543 then found the native tables were the wrong shape.
- `resolve-adversarial-reviewer.sh` remaps unknown hosts to Claude because
  the first reviewers were Claude/Codex only. That is now the opposite of
  owner intent.
- Auto-drive synthesizes minimal proof because a real fresh Grok session
  could not be launched from the previous process. The owner became the bus.

## 4. Constraint profile

- Planning worktree only; default checkout and WI-547 worktree are read-only.
- Chain policy on this machine is `refuse`.
- Owner reviewer policy `fast-local` names only `claude` and `codex`
  orchestrators; AGY is optional. This Grok session must not remap.
- Planning fixtures must not invoke paid providers.
- Do not allocate duplicate WI numbers. 544–547 are taken. Children are 549–553.
- Reversibility: each child rolls back independently.

## 5. Freshness and cache classes

| Class | What | Invalidation owner |
|---|---|---|
| Immutable | Review artifact bytes (SHA-256 objects) | content change = new id |
| Point-in-time | Dispatch policy, chain-policy | next invoke re-reads |
| Session-cached | Session override, continuation baton | session end / receipt |
| Regenerable | `.svc/receipts/<sha>/` mirror | rebuild from notes |
| Must be real-time | Entitlements, station availability | resolver at `now` |
| Historical residue | `.wi543.bak`, worktree-absolute paths | never treated as cache of current truth |

## 6. Cost model

Current: a worktree move can force a second paid AGY review; a restart
boundary burns an owner session; Stop false-success hides missing receipts.

Target: one paid independent review per required gate; relocate is free
digest I/O; planning is mechanical + one native self-review; children run
focused tests; one full Tier-1 at landing boundaries.

## 7. World grounding

| Source | Lesson mapped into POCCA |
|---|---|
| [Git Internals — Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) | Content-addressed object store: retrieve by digest, not by path. WI-547 objects follow this. |
| [Git notes](https://git-scm.com/docs/git-notes) and [Cloudflare Artifacts notes](https://blog.cloudflare.com/artifacts-git-for-agents-beta/) | Metadata attaches to a SHA without rewriting the object. Receipt envelopes stay in notes. |
| [Bazel remote CAS](https://en.wikipedia.org/wiki/Content-addressable_storage) | Build artifacts are stored by digest so a later machine can reuse exact bytes. Review packages should too. |
| [Temporal / Cadence workflows](https://docs.temporal.io/workflows) | A logical workflow survives process restart via a durable history, not by asking a human to paste the next prompt. WI-552 baton. |
| [Kubernetes lease / generation](https://kubernetes.io/docs/concepts/architecture/leases/) | Authority is generation-bound. WI-552 reuses WI-502 leases instead of inventing a second mutex. |
| [Terraform state locking](https://developer.hashicorp.com/terraform/language/state/locking) | Shared mutable policy/state must have one authority location. Chain-policy belongs in git-common-dir, not N worktree copies. |

## 8. Options considered

| Option | Summary |
|---|---|
| A. Keep current and tune only | chmod adapters, copy chain-policy into worktrees, keep notes as-is, keep Claude remap |
| B. Identical-hook mega-parity | Force every host to Claude-shaped hooks and Claude/Codex reviewers |
| C. Notes-only everything | Put bulky AGY packages into git notes or tracked files |
| D. POCCA (selected) | Portable outcomes + capability-declared adapters + split store + owner-external dispatch |

## 9. Tradeoff matrix

| | Quality | Cost | Latency | Size | Reversibility | Operational risk |
|---|---|---|---|---|---|---|
| A. Tune only | Low — PR #10 stays false-green | Low now, high later (re-reviews) | Low | Tiny | High | Repeat of WI-542 closeout |
| B. Mega-parity | False — claims Grok is Claude | High paid remap | High | Large | Low | Hidden fallback |
| C. Notes-only | Medium | Note-size / clone bloat | Medium | Medium | Medium | Notes are the wrong blob store |
| D. POCCA | High — honest per host | Planning free; one review per later land | Medium (split WIs) | Medium, sequential | High (per-child rollback) | Lowest remaining: host launch APIs |

## 10. Action-by-action approval packet

| Proposed action | Why | How | Positive | Negative / risk | If skipped | Required proof |
|---|---|---|---|---|---|---|
| Accept POCCA as the program architecture | Tune-only and mega-parity recreate the incident or a silent remap | Land this planning PR only | One DAG, no duplicate WIs | Wrong split would delay 547 | Another closeout false-green | This artifact + review-log |
| Treat WI-547 as landed foundation | PR #11 / `7bca62f3` plus passing `f27a143a` check | Reference, do not re-implement | No double implementation | Closeout docs for 547 may still be in flight | Re-implement and drift | Re-read `origin/main` WI-547 before each child plans |
| Land WI-545 separately and first among Stop work | 100644 adapters make Stop fixtures lie | `git update-index --chmod=+x` + setup fail-closed | Grok/Cursor Stop can run | Tiny race with closeout chmod | WI-546 Stop tests stay red | `git ls-tree` shows 100755 |
| Land WI-549 shared policy | Missing local file became warn | git-common-dir resolver, fail-closed refuse | All worktrees share refuse | Mis-seed could force refuse unexpectedly | PR-class closeout repeats | Fresh worktree without local file still refuse |
| Land WI-550 composite receipt keys + barrier | Dual-WI overwrite + false VERIFIED | Envelope key `{type,wi,sha}`; Stop rechecks | Honest completion | Legacy notes need a projection | Second WI still clobbers the first | Dual-WI fixture |
| Land WI-551 dispatch resolver before WI-552 | Continuation must ask `verify.restart` | Owner JSON at now + overlays | No silent Claude remap | Owner must create the file | Restart controller invents a fallback | Missing file refuses; Grok stays Grok |
| Land WI-552 continuation after 551+547 | Owner became the message bus | Hash-bound baton + exactly-once launch | One logical run | Host may lack a launch API | Owner paste remains “success” | Fake transport unit tests; live launch in 546 |
| Land WI-553 independently | Risk flags were documented but not compiled | Extra plan-contract sections only when matched | Cheap fail-closed | Over-trigger on docs-only WIs | Next host-rewire repeats G5 gaps | Negative no-flag fixture |
| Keep WI-546 as the live acceptance wave | Registration ≠ behavior | After 545/547/549/550/551/552 | Real Grok/Cursor/AGY proof | Temptation to start 546 early | “Parity” remains a manifesto | Setup + drift + fixtures listed in the matrix |
| Leave PR #10 landed | It merged as `223436ab` | No further closeout work in this DAG | Avoid re-opening a closed PR | None | Re-implement closeout | Status row in INDEX |
| Accept `.wi543.bak` as historical residue | File exists; hashes matched live after second rewire | Retain on disk; do not commit or restore | Avoid fake rollback | Lose a useless backup | None material | Path named in this packet |
| Do not invoke paid review while planning | Owner policy optional AGY; user forbid paid planning fixtures | Native Grok self-review + mechanical checks | Zero planning spend | No different-family stamp on the plan | Repeat AGY for a docs PR | review-log records capability-limited topology |

## 11. Outcome coverage

| Area | Best | Worst | Mitigation |
|---|---|---|---|
| Product UX | n/a (framework operators) | Operators still paste prompts | WI-552 + explicit blocker |
| Web / mobile | n/a | n/a | n/a |
| Data correctness | Dual-WI receipts and AGY bytes survive | Store/common-dir lost on new clone | Relocation + documented seed; notes still push |
| Cost / credits | One review per gate | Relocate triggers AGY again | Checker must not launch providers |
| Provider usage | AGY only when policy requires a new review | Planning or relocate pays AGY | This PR invokes none |
| Cache / freshness | Policy and entitlements re-read at now | Stale worktree policy | WI-549 |
| Scalability | Split landable WIs | One mega-implementation | DAG |
| Complexity | Eight children | Too many WIs | 546 was split because it was already three WIs |
| Reversibility | Per-child revert | Coupled land | No shared runtime commit in this PR |
| Support / ops | Capability-limited errors | Silent remap | Matrix + resolver fixtures |

## 12. Decision or remaining unknowns

**Selected:** POCCA. Children 545 / 549–553 / 546. WI-547 and PR #10 are landed inputs.

Remaining unknowns that do **not** block planning:

- Whether Grok/Cursor CLIs can start a fresh session with no human. WI-552
  must probe and record a blocker if not.
- Whether WI-547’s exact store path remains `svc-review-evidence` at land.
  Children must re-read that worktree/HEAD.
- Whether the owner will add a Grok key to reviewer-policy-v2. Framework
  must not invent one.

Confidence: high for architecture and sequence; medium for live fresh-session
launch APIs (explicitly deferred to WI-552/WI-546).

## 13. Base44 / AI suggestions triage

| Suggestion | Class | Reason |
|---|---|---|
| Require identical hooks on every host | reject | Hosts expose different events and decision formats |
| Treat AGY as a general orchestrator | reject | It is a Gemini reviewer transport |
| Silent Claude/Codex remap | reject | Owner-forbidden; root cause of WI-542 adapter mismatch |
| Content-addressed review store | adopt | Already being built in WI-547 |
| Owner-external dispatch file | adopt | Matches the dispatch proposal |
| Copy chain-policy into every worktree as authority | modify | Copy may exist as a mirror; authority is git-common-dir |
| Re-run AGY to unblock PR #10 | reject | User-forbidden; the defect is storage |
| Implement everything in this PR | reject | Planning only |
| Execution Controller v2 wholesale | defer | Only the restart-boundary slice is in scope |

## 14. User-facing summary

- Keep one portable delivery contract; let hosts differ honestly.
- WI-547 and PR #10 are already landed. Next implementation is WI-545 and WI-549..WI-553, then WI-546.
- Fix Stop adapter mode bits (WI-545), shared refuse (WI-549), and dual-WI receipt keys (WI-550) as separate small lands.
- Add an owner-external dispatch resolver (WI-551) before autonomous restart (WI-552).
- Keep risk-triggered plan contracts (WI-553) on their own track.
- Prove real Grok/Cursor/AGY behavior last, in WI-546.
- This PR plans that sequence. It does not change runtime.
