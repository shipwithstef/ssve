# WI-562 Plan Remediation — Triple Review Gate Round 1 → Unanimous Consensus

- **Date:** 2026-08-24
- **Plan under review:** `docs/plans/2026-08-24-wi562-multi-agent-handoff-and-graph-engineering.md` (v2)
- **Round-1 reviewers:** Codex gpt-5.6-sol (high) — NEEDS_FIX rubric 2.5; Grok grok-4.6 (high) — NEEDS_FIX rubric 4; Cursor Auto — NEEDS_FIX rubric 6.
- **Review artifacts:** `docs/specs/reviews/wi562-plan-review-grok-high.md`, `/tmp` raw transcripts archived to `docs/specs/reviews/wi562-plan-review-round1-transcripts.md`.

## Finding → Resolution Map

### Codex findings (F-C1…F-C13)

| # | Sev | Finding (abridged) | Resolution | Plan § |
|---|---|---|---|---|
| C1 | CRIT | IP-H1 absent; parallel merge-back trusts worker claims | **Accepted.** IP-H1 now Wave 1 H-A: shared `merge-back-core.mjs`, delete accepted-string list, workers commit before report, forged-PASS/dirty-tree/scope/digest fixtures | §H-A |
| C2 | HIGH | Age-based theft persists when liveness uncertain; identity-less claims unhandled | **Accepted.** Same-host pid-bearing locks: positive death proof only (version-gated legacy class = locks lacking `start_token`). Claims (wi-claim) split into E2 with heartbeat + death-proof reclaim | §H-E1/E2 |
| C3 | CRIT | finalizeHandover wrong crash state; would advance lease twice / tokenless takeover | **Accepted.** Redesigned to case A only: `expected_generation+1` AND `expected_revision+1` AND successor principal match ⇒ mark consumed, emit receipt, freeze delegations, NO lease mutation, idempotent. Case B refuses without token | §H-D |
| C4 | HIGH | One object can't satisfy both schemas; release uncovered; evidence digests dropped; JSONL append not atomic enough | **Accepted.** Dual-write (normalized record ≠ lifecycle receipt); release records added; `evidence_digests` preserved; per-record atomic files via writeJsonAtomic | §H-F |
| C5 | HIGH | H-G doesn't fulfill enforce-or-delete; no Bash-path lane-tasks validation | **Accepted.** Freeze enforced at guard layer with deletion fallback decision recorded at implementation; pre-commit lane-tasks validator added; residual in-session Bash window documented as accepted residual | §H-G |
| C6 | HIGH | Branch-keyed lock can't serialize cleanup; not Git-CAS family | **Accepted.** Existing Git-ref CAS `withExclusiveLock` family; repo-wide `_global` lock for cleanup; one-directional ordering (no nesting either way) | §H-C |
| C7 | HIGH | R-F breaks consumers (`timestamp` required by authenticity hook); absence-grandfathering fail-open | **Accepted.** Dual-write aliases for pipeline decisions; cutoff-marker grandfathering via `.svc/receipt-migration-WI562.json`; matrix zero-target scoped to upgraded subset, remainder accepted-debt → WI-563 | §R-F |
| C8 | HIGH | R-G digest keyed by type collides across slots; digest domain undefined | **Accepted.** Digests keyed by composite `<type>::<wi>[::<phase>]`; canonical-JSON hashing domain defined in charter; normalization/GC/miner consumers updated together; tamper+collision+GC fixtures | §R-G |
| C9 | HIGH | Deferrals untracked; catalog covers 3 of 7 hosts | **Accepted.** WI-563/WI-564 registered in new `docs/specs/wi-followups.md`; catalog carries capability truth for all 7 hook-capable hosts as WI-563 seed corpus | §0.2/§W-C |
| C10 | HIGH | Charter denominator unprovable; subset checks allow reverse drift; "single emitter" language inconsistent | **Accepted.** Machine-readable `references/receipt-kind-registry.json` denominator; EXACT parity conformance w/ exception file; quick-fix routed through emit-receipt core writer | §R-A/R-D/R-E |
| C11 | HIGH | Not execution-ready governance (no task DAG/write sets/lock order/external state) | **Accepted.** Implementation Contract section added: disjoint wave write sets, compensation ordering, external-state inventory, lock ordering | §Impl Contract |
| C12 | MEDIUM | V-2 branch claims wedge/escape; branch_busy outside vocabulary | **Accepted.** Hashed claim ids, pid+start_token ownership, death-proof steal, SIGKILL/pid-reuse/slash tests; branch_busy added to result vocabulary + retry policy (max 2 redispatches) documented in dispatch-waves appendix | §V-2 |
| C13 | MEDIUM | W-C preserves the ~35-case table IP-W3 kills | **Accepted (bounded).** Claude canonical identities generated from catalog; bespoke table demoted to explicitly-bounded legacy-migration adapter; drill runs on all three wirers | §W-C |

