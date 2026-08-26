# SVC Execution Review Request — WI-SSVE-ARCHITECTURE-EVOLUTION-02

You are an independent adversarial EXECUTION reviewer for the svc framework (SSVE). Review the IMPLEMENTED CHANGESET below. Your findings gate promotion (T06 land). You have read access to the repository at the context root.

## What you are reviewing

- **Work item:** WI-SSVE-ARCHITECTURE-EVOLUTION-02 — SSVE Framework Architecture Evolution & Performance Preservation
- **Branch:** `feat/ssve-architecture-evolution-02`, single commit `1870dbc` on base `784b764b9af91dbcbd4167f3c317508fa6084677`
- **Diff command:** `git diff 784b764b9af91dbcbd4167f3c317508fa6084677..1870dbc` (49 files, +2336/−394)
- **Plan (binding):** `docs/plans/2026-08-24-ssve-architecture-evolution-plan.md` + `manifest.md` + `plan-contract.json` (same directory)
- **Plan review record:** `docs/specs/reviews/wi-ssve-evolution-plan-triple-review.md` (Grok APPROVE R2; Cursor overlap findings accepted into plan)
- **Wave evidence log:** `docs/specs/reviews/wi-ssve-evolution-e1-e4-validation.log`

## Delivered scope (verify implementation against this — no silent scope drops, no undeclared behavior)

| Wave | Contract | Key files |
|---|---|---|
| E1 | `mandatory_chain_segments` in `references/stage-registry.json`; `scripts/stage-segment.mjs` derives `SEGMENTS`; template staleness exit 2 (`stage-segment.mjs`, `audit-story-receipts.mjs`) | `validate-stage-registry-single-source.sh` extended |
| E2 | manifest `schema_version:1`, `dualRunSkillAllowlist.track-visuals`, `reviewGates.enforced_by`, lint `--stamp` digest sidecar (gitignored cache), pre-commit slot `21-manifest-integrity`, NEW validators `validate-manifest-integrity-stamp.sh` + `validate-gate-ownership-matrix.sh` | skills-manifest.json, lint-skills-manifest.mjs |
| E3 | `scripts/wire-hooks.mjs` subtractive rebuild (no isAlreadyWired / migrations / dedup passes); managed-helper predicate scoped to current skills tree or `/skills/{hooks,scripts}/` shape so FOREIGN same-basename hooks survive; `--remove-company-session-hooks` prune+write+exit preserved | validate-claude-wirer-cutover.sh (35 checks), variant-dedup repurposed |
| E4 | capability tiers + receipts in `references/host-hook-catalog.json`; Cursor `afterFileEdit` + Grok `PostToolUse` autoemit; Cursor payload normalizer in `hooks/lib/hook-payload.mjs`; cross-host conformance section | wire-cursor/wire-grok, catalog |

Resume-session remediation (T05 governance, same changeset): fixed invalid bash heredoc-pipe constructs in the two new validators; matchAll global-flag fix; `pipeline-decisions` wi pattern aligned to canonical WI-id grammar (schema + validator); structured `skill_receipt.phases_executed` backfill for lane tasks 3–4 (evidence = real tracked artifacts); session-contract `ts` row; scratch `.svc` files deleted; living-manifest amended (ownership T04–T09, census 18); `validate-plan-product-safety.sh` ACTIVE-contract selector changed from lexicographic to newest-committed (multi-plan branch bug).

## Known failures at validation time (353-script tier-1 corpus: 350 pass / 3 fail) — adjudicate these dispositions

1. `validate-codex-session-rebinding.sh` rc=1 on THIS branch AND on pristine origin/main worktree (verified): direct `svc-worktree-isolation-guard.mjs` denies while owner-recovery lease is armed ("owner recovery also bypasses a stale direct isolation hook"). Pre-existing drift, not a wave regression.
2. `validate-kimi-host.sh` check #8 "resolve-model.sh unexpectedly succeeded without owner dispatch policy" — fails identically on pristine main; kimi CLI absent on this machine. Validator/script contract drift, pre-existing.
3. Any failure you can reproduce on pristine main: cite the command and mark disposition PRE-EXISTING; anything that reproduces ONLY on this branch is a finding.

## Review lenses (cite file:line for every finding)

