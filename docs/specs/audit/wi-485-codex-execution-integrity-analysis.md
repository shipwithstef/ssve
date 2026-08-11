# Systems Analysis: WI-485 Codex Execution Integrity

**Date:** 2026-07-14
**Branch:** `framework-WI-485-codex-execution-integrity`
**Core implementation candidate:** `8c0bfe07203cc5dce1c836a736123a36b3d2620c`

**Final audited commit:** `21500752`
**Spec:** `docs/specs/work-items/WI-485.md`
**Manifest:** `docs/plans/2026-07-14-wi485-codex-execution-integrity/manifest.md`

## Verification Contract

| AC | What code must do | Verified? | Evidence |
|---|---|---|---|
| AC-485-1 | Recorded foreign WI-479 Stop allows termination | Confirmed | Exact incident fixture at `validate-codex-execution-integrity.sh:89` |
| AC-485-2 | Continuation requires current session/turn prompt or later route binding | Confirmed | Positive, summary, negation, stale route, wrong-session, and wrong-turn fixtures; 88/88 focused suite |
| AC-485-3 | Fresh foreign claims cannot be stolen | Confirmed | Unknown, freshness-undecidable, and valid-fresh foreign claim fixtures |
| AC-485-4 | Governed mutation denies before and allows after exact skill load | Confirmed | Canonical apply-patch/Edit/Write matrix and exact loader-bootstrap fixtures |
| AC-485-5 | Foreign/stale/mismatched receipts deny; later unchanged turn allows | Confirmed | Session, task, graph, worktree, canonical hash/path, and later-turn matrix |
| AC-485-6 | Canonical mutation payloads and real plan paths are covered | Confirmed | Add/Delete/Update patch operations and `docs/plans/` fixture |
| AC-485-7 | Non-Codex source and registry surfaces remain invariant | Confirmed | `docs/specs/audit/wi-485-invariance-snapshot.json` |
| AC-485-8 | Report configured, effective-single-Stop, trusted, and runtime-observed separately | Partially confirmed pre-merge | Wirer emits all four fields at `wire-codex-hooks.mjs:433,461`; configured/effective are proven. Trust and runtime observation remain mandatory post-merge evidence. |
| AC-485-9 | Document PreToolUse limitations and post-action validation | Confirmed | Reference assertions in focused suite |
| AC-485-10 | Persist no raw prompt or secret | Confirmed | Exact schema allowlists and recursive raw/base64 sentinel scan at `validate-codex-execution-integrity.sh:201` |

## Coverage Ledger

| Subsystem | Entrypoints | ACs | Risk | Status | Findings |
|---|---|---|---|---|---|
| Prompt authority and Stop firewall | UserPromptSubmit, Stop | 1, 2, 3, 10 | Critical | audited | F-1, F-5 fixed |
| Skill receipt and mutation gate | PreToolUse, loader CLI | 4, 5, 6, 10 | Critical | audited | F-2, F-3 fixed |
| Hook reconciliation and transactions | setup/wirer | 7, 8 | High | audited | F-4 fixed; runtime obligation retained |
| Documentation and fixtures | reference, tier 1/2 | 1-10 | Medium | audited | coverage gaps closed |

## Hypotheses Tested

1. A WI mention without positive continuation intent can still pressure Stop. Confirmed before remediation for summary and natural negation forms; fixed and regression-fenced.
2. The first exact skill-loader command deadlocks behind its own receipt gate. Confirmed before remediation; fixed with one token-exact bootstrap exception.
3. A self-consistent receipt can point at arbitrary skill bytes. Confirmed before remediation; fixed by canonical hash plus approved-realpath membership.
4. A secondary nested Stop command or parse failure can produce duplicate/partial host state. Confirmed before remediation; fixed by full nested normalization, preflight, atomic replacement, and rollback.
5. Test-only path overrides can weaken production locality. Falsified after remediation: every relaxation is gated by `SVC_CODEX_TEST_MODE=1`; production remains repository-local.
6. Malformed authority time can bypass expiry. Confirmed as a defensive gap; fixed with a finite timestamp requirement.

## Findings

### F-1: Non-continuation and negated prompts pressured Stop

**Severity:** Critical  
**Confidence:** Confirmed  
**Type:** Security / AC violation  
**Location:** `hooks/codex/lib/codex-hook-context.mjs:165`  
**AC Impact:** AC-485-1, AC-485-2

**Observed:** Summary and natural negative instructions could be classified as continuation. Fable/Claude reproduced `do not try to continue WI-485` end to end as a blocking Stop decision.  
**Expected:** Only explicit, positive, current-turn continuation may invoke the completion guard.  
**Evidence:** Cross-model rounds 6-8; direct and soft-negation fixtures now pass.  
**Checked:** Positive `continue`, `resume`, and end-to-end paths remain valid.  
**Fix:** Added explicit continuation intent, broad natural-negation handling, finite authority timestamps, and fixtures.  
**Status:** FIXED.

### F-2: Loader bootstrap deadlocked before first receipt