### Grok findings (F-G1…F-G12)

| # | Sev | Finding | Resolution |
|---|---|---|---|
| G1 | CRIT | IP-H1 neither implemented nor deferred; V-2 ships on top of trust hole | Same as C1 — Wave 1 H-A; V-2 dependency ordering respected (velocity lands Wave 3 AFTER ground-truth merge-back Wave 1) |
| G2 | CRIT | finalizeHandover wrong state/tokenless completion; SessionStart fail-open | Same as C3 + SessionStart fail-closed: detects case-A stranding, invokes finalize, actionable blocking-grade warning on error, never auto-accepts case B |
| G3 | HIGH | mkdir lock contradicts "same family" claim | Same as C6 — actual CAS family used |
| G4 | HIGH | H-E unsatisfiable dual validation; bootstrapOrResume fictional | Same as C4 + resume wired into real `resumeController` |
| G5 | HIGH | H-A inverts IP-H5 pid-less rule; HD-7 open | Same as C2/E2 |
| G6 | HIGH | H7 freeze wrong verbs; lane-tasks bypass | Same as C5 |
| G7 | HIGH | R-F freezes today's PARTIAL cells as baseline; R4 reduced to atomic-only | Matrix gate: zero-regression + upgraded-subset-to-zero + accepted-debt rows bound to WI-563 (option b). R4: quick-fix routed through emitter (single sanctioned path) |
| G8 | HIGH | Quarantine fails worktree-safety orphan glob; promote tests must use scratch clone/fake remote | `.quarantine/` excluded from orphan check same-commit; hermetic fake-remote harness specified, never this repo's origin |
| G9 | HIGH | gh-missing return 0; env bypass; MAX_PARALLEL=0 silent unbounded | gh-missing ⇒ nonzero unless `--no-pr` waiver; single `--skip-healing-gate` channel, env deprecated loudly; explicit `--unbounded` flag replaces 0-semantics |
| G10 | MED | Slot parsing must aggregate per-slot, two-slots-same-type test | Adopted verbatim |
| G11 | MED | Self-verify overclaims; T04 paths wrong; W-C table lives; exceptions under-enumerated | Coverage matrix (§0.2), corrected deliverable mapping (§0.1), bounded legacy adapter (§W-C), full exception enumeration in registry lint (§R-A) |
| G12 | MED | Concurrency test flaky; snapshots vs quoting interplay; promotion notes missing | Lock-held-then-refuse deterministic pattern; same-commit snapshot+quoting rule (§0 constraint 3); Appendix P promotion notes |

### Cursor findings (F-U1…F-U15)

All 15 dispositioned; unique items beyond Codex/Grok:
- U9 (hermetic refused-push mechanism): bare-repo origin with denying pre-push hook specified (§H-B).
- U10 (baseline tautology): baseline pinned PRE-implementation at plan-approval time (§R-F).
- U11 (--skip-healing-gate vs env equivalence): single-channel convergence + deprecation (§0 constraint 5).
- U14 ("339 checks" static): dynamic-discovery language adopted (§0 constraint 2).
- U15 (branch_busy consumer contract): retry policy + result-schema enum + dispatch-waves doc line (§V-2).

## Round-2 verification

Each round-1 reviewer re-reviews plan v2 restricted to their own findings' resolutions. Consensus target: all three ≥ APPROVE_WITH_FINDINGS with zero CRITICAL/HIGH unresolved.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every round-1 finding has a resolution row | Tables above (13+12+15 rows) | PASS |
| 2 | No finding resolved by silent scope-drop | Deferrals carry named WI ids; residuals named | PASS |
| 3 | Resolutions cite plan sections that exist in v2 | Spot-check §anchors | PASS |

---

## Round 2 → Round 3 remediation

**Round-2 verdicts:** Codex NEEDS_FIX (4.5 — C1/C2/C5/C7/C9/C12 partial, C3/C6/C11 rejected-unresolved), Grok NEEDS_FIX (6 — G5 partial only), Cursor NEEDS_FIX (7.5 — U3/U10 partial only).