1. **Correctness** — subtractive rebuild equivalence (double-run stability, DISABLED/profile/minimal paths, kimi strip, company-hook prune semantics vs foreign preservation); stage-segment derivation vs registry; digest sidecar stamping.
2. **Security / fail-closed bias** — any weakened fail-closed posture? Manifest-integrity bypass? Wirer destroying user state irrecoverably? Backup-once + corrupt-config abort intact?
3. **Backwards compatibility** — exported shapes (SEGMENTS, CLI verbs/flags/exit codes), legacy installs converging in ONE run, validator fixtures referencing removed internals.
4. **Velocity preservation (binding directive)** — zero new blocking hooks; autoemit stays fail-open observational; agent-visible runtime cost limited to module-init JSON parses.
5. **Process integrity** — lane-task receipts, plan-contract parity amendments, evidence artifact honesty (no fabricated citations).
6. **D-2 decision point** — does the E3 cutover carry irreducible regression risk requiring the emergency migration-interpreter fallback, or proceed to land?

## Required output format (strict JSON, matching schemas/external-review-findings.schema.json)

```json
{
  "schema_version": 1,
  "review_kind": "exec",
  "rubric_score": null,
  "rubric_failures": null,
  "dependencies_needing_read": [],
  "reviewer": { "station": "<your-station-id>", "model": "<model>", "family": "<family>" },
  "verdict": "APPROVE | NEEDS_FIX",
  "summary": "...",
  "findings": [ { "id": "F-001", "severity": "CRITICAL|HIGH|MEDIUM|LOW", "lens": "...", "file": "path:line", "claim": "...", "evidence": "...", "required_action": "..." } ],
  "certifications": []
}
```

Verdict rules: any CRITICAL or unremediated HIGH ⇒ NEEDS_FIX. Do not re-demand items already landed by WI-562 (IP-H*, IP-R1–R5/R9, IP-W1–W3) — re-demanding them is a review error.

Frozen candidate binding: candidate_digest=`30a33c4c74c18ad93b78bfb352f4d7268e05d2019b651e55a55c03e751bc6945` (git-tree 867c5d0369cfedfb0920a18d09008453312dc928, commit 1870dbc).

Review round: 2 (round 1 aborted: bwrap sandbox kernel limitation, transport shim applied).

Review round: 3 (PATH-shim transport active).

Frozen candidate binding (round 5): candidate_digest=`d936f3a73977cbdb3c946d6c3800fd743b1f5268c67639417e680249602ab6a0`.

## Round 6 — post-cursor-r2 remediation closure (current binding)

Frozen candidate binding (round 6): commit `be5cd04`, git-tree `27618c6f99c8bd10e6637b5b0bb95822e356607c`,
candidate_digest=`288fe2d82654f712c97b0cc42086dea527f3461191a6950db6121530c223e6b6`
(derivation: `git archive be5cd04 | sha256sum`; tree is clean, index == HEAD).

Cursor-Auto R2 findings — remediation dispositions (verify each against this tree):

| ID | Claimed fix | Evidence to check |
|---|---|---|
| F-001 | Fail-closed restored: sidecar `.svc/manifest-digest.json` reclassified TRACKED (exec R5 F-006 amendment); missing sidecar ⇒ `errors.push` exit 1; pre-commit slot 21 additionally binds STAGED manifest ↔ STAGED digest as atomic pair | `scripts/lint-skills-manifest.mjs:227-241`, `hooks/git/pre-commit.d/21-manifest-integrity:25-50`, `test-framework/evals/tier-1/validate-manifest-integrity-stamp.sh:33-38` (passes 5/5), plan §E2.2 + plan-contract amendment |
| F-002 | D-1 verifier + gate JSON committed with autoemit Shell export; candidate restamped | tracked files `scripts/verify-d1-autoemit-host-payloads.mjs`, `docs/specs/reviews/wi-ssve-evolution-d1-autoemit-gate.json` (regenerated 2026-08-26T00:25Z, COMPATIBLE 4/4); commit `254e483` |
| F-003 | kimi strip narrowed to conjunction `isSvcOwnedCommand && /hooks\/kimi\//`; foreign-path fixture added | `scripts/wire-hooks.mjs:661-671`, foreign-kimi fixture in `validate-claude-wirer-cutover.sh` (passes) |
| F-004 | unknown step.skill rejected via `allowedSkills` param; bad-skill mutation fixture added | `scripts/lib/stage-registry.mjs:65-94`, `validate-stage-registry-single-source.sh:36` (passes) |
| F-005 | Receipt amended: 350 pass / 3 pre-existing fails, dispositions cited | `docs/specs/reviews/wi-ssve-evolution-delivery-receipt.md` rev 3 |

Focused validation on THIS tree (2026-08-26): manifest-integrity-stamp 5/5, gate-ownership-matrix PASS, stage-registry-single-source PASS, claude-wirer-cutover PASS, variant-dedup PASS, lint-skills-manifest exit 0, D-1 re-run COMPATIBLE 4/4 (p95 ≈ 45 ms).