**Severity:** Critical  
**Confidence:** Confirmed  
**Type:** Bug / AC violation  
**Location:** `hooks/codex/svc-codex-skill-load-enforcer.mjs:13-37`  
**AC Impact:** AC-485-4

**Observed:** The recovery loader itself was governed before any receipt could exist.  
**Expected:** The exact active graph/task/skill loader must be runnable without opening a general Bash bypass.  
**Evidence:** Exact command allows; altered task/skill/turn and shell metacharacter variants deny.  
**Fix:** Added a token-exact loader bootstrap exception whose CLI performs the full validation before writing.  
**Status:** FIXED.

### F-3: Self-consistent forged skill receipt passed

**Severity:** High  
**Confidence:** Confirmed  
**Type:** Security / data integrity  
**Location:** `hooks/codex/svc-codex-skill-load-enforcer.mjs:43-55`  
**AC Impact:** AC-485-5

**Observed:** A receipt hash was previously compared only with its own arbitrary `skill_path`.  
**Expected:** Receipt bytes and path must resolve to canonical skill evidence.  
**Evidence:** Fable/Claude live-probed framework and consumer layouts, path substitution with identical bytes, symlinks, stale installed copies, traversal names, and canonical sources.  
**Fix:** `resolveCanonicalSkill` selects in-repo source when present or the approved installed Codex source in a consumer repo; the enforcer requires both canonical hash and allowed realpath membership.  
**Status:** FIXED.

### F-4: Nested Stop and partial host writes escaped reconciliation

**Severity:** High  
**Confidence:** Confirmed  
**Type:** Bug / configuration integrity  
**Location:** `scripts/wire-codex-hooks.mjs:382-461`  
**AC Impact:** AC-485-8

**Observed:** Only the first nested hook command was reconciled/counted, and config could change before hooks validation failed.  
**Expected:** The effective user-plus-repository view contains one composite Stop, and failed reconciliation leaves host files byte-identical.  
**Evidence:** Both nested orders, malformed hooks, duplicate repository Stop, byte-identical failure, and rollback fixtures pass.  
**Fix:** Normalize all nested commands, validate the candidate effective view before writes, and use atomic replace with rollback.  
**Status:** FIXED pre-merge; live trust/observation remains a promotion obligation.

### F-5: Destructive session-contract fixture rewrite

**Severity:** High  
**Confidence:** Confirmed  
**Type:** Scope/data integrity  
**Location:** `.svc/session-contract.jsonl`  
**AC Impact:** execution trace integrity

**Observed:** An intermediate implementation replaced 20 pre-existing ledger records.  
**Expected:** The session contract is append-only.  
**Evidence:** The baseline first 20 lines are byte-identical; the candidate contains exactly two appended WI-485 records.  
**Fix:** Restored the baseline ledger and retained only the two append records.  
**Status:** FIXED.

## Specialist Convergence

- Testing specialist identified missing exact incident, route, hash-oracle, redaction, and structured-state coverage. All material gaps are now deterministic fixtures or the invariance snapshot.
- Scope specialist identified destructive ledger replacement, hidden nested Stop commands, partial writes, and the AC8 live-proof boundary. The first three are fixed; the live-proof boundary remains explicit.
- Security specialist identified F-1 through F-3. `docs/specs/security/wi-485-codex-execution-integrity-review.md` records the OWASP/STRIDE disposition.
- Fable/Claude cross-family review revised the implementation until APPROVE at `8c0bfe07`, then gave a final frozen-diff APPROVE at `21500752`; see `docs/specs/reviews/wi-485-codex-execution-integrity-exec-cross-model.md`.

## Validation

- `bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh` — 88 passed, 0 failed.
- `bash test-framework/evals/tier-1/validate-codex-hook-feature-flag.sh` — PASS.
- `bash test-framework/evals/tier-1/validate-stop-hook-stdin-preservation.sh` — PASS.
- `node scripts/lint-skills-manifest.mjs` — PASS.
- `bash test-framework/evals/run-all-evals.sh --tier1` — 239 scripts passed, 0 failed, 0 timed out.

The acceptance-critical pre/post classification is branch-introduced and fixed-by-change: every reproduced failing path above was converted into a passing regression fixture. No external deployment or data migration is involved.

## Residue

- No TODO/FIXME or temporary production flag was introduced.
- Test-only filesystem overrides require `SVC_CODEX_TEST_MODE=1` and do not alter production locality.
- The safe manifest deviation that governs `sed` and `node --check` instead of fast-pathing them is documented in the cross-model review.
- A pure consumer repo still requires svc task-graph infrastructure to run the loader end to end. This is an existing framework bootstrap dependency, not a WI-485 AC regression.

## Unverified Surfaces

- Codex `/hooks` trust confirmation after installing the merged revision.
- A live post-merge trace proving one governed deny, one post-load allow, and one foreign-Stop allow.
- These are AC-485-8 promotion checks and must not be represented as pre-merge PASS.

## Verdict

- [x] READY TO LAND — no unresolved Critical or High finding; AC-485-8 live evidence is assigned to verify-promotion.
- [ ] BLOCKED
- [ ] CONDITIONAL