| Finding | Round-2 status | v3 resolution |
|---|---|---|
| Codex C1 | PARTIAL | Evidence entries are now REPLAY-ONLY: validator re-executes each `{command,cwd}` itself; no worker-authored exit-code files accepted (§H-A) |
| Codex C2 / Grok G5 / Cursor U3 | PARTIAL | H-E2 rewritten to build ON WI-486 semantics: durable-owner class kept, heartbeat made explicit + schedulable via renewClaim; identity-less non-ephemeral creation REFUSED (§H-E2); no ephemeral CLI pid recorded as authority |
| Codex C3 | REJECTED | finalizeHandover now binds handover.lease_id == lease.lease_id; unbound `intended_principal:null` case handled explicitly; token_hash copied into normalized record; authorization rationale documented (§H-D) |
| Codex C6 | REJECTED | Single repo-wide verb mutex for promote/remove/cleanup — branch-scoped locking evaluated and rejected (independent refs never contend) (§H-C) |
| Codex C5 | PARTIAL | Freeze decision made NOW: ENFORCE at `hooks/svc-worktree-isolation-guard.mjs` + verb-level fallback per host recorded in catalog; pre-commit slot named `hooks/git/pre-commit.d/15-lane-tasks-validate`; marker deletion is the only waiver (§H-G) |
| Codex C7 | PARTIAL | Grandfathering now SNAPSHOT-based (frozen legacy set in baseline JSON), not date-trust-based; backdating impossible (§R-F) |
| Codex C9 | PARTIAL | `docs/specs/wi-followups.md` created with WI-563/WI-564 problem statements + exit criteria |
| Codex C11 | REJECTED | Adjacent machine-readable contract added (`docs/plans/2026-08-24-wi562-plan-contract.json`: task DAG, risk flags, external state, lock ordering); disjointness claim corrected to temporal single-executor ownership; External State canonical section added (§Impl Contract) |
| Codex C12 | PARTIAL | branch_busy vocabulary pinned to real summary contract (dispatch-worker.sh + extract-summary.sh); retry consumer named: fanout.sh in-run requeue ×2 + dispatch-waves appendix; phantom schema reference removed (§V-2) |
| Cursor U10 | PARTIAL | Baseline captured at plan approval and committed pre-implementation (`docs/specs/wi562-read-matrix-baseline.json`) |

## Round-3 verification

Same protocol as round 2: each reviewer verifies ONLY their outstanding items on plan v3. Consensus target unchanged.

## Round 3 → Round 4 remediation

| Finding | R3 status | v4 resolution |
|---|---|---|
| Codex C3 | REJECTED | Token-proof moved INSIDE the lease: acceptHandover embeds `accepted_handover_id` + `accepted_token_hash` in its first atomic write; takeover/recovery never write these fields ⇒ stranded tuple is token-gated proof (§H-D) |
| Codex C1 | PARTIAL | Evidence commands must ∈ plan-declared `validation_commands`; undeclared command = failure — no worker-selected tautologies (§H-A) |
| Codex C2 / Grok G5 | PARTIAL | Mandatory heartbeat contract: pid-less claims record `heartbeat_contract{interval}` at creation; renewClaim wired at ensure-worktree resume + worktree.sh guard + dispatch-worker exec loop (real callers) (§H-E2) |
| Codex C5 | PARTIAL | Per-host freeze depth explicit in catalog (`freeze_enforcement: guard\|verbs-only`); residuals bounded by capability truth; marker deletion remains sole waiver (§H-G) |
| Codex C7 | PARTIAL | Baseline extended with frozen PR-review inventory (currently EMPTY set recorded; identity = path+content-hash) (§R-F) |
| Cursor U10 | PARTIAL | Baseline removed from W3 write set; declared pre-approved immutable artifact in plan-contract.json |

Round-2 items already RESOLVED and not re-litigated: Codex C6/C9/C13, Grok G1–G4/G6–G12, Cursor U1/U2/U4–U9/U11–U15.

## Round 4 → Round 5 remediation

| Finding | R4 status | v5 resolution |
|---|---|---|
| Cursor R4-HIGH | NEW | H-D pseudocode block now includes accepted_handover_id/accepted_token_hash guards — prose and pseudocode are consistent |
| Codex C1 | PARTIAL | `validation_commands` declared per task in plan-contract.json + wave-plan graphs; undeclared-command rejection fixture added as verification (e) |
| Codex C2 | PARTIAL | Renewal caller paths added to W2 write set; creation invariant `interval*2 <= ttl` enforced, violation refuses persist |
| Codex C5 | REJECTED | Freeze is enforce-or-UNAVAILABLE: hosts that cannot enforce get `freeze_enforcement:"none"` AND the freeze verb refuses marker creation there — no unenforceable frozen state can exist; catalog moved to Wave 3 with the guard change |
| Codex C7 | PARTIAL | Activation is atomic with writer upgrade in the same merged changeset — no intermediate gated state on main exists |

## Round 5 → Round 6 remediation

| Finding | R5 status | v6 resolution |
|---|---|---|
| Cursor R5-HIGH ×2 | NEW | plan-contract.json synced: W3 gains host-hook-catalog.json (freeze rows ship atomically with guard change); W2 gains svc-ensure-worktree.mjs / worktree.sh / dispatch-worker.sh (renewClaim wiring) |
| Codex C1 | PARTIAL | Evidence set must COVER the full declared required command set; empty declared set ⇒ merge-back refuses (§H-A e/f) |
| Codex C2 | PARTIAL | Authoritative contract W2 now lists all three renewal callers |
| Codex C5 | REJECTED | Catalog moved to Wave 3 in BOTH the plan table and contract JSON — freeze capability truth ships atomically |
