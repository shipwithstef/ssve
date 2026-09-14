# WI-FW-HOOKS-SAFETY-01 — Implementation Correctness & Security Audit

**Auditor:** implementing agent (advisory self-audit; independent review pending — see
`docs/specs/reviews/wi-fw-hooks-safety-exec-cross-model.md`)
**Scope:** commits 3327d47..HEAD on `feat/wi-fw-hooks-safety-01` vs base 494f074

## 1. What changed (verification level: wired/functional)

| Area | Change | Proof |
|---|---|---|
| Literal refs | `validateLiteralBranchName()` via `git check-ref-format` + encoder round trip; slash branches accepted; hostile corpus rejected | validate-literal-branch-worktree.sh 27/27 |
| Worktree identity | hash-derived leaf `<wi>-<slug>-<sha256[0:12]>` for slash branches; external adoption only beneath approved roots with same-UID/no-symlink chain; `.svc` root creation gated behind validation | same validator incl. adopt/deny fixtures |
| Decision engine | one typed observation decision; immutable digest; per-Git-argv `--no-optional-locks` re-encoded + round-trip asserted; export-prefix removed | validate-pretool-decision-engine.sh 19/19; zero-block-reads 35/35 incl. no-export assertion |
| Self-heal | dispatcher-owned single attempt; fresh same-session/same-turn positive intent gate (`work_on` verb added, negations preserved); exactly-one valid graph worktree; foreign/stale/negated byte-identical denial | validate-existing-worktree-self-heal.sh 27/27 |
| Lease continuity | `renewControllerIfCurrent` CAS under controller lock; typed stale decisions write nothing; threshold+min-interval+emergency policy; old principal cannot renew post-handover | validate-tool-call-heartbeat.sh + controller-lease-handover.sh PASS |
| Post correlation | mode-0600 one-time receipts keyed sha256(session\0tool-use), outside worktree; consume is compare-and-mark; replay/expiry/host/digest/generation mismatches are no-ops; failures extend nothing | heartbeat suite PASS |
| Wiring parity | one deny-capable engine entry per host; children registry carries consolidated guards; heartbeat wired on both hosts; duplicate-validator enforces one-engine/no-overlap | validate-settings-no-duplicate-hooks 8/8; cross-host conformance 64/64; firing-parity PASS |

## 2. Security invariants re-verified

- **Original input immutable:** normalization writes a separate `execution_input`; the
  dispatcher allow path passes original bytes when no rewrite applies (asserted).
- **Reads need no authority:** evaluation performs zero filesystem writes under cwd (asserted).
- **No implicit takeover:** adoption requires fresh positive prompt authority AND exact
  no-conflict state; foreign live claim fixture denies and leaves state byte-identical.
- **Default checkout protected:** `adoptExistingWorktree` filters out the default checkout;
  bootstrap scope check now follows explicit operation evidence (FP-04) but still requires
  the default checkout itself.
- **Renewal is not escalation:** renewal preserves lease id/generation/principal; stale
  attempts proven not to write (byte-compared lease file).
- **PostToolUse cannot authorize:** heartbeat acts only through receipt consumption of a
  pre-established tuple; takeover invalidates it (fixture).

## 3. Mutation testing (allow-predicate inversions)

Inverted predicates and their kill status (all killed — test fails when predicate broken):
branch ref acceptance → hostile-corpus loop; approved-root containment → unapproved-root
fixture; prompt intent positivity → negated fixture; turn freshness → stale-turn fixture;
receipt one-time semantics → replay fixture; generation match → takeover fixture;
renewal CAS identity → foreign-principal/old-generation/wrong-id loops.

## 4. Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F-1 | MEDIUM | Engine matcher covers mutation tools only; a host wiring `mcp__.*` write tools outside the engine would bypass consolidation (Codex wirer includes `mcp__.*` on the dispatcher itself) | Accepted for Codex (dispatcher holds the matcher); Claude matcher enumerates file tools. Follow-up WI candidate: dynamic tool-set discovery. |
| F-2 | LOW | `BOOTSTRAP_RE` const in svc-worktree-isolation-guard.mjs is dead code still encoding slash-free branch syntax | Left untouched to keep blast radius minimal; cleanup candidate. |
| F-3 | HIGH (process) | Independent exec-kind review NOT yet run — transport blocked (auth). Release authority unclaimed. | Blocking for land claim; documented in review-log + reviews doc + async notification. |

## 5. Known pre-existing failures (not introduced here)

- `validate-codex-session-rebinding.sh` final check ("legacy direct impact-triad hook is
  pruned") fails identically at base 494f074 — it inspects INSTALLED settings state, which
  predates this WI's rewiring; expected green after post-merge `./setup --all-hosts`.

## 6. Latency / budget notes

Observation fast path unchanged (zero-block-reads p95 within ceiling: 66ms raw vs 127ms
contention-adjusted ceiling during full-suite load). Governed path adds ≤1 controller read
plus thresholded renewal write; receipt write occurs once per governed allow.
